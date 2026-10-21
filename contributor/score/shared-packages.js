// Shared records are authoritative. Local IndexedDB is deliberately not consulted
// when assembling a shared task or matching a returned response.
import {clone,identify,newReview,validateReview,sha256,roles} from './model.js';
import {makeRecovery,makePackage,zipFiles} from './export.js';
import {makeTask,finalizeTask,localTaskDelivery,readPackage,readResponse,responseRevision,strictJSON,json,LIMITS,promptFor} from './workflow.js';
import {workspaceSeed,restoreReturnedBackup} from './returned.js';
import {canonical} from './completion-model.js';
import {retain,retained} from './handoff-store.js';

const safeId=value=>typeof value==='string'&&/^[\w-]{1,80}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=message=>{throw new Error(message);};
const checkedPath=id=>{if(!safeId(id))fail('The shared record identifier is invalid.');return encodeURIComponent(id);};
const parse=async blob=>{if(!blob||blob.size>LIMITS.json)fail('The task metadata is missing or too large.');return strictJSON(await blob.text());};
const completionInspections=new WeakMap();

export async function blobBase64(blob){
  if(!blob||blob.size>LIMITS.zip)fail('The package exceeds the supported size limit.');
  const bytes=new Uint8Array(await blob.arrayBuffer());let encoded='';
  // Multiples of three allow independently encoded chunks without middle padding.
  for(let offset=0;offset<bytes.length;offset+=24576)encoded+=btoa(String.fromCharCode(...bytes.subarray(offset,offset+24576)));
  return encoded;
}

// A local completion contributes exact evidence, never imported approval or
// instructions. Keep its original ZIP unchanged for the authenticated service
// to validate independently; never reconstruct missing lineage from prose.
export async function inspectLocalCompletion(blob,inspectPdf){
  const parsed=await readPackage(blob,inspectPdf),manifest=parsed.manifest,bundle=parsed.completionBundle;
  if(manifest.kind!=='completed-review-handoff'||typeof manifest.completionId!=='string'||!bundle)fail('Choose the completed-review ZIP saved by Finish review. A recovery package or historical declaration alone is not a completed contribution.');
  const completion=bundle.records.find(record=>record.id===manifest.completionId);
  if(!completion||completion.revision.id!==bundle.revisionId||completion.revision.snapshotId!==parsed.review.snapshotId||completion.hashes.annotations!==await sha256(await parsed.payloads.get('annotations.json').arrayBuffer())||roles.some(role=>completion.hashes[role]!==parsed.review.files[role].sha256))fail('The completion does not describe the exact files in this package. Keep the original completed-review ZIP.');
  let restored;
  try{restored=await restoreReturnedBackup(parsed,inspectPdf);}catch{fail('The completion’s original task and response evidence is missing or invalid. Keep the unchanged completed-review ZIP.');}
  if(Boolean(completion.evidence.returned)!==Boolean(restored))fail('The completion is missing its original task and response evidence.');
  let issued=null,entry=null;
  if(restored){
    issued=await hydrateTaskPackage(await zipFiles(restored.issued.payloads),inspectPdf,{expectedId:completion.revision.taskId});
    entry=restored.entry;
    if(entry.id!==completion.revision.responseId||issued.id!==completion.revision.taskId||issued.task.baseline.sourceSha256!==parsed.review.files.source.sha256||entry.taskId!==issued.id)fail('The completion lineage does not match its original task and returned response.');
  }
  const originalPackageSha256=await sha256(await blob.arrayBuffer());
  const inspected={blob,originalPackageSha256,completion:clone(completion),parsed,issued,entry,
    candidate:{snapshotId:parsed.review.snapshotId,files:parsed.review.files},baseline:issued?clone(issued.task.baseline):null,
    codeChanged:issued?issued.task.baseline.codeSha256!==parsed.review.files.ly.sha256:null,
    summary:{scope:completion.scope,scopeNote:completion.scopeNote,reviewer:completion.reviewer,createdAt:completion.createdAt,findings:completion.totals.all,unresolved:completion.totals.unresolved,hasReturnedEvidence:Boolean(issued),sourceName:parsed.files.source.name,renderedName:parsed.files.rendered.name,lyName:parsed.files.ly.name}};
  completionInspections.set(inspected,blob);return inspected;
}

export async function prepareLocalCompletionImport(blobOrInspected,inspectPdf,{requestId=crypto.randomUUID()}={}){
  if(!safeId(requestId))fail('The upload request identifier is invalid.');
  const inspected=completionInspections.has(blobOrInspected)?blobOrInspected:await inspectLocalCompletion(blobOrInspected,inspectPdf),blob=completionInspections.get(inspected);
  return {...inspected,submit:{requestId,package:await blobBase64(blob)}};
}

async function verifiedAsset(client,info,role){
  if(!info||!digest(info.sha256)||typeof info.url!=='string')fail(`The shared ${role} asset is not available. Ask the project maintainer to prepare this work's assets.`);
  const blob=await client.asset(info.url);
  if(blob.size>LIMITS.file||(info.size!=null&&blob.size!==info.size)||await sha256(await blob.arrayBuffer())!==info.sha256)fail(`The shared ${role} bytes do not match the recorded revision. Keep your draft and retry after the project assets are repaired.`);
  return {name:info.name??({source:'source-original.pdf',rendered:'rendered-original.pdf',ly:'supplied.ly'})[role],blob};
}

export async function loadSharedWork(client,workOrCurrent,inspectPdf){
  const current=workOrCurrent.current??workOrCurrent,identities=current.files??workOrCurrent.assets;
  if(!identities)fail('This work has no prepared source, rendering and LilyPond revision.');
  const files={};for(const role of roles)files[role]=await verifiedAsset(client,identities[role],role);
  const {identity,snapshotId}=await identify(files);
  if(current.snapshotId&&snapshotId!==current.snapshotId)fail('The shared files no longer match the captured work revision. Reload the work before continuing.');
  const pages=await inspectPdf(files),review=newReview(identity,snapshotId,pages);
  return {files,review,current};
}

export async function prepareSharedReport(scene,options={}){
  const {scope,clean=false,displayName='',requestId=crypto.randomUUID(),kinds={},discussion,includePackage=false,proposalId}=options;
  if(!scene?.review||!scene.files)fail('Open a score before submitting findings.');
  const {identity,snapshotId}=await identify(scene.files),expected=newReview(identity,snapshotId,scene.review.pages);
  const review=validateReview(scene.review,expected);
  // Retain original timestamps after validating the geometry and file identities.
  review.updatedAt=scene.review.updatedAt;
  if(!review.findings.length&&!clean)fail('Add findings, or select “I found no errors.”');
  if(clean&&review.findings.length)fail('A clean review cannot also contain findings. Submit the findings instead.');
  if(!scope||!['report','partial','whole'].includes(scope.kind)||typeof scope.description!=='string'||!scope.description.trim())fail('Enter the pages or passages you checked.');
  if(clean&&scope.kind==='report')fail('Choose a partial or whole-work review before making a clean declaration.');
  for(const finding of review.findings)if(!['transcription','source_error','clarification'].includes(kinds[finding.id]??'transcription'))fail('Choose an encoding error, suspected source error, or clarification for each finding.');
  const result={requestId,review,scope:clone(scope),clean:clean===true,displayName:String(displayName).slice(0,200),kinds:clone(kinds)};
  if(proposalId!=null){if(!safeId(proposalId))fail('The proposed score identity is invalid.');result.proposalId=proposalId;}
  // Known shared revisions already have immutable file blobs. The service can
  // assemble their recovery package without making a one-finding reporter upload
  // the entire printed edition again. Explicit file transfer remains available.
  if(includePackage)result.package=await blobBase64(await zipFiles(await makeRecovery(review,scene.files)));
  if(discussion)result.discussion=clone(discussion);
  return result;
}

async function openPdf(blob){
  const pdfjs=await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
  return pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,enableXfa:false,
    cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,
    standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,
    wasmUrl:new URL('./vendor/wasm/',import.meta.url).href}).promise;
}

function validateSnapshot(snapshot){
  if(!snapshot||!safeId(snapshot.id)||!safeId(snapshot.workId)||!Array.isArray(snapshot.findings)||snapshot.findings.length>2000)fail('The shared snapshot is invalid or exceeds the supported 2,000-finding package limit.');
  const ids=new Set();for(const f of snapshot.findings){
    if(!safeId(f.id)||ids.has(f.id)||!Number.isSafeInteger(f.version)||f.version<1||!safeId(f.reportId)||!f.author||typeof f.author.id!=='string'||typeof f.author.login!=='string'||typeof f.comment!=='string'||f.comment.length>4000||!['transcription','source_error','clarification'].includes(f.kind)||!f.reviewed||!['snapshotId','sourceSha256','codeSha256','renderSha256'].every(k=>digest(f.reviewed[k])))fail('A shared finding is missing its stable identity, authorship, or exact original revision.');
    ids.add(f.id);
  }
}

function isCurrent(f,review){
  return f.reviewed.snapshotId===review.snapshotId&&f.reviewed.sourceSha256===review.files.source.sha256&&f.reviewed.codeSha256===review.files.ly.sha256&&f.reviewed.renderSha256===review.files.rendered.sha256&&canonical(f.pages)===canonical(review.pages);
}

function currentAnnotation(f,number){
  if(!f.annotation)fail('A finding is missing its original annotation context.');
  return {...clone(f.annotation),id:f.id,number,comment:f.comment,state:f.kind!=='transcription'?'needs_source_clarification':'open'};
}

function requestFor(f,number,current){
  const mark=current?currentAnnotation(f,number):null;
  return {id:f.id,number,page:mark?.page??null,comment:f.comment,kind:f.kind,
    author:clone(f.author),displayName:f.displayName??'',reportId:f.reportId,version:f.version,
    origin:{taskId:null,findingId:f.id,originalId:f.originalId??f.annotation?.id,reportId:f.reportId,
      page:f.annotation?.page??null,renderSha256:f.reviewed.renderSha256,comment:f.comment,reviewed:clone(f.reviewed)},
    reviewer:{state:f.state,explanation:'',decision:null},instructionHistory:[],
    currentAnchor:mark?{findingId:f.id,page:mark.page,bounds:mark.bounds,comment:mark.comment}:null,
    historicalContext:{page:f.annotation?.page??null,renderSha256:f.reviewed.renderSha256},
    history:clone(f.history??[]),discussion:clone(f.discussion??null)};
}

function packageSize(payloads){
  let size=0;for(const blob of payloads.values()){if(blob.size>LIMITS.file)fail('One package asset exceeds 100 MB. The shared reports remain saved.');size+=blob.size;}
  if(payloads.size>LIMITS.count||size>LIMITS.zip-1024*1024)fail('This complete snapshot exceeds the portable package limit. The shared reports remain saved; a maintainer must divide the work into bounded review units.');
}

export async function makeSharedTask(client,snapshot,options={}){
  validateSnapshot(snapshot);
  const {inspectPdf,packageMaker=makePackage,onProgress=()=>{},openPdf:openDocument=openPdf,requestId=crypto.randomUUID()}=options;
  const selected=snapshot.findings.filter(f=>f.state!=='resolved');
  if(!selected.length)fail('There are no outstanding submitted findings to send for correction. This does not imply complete review or verification.');
  onProgress('Loading the exact files for this shared revision…');
  const current=await loadSharedWork(client,snapshot.current??{files:snapshot.assets},inspectPdf);
  const review=clone(current.review),requests=selected.map((f,i)=>requestFor(f,i+1,isCurrent(f,review)));
  review.findings=selected.filter(f=>isCurrent(f,review)).map(f=>currentAnnotation(f,requests.find(r=>r.id===f.id).number));
  review.nextNumber=requests.length+1;
  validateReview(review,newReview(review.files,review.snapshotId,review.pages));
  let doc;let issued;
  try{doc=await openDocument(current.files.rendered.blob);issued=await makeTask(review,current.files,doc,'page',onProgress,packageMaker);}finally{await doc?.destroy?.();}
  issued.task.version=2;issued.task.findings=requests;
  issued.task.shared={schema:'score-desk-shared-task',version:1,snapshotId:snapshot.id,workId:snapshot.workId,revision:snapshot.revision,
    findingVersions:selected.map(f=>({id:f.id,version:f.version})),snapshotPath:'shared/snapshot.json'};
  issued.payloads.set('shared/snapshot.json',json(snapshot));
  const oldByReport=new Map();
  for(const f of selected){
    const request=requests.find(r=>r.id===f.id);
    if(isCurrent(f,review)){
      const prefix=`findings/${String(request.number).padStart(3,'0')}-${f.id}`;
      for(const kind of ['marked','clean']){
        const path=`${prefix}-${kind}.png`;
        if(!issued.payloads.has(path))fail('The current finding context was not generated. Retry the complete package.');
        request.historicalContext[kind]=path;
      }
    }else{
      if(!oldByReport.has(f.reportId))oldByReport.set(f.reportId,[]);
      oldByReport.get(f.reportId).push(f);
    }
  }
  for(const [reportId,findings]of oldByReport){
    onProgress('Preserving original context for findings against an earlier revision…');
    const reportUrl=findings[0].reportPackage??`/api/reports/${checkedPath(reportId)}/package`;
    const original=await readPackage(await client.asset(reportUrl),inspectPdf);
    const oldReview=clone(original.review);oldReview.findings=[];
    for(const finding of findings){
      const old=original.review.findings.find(f=>f.id===(finding.originalId??finding.annotation?.id));
      if(!old||old.comment!==finding.comment||canonical(old)!==canonical(finding.annotation)||original.review.snapshotId!==finding.reviewed.snapshotId||original.review.files.source.sha256!==finding.reviewed.sourceSha256||original.review.files.ly.sha256!==finding.reviewed.codeSha256||original.review.files.rendered.sha256!==finding.reviewed.renderSha256||canonical(original.review.pages)!==canonical(finding.pages))fail('A historical finding no longer matches its immutable report. No coordinates have been copied to the current score.');
      oldReview.findings.push(currentAnnotation(finding,requests.find(r=>r.id===finding.id).number));
    }
    oldReview.nextNumber=requests.length+1;
    let oldDoc,contexts;
    try{oldDoc=await openDocument(original.files.rendered.blob);contexts=await packageMaker(oldReview,original.files,oldDoc,'page',onProgress);}finally{await oldDoc?.destroy?.();}
    const historyPrefix=`historical/reports/${reportId}`;
    const originals={};for(const role of roles){
      const path=`historical/assets/${original.review.files[role].sha256}.${role==='ly'?'ly':'pdf'}`;
      issued.payloads.set(path,original.files[role].blob);originals[role]={path,...original.review.files[role]};
    }
    issued.payloads.set(`${historyPrefix}/annotations.json`,original.payloads.get('annotations.json'));
    issued.payloads.set(`${historyPrefix}/identity.json`,json({reportId,reviewed:findings[0].reviewed,files:originals,
      annotations:`${historyPrefix}/annotations.json`,note:'Historical original files and geometry. Never apply these coordinates to the current rendering.'}));
    for(const finding of findings){
      const request=requests.find(r=>r.id===finding.id),prefix=`findings/${String(request.number).padStart(3,'0')}-${finding.id}`;
      for(const kind of ['marked','clean']){
        const blob=contexts.get(`${prefix}-${kind}.png`);if(!blob)fail('An earlier finding context could not be generated. The shared records remain saved.');
        const path=`historical/findings/${finding.id}-${kind}.png`;issued.payloads.set(path,blob);request.historicalContext[kind]=path;
      }
      request.historicalContext.originalFiles=originals;
      request.historicalContext.annotations=`${historyPrefix}/annotations.json`;
    }
  }
  await finalizeTask(issued);
  packageSize(issued.payloads);
  issued.zip=await zipFiles(issued.payloads,onProgress);issued.prompt=await issued.payloads.get('PROMPT.txt').text();
  // Validate the bytes a fresh browser will receive before advertising a package.
  await hydrateTaskPackage(issued.zip,inspectPdf,{expectedId:issued.id,expectedSharedSnapshotId:snapshot.id});
  issued.submit={requestId,snapshotId:snapshot.id,package:await blobBase64(issued.zip)};
  return issued;
}

export async function hydrateTaskPackage(blob,inspectPdf,expected={}){
  if(expected.sha256&&await sha256(await blob.arrayBuffer())!==expected.sha256)fail('The shared task package digest differs from its immutable record.');
  const parsed=await readPackage(blob,inspectPdf),task=await parse(parsed.payloads.get('task.json'));
  const expectedBaseline={snapshotId:parsed.review.snapshotId,sourceSha256:parsed.review.files.source.sha256,
    codeSha256:parsed.review.files.ly.sha256,renderSha256:parsed.review.files.rendered.sha256,
    annotationSha256:await sha256(await parsed.payloads.get('annotations.json').arrayBuffer())};
  if(task.schema!=='score-desk-task'||![1,2].includes(task.version)||!safeId(task.id)||task.kind!=='correction-existing-transcription'||parsed.manifest.taskId!==task.id||expected.expectedId&&task.id!==expected.expectedId||canonical(task.baseline)!==canonical(expectedBaseline)||!Array.isArray(task.findings)||task.findings.length>2000)fail('The original task identity or baseline does not match its exact package.');
  const ids=new Set(),numbers=new Set();for(const f of task.findings){
    if(!safeId(f.id)||ids.has(f.id)||!Number.isSafeInteger(f.number)||f.number<1||f.number>99999||numbers.has(f.number)||typeof f.comment!=='string'||f.comment.length>4000)fail('The original task findings are invalid or duplicated.');
    ids.add(f.id);numbers.add(f.number);
    if(task.version===1){const annotation=parsed.review.findings.find(a=>a.id===f.id);if(!annotation||annotation.number!==f.number||annotation.page!==f.page||annotation.comment!==f.comment)fail('The original task differs from its annotation baseline.');}
    if(task.version===2&&f.currentAnchor){const annotation=parsed.review.findings.find(a=>a.id===f.id);if(!annotation||f.currentAnchor.findingId!==f.id||f.currentAnchor.page!==annotation.page||canonical(f.currentAnchor.bounds)!==canonical(annotation.bounds)||f.currentAnchor.comment!==annotation.comment||f.page!==annotation.page)fail('The task current anchor differs from the exact current annotation.');}
    if(task.version===2&&!f.currentAnchor&&f.page!==null)fail('An unlocated historical finding cannot claim a current page.');
    if(task.version===2&&f.historicalContext){for(const kind of ['marked','clean']){const path=f.historicalContext[kind];if(typeof path!=='string'||!parsed.payloads.has(path))fail('The task is missing a finding’s original visual context.');}}
  }
  if(task.version===1&&parsed.review.findings.length!==task.findings.length)fail('The original task omits baseline findings.');
  if(task.version===2&&parsed.review.findings.some(a=>!task.findings.some(f=>f.id===a.id&&f.currentAnchor)))fail('The task has unrelated current annotations.');
  if(task.shared){
    const shared=task.shared;
    if(shared.schema!=='score-desk-shared-task'||shared.version!==1||!safeId(shared.snapshotId)||!safeId(shared.workId)||shared.snapshotPath!=='shared/snapshot.json'||expected.expectedSharedSnapshotId&&shared.snapshotId!==expected.expectedSharedSnapshotId||!Array.isArray(shared.findingVersions))fail('The shared task extension is invalid.');
    const snapshot=await parse(parsed.payloads.get(shared.snapshotPath));validateSnapshot(snapshot);
    const outstanding=snapshot.findings.filter(f=>f.state!=='resolved');
    if(snapshot.id!==shared.snapshotId||snapshot.workId!==shared.workId||snapshot.revision!==shared.revision||canonical(shared.findingVersions)!==canonical(outstanding.map(f=>({id:f.id,version:f.version})))||outstanding.length!==task.findings.length)fail('The task does not represent its complete captured shared snapshot.');
    if(snapshot.current?.snapshotId!==parsed.review.snapshotId)fail('The captured shared snapshot has a different current baseline.');
    const verifiedHistory=new Map(),historicalReviews=new Map();
    for(const f of outstanding){
      const request=task.findings.find(r=>r.id===f.id),current=isCurrent(f,parsed.review);
      if(!request||request.version!==f.version||canonical(request.author)!==canonical(f.author)||request.reportId!==f.reportId||request.comment!==f.comment||request.kind!==f.kind||canonical(request.origin?.reviewed)!==canonical(f.reviewed)||Boolean(request.currentAnchor)!==current)fail('Shared finding identity, authorship, or original context differs from the captured snapshot.');
      if(current){
        if(canonical(parsed.review.findings.find(a=>a.id===f.id))!==canonical(currentAnnotation(f,request.number)))fail('The current annotation differs from its original shared report.');
      }else{
        const context=request.historicalContext;
        for(const [role,key]of [['source','sourceSha256'],['rendered','renderSha256'],['ly','codeSha256']]){
          const info=context?.originalFiles?.[role],asset=parsed.payloads.get(info?.path);
          if(!info||!asset||info.sha256!==f.reviewed[key]||info.size!==asset.size)fail('The task is missing exact original historical file identities.');
          if(!verifiedHistory.has(info.path))verifiedHistory.set(info.path,await sha256(await asset.arrayBuffer()));
          if(verifiedHistory.get(info.path)!==f.reviewed[key])fail('Historical file bytes differ from the original shared report.');
        }
        const path=context?.annotations;
        if(!historicalReviews.has(path))historicalReviews.set(path,await parse(parsed.payloads.get(path)));
        const original=historicalReviews.get(path);
        if(original.snapshotId!==f.reviewed.snapshotId||canonical(original.pages)!==canonical(f.pages)||!original.findings?.some(a=>canonical(a)===canonical(f.annotation))||roles.some(role=>original.files?.[role]?.sha256!==context.originalFiles[role].sha256))fail('Historical annotations differ from the original shared report.');
      }
    }
  }else if(expected.expectedSharedSnapshotId)fail('The shared task is missing its captured snapshot identity.');
  return {id:task.id,kind:'task',createdAt:task.createdAt,task,review:parsed.review,files:parsed.files,payloads:parsed.payloads,zip:blob,prompt:promptFor(task)};
}

export async function loadSharedTask(client,taskId,inspectPdf){
  const id=checkedPath(taskId),record=await client.request(`/api/tasks/${id}`);
  const instructions=record.instructions;
  if(instructions?.schema!=='score-desk-trusted-instructions'||instructions.version!==2||typeof instructions.prompt!=='string'||!digest(record.packageSha256))fail('The project service must prepare trusted instructions before this task can be downloaded. Its original ID and baseline are retained.');
  const issued=await hydrateTaskPackage(await client.asset(record.packageUrl??`/api/tasks/${id}/package`),inspectPdf,
    {expectedId:taskId,sha256:record.packageSha256??record.package?.sha256,expectedSharedSnapshotId:record.snapshotId??record.task?.shared?.snapshotId});
  const policy=await parse(issued.payloads.get('instruction-policy.json'));
  if(await issued.payloads.get('PROMPT.txt')?.text()!==instructions.prompt||policy.schema!==instructions.schema||policy.version!==instructions.version||canonical(policy.guidance)!==canonical(instructions.guidance)||record.task&&canonical(record.task)!==canonical(issued.task))fail('The task instructions differ from the trusted project record.');
  const paths=['project-guidance/AGENTS.md','project-guidance/HANDBOOK.md'];
  if(!instructions.guidance||Object.keys(instructions.guidance).length!==paths.length)fail('Trusted project guidance is missing.');
  for(const path of paths){const payload=issued.payloads.get(path),expected=instructions.guidance[path];if(!payload||!digest(expected)||await sha256(await payload.arrayBuffer())!==expected)fail('The bundled guidance differs from the trusted project instructions.');}
  issued.prompt=instructions.prompt;issued.instructions=clone(instructions);return issued;
}

// A legacy local task can also travel as its original ZIP. Validation is identical
// to a shared task download; this explicit import adds the original task identity,
// never a replacement task or a weakened response baseline.
export async function retainPortableTask(blob,inspectPdf,{lookup=retained,write=retain}={}){
  const issued=await hydrateTaskPackage(blob,inspectPdf);
  async function same(existing){
    if(existing?.kind!=='task'||existing.id!==issued.id||!(existing.payloads instanceof Map)||existing.payloads.size!==issued.payloads.size||canonical(existing.task?.baseline)!==canonical(issued.task.baseline))return false;
    for(const [path,payload]of issued.payloads){const before=existing.payloads.get(path);if(!before||before.size!==payload.size||await sha256(await before.arrayBuffer())!==await sha256(await payload.arrayBuffer()))return false;}
    return true;
  }
  const existing=await lookup(issued.id);
  if(existing){
    if(await same(existing))return existing;
    // A download of this original's exact installed-app projection is safe to
    // reopen. Compare the incoming bytes with that projection, not two lossy
    // projections of arbitrary uploads, and never replace the retained original.
    if(existing.kind==='task'&&canonical(existing.task?.baseline)===canonical(issued.task.baseline)){
      try{if(await same(await localTaskDelivery(existing)))return existing;}catch{/* A malformed original is not a match. */}
    }
    fail('This task ID already exists with different original bytes. The retained original task has not been replaced.');
  }
  try{await write(issued);return issued;}
  catch(error){
    // Another tab may have imported the same immutable original while this tab
    // was validating it. Only byte-for-byte equality permits that safe retry.
    const concurrent=await lookup(issued.id);
    if(concurrent&&await same(concurrent))return concurrent;
    throw error;
  }
}

export async function readSharedResponse(client,blob,inspectPdf){
  const parsed=await readResponse(blob,id=>loadSharedTask(client,id,inspectPdf));
  if(parsed.response.rendering.status==='supplied')await inspectPdf({source:parsed.issued.files.source,rendered:{name:parsed.response.rendering.path,blob:parsed.payloads.get(parsed.response.rendering.path)}});
  return parsed;
}

export async function loadSharedProposal(client,proposalOrId,inspectPdf){
  const proposal=typeof proposalOrId==='string'?await client.request(`/api/proposals/${checkedPath(proposalOrId)}`):proposalOrId;
  if(!proposal||!safeId(proposal.id))fail('The proposed revision identifier is invalid.');
  const blob=await client.asset(proposal.packageUrl??`/api/proposals/${checkedPath(proposal.id)}/package`);
  const expected=proposal.packageSha256??proposal.package?.sha256;
  if(expected&&await sha256(await blob.arrayBuffer())!==expected)fail('The response package differs from its shared record.');
  const parsed=await readSharedResponse(client,blob,inspectPdf),entry=responseRevision(parsed);
  if(proposal.taskId&&proposal.taskId!==parsed.issued.id)fail('The proposed revision belongs to a different original task.');
  entry.id=proposal.id;entry.createdAt=proposal.createdAt??entry.createdAt;
  if(proposal.parentProposalId)entry.parentRevisionId=proposal.parentProposalId;
  const seed=entry.response.code.status==='changed'&&entry.response.rendering.status==='pending'?null:await workspaceSeed(entry,parsed.issued,inspectPdf);
  if(seed){
    const current=proposal.candidateCurrent,{identity,snapshotId}=await identify(seed.files);
    if(!current||current.snapshotId!==snapshotId||current.origin?.kind!=='proposal'||current.origin.proposalId!==proposal.id||roles.some(role=>current.files?.[role]?.sha256!==identity[role].sha256||current.files[role].size!==identity[role].size))fail('The proposed score files differ from the shared candidate revision.');
    seed.current=clone(current);
    if(proposal.renderingProvenance)seed.returned.provenance={...seed.returned.provenance,sharedRendering:clone(proposal.renderingProvenance),parentProposalId:proposal.parentProposalId??null};
  }
  return {entry,issued:parsed.issued,seed,proposal,blob};
}

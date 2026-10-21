// Returned-review metadata is separate from the content-hashed annotation model.
import {clone,identify,newReview,sha256,STATES} from './model.js';
import {retained} from './handoff-store.js';
import {makeRecovery,zipFiles} from './export.js';
import {makeTask,finalizeTask,taskFindings,contextPaths,seal,json,plain,readPackage,readResponse,strictJSON} from './workflow.js';
export const resultState={changed:'corrected_pending_review',unchanged_with_reason:'open',needs_clarification:'needs_source_clarification'};
// Instructions outlive approval. Each issued follow-up contributes one entry;
// opening its response starts a fresh decision without losing earlier wording.
function instructionsFrom(f,issued){
  const history=clone(f.instructionHistory??[]),explanation=f.reviewer?.explanation??'',regionComment=f.currentAnchor?.comment??'';
  if(explanation||regionComment)history.push({taskId:issued.id,codeSha256:issued.task.baseline.codeSha256,renderSha256:issued.task.baseline.renderSha256,explanation,regionComment});
  return history;
}
const instructionText=history=>(history??[]).map(h=>`Task ${h.taskId}\nReviewer: ${h.explanation||'[No additional explanation]'}\nAnnotation comment: ${h.regionComment||'[None]'}`).join('\n\n');
export async function restoreInstructionHistory(round){
  if(!round||round.reported.every(f=>f.instructionHistory!==undefined))return false;
  const issued=await retained(round.taskId);if(!issued)throw new Error('The issued task is missing; earlier human instructions cannot be restored.');
  for(const f of round.reported)if(f.instructionHistory===undefined){const original=taskFindings(issued).find(item=>item.id===f.id);f.instructionHistory=original?instructionsFrom(original,issued):[];}
  return true;
}
export function returnedInputs(entry,issued,attachment=null){
  const response=entry.response,code=response.code.status==='changed'?{name:response.code.path.split('/').at(-1),blob:entry.payloads.get(response.code.path)}:issued.files.ly;
  const rendered=attachment?attachment.rendered:response.rendering.status==='supplied'?{name:response.rendering.path.split('/').at(-1),blob:entry.payloads.get(response.rendering.path)}:response.code.status==='unchanged'?issued.files.rendered:null;
  return {source:issued.files.source,ly:code,rendered};
}
export async function workspaceSeed(entry,issued,inspectPdf,attachment=null){
  const files=returnedInputs(entry,issued,attachment);if(!files.rendered)throw new Error('Updated rendering pending. Attach an existing PDF before reviewing changed code or exporting a follow-up.');
  const {identity,snapshotId}=await identify(files),pages=await inspectPdf(files),review=newReview(identity,snapshotId,pages);
  if(attachment&&(attachment.responseId!==entry.id||attachment.codeSha256!==identity.ly.sha256||attachment.rendered.sha256!==identity.rendered.sha256))throw new Error('This rendering attachment belongs to a different code revision.');
  const reported=taskFindings(issued).map(f=>{
    const agent=entry.response.results.find(r=>r.id===f.id),legacy=entry.findings.find(r=>r.id===f.id),state=attachment?resultState[agent.status]:legacy?.state??resultState[agent.status];
    return {id:f.id,number:f.number,comment:f.origin?.comment??f.comment,origin:f.origin??{taskId:issued.id,findingId:f.id,page:f.page,renderSha256:issued.task.baseline.renderSha256},context:contextPaths(issued,f),agent:clone(agent),state,explanation:'',instructionHistory:instructionsFrom(f,issued),associationId:null,decision:state==='resolved'?{state,explanation:'Earlier explicit human decision for this exact revision.',reviewed:{snapshotId,codeSha256:identity.ly.sha256,renderSha256:identity.rendered.sha256}}:null};
  });
  review.nextNumber=Math.max(0,...reported.map(f=>f.number))+1;review.preferences=clone(issued.review.preferences);
  const returned={schema:'score-desk-returned-workspace',version:1,id:`returned:${entry.id}:${attachment?.id??'received'}`,responseId:entry.id,taskId:issued.id,parentRevisionId:entry.parentRevisionId??entry.id,attachmentId:attachment?.id??null,contentSnapshotId:snapshotId,codeSha256:identity.ly.sha256,renderSha256:identity.rendered.sha256,provenance:attachment?.provenance??{relationship:'supplier-declared; not established by compilation',supplier:entry.response.rendering.producer??'original user-supplied baseline',compiler:entry.response.rendering.compiler??null},reported};
  return {files,review,returned};
}
export async function renderingAttachment(entry,issued,file,inspectPdf){
  if(!file||file.size>100*1024*1024)throw new Error('Select a local PDF smaller than 100 MB.');
  const inputs=returnedInputs(entry,issued);await inspectPdf({source:inputs.source,rendered:{name:file.name,blob:file}});
  return {id:crypto.randomUUID(),kind:'render-attachment',version:1,createdAt:new Date().toISOString(),taskId:issued.id,responseId:entry.id,parentRevisionId:entry.id,codeSha256:await sha256(await inputs.ly.blob.arrayBuffer()),rendered:{name:file.name,blob:file,size:file.size,sha256:await sha256(await file.arrayBuffer())},provenance:{supplier:'Local contributor selecting an existing PDF',declaredAt:new Date().toISOString(),relationship:'supplier-declared; not established by compilation',compiler:null,compilationPerformedByScoreDesk:false}};
}
export async function followupTask(scene,context,progress,packageMaker){
  const {review,files,returned:round,doc}=scene;if(!round)throw new Error('Open a returned revision first.');
  if(review.files.ly.sha256!==round.codeSha256||review.files.rendered.sha256!==round.renderSha256)throw new Error('The current files do not match this returned revision.');
  const issued=await retained(round.taskId),entry=await retained(round.responseId),outstanding=round.reported.filter(f=>f.state!=='resolved'),associated=new Set(round.reported.map(f=>f.associationId).filter(Boolean));
  const current=clone(review);current.findings=[];
  const requests=outstanding.map(f=>{
    const mark=review.findings.find(m=>m.id===f.associationId),old=taskFindings(issued).find(m=>m.id===f.id);
    if(mark)current.findings.push({...clone(mark),id:f.id,number:f.number,state:f.state});
    return {id:f.id,number:f.number,page:mark?.page??null,comment:f.comment,origin:clone(f.origin),reviewer:{state:f.state,explanation:f.explanation,decision:clone(f.decision)},instructionHistory:clone(f.instructionHistory??[]),priorResponse:{taskId:round.taskId,responseId:round.responseId,result:clone(f.agent)},currentAnchor:mark?{findingId:f.id,page:mark.page,bounds:mark.bounds,comment:mark.comment}:null,historicalContext:{page:old?.historicalContext?.page??old?.page??f.origin.page,renderSha256:old?.historicalContext?.renderSha256??issued.task.baseline.renderSha256}};
  });
  for(const f of review.findings)if(!associated.has(f.id)&&f.state!=='resolved'){current.findings.push(clone(f));requests.push({id:f.id,number:f.number,page:f.page,comment:f.comment,origin:{taskId:null,findingId:f.id,page:f.page,renderSha256:review.files.rendered.sha256,comment:f.comment},reviewer:{state:f.state,explanation:f.comment},instructionHistory:[],currentAnchor:{findingId:f.id,page:f.page,bounds:f.bounds,comment:f.comment},historicalContext:{page:f.page,renderSha256:review.files.rendered.sha256}});}
  if(!requests.length)throw new Error('There are no outstanding or new findings to send back. This does not establish whole-score verification.');
  const task=await makeTask(current,files,doc,context,progress,packageMaker);task.task.version=2;task.task.findings=requests;task.task.parent={workspaceId:round.id,responseId:round.responseId,taskId:round.taskId,contentSnapshotId:round.contentSnapshotId};
  for(const request of requests){const original=round.reported.find(f=>f.id===request.id),paths=original?original.context:['marked','clean'].map(type=>`findings/${String(request.number).padStart(3,'0')}-${request.id}-${type}.png`);
    for(let i=0;i<2;i++){const path=`historical/${request.id}-${i?'clean':'marked'}.png`,blob=(original?issued.payloads:task.payloads).get(paths[i]);if(blob){task.payloads.set(path,blob);request.historicalContext[i?'clean':'marked']=path;}}
  }
  task.payloads.set('historical/previous-rendering.pdf',issued.files.rendered.blob);task.payloads.set('historical/prior-response.json',json(entry.response));
  const lines=['','FOLLOW-UP OUTSTANDING FINDINGS (historical pages are never current anchors)'];
  for(const f of requests)lines.push(`\n#${f.number} | ${f.id}`,`Current page: ${f.page??'not located; inspect historical context and complete current render'}`,`Original: ${f.comment}`,`Current annotation: ${f.currentAnchor?.bounds?'marked passage':f.currentAnchor?'text-only; page context only':'not located'}`,`Current annotation comment: ${f.currentAnchor?.comment||'[None]'}`,`Reviewer: ${f.reviewer.explanation||'[No additional explanation]'}`,`Earlier human instructions (historical, not approval):\n${instructionText(f.instructionHistory)||'[None]'}`,`Historical context: ${JSON.stringify(f.historicalContext)}`,`Origin: ${JSON.stringify(f.origin)}`,`Previous agent response: ${JSON.stringify(f.priorResponse??null)}`);
  task.payloads.set('review.txt',plain(await task.payloads.get('review.txt').text()+lines.join('\n')+'\n'));await finalizeTask(task);return task;
}
// A v1 package extension: older consumers retain ordinary current annotations;
// this app restores the explicit returned-workspace sidecar as a recovery branch.
export async function makeReturnedBackup(review,files,round,payloads=null){
  payloads??=await makeRecovery(review,files);const issued=await retained(round.taskId),entry=await retained(round.responseId);
  const metadata={schema:'score-desk-returned-workspace-backup',version:1,returned:round,issued:{id:issued.id,kind:'task',createdAt:issued.createdAt,task:issued.task,review:issued.review},entry:{...entry,payloads:undefined},taskPaths:[],responsePaths:[]};
  for(const [path,blob]of issued.payloads){payloads.set('history/task/'+path,blob);metadata.taskPaths.push(path);}
  for(const [path,blob]of entry.payloads){payloads.set('history/response/'+path,blob);metadata.responsePaths.push(path);}
  payloads.set('returned-workspace.json',json(metadata));const manifest=JSON.parse(await payloads.get('manifest.json').text());manifest.extensions=[{schema:metadata.schema,version:1,path:'returned-workspace.json'}];
  payloads.set('review.txt',plain(await payloads.get('review.txt').text()+'\nRETURNED REVISION REVIEW\n'+round.reported.map(f=>`#${f.number} ${f.id} | ${f.state}\nOriginal: ${f.comment}\nReviewer: ${f.explanation}\nEarlier human instructions (historical, not approval):\n${instructionText(f.instructionHistory)||'[None]'}\nAI: ${f.agent.explanation}\nDecision: ${JSON.stringify(f.decision)}`).join('\n\n')));return seal(payloads,manifest);
}
export async function restoreReturnedBackup(parsed,inspectPdf){
  const extensions=parsed.manifest.extensions?.filter(e=>e.schema==='score-desk-returned-workspace-backup');if(!extensions?.length)return null;
  if(extensions.length!==1||extensions[0].version!==1||extensions[0].path!=='returned-workspace.json')throw new Error('Unsupported returned-review extension.');
  const meta=strictJSON(await parsed.payloads.get('returned-workspace.json').text());if(meta.schema!=='score-desk-returned-workspace-backup'||meta.version!==1)throw new Error('Unsupported returned-workspace backup.');
  const taskMap=new Map(meta.taskPaths.map(path=>[path,parsed.payloads.get('history/task/'+path)])),taskPackage=await readPackage(await zipFiles(taskMap),inspectPdf),task=strictJSON(await taskMap.get('task.json').text()),issued={...meta.issued,task,review:taskPackage.review,files:taskPackage.files,payloads:taskMap};
  if(![1,2].includes(task.version)||issued.id!==task.id||task.schema!=='score-desk-task'||task.baseline.snapshotId!==taskPackage.review.snapshotId||task.baseline.codeSha256!==taskPackage.review.files.ly.sha256||task.baseline.renderSha256!==taskPackage.review.files.rendered.sha256||task.baseline.sourceSha256!==taskPackage.review.files.source.sha256||task.baseline.annotationSha256!==await sha256(await taskMap.get('annotations.json').arrayBuffer())||!Array.isArray(task.findings)||task.findings.length>2000||new Set(task.findings.map(f=>f.id)).size!==task.findings.length)throw new Error('The retained task baseline in this backup does not match.');
  const responseMap=new Map(meta.responsePaths.map(path=>[path,parsed.payloads.get('history/response/'+path)]));const response=await readResponse(await zipFiles(responseMap),async id=>id===issued.id?issued:null),entry={...meta.entry,response:response.response,payloads:responseMap};
  if(entry.kind!=='response'||entry.taskId!==issued.id||typeof entry.id!=='string'||!/^[-\w]{1,80}$/.test(entry.id))throw new Error('Returned response metadata is invalid.');
  const round=meta.returned,code=returnedInputs(entry,issued).ly;
  if(round.schema!=='score-desk-returned-workspace'||round.version!==1||round.taskId!==issued.id||round.responseId!==entry.id||round.contentSnapshotId!==parsed.review.snapshotId||round.codeSha256!==parsed.review.files.ly.sha256||round.codeSha256!==await sha256(await code.blob.arrayBuffer())||parsed.review.files.source.sha256!==task.baseline.sourceSha256||round.renderSha256!==parsed.review.files.rendered.sha256||!Array.isArray(round.reported)||round.reported.length!==task.findings.length)throw new Error('Returned-review identity mismatch.');
  const ids=new Set(task.findings.map(f=>f.id));for(const f of round.reported){
    const finding=task.findings.find(item=>item.id===f.id),agent=entry.response.results.find(item=>item.id===f.id);
    if(!ids.delete(f.id)||f.number!==finding.number||typeof f.comment!=='string'||f.comment.length>4000||!STATES.includes(f.state)||typeof f.explanation!=='string'||f.explanation.length>4000||JSON.stringify(f.agent)!==JSON.stringify(agent)||!Array.isArray(f.context)||f.context.length!==2||f.context.some(path=>typeof path!=='string'||!taskMap.has(path))||!f.origin||f.state==='resolved'&&!f.decision||f.decision&&(f.decision.state!==f.state||f.decision.reviewed.snapshotId!==round.contentSnapshotId||f.decision.reviewed.codeSha256!==round.codeSha256||f.decision.reviewed.renderSha256!==round.renderSha256))throw new Error('Returned-review decision or finding mismatch.');
  }
  return {issued,entry,seed:{files:parsed.files,review:parsed.review,completionBundle:parsed.completionBundle,returned:{...round,id:'returned:recovery:'+crypto.randomUUID(),recoveredFrom:round.id}}};
}

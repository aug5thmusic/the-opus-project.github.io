// Trusted test fixture: run the actual pre-security-update exporter, with only
// browser persistence and canvas-derived crop generation replaced by test data.
// No uploaded code, prompt, guidance or LilyPond is executed.
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
import {fixtureBlob} from './fixtures.js';

export const LEGACY_EXPORTER_REF='a4a1319';
export const LEGACY_EXPORTER_COMMIT='a4a1319d598d81993e6fff035fe5f00d1ac19afb';
export const LEGACY_EXPORTER_FIXTURE_SHA256='4ae3dc6247276a2576e74ce37f9a27cc6509927bb9d24dc4358ff1dd93ceb5ed';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const pages=[{page:1,view:[0,0,612,792],rotation:0,userUnit:1}];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9B0AAAAASUVORK5CYII=','base64');
// Git may convert JSON formatting newlines on Windows; embedded source bytes
// are escaped JSON strings and stay exact under that checkout conversion.
const frozenBytes=(await readFile(new URL('./fixtures/legacy-exporter-a4a1319.json',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
if(digest(frozenBytes)!==LEGACY_EXPORTER_FIXTURE_SHA256)throw Error('Frozen legacy exporter fixture digest differs.');
const frozen=JSON.parse(frozenBytes);
if(frozen.schema!=='opus-frozen-legacy-exporter'||frozen.version!==1||frozen.commit!==LEGACY_EXPORTER_COMMIT)throw Error('Frozen legacy exporter identity differs.');
const previous=path=>{const file=frozen.files[path];if(!file||digest(file.source)!==file.sha256)throw Error('Frozen legacy exporter source digest differs: '+path);return Buffer.from(file.source,'utf8');};

export async function legacyCompletionFixture(options={}){
  globalThis.crypto??=webcrypto;
  if(!globalThis.JSZip){const module={exports:{}};Function('module','exports',await readFile(new URL('../vendor/jszip.min.js',import.meta.url),'utf8'))(module,module.exports);globalThis.JSZip=module.exports;}
  const parent=join(root,'.build','legacy-completion-fixtures');await mkdir(parent,{recursive:true});
  const directory=await mkdtemp(join(parent,'trusted-'));
  const names=['model.js','export.js','workflow.js','returned.js','completion-model.js','completion.js','github-handoff.js'];
  await Promise.all(names.map(name=>writeFile(join(directory,name),previous('contributor/score/'+name))));
  await writeFile(join(directory,'package.json'),' {"type":"module"}\n');
  await writeFile(join(directory,'handoff-store.js'),'export const records=new Map(); export async function retain(entry){if(records.has(entry.id))throw Error("Duplicate fixture record");records.set(entry.id,entry);return entry;} export async function retained(id){return records.get(id);}\n');
  await writeFile(join(directory,'storage.js'),'export async function returnedHistory(){return [];}\n');
  const load=name=>import(pathToFileURL(join(directory,name)).href);
  const [model,exp,workflow,returned,completion,store]=await Promise.all(['model.js','export.js','workflow.js','returned.js','completion.js','handoff-store.js'].map(load));
  const baselineFiles=options.baselineFiles??{source:{name:'legacy-source.pdf',blob:await fixtureBlob('source.pdf')},rendered:{name:'legacy-baseline.pdf',blob:await fixtureBlob('rendered.pdf')},ly:{name:'legacy-score.ly',blob:await fixtureBlob('score.ly')}};
  const candidateFiles=options.candidateFiles??(options.reviewOnly?baselineFiles:{...baselineFiles,ly:{name:'legacy-proposed.ly',blob:new Blob([baselineFiles.ly.blob,'\n% SIMULATED corrected proposal, not musical verification\n'])}});
  const baselinePages=options.baselinePages??pages,candidatePages=options.candidatePages??baselinePages;
  const {identity,snapshotId}=await model.identify(baselineFiles),review=model.newReview(identity,snapshotId,baselinePages);
  const findingCount=options.findingCount??1;
  if(!Number.isSafeInteger(findingCount)||findingCount<1||findingCount>10)throw Error('Fixture findingCount must be between 1 and 10.');
  const findingState=options.findingState??'open';
  if(!['open','corrected_pending_review','resolved','needs_source_clarification'].includes(findingState))throw Error('Unsupported fixture findingState.');
  review.findings=Array.from({length:findingCount},(_,index)=>({id:index===0?'legacy-finding-one':`legacy-finding-${index+1}`,number:index+1,page:1,comment:options.comment??`SIMULATED bar ${index+2}: compare the upper voice with the print.`,state:findingState,color:'#ffd34d',strokes:[],bounds:null}));review.nextNumber=findingCount+1;
  async function packageMaker(review,files){
    const payloads=await exp.makeRecovery(review,files);
    for(const f of review.findings)for(const kind of ['clean','marked'])payloads.set(`findings/${String(f.number).padStart(3,'0')}-${f.id}-${kind}.png`,new Blob([png]));
    for(const name of ['AGENTS.md','HANDBOOK.md'])payloads.set('project-guidance/'+name,new Blob([previous(name)]));
    return workflow.seal(payloads,JSON.parse(await payloads.get('manifest.json').text()));
  }
  if(options.reviewOnly){
    const current=await model.identify(candidateFiles),currentReview=model.newReview(current.identity,current.snapshotId,candidatePages);
    const scene={files:candidateFiles,review:currentReview,returned:null,doc:{},workspaceId:current.snapshotId,revisionId:crypto.randomUUID(),persistedRevision:1,completions:[]};
    const {record,payloads}=await completion.prepareCompletion(scene,{scope:options.scope??'partial',note:options.scopeNote??'SIMULATED page 1 only',reviewer:options.reviewer??'@legacy-typed-name'},{id:crypto.randomUUID(),createdAt:'2026-10-20T12:00:00.000Z'},()=>{},packageMaker);
    return {zip:await exp.zipFiles(payloads),payloads,record,issued:null,entry:null,scene,baselineFiles,candidateFiles,baselinePages,candidatePages,exporterRef:LEGACY_EXPORTER_REF,directory};
  }
  async function respond(task,files){
    const response=JSON.parse(await task.payloads.get('response-template.json').text()),responsePayloads=new Map(),changed=await model.sha256(await task.files.ly.blob.arrayBuffer())!==await model.sha256(await files.ly.blob.arrayBuffer());
    if(changed){response.code={status:'changed',path:'proposed.ly'};responsePayloads.set('proposed.ly',files.ly.blob);}
    response.rendering={status:'supplied',path:'proposed.pdf',producer:options.producer??'SIMULATED old local rendering declaration',compiler:null};responsePayloads.set('proposed.pdf',files.rendered.blob);
    response.files=Object.fromEntries(await Promise.all([...responsePayloads].map(async([path,blob])=>[path,await workflow.fileInfo(blob)])));
    response.results=task.task.findings.map(finding=>({id:finding.id,status:changed?'changed':'unchanged_with_reason',explanation:options.explanation??'SIMULATED local correction proposal; compare with the source.',codeLocation:`upper voice, bar ${finding.number+1}`}));responsePayloads.set('response.json',workflow.json(response));
    const responseZip=await exp.zipFiles(responsePayloads),entry=workflow.responseRevision(await workflow.readResponse(responseZip,store.retained));await store.retain(entry);return {responseZip,entry};
  }
  let issued=await workflow.makeTask(review,baselineFiles,{},'page',()=>{},packageMaker);await store.retain(issued);
  if(options.followUp){
    // The first real response keeps canonical source/code bytes. Reassociation
    // changes only current observation wording, preserving the original report.
    const prior=await respond(issued,baselineFiles),priorSeed=await returned.workspaceSeed(prior.entry,issued,async()=>baselinePages);
    for(const finding of priorSeed.returned.reported){
      finding.state=findingState==='needs_source_clarification'?findingState:'open';
      finding.explanation=options.reviewExplanation??'SIMULATED reviewer asks for another source comparison.';
      finding.decision=null;finding.associationId=`legacy-reassociated-${finding.number}`;
      finding.instructionHistory=[{taskId:issued.id,codeSha256:issued.task.baseline.codeSha256,renderSha256:issued.task.baseline.renderSha256,explanation:'SIMULATED earlier reviewer wording retained as history.',regionComment:''}];
      priorSeed.review.findings.push({id:finding.associationId,number:priorSeed.review.nextNumber++,page:1,comment:`SIMULATED current anchor note ${finding.number}: inspect the lower voice as well.`,state:finding.state,color:'#ffd34d',strokes:[],bounds:null});
    }
    issued=await returned.followupTask({...priorSeed,doc:{}},'page',()=>{},packageMaker,{lookup:store.retained});await store.retain(issued);
  }
  const {responseZip,entry}=await respond(issued,candidateFiles);
  const seed=await returned.workspaceSeed(entry,issued,async()=>candidatePages);
  for(const finding of seed.returned.reported){
    finding.state='resolved';finding.explanation=options.reviewExplanation??'SIMULATED local reviewer checked the correction.';
    finding.decision={state:'resolved',explanation:finding.explanation,at:'2026-10-20T12:00:00.000Z',reviewed:{snapshotId:seed.review.snapshotId,codeSha256:seed.review.files.ly.sha256,renderSha256:seed.review.files.rendered.sha256}};
  }
  if(options.additionalCandidateFinding){seed.review.findings.push({id:'legacy-new-candidate-finding',number:seed.review.nextNumber++,page:1,comment:'SIMULATED new observation on the proposed revision, unrelated to the old marks.',state:'open',color:'#ffd34d',strokes:[],bounds:null});}
  const scene={...seed,doc:{},workspaceId:seed.returned.id,revisionId:crypto.randomUUID(),persistedRevision:1,completions:[]};
  const {record,payloads}=await completion.prepareCompletion(scene,{scope:options.scope??'partial',note:options.scopeNote??'SIMULATED page 1 only',reviewer:options.reviewer??'@legacy-typed-name'},{id:crypto.randomUUID(),createdAt:'2026-10-20T12:00:00.000Z'},()=>{},packageMaker);
  return {zip:await exp.zipFiles(payloads),payloads,record,issued,entry,responseZip,scene,baselineFiles,candidateFiles:seed.files,baselinePages,candidatePages,exporterRef:LEGACY_EXPORTER_REF,directory};
}

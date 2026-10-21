import {identify,sha256,newReview,validateReview,clone,roles} from './model.js';
import {makePackage} from './export.js';
import {retain,retained} from './handoff-store.js';
import {COMPLETION_EXTENSION,validateCompletionBundle,exactReview} from './completion-model.js';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export const json=value=>new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'});
export const plain=value=>new Blob([value],{type:'text/plain;charset=utf-8'});
const fail=message=>{throw new Error(message);};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const pathOK=name=>typeof name==='string'&&name.length<=240&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)&&!name.split('/').some(p=>!p||p==='.'||p==='..');
export const LIMITS={zip:256*1024*1024,total:512*1024*1024,file:100*1024*1024,count:5000,ratio:200,json:25*1024*1024};

// JSON.parse alone silently accepts duplicate object keys. These manifests are
// identity contracts, so reject ambiguity at every level (also bounded depth).
export function strictJSON(text){
  let i=0;const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
  function string(){const start=i++;while(i<text.length){const ch=text[i++];if(ch==='\\'){i++;continue;}if(ch==='"')return JSON.parse(text.slice(start,i));}fail('Incomplete JSON text.');}
  function value(depth=0){if(depth>60)fail('JSON nesting is excessive.');ws();const ch=text[i];
    if(ch==='"')return string();
    if(ch==='{'||ch==='['){const object=ch==='{',result=object?Object.create(null):[],keys=new Set();i++;ws();if(text[i]===(object?'}':']')){i++;return result;}
      while(i<text.length){ws();if(object){if(text[i]!=='"')fail('Invalid JSON object.');const key=string();if(keys.has(key)||key==='__proto__')fail('Duplicate or unsafe JSON key.');keys.add(key);ws();if(text[i++]!==':')fail('Invalid JSON object.');result[key]=value(depth+1);}else result.push(value(depth+1));ws();const end=text[i++];if(end===(object?'}':']'))return result;if(end!==',')fail('Invalid JSON separator.');}fail('Incomplete JSON object.');}
    const token=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0];if(!token)fail('Invalid JSON value.');i+=token.length;return JSON.parse(token);
  }
  const result=value();ws();if(i!==text.length)fail('Unexpected text after JSON.');return result;
}
const parse=async(blob,limit=LIMITS.json)=>{if(!blob||blob.size>limit)fail('Missing or oversized JSON file.');try{return strictJSON(await blob.text());}catch(e){fail('Package JSON is invalid: '+e.message);}};

// Inspect raw central and local headers BEFORE JSZip sees compressed data.
// No extraction to disk; even approved imported scripts are never executed.
export function inspectZip(buffer){
  const bytes=new Uint8Array(buffer),v=new DataView(buffer),n=bytes.length;
  if(n>LIMITS.zip||n<22)fail('ZIP is missing or exceeds the 256 MB limit.');
  let end=-1;for(let p=n-22;p>=Math.max(0,n-65557);p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===n){end=p;break;}
  if(end<0)fail('ZIP directory is incomplete.');
  const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),offset=v.getUint32(end+16,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count||count===65535||!count||count>LIMITS.count||offset+size!==end)fail('Unsupported or excessive ZIP directory.');
  const entries=[],seen=new Set(),ranges=[];let p=offset,total=0;
  for(let index=0;index<count;index++){
    if(p+46>end||v.getUint32(p,true)!==0x02014b50)fail('Invalid ZIP entry.');
    const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),packed=v.getUint32(p+20,true),unpacked=v.getUint32(p+24,true),len=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
    if(p+46+len+extra+comment>end)fail('Invalid ZIP entry length.');
    const raw=bytes.slice(p+46,p+46+len),name=decoder.decode(raw),directory=name.endsWith('/'),path=directory?name.slice(0,-1):name;
    if(!pathOK(path)||seen.has(path.toLowerCase()))fail('ZIP contains an unsafe or duplicate path.');seen.add(path.toLowerCase());
    if((flags&1)||![0,8].includes(method)||v.getUint16(p+34,true)||((v.getUint32(p+38,true)>>>16)&0xf000)===0xa000||unpacked>LIMITS.file||packed===0xffffffff||unpacked===0xffffffff||unpacked/Math.max(1,packed)>LIMITS.ratio)fail('ZIP entry is encrypted, unsupported, or exceeds size/compression limits.');
    total+=unpacked;if(total>LIMITS.total)fail('ZIP expands beyond the 512 MB limit.');
    if(local+30>offset||v.getUint32(local,true)!==0x04034b50||v.getUint16(local+6,true)!==flags||v.getUint16(local+8,true)!==method)fail('ZIP headers disagree.');
    const localLen=v.getUint16(local+26,true),localExtra=v.getUint16(local+28,true),data=local+30+localLen+localExtra;
    if(decoder.decode(bytes.slice(local+30,local+30+localLen))!==name||data+packed>offset)fail('ZIP paths or lengths disagree.');
    ranges.push([local,data+packed]);entries.push({name,size:unpacked,directory,crc:v.getUint32(p+16,true)});p+=46+len+extra+comment;
  }
  if(p!==end)fail('ZIP directory has unexpected entries.');ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])fail('ZIP entries overlap.');
  return entries;
}
export async function readZip(blob){
  if(!blob||blob.size>LIMITS.zip)fail('ZIP exceeds the 256 MB limit.');
  const buffer=await blob.arrayBuffer(),entries=inspectZip(buffer);let zip;
  try{zip=await JSZip.loadAsync(buffer,{checkCRC32:false,createFolders:false});}catch{fail('ZIP is damaged or unsupported.');}
  const files=new Map();for(const entry of entries){if(entry.directory){if(entry.size)fail('ZIP directory contains data.');continue;}
    const file=zip.file(entry.name);if(!file)fail('ZIP contents differ from its directory.');
    // Bound actual streaming output too: an attacker can lie about sizes in both
    // headers. Never let JSZip accumulate an unchecked decompressed payload.
    const chunks=[];let length=0,crc=-1;
    await new Promise((resolve,reject)=>{let stopped=false;const stream=file.internalStream('uint8array');stream.on('data',chunk=>{
      if(stopped)return;length+=chunk.length;if(length>entry.size||length>LIMITS.file){stopped=true;stream.pause();reject(new Error('ZIP expands beyond its declared size.'));return;}
      for(const byte of chunk)crc=crcTable[(crc^byte)&255]^(crc>>>8);chunks.push(chunk);
    }).on('error',e=>{stopped=true;reject(new Error('ZIP decompression failed: '+e.message));}).on('end',()=>{if(!stopped)resolve();}).resume();});
    if(length!==entry.size||((crc^-1)>>>0)!==entry.crc)fail('ZIP contents or checksum differ from its directory.');files.set(entry.name,new Blob(chunks));
  }return files;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export async function fileInfo(blob){return {size:blob.size,sha256:await sha256(await blob.arrayBuffer())};}
export async function seal(payloads,manifest){manifest.payloads={};for(const [path,blob]of payloads)if(path!=='manifest.json')manifest.payloads[path]=await fileInfo(blob);payloads.set('manifest.json',json(manifest));return payloads;}
async function checkPayloads(payloads,declarations,root='manifest.json'){
  if(!declarations||typeof declarations!=='object'||Array.isArray(declarations))fail('Package file list is missing.');
  const declared=Object.keys(declarations);if(declared.length!==payloads.size-1)fail('Package has missing or undeclared files.');
  for(const path of declared){const info=declarations[path],blob=payloads.get(path);if(!pathOK(path)||path===root||!blob||!hash(info?.sha256)||!Number.isSafeInteger(info.size)||info.size!==blob.size||await sha256(await blob.arrayBuffer())!==info.sha256)fail(`File integrity check failed for ${path}. Use the unchanged package.`);}
}
const legacyPaths={source:'source-original.pdf',rendered:'rendered-original.pdf',ly:'lilypond/supplied.ly'};
export async function readPackage(blob,inspectPdf){
  const payloads=await readZip(blob),m=await parse(payloads.get('manifest.json'),2*1024*1024);
  if(!m||typeof m!=='object'||Array.isArray(m))fail('Package manifest must be a supported Score Desk object.');
  const legacy=m.schema==='score-desk-package'&&m.version===1,clean=m.schema==='score-desk-input'&&m.version===1;
  if(!legacy&&!clean)fail('This package format is not supported. Use a Score Desk review, recovery, or input package.');
  if(m.relationship!=='user-supplied; not established by compilation'||!m.inputs||Object.keys(m.inputs).length!==roles.length||Object.keys(m.inputs).some(role=>!roles.includes(role)))fail('Package input roles or PDF/code relationship are invalid.');
  await checkPayloads(payloads,m.payloads);
  const files={},used=new Set();for(const role of roles){const info=m.inputs?.[role],path=legacy?legacyPaths[role]:info?.path;
    if(!pathOK(path)||used.has(path)||!payloads.has(path)||!info||typeof info.name!=='string'||!info.name.length||info.name.length>250)fail('Package input roles are missing or ambiguous.');used.add(path);
    const blob=payloads.get(path);if(blob.size!==info.size||await sha256(await blob.arrayBuffer())!==info.sha256)fail(`The ${role==='rendered'?'rendered PDF':role==='source'?'original PDF':'LilyPond file'} does not match this review.`);files[role]={name:info.name,blob};
  }
  if(!files.ly.name.toLowerCase().endsWith('.ly'))fail('The code input must be a LilyPond .ly file.');
  const {identity,snapshotId}=await identify(files);if(snapshotId!==m.snapshotId)fail('Package input snapshot does not match its manifest.');
  const pages=await inspectPdf(files),expected=newReview(identity,snapshotId,pages);
  let review=expected;if(legacy){if(!payloads.has('annotations.json'))fail('This review package is missing its annotations.');const annotations=await parse(payloads.get('annotations.json'));try{review=validateReview(annotations,expected);}catch(e){if(e.message.includes('rendered file'))fail('The rendered PDF does not match this review.');if(e.message.includes('geometry'))fail('The review markings do not match the rendered PDF pages.');throw e;}}else if(payloads.has('annotations.json'))fail('A clean input package cannot contain annotations.');
  let completionBundle=null;
  if(m.extensions){
    const known={'score-desk-returned-workspace-backup':'returned-workspace.json',[COMPLETION_EXTENSION.schema]:COMPLETION_EXTENSION.path};
    if(!legacy||!Array.isArray(m.extensions)||m.extensions.length>2||new Set(m.extensions.map(e=>e?.schema)).size!==m.extensions.length||m.extensions.some(e=>e?.version!==1||!Object.hasOwn(known,e.schema)||e.path!==known[e.schema]||!payloads.has(e.path)))fail('Unsupported package extension.');
    if(m.extensions.some(e=>e.schema===COMPLETION_EXTENSION.schema)){
      const round=m.extensions.some(e=>e.schema==='score-desk-returned-workspace-backup')?(await parse(payloads.get('returned-workspace.json'))).returned:null;
      // Retain the exported annotation date, rather than inventing an edit on
      // import. The completion still refers to these exact annotation bytes.
      review=exactReview(review,await parse(payloads.get('annotations.json')));
      completionBundle=await validateCompletionBundle(await parse(payloads.get(COMPLETION_EXTENSION.path)),review,round);
      for(const record of completionBundle.records)if(record.revision.id===completionBundle.revisionId&&record.hashes.annotations!==await sha256(await payloads.get('annotations.json').arrayBuffer()))fail('Current completion annotation hash does not match exported bytes.');
    }
  }
  if(m.kind==='completed-review-handoff'&&!completionBundle?.records.some(r=>r.id===m.completionId&&r.revision.id===completionBundle.revisionId))fail('Completion metadata is missing its current handoff record.');
  return {files,review,payloads,manifest:m,completionBundle};
}
export async function makeInput(files){const {identity,snapshotId}=await identify(files),payloads=new Map();for(const role of roles)payloads.set(legacyPaths[role],files[role].blob);return seal(payloads,{schema:'score-desk-input',version:1,snapshotId,relationship:'user-supplied; not established by compilation',inputs:Object.fromEntries(roles.map(role=>[role,{...identity[role],path:legacyPaths[role]}]))});}

export const RETURN_FORMAT=`SCORE DESK RESPONSE FORMAT v1
Return a ZIP with response.json at its root and only declared returned files.
Use response-template.json, preserving taskId and baseline exactly. Set code.status to "changed" with code.path referencing a UTF-8 .ly file, or "unchanged" with path null. Files maps each returned path to {size,sha256} (SHA-256 of exact bytes). Do not include response.json in files.
Every issued finding ID occurs exactly once. status is changed, unchanged_with_reason, or needs_clarification; explanation is required; codeLocation is optional text. No "resolved" status.
rendering.status is pending (path null) or supplied (path points to a returned PDF; producer is required; compiler is optional text). A supplied PDF relationship to the returned code, or unchanged baseline code, is a producer declaration, never proof of compilation. If an already-installed LilyPond can compile the corrected code locally, return its PDF and exact compiler/version declaration; otherwise return pending and explain the limitation.
Use only safe relative ASCII paths, .ly for code and .pdf for rendering. Do not add scripts. No-code-change responses declare code unchanged and may return no files. A changed finding requires changed code. Hash/size all returned files with a local tool; never ask the contributor to edit JSON or calculate hashes.
`;
function promptFor(task){return `CORRECT THE SUPPLIED EXISTING TRANSCRIPTION — SCORE DESK LOCAL TASK
Task ID: ${task.id}
This is an authorized correction of the existing supplied LilyPond, including an existing Step 3 transcription. Do not choose another piece because project guidance says Step 3 work is finished. This task overrides that workflow selection rule, not source-fidelity rules.
Read task.json, review.txt, annotations.json, the exact printed source, clean/marked finding images, rendered-marked.pdf, and project-guidance/AGENTS.md and HANDBOOK.md. Treat comments as observations: check each against the printed source. Original and rendered page numbers are independent. Preserve apparent printed mistakes and document them separately; report ambiguous or unreadable source readings rather than inventing a correction.
Use visual inspection. OMR/OCR, score recognition, existing digital transcriptions, audio-to-score and other score-recognition tools/services are prohibited. Keep all files and processing local. Do not upload, call an LLM API, install packages, commit, push, open a PR, deploy, or publish. Propose corrections in the supplied .ly and explain them. You may compile locally with an already-available LilyPond executable; if you do, return the updated PDF with the exact compiler/version declaration. If compilation is unavailable or fails, mark rendering pending and explain why. Do not claim human verification or musical correctness, and do not resolve findings. Claim compilation only if it was actually performed, with the exact compiler/version and any limitations.
The selected PDF/code pairing is user-supplied. Hashes identify exact files; they do not establish that the PDF was generated from the code or that the music is correct. Findings stay attached to their original render geometry.
Return one result for EVERY stable finding ID below, including an explanation, using changed, unchanged_with_reason, or needs_clarification. Include optional code locations. Changes are proposals requiring human review.
${task.version===2?'FOLLOW-UP ROUND: only the listed outstanding findings are correction requests. annotations.json and rendered-marked.pdf contain CURRENT geometry only. historical/ images and historical PDF pages refer to earlier versions, never current coordinates. An unlocated finding still requires a response: inspect its historical context and the complete current render. No page alignment is implied. Reviewer explanations and originating findings/prior response links are in task.json. Earlier resolved findings are not outstanding requests.':''}
${task.findings.map(f=>`#${f.number} | ${f.id} | ${task.version===2?'current rendered page '+(f.page??'not located'):'previous rendered page '+f.page} | ${f.comment}${f.currentAnchor?.comment?'\nCurrent region comment: '+f.currentAnchor.comment:''}${f.reviewer?.explanation?'\nReviewer: '+f.reviewer.explanation:''}${f.instructionHistory?.length?'\nEarlier human instructions (historical, not approval):\n'+f.instructionHistory.map(h=>`Task ${h.taskId}\nReviewer: ${h.explanation||'[No additional explanation]'}\nRegion comment: ${h.regionComment||'[None]'}`).join('\n\n'):''}`).join('\n')||'(No findings recorded; do not imply review coverage.)'}

Return the versioned response ZIP described in RESPONSE_FORMAT.txt, using response-template.json. Preserve the exact task ID and baseline fields. Include corrected UTF-8 LilyPond with file hashes, or explicitly declare no code change. Return this package to the contributor; they should only need Import AI response, not manual JSON editing or hash calculation.
Baseline: ${JSON.stringify(task.baseline)}
${RETURN_FORMAT}`;}
export async function makeTask(review,files,doc,context,progress,packageMaker=makePackage){
  const payloads=await packageMaker(review,files,doc,context,progress),annotation=payloads.get('annotations.json');
  const task={schema:'score-desk-task',version:1,id:crypto.randomUUID(),kind:'correction-existing-transcription',createdAt:new Date().toISOString(),baseline:{snapshotId:review.snapshotId,sourceSha256:review.files.source.sha256,codeSha256:review.files.ly.sha256,renderSha256:review.files.rendered.sha256,annotationSha256:await sha256(await annotation.arrayBuffer())},findings:review.findings.map(({id,number,page,comment})=>({id,number,page,comment})),renderingConstraint:'local compilation with already-available LilyPond allowed; otherwise rendering pending',relationship:review.relationship};
  const entry={id:task.id,kind:'task',createdAt:task.createdAt,task,review:clone(review),files,payloads};await finalizeTask(entry);return entry;
}
export async function finalizeTask(entry){
  const {task,payloads}=entry;
  const template={schema:'score-desk-response',version:1,taskId:task.id,baseline:task.baseline,code:{status:'unchanged',path:null},rendering:{status:'pending',path:null,producer:null,compiler:null},files:{},results:task.findings.map(f=>({id:f.id,status:'needs_clarification',explanation:'REPLACE with your source-checked response.',codeLocation:''}))};
  payloads.set('task.json',json(task));payloads.set('PROMPT.txt',plain(promptFor(task)));payloads.set('response-template.json',json(template));payloads.set('RESPONSE_FORMAT.txt',plain(RETURN_FORMAT));
  const manifest=await parse(payloads.get('manifest.json'));manifest.taskId=task.id;await seal(payloads,manifest);
  return entry;
}
export const taskFindings=issued=>issued.task.version===2?issued.task.findings:issued.review.findings;
export const contextPaths=(issued,f)=>issued.task.version===2?[f.historicalContext?.marked,f.historicalContext?.clean]:['marked','clean'].map(type=>`findings/${String(f.number).padStart(3,'0')}-${f.id}-${type}.png`);
export async function readResponse(blob,lookup=retained){
  const payloads=await readZip(blob),response=await parse(payloads.get('response.json'),2*1024*1024);
  if(!response||typeof response!=='object'||Array.isArray(response))fail('AI response must be a supported Score Desk object.');
  if(response.schema!=='score-desk-response'||response.version!==1)fail('Unsupported AI response format.');
  if(typeof response.taskId!=='string')fail('Response is missing its task ID.');const issued=await lookup(response.taskId);
  if(!issued||issued.kind!=='task')fail('This response does not match a task issued on this device and browser origin. Open the issuing workspace.');
  const expected=issued.task.baseline,baseline=response.baseline;
  if(!baseline||Object.keys(baseline).length!==Object.keys(expected).length||Object.keys(expected).some(key=>baseline[key]!==expected[key]))fail('This response answers a different baseline. The current review has not changed.');
  await checkPayloads(payloads,response.files,'response.json');
  const code=response.code,rendering=response.rendering;
  if(!code||!['changed','unchanged'].includes(code.status)||(code.status==='unchanged'?code.path!==null:!pathOK(code.path)||!code.path.endsWith('.ly')||!payloads.has(code.path)))fail('Response code declaration is contradictory or missing.');
  if(!rendering||!['pending','supplied'].includes(rendering.status)||(rendering.status==='pending'?rendering.path!==null:!pathOK(rendering.path)||!rendering.path.endsWith('.pdf')||!payloads.has(rendering.path)||typeof rendering.producer!=='string'||!rendering.producer.trim()||rendering.producer.length>500)||(rendering.compiler!=null&&(typeof rendering.compiler!=='string'||rendering.compiler.length>500)))fail('Response rendering declaration is contradictory or missing.');
  const paths=[...(code.status==='changed'?[code.path]:[]),...(rendering.status==='supplied'?[rendering.path]:[])];if(paths.length!==payloads.size-1||new Set(paths).size!==paths.length)fail('Response has undeclared or unrelated returned files.');
  if(code.status==='changed'){
    try{decoder.decode(await payloads.get(code.path).arrayBuffer());}catch{fail('Returned LilyPond is not valid UTF-8.');}
    if(response.files[code.path].sha256===expected.codeSha256)fail('Response declares changed code but returns unchanged bytes.');
  }
  const ids=new Set(issued.task.findings.map(f=>f.id)),seen=new Set();
  if(!Array.isArray(response.results)||response.results.length!==ids.size)fail('Response must include every issued finding exactly once.');
  for(const result of response.results){if(!ids.has(result.id)||seen.has(result.id)||!['changed','unchanged_with_reason','needs_clarification'].includes(result.status)||typeof result.explanation!=='string'||!result.explanation.trim()||result.explanation.length>8000||(result.codeLocation!==undefined&&(typeof result.codeLocation!=='string'||result.codeLocation.length>1000))||(result.status==='changed'&&code.status!=='changed'))fail('Response contains a duplicate, unknown, missing, or contradictory finding result.');seen.add(result.id);}
  return {response,issued,payloads};
}
export function responseRevision(parsed){const {issued,response,payloads}=parsed;return {id:crypto.randomUUID(),kind:'response',createdAt:new Date().toISOString(),taskId:issued.id,parentSnapshotId:issued.task.baseline.snapshotId,baseline:clone(response.baseline),response:clone(response),payloads,renderingStatus:response.rendering.status,findings:taskFindings(issued).map(f=>({id:f.id,number:f.number,comment:f.comment,page:f.page,state:({changed:'corrected_pending_review',unchanged_with_reason:'open',needs_clarification:'needs_source_clarification'})[response.results.find(r=>r.id===f.id).status]}))};}
export async function acceptResponse(parsed){const entry=responseRevision(parsed);await retain(entry);return entry;}

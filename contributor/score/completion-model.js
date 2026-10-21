import {clone,sha256,validateReview,STATES} from './model.js';
export const SCOPES={corrections:'I checked the reported corrections.',entire:'I compared the entire work.',partial:'This is a partial review.'};
export const COMPLETION_EXTENSION={schema:'score-desk-completions',version:1,path:'completion-history.json'};
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const jsonBlob=value=>new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'});
const digest=text=>sha256(new TextEncoder().encode(text));
export const annotationHash=review=>digest(JSON.stringify(review,null,2)+'\n');
export function exactReview(validated,original){
  validated.updatedAt=original.updatedAt;
  if(canonical(validated)!==canonical(original))throw new Error('Completion metadata differs from the supported annotation model.');
  return clone(original); // retain key ordering only after semantic validation
}
export async function stateHash(review,returned=null){
  const annotations=clone(review);delete annotations.createdAt;delete annotations.updatedAt;
  const round=clone(returned);if(round){delete round.id;delete round.recoveredFrom;}
  return digest(canonical({annotations,returned:round}));
}
export function mergeCompletions(prior=[],incoming=[]){
  const all=new Map(prior.map(r=>[r.id,r]));
  for(const r of incoming){if(all.has(r.id)&&canonical(all.get(r.id))!==canonical(r))throw new Error('Completion identity conflicts with an immutable earlier record.');all.set(r.id,r);}
  if(all.size>500)throw new Error('Prototype limit: 500 completion records per review.');return [...all.values()];
}
export function completionFindings(review,round){
  const associated=new Set(round?.reported.map(f=>f.associationId).filter(Boolean)??[]);
  return [...(round?.reported??[]).map(f=>({...clone(f),kind:'reported',region:clone(review.findings.find(m=>m.id===f.associationId)??null)})),...review.findings.filter(f=>!associated.has(f.id)).map(f=>({...clone(f),kind:'annotation',region:clone(f)}))];
}
export async function createCompletion(scene,declaration,attempt,events=[]){
  if(!Object.hasOwn(SCOPES,declaration.scope))throw new Error('Choose what kind of review you performed.');
  const findings=completionFindings(scene.review,scene.returned),totals={all:findings.length,resolved:findings.filter(f=>f.state==='resolved').length,unresolved:findings.filter(f=>f.state!=='resolved').length,unlocated:findings.filter(f=>!f.region).length,missingDecisions:findings.filter(f=>f.kind==='reported'&&!f.decision).length};
  return {schema:'score-desk-completion',version:1,id:attempt.id,createdAt:attempt.createdAt,scope:declaration.scope,scopeNote:declaration.note.trim(),reviewer:declaration.reviewer.trim()||null,
    revision:{id:scene.revisionId,workspaceId:scene.workspaceId,snapshotId:scene.review.snapshotId,persistedRevision:scene.persistedRevision,taskId:scene.returned?.taskId??null,responseId:scene.returned?.responseId??null,parentRevisionId:scene.returned?.parentRevisionId??null,attachmentId:scene.returned?.attachmentId??null},
    hashes:{source:scene.review.files.source.sha256,ly:scene.review.files.ly.sha256,rendered:scene.review.files.rendered.sha256,annotations:await annotationHash(scene.review),state:await stateHash(scene.review,scene.returned)},findings,totals,
    history:{returnedEvents:events.map(({id,parentHistoryId,storageRevision,createdAt})=>({id,parentHistoryId,storageRevision,createdAt})),response:scene.returned?{taskId:scene.returned.taskId,responseId:scene.returned.responseId,parentRevisionId:scene.returned.parentRevisionId}:null},
    provenance:{relationship:scene.review.relationship,rendering:clone(scene.returned?.provenance??null),compilerVersion:null,compilationPerformed:false,identity:'Contributor-supplied, unauthenticated; unknown when absent',verification:'Not established. Scope declaration only; unresolved findings and missing decisions remain.'},
    evidence:{annotations:clone(scene.review),returned:clone(scene.returned)}};
}
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),id=s=>typeof s==='string'&&s.length>0&&s.length<=200;
export async function validateCompletionBundle(bundle,review,round=null){
  const fail=()=>{throw new Error('Completion metadata or revision hashes do not match this package.');};
  if(bundle?.schema!==COMPLETION_EXTENSION.schema||bundle.version!==1||!id(bundle.revisionId)||!hash(bundle.stateSha256)||!Array.isArray(bundle.records)||bundle.records.length>500||new Set(bundle.records.map(r=>r?.id)).size!==bundle.records.length)fail();
  if(await stateHash(review,round)!==bundle.stateSha256)fail();
  for(const r of bundle.records){
    if(r?.schema!=='score-desk-completion'||r.version!==1||!id(r.id)||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||!Object.hasOwn(SCOPES,r.scope)||typeof r.scopeNote!=='string'||r.scopeNote.length>4000||r.reviewer!==null&&(typeof r.reviewer!=='string'||r.reviewer.length>200)||!id(r.revision?.id)||!id(r.revision.workspaceId)||!hash(r.revision.snapshotId)||!r.evidence?.annotations||!r.hashes||Object.keys(r.hashes).length!==5||!Object.values(r.hashes).every(hash))fail();
    const a=r.evidence.annotations;validateReview(a,a);
    const round=r.evidence.returned;
    if(round&&(round.schema!=='score-desk-returned-workspace'||round.version!==1||!Array.isArray(round.reported)||round.reported.length>2000||round.reported.some(f=>!id(f.id)||!STATES.includes(f.state)||typeof f.comment!=='string'||f.comment.length>4000||typeof f.explanation!=='string'||f.explanation.length>4000)))fail();
    if(a.relationship!=='user-supplied; not established by compilation'||a.snapshotId!==r.revision.snapshotId||['source','ly','rendered'].some(role=>r.hashes[role]!==a.files[role].sha256)||r.hashes.annotations!==await annotationHash(a)||r.hashes.state!==await stateHash(a,r.evidence.returned))fail();
    const findings=completionFindings(a,r.evidence.returned);if(canonical(findings)!==canonical(r.findings)||findings.some(f=>!STATES.includes(f.state)))fail();
    const expected=await createCompletion({review:a,returned:r.evidence.returned,revisionId:r.revision.id,workspaceId:r.revision.workspaceId,persistedRevision:r.revision.persistedRevision},{scope:r.scope,note:r.scopeNote,reviewer:r.reviewer??''},r,r.history?.returnedEvents??[]);
    if(canonical(expected)!==canonical(r)||r.revision.id===bundle.revisionId&&(r.hashes.state!==bundle.stateSha256||r.hashes.annotations!==await annotationHash(review)))fail();
  }return clone(bundle);
}
export function completionSummary(record){
  const lines=['SCORE DESK — COMPLETED REVIEW HANDOFF',`Completion: ${record.id}`,`Declared at: ${record.createdAt}`,`Scope: ${SCOPES[record.scope]}`,`Scope note: ${record.scopeNote||'[Not supplied]'}`,`Reviewer: ${record.reviewer??'Unknown (not supplied)'}`,'Identity is contributor-supplied and unauthenticated.','',`Review revision: ${record.revision.id}`,`Workspace: ${record.revision.workspaceId}`,`Input snapshot: ${record.revision.snapshotId}`];
  for(const [key,value]of Object.entries(record.hashes))lines.push(`${key} SHA-256: ${value}`);
  lines.push(`Rendering supplier: ${record.provenance.rendering?.supplier??'Unknown (not recorded)'}`,`Supplier-declared compiler: ${record.provenance.rendering?.compiler??'Unknown (not supplied)'}`);
  lines.push(`Task: ${record.revision.taskId??'None recorded'}`,`Response: ${record.revision.responseId??'None recorded'}`,`Parent revision: ${record.revision.parentRevisionId??'None recorded'}`,'',`Findings: ${record.totals.all}; unresolved: ${record.totals.unresolved}; resolved: ${record.totals.resolved}; unlocated: ${record.totals.unlocated}; reported findings missing decisions: ${record.totals.missingDecisions}.`,'The legacy unlocated total counts findings without an annotation association; text-only annotations still have no marked passage.','Finishing does not resolve findings or approve a response. No whole-score verification is established.','Scope is a contributor declaration, never inferred from visits, elapsed time, scrolling or finding counts.','PDF/code relationship is supplier-declared; no compilation performed. Compiler version unknown.','Source and rendering page numbers are independent. No automatic alignment.','External LilyPond includes are not bundled. Available history only; no actions or review times have been inferred.','');
  for(const f of record.findings){lines.push(`#${f.number} | ${f.id} | ${f.state}`,`Original/comment: ${f.comment}`,`Current annotation: ${f.region?'finding #'+f.region.number+' ('+f.region.id+'), '+(f.region.strokes.length?'marked passage on rendered page ':'text-only; page context ')+f.region.page:'not located'}`,`Annotation state: ${f.region?.state??'Not located'}`,`Annotation comment: ${f.region?.comment??'[None]'}`,`Reviewer explanation: ${f.explanation??'[None]'}`,`Human decision: ${f.decision?JSON.stringify(f.decision):f.kind==='reported'?'Missing':'Not applicable'}`);
    for(const h of f.instructionHistory??[])lines.push(`Earlier instructions · task ${h.taskId}`,`Reviewer: ${h.explanation}`,`Annotation comment: ${h.regionComment}`);
    if(f.agent)lines.push(`Agent response: ${f.agent.explanation}`);lines.push('');}
  lines.push('Recorded history references:',JSON.stringify(record.history,null,2),'','This package is ready for local download. Download requests do not prove it was saved to disk.');return lines.join('\n')+'\n';
}

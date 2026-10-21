import {COMPLETION_EXTENSION,SCOPES,createCompletion,mergeCompletions,completionSummary,jsonBlob,stateHash,validateCompletionBundle} from './completion-model.js';
import {makeReturnedBackup} from './returned.js';
import {returnedHistory} from './storage.js';
import {seal,LIMITS} from './workflow.js';
import {roles,sha256} from './model.js';
import {githubInstructions,GITHUB_INSTRUCTIONS} from './github-handoff.js';
import {observationText} from './export.js';
export async function addCompletionHistory(payloads,review,round,revisionId,records){
  if(!records.length)return payloads;
  const manifest=JSON.parse(await payloads.get('manifest.json').text());manifest.extensions=[...(manifest.extensions??[]).filter(e=>e.schema!==COMPLETION_EXTENSION.schema),COMPLETION_EXTENSION];
  const metadata={schema:COMPLETION_EXTENSION.schema,version:1,revisionId,stateSha256:await stateHash(review,round),records},bundle=jsonBlob(metadata);
  if(bundle.size>LIMITS.json)throw new Error('Completion history exceeds the 25 MB import limit. Keep earlier packages and use a smaller review.');
  await validateCompletionBundle(metadata,review,round);
  payloads.set(COMPLETION_EXTENSION.path,bundle);
  const current=records.filter(r=>r.revision.id===revisionId).at(-1);
  const history='\nCOMPLETION HISTORY (full immutable records: completion-history.json)\n'+records.map(r=>`${r.id} | ${r.revision.id===revisionId?'matches current review state':'historical; does not declare current revision'} | ${SCOPES[r.scope]} | ${r.createdAt} | ${r.totals.unresolved} unresolved`).join('\n')+'\n';
  payloads.set('completion-summary.txt',new Blob([observationText(current?'COMPLETED REVIEW':'HISTORICAL COMPLETIONS ONLY',{summary:current?completionSummary(current):records.map(r=>completionSummary(r)),history})],{type:'text/plain;charset=utf-8'}));return seal(payloads,manifest);
}
export async function prepareCompletion(scene,declaration,attempt,progress,packageMaker){
  for(const role of roles)if(await sha256(await scene.files[role].blob.arrayBuffer())!==scene.review.files[role].sha256)throw new Error('Current input bytes changed. Reopen the exact files before finishing.');
  let payloads=await packageMaker(scene.review,scene.files,scene.doc,'120',progress);
  if(scene.returned)payloads=await makeReturnedBackup(scene.review,scene.files,scene.returned,payloads);
  const events=scene.returned?(await returnedHistory(scene.workspaceId)).filter(e=>e.storageRevision<=scene.persistedRevision):[];
  const record=attempt.record??=await createCompletion(scene,declaration,attempt,events);
  const manifest=JSON.parse(await payloads.get('manifest.json').text());manifest.kind='completed-review-handoff';manifest.completionId=record.id;payloads.set('manifest.json',jsonBlob(manifest));
  payloads.set('review.txt',new Blob(['COMPLETED-REVIEW HANDOFF\nRead completion-summary.txt for the declared scope and exact revision. This is not an issued AI correction task. All finding states remain included; no approval or score verification is established.\n\n',await payloads.get('review.txt').text()],{type:'text/plain;charset=utf-8'}));
  payloads=await addCompletionHistory(payloads,scene.review,scene.returned,scene.revisionId,mergeCompletions(scene.completions,[record]));
  payloads.set(GITHUB_INSTRUCTIONS,new Blob([await githubInstructions(scene,record)],{type:'text/plain;charset=utf-8'}));
  await seal(payloads,JSON.parse(await payloads.get('manifest.json').text()));
  if(payloads.size>LIMITS.count||[...payloads.values()].some(b=>b.size>LIMITS.file)||[...payloads.values()].reduce((n,b)=>n+b.size,0)>LIMITS.total)throw new Error('Completed package exceeds the supported import size limits.');return {record,payloads};
}

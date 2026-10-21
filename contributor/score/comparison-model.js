// Display context and bookmarks are deliberately separate from score files,
// annotation coordinates, AI claims, and human approval.
import {clone, sha256, validateReview} from './model.js';
import {taskFindings, contextPaths, strictJSON} from './workflow.js';

export function candidateIdentity(review) {
  return {snapshotId:review.snapshotId, codeSha256:review.files.ly.sha256, renderSha256:review.files.rendered.sha256};
}
export function sameCandidate(a,b) {
  return Boolean(a&&b&&['snapshotId','codeSha256','renderSha256'].every(k=>a[k]===b[k]));
}
export function validPosition(p,pages) {
  if(!p||!Number.isInteger(p.page)||p.page<1||p.page>pages.length||!['fit',.75,1,1.5,2].includes(p.zoom))return false;
  const box=pages[p.page-1].view;
  return Array.isArray(p.point)&&p.point.length===2&&p.point.every(Number.isFinite)&&p.point[0]>=box[0]&&p.point[0]<=box[2]&&p.point[1]>=box[1]&&p.point[1]<=box[3];
}
export function savedLocation(location,findingId,review) {
  return location?.version===1&&location.findingId===findingId&&sameCandidate(location.candidate,candidateIdentity(review))&&validPosition(location.position,review.pages)?location:null;
}
export function bookmark(findingId,review,position) {
  if(!validPosition(position,review.pages))throw new Error('Wait for the revised page to finish loading before locating it.');
  return {version:1,findingId,candidate:candidateIdentity(review),position:clone(position)};
}
export function validateLocations(locations,round,review) {
  if(locations===undefined)return {};
  if(!locations||Array.isArray(locations)||typeof locations!=='object'||Object.keys(locations).length>round.reported.length)throw new Error('Invalid correction locations.');
  for(const [id,value]of Object.entries(locations))if(!round.reported.some(f=>f.id===id)||!savedLocation(value,id,review))throw new Error('Correction location belongs to different files or invalid page geometry.');
  return clone(locations);
}
export async function comparisonContext(issued,finding) {
  const baseline={blob:issued.files.rendered.blob,sha256:issued.task.baseline.renderSha256,marks:issued.review.findings,selectedId:finding.id};
  const context=finding.historicalContext,hash=context?.renderSha256??finding.origin?.renderSha256??baseline.sha256;
  const earlier=hash!==baseline.sha256;
  const result={baseline,earlier,page:context?.page??finding.origin?.page??finding.page??1,crops:contextPaths(issued,finding).map(path=>issued.payloads.get(path)),original:null};
  if(!earlier){result.original=baseline;return result;}
  const info=context?.originalFiles?.rendered,blob=issued.payloads.get(info?.path);
  // Legacy follow-ups sometimes retain only crops: never invent a matching PDF.
  if(!blob||info.sha256!==hash||await sha256(await blob.arrayBuffer())!==hash)return result;
  let marks=[];
  const raw=issued.payloads.get(context.annotations);
  if(raw){
    const original=strictJSON(await raw.text());
    if(original.files?.rendered?.sha256!==hash)throw new Error('Historical marks do not match their rendering.');
    const checked=validateReview(original,original);
    const originalId=finding.origin?.findingId??finding.id;
    marks=checked.findings.map(f=>f.id===originalId?{...f,id:finding.id,number:finding.number}:f);
  }
  result.original={blob,sha256:hash,marks,selectedId:finding.id};return result;
}
export function taskFinding(issued,id){return taskFindings(issued).find(f=>f.id===id);}

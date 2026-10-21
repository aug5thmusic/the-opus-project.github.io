// Build the historical upgrade package from synthetic geometry at test time.
// No score PDFs, exported archives, or browser database snapshots are committed.
import {fixtureBlob} from './fixtures.js';
import {identify,newReview,bounds,clone,PALETTE} from '../model.js';
import {makeRecovery,zipFiles} from '../export.js';
import {makeTask,responseRevision,json,seal} from '../workflow.js';
import {workspaceSeed,makeReturnedBackup} from '../returned.js';
import {retain} from '../handoff-store.js';
import {createCompletion} from '../completion-model.js';
import {addCompletionHistory} from '../completion.js';

export async function completedFixture(inspectPdf) {
  const files={};
  for(const [role,name] of [['source','source.pdf'],['rendered','rendered.pdf'],['ly','score.ly']])files[role]={name,blob:await fixtureBlob(name)};
  const {identity,snapshotId}=await identify(files),review=newReview(identity,snapshotId,await inspectPdf(files));
  const strokes=[{width:12,color:PALETTE[0].color,opacity:0.35,points:[[70,680],[100,680]]}];
  review.findings=[{id:crypto.randomUUID(),number:1,page:1,color:PALETTE[0].color,comment:'SYNTHETIC historical finding',state:'open',strokes,bounds:bounds(strokes)}];review.nextNumber=2;
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=60;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,240,60);ctx.fillStyle='#123f39';ctx.fillText('SYNTHETIC historical context',10,30);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const fixturePackage=async(review,files)=>{
    const payloads=await makeRecovery(review,files);
    for(const f of review.findings)for(const type of ['marked','clean'])payloads.set(`findings/${String(f.number).padStart(3,'0')}-${f.id}-${type}.png`,png);
    return seal(payloads,JSON.parse(await payloads.get('manifest.json').text()));
  };
  const issued=await makeTask(review,files,null,'120',()=>{},fixturePackage);await retain(issued);
  const response={schema:'score-desk-response',version:1,taskId:issued.id,baseline:clone(issued.task.baseline),code:{status:'unchanged',path:null},rendering:{status:'pending',path:null,producer:null,compiler:null},files:{},results:review.findings.map(f=>({id:f.id,status:'unchanged_with_reason',explanation:'SYNTHETIC response; no musical assertion.',codeLocation:''}))};
  const entry=responseRevision({issued,response,payloads:new Map([['response.json',json(response)]])});await retain(entry);
  const seed=await workspaceSeed(entry,issued,inspectPdf);
  seed.review.findings=[{...clone(review.findings[0]),id:crypto.randomUUID()}];
  seed.returned.reported[0].associationId=seed.review.findings[0].id;
  seed.returned.reported[0].instructionHistory=[{taskId:issued.id,codeSha256:identity.ly.sha256,renderSha256:identity.rendered.sha256,explanation:'SYNTHETIC earlier instruction retained across rounds.',regionComment:'SYNTHETIC region note.'}];
  const revisionId=crypto.randomUUID(),attempt={id:crypto.randomUUID(),createdAt:new Date().toISOString()};
  const completion=await createCompletion({...seed,workspaceId:seed.returned.id,revisionId,persistedRevision:1},{scope:'partial',note:'SYNTHETIC pre-upgrade completion',reviewer:'QA'},attempt);
  let payloads=await makeReturnedBackup(seed.review,seed.files,seed.returned);
  payloads=await addCompletionHistory(payloads,seed.review,seed.returned,revisionId,[completion]);
  const manifest=JSON.parse(await payloads.get('manifest.json').text());manifest.kind='completed-review-handoff';manifest.completionId=completion.id;
  await seal(payloads,manifest);
  return zipFiles(payloads);
}

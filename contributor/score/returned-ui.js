import {clone} from './model.js';
import {retained,retainedList,retain} from './handoff-store.js';
import {returnedHistory} from './storage.js';
import {workspaceSeed,renderingAttachment,followupTask,makeReturnedBackup} from './returned.js';
const $=id=>document.getElementById(id);
export function installReturned(api,host){
  let position=0,panelId=null,attachmentTarget=null,working=false;
  const io={workspaceSeed,renderingAttachment,followupTask,retain};
  const guard=fn=>async(...args)=>{try{await fn(...args);}catch(e){api.message(e.message,true);$('roundStatus').textContent=e.message;}};
  async function latestAttachment(entry){return (await retainedList()).find(e=>e.kind==='render-attachment'&&e.responseId===entry.id);}
  async function open(entry,attachment=null){
    if(working||api.status().busy)return;
    working=true;try{
      const seed=await api.lock(async()=>{const issued=await retained(entry.taskId);attachment??=await latestAttachment(entry);
        if(entry.response.code.status==='changed'&&entry.response.rendering.status==='pending'&&!attachment){$('handoffTitle').textContent='Updated rendering pending';api.message('Updated rendering pending. Attach an existing PDF to review changed code and export a follow-up.');return null;}
        return io.workspaceSeed(entry,issued,api.inspectPdf,attachment);
      });
      if(!seed)return;await api.openReturned(seed);host.close();await render();
    }finally{working=false;controls();}
  }
  function attach(entry){if(working||api.status().busy)return;attachmentTarget={entry:clone(entry),stamp:api.capture().stamp};$('updatedRenderingFile').click();}
  $('updatedRenderingFile').onchange=guard(async e=>{
    const file=e.target.files[0],captured=attachmentTarget,target=captured?.entry;e.target.value='';attachmentTarget=null;if(!file||!target||working||api.status().busy)return;
    working=true;let attachment;try{await api.lock(async()=>{api.message('Checking the selected PDF…');const issued=await retained(target.taskId);attachment=await io.renderingAttachment(target,issued,file,api.inspectPdf);await io.retain(attachment);});await host.refresh();}
    finally{working=false;controls();}
    if(host.getShown()?.id===target.id&&api.matches(captured.stamp))await open(target,attachment);else api.message('Rendering retained for the earlier selected revision. The current workspace was not changed.');
  });
  function controls(){const s=api.capture(),disabled=api.status().busy||working;for(const button of document.querySelectorAll('[data-round-action]'))button.disabled=disabled||!s.returned||s.comparison&&['locateRegion','showRegion','exportFollowup'].includes(button.id);$('roundVersion').disabled=disabled||!s.returned;}
  async function render(){
    if(api.status().busy)return;
    const scene=api.capture(),round=scene.returned;$('returnedPanel').hidden=!round;$('returnedBar').hidden=!round;document.body.classList.toggle('returned-review',Boolean(round));
    if(!round){panelId=null;return;}
    if(panelId!==round.id){position=0;panelId=round.id;$('roundStatus').textContent='';}
    $('roundVersion').value=scene.comparison?'previous':'current';
    $('roundIdentity').textContent=`Reviewing ${scene.files.ly.name} · ${scene.files.rendered.name} · response ${round.responseId.slice(0,8)}`;
    const issued=await retained(round.taskId);if(api.capture().returned?.id!==round.id)return;
    const get=()=>api.capture().returned;
    await api.corrections.open({key:round.id,issued,candidate:true,shared:false,
      ids:{previous:'previousFinding',next:'nextFinding',explanation:'roundExplanation',approve:'looksCorrect',reject:'stillCorrection',clarify:'needsClarification',state:'roundState'},
      matches:s=>s.returned?.id===round.id,
      findings:()=>issued.task.findings,
      result:id=>get()?.reported.find(f=>f.id===id)?.agent,
      explanation:id=>get()?.reported.find(f=>f.id===id)?.explanation??'',
      saveExplanation:(id,value)=>api.updateReturned(r=>r.reported.find(f=>f.id===id).explanation=value),
      decision:id=>get()?.reported.find(f=>f.id===id)?.decision,
      state:id=>(get()?.reported.find(f=>f.id===id)?.state??'unchecked').replaceAll('_',' '),
      canApprove:()=>!api.capture().comparison,
      location:id=>get()?.locations?.[id],
      exportPackage:()=>api.lock(async()=>{await api.flush();const s=api.capture();api.download(await api.zip(await makeReturnedBackup(s.review,s.files,s.returned)),'score-desk-comparison.zip');}),
      saveLocation:async(id,location)=>{await api.lock(()=>api.commitDecision(r=>{r.locations={...r.locations,[id]:location};}));return true;},
      saveDecision:async(id,value,explanation)=>{
        if(value!=='looks_correct'&&!explanation.trim())throw new Error('Add your explanation before requesting another correction or source clarification.');
        const state={looks_correct:'resolved',needs_correction:'open',needs_clarification:'needs_source_clarification'}[value];
        await api.lock(()=>api.commitDecision(r=>{const f=r.reported.find(f=>f.id===id);f.explanation=explanation;f.state=state;f.decision={state,explanation,at:new Date().toISOString(),reviewed:{snapshotId:r.contentSnapshotId,codeSha256:r.codeSha256,renderSha256:r.renderSha256}};}));
        $('roundStatus').textContent='Human decision saved.';return true;
      },
      onSelect:async next=>{position=next;await details();}
    });
    await details();controls();
  }
  async function details(){
    const scene=api.capture(),round=scene.returned,f=round?.reported[position];if(!f)return;
    const annotation=scene.review.findings.find(m=>m.id===f.associationId);
    $('roundAnchor').textContent=annotation?.strokes.length?'Marked passage on current rendering.':annotation?'Text-only note on current rendering.':'No new note or marks associated.';
    $('locateRegion').textContent=annotation?'Replace current note or marks':'Add current note or marks';
    $('showRegion').textContent=annotation?.strokes.length?'Show current region':'Show current note';
    $('roundInstructions').textContent=(f.instructionHistory??[]).map(h=>`Task ${h.taskId}\nReviewer: ${h.explanation||'[No additional explanation]'}\nAnnotation comment: ${h.regionComment||'[None]'}`).join('\n\n')||'No earlier human instructions.';
    $('roundMetadata').textContent=JSON.stringify({workspaceId:round.id,contentSnapshotId:round.contentSnapshotId,responseId:round.responseId,taskId:round.taskId,codeSha256:round.codeSha256,renderSha256:round.renderSha256,provenance:round.provenance,decision:f.decision},null,2);
  }
  $('locateRegion').onclick=guard(async()=>{const s=api.capture(),f=s.returned?.reported[position];if(!f||api.status().busy||s.comparison)return;api.newRegion(f.id);await render();});
  $('showRegion').onclick=guard(async()=>{const s=api.capture(),f=s.returned?.reported[position];if(f?.associationId)await api.selectMark(f.associationId);});
  $('roundReload').onclick=guard(async()=>{if(!api.status().busy){await api.reloadReturned();await render();}});
  $('roundVersion').onchange=guard(async()=>{const s=api.capture();if(!s.returned)return;const issued=await retained(s.returned.taskId);await api.compare($('roundVersion').value==='previous'?issued.files.rendered.blob:null);await render();});
  $('roundHistory').onclick=guard(async()=>{const s=api.capture();if(!s.returned)return;const events=await returnedHistory(s.returned.id);$('roundHistoryText').textContent=JSON.stringify(events.map(e=>({id:e.id,parentHistoryId:e.parentHistoryId,revision:e.storageRevision,createdAt:e.createdAt,decisions:e.returned.reported.map(f=>({id:f.id,state:f.state,decision:f.decision}))})),null,2);});
  document.addEventListener('score-desk-change',()=>{render().catch(e=>api.message(e.message,true));});document.addEventListener('score-desk-controls',()=>{controls();if(!api.status().busy)render().catch(e=>api.message(e.message,true));});
  return {io,open,attach,render,isBusy:()=>working,selected:()=>position};
}

import {clone} from './model.js';
import {retained,retainedList,retain} from './handoff-store.js';
import {returnedHistory} from './storage.js';
import {workspaceSeed,renderingAttachment,followupTask} from './returned.js';
const $=id=>document.getElementById(id);
export function installReturned(api,host){
  let position=0,panelId=null,images=[],attachmentTarget=null,working=false,decisionBusy=false;
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
      if(!seed)return;await api.openReturned(seed);host.close();position=0;await render();
    }finally{working=false;controls();}
  }
  function attach(entry){if(working||api.status().busy)return;attachmentTarget={entry:clone(entry),stamp:api.capture().stamp};$('updatedRenderingFile').click();}
  $('updatedRenderingFile').onchange=guard(async e=>{
    const file=e.target.files[0],captured=attachmentTarget,target=captured?.entry;e.target.value='';attachmentTarget=null;if(!file||!target||working||api.status().busy)return;
    working=true;let attachment;try{await api.lock(async()=>{api.message('Validating the selected PDF for the captured code revision…');const issued=await retained(target.taskId);attachment=await io.renderingAttachment(target,issued,file,api.inspectPdf);await io.retain(attachment);});await host.refresh();}
    finally{working=false;controls();}
    if(host.getShown()?.id===target.id&&api.matches(captured.stamp))await open(target,attachment);else api.message('Rendering retained for the earlier selected revision. The current workspace was not changed.');
  });
  function controls(){const s=api.capture(),disabled=api.status().busy||working||decisionBusy;for(const button of document.querySelectorAll('[data-round-action]'))button.disabled=disabled||!s.returned||s.comparison&&['looksCorrect','stillCorrection','needsClarification','locateRegion','showRegion','exportFollowup'].includes(button.id);$('roundVersion').disabled=disabled||!s.returned;}
  async function render(){
    const scene=api.capture(),round=scene.returned;$('returnedPanel').hidden=!round;$('returnedBar').hidden=!round;document.body.classList.toggle('returned-review',Boolean(round));
    if(!round){for(const url of images)URL.revokeObjectURL(url);images=[];panelId=null;$('renderedLabel').textContent='Rendered score';return;}
    if(panelId!==round.id){position=0;panelId=round.id;$('roundStatus').textContent='';}$('roundVersion').value=scene.comparison?'previous':'current';$('renderedLabel').textContent=scene.comparison?'Previous rendering · comparison only':'Returned rendering · current review';
    $('roundIdentity').textContent=`Reviewing ${scene.files.ly.name} · ${scene.files.rendered.name} · response ${round.responseId.slice(0,8)} · ${round.attachmentId?'attached version '+round.attachmentId.slice(0,8):'received revision'}`;
    $('roundProgress').textContent=`${round.reported.filter(f=>f.decision).length} of ${round.reported.length} reported findings reviewed. This is not whole-score verification.`;
    position=Math.max(0,Math.min(round.reported.length-1,position));const f=round.reported[position];$('reportedFinding').hidden=!f;if(!f){controls();return;}
    $('roundFindingTitle').textContent=`Finding ${position+1} / ${round.reported.length} · #${f.number}`;$('roundOriginal').textContent=f.comment;$('roundAgent').textContent=f.agent.explanation;$('roundLocation').textContent=f.agent.codeLocation?`Code location: ${f.agent.codeLocation}`:'';
    $('roundState').textContent=f.state.replaceAll('_',' ');$('roundAnchor').textContent=scene.review.findings.some(m=>m.id===f.associationId)?'Explicit region on current rendering.':'Current passage not located. Historical context remains available; re-marking is optional.';
    $('locateRegion').textContent=scene.review.findings.some(m=>m.id===f.associationId)?'Replace current region (undo available)':'Mark current region (optional)';
    if(document.activeElement!==$('roundExplanation'))$('roundExplanation').value=f.explanation;
    $('roundInstructions').textContent=(f.instructionHistory??[]).map(h=>`Task ${h.taskId}\nReviewer: ${h.explanation||'[No additional explanation]'}\nRegion comment: ${h.regionComment||'[None]'}`).join('\n\n')||'No earlier human instructions.';
    const token=round.id+':'+f.id;const issued=await retained(round.taskId);if(api.capture().returned?.id!==round.id||round.reported[position]?.id!==f.id)return;
    if($('roundContext').dataset.token!==token){$('roundContext').dataset.token=token;$('roundStatus').textContent='';for(const url of images)URL.revokeObjectURL(url);images=[];$('roundContext').replaceChildren();
      for(let i=0;i<2;i++){const blob=issued.payloads.get(f.context[i]);if(!blob)continue;const url=URL.createObjectURL(blob);images.push(url);const a=document.createElement('a'),img=document.createElement('img'),label=document.createElement('p');label.textContent=`Historical ${i?'clean':'marked'} context · old page ${f.origin.page??'not specified'} · open image to enlarge`;a.href=url;a.target='_blank';a.rel='noopener';img.src=url;img.alt=label.textContent;a.append(img);$('roundContext').append(label,a);}
    }
    $('roundMetadata').textContent=JSON.stringify({workspaceId:round.id,contentSnapshotId:round.contentSnapshotId,responseId:round.responseId,taskId:round.taskId,parentRevisionId:round.parentRevisionId,codeSha256:round.codeSha256,renderSha256:round.renderSha256,provenance:round.provenance,decision:f.decision},null,2);controls();
  }
  $('previousFinding').onclick=guard(async()=>{if(api.status().busy)return;position--;await render();});$('nextFinding').onclick=guard(async()=>{if(api.status().busy)return;position++;await render();});
  $('roundExplanation').oninput=()=>{const s=api.capture(),f=s.returned?.reported[position];if(!f||api.status().busy){if(f)$('roundExplanation').value=f.explanation;return;}api.updateReturned(r=>r.reported.find(item=>item.id===f.id).explanation=$('roundExplanation').value);};
  async function decide(state){
    if(working||decisionBusy||api.status().busy||api.capture().comparison)return;const s=api.capture(),f=s.returned?.reported[position];if(!f)return;
    if(state!=='resolved'&&!f.explanation.trim())throw new Error('Add your explanation before requesting another correction or source clarification.');
    decisionBusy=true;controls();try{await api.lock(()=>api.commitDecision(round=>{const item=round.reported.find(item=>item.id===f.id);item.state=state;item.decision={state,explanation:item.explanation,at:new Date().toISOString(),reviewed:{snapshotId:round.contentSnapshotId,codeSha256:round.codeSha256,renderSha256:round.renderSha256}};}));$('roundStatus').textContent='Human decision saved for this exact code and rendering. Earlier decisions retained.';await render();}
    finally{decisionBusy=false;controls();}
  }
  $('looksCorrect').onclick=guard(()=>decide('resolved'));$('stillCorrection').onclick=guard(()=>decide('open'));$('needsClarification').onclick=guard(()=>decide('needs_source_clarification'));
  $('locateRegion').onclick=guard(async()=>{const s=api.capture(),f=s.returned?.reported[position];if(!f||api.status().busy||s.comparison)return;api.newRegion(f.id);await render();});
  $('showRegion').onclick=guard(async()=>{const s=api.capture(),f=s.returned?.reported[position];if(f?.associationId)await api.selectMark(f.associationId);});
  $('roundReload').onclick=guard(async()=>{if(!api.status().busy){await api.reloadReturned();await render();}});
  $('roundVersion').onchange=guard(async()=>{const s=api.capture();if(!s.returned)return;const issued=await retained(s.returned.taskId);await api.compare($('roundVersion').value==='previous'?issued.files.rendered.blob:null);await render();});
  $('roundHistory').onclick=guard(async()=>{const s=api.capture();if(!s.returned)return;const events=await returnedHistory(s.returned.id);$('roundHistoryText').textContent=JSON.stringify(events.map(e=>({id:e.id,parentHistoryId:e.parentHistoryId,revision:e.storageRevision,createdAt:e.createdAt,decisions:e.returned.reported.map(f=>({id:f.id,state:f.state,decision:f.decision}))})),null,2);});
  document.addEventListener('score-desk-change',()=>{render().catch(e=>api.message(e.message,true));});document.addEventListener('score-desk-controls',controls);
  return {io,open,attach,render,selected:()=>position};
}

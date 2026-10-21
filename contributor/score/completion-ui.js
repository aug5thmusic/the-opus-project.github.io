import {prepareCompletion} from './completion.js';
import {SCOPES,completionFindings} from './completion-model.js';
import {LIMITS} from './workflow.js';
const $=id=>document.getElementById(id);
export function installCompletion(api){
  let job=null,attempt=null,urls=[],published=null;
  const io={prepare:prepareCompletion,zip:api.zip,commit:api.commitCompletion};
  const declaration=()=>({scope:document.querySelector('input[name="finishScope"]:checked')?.value??'',note:$('finishNote').value,reviewer:$('finishReviewer').value});
  const status=text=>{$('finishStatus').textContent=text;};
  function clear(){for(const url of urls)URL.revokeObjectURL(url);urls=[];$('finishDownloads').replaceChildren();$('finishSummary').textContent='';published=null;}
  function controls(){
    const busy=Boolean(job);for(const field of $('finishForm').querySelectorAll('input,textarea'))field.disabled=busy;
    $('prepareFinish').disabled=busy||!declaration().scope||Boolean(published);$('closeFinish').disabled=busy;$('cancelFinish').hidden=!busy;$('cancelFinish').disabled=job?.phase==='committing';
  }
  function history(){const s=api.capture();$('completionHistory').replaceChildren();for(const r of [...s.completions].reverse()){const p=document.createElement('p');p.textContent=`${r.revision.id===s.revisionId?'Matches current review state':'Historical completion · does not declare the current revision'} · ${SCOPES[r.scope]} · ${r.createdAt} · ${r.reviewer??'Reviewer unknown'} · ${r.totals.unresolved} unresolved · ${r.totals.missingDecisions} missing decisions · ${r.id}`;$('completionHistory').append(p);}$('completionCount').textContent=s.completions.length;}
  function open(){
    if(api.status().busy||!api.capture().review)return;clear();attempt=null;$('finishForm').reset();try{$('finishReviewer').value=localStorage.getItem('score-desk-reviewer')??'';}catch{}
    const s=api.capture(),findings=completionFindings(s.review,s.returned);$('finishRevision').textContent=`Current review: ${s.files.ly.name} · ${s.files.rendered.name}${s.returned?' · response '+s.returned.responseId:''}`;
    $('finishOverview').textContent=`${findings.length} findings · ${findings.filter(f=>f.state!=='resolved').length} unresolved · ${findings.filter(f=>f.kind==='reported'&&!f.decision).length} reported findings without a decision. All are included.`;
    status('Choose what you reviewed. This declaration does not resolve findings, approve a response or verify the score.');controls();$('finishDialog').showModal();
  }
  function cancel(){if(job?.phase==='preparing'){job.cancelled=true;status('Cancelling preparation. Your work is retained; editing resumes when preparation stops.');}else if(job)status('Saving the completion. Please wait for this atomic operation to finish.');else $('finishDialog').close();}
  $('finishReview').onclick=open;$('closeFinish').onclick=cancel;$('cancelFinish').onclick=cancel;
  $('finishDialog').addEventListener('cancel',e=>{if(job){e.preventDefault();cancel();}});
  $('finishDialog').addEventListener('close',()=>{if(job&&!$('finishDialog').open)job.cancelled=true;});
  $('finishForm').oninput=()=>{if(!job){attempt=null;clear();status('Ready to prepare the selected review scope.');}controls();};
  $('finishForm').onsubmit=async e=>{
    e.preventDefault();if(job||api.status().busy||!declaration().scope||published)return;
    const fields=declaration(),key=JSON.stringify({stamp:api.capture().stamp,fields});
    if(attempt?.key!==key)attempt={key,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
    const thisJob=job={phase:'preparing',cancelled:false};clear();controls();
    const valid=s=>{const reason=job!==thisJob?'Operation replaced':thisJob.cancelled?'Preparation cancelled':!$('finishDialog').open?'Dialog closed':!api.matches(s.stamp)?'Review revision changed':JSON.stringify(declaration())!==JSON.stringify(fields)?'Scope fields changed':null;if(reason)throw new Error(reason);return true;};
    try{await api.lock(async()=>{
      await api.flush();const scene=api.capture();if(!valid(scene))throw new Error('Preparation cancelled or review changed.');
      const {record,payloads}=await io.prepare(scene,fields,attempt,text=>status(text),api.packageMaker);if(!valid(scene))throw new Error('Preparation cancelled or review changed.');
      const zip=await io.zip(payloads,text=>status(text));if(!valid(scene))throw new Error('Preparation cancelled or review changed.');
      if(zip.size>LIMITS.zip)throw new Error('Completed ZIP exceeds the 256 MB import limit.');
      const summary=await payloads.get('completion-summary.txt').text();if(!valid(scene))throw new Error('Preparation cancelled or review changed.');
      thisJob.phase='committing';controls();status('Saving the completion for this exact revision…');await io.commit(record,scene.stamp);
      if(!valid(scene))throw new Error('Completion retained as history; downloads were not published because the dialog was closed.');
      const fragment=document.createDocumentFragment(),individual=document.createElement('details'),label=document.createElement('summary');label.textContent=`Individual files (${payloads.size})`;individual.append(label);
      for(const [path,blob]of [['score-desk-completed-review.zip',zip],...payloads]){const a=document.createElement('a'),url=URL.createObjectURL(blob);urls.push(url);a.href=url;a.download=path.replaceAll('/','__');a.textContent=path==='score-desk-completed-review.zip'?'Download completed-review ZIP':path;a.className='download';(path==='score-desk-completed-review.zip'?fragment:individual).append(a);}fragment.append(individual);
      $('finishSummary').textContent=summary;$('finishDownloads').append(fragment);published=scene.stamp;
      try{if(fields.reviewer.trim())localStorage.setItem('score-desk-reviewer',fields.reviewer.trim());else localStorage.removeItem('score-desk-reviewer');}catch{}
      status(`Package ready · ${SCOPES[record.scope]} ${record.totals.unresolved} unresolved; ${record.totals.missingDecisions} missing decisions. No score verification claimed.`);history();
    });}catch(error){clear();status(`Not finished: ${error.message} Your review is retained. Retry when ready.`);api.message($('finishStatus').textContent,true);if(thisJob.cancelled)attempt=null;}
    finally{if(job===thisJob)job=null;controls();}
  };
  document.addEventListener('score-desk-change',()=>{if(published&&!api.matches(published)){clear();status('Review changed. Earlier completions remain historical; choose Finish review for this revision.');}history();});
  document.addEventListener('score-desk-completions',history);
  return {io,open,capture:api.capture,job:()=>job};
}

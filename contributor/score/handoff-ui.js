import {clone,sha256} from './model.js';
import {makeRecovery} from './export.js';
import {readPackage,makeInput,makeTask,readResponse,acceptResponse,taskFindings,contextPaths,localTaskDelivery} from './workflow.js';
import {installReturned} from './returned-ui.js';
import {restoreReturnedBackup} from './returned.js';
import {retain,retained,retainedList} from './handoff-store.js';
import {retainPortableTask} from './shared-packages.js';
const $=id=>document.getElementById(id);
export function installHandoff(api){
  let job=false,resolving=false,pending=null,shown=null,links=[],prompt='',issuedStamp=null;
  const io={readPackage,makeInput,makeTask,readResponse,acceptResponse,retain};
  const status=(text,error=false)=>{$('handoffStatus').textContent=text;api.message(text,error);};
  const guarded=action=>async(...args)=>{try{await action(...args);}catch(e){console.error(e);status(e.message,true);}};
  const canResolve=response=>response.code.status==='unchanged'||response.rendering.status==='supplied';
  function resolutionControls(response){for(const button of $('responsePreview').querySelectorAll('[data-resolve-finding]'))button.disabled=resolving||!canResolve(response);}
  const clear=()=>{for(const url of links)URL.revokeObjectURL(url);links=[];$('handoffDownloads').replaceChildren();};
  function downloadLink(blob,name,label=name,parent=$('handoffDownloads')){const a=document.createElement('a'),url=URL.createObjectURL(blob);links.push(url);a.href=url;a.download=name.replaceAll('/','__');a.textContent=label;a.className='download';parent.append(a);return a;}
  function taskDownloads(entry,zip){
    downloadLink(zip,'score-desk-ai-task.zip','Download task ZIP').classList.add('task-download');
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Individual files';details.append(summary);
    for(const [path,blob]of entry.payloads)downloadLink(blob,path,path,details);$('handoffDownloads').append(details);
    const local=document.createElement('details'),heading=document.createElement('summary'),link=document.createElement('a');
    heading.textContent='Run with local AI';link.href='SECURITY.md';link.target='_blank';link.rel='noopener';link.textContent='Setup and limits';
    local.append(heading,document.createTextNode('Requires local setup. '),link);$('handoffDownloads').append(local);
  }
  function show(task=false){$('workspaceDialog').close();$('taskInstructions').hidden=!task;$('handoffIntro').hidden=task;if(!$('handoffDialog').open)$('handoffDialog').showModal();}
  const close=()=>{if(!job)$('handoffDialog').close();};$('closeHandoff').onclick=close;
  $('handoffDialog').addEventListener('cancel',e=>{if(job){e.preventDefault();status('Preparing files. Editing stays blocked until this operation finishes.');}});
  // A closed dialog invalidates a running job, even if closed programmatically.
  let generation=0;$('handoffDialog').addEventListener('close',()=>{generation++;});
  async function history(){
    const entries=await retainedList(),names=new Map(entries.filter(e=>e.kind==='task').map(e=>[e.id,e.review.files.ly.name]));
    $('handoffHistory').hidden=entries.length===0;$('inspectHandoff').hidden=entries.length===0;$('handoffEmpty').hidden=entries.length!==0;
    $('handoffEmpty').textContent='No saved tasks, responses or reviews yet.';
    $('handoffHistory').replaceChildren(new Option('Choose a saved task, response, or review…',''));
    for(const e of entries){const name=e.kind==='task'?e.review.files.ly.name:e.kind==='review-backup'?e.review.files.rendered.name:names.get(e.taskId)??'AI response',kind=e.kind==='response'?(e.parentRevisionId?'human decision':e.renderingStatus==='pending'?'response · rendering pending':'response · PDF supplied'):e.kind;$('handoffHistory').add(new Option(`${kind} · ${name} · ${new Date(e.createdAt).toLocaleString()}`,e.id));}
  }
  $('openPackage').onclick=()=>$('packageFile').click();
  $('packageFile').onchange=guarded(async e=>{const file=e.target.files[0];e.target.value='';if(!file||api.status().busy)return;const captured=api.capture().stamp;status('Checking package files…');
    const parsed=await api.lock(()=>io.readPackage(file,api.inspectPdf));if(!api.matches(captured))throw new Error('The review changed while checking this package. Open it again when ready.');
    // An original task ZIP carries the immutable baseline needed in a fresh
    // browser. Validate every byte before retaining it; never replace an ID.
    if(parsed.payloads.has('task.json'))await api.lock(()=>retainPortableTask(file,api.inspectPdf,{lookup:retained,write:io.retain}));
    const restored=await restoreReturnedBackup(parsed,api.inspectPdf);
    if(restored){for(const entry of [restored.issued,restored.entry]){const existing=await retained(entry.id),path=entry.kind==='task'?'task.json':'response.json';if(existing&&(JSON.stringify(existing.task?.baseline??existing.baseline)!==JSON.stringify(entry.task?.baseline??entry.baseline)||await sha256(await existing.payloads.get(path).arrayBuffer())!==await sha256(await entry.payloads.get(path).arrayBuffer())))throw new Error('Retained task or response identity conflicts with this recovery.');if(!existing)await io.retain(entry);}await api.openReturned(restored.seed);}
    else await api.openImported(parsed);await history();
  });
  $('exportInput').onclick=guarded(async()=>{const s=api.capture();if(!s.review)return;await api.lock(async()=>{const files=await io.makeInput(s.files),zip=await api.zip(files);await api.download(zip,'score-desk-input.zip');});status('Clean input package downloaded (no findings).');});
  $('exportTask').onclick=guarded(async()=>{
    if(!api.capture().review||api.status().busy)return;
    show(true);clear();$('responsePreview').replaceChildren();$('acceptResponse').hidden=true;$('handoffTitle').textContent='Send for corrections';$('promptFallback').hidden=true;
    const s=api.capture(),token=++generation;job=true;$('closeHandoff').disabled=true;status('Preparing the exact baseline and visual context…');
    try{await api.lock(async()=>{
      const entry=s.returned?await returnedUI.io.followupTask(s,'120',text=>status(text),api.packageMaker):await io.makeTask(s.review,s.files,s.doc,'120',text=>status(text),api.packageMaker),zip=await api.zip(entry.payloads,text=>status(text));
      if(generation!==token||!api.matches(s.stamp))throw new Error('The task export changed or was cancelled. Export again.');
      // Retain before publishing: a response must have an issued baseline here.
      await io.retain(entry);if(generation!==token||!api.matches(s.stamp))throw new Error('Task retained as historical; export was cancelled.');
      const text=await entry.payloads.get('PROMPT.txt').text();if(generation!==token||!api.matches(s.stamp))throw new Error('Task retained as historical; export was cancelled.');
      issuedStamp=s.stamp;prompt=text;$('aiPrompt').value=prompt;$('promptFallback').hidden=false;
      taskDownloads(entry,zip);
      status(`AI task ready · ${entry.review.files.ly.name} · ${entry.task.findings.length} findings. Exact baseline retained locally.`);
    });await history();}catch(e){clear();prompt='';$('promptFallback').hidden=true;throw e;}
    finally{job=false;$('closeHandoff').disabled=false;}
  });
  $('copyPrompt').onclick=guarded(async()=>{
    if(!prompt){status('Choose Send for corrections first, or inspect a retained task.');return;}
    show(true);$('aiPrompt').value=prompt;$('promptFallback').hidden=false;
    try{await navigator.clipboard.writeText(prompt);status('Prompt copied. Selectable text is also shown below.');}catch{status('Clipboard is unavailable. Select and copy the complete prompt below.');$('aiPrompt').focus();$('aiPrompt').select();}
  });
  $('importResponse').onclick=()=>$('responseFile').click();
  $('responseFile').onchange=guarded(async e=>{
    const file=e.target.files[0];e.target.value='';if(!file||api.status().busy)return;status('Checking AI response against its issued task…');
    const parsed=await api.lock(async()=>{const next=await io.readResponse(file);if(next.response.rendering.status==='supplied')await api.inspectPdf({source:next.issued.files.source,rendered:{blob:next.payloads.get(next.response.rendering.path)}});return next;});
    pending=parsed;shown=null;clear();$('promptFallback').hidden=true;$('handoffTitle').textContent='Preview AI response';show();renderResponse(parsed,null);$('acceptResponse').hidden=false;
    status('Response validated. Review the proposal below, then Accept as a retained revision. Your current review will stay open.');
  });
  function renderResponse(parsed,entry){
    const {issued,response,payloads}=parsed,root=$('responsePreview');root.replaceChildren();
    const p=document.createElement('p');p.className='response-banner';p.textContent=response.code.status==='changed'&&response.rendering.status==='pending'?'Code changes received — updated rendering pending.':response.rendering.status==='supplied'?'Updated rendering ready to review.':'No code changes received.';root.append(p);
    const note=document.createElement('p');note.textContent=`Response to ${issued.review.files.ly.name} · task ${issued.id.slice(0,8)}. Original marks are shown on the previous rendering.`;root.append(note);
    downloadLink(issued.files.rendered.blob,'previous-rendering.pdf','Previous rendering with original findings',root);
    downloadLink(issued.files.source.blob,'original-printed-source.pdf','Original printed source',root);
    downloadLink(response.code.status==='changed'?payloads.get(response.code.path):issued.files.ly.blob,'proposed.ly',response.code.status==='changed'?'Proposed LilyPond — rendering '+response.rendering.status:'Unchanged baseline LilyPond',root);
    if(response.rendering.status==='supplied')downloadLink(payloads.get(response.rendering.path),'proposed-rendering.pdf','Updated PDF from '+response.rendering.producer,root);
    if(entry){const actions=document.createElement('div'),open=document.createElement('button'),attach=document.createElement('button');open.id='reviewReturned';open.className='primary';open.textContent='Review this returned revision';open.dataset.handoffAction='';open.onclick=guarded(()=>returnedUI.open(entry));attach.id='attachUpdated';attach.textContent='Attach updated rendering';attach.dataset.handoffAction='';attach.onclick=()=>returnedUI.attach(entry);actions.append(open,attach);root.append(actions);}
    for(const f of taskFindings(issued)){const result=response.results.find(r=>r.id===f.id),card=document.createElement('article');card.className='response-finding';const title=document.createElement('h3');title.textContent=`#${f.number} · ${f.page==null?'current passage not located':'previous rendered page '+f.page}`;card.append(title);
      for(const text of [`Original finding: ${f.comment}`,`Agent: ${result.status.replaceAll('_',' ')} — ${result.explanation}`,result.codeLocation?`Code location: ${result.codeLocation}`:''])if(text){const p=document.createElement('p');p.textContent=text;card.append(p);}
      const state=entry?.findings.find(item=>item.id===f.id)?.state??({changed:'corrected_pending_review',unchanged_with_reason:'open',needs_clarification:'needs_source_clarification'})[result.status];const label=document.createElement('strong');label.textContent='Review state: '+state.replaceAll('_',' ');card.append(label);
      const paths=contextPaths(issued,f);for(const [i,type]of ['marked','clean'].entries()){const blob=issued.payloads.get(paths[i]);if(blob){const img=document.createElement('img'),caption=document.createElement('p'),url=URL.createObjectURL(blob);links.push(url);img.src=url;img.alt=`Original ${type} context for finding ${f.number}`;caption.textContent=img.alt;card.append(caption,img);}}
      if(entry&&state!=='resolved'){const approve=document.createElement('button');approve.textContent='Human: resolve finding after visual review';approve.dataset.resolveFinding=f.id;approve.disabled=resolving||!canResolve(response);approve.title=!canResolve(response)?'Code changed and updated rendering is pending; visual approval is unavailable.':'';
        approve.onclick=guarded(()=>resolveFinding(parsed,entry,f.id));card.append(approve);}
      root.append(card);
    }
    const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Response details';pre.textContent=JSON.stringify(response,null,2);details.append(summary,pre);root.append(details);
    $('handoffDialog').scrollTop=0;
  }
  async function resolveFinding(parsed,entry,id){
    // Single-flight, set before any await. A detached/stale button must not
    // branch from an earlier displayed revision after a successful decision.
    if(job||api.status().busy||shown?.id!==entry.id||!canResolve(parsed.response))return;
    job=true;resolving=true;resolutionControls(parsed.response);$('closeHandoff').disabled=true;$('responsePreview').setAttribute('aria-busy','true');
    try{await api.lock(async()=>{
      const next=clone(shown);next.id=crypto.randomUUID();next.createdAt=new Date().toISOString();next.parentRevisionId=shown.id;next.findings.find(item=>item.id===id).state='resolved';
      status('Saving human review decision…');await io.retain(next);shown=next;clear();renderResponse(parsed,next);await history();status('Human decision saved.');
    });}
    finally{job=false;resolving=false;resolutionControls(parsed.response);$('closeHandoff').disabled=false;$('responsePreview').setAttribute('aria-busy','false');}
  }
  $('acceptResponse').onclick=guarded(async()=>{
    if(!pending||job)return;job=true;$('acceptResponse').disabled=true;$('closeHandoff').disabled=true;
    try{const entry=await api.lock(()=>io.acceptResponse(pending));shown=entry;$('acceptResponse').hidden=true;clear();renderResponse(pending,entry);await history();status('Accepted and saved for review.');}
    finally{job=false;$('acceptResponse').disabled=false;$('closeHandoff').disabled=false;}
  });
  $('inspectHandoff').onclick=guarded(async()=>{const entry=await retained($('handoffHistory').value);if(!entry)return;clear();$('responsePreview').replaceChildren();$('acceptResponse').hidden=true;$('promptFallback').hidden=true;show(entry.kind==='task');
    if(entry.kind==='task'){const delivery=await localTaskDelivery(entry);prompt=delivery.prompt;issuedStamp=null;$('handoffTitle').textContent='Retained AI task · historical baseline';$('aiPrompt').value=prompt;$('promptFallback').hidden=false;taskDownloads(delivery,await api.zip(delivery.payloads));}
    else if(entry.kind==='response'){const issued=await retained(entry.taskId);pending={issued,response:entry.response,payloads:entry.payloads};shown=entry;$('handoffTitle').textContent='Retained response revision';renderResponse(pending,entry);}
    else if(entry.kind==='render-attachment'){const responseEntry=await retained(entry.responseId);shown=responseEntry;$('handoffTitle').textContent='Retained rendering attachment';await returnedUI.open(responseEntry,entry);}
    else{ $('handoffTitle').textContent='Retained prior review';const payloads=await makeRecovery(entry.review,entry.files);downloadLink(await api.zip(payloads),'prior-review-recovery.zip','Download prior review; reopen with Open package');}
    status('Inspecting retained history. Your current workspace is unchanged.');
  });
  // Invalidate generated downloads as soon as the visible review changes.
  document.addEventListener('score-desk-change',()=>{if(issuedStamp&&!api.matches(issuedStamp)){clear();issuedStamp=null;prompt='';$('aiPrompt').value='';$('promptFallback').hidden=true;status('Review changed. The issued task remains in history; export a new task for the latest findings.');}});
  const returnedUI=installReturned(api,{getShown:()=>shown,close,refresh:history});
  $('exportFollowup').onclick=()=>$('exportTask').click();
  history().catch(e=>{$('handoffEmpty').textContent='Saved history could not be loaded.';status('Handoff history is unavailable: '+e.message,true);});
  return {io,history,returnedUI};
}

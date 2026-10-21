import * as pdfjs from './vendor/pdf.mjs';
import {clone,identify,newReview,bounds,paint,validateReview,roles,PALETTE} from './model.js';
import {getSaved,putSaved,listSaved} from './storage.js';
import {makeRecovery,makePackage,zipFiles} from './export.js';
import {installHandoff} from './handoff-ui.js';
import {retain} from './handoff-store.js';
import {makeReturnedBackup,restoreInstructionHistory} from './returned.js';
import {mergeCompletions,exactReview} from './completion-model.js';
import {addCompletionHistory} from './completion.js';
import {installCompletion} from './completion-ui.js';
pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs';
const $=id=>document.getElementById(id);
let review=null, files=null, active=null, focused=null, mode='navigate', gesture=null, undo=[],redo=[], busy=false,revision=0,dirty=false;
let persistedRevision=null,saveConflict=false,recoveryStamp=null,recoveryJob=null,exportJob=null;
let returned=null,comparison=null;
let revisionId=crypto.randomUUID(),completions=[];
const recordKey=()=>returned?.id??review?.snapshotId;
const stamp=()=>({snapshotId:review?.snapshotId,workspaceId:returned?.id??null,revision});
const matchesStamp=value=>value?.snapshotId===review?.snapshotId&&(value?.workspaceId??null)===(returned?.id??null)&&value?.revision===revision;
const unprotectedWork=()=>Boolean(review&&(dirty||saveFailed)&&!matchesStamp(recoveryStamp));
for(const entry of PALETTE)$('highlightColor').add(new Option(entry.name,entry.color));
const views=Object.fromEntries(['source','rendered'].map(kind=>[kind,{kind,doc:null,page:1,viewport:null,serial:0,task:null}]));
function message(text,error=false){$('message').textContent=text;document.querySelector('.statusbar').classList.toggle('error',error);}
function guard(fn){return async (...args)=>{try{await fn(...args);}catch(e){console.error(e);message(e.message,true);}};}
// Annotation history includes its links, but never rolls back human decisions.
function annotationState(){return {review:clone(review),workspaceId:returned?.id,associations:returned?.reported.map(f=>[f.id,f.associationId])};}
function checkpoint(){undo.push(annotationState());if(undo.length>80)undo.shift();redo=[];}
function changed(){revision++;revisionId=crypto.randomUUID();dirty=true;review.updatedAt=new Date().toISOString();invalidateExport();document.dispatchEvent(new Event('score-desk-change'));renderFindings();drawOverlay();scheduleSave();}
function controls(){
  for(const id of ['newFinding','draw','undo','redo','draft','export','highlightColor','autoColor','showAll','comment','findingState','saveFinding','deleteFinding'])$(id).disabled=!review||busy;
  for(const region of [document.querySelector('main'),document.querySelector('.toolbar'),document.querySelector('.highlight-tools'),$('filesPanel')])region.inert=busy;
  $('load').disabled=busy;$('reopen').disabled=busy;$('undo').disabled=!undo.length||busy;$('redo').disabled=!redo.length||busy;
  for(const el of document.querySelectorAll('[data-handoff-action]'))el.disabled=busy||(el.dataset.needsReview!==undefined&&!review);
  if(comparison)for(const id of ['draw','newFinding','saveFinding'])$(id).disabled=true;
  for(const button of document.querySelectorAll('.finding-open,.focus-finding')){button.disabled=busy||Boolean(comparison);button.title=comparison?'Switch to the current rendering to select current marks.':'';}
  document.dispatchEvent(new Event('score-desk-controls'));
}
function setMode(next){cancelGesture();mode=next;document.body.classList.toggle('drawing',mode==='draw');$('draw').setAttribute('aria-pressed',String(mode==='draw'));$('navigate').setAttribute('aria-pressed',String(mode==='navigate'));message(mode==='draw'?'Draw mode: strokes join the selected finding. New finding starts a separate comment.':'Navigate mode: drag or scroll the page. No marks will be added.');}
function cancelGesture(){if(gesture?.pointerId!==undefined&&$('overlay').hasPointerCapture(gesture.pointerId))$('overlay').releasePointerCapture(gesture.pointerId);gesture=null;drawOverlay();}
async function openPdf(blob){return pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),cMapUrl:'./vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'./vendor/standard_fonts/',wasmUrl:'./vendor/wasm/',iccUrl:'./vendor/iccs/',isEvalSupported:false,enableXfa:false}).promise;}
async function openSnapshot(nextFiles=null,targetId=null,imported=null,seed=null,force=false,completionBundle=null){
  if(busy)return;
  // Lock before the first await. In particular, never prefetch Reopen's record
  // before flushing the current edits, and never reinstall the active snapshot.
  busy=true;controls();cancelGesture();
  const docs=[];
  try{
    await saveNow();
    if(unprotectedWork())throw new Error('The current review could not be saved. Download a recovery ZIP containing the latest edits before opening another snapshot.');
    if(!force&&seed?.returned.id===returned?.id&&returned){message('Returned revision resumed: latest annotations and decisions kept.');return;}
    if(!force&&!imported&&targetId&&targetId===recordKey()){message('Reopened the current snapshot: latest edits and undo history kept.');return;}
    let stored=null,readFailure=null;
    if(targetId){stored=await getSaved(targetId);if(!stored)throw new Error('Snapshot no longer available.');nextFiles=stored.files;}
    message('Hashing selected bytes and loading PDFs…');
    const {identity,snapshotId}=await identify(nextFiles);
    if(!seed&&!returned&&!stored?.returned&&!imported&&snapshotId===review?.snapshotId){message('Reopened the current snapshot: latest edits and undo history kept.');return;}
    if(!stored)try{stored=await getSaved(seed?.returned.id??snapshotId);}catch(error){readFailure=error;}
    // Renaming byte-identical picker inputs resumes the retained snapshot,
    // including the original names recorded in its exact annotation evidence.
    const retainedCompletion=!imported&&!seed&&stored?.completions?.length;
    if(retainedCompletion)nextFiles=stored.files;
    docs.push(await openPdf(nextFiles.source.blob));docs.push(await openPdf(nextFiles.rendered.blob));
    const pages=[];for(let i=1;i<=docs[1].numPages;i++){const p=await docs[1].getPage(i);pages.push({page:i,view:[...p.view],rotation:p.rotate,userUnit:p.userUnit});}
    const expected=newReview(retainedCompletion?stored.review.files:identity,snapshotId,pages);
    let nextReview=stored?.returned?validateReview(stored.review,expected):imported?validateReview(imported,expected):stored?validateReview(stored.review,expected):expected;
    let nextReturned=clone(stored?.returned??seed?.returned??null);
    const restoredInstructions=await restoreInstructionHistory(nextReturned);
    const bundle=completionBundle??seed?.completionBundle,nextCompletions=mergeCompletions(stored?.completions,bundle?.records);
    const nextRevisionId=bundle?.revisionId??((!imported||seed&&stored)?stored?.revisionId:null)??crypto.randomUUID();
    // Completion evidence hashes exact annotation bytes, including their date.
    if(nextCompletions.length)nextReview=exactReview(nextReview,(stored?.returned?stored.review:imported??stored?.review)??nextReview);
    if(seed&&!stored){
      if(readFailure)throw readFailure;
      try{stored=await operations.putSaved({id:nextReturned.id,review:nextReview,files:nextFiles,returned:nextReturned,revisionId:nextRevisionId,completions:nextCompletions},null);}
      catch(e){if(e.name!=='StorageConflictError')throw e;stored=await getSaved(nextReturned.id);if(!stored)throw e;nextReview=validateReview(stored.review,expected);nextReturned=stored.returned;if(stored.completions?.length)nextReview=exactReview(nextReview,stored.review);}
    }
    if(imported&&readFailure)throw new Error('Local storage could not be read. The current review is unchanged. Download recovery and retry.');
    if(imported&&!seed&&stored)await retain({id:crypto.randomUUID(),kind:'review-backup',createdAt:new Date().toISOString(),review:stored.review,files:stored.files});
    // A completion import must pass its global immutable-ID checks and CAS
    // before replacing the visible ordinary review, just like returned seeds.
    if(bundle&&!seed)stored=await operations.putSaved({id:snapshotId,review:nextReview,files:nextFiles,returned:nextReturned,revisionId:nextRevisionId,completions:nextCompletions},stored?(stored.storageRevision??0):null);
    if(comparison){views.rendered.doc=comparison.current;await comparison.previous.destroy();comparison=null;}
    for(const v of Object.values(views)){v.serial++;v.task?.cancel();if(v.task)try{await v.task.promise;}catch{}await v.doc?.destroy();}
    invalidateExport();files=nextFiles;review=nextReview;returned=clone(nextReturned);revision++;dirty=restoredInstructions||(seed||bundle?false:Boolean(imported)||!stored);persistedRevision=stored?(stored.storageRevision??0):null;
    revisionId=stored?.returned&&!bundle?stored.revisionId??nextRevisionId:nextRevisionId;completions=mergeCompletions(stored?.completions,nextCompletions);
    saveFailed=false;saveConflict=false;recoveryStamp=null;active=null;focused=null;undo=[];redo=[];
    document.dispatchEvent(new Event('score-desk-change'));
    $('emergency').hidden=true;$('storage').textContent=stored?'Saved locally · reopened exact snapshot':'Saving local snapshot…';
    views.source.doc=docs[0];views.rendered.doc=docs[1];
    for(const v of Object.values(views)){
      v.page=1;v.viewport=null;$(`${v.kind}Page`).value='1';$(`${v.kind}Page`).max=v.doc.numPages;$(`${v.kind}Count`).textContent=`/ ${v.doc.numPages}`;$(`${v.kind}Scroll`).scrollTo(0,0);
    }
    $('identity').replaceChildren();for(const r of roles){const s=document.createElement('span');s.textContent=`${r}: ${review.files[r].name}`;const b=document.createElement('b');b.textContent=`SHA-256 ${review.files[r].sha256}`;s.append(b);$('identity').append(s);}
    $('filesPanel').open=false;setMode('navigate');renderFindings();await Promise.all(Object.values(views).map(renderPage));if(readFailure)storageFailure(readFailure);await saveNow();
    message(returned?'Returned revision ready. Reported findings require explicit human review; no whole-score verification is claimed.':imported?'Package opened. Exact inputs, comments, and marks restored; prior saved review retained.':stored?'Reopened the review for these exact file bytes.':'Snapshot ready. Start a new finding to paint a passage.');
  }catch(e){for(const doc of docs)if(doc!==views.source.doc&&doc!==views.rendered.doc)await doc.destroy();throw e;}
  finally{busy=false;controls();}
}
async function renderPage(v){
  if(!v.doc)return;
  if(gesture)cancelGesture();
  const serial=++v.serial;v.viewport=null;$(`${v.kind}Paper`).setAttribute('aria-busy','true');
  const page=await v.doc.getPage(v.page);if(serial!==v.serial)return;
  const base=page.getViewport({scale:1}),z=$(`${v.kind}Zoom`).value;
  const scale=z==='fit'?Math.max(.15,($(`${v.kind}Scroll`).clientWidth-38)/base.width):Number(z);
  const viewport=page.getViewport({scale});
  v.task?.cancel();if(v.task)try{await v.task.promise;}catch{}
  if(serial!==v.serial)return;
  const canvas=$(`${v.kind}Canvas`),paper=$(`${v.kind}Paper`),dpr=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.ceil(viewport.width*dpr);canvas.height=Math.ceil(viewport.height*dpr);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;paper.style.width=`${viewport.width}px`;paper.style.height=`${viewport.height}px`;paper.hidden=false;
  if(v.kind==='rendered'){$('overlay').width=canvas.width;$('overlay').height=canvas.height;$('overlay').style.width=canvas.style.width;$('overlay').style.height=canvas.style.height;}
  v.task=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[dpr,0,0,dpr,0,0]});
  try{await v.task.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;return;}
  if(serial!==v.serial)return;v.viewport=viewport;v.dpr=dpr;$(`${v.kind}Paper`).setAttribute('aria-busy','false');drawOverlay();
}
function drawOverlay(){const v=views.rendered,c=$('overlay'),ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);if(comparison||!review||!v.viewport||$('hide').checked)return;ctx.setTransform(v.dpr,0,0,v.dpr,0,0);paint(ctx,v.viewport,focused?review.findings.filter(f=>f.id===focused):review.findings,v.page,gesture?.stroke);}
function current(){return review?.findings.find(f=>f.id===active);}
function newFinding(reportedId=null){
  if(!review||busy||comparison)return;
  if(review.findings.length>=2000)throw new Error('Prototype limit: 2,000 findings per review.');
  if(review.nextNumber>99999)throw new Error('Finding number limit reached.');
  checkpoint();const prefs=review.preferences,color=prefs.autoColor?PALETTE[prefs.colorCursor].color:prefs.color;
  if(prefs.autoColor)prefs.colorCursor=(prefs.colorCursor+1)%PALETTE.length;
  const f={id:crypto.randomUUID(),number:review.nextNumber++,page:views.rendered.page,color,comment:'',state:'open',strokes:[],bounds:null};
  const reported=returned?.reported.find(item=>item.id===reportedId);
  if(reported){review.findings=review.findings.filter(mark=>mark.id!==reported.associationId);reported.associationId=f.id;}
  review.findings.push(f);active=f.id;if(focused)focused=f.id;setMode('draw');$('hide').checked=false;changed();$('comment').focus();return f.id;
}
function renderFindings(){
  $('findingCount').textContent=review?.findings.length??0;const f=current();$('editor').hidden=!f;
  if(focused&&!review?.findings.some(f=>f.id===focused))focused=null;
  const focusFinding=review?.findings.find(f=>f.id===focused);
  $('focusStatus').textContent=focusFinding?`Focused on finding ${focusFinding.number} · rendered page ${focusFinding.page} · other marks hidden`:'Showing all findings';$('showAll').hidden=!focused;
  $('highlightColor').value=f?.color??review?.preferences.color??PALETTE[0].color;
  $('colorSwatch').style.backgroundColor=$('highlightColor').value;
  $('autoColor').checked=review?.preferences.autoColor??false;
  if(f){$('editTitle').textContent=`Finding ${f.number} · rendered page ${f.page}`;if(document.activeElement!==$('comment'))$('comment').value=f.comment;$('findingState').value=f.state;}
  const list=$('findings');list.replaceChildren();
  if(!review?.findings.length){const p=document.createElement('p');p.className='hint';p.textContent='Start a finding, paint one or more strokes on a rendered page, and write a comment.';list.append(p);}
  for(const finding of review?.findings??[]){
    const item=document.createElement('div');item.className=`finding ${finding.id===active?'active':''}`;item.dataset.findingId=finding.id;item.style.borderLeftColor=finding.color;
    const open=document.createElement('button');open.className='finding-open';const title=document.createElement('b');title.textContent=`#${finding.number} · rendered page ${finding.page}`;const comment=document.createElement('span');comment.className='finding-comment';comment.textContent=finding.comment||'(Comment not entered)';const meta=document.createElement('small');meta.textContent=`${finding.state.replaceAll('_',' ')} · ${finding.strokes.length} stroke(s)`;open.append(title,comment,meta);
    const choose=guard(async()=>{if(busy||comparison)return;cancelGesture();active=finding.id;if(focused)focused=finding.id;views.rendered.page=finding.page;$('renderedPage').value=finding.page;renderFindings();await renderPage(views.rendered);});
    open.onclick=e=>{e.stopPropagation();choose();};item.onclick=choose;
    const focus=document.createElement('button');focus.className='focus-finding';focus.textContent=focused===finding.id?'Show all':'Focus';focus.setAttribute('aria-label',focused===finding.id?'Show all findings':`Focus finding ${finding.number}`);focus.setAttribute('aria-pressed',String(focused===finding.id));
    focus.onclick=guard(async e=>{e.stopPropagation();if(busy||comparison)return;cancelGesture();const exiting=focused===finding.id;focused=exiting?null:finding.id;active=finding.id;$('hide').checked=false;if(!exiting){views.rendered.page=finding.page;$('renderedPage').value=finding.page;}renderFindings();await renderPage(views.rendered);});
    item.append(open,focus);list.append(item);
  }
  controls();
}
function pdfPoint(event){const v=views.rendered,rect=$('overlay').getBoundingClientRect();const [x,y]=v.viewport.convertToPdfPoint((event.clientX-rect.left)*v.viewport.width/rect.width,(event.clientY-rect.top)*v.viewport.height/rect.height);const [x0,y0,x1,y1]=review.pages[v.page-1].view;return [Math.max(x0,Math.min(x1,x)),Math.max(y0,Math.min(y1,y))];}
$('overlay').addEventListener('pointerdown',e=>{
  if(busy||!review||e.button!==0||comparison)return;
  if(!views.rendered.viewport){message('Wait for this page to finish rendering before drawing.');return;}
  e.preventDefault();
  if(mode==='draw'){
    if($('hide').checked){message('Show marks before drawing.',true);return;}
    const f=current();if(!f){message('Choose New finding before painting.',true);return;}if(f.page!==views.rendered.page){message('This finding belongs to another rendered page. Start a new finding here.',true);return;}
    gesture={pointerId:e.pointerId,findingId:f.id,stroke:{points:[pdfPoint(e)],width:Number($('brush').value),color:f.color,opacity:0.35}};
  }else gesture={pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:$('renderedScroll').scrollLeft,top:$('renderedScroll').scrollTop};
  $('overlay').setPointerCapture(e.pointerId);drawOverlay();
});
$('overlay').addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.pointerId)return;e.preventDefault();if(gesture.stroke){const samples=e.getCoalescedEvents?.();for(const p of samples?.length?samples:[e]){if(gesture.stroke.points.length>=200000)break;gesture.stroke.points.push(pdfPoint(p));}drawOverlay();}else{$('renderedScroll').scrollLeft=gesture.left-e.clientX+gesture.x;$('renderedScroll').scrollTop=gesture.top-e.clientY+gesture.y;}});
$('overlay').addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.pointerId)return;const completed=gesture;gesture=null;if($('overlay').hasPointerCapture(e.pointerId))$('overlay').releasePointerCapture(e.pointerId);if(completed.stroke){const f=review.findings.find(f=>f.id===completed.findingId);const total=review.findings.reduce((n,f)=>n+f.strokes.reduce((m,s)=>m+s.points.length,0),0);if(total+completed.stroke.points.length>200000||f.strokes.length>=5000){message('Prototype point/stroke limit reached. This stroke was not added; export this review before starting another.',true);drawOverlay();return;}checkpoint();f.strokes.push(completed.stroke);f.bounds=bounds(f.strokes);changed();}else drawOverlay();});
$('overlay').addEventListener('pointercancel',e=>{if(gesture?.pointerId===e.pointerId)cancelGesture();});
$('overlay').addEventListener('lostpointercapture',e=>{if(gesture?.pointerId===e.pointerId&&!$('overlay').hasPointerCapture(e.pointerId))cancelGesture();});
$('navigate').onclick=()=>setMode('navigate');$('draw').onclick=()=>setMode('draw');$('newFinding').onclick=guard(newFinding);
$('comment').addEventListener('input',()=>{if(!current())return;if(busy){$('comment').value=current().comment;return;}checkpoint();current().comment=$('comment').value;changed();});
$('findingState').onchange=()=>{if(!current())return;if(busy){$('findingState').value=current().state;return;}checkpoint();current().state=$('findingState').value;changed();};
$('saveFinding').onclick=()=>{if(busy)return;const f=current();if(!f?.strokes.length){message('Paint at least one stroke before finishing this finding.',true);return;}active=null;setMode('navigate');renderFindings();message(`Finding ${f.number} saved. Start another or select a finding to edit.`);saveNow();};
$('deleteFinding').onclick=()=>{if(busy||!current())return;cancelGesture();checkpoint();review.findings=review.findings.filter(f=>f.id!==active);active=null;changed();};
function history(from,to){if(!from.length||busy)return;cancelGesture();to.push(annotationState());const prior=from.pop();review=prior.review;if(returned&&prior.workspaceId===returned.id){const links=new Map(prior.associations);for(const f of returned.reported)f.associationId=links.get(f.id)??null;}if(!current())active=null;changed();}
$('undo').onclick=()=>history(undo,redo);$('redo').onclick=()=>history(redo,undo);
$('hide').onchange=()=>{cancelGesture();drawOverlay();};$('brush').oninput=()=>$('brushValue').textContent=`${$('brush').value} pt`;
$('showAll').onclick=()=>{cancelGesture();focused=null;$('hide').checked=false;renderFindings();drawOverlay();};
$('highlightColor').onchange=()=>{if(!review||busy)return;cancelGesture();checkpoint();const color=$('highlightColor').value;review.preferences.color=color;if(review.preferences.autoColor)review.preferences.colorCursor=(PALETTE.findIndex(p=>p.color===color)+1)%PALETTE.length;const f=current();if(f){f.color=color;for(const s of f.strokes)s.color=color;}changed();};
$('autoColor').onchange=()=>{if(!review||busy)return;checkpoint();const prefs=review.preferences;prefs.autoColor=$('autoColor').checked;const index=PALETTE.findIndex(p=>p.color===$('highlightColor').value);prefs.colorCursor=(index+(review.findings.length?1:0))%PALETTE.length;changed();};
document.addEventListener('keydown',e=>{if(busy){if(e.key==='Escape'&&exportJob){e.preventDefault();message('Export is still running. Editing will be available when it finishes.');}return;}if(e.key==='Escape'){cancelGesture();setMode('navigate');}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();history(e.shiftKey?redo:undo,e.shiftKey?undo:redo);}});
for(const kind of ['source','rendered']){
  const v=views[kind];const go=guard(async n=>{if(!v.doc)return;v.page=Math.max(1,Math.min(v.doc.numPages,Math.round(Number(n)||1)));$(`${kind}Page`).value=v.page;$(`${kind}Scroll`).scrollTo(0,0);await renderPage(v);});
  $(`${kind}Page`).onchange=e=>go(e.target.value);$(`${kind}Zoom`).onchange=guard(()=>renderPage(v));
  document.querySelectorAll(`[data-kind="${kind}"]`).forEach(b=>b.onclick=()=>go(v.page+(b.dataset.action==='next'?1:-1)));
}
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{for(const v of Object.values(views))if($(`${v.kind}Zoom`).value==='fit')guard(()=>renderPage(v))();},150);}).observe(document.querySelector('main'));
$('load').onclick=guard(async()=>{const selected={};for(const role of roles){const file=$(`${role}File`).files[0];if(!file)throw new Error('Select an original PDF, rendered PDF, and .ly file first.');if(file.size>100*1024*1024)throw new Error('Prototype limit: 100 MB per input file.');if(role==='ly'&&!file.name.toLowerCase().endsWith('.ly'))throw new Error('The code file must end in .ly.');selected[role]={name:file.name,blob:file};}await openSnapshot(selected);});
$('import').onchange=guard(async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy)return;if(!review)throw new Error('Open the exact three input files before importing annotation JSON.');if(file.size>25*1024*1024)throw new Error('Review JSON exceeds 25 MB.');const captured=stamp(),value=JSON.parse(await file.text());if(busy||!matchesStamp(captured))throw new Error('The review changed while importing. Select the JSON again.');const imported=validateReview(value,review);cancelGesture();checkpoint();review=imported;active=null;changed();message('Imported matching review. All comments and strokes restored.');});
// Persistence and package wiring are kept separate from the drawing surface.
let saveFailed=false,saveTimer,saveQueue=Promise.resolve(),urls=[];
function storageFailure(e){saveFailed=true;saveConflict||=e.name==='StorageConflictError';$('storage').textContent=`NOT SAVED · ${e.message||e.name||'Storage unavailable'}`;$('emergency').hidden=false;message(saveConflict?e.message:'Local saving failed (storage blocked, full, or unavailable). Keep this tab open and download a recovery ZIP immediately.',true);}
function scheduleSave(){clearTimeout(saveTimer);$('storage').textContent=saveConflict?'NOT SAVED · Conflict with a newer saved version; download recovery ZIP.':'Saving local snapshot…';saveTimer=setTimeout(()=>saveNow(),350);}
async function saveNow(){
  clearTimeout(saveTimer);
  const save=async()=>{
    // Capture when this queued write starts, not when it was enqueued. A second
    // queued save must use the first write's persisted revision, or do no work.
    if(!review||!dirty||saveConflict)return !dirty;
    const record={id:recordKey(),review:clone(review),files,revisionId,completions:clone(completions),...(returned?{returned:clone(returned)}:{})},captured=stamp();
    try{
    const saved=await operations.putSaved(record,persistedRevision);
      if(recordKey()===record.id){persistedRevision=saved.storageRevision;if(matchesStamp(captured)){dirty=false;saveFailed=false;$('emergency').hidden=true;$('storage').textContent=`Saved locally · ${new Date().toLocaleTimeString()}`;}}
    }catch(e){storageFailure(e);return false;}
    try{await refreshSaved();}catch(e){message(`Snapshot saved, but the saved-review list could not refresh: ${e.message}`,true);}
    return !dirty;
  };
  saveQueue=saveQueue.then(save,save);return saveQueue;
}
async function refreshSaved(){const selected=$('saved').value;const entries=await listSaved();$('saved').replaceChildren(new Option('Choose a locally saved review…',''));for(const r of entries)$('saved').add(new Option(`${r.name} · ${r.count} findings · ${r.id.slice(0,8)}`,r.id));$('saved').value=selected;return entries;}
$('reopen').onclick=guard(async()=>{if(!$('saved').value)throw new Error('Choose a saved snapshot first.');await openSnapshot(null,$('saved').value);});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function invalidateExport(){if(exportJob)exportJob.cancelled=true;for(const url of urls)URL.revokeObjectURL(url);urls=[];$('downloads').replaceChildren();$('progress').textContent='';}
function link(blob,path,className='download'){const url=URL.createObjectURL(blob);urls.push(url);const a=document.createElement('a');a.href=url;a.download=path.replaceAll('/','__');a.textContent=path;a.className=className;$('downloads').append(a);}
$('draft').onclick=()=>download(new Blob([JSON.stringify(review,null,2)+'\n'],{type:'application/json'}),'annotations.json');
$('emergency').onclick=guard(async()=>{
  if(!review)throw new Error('Load input files first.');if(busy||recoveryJob)return;
  const job={...stamp()},snapshot=clone(review),snapshotFiles=files,round=clone(returned);recoveryJob=job;$('emergency').disabled=true;
  try{
    const savedCompletions=clone(completions),savedRevisionId=revisionId;
    message('Preparing immediate recovery ZIP…');let payloads=round?await makeReturnedBackup(snapshot,snapshotFiles,round):await operations.makeRecovery(snapshot,snapshotFiles);payloads=await addCompletionHistory(payloads,snapshot,round,savedRevisionId,savedCompletions);const zip=await operations.zipFiles(payloads);
    await operations.download(zip,'score-desk-recovery.zip');
    if(matchesStamp(job)){recoveryStamp=job;message('Recovery ZIP download requested for the current revision. Confirm it finished before closing this tab.');}
    else message('Recovery ZIP contains an earlier revision. Newer edits are still unprotected; save them or download another recovery ZIP.',true);
  }finally{if(recoveryJob===job)recoveryJob=null;$('emergency').disabled=false;}
});
$('export').onclick=()=>{if(!review||busy)return;cancelGesture();$('exports').showModal();};
$('closeExports').onclick=()=>{if(!exportJob)$('exports').close();};
$('exports').addEventListener('cancel',e=>{if(exportJob){e.preventDefault();message('Export is still running. Editing will be available when it finishes.');}});
$('exports').addEventListener('close',()=>{if(exportJob)exportJob.cancelled=true;});
$('context').onchange=()=>{if(exportJob){$('context').value=exportJob.context;return;}invalidateExport();};
const currentExport=job=>exportJob===job&&!job.cancelled&&matchesStamp(job)&&$('context').value===job.context;
$('generate').onclick=guard(async()=>{
  if(busy||!review)return;invalidateExport();const job={...stamp(),context:$('context').value,cancelled:false};exportJob=job;
  busy=true;controls();$('generate').disabled=true;$('closeExports').disabled=true;$('context').disabled=true;
  try{
    const progress=t=>{if(currentExport(job))$('progress').textContent=t;};
    const snapshot=clone(review),round=clone(returned);let payloads=await operations.makePackage(snapshot,files,comparison?.current??views.rendered.doc,job.context,progress);
    if(round)payloads=await makeReturnedBackup(snapshot,files,round,payloads);
    payloads=await addCompletionHistory(payloads,snapshot,round,revisionId,clone(completions));
    if(!currentExport(job))throw new Error('Review, settings, or export dialog changed. Regenerate the package.');
    const zip=await operations.zipFiles(payloads,progress);
    if(!currentExport(job))throw new Error('Review, settings, or export dialog changed. Regenerate the package.');
    // Publish ZIP and individual links together, only after the entire job is current.
    for(const [path,blob]of payloads)link(blob,path);link(zip,'score-desk-review.zip','zip');
    $('progress').textContent=`Ready · ${payloads.size} individual files and ZIP. Original input hashes are recorded in manifest.json.`;
  }catch(e){invalidateExport();$('progress').textContent=`Export failed or discarded: ${e.message} Download review JSON or retry export.`;message($('progress').textContent,true);}
  finally{if(exportJob===job)exportJob=null;busy=false;controls();$('generate').disabled=false;$('closeExports').disabled=false;$('context').disabled=false;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});
window.addEventListener('beforeunload',e=>{if(unprotectedWork()){saveNow();e.preventDefault();e.returnValue='';}});
// Mutable I/O boundary for deterministic local QA fault injection. The QA bridge
// is loaded only by the separate test pages, never by the application UI.
export const operations={makeRecovery,makePackage,zipFiles,download,putSaved};
export {saveNow};
export const sessionStatus=()=>({...stamp(),dirty,busy,persistedRevision,saveConflict,unprotected:unprotectedWork(),recoveryStamp:recoveryStamp&&{...recoveryStamp},undoLength:undo.length,exporting:Boolean(exportJob)});
const appApi={
  capture:()=>({review:clone(review),files,returned:clone(returned),active,doc:comparison?.current??views.rendered.doc,comparison:Boolean(comparison),stamp:stamp(),revisionId,workspaceId:recordKey(),persistedRevision,completions:clone(completions)}),matches:matchesStamp,status:sessionStatus,message,
  openImported:parsed=>openSnapshot(parsed.files,null,parsed.review,null,false,parsed.completionBundle),
  openReturned:seed=>openSnapshot(seed.files,null,seed.review,seed),
  reloadReturned:()=>openSnapshot(null,recordKey(),null,null,true),
  updateReturned:mutate=>{if(busy||!returned)return;mutate(returned);changed();},
  newRegion:reportedId=>newFinding(reportedId),
  selectMark:async id=>{if(busy||comparison)return;active=id;const f=current();if(f){views.rendered.page=f.page;$('renderedPage').value=f.page;renderFindings();await renderPage(views.rendered);}},
  commitDecision:async mutate=>{
    await saveNow();if(unprotectedWork())throw new Error('Save the current annotations or download their latest recovery ZIP before recording a decision.');
    const next=clone(returned);mutate(next);const nextReview=clone(review);nextReview.updatedAt=new Date().toISOString();
    const nextRevisionId=crypto.randomUUID();let saved;try{saved=await operations.putSaved({id:recordKey(),review:nextReview,files,returned:next,revisionId:nextRevisionId,completions},persistedRevision);}catch(e){if(e.name==='StorageConflictError')throw new Error('Another tab saved newer review decisions. This decision was not saved. Reload the saved review before continuing.');throw e;}
    returned=saved.returned;review=nextReview;revisionId=nextRevisionId;completions=saved.completions;persistedRevision=saved.storageRevision;revision++;invalidateExport();document.dispatchEvent(new Event('score-desk-change'));try{await refreshSaved();}catch(e){message('Decision saved, but the saved-review list could not refresh: '+e.message,true);}
  },
  compare:async blob=>{
    if(!review||busy)return;busy=true;controls();cancelGesture();try{
      if(blob&&!comparison){const previous=await openPdf(blob);comparison={current:views.rendered.doc,previous,currentPage:views.rendered.page};views.rendered.doc=previous;views.rendered.page=1;}
      else if(!blob&&comparison){views.rendered.doc=comparison.current;views.rendered.page=comparison.currentPage;await comparison.previous.destroy();comparison=null;}
      $('renderedPage').max=views.rendered.doc.numPages;$('renderedPage').value=views.rendered.page;$('renderedCount').textContent=`/ ${views.rendered.doc.numPages}`;await renderPage(views.rendered);
    }finally{busy=false;controls();}
  },
  inspectPdf:async nextFiles=>{const docs=[];try{for(const role of ['source','rendered'])docs.push(await openPdf(nextFiles[role].blob));const pages=[];for(let i=1;i<=docs[1].numPages;i++){const p=await docs[1].getPage(i);pages.push({page:i,view:[...p.view],rotation:p.rotate,userUnit:p.userUnit});}return pages;}finally{for(const doc of docs)await doc.destroy();}},
  lock:async action=>{if(busy)throw new Error('Wait for the current operation to finish.');busy=true;cancelGesture();controls();try{return await action();}finally{busy=false;controls();}},
  flush:async()=>{await saveNow();if(unprotectedWork())throw new Error('The latest review could not be saved. Protect your edits with a recovery ZIP before finishing.');},
  commitCompletion:async(record,captured)=>{
    if(!matchesStamp(captured)||record.revision.id!==revisionId)throw new Error('The review changed. Finish the current revision again.');
    const saved=await operations.putSaved({id:recordKey(),review:clone(review),files,returned:clone(returned),revisionId,completions:mergeCompletions(completions,[record])},persistedRevision,record);
    completions=saved.completions;persistedRevision=saved.storageRevision;dirty=false;saveFailed=false;saveConflict=false;recoveryStamp=null;$('emergency').hidden=true;$('storage').textContent='Saved locally · completion recorded.';invalidateExport();document.dispatchEvent(new Event('score-desk-completions'));
  },
  packageMaker:(...args)=>operations.makePackage(...args),zip:(...args)=>operations.zipFiles(...args),download:(...args)=>operations.download(...args)
};
export const handoff=installHandoff(appApi);
export const completion=installCompletion(appApi);
controls();
// Reopening retained bytes never attaches an old review to newly selected files.
(async()=>{try{const entries=await refreshSaved();if(entries.length){await openSnapshot(null,entries[0].id);message('Restored your latest saved snapshot with its exact original file bytes.');}}catch(e){storageFailure(e);}finally{document.body.dataset.ready='true';}})();

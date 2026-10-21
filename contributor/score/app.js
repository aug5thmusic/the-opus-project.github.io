import * as pdfjs from './vendor/pdf.mjs';
import {clone,identify,newReview,bounds,paint,hitFinding,validateReview,roles,PALETTE} from './model.js';
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
let prepared=false,pendingReportedId=null,composing=false;
const dialogOpen=()=>Boolean(document.querySelector('dialog[open]'));
const canEdit=()=>Boolean(review&&!busy&&!comparison&&!dialogOpen());
let revisionId=crypto.randomUUID(),completions=[];
const recordKey=()=>returned?.id??review?.snapshotId;
const stamp=()=>({snapshotId:review?.snapshotId,workspaceId:returned?.id??null,revision});
const matchesStamp=value=>value?.snapshotId===review?.snapshotId&&(value?.workspaceId??null)===(returned?.id??null)&&value?.revision===revision;
const unprotectedWork=()=>Boolean(review&&(dirty||saveFailed)&&!matchesStamp(recoveryStamp));
for(const entry of PALETTE)$('highlightColor').add(new Option(entry.name,entry.color));
const views=Object.fromEntries(['source','rendered'].map(kind=>[kind,{kind,doc:null,page:1,viewport:null,serial:0,task:null}]));
let messageTimer,storageProblem='';
function noticeLayout(){
  const same=!$('message').hidden&&$('message').textContent===storageProblem;
  $('storageProblem').textContent=storageProblem;$('storageProblem').hidden=!storageProblem||same;
  $('notices').hidden=$('message').hidden&&!storageProblem&&$('emergency').hidden;
  $('notices').classList.toggle('error',Boolean(storageProblem)||$('message').dataset.error==='true');
  $('dismissMessage').hidden=$('message').hidden||same||busy;
}
function dismissMessage(){clearTimeout(messageTimer);$('message').hidden=true;$('message').dataset.error='false';noticeLayout();}
function message(text,error=false){
  // Routine confirmations expire; an unrelated action must not erase an error.
  if(!error&&!busy&&!$('message').hidden&&$('message').dataset.error==='true')return;
  clearTimeout(messageTimer);$('message').textContent=text;$('message').hidden=!text;$('message').dataset.error=String(error);noticeLayout();
  if(text&&!error){const expire=()=>{if(busy){messageTimer=setTimeout(expire,1000);return;}dismissMessage();};messageTimer=setTimeout(expire,3500);}
}
function storageStatus(text,problem=''){
  const previous=storageProblem;storageProblem=problem;$('storage').textContent=text;$('storage').hidden=!text;$('storage').classList.toggle('unsaved',Boolean(problem));
  if(previous&&!problem&&$('message').textContent===previous)dismissMessage();else noticeLayout();
}
$('dismissMessage').onclick=dismissMessage;
const shortcutModifier=/Mac|iPhone|iPad/.test(navigator.userAgentData?.platform??navigator.platform)?'Cmd':'Ctrl';
for(const label of document.querySelectorAll('[data-shortcut-modifier]'))label.textContent=shortcutModifier;
$('doneNext').title=`Finish this group and prepare the next (${shortcutModifier}+Enter)`;
function guard(fn){return async (...args)=>{try{await fn(...args);}catch(e){console.error(e);message(e.message,true);}};}
// Annotation history includes its links, but never rolls back human decisions.
function annotationState(){return {review:clone(review),active,prepared,pendingReportedId,workspaceId:returned?.id,associations:returned?.reported.map(f=>[f.id,f.associationId])};}
function checkpoint(){undo.push(annotationState());if(undo.length>80)undo.shift();redo=[];}
function changed(){revision++;revisionId=crypto.randomUUID();dirty=true;review.updatedAt=new Date().toISOString();invalidateExport();document.dispatchEvent(new Event('score-desk-change'));renderFindings();drawOverlay();scheduleSave();}
function controls(){
  for(const id of ['newFinding','navigate','draw','undo','redo','brush','hide','draft','export','highlightColor','autoColor','showAll','comment','findingState','saveFinding','doneNext','deleteFinding'])$(id).disabled=!canEdit();
  // Package/export controls inside the workspace dialog remain usable there.
  for(const id of ['draft','export'])$(id).disabled=!review||busy;
  for(const region of [document.querySelector('main'),document.querySelector('.toolbar'),$('filesPanel')])region.inert=busy;
  $('commentsPanel').inert=busy||(matchMedia('(max-width:1000px)').matches&&!document.body.classList.contains('comments-open'));
  $('load').disabled=busy;$('reopen').disabled=busy;$('undo').disabled=!undo.length||!canEdit();$('redo').disabled=!redo.length||!canEdit();
  for(const el of document.querySelectorAll('[data-handoff-action]'))el.disabled=busy||(el.dataset.needsReview!==undefined&&!review);
  $('findingState').disabled=!current()||!canEdit();$('deleteFinding').disabled=!current()||!canEdit();
  $('hide').disabled=!review||busy||Boolean(comparison);
  $('comparisonControl').hidden=!returned;
  $('editTitle').textContent=comparison?'Previous rendering · read only':current()?`Editing finding #${current().number} · page ${current().page}`:'New finding';
  noticeLayout();
  for(const button of document.querySelectorAll('.finding-open,.focus-finding')){button.disabled=!canEdit();button.title=comparison?'Switch to the current rendering to select current marks.':'';}
  document.dispatchEvent(new Event('score-desk-controls'));
}
function setMode(next){cancelGesture();mode=next;document.body.classList.toggle('drawing',mode==='draw');$('draw').setAttribute('aria-pressed',String(mode==='draw'));$('navigate').setAttribute('aria-pressed',String(mode==='navigate'));}
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
    saveFailed=false;saveConflict=false;recoveryStamp=null;active=null;focused=null;prepared=false;pendingReportedId=null;undo=[];redo=[];
    document.dispatchEvent(new Event('score-desk-change'));
    $('emergency').hidden=true;storageStatus(stored?'Saved locally':'Saving…');
    views.source.doc=docs[0];views.rendered.doc=docs[1];
    for(const v of Object.values(views)){
      v.page=1;v.viewport=null;$(`${v.kind}Page`).value='1';$(`${v.kind}Page`).max=v.doc.numPages;$(`${v.kind}Count`).textContent=`/ ${v.doc.numPages}`;$(`${v.kind}Scroll`).scrollTo(0,0);
    }
    $('identity').replaceChildren();for(const r of roles){const s=document.createElement('span');s.textContent=`${r}: ${review.files[r].name}`;const b=document.createElement('b');b.textContent=`SHA-256 ${review.files[r].sha256}`;s.append(b);$('identity').append(s);}
    $('filesPanel').open=false;$('workspaceDialog').close();document.body.classList.add('review-open');setMode('navigate');renderFindings();await Promise.all(Object.values(views).map(renderPage));if(readFailure)storageFailure(readFailure);await saveNow();
    message(returned?'Returned revision ready. Reported findings require explicit human review; no whole-score verification is claimed.':imported?'Package opened. Exact inputs, comments, and marks restored; prior saved review retained.':stored?'Reopened the review for these exact file bytes.':'Snapshot ready. Draw a finding.');
  }catch(e){for(const doc of docs)if(doc!==views.source.doc&&doc!==views.rendered.doc)await doc.destroy();throw e;}
  finally{busy=false;controls();}
}
async function renderPage(v){
  if(!v.doc||!$(`${v.kind}Scroll`).clientWidth)return;
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
function nextColor(){const p=review.preferences;return p.autoColor?PALETTE[p.colorCursor].color:p.color;}
function findingCapacity(){
  if(review.findings.length>=2000)throw new Error('Limit: 2,000 findings per review.');
  if(review.nextNumber>99999)throw new Error('Finding number limit reached.');
}
// Preparation is view state only. Commit a number/color/association with real content.
function createFinding(){
  findingCapacity();const color=nextColor();
  const f={id:crypto.randomUUID(),number:review.nextNumber++,page:views.rendered.page,color,comment:'',state:'open',strokes:[],bounds:null};
  if(review.preferences.autoColor)review.preferences.colorCursor=(review.preferences.colorCursor+1)%PALETTE.length;
  const reported=returned?.reported.find(item=>item.id===pendingReportedId);
  if(reported){review.findings=review.findings.filter(mark=>mark.id!==reported.associationId);reported.associationId=f.id;}
  review.findings.push(f);active=f.id;focused=null;prepared=false;pendingReportedId=null;return f;
}
function setComments(open){
  document.body.classList.toggle('comments-open',open);$('toggleComments').setAttribute('aria-expanded',String(open));
  $('commentsPanel').inert=busy||(matchMedia('(max-width:1000px)').matches&&!open);
}
function showScore(kind){
  document.body.dataset.score=kind;
  for(const name of ['source','rendered','both'])$('show'+name[0].toUpperCase()+name.slice(1)).setAttribute('aria-pressed',String(name===kind));
}
function revealRendered(){if(document.body.dataset.score==='source')showScore('rendered');}
function newFinding(reportedId=null){
  if(!canEdit())return;
  findingCapacity();cancelGesture();active=null;focused=null;prepared=true;pendingReportedId=typeof reportedId==='string'?reportedId:null;
  revealRendered();setComments(false);setMode('draw');$('hide').checked=false;renderFindings();drawOverlay();$('overlay').focus({preventScroll:true});
  message('Draw a passage, then comment.');
}
async function finishFinding(next=false){
  if(!canEdit())return;
  const f=current();
  if(!f?.strokes.length){message('Paint at least one stroke before finishing this finding. Your comment is kept.',true);return;}
  busy=true;cancelGesture();controls();
  try{
    if(!await saveNow()||saveFailed||saveConflict){if(!storageProblem)message('Finding is still being edited. Retry Done or download a recovery ZIP.',true);return;}
    active=null;focused=null;prepared=next;pendingReportedId=null;setMode(next?'draw':'navigate');
    renderFindings();drawOverlay();setComments(false);
    message(`Finding #${f.number} done.${next?' Draw the next finding.':''}`);
  }finally{busy=false;controls();if(!active)$('overlay').focus({preventScroll:true});}
}
async function selectFinding(id){
  if(!canEdit())return;
  const f=review.findings.find(f=>f.id===id);if(!f)return;
  cancelGesture();active=id;prepared=false;pendingReportedId=null;revealRendered();setComments(false);
  const pageChanged=views.rendered.page!==f.page;views.rendered.page=f.page;$('renderedPage').value=f.page;renderFindings();drawOverlay();
  if(pageChanged){$('renderedScroll').scrollTo(0,0);await renderPage(views.rendered);}
}
function clearFocus(){if(!canEdit())return;cancelGesture();focused=null;$('hide').checked=false;renderFindings();drawOverlay();}
function renderFindings(){
  $('findingCount').textContent=review?.findings.length??0;const f=current();$('editor').hidden=!f&&!prepared;
  $('commentDock').hidden=$('editor').hidden;
  if(focused&&!review?.findings.some(f=>f.id===focused))focused=null;
  const focusFinding=review?.findings.find(f=>f.id===focused);
  $('focusStatus').textContent=focusFinding?`Only showing finding #${focusFinding.number}`:'';$('showAll').hidden=!focused;$('focusBar').hidden=!focused;
  $('toggleComments').textContent='Findings';
  $('highlightColor').value=f?.color??(review?nextColor():PALETTE[0].color);
  $('colorSwatch').style.backgroundColor=$('highlightColor').value;
  $('autoColor').checked=review?.preferences.autoColor??false;
  $('editTitle').textContent=f?`Editing finding #${f.number} · page ${f.page}`:'New finding';
  if(document.activeElement!==$('comment')||$('comment').dataset.findingId!==(f?.id??''))$('comment').value=f?.comment??'';
  $('comment').dataset.findingId=f?.id??'';$('findingState').value=f?.state??'open';
  const list=$('findings');list.replaceChildren();
  if(!review?.findings.length){const p=document.createElement('p');p.className='hint';p.textContent='Draw a passage to start a finding. Add more strokes to the same comment, then choose Done & next.';list.append(p);}
  for(const finding of review?.findings??[]){
    const item=document.createElement('div');item.className=`finding ${finding.id===active?'active':''}`;item.dataset.findingId=finding.id;item.style.borderLeftColor=finding.color;
    const open=document.createElement('button');open.className='finding-open';const title=document.createElement('b');title.textContent=`#${finding.number} · rendered page ${finding.page}`;const comment=document.createElement('span');comment.className='finding-comment';comment.textContent=finding.comment||'(Comment not entered)';const meta=document.createElement('small');meta.textContent=`${finding.state.replaceAll('_',' ')} · ${finding.strokes.length} stroke(s)`;open.append(title,comment,meta);
    const choose=guard(()=>selectFinding(finding.id));open.onclick=e=>{e.stopPropagation();choose();};item.onclick=choose;
    const focus=document.createElement('button');focus.className='focus-finding';focus.textContent=focused===finding.id?'Show all':'Only show';focus.setAttribute('aria-label',focused===finding.id?'Show all findings':`Only show finding ${finding.number}`);focus.setAttribute('aria-pressed',String(focused===finding.id));
    focus.onclick=guard(async e=>{e.stopPropagation();if(!canEdit())return;cancelGesture();const exiting=focused===finding.id;focused=exiting?null:finding.id;$('hide').checked=false;revealRendered();const pageChanged=!exiting&&views.rendered.page!==finding.page;if(pageChanged){views.rendered.page=finding.page;$('renderedPage').value=finding.page;}renderFindings();drawOverlay();if(pageChanged)await renderPage(views.rendered);});
    item.append(open,focus);list.append(item);
  }
  controls();
}
function viewportPoint(event){const v=views.rendered,rect=$('overlay').getBoundingClientRect();return [(event.clientX-rect.left)*v.viewport.width/rect.width,(event.clientY-rect.top)*v.viewport.height/rect.height];}
function pdfPoint(event){const v=views.rendered;const [x,y]=v.viewport.convertToPdfPoint(...viewportPoint(event));const [x0,y0,x1,y1]=review.pages[v.page-1].view;return [Math.max(x0,Math.min(x1,x)),Math.max(y0,Math.min(y1,y))];}
$('overlay').addEventListener('pointerdown',e=>{
  if(busy||!review||dialogOpen()||e.button!==0||gesture||!e.isPrimary&&e.pointerType==='touch')return;
  if(!views.rendered.viewport){message('Wait for this page to finish rendering before drawing.');return;}
  e.preventDefault();
  if(mode==='draw'){
    if(!canEdit())return;
    if($('hide').checked){message('Show marks before drawing.',true);return;}
    const f=current();if(f&&f.page!==views.rendered.page){message('This finding belongs to another rendered page. Start a new finding here.',true);return;}
    gesture={pointerId:e.pointerId,findingId:f?.id,stroke:{points:[pdfPoint(e)],width:Number($('brush').value),color:f?.color??nextColor(),opacity:0.35}};
  }else gesture={pointerId:e.pointerId,x:e.clientX,y:e.clientY,dragged:false,left:$('renderedScroll').scrollLeft,top:$('renderedScroll').scrollTop};
  try{$('overlay').setPointerCapture(e.pointerId);}catch{}drawOverlay();
});
$('overlay').addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;e.preventDefault();
  if(gesture.stroke){const samples=e.getCoalescedEvents?.();for(const p of samples?.length?samples:[e]){if(gesture.stroke.points.length>=200000)break;gesture.stroke.points.push(pdfPoint(p));}drawOverlay();}
  else{gesture.dragged ||= Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5;if(gesture.dragged){$('renderedScroll').scrollLeft=gesture.left-e.clientX+gesture.x;$('renderedScroll').scrollTop=gesture.top-e.clientY+gesture.y;}}
});
$('overlay').addEventListener('pointerup',guard(async e=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;const completed=gesture;gesture=null;if($('overlay').hasPointerCapture(e.pointerId))$('overlay').releasePointerCapture(e.pointerId);
  if(completed.stroke){
    if(!canEdit()){drawOverlay();return;}
    let f=review.findings.find(f=>f.id===completed.findingId);
    const total=review.findings.reduce((n,f)=>n+f.strokes.reduce((m,s)=>m+s.points.length,0),0);
    if(total+completed.stroke.points.length>200000||(f?.strokes.length??0)>=5000){message('Point/stroke limit reached. This stroke was not added; export this review before starting another.',true);drawOverlay();return;}
    const creating=!f,focusComment=creating&&!pendingReportedId;if(creating)findingCapacity();checkpoint();if(creating)f=createFinding();f.strokes.push(completed.stroke);f.bounds=bounds(f.strokes);changed();
    // Focus once, after committing real content. Pointerdown prevents subsequent
    // strokes from blurring the editor; neither focus nor the dock scrolls PDFs.
    if(focusComment&&canEdit()&&current()?.id===f.id)$('comment').focus({preventScroll:true});
  }else{
    if(!completed.dragged&&Math.hypot(e.clientX-completed.x,e.clientY-completed.y)<=5&&canEdit()&&!$('hide').checked){
      const f=hitFinding(views.rendered.viewport,focused?review.findings.filter(f=>f.id===focused):review.findings,views.rendered.page,...viewportPoint(e));
      if(f)await selectFinding(f.id);
    }
    drawOverlay();
  }
}));
$('overlay').addEventListener('pointercancel',e=>{if(gesture?.pointerId===e.pointerId)cancelGesture();});
$('overlay').addEventListener('lostpointercapture',e=>{if(gesture?.pointerId===e.pointerId&&!$('overlay').hasPointerCapture(e.pointerId))cancelGesture();});
const commands={
  new:()=>newFinding(),draw:()=>{if(canEdit()){revealRendered();setMode('draw');}},navigate:()=>{if(canEdit())setMode('navigate');},
  done:()=>finishFinding(),next:()=>finishFinding(true),undo:()=>history(undo,redo),redo:()=>history(redo,undo),showAll:clearFocus
};
for(const [id,name]of Object.entries({navigate:'navigate',draw:'draw',newFinding:'new',saveFinding:'done',doneNext:'next',undo:'undo',redo:'redo',showAll:'showAll'}))$(id).onclick=guard(commands[name]);
$('comment').addEventListener('input',guard(()=>{
  if(!canEdit()){$('comment').value=current()?.comment??'';return;}
  if(!current()&&!prepared)return;const value=$('comment').value;if(!current()&&!value)return;
  if(!current())findingCapacity();checkpoint();const f=current()??createFinding();f.comment=value;changed();
}));
$('findingState').onchange=()=>{if(!current())return;if(!canEdit()){$('findingState').value=current().state;return;}checkpoint();current().state=$('findingState').value;changed();};
$('deleteFinding').onclick=()=>{if(!canEdit()||!current())return;cancelGesture();checkpoint();review.findings=review.findings.filter(f=>f.id!==active);active=null;prepared=false;changed();};
function history(from,to){if(!from.length||!canEdit())return;cancelGesture();to.push(annotationState());const prior=from.pop();review=prior.review;active=prior.active;prepared=prior.prepared;pendingReportedId=prior.pendingReportedId;if(returned&&prior.workspaceId===returned.id){const links=new Map(prior.associations);for(const f of returned.reported)f.associationId=links.get(f.id)??null;}if(!current())active=null;changed();}
$('hide').onchange=()=>{if(!review||busy||comparison)return;cancelGesture();drawOverlay();};$('brush').oninput=()=>$('brushValue').textContent=`${$('brush').value} pt`;
$('highlightColor').onchange=()=>{if(!canEdit())return;cancelGesture();checkpoint();const color=$('highlightColor').value;review.preferences.color=color;if(review.preferences.autoColor)review.preferences.colorCursor=(PALETTE.findIndex(p=>p.color===color)+1)%PALETTE.length;const f=current();if(f){f.color=color;for(const s of f.strokes)s.color=color;}changed();};
$('autoColor').onchange=()=>{if(!canEdit())return;checkpoint();const prefs=review.preferences;prefs.autoColor=$('autoColor').checked;const index=PALETTE.findIndex(p=>p.color===$('highlightColor').value);prefs.colorCursor=(index+(review.findings.length?1:0))%PALETTE.length;changed();};
document.addEventListener('compositionstart',()=>composing=true);document.addEventListener('compositionend',()=>composing=false);
document.addEventListener('keydown',guard(async e=>{
  if(e.defaultPrevented||e.isComposing||composing||e.keyCode===229)return;
  // Retain the export's key-level protection as well as its cancel handler.
  // Completion dialogs still receive Escape to request their own cancellation.
  if(e.key==='Escape'&&busy&&exportJob){e.preventDefault();message('Export is still running. Editing will be available when it finishes.');return;}
  if(dialogOpen()||busy)return;
  const typing=e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  if(e.key==='Escape'){
    if(gesture){e.preventDefault();cancelGesture();return;}
    if(!canEdit())return;e.preventDefault();active=null;focused=null;prepared=false;pendingReportedId=null;setMode('navigate');renderFindings();drawOverlay();
    message('Navigate. Marks and comments kept.');return;
  }
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key==='Enter'&&e.target===$('comment')){e.preventDefault();await commands.next();return;}
  if(typing)return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();commands[e.shiftKey?'redo':'undo']();return;}
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.repeat)return;
  const name={n:'new',d:'draw',v:'navigate'}[e.key.toLowerCase()];if(name&&canEdit()){e.preventDefault();commands[name]();}
}));
$('toggleComments').onclick=()=>{if(!busy)setComments(!document.body.classList.contains('comments-open'));};
$('closeComments').onclick=()=>{setComments(false);$('toggleComments').focus({preventScroll:true});};
$('showSource').onclick=()=>showScore('source');$('showRendered').onclick=()=>showScore('rendered');$('showBoth').onclick=()=>showScore('both');
$('workspaceTools').onclick=()=>{if(busy)return;cancelGesture();$('workspaceDialog').showModal();controls();};
$('closeWorkspace').onclick=()=>$('workspaceDialog').close();
$('shortcutHelp').onclick=()=>{if(!busy){cancelGesture();$('shortcutsDialog').showModal();}};
$('closeShortcuts').onclick=()=>$('shortcutsDialog').close();
for(const dialog of document.querySelectorAll('dialog'))new MutationObserver(()=>{if(dialog.open)cancelGesture();controls();}).observe(dialog,{attributes:true,attributeFilter:['open']});
for(const kind of ['source','rendered']){
  const v=views[kind];const go=guard(async n=>{if(!v.doc)return;v.page=Math.max(1,Math.min(v.doc.numPages,Math.round(Number(n)||1)));$(`${kind}Page`).value=v.page;$(`${kind}Scroll`).scrollTo(0,0);await renderPage(v);});
  $(`${kind}Page`).onchange=e=>go(e.target.value);$(`${kind}Zoom`).onchange=guard(()=>renderPage(v));
  document.querySelectorAll(`[data-kind="${kind}"]`).forEach(b=>b.onclick=()=>go(v.page+(b.dataset.action==='next'?1:-1)));
}
let resizeTimer;const resizeObserver=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{setComments(document.body.classList.contains('comments-open'));for(const v of Object.values(views)){const width=$(`${v.kind}Scroll`).clientWidth;if(width&&width!==v.observedWidth){v.observedWidth=width;if($(`${v.kind}Zoom`).value==='fit'||!v.viewport)guard(()=>renderPage(v))();}}},150);});for(const kind of ['source','rendered'])resizeObserver.observe($(`${kind}Scroll`));
$('load').onclick=guard(async()=>{const selected={};for(const role of roles){const file=$(`${role}File`).files[0];if(!file)throw new Error('Select an original PDF, rendered PDF, and .ly file first.');if(file.size>100*1024*1024)throw new Error('Prototype limit: 100 MB per input file.');if(role==='ly'&&!file.name.toLowerCase().endsWith('.ly'))throw new Error('The code file must end in .ly.');selected[role]={name:file.name,blob:file};}await openSnapshot(selected);});
$('import').onchange=guard(async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy)return;if(!review)throw new Error('Open the exact three input files before importing annotation JSON.');if(file.size>25*1024*1024)throw new Error('Review JSON exceeds 25 MB.');const captured=stamp(),value=JSON.parse(await file.text());if(busy||!matchesStamp(captured))throw new Error('The review changed while importing. Select the JSON again.');const imported=validateReview(value,review);cancelGesture();checkpoint();review=imported;active=null;changed();message('Imported matching review. All comments and strokes restored.');});
// Persistence and package wiring are kept separate from the drawing surface.
let saveFailed=false,saveTimer,saveQueue=Promise.resolve(),urls=[];
function storageFailure(e){saveFailed=true;saveConflict||=e.name==='StorageConflictError';$('emergency').hidden=false;const detail=saveConflict?e.message:`Local saving failed: ${e.message||e.name||'Storage unavailable'}. Keep this tab open and download a recovery ZIP.`;storageStatus('NOT SAVED',detail);message(detail,true);}
function scheduleSave(){clearTimeout(saveTimer);storageStatus(saveConflict||saveFailed?'NOT SAVED':'Saving…',storageProblem);saveTimer=setTimeout(()=>saveNow(),350);}
async function saveNow(){
  clearTimeout(saveTimer);
  const save=async()=>{
    // Capture when this queued write starts, not when it was enqueued. A second
    // queued save must use the first write's persisted revision, or do no work.
    if(!review||!dirty||saveConflict)return !dirty;
    const record={id:recordKey(),review:clone(review),files,revisionId,completions:clone(completions),...(returned?{returned:clone(returned)}:{})},captured=stamp();
    try{
    const saved=await operations.putSaved(record,persistedRevision);
      if(recordKey()===record.id){persistedRevision=saved.storageRevision;if(matchesStamp(captured)){dirty=false;saveFailed=false;$('emergency').hidden=true;storageStatus('Saved locally');}}
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
$('export').onclick=()=>{if(!review||busy)return;cancelGesture();$('workspaceDialog').close();$('exports').showModal();};
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
export const sessionStatus=()=>({...stamp(),dirty,busy,persistedRevision,saveConflict,unprotected:unprotectedWork(),recoveryStamp:recoveryStamp&&{...recoveryStamp},active,focused,prepared,mode,gesture:Boolean(gesture),undoLength:undo.length,exporting:Boolean(exportJob)});
const appApi={
  capture:()=>({review:clone(review),files,returned:clone(returned),active,doc:comparison?.current??views.rendered.doc,comparison:Boolean(comparison),stamp:stamp(),revisionId,workspaceId:recordKey(),persistedRevision,completions:clone(completions)}),matches:matchesStamp,status:sessionStatus,message,
  openImported:parsed=>openSnapshot(parsed.files,null,parsed.review,null,false,parsed.completionBundle),
  openReturned:seed=>openSnapshot(seed.files,null,seed.review,seed),
  reloadReturned:()=>openSnapshot(null,recordKey(),null,null,true),
  updateReturned:mutate=>{if(!canEdit()||!returned)return;mutate(returned);changed();},
  newRegion:reportedId=>newFinding(reportedId),
  selectMark:selectFinding,
  commitDecision:async mutate=>{
    await saveNow();if(unprotectedWork())throw new Error('Save the current annotations or download their latest recovery ZIP before recording a decision.');
    const next=clone(returned);mutate(next);const nextReview=clone(review);nextReview.updatedAt=new Date().toISOString();
    const nextRevisionId=crypto.randomUUID();let saved;try{saved=await operations.putSaved({id:recordKey(),review:nextReview,files,returned:next,revisionId:nextRevisionId,completions},persistedRevision);}catch(e){if(e.name==='StorageConflictError')throw new Error('Another tab saved newer review decisions. This decision was not saved. Reload the saved review before continuing.');throw e;}
    returned=saved.returned;review=nextReview;revisionId=nextRevisionId;completions=saved.completions;persistedRevision=saved.storageRevision;revision++;invalidateExport();document.dispatchEvent(new Event('score-desk-change'));try{await refreshSaved();}catch(e){message('Decision saved, but the saved-review list could not refresh: '+e.message,true);}
  },
  compare:async blob=>{
    if(!review||busy)return;busy=true;controls();cancelGesture();try{
      if(blob&&!comparison){const previous=await openPdf(blob);setMode('navigate');comparison={current:views.rendered.doc,previous,currentPage:views.rendered.page,currentScroll:[$('renderedScroll').scrollLeft,$('renderedScroll').scrollTop]};views.rendered.doc=previous;views.rendered.page=1;}
      else if(!blob&&comparison){views.rendered.restoreScroll=comparison.currentScroll;views.rendered.doc=comparison.current;views.rendered.page=comparison.currentPage;await comparison.previous.destroy();comparison=null;}
      $('renderedPage').max=views.rendered.doc.numPages;$('renderedPage').value=views.rendered.page;$('renderedCount').textContent=`/ ${views.rendered.doc.numPages}`;await renderPage(views.rendered);if(views.rendered.restoreScroll){$('renderedScroll').scrollTo(...views.rendered.restoreScroll);delete views.rendered.restoreScroll;}
    }finally{busy=false;controls();}
  },
  inspectPdf:async nextFiles=>{const docs=[];try{for(const role of ['source','rendered'])docs.push(await openPdf(nextFiles[role].blob));const pages=[];for(let i=1;i<=docs[1].numPages;i++){const p=await docs[1].getPage(i);pages.push({page:i,view:[...p.view],rotation:p.rotate,userUnit:p.userUnit});}return pages;}finally{for(const doc of docs)await doc.destroy();}},
  lock:async action=>{if(busy)throw new Error('Wait for the current operation to finish.');busy=true;cancelGesture();controls();try{return await action();}finally{busy=false;controls();}},
  flush:async()=>{await saveNow();if(unprotectedWork())throw new Error('The latest review could not be saved. Protect your edits with a recovery ZIP before finishing.');},
  commitCompletion:async(record,captured)=>{
    if(!matchesStamp(captured)||record.revision.id!==revisionId)throw new Error('The review changed. Finish the current revision again.');
    const saved=await operations.putSaved({id:recordKey(),review:clone(review),files,returned:clone(returned),revisionId,completions:mergeCompletions(completions,[record])},persistedRevision,record);
    completions=saved.completions;persistedRevision=saved.storageRevision;dirty=false;saveFailed=false;saveConflict=false;recoveryStamp=null;$('emergency').hidden=true;storageStatus('Saved locally');invalidateExport();document.dispatchEvent(new Event('score-desk-completions'));
  },
  packageMaker:(...args)=>operations.makePackage(...args),zip:(...args)=>operations.zipFiles(...args),download:(...args)=>operations.download(...args)
};
export const handoff=installHandoff(appApi);
export const completion=installCompletion(appApi);
controls();
// Reopening retained bytes never attaches an old review to newly selected files.
(async()=>{try{const entries=await refreshSaved();if(entries.length){await openSnapshot(null,entries[0].id);message('Restored last saved snapshot');}}catch(e){storageFailure(e);}finally{document.body.dataset.ready='true';}})();

import {comparisonContext,savedLocation,bookmark} from './comparison-model.js';
const $=id=>document.getElementById(id);
const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};

// Both transports share this view. Adapters alone persist decisions and enforce
// permissions; navigation, drafts and remembered passages never imply approval.
export function installComparison(api){
  const header=element('section',null,'correction-header');header.id='correctionHeader';header.hidden=true;document.body.prepend(header);
  const root=element('section',null,'correction-comparison');root.id='correctionComparison';root.hidden=true;root.setAttribute('aria-label','Review the reported problem');$('focusBar').before(root);
  const filesDialog=element('dialog');filesDialog.id='correctionFiles';filesDialog.setAttribute('aria-label','Files and review history');
  const filesHead=element('div',null,'dialog-head');filesHead.append(element('h2','Files and review history'));const filesClose=element('button','Close');filesClose.onclick=()=>filesDialog.close();filesHead.append(filesClose);filesDialog.append(filesHead);document.body.append(filesDialog);
  const problemsDialog=element('dialog');problemsDialog.id='correctionProblems';problemsDialog.setAttribute('aria-label','Reported problems');
  const problemsHead=element('div',null,'dialog-head');problemsHead.append(element('h2','Reported problems'));const problemsClose=element('button','Close');problemsClose.onclick=()=>problemsDialog.close();problemsHead.append(problemsClose);
  const problemSearch=element('input');problemSearch.id='correctionProblemSearch';problemSearch.type='search';problemSearch.placeholder='Search report text or page';problemSearch.setAttribute('aria-label','Search reported problems');
  const uncheckedLabel=element('label','Unchecked only'),unchecked=element('input');unchecked.type='checkbox';unchecked.id='correctionUncheckedOnly';uncheckedLabel.prepend(unchecked);
  const problemCount=element('p');problemCount.id='correctionProblemCount';problemCount.setAttribute('role','status');const problemList=element('div');problemList.id='correctionProblemList';
  problemsDialog.append(problemsHead,problemSearch,uncheckedLabel,problemCount,problemList);document.body.append(problemsDialog);
  const refs={},owned=[],homes=new Map(),narrow=matchMedia('(max-width:700px)'),compact=matchMedia('(max-width:430px)'),medium=matchMedia('(max-width:1100px)');
  const scoreSwitch=document.querySelector('.score-switch'),switchHome=scoreSwitch.parentNode;
  let adapter=null,index=0,context=null,left='before',priorLeft='before',pending=false,initializing=false,opening=null,viewReady=false,generation=0,urls=[],positions=new Map(),currentId=null,editorOpen=false,draftSerial=0;
  const selected=()=>adapter?.findings()[index];
  function place(node,parent){if(!homes.has(node))homes.set(node,{parent:node.parentNode,next:node.nextSibling});parent.append(node);}
  function restore(){for(const [node,home]of homes)home.parent.insertBefore(node,home.next?.parentNode===home.parent?home.next:null);homes.clear();for(const node of owned)node.remove();owned.length=0;}
  function own(node,parent){parent.append(node);owned.push(node);return node;}
  function closeMenus(){for(const item of [refs.more,refs.aiDetails,refs.sourceOptions,refs.afterOptions])if(item)item.open=false;}
  function notify(text,error=false){refs.notice.textContent=text;refs.notice.dataset.error=String(error);api.message(text,error,true);}
  function clearReceipt(){
    // Only clear our current acknowledgement, never an unrelated failure.
    if(refs.receipt&&$('message').contains(refs.receipt))api.message('',false,true);
  }
  function controls(){
    if(!adapter)return;
    const disabled=pending||initializing||api.status().busy;root.setAttribute('aria-busy',String(disabled));
    for(const scope of [root,header,...owned])for(const el of scope.querySelectorAll('button,select,textarea,input'))if(!el.closest('#notices'))el.disabled=disabled;
    refs.skip.disabled=disabled||index>=adapter.findings().length-1;
    refs.skip.hidden=index>=adapter.findings().length-1;
    refs.approve.disabled=disabled||!viewReady||!adapter.canApprove();refs.locate.disabled=disabled||!viewReady||!adapter.candidate;refs.package.disabled=disabled||!adapter.candidate;refs.report.disabled=disabled||!adapter.candidate;
    document.body.classList.toggle('corrections-annotating',Boolean(api.status().active||api.status().prepared));
    if(api.status().active||api.status().prepared)clearReceipt();
    if(refs.submit)refs.submit.disabled=disabled||!api.status().active;
    refs.back.textContent=compact.matches?(adapter.shared?'← Project':'← Workspace'):(adapter.shared?'Back to project':'Back to workspace');refs.back.setAttribute('aria-label',adapter.shared?'Back to project':'Back to workspace');
    for(const kind of ['source','rendered']){
      const page=$(`${kind}Page`),nav=$(`${kind}PageNavigation`);
      if(nav){nav.querySelector('[data-action=prev]').disabled=disabled||Number(page.value)<=1;nav.querySelector('[data-action=next]').disabled=disabled||Number(page.value)>=Number(page.max);}
    }
    $('showSource').textContent=left==='source'?(compact.matches?'Source':'Printed source'):left==='original'?'Earlier version':compact.matches?'Before':'Before correction';
    $('showSource').setAttribute('aria-label',left==='source'?'Printed source':left==='original'?'Earlier version':'Before correction');
    refs.sourceToggle.textContent=left==='source'?(compact.matches?'Back to Before':'Back to correction'):(compact.matches?'Check source':'Check printed source');
    refs.sourceToggle.setAttribute('aria-label',left==='source'?'Return to the correction comparison':'Check printed source');
    refs.report.textContent=compact.matches?'Report error':'Report another error';refs.report.setAttribute('aria-label','Report another error');
    refs.aiDetails.querySelector('summary').textContent=medium.matches?'AI changes':'What the AI changed';refs.aiDetails.querySelector('summary').setAttribute('aria-label','What the AI changed');
    for(const summary of [refs.sourcePageSummary,refs.afterPageSummary]){summary.textContent=compact.matches?'View':'View options';summary.setAttribute('aria-label','View options');}
  }
  compact.addEventListener('change',controls);
  medium.addEventListener('change',controls);
  const guarded=fn=>async(...args)=>{
    if(pending||initializing||api.status().busy)return;
    const focused=document.activeElement;pending=true;controls();
    try{await fn(...args);}catch(error){notify(error.message,true);}finally{pending=false;controls();if(refs.focusAfter){refs.focusAfter.focus({preventScroll:true});refs.focusAfter=null;}else if(focused?.isConnected&&!focused.closest('[hidden]')&&!document.querySelector('dialog[open]'))(focused.disabled?refs.picker:focused).focus({preventScroll:true});}
  };
  function button(label,id,fn,guard=true){const el=element('button',label);el.type='button';if(id)el.id=id;el.onclick=guard?guarded(fn):fn;return el;}
  function disclosure(label,id,cls='review-disclosure'){
    const details=element('details',null,cls);if(id)details.id=id;const summary=element('summary',label),body=element('div',null,'review-popover');details.append(summary,body);return {details,summary,body};
  }
  function renderProblems(){
    if(!adapter)return;
    const query=problemSearch.value.trim().toLocaleLowerCase(),list=adapter.findings();problemList.replaceChildren();let visible=0;
    list.forEach((finding,i)=>{
      const page=finding.historicalContext?.page??finding.origin?.page??finding.page,location=page?`Reported on page ${page}`:'No page specified',state=adapter.state(finding.id)||'Unchecked';
      if(unchecked.checked&&adapter.decision(finding.id)||query&&!`${finding.comment} ${location} ${state}`.toLocaleLowerCase().includes(query))return;
      visible++;const row=button('',null,async()=>{problemsDialog.close();await select(i);refs.focusAfter=refs.picker;});row.dataset.problemIndex=String(i);row.className='problem-list-item';row.setAttribute('aria-current',String(i===index));
      row.append(element('span',`${i+1} · ${location} · ${state}`, 'problem-list-context'),element('span',finding.comment,'problem-list-comment'));problemList.append(row);
    });
    problemCount.textContent=`${visible} of ${list.length} reported problems`;if(!visible)problemList.append(element('p','No problems match this search.'));
  }
  problemSearch.oninput=unchecked.onchange=()=>{renderProblems();problemList.scrollTop=0;};
  function showProblems(){closeMenus();renderProblems();problemsDialog.showModal();problemSearch.focus();problemList.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest'});}
  function showEditor(open){editorOpen=open;refs.editor.hidden=!open;refs.actions.hidden=open;refs.reportBody.hidden=open;root.classList.toggle('response-open',open);if(open){closeMenus();refs.explanation.focus({preventScroll:true});}else refs.reject.focus({preventScroll:true});}
  function focusEditor(){if(pending||initializing)return;showEditor(true);}
  async function saveDraft(){
    const id=selected().id,key=adapter.key,serial=++draftSerial,value=refs.explanation.value,kind=refs.clarify.checked?'needs_clarification':'needs_correction';
    refs.draft.textContent='Saving draft locally…';
    try{await adapter.saveExplanation(id,value,kind);if(adapter?.key===key&&selected()?.id===id&&serial===draftSerial)refs.draft.textContent='Draft saved locally';}
    catch(error){if(adapter?.key===key&&selected()?.id===id&&serial===draftSerial)refs.draft.textContent='Draft not saved';notify(`Draft could not be saved: ${error.message}. Keep this page open.`,true);}
  }
  function remember(){
    if(!currentId)return;const saved=positions.get(currentId)??{};
    // A page change clears its viewport while painting. Preserve the requested
    // page even if the reviewer switches versions before that paint completes.
    const position=kind=>api.viewPosition(kind)??{page:Number($(`${kind}Page`).value)||1,zoom:$(`${kind}Zoom`).value==='fit'?'fit':Number($(`${kind}Zoom`).value)};
    saved[left]=position('source');saved.after=position('rendered');positions.set(currentId,saved);
  }
  function initial(asset){const mark=asset?.marks.find(f=>f.id===selected().id),box=mark?.bounds;return {page:mark?.page??context.page,zoom:'fit',...(box?{point:[(box[0]+box[2])/2,(box[1]+box[3])/2]}:{})};}
  async function displayLeft(mode){
    const token=generation;if(mode==='source'&&left!=='source')priorLeft=left;left=mode;refs.left.value=mode;
    const asset=mode==='source'?null:mode==='original'?context.original:context.baseline;
    await api.showHistorical(asset,positions.get(currentId)?.[mode]??(mode==='source'?{page:1,zoom:'fit'}:initial(asset)),refs.others.checked);
    if(token!==generation)return;
    $('sourceLabel').textContent=mode==='source'?'Printed source':mode==='original'?'Earlier version':'Before correction';
    refs.sourceToggle.textContent=mode==='source'?'Back to correction':'Check printed source';
    $('showSource').textContent=mode==='source'?'Printed source':mode==='original'?'Earlier version':'Before correction';
  }
  function measureReport(){if(!adapter)return;refs.expand.hidden=refs.original.scrollHeight<=refs.original.clientHeight+1&&!root.classList.contains('report-expanded');}
  const reportSize=new ResizeObserver(measureReport);
  async function select(next){
    remember();closeMenus();editorOpen=false;refs.editor.hidden=true;refs.actions.hidden=false;refs.reportBody.hidden=false;root.classList.remove('response-open','report-expanded');refs.expand.textContent='Read full report';
    viewReady=false;index=Math.max(0,Math.min(adapter.findings().length-1,next));const f=selected();if(!f)return;
    const token=++generation;currentId=f.id;context=await comparisonContext(adapter.issued,f);if(token!==generation)return;
    refs.picker.value=String(index);refs.original.textContent=f.comment;refs.ai.textContent=adapter.result(f.id)?.explanation??'No explanation supplied.';
    refs.explanation.value=await adapter.explanation(f.id);const kind=await adapter.draftKind?.(f.id);if(token!==generation)return;
    refs.clarify.checked=kind==='needs_clarification';refs.draft.textContent=refs.explanation.value?'Draft saved locally':'';
    for(const url of urls)URL.revokeObjectURL(url);urls=[];refs.context.replaceChildren();
    refs.history.hidden=!context.earlier;refs.history.textContent=context.earlier?'This error was reported on an earlier version.':'';
    refs.earlier.textContent=context.original?'The original PDF and its reported errors are available.':'Only the original marked images are available.';
    refs.originalVersion.hidden=!context.earlier||!context.original;
    refs.left.replaceChildren(new Option('Before correction','before'),new Option('Printed source','source'));if(context.earlier&&context.original)refs.left.add(new Option('Earlier version','original'));
    context.crops.forEach((blob,i)=>{if(!blob)return;const img=element('img');img.src=URL.createObjectURL(blob);urls.push(img.src);img.alt=`${i?'Clean':'Marked'} original context for problem ${index+1}`;refs.context.append(img);});
    await displayLeft(context.earlier&&context.original?'original':'before');if(token!==generation)return;
    const scene=api.capture(),location=adapter.candidate&&savedLocation(adapter.location(f.id),f.id,scene.review);
    await api.positionView('rendered',location?.position??positions.get(f.id)?.after??{page:context.page,zoom:'fit'});if(token!==generation)return;
    refs.alignment.textContent=location?'This passage is remembered for this AI revision.':'Starting page only — the passage has not been matched.';
    refs.notice.textContent='';viewReady=true;refresh();await adapter.onSelect?.(index);controls();measureReport();
  }
  function refresh(){
    if(!adapter)return;const list=adapter.findings(),checked=list.filter(f=>adapter.decision(f.id)).length;
    const progress=`${checked} of ${list.length} corrections checked`;refs.progress.textContent=progress;const local=$('roundProgress');if(local)local.textContent=progress;
    if(selected()){
      const decision=adapter.decision(selected().id),checked=Boolean(decision),status=adapter.state(selected().id);
      const outcome={needs_correction:'Still wrong',open:'Still wrong',needs_clarification:'Source unclear',needs_source_clarification:'Source unclear'}[decision?.state];
      refs.state.textContent=checked?(status.includes('Applied')?'Checked · Applied':outcome??'Checked'):'Unchecked';refs.state.title=status;refs.state.dataset.checked=String(checked);refs.state.dataset.attention=String(Boolean(outcome));
      refs.picker.textContent=`Problems ${index+1}/${list.length}`;refs.picker.setAttribute('aria-label',`Browse reported problems. Problem ${index+1} of ${list.length}. ${selected().comment}`);
      refs.approve.textContent=index===list.length-1?'Looks correct':'Looks correct & next';
      refs.end.hidden=index!==list.length-1;refs.end.textContent=remainingText();
    }
    if(problemsDialog.open)renderProblems();
    $('renderedLabel').textContent=adapter.candidate?'AI revision':'AI revision unavailable';controls();
  }
  function remainingText(){const remaining=adapter.findings().filter(f=>!adapter.decision(f.id)).length;return remaining?`Last problem · ${remaining} unchecked`:'All corrections checked';}
  async function decide(state){
    const f=selected(),key=adapter.key,id=f.id;
    if(state!=='looks_correct'&&!refs.explanation.value.trim()){notify('Describe what is still wrong before sending.',true);refs.focusAfter=refs.explanation;return;}
    const saved=await adapter.saveDecision(id,state,refs.explanation.value);
    if(saved!==true)throw new Error('The decision was not confirmed saved. Your problem and draft are kept. Retry when connected.');
    if(adapter?.key!==key||selected()?.id!==id)return;
    if(state==='looks_correct'&&index<adapter.findings().length-1)await select(index+1);else{showEditor(false);refs.focusAfter=refs.reject;refresh();}
    notify((adapter.shared?'Decision confirmed by the project.':'Decision saved locally.')+(index===adapter.findings().length-1?' '+remainingText()+'.':''));
  }
  function setResponsiveView(){if(adapter)api.showScore(narrow.matches?'rendered':'both');}
  narrow.addEventListener('change',setResponsiveView);
  function showFiles(){closeMenus();filesDialog.showModal();}
  function secondary(kind){
    const head=$(`${kind}Viewer`).querySelector('.viewer-head'),tools=own(element('div',null,'review-pane-actions'),head),menu=disclosure('View options',`${kind}ViewOptions`,'review-view-options');tools.append(menu.details);
    const navigation=own(element('div',null,'review-page-navigation'),$(`${kind}Viewer`));navigation.id=`${kind}PageNavigation`;navigation.setAttribute('role','group');navigation.setAttribute('aria-label',kind==='source'?'Before and printed source page navigation':'AI revision page navigation');
    place(head.querySelector('.page-controls'),navigation);return {tools,...menu};
  }
  async function open(next){
    if(adapter?.key===next.key){adapter=next;refresh();return opening;}
    generation++;remember();filesDialog.close();problemsDialog.close();problemSearch.value='';unchecked.checked=false;restore();switchHome.append(scoreSwitch);adapter=next;positions=new Map();currentId=null;index=0;initializing=true;root.replaceChildren();header.replaceChildren();root.hidden=false;header.hidden=false;document.body.classList.add('corrections-open');
    header.setAttribute('aria-label','Correction review navigation');
    refs.back=button(next.shared?'Back to project':'Back to workspace','correctionBack',()=>{closeMenus();$(next.shared?'sharedProject':'workspaceTools').click();},false);header.append(refs.back);
    const more=disclosure('More','correctionMore');refs.more=more.details;header.append(more.details);
    refs.package=button('Download review package','saveComparisonPackage',async()=>{closeMenus();await adapter.exportPackage();notify('Review package downloaded.');});
    more.body.append(refs.package,button('Files and review history','correctionFilesButton',showFiles,false),button('Workspace and files','correctionWorkspace',()=>{closeMenus();$('workspaceTools').click();},false));
    if(next.shared)more.body.append(button('Submit separate findings','correctionSubmitFindings',()=>{closeMenus();$('sharedSubmit').click();},false));
    refs.progress=element('span');refs.progress.id='correctionProgress';refs.state=element('span',null,'correction-state');refs.state.id=next.ids.state;more.body.append(element('small','Checking these corrections does not verify or publish the whole score.'));
    const navigation=element('div',null,'correction-navigation');header.prepend(navigation);
    refs.picker=button('Problems',next.ids.picker??'correctionFinding',showProblems,false);refs.picker.className='problem-picker';refs.picker.setAttribute('aria-haspopup','dialog');refs.picker.setAttribute('aria-controls','correctionProblems');
    navigation.append(refs.picker,refs.progress);place($('notices'),header);header.insertBefore($('notices'),refs.back);
    const ai=disclosure('What the AI changed','correctionAI');refs.aiDetails=ai.details;refs.ai=element('p');ai.body.append(refs.ai,button('Close','closeAIExplanation',()=>{ai.details.open=false;ai.summary.focus();},false));
    refs.reportBody=element('div',null,'correction-report');refs.original=element('p');refs.original.id='correctionOriginal';refs.original.tabIndex=0;
    const copy=element('div',null,'correction-copy');refs.expand=button('Read full report','expandCorrectionReport',()=>{const expanded=root.classList.toggle('report-expanded');refs.expand.textContent=expanded?'Collapse report':'Read full report';measureReport();},false);refs.expand.className='quiet';copy.append(refs.original,refs.expand);refs.reportBody.append(refs.state,copy,ai.details);root.append(refs.reportBody);reportSize.disconnect();reportSize.observe(refs.original);
    refs.history=element('p',null,'correction-history-hint');refs.history.id='correctionHistoryLabel';copy.append(refs.history);
    refs.actions=element('div',null,'correction-actions');refs.approve=button('Looks correct & next',next.ids.approve,()=>decide('looks_correct'));refs.approve.className='primary';refs.reject=button('Still wrong…',next.ids.reject,focusEditor,false);refs.skip=button('Skip','skipCorrection',()=>select(index+1));refs.end=element('span',null,'correction-end');refs.end.id='correctionEnd';refs.actions.append(refs.approve,refs.reject,refs.skip,refs.end);root.append(refs.actions);
    refs.editor=element('form',null,'correction-response');refs.editor.id='correctionResponse';refs.editor.hidden=true;refs.editor.onsubmit=guarded(async event=>{event.preventDefault();await decide(refs.clarify.checked?'needs_clarification':'needs_correction');});
    // Prevent native form navigation even when the guard is busy.
    refs.editor.addEventListener('submit',event=>event.preventDefault());
    const label=element('label','What is still wrong?');refs.explanation=element('textarea');refs.explanation.id=next.ids.explanation;refs.explanation.rows=2;refs.explanation.maxLength=4000;refs.explanation.oninput=saveDraft;label.append(refs.explanation);
    const responseActions=element('div',null,'response-actions');refs.send=button('Send','sendCorrectionResponse',()=>decide(refs.clarify.checked?'needs_clarification':'needs_correction'));const cancel=button('Cancel','cancelCorrectionResponse',()=>showEditor(false),false);responseActions.append(refs.send,cancel);
    const clarifyLabel=element('label','The printed source is unclear');refs.clarify=element('input');refs.clarify.id=next.ids.clarify;refs.clarify.type='checkbox';refs.clarify.onchange=saveDraft;clarifyLabel.prepend(refs.clarify);clarifyLabel.className='source-unclear';refs.draft=element('span',null,'response-draft');refs.draft.id='correctionDraftStatus';refs.draft.setAttribute('role','status');refs.editor.append(label,responseActions,clarifyLabel,refs.draft);root.append(refs.editor);
    root.append(scoreSwitch);$('showSource').textContent='Before correction';$('showRendered').textContent='AI revision';setResponsiveView();
    const source=secondary('source');refs.sourceOptions=source.details;refs.sourcePageSummary=source.summary;
    refs.sourceToggle=button('Check printed source','checkPrintedSource',async()=>{remember();await displayLeft(left==='source'?priorLeft:'source');});source.tools.prepend(refs.sourceToggle);
    refs.left=element('select');refs.left.id='comparisonLeft';refs.left.setAttribute('aria-label','Version shown before correction');refs.left.onchange=guarded(async()=>{const mode=refs.left.value;remember();await displayLeft(mode);});source.body.append(refs.left);
    const otherLabel=element('label','Show other reported errors');refs.others=element('input');refs.others.id='otherHistoricalMarks';refs.others.type='checkbox';refs.others.onchange=guarded(async()=>{remember();await displayLeft(left);});otherLabel.prepend(refs.others);source.body.append(otherLabel);
    refs.originalVersion=button('Show the earlier version','showOriginalVersion',async()=>{remember();await displayLeft('original');});source.body.append(refs.originalVersion);
    const original=disclosure('Original marked context','originalReportedContext','correction-context');refs.earlier=element('p');refs.context=element('div');original.body.append(refs.earlier,refs.context);source.body.append(original.details);
    const after=secondary('rendered');refs.afterOptions=after.details;refs.afterPageSummary=after.summary;
    refs.report=button('Report another error','reportAnotherError',()=>{closeMenus();clearReceipt();document.body.classList.add('corrections-annotating');$('newFinding').click();},false);after.tools.prepend(refs.report);
    refs.submit=null;
    $('saveFinding').textContent='Save locally';
    if(next.submitFinding){
      refs.submit=own(button('Submit error','submitCorrectionError',async()=>{
        await api.flush();const id=api.status().active;if(!id)throw new Error('Type a comment or mark the new error before submitting.');
        clearReceipt();const finding=api.capture().review.findings.find(f=>f.id===id);
        const receipt=await adapter.submitFinding(id);if(!receipt?.id)throw new Error('Submission was not confirmed. Your draft is kept; retry safely.');
        await api.finishFinding();
        if(!refs.receipts.querySelector(`[data-receipt-id="${CSS.escape(receipt.id)}"]`)){
          const saved=element('a',`Error #${finding.number}: ${finding.comment||'Marked passage'}`);saved.href=receipt.url;saved.dataset.receiptId=receipt.id;refs.receipts.append(saved);
        }
        refs.receipts.hidden=false;notify(`Error #${finding.number} received by the project. `);
        // A receipt is part of this acknowledgement, not an independent banner.
        // message() replaces it on the next notice (including non-review errors).
        refs.receipt.href=receipt.url;refs.receipt.textContent='Receipt';refs.receipt.setAttribute('aria-label',`Project receipt for error #${finding.number}`);$('message').append(refs.receipt);refs.focusAfter=refs.receipt;
      }),$('editor').querySelector('.editor-actions'));refs.submit.className='primary';
      refs.receipt=element('a');refs.receipt.id='correctionErrorReceipt';
      refs.receipts=element('details',null,'correction-receipts');refs.receipts.id='correctionReceipts';refs.receipts.append(element('summary','Submitted errors'));refs.receipts.hidden=true;more.body.append(refs.receipts);
    }
    refs.alignment=element('p');refs.alignment.id='correctionAlignment';refs.locate=button('Remember this passage','locateCorrectedPassage',async()=>{const f=selected(),location=bookmark(f.id,api.capture().review,api.viewPosition('rendered'));if(await adapter.saveLocation(f.id,location)!==true)throw new Error('The passage was not confirmed saved. Your current view is kept; please retry.');refs.alignment.textContent='This passage is remembered for this AI revision.';closeMenus();notify('Passage remembered. No finding or decision was created.');});
    after.body.append(refs.alignment,element('p','Find the passage in the AI revision, then remember this view.'),refs.locate);
    refs.missing=element('p',null,'correction-missing');refs.missing.hidden=Boolean(next.candidate);refs.missing.append(element('span','Add the revised PDF before checking this correction. '),button('Add revised PDF','addMissingRevision',showFiles,false));root.append(refs.missing);
    if(next.filesPanel)place($(next.filesPanel),filesDialog);
    refs.notice=element('span');refs.notice.id='correctionNotice';refs.notice.hidden=true;root.append(refs.notice);
    try{controls();opening=select(0);await opening;}finally{if(adapter?.key===next.key){opening=null;initializing=false;controls();}}
  }
  function close(){adapter=null;generation++;opening=null;initializing=false;currentId=null;root.hidden=true;header.hidden=true;filesDialog.close();problemsDialog.close();restore();$('saveFinding').textContent='Done';switchHome.append(scoreSwitch);for(const url of urls)URL.revokeObjectURL(url);urls=[];document.body.classList.remove('corrections-open','corrections-annotating');$('showSource').textContent='Source';$('showRendered').textContent='Rendered';$('sourceLabel').textContent='Original source';}
  document.addEventListener('keydown',event=>{if(!adapter||event.key!=='Escape'||event.isComposing||document.querySelector('dialog[open]'))return;const menu=[refs.more,refs.aiDetails,refs.sourceOptions,refs.afterOptions].find(item=>item?.open);if(menu){event.preventDefault();event.stopImmediatePropagation();menu.open=false;menu.querySelector('summary').focus();}else if(editorOpen){event.preventDefault();event.stopImmediatePropagation();showEditor(false);}},true);
  document.addEventListener('score-desk-controls',controls);
  document.addEventListener('score-desk-change',()=>{if(adapter&&!adapter.matches(api.capture()))close();});
  return {open,refresh,close,showFiles,selected:()=>index,select:guarded(select),state:()=>({key:adapter?.key,findingId:selected()?.id,left,pending})};
}

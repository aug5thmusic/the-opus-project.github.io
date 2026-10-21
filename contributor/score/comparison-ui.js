import {comparisonContext,savedLocation,bookmark} from './comparison-model.js';
const $=id=>document.getElementById(id);
const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};

// Both transports use this controller. Adapters own persistence/permissions;
// this controller never turns a navigation action into a review decision.
export function installComparison(api){
  const root=element('section',null,'correction-comparison');root.id='correctionComparison';root.hidden=true;root.setAttribute('aria-label','Check AI corrections');$('focusBar').before(root);
  let adapter=null,index=0,context=null,left='before',pending=false,initializing=false,opening=null,viewReady=false,generation=0,urls=[],positions=new Map(),currentId=null;
  const refs={};
  const navigationSize=new ResizeObserver(entries=>root.style.setProperty('--correction-nav-height',`${entries[0].target.getBoundingClientRect().height}px`));
  const selected=()=>adapter?.findings()[index];
  const notify=(text,error=false)=>{refs.notice.textContent=text;refs.notice.dataset.error=String(error);api.message(text,error);};
  const guarded=fn=>async(...args)=>{
    if(pending||initializing||api.status().busy)return;
    const focused=root.contains(document.activeElement)?document.activeElement:null;
    pending=true;controls();try{await fn(...args);}catch(error){notify(error.message,true);}finally{
      pending=false;controls();
      if(focused?.isConnected&&!root.hidden&&!document.querySelector('dialog[open]'))(focused.disabled?refs.picker:focused).focus({preventScroll:true});
    }
  };
  function button(label,id,fn){const el=element('button',label);if(id)el.id=id;el.onclick=guarded(fn);return el;}
  function controls(){
    if(!adapter)return;
    const disabled=pending||initializing||api.status().busy;
    root.setAttribute('aria-busy',String(disabled));
    for(const el of root.querySelectorAll('button,select,textarea,input'))el.disabled=disabled;
    refs.previous.disabled=disabled||index===0;refs.next.disabled=disabled||index>=adapter.findings().length-1;
    refs.approve.disabled=disabled||!viewReady||!adapter.canApprove();refs.locate.disabled=disabled||!viewReady||!adapter.candidate;
    refs.package.disabled=disabled||!adapter.candidate;
  }
  function remember(){
    if(!currentId)return;
    const saved=positions.get(currentId)??{};
    saved[left]=api.viewPosition('source');saved.after=api.viewPosition('rendered');positions.set(currentId,saved);
  }
  function initial(asset){
    const mark=asset?.marks.find(f=>f.id===selected().id),box=mark?.bounds;
    return {page:mark?.page??context.page,zoom:'fit',...(box?{point:[(box[0]+box[2])/2,(box[1]+box[3])/2]}:{})};
  }
  async function displayLeft(mode){
    const token=generation;left=mode;refs.left.value=mode;
    const asset=mode==='source'?null:mode==='original'?context.original:context.baseline;
    await api.showHistorical(asset,positions.get(currentId)?.[mode]??(mode==='source'?{page:1,zoom:'fit'}:initial(asset)),refs.others.checked);
    if(token!==generation)return;
    $('sourceLabel').textContent=mode==='source'?'Printed source':mode==='original'?'Earlier version · original report':'Before · task baseline';
    $('showSource').textContent=mode==='source'?'Printed source':mode==='original'?'Earlier version':'Before';
  }
  async function select(next){
    remember();viewReady=false;index=Math.max(0,Math.min(adapter.findings().length-1,next));
    const f=selected();if(!f)return;
    const token=++generation;currentId=f.id;
    context=await comparisonContext(adapter.issued,f);if(token!==generation)return;
    refs.picker.value=String(index);refs.original.textContent=f.comment;refs.ai.textContent=adapter.result(f.id)?.explanation??'No explanation supplied.';
    refs.explanation.value=await adapter.explanation(f.id);if(token!==generation)return;
    for(const url of urls)URL.revokeObjectURL(url);urls=[];refs.context.replaceChildren();
    refs.earlier.textContent=context.earlier?'Reported on an earlier version'+(context.original?' · original PDF available':' · only original crops available'):'Historical marks are read-only · exact task baseline';
    refs.left.replaceChildren(new Option('Before · task baseline','before'),new Option('Printed source','source'));
    if(context.earlier&&context.original)refs.left.add(new Option('Earlier version · original report','original'));
    context.crops.forEach((blob,i)=>{if(!blob)return;const image=element('img');image.src=URL.createObjectURL(blob);urls.push(image.src);image.alt=`${i?'Clean':'Marked'} original context for finding #${f.number}`;refs.context.append(image);});
    refs.contextDetails.open=context.earlier&&!context.original;
    await displayLeft(context.earlier&&context.original?'original':'before');
    if(token!==generation)return;
    const scene=api.capture(),location=adapter.candidate&&savedLocation(adapter.location(f.id),f.id,scene.review);
    await api.positionView('rendered',location?.position??positions.get(f.id)?.after??{page:context.page,zoom:'fit'});
    if(token!==generation)return;
    refs.alignment.textContent=location?'Saved corresponding location · this exact After revision':'Approximate starting position · passage not matched';
    refs.notice.textContent='';viewReady=true;refresh();await adapter.onSelect?.(index);controls();
  }
  function refresh(){
    if(!adapter)return;
    const list=adapter.findings(),checked=list.filter(f=>adapter.decision(f.id)).length;
    refs.progress.textContent=`${checked} of ${list.length} corrections checked · selected ${index+1} of ${list.length}`;
    const localProgress=$('roundProgress');if(localProgress)localProgress.textContent=refs.progress.textContent;
    const f=selected();if(f){refs.state.textContent=adapter.state(f.id);refs.picker.options[index].text=`#${f.number} · ${adapter.state(f.id)}`;}
    controls();
  }
  async function decide(state){
    const f=selected(),targetKey=adapter.key,id=f.id;
    const saved=await adapter.saveDecision(id,state,refs.explanation.value);
    if(saved!==true)throw new Error('The decision was not confirmed saved. This finding is still selected; keep your explanation and retry.');
    if(adapter?.key!==targetKey||selected()?.id!==id)return;
    if(state==='looks_correct'&&index<adapter.findings().length-1)await select(index+1);else refresh();
    notify(adapter.shared?'Decision submitted.':'Human decision saved.');
  }
  async function open(next){
    if(adapter?.key===next.key){adapter=next;refresh();return opening;}
    generation++;remember();adapter=next;positions=new Map();currentId=null;index=0;initializing=true;root.replaceChildren();root.hidden=false;document.body.classList.add('corrections-open');
    $('showRendered').textContent='After';$('renderedLabel').textContent=adapter.candidate?'After · returned rendering':'After unavailable · previous rendering shown';
    const navigation=element('div',null,'correction-navigation');navigationSize.disconnect();navigationSize.observe(navigation);
    navigation.append(element('strong','Check AI corrections'));
    refs.previous=button('Previous finding',next.ids.previous,()=>select(index-1));refs.next=button('Next finding',next.ids.next,()=>select(index+1));
    refs.picker=element('select');refs.picker.id=next.ids.picker??'correctionFinding';refs.picker.setAttribute('aria-label','Choose a reported finding');
    next.findings().forEach((f,i)=>refs.picker.add(new Option(`#${f.number} · ${next.state(f.id)}`,String(i))));refs.picker.onchange=guarded(()=>select(Number(refs.picker.value)));
    refs.progress=element('span');refs.progress.id='correctionProgress';navigation.append(refs.previous,refs.picker,refs.next,refs.progress);root.append(navigation);
    const copy=element('div',null,'correction-copy');
    for(const [key,label]of [['original','Original comment'],['ai','AI explanation']]){const section=element('div');section.append(element('strong',label));refs[key]=element('p');section.append(refs[key]);copy.append(section);}
    const explain=element('label','Your explanation');refs.explanation=element('textarea');refs.explanation.id=next.ids.explanation;refs.explanation.rows=2;refs.explanation.maxLength=4000;
    refs.explanation.oninput=()=>{const id=selected().id,value=refs.explanation.value;Promise.resolve(adapter.saveExplanation(id,value)).catch(e=>notify(`Explanation not saved: ${e.message}. Keep this page open.`,true));};explain.append(refs.explanation);copy.append(explain);root.append(copy);
    const actions=element('div',null,'correction-actions');
    refs.approve=button('Looks correct & next',next.ids.approve,()=>decide('looks_correct'));refs.approve.className='primary';
    refs.state=element('span');refs.state.id=next.ids.state;
    actions.append(refs.approve,button('Still needs correction',next.ids.reject,()=>decide('needs_correction')),button('Needs clarification',next.ids.clarify,()=>decide('needs_clarification')),button('Skip','skipCorrection',()=>select(index+1)),refs.state);root.append(actions);
    const viewing=element('div',null,'correction-viewing');refs.left=element('select');refs.left.id='comparisonLeft';refs.left.setAttribute('aria-label','Left comparison pane');refs.left.onchange=guarded(async()=>{const mode=refs.left.value;remember();await displayLeft(mode);});
    const otherLabel=element('label','Other historical marks');refs.others=element('input');refs.others.id='otherHistoricalMarks';refs.others.type='checkbox';refs.others.onchange=guarded(async()=>{remember();await displayLeft(left);});otherLabel.prepend(refs.others);
    refs.locate=button('Locate corrected passage','locateCorrectedPassage',async()=>{
      const f=selected(),location=bookmark(f.id,api.capture().review,api.viewPosition('rendered'));
      if(await adapter.saveLocation(f.id,location)!==true)throw new Error('Location save was not confirmed. Keep this page open and retry.');
      refs.alignment.textContent='Saved corresponding location · this exact After revision';notify('Location saved. No finding or approval created.');
    });
    refs.alignment=element('span');refs.alignment.id='correctionAlignment';viewing.append(refs.left,otherLabel,refs.locate,refs.alignment);root.append(viewing);
    refs.earlier=element('span');refs.earlier.id='correctionHistoryLabel';refs.contextDetails=element('details');refs.contextDetails.className='correction-context';refs.contextDetails.append(element('summary','Original marked context'));refs.context=element('div');refs.contextDetails.append(refs.context);root.append(refs.earlier,refs.contextDetails);
    refs.package=button('Save comparison package','saveComparisonPackage',async()=>{await adapter.exportPackage();notify('Comparison package saved.');});root.append(refs.package);
    refs.notice=element('div');refs.notice.id='correctionNotice';refs.notice.setAttribute('role','status');root.append(refs.notice);
    try{controls();opening=select(0);await opening;}finally{if(adapter?.key===next.key){opening=null;initializing=false;controls();}}
  }
  function close(){adapter=null;generation++;opening=null;initializing=false;currentId=null;root.hidden=true;for(const url of urls)URL.revokeObjectURL(url);urls=[];document.body.classList.remove('corrections-open');$('showSource').textContent='Source';$('showRendered').textContent='Rendered';$('sourceLabel').textContent='Original source';}
  document.addEventListener('score-desk-controls',controls);
  document.addEventListener('score-desk-change',()=>{if(adapter&&!adapter.matches(api.capture()))close();});
  return {open,refresh,close,selected:()=>index,select:guarded(select),state:()=>({key:adapter?.key,findingId:selected()?.id,left,pending})};
}

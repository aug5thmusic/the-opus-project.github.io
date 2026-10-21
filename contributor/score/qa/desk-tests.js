import {fixtureBlob} from './fixtures.js';
import {PALETTE,markerPosition} from '../model.js';
if(location.hostname!=='127.0.0.1'||['8939','8945'].includes(location.port))throw new Error('Use a disposable test origin.');
const frame=document.getElementById('app'),out=document.getElementById('results');frame.src='../index.html';
const $=id=>frame.contentDocument.getElementById(id),api=()=>frame.contentWindow.scoreDeskQA,scene=()=>api().completion.capture(),state=()=>api().sessionStatus();
const wait=async(fn,label)=>{const end=Date.now()+30000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Timeout: '+label+'; '+$('message')?.textContent);};
let count=0;const assert=(ok,label)=>{if(!ok)throw new Error(label);out.textContent+=`PASS ${++count} ${label}\n`;};
const fire=(id,type)=>$(id).dispatchEvent(new frame.contentWindow.Event(type,{bubbles:true}));
const key=(key,target=frame.contentDocument.body,extra={})=>target.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));
const edit=value=>{$('comment').value=value;fire('comment','input');};
async function bridge(){await wait(()=>frame.contentDocument?.body.dataset.ready==='true','app ready');const script=frame.contentDocument.createElement('script');script.type='module';script.src='./qa/bridge.js';frame.contentDocument.body.append(script);await wait(()=>api(),'bridge');}
async function choose(id,blob,name){const data=new frame.contentWindow.DataTransfer();data.items.add(new frame.contentWindow.File([blob],name));$(id).files=data.files;fire(id,'change');}
async function load(rotated=false){
  const source=await fixtureBlob('multipage.pdf');let render=source;
  if(rotated){const doc=await PDFLib.PDFDocument.load(await source.arrayBuffer()),page=doc.getPages()[0];page.setRotation(PDFLib.degrees(90));page.setCropBox(12,24,588,744);render=new Blob([await doc.save()]);}
  await choose('sourceFile',source,'source.pdf');await choose('renderedFile',new Blob([render,'\n% desk '+crypto.randomUUID()]),'render.pdf');await choose('lyFile',await fixtureBlob('score.ly'),'score.ly');$('load').click();await wait(()=>!state().busy&&$('message').textContent.includes('Snapshot ready'),'load');await api().saveNow();await ready();
}
const ready=()=>wait(()=>$('renderedPaper').getAttribute('aria-busy')==='false','render');
function pointer(type,x,y){const r=$('overlay').getBoundingClientRect();$('overlay').dispatchEvent(new frame.contentWindow.PointerEvent(type,{pointerId:1,isPrimary:true,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,bubbles:true,clientX:r.left+x,clientY:r.top+y}));}
async function stroke(x=70,y=90,cancel=false){await ready();pointer('pointerdown',x,y);pointer('pointermove',x+25,y+2);pointer(cancel?'pointercancel':'pointerup',x+25,y+2);}
async function done(next=true){$(next?'doneNext':'saveFinding').click();await wait(()=>!state().busy,'Done saved');}
async function zoom(value){$('renderedZoom').value=value;fire('renderedZoom','change');await ready();}
async function page(number,kind='rendered'){$(`${kind}Page`).value=number;fire(`${kind}Page`,'change');await wait(()=>$(`${kind}Paper`).getAttribute('aria-busy')==='false','page');}
async function viewport(){const p=await scene().doc.getPage(Number($('renderedPage').value));return p.getViewport({scale:parseFloat($('overlay').style.width)/p.getViewport({scale:1}).width});}
async function clickMark(f,marker=false){const vp=await viewport(),p=marker?markerPosition(vp,f):null;const [x,y]=p?[p.x,p.y]:vp.convertToViewportPoint(...f.strokes[0].points[0]);pointer('pointerdown',x,y);pointer('pointerup',x,y);}
const annotations=()=>JSON.stringify(scene().review);
const layout=()=>{const d=frame.contentDocument;return {width:frame.clientWidth,height:frame.clientHeight,scroll:d.scrollingElement.scrollHeight,docY:frame.contentWindow.scrollY};};
const reachable=id=>{const r=$(id).getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=frame.clientWidth+1&&r.bottom<=frame.clientHeight+1;};
document.getElementById('run').onclick=async()=>{
  out.textContent='';count=0;document.getElementById('run').disabled=true;
  try{
    await bridge();await load();$('autoColor').checked=true;fire('autoColor','change');await api().saveNow();
    const baseline=annotations(),history=state().undoLength;key('d');await stroke(70,90,true);
    assert(annotations()===baseline&&state().undoLength===history,'cancelled paint-first gesture creates no finding, history, number or color consumption');
    pointer('pointerdown',70,90);key('Escape');pointer('pointerup',90,90);
    assert(annotations()===baseline&&state().mode==='draw','first Escape cancels the gesture and leaves Draw ready');
    await stroke();let first=scene().review.findings[0];assert(first.strokes.length===1&&first.color===PALETTE[0].color,'completed stroke automatically creates the first finding');
    $('undo').click();assert(scene().review.findings.length===0&&scene().review.preferences.colorCursor===0,'one undo reverses automatic creation, stroke, number and color');
    $('redo').click();assert(scene().review.findings[0].id===first.id&&state().active===first.id,'redo restores identity and stroke destination together');
    await stroke(100,120);edit('First group — two strokes');await done();
    assert(scene().review.findings.length===1&&scene().review.findings[0].strokes.length===2&&state().active===null&&state().prepared&&state().mode==='draw','Done & next finishes multiple strokes and prepares without an empty record');
    await stroke(130,150,true);assert(scene().review.preferences.colorCursor===1,'cancelled next stroke does not advance color');
    for(let i=0;i<3;i++){await stroke(60+i*30,170+i*25);edit('Repeated group '+i);await done();}
    assert(scene().review.findings.length===4&&scene().review.findings.every((f,i)=>f.color===PALETTE[i].color),'repeated paint/comment/Done & next cycles preserve groups and color order');
    assert(scene().review.findings.every(f=>f.state==='open')&&scene().completions.length===0&&scene().review.coverage.startsWith('Not declared'),'Done actions do not resolve findings, approve corrections or declare coverage');
    const beforeNew=annotations();key('n');key('n');assert(annotations()===beforeNew,'repeated New preparation does not persist empty findings');
    edit('An unfinished comment without a stroke');await done();assert(state().active&&$('comment').value.includes('unfinished')&&$('message').textContent.includes('Paint at least'),'incomplete comment stays in its editor when Done cannot complete');
    $('deleteFinding').click();key('v');first=scene().review.findings[0];await clickMark(first);
    assert(state().active===first.id&&state().focused===null,'pan click selects a comment without isolating it');
    const second=scene().review.findings[1];$('findings').querySelectorAll('.focus-finding')[1].click();
    assert(state().focused===second.id&&state().active===first.id,'Only show filters another finding without changing the editor');
    $('showAll').click();key('d');await stroke(90,95);
    assert(state().active===first.id&&scene().review.findings[0].strokes.length===3,'Show all preserves the destination of the next stroke');
    $('findings').querySelector('.focus-finding').click();await done();
    assert(!state().active&&!state().focused&&state().mode==='draw','Done & next visibly leaves the old editing and isolation states');
    key('v');await clickMark(second,true);assert(state().active===second.id,'numbered marker selects its comment');
    const selected=state().active;await zoom('2');const vp=await viewport(),[px,py]=vp.convertToViewportPoint(...first.strokes[0].points[0]);
    pointer('pointerdown',px,py);pointer('pointermove',px-40,py-50);pointer('pointermove',px,py);pointer('pointerup',px,py);
    assert(state().active===selected,'a pan that returns to its start still never selects a finding');
    await clickMark(first);assert(state().active===first.id,'stroke hit testing works at 200% with scrolling');
    await zoom('0.75');await clickMark(second);assert(state().active===second.id,'stroke hit testing works at 75%');
    $('findings').querySelector('.focus-finding').click();await clickMark(second);assert(state().active===second.id,'hidden marks are not selectable');$('showAll').click();
    await page(2);const beforePage=state().active;pointer('pointerdown',px,py);pointer('pointerup',px,py);assert(state().active===beforePage,'marks from another page are not hit tested');await page(1);
    // All key routes share command guards; native text undo remains untouched.
    const savedState=state();for(const id of ['comment','sourcePage','highlightColor'])for(const k of ['n','d','v'])key(k,$(id));
    const editable=frame.contentDocument.createElement('div');editable.contentEditable='true';frame.contentDocument.body.append(editable);for(const k of ['n','d','v'])key(k,editable);editable.remove();
    assert(state().active===savedState.active&&state().mode===savedState.mode,'letter shortcuts ignore inputs, textareas, selects and contenteditable');
    for(const extra of [{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])key('n',frame.contentDocument.body,extra);
    fire('comment','compositionstart');key('Escape');key('n');fire('comment','compositionend');
    assert(state().active===savedState.active&&state().mode===savedState.mode,'composition and modified letters do not mutate review state');
    const undoCount=state().undoLength;key('z',$('comment'),{ctrlKey:true});assert(state().undoLength===undoCount,'text editor keeps native undo');
    $('shortcutHelp').click();key('n');key('Escape');assert(state().active===savedState.active&&$('shortcutsDialog').open,'dialog Escape is left to the dialog and shortcuts cannot edit behind it');$('shortcutsDialog').close();
    edit('Shortcut completes this exact group');key('Enter',$('comment'),{ctrlKey:true});await wait(()=>!state().busy,'shortcut completion');assert(!state().active&&state().prepared,'Ctrl+Enter in comment uses Done & next');
    key('d');await stroke(110,210);edit('Save failure must keep this comment');
    const put=api().operations.putSaved;api().operations.putSaved=async()=>{throw new Error('Injected Done save failure');};await done();
    assert(state().active&&state().dirty&&!$('emergency').hidden&&$('comment').value.includes('Save failure'),'failed Done keeps active comment and recovery available');
    api().operations.putSaved=put;await done();assert(!state().active&&!state().dirty,'Done can retry after storage recovers');
    key('d');await stroke(140,235);edit('Delayed save');let release,started=false;const gate=new Promise(r=>release=r);api().operations.putSaved=async(...args)=>{started=true;await gate;return put(...args);};
    $('doneNext').click();await wait(()=>started,'delayed save');const locked=annotations();for(const k of ['n','d','v','Escape'])key(k);$('newFinding').dispatchEvent(new frame.contentWindow.MouseEvent('click'));edit('blocked edit');
    assert(state().busy&&annotations()===locked,'busy completion blocks shortcuts and forced edit handlers');release();await wait(()=>!state().busy,'unlock');api().operations.putSaved=put;
    // Separate source/render positions, viewport-bounded desktop and narrow controls.
    await zoom('2');$('sourceZoom').value='2';fire('sourceZoom','change');await page(2,'source');$('renderedScroll').scrollTo(30,220);$('sourceScroll').scrollTo(40,170);
    key('n');await stroke(150,250);edit('No scroll jump');const scroll=[$('sourceScroll').scrollTop,$('renderedScroll').scrollTop];await done();
    assert($('sourceScroll').scrollTop===scroll[0]&&$('renderedScroll').scrollTop===scroll[1]&&$('sourcePage').value==='2'&&$('renderedPage').value==='1','starting and finishing preserve independent page and scroll positions');
    for(const [width,height]of [[1280,800],[724,420],[600,420],[444,420]]){
      frame.style.width=width+'px';frame.style.height=height+'px';await new Promise(r=>setTimeout(r,250));await ready();
      assert(layout().scroll<=height+1&&layout().docY===0,'no document scrolling at '+width+' × '+height);
      assert(['sourceViewer','renderedViewer','newFinding','draw','navigate','undo','redo','brush','highlightColor','autoColor','finishReview','showAll'].filter(id=>id!=='showAll'||!$('showAll').hidden).every(reachable),'scores remain side by side and review controls reachable at '+width+' × '+height);
      assert(reachable('comment')&&reachable('saveFinding')&&reachable('doneNext')&&!$('comment').closest('[inert]'),'comment editor and completion stay automatically reachable without opening a drawer at '+width+' × '+height);
      const sourceHead=$('sourceViewer').querySelector('.viewer-head').getBoundingClientRect(),renderHead=$('renderedViewer').querySelector('.viewer-head').getBoundingClientRect();
      assert(Math.abs(sourceHead.top-renderHead.top)<1&&Math.abs(sourceHead.height-renderHead.height)<1,'source and render navigation stay aligned at '+width+' × '+height);
      assert(Math.abs($('sourcePage').getBoundingClientRect().top-$('renderedPage').getBoundingClientRect().top)<1&&Math.abs($('sourceZoom').getBoundingClientRect().top-$('renderedZoom').getBoundingClientRect().top)<1,'page arrows and zoom rows align at '+width+' × '+height);
      if(width===724){$('toggleComments').click();assert(reachable('commentsPanel'),'comments drawer stays within narrow workspace');$('closeComments').click();$('showSource').click();$('showRendered').click();$('showBoth').click();assert($('sourcePage').value==='2'&&$('renderedPage').value==='1'&&$('sourceScroll').scrollTop===scroll[0]&&$('renderedScroll').scrollTop===scroll[1],'source/render/both switches preserve independent positions');}
    }
    frame.style.width='1280px';frame.style.height='800px';await load(true);key('d');await stroke(120,140);edit('Rotated crop');await done(false);first=scene().review.findings[0];
    for(const scale of ['0.75','2']){await zoom(scale);key('Escape');await clickMark(first);assert(state().active===first.id,'rotated/cropped stroke selects at zoom '+scale);key('Escape');await clickMark(first,true);assert(state().active===first.id,'rotated/cropped numbered marker selects at zoom '+scale);}
    await done();key('d');await stroke(120,140);edit('Overlapping top mark');await done(false);const top=scene().review.findings.at(-1);await clickMark(top);assert(state().active===top.id,'last-painted overlapping mark wins deterministically');
    edit('Conflicting Done');api().operations.putSaved=async()=>{const e=new Error('Injected newer-tab conflict');e.name='StorageConflictError';throw e;};await done();
    assert(state().saveConflict&&state().active===top.id&&$('comment').value==='Conflicting Done'&&!$('emergency').hidden,'conflicted Done keeps local editing state and cannot claim success');api().operations.putSaved=put;
    let backup;api().operations.download=async blob=>backup=blob;$('emergency').click();await wait(()=>backup,'recovery');assert(backup.size>0,'recovery export remains available after completion conflict');
    out.textContent+=`\nALL ${count} DESK CHECKS PASSED.\n`;
  }catch(e){out.textContent+='FAIL '+e.stack;out.className='fail';console.error(e);}finally{document.getElementById('run').disabled=false;}
};

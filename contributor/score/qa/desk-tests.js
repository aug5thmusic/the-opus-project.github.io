import {fixtureBlob} from './fixtures.js';
import {PALETTE,markerPosition} from '../model.js';
if(location.hostname!=='127.0.0.1'||['8939','8945','8964','8967'].includes(location.port))throw new Error('Use a disposable test origin.');
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
    await bridge();await load();await wait(()=>$('message').hidden,'routine announcement expires');assert($('storage').closest('header')&&$('storage').textContent==='Saved locally'&&$('focusBar').hidden,'saved status stays in the header with a stable status slot and no inactive isolation row');assert($('navigate').textContent==='Navigate'&&$('navigate').querySelector('u').textContent==='v'&&$('draw').querySelector('u').textContent==='D'&&$('newFinding').querySelector('u').textContent==='N'&&!frame.contentDocument.querySelector('[accesskey]'),'visible shortcut underlines preserve natural button labels without accesskeys');assert(/^(Ctrl|Cmd)\+Enter$/.test($('doneNext').querySelector('kbd').textContent),'Done & next displays its actual platform shortcut');$('autoColor').checked=true;fire('autoColor','change');await api().saveNow();
    const baseline=annotations(),history=state().undoLength;key('d');$('draw').focus();const beforeCancel=frame.contentDocument.activeElement;await stroke(70,90,true);assert(frame.contentDocument.activeElement===beforeCancel&&$('commentDock').hidden,'cancelled first stroke neither opens the editor nor steals focus');
    assert(annotations()===baseline&&state().undoLength===history,'cancelled paint-first gesture creates no finding, history, number or color consumption');
    pointer('pointerdown',70,90);key('Escape');pointer('pointerup',90,90);
    assert(annotations()===baseline&&state().mode==='draw','first Escape cancels the gesture and leaves Draw ready');
    await stroke();assert(frame.contentDocument.activeElement===$('comment')&&$('comment').selectionStart===$('comment').selectionEnd,'first completed ordinary stroke focuses the textarea with a caret');edit('Typed immediately');assert(scene().review.findings[0].comment==='Typed immediately','immediate typing after the stroke belongs to the new finding');$('undo').click();let first=scene().review.findings[0];assert(first.strokes.length===1&&first.color===PALETTE[0].color,'completed stroke automatically creates the first finding');
    $('undo').click();assert(scene().review.findings.length===0&&scene().review.preferences.colorCursor===0,'one undo reverses automatic creation, stroke, number and color');
    $('redo').click();assert(scene().review.findings[0].id===first.id&&state().active===first.id,'redo restores identity and stroke destination together');
    $('brush').focus();await stroke(100,120);assert(frame.contentDocument.activeElement===$('brush'),'additional strokes do not steal focus again');edit('First group — two strokes');await done();
    assert(scene().review.findings.length===1&&scene().review.findings[0].strokes.length===2&&state().active===null&&state().prepared&&state().mode==='draw','Done & next finishes multiple strokes and prepares without an empty record');
    await stroke(130,150,true);assert(scene().review.preferences.colorCursor===1,'cancelled next stroke does not advance color');
    for(let i=0;i<3;i++){await stroke(60+i*30,170+i*25);edit('Repeated group '+i);await done();}
    assert(frame.contentDocument.activeElement===$('overlay'),'Done & next returns focus to the score for the next gesture');assert(scene().review.findings.length===4&&scene().review.findings.every((f,i)=>f.color===PALETTE[i].color),'repeated paint/comment/Done & next cycles preserve groups and color order');
    assert(scene().review.findings.every(f=>f.state==='open')&&scene().completions.length===0&&scene().review.coverage.startsWith('Not declared'),'Done actions do not resolve findings, approve corrections or declare coverage');
    const beforeNew=annotations();key('n');key('n');assert(annotations()===beforeNew,'repeated New preparation does not persist empty findings');
    assert(frame.contentDocument.activeElement===$('comment'),'New finding puts the caret in the editor before any mark');
    edit('  \n ');await done();assert(annotations()===beforeNew&&state().prepared,'whitespace-only preparation consumes no ID, number, color or persisted finding');
    const exactNote='  Text-only correction E♭ 𝄞\nKeep this spacing.  ';edit(exactNote);const note=structuredClone(scene().review.findings.at(-1));
    await done(false);assert(!state().active&&scene().review.findings.at(-1).comment===exactNote&&!note.strokes.length&&note.bounds===null,'Done accepts exact text-only content without fabricating geometry');
    $('findings').querySelector(`[data-finding-id="${note.id}"] .finding-open`).click();assert(state().active===note.id&&$('comment').value===exactNote&&$('findings').textContent.includes('text-only'),'text-only notes remain selectable and editable with page context');
    key('d');await stroke(100,180);assert(scene().review.findings.at(-1).id===note.id&&scene().review.findings.at(-1).comment===exactNote&&scene().review.findings.at(-1).strokes.length===1,'later marks keep the same text-only finding ID, number and comment');
    $('undo').click();assert(scene().review.findings.at(-1).id===note.id&&!scene().review.findings.at(-1).strokes.length,'Undo restores the text-only note without losing its identity');$('redo').click();$('undo').click();
    key('Enter',$('comment'),{ctrlKey:true});await wait(()=>!state().busy,'text-only shortcut');assert(!state().active&&state().prepared&&frame.contentDocument.activeElement===$('comment'),'Ctrl+Enter accepts text-only content and leaves the caret ready for the next note');
    edit('Second text-only note');await done();assert(!state().active&&state().prepared,'Done & next accepts text-only content');
    key('v');first=scene().review.findings[0];await clickMark(first);
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
    $('shortcutHelp').click();key('n');key('Escape');assert(state().active===savedState.active&&$('shortcutsDialog').open,'dialog Escape is left to the dialog and shortcuts cannot edit behind it');const closeBox=$('closeShortcuts').getBoundingClientRect(),closeIcon=$('closeShortcuts').querySelector('svg').getBoundingClientRect();$('closeShortcuts').focus();assert(Math.abs(closeBox.x+closeBox.width/2-closeIcon.x-closeIcon.width/2)<.5&&Math.abs(closeBox.y+closeBox.height/2-closeIcon.y-closeIcon.height/2)<.5&&closeBox.width===closeBox.height,'focused dialog close icon is centered in a square hit area');$('shortcutsDialog').close();
    edit('Shortcut completes this exact group');key('Enter',$('comment'),{ctrlKey:true});await wait(()=>!state().busy,'shortcut completion');assert(!state().active&&state().prepared,'Ctrl+Enter in comment uses Done & next');
    $('newFinding').click();edit('Save failure must keep this comment');
    const put=api().operations.putSaved;api().operations.putSaved=async()=>{throw new Error('Injected Done save failure');};await done();
    await new Promise(r=>setTimeout(r,3800));assert(!$('notices').hidden&&$('storage').textContent==='NOT SAVED'&&!$('message').hidden&&$('message').scrollWidth<=$('message').clientWidth+1,'saving failures stay visible and wrap after routine notices would expire');assert(state().active&&state().dirty&&!$('emergency').hidden&&$('comment').value.includes('Save failure'),'failed Done keeps active comment and recovery available');
    const recover=api().operations.makeRecovery,noticeHeight=$('notices').getBoundingClientRect().height;let recoveryCalls=0;api().operations.makeRecovery=async()=>{recoveryCalls++;throw new Error('Injected separate recovery failure');};$('emergency').click();await wait(()=>$('message').textContent.includes('separate recovery failure'),'recovery failure notice');assert(!$('storageProblem').hidden&&$('storageProblem').getBoundingClientRect().top>=$('message').getBoundingClientRect().bottom-1&&$('notices').getBoundingClientRect().height===noticeHeight,'simultaneous storage and recovery errors stack readably inside the stable slot');
    // Test the painted hit targets, not element.click() on a possibly covered button.
    const hitAt=(id,x=.5,y=.5)=>{const r=$(id).getBoundingClientRect();return frame.contentDocument.elementFromPoint(r.x+r.width*x,r.y+r.height*y);};
    const clickAt=(id,x=.5)=>hitAt(id,x).dispatchEvent(new frame.contentWindow.MouseEvent('click',{bubbles:true,cancelable:true}));
    for(const [width,height]of [[1280,800],[724,420],[600,420],[533,420],[444,420]]){
      frame.style.width=width+'px';frame.style.height=height+'px';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const geometry=()=>JSON.stringify(['newFinding','draw','sourceScroll','renderedScroll','comment','doneNext','emergency'].map(id=>{const r=$(id).getBoundingClientRect();return [r.x,r.y,r.width,r.height];})),before=geometry(),recoveryBox=$('emergency').getBoundingClientRect(),dismissBox=$('dismissMessage').getBoundingClientRect();
      assert(reachable('emergency')&&reachable('dismissMessage')&&recoveryBox.right+4<=dismissBox.left&&['emergency','dismissMessage'].every(id=>[[.05,.5],[.5,.5],[.95,.5],[.5,.1],[.5,.9]].every(([x,y])=>hitAt(id,x,y)?.closest('button')===$(id))),'recovery and dismiss have separate visible bounds and unobscured hit targets at '+width);
      const attempts=recoveryCalls;clickAt('emergency',.05);await wait(()=>recoveryCalls===attempts+1&&!$('emergency').disabled,'recovery hit target');assert(!$('message').hidden&&$('message').textContent.includes('separate recovery failure')&&!$('storageProblem').hidden&&!$('dismissMessage').hidden&&geometry()===before,'recovery hit invokes recovery without dismissing either error or moving controls at '+width);
      clickAt('dismissMessage');assert(recoveryCalls===attempts+1&&$('message').hidden&&!$('storageProblem').hidden&&$('storageProblem').textContent.includes('Done save failure')&&!$('emergency').hidden&&geometry()===before&&$('notices').getBoundingClientRect().height===noticeHeight,'dismiss hit leaves storage error and recovery available without invoking recovery or moving controls at '+width);
      clickAt('emergency');await wait(()=>recoveryCalls===attempts+2&&!$('emergency').disabled&&!$('message').hidden,'recovery remains reachable after dismissal');
    }
    frame.style.width='1280px';frame.style.height='800px';api().operations.makeRecovery=recover;
    api().operations.putSaved=put;await done();assert(!state().active&&!state().dirty,'Done can retry after storage recovers');
    key('d');await stroke(140,235);edit('Delayed save');let release,started=false;const gate=new Promise(r=>release=r);api().operations.putSaved=async(...args)=>{started=true;await gate;return put(...args);};
    $('doneNext').click();await wait(()=>started,'delayed save');const locked=annotations();for(const k of ['n','d','v','Escape'])key(k);$('newFinding').dispatchEvent(new frame.contentWindow.MouseEvent('click'));edit('blocked edit');
    assert(state().busy&&annotations()===locked,'busy completion blocks shortcuts and forced edit handlers');release();await wait(()=>!state().busy,'unlock');api().operations.putSaved=put;
    // Separate source/render positions, viewport-bounded desktop and narrow controls.
    await zoom('2');$('sourceZoom').value='2';fire('sourceZoom','change');await page(2,'source');$('renderedScroll').scrollTo(30,220);$('sourceScroll').scrollTo(40,170);
    key('n');const beforeMark=[$('sourceScroll').scrollLeft,$('sourceScroll').scrollTop,$('renderedScroll').scrollLeft,$('renderedScroll').scrollTop,$('sourceZoom').value,$('renderedZoom').value,frame.contentWindow.scrollY];await stroke(150,250);assert(frame.contentDocument.activeElement===$('comment')&&JSON.stringify(beforeMark)===JSON.stringify([$('sourceScroll').scrollLeft,$('sourceScroll').scrollTop,$('renderedScroll').scrollLeft,$('renderedScroll').scrollTop,$('sourceZoom').value,$('renderedZoom').value,frame.contentWindow.scrollY]),'first-stroke caret preserves both PDF scroll positions, zoom and document position');edit('No scroll jump');const scroll=[$('sourceScroll').scrollTop,$('renderedScroll').scrollTop];await done();
    assert($('sourceScroll').scrollTop===scroll[0]&&$('renderedScroll').scrollTop===scroll[1]&&$('sourcePage').value==='2'&&$('renderedPage').value==='1','starting and finishing preserve independent page and scroll positions');
    await wait(()=>$('message').hidden,'completion confirmation expires');for(const [width,height]of [[1280,800],[724,420],[600,420],[533,420],[444,420]]){
      frame.style.width=width+'px';frame.style.height=height+'px';await new Promise(r=>setTimeout(r,250));await ready();
      assert(layout().scroll<=height+1&&layout().docY===0,'no document scrolling at '+width+' × '+height);
      assert(['sourceViewer','renderedViewer','newFinding','draw','navigate','undo','redo','brush','highlightColor','autoColor','finishReview','exportTask','showAll'].filter(id=>id!=='showAll'||!$('showAll').hidden).every(reachable),'scores remain side by side and review controls reachable at '+width+' × '+height);
      assert(reachable('comment')&&reachable('saveFinding')&&reachable('doneNext')&&!$('comment').closest('[inert]'),'comment editor and completion stay automatically reachable without opening a drawer at '+width+' × '+height);
      const sourceHead=$('sourceViewer').querySelector('.viewer-head').getBoundingClientRect(),renderHead=$('renderedViewer').querySelector('.viewer-head').getBoundingClientRect();
      assert(Math.abs(sourceHead.top-renderHead.top)<1&&Math.abs(sourceHead.height-renderHead.height)<1,'source and render navigation stay aligned at '+width+' × '+height);
      assert(Math.abs($('sourcePage').getBoundingClientRect().top-$('renderedPage').getBoundingClientRect().top)<1&&Math.abs($('sourceZoom').getBoundingClientRect().top-$('renderedZoom').getBoundingClientRect().top)<1,'page arrows and zoom rows align at '+width+' × '+height);
      if([1280,724,533].includes(width)){
        const geometry=()=>JSON.stringify(['newFinding','draw','sourcePage','renderedPage','sourceScroll','renderedScroll','comment','doneNext'].map(id=>{const r=$(id).getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
        $('newFinding').click();$('dismissMessage').click();const empty=geometry();$('newFinding').click();assert(geometry()===empty,'routine notice appearance preserves controls and PDF viewport at '+width);
        await wait(()=>$('message').hidden,'3500 ms notice expiry');assert(geometry()===empty,'notice expiry preserves controls, PDF viewport and click targets at '+width);
        $('newFinding').click();$('dismissMessage').click();assert(geometry()===empty,'notice dismissal preserves control positions at '+width);
        edit('Status geometry note');await api().saveNow();const savedGeometry=geometry();let saveRelease,saveStarted=false;const pending=new Promise(r=>saveRelease=r);api().operations.putSaved=async(...args)=>{saveStarted=true;await pending;return put(...args);};edit('Status geometry note updated');const saving=api().saveNow();await wait(()=>saveStarted,'held saving transition');assert($('storage').textContent==='Saving…'&&geometry()===savedGeometry,'saving status preserves geometry at '+width);saveRelease();await saving;api().operations.putSaved=put;assert($('storage').textContent==='Saved locally'&&geometry()===savedGeometry,'saved status preserves geometry at '+width);await done();
      }
      if(width===724||width===533)assert($('renderedScroll').clientHeight>=(width===724?100:60),'compact chrome provides useful score height with editor at '+width+' pixels ('+$('renderedScroll').clientHeight+' px)');if(width===724){$('toggleComments').click();assert(reachable('commentsPanel'),'comments drawer stays within narrow workspace');$('closeComments').click();$('showSource').click();$('showRendered').click();$('showBoth').click();assert($('sourcePage').value==='2'&&$('renderedPage').value==='1'&&$('sourceScroll').scrollTop===scroll[0]&&$('renderedScroll').scrollTop===scroll[1],'source/render/both switches preserve independent positions');}
    }
    frame.style.width='533px';frame.style.height='420px';await new Promise(r=>setTimeout(r,250));key('d');await stroke(110,210);edit('Narrow saving error');api().operations.putSaved=async()=>{throw new Error('Storage is full. Download recovery before closing this tab.');};await done();assert(reachable('comment')&&reachable('doneNext')&&reachable('emergency')&&!$('notices').hidden&&$('message').scrollWidth<=$('message').clientWidth+1,'narrow saving error wraps while recovery and the editor remain reachable');api().operations.putSaved=put;await done();frame.style.width='1280px';frame.style.height='800px';await load(true);key('d');await stroke(120,140);edit('Rotated crop');await done(false);first=scene().review.findings[0];
    for(const scale of ['0.75','2']){await zoom(scale);key('Escape');await clickMark(first);assert(state().active===first.id,'rotated/cropped stroke selects at zoom '+scale);key('Escape');await clickMark(first,true);assert(state().active===first.id,'rotated/cropped numbered marker selects at zoom '+scale);}
    await done();key('d');await stroke(120,140);edit('Overlapping top mark');await done(false);const top=scene().review.findings.at(-1);await clickMark(top);assert(state().active===top.id,'last-painted overlapping mark wins deterministically');
    $('newFinding').click();edit('Conflicting Done');const conflicting=scene().review.findings.at(-1);api().operations.putSaved=async()=>{const e=new Error('Injected newer-tab conflict');e.name='StorageConflictError';throw e;};await done();
    assert(state().saveConflict&&state().active===conflicting.id&&$('comment').value==='Conflicting Done'&&!$('emergency').hidden,'conflicted Done keeps local editing state and cannot claim success');api().operations.putSaved=put;
    let backup;api().operations.download=async blob=>backup=blob;$('emergency').click();await wait(()=>backup,'recovery');assert(backup.size>0,'recovery export remains available after completion conflict');
    out.textContent+=`\nALL ${count} DESK CHECKS PASSED.\n`;
  }catch(e){out.textContent+='FAIL '+e.stack;out.className='fail';console.error(e);}finally{document.getElementById('run').disabled=false;}
};

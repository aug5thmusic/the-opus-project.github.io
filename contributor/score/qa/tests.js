import {fixtureBlob} from './fixtures.js';
import {getSaved} from '../storage.js';
import {sha256,validateReview,clone,bounds,PALETTE,VERSION} from '../model.js';
import * as pdfjs from '../vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='../vendor/pdf.worker.mjs';
const frame=document.getElementById('app'),out=document.getElementById('results');
if(['8939','8945','8964','8967'].includes(location.port)||location.hostname!=='127.0.0.1'){out.textContent='QA refused: use an isolated loopback port, never 8939, 8945, 8964 or 8967.';document.getElementById('run').disabled=true;throw new Error(out.textContent);}
frame.src='../index.html';
const log=s=>{out.textContent+=s+'\n';};
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const assert=(condition,label)=>{if(!condition)throw new Error(label);log('PASS '+label);};
const wait=async(fn,label)=>{const until=Date.now()+20000;while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,70));}throw new Error('Timeout: '+label);};
const $=id=>frame.contentDocument.getElementById(id);
const event=(id,type)=>$(id).dispatchEvent(new frame.contentWindow.Event(type,{bubbles:true}));
async function markAligned(record,doc,label){await wait(()=>$('renderedPaper').getAttribute('aria-busy')==='false','visible page paint');const page=await doc.getPage(1),base=page.getViewport({scale:1}),canvas=$('overlay'),vp=page.getViewport({scale:parseFloat(canvas.style.width)/base.width}),point=record.review.findings[0].strokes[0].points[0];const [x,y]=vp.convertToViewportPoint(...point),dpr=canvas.width/vp.width;assert(canvas.getContext('2d').getImageData(Math.round(x*dpr),Math.round(y*dpr),1,1).data[3]>0,label);}
async function choose(id,blob,name){const dt=new frame.contentWindow.DataTransfer();dt.items.add(new frame.contentWindow.File([blob],name));$(id).files=dt.files;event(id,'change');}
async function saved(){const hash=$('identity').textContent.match(/SHA-256 ([a-f0-9]{64})/g);if(!hash)return null;const id=await sha256(new TextEncoder().encode(['source','rendered','ly'].map((r,i)=>r+':'+hash[i].slice(8)).join('\n')));return getSaved(id);}
async function settle(){await wait(()=>!$('storage').textContent.startsWith('Saving')&&$('storage').textContent.startsWith('Saved locally'),'durable save');return saved();}
function input(id,value){$(id).value=value;event(id,'input');}
async function stroke(x,y,dx=25,cancel=false){await wait(()=>$('renderedPaper').getAttribute('aria-busy')==='false','page ready for pointer input');const c=$('overlay'),r=c.getBoundingClientRect(),w=frame.contentWindow;const send=(type,px,py)=>c.dispatchEvent(new w.PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+px,clientY:r.top+py}));send('pointerdown',x,y);send('pointermove',x+dx,y+2);send(cancel?'pointercancel':'pointerup',x+dx,y+2);}
async function alphaAt(finding,doc){await wait(()=>$('renderedPaper').getAttribute('aria-busy')==='false','focus page ready');const p=await doc.getPage(1),base=p.getViewport({scale:1}),c=$('overlay'),v=p.getViewport({scale:parseFloat(c.style.width)/base.width}),[x,y]=v.convertToViewportPoint(...finding.strokes[0].points[0]),dpr=c.width/v.width;return c.getContext('2d').getImageData(Math.round(x*dpr),Math.round(y*dpr),1,1).data[3];}
document.getElementById('run').onclick=async()=>{
  out.textContent='';document.getElementById('run').disabled=true;
  try{
    if(['8939','8945','8964','8967'].includes(location.port)||location.hostname!=='127.0.0.1')throw new Error('Run QA on a separate loopback port, never the user app on 8939.');
    await wait(()=>frame.contentDocument.body.dataset.ready==='true','app ready after any restore');
    const [source,render,ly]=await Promise.all(['source.pdf','multipage.pdf','score.ly'].map(async name=>fixtureBlob(name)));
    // An inert PDF comment makes test bytes distinct; PDF readers ignore trailing comments.
    const uniqueRender=new Blob([render,'\n% Score Desk QA '+Date.now()+'\n'],{type:'application/pdf'});
    const geometryDoc=await pdfjs.getDocument({data:new Uint8Array(await uniqueRender.arrayBuffer()),isEvalSupported:false}).promise;
    await choose('sourceFile',source,'qa-source.pdf');await choose('renderedFile',uniqueRender,'qa-rendered.pdf');await choose('lyFile',ly,'qa-score.ly');$('load').click();
    await wait(()=>$('message').textContent.includes('Snapshot ready'),'load exact local bytes');await settle();
    assert($('sourceCount').textContent==='/ 1'&&$('renderedCount').textContent==='/ 4','independent 1-page source and 4-page render loaded');
    $('newFinding').click();input('comment','should be E♭ — compare ♯ and 𝄞');await stroke(90,110);await stroke(130,116);
    let record=await settle();assert(record.review.findings.length===1&&record.review.findings[0].strokes.length===2,'two brush strokes share one comment');
    const first=clone(record.review.findings[0]);await stroke(160,120,30,true);record=await settle();assert(record.review.findings[0].strokes.length===2,'cancelled gesture leaves no phantom stroke');
    $('saveFinding').click();await wait(()=>!$('comment').disabled,'finding completion');$('newFinding').click();input('comment','beam together');await stroke(175,160);$('saveFinding').click();await wait(()=>!$('comment').disabled,'finding completion');record=await settle();assert(record.review.findings.length===2&&record.review.findings[1].strokes.length===1,'separate pitch and beam findings');
    frame.contentDocument.querySelector('.finding').click();await wait(()=>$('comment').value===first.comment,'select finding for color');
    $('highlightColor').value=PALETTE[2].color;event('highlightColor','change');record=await settle();
    assert(record.review.findings[0].strokes.every(s=>s.color===PALETTE[2].color)&&record.review.findings[1].color===PALETTE[0].color,'changing a finding color recolors all its strokes only');
    $('undo').click();record=await settle();assert(record.review.findings[0].color===PALETTE[0].color,'undo color change');$('redo').click();record=await settle();assert(record.review.findings[0].color===PALETTE[2].color,'redo color change');
    const beforeVisibility=canonical(record.review.findings);$('hide').checked=true;event('hide','change');
    assert(await alphaAt(record.review.findings[0],geometryDoc)===0&&await alphaAt(record.review.findings[1],geometryDoc)===0,'global visibility hides every finding');
    $('hide').checked=false;event('hide','change');assert(await alphaAt(record.review.findings[0],geometryDoc)>0&&await alphaAt(record.review.findings[1],geometryDoc)>0&&canonical((await saved()).review.findings)===beforeVisibility,'showing marks restores every finding without changing annotations');
    $('autoColor').checked=true;event('autoColor','change');$('newFinding').click();input('comment','automatic color example');await stroke(90,210);$('saveFinding').click();await wait(()=>!$('comment').disabled,'finding completion');$('newFinding').click();input('comment','next automatic color');await stroke(130,215);$('saveFinding').click();await wait(()=>!$('comment').disabled,'finding completion');record=await settle();
    assert(record.review.findings[2].color===PALETTE[3].color&&record.review.findings[3].color===PALETTE[4].color,'each new finding advances through the allowed palette');
    for(let i=0;i<2;i++){frame.contentDocument.querySelectorAll('.finding')[2].click();$('deleteFinding').click();await settle();}
    $('autoColor').checked=false;event('autoColor','change');$('highlightColor').value=PALETTE[1].color;event('highlightColor','change');$('newFinding').click();input('comment','manual color example');await stroke(90,210);record=await settle();assert(record.review.findings[2].color===PALETTE[1].color,'manual default color used with cycling disabled');$('deleteFinding').click();await settle();$('autoColor').checked=true;event('autoColor','change');await settle();
    frame.contentDocument.querySelectorAll('.finding')[0].click();await wait(()=>$('comment').value===first.comment,'select first comment');input('comment','should be E♭ — edited; ♯ and 𝄞');$('saveFinding').click();await wait(()=>!$('comment').disabled,'finding completion');record=await settle();
    const stable=canonical(record.review.findings.map(f=>f.strokes));
    $('renderedZoom').value='2';event('renderedZoom','change');await wait(()=>$('renderedCanvas').style.width.replace('px','')>1000,'200% render');
    await markAligned(record,geometryDoc,'mark stays on expected PDF point at 200%');
    $('renderedZoom').value='0.75';event('renderedZoom','change');await new Promise(r=>setTimeout(r,500));record=await saved();assert(canonical(record.review.findings.map(f=>f.strokes))===stable,'zoom leaves PDF coordinates and widths unchanged');
    await markAligned(record,geometryDoc,'mark stays on expected PDF point at 75%');
    $('hide').checked=true;event('hide','change');const pixels=$('overlay').getContext('2d').getImageData(0,0,$('overlay').width,$('overlay').height).data;assert(!pixels.some((v,i)=>i%4===3&&v),'hide marks clears overlay');$('hide').checked=false;event('hide','change');
    frame.contentDocument.querySelectorAll('.finding')[1].click();await new Promise(r=>setTimeout(r,100));$('deleteFinding').click();await settle();$('undo').click();record=await settle();assert(record.review.findings.length===2&&record.review.findings[0].comment.includes('edited'),'undo deletion preserves neighboring comment');$('redo').click();record=await settle();assert(record.review.findings.length===1,'redo deletion');$('undo').click();await settle();
    $('renderedPage').value='3';event('renderedPage','change');await new Promise(r=>setTimeout(r,300));assert($('sourcePage').value==='1'&&$('renderedPage').value==='3','page navigation does not align unrelated PDFs');
    $('renderedPage').value='1';event('renderedPage','change');$('renderedZoom').value='fit';event('renderedZoom','change');await settle();
    record=await saved();const beforeReload=canonical(record.review.findings);frame.contentWindow.location.reload();await wait(()=>$('message')?.textContent.includes('Restored last saved snapshot'),'reload restoration');record=await settle();assert(canonical(record.review.findings)===beforeReload,'reload restores exact comments and strokes');
    assert(record.review.preferences.autoColor&&$('autoColor').checked&&record.review.findings[0].color===PALETTE[2].color,'colors and automatic cycling preference survive reload');
    await markAligned(record,geometryDoc,'restored marks align after reload');
    frame.style.width='650px';await new Promise(r=>setTimeout(r,400));await markAligned(record,geometryDoc,'marks align after panel resize');frame.style.width='100%';await new Promise(r=>setTimeout(r,400));
    for(const r of ['source','rendered','ly'])assert(await sha256(await record.files[r].blob.arrayBuffer())===record.review.files[r].sha256,'restored exact '+r+' bytes');
    const matching=JSON.stringify(record.review);await choose('import',new Blob([matching]),'annotations.json');await wait(()=>$('message').textContent.includes('Imported matching'),'JSON round-trip');assert((await settle()).review.findings.length===2,'matching JSON round-trip');
    const bad=clone(record.review);bad.snapshotId='0'.repeat(64);await choose('import',new Blob([JSON.stringify(bad)]),'wrong-review.json');await wait(()=>$('message').textContent.includes('snapshot mismatch'),'mismatched import rejection');assert(canonical((await saved()).review.findings)===beforeReload,'mismatched JSON rejected without changing marks');
    const malformed=clone(record.review);malformed.findings[0].strokes[0].points[0]=[Infinity,1];let rejected=false;try{validateReview(malformed,record.review);}catch{rejected=true;}assert(rejected,'non-finite/out-of-bounds geometry rejected');
    const invalidColor=clone(record.review);invalidColor.findings[0].color='#000000';rejected=false;try{validateReview(invalidColor,record.review);}catch{rejected=true;}assert(rejected,'colors outside the readable palette are rejected');
    const legacy=clone(record.review);legacy.version=1;delete legacy.preferences;for(const f of legacy.findings){delete f.color;for(const s of f.strokes)s.color=PALETTE[0].color;}const migrated=validateReview(legacy,record.review);assert(migrated.version===VERSION&&migrated.findings.every(f=>f.color===PALETTE[0].color),'version 1 reviews migrate without losing geometry or comments');
    // Force a real IndexedDB put failure, then exercise the existing recovery affordance.
    const proto=frame.contentWindow.IDBObjectStore.prototype,put=proto.put;proto.put=function(){throw new frame.contentWindow.DOMException('Simulated quota exhaustion','QuotaExceededError');};
    $('newFinding').click();input('comment','temporary quota test');await wait(()=>$('storage').textContent.includes('NOT SAVED'),'storage failure UI');assert(!$('emergency').hidden,'storage failure exposes immediate recovery ZIP download');proto.put=put;$('deleteFinding').click();await settle();
    // Create a rotated/cropped view of the existing PDF in memory, without encoding music.
    const rotated=await PDFLib.PDFDocument.load(await render.arrayBuffer());const p=rotated.getPages()[0],size=p.getSize();p.setCropBox(12,24,size.width-24,size.height-48);p.setRotation(PDFLib.degrees(90));
    await choose('sourceFile',source,'qa-source.pdf');await choose('lyFile',ly,'qa-score.ly');await choose('renderedFile',new Blob([await rotated.save()]),'qa-rotated-crop.pdf');$('load').click();await wait(()=>$('message').textContent.includes('Snapshot ready'),'rotated snapshot');record=await settle();assert(record.review.findings.length===0,'new PDF bytes do not inherit old findings');assert(record.review.pages[0].rotation===90&&record.review.pages[0].view[0]===12,'rotation and nonzero crop offsets recorded');
    $('newFinding').click();input('comment','rotation / crop coordinate check');await stroke(100,90);$('saveFinding').click();await wait(()=>!$('comment').disabled,'finding completion');record=await settle();const f=record.review.findings[0],box=record.review.pages[0].view;assert(f.strokes[0].points.every(([x,y])=>x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3]),'rotated pointer positions invert into raw PDF crop bounds');
    // Reopen the earlier saved snapshot using the product control, then export it.
    const oldId=JSON.parse(matching).snapshotId;$('saved').value=oldId;$('reopen').click();await wait(()=>$('message').textContent.includes('Reopened the review'),'old snapshot reopen');record=await settle();assert(record.review.findings.length===2&&canonical(record.review.findings)===beforeReload,'earlier snapshot remains available with original files');
    $('hide').checked=true;event('hide','change');$('export').click();$('generate').click();await wait(()=>$('progress').textContent.startsWith('Ready'),'full portable export');
    const links=[...frame.contentDocument.querySelectorAll('#downloads a')];assert(links.length===14,'ZIP and all 13 individual payloads offered');
    const get=async name=>{const a=links.find(a=>a.textContent===name);if(!a)throw new Error('Missing '+name);return (await fetch(a.href)).blob();};
    const manifest=JSON.parse(await (await get('manifest.json')).text());for(const [path,expected]of Object.entries(manifest.payloads))assert(await sha256(await (await get(path)).arrayBuffer())===expected.sha256,'export integrity: '+path);
    const report=await (await get('review.txt')).text();assert(report.includes('should be E♭ — edited; ♯ and 𝄞')&&report.includes('beam together'),'all Unicode comments readable as ordinary report text');
    const exported=JSON.parse(await (await get('annotations.json')).text());assert(exported.findings.length===2&&exported.findings[0].strokes.every(s=>s.color===PALETTE[2].color),'hidden view exports all findings with their chosen colors');
    for(const f of record.review.findings){const paths=manifest.context.filesByFinding[f.id];const clean=await createImageBitmap(await get(paths[1])),marked=await createImageBitmap(await get(paths[0]));assert(clean.width===marked.width&&clean.height===marked.height&&clean.width>1500,'clean and marked context dimensions match for #'+f.number);clean.close();marked.close();}
    log('\nALL CHECKS PASSED. Export downloads are in the embedded actual interface.');
  }catch(e){log('FAIL '+e.stack);out.className='fail';console.error(e);}finally{document.getElementById('run').disabled=false;}
};

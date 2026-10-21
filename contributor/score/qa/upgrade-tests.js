import * as pdfjs from '../vendor/pdf.mjs';
import {completedFixture} from './completed-fixture.js';
import {readPackage,readZip} from '../workflow.js';
import {restoreReturnedBackup} from '../returned.js';
import {retain,retained} from '../handoff-store.js';
import {sha256,clone} from '../model.js';
if(location.hostname!=='127.0.0.1'||['8939','8945','8964','8967'].includes(location.port))throw new Error('Use a fresh isolated loopback origin, never port 8939.');
pdfjs.GlobalWorkerOptions.workerSrc='../vendor/pdf.worker.mjs';
const frame=document.getElementById('app'),out=document.getElementById('results'),run=document.getElementById('run');
const name='score-desk-upgrade-'+crypto.randomUUID(),channel=new BroadcastChannel(name),pending=new Map();
document.getElementById('openOld').href='./legacy-v2.html?channel='+name;
channel.onmessage=e=>{if(e.data.ready){run.disabled=false;return;}const p=pending.get(e.data.id);if(p){clearTimeout(p.timer);pending.delete(e.data.id);e.data.error?p.reject(new Error(e.data.error)):p.resolve(e.data.result);}};
const ask=(action,arg)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>reject(new Error('Historical client timeout: '+action)),60000);pending.set(id,{resolve,reject,timer});channel.postMessage({id,to:'old',action,arg});});
let passed=0,failed=0;
const log=s=>out.textContent+=s+'\n',check=(ok,s)=>{ok?passed++:failed++;log((ok?'PASS ':'FAIL ')+s);};
const wait=async(fn,s)=>{const end=Date.now()+60000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Timeout: '+s+'; '+$('message')?.textContent+'; '+$('progress')?.textContent);};
const $=id=>frame.contentDocument.getElementById(id),api=()=>frame.contentWindow.scoreDeskQA,scene=()=>api().completion.capture();
async function inspect(files){const doc=await pdfjs.getDocument({data:new Uint8Array(await files.rendered.blob.arrayBuffer()),isEvalSupported:false}).promise;try{const pages=[];for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);pages.push({page:i,view:[...p.view],rotation:p.rotate,userUnit:p.userUnit});}return pages;}finally{await doc.destroy();}}
async function records(){const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('score-desk-local-v1');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('reviews','readonly'),q=tx.objectStore('reviews').getAll();q.onsuccess=()=>resolve(q.result);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
async function normalized(value){if(value instanceof Blob)return {blobSize:value.size,blobType:value.type,sha256:await sha256(await value.arrayBuffer())};if(Array.isArray(value))return Promise.all(value.map(normalized));if(value&&typeof value==='object'){const r={};for(const k of Object.keys(value).sort())r[k]=await normalized(value[k]);return r;}return value;}
const fingerprint=async list=>JSON.stringify(await normalized(list));
const artifact=(blob,id,label)=>{const a=document.createElement('a');a.id=id;a.href=URL.createObjectURL(blob);a.download=id+'.zip';a.textContent=label;document.getElementById('artifacts').append(a);};
async function choose(blob){const dt=new frame.contentWindow.DataTransfer();dt.items.add(new frame.contentWindow.File([blob],'existing-completed-review.zip'));$('packageFile').files=dt.files;$('packageFile').dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));}
run.onclick=async()=>{
  run.disabled=true;passed=0;failed=0;out.textContent='';
  try{
    // No app/storage client is opened until the historical fixture is initialized.
    const existing=await indexedDB.databases();if(existing.some(d=>['score-desk-local-v1','score-desk-handoffs-v1'].includes(d.name)))throw new Error('STOP: this test origin already contains Score Desk data. Choose another unused localhost port. Do not delete/reset the database.');
    log('FRESH ORIGIN '+location.origin+' · no application database or app iframe existed.');
    const packageBlob=await completedFixture(inspect),parsed=await readPackage(packageBlob,inspect),restored=await restoreReturnedBackup(parsed,inspect);
    const round=JSON.parse(await parsed.payloads.get('returned-workspace.json').text()).returned;
    const oldRecord={id:round.id,review:parsed.review,files:parsed.files,returned:round};
    const initialized=await ask('init',{record:oldRecord});
    check(initialized.expectedRevision===1&&!initialized.dirty&&!initialized.hasCompletions&&!initialized.hasRevisionId,'real v2 historical writer creates/saves old-shape review before current app opens');
    const beforeSeed=await records(),first=beforeSeed.find(r=>r.id===round.id),eventId='returned-event:'+crypto.randomUUID();
    const historicalHead={...oldRecord,revisionId:parsed.completionBundle.revisionId,completions:parsed.completionBundle.records,storageRevision:2,historyId:eventId};
    await ask('seed',{records:[historicalHead,{...historicalHead,id:eventId,kind:'returned-event',workspaceId:round.id,parentHistoryId:first.historyId,createdAt:new Date().toISOString()},...historicalHead.completions.map(record=>({id:'completion:'+record.id,kind:'completion-record',record}))]});
    // Runtime fixture generation retains these append-only entries so the
    // production backup maker can read them. Verify that any retained entry is
    // exactly the issued task/response before reusing it; never insert twice.
    for(const entry of [restored.issued,restored.entry]){
      const existing=await retained(entry.id),path=entry.kind==='task'?'task.json':'response.json';
      if(existing)check(existing.kind===entry.kind&&await sha256(await existing.payloads.get(path).arrayBuffer())===await sha256(await entry.payloads.get(path).arrayBuffer()),'synthetic fixture retains the exact immutable '+entry.kind+' bytes');
      else await retain(entry);
    }
    const initialRecords=await records(),initialFingerprint=await fingerprint(initialRecords);
    await ask('latest');await ask('edit',{text:'UNSAVED historical local edit before database upgrade — E♭ 𝄞'});
    check((await ask('stats')).expectedRevision===historicalHead.storageRevision,'old client has latest CAS token and local unsaved edits before upgrade');
    frame.src='../index.html';await wait(()=>frame.contentDocument?.body?.dataset.ready==='true','updated app startup');
    const bridge=frame.contentDocument.createElement('script');bridge.type='module';bridge.src='./qa/bridge.js';frame.contentDocument.body.append(bridge);await wait(()=>api(),'actual app bridge');
    check(await fingerprint(await records())===initialFingerprint,'upgrade preserves every review, exact input Blob, returned event, registry body, revision ID, association and history byte-for-byte');
    const db=(await indexedDB.databases()).find(d=>d.name==='score-desk-local-v1');check(db.version>2,'current app upgrades the existing database beyond version 2');
    const old=await ask('stats');check(old.changes.length===1&&old.changes[0].oldVersion===2&&old.changes[0].newVersion===db.version,'open v2 connection receives versionchange and closes without a reload');
    check(old.dirty&&old.comment.includes('before database upgrade'),'versionchange retains the old tab local unsaved review');
    check(scene().revisionId===historicalHead.revisionId&&JSON.stringify(scene().completions)===JSON.stringify(historicalHead.completions)&&scene().returned.reported.some(f=>f.associationId)&&scene().returned.reported.some(f=>f.instructionHistory?.length),'current UI restores existing completion links, exact revision, associations and earlier instructions');
    $('finishReview').click();$('finishForm').querySelector('input[value="partial"]').click();$('finishNote').value='SIMULATED v2 upgrade regression completion';$('prepareFinish').click();
    await wait(()=>!api().sessionStatus().busy&&$('finishStatus').textContent.startsWith('Package ready'),'completion after upgrade');
    const zip=await (await fetch($('finishDownloads').querySelector('a').href)).blob(),payloads=await readZip(zip),bundle=JSON.parse(await payloads.get('completion-history.json').text()),head=(await records()).find(r=>r.id===round.id);
    check(head.completions.length===historicalHead.completions.length+1&&bundle.records.length===head.completions.length&&bundle.revisionId===head.revisionId&&$('finishDownloads').querySelectorAll('a').length>2,'updated app commits completion normally and publishes ZIP plus individual downloads with all earlier records');
    artifact(zip,'upgrade-completed-inspection','Download actual post-upgrade completion package');$('closeFinish').click();
    const savedBefore=await records(),fingerprintBefore=await fingerprint(savedBefore);
    // Reproduce the original old-tab reopen -> latest CAS -> incomplete write.
    const latest=await ask('latest');log('Historical read of latest head: '+JSON.stringify({ok:latest.ok,error:latest.error,revision:latest.expectedRevision}));
    if(!latest.ok)await ask('latestToken',{revision:head.storageRevision}); // Give it the exact token anyway: CAS must not be the protection.
    const token=await ask('stats');check(token.expectedRevision===head.storageRevision,'old writer attempts the exact latest CAS revision (explicitly supplied even when its closed connection cannot read)');
    await ask('edit',{text:'UNSAVED historical local edit with latest CAS — E♭ 𝄞'});
    const held=await ask('heldWrite');log('Held v2 writer result: '+JSON.stringify(held));
    check(held.dirty&&held.lastError?.startsWith('InvalidStateError'),'historical writer cannot transact through its previously held v2 connection');
    const reopen=await ask('reopen');check(!reopen.ok&&reopen.error==='VersionError','historical indexedDB.open(name, 2) cannot reopen the upgraded database');
    const attempted=await ask('reopenWrite');log('Reopened v2 writer result: '+JSON.stringify(attempted));
    check(attempted.dirty&&attempted.lastError?.startsWith('VersionError'),'actual old-shape CAS save fails on v2 reopen, retaining local edits');
    const after=await records(),afterHead=after.find(r=>r.id===round.id);
    log('Saved head after historical attempts: '+JSON.stringify({storageRevision:afterHead.storageRevision,revisionId:afterHead.revisionId,completionIds:afterHead.completions?.map(r=>r.id),registryCount:after.filter(r=>r.kind==='completion-record').length,returnedEventsBefore:savedBefore.filter(r=>r.kind==='returned-event').length,returnedEventsAfter:after.filter(r=>r.kind==='returned-event').length}));
    check(await fingerprint(after)===fingerprintBefore,'attempted historical saves change no review, completion links, revision ID, immutable registry, returned history or files');
    check(afterHead.revisionId===head.revisionId&&JSON.stringify(afterHead.completions)===JSON.stringify(head.completions)&&after.filter(r=>r.kind==='returned-event').length===savedBefore.filter(r=>r.kind==='returned-event').length,'head links and returned-history count survive the latest-CAS old writer');
    const local=await ask('unload');check(local.dirty&&local.prevented&&local.comment.includes('latest CAS'),'old client still displays its unsaved edits and prevents accidental unload');
    const recovery=await ask('recovery'),recoveryFiles=await readZip(recovery.blob);check(JSON.parse(await recoveryFiles.get('annotations.json').text()).findings[0].comment.includes('latest CAS'),'existing local recovery path packages the failed historical writer edits');artifact(recovery.blob,'upgrade-old-local-recovery','Download old-client retained local recovery');
    if(!failed){
      await choose(packageBlob);await wait(()=>!api().sessionStatus().busy&&scene().workspaceId!==round.id&&$('message').textContent.startsWith('Returned revision ready')&&$('correctionComparison').getAttribute('aria-busy')==='false','existing completion package import');
      const imported=scene();check(JSON.stringify(imported.completions)===JSON.stringify(historicalHead.completions)&&JSON.stringify(imported.returned.reported)===JSON.stringify(round.reported),'existing pre-upgrade completion package reopens with all completion, decision, association and instruction history intact');
      $('export').click();$('generate').click();await wait(()=>!api().sessionStatus().busy&&$('progress').textContent.startsWith('Ready'),'existing package re-export');
      const a=[...$('downloads').querySelectorAll('a')].find(a=>a.download==='score-desk-review.zip'),exported=await (await fetch(a.href)).blob(),reexported=await readPackage(exported,inspect),meta=JSON.parse(await reexported.payloads.get('returned-workspace.json').text());
      check(JSON.stringify(reexported.completionBundle.records)===JSON.stringify(historicalHead.completions)&&JSON.stringify(meta.returned.reported)===JSON.stringify(round.reported),'existing completion package exports again with unchanged completion and returned-review history');artifact(exported,'upgrade-existing-reexport','Download re-export of the existing completion package');$('closeExports').click();
    }
    await ask('release');log(`\n${failed?'FAILED':'ALL'} ${passed} PASSED / ${failed} FAILED · REAL V2 UPGRADE REGRESSION · ${location.origin}`);if(failed)out.className='fail';
  }catch(e){out.className='fail';log('STOP / FAIL '+(e?.stack??`${e?.name??'Error'}: ${e?.message??String(e)}`));}finally{run.disabled=false;}
};

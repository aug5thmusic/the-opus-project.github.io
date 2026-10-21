// HISTORICAL FIXTURE: database v2, pre-completion CAS writer and record shape.
// Keep this independent of current storage.js, including its lack of completion
// merging/registry checks. Writer copied from the supplied completion-audit.
import {makeRecovery,zipFiles} from '../export.js';
if(location.hostname!=='127.0.0.1'||['8939','8945','8964'].includes(location.port))throw new Error('Use a fresh isolated loopback origin, never port 8939.');
const channel=new BroadcastChannel(new URLSearchParams(location.search).get('channel'));
let dbPromise,held,local,expectedRevision,dirty=false,changes=[],lastError=null;
function database(){return dbPromise??=new Promise((resolve,reject)=>{
  const request=indexedDB.open('score-desk-local-v1',2); // Intentionally historical.
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('reviews'))request.result.createObjectStore('reviews',{keyPath:'id'});};
  request.onsuccess=()=>{const db=request.result;held=db;db.onversionchange=e=>{changes.push({oldVersion:e.oldVersion,newVersion:e.newVersion});db.close();show();};resolve(db);};
  request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Database upgrade blocked by another open Score Desk tab.'));
});}
class StorageConflictError extends Error{constructor(){super('Another tab saved a newer version. Your edits remain in this tab; download a recovery ZIP before reloading or switching.');this.name='StorageConflictError';}}
async function oldPutSaved(record,expectedRevision){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('reviews','readwrite'),store=tx.objectStore('reviews');
    let saved,failure;
    const request=store.get(record.id);
    request.onsuccess=()=>{
      const current=request.result;
      const actual=current?(current.storageRevision??0):null;
      if(actual!==expectedRevision){failure=new StorageConflictError();tx.abort();return;}
      saved={...record,storageRevision:(actual??0)+1};
      try{
        if(record.returned){
          saved.historyId='returned-event:'+crypto.randomUUID();
          store.add({...saved,id:saved.historyId,kind:'returned-event',workspaceId:record.id,parentHistoryId:current?.historyId??null,createdAt:new Date().toISOString()});
        }
        store.put(saved);
      }catch(error){failure=error;tx.abort();}
    };
    tx.oncomplete=()=>resolve(saved);
    tx.onabort=()=>reject(failure||tx.error||new Error('Local storage transaction aborted.'));
    tx.onerror=()=>{failure??=tx.error;};
  });
}
// This is the historical app's write shape. Do NOT spread a current head here.
const oldShape=r=>({id:r.id,review:structuredClone(r.review),files:r.files,returned:structuredClone(r.returned)});
const stats=()=>({expectedRevision,dirty,changes,lastError,comment:local?.review.findings[0].comment,hasRevisionId:local&&Object.hasOwn(local,'revisionId'),hasCompletions:local&&Object.hasOwn(local,'completions')});
function show(){document.getElementById('status').textContent=JSON.stringify(stats(),null,2);if(local)document.getElementById('comment').value=local.review.findings[0].comment;}
async function save(){try{const saved=await oldPutSaved(oldShape(local),expectedRevision);expectedRevision=saved.storageRevision;dirty=false;lastError=null;}catch(e){lastError=e.name+': '+e.message;}show();return stats();}
document.getElementById('comment').oninput=e=>{local.review.findings[0].comment=e.target.value;dirty=true;show();};
document.getElementById('save').onclick=save;
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function recovery(){const blob=await zipFiles(await makeRecovery(local.review,local.files)),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='historical-v2-local-recovery.zip';a.textContent='Download retained historical local edits';document.getElementById('downloads').replaceChildren(a);return {blob,comment:local.review.findings[0].comment,dirty};}
document.getElementById('recover').onclick=async()=>{await recovery();document.querySelector('#downloads a').click();};
const actions={
  async init({record}){if((await indexedDB.databases()).some(d=>d.name==='score-desk-local-v1'))throw new Error('STOP: test database already exists. Choose another isolated localhost port; do not delete or reset it.');local=oldShape(record);expectedRevision=null;await save();if(lastError)throw new Error(lastError);return stats();},
  // Test setup only: seed a genuine existing completed package and its immutable
  // registry/history, using the already-open v2 connection before app startup.
  async seed({records}){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('reviews','readwrite');for(const r of records)tx.objectStore('reviews').put(r);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});return true;},
  async latest(){try{const db=await database(),r=await new Promise((resolve,reject)=>{const tx=db.transaction('reviews','readonly'),q=tx.objectStore('reviews').get(local.id);q.onsuccess=()=>resolve(q.result);tx.onabort=()=>reject(tx.error);});local=oldShape(r);expectedRevision=r.storageRevision;show();return {ok:true,...stats()};}catch(e){return {ok:false,error:e.name,...stats()};}},
  latestToken({revision}){expectedRevision=revision;show();return stats();},
  edit({text}){local.review.findings[0].comment=text;dirty=true;show();return stats();},
  save,stats,recovery,
  heldWrite(){return save();},
  async reopen(){return new Promise(resolve=>{const q=indexedDB.open('score-desk-local-v1',2);q.onerror=()=>resolve({ok:false,error:q.error.name});q.onsuccess=()=>{q.result.close();resolve({ok:true});};});},
  async reopenWrite(){dbPromise=undefined;return save();},
  unload(){const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return {prevented:e.defaultPrevented,...stats()};},
  // Explicit cleanup after assertions/recovery; only this disposable tab.
  release(){dirty=false;held?.close();show();return true;}
};
channel.onmessage=async e=>{const {id,to,action,arg}=e.data;if(to!=='old')return;try{channel.postMessage({id,result:await actions[action](arg??{})});}catch(error){channel.postMessage({id,error:error?.stack??`${error?.name??'Error'}: ${error?.message??String(error)}`});}};
show();channel.postMessage({ready:'old'});

// One atomic record contains the review, inputs and additive completions.
import {mergeCompletions,canonical} from './completion-model.js';
let dbPromise;
function database(){
  return dbPromise??=new Promise((resolve,reject)=>{
    // Version 3 preserves all records and closes incompatible v1/v2 clients via
    // their existing versionchange handler. Pre-completion v2 writers can pass
    // CAS yet omit revisionId/completions; they must not reconnect at version 2.
    const request=indexedDB.open('score-desk-local-v1',3);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('reviews'))request.result.createObjectStore('reviews',{keyPath:'id'});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Database upgrade blocked by another open Score Desk tab.'));
  });
}
async function transaction(mode,action){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('reviews',mode),request=action(tx.objectStore('reviews'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||new Error('Local storage transaction aborted.'));tx.onerror=()=>reject(tx.error||request.error);});}
export const getSaved=id=>transaction('readonly',store=>store.get(id));
export class StorageConflictError extends Error {
  constructor(){super('Another tab saved a newer version. Your edits remain in this tab; download a recovery ZIP before reloading or switching.');this.name='StorageConflictError';}
}
// The read AND conditional write must share one readwrite transaction. IndexedDB
// serializes these transactions across tabs; timestamps are not a lock.
export async function putSaved(record,expectedRevision,completion=null){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('reviews','readwrite'),store=tx.objectStore('reviews');
    let saved,failure;
    const request=store.get(record.id);
    request.onsuccess=()=>{
      const current=request.result;
      const actual=current?(current.storageRevision??0):null;
      if(completion&&current?.completions?.some(r=>r.id===completion.id)){
        const existing=current.completions.find(r=>r.id===completion.id);
        if(current.revisionId===record.revisionId&&canonical(existing)===canonical(completion)){
          const key='completion:'+completion.id,lookup=store.get(key);lookup.onsuccess=()=>{if(lookup.result&&canonical(lookup.result.record)!==canonical(completion)){failure=new Error('Completion identity conflicts with an immutable earlier record.');tx.abort();return;}if(!lookup.result)store.add({id:key,kind:'completion-record',record:completion});saved=current;};return;
        }
        failure=new StorageConflictError();tx.abort();return;
      }
      if(actual!==expectedRevision){failure=new StorageConflictError();tx.abort();return;}
      saved={...record,storageRevision:(actual??0)+1};
      try{
        saved.completions=mergeCompletions(current?.completions,record.completions);
        const writeHead=()=>{
          if(record.returned){saved.historyId='returned-event:'+crypto.randomUUID();store.add({...saved,id:saved.historyId,kind:'returned-event',workspaceId:record.id,parentHistoryId:current?.historyId??null,createdAt:new Date().toISOString()});}
          store.put(saved);
        };
        let pending=saved.completions.length;if(!pending){writeHead();return;}
        // Global immutable IDs also protect imports into a new recovery branch.
        // All lookups, registry additions, history and the head share this tx.
        for(const item of saved.completions){const key='completion:'+item.id,lookup=store.get(key);lookup.onsuccess=()=>{
          if(failure)return;
          if(lookup.result&&canonical(lookup.result.record)!==canonical(item)){failure=new Error('Completion identity conflicts with an immutable earlier record.');tx.abort();return;}
          if(!lookup.result)store.add({id:key,kind:'completion-record',record:item});
          if(!--pending)writeHead();
        };}
      }catch(error){failure=error;tx.abort();}
    };
    tx.oncomplete=()=>resolve(saved);
    tx.onabort=()=>reject(failure||tx.error||new Error('Local storage transaction aborted.'));
    tx.onerror=()=>{failure??=tx.error;};
  });
}
export const listSaved=async()=>{const all=await transaction('readonly',store=>store.getAll());return all.filter(r=>!['returned-event','completion-record'].includes(r.kind)).map(({id,review,returned})=>({id,updatedAt:review.updatedAt,name:(returned?'Returned review · ':'')+review.files.rendered.name,count:review.findings.length})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));};
export const returnedHistory=async id=>(await transaction('readonly',store=>store.getAll())).filter(r=>r.kind==='returned-event'&&r.workspaceId===id).sort((a,b)=>a.storageRevision-b.storageRevision);

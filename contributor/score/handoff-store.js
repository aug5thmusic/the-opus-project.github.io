// Separate database: existing review CAS records and legacy clients stay intact.
let connection;
const database=()=>connection??=new Promise((resolve,reject)=>{
  const r=indexedDB.open('score-desk-handoffs-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('entries',{keyPath:'id'});
  r.onerror=()=>reject(r.error);
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
});
async function run(mode,action){const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction('entries',mode);let result,failure;
  try{const r=action(tx.objectStore('entries'));r.onsuccess=()=>result=r.result;r.onerror=()=>failure=r.error;}catch(e){failure=e;tx.abort();}
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||new Error('Handoff could not be retained locally.'));
});}
// Append only. A response or human decision never rewrites an issued baseline.
export const retain=entry=>run('readwrite',store=>store.add(entry));
export const retained=id=>run('readonly',store=>store.get(id));
export const retainedList=async()=>{const entries=await run('readonly',store=>store.getAll());return entries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));};

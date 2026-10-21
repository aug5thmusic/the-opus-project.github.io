// Source-only checks for the integrated static app. No installs or score builds.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else files.push(p);}}
walk(root);
const source=files.filter(p=>p.endsWith('.js')&&!p.includes(path.sep+'vendor'+path.sep));
for(const p of source){
  execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
  const text=fs.readFileSync(p,'utf8');
  for(const hit of text.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))assert.ok(fs.existsSync(path.resolve(path.dirname(p),hit[1])),`missing module from ${p}: ${hit[1]}`);
  if(p.startsWith(__dirname+path.sep))assert.ok(!/fetch\(['"]\.\/inputs\/|fetch\(['"]\.\/completion-inspected\//.test(text),`generated fixture dependency: ${p}`);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(!/<iframe\b/i.test(html),'the contributor app must not wrap the prototypes in iframes');
for(const hit of html.matchAll(/(?:src|href)=['"]([^'"#]+)['"]/g)){
  const url=hit[1];assert.ok(!/^(?:https?:|\/)/.test(url),'production assets and navigation must be relative for subpath hosting: '+url);
  if(/\.(?:js|mjs|css)$/.test(url))assert.ok(fs.existsSync(path.resolve(root,url)),`missing production asset: ${url}`);
}
for(const required of ['pdf.mjs','pdf.worker.mjs','pdf-lib.min.js','jszip.min.js','PDFJS-LICENSE','PDF-LIB-LICENSE.md','JSZIP-LICENSE.md'])assert.ok(fs.existsSync(path.join(root,'vendor',required)),'missing vendored dependency/license: '+required);
assert.ok(!files.some(p=>/\.(?:pdf|zip|png|jpg)$/i.test(p)),'source tree must not carry score PDFs or generated test exports');
assert.ok(fs.readFileSync(path.join(root,'storage.js'),'utf8').includes("indexedDB.open('score-desk-local-v1',3)"),'retain the reviewed database compatibility version');
(async()=>{
  const {fixtureBlob}=await import(pathToFileURL(path.join(__dirname,'fixtures.js')));
  for(const [name,pages] of [['source.pdf',1],['rendered.pdf',1],['multipage.pdf',4]]){
    const one=await fixtureBlob(name),two=await fixtureBlob(name),text=await one.text();
    assert.equal(one.type,'application/pdf');assert.equal(text,await two.text());
    assert.ok(text.includes(`/Count ${pages}`));
    const offset=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(offset,offset+4),'xref');
  }
  assert.notEqual(await (await fixtureBlob('source.pdf')).text(),await (await fixtureBlob('rendered.pdf')).text(),'source/render fixtures must have distinct identities');
  console.log(`Static integration checks passed; ${source.length} JavaScript modules checked. Synthetic PDF geometry generated in memory.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

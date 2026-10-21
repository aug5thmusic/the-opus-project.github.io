// Reproducible browser tests. Always creates disposable browser contexts and a
// fresh loopback server; never connects to a contributor's running browser.
import {createServer} from 'node:http';
import {readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {resolve, relative, extname, sep} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const moduleName=process.env.OPUS_PLAYWRIGHT;
const {chromium}=await import(moduleName?pathToFileURL(resolve(moduleName)).href:'playwright');
export const evidence=resolve(root,'.build','browser-tests',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf','.wasm':'application/wasm'};

export async function serve(directory,{prefix='/',config=null}={}){
  directory=resolve(directory);
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
      if(config&&url.pathname===prefix+'contributor/score/shared-config.json'){
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(config));return;
      }
      let path=resolve(directory,decodeURIComponent(url.pathname.slice(prefix.length))||'.');
      if(relative(directory,path).startsWith('..'+sep)||relative(directory,path)==='..'){res.writeHead(403).end();return;}
      if((await stat(path)).isDirectory())path=resolve(path,'index.html');
      res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(path));
    }catch{res.writeHead(404).end('Not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  assert(!['8939','8945','8964','8967'].includes(String(server.address().port)));
  return {origin,url:origin+prefix,close:()=>new Promise(r=>server.close(r))};
}

const browser=await chromium.launch({headless:true,...(process.env.OPUS_BROWSER_CHANNEL?{channel:process.env.OPUS_BROWSER_CHANNEL}:{})});
let services=[];
const results=[];
const selected=process.argv.find(arg=>arg.startsWith('--suites='))?.slice(9).split(',');
const included=name=>!selected||selected.includes(name);
async function record(page,name){
  const text=await page.locator('#results').innerText();
  await writeFile(resolve(evidence,name+'.txt'),text);
  if(/(^|\n)FAIL\b/.test(text)||!/ALL .*PASSED/.test(text))throw new Error(name+' failed:\n'+text);
  const count=(text.match(/^PASS\b/gm)||[]).length;
  results.push({name,assertions:count});console.log(`${name}: ${count} assertions passed`);
}
async function runSuite(context,url,name){
  const page=await context.newPage();await page.goto(url);await page.locator('#run').click();
  if(name==='completion'){
    await page.waitForFunction(()=>document.querySelector('#continueEscape')?.hidden===false||document.querySelector('#results')?.classList.contains('fail'),null,{timeout:120000});
    if(await page.locator('#continueEscape').isVisible()){
      await page.frameLocator('#app').locator('#finishDialog').press('Escape');await page.locator('#continueEscape').click();
    }
  }
  await page.waitForFunction(()=>/ALL .*PASSED|\bFAIL\b/.test(document.querySelector('#results')?.textContent||''),null,{timeout:180000});
  await record(page,name);await page.close();
}
try{
  if(!process.argv.includes('--shared-only')&&!process.argv.includes('--revisions-only')&&!process.argv.includes('--completion-import-only')){
    const server=await serve(root);services.push(server);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    for(const [path,name] of [['index','brush'],['desk','desk'],['workflow','workflow'],['completion','completion']])if(included(name))await runSuite(context,server.url+`contributor/score/qa/${path}.html`,name);
    if(included('races')){
    const races=await context.newPage();await races.goto(server.url+'contributor/score/qa/races.html');
    const tabs=[];
    for(const slot of ['A','B']){const tab=await context.newPage();await tab.goto(new URL(await races.locator('#open'+slot).getAttribute('href'),races.url()).href);tabs.push(tab);}
    await races.locator('#run').click();
    await races.waitForFunction(()=>!document.querySelector('#continue').hidden||document.querySelector('#results').classList.contains('fail'),null,{timeout:180000});
    if(await races.locator('#continue').isVisible()){await tabs[0].frameLocator('#app').locator('#exports').press('Escape');await races.locator('#continue').click();}
    await races.waitForFunction(()=>/ALL .*PASSED|\bFAIL\b/.test(document.querySelector('#results').textContent),null,{timeout:180000});
    await record(races,'races');}
    await context.close();
    if(included('comparison')){
      const {runComparison}=await import('./comparison-browser-tests.mjs');
      results.push(await runComparison({browser,serve,evidence,root}));
    }
    if(included('upgrade')){
    const fresh=await serve(root);services.push(fresh);
    const upgraded=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await upgraded.newPage();await page.goto(fresh.url+'contributor/score/qa/upgrade.html');
    const old=await upgraded.newPage();await old.goto(new URL(await page.locator('#openOld').getAttribute('href'),page.url()).href);
    await page.locator('#run').click();
    await page.waitForFunction(()=>/ALL .*PASSED|\bFAIL\b/.test(document.querySelector('#results').textContent),null,{timeout:180000});
    await record(page,'upgrade');await upgraded.close();}
  }
  if(process.argv.includes('--shared')||process.argv.includes('--shared-only')){
    const {runShared}=await import('./shared-browser-tests.mjs');
    results.push(await runShared({browser,serve,evidence,root}));
  }
  if(process.argv.includes('--shared')||process.argv.includes('--shared-only')||process.argv.includes('--revisions-only')){
    const {runSharedRevisions}=await import('./shared-revision-browser-tests.mjs');
    results.push(await runSharedRevisions({browser,serve,evidence,root}));
  }
  if(process.argv.includes('--shared')||process.argv.includes('--shared-only')||process.argv.includes('--completion-import-only')){
    const {runCompletionImports}=await import('./completion-import-browser-tests.mjs');
    results.push(await runCompletionImports({browser,serve,evidence,root}));
  }
  console.log(JSON.stringify({results,evidence},null,2));
}catch(error){console.error(error);process.exitCode=1;}
finally{await browser.close();for(const service of services)await service.close();}

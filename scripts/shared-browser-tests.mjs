// Actual UI + durable HTTP integration. Every identity, score and AI response
// here is SIMULATED test data; no musical correction or verification is claimed.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fixtureBlob} from '../contributor/score/qa/fixtures.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function runShared({browser,serve,evidence,root}){
  let assertions=0,processHandle,staticServer;const contexts=[];const log=[],serviceLog=[];
  const check=(ok,label)=>{assert(ok,label);assertions++;log.push('PASS '+label);console.log('shared: '+label);};
  const directory=resolve(evidence,'shared'),repo=resolve(directory,'repo'),site=resolve(directory,'site');
  const slug='simulated-shared-work',piece=resolve(repo,'pieces',slug),renderPath=resolve(site,'pieces',slug,'score.pdf');
  await mkdir(piece,{recursive:true});await mkdir(resolve(site,'pieces',slug),{recursive:true});
  const source=Buffer.from(await (await fixtureBlob('source.pdf')).arrayBuffer());
  const rendered=Buffer.from(await (await fixtureBlob('rendered.pdf')).arrayBuffer());
  const lilypond=Buffer.from(await (await fixtureBlob('score.ly')).arrayBuffer());
  await writeFile(resolve(piece,'score.ly'),lilypond);await writeFile(renderPath,rendered);
  await writeFile(resolve(piece,'metadata.json'),json({slug,title:'SIMULATED shared acceptance work',composer:'Synthetic fixture',step:3,models:['simulated/test-only'],verified_by:null,source_sha256:sha(source),source_pdf:'https://example.invalid/SIMULATED-source.pdf',source_page:'https://example.invalid/SIMULATED',source_id:'SIMULATED-NOT-A-SCORE'}));
  const git=(...args)=>execFileSync('git',args,{cwd:repo,stdio:'pipe',encoding:'utf8'}).trim();
  git('init','--initial-branch=main','--quiet');git('add','pieces');
  git('-c','user.name=OPUS simulated test','-c','user.email=simulated@example.invalid','commit','--quiet','-m','SIMULATED test baseline; no musical verification');
  // Build only allowlisted frontend files, under a real directory prefix. Test
  // pieces/rendering live in the isolated runtime and never enter the app build.
  execFileSync(process.env.OPUS_PYTHON||'python',['-B','-c','import sys; from pathlib import Path; sys.path.insert(0,"scripts"); import build_site; build_site.copy_contributor_assets(Path(sys.argv[1]))',site],{cwd:root,stdio:'pipe'});
  const config={apiBase:null};staticServer=await serve(site,{prefix:'/opus-preview/',config});
  let serviceURL;
  const start=async()=>{
    const args=['-B',resolve(root,'service/opus_service.py'),'--repo',repo,'--site-root',site,'--data-dir',resolve(directory,'data'),'--port','0','--allow-origin',staticServer.origin,'--dev-auth'];
    processHandle=spawn(process.env.OPUS_PYTHON||'python',args,{cwd:root,env:{...process.env,OPUS_MAINTAINER_IDS:'dev:david',OPUS_VERIFIER_IDS:'dev:appointed'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='';for(const stream of [processHandle.stdout,processHandle.stderr])stream.on('data',data=>{output+=data;serviceLog.push(String(data));});
    const deadline=Date.now()+15000;
    while(!/OPUS shared service: (http:\/\/[^\s]+)/.test(output)){if(processHandle.exitCode!==null||Date.now()>deadline)throw new Error('Service startup failed: '+output);await wait(50);}
    serviceURL=output.match(/OPUS shared service: (http:\/\/[^\s]+)/)[1];config.apiBase=serviceURL;
  };
  const api=async(path,{method='GET',body,token,expected=200}={})=>{
    const response=await fetch(serviceURL+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
  };
  const state=()=>api('/api/works/'+slug);
  const actors={};
  async function actor(name,query=''){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(30000);contexts.push(context);
    const page=await context.newPage();page.on('pageerror',error=>log.push('BROWSER ERROR '+error.message));
    page.on('requestfailed',request=>log.push('NETWORK '+name+' '+request.method()+' '+request.url()+' '+request.failure()?.errorText));
    page.on('console',message=>{if(message.type()==='error')log.push('CONSOLE '+name+' '+message.text());});
    await page.goto(staticServer.url+'contributor/score/?piece='+slug+query);
    await page.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.querySelector('#sharedAvailable')?.hidden);
    if(!await page.locator('#sharedDialog').isVisible())await page.locator('#sharedProject').click();
    await page.locator('#sharedDevLogin').fill(name);await page.locator('#sharedDevForm button').click();
    await page.waitForFunction(name=>document.querySelector('#sharedIdentity').textContent.includes('@'+name),name);
    actors[name]=page;return page;
  }
  async function openScore(page){await page.locator('#sharedOpenScore').click();await page.waitForFunction(()=>!document.querySelector('#sharedDialog').open&&document.querySelector('#renderedPaper').getAttribute('aria-busy')==='false');}
  async function textFinding(page,text){await page.locator('#newFinding').click();await page.locator('#comment').fill(text);await page.locator('#saveFinding').click();await page.waitForFunction(()=>document.querySelector('#storage').textContent==='Saved locally');}
  async function sendReport(page){const before=new URL(page.url()).searchParams.get('report');await page.locator('#sharedSendReport').click();await page.waitForFunction(before=>document.querySelector('#sharedReportForm').hidden&&new URL(location.href).searchParams.get('report')!==before,before);return new URL(page.url()).searchParams.get('report');}
  async function submit(page){await page.locator('#sharedSubmit').click();return sendReport(page);}
  async function getTask(page){
    if(!await page.locator('#sharedDialog').isVisible())await page.locator('#sharedProject').click();
    await page.locator('#sharedFixPath').click();await page.locator('#sharedGetTask').click();
    await page.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.startsWith('Correction package saved'),null,{timeout:120000});
    const download=await Promise.all([page.waitForEvent('download'),page.locator('#sharedTaskDownloads a').click()]);
    return readFile(await download[0].path());
  }
  try{
    await start();
    const setup=await api('/auth/dev',{method:'POST',body:{login:'fixture-loader'}});
    const upload=await fetch(serviceURL+'/api/works/'+slug+'/assets/source',{method:'POST',headers:{Authorization:'Bearer '+setup.token,'Content-Type':'application/pdf'},body:source});assert.equal(upload.status,200);
    const baseline=await state();check(baseline.current.files.ly.sha256===sha(lilypond),'fixture exact assets registered with service');
    const alice=await actor('alice');await openScore(alice);
    await textFinding(alice,'SIMULATED Alice text-only observation <script>untrusted()</script>.');
    await alice.locator('#draw').click();const canvas=await alice.locator('#overlay').boundingBox();
    await alice.mouse.move(canvas.x+60,canvas.y+100);await alice.mouse.down();await alice.mouse.move(canvas.x+110,canvas.y+105,{steps:5});await alice.mouse.up();
    await alice.locator('#comment').fill('SIMULATED Alice highlighted observation.');await alice.locator('#saveFinding').click();
    const aliceId=await submit(alice),aliceReport=await api('/api/reports/'+aliceId);
    check(aliceReport.findings.length===2&&aliceReport.findings[0].annotation.strokes.length===0&&aliceReport.findings[1].annotation.strokes.length>0,'Alice submits text-only and brush findings through actual UI');
    check(aliceReport.author.login==='alice'&&aliceReport.reviewed.files.ly.sha256===sha(lilypond),'receipt preserves authenticated author and exact reviewed bytes');
    check((await alice.locator('#sharedReceipt').innerText()).includes('You can leave now'),'ordinary report has durable receipt and independent completion');
    const eric=await actor('eric');await openScore(eric);const quickStart=Date.now();
    await textFinding(eric,'SIMULATED another reporter observation.');const ericId=await submit(eric);
    check(Date.now()-quickStart<10000,'one-finding report completes within ten seconds without AI or PR');
    check((await state()).findings.length===3,'shared reports from different browsers accumulate');
    const bob=await actor('bob');const taskBytes=await getTask(bob);
    const zipModule={exports:{}};Function('module','exports',await readFile(resolve(root,'contributor/score/vendor/jszip.min.js'),'utf8'))(zipModule,zipModule.exports);
    const JSZip=zipModule.exports,taskZip=await JSZip.loadAsync(taskBytes),task=JSON.parse(await taskZip.file('task.json').async('string'));
    check(task.findings.length===3&&task.findings.filter(f=>f.author.login==='alice').length===2&&task.findings.some(f=>f.author.login==='eric'),'Bob fresh browser downloads every shared finding with original authorship');
    check(task.findings.every(f=>taskZip.file(f.historicalContext.clean)&&taskZip.file(f.historicalContext.marked)),'actual renderer generates clean and marked context for text and brush findings');
    check((await bob.locator('#sharedPrompt').inputValue()).includes('untrusted observations'),'ready-to-copy instructions preserve source fidelity and distrust imported comments');
    // Reports arriving during the task do not enter its captured request list.
    await eric.locator('#sharedClose').click();await textFinding(eric,'SIMULATED new finding while correction is running.');await submit(eric);
    check((await state()).findings.length===4&&task.findings.length===3,'new findings stay outstanding without mutating issued task');
    const response=JSON.parse(await taskZip.file('response-template.json').async('string'));
    response.results.forEach(result=>{result.status='unchanged_with_reason';result.explanation='SIMULATED AI response for workflow acceptance. No musical correction or human verification.';});
    const responseBytes=await new JSZip().file('response.json',json(response)).generateAsync({type:'nodebuffer'});
    await bob.locator('#sharedResponseFile').setInputFiles({name:'SIMULATED-response.zip',mimeType:'application/zip',buffer:responseBytes});
    await bob.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.startsWith('AI response submitted'));
    const proposalId=new URL(bob.url()).searchParams.get('proposal');
    check((await state()).proposals.length===1,'Bob returns the response and completes his independent contribution');
    const carol=await actor('carol');await carol.locator('#sharedFixPath').click();
    await carol.locator('#sharedResponseFile').setInputFiles({name:'SIMULATED-response.zip',mimeType:'application/zip',buffer:responseBytes});
    await carol.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.startsWith('AI response submitted'));
    check(new URL(carol.url()).searchParams.get('proposal')===proposalId&&(await state()).proposals.length===1,'Carol imports identical response without Bob local DB and gets original immutable receipt');
    check(!((await carol.locator('#sharedProposals').innerText()).includes('Applied to the project')),'unapplied proposals never display as applied');
    const david=await actor('david');await david.locator('#sharedProposals button').first().click();
    await david.waitForFunction(()=>!document.querySelector('#sharedDialog').open&&!document.querySelector('#sharedProposalPanel').hidden);
    await david.locator('#sharedDecisionExplanation').fill('SIMULATED workflow-only visual review decision.');await david.locator('#sharedLooksCorrect').click();
    await david.waitForFunction(()=>document.querySelector('#message').textContent.includes('Decision submitted'));
    const decided=await api('/api/proposals/'+proposalId);
    check(decided.findings.filter(f=>f.decision).length===1&&decided.findings[0].decision.author.login==='david','David reviews one finding and preserves attribution; unchecked findings remain');
    check((await state()).findings.every(f=>f.state!=='resolved'),'approval alone resolves no finding in the published score');
    // Clean declarations are independently useful and never close other reports.
    const eve=await actor('eve');await eve.locator('#sharedReviewPath').click();
    await eve.locator('input[name=sharedScope][value=partial]').check();await eve.locator('#sharedScopeNote').fill('SIMULATED partial review: first system only.');
    await eve.locator('#sharedDisplayName').fill('SIMULATED optional typed name');
    await eve.reload();await eve.waitForFunction(()=>document.body.dataset.ready==='true'&&!document.querySelector('#sharedAvailable')?.hidden);
    if(!await eve.locator('#sharedDialog').isVisible())await eve.locator('#sharedProject').click();
    await eve.locator('#sharedDevLogin').fill('eve');await eve.locator('#sharedDevForm button').click();await eve.waitForFunction(()=>document.querySelector('#sharedIdentity').textContent.includes('@eve'));
    await eve.locator('#sharedReviewPath').click();await eve.waitForFunction(()=>document.querySelector('#sharedScopeNote').value==='SIMULATED partial review: first system only.');
    check(await eve.locator('input[name=sharedScope][value=partial]').isChecked()&&(await eve.locator('#sharedDisplayName').inputValue())==='SIMULATED optional typed name'&&!await eve.locator('#sharedClean').isChecked(),'offline review draft restores scope and typed name after reload without implying clean coverage');
    const reportCount=(await state()).reports.length;
    await eve.locator('#sharedSendReport').click();await eve.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.includes('explicitly declare'));
    check((await state()).reports.length===reportCount,'zero findings without an explicit clean declaration cannot submit');
    await eve.locator('#sharedClean').check();await sendReport(eve);
    await eve.locator('#sharedReviewPath').click();await eve.locator('input[name=sharedScope][value=whole]').check();await eve.locator('#sharedScopeNote').fill('SIMULATED whole-work review: every fixture page and system.');await eve.locator('#sharedClean').check();await sendReport(eve);
    const cleanState=await state();check(cleanState.reports.filter(r=>r.clean).length===2&&cleanState.findings.length===4,'partial and whole clean reviews leave other people findings intact');
    check(cleanState.current.files.ly.sha256===sha(lilypond)&&cleanState.work.verified_by===null,'review-only submissions change neither LilyPond nor verification');
    // Normal authenticated users cannot mutate reports or claim application/verification.
    const outsider=await api('/auth/dev',{method:'POST',body:{login:'outsider'}});
    await api('/api/reports/'+aliceId,{method:'PATCH',body:{comment:'overwrite'},token:outsider.token,expected:405});
    await api('/api/works/'+slug+'/verification',{method:'POST',body:{verified_by:'typed-name'},token:outsider.token,expected:403});
    check(true,'server rejects alteration of another report and unauthorized verification');
    // A maintainer records application only after checking canonical bytes and a
    // traceable PR. This fixture is unchanged-code false-positive resolution.
    const maintainer=await api('/auth/dev',{method:'POST',body:{login:'david'}});
    await api('/api/works/'+slug+'/applications',{method:'POST',token:maintainer.token,body:{requestId:'simulated-application',proposalId,findingIds:[task.findings[0].id],repositoryRevision:git('rev-parse','HEAD'),pullRequest:'https://github.com/the-opus-project/the-opus-project.github.io/pull/999999'}});
    check((await state()).findings.filter(f=>f.state==='resolved').length===1,'explicit canonical application resolves only the reviewed selected finding');
    // Change render geometry for a later repository revision. All previous marks
    // must remain historical, including findings outside the issued task.
    const changedCode=Buffer.concat([lilypond,Buffer.from('\n% SIMULATED later canonical fixture revision\n')]);
    await writeFile(resolve(piece,'score.ly'),changedCode);await writeFile(renderPath,Buffer.from(await (await fixtureBlob('multipage.pdf')).arrayBuffer()));
    git('add','pieces');git('-c','user.name=OPUS simulated test','-c','user.email=simulated@example.invalid','commit','--quiet','-m','SIMULATED later fixture revision');
    const frank=await actor('frank'),laterZip=await JSZip.loadAsync(await getTask(frank)),laterTask=JSON.parse(await laterZip.file('task.json').async('string'));
    check(laterTask.findings.length===3&&!laterTask.findings.some(f=>f.id===task.findings[0].id),'later package excludes applied requests and preserves pending and newly submitted findings');
    check(laterTask.findings.every(f=>f.page===null&&!f.currentAnchor&&f.historicalContext.originalFiles),'changed PDF geometry preserves historical files and never transfers highlights');
    check((await api('/api/proposals/'+proposalId)).stale===true,'old responses remain discoverable and explicitly stale after score advances');
    // Reopening durable receipts in another fresh profile is independent of any
    // local task store. Compact input snapshots, not browser mocks, back reads.
    const grace=await actor('grace','&report='+ericId);await grace.waitForFunction(id=>document.querySelector('#sharedReceipt').textContent.includes(id),ericId);check((await grace.locator('#sharedReceipt').innerText()).includes(ericId),'receipt reopens in a different fresh browser');
    // An acknowledgement can be lost after the actual server COMMIT. The UI
    // must retain the original request and retry it, not announce fake success.
    const hank=await actor('hank');await openScore(hank);
    await textFinding(hank,'SIMULATED offline/retry finding; preserve this draft.');
    await hank.locator('#sharedProject').click();await hank.locator('#sharedSignOut').click();await hank.waitForFunction(()=>document.querySelector('#sharedIdentity').textContent==='Reading without signing in');await hank.locator('#sharedClose').click();
    await hank.locator('#sharedSubmit').click();await hank.locator('#sharedSendReport').click();
    await hank.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.includes('Sign in to submit'));
    check((await state()).findings.length===4&&(await hank.locator('#sharedFindingChoices').innerText()).includes('offline/retry'),'authentication failure preserves draft and creates no shared record');
    await hank.locator('#sharedDevLogin').fill('hank');await hank.locator('#sharedDevForm button').click();
    await hank.waitForFunction(()=>document.querySelector('#sharedIdentity').textContent.includes('@hank'));
    await hank.context().route('**/api/works/'+slug+'/reports',async route=>{await route.fetch();await route.abort('connectionfailed');});
    await hank.locator('#sharedSendReport').click();await hank.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.includes('could not be reached'));
    check((await state()).findings.length===5&&await hank.locator('#sharedPending button').count()===1,'lost acknowledgement leaves pending retry although server committed once');
    await hank.context().unroute('**/api/works/'+slug+'/reports');await hank.locator('#sharedPending button').click();
    await hank.waitForFunction(()=>document.querySelector('#sharedPending').textContent==='');
    check((await state()).findings.length===5&&(await hank.locator('#sharedReceipt').innerText()).includes('Submitted to the project'),'safe retry gets durable receipt without duplicating finding');
    await grace.screenshot({path:resolve(evidence,'shared-receipt.png'),fullPage:true});
    await david.screenshot({path:resolve(evidence,'shared-proposal.png'),fullPage:true});
    // Real durable restart: no client cache supplies this record.
    processHandle.kill();await new Promise(r=>processHandle.once('exit',r));await start();
    check((await api('/api/reports/'+aliceId)).findings.length===2&&(await state()).findings.length===5,'SQLite records and immutable packages survive service restart');
    check(!log.some(line=>line.startsWith('BROWSER ERROR')),'shared UI completed without uncaught browser errors');
    await writeFile(resolve(evidence,'shared.txt'),log.join('\n')+'\n');
    return {name:'shared actual UI and persistence',assertions};
  }catch(error){
    await writeFile(resolve(evidence,'shared.txt'),log.join('\n')+'\nFAIL '+error.stack);
    for(const [name,page]of Object.entries(actors))try{await writeFile(resolve(evidence,'failure-'+name+'.txt'),await page.locator('body').innerText());await page.screenshot({path:resolve(evidence,'failure-'+name+'.png'),fullPage:true});}catch{}
    throw error;
  }finally{for(const context of contexts)await context.close();processHandle?.kill();await staticServer?.close();await writeFile(resolve(evidence,'shared-service.txt'),serviceLog.join(''));}
}

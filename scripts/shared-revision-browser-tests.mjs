// Real HTTP/UI and production LilyPond compilation, using disposable synthetic music.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fixtureBlob} from '../contributor/score/qa/fixtures.js';

const chooseProblem=async(page,index)=>{await page.locator('#sharedProposalFinding').click();await page.locator(`[data-problem-index="${index}"]`).click();await page.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false');};
const responseEditor=async page=>{if(!await page.locator('#correctionResponse').isVisible())await page.locator('#sharedStillCorrection').click();};
const viewOptions=async page=>{if(!await page.locator('#renderedViewOptions').evaluate(el=>el.open))await page.locator('#renderedViewOptions>summary').click();};
const more=async page=>{if(!await page.locator('#correctionMore').evaluate(el=>el.open))await page.locator('#correctionMore>summary').click();};
const files=async page=>{if(!await page.locator('#correctionFiles').isVisible()){await more(page);await page.locator('#correctionFilesButton').click();}};
const back=async page=>{if(await page.locator('#correctionFiles').isVisible())await page.locator('#correctionFiles .dialog-head button').click();await page.locator(await page.locator('#correctionBack').isVisible()?'#correctionBack':'#sharedProject').click();};
const submitForm=async page=>{if(await page.locator('#correctionMore').isVisible()){await more(page);await page.locator('#correctionSubmitFindings').click();}else await page.locator('#sharedSubmit').click();};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
export async function runSharedRevisions({browser,serve,evidence,root}){
  const directory=resolve(evidence,'revisions'),repo=resolve(directory,'repo'),site=resolve(directory,'site');
  const slug='simulated-rendering-revisions',piece=resolve(repo,'pieces',slug),renderPath=resolve(site,'pieces',slug,'score.pdf');
  const contexts=[],actors={},log=[],serviceLog=[];let processHandle,staticServer,serviceURL,assertions=0;
  const check=(ok,label)=>{assert(ok,label);assertions++;log.push('PASS '+label);console.log('revisions: '+label);};
  const python=process.env.OPUS_PYTHON||'python';
  const compile=(source,pdf)=>{
    const output=execFileSync(python,['-B','-c','import sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from trusted_browser_fixtures import compile_trusted_fixture; compile_trusted_fixture(Path(sys.argv[2]),Path(sys.argv[3]))',resolve(root,'scripts'),source,pdf],{cwd:root,encoding:'utf8',stdio:'pipe'});
    log.push('LILYPOND '+output.trim());
  };
  const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:'pipe'}).trim();
  const commit=label=>{git('add','pieces');git('-c','user.name=OPUS simulated test','-c','user.email=simulated@example.invalid','commit','--quiet','-m',label);return git('rev-parse','HEAD');};
  async function api(path,{method='GET',body,token,expected=200}={}){
    const response=await fetch(serviceURL+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return value;
  }
  const state=()=>api('/api/works/'+slug),proposal=id=>api('/api/proposals/'+id);
  async function actor(name,proposalId){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(30000);contexts.push(context);
    const page=await context.newPage();actors[name]=page;page.on('pageerror',error=>log.push('BROWSER ERROR '+error.message));
    await page.goto(staticServer.url+'contributor/score/?piece='+slug+(proposalId?'&proposal='+proposalId:''));
    if(proposalId){await opened(page);await project(page);}else await page.locator('#sharedDialog').waitFor({state:'visible'});
    await page.locator('#sharedDevLogin').fill(name);await page.locator('#sharedDevForm button').click();
    await page.waitForFunction(name=>document.querySelector('#sharedIdentity').textContent.includes('@'+name),name);
    if(proposalId){await page.locator('#sharedClose').click();await opened(page);}
    return page;
  }
  async function opened(page){await page.waitForFunction(()=>!document.querySelector('#sharedDialog').open&&!document.querySelector('#sharedProposalPanel').hidden&&!document.querySelector('#sharedProposalPanel').getAttribute('aria-busy'));}
  async function project(page){if(!await page.locator('#sharedDialog').isVisible())await back(page);}
  async function finding(page,text){await page.locator(await page.locator('#reportAnotherError').isVisible()?'#reportAnotherError':'#newFinding').click();await page.locator('#comment').fill(text);await page.locator('#saveFinding').click();await page.waitForFunction(()=>document.querySelector('#storage').textContent==='Saved locally');}
  async function form(page){if(await page.locator('#sharedDialog').isVisible())await page.locator('#sharedClose').click();await submitForm(page);await page.locator('#sharedReportForm').waitFor({state:'visible'});}
  async function submit(page){await page.locator('#sharedSendReport').click();await page.waitForFunction(()=>document.querySelector('#sharedReportForm').hidden&&new URL(location.href).searchParams.has('report'));return new URL(page.url()).searchParams.get('report');}
  async function task(page){await project(page);await page.locator('#sharedFixPath').click();await page.locator('#sharedGetTask').click();await page.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.startsWith('Correction package saved'),null,{timeout:120000});const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#sharedTaskDownloads a').click()]);return readFile(await download.path());}
  async function approve(page,index){await chooseProblem(page,index);await responseEditor(page);await page.locator('#sharedDecisionExplanation').fill('SIMULATED independent workflow check; no musical verification.');await page.locator('#cancelCorrectionResponse').click();const response=page.waitForResponse(r=>r.url().endsWith('/decisions')&&r.request().method()==='POST');await page.locator('#sharedLooksCorrect').click();assert.equal((await response).status(),200);await page.waitForFunction(()=>document.querySelector('#message').textContent==='Decision confirmed by the project.'&&document.querySelector('#sharedLooksCorrect')?.disabled===false);}
  async function canonical(page){await files(page);const before=new URL(page.url()).searchParams.get('proposal');await page.locator('#sharedUseProjectPdf').click();await page.waitForFunction(before=>!document.querySelector('#sharedDialog').open&&new URL(location.href).searchParams.get('proposal')!==before&&document.querySelector('#sharedProposalPanel').dataset.proposalId===new URL(location.href).searchParams.get('proposal'),before);return new URL(page.url()).searchParams.get('proposal');}
  try{
    await mkdir(piece,{recursive:true});await mkdir(resolve(site,'pieces',slug),{recursive:true});await mkdir(resolve(directory,'compiler'),{recursive:true});
    const source=Buffer.from(await (await fixtureBlob('source.pdf')).arrayBuffer());
    const code=Buffer.from('% SIMULATED regression fixture; not a transcription\n\\version "2.24.3"\n\\header { title = "SIMULATED baseline" }\n{ c\'1 }\n');
    const changed=Buffer.from('% SIMULATED changed-code fixture; not a correction\n\\version "2.24.3"\n\\header { title = "SIMULATED proposed version" }\n{ c\'4 e\'4 g\'4 c\'\'4 }\n');
    const proposedLy=resolve(directory,'compiler','proposed.ly'),proposedPdf=resolve(directory,'compiler','proposed.pdf');
    await writeFile(resolve(piece,'score.ly'),code);compile(resolve(piece,'score.ly'),renderPath);
    await writeFile(proposedLy,changed);compile(proposedLy,proposedPdf);const suppliedPdf=await readFile(proposedPdf);
    await writeFile(resolve(piece,'metadata.json'),json({slug,title:'SIMULATED rendering revision test',composer:'Synthetic fixture',step:3,models:['simulated/test-only'],verified_by:null,source_sha256:sha(source),source_pdf:'https://example.invalid/SIMULATED-source.pdf',source_page:'https://example.invalid/SIMULATED',source_id:'SIMULATED-NOT-A-SCORE'}));
    for(const name of ['AGENTS.md','HANDBOOK.md'])await writeFile(resolve(repo,name),await readFile(resolve(root,name)));
    git('init','--initial-branch=main','--quiet');commit('SIMULATED baseline');
    execFileSync(python,['-B','-c','import sys; from pathlib import Path; sys.path.insert(0,"scripts"); import build_site; build_site.copy_contributor_assets(Path(sys.argv[1]))',site],{cwd:root,stdio:'pipe'});
    const config={apiBase:null};staticServer=await serve(site,{prefix:'/revision-preview/',config});
    processHandle=spawn(python,['-B',resolve(root,'service/opus_service.py'),'--repo',repo,'--site-root',site,'--data-dir',resolve(directory,'data'),'--port','0','--allow-origin',staticServer.origin,'--dev-auth'],{cwd:root,env:{...process.env,OPUS_MAINTAINER_IDS:'dev:david'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='';for(const stream of [processHandle.stdout,processHandle.stderr])stream.on('data',data=>{output+=data;serviceLog.push(String(data));});
    const deadline=Date.now()+15000;while(!/OPUS shared service: (http:\/\/[^\s]+)/.test(output)){if(processHandle.exitCode!==null||Date.now()>deadline)throw new Error('Service startup failed: '+output);await pause(50);}
    serviceURL=output.match(/OPUS shared service: (http:\/\/[^\s]+)/)[1];config.apiBase=serviceURL;
    const maintainer=await api('/auth/dev',{method:'POST',body:{login:'david'}});
    assert.equal((await fetch(serviceURL+'/api/works/'+slug+'/assets/source',{method:'POST',headers:{Authorization:'Bearer '+maintainer.token,'Content-Type':'application/pdf'},body:source})).status,200);
    const original=await state(),alice=await actor('alice');await alice.locator('#sharedReportPath').click();
    await alice.waitForFunction(()=>!document.querySelector('#sharedDialog').open&&document.querySelector('#renderedPaper').getAttribute('aria-busy')==='false');
    for(let i=1;i<=3;i++)await finding(alice,'SIMULATED original error '+i);await form(alice);await submit(alice);
    const zipModule={exports:{}};Function('module','exports',await readFile(resolve(root,'contributor/score/vendor/jszip.min.js'),'utf8'))(zipModule,zipModule.exports);const JSZip=zipModule.exports;
    const bob=await actor('bob'),issued=await JSZip.loadAsync(await task(bob)),issuedTask=JSON.parse(await issued.file('task.json').async('string'));
    const ids=issuedTask.findings.map(item=>item.id),response=JSON.parse(await issued.file('response-template.json').async('string'));
    response.code={status:'changed',path:'proposed.ly'};response.rendering={status:'pending',path:null,producer:'SIMULATED AI fixture',compiler:null};response.files={'proposed.ly':{size:changed.length,sha256:sha(changed)}};
    response.results.forEach(item=>{item.status='changed';item.explanation='SIMULATED returned change for regression testing.';});
    const responseBytes=await new JSZip().file('proposed.ly',changed).file('response.json',json(response)).generateAsync({type:'nodebuffer'});
    await bob.locator('#sharedResponseFile').setInputFiles({name:'SIMULATED-pending.zip',mimeType:'application/zip',buffer:responseBytes});await bob.waitForFunction(()=>document.querySelector('#sharedStatus').textContent.startsWith('AI response submitted'));
    const parentId=new URL(bob.url()).searchParams.get('proposal'),carol=await actor('carol',parentId);await files(carol);
    check(await carol.locator('#sharedLooksCorrect').isDisabled()&&await carol.locator('#sharedAddProposalPdf').isVisible(),'fresh browser can add the missing PDF to a changed-code response');
    await carol.locator('#sharedPdfProducer').fill('SIMULATED test compiler');await carol.locator('#sharedProposalPdf').setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-invalid')});await carol.locator('#sharedAddProposalPdf').click();
    await carol.waitForFunction(()=>document.querySelector('#message').dataset.error==='true');
    check((await state()).proposals.length===1&&!(await proposal(parentId)).candidate.renderSha256,'invalid PDF creates no shared revision');
    await carol.locator('#sharedProposalPdf').setInputFiles({name:'SIMULATED-proposed.pdf',mimeType:'application/pdf',buffer:suppliedPdf});await carol.locator('#sharedPdfProducer').fill('SIMULATED test compiler');await carol.locator('#sharedPdfCompiler').fill('LilyPond '+execFileSync('lilypond',['--version'],{encoding:'utf8'}).split('\n')[0]);
    await carol.context().route('**/renderings',async route=>{await route.fetch();await route.abort('connectionfailed');});await carol.locator('#sharedAddProposalPdf').click();
    await carol.waitForFunction(()=>document.querySelector('#message').textContent.includes('could not be reached'));
    check((await state()).proposals.length===2,'lost attachment acknowledgement retains exactly one immutable revision');
    await carol.context().unroute('**/renderings');await project(carol);await carol.locator('#sharedPending button').click();await carol.waitForFunction(parent=>document.querySelector('#sharedPending').textContent===''&&new URL(location.href).searchParams.get('proposal')!==parent,parentId);
    const uploadedId=new URL(carol.url()).searchParams.get('proposal'),uploaded=await proposal(uploadedId);
    check(uploadedId!==parentId&&uploaded.parentProposalId===parentId&&uploaded.candidate.codeSha256===sha(changed)&&uploaded.candidate.renderSha256===sha(suppliedPdf)&&(await state()).proposals.length===2,'retry returns the attached PDF revision bound to the exact proposed code');
    const david=await actor('david',uploadedId);check((await proposal(uploadedId)).findings.every(item=>!item.decision),'attached rendering starts with no inherited approval');
    await david.locator('#renderedZoom').selectOption('1.5');
    await viewOptions(david);await david.locator('#locateCorrectedPassage').click();await david.waitForFunction(()=>document.querySelector('#correctionNotice').textContent.startsWith('Passage remembered'));
    check((await proposal(uploadedId)).findings[0].location.position.zoom===1.5&&(await proposal(uploadedId)).findings.every(f=>!f.decision),'shared location persists independently of approval');
    const locator=await actor('location-reader',uploadedId);
    await viewOptions(locator);check((await locator.locator('#correctionAlignment').innerText()).includes('remembered')&&await locator.locator('#renderedZoom').inputValue()==='1.5','fresh-browser shared handoff restores the exact candidate location');
    await more(locator);const [comparisonDownload]=await Promise.all([locator.waitForEvent('download'),locator.locator('#saveComparisonPackage').click()]);
    const packageContext=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(packageContext);const packagePage=await packageContext.newPage();
    await packagePage.goto(staticServer.url+'contributor/score/');await packagePage.waitForFunction(()=>document.body.dataset.ready==='true');
    await packagePage.locator('#packageFile').setInputFiles({name:'SIMULATED-shared-comparison.zip',mimeType:'application/zip',buffer:await readFile(await comparisonDownload.path())});
    await packagePage.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false'&&document.querySelector('#looksCorrect'));
    await viewOptions(packagePage);await more(packagePage);check((await packagePage.locator('#correctionAlignment').innerText()).includes('remembered')&&await packagePage.locator('#renderedZoom').inputValue()==='1.5'&&(await packagePage.locator('#correctionProgress').innerText()).startsWith('0 of '),'shared comparison package round-trip retains bookmarks without importing service approval authority');
    await david.context().route('**/decisions',async route=>{await route.fetch();await route.abort('connectionfailed');});
    await responseEditor(david);await david.locator('#sharedDecisionExplanation').fill('SIMULATED retained explanation after lost acknowledgment');await david.locator('#cancelCorrectionResponse').click();await david.locator('#sharedLooksCorrect').click();
    await david.waitForFunction(()=>document.querySelector('#correctionNotice').textContent.includes('could not be reached'));
    check(await david.locator('#sharedProposalFinding').evaluate(el=>el.value)==='0'&&(await david.locator('#sharedDecisionExplanation').inputValue()).includes('retained explanation'),'uncertain shared save does not advance or discard the decision draft');
    await david.context().unroute('**/decisions');await david.locator('#sharedLooksCorrect').click();
    await david.waitForFunction(()=>document.querySelector('#sharedProposalFinding').value==='1'&&document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false');
    check((await proposal(uploadedId)).findings[0].decisionVersion===1,'retry acknowledges one durable decision then advances');
    await responseEditor(locator);await locator.locator('#sharedDecisionExplanation').fill('SIMULATED competing stale review');await locator.locator('#cancelCorrectionResponse').click();await locator.locator('#sharedLooksCorrect').click();
    await locator.waitForFunction(()=>document.querySelector('#correctionNotice').textContent.includes('Another reviewer'));
    check(await locator.locator('#sharedProposalFinding').evaluate(el=>el.value)==='0'&&await locator.locator('#sharedDecisionExplanation').inputValue()==='SIMULATED competing stale review','shared conflict keeps the selected finding and unsent explanation');

    await chooseProblem(locator,1);await locator.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false');await responseEditor(locator);
    await locator.locator('#sharedDecisionExplanation').fill('SIMULATED the printed source is unclear at this passage.');await locator.locator('#sharedNeedsClarification').check();await locator.waitForFunction(()=>document.querySelector('#correctionDraftStatus').textContent==='Draft saved locally');await locator.locator('#cancelCorrectionResponse').click();
    check(!(await proposal(uploadedId)).findings[1].decision,'canceling a shared response preserves its draft without submitting a decision');
    await locator.reload();await opened(locator);await chooseProblem(locator,1);await locator.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false');await responseEditor(locator);
    check(await locator.locator('#sharedNeedsClarification').isChecked()&&await locator.locator('#sharedDecisionExplanation').inputValue()==='SIMULATED the printed source is unclear at this passage.','shared explanation and clarification choice survive Cancel and reload');
    await locator.locator('#sendCorrectionResponse').click();await locator.locator('#sharedDialog').waitFor({state:'visible'});
    check(!(await proposal(uploadedId)).findings[1].decision&&await locator.locator('#sharedDecisionExplanation').inputValue()==='SIMULATED the printed source is unclear at this passage.','expired test sign-in keeps the shared response draft and submits no decision');
    await locator.locator('#sharedDevLogin').fill('location-reader');await locator.locator('#sharedDevForm button').click();await locator.waitForFunction(()=>document.querySelector('#sharedIdentity').textContent.includes('@location-reader'));await locator.locator('#sharedClose').click();
    await locator.locator('#sendCorrectionResponse').click();await locator.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false'&&document.querySelector('#correctionResponse').hidden);
    check((await proposal(uploadedId)).findings[1].decision.state==='needs_clarification','shared Send records the existing source-clarification decision state');

    const eve=await actor('eve',uploadedId);await finding(eve,'SIMULATED newly discovered error in the proposed score');await form(eve);const candidateReportId=await submit(eve),candidateReport=await api('/api/reports/'+candidateReportId);
    check(candidateReport.reviewed.snapshotId===uploaded.candidate.snapshotId&&candidateReport.reviewed.proposalId===uploadedId&&candidateReport.findings[0].annotation.strokes.length===0,'new text finding receives a durable receipt on the unmerged candidate');
    const frank=await actor('frank',uploadedId);await form(frank);await frank.locator('input[name=sharedScope][value=whole]').check();await frank.locator('#sharedScopeNote').fill('SIMULATED complete candidate check');await frank.locator('#sharedClean').check();const cleanId=await submit(frank),clean=await api('/api/reports/'+cleanId);
    check(clean.clean&&clean.scope.kind==='whole'&&clean.reviewed.proposalId===uploadedId&&clean.reviewed.snapshotId===uploaded.candidate.snapshotId,'explicit whole clean review is retained against the unmerged candidate');
    check((await state()).current.snapshotId===original.current.snapshotId&&(await state()).work.verified_by===null&&(await state()).findings.every(item=>item.state!=='resolved'),'candidate reports preserve canonical files, verification and other outstanding reports');
    await writeFile(resolve(piece,'score.ly'),changed);const mergedCommit=commit('SIMULATED merged proposed code');compile(resolve(piece,'score.ly'),renderPath);const rebuilt=await readFile(renderPath);
    check(sha(rebuilt)!==sha(suppliedPdf),'hardcoded synthetic fixture recompiles into different PDF bytes (UI regression, not isolation evidence)');
    const application=(id,selected,requestId)=>api('/api/works/'+slug+'/applications',{method:'POST',token:maintainer.token,body:{requestId,proposalId:id,findingIds:selected,repositoryRevision:mergedCommit,pullRequest:'https://github.com/the-opus-project/the-opus-project.github.io/pull/999999'}});
    await api('/api/works/'+slug+'/applications',{method:'POST',token:maintainer.token,expected:409,body:{requestId:'premature-rebuilt',proposalId:uploadedId,findingIds:[ids[0]],repositoryRevision:mergedCommit,pullRequest:'https://github.com/the-opus-project/the-opus-project.github.io/pull/999999'}});
    check((await state()).findings.every(item=>item.state!=='resolved'),'old PDF approval cannot apply the rebuilt PDF');
    const canonicalId=await canonical(david),canonicalProposal=await proposal(canonicalId);
    check(canonicalId!==uploadedId&&canonicalProposal.candidate.renderSha256===sha(rebuilt)&&canonicalProposal.findings.every(item=>!item.decision&&!item.location)&&(await proposal(uploadedId)).findings[0].decision.reviewed.renderSha256===sha(suppliedPdf),'canonical build becomes a new review target and old approvals remain on old bytes');
    const grace=await actor('grace',canonicalId);await approve(grace,0);const applied=await application(canonicalId,[ids[0]],'partial-canonical-application');
    check(applied.repositoryRevision===mergedCommit&&applied.candidate.renderSha256===sha(rebuilt)&&applied.candidate.codeSha256===sha(changed)&&applied.candidate.sourceSha256===sha(source),'application records the exact approved canonical source, code, PDF and commit');
    const helen=await actor('helen',canonicalId);await chooseProblem(helen,0);
    await files(helen);check((await helen.locator('.shared-proposal-state').innerText()).includes('1 of 3'),'fresh browser shows partial application');await helen.locator('#correctionFiles .dialog-head button').click();await more(helen);check((await helen.locator('#sharedFindingStatus').innerText()).includes('Applied'),'fresh browser shows partial application and the selected applied finding');
    await chooseProblem(helen,1);await helen.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false');await more(helen);check(!(await helen.locator('#sharedFindingStatus').innerText()).includes('Applied')&&new Set((await proposal(canonicalId)).applied.flatMap(a=>a.findingIds)).size===1,'finding navigation marks only the applied finding');
    await project(helen);check((await helen.locator(`article[data-proposal-id="${canonicalId}"]`).innerText()).includes('1 of 3'),'proposal card shows partial rather than complete application');
    const laterZip=await JSZip.loadAsync(await task(helen)),laterTask=JSON.parse(await laterZip.file('task.json').async('string')),candidateFinding=laterTask.findings.find(item=>item.reportId===candidateReportId),snapshot=JSON.parse(await laterZip.file('shared/snapshot.json').async('string'));
    check(!laterTask.findings.some(item=>item.id===ids[0])&&ids.slice(1).every(id=>laterTask.findings.some(item=>item.id===id)),'next task excludes only the applied finding');
    check(candidateFinding?.page===null&&candidateFinding.historicalContext.originalFiles.rendered.sha256===sha(suppliedPdf)&&snapshot.reports.some(item=>item.id===cleanId&&item.reviewed.proposalId===uploadedId),'later canonical task preserves candidate reports, clean declaration and original rendering context');
    for(let index=1;index<ids.length;index++)await approve(grace,index);await application(canonicalId,ids.slice(1),'remaining-canonical-application');
    const iris=await actor('iris',canonicalId);await files(iris);check((await iris.locator('.shared-proposal-state').innerText()).includes('3 of 3')&&(await state()).findings.filter(item=>item.state==='resolved').length===3,'whole-proposal completion appears only after every original finding is applied');
    const last=await JSZip.loadAsync(await task(iris)),lastTask=JSON.parse(await last.file('task.json').async('string'));check(lastTask.findings.length===1&&lastTask.findings[0].reportId===candidateReportId,'new candidate finding remains outstanding after the original corrections are applied');
    compile(resolve(piece,'score.ly'),renderPath);check(sha(await readFile(renderPath))!==sha(rebuilt),'a later real build has another exact rendering identity');
    await api('/api/works/'+slug+'/applications',{method:'POST',token:maintainer.token,expected:409,body:{requestId:'unreviewed-later-build',proposalId:canonicalId,findingIds:[ids[0]],repositoryRevision:mergedCommit,pullRequest:'https://github.com/the-opus-project/the-opus-project.github.io/pull/999999'}});
    check(true,'a different unreviewed rendering still cannot use earlier approval');
    const latestId=await canonical(david),latest=await proposal(latestId);
    git('-c','user.name=OPUS simulated test','-c','user.email=simulated@example.invalid','commit','--allow-empty','--quiet','-m','SIMULATED new canonical commit, same PDF');
    const samePdfCommit=git('rev-parse','HEAD'),samePdfId=await canonical(david),samePdf=await proposal(samePdfId);
    check(samePdfId!==latestId&&samePdf.candidate.renderSha256===latest.candidate.renderSha256&&samePdf.candidate.canonicalRepositoryRevision===samePdfCommit&&samePdfCommit!==mergedCommit,'same PDF at a new canonical commit receives its own review receipt');
    check(samePdf.findings.every(item=>!item.decision),'same-byte canonical recapture does not inherit earlier decisions');
    check(!log.some(line=>line.startsWith('BROWSER ERROR')),'revision workflow completed without uncaught browser errors');
    await iris.screenshot({path:resolve(evidence,'rendering-revision-complete.png'),fullPage:true});
    return {name:'changed code, rendering revisions and candidate reports',assertions};
  }catch(error){log.push('FAIL '+error.stack);for(const [name,page]of Object.entries(actors))try{await writeFile(resolve(evidence,'revisions-failure-'+name+'.txt'),await page.locator('body').innerText());await page.screenshot({path:resolve(evidence,'revisions-failure-'+name+'.png'),fullPage:true});}catch{}throw error;}
  finally{await writeFile(resolve(evidence,'revisions.txt'),log.join('\n')+'\n');for(const context of contexts)await context.close();processHandle?.kill();await staticServer?.close();await writeFile(resolve(evidence,'revisions-service.txt'),serviceLog.join(''));}
}

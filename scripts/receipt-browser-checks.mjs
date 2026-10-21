import {resolve} from 'node:path';

// Real submissions and failed HTTP requests in the revision suite's disposable
// service. In particular, no new draft intervenes between A and a failed decision.
export async function checkReceiptFollowups({actor,proposalId,state,api,evidence,check}){
  const settled=p=>p.waitForFunction(()=>document.querySelector('#correctionComparison').getAttribute('aria-busy')==='false'&&document.querySelector('#renderedPaper').getAttribute('aria-busy')==='false'&&document.querySelector('#correctionAI>summary').textContent===(matchMedia('(max-width:1100px)').matches?'AI changes':'What the AI changed'));
  const layout=p=>p.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const ids=['correctionHeader','correctionComparison','renderedScroll','correctionProgress','correctionBack','correctionMore','notices','noticeCopy','dismissMessage','emergency'];
    const boxes=Object.fromEntries(ids.map(id=>[id,rect(id)]));
    const hit=id=>{const el=document.getElementById(id),r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el.hidden||el===at||el.contains(at);};
    const visible=id=>!document.getElementById(id).hidden;
    const copy=boxes.noticeCopy;
    return {boxes,headerOverflow:document.getElementById('correctionHeader').scrollWidth>innerWidth,
      readable:hit('noticeCopy'),dismiss:hit('dismissMessage'),recovery:hit('emergency'),
      separated:['dismissMessage','emergency'].every(id=>!visible(id)||copy.right<=boxes[id].x),
      progressClear:boxes.correctionProgress.right<=boxes.notices.x,
      font:parseFloat(getComputedStyle(document.getElementById('message')).fontSize),
      fullLines:copy.height>=Math.min(30,document.getElementById('noticeCopy').scrollHeight)};
  });
  const stable=(a,b)=>['correctionHeader','correctionComparison','renderedScroll','correctionProgress','correctionBack','correctionMore'].every(id=>['x','y','width','height'].every(k=>Math.abs(a.boxes[id][k]-b.boxes[id][k])<1));
  const clear=async(p,before,label)=>{await p.locator('#dismissMessage').click();await settled(p);check(await p.locator('#message').isHidden()&&stable(before,await layout(p)),label+' dismissal keeps the score panes fixed');};
  const submit=async p=>{await p.locator('#submitCorrectionError').click();await settled(p);await p.locator('#correctionErrorReceipt').waitFor({state:'visible'});return new URL(await p.locator('#correctionErrorReceipt').getAttribute('href')).searchParams.get('report');};
  for(const [width,height]of [[390,844],[680,499],[785,442],[1440,900]]){
    const page=await actor('receipt-followup-'+width,proposalId);await page.setViewportSize({width,height});await settled(page);
    const idle=await layout(page),a=`SIMULATED error A at ${width}: check the slur in bar 2.`,b=`SIMULATED error B at ${width}: check the accidental in bar 5.`,start=await state();
    await page.locator('#reportAnotherError').click();await page.locator('#comment').fill(a);const receiptA=await submit(page);
    const receivedA=await layout(page);
    check(stable(idle,receivedA),`${width}: confirmed A does not move the score panes${stable(idle,receivedA)?'':JSON.stringify({idle,receivedA})}`);
    const afterA=await state();check(afterA.reports.length===start.reports.length+1&&afterA.findings.length===start.findings.length+1,`${width}: A has one actual service report and finding`);
    await page.route('**/decisions',route=>route.abort());await page.locator('#sharedLooksCorrect').click();await settled(page);
    await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('could not be reached'));
    const failure=await layout(page);
    check(failure.readable&&failure.dismiss&&failure.separated&&failure.progressClear&&!failure.headerOverflow&&failure.font>=12&&failure.fullLines&&stable(idle,failure),`${width}: post-receipt decision failure is readable, actionable, separate from progress and stable`);
    check(await page.locator('#correctionErrorReceipt').isHidden(),`${width}: A receipt cannot cover a later decision failure`);
    await page.screenshot({path:resolve(evidence,`receipt-failed-decision-${width}.png`)});await clear(page,idle,`${width}: decision failure`);await page.unroute('**/decisions');
    const long='SIMULATED decision was not saved. The project is temporarily unavailable while its storage connection is restored. Your selected problem and explanation remain on this device. Reconnect, then retry this same decision safely.';
    await page.route('**/decisions',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:long})}));await page.locator('#sharedLooksCorrect').click();await settled(page);
    check(await page.locator('#message').textContent()===long&&(await layout(page)).readable&&stable(idle,await layout(page)),`${width}: longer failure preserves its full text without shifting the score`);
    await page.locator('#noticeCopy').focus();await page.locator('#noticeCopy').press('End');
    await page.waitForFunction(()=>{const el=document.getElementById('noticeCopy');return el.scrollTop+el.clientHeight>=el.scrollHeight-1;});
    check((await layout(page)).dismiss&&(await layout(page)).separated,`${width}: full long message is keyboard-readable and dismissal remains uncovered`);
    await page.screenshot({path:resolve(evidence,`receipt-long-failure-${width}.png`)});await clear(page,idle,`${width}: long failure`);await page.unroute('**/decisions');
    // Recover A through the existing annotation editor and idempotent submission,
    // so B begins immediately after a visible confirmed A receipt.
    await page.locator('#reportAnotherError').click();await page.locator('#toggleComments').click();
    await page.locator('.finding-open').filter({hasText:a}).click();await submit(page);
    check((await state()).reports.length===afterA.reports.length,`${width}: reopening and resubmitting A reuses its receipt`);
    await page.locator('#reportAnotherError').click();await page.locator('#comment').fill(b);
    check(await page.locator('#correctionErrorReceipt').isHidden()&&!(await page.locator('#message').innerText()).includes('received'),`${width}: unsent B is never presented as received`);
    const editing=await layout(page);await page.route('**/reports',route=>route.abort());await page.locator('#submitCorrectionError').click();await settled(page);
    const failedB=await state();
    check(failedB.reports.length===afterA.reports.length&&failedB.findings.length===afterA.findings.length&&await page.locator('#comment').inputValue()===b&&await page.locator('#comment').isEditable(),`${width}: aborted B adds no service record and keeps its exact editable draft`);
    check(await page.locator('#correctionErrorReceipt').isHidden()&&(await layout(page)).readable&&(await layout(page)).dismiss&&stable(editing,await layout(page)),`${width}: failed B has no stale confirmation or notification overlap`);
    await page.screenshot({path:resolve(evidence,`receipt-second-error-failed-${width}.png`)});
    await page.locator('#correctionMore>summary').click();await page.locator('#correctionReceipts>summary').click();
    check(await page.locator(`#correctionReceipts [data-receipt-id="${receiptA}"]`).isVisible()&&(await page.locator('#correctionReceipts').innerText()).includes(a),`${width}: A remains accessible as a specifically identified earlier receipt`);await page.locator('#correctionMore>summary').click();
    await page.unroute('**/reports');const receiptB=await submit(page),confirmed=await state(),report=await api('/api/reports/'+receiptB);
    check(receiptB!==receiptA&&report.findings[0].comment===b&&report.reviewed.proposalId===proposalId&&confirmed.reports.length===afterA.reports.length+1&&confirmed.findings.length===afterA.findings.length+1,`${width}: retry creates exactly one B report and binds its own receipt to the exact candidate`);
    check(await page.locator('#editor').isHidden()&&await page.locator('#correctionErrorReceipt').isVisible()&&stable(idle,await layout(page)),`${width}: confirmed B closes its editor without changing the idle score layout`);
    await page.screenshot({path:resolve(evidence,`receipt-second-error-confirmed-${width}.png`)});
    await clear(page,idle,`${width}: confirmed B`);
  }
}

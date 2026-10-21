import {SharedClient, sharedConfiguration} from './shared-client.js';
import {loadSharedWork, prepareSharedReport, makeSharedTask, loadSharedTask, readSharedResponse, loadSharedProposal, blobBase64} from './shared-packages.js';
import {clone, sha256} from './model.js';
import {canonical} from './completion-model.js';
import {contextPaths, taskFindings} from './workflow.js';

const $ = id => document.getElementById(id);
const idPart = value => encodeURIComponent(value);
const identity = user => user ? `@${user.login}${user.provenance === 'simulated-development-identity' ? ' · test account' : ''}` : 'Reading without signing in';
const contentKey = async value => sha256(new TextEncoder().encode(canonical(value)));
export function proposalApplications(record) {
  const findings = record?.findings ?? record?.task?.findings ?? [];
  const applicable = new Set(findings.map(finding => finding.id));
  const ids = new Set((record?.applied ?? []).flatMap(event => event.findingIds ?? []).filter(id => applicable.has(id)));
  return {ids, applied: ids.size, total: applicable.size, complete: applicable.size > 0 && ids.size === applicable.size};
}
const applicationLabel = record => { const summary = proposalApplications(record); return `${summary.applied} of ${summary.total} findings applied to the project`; };
export function proposalFindingState(record, findingId) {
  if (proposalApplications(record).ids.has(findingId)) return 'Applied to the project';
  const finding = record?.findings?.find(item => item.id === findingId), decision = finding?.decision ?? finding?.decisions?.at(-1);
  return ({looks_correct: 'Looks correct · awaiting application', needs_correction: 'Still needs correction', needs_clarification: 'Needs clarification'})[decision?.state] ?? 'Waiting to be checked';
}
export function proposalReportIdentity(loaded, review) {
  if (!loaded) return null;
  const candidate = loaded.proposal?.candidateCurrent;
  if (!loaded.seed || !candidate) throw new Error('Add the proposed PDF before reporting on these corrections, or open the project score to report on that version.');
  if (candidate.snapshotId !== review?.snapshotId || ['source', 'rendered', 'ly'].some(role => candidate.files?.[role]?.sha256 !== review?.files?.[role]?.sha256)) throw new Error('The displayed score differs from this proposal. Reopen its exact version before submitting findings.');
  return loaded.proposal.id;
}
export function reportFindingSelection({submitted, checked, coverageChecked}, scoped) {
  if (!submitted) return {checked, disabled: false};
  const selected = typeof coverageChecked === 'boolean' ? coverageChecked : true;
  return {checked: scoped && selected, disabled: !scoped, coverageChecked: selected};
}
const submissionKind = path => path.includes('/reports') ? 'report' : path === '/api/tasks' ? 'task' : path === '/api/proposals' || /^\/api\/proposals\/[^/]+\/renderings$/.test(path) ? 'proposal' : null;
function node(tag, text, className) { const element = document.createElement(tag); if (text != null) element.textContent = text; if (className) element.className = className; return element; }
function action(text, handler, className) { const button = node('button', text, className); button.type = 'button'; button.onclick = handler; return button; }

// A work selection can change while its public read is in flight. Only the
// latest read for the still-selected work is allowed to reach the UI.
export function createCurrentWorkReader(read, selection) {
  let generation = 0;
  return async () => {
    const slug = selection(), current = ++generation;
    if (!slug) return null;
    let detail;
    try { detail = await read(slug); }
    catch (error) { if (current !== generation || selection() !== slug) return null; throw error; }
    if (current !== generation || selection() !== slug) return null;
    if ((detail?.workId ?? detail?.work?.slug) !== slug) throw new Error('The project service returned a different work. Refresh the selected work before continuing.');
    return detail;
  };
}

export function matchingReportDraft(draft, {workId, snapshotId, mode, findingIds}) {
  if (!draft || draft.version !== 1 || draft.workId !== workId || draft.snapshotId !== snapshotId || draft.mode !== mode) return null;
  if (![null, 'report', 'partial', 'whole'].includes(draft.scope) || typeof draft.clean !== 'boolean' || !Array.isArray(draft.findings)) return null;
  for (const key of ['scopeNote', 'displayName', 'discussionUrl', 'discussionAuthor', 'discussionSummary']) if (typeof draft[key] !== 'string') return null;
  const allowed = new Set(findingIds);
  return {...draft, findings: draft.findings.filter(finding => allowed.has(finding.id) && typeof finding.checked === 'boolean' && (finding.coverageChecked === undefined || typeof finding.coverageChecked === 'boolean') && ['transcription', 'source_error', 'clarification'].includes(finding.kind))};
}

export function installShared(api) {
  // This template is constant application markup. All contributor/imported text is assigned as textContent/value below.
  const template = document.createElement('template');
  template.innerHTML = `<dialog id="sharedDialog" aria-labelledby="sharedTitle">
    <div class="dialog-head"><h2 id="sharedTitle">Project contributions</h2><button id="sharedClose" type="button" aria-label="Close project contributions">Close</button></div>
    <p>Choose how to help.</p>
    <div class="shared-session"><span id="sharedIdentity">Loading shared project…</span><button id="sharedSignIn" type="button">Sign in with GitHub</button><button id="sharedSignOut" type="button" hidden>Sign out</button></div>
    <form id="sharedDevForm" hidden><label>Local test identity <input id="sharedDevLogin" maxlength="80" placeholder="alice" autocomplete="off"></label><button type="submit">Use test identity</button><small>Local development only. This does not identify a real GitHub account.</small></form>
    <p id="sharedStatus" role="status" aria-live="polite"></p>
    <div id="sharedPending"></div>
    <div id="sharedAvailable" hidden>
      <div class="shared-work-picker"><label>Work <select id="sharedWork"></select></label><button id="sharedRefresh" type="button">Refresh</button></div>
      <h3 id="sharedWorkTitle"></h3><details><summary>Version details</summary><p id="sharedRevision"></p></details>
      <section id="sharedSourceFallback" hidden><p>The library download failed. Save the PDF using the link below, then select it here.</p><a id="sharedLibrary" target="_blank" rel="noopener noreferrer">Open the printed source</a><label>Printed PDF <input id="sharedSourceFile" type="file" accept=".pdf,application/pdf"></label><button id="sharedUploadSource" type="button">Use this PDF</button></section>
      <nav class="shared-paths" aria-label="Ways to contribute">
        <button id="sharedReportPath" type="button"><b>Proofread</b><span>Find errors in the current project score.</span></button>
        <button id="sharedFixPath" type="button"><b>Send corrections to AI</b><span>Download reported errors and instructions for your AI.</span></button>
        <button id="sharedReviewFixesPath" type="button"><b>Check AI corrections</b><span>Open an AI’s proposed version and check its changes.</span></button>
      </nav>
      <button id="sharedOpenScore" type="button">Open score</button>
      <form id="sharedReportForm" hidden>
        <h3 id="sharedReportHeading">Submit findings</h3><p id="sharedDraftNotice"></p>
        <fieldset id="sharedScopeFields"><legend>What are you submitting?</legend><label><input type="radio" name="sharedScope" value="report"> Just the errors I marked</label><label><input type="radio" name="sharedScope" value="partial"> I proofread part of the score</label><label><input type="radio" name="sharedScope" value="whole"> I proofread the whole score</label></fieldset>
        <label id="sharedScopeLabel">Pages or passages checked <textarea id="sharedScopeNote" rows="2" maxlength="4000" placeholder="For example: page 1, first two systems, right hand"></textarea></label>
        <label id="sharedCleanLabel"><input id="sharedClean" type="checkbox"> I found no errors in the part I checked.</label>
        <div id="sharedFindingChoices"></div>
        <label>Reviewer name or handle (optional) <input id="sharedDisplayName" maxlength="200" autocomplete="off"></label>
        <details><summary>Link a GitHub Discussion</summary><label>Discussion or comment link <input id="sharedDiscussionUrl" type="url" placeholder="https://github.com/…/discussions/…"></label><label>Original author or handle <input id="sharedDiscussionAuthor" maxlength="200"></label><label>Original comment <textarea id="sharedDiscussionSummary" rows="2" maxlength="4000"></textarea></label></details>
        <button id="sharedSendReport" class="primary" type="submit">Submit findings</button>
      </form>
      <section id="sharedFixSection" hidden><h3>Send corrections to AI</h3><p>Download the ZIP, attach it to your AI, and paste the instructions. Upload its response here when it’s ready.</p><button id="sharedGetTask" class="primary" type="button">Get correction package</button><button id="sharedReturnResponse" type="button">Return AI response</button><input id="sharedResponseFile" type="file" accept=".zip,application/zip" hidden><div id="sharedTaskDownloads"></div><label id="sharedPromptLabel" hidden>AI instructions<textarea id="sharedPrompt" rows="8" readonly></textarea></label><button id="sharedCopyPrompt" type="button" hidden>Copy AI instructions</button></section>
      <section id="sharedReceipt" hidden aria-label="Shared contribution receipt"></section>
      <section id="sharedRecords"><h3>Reported errors</h3><div id="sharedFindings"></div><h3>AI corrections</h3><div id="sharedProposals"></div><h3>Reports</h3><div id="sharedReports"></div></section>
      <section id="sharedMaintainer" hidden><h3>Maintainer instructions</h3><button id="sharedCopyHandoff" type="button">Copy instructions</button><textarea id="sharedHandoffText" rows="10" readonly></textarea><div id="sharedHandoffFiles"></div></section>
    </div>
  </dialog>`;
  document.body.append(template.content);
  // Core dialogs predate this optional module; register the same edit lock for the new modal.
  new MutationObserver(() => api.refreshControls()).observe($('sharedDialog'), {attributes: true, attributeFilter: ['open']});
  $('sharedProject').textContent = 'Project'; $('sharedProject').title = 'Shared project contributions';
  const localTools = node('nav', null, 'shared-local-tools'); localTools.setAttribute('aria-label', 'Local package actions');
  for (const [target, label, needsReview] of [['openPackage', 'Open package', false], ['exportTask', 'Send local findings for corrections', true], ['finishReview', 'Finish local review', true]]) {
    const button = action(label, () => $(target).click()); button.dataset.handoffAction = ''; if (needsReview) button.dataset.needsReview = ''; localTools.append(button);
  }
  $('workspaceDialog').querySelector('.handoff-actions').after(localTools);
  let client = null, detail = null, selected = null, busy = false, mode = 'report', reportScene = null, proposal = null, proposalPosition = 0;
  let taskAttempt = null, taskLinks = [], proposalImages = [], handoffLinks = [], loadedSnapshot = null, proposalRender = 0;
  let reportDraftName = null, reportLegacyDraftName = null, reportFormGeneration = 0, reportFormEdits = 0;
  const readSelectedWork = createCurrentWorkReader(slug => client.request(`/api/works/${idPart(slug)}`), () => selected);
  const status = (text, error = false) => { $('sharedStatus').textContent = text; $('sharedStatus').dataset.error = String(error); api.message(text, error); };
  const show = () => { $('workspaceDialog').close(); if (!$('sharedDialog').open) $('sharedDialog').showModal(); };
  const close = () => { if (!busy) $('sharedDialog').close(); };
  const guard = fn => async (...args) => { try { return await fn(...args); } catch (error) { status(error.message, true); if (error.status === 401) show(); return null; } };
  const run = async fn => {
    if (busy || api.status().busy) return;
    busy = true; controls();
    try { return await fn(); } finally { busy = false; controls(); }
  };
  function controls() {
    $('sharedProject').disabled = api.status().busy;
    $('sharedSubmit').hidden = !client || !selected;
    document.body.classList.toggle('shared-work-selected', Boolean(client && selected));
    $('sharedSubmit').disabled = busy || api.status().busy || !api.capture().review;
    for (const element of $('sharedDialog').querySelectorAll('button,input,textarea,select')) element.disabled = busy || element.dataset.alreadySubmitted === 'true';
    $('sharedSignIn').hidden = Boolean(client?.user) || Boolean(client?.devAuth) || !client;
    $('sharedSignOut').hidden = !client?.user;
    $('sharedDevForm').hidden = !client?.devAuth;
    if (proposal) for (const button of $('sharedProposalPanel').querySelectorAll('button,input,select,textarea')) button.disabled = busy || api.status().busy || button.dataset.sharedUnavailable === 'true';
    const correct = $('sharedLooksCorrect'); if (correct) correct.disabled = busy || api.status().busy || !proposal?.seed;
    const canonicalPdf = $('sharedUseProjectPdf'); if (canonicalPdf) canonicalPdf.hidden = !client?.user?.roles?.includes('maintainer');
  }
  function revoke(list) { for (const url of list) URL.revokeObjectURL(url); list.length = 0; }
  function download(blob, filename, label, parent, links = taskLinks) {
    const url = URL.createObjectURL(blob); links.push(url);
    const link = node('a', label, 'download'); link.href = url; link.download = filename; parent.append(link); return link;
  }
  function requireClient() { if (!client) throw new Error('Shared submission is implemented but has not been activated by the project owner. You can keep drafting and export a recovery package.'); }
  function requireUser() { requireClient(); if (!client.user) { show(); throw new Error('Sign in to submit this contribution. Your draft and selected scope are kept.'); } }
  function requireWork() { requireClient(); if (!selected || !detail?.current || (detail.workId ?? detail.work?.slug) !== selected) throw new Error('Wait for the selected project work to load before continuing.'); }
  function receiptURL(kind, id) {
    const url = new URL(location.href); url.searchParams.set('piece', selected ?? detail?.work?.slug ?? ''); url.searchParams.delete('report'); url.searchParams.delete('proposal'); url.searchParams.delete('task'); url.searchParams.set(kind, id); return url;
  }
  function actorName(record) { return record?.author ? identity(record.author) : 'Recorded contributor'; }
  function receipt(kind, record) {
    const root = $('sharedReceipt'); root.replaceChildren(); root.hidden = false;
    const id = record.id ?? record.report?.id ?? record.proposal?.id ?? record.task?.id;
    if (!id) throw new Error('The service acknowledgement has no stable record ID. Retry this same submission.');
    root.dataset.recordId = id;
    const application = proposalApplications(record), state = kind === 'proposal' ? application.complete ? 'Applied to the project' : application.applied ? 'Partly applied' : 'Awaiting review' : 'Submitted to the project';
    root.append(node('h3', state), node('p', kind === 'proposal' ? 'Your AI response is ready to check.' : 'Your submission is saved.'));
    if (kind === 'proposal' && application.total) root.append(node('p', applicationLabel(record)));
    const link = node('a', `${kind === 'report' ? 'Report' : kind === 'proposal' ? 'Proposal' : 'Task'} receipt: ${id}`); link.href = receiptURL(kind, id).href; root.append(link);
    root.append(node('p', `${actorName(record)} · ${record.createdAt ?? ''}`));
    if (kind === 'proposal') { const open = action('Check corrections', guard(() => openProposal(id)), 'primary'); open.id = 'sharedReceiptOpenProposal'; root.append(open); }
    if (kind !== 'task') root.append(action('Agent / maintainer handoff (optional)', guard(() => handoff(kind, id))));
    history.replaceState(null, '', link.href); root.scrollIntoView({block: 'nearest'});
  }
  async function refreshPending() {
    $('sharedPending').replaceChildren(); if (!client?.user) return;
    const pending = await client.pending(); if (!pending.length) return;
    $('sharedPending').append(node('p', `${pending.length} submission${pending.length === 1 ? '' : 's'} waiting to send.`));
    for (const item of pending) {
      const row = node('div', null, 'shared-retry'); row.append(node('span', `${item.path.includes('/reports') ? 'Review report' : item.path === '/api/tasks' ? 'Correction task' : item.path.endsWith('/renderings') ? 'Updated PDF' : item.path === '/api/proposals' ? 'AI response' : 'Review decision'} · ${new Date(item.createdAt).toLocaleString()}`));
      row.append(action('Retry safely', guard(() => run(async () => {
        const result = await client.write(item.path, item.body); const kind = submissionKind(item.path);
        if (result.workId && result.workId !== selected) { selected = result.workId; $('sharedWork').value = selected; await refreshWork(); }
        if (kind) receipt(kind, result); else status('Review decision acknowledged by the project.');
        await refreshPending(); if (selected) await refreshWork();
      })))); $('sharedPending').append(row);
    }
  }
  async function refreshWork() {
    const response = await readSelectedWork();
    if (!response) return null;
    detail = response; renderWork(); return detail;
  }
  function renderWork() {
    const work = detail.work ?? detail;
    $('sharedWorkTitle').textContent = [work.composer, work.title ?? work.slug ?? selected].filter(Boolean).join(' — ');
    $('sharedRevision').textContent = detail.current ? `Score: ${detail.current.repositoryRevision ?? detail.current.snapshotId}. Reports: ${detail.revision ?? 'unknown'}.` : 'Score files are not ready yet.';
    $('sharedFindings').replaceChildren();
    const outstanding = (detail.findings ?? []).filter(finding => finding.state !== 'resolved');
    if (!outstanding.length) $('sharedFindings').append(node('p', 'No open reports.'));
    for (const finding of outstanding) {
      const card = node('article', null, 'shared-record');
      card.append(node('strong', finding.kind === 'source_error' ? 'Possible error in the original' : finding.kind === 'clarification' ? 'Needs clarification' : 'Error'), node('p', finding.comment), node('small', `${actorName(finding)} · ${finding.reviewed?.snapshotId === detail.current?.snapshotId ? 'Current score' : 'Earlier score version'} · ${finding.state.replaceAll('_', ' ')}`));
      if (finding.discussion?.url) { const link = node('a', `Original Discussion · ${finding.discussion.author}`); try { const url = new URL(finding.discussion.url); if (url.protocol === 'https:' && url.hostname === 'github.com') { link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); } } catch {} }
      card.append(action('Open report and original context', guard(() => openReceipt('report', finding.reportId)))); $('sharedFindings').append(card);
    }
    $('sharedProposals').replaceChildren();
    if (!detail.proposals?.length) $('sharedProposals').append(node('p', 'No AI corrections to check yet.'));
    for (const item of detail.proposals ?? []) {
      const card = node('article', null, 'shared-record'); card.dataset.proposalId = item.id; card.append(node('strong', 'AI corrections'), node('p', applicationLabel(item)), node('small', `${actorName(item)} · ${item.createdAt}`), action('Check corrections', guard(() => openProposal(item.id)))); $('sharedProposals').append(card);
    }
    $('sharedReports').replaceChildren();
    for (const item of detail.reports ?? []) {
      const card = node('article', null, 'shared-record'); card.append(node('strong', item.clean ? 'No errors found' : 'Submitted findings'), node('p', item.scope?.description ?? ''), node('small', actorName(item)), action('Open report', guard(() => openReceipt('report', item.id)))); $('sharedReports').append(card);
    }
  }
  async function openScore() {
    requireWork();
    const current = await run(async () => {
      status('Opening score…');
      let imported;
      try { imported = await loadSharedWork(client, detail, api.inspectPdf); }
      catch (error) { if (error.details?.needsSourceUpload) showSourceFallback(); throw error; }
      await api.openFiles(imported.files);
      loadedSnapshot = imported.review.snapshotId; proposal = null; $('sharedProposalPanel').hidden = true; $('renderedLabel').textContent = 'Rendered score';
      return imported;
    });
    if (current) { close(); status('Score opened.'); }
    return current;
  }
  function showSourceFallback() {
    const source = detail?.work?.source_pdf ?? detail?.work?.sourcePdf;
    if (typeof source !== 'string') return;
    try { const url = new URL(source); if (url.protocol !== 'https:') return; $('sharedLibrary').href = url.href; $('sharedSourceFallback').hidden = false; } catch {}
  }
  function alreadySubmitted(finding, scene) {
    return (detail?.findings ?? []).find(existing => existing.author?.id === client?.user?.id && existing.reviewed?.snapshotId === scene.review.snapshotId && (existing.reviewed?.proposalId ?? null) === (scene.sharedProposalId ?? null) && (existing.originalId ?? existing.annotation?.id) === finding.id && existing.comment === finding.comment && canonical(existing.annotation?.strokes ?? []) === canonical(finding.strokes));
  }
  async function reportForm(kind) {
    requireWork();
    if (!api.capture().review) {
      await openScore();
      if (!api.capture().review) return;
    }
    if (proposal && proposal.proposal.workId !== selected) throw new Error('Open the selected work before submitting findings. The displayed AI version belongs to another work.');
    const proposalId = proposalReportIdentity(proposal, api.capture().review);
    if (!proposalId && api.capture().review.files.source.sha256 !== detail.current.files.source.sha256) throw new Error('This local draft uses a different printed source. Open the selected work before reporting; the existing draft stays saved on this device.');
    mode = kind; await api.flush(); reportScene = {...api.capture(), sharedProposalId: proposalId}; show();
    const formGeneration = ++reportFormGeneration, originalEdits = reportFormEdits, draftWork = selected, draftSnapshot = reportScene.review.snapshotId;
    reportDraftName = `report:${draftWork}:${draftSnapshot}:${kind}${proposalId ? ':' + proposalId : ''}`;
    reportLegacyDraftName = null;
    $('sharedReportForm').hidden = false; $('sharedFixSection').hidden = true;
    $('sharedReportHeading').textContent = 'Submit findings';
    $('sharedDraftNotice').textContent = proposalId ? 'Reporting on the AI version currently open.' : reportScene.review.snapshotId === detail.current.snapshotId ? '' : 'These findings refer to an earlier score version.';
    $('sharedDraftNotice').hidden = ! $('sharedDraftNotice').textContent;
    $('sharedScopeFields').hidden = false;
    $('sharedSendReport').textContent = 'Submit';
    for (const radio of $('sharedScopeFields').querySelectorAll('input')) radio.checked = radio.value === 'report';
    $('sharedClean').checked = false;
    for (const id of ['sharedScopeNote', 'sharedDisplayName', 'sharedDiscussionUrl', 'sharedDiscussionAuthor', 'sharedDiscussionSummary']) $(id).value = '';
    $('sharedFindingChoices').replaceChildren();
    for (const finding of reportScene.review.findings) {
      const existing = alreadySubmitted(finding, reportScene), row = node('div', null, 'shared-finding-choice'), label = node('label'), checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.checked = kind === 'review' || !existing; checkbox.dataset.sharedFinding = finding.id; checkbox.dataset.submitted = String(Boolean(existing)); checkbox.dataset.alreadySubmitted = String(Boolean(existing && kind !== 'review')); checkbox.disabled = Boolean(existing && kind !== 'review');
      if (existing) { checkbox.dataset.coverageChecked = 'true'; checkbox.onchange = () => { checkbox.dataset.coverageChecked = String(checkbox.checked); }; }
      label.append(checkbox, node('span', `#${finding.number} · page ${finding.page} · ${finding.comment || 'Highlighted passage'}${existing ? ' · already submitted' : ''}`)); row.append(label);
      const select = document.createElement('select'); select.dataset.sharedKind = finding.id; select.setAttribute('aria-label', `Finding ${finding.number} type`);
      for (const [value, text] of [['transcription', 'Error'], ['source_error', 'Possible error in the original'], ['clarification', 'Needs clarification']]) select.add(new Option(text, value));
      if (finding.state === 'needs_source_clarification') select.value = 'clarification';
      if (existing) { select.value = existing.kind; select.dataset.alreadySubmitted = 'true'; select.disabled = true; }
      row.append(select); $('sharedFindingChoices').append(row);
    }
    if (!reportScene.review.findings.length) $('sharedFindingChoices').append(node('p', 'No errors marked.'));
    const draftContext = {workId: draftWork, snapshotId: draftSnapshot, mode: kind, findingIds: reportScene.review.findings.map(finding => finding.id)};
    const legacyName = `report:${draftWork}:${draftSnapshot}:review`;
    let savedDraft = matchingReportDraft(await client.draft(reportDraftName), draftContext);
    if (!savedDraft && !proposalId) {
      const legacyDraft = matchingReportDraft(await client.draft(legacyName), {...draftContext, mode: 'review'});
      if (legacyDraft) savedDraft = {...legacyDraft, legacyReviewDraft: true};
    }
    if (formGeneration !== reportFormGeneration || draftWork !== selected || draftSnapshot !== reportScene?.review?.snapshotId) return;
    // Typing during a slow local read wins over restoration of the older draft.
    if (savedDraft && originalEdits === reportFormEdits) {
      if (savedDraft.legacyReviewDraft === true) reportLegacyDraftName = legacyName;
      for (const radio of $('sharedScopeFields').querySelectorAll('input')) radio.checked = radio.value === (savedDraft.scope ?? 'report');
      $('sharedClean').checked = savedDraft.clean;
      for (const [id, key] of [['sharedScopeNote', 'scopeNote'], ['sharedDisplayName', 'displayName'], ['sharedDiscussionUrl', 'discussionUrl'], ['sharedDiscussionAuthor', 'discussionAuthor'], ['sharedDiscussionSummary', 'discussionSummary']]) $(id).value = savedDraft[key];
      for (const finding of savedDraft.findings) {
        const checkbox = [...$('sharedFindingChoices').querySelectorAll('[data-shared-finding]')].find(input => input.dataset.sharedFinding === finding.id);
        const select = [...$('sharedFindingChoices').querySelectorAll('[data-shared-kind]')].find(input => input.dataset.sharedKind === finding.id);
        if (checkbox?.dataset.submitted === 'true') checkbox.dataset.coverageChecked = String(finding.coverageChecked ?? (savedDraft.mode === 'review' ? finding.checked : true));
        else if (checkbox) checkbox.checked = finding.checked;
        if (select && select.dataset.alreadySubmitted !== 'true') select.value = finding.kind;
      }
    }
    scopeControls(); $('sharedReportForm').scrollIntoView({block: 'start'}); controls();
  }
  function scopeControls() {
    const scoped = ['partial', 'whole'].includes($('sharedScopeFields').querySelector('input:checked')?.value);
    $('sharedScopeLabel').hidden = !scoped; $('sharedCleanLabel').hidden = !scoped;
    for (const checkbox of $('sharedFindingChoices').querySelectorAll('[data-shared-finding]')) {
      const choice = reportFindingSelection({submitted: checkbox.dataset.submitted === 'true', checked: checkbox.checked, coverageChecked: checkbox.dataset.coverageChecked === 'true'}, scoped);
      checkbox.checked = choice.checked; checkbox.dataset.alreadySubmitted = String(choice.disabled); checkbox.disabled = busy || choice.disabled;
    }
  }
  function saveReportForm() {
    if (!client || !reportScene || !reportDraftName || $('sharedReportForm').hidden) return;
    reportFormEdits++;
    const choices = [...$('sharedFindingChoices').querySelectorAll('[data-shared-finding]')], types = [...$('sharedFindingChoices').querySelectorAll('[data-shared-kind]')];
    const scope = $('sharedScopeFields').querySelector('input:checked')?.value ?? null, scoped = ['partial', 'whole'].includes(scope);
    const draft = {version: 1, workId: selected, snapshotId: reportScene.review.snapshotId, mode, legacyReviewDraft: Boolean(reportLegacyDraftName), scope, clean: $('sharedClean').checked,
      scopeNote: $('sharedScopeNote').value, displayName: $('sharedDisplayName').value, discussionUrl: $('sharedDiscussionUrl').value, discussionAuthor: $('sharedDiscussionAuthor').value, discussionSummary: $('sharedDiscussionSummary').value,
      findings: choices.map(input => ({id: input.dataset.sharedFinding, checked: input.checked, ...(input.dataset.submitted === 'true' ? {coverageChecked: scoped ? input.checked : input.dataset.coverageChecked === 'true'} : {}), kind: types.find(select => select.dataset.sharedKind === input.dataset.sharedFinding)?.value ?? 'transcription'}))};
    client.saveDraft(reportDraftName, draft).catch(error => status(`The report form could not be saved locally: ${error.message}. Keep this page open; your score annotations are still kept separately.`, true));
  }
  async function sendReport(event) {
    event.preventDefault(); requireUser(); requireWork();
    if (!reportScene || !api.matches(reportScene.stamp)) throw new Error('Your local review changed. Reopen Submit findings to include the latest draft.');
    await run(async () => {
      const selectedIds = new Set([...$('sharedFindingChoices').querySelectorAll('[data-shared-finding]:checked')].map(input => input.dataset.sharedFinding));
      const scene = {...reportScene, review: clone(reportScene.review)}; scene.review.findings = scene.review.findings.filter(finding => selectedIds.has(finding.id));
      const kind = $('sharedScopeFields').querySelector('input:checked')?.value;
      const scope = {kind, description: kind === 'report' ? 'Reported errors' : $('sharedScopeNote').value.trim() || (kind === 'whole' ? 'Whole score' : '')};
      const clean = kind !== 'report' && $('sharedClean').checked;
      const kinds = Object.fromEntries([...$('sharedFindingChoices').querySelectorAll('[data-shared-kind]')].filter(select => selectedIds.has(select.dataset.sharedKind)).map(select => [select.dataset.sharedKind, select.value]));
      const discussion = $('sharedDiscussionUrl').value.trim() ? {url: $('sharedDiscussionUrl').value.trim(), author: $('sharedDiscussionAuthor').value.trim(), summary: $('sharedDiscussionSummary').value.trim()} : undefined;
      const options = {scope, clean, kinds, displayName: $('sharedDisplayName').value.trim(), ...(discussion ? {discussion} : {}), ...(reportScene.sharedProposalId ? {proposalId: reportScene.sharedProposalId} : {})};
      options.requestId = await contentKey({kind: 'report', work: selected, actor: client.user.id, review: scene.review, ...options});
      const pending = (await client.pending()).find(record => record.body.requestId === options.requestId);
      status('Submitting…');
      const body = pending?.body ?? await prepareSharedReport(scene, options);
      const result = await client.write(`/api/works/${idPart(selected)}/reports`, body);
      try {
        if (reportDraftName) await client.clearDraft(reportDraftName);
        if (reportLegacyDraftName) await client.clearDraft(reportLegacyDraftName);
      } catch { /* The durable server receipt still stands; repeating this draft remains idempotent. */ }
      receipt('report', result); $('sharedReportForm').hidden = true; await refreshWork(); await refreshPending();
      status('Submitted to the project.');
    });
  }
  async function task() {
    requireUser(); requireWork();
    await run(async () => {
      if (!taskAttempt || taskAttempt.workId !== selected || taskAttempt.acknowledged) {
        const pending = (await client.pending()).find(record => record.path === '/api/tasks');
        if (pending) {
          status('Retrying the correction task whose acknowledgement is pending…');
          const record = await client.write(pending.path, pending.body), issued = await loadSharedTask(client, record.id, api.inspectPdf);
          if (issued.task.shared?.workId && issued.task.shared.workId !== selected) { selected = issued.task.shared.workId; $('sharedWork').value = selected; await refreshWork(); }
          showTask(issued); receipt('task', record); await refreshPending(); return;
        }
        let snapshot;
        try { snapshot = await client.request(`/api/works/${idPart(selected)}/snapshot`); }
        catch (error) { if (error.details?.needsSourceUpload) showSourceFallback(); throw error; }
        const issued = await api.lock(() => makeSharedTask(client, snapshot, {inspectPdf: api.inspectPdf, packageMaker: api.packageMaker, onProgress: text => status(text)}));
        taskAttempt = {workId: selected, issued, acknowledged: false};
      }
      status('Preparing download…');
      const record = await client.write('/api/tasks', taskAttempt.issued.submit), delivered = await loadSharedTask(client, record.id, api.inspectPdf);
      taskAttempt.acknowledged = true; showTask(delivered); receipt('task', record); await refreshPending(); status('Correction package saved in the project. Download the ZIP, attach it to your AI, and paste the instructions.');
    });
  }
  function showTask(issued) {
    $('sharedFixSection').hidden = false; revoke(taskLinks); $('sharedTaskDownloads').replaceChildren();
    download(issued.zip, `opus-task-${issued.id}.zip`, 'Download correction ZIP', $('sharedTaskDownloads'));
    $('sharedPrompt').value = issued.prompt; $('sharedPromptLabel').hidden = false; $('sharedCopyPrompt').hidden = false;
  }
  async function returnResponse(file) {
    requireUser(); if (!file) return;
    await run(async () => {
      status('Checking AI response…');
      const parsed = await api.lock(() => readSharedResponse(client, file, api.inspectPdf));
      const requestId = await contentKey({kind: 'proposal', actor: client.user.id, digest: await sha256(await file.arrayBuffer())});
      const record = await client.write('/api/proposals', {requestId, package: await blobBase64(file)});
      if (parsed.issued.task.shared?.workId) { selected = parsed.issued.task.shared.workId; $('sharedWork').value = selected; }
      receipt('proposal', record); await refreshWork(); await refreshPending(); status('AI response submitted.');
    });
  }
  async function openReceipt(kind, id) {
    requireClient(); show();
    const path = kind === 'report' ? 'reports' : kind === 'proposal' ? 'proposals' : 'tasks';
    const record = await client.request(`/api/${path}/${idPart(id)}`);
    if (record.workId && record.workId !== selected) { selected = record.workId; $('sharedWork').value = selected; await refreshWork(); }
    receipt(kind, record);
    if (kind === 'task') showTask(await loadSharedTask(client, id, api.inspectPdf));
    if (kind === 'report') {
      $('sharedReceipt').append(node('p', `${record.clean ? 'Explicit no-errors declaration' : 'Finding report'} · ${record.scope?.kind}: ${record.scope?.description}`));
      const version = node('details'); version.append(node('summary', 'Version details'), node('p', record.reviewed?.snapshotId ?? record.review?.snapshotId ?? 'See saved report')); $('sharedReceipt').append(version);
      const reportFindings = record.findingIds ? record.findingIds.map(id => (detail?.findings ?? []).find(finding => finding.id === id)).filter(Boolean) : record.findings ?? record.review?.findings ?? [];
      for (const finding of reportFindings) $('sharedReceipt').append(node('p', finding.comment));
      if (record.packageUrl || record.packageSha256) {
        $('sharedReceipt').append(action('Download original report and context', guard(async () => {
          const blob = await client.asset(record.packageUrl ?? `/api/reports/${idPart(id)}/package`); api.download(blob, `opus-report-${id}.zip`);
        })));
      }
    }
    return record;
  }
  async function openProposal(id) {
    requireClient();
    const loaded = await run(async () => {
      status('Opening AI corrections…');
      const item = await api.lock(() => loadSharedProposal(client, id, api.inspectPdf));
      await api.openFiles(item.seed?.files ?? item.issued.files); proposal = item; proposalPosition = 0;
      selected = item.proposal.workId ?? item.issued.task.shared.workId; $('sharedWork').value = selected;
      loadedSnapshot = api.capture().review.snapshotId;
      await refreshWork();
      await renderProposal(); api.showFindings(); return item;
    });
    if (loaded) { close(); history.replaceState(null, '', receiptURL('proposal', id)); status('Compare the AI’s changes with the original score.'); }
  }
  function renderingForm(root) {
    const section = node(proposal.seed ? 'details' : 'section', null, 'shared-pdf-upload'); section.id = 'sharedRenderingSection';
    section.append(node(proposal.seed ? 'summary' : 'h4', proposal.seed ? 'Replace PDF' : 'Add PDF'));
    section.append(node('p', 'Choose the PDF rendered from this proposal’s LilyPond.'));
    const form = document.createElement('form'), fileLabel = node('label', 'PDF'), file = document.createElement('input');
    file.id = 'sharedProposalPdf'; file.type = 'file'; file.accept = '.pdf,application/pdf'; file.required = true; fileLabel.append(file); form.append(fileLabel);
    for (const [id, label, placeholder, required] of [['sharedPdfProducer', 'Rendered by', 'Person or tool that made this PDF', true], ['sharedPdfCompiler', 'LilyPond version (optional)', 'For example: 2.24.4', false]]) {
      const field = node('label', label), input = document.createElement('input'); input.id = id; input.maxLength = 200; input.placeholder = placeholder; input.required = required; field.append(input); form.append(field);
    }
    const submit = node('button', proposal.seed ? 'Save new PDF version' : 'Add PDF', 'primary'); submit.id = 'sharedAddProposalPdf'; submit.type = 'submit'; form.append(submit);
    form.onsubmit = guard(async event => { event.preventDefault(); await addProposalRendering('uploaded'); }); section.append(form); root.append(section);
    const canonical = action('Use project PDF', guard(() => addProposalRendering('canonical'))); canonical.id = 'sharedUseProjectPdf'; canonical.hidden = !client?.user?.roles?.includes('maintainer'); root.append(canonical);
  }
  async function addProposalRendering(mode) {
    requireUser(); if (!proposal) return;
    const target = proposal, targetStamp = api.capture().stamp, file = mode === 'uploaded' ? $('sharedProposalPdf').files[0] : null;
    const producer = mode === 'uploaded' ? $('sharedPdfProducer').value.trim() : null, compiler = mode === 'uploaded' ? $('sharedPdfCompiler').value.trim() : null;
    if (mode === 'uploaded' && (!file || !producer)) throw new Error('Choose a PDF and say who or what rendered it.');
    if (file && (!file.name.toLowerCase().endsWith('.pdf') || file.size > 100 * 1024 * 1024)) throw new Error('Choose a PDF no larger than 100 MB.');
    const record = await run(async () => {
      let body, key;
      if (mode === 'uploaded') {
        status('Checking the PDF…');
        await api.lock(() => api.inspectPdf({source: target.issued.files.source, rendered: {name: file.name, blob: file}}));
        const digest = await sha256(await file.arrayBuffer());
        body = {mode, name: file.name, producer, ...(compiler ? {compiler} : {}), pdf: await blobBase64(file)};
        key = {digest, name: file.name, producer, compiler};
      } else {
        const work = await client.request(`/api/works/${idPart(target.proposal.workId)}`);
        body = {mode}; key = {snapshotId: work.current.snapshotId, repositoryRevision: work.current.repositoryRevision};
      }
      body.requestId = await contentKey({kind: 'proposal-rendering', parent: target.proposal.id, actor: client.user.id, mode, ...key});
      status('Saving the PDF version…');
      const child = await client.write(`/api/proposals/${idPart(target.proposal.id)}/renderings`, body);
      show(); receipt('proposal', child); await refreshWork(); await refreshPending(); return child;
    });
    if (record && proposal?.proposal.id === target.proposal.id && api.matches(targetStamp)) await openProposal(record.id);
  }
  async function renderProposal() {
    const rendering = ++proposalRender;
    const root = $('sharedProposalPanel'); root.replaceChildren(); revoke(proposalImages); if (!proposal) { root.hidden = true; return; } root.hidden = false;
    const findings = taskFindings(proposal.issued); proposalPosition = Math.max(0, Math.min(proposalPosition, findings.length - 1));
    const finding = findings[proposalPosition], result = proposal.entry.response.results.find(item => item.id === finding.id), sharedFinding = proposal.proposal.findings?.find(item => item.id === finding.id);
    $('renderedLabel').textContent = proposal.seed ? proposalApplications(proposal.proposal).complete ? 'Applied rendering' : 'Proposed rendering' : 'Previous rendering · proposed PDF pending';
    root.dataset.proposalId = proposal.proposal.id;
    root.append(node('h3', 'Check AI corrections'), node('p', applicationLabel(proposal.proposal), 'shared-proposal-state'));
    if (proposal.proposal.stale && proposal.proposal.candidate?.snapshotId !== proposal.proposal.current?.snapshotId) root.append(node('p', 'The project score has changed since this task.', 'shared-warning'));
    if (!proposal.seed) root.append(node('p', 'The updated PDF is missing.', 'shared-warning'));
    renderingForm(root);
    if (proposal.proposal.revisions?.length > 1) {
      const versions = node('details'); versions.id = 'sharedProposalVersions'; versions.append(node('summary', 'PDF versions'));
      for (const revision of proposal.proposal.revisions) {
        const label = `Version ${revision.renderingRevision ?? 0}${revision.id === proposal.proposal.id ? ' · currently open' : ''}`;
        if (revision.id === proposal.proposal.id) versions.append(node('p', label));
        else { const button = action(label, guard(() => openProposal(revision.id))); button.dataset.proposalId = revision.id; versions.append(button); }
      }
      root.append(versions);
    }
    root.append(node('p', `Finding ${proposalPosition + 1} of ${findings.length}`));
    const navigation = node('div', null, 'shared-inline-actions');
    for (const [label, step] of [['Previous', -1], ['Next', 1]]) { const button = action(label, guard(async () => { proposalPosition += step; await renderProposal(); })); button.dataset.sharedUnavailable = String(proposalPosition + step < 0 || proposalPosition + step >= findings.length); navigation.append(button); }
    const findingPicker = document.createElement('select'); findingPicker.id = 'sharedProposalFinding'; findingPicker.setAttribute('aria-label', 'Choose a reported finding');
    findings.forEach((item, index) => findingPicker.add(new Option(`#${item.number} · ${proposalFindingState(proposal.proposal, item.id)}`, String(index)))); findingPicker.value = String(proposalPosition);
    findingPicker.onchange = guard(async () => { proposalPosition = Number(findingPicker.value); await renderProposal(); }); navigation.append(findingPicker); root.append(navigation);
    const findingStatus = node('p', proposalFindingState(proposal.proposal, finding.id), 'shared-finding-state'); findingStatus.id = 'sharedFindingStatus'; root.append(findingStatus);
    root.append(node('strong', 'Original report'), node('p', finding.comment), node('small', `${actorName(finding)} · page ${finding.origin?.page ?? finding.page ?? 'unspecified'}`), node('strong', 'AI response'), node('p', result.explanation));
    if (result.codeLocation) root.append(node('p', `Proposed code location: ${result.codeLocation}`));
    const details = node('details'), summary = node('summary', 'Original highlights'); details.append(summary);
    for (const [index, path] of contextPaths(proposal.issued, finding).entries()) {
      const blob = proposal.issued.payloads.get(path); if (!blob) continue; const url = URL.createObjectURL(blob); proposalImages.push(url);
      const image = document.createElement('img'); image.src = url; image.alt = `${index ? 'Clean' : 'Marked'} original context for ${finding.id}`; details.append(image);
    }
    for (const [role, label] of [['source', 'Printed source used for this original report'], ['rendered', 'Rendering originally reported']]) {
      const original = finding.historicalContext?.originalFiles?.[role], blob = original && proposal.issued.payloads.get(original.path);
      if (blob) download(blob, `historical-${role}.pdf`, label, details, proposalImages);
    }
    const history = node('pre', JSON.stringify({origin: finding.origin, discussion: finding.discussion, priorInstructions: finding.instructionHistory, sharedHistory: finding.history}, null, 2)); details.append(history); root.append(details);
    const files = node('details'); files.append(node('summary', 'Compare files'));
    download(proposal.issued.files.ly.blob, 'previous.ly', 'Previous LilyPond', files, proposalImages);
    const proposedCode = proposal.entry.response.code.status === 'changed' ? proposal.entry.payloads.get(proposal.entry.response.code.path) : proposal.issued.files.ly.blob;
    download(proposedCode, 'proposed.ly', 'Proposed LilyPond', files, proposalImages);
    download(proposal.issued.files.rendered.blob, 'previous-rendering.pdf', 'Previous rendering', files, proposalImages);
    if (proposal.seed) download(proposal.seed.files.rendered.blob, 'proposed-rendering.pdf', 'Proposed PDF', files, proposalImages);
    files.append(node('pre', JSON.stringify({taskId: proposal.issued.id, proposalId: proposal.proposal.id, parentProposalId: proposal.proposal.parentProposalId, candidate: proposal.proposal.candidate, rendering: proposal.entry.response.rendering, renderingProvenance: proposal.proposal.renderingProvenance}, null, 2))); root.append(files);
    if (proposal.entry.response.code.status === 'unchanged') files.append(node('p', 'LilyPond unchanged.'));
    else {
      const limit = 100 * 1024;
      const [before, after] = await Promise.all([proposal.issued.files.ly.blob.slice(0, limit).text(), proposedCode.slice(0, limit).text()]);
      if (rendering !== proposalRender) return;
      const columns = node('div', null, 'shared-code-comparison');
      for (const [heading, text] of [['Before · task baseline', before], ['After · proposed code', after]]) {
        const column = node('section'); column.append(node('h4', heading), node('pre', text)); columns.append(column);
      }
      if (proposal.issued.files.ly.blob.size > limit || proposedCode.size > limit) files.append(node('p', 'Preview limited to the first 100 KiB of each file. The complete files are available from the download links above.'));
      files.append(columns);
    }
    const explanationLabel = node('label', 'Your explanation'), explanation = document.createElement('textarea'); explanation.id = 'sharedDecisionExplanation'; explanation.maxLength = 4000; explanation.rows = 3; explanationLabel.append(explanation); root.append(explanationLabel);
    const draftName = `decision:${proposal.proposal.id}:${finding.id}`;
    explanation.oninput = () => client.saveDraft(draftName, {explanation: explanation.value}).catch(error => status(`Decision explanation could not be saved locally: ${error.message}. Keep this page open.`, true));
    const savedDraft = await client.draft(draftName); if (rendering !== proposalRender) return; if (savedDraft) explanation.value = savedDraft.explanation ?? '';
    const buttons = node('div', null, 'shared-decision-buttons');
    for (const [id, label, state] of [['sharedLooksCorrect', 'Looks correct', 'looks_correct'], ['sharedStillCorrection', 'Still needs correction', 'needs_correction'], ['sharedNeedsClarification', 'Needs clarification', 'needs_clarification']]) { const button = action(label, guard(() => decision(finding.id, state, explanation.value))); button.id = id; buttons.append(button); }
    root.append(buttons);
    const decisionHistory = node('details'); decisionHistory.append(node('summary', 'Shared decision history'));
    for (const entry of sharedFinding?.decisions ?? []) decisionHistory.append(node('p', `${entry.state.replaceAll('_', ' ')} · ${actorName(entry)} · ${entry.createdAt ?? entry.at} · ${entry.explanation ?? ''}`));
    if (!sharedFinding?.decisions?.length) decisionHistory.append(node('p', 'No shared decisions for this finding yet.'));
    root.append(decisionHistory, action('Project page and maintainer handoff', guard(async () => { show(); await refreshWork(); receipt('proposal', proposal.proposal); })));
    controls();
  }
  async function decision(findingId, state, explanation) {
    requireUser(); if (!proposal) return;
    if (!proposal.seed && state === 'looks_correct') throw new Error('A current proposed rendering is required before visual approval.');
    if (state !== 'looks_correct' && !explanation.trim()) throw new Error('Explain what still needs correction or clarification.');
    await run(async () => {
      const target = proposal.proposal.findings?.find(item => item.id === findingId), expectedVersion = target?.decisionVersion ?? 0;
      const body = {findingId, state, explanation: explanation.trim(), expectedVersion}; body.requestId = await contentKey({kind: 'decision', proposalId: proposal.proposal.id, actor: client.user.id, ...body});
      try { await api.lock(() => client.write(`/api/proposals/${idPart(proposal.proposal.id)}/decisions`, body)); }
      catch (error) { if (error.status === 409) { proposal.proposal = await client.request(`/api/proposals/${idPart(proposal.proposal.id)}`); await renderProposal(); throw new Error('Another reviewer recorded a decision first. Their history is now shown. Check it before submitting your decision again.'); } throw error; }
      await client.clearDraft(`decision:${proposal.proposal.id}:${findingId}`);
      proposal.proposal = await client.request(`/api/proposals/${idPart(proposal.proposal.id)}`); await renderProposal(); await refreshPending();
      status('Decision submitted.');
    });
  }
  async function handoff(kind, id) {
    requireClient();
    const result = await client.request(`/api/${kind === 'report' ? 'reports' : 'proposals'}/${idPart(id)}/handoff`);
    $('sharedMaintainer').hidden = false; $('sharedHandoffText').value = result.text; revoke(handoffLinks); $('sharedHandoffFiles').replaceChildren();
    const handoffFiles = Array.isArray(result.files) ? result.files : Object.entries(result.files ?? {}).map(([name, url]) => ({name: `opus-${kind}-${id}-${name}.zip`, url}));
    for (const file of handoffFiles) {
      if (typeof file === 'string') continue;
      const button = action(file.name ?? file.path ?? 'Download handoff file', guard(async () => { const blob = await client.asset(file.url); api.download(blob, file.name ?? 'opus-handoff.zip'); })); $('sharedHandoffFiles').append(button);
    }
    $('sharedMaintainer').scrollIntoView({block: 'start'});
  }
  async function copy(id) {
    const text = $(id).value; try { await navigator.clipboard.writeText(text); status('Instructions copied.'); } catch { $(id).focus(); $(id).select(); status('Select and copy the displayed instructions.'); }
  }
  $('sharedProject').onclick = guard(async () => { show(); await ready; if (client && selected) await refreshWork(); });
  $('sharedSubmit').onclick = guard(async () => { show(); await ready; if (!selected) { status('Choose the project work for this draft, then open its exact score.'); return; } await reportForm('report'); });
  $('sharedClose').onclick = close;
  $('sharedDialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('sharedSignIn').onclick = guard(async () => { await client.signIn(); await refreshPending(); status('Signed in. Your draft is ready to submit.'); });
  $('sharedSignOut').onclick = guard(async () => { await client.signOut(); status('Signed out. Local drafts remain on this device.'); });
  $('sharedDevForm').onsubmit = guard(async event => { event.preventDefault(); await client.localSignIn($('sharedDevLogin').value.trim()); await refreshPending(); status('Local test identity selected.'); });
  $('sharedRefresh').onclick = guard(() => run(async () => { await refreshWork(); status('Shared records refreshed.'); }));
  $('sharedWork').onchange = guard(async () => { selected = $('sharedWork').value; detail = null; reportScene = null; $('sharedWorkTitle').textContent = selected ? 'Loading the selected work…' : 'Choose a project work'; $('sharedRevision').textContent = ''; for (const id of ['sharedFindings', 'sharedProposals', 'sharedReports']) $(id).replaceChildren(); $('sharedReportForm').hidden = true; $('sharedReceipt').hidden = true; $('sharedMaintainer').hidden = true; $('sharedSourceFallback').hidden = true; await refreshWork(); });
  $('sharedOpenScore').onclick = guard(openScore);
  $('sharedReportPath').onclick = guard(openScore);
  $('sharedFixPath').onclick = () => { $('sharedFixSection').hidden = false; $('sharedReportForm').hidden = true; $('sharedFixSection').scrollIntoView({block: 'start'}); };
  $('sharedReviewFixesPath').onclick = () => { $('sharedProposals').scrollIntoView({block: 'start'}); };
  $('sharedReportForm').onsubmit = guard(sendReport);
  $('sharedReportForm').addEventListener('input', saveReportForm);
  $('sharedReportForm').addEventListener('change', saveReportForm);
  $('sharedScopeFields').addEventListener('change', scopeControls);
  $('sharedGetTask').onclick = guard(task);
  $('sharedReturnResponse').onclick = guard(async () => { requireUser(); $('sharedResponseFile').click(); });
  $('sharedResponseFile').onchange = guard(async event => { const file = event.target.files[0]; event.target.value = ''; await returnResponse(file); });
  $('sharedCopyPrompt').onclick = guard(() => copy('sharedPrompt'));
  $('sharedCopyHandoff').onclick = guard(() => copy('sharedHandoffText'));
  $('sharedUploadSource').onclick = guard(() => run(async () => {
    requireUser(); const file = $('sharedSourceFile').files[0]; if (!file) throw new Error('Select the exact printed PDF you saved from the library.');
    await client.fetch(`/api/works/${idPart(selected)}/assets/source`, {method: 'POST', body: file, headers: {'Content-Type': 'application/pdf'}});
    $('sharedSourceFallback').hidden = true; await refreshWork(); status('The exact source PDF is available. Open the score or get a correction package.');
  }));
  document.addEventListener('score-desk-controls', controls);
  document.addEventListener('score-desk-change', () => { if (proposal && loadedSnapshot && api.capture().review?.snapshotId !== loadedSnapshot) { proposal = null; $('sharedProposalPanel').hidden = true; } controls(); });
  const ready = (async () => {
    try {
      const config = await sharedConfiguration();
      if (!config.apiBase) { $('sharedIdentity').textContent = 'Submissions not yet available'; status('You can save drafts and download packages.'); controls(); return; }
      client = new SharedClient(config.apiBase);
      client.addEventListener('session', () => { $('sharedIdentity').textContent = identity(client.user); controls(); });
      client.addEventListener('outbox', () => refreshPending().catch(error => status(error.message, true)));
      await client.session(); const works = await client.all('/api/works');
      $('sharedWork').replaceChildren(new Option('Choose a project work…', ''));
      for (const work of works) $('sharedWork').add(new Option(`${work.composer ? work.composer + ' — ' : ''}${work.title ?? work.slug ?? work.id}${work.outstanding ? ` · ${work.outstanding} outstanding` : ''}`, work.slug ?? work.id));
      $('sharedAvailable').hidden = false;
      const params = new URLSearchParams(location.search), piece = params.get('piece');
      if (piece && works.some(work => (work.slug ?? work.id) === piece)) { selected = piece; $('sharedWork').value = piece; await refreshWork(); }
      if (document.body.dataset.ready !== 'true') await new Promise(resolve => document.addEventListener('score-desk-ready', resolve, {once: true}));
      if (params.get('proposal')) await openProposal(params.get('proposal'));
      else if (params.get('report')) await openReceipt('report', params.get('report'));
      else if (params.get('task')) await openReceipt('task', params.get('task'));
      else if (selected) show();
      if (!works.length) status('No works have been prepared in the shared service yet. Local packages and drafts are available.');
      else status('');
    } catch (error) { $('sharedIdentity').textContent = 'Shared service unavailable'; status(error.message, true); }
    finally { controls(); }
  })();
  controls();
  return {ready, get client() { return client; }, refreshWork, openScore, reportForm, openProposal, returnResponse, state: () => ({selected, detail, proposal, busy})};
}

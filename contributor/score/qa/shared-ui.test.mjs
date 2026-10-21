import test from 'node:test';
import assert from 'node:assert/strict';
import {createCurrentWorkReader, matchingReportDraft, proposalApplications, proposalFindingState, proposalReportIdentity, reportFindingSelection} from '../shared-ui.js';

const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return {promise, resolve, reject}; };
const work = slug => ({workId: slug, work: {slug}, current: {snapshotId: `snapshot-${slug}`}});

test('partial application never labels an entire proposal applied or transfers application to another finding', () => {
  const record = {findings: [{id: 'one'}, {id: 'two', decision: {state: 'looks_correct'}}, {id: 'three', decision: {state: 'needs_correction'}}], applied: [{findingIds: ['one']}, {findingIds: ['one', 'unrelated']}]};
  const partial = proposalApplications(record);
  assert.equal(partial.applied, 1); assert.equal(partial.total, 3); assert.equal(partial.complete, false);
  assert.equal(proposalFindingState(record, 'one'), 'Applied to the project');
  assert.equal(proposalFindingState(record, 'two'), 'Looks correct · awaiting application');
  assert.equal(proposalFindingState(record, 'three'), 'Still needs correction');
  record.applied.push({findingIds: ['two', 'three']}); assert.equal(proposalApplications(record).complete, true);
  assert.equal(proposalApplications({findings: [], applied: []}).complete, false);
});

test('a new PDF revision starts its own review and application status', () => {
  const original = {id: 'old', findings: [{id: 'one', decision: {state: 'looks_correct'}}], applied: [{findingIds: ['one']}]};
  const child = {id: 'new', parentProposalId: 'old', findings: [{id: 'one', decisions: []}], applied: []};
  assert.equal(proposalApplications(original).complete, true);
  assert.equal(proposalApplications(child).applied, 0); assert.equal(proposalApplications(child).complete, false);
  assert.equal(proposalFindingState(child, 'one'), 'Waiting to be checked');
});

test('reports on returned corrections bind the exact candidate and never the pending baseline', () => {
  const review = {snapshotId: 'candidate', files: {source: {sha256: 'source'}, rendered: {sha256: 'new-pdf'}, ly: {sha256: 'new-code'}}};
  const loaded = {seed: {}, proposal: {id: 'child', candidateCurrent: structuredClone(review)}};
  assert.equal(proposalReportIdentity(loaded, review), 'child');
  assert.equal(proposalReportIdentity(null, review), null);
  assert.throws(() => proposalReportIdentity({...loaded, seed: null}, review), /Add the proposed PDF/);
  assert.throws(() => proposalReportIdentity(loaded, {...review, snapshotId: 'baseline'}), /displayed score differs/);
  for (const role of ['source', 'rendered', 'ly']) {
    const different = structuredClone(review); different.files[role].sha256 = 'different';
    assert.throws(() => proposalReportIdentity(loaded, different), /displayed score differs/);
  }
});

test('coverage can reference known findings while quick reports suppress them without losing the reviewer’s selection', () => {
  const known = ['one', 'two'].map(id => ({id, submitted: true, checked: false, ...reportFindingSelection({submitted: true, checked: false}, false)}));
  assert.ok(known.every(finding => !finding.checked && finding.disabled));
  assert.ok(known.every(finding => reportFindingSelection(finding, true).checked));
  known[0].coverageChecked = true; known[1].coverageChecked = false;
  assert.deepEqual(known.map(finding => reportFindingSelection(finding, true).checked), [true, false]);
  const quick = known.map(finding => ({...finding, ...reportFindingSelection(finding, false)}));
  assert.ok(quick.every(finding => !finding.checked && finding.disabled));
  const draft = {version: 1, workId: 'work', snapshotId: 'exact', mode: 'report', scope: 'partial', clean: false, scopeNote: 'Second system', displayName: '', discussionUrl: '', discussionAuthor: '', discussionSummary: '', findings: quick.map(({id, checked, coverageChecked}) => ({id, checked, coverageChecked, kind: 'transcription'}))};
  const restored = matchingReportDraft(JSON.parse(JSON.stringify(draft)), {workId: 'work', snapshotId: 'exact', mode: 'report', findingIds: ['one', 'two']});
  assert.deepEqual(restored.findings.map(finding => reportFindingSelection({...finding, submitted: true}, true).checked), [true, false]);
  assert.deepEqual(reportFindingSelection({submitted: false, checked: false}, false), {checked: false, disabled: false});
});

test('a delayed work A cannot replace selected work B or supply B’s action baseline', async () => {
  let selected = 'a'; const reads = [];
  const read = createCurrentWorkReader(slug => { const pending = deferred(); reads.push({slug, ...pending}); return pending.promise; }, () => selected);
  const a = read(); selected = 'b'; const b = read();
  reads[1].resolve(work('b')); assert.equal((await b).workId, 'b');
  reads[0].resolve(work('a')); assert.equal(await a, null);
});

test('returning to A still rejects the older A response and its obsolete errors', async () => {
  let selected = 'a'; const reads = [];
  const read = createCurrentWorkReader(() => { const pending = deferred(); reads.push(pending); return pending.promise; }, () => selected);
  const oldA = read(); selected = 'b'; const oldB = read(); selected = 'a'; const newA = read();
  reads[2].resolve(work('a')); assert.equal((await newA).current.snapshotId, 'snapshot-a');
  reads[0].resolve({...work('a'), current: {snapshotId: 'outdated-a'}}); assert.equal(await oldA, null);
  reads[1].reject(new Error('Obsolete network failure')); assert.equal(await oldB, null);
});

test('clearing selection invalidates a pending read; current errors and mismatched work remain visible', async () => {
  let selected = 'a'; const pending = deferred();
  const read = createCurrentWorkReader(() => pending.promise, () => selected);
  const a = read(); selected = ''; pending.resolve(work('a')); assert.equal(await a, null); assert.equal(await read(), null);
  selected = 'b';
  await assert.rejects(createCurrentWorkReader(async () => { throw new Error('Current network failure'); }, () => selected)(), /Current network failure/);
  await assert.rejects(createCurrentWorkReader(async () => work('a'), () => selected)(), /different work/);
});

test('report drafts restore deliberate scope, declaration and attribution only on the exact work and revision', () => {
  const draft = {version: 1, workId: 'work-a', snapshotId: 'exact-a', mode: 'review', scope: 'partial', clean: false, scopeNote: 'First system only', displayName: 'Optional typed label', discussionUrl: 'https://github.com/project/repo/discussions/1', discussionAuthor: '@original', discussionSummary: '<script>untrusted quotation</script>', findings: [{id: 'one', checked: true, kind: 'source_error'}, {id: 'removed', checked: true, kind: 'transcription'}]};
  const context = {workId: 'work-a', snapshotId: 'exact-a', mode: 'review', findingIds: ['one', 'new']};
  const restored = matchingReportDraft(draft, context);
  assert.equal(restored.scope, 'partial'); assert.equal(restored.clean, false); assert.equal(restored.scopeNote, 'First system only');
  assert.equal(restored.displayName, draft.displayName); assert.equal(restored.discussionSummary, draft.discussionSummary);
  assert.deepEqual(restored.findings, [{id: 'one', checked: true, kind: 'source_error'}]);
  assert.equal(matchingReportDraft(draft, {...context, snapshotId: 'new-render'}), null);
  assert.equal(matchingReportDraft(draft, {...context, workId: 'work-b'}), null);
  assert.equal(matchingReportDraft(draft, {...context, mode: 'report'}), null);
  assert.equal(matchingReportDraft({...draft, clean: undefined}, context), null);
});

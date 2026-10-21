import test from 'node:test';
import assert from 'node:assert/strict';
import {createCurrentWorkReader, matchingReportDraft} from '../shared-ui.js';

const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return {promise, resolve, reject}; };
const work = slug => ({workId: slug, work: {slug}, current: {snapshotId: `snapshot-${slug}`}});

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

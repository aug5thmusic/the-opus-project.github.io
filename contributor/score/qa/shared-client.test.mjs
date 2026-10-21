import test from 'node:test';
import assert from 'node:assert/strict';
import {SharedClient, SharedError} from '../shared-client.js';

test('shared service endpoints stay on the configured secure origin and path', () => {
  for (const base of ['http://example.org', 'https://name:password@example.org', 'https://example.org/?secret=yes', 'javascript:alert(1)']) assert.throws(() => new SharedClient(base));
  const client = new SharedClient('https://project.example/service');
  assert.equal(client.url('/api/works').href, 'https://project.example/service/api/works');
  assert.throws(() => client.url('https://other.example/api/assets/digest'));
  assert.throws(() => client.url('../outside'));
  assert.equal(new SharedClient('http://127.0.0.1:8999').url('/api/session').href, 'http://127.0.0.1:8999/api/session');
});

test('work discovery follows every numeric API cursor without mistaking it for an asset path', async () => {
  const client = new SharedClient('http://127.0.0.1:8999');
  const calls = [];
  client.request = async path => {
    const url = client.url(path); calls.push(url.href);
    const after = Number(url.searchParams.get('after') ?? 0);
    return {items: [{id: after}], next: after < 100 ? String(after + 50) : null};
  };
  assert.deepEqual(await client.all('/api/works?limit=50'), [{id: 0}, {id: 50}, {id: 100}]);
  assert.equal(calls[2], 'http://127.0.0.1:8999/api/works?limit=50&after=100');
});

test('invalid or repeated list pages fail visibly instead of silently dropping later work', async () => {
  const client = new SharedClient('http://127.0.0.1:8999');
  client.request = async () => ({items: [], next: '50'});
  await assert.rejects(client.all('/api/works'), /repeated a page/);
  client.request = async () => ({items: null});
  await assert.rejects(client.all('/api/works'), /invalid list/);
});

test('sign-out clears identity synchronously while server revocation is pending', async () => {
  const client = new SharedClient('http://127.0.0.1:8999');
  client.useSession({token: 'SIMULATED-NONCREDENTIAL-FOR-TEST', user: {id: 'dev:alice', login: 'alice'}});
  let release, request;
  const held = new Promise(resolve => { release = resolve; });
  client.request = async (path, options) => { request = {path, options}; await held; return {}; };
  const signingOut = client.signOut();
  assert.equal(client.user, null);
  assert.equal(request.path, '/auth/logout');
  assert.equal(request.options.headers.Authorization, 'Bearer SIMULATED-NONCREDENTIAL-FOR-TEST');
  release(); await signingOut;
  assert.equal(client.user, null);
});

test('an expired earlier request cannot clear a newly authenticated identity', async () => {
  const client = new SharedClient('http://127.0.0.1:8999');
  client.useSession({token: 'SIMULATED-OLD-SESSION', user: {id: 'dev:alice', login: 'alice'}});
  const originalFetch = globalThis.fetch;
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  try {
    const pending = client.request('/api/session');
    client.useSession({token: 'SIMULATED-NEW-SESSION', user: {id: 'dev:bob', login: 'bob'}});
    release(new Response(JSON.stringify({error: 'Expired test session'}), {status: 401, headers: {'Content-Type': 'application/json'}}));
    await assert.rejects(pending, /Expired test session/);
    assert.equal(client.user.login, 'bob');
  } finally { globalThis.fetch = originalFetch; }
});

test('an interrupted asset body gives a useful retry error after successful response headers', async () => {
  const client = new SharedClient('http://127.0.0.1:8999');
  client.fetch = async () => ({blob: async () => { throw new TypeError('Failed to fetch'); }});
  await assert.rejects(client.asset('/api/assets/simulated'), error => error instanceof SharedError && error.status === 0 && /download was interrupted/.test(error.message) && /local draft is kept/.test(error.message) && /retry the same action/.test(error.message));
});

test('interrupted or malformed acknowledgement bodies retain uncertain-write retry semantics', async () => {
  const client = new SharedClient('http://127.0.0.1:8999');
  client.fetch = async () => ({json: async () => { throw new TypeError('Failed to fetch'); }});
  await assert.rejects(client.request('/api/proposals', {method: 'POST', body: {requestId: 'unchanged-retry'}}), error => error instanceof SharedError && error.status === 0 && /response was interrupted/.test(error.message) && /same action/.test(error.message));
  client.fetch = async () => new Response('not JSON', {status: 200});
  await assert.rejects(client.request('/api/proposals', {method: 'POST', body: {requestId: 'unchanged-retry'}}), error => error instanceof SharedError && error.status === 0 && /unreadable JSON/.test(error.message) && /local draft is kept/.test(error.message));
});

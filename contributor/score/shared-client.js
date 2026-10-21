// Public configuration only. OAuth credentials and session tokens are never stored here.
const loopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
let outboxConnection;
const outbox = () => outboxConnection ??= new Promise((resolve, reject) => {
  const request = indexedDB.open('score-desk-shared-outbox-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('requests', {keyPath: 'key'});
  request.onerror = () => reject(request.error);
  request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
});
async function stored(mode, action) {
  const database = await outbox();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('requests', mode); let result;
    const request = action(transaction.objectStore('requests'));
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? new Error('The retry record could not be saved.'));
  });
}

export class SharedError extends Error {
  constructor(message, status = 0, details = null) { super(message); this.name = 'SharedError'; this.status = status; this.details = details; }
}

export async function sharedConfiguration() {
  const response = await fetch(new URL('./shared-config.json', import.meta.url), {cache: 'no-store'});
  if (!response.ok) throw new SharedError('The shared project configuration could not be loaded. Local drafts are still available.');
  const config = await response.json();
  // Disposable loopback previews can select a test service. Public URLs cannot override the owner configuration.
  const override = loopback(location.hostname) && new URLSearchParams(location.search).get('service');
  if (override) {
    const url = new URL(override);
    if (!loopback(url.hostname) || url.protocol !== 'http:') throw new SharedError('Local previews can only select a loopback test service.');
    return {...config, apiBase: url.href};
  }
  return config;
}

export class SharedClient extends EventTarget {
  #token = null;
  constructor(apiBase) {
    super();
    this.base = new URL(apiBase);
    if (this.base.username || this.base.password || this.base.search || this.base.hash ||
        !(this.base.protocol === 'https:' || this.base.protocol === 'http:' && loopback(this.base.hostname))) {
      throw new SharedError('The project service must use HTTPS, or loopback HTTP for local testing.');
    }
    this.base.pathname = this.base.pathname.replace(/\/$/, '') + '/';
    this.user = null;
    this.devAuth = false;
  }
  url(path) {
    const url = new URL(path.replace(/^\//, ''), this.base);
    if (url.origin !== this.base.origin || !url.pathname.startsWith(this.base.pathname)) throw new SharedError('A shared asset points outside the configured project service.');
    return url;
  }
  async fetch(path, {method = 'GET', body, headers = {}, signal} = {}) {
    const requestHeaders = new Headers(headers);
    const sessionToken = this.#token;
    if (sessionToken) requestHeaders.set('Authorization', `Bearer ${sessionToken}`);
    let payload = body;
    if (body != null && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
      requestHeaders.set('Content-Type', 'application/json'); payload = JSON.stringify(body);
    }
    let response;
    try { response = await fetch(this.url(path), {method, headers: requestHeaders, body: payload, signal, credentials: 'omit', cache: 'no-store', redirect: 'error'}); }
    catch (error) { throw new SharedError('The project service could not be reached. Your local draft is kept. Reconnect and retry the same action.', 0, {cause: error.name}); }
    if (!response.ok) {
      let details; try { details = await response.json(); } catch {}
      if (response.status === 401 && this.#token === sessionToken) { this.#token = null; this.user = null; this.dispatchEvent(new Event('session')); }
      throw new SharedError(details?.error?.message ?? details?.message ?? (typeof details?.error === 'string' ? details.error : `The project service returned ${response.status}. Retry after checking your connection.`), response.status, details);
    }
    return response;
  }
  async request(path, options) {
    const response = await this.fetch(path, options);
    try { return await response.json(); }
    catch (error) {
      const problem = error.name === 'SyntaxError' ? 'returned an unreadable JSON response' : 'response was interrupted before it finished';
      // A successful status followed by an incomplete body is an uncertain
      // acknowledgement, not a rejected write. Keep the original retry request.
      throw new SharedError(`The project service ${problem}. Your local draft is kept. Retry the same action to recover its shared acknowledgement.`, 0, {cause: error.name});
    }
  }
  async asset(path) {
    const response = await this.fetch(path);
    try { return await response.blob(); }
    catch (error) { throw new SharedError('The project file download was interrupted before it finished. Your local draft is kept. Reconnect and retry the same action.', 0, {cause: error.name}); }
  }
  async write(path, body) {
    if (!this.user) throw new SharedError('Sign in before submitting. Your local draft is kept.', 401);
    if (typeof body.requestId !== 'string') throw new SharedError('The submission is missing its retry identity.');
    const key = `${this.base.href}:${this.user.id}:${body.requestId}`;
    let record = await stored('readonly', store => store.get(key));
    if (record && record.path !== path) throw new SharedError('This retry belongs to a different contribution.');
    if (record?.receipt) return record.receipt;
    if (record && JSON.stringify(record.body) !== JSON.stringify(body)) throw new SharedError('The pending submission changed. Retry the original contribution first.');
    if (!record) {
      record = {key, service: this.base.href, actor: this.user.id, path, body, createdAt: new Date().toISOString()};
      await stored('readwrite', store => store.add(record));
    }
    this.dispatchEvent(new Event('outbox'));
    let receipt;
    try { receipt = await this.request(path, {method: 'POST', body: record.body}); }
    catch (error) {
      if ([400, 403, 404, 409, 413, 422].includes(error.status)) {
        // A definite rejection is not an uncertain acknowledgement. Keep its evidence without retrying it forever.
        try { await stored('readwrite', store => store.put({...record, rejectedAt: new Date().toISOString(), rejection: {status: error.status, message: error.message}})); } catch {}
        this.dispatchEvent(new Event('outbox'));
      }
      throw error;
    }
    // Acknowledgement is already durable on the server. A local cache failure cannot undo it.
    try { await stored('readwrite', store => store.put({...record, body: null, receipt, acknowledgedAt: new Date().toISOString()})); }
    catch { /* The same immutable request remains safe to retry after a lost local acknowledgement. */ }
    this.dispatchEvent(new Event('outbox'));
    return receipt;
  }
  async pending() {
    if (!this.user) return [];
    return (await stored('readonly', store => store.getAll())).filter(record => record.kind !== 'draft' && record.service === this.base.href && record.actor === this.user.id && !record.receipt && !record.rejectedAt);
  }
  async saveDraft(name, value) { return stored('readwrite', store => store.put({key: `draft:${this.base.href}:${name}`, kind: 'draft', body: value, updatedAt: new Date().toISOString()})); }
  async draft(name) { return (await stored('readonly', store => store.get(`draft:${this.base.href}:${name}`)))?.body; }
  async clearDraft(name) { return stored('readwrite', store => store.delete(`draft:${this.base.href}:${name}`)); }
  async session() {
    const data = await this.request('/api/session');
    this.user = data.user ?? null;
    this.devAuth = data.devAuth === true && loopback(this.base.hostname) && loopback(location.hostname);
    this.dispatchEvent(new Event('session'));
    return data;
  }
  useSession(data) {
    if (typeof data.token !== 'string' || !data.user) throw new SharedError('Sign-in did not return a valid session. Your draft is unchanged.');
    this.#token = data.token; this.user = data.user; this.dispatchEvent(new Event('session')); return this.user;
  }
  async localSignIn(login) {
    if (!this.devAuth) throw new SharedError('Local test sign-in is unavailable.');
    return this.useSession(await this.request('/auth/dev', {method: 'POST', body: {login}}));
  }
  async signOut() {
    const token = this.#token;
    // Stop accepting new authenticated actions immediately, even while revocation is in flight.
    this.#token = null; this.user = null; this.dispatchEvent(new Event('session'));
    if (token) await this.request('/auth/logout', {method: 'POST', body: {}, headers: {Authorization: `Bearer ${token}`}});
  }
  async signIn() {
    const popup = window.open('about:blank', 'opus-project-sign-in', 'popup,width=640,height=760');
    if (!popup) throw new SharedError('Allow the sign-in window, then try Sign in with GitHub again. Your draft is kept.');
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const url = this.url('/auth/start'); url.searchParams.set('origin', location.origin); url.searchParams.set('challenge', challenge);
    return new Promise((resolve, reject) => {
      let finished = false, exchanging = false;
      const finish = (error, result) => {
        if (finished) return; finished = true; clearTimeout(timer); clearInterval(closed); window.removeEventListener('message', receive); popup.close();
        error ? reject(error) : resolve(result);
      };
      const receive = async event => {
        if (exchanging || event.origin !== this.base.origin || event.source !== popup || event.data?.type !== 'opus-auth') return;
        if (typeof event.data.code !== 'string') return finish(new SharedError('GitHub sign-in was not completed. Your draft is kept.'));
        exchanging = true;
        try { finish(null, this.useSession(await this.request('/auth/exchange', {method: 'POST', body: {code: event.data.code, verifier}}))); }
        catch (error) { finish(error); }
      };
      const timer = setTimeout(() => finish(new SharedError('Sign-in timed out. Your draft is kept; try again when ready.')), 180000);
      const closed = setInterval(() => { if (popup.closed && !exchanging) finish(new SharedError('The sign-in window closed. Your draft is kept.')); }, 500);
      window.addEventListener('message', receive); popup.location.href = url.href;
    });
  }
  async all(path) {
    const items = [], seen = new Set(); let next = path;
    while (next) {
      const key = this.url(next).href;
      if (seen.has(key)) throw new SharedError('The project service repeated a page. Refresh before preparing a package.');
      seen.add(key);
      const page = await this.request(next);
      if (!Array.isArray(page.items)) throw new SharedError('The project service returned an invalid list.');
      items.push(...page.items);
      if (page.next != null && /^\d+$/.test(String(page.next))) { const url = this.url(path); url.searchParams.set('after', String(page.next)); next = url.href; }
      else next = page.next;
    }
    return items;
  }
}

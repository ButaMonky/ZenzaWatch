'use strict';

// This factory runs in the userscript sandbox. Its three synchronous storage
// adapters must be private GM_*Value functions. request only targets api.x.com.
// https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token
function createXUserAuth({get, set, remove, request}) {
  const prefix = 'zenza.x.oauth.';
  const settingsKey = prefix + 'config';
  const loopback = 'http://127.0.0.1:48765/callback';
  const required = ['tweet.read', 'users.read', 'media.write', 'tweet.write'];
  const reserved = ['state', 'code', 'error', 'error_description', 'error_uri'];
  const readSettings = () => get(settingsKey) || {clientId: '', redirectUri: loopback, generation: ''};
  // Separate keys per configuration generation. Late asynchronous completions
  // from a disconnected tab cannot replace tokens belonging to a new account.
  const key = (settings, suffix) => prefix + settings.generation + '.' + suffix;
  const current = settings => readSettings().generation === settings.generation;
  let refreshing;

  function fail(code) {
    const err = new Error(code);
    err.code = code;
    return err;
  }

  function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function random() {
    return base64url(crypto.getRandomValues(new Uint8Array(32)));
  }

  function config() {
    const {clientId, redirectUri} = readSettings();
    return {clientId, redirectUri};
  }

  function parse(value, error) {
    if (typeof value !== 'string' || /[\s\\#]/.test(value)) throw fail(error);
    let url;
    try { url = new URL(value); } catch { throw fail(error); }
    if (url.username || url.password) throw fail(error);
    return url;
  }

  function configure({clientId, redirectUri} = {}) {
    if (typeof clientId !== 'string' || !/^[A-Za-z0-9._~-]{1,512}$/.test(clientId)) throw fail('INVALID_CONFIG');
    const uri = parse(redirectUri, 'INVALID_CONFIG');
    if ((uri.protocol !== 'https:' && redirectUri !== loopback) ||
        reserved.some(p => uri.searchParams.has(p))) throw fail('INVALID_CONFIG');
    const old = readSettings();
    if (old.clientId === clientId && old.redirectUri === redirectUri) return config();
    const oldToken = get(key(old, 'token'));
    set(settingsKey, {clientId, redirectUri, generation: random()});
    clear(old);
    if (oldToken) void revoke(old, oldToken);
    return config();
  }

  function clear(settings) {
    remove(key(settings, 'pending'));
    remove(key(settings, 'token'));
  }

  async function begin() {
    const settings = readSettings();
    if (!settings.clientId) throw fail('INVALID_CONFIG');
    const verifier = random();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    if (!current(settings)) throw fail('AUTH_REQUIRED');
    const state = random();
    const url = new URL('https://x.com/i/oauth2/authorize');
    url.search = new URLSearchParams({response_type: 'code', client_id: settings.clientId,
      redirect_uri: settings.redirectUri, scope: [...required, 'offline.access'].join(' '),
      state, code_challenge_method: 'S256', code_challenge: base64url(new Uint8Array(digest))}).toString();
    set(key(settings, 'pending'), {state, verifier, expiresAt: Date.now() + 10 * 60 * 1000});
    return url.href;
  }

  async function postForm(path, fields) {
    try {
      return await request(path, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams(fields).toString()});
    } catch {
      throw fail('NETWORK');
    }
  }

  async function exchange(settings, fields, previous) {
    const response = await postForm('/2/oauth2/token', {client_id: settings.clientId, ...fields});
    if (response?.status !== 200) {
      if (response?.json?.error === 'invalid_grant') throw fail('AUTH_EXPIRED');
      throw fail('TOKEN_ERROR');
    }
    const raw = response.json;
    try {
      return tokenFrom(raw, previous);
    } catch (err) {
      await revoke(settings, {access: raw?.access_token, refresh: raw?.refresh_token});
      throw err;
    }
  }

  function tokenFrom(raw, previous) {
    // A refresh may omit scope when it is unchanged (RFC 6749 section 5.1).
    const scope = raw?.scope ?? previous?.scope;
    const scopes = typeof scope === 'string' ? scope.split(/\s+/) : [];
    if (!required.every(s => scopes.includes(s))) throw fail('SCOPE_MISSING');
    if (typeof raw?.token_type !== 'string' || raw.token_type.toLowerCase() !== 'bearer' || typeof raw.access_token !== 'string' ||
        !/^[!-~]+$/.test(raw.access_token) || !Number.isSafeInteger(raw.expires_in) || raw.expires_in < 1) {
      throw fail('TOKEN_ERROR');
    }
    const refresh = scopes.includes('offline.access') ? raw.refresh_token ?? previous?.refresh : undefined;
    if (refresh != null && (typeof refresh !== 'string' || !/^[!-~]+$/.test(refresh))) throw fail('TOKEN_ERROR');
    return {id: random(), access: raw.access_token, refresh: refresh || '', scope,
      expiresAt: Date.now() + raw.expires_in * 1000};
  }

  function callbackParams(value, settings) {
    const callback = parse(value, 'INVALID_CALLBACK');
    const registered = new URL(settings.redirectUri);
    // Keep the exact origin and path, plus the registered fixed query (if any).
    // Reject userinfo, alternate hosts, duplicate response fields, and query substitutions.
    if (callback.origin !== registered.origin || callback.pathname !== registered.pathname ||
        value.split('?')[0] !== settings.redirectUri.split('?')[0]) throw fail('INVALID_CALLBACK');
    const params = callback.searchParams;
    for (const name of new Set(registered.searchParams.keys())) {
      const actual = params.getAll(name);
      const expected = registered.searchParams.getAll(name);
      if (actual.length !== expected.length || expected.some((v, i) => v !== actual[i])) throw fail('INVALID_CALLBACK');
    }
    if (params.getAll('state').length !== 1 || reserved.some(p => params.getAll(p).length > 1) ||
        params.has('code') === params.has('error')) throw fail('INVALID_CALLBACK');
    return params;
  }

  async function complete(value) {
    const settings = readSettings();
    const pendingKey = key(settings, 'pending');
    const pending = get(pendingKey);
    const params = callbackParams(value, settings);
    if (!pending?.verifier || params.get('state') !== pending.state) throw fail('INVALID_CALLBACK');
    if (Date.now() >= pending.expiresAt) {
      remove(pendingKey);
      throw fail('AUTH_EXPIRED');
    }
    if (params.has('error')) {
      remove(pendingKey);
      throw fail('AUTH_DENIED');
    }
    if (!params.get('code')) throw fail('INVALID_CALLBACK');
    // Consume the verifier before awaiting any I/O. The state marker detects a newer link attempt.
    set(pendingKey, {state: pending.state});
    try {
      const token = await exchange(settings, {grant_type: 'authorization_code', code: params.get('code'),
        redirect_uri: settings.redirectUri, code_verifier: pending.verifier});
      if (!current(settings) || get(pendingKey)?.state !== pending.state) {
        if (!current(settings)) await revoke(settings, token);
        throw fail('AUTH_REQUIRED');
      }
      set(key(settings, 'token'), token);
      return true;
    } finally {
      if (get(pendingKey)?.state === pending.state) remove(pendingKey);
    }
  }

  function isLinked() {
    const token = get(key(readSettings(), 'token'));
    return !!token?.access && (!!token.refresh || token.expiresAt > Date.now());
  }

  async function refresh(settings) {
    if (!current(settings)) throw fail('AUTH_REQUIRED');
    const tokenKey = key(settings, 'token');
    const previous = get(tokenKey);
    if (!previous?.access) throw fail('AUTH_REQUIRED');
    if (previous.expiresAt > Date.now() + (previous.refresh ? 30000 : 0)) return previous.access;
    if (!previous.refresh) throw fail('AUTH_REQUIRED');
    let next;
    try {
      next = await exchange(settings, {grant_type: 'refresh_token', refresh_token: previous.refresh}, previous);
    } catch (err) {
      if (['AUTH_EXPIRED', 'SCOPE_MISSING'].includes(err.code) && get(tokenKey)?.id === previous.id) remove(tokenKey);
      throw err;
    }
    if (!current(settings)) {
      await revoke(settings, next);
      throw fail('AUTH_REQUIRED');
    }
    const latest = get(tokenKey);
    if (latest?.id !== previous.id) {
      if (latest?.expiresAt > Date.now()) return latest.access;
      throw fail('AUTH_REQUIRED');
    }
    set(tokenKey, next);
    return next.access;
  }

  async function getToken() {
    const settings = readSettings();
    const token = get(key(settings, 'token'));
    if (!token?.access) throw fail('AUTH_REQUIRED');
    if (token.expiresAt > Date.now() + (token.refresh ? 30000 : 0)) return token.access;
    if (refreshing?.generation === settings.generation) return refreshing.promise;
    const locks = globalThis.navigator?.locks;
    const run = () => refresh(settings);
    const promise = locks ? locks.request(key(settings, 'refresh-lock'), run) : run();
    refreshing = {generation: settings.generation, promise};
    try { return await promise; }
    finally { if (refreshing?.promise === promise) refreshing = undefined; }
  }

  async function revoke(settings, token) {
    const values = [...new Set([token?.refresh, token?.access].filter(v => typeof v === 'string' && v.length))];
    const results = await Promise.all(values.map(async value => {
      try {
        const r = await postForm('/2/oauth2/revoke', {token: value, client_id: settings.clientId});
        return r?.status >= 200 && r.status < 300 && r.json?.revoked !== false;
      } catch { return false; }
    }));
    return results.every(Boolean);
  }

  function disconnect() {
    const old = readSettings();
    const token = get(key(old, 'token'));
    set(settingsKey, {...old, generation: random()});
    clear(old);
    return revoke(old, token);
  }

  return {config, configure, begin, complete, getToken, disconnect, isLinked};
}

module.exports = {createXUserAuth};

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash, randomUUID} = require('node:crypto');
const {createXUserAuth} = require('./x-user-auth.cjs');

const cfg = {clientId: 'test_client-1', redirectUri: 'http://127.0.0.1:48765/callback'};
const required = 'tweet.read users.read media.write tweet.write';
// Issue disposable token pairs for these simulated OAuth exchanges.
const tokenPair = () => ({access_token:randomUUID(), refresh_token:randomUUID()});
const initial = tokenPair(), rotated = tokenPair(), concurrent = tokenPair(), late = tokenPair();
const granted = {token_type: 'bearer', ...initial,
  scope: required + ' offline.access', expires_in: 7200};
const ok = json => ({status: 200, json});
function setup() {
  const db = new Map();
  const calls = [];
  const responses = [];
  const adapters = {
    get: k => structuredClone(db.get(k)),
    set: (k,v) => db.set(k,structuredClone(v)),
    remove: k => db.delete(k),
    request: async (path, init) => {
      calls.push({path, ...init, form: Object.fromEntries(new URLSearchParams(init.body))});
      const response = responses.shift();
      if (!response) throw Error('unexpected request');
      return typeof response === 'function' ? response() : response;
    }
  };
  const auth = createXUserAuth(adapters);
  auth.configure(cfg);
  return {db, calls, responses, auth, second: () => createXUserAuth(adapters)};
}
async function start(auth, redirectUri = cfg.redirectUri) {
  const authorization = new URL(await auth.begin());
  const callback = new URL(redirectUri);
  callback.searchParams.set('code', 'user-code');
  callback.searchParams.set('state', authorization.searchParams.get('state'));
  return {authorization, callback};
}

test('S256 challenge derives from the exchanged one-time verifier and scopes authorize media and posts', async () => {
  const {auth, calls, responses, second} = setup();
  const {authorization, callback} = await start(auth);
  const p = authorization.searchParams;
  assert.equal(authorization.origin + authorization.pathname, 'https://x.com/i/oauth2/authorize');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.equal(p.get('client_id'), cfg.clientId);
  assert.equal(p.get('redirect_uri'), cfg.redirectUri);
  assert.equal(p.get('response_type'), 'code');
  assert.deepEqual(p.get('scope').split(' ').sort(), (required + ' offline.access').split(' ').sort());
  assert.match(p.get('state'), /^[A-Za-z0-9_-]{32,}$/);
  responses.push(ok(granted));
  assert.equal(await second().complete(callback.href), true);
  const r = calls[0];
  assert.equal(r.path, '/2/oauth2/token');
  assert.equal(r.method, 'POST');
  assert.equal(r.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const {code_verifier, ...fields} = r.form;
  assert.match(code_verifier, /^[A-Za-z0-9._~-]{43,128}$/);
  assert.equal(createHash('sha256').update(code_verifier).digest('base64url'), p.get('code_challenge'));
  assert.deepEqual(fields, {grant_type: 'authorization_code', client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri, code: 'user-code'});
  assert.deepEqual(auth.config(), cfg);
  assert.equal(auth.isLinked(), true);
  assert.equal(await auth.getToken(), initial.access_token);
  await assert.rejects(auth.complete(callback.href), {code: 'INVALID_CALLBACK'});
  assert.equal(calls.length, 1);
});

test('foreign origins, paths, credentials, fragments, duplicate parameters and wrong states cannot exchange a code', async () => {
  const {auth, calls} = setup();
  const {callback} = await start(auth);
  for (const invalid of [
    callback.href.replace('127.0.0.1', '127.0.0.1.example.com'),
    callback.href.replace('/callback?', '/other?'),
    callback.href.replace('http://', 'http://user@'),
    callback.href + '#fragment', callback.href + '&state=other', callback.href + '&code=other',
    callback.href.replace(callback.searchParams.get('state'), 'wrong'),
    callback.href.replace('code=user-code','error=access_denied&code=user-code')
  ]) await assert.rejects(auth.complete(invalid), {code: 'INVALID_CALLBACK'});
  assert.equal(calls.length, 0);
  callback.searchParams.delete('code');
  callback.searchParams.set('error','access_denied');
  await assert.rejects(auth.complete(callback.href), {code: 'AUTH_DENIED'});
});

test('accepts operator-configured HTTPS callbacks and rejects insecure or ambiguous redirect URIs', async () => {
  const {auth, calls} = setup();
  for (const redirectUri of ['javascript:go()', 'http://example.com/cb','http://127.0.0.1:80/callback',
    'http://localhost:48765/callback', 'https://user@example.com/cb','https://example.com/cb#fragment',
    'https://example.com/cb?state=other']) {
    assert.throws(() => auth.configure({...cfg, redirectUri}), {code: 'INVALID_CONFIG'});
  }
  const redirectUri = 'https://auth.example.org/oauth/callback?tenant=one';
  auth.configure({...cfg, redirectUri});
  const {callback} = await start(auth, redirectUri);
  await assert.rejects(auth.complete(callback.href.replace('tenant=one', 'tenant=two')), {code: 'INVALID_CALLBACK'});
  assert.equal(calls.length, 0);
});

test('missing write scope and expired state never establish a link', async t => {
  const {auth, responses, calls} = setup();
  const initial = await start(auth);
  responses.push(ok({...granted, scope: 'tweet.write users.read'}));
  await assert.rejects(auth.complete(initial.callback.href), {code: 'SCOPE_MISSING'});
  assert.equal(auth.isLinked(), false);
  const next = await start(auth);
  t.mock.method(Date, 'now', () => nextTime);
  const nextTime = new Date().getTime() + 601000;
  const previousCalls = calls.length;
  await assert.rejects(auth.complete(next.callback.href), {code: 'AUTH_EXPIRED'});
  assert.equal(calls.length, previousCalls);
});

test('refreshes once for parallel callers, adopts rotated tokens, and forgets secrets before remote revocation', async t => {
  const {auth, responses, calls, db} = setup();
  const now = Date.now();
  let clock = now;
  t.mock.method(Date, 'now', () => clock);
  const {callback} = await start(auth);
  responses.push(ok(granted));
  await auth.complete(callback.href);
  clock += 7201000;
  responses.push(ok({...granted, ...rotated}));
  assert.deepEqual(await Promise.all([auth.getToken(), auth.getToken()]), [rotated.access_token,rotated.access_token]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].form, {grant_type:'refresh_token', refresh_token:initial.refresh_token, client_id:cfg.clientId});
  responses.push(() => {
    assert.equal(auth.isLinked(), false);
    assert.doesNotMatch(JSON.stringify([...db.values()]), /(?:access|refresh)-[12]/);
    return ok({});
  }, ok({}));
  assert.equal(await auth.disconnect(), true);
  assert.ok(calls.slice(2).every(c => c.path === '/2/oauth2/revoke' && c.form.client_id === cfg.clientId));
  assert.ok(calls.slice(2).some(c => c.form.token === rotated.refresh_token));
  await assert.rejects(auth.getToken(), {code:'AUTH_REQUIRED'});
});

test('an exchange finishing after unlink in a second tab cannot silently reconnect the account', async () => {
  const {auth, responses, second} = setup();
  let resolveExchange, entered;
  const started = new Promise(resolve => {entered = resolve;});
  const {callback} = await start(auth);
  responses.push(() => new Promise(resolve => {resolveExchange = resolve; entered();}));
  const linking = auth.complete(callback.href);
  await started;
  await second().disconnect();
  responses.push(ok({}), ok({}));
  resolveExchange(ok(granted));
  await assert.rejects(linking, {code:'AUTH_REQUIRED'});
  assert.equal(second().isLinked(), false);
});

test('offline access is optional and failed remote revocation still removes local authorization', async () => {
  const {auth, responses} = setup();
  const {callback} = await start(auth);
  responses.push(ok({...granted,scope: required,refresh_token:undefined}));
  await auth.complete(callback.href);
  assert.equal(await auth.getToken(), initial.access_token);
  responses.push({status: 503});
  assert.equal(await auth.disconnect(), false);
  assert.equal(auth.isLinked(), false);
});

test('two tabs share a refresh lock and observe the new access token', async t => {
  const {auth, responses, calls, second} = setup();
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const {callback} = await start(auth);
  responses.push(ok(granted));
  await auth.complete(callback.href);
  now += 7201000;
  responses.push(ok({...granted, ...concurrent}));
  assert.deepEqual(await Promise.all([auth.getToken(), second().getToken()]), [concurrent.access_token,concurrent.access_token]);
  assert.equal(calls.filter(c => c.form.grant_type === 'refresh_token').length, 1);
});

test('unlinking during a refresh rejects the late result and forgets the rotated token', async t => {
  const {auth, responses, second, db} = setup();
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const {callback} = await start(auth);
  responses.push(ok(granted));
  await auth.complete(callback.href);
  now += 7201000;
  let enter, finish;
  const refreshing = new Promise(resolve => {enter = resolve;});
  responses.push(() => new Promise(resolve => {finish = resolve; enter();}), ok({}), ok({}));
  const pending = auth.getToken();
  await refreshing;
  await second().disconnect();
  responses.push(ok({}), ok({}));
  finish(ok({...granted, ...late}));
  await assert.rejects(pending, {code:'AUTH_REQUIRED'});
  assert.equal(auth.isLinked(), false);
  for (const value of Object.values(late)) assert.ok(!JSON.stringify([...db.values()]).includes(value));
});

test('a malformed token response is a stable TOKEN_ERROR and is never used for posting', async () => {
  const {auth, responses} = setup();
  const {callback} = await start(auth);
  responses.push(ok({...granted,token_type:42}));
  await assert.rejects(auth.complete(callback.href), {code:'TOKEN_ERROR'});
  assert.equal(auth.isLinked(), false);
});

test('an incomplete grant is revoked when its scopes cannot authorize video publishing', async () => {
  const {auth, calls, responses} = setup();
  const {callback} = await start(auth);
  responses.push(ok({...granted,scope:'users.read offline.access'}), ok({}), ok({}));
  await assert.rejects(auth.complete(callback.href), {code:'SCOPE_MISSING'});
  assert.deepEqual(calls.filter(c => c.path === '/2/oauth2/revoke').map(c => c.form.token).sort(),
    [initial.access_token,initial.refresh_token].sort());
  assert.equal(auth.isLinked(), false);
});

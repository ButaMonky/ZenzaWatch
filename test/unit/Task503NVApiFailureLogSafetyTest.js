// Task503: canonical NVApi TypeScript must emit a runtime that never logs
// URL, query parameters, tokens, or raw fetch exceptions.
// Synthetic VM only; no live NicoNico network and no credential acquisition.
'use strict';
const assert = require('assert');
const {extract, run, createContext} = require('../helpers/extractSource');

const sourcePaths = [
  ['source', 'packages/lib/src/nico/NVApi.js'],
  ['dev-dist', 'dist/ZenzaWatch-dev.user.js']
];
const PRIVATE = 'SYNTHETIC_SIGNED_VALUE_DO_NOT_EXPOSE';
const endpoint = 'https://nvapi.nicovideo.jp/v1/users/me/likes/items?session=' + PRIVATE;
const stringifyWarnings = warnings => warnings.map(args => args.map(x =>
  typeof x === 'string' ? x : JSON.stringify(x)).join(' ')).join('\n');
function fixture(path, fetcher) {
  const calls = [], warnings = [];
  const ctx = createContext({
    netUtil: {fetch: (...args) => {calls.push(args); return fetcher(...args);}},
    console: {warn: (...args) => warnings.push(args), log() {}, error() {}},
    Promise
  });
  run('const NVApi = ' + extract(path,'NVApi','var') + ';globalThis.__api=NVApi;',ctx);
  return {api:ctx.__api,calls,warnings};
}

for (const [variant, path] of sourcePaths) {
  describe('Task503 NVApi failure log privacy / '+variant, () => {
    it('does not print signed URL, params or rejection errors', async () => {
      const fault=Object.assign(new Error('request ' + endpoint), {
        token: PRIVATE, url: endpoint
      });
      const f=fixture(path, () => Promise.reject(fault));
      const result=await f.api.call(endpoint, {method:'DELETE'});
      assert.strictEqual(result, undefined, 'transport failure still resolves undefined');
      assert.strictEqual(f.warnings.length, 1, 'one non-sensitive warning');
      const line=stringifyWarnings(f.warnings);
      assert(line.includes('nvapi fail'), 'keep a predictable diagnostic');
      for (const forbidden of [PRIVATE,endpoint,'session=','DELETE','token']) {
        assert(!line.includes(forbidden), 'unexpected private field in warning');
      }
      assert.strictEqual(f.warnings[0].length,1,'no object or raw Error argument');
    });
    it('never logs a fake response body or arbitrary exception object', async () => {
      const rejection={response:{url:endpoint,data:{token:PRIVATE}},
        detail:'private-error-payload-'+PRIVATE};
      const f=fixture(path,()=>Promise.reject(rejection));
      const result=await f.api.call(endpoint, {});
      assert.strictEqual(result, undefined);
      const line=stringifyWarnings(f.warnings);
      assert(line.includes('nvapi fail'));
      assert(!line.includes(PRIVATE) && !line.includes('response'));
    });
    it('preserves credentialed frontend headers, method and timeout', async () => {
      const response={status:403,json:async()=>({meta:{status:403}})};
      const f=fixture(path,()=>Promise.resolve(response));
      assert.strictEqual(await f.api.call(endpoint,{method:'DELETE'}),response);
      assert.strictEqual(f.calls.length,1);
      assert.strictEqual(f.calls[0][0],endpoint);
      const init=f.calls[0][1];
      assert.strictEqual(init.method,'DELETE');
      assert.strictEqual(init.credentials,'include');
      assert.strictEqual(init.mode,'cors');
      assert.strictEqual(init.timeout,5000);
      assert.strictEqual(init.headers['X-Frontend-Id'],'6');
      assert.strictEqual(init.headers['X-Frontend-Version'],'0');
      assert.strictEqual(init.headers['X-Request-with'],'https://www.nicovideo.jp');
      assert.strictEqual(f.warnings.length,0,'HTTP status classification stays with callers');
    });
    it('defaults to GET, returns original response and never logs success', async () => {
      const response={status:200};
      const f=fixture(path,()=>Promise.resolve(response));
      assert.strictEqual(await f.api.call(endpoint),response);
      assert.strictEqual(f.calls[0][1].method,'GET');
      assert.deepStrictEqual(f.warnings,[]);
    });
  });
}

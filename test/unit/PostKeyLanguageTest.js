// Task176 (Darasan follow-up D05): getPostKey receives the resolved thread language but
// did not send it. The real getPostKey/_postChat are used; only fetch is replaced, and
// the final fetch arguments are inspected (getPostKey itself is not stubbed).
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function loader(responder) {
  const requests = [];
  const quiet = {log() {}, warn() {}, error() {}, info() {}};
  const c = createContext({
    console: quiet, logSafe: {redact: x => x}, sleep: async () => {},
    netUtil: {fetch: async (url, options = {}) => {
      requests.push({url: String(url), options});
      return {json: async () => responder(String(url), options, requests.length)};
    }}
  });
  const l = run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';ThreadLoader;', c);
  return {l, requests, keyRequests: () => requests.filter(r => r.url.includes('/comment/keys/post'))};
}
const ok = data => ({meta: {status: 200}, data});
const msgInfo = language => ({
  threadInfo: {videoId: 'so9', threadId: 10, language},
  nvComment: {server: 'https://comments.invalid'}
});

describe('Task176 post key request carries the resolved comment language', () => {
  it('sends X-Niconico-Language from the options to the post-key endpoint', async () => {
    const h = loader(url => ok({postKey: 'fixture'}));
    await h.l.getPostKey(10, {language: 'en-us'});
    const [req] = h.keyRequests();
    assert.strictEqual(req.options.headers['X-Niconico-Language'], 'en-us');
    assert.strictEqual(req.options.headers['X-Frontend-Id'] !== undefined, true);
    assert.strictEqual(req.options.credentials, 'include');
  });

  it('defaults the header when the language is missing', async () => {
    const h = loader(() => ok({postKey: 'fixture'}));
    await h.l.getPostKey(10, {});
    assert.strictEqual(h.keyRequests()[0].options.headers['X-Niconico-Language'], 'ja-jp');
  });

  it('a real post uses the resolved thread language, not a page/UI language', async () => {
    const h = loader(url => (url.includes('/keys/post') ? ok({postKey: 'fixture'}) : ok({no: 1, id: 'c1'})));
    const result = await h.l.postChat(msgInfo('zh-tw'), 'fixture', '', 0);
    assert.strictEqual(result.no, 1);
    assert.strictEqual(h.keyRequests().length, 1);
    assert.strictEqual(h.keyRequests()[0].options.headers['X-Niconico-Language'], 'zh-tw');
  });

  it('keeps the single token retry and never re-posts on a non-token failure', async () => {
    let posts = 0;
    const retry = loader(url => {
      if (url.includes('/keys/post')) { return ok({postKey: 'fixture'}); }
      posts++;
      return posts === 1 ? {meta: {status: 403, errorCode: 'EXPIRED_TOKEN'}} : ok({no: 2, id: 'c2'});
    });
    retry.l.load = async () => {};
    await retry.l.postChat(msgInfo('en-us'), 'fixture', '', 0);
    assert.strictEqual(posts, 2);
    assert.deepStrictEqual(retry.keyRequests().map(r => r.options.headers['X-Niconico-Language']), ['en-us', 'en-us']);

    let failedPosts = 0;
    const fail = loader(url => {
      if (url.includes('/keys/post')) { return ok({postKey: 'fixture'}); }
      failedPosts++;
      return {meta: {status: 403, errorCode: 'FORBIDDEN'}};
    });
    await assert.rejects(fail.l.postChat(msgInfo('en-us'), 'fixture', '', 0));
    assert.strictEqual(failedPosts, 1);
  });
});

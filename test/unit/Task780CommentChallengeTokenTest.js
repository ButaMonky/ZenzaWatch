'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

// Synthetic authenticated POST. No real site/token/cookie is contacted or persisted.
function createSubject(challenge, challengeResolver, postReply) {
  const requests = [], capturedLogs = [];
  const token = 'TEST-CHALLENGE-TOKEN-NOT-FOR-SERVER';
  const json = data => ({status: 200, json: async () => data});
  const context = createContext({
    logSafe: {redact: value => value}, sleep: async () => {},
    PopupMessage: {alert() {}}, debug: {},
    netUtil: {fetch: async (url, options = {}) => {
      if (String(url).includes('/keys/post')) {
        requests.push({kind: 'key'});
        return json({meta: {status: 200}, data: {postKey: 'SYNTH-KEY', challenge}});
      }
      requests.push({kind: 'post', packet: JSON.parse(options.body)});
      return json(postReply || {meta: {status: 201}, data: {no: 8, id: 'ok'}});
    }},
    console: {log: (...args) => capturedLogs.push(args), warn() {}, time() {}, timeEnd() {}}
  });
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';globalThis.loader=ThreadLoader;', context);
  const subject = context.loader;
  let resolverCalls = 0;
  subject.getChallengeToken = async siteKey => {
    resolverCalls++;
    return challengeResolver(siteKey, token);
  };
  const data = {threadInfo: {videoId: 'sm9', threadId: 11, language: 'ja-jp',
    canPost: true, is184Forced: false}, nvComment: {server: 'https://comments.invalid'}};
  return {subject, data, requests, token, capturedLogs, get resolverCalls() {return resolverCalls;}};
}
const settleFailure = p => p.subject.postChat(p.data, 'draft', '184 red', 1.25)
  .then(() => {throw new Error('Unexpected success');}, error => error);

describe('Task780 real challenge token POST integration', () => {
  it('awaits a user-completed Turnstile and sends challengeToken in the POST body exactly once', async () => {
    const p = createSubject({isRequired: true, siteKey: 'public-example-sitekey'},
      async key => {assert.strictEqual(key, 'public-example-sitekey'); return 'TEST-CHALLENGE-TOKEN-NOT-FOR-SERVER';});
    const result = await p.subject.postChat(p.data, 'draft', '184 red', 1.25);
    assert.strictEqual(result.no, 8);
    assert.strictEqual(p.resolverCalls, 1);
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key', 'post']);
    assert.strictEqual(p.requests[1].packet.challengeToken, p.token);
    assert.deepStrictEqual(Object.keys(p.requests[1].packet),
      ['body', 'commands', 'vposMs', 'postKey', 'videoId', 'challengeToken']);
    assert(!JSON.stringify(p.capturedLogs).includes(p.token), 'challenge token is never logged');
    assert(!JSON.stringify(p.capturedLogs).includes('SYNTH-KEY'), 'post key is never logged');
  });
  it('never sends a POST when the user cancels authentication', async () => {
    const p = createSubject({isRequired: true, siteKey: 'public-example-sitekey'}, async () => {
      throw {status: 'fail', reason: 'challenge-cancelled', outcome: 'not-sent',
        message: '認証を中止しました'};
    });
    const error = await settleFailure(p);
    assert.strictEqual(error.reason, 'challenge-cancelled');
    assert.strictEqual(error.outcome, 'not-sent');
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key']);
  });
  it('does not invoke Turnstile when the siteKey is absent', async () => {
    const p = createSubject({isRequired: true}, async () => 'must-not-run');
    const error = await settleFailure(p);
    assert.strictEqual(error.reason, 'challenge-unavailable');
    assert.strictEqual(p.resolverCalls, 0);
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key']);
  });
  it('rejects malformed or empty tokens without sending to the server', async () => {
    const p = createSubject({isRequired: true, siteKey: 'public-example-sitekey'}, async () => '');
    const error = await settleFailure(p);
    assert.strictEqual(error.reason, 'challenge-unavailable');
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key']);
  });
  it('does not replay a rejected challenge even after obtaining a valid token', async () => {
    const p = createSubject({isRequired: true, siteKey: 'public-example-sitekey'},
      async (_, token) => token, {meta: {status: 400, errorCode: 'INVALID_CHALLENGE_TOKEN'}, data: {}});
    const error = await settleFailure(p);
    assert.strictEqual(error.reason, 'challenge-rejected');
    assert.strictEqual(error.outcome, 'rejected');
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key', 'post']);
    assert(!JSON.stringify(p.capturedLogs).includes(p.token));
  });
  it('does not include challengeToken in an ordinary non-challenged comment', async () => {
    const p = createSubject({isRequired: false}, async () => 'must-not-run');
    await p.subject.postChat(p.data, 'ordinary', '', 0);
    assert.strictEqual(p.resolverCalls, 0);
    assert.deepStrictEqual(Object.keys(p.requests[1].packet),
      ['body', 'commands', 'vposMs', 'postKey', 'videoId']);
  });
});

describe('Task780 in-flight video ownership boundary', () => {
  it('does not request challenge or POST if the originating video changed before verification', async () => {
    const p = createSubject({isRequired: true, siteKey: 'public-example-sitekey'},
      async () => 'SHOULD-NOT-RUN');
    const error = await p.subject.postChat(p.data, 'draft', '', 1, () => false)
      .then(() => null, e => e);
    assert.strictEqual(error.reason, 'challenge-stale-video');
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key']);
    assert.strictEqual(p.resolverCalls, 0);
  });
  it('discards an actual verification token when the original video changed during the challenge', async () => {
    let isOriginal = true;
    const p = createSubject({isRequired: true, siteKey: 'public-example-sitekey'},
      async (_key, token) => {
        isOriginal = false;
        return token;
      });
    const error = await p.subject.postChat(p.data, 'draft', '', 1, () => isOriginal)
      .then(() => null, e => e);
    assert.strictEqual(error.reason, 'challenge-stale-video');
    assert.strictEqual(error.outcome, 'not-sent');
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key']);
    assert(!JSON.stringify(p.capturedLogs).includes(p.token));
  });
  it('preserves legacy in-flight posting to the original video when no challenge was required', async () => {
    const p = createSubject({isRequired: false}, async () => 'SHOULD-NOT-RUN');
    const result = await p.subject.postChat(p.data, 'draft', '', 1, () => false);
    assert.strictEqual(result.no, 8);
    assert.deepStrictEqual(p.requests.map(x => x.kind), ['key', 'post']);
  });
});

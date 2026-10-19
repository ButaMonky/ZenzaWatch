'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function wire() {
  return run(beginSection('packages/lib/src/nico/CommentPostWire.js') +
    ';CommentPostWire;', createContext({netUtil: {fetch: () => {throw Error('not used');}}}));
}

describe('Task488 typed nvComment POST/key response envelope', () => {
  it('preserves the exact success data reference for 200 and 201', () => {
    const api = wire();
    for (const status of [200, 201, 204, 299]) {
      const reply = {meta: {status}, data: {postKey: 'fixture-key', extra: status}};
      assert.strictEqual(api.unwrapApiEnvelope(reply), reply.data);
    }
  });
  it('preserves precise server rejection metadata including invalid challenge', () => {
    const api = wire();
    for (const [status, errorCode] of [[400, 'INVALID_CHALLENGE_TOKEN'],
      [403, 'EXPIRED_TOKEN'], [429, 'TOO_MANY_REQUESTS']]) {
      const meta = {status, errorCode, challengeToken: 'fixture-do-not-log'};
      assert.throws(() => api.unwrapApiEnvelope({meta, data: {}}),
        thrown => thrown === meta);
    }
  });
  it('rejects malformed meta/status without inventing a successful post', () => {
    const api = wire();
    const wrong = [null, undefined, false, [], {}, {meta: null},
      {meta: {}}, {meta: {status: '200'}, data: {no: 3}},
      {meta: {status: false}}, {meta: {status: 199}},
      {meta: {status: 600}}, {meta: {status: NaN}}];
    for (const reply of wrong) {
      assert.throws(() => api.unwrapApiEnvelope(reply),
        error => error && error.kind === 'schema' && error.errorCode === 'RESPONSE_SCHEMA');
    }
  });
  it('retains unknown success body as-is rather than assuming a post number', () => {
    const api = wire();
    assert.strictEqual(api.unwrapApiEnvelope({meta: {status: 200}}), undefined);
    assert.strictEqual(api.unwrapApiEnvelope({meta: {status: 200}, data: false}), false);
  });
});

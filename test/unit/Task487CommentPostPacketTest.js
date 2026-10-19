'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function wire() {
  const context = createContext({netUtil: {fetch: () => {throw Error('no network');}}});
  return run(beginSection('packages/lib/src/nico/CommentPostWire.js') + ';CommentPostWire;', context);
}

describe('Task487 typed comment-post key and packet boundary', () => {
  it('rejects missing or wrong-shaped post keys before posting', () => {
    const api = wire();
    for (const data of [null, undefined, '', 0, false, true, [], {},
      {postKey: null}, {postKey: 123}, {postKey: ''}, {postKey: ' \t'}]) {
      assert.strictEqual(api.readPostKey(data), null, JSON.stringify(data));
    }
  });
  it('preserves the exact nonempty key supplied by the server', () => {
    const api = wire();
    assert.strictEqual(api.readPostKey({postKey: '  secret-key  '}), '  secret-key  ');
  });
  it('does not parse an untrusted value as a key or accept inherited keys', () => {
    const api = wire();
    assert.strictEqual(api.readPostKey('secret-key'), null);
    assert.strictEqual(api.readPostKey(Object.create({postKey: 'inherited'})), null);
  });
  it('builds the legacy wire JSON and command tokens without logging content', () => {
    const api = wire();
    const input = {text: 'private fixture', cmd: 'red\tbig　test',
      vpos: 12.34, postKey: 'fixture-key', videoId: 'sm9'};
    const result = api.buildPacket(input);
    assert.deepStrictEqual(JSON.parse(result.packet), {
      body: 'private fixture', commands: ['red', 'big', 'test'],
      vposMs: 123, postKey: 'fixture-key', videoId: 'sm9'
    });
    assert.strictEqual(result.commandCount, 3);
    assert.strictEqual(result.hasBlankCommand, false);
  });
  it('preserves legacy null/empty command and negative position behavior', () => {
    const api = wire();
    for (const cmd of [null, undefined, '', '   ', '\t　']) {
      const result = api.buildPacket({text:'fixture', cmd, vpos:0,
        postKey:'key', videoId:'sm9'});
      assert.deepStrictEqual(JSON.parse(result.packet).commands, []);
      assert.strictEqual(result.commandCount, 0);
    }
    assert.strictEqual(JSON.parse(api.buildPacket({text:'fixture', cmd:'red',
      vpos:-1.23, postKey:'key', videoId:'sm9'}).packet).vposMs, -13);
  });
});

describe('Task487 live ThreadLoader uses TypeScript-generated wire helpers', () => {
  it('validates the server key and delegates final JSON serialization', async () => {
    const context = createContext({
      console: {log() {}, warn() {}, error() {}, info() {}},
      logSafe: {redact: value => value}, sleep: async () => {},
      netUtil: {fetch: () => {throw Error('must not fetch');}}
    });
    const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';ThreadLoader;', context);
    const api = run('CommentPostWire', context);
    const calls = [];
    const originalRead = api.readPostKey, originalBuild = api.buildPacket;
    api.readPostKey = value => {
      calls.push('key'); return originalRead(value);
    };
    api.buildPacket = opts => {
      calls.push('packet'); return originalBuild(opts);
    };
    loader.getPostKey = async () => ({postKey: 'fixture-secret'});
    const posted = [];
    loader._post = async (url, payload) => {
      posted.push({url: String(url), payload: JSON.parse(payload)});
      return {no: 4, id: 'fixture-comment'};
    };
    const msgInfo = {threadInfo: {videoId: 'sm9', threadId: 100,
      language: 'ja-jp', is184Forced: false},
      nvComment: {server: 'https://comments.invalid'}};
    const result = await loader.postChat(msgInfo, 'fixture comment', 'red', 12.3);
    assert.strictEqual(result.no, 4);
    assert.deepStrictEqual(calls, ['key', 'packet']);
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].payload.vposMs, 123);
    assert.deepStrictEqual(posted[0].payload.commands, ['red']);
  });
});

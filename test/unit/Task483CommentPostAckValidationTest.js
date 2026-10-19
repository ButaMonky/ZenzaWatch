// Task483: an acknowledgement must contain a real, non-negative comment number.
// Regresses Number(false), Number([]) and Number('   ') being accepted as success.
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function posting(ack) {
  let posts = 0;
  const c = createContext({console: {log() {}, warn() {}, error() {}, info() {}},
    logSafe: {redact: x => x}, sleep: async () => {}});
  const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';ThreadLoader;', c);
  loader.getPostKey = async () => ({postKey: 'test-only-key'});
  loader._post = async () => { posts++; return ack; };
  const msgInfo = {threadInfo: {videoId: 'sm9', threadId: 10, language: 'ja-jp'},
    nvComment: {server: 'https://comments.invalid'}};
  return {send: () => loader.postChat(msgInfo, 'test-only-body', '', 0), posts: () => posts};
}

const invalid = [
  ['false', {no: false}], ['true', {no: true}],
  ['empty array', {no: []}], ['numeric array', {no: [7]}],
  ['whitespace', {no: '   '}], ['negative', {no: -1}],
  ['fraction', {no: 1.5}], ['unsafe integer', {no: Number.MAX_SAFE_INTEGER + 1}],
  ['fraction string', {no: '1.5'}], ['exponent string', {no: '1e2'}],
  ['missing number', {}], ['null', null], ['array envelope', []]
];

describe('Task483 strict comment-post acknowledgement', () => {
  for (const [label, ack] of invalid) {
    it('does not confirm or retry ' + label, async () => {
      const h = posting(ack);
      const failure = await h.send().then(() => null, error => error);
      assert(failure, 'invalid acknowledgement must not confirm a post');
      assert.strictEqual(failure.reason, 'ack-incomplete');
      assert.strictEqual(failure.outcome, 'unknown');
      assert.strictEqual(h.posts(), 1, 'unknown acceptance must never be retried');
    });
  }
  for (const no of [0, 7, '7', '007', Number.MAX_SAFE_INTEGER]) {
    it('keeps valid comment number ' + JSON.stringify(no), async () => {
      const h = posting({no, id: 'test-only-id'});
      const result = await h.send();
      assert.strictEqual(result.status, 'ok');
      assert.strictEqual(result.no, Number(no));
      assert.strictEqual(result.id, 'test-only-id');
      assert.strictEqual(h.posts(), 1);
    });
  }
});

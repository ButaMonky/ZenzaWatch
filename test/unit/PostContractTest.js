import assert from 'power-assert';
const {beginSection, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

// Dialog and ThreadLoader methods are the actual extracted production sources.
// Only network/key refresh and the retry wait are replaced with controllable peers.
function posting(is184Forced = false) {
  const h = createDialogHarness();
  const d = h.dialog;
  const threadInfo = {threadId: '12', videoId: 'smA', language: 'en-us', is184Forced, blockNo: 17};
  const msgInfo = {threadInfo, nvComment: {server: 'https://comments.invalid'}};
  Object.assign(d, {_watchId: 'smA', _requestId: 'rA', _threadInfo: threadInfo,
    _videoInfo: {msgInfo}, _nicoVideoPlayer: h.player});
  d._playerConfig.props.commentLanguage = 'ja-jp'; // Resolved thread language takes precedence.
  return {h, d, msgInfo, threadInfo};
}

function connect(s, responses) {
  const packets = [], keys = [], waits = [];
  let refreshes = 0;
  const quiet = {log() {}, warn() {}, error() {}};
  const c = createContext({console: quiet, logSafe: {redact: x => x},
    sleep: async ms => { waits.push(ms); }});
  const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';ThreadLoader;', c);
  loader.getPostKey = async (id, options) => {
    keys.push({id, language: options.language});
    return {postKey: 'key-' + keys.length};
  };
  loader.load = async info => { assert.strictEqual(info, s.msgInfo); refreshes++; };
  loader._post = async (url, packet) => {
    packets.push({url: String(url), body: JSON.parse(packet)});
    const response = responses.shift();
    if (response && response.error) { throw response.error; }
    if (typeof response === 'function') { return response(); }
    return response;
  };
  s.d.threadLoader = loader;
  return {packets, keys, waits, refreshes: () => refreshes};
}
const token = code => ({error: {result: {status: 403, errorCode: code}}});

describe('ZW-023/024 posting contract', function() {
  it('EXPIRED_TOKEN from real dialog refreshes once and retries with resolved language and fresh post key', async function() {
    const s = posting();
    const net = connect(s, [token('EXPIRED_TOKEN'), {no: 41, id: 'new-id'}]);
    const result = await s.d.addChat('hello', 'red', 123);
    assert.strictEqual(result.id, 'new-id');
    assert.strictEqual(net.refreshes(), 1);
    assert.strictEqual(net.packets.length, 2);
    assert.deepEqual(net.keys, [{id: '12', language: 'en-us'}, {id: '12', language: 'en-us'}]);
    assert.deepEqual(net.packets.map(p => p.body.postKey), ['key-1', 'key-2']);
    assert.deepEqual(net.waits, [3000]);
    assert.deepEqual(net.packets[1].body, {body: 'hello', commands: ['184', 'red'], vposMs: 1230, postKey: 'key-2', videoId: 'smA'});
    assert.strictEqual(net.packets[1].url, 'https://comments.invalid/v1/threads/12/comments');
    assert.strictEqual(s.h.player.chats[0].no, 41);
    assert.strictEqual(s.threadInfo.blockNo, 17);
  });

  it('INVALID_TOKEN refreshes once; a second token rejection ends without a third post', async function() {
    const s = posting();
    const net = connect(s, [token('INVALID_TOKEN'), token('EXPIRED_TOKEN')]);
    let failure;
    try { await s.d.addChat('hello', '', 0); } catch (error) { failure = error; }
    assert(failure && failure.message.includes('EXPIRED_TOKEN'));
    assert.strictEqual(net.refreshes(), 1);
    assert.strictEqual(net.packets.length, 2);
    assert.strictEqual(net.keys.length, 2);
    assert.strictEqual(s.h.player.chats[0].isPostFail, true);
    assert.strictEqual(s.h.state.isCommentPosting, false);
  });

  it('an ambiguous network failure never refreshes or reposts', async function() {
    const s = posting();
    const net = connect(s, [{error: {result: {}, message: 'response lost'}}]);
    let rejected = false;
    try { await s.d.addChat('hello', '', 0); } catch (_) { rejected = true; }
    assert(rejected);
    assert.strictEqual(net.refreshes(), 0);
    assert.strictEqual(net.packets.length, 1);
    assert.deepEqual(net.waits, []);
  });

  it('forced anonymous thread does not add 184; local chat gets thread and owner option survives', async function() {
    const s = posting(true);
    const net = connect(s, [{no: 1, id: 'one'}]);
    await s.d.addChat('owner-style local chat', 'red', 0, {fork: 1});
    assert.deepEqual(net.packets[0].body.commands, ['red']);
    const chat = s.h.player.chats[0];
    assert.strictEqual(chat.options.thread, 12);
    assert.strictEqual(chat.options.thead, undefined);
    assert.strictEqual(chat.options.fork, 1);
    assert.strictEqual(chat.options.isMine, true);
    assert.strictEqual(chat.isUpdating, false);
    assert.strictEqual(s.threadInfo.blockNo, 17);
  });

  it('non-forced thread adds 184 and success without blockNo preserves replacement thread metadata', async function() {
    const s = posting(false);
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const net = connect(s, [() => pending]);
    const post = s.d.addChat('hello', '', 0);
    await flush();
    s.d._threadInfo = {...s.threadInfo, blockNo: 23};
    finish({no: 2, id: 'two'});
    await post;
    assert.deepEqual(net.packets[0].body.commands, ['184']);
    assert.strictEqual(s.d._threadInfo.blockNo, 23);
    assert.strictEqual(s.threadInfo.blockNo, 17);
  });

  it('delayed A success after B starts posting preserves B state and records only A history', async function() {
    const s = posting();
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    connect(s, [() => pending]);
    const post = s.d.addChat('A comment', '', 0);
    await flush();
    Object.assign(s.d, {_watchId: 'smB', _requestId: 'rB', _threadInfo: {threadId: '99', blockNo: 88}, _videoInfo: {msgInfo: {tag: 'B'}}});
    s.h.state.isCommentPosting = true;
    finish({no: 3, id: 'three'});
    await post;
    assert.strictEqual(s.threadInfo.blockNo, 17);
    assert.strictEqual(s.d._threadInfo.blockNo, 88);
    assert.strictEqual(s.h.state.isCommentPosting, true);
    assert.deepEqual(s.h.cachePuts.map(row => row.id), ['smA']);
    assert.strictEqual(s.h.log.includes('execCommand:notify'), false);
    assert.strictEqual(s.h.player.chats[0].no, 3);
  });
});

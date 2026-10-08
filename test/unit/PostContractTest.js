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
  const packets = [], keys = [], waits = [], consoleCalls = [];
  let refreshes = 0;
  const rec = kind => (...args) => consoleCalls.push({kind, args});
  const quiet = {
    log: rec('log'),
    info: rec('info'),
    warn: rec('warn'),
    error: rec('error'),
    debug: rec('debug'),
    time() {},
    timeEnd() {}
  };
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
  const diagnostics = () => consoleCalls
    .filter(call => call.args[0] === '[ZenzaWatch][CommentPost]')
    .map(call => call.args[1]);
  return {packets, keys, waits, loader, diagnostics, refreshes: () => refreshes};
}
const token = code => ({error: {result: {status: 403, errorCode: code}}});

describe('ZW-023/024 posting contract', function() {
  it('Task215 dialog precheck reports an already-running post before network work starts', async function() {
    const s = posting();
    const warnings = [];
    s.h.context.console.warn = (...args) => warnings.push(args);
    s.h.state.isCommentPosting = true;
    await assert.rejects(s.d.addChat('fixture', '', 0));
    const entry = warnings.find(args => args[0] === '[ZenzaWatch][CommentPost]');
    assert(entry);
    assert.strictEqual(entry[1].phase, 'dialog-precheck');
    assert.strictEqual(entry[1].event, 'rejected');
    assert.strictEqual(entry[1].reason, 'post-already-in-flight');
    assert.strictEqual(entry[1].videoId, 'smA');
  });

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

  it('Task215 diagnostics correlate token retry and keep the first rejection', async function() {
    const s = posting();
    const net = connect(s, [token('EXPIRED_TOKEN'), {no: 41, id: 'new-id'}]);
    await s.d.addChat('diagnostic-fixture-body', 'red', 123);
    const diagnostics = net.diagnostics();
    const ids = [...new Set(diagnostics.map(d => d && d.id).filter(Boolean))];
    assert.strictEqual(ids.length, 1);
    const firstFailure = diagnostics.find(d => d.phase === 'post' && d.event === 'failure' && d.attempt === 1);
    assert(firstFailure);
    assert.strictEqual(firstFailure.statusCode, 403);
    assert.strictEqual(firstFailure.errorCode, 'EXPIRED_TOKEN');
    assert.strictEqual(firstFailure.retryScheduled, true);
    assert(diagnostics.some(d => d.phase === 'retry-refresh' && d.event === 'success'));
    const completed = diagnostics.find(d => d.phase === 'complete' && d.event === 'success' && d.attempt === 2);
    assert(completed);
    assert.strictEqual(completed.outcome, 'accepted');
    const serialized = JSON.stringify(diagnostics);
    assert(!serialized.includes('diagnostic-fixture-body'));
    assert(!serialized.includes('key-1'));
    assert(!serialized.includes('key-2'));
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

  it('Task215 diagnostics classify post-key HTTP failure before POST', async function() {
    const s = posting();
    const net = connect(s, []);
    net.loader.getPostKey = async () => {
      throw {result: {status: 429, errorCode: 'TOO_MANY_REQUESTS', retryAfterMs: 7000}};
    };
    await assert.rejects(s.d.addChat('fixture', '', 0));
    assert.strictEqual(net.packets.length, 0);
    const failure = net.diagnostics().find(d => d.phase === 'post-key' && d.event === 'failure');
    assert(failure);
    assert.strictEqual(failure.statusCode, 429);
    assert.strictEqual(failure.errorCode, 'TOO_MANY_REQUESTS');
    assert.strictEqual(failure.retryAfterMs, 7000);
    assert.strictEqual(failure.outcome, 'not-sent');
  });

  it('Task215 diagnostics keep only ACK shape when acknowledgement is incomplete', async function() {
    const s = posting();
    const net = connect(s, [{id: 'only-id', serverNote: 'diagnostic-ack-value'}]);
    const failure = await s.d.addChat('fixture', '', 0).then(() => null, error => error);
    assert.strictEqual(failure.reason, 'ack-incomplete');
    const ackFailure = net.diagnostics().find(d => d.phase === 'ack' && d.event === 'failure');
    assert(ackFailure);
    assert.strictEqual(ackFailure.outcome, 'unknown');
    assert.strictEqual(ackFailure.ackType, 'object');
    assert.strictEqual(ackFailure.hasNo, false);
    assert(ackFailure.ackKeys.includes('id'));
    assert(ackFailure.ackKeys.includes('serverNote'));
    assert(!JSON.stringify(net.diagnostics()).includes('diagnostic-ack-value'));
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

describe('Task301 anonymous-thread empty command compatibility', () => {
  for (const command of ['', '   ', '\t\u3000']) {
    it(`omits empty protocol tokens for ${JSON.stringify(command)}`, async () => {
      const s = posting(true); const net = connect(s, [{no: 1, id: 'one'}]);
      await s.d.addChat('fixture', command, 0);
      assert.deepEqual(net.packets[0].body.commands, []);
    });
  }
  it('retains nonempty tokens and automatic anonymity', async () => {
    const s = posting(false); const net = connect(s, [{no: 1, id: 'one'}]);
    await s.d.addChat('fixture', 'red  big', 0);
    assert.deepEqual(net.packets[0].body.commands, ['184', 'red', 'big']);
  });
});

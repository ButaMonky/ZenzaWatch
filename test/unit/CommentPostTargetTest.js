// Task183 (Watch V4 audit F07): a video whose comment metadata has no post target, or is
// partly missing, still parses and plays; posting is disabled explicitly and nothing is
// sent to an arbitrary thread. All responses are synthetic.
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

function v4(edit = () => {}) {
  const data = {
    client: {watchId: 'so9', watchTrackId: 'track'},
    comment: {threads: [{id: 10, fork: 0, isPostTarget: true}, {id: 11, fork: 1, isPostTarget: false}], layers: [{index: 1, components: [{threadId: 10, fork: 0}]}], ng: {}, nvComment: {server: 'https://comments.invalid', threadKey: 'fixture'}},
    media: {contents: {videos: [{id: 'v', isAvailable: true}], audios: [{id: 'a', isAvailable: true}]}, accessRightKey: 'fixture', isStoryboardAvailable: false},
    player: {initialPlayback: {positionSec: 0}},
    video: {id: 'so9', title: 'fixture', duration: 300, count: {view: 1}, thumbnail: {url: 'https://example.invalid/t.jpg'}, permission: {}},
    genre: {key: 'anime', label: 'anime'}, tags: {items: [], edit: {isEditable: false}},
    payment: {ppv: {isEnabled: false}, admission: {isEnabled: false}, premium: {isEnabled: false}}, viewer: null
  };
  edit(data);
  return {data: {response: {$watchV4: {data}}}};
}
async function load(payload) {
  const context = createContext({
    CacheStorage: class { setItem() {} }, sessionStorage: {},
    netUtil: {fetch: async url => ({json: async () => (String(url).includes('/watch/') ? payload : {})})},
    nicoUtil: {hasLargeThumbnail: () => false}, textUtil: {}, Config: {getValue: () => false},
    emitter: {emitAsync() {}}, debug: {}, console: {error() {}, info() {}, warn() {}, log() {}, time() {}, timeEnd() {}}
  });
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') + ';globalThis.loader=VideoInfoLoader;', context);
  return context.loader.load('so9', {});
}

describe('Task183 post target and partial comment metadata (Watch V4 audit F07)', () => {
  it('a normal video keeps its post target', async () => {
    const r = await load(v4());
    assert.strictEqual(r.msgInfo.threadId, 10);
    assert.strictEqual(r.msgInfo.canPost, true);
    assert.strictEqual(r.msgInfo.postUnavailableReason, null);
    assert.deepStrictEqual(Array.from(r.msgInfo.optionalThreads, t => t.id), [11]);
  });

  it('no post target: still playable, posting disabled, no thread is picked for it', async () => {
    const r = await load(v4(d => { d.comment.threads[0].isPostTarget = false; }));
    assert.strictEqual(r.isPlayable, true);
    assert.strictEqual(r.msgInfo.defaultThread, null);
    assert.strictEqual(r.msgInfo.threadId, null);
    assert.strictEqual(r.msgInfo.canPost, false);
    assert.strictEqual(r.msgInfo.postUnavailableReason, 'no-post-target');
    assert.strictEqual(r.msgInfo.threads.length, 2, 'threads stay readable');
  });

  it('missing threads/layers/components are reported, not treated as normal', async () => {
    const noThreads = await load(v4(d => { delete d.comment.threads; }));
    assert.strictEqual(noThreads.isPlayable, true);
    assert.strictEqual(noThreads.msgInfo.canPost, false);
    assert.strictEqual(noThreads.msgInfo.postUnavailableReason, 'malformed-comment');
    assert(noThreads.msgInfo.commentMetadataIssues.includes('threads'));
    const noComponents = await load(v4(d => { delete d.comment.layers[0].components; }));
    assert(noComponents.msgInfo.commentMetadataIssues.includes('components'));
    assert.strictEqual(noComponents.msgInfo.canPost, true, 'a readable post target remains usable');
    const noComment = await load(v4(d => { delete d.comment; }));
    assert.strictEqual(noComment.isPlayable, true);
    assert(noComment.msgInfo.commentMetadataIssues.includes('comment'));
  });

  it('the legacy record keeps its default post target', async () => {
    const r = await load(JSON.parse(JSON.stringify(require('../fixtures/watch-legacy-darasan.sanitized.json'))));
    assert.strictEqual(r.msgInfo.threadId, 1790214593);
    assert.strictEqual(r.msgInfo.canPost, true);
  });

  it('ThreadLoader never requests a key or POSTs without a post target', async () => {
    const requests = [];
    const c = createContext({console: {log() {}, warn() {}, error() {}, info() {}}, logSafe: {redact: x => x}, sleep: async () => {},
      netUtil: {fetch: async url => { requests.push(String(url)); return {json: async () => ({meta: {status: 200}, data: {postKey: 'x', no: 1}})}; }}});
    const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';ThreadLoader;', c);
    const msgInfo = {threadInfo: {videoId: 'so9', threadId: null, canPost: false, language: 'ja-jp'}, nvComment: {server: 'https://comments.invalid'}};
    await assert.rejects(loader.postChat(msgInfo, 'fixture', '', 0), e => e.reason === 'no-post-target');
    assert.deepStrictEqual(requests, []);
  });

  it('the dialog tells the user and does not add a local posting comment', async () => {
    const h = createDialogHarness(), notes = [];
    h.dialog.execCommand = (cmd, text) => notes.push(`${cmd}:${text}`);
    Object.assign(h.dialog, {_nicoVideoPlayer: h.player, _requestId: 'r1', _watchId: 'so9',
      _threadInfo: {threadId: null, canPost: false}, _videoInfo: {msgInfo: {}}});
    h.dialog.threadLoader.postChat = () => { throw Error('must not post'); };
    await assert.rejects(h.dialog.addChat('fixture', '', 0), e => e.reason === 'no-post-target');
    await flush();
    assert.strictEqual(h.player.chats.length, 0);
    assert.strictEqual(h.state.isCommentPosting, false);
    assert(notes.some(n => n.startsWith('alert:') && n.includes('投稿できません')));
  });
});

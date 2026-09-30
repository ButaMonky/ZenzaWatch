// Task 090（監査v2 R04）: 本体の再生の中心（NicoVideoPlayerDialog）で、動画を切り替えた・閉じた後に、
// 前の動画の非同期の結果（動画情報・セッション・接続・失敗・自動の「次へ」・コメント投稿）が今の動画へ入らないことの回帰テスト。
// ZW-012・014・015・016・017・021・025 を、それぞれ別の describe で確かめる。
// test/helpers/dialogHarness.js の代わりの部品で、本物のメソッドを動かす。実ブラウザ・実際のニコニコ動画での確認ではない。
import assert from 'power-assert';

const {createDialogHarness, flush} = require('../helpers/dialogHarness');

// A の読み込みを「セッションを作る」ところまで進める
async function openUntilCreate(h, tag) {
  h.dialog.open(tag);
  await flush();
  const i = h.loader.calls.length - 1;
  h.loader.calls[i].resolve(h.videoData(tag));
  h.cacheGet.calls[h.cacheGet.calls.length - 1].resolve(null);
  await flush();
  return h.sessionCreate.calls.length - 1;
}

// 1本の動画を最後（setVideo）まで開く
async function openFully(h, tag) {
  const ci = await openUntilCreate(h, tag);
  const s = h.openedSession(tag);
  h.sessionCreate.calls[ci].resolve(s);
  await flush();
  s.connect.calls[0].resolve({url: `url:${tag}`, type: 'domand'});
  await flush();
  return s;
}

const setVideos = h => h.log.filter(x => x.startsWith('setVideo:'));

describe('R04 ZW-012: 動画を切り替えた後に、前の動画の読み込みの結果を使わない', function() {
  this.timeout(10000);

  it('DIALOG-02: A のセッション作成を待つ間に B を開くと、後から完了した A は使わず、A のセッションは閉じる', async function() {
    const h = createDialogHarness();
    const ciA = await openUntilCreate(h, 'smA');
    const sB = await openFully(h, 'smB');
    const sA = h.openedSession('smA');
    h.sessionCreate.calls[ciA].resolve(sA);
    await flush();
    assert.deepEqual(setVideos(h), ['setVideo:url:smB']);
    assert.equal(sA.connect.calls.length, 0, 'A へ接続しない');
    assert.equal(sA.closeCount, 1, '使わない A のセッションは閉じる');
    assert.equal(sB.closeCount, 0, 'B のセッションは閉じない');
    assert.equal(h.dialog._videoSession, sB);
    assert.equal(h.state.videoInfo.watchId, 'smB');
  });

  it('A の接続（connect）を待つ間に B を開くと、後から返った A の URL・動画情報・コメントは使わない', async function() {
    const h = createDialogHarness();
    const ciA = await openUntilCreate(h, 'smA');
    const sA = h.openedSession('smA');
    h.sessionCreate.calls[ciA].resolve(sA);
    await flush();
    const sB = await openFully(h, 'smB');
    sA.connect.calls[0].resolve({url: 'url:smA', type: 'domand'});
    await flush();
    assert.deepEqual(setVideos(h), ['setVideo:url:smB']);
    assert.equal(h.state.videoInfo.watchId, 'smB');
    assert.deepEqual(h.log.filter(x => x.startsWith('loadComment:')), ['loadComment:smB']);
    assert.equal(sB.closeCount, 0);
  });

  it('A の接続が B を開いた後に失敗しても、B にエラーを出さない', async function() {
    const h = createDialogHarness();
    h.dialog.playNextVideo = () => h.log.push('playNextVideo');
    const ciA = await openUntilCreate(h, 'smA');
    const sA = h.openedSession('smA');
    h.sessionCreate.calls[ciA].resolve(sA);
    await flush();
    await openFully(h, 'smB');
    sA.connect.calls[0].reject(new Error('A failed'));
    await flush();
    assert.equal(h.state.isError, false);
    assert.equal(h.state.errorMessage, '');
    assert.equal(h.state.videoInfo.watchId, 'smB');
  });

  it('動画情報の読み込み中に閉じた（close）後は、返ってきた結果を使わない', async function() {
    const h = createDialogHarness();
    h.dialog.open('smA');
    await flush();
    h.dialog.close();
    h.loader.calls[0].resolve(h.videoData('smA'));
    h.cacheGet.calls[0].resolve(null);
    await flush();
    assert.equal(h.sessionCreate.calls.length, 0, 'セッションを作らない');
    assert.deepEqual(setVideos(h), []);
    assert.deepEqual(h.log.filter(x => x.startsWith('loadComment:')), []);
  });

  it('最初のプレイヤーの準備中に2回開いても、プレイヤーは1つだけ作り、読み込むのは後の動画だけ', async function() {
    const h = createDialogHarness();
    const init = h.setSlowPlayerInit();
    h.dialog.open('smA');
    await flush();
    h.dialog.open('smB');
    await flush();
    init.resolve();
    await flush();
    assert.equal(h.log.filter(x => x === 'initPlayer').length, 1, 'プレイヤーの初期化は1回');
    assert.deepEqual(h.loader.calls.map(c => c.args[0]), ['smB']);
  });

  it('正常: 1本だけ開けば、今までどおり最後まで読み込む', async function() {
    const h = createDialogHarness();
    const s = await openFully(h, 'smA');
    assert.deepEqual(setVideos(h), ['setVideo:url:smA']);
    assert.equal(h.state.videoInfo.watchId, 'smA');
    assert.equal(h.dialog._videoSession, s);
    assert.deepEqual(h.log.filter(x => x.startsWith('loadComment:')), ['loadComment:smA']);
  });
});

describe('R04 ZW-014: プレイリストへ追加するだけの時は、今の再生の世代・設定を変えない', function() {
  it('再生中・連続再生の時に別の動画を開くと、プレイリストへ入れるだけで requestId・options は元のまま', async function() {
    const h = createDialogHarness();
    const d = h.dialog;
    await openFully(h, 'smA');
    const requestId = d._requestId;
    const options = d._videoWatchOptions;
    h.state.isPlaying = true;
    h.playlist.isEnable = true;
    await d.open('smC');
    await flush();
    assert.deepEqual(h.playlist.inserted, ['smC']);
    assert.equal(d._requestId, requestId, 'requestId が変わらない（読み込み中のコメントを捨てない）');
    assert.equal(d._videoWatchOptions, options, '再読み込みに使う options が変わらない');
    assert.equal(h.loader.calls.length, 1, '新しく読み込まない');
  });

  it('すぐ開く（openNow）時は、今までどおり本当に開く', async function() {
    const h = createDialogHarness();
    const d = h.dialog;
    await openFully(h, 'smA');
    const requestId = d._requestId;
    h.state.isPlaying = true;
    h.playlist.isEnable = true;
    d.open('smC', {openNow: true});
    await flush();
    assert.notEqual(d._requestId, requestId);
    assert.deepEqual(h.loader.calls.map(c => c.args[0]), ['smA', 'smC']);
  });
});

describe('R04 ZW-015: 動画情報の読み込みの失敗の処理が、2つ目の例外にならない', function() {
  const inputs = [
    ['Error', () => new Error('network failure'), false],
    ['DOMException', () => new DOMException('aborted', 'AbortError'), false],
    ['{message}', () => ({message: 'network failure'}), false],
    ['{info: {isPlayable: false}}', () => ({message: 'deleted', info: {watchId: 'smA', isPlayable: false}}), true],
    ['forbidden', () => ({message: 'forbidden', reason: 'forbidden'}), true],
    ['not found', () => ({message: 'not found', reason: 'not found'}), true],
    ['undefined', () => undefined, false],
    ['文字列', () => 'plain failure', false]
  ];
  for (const [label, make, autoNext] of inputs) {
    it(`DIALOG-01: ${label} を受けても例外にならず、エラー表示と「次へ」（${autoNext ? 'する' : 'しない'}）が意図どおり`, function() {
      const h = createDialogHarness();
      const d = h.dialog;
      d._requestId = 'r1';
      d.playNextVideo = () => h.log.push('playNextVideo');
      h.playlist.isEnable = true;
      h.state.isOpen = true;
      d._onVideoInfoLoaderFail('r1', make());
      assert.equal(h.state.isError, true);
      assert.ok(h.state.errorMessage, 'エラーの表示がある');
      assert.ok(h.emitted.some(e => e[0] === 'loadVideoInfoFail'));
      h.timers.advance(3000);
      assert.equal(h.log.includes('playNextVideo'), autoNext);
    });
  }
});

describe('R04 ZW-016: エラー・NG の後の自動の「次へ」は、その動画のもの', function() {
  function erroredHarness() {
    const h = createDialogHarness();
    h.dialog.playNextVideo = () => h.log.push('playNextVideo');
    h.playlist.isEnable = true;
    h.state.isOpen = true;
    return h;
  }

  it('エラー → 2秒後に別の動画を手で開く → 1秒後: 勝手に次へ進まない', async function() {
    const h = erroredHarness();
    h.dialog.open('smA');
    await flush();
    h.loader.calls[0].reject({message: 'forbidden', reason: 'forbidden'});
    await flush();
    h.timers.advance(2000);
    h.dialog.open('smB', {openNow: true});
    await flush();
    h.timers.advance(1500);
    assert.equal(h.log.includes('playNextVideo'), false);
  });

  it('待っている間に閉じた時も、次へ進まない', async function() {
    const h = erroredHarness();
    h.dialog.open('smA');
    await flush();
    h.loader.calls[0].reject({message: 'forbidden', reason: 'forbidden'});
    await flush();
    h.dialog.close();
    h.state.isOpen = true;  // 閉じた後にまた開いた状態でも
    h.timers.advance(3000);
    assert.equal(h.log.includes('playNextVideo'), false);
  });

  it('NG の動画・セッションの失敗の後の「次へ」も、別の動画を開いたら取り消す', async function() {
    for (const kind of ['ng', 'session']) {
      const h = erroredHarness();
      const ci = await openUntilCreate(h, 'smA');
      if (kind === 'ng') {
        h.dialog._videoFilter.isNgVideo = () => true;
        h.sessionCreate.calls[ci].resolve(h.openedSession('smA'));
      } else {
        const s = h.openedSession('smA');
        h.sessionCreate.calls[ci].resolve(s);
        await flush();
        s.connect.calls[0].reject(new Error('session failed'));
      }
      await flush();
      assert.equal(h.state.isError, true, kind);
      h.timers.advance(1000);
      h.dialog._videoFilter.isNgVideo = () => false;
      h.dialog.open('smB', {openNow: true});
      await flush();
      h.timers.advance(3000);
      assert.equal(h.log.includes('playNextVideo'), false, kind);
    }
  });

  it('再生エラーの後の自動の再読み込みも、別の動画を開いたら取り消す', async function() {
    const h = erroredHarness();
    const d = h.dialog;
    await openFully(h, 'smA');
    d.reload = () => h.log.push('reload');
    d._videoInfo = {isDmcAvailable: true, isDomandAvailable: true};
    d._videoWatchOptions = {reloadCount: 0};
    await d._onVideoError({target: {error: {code: 3}}});
    d.open('smB', {openNow: true});
    await flush();
    h.timers.advance(3000);
    assert.equal(h.log.includes('reload'), false);
  });

  it('YouTube の再生エラーの後の再読み込みも、別の動画を開いたら取り消す', async function() {
    const h = erroredHarness();
    const d = h.dialog;
    await openFully(h, 'smA');
    d.reload = () => h.log.push('reload');
    d._onYouTubeVideoError({description: 'youtube failed', fallback: true});
    d.open('smB', {openNow: true});
    await flush();
    h.timers.advance(3000);
    assert.equal(h.log.includes('reload'), false);
  });

  it('正常: 何もしなければ、3秒後に1回だけ次へ進む', async function() {
    const h = erroredHarness();
    h.dialog.open('smA');
    await flush();
    h.loader.calls[0].reject({message: 'forbidden', reason: 'forbidden'});
    await flush();
    h.timers.advance(3000);
    h.timers.advance(3000);
    assert.equal(h.log.filter(x => x === 'playNextVideo').length, 1);
  });
});

describe('R04 ZW-017: キャッシュ・プレイリストの失敗が、動画を開くことを止めない', function() {
  it('キャッシュ（WatchInfoCacheDb.get）が失敗しても、動画は開く', async function() {
    const h = createDialogHarness();
    h.dialog.open('smA');
    await flush();
    h.loader.calls[0].resolve(h.videoData('smA'));
    h.cacheGet.calls[0].reject(new Error('IndexedDB blocked'));
    await flush();
    assert.equal(h.sessionCreate.calls.length, 1);
    assert.equal(h.state.isError, false);
  });

  it('キャッシュがいつまでも返らなくても、期限の後に動画を開く', async function() {
    const h = createDialogHarness();
    h.dialog.open('smA');
    await flush();
    h.loader.calls[0].resolve(h.videoData('smA'));
    await flush();
    assert.equal(h.sessionCreate.calls.length, 0, '期限までは待つ');
    h.timers.advance(5000);
    await flush();
    assert.equal(h.sessionCreate.calls.length, 1);
    assert.equal(h.state.isError, false);
  });

  it('プレイリストの初期化が例外になっても、いつまでも終わらなくても、動画は開く', async function() {
    for (const kind of ['throw', 'pending']) {
      const h = createDialogHarness();
      h.dialog._initializePlaylist = kind === 'throw' ?
        async () => { throw new Error('playlist broken'); } :
        () => new Promise(() => {});
      h.dialog.open('smA');
      await flush();
      h.loader.calls[0].resolve(h.videoData('smA'));
      h.cacheGet.calls[0].resolve(null);
      await flush();
      h.timers.advance(5000);
      await flush();
      assert.equal(h.sessionCreate.calls.length, 1, kind);
      assert.equal(h.state.isError, false, kind);
    }
  });

  it('プレイリストの初期化を諦めた時も playlist-ready にする（再生可能の処理が待ち続けない）', async function() {
    const h = createDialogHarness();
    h.dialog._initializePlaylist = async () => { throw new Error('playlist broken'); };
    h.dialog.open('smA');
    await flush();
    assert.ok(h.log.includes('emitResolve:playlist-ready'));
  });

  it('保存しておいたプレイリストが壊れていても、本物の _initializePlaylist は例外にならず ready になる', async function() {
    const h = createDialogHarness();
    h.context.__restoreFails = true;
    h.dialog._playlist = null;
    const init = h.Dialog.prototype._initializePlaylist;
    await init.call(h.dialog);
    assert.ok(h.dialog._playlist, 'プレイリストは作られている');
    assert.ok(h.log.includes('emitResolve:playlist-ready'));
  });

  it('プレイリストが無くても、再生可能の処理（_onVideoCanPlay）は例外にならず最後まで進む', async function() {
    const h = createDialogHarness();
    const d = h.dialog;
    Object.assign(d, {_playlist: undefined, _watchId: 'smA', _videoInfo: {watchId: 'smA', videoId: 'smA'},
      _videoWatchOptions: {isPlaylistStartRequest: false, eventType: ''}, promise: async () => {}, _nextVideo: 'smN'});
    d._playerConfig.props.enableNicosJumpVideo = true;
    h.state.isLoading = true;
    await d._onVideoCanPlay();
    assert.equal(h.state.isCanPlay, true);
  });

  it('正常: 動画情報そのもの（必須）の失敗は、今までどおりエラー', async function() {
    const h = createDialogHarness();
    h.dialog.open('smA');
    await flush();
    h.loader.calls[0].reject({message: 'not found'});
    h.cacheGet.calls[0].resolve(null);
    await flush();
    assert.equal(h.state.isError, true);
    assert.equal(h.sessionCreate.calls.length, 0);
  });
});

describe('R04 ZW-021: 再生開始の失敗を、名前・種類で分けて扱う', function() {
  function subject() {
    const h = createDialogHarness();
    h.dialog._watchId = 'smA';
    return {h, fail: e => h.dialog._onVideoPlayStartFail(e), fails: () => h.emitted.filter(e => e[0] === 'loadVideoPlayStartFail').length};
  }

  it('セッション切れ（SessionClosedError）: 例外にならず、エラーを表示する', function() {
    for (const make of [() => new DOMException('SessionClosedError'), () => new DOMException('closed', 'SessionClosedError'), () => ({kind: 'SessionClosedError', message: 'closed'})]) {
      const s = subject();
      s.fail(make());
      assert.equal(s.h.state.isError, true);
      assert.ok(s.h.state.errorMessage);
      assert.equal(s.fails(), 1);
    }
  });

  it('セッション切れでも、すでにエラーの時はエラー表示を重ねない', function() {
    const s = subject();
    s.h.state.isError = true;
    s.h.state.errorMessage = 'first';
    s.fail(new DOMException('SessionClosedError'));
    assert.equal(s.h.state.errorMessage, 'first');
  });

  it('NotAllowedError（自動再生の拒否）・AbortError（中断）: エラーにせず、失敗を知らせる', function() {
    for (const name of ['NotAllowedError', 'AbortError']) {
      const s = subject();
      s.fail(new DOMException('rejected', name));
      assert.equal(s.h.state.isError, false, name);
      assert.equal(s.fails(), 1, name);
    }
  });

  it('知らない失敗（DOMException でないもの）も、失敗を知らせる（黙って捨てない）', function() {
    const s = subject();
    s.fail(new TypeError('boom'));
    s.fail(undefined);
    assert.equal(s.fails(), 2);
    assert.equal(s.h.state.isError, false);
  });
});

describe('R04 ZW-025: 投稿の完了が、切り替えた後の動画の状態を変えない', function() {
  function posting() {
    const h = createDialogHarness();
    const d = h.dialog;
    Object.assign(d, {_watchId: 'smA', _requestId: 'rA', _threadInfo: {threadId: '1'}, _videoInfo: {msgInfo: {tag: 'A'}}, _nicoVideoPlayer: h.player});
    return {h, d};
  }
  const switchTo = (h, d, tag, rid, threadId) => {
    Object.assign(d, {_watchId: tag, _requestId: rid, _threadInfo: {threadId}, _videoInfo: {msgInfo: {tag}}});
    h.state.isCommentPosting = false;  // 開いた時の初期化（下のテストで open が行うことを確かめる）
  };

  it('COMMENT-02: A へ投稿 → B へ切り替え → A の成功: 履歴は A に書き、B の blockNo・投稿中の表示は変えない', async function() {
    const {h, d} = posting();
    const threadA = d._threadInfo;
    const pA = d.addChat('hello', '', 0);
    switchTo(h, d, 'smB', 'rB', '2');
    const pB = d.addChat('world', '', 0);
    assert.equal(h.state.isCommentPosting, true, 'B が投稿中');
    h.dialog.threadLoader.postChat.calls[0].resolve({no: 1, blockNo: 999});
    await pA;
    assert.equal(h.cachePuts[0].id, 'smA', '投稿の履歴は元の動画へ');
    assert.equal(threadA.blockNo, 999, '記録は元の動画のスレッドへ');
    assert.equal(d._threadInfo.blockNo, undefined, 'B のスレッドは変えない');
    assert.equal(h.state.isCommentPosting, true, 'B の投稿中の表示を A の完了で消さない');
    h.dialog.threadLoader.postChat.calls[1].resolve({no: 2, blockNo: 3});
    await pB;
    assert.equal(h.state.isCommentPosting, false);
    assert.equal(d._threadInfo.blockNo, 3);
  });

  it('A へ投稿 → B へ切り替え → A の失敗: B の blockNo・表示を変えず、B に警告を出さない', async function() {
    const {h, d} = posting();
    const pA = d.addChat('hello', '', 0).catch(e => e);
    switchTo(h, d, 'smB', 'rB', '2');
    h.dialog.threadLoader.postChat.calls[0].reject({message: 'failed', blockNo: 5});
    await pA;
    assert.equal(d._threadInfo.blockNo, undefined);
    assert.equal(h.log.includes('execCommand:alert'), false);
    assert.equal(h.player.chats[0].isPostFail, true, '失敗は元のコメントに記録する');
  });

  it('同じ動画のまま、コメントの読み直しでスレッドの情報が新しくなった時は、新しい方の blockNo を更新する', async function() {
    const {h, d} = posting();
    const p = d.addChat('hello', '', 0);
    d._threadInfo = {threadId: '1'};  // reloadComment → _onCommentLoadSuccess で置き換わる（requestId は同じ）
    h.dialog.threadLoader.postChat.calls[0].resolve({no: 1, blockNo: 8});
    await p;
    assert.equal(d._threadInfo.blockNo, 8);
  });

  it('動画を開く（open）と、前の動画の「投稿中」は外れる（新しい動画で投稿できる）', async function() {
    const h = createDialogHarness();
    await openFully(h, 'smA');
    h.state.isCommentPosting = true;
    h.dialog.open('smB', {openNow: true});
    await flush();
    assert.equal(h.state.isCommentPosting, false);
  });

  it('正常: 切り替えなければ、今までどおり履歴・blockNo・投稿中の表示・通知を更新する', async function() {
    const {h, d} = posting();
    const p = d.addChat('hello', '', 0);
    h.dialog.threadLoader.postChat.calls[0].resolve({no: 1, blockNo: 7});
    await p;
    assert.equal(h.cachePuts[0].id, 'smA');
    assert.equal(d._threadInfo.blockNo, 7);
    assert.equal(h.state.isCommentPosting, false);
    assert.ok(h.log.includes('execCommand:notify'));
  });
});

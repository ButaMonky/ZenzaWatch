// Task 093: Playlist Core（VideoListItem・VideoListModel・PlayListModel・PlayList）を、
// 描画（VideoListView・PlayListView）や通信を読み込まずに動かすための道具。
// extractSource と同じく、//===BEGIN===〜//===END=== の部分だけを vm のコンテキストで実行する。
// requestAnimationFrame は setTimeout(0) で代わりにする（throttle.raf の通知も最後まで動く）。
// 実ブラウザ・実際のプレイリストの画面での確認ではない。
'use strict';
const _ = require('lodash');
const {beginSection, createContext, run} = require('./extractSource');

const flush = async (n = 3) => {
  for (let i = 0; i < n; i++) {
    await new Promise(r => setTimeout(r, 0));
    await Promise.resolve();
  }
};

function createPlaylistContext() {
  const commands = [];
  const c = createContext({
    _,
    performance: {now: () => Date.now()},
    requestAnimationFrame: f => setTimeout(() => f(Date.now()), 0),
    cancelAnimationFrame: id => clearTimeout(id),
    Blob: class {},
    document: {},
    global: {debug: {}, emitter: {on() {}}, api: {}},
    prompt: () => null
  });
  // PlayList の import は window.setTimeout(…, 2000) で開く。テストでは待たずに次のタスクで動かす
  c.window = c;
  c.setTimeout = (f, ms) => setTimeout(f, 0);
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(`${beginSection('packages/lib/src/infra/bounce.js')}; globalThis.bounce = bounce; globalThis.throttle = throttle;`, c);
  run(`${beginSection('packages/lib/src/text/textUtil.js')}; globalThis.textUtil = textUtil;`, c);
  run(`${beginSection('packages/zenza/src/Playlist/VideoListItem.js')}; globalThis.VideoListItem = VideoListItem;`, c);
  run(`${beginSection('packages/zenza/src/Playlist/VideoListModel.js')}; globalThis.VideoListModel = VideoListModel;`, c);
  run(`${beginSection('packages/zenza/src/Playlist/PlayListModel.js')}; globalThis.PlayListModel = PlayListModel;`, c);
  // PlayList の基底クラス（描画・広告装飾）は代わりのものにする
  run(`class VideoList extends Emitter { constructor() { super(); } _initializeAdDecoration() {} };
    const PlayListSession = {save() {}, restore() { return null; }};
    globalThis.VideoList = VideoList; globalThis.PlayListSession = PlayListSession;`, c);
  run(`${beginSection('packages/zenza/src/Playlist/PlayList.js')}; globalThis.PlayList = PlayList;`, c);

  const {VideoListItem, VideoListModel, PlayListModel, PlayList} = c;
  let seq = 0;
  // 動画1件分の元データ（serialize と同じ形）
  const raw = (id, extra = {}) => Object.assign({
    id, title: `title ${id}`, length_seconds: 60, num_res: 1, mylist_counter: 2, view_counter: 3,
    thumbnail_url: `https://example.invalid/${id}.jpg`, first_retrieve: '2020/01/01 00:00:00'
  }, extra);
  const item = (id, extra) => new VideoListItem(raw(id, extra));

  const createPlaylist = ({maxItems} = {}) => {
    const p = new PlayList();
    p.initialize({loop: false, container: null, loader: {}});   // 本物の initialize（model の作成と監視）
    if (maxItems) { p.model.maxItems = maxItems; }
    p.view = {scrollToItem() {}, scrollTop() {}, hasFocus: false};
    p.on('command', (...a) => commands.push(a));
    return p;
  };
  const videoInfo = (watchId, extra = {}) => Object.assign({
    watchId, contextWatchId: watchId, title: `full ${watchId}`, duration: 321,
    count: {comment: 10, mylist: 20, view: 30},
    thumbnail: `https://example.invalid/full/${watchId}.jpg`,
    postedAt: '2021/02/03 04:05:06',
    owner: {id: '1', name: 'owner', type: 'user'}
  }, extra);
  return {c, VideoListItem, VideoListModel, PlayListModel, PlayList, raw, item, createPlaylist, videoInfo, commands, flush, seq};
}

module.exports = {createPlaylistContext, flush};

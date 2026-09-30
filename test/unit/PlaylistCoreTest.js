// Task 093: Playlist Core（VideoListItem・VideoListModel・PlayList）の整合性の回帰テスト。
// identity（watchId・uniqId・itemId）、重複の規則、maxItems、外した item の切り離し（ghost update）、
// 情報不明（blank）の item の同じ object のままの完全化、保存と復元、reverse 後の位置、ファイルからの復元の位置、追加件数。
// 監査v2 R11 の ZW-069（一括追加の中の重複）・ZW-070（setItem が maxItems を超える）を含む。
// 描画（VideoListView）・通信は使わない代わりのもので確かめていて、実ブラウザのプレイリストでの確認ではない。
import assert from 'power-assert';

const {createPlaylistContext, flush} = require('../helpers/playlistHarness');

const ids = model => model.items.map(i => i.watchId);
// isUniq の不変条件: uniqId・watchId・itemId がそれぞれ重複しない、Map が items と一致する
const assertInvariant = (model, label = '') => {
  const uniq = model.items.map(i => i.uniqId), watch = ids(model), item = model.items.map(i => i.itemId);
  assert.equal(new Set(uniq).size, uniq.length, `${label} uniqId が重複: ${uniq}`);
  assert.equal(new Set(watch).size, watch.length, `${label} watchId が重複: ${watch}`);
  assert.equal(new Set(item).size, item.length, `${label} itemId が重複`);
  assert.ok(model.items.length <= model.maxItems, `${label} maxItems を超えた: ${model.items.length} > ${model.maxItems}`);
  for (const i of model.items) {
    assert.equal(model.findByWatchId(i.watchId), i, `${label} findByWatchId(${i.watchId})`);
    assert.equal(model.findByItemId(i.itemId), i, `${label} findByItemId(${i.itemId})`);
    assert.equal(i.groupList, model, `${label} ${i.watchId} の groupList`);
  }
};

describe('Playlist Core: identity（Task 093）', function() {
  this.timeout(20000);

  it('A: rawData.uniq_id を読み、serialize → JSON → 復元しても uniqId が同じ', function() {
    const {VideoListItem} = createPlaylistContext();
    const a = new VideoListItem({id: 'so5', uniq_id: '1340979099', title: 't'});
    assert.equal(a.watchId, 'so5');
    assert.equal(a.uniqId, '1340979099');
    const saved = JSON.parse(JSON.stringify(a.serialize()));
    assert.equal(saved.uniq_id, '1340979099');
    const b = new VideoListItem(saved);
    assert.equal(b.uniqId, '1340979099');
    assert.equal(b.watchId, 'so5');
    assert.notEqual(b.itemId, a.itemId, 'itemId は実行中の object ごとに別');
  });

  it('A2: rawData.uniqId（新しい書き方）も読める。どちらも無ければ watchId', function() {
    const {VideoListItem} = createPlaylistContext();
    assert.equal(new VideoListItem({id: 'sm1', uniqId: 'ctx1'}).uniqId, 'ctx1');
    assert.equal(new VideoListItem({id: 'sm2'}).uniqId, 'sm2');
    assert.equal(new VideoListItem({id: 123}).watchId, '123');
  });

  it('P: 以前の保存形式（uniq_id・played・last_activated）の session を読める', function() {
    const {PlayListModel} = createPlaylistContext();
    const m = new PlayListModel({});
    m.unserialize([
      {id: 'so9', uniq_id: '1340979099', title: 'old', played: true, last_activated: 5, length_seconds: 10},
      {id: 'sm1', title: 'old2'}
    ]);
    assert.deepEqual(ids(m), ['so9', 'sm1']);
    assert.equal(m.items[0].uniqId, '1340979099');
    assert.equal(m.items[0].isPlayed, true);
    assert.equal(m.items[0].serialize().last_activated, 5);
    assert.equal(m.items[1].uniqId, 'sm1');
    assertInvariant(m);
  });

  it('B: watchId を変えると、すぐに新しい ID で見つかり、古い ID では見つからない', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('123');
    m.setItem([a, item('sm2')]);
    a.watchId = 'so999';
    assert.equal(m.findByWatchId('so999'), a);
    assert.equal(m.findByWatchId('123'), undefined);
    assert.equal(a.uniqId, '123', 'uniqId は変えない（最初の identity）');
    assertInvariant(m);
  });

  it('L: watchId を変えた後に serialize → 復元しても、古い ID に戻らない', function() {
    const {VideoListItem, item} = createPlaylistContext();
    const a = item('123');
    a.watchId = 'so999';
    const saved = JSON.parse(JSON.stringify(a.serialize()));
    assert.equal(saved.id, 'so999');
    const b = new VideoListItem(saved);
    assert.equal(b.watchId, 'so999');
    assert.equal(b.uniqId, '123');
  });
});

describe('Playlist Core: watchId の変更で重複する時（Task 093）', function() {
  this.timeout(20000);

  it('C1: どちらも普通の item なら、もともとその ID だった item を残し、変えた方を外す（再生済みは引き継ぐ）', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('123', {played: true}), b = item('so999'), c = item('sm3');
    m.setItem([a, b, c]);
    a.watchId = 'so999';
    assert.deepEqual(ids(m), ['so999', 'sm3']);
    assert.equal(m.items[0], b);
    assert.equal(a.groupList, null);
    assert.equal(b.isPlayed, true, '外した方の再生済みを残した方へ引き継ぐ');
    assertInvariant(m);
  });

  it('C2: 変えた方が再生中（active）なら、そちらを残す', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('123'), b = item('so999');
    m.setItem([a, b]);
    a.isActive = true;
    a.watchId = 'so999';
    assert.deepEqual(m.items, [a]);
    assert.equal(b.groupList, null);
    assert.equal(a.isActive, true);
    assertInvariant(m);
  });

  it('C3: 相手が情報不明（blank）なら、完全な方を残す', function() {
    const {PlayListModel, VideoListItem, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const blank = VideoListItem.createBlankInfo('so999');
    const a = item('123');
    m.setItem([blank, a]);
    a.watchId = 'so999';
    assert.deepEqual(m.items, [a]);
    assert.equal(blank.groupList, null);
    assertInvariant(m);
  });

  it('C4: PlayList の中で重複を外した時も、再生位置（index）が再生中の item を指す', async function() {
    const {createPlaylist, item} = createPlaylistContext();
    const p = createPlaylist();
    const a = item('123'), b = item('sm2'), c = item('so999'), d = item('sm4');
    p.model.setItem([a, b, c, d]);
    p.setIndex(3);
    assert.equal(p._activeItem, d);
    a.watchId = 'so999';
    await flush();
    assert.deepEqual(ids(p.model), ['sm2', 'so999', 'sm4']);
    assert.equal(p._index, p.model.indexOf(d));
    assert.equal(p.selectPrevious(), 'so999');
  });
});

describe('Playlist Core: 重複の規則（setItem・appendItem・insertItem、ZW-069）', function() {
  this.timeout(20000);

  it('D: setItem で同じ watchId・同じ uniqId を複数残さない（最初に現れた位置）', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('123'); a.watchId = 'sm1';          // uniqId は 123、watchId は sm1
    const b = item('sm1');                              // watchId が a と同じ
    const c = item('so7', {uniq_id: '123'});            // uniqId が a と同じ
    const d = item('sm4');
    m.setItem([a, b, c, d, d]);
    assert.deepEqual(ids(m), ['sm1', 'sm4']);
    assert.equal(m.items[0], a);
    assertInvariant(m);
  });

  it('D2: setItem の重複で後ろの方が再生中なら、再生中の方を最初の位置に残す', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('sm1'), x = item('sm2'), b = item('sm1');
    b.isActive = true;
    m.setItem([a, x, b]);
    assert.deepEqual(m.items, [b, x]);
    assertInvariant(m);
  });

  it('E: appendItem の同じ一括の中の [sm1, sm1] は1件だけ入る', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    m.setItem([item('sm0')]);
    m.appendItem([item('sm1'), item('sm1'), item('sm2'), item('sm0')]);
    assert.deepEqual(ids(m), ['sm0', 'sm1', 'sm2']);
    assertInvariant(m);
  });

  it('F: insertItem の同じ一括の中の [sm1, sm1] は1件だけ入る（位置は保つ）', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    m.setItem([item('sm0'), item('sm9')]);
    const idx = m.insertItem([item('sm1'), item('sm1'), item('sm2')], 1);
    assert.deepEqual(ids(m), ['sm0', 'sm1', 'sm2', 'sm9']);
    assert.equal(idx, 1);
    assertInvariant(m);
  });

  it('既にある item と重なる新しい item は入れない（既にある方を残す）', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('sm1', {played: true});
    m.setItem([a]);
    m.appendItem([item('sm1')]);
    m.insertItem([item('sm1')], 0);
    assert.deepEqual(m.items, [a]);
    assertInvariant(m);
  });

  it('既にある情報不明（blank）の item に、完全な情報の item を追加すると、同じ object のまま完全化される', function() {
    const {PlayListModel, VideoListItem, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const blank = VideoListItem.createBlankInfo('sm5');
    m.setItem([item('sm1'), blank]);
    m.appendItem([item('sm5', {title: 'real title'})]);
    assert.equal(m.items[1], blank);
    assert.equal(blank.isBlankData, false);
    assert.equal(blank.title, 'real title');
    assertInvariant(m);
  });
});

describe('Playlist Core: maxItems（ZW-070）と切り離し', function() {
  this.timeout(20000);

  it('G: setItem・unserialize・appendItem・insertItem の後は、いつも maxItems 以下', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    m.maxItems = 3;
    m.setItem(['a1', 'a2', 'a3', 'a4', 'a5'].map(i => item(i)));
    assert.deepEqual(ids(m), ['a1', 'a2', 'a3'], 'setItem は渡された順の先頭を残す');
    assertInvariant(m, 'set');
    m.appendItem(['b1', 'b2'].map(i => item(i)));
    assert.deepEqual(ids(m), ['a3', 'b1', 'b2'], 'append は古い先頭を落として新しい末尾を残す');
    assertInvariant(m, 'append');
    m.insertItem(['c1'].map(i => item(i)), 1);
    assert.deepEqual(ids(m), ['a3', 'c1', 'b1'], 'insert は入れた位置を保ち、末尾を落とす');
    assertInvariant(m, 'insert');
    m.unserialize(['d1', 'd2', 'd3', 'd4'].map(i => ({id: i})));
    assert.deepEqual(ids(m), ['d1', 'd2', 'd3']);
    assertInvariant(m, 'unserialize');
  });

  it('G2: 上限で落とす時、再生中（active）の item は落とさない', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    m.maxItems = 3;
    const a = item('a1');
    m.setItem([a, item('a2'), item('a3')]);
    a.isActive = true;
    m.appendItem([item('b1')]);
    assert.deepEqual(ids(m), ['a1', 'a3', 'b1']);
    assertInvariant(m);
  });

  it('H: setItem で入れ替えた item・clear で消した item は groupList が null', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('sm1'), b = item('sm2');
    m.setItem([a]);
    m.setItem([b]);
    assert.equal(a.groupList, null);
    assert.equal(b.groupList, m);
    m.clear();
    assert.equal(b.groupList, null);
    assert.equal(m.length, 0);
  });

  it('I: maxItems を超えて落とした item は groupList が null', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    m.maxItems = 2;
    const a = item('sm1'), b = item('sm2'), c = item('sm3');
    m.appendItem([a, b]);
    m.appendItem([c]);
    assert.equal(a.groupList, null);
    const d = item('sm4');
    m.insertItem([d], 2);
    assert.equal(d.groupList, null, '入れた位置が上限の外なら、入らずに切り離したまま');
    assertInvariant(m);
  });

  it('J: プレイリストから外れた item の状態を変えても、前の model の更新が起きない（ghost update）', async function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('sm1'), b = item('sm2');
    m.setItem([a, b]);
    await flush();
    let updates = 0;
    m.onItemUpdate = () => { updates++; };
    m.setItem([b]);
    a.isPlayed = true;
    a.isActive = true;
    await flush();
    assert.equal(updates, 0);
    b.isPlayed = true;
    await flush();
    assert.equal(updates, 1, 'プレイリストにある item の更新は届く');
  });

  it('removeItem・removePlayedItem で外した item も groupList が null', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const a = item('sm1'), b = item('sm2', {played: true}), c = item('sm3');
    m.setItem([a, b, c]);
    m.removeItem(a);
    m.removePlayedItem();
    assert.deepEqual(m.items, [c]);
    assert.equal(a.groupList, null);
    assert.equal(b.groupList, null);
    assertInvariant(m);
  });

  it('moveItemTo（ドラッグの並べ替え）は今までどおり', function() {
    const {PlayListModel, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const [a, b, c, d] = ['sm1', 'sm2', 'sm3', 'sm4'].map(i => item(i));
    m.setItem([a, b, c, d]);
    m.moveItemTo(a, c);
    assert.deepEqual(ids(m), ['sm2', 'sm3', 'sm1', 'sm4']);
    m.moveItemTo(d, b);
    assert.deepEqual(ids(m), ['sm4', 'sm2', 'sm3', 'sm1']);
    assertInvariant(m);
  });
});

describe('Playlist Core: 情報不明（blank）の item の完全化（Task 093）', function() {
  this.timeout(20000);

  it('K: 再生中の blank は、同じ object・同じ位置・再生中・再生済みのまま完全な情報になる', async function() {
    const {createPlaylist, VideoListItem, item, videoInfo} = createPlaylistContext();
    const p = createPlaylist();
    const blank = VideoListItem.createBlankInfo('sm5');
    p.model.setItem([item('sm1'), blank, item('sm9')]);
    p.setIndex(1);
    blank.isPlayed = true;
    const itemId = blank.itemId;
    p.insertCurrentVideo(videoInfo('sm5'));
    await flush();
    assert.equal(p.model.length, 3);
    assert.equal(p.model.items[1], blank);
    assert.equal(blank.itemId, itemId);
    assert.equal(blank.isActive, true);
    assert.equal(blank.isPlayed, true);
    assert.equal(blank.isBlankData, false);
    assert.equal(blank.title, 'full sm5');
    assert.equal(blank.duration, 321);
    assert.deepEqual(blank.count, {comment: 10, mylist: 20, view: 30});
    assert.equal(blank.thumbnail, 'https://example.invalid/full/sm5.jpg');
    assert.equal(blank.postedAt, '2021/02/03 04:05:06');
    assert.equal(blank.serialize().title, 'full sm5');
    assert.equal(p._activeItem, blank);
    assert.equal(p._index, 1);
    assertInvariant(p.model);
  });

  it('K2: 再生中でない blank も同じ object のまま完全化して、そこを再生位置にする', async function() {
    const {createPlaylist, VideoListItem, item, videoInfo} = createPlaylistContext();
    const p = createPlaylist();
    const blank = VideoListItem.createBlankInfo('sm5');
    p.model.setItem([item('sm1'), blank, item('sm9')]);
    p.setIndex(0);
    p.insertCurrentVideo(videoInfo('sm5'));
    assert.equal(p.model.length, 3);
    assert.equal(p.model.items[1], blank);
    assert.equal(blank.isBlankData, false);
    assert.equal(p._activeItem, blank);
    assert.equal(p._index, 1);
    assert.equal(blank.isPlayed, true);
  });

  it('K3: チャンネル動画（数字の ID で開いて so〜 になる）の blank も完全化し、so〜 で見つかる', function() {
    const {createPlaylist, VideoListItem, item, videoInfo} = createPlaylistContext();
    const p = createPlaylist();
    const blank = VideoListItem.createBlankInfo('1340979099');
    p.model.setItem([item('sm1'), blank]);
    p.setIndex(1);
    p.insertCurrentVideo(videoInfo('so77', {contextWatchId: '1340979099'}));
    assert.equal(p.model.length, 2);
    assert.equal(p.model.items[1], blank);
    assert.equal(blank.watchId, 'so77');
    assert.equal(p.model.findByWatchId('so77'), blank);
    assert.equal(p.model.findByWatchId('1340979099'), undefined);
    assert.equal(blank.isBlankData, false);
    assertInvariant(p.model);
  });

  it('普通の item の更新（updateByVideoInfo）は今までどおり件数・サムネイル・投稿日だけ', function() {
    const {item, videoInfo} = createPlaylistContext();
    const a = item('sm1');
    a.updateByVideoInfo(videoInfo('sm1'));
    assert.equal(a.title, 'title sm1');
    assert.deepEqual(a.count, {comment: 10, mylist: 20, view: 30});
    assert.equal(a.thumbnail, 'https://example.invalid/full/sm1.jpg');
  });

  it('プレイリストに無い動画は、今までどおり今の位置の次に入れて再生中にする', function() {
    const {createPlaylist, item, videoInfo} = createPlaylistContext();
    const p = createPlaylist();
    p.model.setItem([item('sm1'), item('sm2')]);
    p.setIndex(0);
    p.insertCurrentVideo(videoInfo('sm7'));
    assert.deepEqual(ids(p.model), ['sm1', 'sm7', 'sm2']);
    assert.equal(p._activeItem.watchId, 'sm7');
    assert.equal(p._index, 1);
  });
});

describe('Playlist Core: reverse・ファイルからの復元・追加件数（Task 093）', function() {
  this.timeout(20000);

  it('M: reverse の後、再生位置が再生中の item の新しい位置になり、次へ・前へが正しい', function() {
    const {createPlaylist, item} = createPlaylistContext();
    const p = createPlaylist();
    const [a, b, c, d] = ['sm1', 'sm2', 'sm3', 'sm4'].map(i => item(i));
    p.model.setItem([a, b, c, d]);
    p.setIndex(1);
    let updates = 0;
    p.on('update', () => updates++);
    p._onCommand('reverse');
    assert.deepEqual(ids(p.model), ['sm4', 'sm3', 'sm2', 'sm1']);
    assert.equal(p._index, 2);
    assert.equal(p._index, p.model.indexOf(b));
    assert.ok(updates >= 1, '保存のための update を出す');
    assert.equal(p.selectNext(), 'sm1');
    assert.equal(p.selectPrevious(), 'sm2');
    assert.equal(p.selectPrevious(), 'sm3');
  });

  const exported = (p, index) => JSON.stringify(Object.assign(p.serialize(), {index}));

  it('N: ファイルから復元すると、保存した index の動画を開く', async function() {
    const {createPlaylist, item, commands} = createPlaylistContext();
    const src = createPlaylist();
    src.model.setItem(['sm1', 'sm2', 'sm3'].map(i => item(i)));
    src.setIndex(2);
    const json = JSON.stringify(src.serialize());
    const p = createPlaylist();
    p._onImportFileCommand(json);
    await flush(5);
    assert.equal(p._index, 2);
    assert.equal(p._activeItem.watchId, 'sm3');
    const open = commands.filter(c => c[0] === 'openNow').pop();
    assert.deepEqual(open, ['openNow', 'sm3']);
  });

  for (const [index, expected] of [[undefined, 0], [-1, 0], ['x', 0], [99, 2], [1.7, 1]]) {
    it(`N2: 保存した index が ${JSON.stringify(index)} なら ${expected} 番目を開く`, async function() {
      const {createPlaylist, item, commands} = createPlaylistContext();
      const src = createPlaylist();
      src.model.setItem(['sm1', 'sm2', 'sm3'].map(i => item(i)));
      const p = createPlaylist();
      p._onImportFileCommand(exported(src, index));
      await flush(5);
      assert.equal(p._index, expected);
      assert.deepEqual(commands.filter(c => c[0] === 'openNow').pop(), ['openNow', `sm${expected + 1}`]);
    });
  }

  it('N3: 中身がプレイリストでない JSON は何もしない', async function() {
    const {createPlaylist, item, commands} = createPlaylistContext();
    const p = createPlaylist();
    p.model.setItem([item('sm1')]);
    p._onImportFileCommand('{"foo": 1}');
    p._onImportFileCommand('[1, 2]');
    await flush(5);
    assert.deepEqual(ids(p.model), ['sm1']);
    assert.equal(commands.filter(c => c[0] === 'openNow').length, 0);
  });

  it('O: 上限いっぱいでも、新しく入った件数を返す（長さが同じでも 2件）', function() {
    const {createPlaylist, item} = createPlaylistContext();
    const p = createPlaylist({maxItems: 5});
    p.model.setItem(['a1', 'a2', 'a3', 'a4', 'a5'].map(i => item(i)));
    assert.equal(p._appendAll([item('b1'), item('b2')]), 2);
    assert.deepEqual(ids(p.model), ['a3', 'a4', 'a5', 'b1', 'b2']);
    p.setIndex(0);
    assert.equal(p._insertAll([item('c1'), item('c2')]), 2);
    assert.deepEqual(ids(p.model), ['a3', 'c1', 'c2', 'a4', 'a5']);
    assert.equal(p._appendAll([item('a3'), item('c1')]), 0, '全部登録済みなら 0');
    assert.equal(p._appendAll([item('d1'), item('d1')]), 1, '同じ一括の中の重複は1件');
  });
});

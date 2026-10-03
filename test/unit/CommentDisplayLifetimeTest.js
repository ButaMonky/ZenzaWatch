import assert from 'power-assert';
// Task 206: 表示中のコメントが新着だけを理由に途中で消えないこと、期限切れの回収、管理表の整合、
// 表示開始前だけの上限判定（通常 > 履歴、通常 > かんたん > AI、owner/自分は対象外）を、
// 実ソースのNicoCommentCss3PlayerView/CommentDisplayBudgetを合成DOMで動かして確かめる。
const {createContext, loadClass} = require('../helpers/extractSource');

class FakeElement {
  constructor(classes = '', fragment = false) {
    this.classes = new Set(classes.split(' ').filter(Boolean));
    this.children = []; this.parentNode = null; this.fragment = fragment; this.style = {};
    this.classList = {remove: s => this.classes.delete(s), add: s => this.classes.add(s)};
  }
  append(...nodes) {
    for (const n of nodes) {
      if (n.fragment) { for (const c of [...n.children]) { this.append(c); } continue; }
      n.remove(); this.children.push(n); n.parentNode = this;
    }
  }
  remove() {
    if (!this.parentNode) { return; }
    const p = this.parentNode; p.children = p.children.filter(n => n !== this); this.parentNode = null;
    if (!p.fragment) { this.removedCount = (this.removedCount || 0) + 1; } // 画面からの削除だけ数える
  }
  querySelectorAll(selector) {
    const required = selector.split('.').filter(Boolean), out = [];
    for (const n of this.children) {
      if (required.every(c => n.classes.has(c))) { out.push(n); }
      out.push(...n.querySelectorAll(selector));
    }
    return out;
  }
  get firstElementChild() { return this.children[0] || null; }
  set textContent(v) { assert.equal(v, ''); for (const n of [...this.children]) { n.remove(); } }
}

const BUDGET = 'packages/zenza/src/commentLayer/CommentDisplayBudget.js';
const VIEW = 'packages/zenza/src/commentLayer/NicoCommentCss3PlayerView.js';

function setup({limit = 200, history = new Set()} = {}) {
  const props = {maxDisplayComment: limit};
  let comments = [];
  const NicoChat = {
    TYPE: {NAKA: 'naka', TOP: 'ue', BOTTOM: 'shita'},
    SORT_FUNCTION: (a, b) => a.beginLeftTiming - b.beginLeftTiming || a.id - b.id
  };
  const document = {hidden: false, visibilityState: 'visible', addEventListener() {}};
  const c = createContext({
    document, Emitter: class {}, NicoChat, NicoChatViewModel: {SPEED_RATE: 1},
    NicoChatCss3View: {
      buildChatCss() { return ''; },
      buildChatDom(chat) { const e = new FakeElement('nicoChat hidden fork' + chat.fork); e.chatId = chat.id; return e; }
    },
    Config: {namespace: () => ({props, onkey() {}}), props: {}},
    throttle: {raf: f => f}, global: {debug: {}}, console: {log() {}, warn() {}}
  });
  const Budget = loadClass(BUDGET, 'CommentDisplayBudget', c);
  c.CommentDisplayBudget = Budget;
  const View = loadClass(VIEW, 'NicoCommentCss3PlayerView', c);
  View.prototype._initializeView = function() {};
  const viewModel = {
    on() {},
    getGroup(type) {
      return {get inViewMembers() {
        const t = player._currentTime;
        return comments.filter(x => x.type === type && x.beginLeftTiming <= t + 1 && x.endRightTiming >= t);
      }};
    }
  };
  const player = new View({viewModel});
  Object.assign(player, {
    commentLayer: new FakeElement(), subLayer: new FakeElement('subLayer'),
    fragment: new FakeElement('', true), subFragment: new FakeElement('', true),
    removingElements: [], _style: {textContent: ''}, window: {Array}, document: {}, _isShow: true
  });
  player.commentLayer.append(player.subLayer);
  if (player.setHistoryClassifier) { player.setHistoryClassifier(chat => history.has(chat)); }
  const at = t => { player._currentTime = t; player._updateInviewElements(); };
  const screen = () => player.commentLayer.querySelectorAll('.nicoChat');
  const ids = () => screen().map(e => e.chatId).sort((a, b) => a - b);
  const add = list => { comments.push(...list); return list; };
  return {player, props, Budget, at, screen, ids, add, history, get comments() { return comments; }};
}
let seq = 0;
const make = (begin = 40, end = 44, fork = 0, extra = {}) =>
  Object.assign({id: ++seq, beginLeftTiming: begin, endRightTiming: end, fork, type: 'naka', size: 'medium', isSubThread: fork === 2}, extra);
const many = (n, ...args) => Array.from({length: n}, () => make(...args));

function assertConsistent(h) {
  const p = h.player;
  const domKeys = [...p._domTable.keys()];
  assert.deepEqual(domKeys.slice().sort((a, b) => a.id - b.id), [...p._inSlotTable].sort((a, b) => a.id - b.id),
    'DOM表と表示中表が一致');
  for (const chat of p._inSlotTable) { assert(p._inViewTable.has(chat), '表示中は処理済み表にも入る'); }
  for (const chat of p._suppressedTable) {
    assert(p._inViewTable.has(chat)); assert(!p._inSlotTable.has(chat), '見送りと表示中は排他');
  }
  assert.equal(p._inViewTable.size, p._inSlotTable.size + p._suppressedTable.size, '処理済み = 表示中 + 見送り');
  assert.equal(h.screen().length, p._domTable.size, '実DOM数 = DOM表');
  for (const [chat, el] of p._domTable) { assert.equal(el.chatId, chat.id); assert(el.parentNode, '表のDOMは画面上にある'); }
}

describe('Task206 コメント表示の寿命（上限200）', () => {
  it('D02: 60件表示中に0.25秒後20件が来ても、最初の60件は寿命まで同じDOMのまま残る', () => {
    const h = setup();
    const first = h.add(many(60, 40, 44));
    h.at(40);
    const els = new Map(first.map(c => [c.id, h.player._domTable.get(c)]));
    assert.equal(h.screen().length, 60);
    h.add(many(20, 40.25, 44.25));
    for (let t = 40.25; t < 44 + 2; t += 0.25) {
      h.at(t);
      for (const c of first) {
        assert.equal(h.player._domTable.get(c), els.get(c.id), `id${c.id}が${t}秒で消えた/作り直された`);
        assert.equal(els.get(c.id).removedCount || 0, 0);
      }
      assertConsistent(h);
    }
    assert.equal(h.screen().length, 80);
  });
  it('D01: 40/41/60/100/200件の同時有効コメントはすべて表示を開始し途中で消えない', () => {
    for (const n of [40, 41, 60, 100, 200]) {
      const h = setup(); const list = h.add(many(n, 10, 14));
      h.at(10); assert.equal(h.screen().length, n);
      h.at(13.9); assert.equal(h.screen().length, n);
      assertConsistent(h);
    }
  });
  it('D03: 新着0件でも、期限切れのDOMと管理表を回収する', () => {
    const h = setup(); h.add(many(60, 40, 44)); h.at(40);
    for (let t = 40.1; t <= 48; t += 0.1) { h.at(t); }
    assert.equal(h.screen().length, 0);
    assert.equal(h.player._domTable.size, 0);
    assert.equal(h.player._inSlotTable.size, 0);
    assert.equal(h.player._inViewTable.size, 0);
    assert.equal(h.player.removingElements.length, 0);
  });
  it('D04: 期限切れの通常40件の後に来たかんたん1件は追い出されず表示される', () => {
    const h = setup({limit: 40}); h.add(many(40, 40, 44)); h.at(40);
    const easy = h.add([make(48, 52, 2)])[0];
    h.at(48);
    assert.deepEqual(h.ids(), [easy.id]);
    h.at(48.1); assert.deepEqual(h.ids(), [easy.id]);
    assertConsistent(h);
  });
});

describe('Task206 表示開始前だけの上限判定', () => {
  it('上限40: 超過分は表示前に見送り、表示中の40件は後続の新着で消えない', () => {
    const h = setup({limit: 40});
    const first = h.add(many(60, 40, 44)); h.at(40);
    const shown = h.ids();
    assert.equal(shown.length, 40);
    assert.equal(h.player._suppressedTable.size, 20);
    h.add(many(20, 40.25, 44.25));
    for (let t = 40.25; t < 44; t += 0.25) { h.at(t); assert.deepEqual(h.ids(), shown); assertConsistent(h); }
    assert.equal(h.player._suppressedTable.size, 40, '見送りは一度だけ判定し、毎フレーム出し直さない');
    const stats = h.player.displayStats;
    assert.equal(stats.limit, 40);
    assert.equal(stats.suppressed.limit, 40);
    assert.equal(first.length, 60);
  });
  it('D05: 1秒先の先読み候補は、今表示中のコメントを奪わない', () => {
    const h = setup({limit: 40});
    const current = h.add(many(30, 39.5, 43.5));
    const future = h.add(many(30, 40.8, 44.8));
    h.at(40);
    for (const c of current) { assert(h.player._domTable.has(c), '現在の候補が先に受け入れられる'); }
    assert.equal(h.screen().length, 40);
    h.at(41); h.at(42);
    for (const c of current) { assert(h.player._domTable.has(c)); }
    assert.equal(future.filter(c => h.player._domTable.has(c)).length, 10);
    assertConsistent(h);
  });
  it('D06: owner(fork1)と自分の投稿は上限の対象外で必ず表示され、数にも入らない', () => {
    const h = setup({limit: 40}); h.add(many(40, 40, 44)); h.at(40);
    const owner = h.add([make(40.1, 44.1, 1)])[0];
    const mine = h.add([make(40.1, 44.1, 0, {isMine: true})])[0];
    const posting = h.add([make(40.1, 44.1, 0, {isUpdating: true})])[0];
    const normal = h.add([make(40.1, 44.1, 0)])[0];
    h.at(40.1);
    for (const c of [owner, mine, posting]) { assert(h.player._domTable.has(c)); }
    assert(!h.player._domTable.has(normal));
    assert.equal(h.player.displayStats.live, 40);
    assertConsistent(h);
  });
  it('優先度: 今回の通常 > 増量分。増量分は通常コメント用の枠を残して止まる', () => {
    const history = new Set();
    const h = setup({limit: 40, history});
    const hist = many(30, 40, 44); hist.forEach(c => history.add(c)); h.add(hist);
    h.at(40);
    assert.equal(h.screen().length, 30, '増量分は上限の75%まで');
    const normal = h.add(many(15, 40.2, 44.2));
    h.at(40.2);
    assert.equal(normal.filter(c => h.player._domTable.has(c)).length, 10, '残り枠は通常コメントが使える');
    assert.equal(h.player.displayStats.suppressed.limit, 5);
    assertConsistent(h);
  });
  it('優先度: 同じフレームでは 通常 > かんたん > AI > 増量、同順位は開始時刻順', () => {
    const history = new Set();
    const h = setup({limit: 40, history});
    const ai = h.add(many(10, 40, 44, 3));
    const easy = h.add(many(10, 40, 44, 2));
    const hist = many(10, 39.9, 44); hist.forEach(c => history.add(c)); h.add(hist);
    const main = h.add(many(30, 40.5, 44.5));
    h.at(40);
    const has = list => list.filter(c => h.player._domTable.has(c)).length;
    assert.equal(has(main), 30);
    assert.equal(has(easy), 6, 'かんたんは上限の90%(36)まで');
    assert.equal(has(ai), 0, 'AIは85%(34)まで');
    assert.equal(has(hist), 0);
    assert.equal(h.player.displayStats.suppressed.reserve, 4 + 10 + 10);
  });
  it('上限を下げても表示中は消さず、新規の受け入れだけを止める', () => {
    const h = setup({limit: 200}); const list = h.add(many(100, 40, 44)); h.at(40);
    h.props.maxDisplayComment = 40;
    const late = h.add(many(5, 40.5, 44.5)); h.at(40.5);
    for (const c of list) { assert(h.player._domTable.has(c)); }
    for (const c of late) { assert(!h.player._domTable.has(c)); }
    assertConsistent(h);
  });
  it('不正な上限値は既定200に戻す。選択肢は40/100/200/400/800', () => {
    const h = setup();
    assert.deepEqual(Array.from(h.Budget.CHOICES), [40, 100, 200, 400, 800]);
    assert.equal(h.Budget.DEFAULT, 200);
    for (const v of [undefined, null, 'abc', 0, -1, 20000, 150]) { assert.equal(h.Budget.normalizeLimit(v), 200); }
    assert.equal(h.Budget.normalizeLimit('400'), 400);
  });
  it('clearで表示・見送り・削除予約の表をすべて解放する', () => {
    const h = setup({limit: 40}); h.add(many(60, 40, 44)); h.at(40);
    h.player.clear();
    assert.equal(h.player._domTable.size + h.player._inSlotTable.size + h.player._inViewTable.size + h.player._suppressedTable.size, 0);
    assert.equal(h.screen().length, 0);
    h.at(40.1);
    assert.equal(h.screen().length, 40, 'refresh相当の再判定で再表示できる');
    assertConsistent(h);
  });
  it('長時間の連続再生でも表・DOM・削除予約が累積しない', () => {
    const h = setup({limit: 100});
    for (let s = 0; s < 120; s += 0.5) { h.add(many(8, s, s + 4)); }
    let maxDom = 0;
    for (let t = 0; t <= 130; t += 1 / 30) {
      h.at(t); maxDom = Math.max(maxDom, h.player._domTable.size);
    }
    assert(maxDom <= 100);
    assert.equal(h.player._domTable.size + h.player._inViewTable.size + h.player._suppressedTable.size, 0);
    assert.equal(h.player.removingElements.length, 0);
  });
});

describe('Task206 上級者設定の同時表示上限', () => {
  const {createNgSettingsHarness} = require('../helpers/ngRegexHarness');
  const {read} = require('../helpers/extractSource');
  it('selectの値は選択肢の数値として保存し、不正値は既定200にする', () => {
    const h = createNgSettingsHarness();
    h.input('commentLayer.maxDisplayComment', '400');
    assert.strictEqual(h.props['commentLayer.maxDisplayComment'], 400);
    h.input('commentLayer.maxDisplayComment', '40');
    assert.strictEqual(h.props['commentLayer.maxDisplayComment'], 40);
    h.input('commentLayer.maxDisplayComment', '150');
    assert.strictEqual(h.props['commentLayer.maxDisplayComment'], 200);
  });
  it('設定画面とConfigは共通定義CommentDisplayBudgetを参照し、本体には40件の強制削除が残っていない', () => {
    const setting = read('src/_setting.js');
    assert(/data-setting-name="commentLayer\.maxDisplayComment"/.test(setting));
    assert(/CommentDisplayBudget\.CHOICES\.map/.test(setting));
    assert(/'commentLayer\.maxDisplayComment':\s*CommentDisplayBudget\.DEFAULT/.test(read('src/Config.js')));
    const view = read('packages/zenza/src/commentLayer/NicoCommentCss3PlayerView.js');
    assert(!/MAX_DISPLAY_COMMENT\s*=/.test(view));
    assert(!/_gcInviewElements\s*\(\)\s*\{/.test(view));
    assert(/setHistoryClassifier/.test(read('src/CommentPlayer.js')));
  });
});

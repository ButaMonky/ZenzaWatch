import assert from 'power-assert';
import {JSDOM} from 'jsdom';
import {NicoChat} from '../../packages/zenza/src/commentLayer/NicoChat';
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');
const chat = (data = {}) => NicoChat.create(Object.assign({thread: 1, fork: 0, no: 1, text: 'text', vpos: 100}, data));
function env(extra = {}) {
  const c = createContext(Object.assign({NicoChat, console: {log(){}, time(){}, timeEnd(){}, info(){}}, _: {isObject: v => v !== null && typeof v === 'object', size: v => Object.keys(v).length}, MAX_COMMENT: 100000}, extra));
  run(beginSection('packages/lib/src/Emitter.js'), c);
  const Group = loadClass('packages/zenza/src/commentLayer/NicoChatGroup.js', 'NicoChatGroup', c);
  const filter = {on(){}, isSafe: () => true, applyFilter: xs => xs};
  const group = () => new Group('naka', {nicoChatFilter: filter});
  return {c, group};
}
describe('Full comment identity (ZW-073)', function() {
  it('keeps all thread/fork/no components without modulo collisions', function() {
    const variants = [chat(), chat({no: 10001}), chat({thread: 1000001}), chat({fork: 1})];
    assert.equal(new Set(variants.map(c => c.uniqNo)).size, 4);
    assert.equal(chat().uniqNo, chat().uniqNo);
    assert.equal(chat({thread: '1', fork: '0', no: '1'}).uniqNo, chat().uniqNo);
  });
  it('preserves identity on same-number reassignment and updates after posting', function() {
    const c = chat(), original = c.uniqNo;
    c.no = 1; assert.equal(c.uniqNo, original);
    c.no = 10001; assert.notEqual(c.uniqNo, original);
    assert.equal(c.uniqNo, chat({no: 10001}).uniqNo);
  });
  it('recomputes legacy cached numeric identity when restoring bulk props', function() {
    const a = chat(), b = chat({no: 10001});
    const oldA = Object.assign({}, a.props, {uniqNo: 1000001});
    const oldB = Object.assign({}, b.props, {uniqNo: 1000001});
    const restoredA = new NicoChat(oldA, {format: 'bulk'});
    const restoredB = new NicoChat(oldB, {format: 'bulk'});
    assert.equal(restoredA.uniqNo, a.uniqNo); assert.equal(restoredB.uniqNo, b.uniqNo);
    assert.notEqual(restoredA.uniqNo, restoredB.uniqNo);
    assert.equal(new NicoChat(JSON.parse(JSON.stringify(b.props)), {format: 'bulk'}).uniqNo, b.uniqNo);
  });
  it('uses numeric tuple order at equal vpos, including no 2 before 10', function() {
    const a = chat({no: 2}), b = chat({no: 10}), c = chat({thread: 2, no: 1});
    assert.ok(NicoChat.SORT_FUNCTION(a, b) < 0);
    assert.ok(NicoChat.SORT_FUNCTION(b, c) < 0);
    assert.equal(NicoChat.SORT_FUNCTION(a, chat({no: 2})), 0);
    assert.ok(NicoChat.SORT_FUNCTION(chat({vpos: 1, thread: 999}), a) < 0);
  });
  it('deduplicates identical clones but retains collisions through actual append', async function() {
    const h = env();
    const Comment = loadClass('packages/zenza/src/commentLayer/NicoComment.js', 'NicoComment', h.c);
    const model = Object.create(Comment.prototype);
    model.topGroup = h.group(); model.nakaGroup = h.group(); model.bottomGroup = h.group();
    model.nicoScripter = {reset(){}, isEmpty: true}; model.emit = () => {};
    const first = {thread: 1, fork: 0, no: 1, text: 'first'};
    await model.setChats([first]);
    await model.setChats([Object.assign({}, first), Object.assign({}, first, {no: 10001}), Object.assign({}, first, {thread: 1000001})], {append: true});
    assert.equal(model.nakaGroup.nonFilteredMembers.length, 3);
    assert.ok(model.nakaGroup.includes(chat()));
    assert.equal(model.nakaGroup.includes(chat({fork: 1})), undefined);
  });
  it('forwards identity through the view-model and panel getters', function() {
    const h = env();
    const VM = loadClass('packages/zenza/src/commentLayer/NicoChatViewModel.js', 'NicoChatViewModel', h.c);
    const Item = loadClass('src/CommentPanel.js', 'CommentListItem', h.c);
    const c = chat({no: 10001});
    const vm = Object.create(VM.prototype); vm._nicoChat = c;
    const item = Object.create(Item.prototype); item.nicoChat = c;
    assert.strictEqual(vm.uniqNo, c.uniqNo); assert.strictEqual(item.uniqNo, c.uniqNo);
    assert.strictEqual(JSON.parse(JSON.stringify({uniqNo: vm.uniqNo})).uniqNo, c.uniqNo);
    const later = Object.create(VM.prototype); later._nicoChat = chat({thread: 2, no: 1});
    assert.ok(NicoChat.SORT_FUNCTION(vm, later) < 0);
  });
  it('selects the right comment through actual DOM preview click and model lookup', function() {
    const dom = new JSDOM('<div class="preview"><div class="nicoChat"><button data-command="addUserIdFilter">NG</button></div></div>');
    try {
      const sent = [], h = env({window: {setTimeout(){}}, util: {dispatchCommand: (target, command, value) => sent.push([command, value])}});
      const Model = loadClass('src/VideoControlBar.js', 'CommentPreviewModel', h.c);
      const View = loadClass('src/VideoControlBar.js', 'CommentPreviewView', h.c);
      const a = chat({user_id: 'a'}), b = chat({no: 10001, user_id: 'b'});
      const model = Object.create(Model.prototype); model._chatList = [a, b];
      const view = Object.create(View.prototype); view._model = model; view._view = dom.window.document.querySelector('.preview');
      const row = dom.window.document.querySelector('.nicoChat'); row.dataset.nicochatUniqNo = b.uniqNo;
      view._onClick({target: row.querySelector('button'), stopPropagation(){}});
      assert.deepEqual(sent, [['addUserIdFilter', 'b']]);
    } finally { dom.window.close(); }
  });
});

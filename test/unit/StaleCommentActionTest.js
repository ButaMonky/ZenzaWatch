import assert from 'power-assert';
const {createContext, loadClass} = require('../helpers/extractSource');

function subject() {
  class Emitter {}
  const copied = [];
  const c = createContext({Emitter, Clipboard: {copyText: text => copied.push(text)}});
  const Model = loadClass('src/CommentPanel.js', 'CommentListModel', c);
  const Panel = loadClass('src/CommentPanel.js', 'CommentPanel', c);
  const model = new Model({});
  model.emit = () => {};
  const item = {itemId: 0, vpos: 1250, text: 'hello', userId: 'user', nicoru: 0, nicoChat: {no: 1}};
  model.setItem([item]);
  const panel = Object.create(Panel.prototype);
  panel._model = model;
  const events = [];
  panel.emit = (...args) => events.push(args);
  return {panel, model, item, copied, events};
}

describe('消えたコメントの操作（D-40 / Task106）', function() {
  it('一覧clear後の古い行から届く操作は例外も副作用も起こさない', function() {
    const s = subject();
    s.model.clear();
    ['select', 'clipBoard', 'addUserIdFilter', 'addWordFilter', 'nicoru', 'reloadComment', 'itemDetailRequest', 'removeComment'].forEach(command => {
      assert.doesNotThrow(() => s.panel._onCommand(command, null, '0'), command);
    });
    assert.deepEqual(s.events, []);
    assert.deepEqual(s.copied, []);
  });
  it('対象IDのない行専用操作も何もしない', function() {
    const s = subject();
    ['select', 'clipBoard', 'addUserIdFilter', 'addWordFilter', 'nicoru', 'itemDetailRequest', 'removeComment'].forEach(command => {
      assert.doesNotThrow(() => s.panel._onCommand(command, null));
    });
    assert.deepEqual(s.events, []);
  });
  it('存在する行の数値ID=0でもシーク・コピー・ニコるが従来どおり動く', function() {
    const s = subject();
    s.panel._onCommand('select', null, 0);
    s.panel._onCommand('clipBoard', null, 0);
    s.panel._onCommand('nicoru', null, 0);
    assert.deepEqual(s.events[0], ['command', 'seek', 12.5]);
    assert.deepEqual(s.copied, ['hello']);
    assert.equal(s.item.nicoru, 1);
    assert.equal(s.item.nicotta, true);
    assert.deepEqual(s.events[2], ['command', 'nicoru', s.item.nicoChat]);
  });
  it('IDを使わない一覧全体の操作はそのまま通す', function() {
    const s = subject();
    s.panel._onCommand('reloadComment', {when: 123});
    s.panel._onCommand('customCommand', 'value');
    assert.deepEqual(s.events, [['command', 'reloadComment', {when: 123}], ['command', 'customCommand', 'value']]);
  });
});

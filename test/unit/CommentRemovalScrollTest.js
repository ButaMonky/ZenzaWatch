import assert from 'power-assert';
const {createContext, loadClass} = require('../helpers/extractSource');
const lodash = require('lodash');

function subject(vpositions = [0, 1000, 2000]) {
  class Emitter {
    constructor() { this.events = []; }
    emit(...args) { this.events.push(args); }
    emitAsync(...args) { this.emit(...args); }
  }
  const c = createContext({Emitter, _: lodash, textUtil: {
    escapeHtml: String, dateToString: String, secToTime: String
  }});
  c.CommentListItem = loadClass('src/CommentPanel.js', 'CommentListItem', c);
  c.CommentListItem._itemId = 0;
  const Model = loadClass('src/CommentPanel.js', 'CommentListModel', c);
  const model = new Model({});
  model.setChatList({top: [], bottom: [], naka: vpositions.map((vpos, i) => ({vpos, text: 'row'+i, date: i}))});
  model.events.length = 0;
  return model;
}

describe('コメント削除後の時刻と一覧位置（D-40 / Task107）', function() {
  it('過去の行を削除した後、現在時刻に対応する残った行を指す', function() {
    const m = subject();
    m.removeItem(m.getItemByIndex(0));
    const index = m.getInViewIndex(20);
    assert.equal(index, 1);
    assert.equal(m.getItemByIndex(index).vpos, 2000);
  });
  it('同じ時刻のコメントを1件削除しても、もう1件を残して正しい行を指す', function() {
    const m = subject([0, 1000, 1000, 2000]);
    m.removeItem(m.getItemByIndex(1));
    const index = m.getInViewIndex(10);
    assert.equal(index, 1);
    assert.equal(m.getItemByIndex(index).vpos, 1000);
    assert.equal(m.length, 3);
  });
  it('行番号が同じでも、一覧更新後の次の時刻更新で位置を再通知する', function() {
    const m = subject();
    m.currentTime = 10;
    m.events.length = 0;
    m.removeItem(m.getItemByIndex(2));
    m.currentTime = 10.2;
    const events = m.events.filter(e => e[0] === 'currentTimeUpdate');
    assert.deepEqual(events, [['currentTimeUpdate', 10.2, 1]]);
  });
  it('indexでの削除も一覧更新を通知し、時刻の対応を保つ', function() {
    const m = subject();
    m.removeItemByIndex(0);
    assert.equal(m.getInViewIndex(20), 1);
    assert.equal(m.events.filter(e => e[0] === 'update').length, 1);
  });
  it('存在しない行の削除は何も変えず、最後の行を削除すると空になる', function() {
    const m = subject([1000]);
    m.removeItem({});
    m.removeItemByIndex(99);
    assert.equal(m.events.length, 0);
    assert.equal(m.length, 1);
    m.removeItem(m.getItemByIndex(0));
    assert.equal(m.length, 0);
    assert.equal(m.getItemByIndex(m.getInViewIndex(10)), null);
  });
});

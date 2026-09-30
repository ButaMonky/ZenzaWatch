// Task 103 / D-40: コメント一覧で選択したコメントを視覚的に強調する。
import assert from 'power-assert';
import {JSDOM} from 'jsdom';

const {createContext, loadClass} = require('../helpers/extractSource');

function subject() {
  const dom = new JSDOM('<!doctype html><body>' +
    '<div class="commentListItem" data-item-id="1"><span class="text">one</span></div>' +
    '<div class="commentListItem" data-item-id="2"><span class="text">two</span></div>' +
    '</body>');
  const w = dom.window;
  class Emitter {}
  const c = createContext({Emitter});
  const CommentListView = loadClass('src/CommentPanel.js', 'CommentListView', c);
  const view = Object.create(CommentListView.prototype);
  const commands = [];
  view.emit = (...args) => commands.push(args);
  const items = [...w.document.querySelectorAll('.commentListItem')];

  const dblclick = item => {
    CommentListView.prototype._onDblClick.call(view, {
      target: item.querySelector('.text'),
      stopPropagation() {},
      preventDefault() {}
    });
  };

  return {dom, items, commands, dblclick};
}

describe('コメント一覧の選択強調（D-40 / Task 103）', function() {
  it('ダブルクリックした行を強調し、前の選択だけ解除する', function() {
    const s = subject();

    s.dblclick(s.items[0]);
    assert.ok(s.items[0].classList.contains('is-active'));
    assert.ok(!s.items[1].classList.contains('is-active'));
    assert.deepEqual(s.commands[0], ['command', 'select', null, '1']);

    s.dblclick(s.items[1]);
    assert.ok(!s.items[0].classList.contains('is-active'));
    assert.ok(s.items[1].classList.contains('is-active'));
    assert.deepEqual(s.commands[1], ['command', 'select', null, '2']);

    s.dom.window.close();
  });

  it('選択強調用の既存CSSクラス is-active を利用する', function() {
    const s = subject();
    s.dblclick(s.items[0]);
    assert.equal(s.items[0].classList.contains('is-active'), true);
    s.dom.window.close();
  });
});

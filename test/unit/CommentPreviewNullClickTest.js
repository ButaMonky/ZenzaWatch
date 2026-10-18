'use strict';

const assert = require('assert');
const {JSDOM} = require('jsdom');
const {loadClass, createContext} = require('../helpers/extractSource');

function harness(file) {
  const dom = new JSDOM('<div class="preview"><div class="listContainer"></div><div class="nicoChat" data-nicochat-uniq-no="chat-1" data-vpos="1234"><button data-command="addWordFilter">NG</button></div></div>');
  const sent = [];
  const timers = [];
  const context = createContext({
    util: {dispatchCommand: (target, command, arg) => sent.push({target, command, arg})},
    window: {
      setTimeout: (fn, delay) => {
        timers.push({fn, delay});
        return dom.window.setTimeout(fn, delay);
      },
      clearTimeout: dom.window.clearTimeout.bind(dom.window)
    }
  });
  const View = loadClass(file, 'CommentPreviewView', context);
  const view = Object.create(View.prototype);
  view._view = dom.window.document.querySelector('.preview');
  view._model = {getItemByUniqNo: id => id === 'chat-1' ? {userId: 'u1', text: 'hello', cmd: '184'} : null};
  const click = element => {
    let stopped = 0;
    view._onClick({target: element, stopPropagation: () => stopped++});
    return stopped;
  };
  return {dom, view, click, sent, timers};
}

describe('AUD-06 CommentPreview empty-region click null guard (Task305)', function() {
  for (const file of ['src/VideoControlBar.js', 'dist/ZenzaWatch-dev.user.js']) {
    it(file + ': safely ignores preview background and empty list clicks', function() {
      const h = harness(file);
      try {
        const background = h.view._view;
        const emptyList = background.querySelector('.listContainer');
        assert.strictEqual(h.click(background), 1);
        assert.strictEqual(h.click(emptyList), 1);
        assert.deepStrictEqual(h.sent, []);
        assert.strictEqual(h.timers.length, 0);
        assert.strictEqual(background.classList.contains('is-updating'), false);
      } finally { h.dom.window.close(); }
    });
    it(file + ': preserves click-to-seek and NG filtering within a comment row', function() {
      const h = harness(file);
      try {
        const row = h.view._view.querySelector('.nicoChat');
        assert.strictEqual(h.click(row), 1);
        assert.strictEqual(h.sent.length, 1);
        assert.strictEqual(h.sent[0].command, 'seek');
        assert.strictEqual(h.sent[0].arg, 12.34);
        assert.strictEqual(h.click(row.querySelector('button')), 1);
        assert.strictEqual(h.sent.length, 2);
        assert.strictEqual(h.sent[1].command, 'addWordFilter');
        assert.strictEqual(h.sent[1].arg, 'hello');
        assert.strictEqual(h.timers.length, 1);
      } finally { h.dom.window.close(); }
    });
  }
});

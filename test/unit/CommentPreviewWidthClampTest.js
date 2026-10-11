'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function subject(source, width, mode = 'list') {
  const global = {innerWidth: width};
  const c = createContext({global});
  const View = loadClass(source, 'CommentPreviewView', c);
  View.WIDTH = 350;
  View.HOVER_WIDTH = 180;
  const view = Object.create(View.prototype);
  view._mode = mode;
  view._chatList = [{id: 1}];
  view._isListUpdated = false;
  view.applied = 0;
  view.applyView = () => view.applied++;
  return {view, global};
}
for (const source of ['src/VideoControlBar.js','dist/ZenzaWatch-dev.user.js']) {
  describe('Task375 AUD-06 preview bounds: ' + source, () => {
    it('centers the actual hover preview width', () => {
      const {view} = subject(source, 1000, 'hover');
      view.update(500);
      assert.strictEqual(view._left, 410);
      assert.strictEqual(view.applied, 1);
    });
    it('centers full list width', () => {
      const {view} = subject(source, 1000, 'list');
      view.update(500);
      assert.strictEqual(view._left, 325);
    });
    it('clamps wide-window edges without overshooting', () => {
      const {view} = subject(source, 1000, 'list');
      view.update(0);
      assert.strictEqual(view._left, 0);
      view.update(1000);
      assert.strictEqual(view._left, 650);
    });
    it('never yields negative left when viewport is narrower than preview', () => {
      const {view} = subject(source, 220, 'list');
      for (const x of [0, 20, 110, 220, 900]) {
        view.update(x);
        assert.strictEqual(view._left, 0);
      }
    });
    it('reacts to resize instead of reading stale cached dimensions', () => {
      const {view, global} = subject(source, 1000, 'list');
      view.update(980);
      assert.strictEqual(view._left, 650);
      global.innerWidth = 400;
      view.update(980);
      assert.strictEqual(view._left, 50);
      global.innerWidth = 1000;
      view.update(980);
      assert.strictEqual(view._left, 650);
    });
    it('keeps hover and list widths distinct after mode changes', () => {
      const {view} = subject(source, 800, 'hover');
      view.update(400);
      assert.strictEqual(view._left, 310);
      view._mode = 'list';
      view.update(400);
      assert.strictEqual(view._left, 225);
      view._mode = 'hover';
      view.update(400);
      assert.strictEqual(view._left, 310);
    });
    it('does not render when there is no preview content', () => {
      const {view} = subject(source, 800);
      view._chatList = [];
      view.update(300);
      assert.strictEqual(view.applied, 0);
    });
  });
}

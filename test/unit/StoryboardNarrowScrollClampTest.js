'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function harness(path, totalWidth, viewportWidth = 900) {
  const ctx = createContext({global: {innerWidth: viewportWidth},
    Emitter: class {}, cssUtil: {px: value => value}});
  const StoryboardView = loadClass(path, 'StoryboardView', ctx);
  const view = Object.create(StoryboardView.prototype);
  const canvas = {isAnimating: false, scrollLeft: 0};
  view.canvas = canvas;
  view._scrollLeft = 0;
  view.totalWidth = totalWidth;
  view.isEnable = true;
  view.isOpen = true;
  view.state = {isDragging: false};
  view._model = {isAvailable: true, duration: 10,
    cellWidth: 50, cellIntervalMs: 1000};
  return {view, canvas};
}

for (const path of ['packages/zenza/src/storyboard/StoryboardView.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task363 AUD-07 narrow storyboard scrolling: ' + path, () => {
    it('never reports negative scroll on a board narrower than viewport', () => {
      const {view, canvas} = harness(path, 500);
      view.scrollLeft = 0;
      assert.strictEqual(view.scrollLeft, 0);
      view.scrollLeft = 200;
      assert.strictEqual(view.scrollLeft, 0);
      view.scrollLeft = -200;
      assert.strictEqual(view.scrollLeft, 0);
      assert.strictEqual(canvas.scrollLeft, 0);
      assert.strictEqual(view._parsePointerEvent({offsetX: 30, x: 30}).sec, 0.6);
    });
    it('keeps a board equal to viewport stationary', () => {
      const {view} = harness(path, 900);
      view.scrollLeft = 450;
      assert.strictEqual(view.scrollLeft, 0);
    });

    it('clamps both edges while retaining ordinary wide-board movement', () => {
      const {view, canvas} = harness(path, 1500);
      view.scrollLeft = 225;
      assert.strictEqual(view.scrollLeft, 225);
      assert.strictEqual(canvas.scrollLeft, 225);
      view.scrollLeft = 1200;
      assert.strictEqual(view.scrollLeft, 600);
      view.scrollLeft = -20;
      assert.strictEqual(view.scrollLeft, 0);
    });
    it('keeps seek-driven narrow scrolling and pointer timing nonnegative', () => {
      const {view, canvas} = harness(path, 500);
      view._currentTime = -1;
      view._view = {};
      view.setCurrentTime(3);
      assert.strictEqual(view.scrollLeft, 0);
      assert.strictEqual(canvas.scrollLeft, 0);
      assert.strictEqual(view.pointerLeft, 150);
      assert.strictEqual(view._parsePointerEvent({offsetX: 0, x: 0}).sec, 0);
    });
  });
}

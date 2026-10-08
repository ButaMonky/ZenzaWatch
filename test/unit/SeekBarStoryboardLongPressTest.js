'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {loadClass, createContext} = require('../helpers/extractSource');
const {REPO_ROOT} = require('../helpers/buildSandbox');

function harness() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const callbacks = [];
  const dispatched = [];
  const window = {
    setTimeout(fn, delay) {
      const id = ++nextId;
      timers.set(id, {due: now + delay, fn});
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  const context = createContext({
    Emitter: class {}, window,
    global: {innerWidth: 1000},
    util: {dispatchCommand: (...args) => dispatched.push(args)}
  });
  const VideoControlBar = loadClass('src/VideoControlBar.js', 'VideoControlBar', context);
  const bar = Object.create(VideoControlBar.prototype);
  const classes = new Set();
  bar.classList = {
    add(value) { classes.add(value); },
    remove(value) { classes.delete(value); }
  };
  bar._seekBar = {contains: target => target?.withinSeekBar === true};
  bar._bindDragEvent = () => callbacks.push('bind');
  bar._unbindDragEvent = () => callbacks.push('unbind');
  bar.state = {isDragging: false};
  bar._stopTimer = () => {};
  bar._seekBarToolTip = {update: (sec, left) => callbacks.push(['tooltip', sec, left])};
  bar.storyboard = {setCurrentTime: (sec, force) => callbacks.push(['boardTime', sec, force])};
  const tick = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.due <= now) {
        timers.delete(id);
        timer.fn();
      }
    }
  };
  const down = (withinSeekBar = true, button = 0) => {
    let stopped = false;
    bar._onSeekBarMouseDown({
      target: {withinSeekBar}, button,
      stopPropagation() { stopped = true; }
    });
    assert(stopped, 'the existing event ownership must be preserved');
  };
  return {bar, classes, timers, callbacks, dispatched, tick, down};
}

describe('Task312 storyboard opens only after a 200ms seek-bar hold', function() {
  it('never flashes for a short click, and retains immediate dragging/seeking', () => {
    const h = harness();
    h.down();
    assert.strictEqual(h.bar.state.isDragging, true);
    assert(h.classes.has('is-dragging'));
    assert(!h.classes.has('is-storyboardLongPress'));
    h.tick(199);
    assert(!h.classes.has('is-storyboardLongPress'));
    h.bar._onBodyMouseUp({button: 0, shiftKey: false});
    h.tick(100);
    assert(!h.classes.has('is-storyboardLongPress'));
    assert.strictEqual(h.timers.size, 0);
    assert.strictEqual(h.bar.state.isDragging, false);
    assert(!h.classes.has('is-dragging'));
    assert.deepStrictEqual(h.callbacks, ['bind', 'unbind']);
  });
  it('shows at 200ms and hides on release', () => {
    const h = harness();
    h.down();
    h.tick(199);
    assert(!h.classes.has('is-storyboardLongPress'));
    h.tick(1);
    assert(h.classes.has('is-storyboardLongPress'));
    assert(h.classes.has('is-dragging'));
    h.bar._onBodyMouseUp({button: 0});
    assert(!h.classes.has('is-storyboardLongPress'));
    assert(!h.classes.has('is-dragging'));
  });
  it('cancels pending display on focus loss and mouse release', () => {
    for (const release of ['_onWindowBlur', '_endMouseDrag']) {
      const h = harness();
      h.down();
      h.tick(100);
      h.bar[release]();
      h.tick(200);
      assert(!h.classes.has('is-storyboardLongPress'), release);
      assert.strictEqual(h.timers.size, 0);
    }
  });
  it('does not start the seek-bar hold from unrelated player shortcuts or nonprimary buttons', () => {
    for (const [inside, button] of [[false, 0], [true, 2], [false, 2], [true, null]]) {
      const h = harness();
      h.down(inside, button);
      assert.strictEqual(h.timers.size, 0);
      h.tick(500);
      assert(!h.classes.has('is-storyboardLongPress'));
      h.bar._endMouseDrag();
    }
  });
  it('cancels and restarts the 200ms timer on a new press', () => {
    const h = harness();
    h.down();
    h.tick(140);
    h.down();
    h.tick(100);
    assert(!h.classes.has('is-storyboardLongPress'));
    h.tick(100);
    assert(h.classes.has('is-storyboardLongPress'));
    assert.strictEqual(h.timers.size, 0);
  });
  it('clears a pending hold if the video closes or is replaced', () => {
    const h = harness();
    h.down();
    h.bar._onPlayerClose();
    assert.strictEqual(h.timers.size, 0);
    h.tick(250);
    assert(!h.classes.has('is-storyboardLongPress'));
  });
  it('handles close safely even if the control-bar DOM is not initialized', () => {
    const h = harness();
    h.down();
    h.bar.classList = null;
    h.bar._onPlayerClose();
    assert.strictEqual(h.timers.size, 0);
    h.tick(300);
  });
  it('keeps the shift-mouseup escape from leaking a delayed overlay', () => {
    const h = harness();
    h.down();
    h.bar._onBodyMouseUp({button: 0, shiftKey: true});
    h.tick(300);
    assert(!h.classes.has('is-storyboardLongPress'));
    assert.strictEqual(h.timers.size, 0);
    h.bar._endMouseDrag();
  });
  it('continues to seek immediately on range input before the hold threshold', () => {
    const h = harness();
    const target = {value: '12', max: '60'};
    h.down();
    h.bar._onSeekRangeInput({target});
    assert.deepStrictEqual(h.dispatched, [[target, 'seek', 12]]);
    assert.deepStrictEqual(h.callbacks.slice(-2),
      [['tooltip', 12, 200], ['boardTime', 12, true]]);
    assert(!h.classes.has('is-storyboardLongPress'));
    h.bar._endMouseDrag();
    h.tick(300);
    assert(!h.classes.has('is-storyboardLongPress'));
  });
  it('gates only drag-triggered storyboard visibility; wheel and pinned views remain immediate', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT,
      'packages/zenza/src/storyboard/StoryboardView.js'), 'utf8');
    assert(src.includes('.is-dragging.is-storyboardLongPress .storyboardContainer.is-success'));
    assert(!/\.is-dragging\s+\.storyboardContainer\.is-success\s*,/.test(src));
    assert(src.includes('.is-wheelSeeking .storyboardContainer.is-success'));
    assert(src.includes('.storyboardContainer.is-success.is-open'));
  });
});

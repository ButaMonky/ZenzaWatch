'use strict';

const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function harness({width = 1200, left = 0, scale = 1, viewport = 1200,
  tooltipWidth = 180} = {}) {
  const container = {
    width, left, scale,
    get offsetWidth() { return this.width; },
    getBoundingClientRect() {
      return {left: this.left, width: this.width * this.scale};
    }
  };
  const view = {offsetWidth: tooltipWidth, x: NaN};
  const labels = [];
  const thumbnails = [];
  const context = createContext({
    window: {innerWidth: viewport},
    util: {secToTime: sec => String(Math.floor(sec))},
    cssUtil: {
      px: value => value,
      setProps: ([element, name, value]) => {
        assert.strictEqual(name, '--trans-x-pp');
        element.x = value;
      }
    }
  });
  const Subject = loadClass('src/VideoControlBar.js', 'SeekBarToolTip', context);
  const subject = Object.create(Subject.prototype);
  subject._$view = [view];
  subject._$container = [container];
  subject.currentTimeLabel = {set text(value) { labels.push(value); }};
  subject._seekBarThumbnail = {set currentTime(value) { thumbnails.push(value); }};
  return {container, view, labels, thumbnails, context,
    update: (sec, x) => subject.update(sec, x)};
}

describe('SeekBar scene-search tooltip follows and clamps at the edges (Task309)', function() {
  it('moves exactly 1px for each mouse pixel within the same displayed second', function() {
    const h = harness({width: 1000, viewport: 1000});
    h.update(243.1, 400);
    const x1 = h.view.x;
    h.update(243.2, 401);
    assert.strictEqual(h.view.x - x1, 1, 'the tooltip must track 1:1');
    h.update(243.3, 450);
    assert.strictEqual(h.view.x - x1, 50, 'no slowdown or easing');
    assert.strictEqual(h.labels.length, 1, 'same-second label redraws remain suppressed');
    assert.deepStrictEqual(h.thumbnails, [243.1, 243.2, 243.3]);
  });
  it('stops at both edges, then follows immediately when moving inward', function() {
    for (const width of [1920, 1024, 320]) {
      const h = harness({width, viewport: width});
      h.update(20.1, 0);
      assert.strictEqual(h.view.x, 0, 'left boundary at width=' + width);
      h.update(20.1, 50);
      assert.strictEqual(h.view.x, 0, 'no overflow at left edge');
      h.update(20.1, width / 2);
      assert.strictEqual(h.view.x, width / 2 - 90, 'cursor centered');
      h.update(20.1, width / 2 + 1);
      assert.strictEqual(h.view.x, width / 2 - 89, 'no slowdown in middle');
      h.update(20.1, width);
      assert.strictEqual(h.view.x, width - 180, 'right boundary');
      h.update(20.1, width - 50);
      assert.strictEqual(h.view.x, width - 180, 'stop at right edge');
      h.update(20.1, width - 95);
      assert.strictEqual(h.view.x, width - 185, 'resume immediately inward');
    }
  });
  it('updates scene time and thumbnail even while position is clamped', function() {
    const h = harness({width: 320, viewport: 320});
    h.update(50.1, 320);
    h.update(50.2, 319);
    assert.strictEqual(h.view.x, 140, 'preview stays within the right edge');
    assert.deepStrictEqual(h.labels, ['50']);
    h.update(51.2, 319);
    assert.strictEqual(h.view.x, 140, 'position remains clamped');
    assert.deepStrictEqual(h.labels, ['50', '51']);
    assert.deepStrictEqual(h.thumbnails, [50.1, 50.2, 51.2]);
  });
  it('re-measures container width, viewport and CSS scale after a mode change', function() {
    const h = harness({width: 1000, viewport: 1400, left: 200});
    h.update(10.1, 950);
    assert.strictEqual(h.view.x, 820);
    h.container.width = 500;
    h.container.left = 600;
    h.container.scale = 0.8;
    h.context.window.innerWidth = 1100;
    h.update(10.2, 950);
    assert.strictEqual(h.view.x, 320, 'new player width must clamp the position');
    assert(h.container.left + (h.view.x + 180) * h.container.scale <= 1100);
    assert.strictEqual(h.labels.length, 1);
  });
  it('uses the visible viewport bounds for an offscreen or offset player', function() {
    const h = harness({width: 1000, viewport: 800, left: -100});
    h.update(20, 0);
    assert.strictEqual(h.view.x, 100, 'left viewport clip');
    h.update(20, 300);
    assert.strictEqual(h.view.x, 210);
    h.update(20, 301);
    assert.strictEqual(h.view.x, 211, 'exact pointer step');
    h.update(20, 1000);
    assert.strictEqual(h.view.x, 720, 'right viewport clip');
    h.update(20, 750);
    assert.strictEqual(h.view.x, 660, 'immediate inward tracking');
  });
  it('handles a player narrower than the tooltip without viewport overflow', function() {
    const h = harness({width: 140, left: 400, viewport: 1000});
    h.update(8.1, 40);
    const first = h.view.x;
    h.update(8.2, 130);
    assert(h.view.x > first);
    assert(h.container.left + h.view.x >= 0);
    assert(h.container.left + h.view.x + 180 <= 1000);
  });
});

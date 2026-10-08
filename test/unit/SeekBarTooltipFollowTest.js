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

describe('SeekBar scene-search tooltip follows the pointer (Task308)', function() {
  it('moves on every mousemove inside the same displayed second', function() {
    const h = harness({width: 1000, viewport: 1000});
    h.update(243.1, 700);
    const x1 = h.view.x;
    h.update(243.2, 850);
    const x2 = h.view.x;
    h.update(243.3, 1000);
    assert(x1 < x2 && x2 < h.view.x, 'tooltip must not freeze at the right edge');
    assert.strictEqual(h.labels.length, 1, 'same-second label redraws remain suppressed');
    assert.deepStrictEqual(h.thumbnails, [243.1, 243.2, 243.3]);
  });
  it('keeps following from center to right edge in full, normal and small modes', function() {
    for (const width of [1920, 1024, 320]) {
      const h = harness({width, viewport: width});
      const xs = [width * 0.75, width * 0.9, width];
      const positions = xs.map(x => { h.update(20.1, x); return h.view.x; });
      assert(positions[0] < positions[1] && positions[1] < positions[2],
        'tooltip freezes before right edge at width=' + width);
      assert(positions[0] >= 0, 'left overflow at width=' + width);
      assert(Math.abs(positions[2] + 180 - width) < 0.01,
        'right overflow at width=' + width);
    }
  });
  it('re-measures container width, viewport and CSS scale after a mode change', function() {
    const h = harness({width: 1000, viewport: 1400, left: 200});
    h.update(10.1, 400);
    const before = h.view.x;
    h.container.width = 500;
    h.container.left = 600;
    h.container.scale = 0.8;
    h.context.window.innerWidth = 1100;
    h.update(10.2, 400);
    assert.notStrictEqual(h.view.x, before);
    assert(h.container.left + (h.view.x + 180) * h.container.scale <= 1100);
    assert.strictEqual(h.labels.length, 1);
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

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {TimelineGeometry} from '../nico-src/TimelineGeometry.ts';

const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const {loadClass, createContext} = require('../../../test/helpers/extractSource.js');

type Measurement = {left: number; width: number; localWidth: number; duration: number};

// VM extraction is needed because the legacy class belongs to a concatenated bundle.
// Real DOM events/range values are used; only layout and time are deterministic fixtures.
function harness(options: Partial<Measurement> = {}) {
  const measurement = {left: 120, width: 600, localWidth: 300, duration: 200, ...options};
  const dom = new JSDOM('<div class="seekBar"><input type="range" min="0" max="200" step="any"><span></span></div>');
  const seek = dom.window.document.querySelector('.seekBar')!;
  const range = seek.querySelector('input')!;
  const child = seek.querySelector('span')!;
  Object.defineProperty(seek, 'offsetWidth', {get: () => measurement.localWidth});
  seek.getBoundingClientRect = () => ({
    left: measurement.left, width: measurement.width, right: measurement.left + measurement.width,
    x: measurement.left, y: 0, top: 0, bottom: 10, height: 10, toJSON() {}
  });
  const previews: Array<[number, number]> = [];
  const comments: Array<[number, number]> = [];
  const commands: Array<[unknown, string, number]> = [];
  const storyboard: Array<[number, boolean]> = [];
  let commentTime = -1;
  let now = 0;
  let timerId = 0;
  const timers = new Map<number, {due: number; callback: () => void}>();
  const context = createContext({
    Emitter: class {},
    global: {innerWidth: 1000},
    window: {
      innerWidth: 1920,
      setTimeout(callback: () => void, delay: number) {
        const id = ++timerId;
        timers.set(id, {due: now + delay, callback});
        return id;
      },
      clearTimeout(id: number) { timers.delete(id); }
    },
    util: {dispatchCommand: (target: unknown, command: string, seconds: number) =>
      commands.push([target, command, seconds])}
  });
  const Bar = loadClass('src/VideoControlBar.js', 'VideoControlBar', context);
  const bar = Object.create(Bar.prototype);
  const classes = new Set<string>();
  Object.assign(bar, {
    _duration: measurement.duration, _seekBar: seek, _seekRange: range,
    _$seekBarContainer: [seek],
    state: {isDragging: false, isWheelSeeking: true},
    classList: {add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name)},
    _bindDragEvent() {}, _unbindDragEvent() {},
    _seekBarToolTip: {update: (seconds: number, localX: number) => previews.push([seconds, localX])},
    _commentPreview: {
      set currentTime(seconds: number) { commentTime = seconds; },
      update(localX: number) { comments.push([commentTime, localX]); }
    },
    storyboard: {setCurrentTime: (seconds: number, force: boolean) => storyboard.push([seconds, force])}
  });
  seek.addEventListener('mousemove', (event: MouseEvent) => bar._onSeekBarMouseMove(event));
  seek.addEventListener('mousedown', (event: MouseEvent) => bar._onSeekBarMouseDown(event));
  range.addEventListener('input', (event: Event) => bar._onSeekRangeInput(event));
  function hover(clientX: number, offsetX = 3, target = child) {
    const event = new dom.window.MouseEvent('mousemove', {bubbles: true, clientX});
    Object.defineProperty(event, 'offsetX', {value: offsetX});
    target.dispatchEvent(event);
  }
  function input(value: number) {
    range.value = String(value);
    range.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
  }
  function down(button = 0) {
    range.dispatchEvent(new dom.window.MouseEvent('mousedown', {bubbles: true, button}));
  }
  function tick(ms: number) {
    now += ms;
    for (const [id, timer] of timers) {
      if (timer.due <= now) { timers.delete(id); timer.callback(); }
    }
  }
  return {bar, context, measurement, dom, seek, range, child, previews, comments,
    commands, storyboard, classes, timers, hover, input, down, tick};
}

test('hover uses client coordinates on an offset, 2x-scaled track', () => {
  const h = harness();
  h.hover(270);
  assert.deepEqual(h.previews, [[50, 75]]);
  assert.deepEqual(h.comments, [[50, 75]]);
  assert.equal(h.bar._seekBarMouseX, 75);
  assert.deepEqual(h.commands, []);
});

test('child-target offsetX cannot change the hovered scene', () => {
  const h = harness();
  h.hover(270, 2, h.child);
  h.hover(270, 150, h.seek);
  assert.deepEqual(h.previews, [[50, 75], [50, 75]]);
});

test('hover clamps before, on and after both track endpoints', () => {
  const h = harness();
  for (const x of [0, 120, 720, 900]) { h.hover(x, 99); }
  assert.deepEqual(h.previews, [[0, 0], [0, 0], [200, 300], [200, 300]]);
});

test('local position helpers retain local-pixel meaning on a transformed track', () => {
  const h = harness();
  assert.equal(h.bar._posToTime(150), 100);
  assert.equal(h.bar._timeToPos(100), 150);
});

test('subsecond duration is not rounded up to one second', () => {
  const h = harness({duration: 0.4});
  assert.equal(h.bar._timeToPos(0.2), 150);
  assert.equal(h.bar._timeToPer(0.2), 50);
});

test('hover remeasures after narrow-player and fullscreen changes', () => {
  const h = harness();
  h.hover(270);
  Object.assign(h.measurement, {left: 40, width: 150, localWidth: 300});
  h.hover(115);
  Object.assign(h.measurement, {left: 0, width: 1920, localWidth: 1920});
  h.hover(1900.8);
  assert.deepEqual(h.previews.slice(0, 2), [[50, 75], [100, 150]]);
  assert.equal(h.previews[2]![0], 198);
  assert.equal(h.previews[2]![1], 1900.8);
});

test('invalid client coordinates do not produce preview updates or seeks', () => {
  const h = harness();
  for (const clientX of [NaN, Infinity, -Infinity]) {
    h.bar._onSeekBarMouseMove({clientX, offsetX: 50, stopPropagation() {}});
  }
  assert.deepEqual(h.previews, []);
  assert.deepEqual(h.comments, []);
  assert.deepEqual(h.commands, []);
});

test('invalid duration or unmeasurable timeline suppresses positional previews', () => {
  for (const options of [
    {duration: 0}, {duration: -1}, {duration: NaN}, {duration: Infinity},
    {width: 0}, {width: NaN}, {localWidth: 0}, {localWidth: Infinity}
  ]) {
    const h = harness(options);
    h.hover(270);
    assert.deepEqual(h.previews, [], JSON.stringify(options));
    assert.deepEqual(h.comments, [], JSON.stringify(options));
  }
});

test('native input keeps its value as the seek time and uses a local preview anchor', () => {
  const h = harness();
  h.input(50);
  assert.deepEqual(h.commands, [[h.range, 'seek', 50]]);
  assert.deepEqual(h.previews, [[50, 75]]);
  assert.deepEqual(h.storyboard, [[50, true]]);
});

test('valid native input still seeks when geometry is temporarily hidden', () => {
  const h = harness({width: 0, localWidth: 0});
  h.input(50);
  assert.deepEqual(h.commands, [[h.range, 'seek', 50]]);
  assert.deepEqual(h.storyboard, [[50, true]]);
  assert.deepEqual(h.previews, []);
});

test('malformed native input cannot emit a NaN or infinite seek', () => {
  const h = harness();
  for (const target of [
    {value: 'NaN', max: '200'}, {value: 'Infinity', max: '200'},
    {value: '50', max: '0'}, {value: '50', max: 'Infinity'}
  ]) { h.bar._onSeekRangeInput({target}); }
  assert.deepEqual(h.commands, []);
  assert.deepEqual(h.storyboard, []);
  assert.deepEqual(h.previews, []);
});

test('wheel preview uses timeline width independently of the viewport', () => {
  const h = harness();
  h.bar._onWheelSeek(150);
  assert.deepEqual(h.previews, [[150, 225]]);
  assert.deepEqual(h.comments, [[150, 225]]);
  assert.deepEqual(h.storyboard, [[150, true]]);
  assert.deepEqual(h.commands, []);
});

test('wheel preview clamps finite time and rejects nonfinite time', () => {
  const h = harness();
  for (const seconds of [-10, 250, NaN, Infinity]) { h.bar._onWheelSeek(seconds); }
  assert.deepEqual(h.previews, [[0, 0], [200, 300]]);
  assert.deepEqual(h.storyboard, [[0, true], [200, true]]);
});

test('pin freezes hover time and anchor; wheel and native input still seek independently', () => {
  const h = harness();
  h.bar._sceneSearchPinnedTime = () => 12;
  h.bar._seekBarMouseX = 120;
  h.hover(700, 900);
  assert.deepEqual(h.previews, [[12, 120]]);
  h.bar._onWheelSeek(150);
  h.input(50);
  assert.deepEqual(h.previews, [[12, 120], [12, 225], [12, 75]]);
  assert.deepEqual(h.commands, [[h.range, 'seek', 50]]);
  assert.deepEqual(h.storyboard, [[150, true], [50, true]]);
});

test('drag ownership and 200ms hold retain native input and cancellation', () => {
  const h = harness();
  h.down();
  h.hover(270);
  assert.equal(h.bar.state.isDragging, true);
  assert.deepEqual(h.commands, []);
  h.tick(199);
  assert.equal(h.classes.has('is-storyboardLongPress'), false);
  h.input(50);
  assert.deepEqual(h.commands, [[h.range, 'seek', 50]]);
  h.tick(1);
  assert.equal(h.classes.has('is-storyboardLongPress'), true);
  h.bar._onWindowBlur();
  assert.equal(h.classes.has('is-storyboardLongPress'), false);
  assert.equal(h.bar.state.isDragging, false);
  assert.equal(h.timers.size, 0);
});

test('a secondary-button press does not arm the storyboard hold', () => {
  const h = harness();
  h.down(2);
  h.tick(500);
  assert.equal(h.classes.has('is-storyboardLongPress'), false);
  assert.equal(h.timers.size, 0);
});

test('the time marker follows its timeline and remeasures after resize', () => {
  const context = createContext({
    global: {innerWidth: 1000}, throttle: {raf: (fn: () => void) => fn},
    document: {hidden: false}
  });
  const Pointer = loadClass('src/VideoControlBar.js', 'SmoothSeekBarPointer', context);
  const element = {style: {transform: ''}, classList: {toggle() {}}};
  const measurement = {clientLeft: 120, clientWidth: 600, localWidth: 300};
  const pointer = new Pointer({
    pointer: element, playerState: {onkey() {}},
    getTimelineGeometry: () => TimelineGeometry.create(measurement)
  });
  pointer.duration = 200;
  pointer.currentTime = 50;
  assert.equal(element.style.transform, 'translateX(69px)');
  measurement.localWidth = 600;
  pointer.currentTime = 50;
  assert.equal(element.style.transform, 'translateX(144px)');
});


function playbackHarness(options: Partial<Measurement> = {}) {
  const h = harness(options);
  h.context.throttle = {raf: (fn: () => void) => fn};
  h.context.document = h.dom.window.document;
  h.context.util.secToTime = (seconds: number) => String(seconds);
  const Pointer = loadClass('src/VideoControlBar.js', 'SmoothSeekBarPointer', h.context);
  const marker = h.dom.window.document.createElement('span');
  h.seek.append(marker);
  const labels: string[] = [];
  const emitted: string[] = [];
  const pointer = new Pointer({
    pointer: marker, playerState: {onkey() {}},
    getTimelineGeometry: () => h.bar._getTimelineGeometry()
  });
  pointer.duration = h.measurement.duration;
  Object.assign(h.bar, {
    _pointer: pointer, _timerCount: 0, player: {currentTime: 50},
    _wheelSeeker: {}, durationLabel: {},
    currentTimeLabel: {set text(value: string) { labels.push(value); }},
    emit: (event: string) => emitted.push(event)
  });
  h.bar.state.isWheelSeeking = false;
  const playbackTick = () => {
    for (let frame = 0; frame < 6; frame++) { h.bar._onTimer(); }
  };
  return {...h, marker, labels, emitted, playbackTick};
}

test('the control timer repositions a paused marker after a width-only change', () => {
  const h = playbackHarness();
  h.playbackTick();
  assert.equal(h.marker.style.transform, 'translateX(69px)');
  Object.assign(h.measurement, {width: 1200, localWidth: 600});
  h.playbackTick();
  assert.equal(h.marker.style.transform, 'translateX(144px)');
  assert.deepEqual(h.labels, ['50']);
  assert.deepEqual(h.commands, []);
  assert.deepEqual(h.previews, []);
  assert.equal(h.bar.storyboard.currentTime, 50);
});

test('the control timer restores a paused marker when a hidden track becomes measurable', () => {
  const h = playbackHarness({width: 0, localWidth: 0});
  h.playbackTick();
  assert.equal(h.marker.style.transform, '');
  Object.assign(h.measurement, {width: 600, localWidth: 300});
  h.playbackTick();
  assert.equal(h.marker.style.transform, 'translateX(69px)');
  assert.deepEqual(h.labels, ['50']);
  assert.deepEqual(h.commands, []);
});

test('the control timer restores paused progress after a duration correction', () => {
  const h = playbackHarness();
  h.playbackTick();
  assert.equal(h.marker.style.transform, 'translateX(69px)');
  h.bar.duration = 400;
  h.playbackTick();
  assert.equal(h.marker.style.transform, 'translateX(31.5px)');
  assert.equal(h.range.max, '400');
  assert.deepEqual(h.emitted, ['durationChange']);
  assert.deepEqual(h.labels, ['50']);
  assert.deepEqual(h.commands, []);
});

test('legacy scene lookup and native hover resolve the same scene for nested targets', () => {
  const h = harness();
  const Adapter = loadClass('packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js',
    'SceneSearchLegacyAdapter', createContext());
  h.hover(270, 2);
  assert.equal(Adapter.seekTime(h.seek, {clientX: 270, offsetX: 2}, 200), 50);
  assert.equal(h.previews[0]![0], 50);
});

test('native keyboard/range values retain their full fractional precision', () => {
  const h = harness();
  h.input(0.123456789);
  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0]![2], 0.123456789);
});

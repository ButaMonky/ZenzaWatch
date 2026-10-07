'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function loadTouchWrapper(sourcePath = 'src/NicoVideoPlayer.js') {
  class Emitter {
    emit() {}
  }
  const context = createContext({Emitter});
  run(
    `${extract(sourcePath, 'TouchWrapper')}; globalThis.Subject = TouchWrapper;`,
    context
  );
  return context.Subject;
}

function makeSubject(TouchWrapper) {
  const subject = Object.create(TouchWrapper.prototype);
  const commands = [];
  let cancel2 = 0;
  let cancel3 = 0;

  subject._config = {
    props: {
      enable: true,
      tap2command: 'tap2',
      tap3command: 'tap3',
      tap4command: 'tap4',
      tap5command: 'tap5'
    }
  };
  subject._currentPointers = [];
  subject._maxCount = 0;
  subject._isMoved = false;
  subject._startCenter = null;
  subject._lastCenter = null;
  subject._execCommand = command => commands.push(command);
  subject._debouncedOnSwipe2Y = Object.assign(() => {}, {cancel: () => { cancel2 += 1; }});
  subject._debouncedOnSwipe3X = Object.assign(() => {}, {cancel: () => { cancel3 += 1; }});

  return {
    subject,
    commands,
    getCancelCounts: () => ({cancel2, cancel3})
  };
}

const touch = (identifier, x = identifier * 10, y = identifier * 10) => ({
  identifier,
  pageX: x,
  pageY: y
});

describe('Task257 touchcancel gesture reset', () => {
  it('resets gesture ownership when cancel removes the final pointer', () => {
    const TouchWrapper = loadTouchWrapper();
    const {subject, getCancelCounts} = makeSubject(TouchWrapper);
    subject._currentPointers = [touch(1), touch(2), touch(3)];
    subject._maxCount = 3;
    subject._isMoved = true;
    subject._startCenter = {x: 10, y: 10};
    subject._lastCenter = {x: 20, y: 20};

    subject._onTouchCancel({changedTouches: [touch(1), touch(2), touch(3)]});

    assert.strictEqual(subject.touchCount, 0);
    assert.strictEqual(subject._maxCount, 0);
    assert.strictEqual(subject._isMoved, false);
    assert.strictEqual(subject._startCenter, null);
    assert.strictEqual(subject._lastCenter, null);
    assert.deepStrictEqual(getCancelCounts(), {cancel2: 1, cancel3: 1});
  });

  it('preserves the active gesture on a partial cancel', () => {
    const TouchWrapper = loadTouchWrapper();
    const {subject, getCancelCounts} = makeSubject(TouchWrapper);
    subject._currentPointers = [touch(1), touch(2), touch(3)];
    subject._maxCount = 3;
    subject._isMoved = true;
    subject._startCenter = {x: 10, y: 10};
    subject._lastCenter = {x: 20, y: 20};

    subject._onTouchCancel({changedTouches: [touch(3)]});

    assert.strictEqual(subject.touchCount, 2);
    assert.strictEqual(subject._maxCount, 3);
    assert.strictEqual(subject._isMoved, true);
    assert.deepStrictEqual(subject._startCenter, {x: 10, y: 10});
    assert.deepStrictEqual(subject._lastCenter, {x: 20, y: 20});
    assert.deepStrictEqual(getCancelCounts(), {cancel2: 0, cancel3: 0});
  });

  it('does not reuse a canceled three-finger count for the next one-finger tap', () => {
    const TouchWrapper = loadTouchWrapper();
    const {subject, commands} = makeSubject(TouchWrapper);
    subject._currentPointers = [touch(1), touch(2), touch(3)];
    subject._maxCount = 3;

    subject._onTouchCancel({changedTouches: [touch(1), touch(2), touch(3)]});
    const one = touch(4);
    subject._onTouchStart({
      changedTouches: [one],
      touches: [one],
      preventDefault() {}
    });
    subject._onTouchEnd({changedTouches: [one]});

    assert.deepStrictEqual(commands, []);
    assert.strictEqual(subject._maxCount, 0);
  });

  it('keeps an ordinary three-finger tap working once', () => {
    const TouchWrapper = loadTouchWrapper();
    const {subject, commands} = makeSubject(TouchWrapper);
    const touches = [touch(1), touch(2), touch(3)];

    subject._onTouchStart({
      changedTouches: touches,
      touches,
      preventDefault() {}
    });
    subject._onTouchEnd({changedTouches: touches});

    assert.deepStrictEqual(commands, ['tap3']);
    assert.strictEqual(subject._maxCount, 0);
  });
});

describe('Task289 generated dist touchcancel parity', () => {
  it('preserves partial gestures and clears canceled counts before a new tap', () => {
    const TouchWrapper = loadTouchWrapper('dist/ZenzaWatch-dev.user.js');
    const {subject, commands, getCancelCounts} = makeSubject(TouchWrapper);
    subject._currentPointers = [touch(1), touch(2), touch(3)];
    subject._maxCount = 3;
    subject._isMoved = true;
    subject._startCenter = {x: 10, y: 10};
    subject._lastCenter = {x: 20, y: 20};

    subject._onTouchCancel({changedTouches: [touch(3)]});
    assert.strictEqual(subject.touchCount, 2);
    assert.strictEqual(subject._maxCount, 3);
    assert.deepStrictEqual(getCancelCounts(), {cancel2: 0, cancel3: 0});

    subject._onTouchCancel({changedTouches: [touch(1), touch(2)]});
    assert.strictEqual(subject.touchCount, 0);
    assert.strictEqual(subject._maxCount, 0);
    assert.strictEqual(subject._isMoved, false);
    assert.strictEqual(subject._startCenter, null);
    assert.strictEqual(subject._lastCenter, null);
    assert.deepStrictEqual(getCancelCounts(), {cancel2: 1, cancel3: 1});

    const next = touch(4);
    subject._onTouchStart({
      changedTouches: [next],
      touches: [next],
      preventDefault() {}
    });
    subject._onTouchEnd({changedTouches: [next]});
    assert.deepStrictEqual(commands, []);
    assert.strictEqual(subject._maxCount, 0);
  });
});

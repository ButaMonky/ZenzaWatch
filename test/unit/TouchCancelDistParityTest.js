'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function loadTouchWrapper(rel) {
  class Emitter {}
  const context = createContext({Emitter});
  run(`${extract(rel, 'TouchWrapper')}; globalThis.Subject = TouchWrapper;`, context);
  return context.Subject;
}

function verifyReset(rel) {
  const TouchWrapper = loadTouchWrapper(rel);
  const subject = Object.create(TouchWrapper.prototype);
  let cancel2 = 0;
  let cancel3 = 0;
  subject._currentPointers = [{identifier: 1}, {identifier: 2}, {identifier: 3}];
  subject._maxCount = 3;
  subject._isMoved = true;
  subject._startCenter = {x: 10, y: 10};
  subject._lastCenter = {x: 20, y: 20};
  subject._debouncedOnSwipe2Y = {cancel() { cancel2 += 1; }};
  subject._debouncedOnSwipe3X = {cancel() { cancel3 += 1; }};

  subject._onTouchCancel({changedTouches: [{identifier: 1}, {identifier: 2}, {identifier: 3}]});

  assert.strictEqual(subject.touchCount, 0);
  assert.strictEqual(subject._maxCount, 0);
  assert.strictEqual(subject._isMoved, false);
  assert.strictEqual(subject._startCenter, null);
  assert.strictEqual(subject._lastCenter, null);
  assert.strictEqual(cancel2, 1);
  assert.strictEqual(cancel3, 1);
}

describe('Task260 touchcancel source/dist parity', () => {
  it('resets canceled gesture state in source', () => {
    verifyReset('src/NicoVideoPlayer.js');
  });

  it('resets canceled gesture state in generated dev dist', () => {
    verifyReset('dist/ZenzaWatch-dev.user.js');
  });
});

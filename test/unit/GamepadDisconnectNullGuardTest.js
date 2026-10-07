'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeSubject({activeGamepad = null, configuredIndex = 0, sourcePath = 'src/_gamepad.js'} = {}) {
  const emitted = [];
  const context = createContext({
    Config: {
      get(name) {
        if (name === 'deviceIndex') { return configuredIndex; }
        return undefined;
      }
    },
    ZenzaGamePad: {
      emit(...args) { emitted.push(args); }
    },
    activeGamepad,
    detectGamepad() {},
    console: {log() {}}
  });

  run(
    `globalThis.__subject = ${extract(sourcePath, 'onGamepadConnectStatusChange', 'var')};`,
    context
  );

  return {subject: context.__subject, context, emitted};
}

describe('Task245 gamepad disconnect null guard', () => {
  it('ignores a disconnect event when no active gamepad model exists', () => {
    const {subject, context, emitted} = makeSubject({configuredIndex: 1});

    assert.doesNotThrow(() => {
      subject({gamepad: {index: 1, id: 'pad-1'}}, false);
    });

    assert.deepStrictEqual(emitted, []);
    assert.strictEqual(context.activeGamepad, null);
  });

  it('still emits and releases the active configured gamepad exactly once', () => {
    let releaseCount = 0;
    const activeGamepad = {
      getDeviceIndex() { return 1; },
      release() { releaseCount++; }
    };
    const {subject, context, emitted} = makeSubject({activeGamepad, configuredIndex: 1});

    subject({gamepad: {index: 1, id: 'pad-1'}}, false);

    assert.deepStrictEqual(emitted, [['onDeviceDisconnect', 1]]);
    assert.strictEqual(releaseCount, 1);
    assert.strictEqual(context.activeGamepad, null);
  });

  it('leaves the active model alone for a disconnect event from another index', () => {
    let releaseCount = 0;
    const activeGamepad = {
      getDeviceIndex() { return 1; },
      release() { releaseCount++; }
    };
    const {subject, context, emitted} = makeSubject({activeGamepad, configuredIndex: 1});

    subject({gamepad: {index: 2, id: 'pad-2'}}, false);

    assert.deepStrictEqual(emitted, []);
    assert.strictEqual(releaseCount, 0);
    assert.strictEqual(context.activeGamepad, activeGamepad);
  });
});

describe('Task290 generated dist gamepad disconnect parity', () => {
  it('guards missing models and releases only the configured connected model', () => {
    const distPath = 'dist/ZenzaGamePad.user.js';
    const absent = makeSubject({configuredIndex: 1, sourcePath: distPath});
    assert.doesNotThrow(() => {
      absent.subject({gamepad: {index: 1, id: 'pad-1'}}, false);
    });
    assert.deepStrictEqual(absent.emitted, []);
    assert.strictEqual(absent.context.activeGamepad, null);

    let releaseCount = 0;
    const activeGamepad = {
      getDeviceIndex() { return 1; },
      release() { releaseCount++; }
    };
    const active = makeSubject({activeGamepad, configuredIndex: 1, sourcePath: distPath});
    active.subject({gamepad: {index: 2, id: 'pad-2'}}, false);
    assert.strictEqual(releaseCount, 0);
    assert.deepStrictEqual(active.emitted, []);
    assert.strictEqual(active.context.activeGamepad, activeGamepad);

    active.subject({gamepad: {index: 1, id: 'pad-1'}}, false);
    assert.strictEqual(releaseCount, 1);
    assert.deepStrictEqual(active.emitted, [['onDeviceDisconnect', 1]]);
    assert.strictEqual(active.context.activeGamepad, null);
  });
});

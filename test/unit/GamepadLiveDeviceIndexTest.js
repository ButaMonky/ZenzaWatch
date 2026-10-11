'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeSubject(artifact) {
  let selectedIndex = 0;
  let gamepads = [];
  const events = [];
  const intervals = [];
  const models = [];
  class GamePadModel {
    constructor(pad) {
      this.pad = pad;
      this.isConnected = true;
      this.releases = 0;
      this.updates = 0;
      models.push(this);
    }
    on() {}
    getDeviceIndex() { return this.pad.index; }
    getDeviceId() { return this.pad.id; }
    update() { this.updates++; }
    release() { this.releases++; }
  }
  const context = createContext({
    Config: {get: key => key === 'deviceIndex' ? selectedIndex :
      key === 'enabled' ? true : false},
    padIndex: 0,
    activeGamepad: null,
    navigator: {getGamepads: () => gamepads},
    document: {hasFocus: () => true},
    pollingTimer: {changeInterval: n => intervals.push(n)},
    GamePadModel,
    ZenzaGamePad: {emit: (...args) => events.push(args)},
    console: {log() {}}
  });
  for (const [name, exposed] of [['detectGamepad', 'detectGamepad'],
    ['onTimerInterval', 'tick'], ['onGamepadConnectStatusChange', 'onStatus']]) {
    run('globalThis.' + exposed + ' = (' + extract(artifact, name, 'var') + ');', context);
  }
  return {
    context, events, intervals, models,
    select: value => { selectedIndex = value; },
    pads: value => { gamepads = value; },
    makePad: index => ({index, connected: true, id: 'pad-' + index}),
    detect: () => context.detectGamepad(),
    tick: () => context.tick(),
    status: (...args) => context.onStatus(...args),
    get active() { return context.activeGamepad; }
  };
}

for (const artifact of ['src/_gamepad.js', 'dist/ZenzaGamePad.user.js']) {
  describe('Task364 AUD-18 runtime gamepad selection: ' + artifact, () => {
    it('uses the latest selected index on each detection', () => {
      const h = makeSubject(artifact);
      h.pads([h.makePad(0), h.makePad(1)]);
      h.select(1);
      h.detect();
      assert.strictEqual(h.active?.getDeviceIndex(), 1);
      assert.deepStrictEqual(h.events, [['onDeviceConnect', 1, 'pad-1']]);
    });
    it('releases the old selected pad and activates the new one on poll', () => {
      const h = makeSubject(artifact);
      h.pads([h.makePad(0), h.makePad(1)]);
      h.detect();
      assert.strictEqual(h.active.getDeviceIndex(), 0);
      h.select(1);
      h.tick();
      assert.strictEqual(h.models[0].releases, 1);
      assert.strictEqual(h.active?.getDeviceIndex(), 1);
      assert.deepStrictEqual(h.events, [
        ['onDeviceConnect', 0, 'pad-0'], ['onDeviceDisconnect', 0],
        ['onDeviceConnect', 1, 'pad-1']]);
      h.tick();
      assert.strictEqual(h.models[0].updates, 0);
      assert.strictEqual(h.models[1].updates, 1);
    });
    it('drops stale selection and later picks a newly attached pad', () => {
      const h = makeSubject(artifact);
      h.pads([h.makePad(0)]);
      h.detect();
      h.select(2);
      h.tick();
      assert.strictEqual(h.active, null);
      assert.strictEqual(h.models[0].releases, 1);
      h.pads([h.makePad(0), null, h.makePad(2)]);
      h.tick();
      assert.strictEqual(h.active?.getDeviceIndex(), 2);
    });
    it('never disconnects a different active device on a stale event', () => {
      const h = makeSubject(artifact);
      h.pads([h.makePad(0)]);
      h.detect();
      h.select(1);
      h.status({gamepad: h.makePad(1)}, false);
      assert.strictEqual(h.active?.getDeviceIndex(), 0);
      assert.strictEqual(h.models[0].releases, 0);
      assert.deepStrictEqual(h.events, [['onDeviceConnect', 0, 'pad-0']]);
    });
    it('does not reconnect or emit disconnect for unchanged selection', () => {
      const h = makeSubject(artifact);
      h.pads([h.makePad(0), h.makePad(1)]);
      h.detect();
      h.tick();
      h.tick();
      assert.strictEqual(h.active?.getDeviceIndex(), 0);
      assert.strictEqual(h.models.length, 1);
      assert.strictEqual(h.models[0].releases, 0);
      assert.strictEqual(h.models[0].updates, 2);
      assert.deepStrictEqual(h.events, [['onDeviceConnect', 0, 'pad-0']]);
    });
  });
}

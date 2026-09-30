import assert from 'power-assert';
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function subject(type, target = 20) {
  const c = createContext();
  run(beginSection('packages/lib/src/Emitter.js'), c);
  const Scripter = loadClass('packages/zenza/src/commentLayer/NicoScripter.js', 'NicoScripter', c);
  const script = new Scripter();
  script._marker.destination = target;
  script._eventScript.push({p: {id: 1, type, params: {time: type === 'SEEK' ? target : 'destination'}},
    nicos: {vpos: 1000, duration: 3}});
  const commands = [];
  script.on('command', (...args) => commands.push(args));
  return {script, commands};
}

describe('NicoScripter finite seek boundaries (ZW-079)', function() {
  for (const type of ['SEEK', 'SEEK_MARKER']) {
    for (const [time, expected] of [[10, 20], [10.25, 19.75], [11, 19], [12, 19], [13, 19]]) {
      it(`${type} at ${time}s emits finite target ${expected}`, function() {
        const s = subject(type);
        s.script.currentTime = time;
        assert.equal(s.commands.length, 1);
        assert.equal(s.commands[0][0], 'nicosSeek');
        assert.ok(Number.isFinite(s.commands[0][1]));
        assert.equal(s.commands[0][1], expected);
      });
    }
    for (const time of [9.99, 13.01]) {
      it(`${type} outside interval at ${time}s does not seek`, function() {
        const s = subject(type);
        s.script.currentTime = time;
        assert.equal(s.commands.length, 0);
      });
    }
    for (const time of [10, 10.25, 13]) {
      it(`${type} clamps negative destination at ${time}s to zero`, function() {
        const s = subject(type, -2);
        s.script.currentTime = time;
        assert.deepEqual(s.commands, [['nicosSeek', 0]]);
      });
    }
    it(`${type} fires once in view and rearms after leaving`, function() {
      const s = subject(type);
      for (const time of [10.25, 11, 13]) s.script.currentTime = time;
      assert.equal(s.commands.length, 1);
      s.script.currentTime = 13.01;
      s.script.currentTime = 10;
      assert.deepEqual(s.commands, [['nicosSeek', 19.75], ['nicosSeek', 20]]);
    });
  }
});

import assert from 'power-assert';
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

// Rendering groups and chat decoding are fixtures; lifecycle, parser and emitter are actual source.
function subject() {
  const quiet = {log() {}, info() {}, time() {}, timeEnd() {}, timeLog() {}};
  const c = createContext({console: quiet, MAX_COMMENT: 1000,
    _: {isObject: value => value !== null && typeof value === 'object', size: value => Object.keys(value).length},
    NicoChat: {TYPE: {TOP: 'top', NAKA: 'naka', BOTTOM: 'bottom'}, SIZE: {SMALL: 'small'},
      create: chat => Object.assign({date: 1, fork: 1, type: 'naka', isNicoScript: true,
        hasDurationSet: true, duration: 3}, chat)}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  loadClass('packages/zenza/src/commentLayer/NicoScripter.js', 'NicoScriptParser', c);
  const Scripter = loadClass('packages/zenza/src/commentLayer/NicoScripter.js', 'NicoScripter', c);
  const Comment = loadClass('packages/zenza/src/commentLayer/NicoComment.js', 'NicoComment', c);
  const model = Object.create(Comment.prototype);
  model.nicoScripter = new Scripter();
  model.nicoScripter.on('command', (...args) => model.emit('command', ...args));
  for (const key of ['topGroup', 'nakaGroup', 'bottomGroup']) {
    model[key] = {nonFilteredMembers: [], reset() { this.nonFilteredMembers = []; },
      addChatArray(chats) { this.nonFilteredMembers.push(...chats); }};
  }
  const commands = [];
  model.on('command', (...args) => commands.push(args));
  return {model, script: model.nicoScripter, commands};
}
const chat = (text, vpos = 1000) => ({text, vpos});
const oldChats = () => [chat('@ジャンプ #0:20'), chat('@ジャンプマーカー:old', 2000), chat('@ジャンプ sm123')];
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('NicoComment clear resets NicoScript lifecycle (ZW-081)', function() {
  it('clear suppresses an already queued nextVideo command', async function() {
    const s = subject();
    await s.model.setChats([chat('@ジャンプ sm123')]);
    s.model.clear();
    await flush();
    assert.equal(s.commands.length, 0);
  });
  it('clear followed by new scripts with the same nextVideo emits only the new command', async function() {
    const s = subject();
    await s.model.setChats([chat('@ジャンプ sm123')]);
    s.model.clear();
    await s.model.setChats([chat('@ジャンプ sm123')]);
    assert.equal(s.commands.length, 0, 'nextVideo remains asynchronous');
    await flush();
    assert.deepEqual(s.commands, [['nextVideo', 'sm123']]);
  });
  it('non-append setChats invalidates a queued command from the previous scripts', async function() {
    const s = subject();
    await s.model.setChats([chat('@ジャンプ sm123')]);
    await s.model.setChats([chat('@ジャンプ sm456')]);
    await flush();
    assert.deepEqual(s.commands, [['nextVideo', 'sm456']]);
  });
  it('clear then later playback does not emit an old seek', async function() {
    const s = subject();
    await s.model.setChats([chat('@ジャンプ #0:20')]);
    s.model.clear();
    s.model.currentTime = 10.25;
    assert.equal(s.commands.length, 0);
    assert.equal(s.model.topGroup.currentTime, 10.25);
  });
  it('clear removes next video, markers, event scripts, in-view state and source scripts before notifying', async function() {
    const s = subject();
    await s.model.setChats(oldChats());
    await flush();
    assert.equal(s.script.getNextVideo(), 'sm123');
    assert.equal(s.script._marker.old, 20);
    s.model.currentTime = 10.25;
    assert.equal(Object.keys(s.script._inviewEvents).length, 1);
    let clears = 0;
    s.model.on('clear', () => {
      clears++;
      assert.equal(s.script.getNextVideo(), '');
      assert.equal(s.script.getEventScript().length, 0);
      assert.equal(s.script.isEmpty, true);
      assert.equal(Object.keys(s.script._marker).length, 0);
      assert.equal(Object.keys(s.script._inviewEvents).length, 0);
      for (const key of ['topGroup', 'nakaGroup', 'bottomGroup']) assert.equal(s.model[key].nonFilteredMembers.length, 0);
    });
    s.model.clear();
    s.model.clear();
    assert.equal(clears, 2);
  });
  it('new setChats after clear still parses scripts and forwards their commands', async function() {
    const s = subject();
    await s.model.setChats(oldChats());
    await flush();
    s.model.clear();
    s.commands.length = 0;
    await s.model.setChats([chat('@ジャンプ #fresh'), chat('@ジャンプマーカー:fresh', 3000), chat('@ジャンプ sm456')]);
    await flush();
    assert.deepEqual(s.commands, [['nextVideo', 'sm456']]);
    s.model.currentTime = 10.25;
    assert.deepEqual(s.commands, [['nextVideo', 'sm456'], ['nicosSeek', 29.75]]);
    assert.equal(s.script._marker.old, undefined);
    assert.equal(s.script.getEventScript().length, 1);
  });
});

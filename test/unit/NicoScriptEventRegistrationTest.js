import assert from 'assert';
import {NicoChat} from '../../packages/zenza/src/commentLayer/NicoChat';
const {beginSection, createContext, run} = require('../helpers/extractSource');
function subject() {
  assert.strictEqual(typeof NicoChat.identity, 'function', 'ZW073 identity prerequisite');
  const c = createContext({console: {log() {}, error() {}}, textUtil: {}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/commentLayer/NicoScripter.js') + '\nglobalThis.scripter = new NicoScripter();', c);
  const commands = []; c.scripter.on('command', (...args) => commands.push(args));
  return {s: c.scripter, commands};
}
function chat(no, text, fork = 1) {
  const result = NicoChat.create({thread: 1, fork, no, text, vpos: 100});
  result.duration = 5;
  return result;
}
describe('ZW080 stable script event registration', () => {
  it('registers repeated apply and identical cloned append only once', () => {
    const {s, commands} = subject();
    s.add(chat(1, '@ジャンプ #0:10')); s.apply([]); s.apply([]);
    s.add(chat(1, '@ジャンプ #0:10')); s.apply([]);
    assert.strictEqual(s.getEventScript().length, 1);
    s.currentTime = 1; assert.deepStrictEqual(commands, [['nicosSeek', 10]]);
  });
  it('retains distinct instruction positions including identical PIPE commands', () => {
    const {s, commands} = subject();
    s.add(chat(1, '/seek(vpos:10);/seek(vpos:20);/seek(vpos:10)'));
    s.apply([]); s.apply([]); assert.strictEqual(s.getEventScript().length, 3);
    s.currentTime = 1; assert.deepStrictEqual(commands, [['nicosSeek', 10], ['nicosSeek', 20], ['nicosSeek', 10]]);
  });
  it('retains identical content from different stable comment identities', () => {
    const {s, commands} = subject();
    s.add(chat(1, '@ジャンプ #0:10')); s.add(chat(10001, '@ジャンプ #0:10'));
    s.apply([]); s.apply([]); assert.strictEqual(s.getEventScript().length, 2);
    s.currentTime = 1; assert.deepStrictEqual(commands, [['nicosSeek', 10], ['nicosSeek', 10]]);
  });
  it('does not rearm an active event on apply but retains leave-and-reenter behavior', () => {
    const {s, commands} = subject(); s.add(chat(1, '@ジャンプ #0:10')); s.apply([]);
    s.currentTime = 1; s.apply([]); s.currentTime = 2;
    assert.deepStrictEqual(commands, [['nicosSeek', 10]]);
    s.currentTime = 7; s.currentTime = 1;
    assert.deepStrictEqual(commands, [['nicosSeek', 10], ['nicosSeek', 10]]);
  });
  it('clears registration and active state when resetting for a new video', () => {
    const {s, commands} = subject(); s.add(chat(1, '@ジャンプ #0:10')); s.apply([]); s.currentTime = 1;
    s.reset(); assert.strictEqual(s.getEventScript().length, 0);
    s.add(chat(1, '@ジャンプ #0:10')); s.apply([]); s.currentTime = 1;
    assert.deepStrictEqual(commands, [['nicosSeek', 10], ['nicosSeek', 10]]);
  });
  it('deduplicates SEEK_MARKER registration while resolving its marker normally', () => {
    const {s, commands} = subject();
    s.add(chat(1, '@ジャンプマーカー:loop')); s.add(chat(2, '@ジャンプ #loop')); s.apply([]); s.apply([]);
    assert.strictEqual(s.getEventScript().length, 1); s.currentTime = 1;
    assert.deepStrictEqual(commands, [['nicosSeek', 1]]);
  });
  it('continues applying non-event PIPE effects to appended chats', () => {
    const {s} = subject(); s.add(chat(1, '/commentColor=0x112233;/seek(vpos:10)'));
    const first = chat(10, 'first', 0), appended = chat(11, 'second', 0);
    s.apply([first]); s.apply([appended]);
    assert.strictEqual(first.color, '#112233'); assert.strictEqual(appended.color, '#112233');
    assert.strictEqual(s.getEventScript().length, 1);
  });
});

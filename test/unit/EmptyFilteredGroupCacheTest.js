const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function context() {
  const logger = {log() {}, time() {}, timeEnd() {}};
  const c = createContext({console: logger, _: {compact: xs => xs.filter(Boolean), debounce: fn => fn},
    Config: {getValue: () => false}, textUtil: {escapeRegs: s => s}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js'), c);
  run(`function chat(no, text = 'clean', userId = 'user-' + no, fork = 0) {
    return {no, text, userId, fork, threadId: 1, threadLabel: 'default', type: 'naka', score: 0, cmd: ''};
  }`, c);
  return c;
}

function subject() {
  const c = context();
  run(beginSection('packages/zenza/src/commentLayer/NicoChatGroup.js'), c);
  run(`globalThis.filter = new NicoChatFilter({wordFilter: 'blocked'});
    globalThis.calls = 0;
    const apply = filter.applyFilter.bind(filter);
    filter.applyFilter = chats => { globalThis.calls++; return apply(chats); };
    globalThis.group = new NicoChatGroup('naka', {nicoChatFilter: filter});
    globalThis.events = [];
    ['change', 'addChat', 'addChatArray'].forEach(name => group.on(name, () => events.push(name)));`, c);
  return c;
}
function readTwice(c, expected) {
  const before = c.calls;
  const a = c.group.members, b = c.group.members;
  assert.strictEqual(a, b, 'cached array reused, including empty arrays');
  assert.deepStrictEqual(Array.from(a, x => x.no), expected);
  assert.strictEqual(c.calls - before, 1, 'one full recomputation per dirty state');
}
describe('ZW-076 filtered group cache', () => {
  it('caches zero comments and all-NG, some-NG and no-NG results', () => {
    const empty = subject(); readTwice(empty, []);
    const all = subject(); run("group.addChatArray([chat(1, 'blocked'), chat(2, 'blocked')]);", all); readTwice(all, []);
    const some = subject(); run("group.addChatArray([chat(1, 'blocked'), chat(2)]);", some); readTwice(some, [2]);
    const none = subject(); run('group.addChatArray([chat(1), chat(2)]);', none); readTwice(none, [1, 2]);
  });
  it('does not validate a partial cache when adding before a post-filter-change read', () => {
    const c = subject(); run("group.addChatArray([chat(1, 'blocked'), chat(2)]);", c);
    assert.deepStrictEqual(Array.from(c.group.members, x => x.no), [2]);
    run("filter.wordFilterList = ''; group.addChat(chat(3));", c);
    readTwice(c, [1, 2, 3]);
    run("filter.wordFilterList = 'blocked'; group.addChatArray([chat(4), chat(5, 'blocked')]);", c);
    readTwice(c, [2, 3, 4]);
  });
  it('invalidates full results after array and single additions', () => {
    const c = subject(); readTwice(c, []);
    run('group.addChat(chat(1));', c); readTwice(c, [1]);
    run("group.addChatArray([chat(2), chat(3, 'blocked')]);", c); readTwice(c, [1, 2]);
    assert.deepStrictEqual(Array.from(c.events), ['addChat', 'addChatArray']);
  });
  it('invalidates hidden and visible removals, while preserving change notifications', () => {
    const c = subject(); run("group.addChatArray([chat(1), chat(2, 'blocked')]);", c); readTwice(c, [1]);
    run("events.length = 0; group.removeChat(chat(2, 'blocked'));", c); readTwice(c, [1]);
    assert.deepStrictEqual(Array.from(c.events), []);
    run('group.removeChat(chat(1));', c); readTwice(c, []);
    assert.deepStrictEqual(Array.from(c.events), ['change']);
    const before = c.calls;
    run('group.removeChat(chat(99));', c);
    assert.strictEqual(c.group.members.length, 0); assert.strictEqual(c.calls, before);
  });
  it('does not remove twice when the empty cache shares the members array', () => {
    const c = subject(); readTwice(c, []);
    run('group.addChat(chat(1)); group.addChat(chat(1));', c);
    run('events.length = 0; group.removeChat(chat(1));', c);
    assert.strictEqual(c.group.nonFilteredMembers.length, 1, 'only one matching member removed');
    readTwice(c, [1]);
    assert.deepStrictEqual(Array.from(c.events), ['change']);
  });
  it('invalidates reset without adding notifications', () => {
    const c = subject(); run('group.addChat(chat(1));', c); readTwice(c, [1]);
    run('events.length = 0; group.reset();', c); readTwice(c, []);
    assert.deepStrictEqual(Array.from(c.events), []);
  });
  it('recomputes matched-user relationships after removal of a hidden trigger', () => {
    const c = subject();
    run("filter.removeNgMatchedUser = true; group.addChatArray([chat(1, 'blocked', 'same'), chat(2, 'clean', 'same')]);", c);
    readTwice(c, []);
    run("events.length = 0; group.removeChat(chat(1, 'blocked', 'same'));", c);
    readTwice(c, [2]);
    // Matched-user membership changes now notify the whole group.
    assert.deepStrictEqual(Array.from(c.events), ['change']);
  });
});

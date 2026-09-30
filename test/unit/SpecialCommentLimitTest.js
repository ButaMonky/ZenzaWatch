import assert from 'power-assert';
const {beginSection, createContext, run} = require('../helpers/extractSource');

// Run the real parsers and setChats selection; groups only collect output.
function subject() {
  const quiet = {log() {}, info() {}, time() {}, timeEnd() {}, timeLog() {}};
  const context = createContext({console: quiet, _: require('lodash')});
  run(beginSection('packages/lib/src/Emitter.js'), context);
  run(beginSection('packages/zenza/src/commentLayer/CommentLayer.js'), context);
  const NicoChat = run(beginSection('packages/zenza/src/commentLayer/NicoChat.js') + ';NicoChat;', context);
  const NicoComment = run(beginSection('packages/zenza/src/commentLayer/NicoComment.js') + ';NicoComment;', context);
  const model = Object.create(NicoComment.prototype);
  for (const name of ['top', 'naka', 'bottom']) {
    model[name + 'Group'] = {
      nonFilteredMembers: [],
      reset() { this.nonFilteredMembers = []; },
      addChatArray(chats) { this.nonFilteredMembers.push(...chats); }
    };
  }
  model.nicoScripter = {reset() {}, isEmpty: true};
  model.emit = () => {};
  return {NicoChat, NicoComment, model};
}

function rows(count, cmd, thread = 10, fork = 0, prefix = 'chat') {
  return Array.from({length: count}, (_, i) => ({
    text: prefix + '-' + i, cmd, thread, fork, no: i + 1,
    date: 1700000000 + i, vpos: 100, user_id: 'user'
  }));
}

async function selected(h, data, duration = 120) {
  await h.model.setChats(data, {duration, mainThreadId: 10});
  const chats = ['top', 'naka', 'bottom'].reduce((all, name) =>
    all.concat(h.model[name + 'Group'].nonFilteredMembers), []);
  assert(chats.every(chat => chat instanceof h.NicoChat));
  return chats.map(chat => chat.text);
}

describe('Special comment limits (ZW-072)', function() {
  // One real duration budget is sufficient to catch the reversed selection.
  for (const cmd of ['patissier', 'ca']) {
    for (const count of [0, 1, 249, 250, 251]) {
      it(`${cmd}: keeps first min(${count}, 250) in each thread bucket`, async function() {
        const h = subject();
        const main = rows(count, cmd, 10, 0, 'main');
        const sub = rows(count, cmd, 20, 0, 'sub');
        const actual = await selected(h, main.concat(sub));
        assert.deepEqual(actual.filter(text => text.startsWith('main-')), main.slice(0, 250).map(chat => chat.text));
        assert.deepEqual(actual.filter(text => text.startsWith('sub-')), sub.slice(0, 250).map(chat => chat.text));
        assert.strictEqual(actual.length, Math.min(count, 250) * 2);
      });
    }
  }

  it('main and sub each have a shared patissier/CA budget and keep input order', async function() {
    const h = subject();
    const main = rows(251, '', 10, 0, 'main');
    const sub = rows(251, '', 20, 0, 'sub');
    for (const group of [main, sub]) {
      group.forEach((chat, i) => { chat.cmd = i % 2 ? 'ca' : 'patissier'; });
    }
    const input = main.reduce((all, chat, i) => all.concat(chat, sub[i]), []);
    const actual = await selected(h, input);
    assert.deepEqual(actual.filter(text => text.startsWith('main-')), main.slice(0, 250).map(chat => chat.text));
    assert.deepEqual(actual.filter(text => text.startsWith('sub-')), sub.slice(0, 250).map(chat => chat.text));
    assert.strictEqual(actual.length, 500);
  });

  for (const [cmd, fork] of [['', 0], ['patissier', 1], ['ca', 1]]) {
    it(`does not cap ${cmd || 'ordinary'} fork ${fork} at any boundary`, async function() {
      const h = subject();
      for (const count of [0, 1, 249, 250, 251]) {
        const data = rows(count, cmd, 10, fork, 'main').concat(rows(count, cmd, 20, fork, 'sub'));
        assert.deepEqual(await selected(h, data), data.map(chat => chat.text), `count ${count}`);
      }
    });
  }

  for (const cmd of ['patissier', 'ca']) {
    it(`fork 2 ${cmd} remains subject to the special limit`, async function() {
      const h = subject();
      const data = rows(251, cmd, 10, 2);
      assert.deepEqual(await selected(h, data), data.slice(0, 250).map(chat => chat.text));
    });
  }

  it('normal and owner comments survive alongside both capped special buckets', async function() {
    const h = subject();
    const main = rows(251, 'patissier', 10, 0, 'main');
    const sub = rows(251, 'ca', 20, 0, 'sub');
    const other = rows(251, '', 10, 0, 'ordinary').concat(
      rows(251, 'patissier', 10, 1, 'owner-p'), rows(251, 'ca', 20, 1, 'owner-ca'));
    const actual = await selected(h, main.concat(sub, other));
    assert.strictEqual(actual.length, 500 + other.length);
    assert.deepEqual(actual.filter(text => !text.startsWith('main-') && !text.startsWith('sub-')),
      other.map(chat => chat.text));
  });

  it('exposes parsed CA as a boolean without classifying ordinary comments as CA', function() {
    const {NicoChat} = subject();
    assert.strictEqual(NicoChat.create({cmd: 'ca'}).isCA, true);
    assert.strictEqual(NicoChat.create({cmd: 'patissier'}).isCA, false);
    assert.strictEqual(NicoChat.create({cmd: ''}).isCA, false);
    assert.strictEqual(new NicoChat({}, {format: 'bulk'}).isCA, false);
  });
});

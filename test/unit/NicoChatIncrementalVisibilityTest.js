'use strict';
const assert = require('assert');
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function subject(file, options={}) {
  const logger = {log() {}, error() {}, time() {}, timeEnd() {}};
  const c = createContext({console: logger,
    Config: {getValue: () => false},
    _: {compact: a => a.filter(Boolean), debounce: fn => fn},
    textUtil: {escapeRegs: s => s}});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/commentLayer/NicoChatFilter.js'), c);
  if (file === 'src') {
    run(beginSection('packages/zenza/src/commentLayer/NicoChatGroup.js'), c);
  } else {
    loadClass('dist/ZenzaWatch-dev.user.js', 'NicoChatGroup', c);
    run('globalThis.NicoChatGroup = globalThis.__subject;', c);
  }
  run(`globalThis.make = opts => {
    const filter = new NicoChatFilter(opts);
    const group = new NicoChatGroup('naka', {nicoChatFilter: filter});
    const additions = [], changes = [];
    group.on('addChat', chat => additions.push(chat));
    group.on('change', evt => changes.push(evt));
    return {filter, group, additions, changes};
  }`, c);
  return c.make(options);
}

const chat = (no, extra={}) => ({
  no, type: 'naka', threadId: 'thread', fork: 0, threadLabel: 'default',
  score: 0, text: 'visible', cmd: '', userId: 'user-' + no, ...extra
});
const threads = [
  ['default','defaultThread'],['owner','ownerThread'],
  ['community','communityThread'],['nicos','nicosThread'],
  ['easy','easyThread'],['ai','aiThread'],
  ['extra-default','extraDefaultThread'],['extra-owner','extraOwnerThread'],
  ['extra-community','extraCommunityThread'],['extra-nicos','extraNicosThread'],
  ['extra-easy','extraEasyThread']
];

describe('Task320 AUD-05 single-comment visibility matches batch filtering', () => {
  for (const file of ['src','dist']) {
    it(file + ' suppresses hidden fork additions for all four forks', () => {
      for (let fork=0;fork<4;fork++) {
        const h=subject(file,{['fork'+fork]:false}), item=chat(fork,{fork});
        assert.strictEqual(h.filter.applyFilter([item]).length,0);
        h.group.addChat(item);
        assert.deepStrictEqual(Array.from(h.additions),[], 'fork '+fork+' must not reach addChat');
        assert.strictEqual(h.group.members.length,0);
        assert.strictEqual(h.group.nonFilteredMembers.length,1);
      }
    });

    it(file + ' suppresses hidden thread-label additions for all eleven labels', () => {
      for (const [label,flag] of threads) {
        const h=subject(file,{[flag]:false}),item=chat(1,{threadLabel:label});
        assert.strictEqual(h.filter.applyFilter([item]).length,0);
        h.group.addChat(item);
        assert.deepStrictEqual(Array.from(h.additions),[],label+' must not reach addChat');
        assert.strictEqual(h.group.members.length,0);
        assert.strictEqual(h.group.nonFilteredMembers.length,1);
      }
    });
    it(file + ' still emits visible comments and respects word NG', () => {
      const h=subject(file,{wordFilter:'blocked'});
      const accepted=chat(1),rejected=chat(2,{text:'blocked'});
      h.group.addChat(accepted);
      h.group.addChat(rejected);
      assert.deepStrictEqual(Array.from(h.additions),[accepted]);
      assert.deepStrictEqual(Array.from(h.group.members,x=>x.no),[1]);
      assert.strictEqual(h.group.nonFilteredMembers.length,2);
    });

    it(file + ' honors fork restrictions even with master NG disabled', () => {
      const h=subject(file,{enableFilter:false,fork1:false});
      const excluded=chat(1,{fork:1}),normal=chat(2);
      h.group.addChat(excluded); h.group.addChat(normal);
      assert.deepStrictEqual(Array.from(h.additions),[normal]);
      assert.deepStrictEqual(Array.from(h.group.members,x=>x.no),[2]);
    });
    it(file + ' preserves full-group change handling for matched-user NG', () => {
      const h=subject(file,{removeNgMatchedUser:true,wordFilter:'blocked'});
      h.group.addChat(chat(1,{text:'blocked',userId:'same'}));
      h.group.addChat(chat(2,{userId:'same'}));
      assert.strictEqual(h.additions.length,0);
      assert.strictEqual(h.changes.length,2);
      assert.strictEqual(h.group.members.length,0);
    });
  }
});

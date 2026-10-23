'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');
function model(path = 'packages/zenza/src/commentLayer/NicoComment.js') {
  const quiet = {log() {}, info() {}, time() {}, timeEnd() {}, timeLog() {}};
  const c = createContext({
    Emitter: class {emit() {}}, console: quiet, MAX_COMMENT: 1000,
    _: {isObject: value => value !== null && typeof value === 'object',
      size: value => Object.keys(value).length},
    NicoChat: {TYPE: {TOP: 'top', NAKA: 'naka', BOTTOM: 'bottom'},
      SIZE: {SMALL: 'small'}, create: input => Object.assign({
        date: 1, fork: 0, type: 'naka', isDeleted: false,
        isNicoScript: false, isCA: false, isPatissier: false
      }, input)}
  });
  const Comment = loadClass(path, 'NicoComment', c);
  const subject = Object.create(Comment.prototype);
  subject.nicoScripter = {isEmpty: true, reset() {}};
  for (const name of ['topGroup', 'nakaGroup', 'bottomGroup']) {
    subject[name] = {nonFilteredMembers: [], reset() {this.nonFilteredMembers = [];},
      addChatArray(items) {this.nonFilteredMembers.push(...items);}};
  }
  return subject;
}

describe('Issue #29 comment timestamp normalization', () => {
  it('never produces NaN when one or several comments share one posting date', async () => {
    for (const count of [1, 3]) {
      const m = model();
      await m.setChats(Array.from({length: count},
        (_, i) => ({date: 1700000000, text: String(i)})));
      assert.strictEqual(m.nakaGroup.nonFilteredMembers.length, count);
      for (const item of m.nakaGroup.nonFilteredMembers) {
        assert.strictEqual(item.time3d, 0);
        assert.strictEqual(item.time3dp, 0);
      }
    }
  });
  it('keeps the fractional normal case and empty input unchanged', async () => {
    const m = model();
    await m.setChats([]);
    assert.strictEqual(m.nakaGroup.nonFilteredMembers.length, 0);
    await m.setChats([100, 150, 200].map((date, i) => ({date, text: String(i)})));
    assert.deepStrictEqual(m.nakaGroup.nonFilteredMembers.map(x => x.time3dp), [0, 0.5, 1]);
  });
});

describe('Issue #29 compiled ZenzaWatch-dev parity', () => {
  it('does not divide by zero in the generated userscript', async () => {
    const m = model('dist/ZenzaWatch-dev.user.js');
    await m.setChats([{date: 1700000000, text: 'only comment'}]);
    assert.strictEqual(m.nakaGroup.nonFilteredMembers[0].time3dp, 0);
  });
});

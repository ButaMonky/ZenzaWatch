// Task184 (Watch V4 audit F08): quality candidates are ordered with a signed comparator
// (highest first), ties keep the server order, the input is not mutated, and the
// existing "first available candidate" selection keeps working. Synthetic data only.
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

const ctx = () => createContext({JSONable: class {}});
const Domand = raw => new (loadClass('src/VideoInfo.js', 'DomandInfo', ctx()))(raw, {id: 'so9'});
const Dmc = raw => new (loadClass('src/VideoInfo.js', 'DmcInfo', ctx()))({movie: {session: {urls: []}, ...raw}});
const levels = list => Array.from(list, x => x.qualityLevel);

describe('Task184 quality candidate order (Watch V4 audit F08)', () => {
  it('sorts video and audio levels [1,3,2] descending', () => {
    const d = Domand({videos: [1, 3, 2].map(q => ({id: 'v' + q, qualityLevel: q, isAvailable: true})),
      audios: [1, 3, 2].map(q => ({id: 'a' + q, qualityLevel: q, isAvailable: true}))});
    assert.deepStrictEqual(levels(d.videos), [3, 2, 1]);
    assert.deepStrictEqual(levels(d.audios), [3, 2, 1]);
  });

  it('keeps the server order for equal levels and does not mutate the input', () => {
    const raw = {videos: [{id: 'x', qualityLevel: 2}, {id: 'y', qualityLevel: 5}, {id: 'z', qualityLevel: 2}], audios: []};
    const before = JSON.stringify(raw);
    assert.deepStrictEqual(Array.from(Domand(raw).videos, v => v.id), ['y', 'x', 'z']);
    assert.strictEqual(JSON.stringify(raw), before);
  });

  it('missing / non-numeric levels go last; empty lists stay empty', () => {
    const d = Domand({videos: [{id: 'n'}, {id: 'a', qualityLevel: 1}, {id: 's', qualityLevel: 'x'}, {id: 'b', qualityLevel: 4}], audios: []});
    assert.deepStrictEqual(Array.from(d.videos, v => v.id), ['b', 'a', 'n', 's']);
    assert.deepStrictEqual(Array.from(Domand({videos: [], audios: []}).videos), []);
  });

  it('available candidates are the best available ones first (auto selection uses [0])', () => {
    const d = Domand({videos: [{id: 'v1', qualityLevel: 1, isAvailable: true}, {id: 'v4', qualityLevel: 4, isAvailable: false}, {id: 'v3', qualityLevel: 3, isAvailable: true}],
      audios: [{id: 'a1', qualityLevel: 1, isAvailable: true}, {id: 'a2', qualityLevel: 2, isAvailable: true}]});
    assert.deepStrictEqual(Array.from(d.availableVideoIds), ['v3', 'v1']);
    assert.strictEqual(d.availableAudioIds[0], 'a2');
  });

  it('the legacy dmc order uses the same signed comparator', () => {
    const d = Dmc({videos: [1, 3, 2].map(l => ({id: 'v' + l, isAvailable: true, metadata: {levelIndex: l}})),
      audios: [0, 2, 1].map(l => ({id: 'a' + l, isAvailable: true, metadata: {levelIndex: l}}))});
    assert.deepStrictEqual(Array.from(d.videos, v => v.id), ['v3', 'v2', 'v1']);
    assert.deepStrictEqual(Array.from(d.audios, v => v.id), ['a2', 'a1', 'a0']);
  });
});

// Task476 NICOCOMPAT-04: validate storyboard metadata before fetching images.
// This test uses a VM and entirely synthetic fetches; no external URLs are requested.
'use strict';
const assert = require('assert');
const {extract, run, createContext} = require('../helpers/extractSource');

const okDomand = () => ({
  thumbnailWidth: 160, thumbnailHeight: 90, rows: 2, columns: 3,
  interval: 10000, version: '1', quality: 1,
  images: [{url: 'one.jpg'}, {url: 'two.jpg'}]
});
const okDmc = () => ({
  version: 1, storyboards: [{
    thumbnail_width: 160, thumbnail_height: 90,
    rows: 2, columns: 3, interval: 10000, quality: 10,
    images: [{timestamp: 0, uri: 'https://example.invalid/a.jpg'},
      {timestamp: 60000, uri: 'https://example.invalid/b.jpg'}]
  }]
});
function harness(metadataPayload = {meta: {status: 200}, data: okDmc()}) {
  const imageFetches = [], metadataFetches = [];
  const ctx = createContext({
    fetch: async (url, opts) => {
      imageFetches.push({url: String(url), opts});
      return {ok: true, arrayBuffer: async () => new ArrayBuffer(16)};
    },
    URL, ArrayBuffer
  });
  run('const makeFactory=' +
    extract('packages/lib/src/nico/VideoSessionWorker.js',
      'createStoryboardClasses', 'var') +
    ';globalThis.__factory=makeFactory;', ctx);
  const util = {fetch: async url => {
    metadataFetches.push(String(url));
    return {json: async () => metadataPayload};
  }};
  const classes = ctx.__factory(util);
  const domand = (value = okDomand(), duration = 120) => {
    const loader = new classes.DomandStoryboardInfoLoader({
      url: 'https://example.invalid/video/storyboard.json'
    });
    loader._rawData = value;
    loader.duration = duration;
    return loader;
  };
  const dmc = (value = okDmc(), duration = 120) => {
    const loader = new classes.DmcStoryboardInfoLoader({
      url: 'https://example.invalid/video/storyboard.json'
    });
    loader._rawData = value;
    loader.duration = duration;
    return loader;
  };
  return {classes, domand, dmc, ctx, imageFetches, metadataFetches};
}
const schema = error => error && error.kind === 'schema' &&
  error.errorCode === 'STORYBOARD_SCHEMA';
const failsSchema = fn => assert.throws(fn, schema);

describe('Task476 storyboard pre-download schema contract', () => {
  it('keeps valid domand URL normalization, count and image downloading', async () => {
    const h = harness();
    const data = h.domand().getStoryboardWithUrls();
    assert.equal(data.count, 12);
    assert.deepStrictEqual(Array.from(data.images, x => x.url),
      ['https://example.invalid/video/one.jpg',
        'https://example.invalid/video/two.jpg']);
    const info = await h.domand().getInfo();
    assert.equal(info.format, 'domand');
    assert.equal(info.storyboard.images.length, 2);
    assert.equal(h.imageFetches.length, 2);
    assert.equal(h.imageFetches[0].opts.credentials, 'omit');
  });
  it('keeps valid DMC storyboard conversion', () => {
    const h = harness();
    const data = h.dmc().getStoryboardWithUrls();
    assert.equal(data.count, 12);
    assert.equal(data.thumbnail.width, 160);
    assert.equal(data.images[1].url, 'https://example.invalid/b.jpg');
    assert.equal(h.imageFetches.length, 0);
  });
  it('rejects missing/malformed domand payload before any download', async () => {
    for (const payload of [null, {}, {...okDomand(), images: null},
      {...okDomand(), images: [{url: null}]},
      {...okDomand(), images: [{url: ''}]},
      {...okDomand(), interval: 0},
      {...okDomand(), interval: -1},
      {...okDomand(), thumbnailWidth: null},
      {...okDomand(), rows: 0}]) {
      const h = harness();
      await assert.rejects(h.domand(payload).getInfo(), schema);
      assert.equal(h.imageFetches.length, 0, 'fail before any image transfer');
    }
  });
  it('rejects malicious image protocols and URL credentials', async () => {
    for (const url of [
      'javascript:alert(1)', 'data:image/png;base64,AAAA',
      'file:///C:/windows/win.ini', 'https://user:pass@example.invalid/x.jpg'
    ]) {
      const h = harness();
      await assert.rejects(h.classes.StoryboardInfoLoader.fetchImages([{url}]), schema);
      assert.equal(h.imageFetches.length, 0);
    }
  });
  it('rejects unbounded image lists before scheduling Promise.all', async () => {
    const h = harness();
    const huge = {...okDomand(),
      images: Array.from({length: 513}, (_, i) => ({url: String(i) + '.jpg'}))};
    await assert.rejects(h.domand(huge).getInfo(), schema);
    assert.equal(h.imageFetches.length, 0);
  });
  it('rejects invalid DMC response structure with a typed schema failure', () => {
    for (const value of [
      {version: 1, storyboards: null}, {version: 1, storyboards: [null]},
      {version: 1, storyboards: [{images: null}]},
      {version: 1, storyboards: [{images: [{uri: null}]}]}
    ]) {
      const h = harness();
      failsSchema(() => h.dmc(value).getStoryboardWithUrls());
      assert.equal(h.imageFetches.length, 0);
    }
  });
  it('rejects malformed DMC API envelopes without raw TypeErrors', async () => {
    for (const payload of [
      null, {}, {meta: null, data: okDmc()},
      {meta: {status: '200'}, data: okDmc()},
      {meta: {status: 200}, data: null}
    ]) {
      const h = harness(payload);
      const loader = new h.classes.DmcStoryboardInfoLoader({
        url: 'https://example.invalid/dmc/storyboard.json'
      });
      await assert.rejects(loader.load(), schema);
      assert.equal(h.metadataFetches.length, 1);
      assert.equal(h.imageFetches.length, 0);
    }
  });
  it('rejects a storyboard count exceeding available sprite cells', () => {
    const h = harness();
    const limited = {...okDomand(), images: [{url: 'one.jpg'}]};
    failsSchema(() => h.domand(limited).getStoryboardWithUrls());
    assert.equal(h.imageFetches.length, 0);
  });
  it('accepts protocol-relative DMC images without credentials', async () => {
    const h = harness(), value = okDmc();
    value.storyboards[0].images[0].uri = '//example.invalid/a.jpg';
    const result = await h.dmc(value).getInfo();
    assert.equal(result.storyboard.images.length, 2);
    assert.equal(h.imageFetches[0].opts.credentials, 'omit');
  });
  it('preserves failed-image flag and does not retry any HTTP failure', async () => {
    const h = harness();
    h.ctx.fetch = async url => {
      h.imageFetches.push({url: String(url)});
      return {ok: false, status: 403};
    };
    const image = await h.classes.StoryboardInfoLoader.fetchImages([{
      url: 'https://example.invalid/fail.jpg'
    }]);
    assert.equal(image.length, 1);
    assert.equal(image[0].isFail, true);
    assert.equal(h.imageFetches.length, 1);
  });
  it('rejects direct malformed image-list requests without network', async () => {
    for (const images of [null, [], [null], [{url: 'ftp://host/a.jpg'}]]) {
      const h = harness();
      await assert.rejects(h.classes.StoryboardInfoLoader.fetchImages(images), schema);
      assert.equal(h.imageFetches.length, 0);
    }
  });
});

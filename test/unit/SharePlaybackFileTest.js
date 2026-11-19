const assert = require('assert');
const vm = require('vm');
const {beginSection} = require('../helpers/extractSource');

describe('current player MP4 source', () => {
  const origin = 'https://www.nicovideo.jp';
  const url = origin + '/example.mp4';
  const objectUrl = 'blob:' + origin + '/example';
  const box = (type, ...parts) => {
    const payload = Buffer.concat(parts);
    const header = Buffer.alloc(8);
    header.writeUInt32BE(payload.length + 8);
    header.write(type, 4, 'ascii');
    return Buffer.concat([header, payload]);
  };
  const file = (entry = 'avc1', extra = Buffer.alloc(0)) => {
    const stsd = box('stsd', Buffer.from([0,0,0,0,0,0,0,1]), box(entry, Buffer.alloc(78)));
    const trak = box('trak', box('mdia', box('minf', box('stbl', stsd))));
    return new Blob([box('ftyp', Buffer.from('isom\u0000\u0000\u0000\u0001')), box('mdat', Buffer.alloc(4)), box('moov', trak, extra)], {type:'video/mp4'});
  };
  const video = currentSrc => ({currentSrc, srcObject:null, mediaKeys:null});
  function setup(handler, controlled = false) {
    const calls = [];
    const scope = {
      Blob, URL, DataView, TextDecoder, location:{origin, href:origin + '/watch/sm9'},
      navigator:{serviceWorker:{controller:controlled ? {} : null}},
      fetch:async (path, options) => { calls.push({path, options}); return handler(path, options); }
    };
    const api = vm.runInNewContext(beginSection('src/SharePlaybackFile.js') + '\n;SharePlaybackFile', scope);
    return {api, calls};
  }
  const accepted = {isCurrent:() => true};
  const reply = (blob, status = 200) => new Response(blob, {status, headers:{'Content-Type':'video/mp4'}});
  it('uses a source Blob and a matching blob URL without a network URL', async () => {
    const blob = file();
    const {api, calls} = setup(() => reply(blob));
    assert.strictEqual(await api.get({...video(''), srcObject:blob}, blob, accepted), blob);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual((await api.get(video(objectUrl), objectUrl, accepted)).size, blob.size);
    assert.deepStrictEqual(calls.map(c => c.path), [objectUrl]);
  });
  it('accepts a full local HTTP cache hit and never retries a miss or partial response', async () => {
    for (const status of [200, 504, 206]) {
      let networkRequests = 0;
      const {api, calls} = setup((path, options) => {
        if (options.cache !== 'only-if-cached' || options.mode !== 'same-origin') networkRequests++;
        assert.strictEqual(options.redirect, 'error');
        return reply(file(), status);
      });
      assert.strictEqual(Boolean(await api.get(video(url), url, accepted)), status === 200);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(networkRequests, 0);
    }
  });
  it('never reads HLS, MSE backing an HLS player, cross-origin files, active service workers or DRM', async () => {
    const {api, calls} = setup(() => {throw new Error('unexpected fetch');});
    const hls = origin + '/stream.m3u8';
    for (const [el, assigned] of [[video(hls),hls], [video(objectUrl),hls], [video('https://example.org/v.mp4'),'https://example.org/v.mp4'], [{...video(url),mediaKeys:{}},url]]) {
      assert.strictEqual(await api.get(el, assigned, accepted), null);
    }
    const controller = setup(() => {throw new Error('unexpected network');}, true);
    assert.strictEqual(await controller.api.get(video(url), url, accepted), null);
    assert.strictEqual(controller.calls.length + calls.length, 0);
  });
  it('rejects encrypted sample entries, protection metadata, fragmented and incomplete files', async () => {
    const {api} = setup(() => {throw new Error('unexpected fetch');});
    for (const blob of [file('encv'),file('enca'),file('avc1',box('pssh')),file('avc1',box('mvex')),new Blob([box('moov')],{type:'video/mp4'})]) {
      assert.strictEqual(await api.get({...video(''),srcObject:blob}, blob, accepted), null);
    }
  });
  it('rechecks the session, original source and abort signal while loading', async () => {
    const controller = new AbortController();
    let current = false;
    const el = video(url);
    const {api, calls} = setup(() => {current = false;return reply(file());});
    const options = {signal:controller.signal,isCurrent:() => current};
    assert.strictEqual(await api.get(el, url, options), null);
    assert.strictEqual(calls.length, 0);
    current = true;
    assert.strictEqual(await api.get(el, url, options), null);
    assert.strictEqual(calls.length, 1);
    const swapped = setup(() => {el.currentSrc = url + '?new';return reply(file());});
    assert.strictEqual(await swapped.api.get(el, url, accepted), null);
    controller.abort(); current = true; el.currentSrc = url;
    assert.strictEqual(await api.get(el, url, options), null);
    assert.strictEqual(calls.length, 1);
  });
});

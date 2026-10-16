// Task494: background storyboard refresh errors must never expose signed CDN
// URLs, tokens or private response objects through console warnings.
// Synthetic VM fixtures only. No network or real browser actions.
'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const source = 'packages/lib/src/nico/VideoSessionWorker.js';
const SECRET = 'QA_SECRET_TOKEN_DO_NOT_LOG';
const PRIVATE_URL = 'https://cdn.example.invalid/storyboard.jpg?token=' + SECRET;

const ready = () => ({
  status: 'ok', watchId: 'sm9', format: 'domand', duration: 120,
  storyboard: {
    interval: 10000, count: 12, rows: 2, columns: 3,
    thumbnail: {width: 160, height: 90},
    images: [
      {url: 'https://example.invalid/1.jpg', buffer: new ArrayBuffer(8)},
      {url: 'https://example.invalid/2.jpg', buffer: new ArrayBuffer(8)}
    ]
  }
});
const head = () => ({
  status: 'ok', watchId: 'sm9', format: 'domand', duration: 120,
  storyboard: {
    interval: 10000, count: 12, rows: 2, columns: 3,
    thumbnail: {width: 160, height: 90},
    images: [{url: 'https://example.invalid/1.jpg'}]
  }
});
function harness({imageError, putError, imageResult = ready(), cached} = {}) {
  const warnings = [], calls = [], saved = [];
  const ctx = createContext({
    console: {warn: (...args) => warnings.push(args), log() {}, error() {}},
    StoryboardCacheDb: {
      async get() {return cached || null;},
      async delete() {},
      async put(key, value) { saved.push([key,value]); if (putError) throw putError; }
    },
    workerUtil: {createCrossMessageWorker: () => ({
      async post({command}) {
        calls.push(command);
        if (command === 'storyboard') return head();
        if (command === 'storyboardImages') {
          if (imageError) throw imageError;
          return imageResult;
        }
        throw new Error('unexpected mock command ' + command);
      }
    })},
    URL, setTimeout, clearTimeout
  });
  run('const createStoryboardClasses=' +
    extract(source,'createStoryboardClasses','var') + ';' +
    'const VideoSessionWorker=' + extract(source,'VideoSessionWorker','var') + ';' +
    'globalThis.__subject=VideoSessionWorker;',ctx);
  return {load: () => ctx.__subject.storyboard({
    type: 'domand', info: {toJSON: () => ({watchId:'sm9',duration:120})}
  }),warnings,calls,saved};
}
const settleBackground = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};
const warningText = warnings => warnings.map(args => args.map(arg =>
  typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')).join(' ');

describe('Task494 storyboard background failure log safety', () => {
  it('redacts rejected image worker errors even if they contain signed URLs', async () => {
    const error = Object.assign(new Error('image request failed: ' + PRIVATE_URL),
      {url: PRIVATE_URL, token: SECRET});
    const h = harness({imageError: error});
    const result = await h.load(); await settleBackground();
    assert.equal(result.status,'ok','original storyboard remains usable');
    assert.deepStrictEqual(h.calls,['storyboard','storyboardImages']);
    assert.equal(h.warnings.length,1);
    const output = warningText(h.warnings);
    assert(output.includes('storyboard image cache fail'),'keep a constant diagnosis');
    for (const forbidden of [SECRET,'cdn.example.invalid','token=',
      'image request failed', 'url']) {
      assert(!output.includes(forbidden),forbidden + ' should not be logged');
    }
  });
  it('redacts rejected optional IndexedDB write exceptions', async () => {
    const err = {message:'IndexedDB failure: '+PRIVATE_URL,secret:SECRET};
    const h = harness({putError:err});
    const result = await h.load(); await settleBackground();
    assert.equal(result.status,'ok');
    assert.equal(h.saved.length,1,'valid data was offered to optional cache');
    assert.equal(h.warnings.length,1);
    const output = warningText(h.warnings);
    assert(output.includes('storyboard image cache fail'));
    assert(!output.includes(SECRET) && !output.includes('cdn.example.invalid'));
  });
  it('retains normal asynchronous caching without warnings', async () => {
    const h = harness();
    const result = await h.load(); await settleBackground();
    assert.equal(result.status,'ok');
    assert.equal(h.saved.length,1);
    assert.equal(h.saved[0][0],'sm9_domand');
    assert.strictEqual(h.warnings.length,0);
    assert.deepStrictEqual(h.calls,['storyboard','storyboardImages']);
  });
  it('does not send a refresh when the existing cache is valid', async () => {
    const h = harness({cached:ready()});
    const result = await h.load(); await settleBackground();
    assert.equal(result.fromCache,true);
    assert.deepStrictEqual(h.calls,[]);
    assert.deepStrictEqual(h.warnings,[]);
    assert.deepStrictEqual(h.saved,[]);
  });
});

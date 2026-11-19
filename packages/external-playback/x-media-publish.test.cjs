'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createXMediaPublisher } = require('./x-media-publish.cjs');

const mediaId = '1880028106020515840';
const postId = '1880028106020515841';
const uploadPath = '/2/media/upload/' + mediaId;
const statusPath = '/2/media/upload?command=STATUS&media_id=' + mediaId;
const clip = new Blob(['clip'], {type: 'video/mp4'});
const ready = {status: 200, json: {data: {id: mediaId}}};
const appended = {status: 200, json: {}};
const created = {status: 201, json: {data: {id: postId}}};
const processing = (state, seconds) => ({
  status: 200, json: {data: {id: mediaId, processing_info: {state, check_after_secs: seconds}}}
});

// Only this scripted transport is used. Unexpected calls never fall through to a network API.
function session(responses, options) {
  const calls = [];
  const publisher = createXMediaPublisher(async (path, init) => {
    calls.push({path, ...init});
    const next = responses.shift();
    if (!next) throw Error('unexpected request: ' + path);
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  }, options);
  return {calls, publish: publisher.publish};
}

test('uploads every byte in order, observes server poll delays and creates one post with an exact string ID', async () => {
  const bytes = new Uint8Array(4 * 1024 * 1024 + 17);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const file = new Blob([bytes], {type: 'video/mp4'});
  const delays = [];
  const {publish, calls} = session([
    ready, appended, appended, processing('pending', 7),
    processing('in_progress', 3), processing('succeeded'), created
  ], {sleep: async ms => { delays.push(ms); }});
  const events = [];
  assert.deepEqual(await publish({file, text: '日本語 🎞️', onProgress: e => events.push(e)}),
    {id: postId, mediaId, url: 'https://x.com/i/status/' + postId});
  assert.deepEqual(calls.map(c => [c.method, c.path]), [
    ['POST', '/2/media/upload/initialize'], ['POST', uploadPath + '/append'],
    ['POST', uploadPath + '/append'], ['POST', uploadPath + '/finalize'],
    ['GET', statusPath], ['GET', statusPath], ['POST', '/2/tweets']
  ]);
  assert.deepEqual(JSON.parse(calls[0].body),
    {media_category: 'tweet_video', media_type: 'video/mp4', total_bytes: file.size});
  const chunks = calls.slice(1, 3).map(c => {
    assert.equal(c.headers['Content-Type'], 'application/json');
    return JSON.parse(c.body);
  });
  assert.deepEqual(chunks.map(c => c.segment_index), [0, 1]);
  assert.deepEqual(Buffer.concat(chunks.map(c => Buffer.from(c.media, 'base64'))), Buffer.from(bytes));
  assert.equal(calls[3].body, undefined);
  assert.equal(calls[4].body, undefined);
  assert.deepEqual(delays, [7000, 3000]);
  assert.deepEqual(JSON.parse(calls.at(-1).body), {text: '日本語 🎞️', media: {media_ids: [mediaId]}});
  assert.ok(events.some(e => e.stage === 'upload' && e.uploadedBytes > 0 && e.uploadedBytes < file.size));
  assert.equal(events.at(-1).stage, 'post');
});

test('a synchronous finalize can lead directly to a media-only post', async () => {
  const {publish, calls} = session([ready, appended, ready, created]);
  await publish({file: clip});
  assert.deepEqual(JSON.parse(calls.at(-1).body), {media: {media_ids: [mediaId]}});
});

test('guards media ID, async processing state, and incomplete finalize response', async () => {
  for (const [responses, code] of [
    [[{status: 200, json: {data: {id: '../tweets'}}}], 'INVALID_RESPONSE'],
    [[ready, appended, processing('failed')], 'PROCESSING_FAILED'],
    [[ready, appended, {status: 200, json: null}], 'INVALID_RESPONSE'],
    [[ready, appended, processing('pending', 2), ready], 'INVALID_RESPONSE'],
    [[ready, appended, processing('unrecognized')], 'INVALID_RESPONSE'],
    [[ready, {status: 200, json: {errors: [{title: 'Invalid segment'}]}}], 'API_ERROR']
  ]) {
    const {publish, calls} = session(responses, {sleep: async () => {}});
    await assert.rejects(publish({file: clip}), {code});
    assert.ok(!calls.find(c => c.path === '/2/tweets'));
  }
});

test('distinguishes rejected requests from unknown post outcomes and never resends', async () => {
  for (const [response, code] of [
    [{status: 402}, 'QUOTA'], [{status: 403}, 'ACCESS_DENIED'], [{status: 429}, 'RATE_LIMITED'],
    [{status: 429, json: {type: 'https://api.x.com/2/problems/usage-capped'}}, 'QUOTA'],
    [{status: 403, json: {detail: 'This user is not allowed to post a video longer than 20 minutes.'}}, 'DURATION_LIMIT'],
    [{status: 401}, 'AUTH_REQUIRED'], [{status: 400}, 'POST_REJECTED'], [{status: 422}, 'POST_REJECTED'],
    [Error('network'), 'POST_UNCERTAIN'], [{status: 503}, 'POST_UNCERTAIN'],
    [{status: 0}, 'POST_UNCERTAIN'], [{status: 201, json: {}}, 'POST_UNCERTAIN']
  ]) {
    const {publish, calls} = session([ready, appended, ready, response]);
    await assert.rejects(publish({file: clip}), {code});
    assert.equal(calls.filter(c => c.path === '/2/tweets').length, 1);
  }
});

test('duplicate invocation on a busy publisher cannot initialize or create a second post', async () => {
  let release;
  const {publish, calls} = session([() => new Promise(r => {release = r;}), appended, ready, created]);
  const pending = publish({file: clip});
  await assert.rejects(publish({file: clip}), {code: 'BUSY'});
  release(ready);
  await pending;
  assert.equal(calls.length, 4);
});

test('cancellation before dispatch, while processing, and after sending the post are distinct', async () => {
  const a = new AbortController();
  a.abort();
  const before = session([]);
  await assert.rejects(before.publish({file: clip, signal: a.signal}), {code: 'CANCELLED'});
  assert.equal(before.calls.length, 0);

  const b = new AbortController();
  const during = session([ready, appended, processing('pending', 600)]);
  await assert.rejects(during.publish({file: clip, signal: b.signal, onProgress: event => {
    if (event.stage === 'processing') queueMicrotask(() => b.abort());
  }}), {code: 'CANCELLED'});
  assert.equal(during.calls.length, 3);

  const c = new AbortController();
  const after = session([ready, appended, ready, () => { c.abort(); throw Error('aborted'); }]);
  await assert.rejects(after.publish({file: clip, signal: c.signal}), {code: 'POST_UNCERTAIN'});
  assert.equal(after.calls.at(-1).signal, c.signal);
});

test('empty, unsupported, and oversized files fail before contacting X', async () => {
  const {publish, calls} = session([]);
  const tooLarge = new Blob(['x'], {type: 'video/mp4'});
  Object.defineProperty(tooLarge, 'size', {value: 17179869185});
  for (const [file, code] of [[new Blob([]), 'INVALID_FILE'], [new Blob(['x'], {type:'video/webm'}), 'INVALID_FILE'],
    [tooLarge, 'TOO_LARGE']]) {
    await assert.rejects(publish({file}), {code});
  }
  assert.equal(calls.length, 0);
});

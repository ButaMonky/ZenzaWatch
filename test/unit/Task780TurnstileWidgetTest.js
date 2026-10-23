'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {beginSection, createContext, run} = require('../helpers/extractSource');

// Offline DOM harness for the real widget controller; no Cloudflare script is fetched.
function fixture(useApi = true) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><input id="draft"></body></html>',
    {url: 'https://www.nicovideo.jp/watch/sm9', pretendToBeVisual: true});
  const operations = {renders: [], removals: [], logs: []};
  if (useApi) {
    dom.window.turnstile = {
      render(element, options) {
        operations.renders.push({element, options});
        return 'task780-widget';
      },
      remove(id) {operations.removals.push(id);}
    };
  }
  const con = {log: (...values) => operations.logs.push(values),
    warn() {}, error() {}, info() {}, time() {}, timeEnd() {}};
  dom.window.console = con;
  const c = createContext({window: dom.window, document: dom.window.document,
    console: con, logSafe: {redact: value => value}, sleep: async () => {},
    PopupMessage: {alert() {}}, debug: {}});
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') +
    ';globalThis.instance=ThreadLoader;', c);
  const input = dom.window.document.getElementById('draft');
  input.focus();
  return {dom, c, loader: c.instance, operations, input,
    overlay: () => dom.window.document.querySelector('[data-zenza-comment-challenge="active"]')};
}
describe('Task780 official Turnstile widget lifecycle', function() {
  this.timeout(15000);
  it('creates an accessible modal and resolves only with the real callback token', async () => {
    const h = fixture();
    const pending = h.loader.getChallengeToken('public-example-sitekey');
    await new Promise(resolve => setImmediate(resolve));
    assert(h.overlay(), 'dialog rendered');
    assert.strictEqual(h.overlay().getAttribute('role'), 'dialog');
    assert.strictEqual(h.operations.renders.length, 1);
    assert.strictEqual(h.operations.renders[0].options.sitekey, 'public-example-sitekey');
    h.operations.renders[0].options.callback('SYNTHETIC-FROM-WIDGET');
    const token = await pending;
    assert.strictEqual(token, 'SYNTHETIC-FROM-WIDGET');
    assert.strictEqual(h.overlay(), null);
    assert.deepStrictEqual(h.operations.removals, ['task780-widget']);
    assert.strictEqual(h.dom.window.document.activeElement, h.input);
    assert(!JSON.stringify(h.operations.logs).includes(token), 'no logging');
    h.dom.window.close();
  });
  it('cancels with no token and removes the widget and modal', async () => {
    const h = fixture();
    const pending = h.loader.getChallengeToken('public-example-sitekey');
    await new Promise(resolve => setImmediate(resolve));
    h.overlay().querySelector('button').click();
    const error = await pending.then(() => null, err => err);
    assert.strictEqual(error.reason, 'challenge-cancelled');
    assert.strictEqual(error.outcome, 'not-sent');
    assert.deepStrictEqual(h.operations.removals, ['task780-widget']);
    assert.strictEqual(h.overlay(), null);
    h.dom.window.close();
  });
  it('does not send expired tokens and clears the modal', async () => {
    const h = fixture();
    const pending = h.loader.getChallengeToken('public-example-sitekey');
    await new Promise(resolve => setImmediate(resolve));
    h.operations.renders[0].options['expired-callback']();
    const error = await pending.then(() => null, err => err);
    assert.strictEqual(error.reason, 'challenge-expired');
    assert.strictEqual(error.outcome, 'not-sent');
    assert.strictEqual(h.overlay(), null);
    h.dom.window.close();
  });
  it('does not return blank tokens or tokens exceeding the Turnstile limit', async () => {
    for (const value of ['', 'X'.repeat(2049)]) {
      const h = fixture();
      const pending = h.loader.getChallengeToken('public-example-sitekey');
      await new Promise(resolve => setImmediate(resolve));
      h.operations.renders[0].options.callback(value);
      const error = await pending.then(() => null, err => err);
      assert.strictEqual(error.reason, 'challenge-unavailable');
      assert.strictEqual(h.overlay(), null);
      h.dom.window.close();
    }
  });
  it('fails closed on Cloudflare script loading error', async () => {
    const h = fixture(false);
    const pending = h.loader.getChallengeToken('public-example-sitekey');
    const script = h.dom.window.document.querySelector('script[data-zenza-comment-challenge="1"]');
    assert(script, 'official script added to DOM');
    assert.strictEqual(script.src,
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    script.dispatchEvent(new h.dom.window.Event('error'));
    const error = await pending.then(() => null, err => err);
    assert.strictEqual(error.reason, 'challenge-unavailable');
    assert.strictEqual(h.overlay(), null);
    h.dom.window.close();
  });
  it('rejects concurrent authentication instead of creating a second widget', async () => {
    const h = fixture();
    const first = h.loader.getChallengeToken('public-example-sitekey');
    const secondError = await h.loader.getChallengeToken('public-example-sitekey')
      .then(() => null, err => err);
    assert.strictEqual(secondError.reason, 'challenge-busy');
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.operations.renders.length, 1);
    h.overlay().querySelector('button').click();
    await first.catch(() => {});
    h.dom.window.close();
  });
  it('removes the widget even if a mock invokes the success callback synchronously', async () => {
    const h = fixture();
    h.dom.window.turnstile.render = (_element, options) => {
      options.callback('SYNC-WIDGET-TOKEN');
      return 'instant-widget';
    };
    const token = await h.loader.getChallengeToken('public-example-sitekey');
    assert.strictEqual(token, 'SYNC-WIDGET-TOKEN');
    assert.deepStrictEqual(h.operations.removals, ['instant-widget']);
    assert.strictEqual(h.overlay(), null);
    h.dom.window.close();
  });
});

describe('Task780 fullscreen authentication visibility', function() {
  this.timeout(15000);
  it('fails closed when the video element itself is fullscreen rather than presenting an invisible body dialog', async () => {
    const h = fixture();
    const video = h.dom.window.document.createElement('video');
    h.dom.window.document.body.appendChild(video);
    Object.defineProperty(h.dom.window.document, 'fullscreenElement', {value: video, configurable: true});
    const pending = h.loader.getChallengeToken('public-example-sitekey');
    // The guarded precheck may reject synchronously: attach the handler before yielding.
    const outcome = pending.then(() => null, e => e);
    await new Promise(resolve => setImmediate(resolve));
    const unexpectedDialog = h.overlay();
    if (unexpectedDialog) { unexpectedDialog.querySelector('button').click(); }
    const failure = await outcome;
    assert.strictEqual(failure.reason, 'challenge-unavailable');
    assert.strictEqual(failure.outcome, 'not-sent');
    assert.strictEqual(h.overlay(), null);
    assert.strictEqual(h.operations.renders.length, 0);
    h.dom.window.close();
  });
  it('places the widget inside the browser fullscreen container when fullscreen is not a video node', async () => {
    const h = fixture();
    const container = h.dom.window.document.createElement('section');
    h.dom.window.document.body.appendChild(container);
    Object.defineProperty(h.dom.window.document, 'fullscreenElement', {value: container, configurable: true});
    const pending = h.loader.getChallengeToken('public-example-sitekey');
    await new Promise(resolve => setImmediate(resolve));
    assert(container.contains(h.overlay()), 'widget must remain in fullscreen subtree');
    h.operations.renders[0].options.callback('FULLSCREEN-TEST-TOKEN');
    assert.strictEqual(await pending, 'FULLSCREEN-TEST-TOKEN');
    h.dom.window.close();
  });
});

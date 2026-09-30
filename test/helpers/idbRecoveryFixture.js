'use strict';
const assert = require('assert');
const {beginSection, extract, createContext, run} = require('./extractSource');
const quiet = {log() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
const ticks = async () => { for (let n = 0; n < 30; n++) { await Promise.resolve(); } };
function observe(promise) {
  const state = {status: 'pending'};
  Promise.resolve(promise).then(value => Object.assign(state, {status: 'resolved', value}),
    error => Object.assign(state, {status: 'rejected', error}));
  return state;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return {promise, resolve, reject};
}
function eventTarget() {
  const listeners = new Map();
  return {
    error: null,
    addEventListener(type, callback) {
      if (!listeners.has(type)) { listeners.set(type, new Set()); }
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.has(type) && listeners.get(type).delete(callback); },
    fire(type, detail = {}) {
      const e = Object.assign({target: this, preventDefault() {}, stopPropagation() {}}, detail);
      if (this['on' + type]) { this['on' + type](e); }
      if (listeners.has(type)) { [...listeners.get(type)].forEach(callback => callback(e)); }
    }
  };
}
function controllerFixture(overrides = {}) {
  const opens = [], lostExecutorErrors = [];
  // Capture only the async executor anti-pattern under test, without process-global
  // rejection handlers. Assertions still demand the actual outer API reject.
  class TestPromise extends Promise {
    static get [Symbol.species]() { return Promise; }
    constructor(executor) {
      super((resolve, reject) => {
        const ignored = executor(resolve, reject);
        if (ignored && typeof ignored.then === 'function') {
          ignored.catch(error => lostExecutorErrors.push(error));
        }
      });
    }
  }
  const context = createContext(Object.assign({
    console: quiet, performance: {now: () => 1}, Promise: TestPromise,
    indexedDB: {open(name, version) { const req = eventTarget(); opens.push({name, version, req}); return req; }},
    IDBKeyRange: {only: value => value, upperBound: value => value}
  }, overrides));
  run(`globalThis.controller = (${extract('packages/lib/src/infra/IndexedDbStorage.js', 'workerFunc', 'var')})(self);`, context);
  async function ready(db) {
    const pending = context.controller.init({name: 'fixture', ver: 2, stores: []});
    assert.strictEqual(opens.length, 1);
    opens[0].req.result = db;
    opens[0].req.fire('success');
    await pending;
    return context.controller;
  }
  return {context, controller: context.controller, opens, lostExecutorErrors, ready};
}
function gateFixture(db) {
  let handler;
  const posts = [];
  const port = {addEventListener(name, callback) { if (name === 'message') { handler = callback; } }};
  const window = {ZenzaLib: {IndexedDbStorage: db}, addEventListener() {}, console: quiet};
  const context = createContext({window, console: quiet, PRODUCT: 'Test',
    location: {host: 'www.nicovideo.jp'},
    gate: () => ({init: () => ({port, TOKEN: 'fixture-token', type: 'test', PID: 'fixture'}),
      post: (body, options) => posts.push({body, options})})});
  run(`${beginSection('packages/lib/src/nico/GateAPI.js')}; GateAPI.nicovideo();`, context);
  return {posts, send(params, sessionId = 'request-7') {
    return handler({data: {token: 'fixture-token', sessionId, body: {command: 'bridge-db', params}}});
  }};
}
function adapterFixture(name, cache, extra = {}) {
  const context = createContext(Object.assign({console: quiet, location: {host: 'www.nicovideo.jp'},
    IndexedDbStorage: {open: async () => ({cache})}}, extra));
  run(`${beginSection('packages/lib/src/nico/' + name + '.js')}; globalThis.adapter = ${name};`, context);
  return context.adapter;
}
module.exports = {assert, quiet, ticks, observe, deferred, eventTarget, controllerFixture,
  gateFixture, adapterFixture, beginSection, extract, createContext, run};

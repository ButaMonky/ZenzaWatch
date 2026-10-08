'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const ctx = createContext({});
const initSource = extract('packages/zenza/src/init/externalStartup.js', 'initializeExternalSite', 'var');
run('const initializeExternalSite = '+initSource+';globalThis.startExternal=initializeExternalSite;',ctx);
const startExternal = ctx.startExternal;

describe('Task311 cross-domain Google search bootstrap', () => {
  it('starts on Google even while the config bridge is stalled', async () => {
    let started = 0;
    const never = new Promise(() => {});
    startExternal({
      host: 'www.google.com', pathname: '/search',
      initializePlayer: () => { started++; },
      connect: () => never, readUser: () => {}
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(started, 1);
  });
  it('initializes once while a late Google bridge eventually succeeds', async () => {
    let finish;
    const gate = new Promise(resolve => { finish = resolve; });
    const events = [];
    const job = startExternal({
      host: 'www.google.co.jp', pathname: '/search',
      initializePlayer: () => { events.push('start'); },
      connect: () => gate, readUser: () => { events.push('user'); }
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepStrictEqual(events, ['start']);
    finish();
    await job;
    assert.deepStrictEqual(events, ['start', 'user']);
  });
  it('waits for bridge and user detection on other external sites', async () => {
    let finish;
    const gate = new Promise(resolve => { finish = resolve; });
    const events = [];
    const job = startExternal({
      host: 'www.bing.com', pathname: '/search',
      initializePlayer: () => { events.push('start'); },
      connect: () => gate, readUser: () => { events.push('user'); }
    });
    await Promise.resolve();
    assert.deepStrictEqual(events, []);
    finish();
    await job;
    assert.deepStrictEqual(events, ['user', 'start']);
  });
  it('continues after a Google bridge error without duplicate initialization', async () => {
    let started = 0;
    const errors = [];
    await startExternal({
      host: 'www.google.com', pathname: '/search',
      initializePlayer: () => { started++; },
      connect: () => Promise.reject(new Error('bridge blocked')),
      readUser: () => { throw new Error('should not run'); },
      onError: err => errors.push(err.message)
    });
    assert.strictEqual(started, 1);
    assert.deepStrictEqual(errors, ['bridge blocked']);
  });
  it('still initializes after a bridge error on other sites', async () => {
    let started = 0;
    await startExternal({
      host: 'www.bing.com', pathname: '/search',
      initializePlayer: () => { started++; },
      connect: () => Promise.reject(new Error('gate failure')),
      readUser: () => { throw new Error('should not run'); },
      onError: () => {}
    });
    assert.strictEqual(started, 1);
  });
});

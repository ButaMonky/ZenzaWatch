'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {loadClass, createContext} = require('../helpers/extractSource');

const SOURCE = 'packages/zenza/src/sceneSearch/SceneSearchPreferenceConnection.js';
const NAME = 'SceneSearchPreferenceConnection';
const SAVED_EVENT = 'ZenzaWatch-advanced-settings-saved';
const layout = 'sceneSearch.layout.normal';
const step = 'sceneSearch.seekStepSeconds';
const enabled = 'sceneSearch.enabled';
const defaults = {[layout]: '01', [step]: 5, [enabled]: true};
const DataStorage = loadClass('packages/lib/src/infra/DataStorage.js', 'DataStorage', createContext());
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function fixture() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'https://www.nicovideo.jp'});
  const window = dom.window;
  const storage = window.localStorage;
  const memory = {...defaults}, reads = [], writes = [], emissions = [], refreshed = [], errors = [], applying = [];
  let ownerDisposed = false, active = false;
  const config = {
    storage, default: {...defaults}, options: {}, _data: memory,
    getNativeKey: key => key,
    getStorageKey: key => 'connection_' + key,
    getValue: key => memory[key],
    setValue: (key, value) => { writes.push([key, value]); },
    refresh(key, snapshot) {
      reads.push(key);
      return DataStorage.prototype.refresh.call(config, key, snapshot);
    },
    emit(name, ...args) { emissions.push({name, args, active}); }
  };
  const Connection = loadClass(SOURCE, NAME, createContext());
  const connection = new Connection({
    window, config, keys: [layout, step, enabled],
    isDisposed: () => ownerDisposed,
    onApplying: value => { active = value; applying.push(value); },
    onRefresh: keys => refreshed.push(Array.from(keys)),
    onError: error => errors.push(error)
  });
  return {
    dom, window, storage, config, memory, reads, writes, emissions, refreshed, errors, applying, connection,
    saved(values) {
      for (const [key, value] of Object.entries(values)) storage[config.getStorageKey(key)] = JSON.stringify(value);
      this.notify(Object.keys(values));
    },
    notify(keys) { window.dispatchEvent(new window.CustomEvent(SAVED_EVENT, {detail: {keys}})); },
    storageEvent(key, area = storage) {
      window.dispatchEvent(new window.StorageEvent('storage', {key, storageArea: area, newValue: '"untrusted"'}));
    },
    disposeOwner() { ownerDisposed = true; },
    close() {
      try { connection.dispose(); } finally { dom.window.close(); }
    }
  };
}

describe('scene-search saved preference connection', () => {
  it('applies the saved batch atomically without echoing values into storage', async () => {
    const h = fixture();
    try {
      h.connection.connect();
      h.saved({[layout]: '02', [step]: 15});
      await settle();
      assert.equal(h.memory[layout], '02');
      assert.equal(h.memory[step], 15);
      assert.deepStrictEqual(h.reads, [layout, step]);
      assert.deepStrictEqual(h.writes, []);
      assert.equal(h.storage[h.config.getStorageKey(layout)], '"02"');
      assert.deepStrictEqual(h.refreshed, [[layout, step]]);
      assert.deepStrictEqual(h.applying, [true, false]);
      assert.deepStrictEqual(h.emissions.map(event => event.name), [
        'change', 'update', 'update-' + layout, 'update', 'update-' + step
      ]);
      assert(h.emissions.every(event => event.active), 'config subscribers are suppressed for the whole batch');
      assert.deepStrictEqual(Array.from(h.emissions[0].args[0], pair => Array.from(pair)), [[layout, '02'], [step, 15]]);
    } finally { h.close(); }
  });

  it('validates the whole batch before refreshing even the first valid value', async () => {
    const h = fixture();
    try {
      h.connection.connect();
      h.saved({[layout]: '02', [step]: -1});
      await settle();
      assert.deepStrictEqual(h.memory, defaults);
      assert.deepStrictEqual(h.reads, []);
      assert.deepStrictEqual(h.emissions, []);
      assert.equal(h.errors.length, 1);
      h.config.options.validateImport = (key, value) => key !== step || value < 10;
      h.saved({[layout]: '03', [step]: 15});
      await settle();
      assert.deepStrictEqual(h.memory, defaults);
      assert.deepStrictEqual(h.reads, []);
      assert.equal(h.errors.length, 2);
    } finally { h.close(); }
  });

  it('contains malformed storage and ignores event-supplied values and unrelated keys', async () => {
    const h = fixture();
    try {
      h.connection.connect();
      h.storage[h.config.getStorageKey(layout)] = '{broken';
      h.notify([layout]);
      await settle();
      assert.deepStrictEqual(h.memory, defaults);
      assert.deepStrictEqual(h.reads, []);
      assert.equal(h.errors.length, 1);
      h.storage[h.config.getStorageKey(layout)] = '"03"';
      h.window.dispatchEvent(new h.window.CustomEvent(SAVED_EVENT, {
        detail: {keys: [layout, '__proto__', 'videoServerType'], values: {[layout]: '09'}}
      }));
      await settle();
      assert.equal(h.memory[layout], '03');
      assert.deepStrictEqual(h.reads, [layout]);
    } finally { h.close(); }
  });

  it('serializes delayed refreshes and re-reads the latest saved values', async () => {
    const h = fixture(), gate = deferred();
    try {
      const refresh = h.config.refresh.bind(h.config);
      let first = true;
      h.config.refresh = async (key, snapshot) => {
        if (first) { first = false; await gate.promise; }
        return refresh(key, snapshot);
      };
      h.connection.connect();
      h.saved({[layout]: '02'});
      await settle();
      h.saved({[layout]: '03'});
      h.notify([layout, layout]);
      await settle();
      assert.deepStrictEqual(h.reads, []);
      gate.resolve();
      await settle();
      assert.equal(h.memory[layout], '03');
      assert.deepStrictEqual(h.reads, [layout, layout]);
      assert.deepStrictEqual(h.emissions.filter(event => event.name === 'update').map(event => event.args), [
        [layout, '02'], [layout, '03']
      ]);
      assert.deepStrictEqual(h.writes, []);
    } finally { gate.resolve(); h.close(); }
  });

  it('rolls back a partially applied refresh failure and can process the next save', async () => {
    const h = fixture();
    try {
      const refresh = h.config.refresh.bind(h.config);
      let fail = true;
      h.config.refresh = async (key, snapshot) => {
        const result = await refresh(key, snapshot);
        if (key === step && fail) { fail = false; throw new Error('adapter refresh failed'); }
        return result;
      };
      h.connection.connect();
      h.saved({[layout]: '02', [step]: 15});
      await settle();
      assert.deepStrictEqual(h.memory, defaults);
      assert.deepStrictEqual(h.reads, [layout, step, layout, step]);
      assert.deepStrictEqual(h.emissions, []);
      assert.deepStrictEqual(h.refreshed, []);
      assert.equal(h.errors.length, 1);
      h.notify([layout, step]);
      await settle();
      assert.equal(h.memory[layout], '02');
      assert.equal(h.memory[step], 15);
      assert.deepStrictEqual(h.refreshed, [[layout, step]]);
    } finally { h.close(); }
  });

  it('keeps processing saved updates even if the error observer itself throws', async () => {
    const h = fixture();
    try {
      h.connection.onError = error => {
        h.errors.push(error);
        throw new Error('notification observer failed');
      };
      h.connection.connect();
      h.storage[h.config.getStorageKey(step)] = JSON.stringify(-1);
      h.notify([step]);
      // Observe the queue promise so an intentionally throwing observer is not unhandled.
      h.connection._queue.catch(() => {});
      await settle();
      assert.equal(h.errors.length, 1, 'one invalid save was reported');
      h.saved({[step]: 15});
      h.connection._queue.catch(() => {});
      await settle();
      assert.equal(h.memory[step], 15, 'a recovered valid save must reach Config.refresh');
      assert.deepStrictEqual(h.refreshed, [[step]]);
      assert.equal(h.errors.length, 1, 'the error observer is not invoked again on stale rejection');
    } finally { h.close(); }
  });

  it('handles storage deletion and ignores events from a different storage area', async () => {
    const h = fixture();
    try {
      h.connection.connect();
      h.storage[h.config.getStorageKey(layout)] = '"04"';
      h.storageEvent(h.config.getStorageKey(layout), h.window.sessionStorage);
      await settle();
      assert.deepStrictEqual(h.reads, []);
      h.storageEvent(h.config.getStorageKey(layout));
      await settle();
      assert.equal(h.memory[layout], '04');
      h.storage.removeItem(h.config.getStorageKey(layout));
      h.storageEvent(h.config.getStorageKey(layout));
      await settle();
      assert.equal(h.memory[layout], '01');
      assert.equal(h.storage.getItem(h.config.getStorageKey(layout)), null);
      h.saved({[layout]: '05', [step]: 20});
      await settle();
      h.storage.clear();
      h.storageEvent(null);
      await settle();
      assert.deepStrictEqual(h.memory, defaults);
      assert.deepStrictEqual(h.writes, []);
    } finally { h.close(); }
  });

  it('refreshes saved presence even when a migration-sensitive raw value is unchanged', async () => {
    const h = fixture();
    try {
      h.config.resolveSceneSearch = () => ({});
      h.connection.connect();
      h.saved({[enabled]: true});
      await settle();
      assert.deepStrictEqual(h.reads, [enabled]);
      assert.deepStrictEqual(h.refreshed, [[enabled]]);
    } finally { h.close(); }
  });

  it('connects once and detaches both native event listeners on dispose', async () => {
    const h = fixture();
    const add = h.window.addEventListener.bind(h.window), remove = h.window.removeEventListener.bind(h.window);
    const installed = new Map();
    h.window.addEventListener = (name, listener, ...rest) => {
      add(name, listener, ...rest);
      if (name === SAVED_EVENT || name === 'storage') {
        if (!installed.has(name)) installed.set(name, new Set());
        installed.get(name).add(listener);
      }
    };
    h.window.removeEventListener = (name, listener, ...rest) => {
      remove(name, listener, ...rest);
      installed.get(name)?.delete(listener);
    };
    try {
      h.connection.connect();
      h.connection.connect();
      assert.equal(installed.get(SAVED_EVENT)?.size || 0, 1);
      assert.equal(installed.get('storage')?.size || 0, 1);
      h.saved({[layout]: '02'});
      await settle();
      assert.deepStrictEqual(h.refreshed, [[layout]]);
      h.connection.dispose();
      h.connection.dispose();
      h.connection.connect();
      assert.equal(installed.get(SAVED_EVENT).size, 0);
      assert.equal(installed.get('storage').size, 0);
      h.saved({[layout]: '03'});
      h.storageEvent(h.config.getStorageKey(layout));
      await settle();
      assert.equal(h.memory[layout], '02');
    } finally { h.close(); }
  });

  it('cancels queued notifications before they can read saved values', async () => {
    const h = fixture();
    try {
      h.connection.connect();
      h.saved({[layout]: '02'});
      await settle();
      assert.equal(h.memory[layout], '02');
      h.reads.length = 0;
      h.emissions.length = 0;
      h.refreshed.length = 0;
      h.saved({[layout]: '03'});
      h.connection.dispose();
      await settle();
      assert.deepStrictEqual(h.reads, []);
      assert.deepStrictEqual(h.emissions, []);
      assert.deepStrictEqual(h.refreshed, []);
    } finally { h.close(); }
  });

  it('stops the rest of an in-flight batch and every queued batch after disposal', async () => {
    const h = fixture(), gate = deferred();
    try {
      const refresh = h.config.refresh.bind(h.config);
      let entered = false;
      h.config.refresh = async (key, snapshot) => {
        entered = true;
        await gate.promise;
        return refresh(key, snapshot);
      };
      h.connection.connect();
      h.saved({[layout]: '02', [step]: 15});
      await settle();
      assert(entered, 'the adapter is awaiting its first refresh');
      h.saved({[layout]: '03'});
      h.connection.dispose();
      gate.resolve();
      await settle();
      assert.deepStrictEqual(h.reads, [layout]);
      assert.equal(h.memory[step], 5);
      assert.deepStrictEqual(h.emissions, []);
      assert.deepStrictEqual(h.applying, []);
      assert.deepStrictEqual(h.refreshed, []);
      assert.deepStrictEqual(h.errors, []);
    } finally { gate.resolve(); h.close(); }
  });

  it('honors owner disposal and stops emitting when disposal occurs inside a subscriber', async () => {
    const h = fixture();
    try {
      const emit = h.config.emit.bind(h.config);
      h.config.emit = (name, ...args) => {
        emit(name, ...args);
        if (name === 'change') h.connection.dispose();
      };
      h.connection.connect();
      h.saved({[layout]: '02', [step]: 15});
      await settle();
      assert.deepStrictEqual(h.emissions.map(event => event.name), ['change']);
      assert.deepStrictEqual(h.applying, [true, false]);
      assert.deepStrictEqual(h.refreshed, []);
    } finally { h.close(); }
    const owner = fixture();
    try {
      owner.connection.connect();
      owner.saved({[layout]: '02'});
      owner.disposeOwner();
      await settle();
      assert.deepStrictEqual(owner.reads, []);
      assert.deepStrictEqual(owner.emissions, []);
    } finally { owner.close(); }
  });

  it('aborts remaining listener registrations after synchronous disposal', async () => {
    const h = fixture();
    const add = h.window.addEventListener.bind(h.window);
    const remove = h.window.removeEventListener.bind(h.window);
    const installed = new Set();
    h.window.addEventListener = (name, listener, ...rest) => {
      add(name, listener, ...rest);
      installed.add(name);
      if (name === SAVED_EVENT) h.connection.dispose();
    };
    h.window.removeEventListener = (name, listener, ...rest) => {
      remove(name, listener, ...rest);
      installed.delete(name);
    };
    try {
      h.connection.connect();
      assert.equal(installed.size, 0, 'no listeners may survive disposal during connect');
      h.connection.connect();
      assert.equal(installed.size, 0, 'disposed connection must not restart');
    } finally { h.close(); }
  });

  it('detaches a listener installed after synchronous disposal inside its registration wrapper', () => {
    const h = fixture();
    const add = h.window.addEventListener.bind(h.window);
    const remove = h.window.removeEventListener.bind(h.window);
    const installed = new Set();
    h.window.addEventListener = (name, listener, ...rest) => {
      if (name === SAVED_EVENT) h.connection.dispose();
      add(name, listener, ...rest);
      installed.add(listener);
    };
    h.window.removeEventListener = (name, listener, ...rest) => {
      remove(name, listener, ...rest);
      installed.delete(listener);
    };
    try {
      h.connection.connect();
      assert.equal(installed.size, 0, 'register-after-dispose must not retain a listener');
    } finally { h.close(); }
  });

  it('removes even the listener whose registration threw after installing it', async () => {
    const h = fixture();
    const add = h.window.addEventListener.bind(h.window), remove = h.window.removeEventListener.bind(h.window);
    const installed = new Set();
    h.window.addEventListener = (name, listener, ...rest) => {
      add(name, listener, ...rest);
      installed.add(listener);
      if (name === 'storage') throw new Error('registration failed after installing');
    };
    h.window.removeEventListener = (name, listener, ...rest) => {
      remove(name, listener, ...rest);
      installed.delete(listener);
    };
    try {
      assert.throws(() => h.connection.connect(), /registration failed/);
      assert.equal(installed.size, 0);
      h.saved({[layout]: '02'});
      await settle();
      assert.deepStrictEqual(h.reads, []);
      assert.deepStrictEqual(h.emissions, []);
    } finally { h.close(); }
  });

  it('tries both removals and retains a failed listener removal for a later dispose', async () => {
    const h = fixture();
    const add = h.window.addEventListener.bind(h.window), remove = h.window.removeEventListener.bind(h.window);
    const installed = new Map();
    let fail = true;
    h.window.addEventListener = (name, listener, ...rest) => {
      add(name, listener, ...rest);
      installed.set(name, listener);
    };
    h.window.removeEventListener = (name, listener, ...rest) => {
      if (name === SAVED_EVENT && fail) { fail = false; throw new Error('remove temporarily failed'); }
      remove(name, listener, ...rest);
      installed.delete(name);
    };
    try {
      h.connection.connect();
      assert.throws(() => h.connection.dispose(), /remove temporarily failed/);
      assert(installed.has(SAVED_EVENT));
      assert(!installed.has('storage'), 'one removal failure must not prevent the other listener from detaching');
      h.saved({[layout]: '02'});
      await settle();
      assert.deepStrictEqual(h.reads, []);
      h.connection.dispose();
      assert.equal(installed.size, 0);
    } finally { h.close(); }
  });

  it('retains the scene preference validation boundaries', () => {
    const Connection = loadClass(SOURCE, NAME, createContext());
    const cases = [
      ['sceneSearch.presentation.normal', 'follow', true], ['sceneSearch.presentation.fullscreen', 'fixed', true],
      ['sceneSearch.presentation.normal', 'legacy', true], ['sceneSearch.presentation.normal', 'floating', false],
      ['sceneSearch.enabled', true, true], ['sceneSearch.miniCommentVisible', false, true],
      ['sceneSearch.commentListVisible', 1, false], ['sceneSearch.commentListScale', 100, true],
      ['sceneSearch.commentListScale', 200, true], ['sceneSearch.commentListScale', 99, false],
      ['sceneSearch.thumbnailScale', 50, true], ['sceneSearch.thumbnailScale', 201, false],
      ['sceneSearch.commentListBackgroundOpacity', 0, true], ['sceneSearch.commentListBackgroundOpacity', 100, true],
      ['sceneSearch.commentListBackgroundOpacity', 1.5, false], [layout, '00', true], [layout, '10', true],
      [layout, '11', false], [layout, 1, false], ['sceneSearch.miniCommentMode', 'static', true],
      ['sceneSearch.miniCommentMode', 'hidden', true], ['sceneSearch.miniCommentMode', 'unknown', false],
      ['enableCommentPreview', false, true], ['sceneSearch.layout.linkFullscreen', 'false', false],
      ['sceneSearch.commentPreviewVisible', true, true], [step, 0, true], [step, 600, true], [step, 601, false],
      ['sceneSearch.idleHideSeconds', 0.5, true], ['sceneSearch.idleHideSeconds', 30, true],
      ['sceneSearch.idleHideSeconds', 0.25, false], ['sceneSearch.idleHideSeconds', Infinity, false],
      ['sceneSearch.controlsReveal', 'always', true], ['sceneSearch.controlsReveal', 'hover', false],
      ['sceneSearch.animation', 'subtle', true], ['sceneSearch.animation', 'fast', false], ['__proto__', true, false]
    ];
    for (const [key, value, expected] of cases) {
      assert.strictEqual(Connection.validSavedPreference(key, value), expected, key + ': ' + String(value));
    }
  });
});

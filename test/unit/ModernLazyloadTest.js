'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '../../packages/lib/src/nico/modernLazyload.js'),
  'utf8'
);

function loadSubjectSource(rel = 'packages/lib/src/nico/modernLazyload.js') {
  if (rel !== 'dist/ZenzaWatch-dev.user.js') {
    return source;
  }
  const text = fs.readFileSync(path.join(__dirname, '../../' + rel), 'utf8');
  const start = text.indexOf('(() => { // 古いページで使われている');
  const end = text.indexOf('\n})();', start);
  assert.ok(start >= 0 && end > start, 'modern lazyload block missing from generated dev dist');
  return text.slice(start, end + 5);
}

function createItem(HTMLElement, attrs = {}) {
  const values = new Map(Object.entries(attrs));
  const listeners = new Map();
  return new class extends HTMLElement {
    constructor() {
      super();
      this.style = {};
      this.classList = {
        add() {},
        remove() {}
      };
    }
    getAttribute(name) {
      return values.has(name) ? values.get(name) : null;
    }
    setAttribute(name, value) {
      values.set(name, value);
    }
    addEventListener(name, handler) {
      listeners.set(name, handler);
    }
    dispatchEvent() {}
  }();
}

function setup({decode = () => Promise.resolve(), rel = 'packages/lib/src/nico/modernLazyload.js'} = {}) {
  class HTMLElement {}
  const createdImages = [];

  class TestImage {
    constructor() {
      createdImages.push(this);
      if (decode !== undefined) {
        this.decode = decode;
      }
    }
  }

  class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
  }

  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
  }

  const LazyImage = {
    className: 'lazy',
    attrName: 'data-src',
    adjustAttrName: 'data-adjust',
    errorEventName: 'lazy-error',
    margin: 100,
    pageObserver: null,
    intersectionObserver: null,
    mutationObserver: null
  };

  const window = {Nico: {LazyImage}};
  const context = vm.createContext({
    window,
    top: window,
    location: {host: 'www.nicovideo.jp'},
    document: {
      body: {},
      querySelectorAll() {
        return [];
      }
    },
    HTMLElement,
    Image: TestImage,
    IntersectionObserver,
    MutationObserver,
    CustomEvent: class CustomEvent {
      constructor(name, options) {
        this.type = name;
        Object.assign(this, options);
      }
    },
    requestAnimationFrame(callback) {
      callback();
    },
    clearInterval() {},
    console: {log() {}, warn() {}},
    Number
  });

  vm.runInContext(loadSubjectSource(rel), context, {filename: rel});
  return {LazyImage, HTMLElement, createdImages};
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Task240 modern lazyload decode handling', () => {
  it('loads adjusted images after decode resolves', async () => {
    const {LazyImage, HTMLElement} = setup();
    const item = createItem(HTMLElement);

    assert.doesNotThrow(() => LazyImage._adjustSizeAndLoad(item, 'https://example.test/a.jpg'));
    await flushPromises();

    assert.strictEqual(item.getAttribute('src'), 'https://example.test/a.jpg');
    assert.strictEqual(item.style.objectFit, 'contain');
  });

  it('keeps generated dev dist decode invocation in parity with source', async () => {
    const {LazyImage, HTMLElement} = setup({rel: 'dist/ZenzaWatch-dev.user.js'});
    const item = createItem(HTMLElement);

    assert.doesNotThrow(() => LazyImage._adjustSizeAndLoad(item, 'https://example.test/dist.jpg'));
    await flushPromises();

    assert.strictEqual(item.getAttribute('src'), 'https://example.test/dist.jpg');
    assert.strictEqual(item.style.objectFit, 'contain');
  });

  it('falls back to loading adjusted images when decode rejects', async () => {
    const {LazyImage, HTMLElement} = setup({
      decode: () => Promise.reject(new Error('decode failed'))
    });
    const item = createItem(HTMLElement);

    assert.doesNotThrow(() => LazyImage._adjustSizeAndLoad(item, 'https://example.test/b.jpg'));
    await flushPromises();

    assert.strictEqual(item.getAttribute('src'), 'https://example.test/b.jpg');
    assert.strictEqual(item.style.objectFit, 'contain');
  });

  it('falls back when HTMLImageElement.decode is unavailable', async () => {
    const {LazyImage, HTMLElement} = setup({decode: undefined});
    const item = createItem(HTMLElement);

    assert.doesNotThrow(() => LazyImage._adjustSizeAndLoad(item, 'https://example.test/c.jpg'));
    await flushPromises();

    assert.strictEqual(item.getAttribute('src'), 'https://example.test/c.jpg');
    assert.strictEqual(item.style.objectFit, 'contain');
  });

  it('keeps the normal unadjusted lazy-load path unchanged', () => {
    const {LazyImage, HTMLElement, createdImages} = setup();
    const item = createItem(HTMLElement, {'data-src': 'https://example.test/plain.jpg'});

    LazyImage._loadImage(item);

    assert.strictEqual(item.getAttribute('src'), 'https://example.test/plain.jpg');
    assert.strictEqual(item.getAttribute('data-src'), '');
    assert.strictEqual(createdImages.length, 0);
  });
});

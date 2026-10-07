'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeSubject({workerThrows = false, rel = 'src/_shape.js'} = {}) {
  const created = [];
  const revoked = [];
  const workers = [];
  class BlobMock {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }
  class WorkerMock {
    constructor(url, options) {
      if (workerThrows) {
        throw new Error('worker create failed');
      }
      this.url = url;
      this.options = options;
      workers.push(this);
    }
  }
  const URLMock = {
    createObjectURL(blob) {
      created.push(blob);
      return 'blob:maskedwatch-fixture';
    },
    revokeObjectURL(url) {
      revoked.push(url);
    }
  };
  const context = createContext({Blob: BlobMock, Worker: WorkerMock, URL: URLMock});
  run(
    `globalThis.__createWorker = ${extract(rel, 'createWorker', 'var')};`,
    context
  );
  return {createWorker: context.__createWorker, created, revoked, workers};
}

describe('Task241 MaskedWatch worker Blob URL lifetime', () => {
  it('revokes the worker Blob URL after successful Worker construction', () => {
    const {createWorker, created, revoked, workers} = makeSubject();
    const worker = createWorker(function workerMain() {}, {name: 'fixture'});
    assert.strictEqual(created.length, 1);
    assert.strictEqual(workers.length, 1);
    assert.strictEqual(worker, workers[0]);
    assert.strictEqual(worker.url, 'blob:maskedwatch-fixture');
    assert.deepStrictEqual(revoked, ['blob:maskedwatch-fixture']);
  });

  it('revokes the Blob URL even when Worker construction throws', () => {
    const {createWorker, created, revoked} = makeSubject({workerThrows: true});
    assert.throws(
      () => createWorker(function workerMain() {}, {name: 'fixture'}),
      /worker create failed/
    );
    assert.strictEqual(created.length, 1);
    assert.deepStrictEqual(revoked, ['blob:maskedwatch-fixture']);
  });

  it('keeps generated MaskedWatch dist Blob URL cleanup in parity with source', () => {
    const {createWorker, created, revoked, workers} = makeSubject({
      rel: 'dist/MaskedWatch.user.js'
    });
    const worker = createWorker(function workerMain() {}, {name: 'dist-fixture'});

    assert.strictEqual(created.length, 1);
    assert.strictEqual(workers.length, 1);
    assert.strictEqual(worker, workers[0]);
    assert.deepStrictEqual(revoked, ['blob:maskedwatch-fixture']);
  });
});

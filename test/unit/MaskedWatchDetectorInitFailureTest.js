'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeSubject(rel) {
  let terminateCalls = 0;
  let addModuleCalls = 0;
  const error = new Error('paint worklet failed');
  const worker = {
    terminate() {
      terminateCalls += 1;
    }
  };
  const context = createContext({
    createWorker() {
      return worker;
    },
    業務() {},
    下請() {},
    css: {
      addModule() {
        addModuleCalls += 1;
        return Promise.reject(error);
      }
    },
    config: {}
  });
  run(
    `globalThis.__createDetector = ${extract(rel, 'createDetector', 'var')};`,
    context
  );
  return {
    createDetector: context.__createDetector,
    error,
    getTerminateCalls: () => terminateCalls,
    getAddModuleCalls: () => addModuleCalls
  };
}

describe('Task266 MaskedWatch detector initialization failure cleanup', () => {
  for (const rel of ['src/_shape.js', 'dist/MaskedWatch.user.js']) {
    it(`${rel} terminates the worker when paint-worklet registration fails`, async () => {
      const subject = makeSubject(rel);
      await assert.rejects(
        subject.createDetector({video: {}, layer: {}, interval: 300, type: 'fixture'}),
        err => err === subject.error
      );
      assert.strictEqual(subject.getAddModuleCalls(), 1);
      assert.strictEqual(subject.getTerminateCalls(), 1);
    });
  }
});

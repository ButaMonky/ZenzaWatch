'use strict';

const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function createLoader(payload) {
  class CacheStorage {
    constructor() {}
  }
  const context = createContext({
    CacheStorage,
    sessionStorage: {},
    netUtil: {
      fetch: async () => ({
        json: async () => payload
      })
    },
    textUtil: {},
    nicoUtil: {},
    Config: {getValue: () => false},
    emitter: {emitAsync() {}},
    debug: {}
  });
  run(
    beginSection('packages/lib/src/nico/VideoInfoLoader.js') +
      '\nglobalThis.__VideoInfoLoader = VideoInfoLoader;',
    context
  );
  return context.__VideoInfoLoader;
}

function errorPayload(statusCode, errorCode, reasonCode = null) {
  return {
    meta: {status: statusCode},
    data: {
      response: {
        statusCode,
        errorCode,
        reasonCode,
        deletedMessage: null,
        communityLink: null,
        publishScheduledAt: null,
        data: {}
      },
      treatAs: false
    }
  };
}

describe('Task 091: Watch API の削除・不存在動画を構造化エラーにする', function() {
  it('FORBIDDEN / ADMINISTRATOR_DELETE_VIDEO は TypeError ではなく forbidden として返す', async function() {
    const loader = createLoader(errorPayload(400, 'FORBIDDEN', 'ADMINISTRATOR_DELETE_VIDEO'));
    await assert.rejects(
      loader.load('sm1', {}),
      err => {
        assert.equal(err.watchId, 'sm1');
        assert.equal(err.reason, 'forbidden');
        assert.equal(err.errorCode, 'FORBIDDEN');
        assert.equal(err.reasonCode, 'ADMINISTRATOR_DELETE_VIDEO');
        assert.ok(err.message && !/Cannot read properties/.test(err.message), err.message);
        return true;
      }
    );
  });

  it('NOT_FOUND は TypeError ではなく not found として返す', async function() {
    const loader = createLoader(errorPayload(404, 'NOT_FOUND'));
    await assert.rejects(
      loader.load('sm245', {}),
      err => {
        assert.equal(err.watchId, 'sm245');
        assert.equal(err.reason, 'not found');
        assert.equal(err.errorCode, 'NOT_FOUND');
        assert.ok(err.message && !/Cannot read properties/.test(err.message), err.message);
        return true;
      }
    );
  });
});

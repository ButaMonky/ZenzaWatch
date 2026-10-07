'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function makeWorker(file) {
  const source = extract(file, 'StorageWorker', 'var');
  // Expose only this worker's actual config to inspect the message boundary.
  const observed = source.replace(/\}\s*$/, 'self.__readConfig = () => Config;\n}');
  const context = createContext({});
  const worker = run('(' + observed + ')', context);
  const replies = [];
  const scope = {postMessage(message) { replies.push(message); }};
  worker(scope);
  return {scope, replies};
}

describe('Task292 HLS storage config payload', () => {
  for (const file of ['src/_hls.js', 'dist/ZenzaHLS.user.js']) {
    it(file + ': applies nested payload without envelope fields', async () => {
      const {scope, replies} = makeWorker(file);
      await scope.onmessage({data: {
        command: 'config', id: 'request-7',
        data: {cache_expire_time: 1500, enable_db_cache: true}
      }});
      const config = scope.__readConfig();
      assert.strictEqual(config.cache_expire_time, 1500);
      assert.strictEqual(config.enable_db_cache, true);
      assert.strictEqual(config.command, undefined);
      assert.strictEqual(config.id, undefined);
      assert.strictEqual(config.data, undefined);
      assert.strictEqual(replies.length, 1);
      assert.strictEqual(replies[0].id, 'request-7');
      assert.strictEqual(replies[0].result, 'ok');
    });
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const adapter = readFileSync(join(__dirname, 'runtime-adapter.cjs'), 'utf8');
const start = adapter.indexOf(' const legacyHls=');
const end = adapter.indexOf('\n body=body.replaceAll(', start);
assert.ok(start > 0 && end > start, 'the exact HLS adapter section exists');
const section = adapter.slice(start, end);
const legacy = 'const hls = new Hls(Object.assign({}, this._hlsConfig));';
const prefetch = 'const hls = new Hls(Object.assign({}, this._hlsConfig, prefetchActive ? { loader: prefetchRuntime.wrapLoader(Hls.DefaultConfig.loader), startLevel: startupLevel } : {}));';
const trial = 'externalTrial ? {loader:externalTrial.gm.Loader,fLoader:externalTrial.gm.Loader,pLoader:externalTrial.gm.Loader} : {}';
const patch = (original) => {
  const context = {body: original};
  context.once = (from, to) => {
    assert.equal(context.body.split(from).length, 2, 'exactly one recognized anchor');
    context.body = context.body.replace(from, to);
  };
  runInNewContext(section, context, {timeout: 1000});
  return context.body;
};
test('External trial loader overrides both legacy and prefetched HLS constructors', () => {
  assert.equal(patch(legacy), 'const hls = new Hls(Object.assign({}, this._hlsConfig, '+trial+'));');
  assert.equal(patch(prefetch), 'const hls = new Hls(Object.assign({}, this._hlsConfig, prefetchActive ? { loader: prefetchRuntime.wrapLoader(Hls.DefaultConfig.loader), startLevel: startupLevel } : {}, '+trial+'));');
  assert.throws(() => patch('unrecognized constructor'), /recognized anchor/);
});

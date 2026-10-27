'use strict';
// Task450: protect a TypeScript-canonical style utility in the root Mocha gate.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const file=r=>fs.readFileSync(path.join(root,r),'utf8');
const lf=x=>x.replace(/\r\n/g,'\n');
const sha=x=>crypto.createHash('sha256').update(lf(x)).digest('hex');
const source='tools/typescript-stage1/src/StyleSwitcher.ts';
const runtime='packages/lib/src/css/StyleSwitcher.js';
const manifest='tools/typescript-stage1/style-switcher-manifest.json';

describe('Task450 TypeScript style switcher source-of-truth',()=>{
  it('enforces source and emitted runtime hashes in the tracked manifest',()=>{
    const data=JSON.parse(file(manifest));
    assert.strictEqual(data.schemaVersion,1);
    assert.strictEqual(data.source,source);
    assert.strictEqual(data.runtime,runtime);
    assert.strictEqual(data.sourceSha256,sha(file(source)),
      'TS StyleSwitcher was edited without generating the runtime');
    assert.strictEqual(data.runtimeSha256,sha(file(runtime)),
      'legacy StyleSwitcher changed without TypeScript regeneration');
  });
  it('keeps exactly one legacy build section and expected exported symbol',()=>{
    const code=file(runtime);
    assert.strictEqual((code.match(/\/\/===BEGIN===/g)||[]).length,1);
    assert.strictEqual((code.match(/\/\/===END===/g)||[]).length,1);
    assert(code.includes('class StyleSwitcher {'));
    assert(code.includes('export {StyleSwitcher};'));
  });
});

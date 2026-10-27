'use strict';
// Task448: enforce the TypeScript source-of-truth contract during root npm test.
// This is intentionally dependency-free: it does not compile or fetch packages.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const project=path.resolve(__dirname,'../..');
const normalize=data=>String(data).replace(/\r\n/g,'\n');
const digest=data=>crypto.createHash('sha256').update(normalize(data)).digest('hex');
const source='tools/typescript-stage1/src/OfficialPlayerRoute.ts';
const runtime='packages/zenza/src/menu/OfficialPlayerRoute.js';
const manifestFile='tools/typescript-stage1/runtime-manifest.json';
const file=relative=>fs.readFileSync(path.join(project,relative),'utf8');

describe('Task448 canonical TypeScript route source',()=>{
  it('requires a tracked manifest with the exact source and runtime SHA-256',()=>{
    const manifest=JSON.parse(file(manifestFile));
    assert.strictEqual(manifest.schemaVersion,1);
    assert.strictEqual(manifest.source,source);
    assert.strictEqual(manifest.runtime,runtime);
    assert.strictEqual(manifest.sourceSha256,digest(file(source)),
      'TypeScript changed without rebuilding: run npm run generate:legacy');
    assert.strictEqual(manifest.runtimeSha256,digest(file(runtime)),
      'Legacy runtime changed outside the TypeScript generator');
  });
  it('preserves one legacy build section and exports the expected runtime symbol',()=>{
    const js=file(runtime);
    assert.strictEqual((js.match(/\/\/===BEGIN===/g)||[]).length,1);
    assert.strictEqual((js.match(/\/\/===END===/g)||[]).length,1);
    assert(js.includes('const OfficialPlayerRoute = Object.freeze({'));
    assert(js.includes('export {OfficialPlayerRoute};'));
  });
});

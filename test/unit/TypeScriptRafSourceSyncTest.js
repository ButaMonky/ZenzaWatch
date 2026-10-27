'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const file=r=>fs.readFileSync(path.join(root,r),'utf8');
const sha=x=>crypto.createHash('sha256').update(x.replace(/\r\n/g,'\n')).digest('hex');
const source='tools/typescript-stage1/src/RequestAnimationFrame.ts';
const runtime='packages/lib/src/infra/RequestAnimationFrame.js';
const manifest='tools/typescript-stage1/raf-timing-manifest.json';
describe('Task462 TypeScript RAF timing source-of-truth',()=>{
  it('keeps the typed source and runtime tracked by hash',()=>{
    const m=JSON.parse(file(manifest));
    assert.strictEqual(m.schemaVersion,1);
    assert.strictEqual(m.source,source);
    assert.strictEqual(m.runtime,runtime);
    assert.strictEqual(m.sourceSha256,sha(file(source)));
    assert.strictEqual(m.runtimeSha256,sha(file(runtime)));
  });
  it('retains the legacy import and the one-section build markers',()=>{
    const code=file(runtime);
    assert(code.startsWith("import {sleep} from './sleep';"));
    assert.strictEqual((code.match(/\/\/===BEGIN===/g)||[]).length,1);
    assert.strictEqual((code.match(/\/\/===END===/g)||[]).length,1);
    assert(code.includes('class RequestAnimationFrame {'));
    assert(code.includes('export {RequestAnimationFrame};'));
  });
});

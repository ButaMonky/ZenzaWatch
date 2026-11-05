'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const Resources=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutResources.js',
 'SceneSearchLayoutResources',createContext());

describe('P13 strict TypeScript-backed layout cleanup runtime',()=>{
 it('releases a successful cleanup exactly once and leaves no pending work',()=>{
  const h=new Resources();
  let count=0;
  assert.equal(h.release(()=>{count++;},'native-dom'),true);
  assert.equal(count,1);
  assert.equal(h.pendingCount,0);
  assert.equal(h.retry(),true);
 });
 it('keeps a failed cleanup for retry despite an error reporter throwing',()=>{
  const reports=[],error=new Error('temporary');
  const h=new Resources((err,key)=>{reports.push([err,key]);throw Error('reporter failure');});
  let attempts=0;
  const cleanup=()=>{if(attempts++===0)throw error;};
  assert.equal(h.release(cleanup,'DOM'),false);
  assert.equal(h.pendingCount,1);
  assert.strictEqual(reports[0][0],error);
  assert.equal(reports[0][1],'DOM');
  assert.equal(h.retry('DOM'),true);
  assert.equal(attempts,2);
  assert.equal(h.pendingCount,0);
 });
 it('does not reenter the same running cleanup',()=>{
  const h=new Resources();
  let calls=0;
  const cleanup=()=>{calls++;assert.equal(h.release(cleanup,'nested'),false);};
  assert.equal(h.release(cleanup,'nested'),true);
  assert.equal(calls,1);
  assert.equal(h.pendingCount,0);
 });
 it('retries only the selected key while another key stays pending',()=>{
  const h=new Resources();
  let first=0,second=0;
  const failed1=()=>{first++;if(first===1)throw Error('one');};
  const failed2=()=>{second++;if(second===1)throw Error('two');};
  assert.equal(h.release(failed1,'one'),false);
  assert.equal(h.release(failed2,'two'),false);
  assert.equal(h.retry('one'),true);
  assert.equal(h.pendingCount,1);
  assert.equal(second,1);
  assert.equal(h.retry('two'),true);
  assert.equal(h.pendingCount,0);
 });
});

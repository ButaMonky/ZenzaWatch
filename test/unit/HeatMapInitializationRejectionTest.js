'use strict';
const assert = require('assert');
const {read, createContext, run} = require('../helpers/extractSource');
for (const artifact of ['src/VideoControlBar.js', 'dist/ZenzaWatch-dev.user.js']) {
 describe('HeatMap initialization rejection isolation: ' + artifact, () => {
  it('absorbs failed initialization without publishing a broken map or private error details', async () => {
   const text=read(artifact), start=text.indexOf('HeatMapWorker.init({'), end=text.indexOf('const updateHeatMapVisibility',start);
   assert(start>=0 && end>start);
   const expression=text.slice(start,end).trim().replace(/;$/, ''), warnings=[], ready=[];
   const context=createContext({subject:{_seekBar:{},_onHeatMapReady:v=>ready.push(v)},
    HeatMapWorker:{init:()=>Promise.reject(new Error('TEST_ONLY_PRIVATE_FAILURE'))},window:{console:{warn:(...args)=>warnings.push(args)}}});
   await assert.doesNotReject(()=>run('(function(){return '+expression+';}).call(subject)',context));
   assert.deepStrictEqual(ready,[]);assert.strictEqual(warnings.length,1);
   assert(!JSON.stringify(warnings).includes('TEST_ONLY_PRIVATE_FAILURE'));
  });
 });
}

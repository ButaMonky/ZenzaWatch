'use strict';
// Task957: official API response shape independently observed (2026-10-27).
// Offline contract so the test never requires login or a live endpoint.
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
const SOURCE='packages/lib/src/nico/AdDecorationLoader.js';
describe('Task957: Pocket crown lookup uses actual NicoAd response schema',()=>{
 it('maps response data.contents decorations to canonical IDs without credentials',async()=>{
  const calls=[];
  const netUtil={fetch:async(url,options)=>{
   calls.push({url,options});
   return {ok:true,json:async()=>({
    meta:{status:200},
    data:{contents:[{id:'sm46949237',activePoint:98400,totalPoint:98400,decoration:'gold'}]}
   })};
  }};
  const ctx=createContext({netUtil,window:{console:{warn(){}}}});
  run('const AdDecorationLoader='+extract(SOURCE,'AdDecorationLoader','var')+
    ';this.loader=AdDecorationLoader;',ctx);
  const grades=await ctx.loader.load(['sm46949237','sm46962870','sm46949237']);
  assert.strictEqual(grades.get('sm46949237'),'gold');
  assert.strictEqual(grades.get('sm46962870'),'normal');
  assert.strictEqual(calls.length,1);
  assert(calls[0].url.includes('ids=sm46949237,sm46962870'));
  assert.strictEqual(calls[0].options.credentials,'omit');
 });
});

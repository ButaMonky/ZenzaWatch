'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function fixture(file, failedPages=[]) {
  const requests=[], snapshotBatches=[];
  const pageItems = page => Array.from({length:100},(_,i)=>({
    essential: {id:'sm'+((page-1)*100+i+1), registeredAt:'2026-10-01T00:00:00Z', duration:100}
  }));
  const context=createContext({
    NicoSearchApiV2Version:class {},
    API_BASE_URL:'https://search.example.invalid/v2',
    initializeCrossDomainGate(){},
    console:{log(){},warn(){},info(){}},
    netUtil:{fetch:async url=>{
      const page=Number(new URL(url).searchParams.get('page'));
      requests.push(page);
      if (failedPages.includes(page)) {throw new Error('page '+page+' unavailable');}
      return {status:200,json:async()=>({meta:{status:200},
        data:{totalCount:500,items:pageItems(page)}})};
    }},

    gate:{fetch:async url=>{
      const entries=Array.from(new URL(url).searchParams.entries())
        .filter(([key])=>/^filters\[contentId\]\[\d+\]$/.test(key)).map(([,id])=>id);
      snapshotBatches.push(entries);
      return {text:async()=>JSON.stringify({meta:{status:200},
        data:entries.map(contentId=>({contentId}))})};
    }}
  });
  context.window=context;
  const Loader=loadClass(file,'NicoSearchApiV2Loader',context);
  context.NicoSearchApiV2Loader=Loader;
  Loader.nvapi={toLegacyItem:v=>({id:v.id})};
  return {Loader,requests,snapshotBatches};
}

describe('Task322 AUD-40 owner-video result retains successful page siblings',()=>{
  for(const file of ['packages/lib/src/nico/VideoSearch.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' keeps successful pages after a failed first sibling',async()=>{
      const h=fixture(file,[2]);
      const result=await h.Loader.searchByOwner('test',{userId:42},5000);
      assert.deepStrictEqual(h.requests,[1,2,3,4,5,2], 'retry failed page2 only once');
      assert.strictEqual(result.isPartial, true);
      assert.deepStrictEqual(Array.from(result.missingOwnerPages), [2]);
      assert.strictEqual(result.engine,'owner');
      assert.strictEqual(result.status,'ok');
      assert.ok(result.list.some(v=>v.id==='sm201'),'must retain later page3');

      assert.ok(result.list.some(v=>v.id==='sm301'),'must retain later page4');
      assert.ok(result.list.some(v=>v.id==='sm401'),'must retain later page5');
      assert.ok(!result.list.some(v=>v.id==='sm101'),'must not invent failed page2');
      assert.strictEqual(result.count,400);
      assert.strictEqual(h.snapshotBatches.flat().length,400);
    });
    it(file+' preserves the ordinary all-success ordering and count',async()=>{
      const h=fixture(file);
      const result=await h.Loader.searchByOwner('test',{userId:42},5000);
      assert.strictEqual(result.count,500);
      assert.strictEqual(result.list.length,500);
      assert.deepStrictEqual(result.list.map(v=>v.id).slice(0,3),['sm1','sm2','sm3']);
      assert.strictEqual(result.list[499].id,'sm500');
    });

    it(file+' keeps later successes if an interior page fails',async()=>{
      const h=fixture(file,[3]);
      const result=await h.Loader.searchByOwner('test',{userId:42},5000);
      assert.strictEqual(result.count,400);
      assert.strictEqual(h.requests.filter(page=>page===3).length,2);
      assert.strictEqual(result.isPartial,true);
      assert.deepStrictEqual(Array.from(result.missingOwnerPages),[3]);
      assert.ok(result.list.some(v=>v.id==='sm101'),'page2');
      assert.ok(!result.list.some(v=>v.id==='sm201'),'failed page3');
      assert.ok(result.list.some(v=>v.id==='sm301'),'page4');
      assert.ok(result.list.some(v=>v.id==='sm401'),'page5');
    });
    it(file+' does not silently recover from first page failure',async()=>{
      const h=fixture(file,[1]);
      await assert.rejects(h.Loader.searchByOwner('test',{userId:42},5000),/page 1 unavailable/);
    });
  }
});

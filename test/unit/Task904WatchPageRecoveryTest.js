'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');
const DOMParser = new JSDOM('').window.DOMParser;

// Synthetic fixture matching the HAR structure; never include tokens, cookies
// or any of the user's raw responses in source control.
function payload() {
  return {data:{response:{$watchV4:{data:{
    client:{watchId:'sm123',watchTrackId:'test-track'},
    metadata:{jsonLd:{owner:{type:'user',id:'123',name:'Synthetic'}}},
    video:{id:'sm123',title:'synthetic',duration:90,
      count:{view:1,comment:0,mylist:0,like:0},thumbnail:{url:'https://example.invalid/t.jpg'}},
    comment:{threads:[],layers:[],ng:{owner:[],channel:[]}},
    media:{contents:{videos:[{id:'video'}],audios:[{id:'audio'}]},
      accessRightKey:'synthetic-access-key'},
    player:{initialPlayback:{}},genre:{key:'other',label:'Other'},
    tags:{items:[],edit:{isEditable:false}},
    payment:{ppv:{isEnabled:false},premium:{isEnabled:false},
      admission:{isEnabled:false}}
  }}}}};
}
function htmlPage(json) {
  const str = JSON.stringify(json).replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><head><meta name="server-response"
    content="${str}"></head><body></body></html>`;
}
function harness(page, legacy = {}) {
  const calls = [], logs = [];
  const context = createContext({
    DOMParser, CacheStorage:class {setItem(){}},sessionStorage:{},
    netUtil:{fetch:async url=>{
      calls.push(String(url));
      if (url.includes('responseType=json')) {
        return {ok:false,status:400,json:async()=>legacy};
      }
      return {ok:true,status:200,text:async()=>page};
    }},
    nicoUtil:{hasLargeThumbnail:()=>false},textUtil:{},
    Config:{getValue:()=>false},
    emitter:{emitAsync(){}},debug:{},
    console:{
      error:(...args)=>logs.push(args),info(){},warn(){},
      log(){},time(){},timeEnd(){}
    }
  });
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js')+
    ';globalThis.__loader=VideoInfoLoader;',context);
  return {load:()=>context.__loader.load('sm123',{}),calls,logs};
}
describe('Task904: page metadata playback recovery',()=>{
  it('reads actual HTML-escaped server-response, without requesting obsolete JSON',async()=>{
    const h=harness(htmlPage(payload()));
    const result=await h.load();
    assert.strictEqual(result.isPlayable,true);
    assert.strictEqual(result.watchApiData.videoDetail.id,'sm123');
    assert.strictEqual(result.domandInfo.accessRightKey,'synthetic-access-key');
    assert.strictEqual(h.calls.length,1);
    assert.strictEqual(h.calls[0],'https://www.nicovideo.jp/watch/sm123');
  });
  it('falls back to legacy JSON if an older page omits server-response',async()=>{
    const legacy={data:{response:{statusCode:404,errorCode:'NOT_FOUND'}}};
    const h=harness('<html><head></head></html>',legacy);
    await assert.rejects(h.load(),e=>e.reason==='not found' &&
      e.errorCode==='NOT_FOUND');
    assert.strictEqual(h.calls.length,2);
    assert.ok(h.calls[1].includes('responseType=json'));
  });
  it('reports malformed embedded metadata without leaking its content',async()=>{
    const h=harness('<meta name="server-response" content="{invalid">');
    await assert.rejects(h.load(),e=>e.reason==='watch api' &&
      e.errorCode==='WATCH_PAGE_SCHEMA');
    assert.strictEqual(h.calls.length,1);
    assert.ok(!JSON.stringify(h.logs).includes('synthetic-access-key'));
  });
  it('returns a structured error when neither endpoint offers usable data',async()=>{
    const h=harness('<html><head></head></html>',{});
    await assert.rejects(h.load(),e=>e.reason==='watch api' &&
      e.errorCode==='WATCH_PAGE_META_MISSING');
    assert.strictEqual(h.calls.length,2);
  });
});
describe('Task904: video-info state after a failed fetch',()=>{
  it('clears previous model and counters without dereferencing null',()=>{
    const debug={},events=[];
    const context=createContext({BaseState:class {},global:{debug}});
    const PlayerState=loadClass('src/State.js','PlayerState',context);
    const state=Object.create(PlayerState.prototype);
    state._videoInfo={update(){throw Error('must not update old model');}};
    state.videoCount={view:123};
    state.thumbnail='old-thumbnail';
    state.emit=(...args)=>events.push(args);
    state.videoInfo=null;
    assert.strictEqual(state.videoInfo,null);
    assert.strictEqual(debug.videoInfo,null);
    assert.deepStrictEqual(JSON.stringify(state.videoCount),'{}');
    assert.strictEqual(state.thumbnail,'');
    assert.deepStrictEqual(events,[['update-videoInfo',null]]);
    const fresh={count:{view:1},betterThumbnail:'new-thumbnail'};
    state.videoInfo=fresh;
    assert.strictEqual(state.videoInfo,fresh);
    assert.strictEqual(state.thumbnail,'new-thumbnail');
  });
});

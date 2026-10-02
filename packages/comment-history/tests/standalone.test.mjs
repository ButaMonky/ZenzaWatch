import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {watch,body,comment,response,KEY} from './fixtures.mjs';
const code=fs.readFileSync(new URL('../dist/NicoCommentHistory-Standalone.user.js',import.meta.url),'utf8');
function browser({lock=true,videoChange=false}={}){
 let now=0,calls=0,stored=null,blobText=null;const menus=[],alerts=[],events={};
 const location={origin:'https://www.nicovideo.jp',pathname:'/watch/sm1'};
 const BrowserURL=class extends URL {static createObjectURL(blob){blobText=blob.text();return 'blob:local';}static revokeObjectURL(){}};
 const environment={console:{info:()=>{}},AbortController,TextDecoder,Blob,URL:BrowserURL,setTimeout,clearTimeout,setInterval,clearInterval,
  performance:{now:()=>now+=2000},location,alert:x=>alerts.push(x),prompt:()=>null,
  window:{addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener:()=>{}},
  document:{body:{append:()=>{}},createElement:()=>({click:()=>{},remove:()=>{}})},
  navigator:{locks:{request:async(_name,_options,fn)=>fn(lock?{}:null)}},
  GM_registerMenuCommand:(title,fn)=>menus.push({title,fn}),
  GM_getValue:()=>stored??{schema:'nico-comment-history-settings',version:1,values:{maxPages:1}},
  GM_setValue:(_key,value)=>{stored=value;},
  fetch:async(url,options)=>{
   calls++;
   if(String(url).includes('?responseType=json')){if(videoChange)location.pathname='/watch/sm2';return response(watch());}
   const request=JSON.parse(options.body);
   if(request.additionals.when===undefined)return response({meta:{status:200},data:{threads:[{id:'10',fork:'owner',commentCount:0,comments:[]},...body([comment(1)]).data.threads]}});
   return response(body([comment(2)]));
  },
 };
 vm.runInNewContext(code,environment);
 return {menus,alerts,environment,get calls(){return calls;},get stored(){return stored;},async saved(){return JSON.parse(await blobText);}};
}
test('new bundle is inert on installation and registers five manual menus',()=>{
 const b=browser();assert.equal(b.calls,0);assert.equal(b.menus.length,5);assert(b.menus[0].title.includes('独立取得'));
});
test('manual collection uses metadata and baseline and one history page; export is aggregate-only',async()=>{
 const b=browser();await b.menus[0].fn();assert.equal(b.calls,3);b.menus[2].fn();const r=await b.saved();
 assert.equal(r.version,'0.2.0');assert.equal(r.counts.additionalCount,1);assert.equal(r.counts.normalCount,1);assert.equal(r.network.attempts,3);
 const text=JSON.stringify(r);for(const value of [KEY,'SYNTHETIC_BODY','SYNTHETIC_USER'])assert(!text.includes(value));assert.equal(b.stored,null);
});
test('unavailable cross-tab lock means no network requests',async()=>{
 const b=browser({lock:false});await b.menus[0].fn();assert.equal(b.calls,0);assert(b.alerts.some(x=>x.includes('別タブ')));
});
test('video change after metadata read stops before comment requests',async()=>{
 const b=browser({videoChange:true});await b.menus[0].fn();assert.equal(b.calls,1);b.menus[2].fn();const r=await b.saved();assert.equal(r.error.code,'VIDEO_MISMATCH');
});
test('discard menu removes history but does not mutate normal comments or settings',async()=>{
 const b=browser();await b.menus[0].fn();b.menus[4].fn();b.menus[2].fn();const r=await b.saved();
 assert.equal(r.counts.additionalCount,0);assert.equal(r.counts.normalCount,1);assert.equal(b.stored,null);
});
test('invalid JSON settings are not persisted and do not start network',()=>{
 const b=browser();b.environment.prompt=()=>'{"minIntervalMs":0}';b.menus[3].fn();assert.equal(b.stored,null);assert.equal(b.calls,0);
});
test('standalone bundle includes no remote dependency, body injection or posting endpoint',()=>{
 assert(!code.includes('innerHTML'));assert(!/@require\s+https?:/.test(code));assert(!code.includes('/comment-comment-owner-deletions'));
 assert(!code.includes('/easy-comments'));assert(!code.includes('eval('));
});

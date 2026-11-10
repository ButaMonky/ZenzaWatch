'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');const {JSDOM}=require('jsdom');
function fixture(){const calls=[],events=[];let json={data:{response:{$watchV4:{data:{client:{watchId:'sm9',watchTrackId:'track'},video:{id:'sm9',duration:90},media:{accessRightKey:'synthetic',isStoryboardAvailable:true,contents:{}}}}}}};
const ctx=vm.createContext({exports:{},DOMParser:new JSDOM('').window.DOMParser,CacheStorage:class{},sessionStorage:{},debug:{},Config:{getValue:()=>false},emitter:{emitAsync:(...x)=>events.push(x)},console,AbortController,netUtil:{fetch:async(url,opts)=>{calls.push({url,opts});return {json:async()=>json,status:200};}}});
const js=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/VideoInfoLoader.ts','utf8')).replace(/export \{VideoInfoLoader\};/,'exports.loader=VideoInfoLoader;');vm.runInContext(js,ctx);return {loader:ctx.exports.loader,calls,events,set:x=>json=x};}
describe('Task996 passive storyboard watch metadata',()=>{
it('loads only required metadata without playback events or owner/lazy fetches',async()=>{const h=fixture(),signal=new AbortController().signal;const r=await h.loader.loadStoryboardInfo('sm9',{signal});assert.equal(r.watchId,'sm9');assert.equal(r.domandInfo.accessRightKey,'synthetic');assert.equal(r.duration,90);assert.equal(h.calls.length,1);assert.equal(h.calls[0].opts.signal,signal);assert.deepEqual(h.events,[]);assert.equal(r.comment,undefined);});
it('rejects mismatched video and cancelled callers',async()=>{const h=fixture();h.set({data:{response:{$watchV4:{data:{client:{watchId:'sm8'},video:{id:'sm8',duration:9}}}}}});await assert.rejects(h.loader.loadStoryboardInfo('sm9',{}));const c=new AbortController();c.abort();await assert.rejects(h.loader.loadStoryboardInfo('sm9',{signal:c.signal}),e=>e.reason==='cancelled');});
});

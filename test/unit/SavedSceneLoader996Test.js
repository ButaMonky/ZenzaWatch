'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),{stripTypeScriptTypes}=require('node:module');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function harness(extra={}){const ctx=vm.createContext({exports:{},console,URL,Blob,ArrayBuffer,AbortController,DOMException,setTimeout,clearTimeout,Emitter:class{emit(){}},SeekBarThumbnail:{},StoryboardWorker:{},global:{debug:{}}});for(const name of ['StoryboardInfoModel','Storyboard']){let s=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/'+name+'.ts','utf8'));s=s.replace(/export \{([^}]+)\};/g,(_,ns)=>ns.split(',').map(n=>'exports.'+n.trim()+'='+n.trim()+';').join(''));vm.runInContext(s,ctx);}const calls={meta:0,image:0,put:0,abort:0};const raw={watchId:'sm9',format:'domand',status:'ok',duration:30,storyboard:{thumbnail:{width:160,height:90},columns:3,rows:2,interval:5000,count:6,images:[{url:'https://example.invalid/sheet'}]}};const deps={cache:{captureGeneration:()=>1,getPreview:async()=>null,put:async()=>{calls.put++;}},enabled:()=>true,loadMetadata:async()=>{calls.meta++;return raw;},fetchImage:async()=>{calls.image++;return new ArrayBuffer(8);},...extra};return {loader:new ctx.exports.SavedSceneLoader(deps),calls,raw};}
describe('Task996 visible saved scene requests',()=>{
it('shares metadata and one sheet for two visible points, then releases jobs',async()=>{const h=harness(),a=h.loader.acquire('sm9',2),b=h.loader.acquire('sm9',7);const [x,y]=await Promise.all([a.promise,b.promise]);assert.equal(h.calls.meta,1);assert.equal(h.calls.image,1);assert.equal(x.storyboard.images[0].buffer,y.storyboard.images[0].buffer);a.release();b.release();assert.equal(h.loader.activeResources,0);});
it('aborts hidden requests and never writes cancelled data',async()=>{let signal,finish;const h=harness({loadMetadata:async(id,s)=>{signal=s;return new Promise(r=>finish=r);}}),a=h.loader.acquire('sm9',1);a.promise.catch(()=>{});await flush();a.release();assert.equal(signal.aborted,true);finish(h.raw);await flush();assert.equal(h.calls.image,0);assert.equal(h.calls.put,0);assert.equal(h.loader.activeResources,0);});
it('does not request missing history when disabled',async()=>{const h=harness({enabled:()=>false}),a=h.loader.acquire('sm9',1);assert.equal(await a.promise,null);assert.equal(h.calls.meta,0);a.release();});
});

it('Task996 keeps a shared request alive until its last visible owner closes',async()=>{
 let finish,signal;const h=harness({loadMetadata:async(id,s)=>{signal=s;return new Promise(r=>finish=r);}});
 const a=h.loader.acquire('sm9',1),b=h.loader.acquire('sm9',7);a.promise.catch(()=>{});await flush();a.release();assert.equal(signal.aborted,false);finish(h.raw);await b.promise;assert.equal(h.calls.image,1);b.release();assert.equal(h.loader.activeResources,0);
});
it('Task996 caps background work at two jobs and removes hidden queued work',async()=>{
 const jobs=[];const h=harness({loadMetadata:(id,signal)=>new Promise(resolve=>jobs.push({id,signal,resolve}))});
 const a=h.loader.acquire('sm9',1),b=h.loader.acquire('sm8',1),c=h.loader.acquire('sm7',1);c.promise.catch(()=>{});await flush();assert.equal(jobs.length,2);c.release();
 jobs.forEach(j=>j.resolve({...h.raw,watchId:j.id}));await Promise.all([a.promise,b.promise]);assert.equal(jobs.length,2);a.release();b.release();
});
it('Task996 failed lookups cool down instead of retrying every render',async()=>{
 let count=0;const h=harness({loadMetadata:async()=>{count++;throw Error('offline');}});const a=h.loader.acquire('sm9',1);await assert.rejects(a.promise);a.release();const b=h.loader.acquire('sm9',2);assert.equal(await b.promise,null);assert.equal(count,1);b.release();
});
it('Task996 cached images display even when network is disabled and storage rejects writes',async()=>{
 let h;h=harness({enabled:()=>false,cache:{getPreview:async()=>({...h.raw,storyboard:{...h.raw.storyboard,images:[{url:'https://example.invalid/sheet',buffer:new ArrayBuffer(8)}]}}),put:async()=>{throw Error('quota');}}});const a=h.loader.acquire('sm9',1);assert.equal((await a.promise).storyboard.images[0].buffer.byteLength,8);assert.equal(h.calls.meta,0);a.release();
});

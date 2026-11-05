"use strict";
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
function fixture({local=false,autoComment=false,detectError,remoteError}={}) {
 const calls=[];
 const external={
  deflistAdd:arg=>{calls.push(['add',arg]);return remoteError?Promise.reject(remoteError):Promise.resolve('added')},
  deflistRemove:arg=>{calls.push(['remove',arg]);return remoteError?Promise.reject(remoteError):Promise.resolve('removed')}
 };
 const ctx=createContext({
  config:{props:{mylist:{enableAutoComment:autoComment}}},
  location:{host:local?'www.nicovideo.jp':'search.nicovideo.jp'},
  ZenzaDetector:{detect(){calls.push(['detect']);return detectError?Promise.reject(detectError):Promise.resolve({external})}},
  CsrfTokenLoader:{load(){calls.push(['legacy-token']);return Promise.resolve('unused-legacy-token')}},
  ThumbInfoLoader:{load(id){calls.push(['thumb',id]);return Promise.resolve({owner:{name:'owner',linkId:'user/1'},originalVideoId:''})}},
  MylistApiLoader:{addDeflistItem(...args){calls.push(['local-add',...args]);return Promise.resolve('local-added')},removeDeflistItem(id){calls.push(['local-remove',id]);return Promise.resolve('local-removed')}}
 });
 for(const name of ['deflistAdd','deflistRemove'])run('globalThis.'+name+'='+extract('src/_pocket.js',name,'var'),ctx);
 return {ctx,calls};
}
describe('Pocket modern watch-later bridge avoids obsolete CSRF lookup',()=>{
 for(const method of ['deflistAdd','deflistRemove']) {
  it(method+' reaches the authenticated bridge without an unrelated token fetch',async()=>{
   const h=fixture();await h.ctx[method]('sm9');
   assert(!h.calls.some(x=>x[0]==='legacy-token'));
   const call=h.calls.find(x=>x[0]===(method==='deflistAdd'?'add':'remove'));
   assert.strictEqual(call[1].watchId,'sm9');assert(!('token' in call[1]));
  });
  it(method+' preserves bridge detection rejection without a mutation',async()=>{
   const error=new Error('bridge unavailable'),h=fixture({detectError:error});
   await assert.rejects(h.ctx[method]('sm9'),e=>e===error);
   assert.deepStrictEqual(h.calls,[['detect']]);
  });
  it(method+' preserves the external API rejection',async()=>{
   const error=new Error('operation failed'),h=fixture({remoteError:error});
   await assert.rejects(h.ctx[method]('sm9'),e=>e===error);
  });
 }
 it('retains opt-in description enrichment before external add',async()=>{
  const h=fixture({autoComment:true});await h.ctx.deflistAdd('sm9');
  assert(h.calls.some(x=>x[0]==='thumb'));
  assert(h.calls.find(x=>x[0]==='add')[1].description.includes('owner user/1'));
  assert(!h.calls.some(x=>x[0]==='legacy-token'));
 });
 it('retains direct local add and removal without bridge discovery',async()=>{
  const h=fixture({local:true});await h.ctx.deflistAdd('sm9');await h.ctx.deflistRemove('sm9');
  assert.deepStrictEqual(h.calls,[['local-add','sm9',''],['local-remove','sm9']]);
 });
});

'use strict';
const assert=require('assert');
const {beginSection,createContext,read,run}=require('../helpers/extractSource');

const entry=(page,which='watchLater',count=100,offset=0)=>({
  meta:{status:200},
  data:{[which]:{
    hasNext:page<3,hasInvisibleItems:false,
    items:Array.from({length:count},(_,i)=>({
      watchId:'sm'+(offset+i),itemId:offset+i+1
    }))
  }}
});
function load(source='packages/lib/src/nico/MylistApiLoader.js',reply){
 const calls=[],events=[],c=createContext({
  sessionStorage:{},window:{ZenzaWatch:null},
  CacheStorage:class{getItem(){return null;}setItem(){}removeItem(){}},
  emitter:{on(){},emitAsync:(...a)=>events.push(a)},
  netUtil:{fetch:async(url,options)=>{
   calls.push({url:String(url),options});
   return {json:async()=>options?.method==='DELETE'?{meta:{status:200}}:
     reply(new URL(url),calls.length)};
  }},
  console:{log(){},warn(){},error(){}}
 });
 let code;
 if(source==='packages/lib/src/nico/MylistApiLoader.js'){
   code=beginSection(source);
 }else{
   const text=read(source);
   const start=text.indexOf('const MylistApiLoader = (() => {');
   const end=text.indexOf('\n})();',start);
   assert(start>=0&&end>start,'MylistApiLoader must be bundled in '+source);
   code=text.slice(start,end+'\n})();'.length);
 }
 run(code+';globalThis.subject=MylistApiLoader;',c);
 return {api:c.subject,calls,events};
}
describe('Issue #241 targeted single-item delete and pagination safety',function(){
 this.timeout(20000);
 for(const source of ['packages/lib/src/nico/MylistApiLoader.js',
   'dist/ZenzaWatch-dev.user.js','dist/MylistPocket.user.js']){
  it(source+' deletes a watch-later row on page 1 without enumerating the rest',async()=>{
   const h=load(source,()=>({
     meta:{status:200},data:{watchLater:{hasNext:true,
       items:[{watchId:'smTarget',itemId:876}]}}
   }));
   const result=await h.api.removeDeflistItem('smTarget',{frontendId:11,frontendVersion:2});
   assert.equal(result.status,'ok');
   assert.equal(h.calls.length,2);
   assert(h.calls[0].url.includes('page=1'));
   assert(h.calls[1].url.includes('itemIds=876'));
   assert.equal(h.calls[0].options.headers['X-Frontend-Id'],11);
   assert.equal(h.calls[1].options.headers['X-Frontend-Version'],2);
  });
 }
 it('mylist lookup stops on third page and uses its resolved itemId',async()=>{
  const h=load(undefined,(url)=>{const page=Number(url.searchParams.get('page'));
   const data=entry(page,'mylist',2,page*2);
   if(page===3)data.data.mylist.items.push({watchId:'smTarget',itemId:777});
   return data;
  });
  await h.api.removeMylistItem('smTarget',55);
  assert.equal(h.calls.length,4);
  assert.deepEqual(h.calls.slice(0,3).map(x=>new URL(x.url).searchParams.get('page')),
    ['1','2','3']);
  assert(h.calls[3].url.includes('/mylists/55/items?itemIds=777'));
 });
 it('a finite search without a match reports NOT_FOUND instead of deleting',async()=>{
  const h=load(undefined,()=>({meta:{status:200},
    data:{watchLater:{hasNext:false,items:[{watchId:'smNotIt',itemId:44}]}}}));
  await assert.rejects(h.api.removeDeflistItem('smMissing'),e=>e.code==='NOT_FOUND');
  assert.equal(h.calls.length,1);
 });
 it('a broken repeated page terminates after two fetches, without a DELETE',async()=>{
  const h=load(undefined,()=>({meta:{status:200},
    data:{watchLater:{hasNext:true,items:[{watchId:'smOther',itemId:44}]}}}));
  await assert.rejects(h.api.removeDeflistItem('smMissing'),e=>e.code==='REPEATED_PAGE');
  assert.equal(h.calls.length,2);
 });
 it('hasNext with empty data fails safely and never deletes',async()=>{
  const h=load(undefined,()=>({meta:{status:200},
    data:{mylist:{hasNext:true,items:[]}}}));
  await assert.rejects(h.api.removeMylistItem('smMissing',9),e=>e.code==='INVALID_PAGE');
  assert.equal(h.calls.length,1);
 });
 it('100 pages is a hard cap even when every page has distinct IDs',async()=>{
  const h=load(undefined,(url)=>{
    const page=Number(url.searchParams.get('page'));
    return {meta:{status:200},data:{watchLater:{
      hasNext:true,items:[{watchId:'sm'+page,itemId:page}]}}};
  });
  await assert.rejects(h.api.removeDeflistItem('smMissing'),e=>e.code==='PAGE_LIMIT');
  assert.equal(h.calls.length,100);
 });
 it('a video-switch owner invalidates a resolved lookup before DELETE',async()=>{
  let current=true;
  const h=load(undefined,()=>{current=false;
   return {meta:{status:200},data:{watchLater:{hasNext:true,
     items:[{watchId:'smTarget',itemId:88}]}}};
  });
  await assert.rejects(h.api.removeDeflistItem('smTarget',
    {isCurrent:()=>current}),e=>e.code==='STALE');
  assert.equal(h.calls.length,1);
 });
 it('a rejected 403 or malformed successful payload cannot DELETE',async()=>{
  for(const json of [
    {meta:{status:403},data:{watchLater:{items:[]}}},
    {meta:{status:200},data:{watchLater:{items:null}}},
  ]){
   const h=load(undefined,()=>json);
   await assert.rejects(h.api.removeDeflistItem('smTarget'));
   assert.equal(h.calls.length,1);
  }
 });
 it('existing all-page consumer still collects ordered rows',async()=>{
  const h=load(undefined,(url)=>{const page=Number(url.searchParams.get('page'));
    return {meta:{status:200},data:{mylist:{hasNext:page<2,
      items:[{watchId:'sm'+page,itemId:page}]}}};
  });
  const items=await h.api._getMylistItems(55);
  assert.equal(items.length,2);
  assert.equal(items[0].watchId,'sm1');
  assert.equal(items[1].watchId,'sm2');
  assert.equal(h.calls.length,2);
 });
});

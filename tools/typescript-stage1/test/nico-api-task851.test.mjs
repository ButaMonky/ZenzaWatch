// Task851: parity of the small packages/zenza modules moved to TypeScript (legacy fixture
// vs generated runtime on identical fakes), plus old-vs-new checks for the three fixes.
// The root suite (playlist/related/mymemory/startup/preview tests) also runs these files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};
const flush=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};

async function compare(name,symbol,makeWorld,run,label){
  const out=[];
  for(const k of ['old','new']){
    const w=makeWorld();
    const subject=loadLegacy(pair(name)[k],symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}
const memStorage=log=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,
  setItem:(k,v)=>{log.push(['set',k,v.length]);if(v.length>3000){const e=new Error('q');e.name='QuotaExceededError';throw e;}m.set(k,String(v));},
  removeItem:k=>{log.push(['remove',k]);m.delete(k);},m};};

test('createVideoElement and MylistPocketDetector',{timeout:20000},async()=>{
  for(const variant of ['hls','debug','plain']){
    await compare('createVideoElement','createVideoElement',()=>{const log=[];
      return {log,globals:{window:variant==='hls'?{ZenzaHLS:{createVideoElement:(...a)=>({from:'hls',a})}}:{},
        ZenzaWatch:{debug:variant==='debug'?{createVideoElement:(...a)=>({from:'debug',a})}:{}},
        document:{createElement:t=>({from:'dom',t})}}};},cv=>cv(1,'x'),'createVideoElement '+variant);
  }
  for(const ready of [true,false]){
    await compare('MylistPocketDetector','MylistPocketDetector',()=>{const log=[];const handlers=[];
      const target=name=>({addEventListener:(t,f,o)=>{log.push([name,t,o]);handlers.push(f);}});
      const window=Object.assign(target('window'),ready?{MylistPocket:{isReady:true,id:1}}:{});
      return {log,handlers,window,globals:{window,document:{body:target('body')},Promise}};},
    async(d,w)=>{const p=d.detect();if(!ready){w.window.MylistPocket={id:2};w.handlers[1]();}return [await p,d.detect()===p];},'pocket '+ready);
  }
});

test('initializeExternalSite: google search starts early, bridge failures still start',{timeout:20000},async()=>{
  for(const host of ['www.google.com','www.google.co.jp','example.com']){
    for(const fail of [false,true]){
      await compare('externalStartup','initializeExternalSite',()=>({log:[],globals:{Promise}}),async(init,w)=>{
        await init({host,pathname:'/search',initializePlayer:()=>w.log.push('player'),
          connect:()=>{w.log.push('connect');if(fail)throw new Error('blocked');return 'c';},
          readUser:v=>w.log.push(['user',v]),onError:e=>w.log.push(['error',e.message])});
        return w.log.filter(x=>x==='player').length;
      },`startup ${host} ${fail}`);
    }
  }
});

test('PlayListSession: trim around index, quota fallback, restore',{timeout:20000},async()=>{
  await compare('PlayListSession','PlayListSession',()=>{const log=[];const s=memStorage(log);
    return {log,s,globals:{sessionStorage:s,window:{console:{warn:(...a)=>log.push(['warn',a.length]),error:()=>log.push(['error'])}},
      Object,Math,JSON,Array,parseInt}};},(P,w)=>{
    // Task972 changed the default cap; explicit-limit quota/index behavior stays identical.
    const r=[P.MIN_ITEMS,P.isExist(),P.restore()];
    P.MAX_ITEMS=20;P.MIN_ITEMS=5;
    const items=n=>Array.from({length:n},(_,i)=>({id:'sm'+i,title:'x'.repeat(200)}));
    P.save({items:items(8),index:3});r.push(P.isExist(),P.restore().items.length);
    P.save({items:items(8),index:3});
    P.save({items:items(40),index:'30'});const a=P.restore();r.push(a&&a.items.length,a&&a.index,a&&a.items[0].id);
    P.save(null);P.save({items:'no'});
    w.s.m.set('ZenzaWatchPlaylist','{bad');r.push(P.isExist(),P.restore());
    return r;
  },'session');
});

test('PlayerSession: save/restore/clear/hasRecord',{timeout:20000},async()=>{
  await compare('PlayerSession','PlayerSession',()=>({log:[],globals:{window:{console:{error:()=>{}}},console:{log(){}},JSON}}),(S,w)=>{
    const store={removeItem(k){delete this[k];}};
    S.init(store);const r=[S.hasRecord(),S.restore()];
    S.save({watchId:'sm9',currentTime:3});r.push(S.hasRecord(),S.restore(),S.hasRecord());
    S.save({a:1});S.clear();r.push(S.hasRecord(),S.KEY);
    return r;
  },'player session');
});

// ---- fixes ----
function both(name,symbol,globals,fn){const out={};for(const k of ['old','new']){
  const g=globals();try{out[k]=snapshot(fn(loadLegacy(pair(name)[k],symbol,g.globals),g));}catch(e){out[k]=['threw',e.name];}}return out;}

test('FRAMELAYER-BRIDGE-TYPE-001: bridged events keep their type',async()=>{
  const out={};
  for(const k of ['old','new']){
    const events=[];let observeCb;
    class FakeEvent{constructor(type,init){this.type=String(type);this.init=init;}}
    const iframe={className:'',set srcdoc(v){},contentWindow:{name:'f'},dispatchEvent:e=>events.push(e.type),onload:null};
    const iframeCtor=function(){};iframeCtor.prototype={srcdoc:''};iframe.constructor=iframeCtor;
    const globals={document:{createElement:()=>iframe},IntersectionObserver:class{constructor(f){observeCb=f;}observe(){}},
      CustomEvent:FakeEvent,PromiseHandler:class{constructor(){this.p=new Promise(r=>{this.resolve=r;});}then(...a){return this.p.then(...a);}},
      Object,window:{setTimeout}};
    const FrameLayer=loadLegacy(pair('FrameLayer')[k],'FrameLayer',globals);
    const layer=new FrameLayer({container:{append(){}},html:'<p>',className:'c'});
    iframe.onload();
    layer.bridgeFunc(new FakeEvent('keydown',{key:'a'}));
    observeCb([{isIntersecting:true}]);
    out[k]=events;
  }
  assert.deepEqual(out.old,['[object Object]','visibilitychange']);
  assert.deepEqual(out.new,['keydown','visibilitychange']);
});

test('RELATED-ITEM-GUARD-001: one malformed recommend item no longer empties the list',async()=>{
  const out={};
  for(const k of ['old','new']){
    const updates=[];
    class VideoList{_initializeView(){this.view={scrollTop(){}};}}
    VideoList.prototype.model={setItem:items=>updates.push(items.map(i=>i.id))};
    class VideoListItem{constructor(d){this.id=d.id;}static createByVideoInfoModel(){return {serialize:()=>({id:'self'})};}}
    const ok=id=>({id,contentType:'video',content:{title:'t',duration:1,registeredAt:'r',count:{comment:1,mylist:2,view:3},thumbnail:{url:'u'}}});
    const RecommendAPILoader={load:async()=>({items:[ok('sm1'),{id:'sm2',contentType:'video',content:{title:'no-count'}},{id:'sm3'},ok('sm4')]})};
    const R=loadLegacy(pair('RelatedVideoList')[k],'RelatedVideoList',{VideoList,VideoListItem,RecommendAPILoader,Promise});
    const list=new R();
    out[k]=await list.fetchRecommend('sm0',null,{}).then(()=>updates,e=>['threw',e.name,updates]);
  }
  assert.deepEqual(snapshot(out.old),['threw','TypeError',[['self']]]);
  assert.deepEqual(snapshot(out.new),[['self'],['self','sm1','sm2','sm4']]);
});

test('PLAYERSESSION-RESTORE-001: restore reads storage once and logs the right name',()=>{
  const r=both('PlayerSession','PlayerSession',()=>{const log=[];return {log,globals:{window:{console:{error:(m)=>log.push(m)}},console:{log(){}},JSON}};},(S,g)=>{
    let reads=0;const store=new Proxy({removeItem(){}},{get(t,k){if(k===S.KEY)reads++;return k===S.KEY?'{bad':t[k];}});
    S.init(store);S.restore();return [reads,g.log];});
  assert.deepEqual(r.old,[2,['PlayserSession restore fail: ']]);
  assert.deepEqual(r.new,[1,['PlayerSession restore fail: ']]);
});

// Task726: parity of the infra helpers moved to TypeScript (legacy fixture vs generated runtime).
// Every case runs the same script against both versions with identical fakes and compares
// results plus the recorded side effects. No network, timers are fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=5)=>{for(let i=0;i<n;i++)await Promise.resolve();};

/** Run `run(subject, world)` on both versions; compare result and log. */
async function compare(name,symbol,makeWorld,run,label){
  const [before,after]=pair(name);
  const out=[];
  for(const code of [before,after]){
    const w=makeWorld();
    const subject=loadLegacy(code,symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  // Both sides must actually run: an identical crash would otherwise compare equal.
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}

/** Manual timer queue shared by setTimeout / requestIdleCallback / requestAnimationFrame fakes. */
function timers(log){
  let id=0;const q=new Map();
  const add=kind=>(fn,t)=>{const i=++id;q.set(i,fn);log.push([kind,i,t===undefined?'u':t]);return i;};
  const del=kind=>i=>{log.push([kind,i]);q.delete(i);};
  return {
    setTimeout:add('setTimeout'),clearTimeout:del('clearTimeout'),
    requestIdleCallback:add('rIC'),cancelIdleCallback:del('cancelIC'),
    requestAnimationFrame:add('rAF'),cancelAnimationFrame:del('cancelAF'),
    run(){const items=[...q.entries()];q.clear();for(const [i,fn] of items){log.push(['fire',i]);fn(16);}},
    size:()=>q.size
  };
}

test('sleep: delays, idle factory with/without requestIdleCallback, raf, promise', async()=>{
  for(const hasIdle of [true,false]){
    await compare('sleep','sleep',()=>{
      const log=[];const t=timers(log);
      const win={};if(hasIdle)win.requestIdleCallback=t.requestIdleCallback;
      return {log,t,globals:{window:win,setTimeout:t.setTimeout,requestIdleCallback:t.requestIdleCallback,
        requestAnimationFrame:t.requestAnimationFrame,Promise,Object}};
    },async(sleep,w)=>{
      // sleep.idle changed on purpose in Task787 (SLEEP-IDLE-001); tested in nico-api-task787.
      const a=sleep(30),b=sleep();
      const d=sleep.raf();
      w.t.run();
      return [await a,await b,await d,await sleep.promise(),typeof sleep.resolve.then];
    },'idle='+hasIdle);
  }
});

test('env: user agent and plugin sniffing', async()=>{
  const agents=['Mozilla/5.0 Chrome/120 Safari/537.36 AppleWebKit','Mozilla/5.0 Firefox/130',
    'Mozilla/5.0 Edge/18 Chrome/70 AppleWebKit','Something Else'];
  for(const ua of agents)for(const flash of [true,false]){
    await compare('env','env',()=>({log:[],globals:{navigator:{userAgent:ua,
      mimeTypes:flash?{'application/x-shockwave-flash':{}}:{}}}}),
    env=>[env.hasFlashPlayer(),env.isEdgePC(),env.isFirefox(),env.isWebkit(),env.isChrome()],ua+flash);
  }
});

test('dimport: Function path and <script type=module> fallback (same loader text, cache)', async()=>{
  await compare('dimport','dimport',()=>({log:[],globals:{Function}}),
    d=>typeof d,'Function path');
  await compare('dimport','dimport',()=>{
    const log=[];const win={console:{time:l=>log.push(['time',l]),timeEnd:l=>log.push(['timeEnd',l])}};
    const head={append:s=>log.push(['head.append',s.type,s.dataset.import,s.text])};
    const document={head,createElement:tag=>{
      const s={tag,dataset:{},text:'',append(t){this.text+=t;}};log.push(['createElement',tag]);return s;}};
    return {log,win,globals:{window:win,document,console:{warn:(...a)=>log.push(['warn',...a])},
      Date:{now:()=>1234},Promise,Function:function(){throw Error('CSP');}}};
  },async(d,w)=>{
    const p1=d('https://example.invalid/m.js');
    const p2=d('https://example.invalid/m.js');
    const cb=Object.keys(w.win).filter(k=>k.startsWith('dimport_'));
    w.win[cb[0]]({mod:1});
    return [p1===p2,cb,await p1,Object.keys(w.win)];
  },'fallback');
});

test('speech: speak queueing, cancel while speaking, option copy, voices', async()=>{
  for(const speaking of [false,true]){
    await compare('speech','speech',()=>{
      const log=[];
      class SpeechSynthesisUtterance{constructor(){this.listeners={};}
        addEventListener(t,f,o){log.push(['listen',t,o]);this.listeners[t]=f;}}
      const synth={speaking,cancel:()=>log.push(['cancel']),
        speak:m=>{log.push(['speak',m.text,m.lang,m.rate,'pitch' in m]);m.listeners.end();},
        getVoices:()=>{log.push(['getVoices']);return [{lang:'ja-JP',name:'a'},{lang:'en-US',name:'b'}];}};
      return {log,globals:{window:{speechSynthesis:synth,SpeechSynthesisUtterance},Promise,Object}};
    },async s=>[await s.speak('hello',{lang:'ja-JP',rate:2,other:1}),await s.speak('again'),
      s.voices('ja-JP').map(v=>v.name),s.voices().length,s.voices('xx').length],'speaking='+speaking);
  }
  await compare('speech','speech',()=>({log:[],globals:{window:{},Promise,Object}}),
    async s=>[await s.speak('x'),s.voices()],'no speechSynthesis');
});

test('StorageWriter: plain JSON writes, prototype.js pollution routes objects through the worker', async()=>{
  for(const polluted of [false,true]){
    await compare('StorageWriter','StorageWriter',()=>{
      const log=[];
      const store=name=>({setItem:(k,v)=>log.push([name,k,v])});
      const localStorage=store('local'),sessionStorage=store('session');
      const workerUtil={createCrossMessageWorker:(func,opt)=>{
        log.push(['createWorker',opt]);
        const self={};func(self);
        return {post:async msg=>{log.push(['post',msg.command]);return self.onmessage(msg);}};
      }};
      const ArrayProto=Object.create(Array.prototype);
      const ArrayCtor={prototype:polluted?Object.assign(ArrayProto,{toJSON(){}}):Array.prototype};
      return {log,localStorage,sessionStorage,globals:{window:polluted?{Prototype:{}}:{},Array:ArrayCtor,
        JSON,Symbol,localStorage,sessionStorage,workerUtil,Promise}};
    },async(sw,w)=>{
      const r=[typeof sw.writer,await sw.toJson({a:[1,2]}),await sw.toJson('s'),await sw.toJson(null),
        await sw.toJson({b:1},null,2)];
      w.localStorage[sw.writer]('k1',{x:1});
      w.sessionStorage[sw.writer]('k2',3);
      w.localStorage[sw.writer]('k3',null);
      await flush(10);
      return r;
    },'polluted='+polluted);
  }
});

test('CacheStorage: set/get/expiry/remove/clear/gc/quota retry/broken entries', async()=>{
  const world=(opt={})=>()=>{
    const log=[];
    const storage={};
    let quota=opt.quota||0;
    const s=new Proxy(storage,{set(t,k,v){
      if(typeof k==='string'&&k.includes('_cache_')&&quota>0&&String(v).length>opt.limit){quota--;log.push(['quota',k]);
        throw Object.assign(Error('full'),{name:'QuotaExceededError'});}
      t[k]=v;log.push(['set',k]);return true;}});
    Object.defineProperty(storage,'removeItem',{value:k=>{log.push(['remove',k]);delete storage[k];},enumerable:false});
    Object.defineProperty(storage,'hasOwnProperty',{value:k=>Object.prototype.hasOwnProperty.call(storage,k),enumerable:false});
    const _={debounce:(f,ms)=>{const d=(...a)=>{log.push(['debounced',ms]);return f(...a);};d.cancel=()=>log.push(['cancel']);return d;}};
    let now=1000;
    return {log,s,tick:ms=>{now+=ms;},globals:{PRODUCT:'ZW',_,JSON,Object,Array,Number,isNaN,
      Date:{now:()=>now},Error}};
  };
  await compare('CacheStorage','CacheStorage',world(),async(C,w)=>{
    const c=new C(w.s);
    c.setItem('a',{v:1},500);c.setItem('b','forever');c.setItem('c',0,10);
    const r1=[c.getItem('a'),c.getItem('b'),c.getItem('c'),c.getItem('none')];
    w.tick(100);
    const r2=[c.getItem('a'),c.getItem('c')];
    w.s.ZW_cache_bad='{oops';w.s.ZW_cache_arr='[1]';w.s.ZW_cache_noexp=JSON.stringify({data:1,expiredAt:'x'});
    const r3=[c.getItem('bad'),c.getItem('arr'),c.getItem('noexp')];
    c.gc();c.removeItem('b');c.removeItem('zzz');w.s.other='keep';c.clear();
    return [r1,r2,r3,Object.keys(w.s).sort()];
  },'round trip');
  await compare('CacheStorage','CacheStorage',world({quota:1,limit:60}),async(C,w)=>{
    const c=new C(w.s);
    c.setItem('old',1,1);w.tick(10);
    c.setItem('big','x'.repeat(80));
    return [c.getItem('big'),Object.keys(w.s).sort()];
  },'quota retry');
});

test('MediaSessionApi: metadata, artwork filter, action handlers once, position state', async()=>{
  const world=(withPosition=true)=>()=>{
    const log=[];
    const handlers={};
    const mediaSession={setActionHandler:(n,f)=>{log.push(['handler',n]);handlers[n]=f;}};
    if(withPosition)mediaSession.setPositionState=s=>log.push(['position',s]);
    Object.defineProperty(mediaSession,'metadata',{set:m=>log.push(['metadata',m]),enumerable:true});
    class MediaMetadata{constructor(o){Object.assign(this,o);}}
    class Emitter{constructor(){this.l=[];}on(n,f){this.l.push(f);return 'on';}
      emit(n,...a){log.push(['emit',n,...a]);this.l.forEach(f=>f(...a));}}
    return {log,handlers,globals:{navigator:{mediaSession},self:{MediaMetadata},Emitter,Object,Array}};
  };
  await compare('MediaSessionApi','MediaSessionApi',world(),async(m,w)=>{
    const got=[];m.onCommand((...a)=>got.push(a));
    m.updateByVideoInfo({title:'t',owner:{name:'o'},thumbnail:'th',betterThumbnail:'',largeThumbnail:'L',duration:90});
    m.update({title:'u',artist:'a',album:'',artwork:[{src:' '},null,{src:'ok'},{}],duration:5});
    m.update();
    for(const k of Object.keys(w.handlers))w.handlers[k]({seekTime:12});
    // updatePositionState* changed on purpose in Task781 (MSA-POSITION-001); tested below.
    return got;
  },'with setPositionState');
  await compare('MediaSessionApi','MediaSessionApi',world(false),
    m=>[m.update({title:'x',artist:'',album:'',artwork:null,duration:1}),m.updatePositionState({duration:1})],
    'without setPositionState');
  await compare('MediaSessionApi','MediaSessionApi',()=>{const w=world()();w.globals.navigator={};return w;},
    m=>m.update({title:'x'}),'no mediaSession');
});

test('bounce/throttle: debounce idle/time, throttle time/raf/idle and cancel', async()=>{
  const world=(hasIdle=true)=>()=>{
    const log=[];const t=timers(log);
    class PromiseHandler extends Promise{constructor(){let r;super(res=>{r=res;});this.resolve=r;}
      static get [Symbol.species](){return Promise;}}
    const self={setTimeout:t.setTimeout,clearTimeout:t.clearTimeout};
    if(hasIdle)Object.assign(self,{requestIdleCallback:t.requestIdleCallback,cancelIdleCallback:t.cancelIdleCallback});
    let now=0;
    return {log,t,tick:ms=>{now+=ms;},globals:{PromiseHandler,self,setTimeout:t.setTimeout,clearTimeout:t.clearTimeout,
      requestAnimationFrame:t.requestAnimationFrame,performance:{now:()=>now},Symbol,Math,Promise,
      console:{warn:e=>log.push(['warn',String(e&&e.message)])}}};
  };
  for(const hasIdle of [true,false]){
    await compare('bounce','({bounce, throttle})',world(hasIdle),async({bounce,throttle},w)=>{
      const calls=[];const f=(...a)=>{calls.push(a);return a.length;};
      const d=bounce.idle(f);const p1=d(1);const p2=d(2,3);
      const d2=bounce.time(f,50);d2('t');
      const origin=d[bounce.origin]===f;
      w.t.run();
      const r1=[await p1,p2===p1,origin];
      const th=throttle(f,100);const q1=th('a');const q2=th('b');w.tick(30);w.t.run();
      const r2=[q1===q2,await q1];
      const th2=throttle.time(f);th2('c');th2.cancel();
      const rf=throttle.raf(f);const rp=rf('r1');rf('r2');
      const rf2=throttle.raf(()=>{throw Error('boom');});rf2();
      const rf3=throttle.raf(f);rf3('x');rf3.cancel();
      const id=throttle.idle(f);id('i1');id('i2');
      const id2=throttle.idle(f);id2('j');id2.cancel();
      w.t.run();await flush(10);w.t.run();await flush(10);
      return [r1,r2,await rp,calls];
    },'idle='+hasIdle);
  }
});

test('AntiPrototypeJs: no prototype.js, polluted page builds PureArray once', async()=>{
  await compare('AntiPrototypeJs','AntiPrototypeJs',()=>({log:[],globals:{window:{Array},Promise}}),
    async a=>[(await a())===Array],'clean page');
  await compare('AntiPrototypeJs','AntiPrototypeJs',()=>{
    const log=[];
    const PureArray=function PureArray(){};
    const Arr={prototype:{toJSON(){}}},Str={prototype:{toJSON(){}}};
    const window={Prototype:{},Array:Arr,String:Str};
    const listeners={};
    const document={readyState:'loading',
      getElementsByClassName:{toString:()=>'function(B,A){}'},
      addEventListener:(t,f,o)=>{log.push(['docListen',t,o]);listeners[t]=f;},
      createElement:tag=>{log.push(['createElement',tag]);return {style:{},remove(){log.push(['iframe.remove']);},
        contentWindow:{Array:PureArray}};},
      body:{append:f=>{log.push(['body.append',f.id,f.srcdoc,f.loading,f.style]);setTimeout(()=>f.onload(),0);}}};
    return {log,listeners,window,globals:{window,document,Object,Promise,setTimeout,
      console:{error:e=>log.push(['error',String(e)])}}};
  },async(a,w)=>{
    const p=a();const p2=a();
    w.listeners.DOMContentLoaded();
    const r=await p;
    return [p===p2,r&&r.name,'getElementsByClassName' in w.globals.document,
      'toJSON' in w.window.Array.prototype,'toJSON' in w.window.String.prototype,(await a())===r];
  },'polluted page');
});

// Task781: intentional MediaSessionApi fixes. Old and new run side by side; the
// assertions state the difference that was fixed.
function mediaWorld({throwOn=null,noSession=false}={}){
  const log=[];
  const mediaSession={setActionHandler(){},
    setPositionState:s=>{
      if(throwOn&&throwOn(s))throw new TypeError('invalid position state');
      log.push(Object.assign({},s));
    }};
  class MediaMetadata{constructor(o){Object.assign(this,o);}}
  class Emitter{on(){}emit(){}}
  return {log,globals:{navigator:noSession?{}:{mediaSession},self:{MediaMetadata},Emitter,Object,Array,Number,Math}};
}
const loadMedia=(code,w)=>loadLegacy(code,'MediaSessionApi',w.globals);
// What browsers do: reject a non-finite duration, a position past the end, a zero rate.
const strict=s=>!Number.isFinite(s.duration)||s.duration<0||s.playbackRate===0||
  (s.position!==undefined&&(s.position<0||s.position>s.duration));

test('Task781 MSA-POSITION-001: the playback position reaches the OS as `position`',()=>{
  const [before,after]=pair('MediaSessionApi');
  const a=mediaWorld(),b=mediaWorld();
  loadMedia(before,a).updatePositionStateByMedia({duration:120,playbackRate:1.25,currentTime:42});
  loadMedia(after,b).updatePositionStateByMedia({duration:120,playbackRate:1.25,currentTime:42});
  assert.deepEqual(a.log,[{duration:120,playbackRate:1.25,currentTime:42}],'legacy sent an ignored field');
  assert.deepEqual(b.log,[{duration:120,playbackRate:1.25,position:42}]);
});

test('Task781 MSA-POSITION-001: invalid states are clamped or skipped instead of throwing',()=>{
  const [before,after]=pair('MediaSessionApi');
  const cases=[
    {duration:NaN,playbackRate:1,currentTime:0},
    {duration:Infinity,playbackRate:1,currentTime:5},
    {duration:60,playbackRate:1,currentTime:75},
    {duration:60,playbackRate:0,currentTime:10},
    {duration:60,playbackRate:1,currentTime:-3},
    {duration:60,playbackRate:1,currentTime:NaN}
  ];
  const a=mediaWorld({throwOn:strict}),b=mediaWorld({throwOn:strict});
  const A=loadMedia(before,a),B=loadMedia(after,b);
  // Legacy: NaN/Infinity durations and a zero rate throw out of the player code paths.
  const legacyThrows=cases.map(c=>{try{A.updatePositionState(c);return false;}catch(e){return true;}});
  assert.deepEqual(legacyThrows,[true,true,false,true,false,false]);
  for(const c of cases)B.updatePositionState(c);
  assert.deepEqual(b.log,[
    {duration:60,playbackRate:1,position:60},
    {duration:60,playbackRate:1,position:10},
    {duration:60,playbackRate:1,position:0},
    {duration:60,playbackRate:1,position:0}
  ]);
});

test('Task781: a browser rejection is swallowed; update() skips an unusable duration',()=>{
  const [,after]=pair('MediaSessionApi');
  const b=mediaWorld({throwOn:()=>true});
  const B=loadMedia(after,b);
  B.updatePositionState({duration:10,playbackRate:1,currentTime:1});
  B.update({title:'t',artist:'',album:'',artwork:[],duration:NaN});
  assert.deepEqual(b.log,[]);
});

test('Task781 MSA-NOSESSION-002: no mediaSession no longer throws from updatePositionState',()=>{
  const [before,after]=pair('MediaSessionApi');
  const A=loadMedia(before,mediaWorld({noSession:true})),B=loadMedia(after,mediaWorld({noSession:true}));
  // The VM realm has its own TypeError constructor: match by name.
  assert.throws(()=>A.updatePositionState({duration:1,playbackRate:1,currentTime:0}),{name:'TypeError'});
  assert.doesNotThrow(()=>B.updatePositionState({duration:1,playbackRate:1,currentTime:0}));
});

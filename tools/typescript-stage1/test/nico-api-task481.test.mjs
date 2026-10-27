// Task481: GateAPI parity — receiving side of the cross-domain gates.
// Pre-migration fixture vs generated runtime; every side effect is snapshotted at call time.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.GateAPI;
const before=read(spec.fixture),after=read(spec.runtime);
const tick=()=>new Promise(r=>setTimeout(r,10));

function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const listeners={};const windowListeners={};const channels=[];
  const store=new Map(Object.entries(opt.storage||{}));
  const localStorage=new Proxy({
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>{L('ls.set',k,v);store.set(k,String(v));},
    hasOwnProperty:k=>store.has(k)
  },{get:(t,k)=>k in t?t[k]:(store.has(k)?store.get(k):undefined)});
  const gateFake=()=>({
    post:(body,opts)=>L('post',body,opts),
    parseUrl:u=>{const x=new URL(u||'https://unknown.example.com/');return {hostname:x.hostname,pathname:x.pathname};},
    xFetch:(params,sid)=>L('xFetch',params,sid),
    uFetch:params=>{L('uFetch',params);return opt.uFetch?opt.uFetch():Promise.resolve({text:async()=>'<xml/>'});},
    init:({prefix,type})=>{L('init',prefix,type);return {port:{addEventListener:(t,cb)=>{listeners[prefix]=cb;}},TOKEN:'TKN',PID:7,type};}
  });
  const dbStore=new Map(Object.entries(opt.thumbCache||{}));
  const ThumbInfoCacheDb={open:async()=>{
    if(opt.dbFails)throw Error('no idb');
    return {get:async id=>{L('db.get',id);return dbStore.get(id);},put:async(x,i)=>{L('db.put',x,i);}};
  }};
  const stores={};
  const IndexedDbStorage={open:async({name,ver,stores:s})=>{
    L('idb.open',name,ver,s);
    const mk=n=>({close:async()=>L(n,'close'),put:async(d,t)=>L(n,'put',d,t),get:async q=>{L(n,'get',q);return {hit:q.key};},
      update:async d=>{L(n,'update',d);return 'u';},updateTime:async q=>{L(n,'updateTime',q);return 't';},
      delete:async q=>L(n,'delete',q),gc:async(e,i)=>L(n,'gc',e,i)});
    return stores[name]={video:mk('video'),comment:mk('comment')};
  }};
  class BroadcastChannel{
    constructor(name){L('bc.new',name);this.name=name;channels.push(this);}
    addEventListener(t,cb){this.cb=cb;}
    postMessage(m){L('bc.post',m);}
  }
  const elements=[];
  const document={
    createElement:tag=>{
      const el={tag,listeners:{},addEventListener(t,cb){this.listeners[t]=cb;},remove(){L('remove',tag);},
        getContext:()=>({drawImage:(v,x,y)=>L('drawImage',v.tag,x,y)}),toDataURL:t=>'data:'+t,videoWidth:640,videoHeight:360};
      elements.push(el);return el;
    },
    body:{append:v=>{L('append',v.tag,v.volume,v.autoplay,v.controls);
      queueMicrotask(()=>{if(opt.captureFails)v.listeners.error({type:'error'});else v.listeners.seeked();});}}
  };
  const window={
    ZenzaLib:{parseThumbInfo:x=>{L('parse',x);return opt.parse||{status:'ok',id:'sm9'};},IndexedDbStorage},
    history:{replaceState:(s,t,p)=>L('replaceState',s,t,p)},
    BroadcastChannel:opt.noBroadcast?undefined:BroadcastChannel,
    addEventListener:(t,cb)=>{windowListeners[t]=cb;},
    name:'nicovideoApiZenzaWatchLoader',
    console:{info:(...a)=>L('info',...a),error:(...a)=>L('error',...a),log:(...a)=>L('wlog',...a)}
  };
  const console={log:(...a)=>L('log',...a),warn:(...a)=>L('warn',...a),error:(...a)=>L('error',...a)};
  const location={host:opt.host||'www.nicovideo.jp',href:'https://'+(opt.host||'www.nicovideo.jp')+'/robots.txt'};
  let VmPromise=Promise;
  if(opt.trackRejections){
    let attaching=false;
    VmPromise=class RecordingPromise extends Promise{
      constructor(executor){
        super(executor);
        if(!attaching){
          attaching=true;
          try{this.then(undefined,reason=>L('rejection',reason));}finally{attaching=false;}
        }
      }
    };
  }
  const globals={gate:gateFake,ThumbInfoCacheDb,PRODUCT:'ZenzaWatch',window,document,console,location,localStorage,
    Date:{now:()=>1000},JSON,Promise:VmPromise,Object,Error};
  return {globals,log,listeners,windowListeners,channels};
}
const msg=(command,params={},token='TKN',sessionId='S1',asString=false)=>{
  const data={body:{command,params},sessionId,token};
  return {data:asString?JSON.stringify(data):data,origin:'https://www.nicovideo.jp'};
};
async function compare(label,opt,start,events){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,'GateAPI',a.globals),B=loadLegacy(after,'GateAPI',b.globals);
  await start(A);await start(B);await tick();
  for(const [i,ev] of events.entries()){
    await ev(a);await ev(b);await tick();
    assert.deepEqual(b.log,a.log,`${label} after event ${i}`);
  }
  assert.deepEqual(b.log,a.log,label);
}
const send=(prefix,m)=>w=>w.listeners[prefix]&&w.listeners[prefix](m);

test('thumbInfo gate: guards, cache freshness, parse/fetch fallbacks',async()=>{
  const P='thumbInfoZenzaWatchLoader',url=id=>`https://ext.nicovideo.jp/api/getthumbinfo/${id}`;
  const fresh={sm9:{thumbInfo:{status:'ok',v:'cached'},updatedAt:999}};
  await compare('guards',{host:'ext.nicovideo.jp'},g=>g.thumbInfo(),[
    send(P,msg('other',{url:url('sm9')})),
    send(P,msg('fetch',{url:url('sm9')},'BAD')),
    send(P,msg('fetch',{url:'https://evil.example/api/getthumbinfo/sm9'})),
    send(P,msg('fetch',{url:'https://ext.nicovideo.jp/other/sm9'}))
  ]);
  await compare('fresh cache',{host:'ext.nicovideo.jp',thumbCache:fresh},g=>g.thumbInfo(),
    [send(P,msg('fetch',{url:url('sm9'),options:{expireTime:100}},'TKN','S2',true))]);
  await compare('stale cache refetch ok',{host:'ext.nicovideo.jp',thumbCache:fresh},g=>g.thumbInfo(),
    [send(P,msg('fetch',{url:url('sm9'),options:{expireTime:-5000,credentials:'include'}}))]);
  await compare('parse fails, cache used',{host:'ext.nicovideo.jp',thumbCache:{sm9:{thumbInfo:{status:'ok'},updatedAt:0}},parse:{status:'fail'}},
    g=>g.thumbInfo(),[send(P,msg('fetch',{url:url('sm9')}))]);
  await compare('fetch fails with cache',{host:'ext.nicovideo.jp',thumbCache:{sm9:{thumbInfo:{status:'ok'},updatedAt:0}},
    uFetch:()=>Promise.reject({status:'fail',message:'net'})},g=>g.thumbInfo(),[send(P,msg('fetch',{url:url('sm9')}))]);
  await compare('fetch fails without cache',{host:'ext.nicovideo.jp',uFetch:()=>Promise.reject({status:'fail',message:'net'})},
    g=>g.thumbInfo(),[send(P,msg('fetch',{url:url('sm1')}))]);
  await compare('db unavailable',{host:'ext.nicovideo.jp',dbFails:true},g=>g.thumbInfo(),[send(P,msg('fetch',{url:url('sm1')}))]);
});

test('nicovideo gate: commands, config, history, IndexedDB bridge, broadcast',async()=>{
  const P='nicovideoApiZenzaWatchLoader';
  const storage={ZenzaWatch_volume:'0.5',ZenzaWatch_bad:'{oops',Other_x:'1'};
  await compare('commands with BroadcastChannel',{storage},g=>g.nicovideo(),[
    send(P,msg('fetch',{url:'https://www.nicovideo.jp/x'},'BAD')),
    w=>w.channels[0].cb({data:{body:{command:'configSync',params:{key:'a',value:1}}}}),
    send(P,msg('ok')),
    send(P,msg('fetch',{url:'https://www.nicovideo.jp/x'})),
    send(P,msg('dumpConfig',{keys:['volume','bad','missing'],command:'dumpConfig'})),
    send(P,msg('dumpConfig',{prefix:'Other',keys:['x']})),
    send(P,msg('dumpConfig',{})),
    send(P,msg('saveConfig',{key:'volume',value:0.8})),
    send(P,msg('saveConfig',{key:'volume',value:0.8})),
    send(P,msg('saveConfig',{prefix:'Other',key:'y',value:{a:1}})),
    send(P,msg('saveConfig',{value:1})),
    send(P,msg('pushHistory',{path:'/watch/sm9',title:'t'})),
    send(P,msg('pushHistory',{path:'/watch/sm1'})),
    send(P,msg('bridge-db',{command:'open',params:{name:'cache',ver:2,stores:['video']}})),
    send(P,msg('bridge-db',{command:'get',params:{name:'cache',storeName:'video',data:{key:'k',index:'i',timeout:5}}})),
    send(P,msg('bridge-db',{command:'put',params:{name:'cache',storeName:'video',transfer:[1],data:{key:'k',v:1}}})),
    send(P,msg('bridge-db',{command:'update',params:{name:'cache',storeName:'video',data:{key:'k'}}})),
    send(P,msg('bridge-db',{command:'updateTime',params:{name:'cache',storeName:'video',data:{key:'k'}}})),
    send(P,msg('bridge-db',{command:'delete',params:{name:'cache',storeName:'video',data:{key:'k'}}})),
    send(P,msg('bridge-db',{command:'gc',params:{name:'cache',storeName:'video',data:{expireTime:10,index:'ix'}}})),
    send(P,msg('bridge-db',{command:'close',params:{name:'cache',storeName:'video',data:{}}})),
    send(P,msg('bridge-db',{command:'get',params:{name:'nope',storeName:'video',data:{}}})),
    send(P,msg('message',{command:'hello'})),
    send(P,msg('ping',{now:400})),
    send(P,msg('unknown',{})),
    send(P,msg('dumpConfig',{keys:'not-an-array'})),
    w=>w.channels[0].cb({data:{body:{command:'configSync',params:{key:'rule',value:{x:1}}}}}),
    w=>w.channels[0].cb({data:JSON.stringify({body:{command:'configSync',params:{key:'',value:1}}})}),
    w=>w.channels[0].cb({data:'{broken'}),
    w=>w.channels[0].cb({data:{body:{command:'message',params:{command:'play'}},sessionId:'S9'}}),
    w=>w.channels[0].cb({data:{body:{command:'message',params:{}}}}),
    w=>w.channels[0].cb({data:{body:'x'}})
  ]);
  await compare('storage events without BroadcastChannel',{noBroadcast:true},g=>g.nicovideo(),[
    w=>w.windowListeners.storage({type:'storage',key:'ZenzaWatch_volume',oldValue:'1',newValue:'2'}),
    send(P,msg('ok')),
    w=>w.windowListeners.storage({type:'storage',key:'ZenzaWatch_volume',oldValue:'1',newValue:'2'}),
    w=>w.windowListeners.storage({type:'storage',key:'ZenzaWatch_volume',oldValue:'2',newValue:'2'}),
    w=>w.windowListeners.storage({type:'storage',key:'ZenzaWatch_bad',oldValue:'1',newValue:'{x'}),
    w=>w.windowListeners.storage({type:'storage',key:'Other_volume',oldValue:'1',newValue:'2'}),
    w=>w.windowListeners.storage({type:'storage',key:'ZenzaWatch_message',oldValue:null,newValue:JSON.stringify({body:{sessionId:'Q',x:1}})}),
    w=>w.windowListeners.storage({type:'storage',key:null,oldValue:null,newValue:'1'}),
    send(P,msg('message',{command:'nobody-listens'})),
    send(P,msg('saveConfig',{key:'volume',value:3}))
  ]);
});

test('smile / search / nicodic gates: guards and forwarding',async()=>{
  await compare('smile capture',{host:'smile-cls30.nicovideo.jp'},g=>g.smile(),[
    send('storyboardZenzaWatch',msg('fetch',{})),
    send('storyboardZenzaWatch',msg('videoCapture',{src:'s',sec:3},'BAD')),
    send('storyboardZenzaWatch',msg('videoCapture',{src:'https://smile/v.mp4',sec:12}))
  ]);
  // Task641 (GATE-CAPTURE-REJECT-002): the legacy gate left a failed capture as an
  // unhandled rejection and never answered the session (caller waited 60s). The fixed
  // gate posts {status:'fail'} for the same session and leaves no unhandled rejection.
  // The VM gets a Promise subclass that records rejections and marks them handled.
  {
    const opt={host:'smile-pow-01.nicovideo.jp',captureFails:true,trackRejections:true};
    const run=async(src,o=opt)=>{
      const w=world(o);const g=loadLegacy(src,'GateAPI',w.globals);
      g.smile();await tick();
      await send('storyboardZenzaWatch',msg('videoCapture',{src:'x',sec:1},'TKN','S9'))(w);await tick();
      return w.log;
    };
    const legacy=await run(before),fixed=await run(after);
    const posts=l=>l.filter(e=>e[0]==='post');
    assert.equal(posts(legacy).length,0,'legacy never answered');
    assert.ok(legacy.some(e=>e[0]==='rejection'),'legacy capture rejected');
    assert.deepEqual(posts(fixed),[['post',{status:'fail',command:'videoCapture',params:{message:'videoCapture fail'}},{sessionId:'S9'}]]);
    // The only remaining rejection is videoCapture's own promise, now handled by .catch.
    assert.equal(fixed.filter(e=>e[0]==='rejection').length,legacy.filter(e=>e[0]==='rejection').length);
    assert.deepEqual(fixed.filter(e=>e[0]!=='post'),legacy,'all other side effects unchanged');
    // With the real Promise an unhandled rejection would fail this node:test run.
    const plain=await run(after,{host:opt.host,captureFails:true});
    assert.equal(plain.filter(e=>e[0]==='post').length,1);
  }
  const S='searchApiZenzaWatchLoader';
  await compare('search',{host:'snapshot.search.nicovideo.jp'},g=>g.search(),[
    send(S,msg('other',{})),
    send(S,msg('fetch',{url:'https://snapshot.search.nicovideo.jp/api'},'BAD')),
    send(S,msg('fetch',{url:'https://evil.example/api'})),
    send(S,msg('fetch',{url:'https://snapshot.search.nicovideo.jp/api/v2',options:{credentials:'include',a:1}})),
    send(S,msg('fetch',{url:'https://snapshot.search.nicovideo.jp/api/v2'}))
  ]);
  const D='nicodicZenzaWatchLoader';
  await compare('nicodic',{host:'dic.nicovideo.jp'},g=>g.nicodic(),[
    send(D,msg('fetch',{url:'https://dic.nicovideo.jp/b/a/x'})),
    send(D,msg('fetch',{url:'https://dic.nicovideo.jp/a/東方'},'BAD')),
    send(D,msg('fetch',{url:'https://dic.nicovideo.jp/a/%E6%9D%B1',options:{credentials:'include'}},'TKN','S3',true))
  ]);
});

test('Task641: boot.js only dispatches to gates GateAPI provides (GATE-EXAPI-001)',async()=>{
  const {readFileSync}=await import('node:fs');
  const boot=readFileSync(new URL('../../../src/boot.js',import.meta.url),'utf8');
  const w=world({host:'ext.nicovideo.jp'});
  const g=loadLegacy(after,'GateAPI',w.globals);
  const called=[...boot.matchAll(/GateAPI\.([A-Za-z_$]+)\(/g)].map(m=>m[1]);
  assert.ok(called.length>=5,'boot.js dispatch found');
  for(const name of called)assert.equal(typeof g[name],'function',`GateAPI.${name} exists`);
  assert.doesNotMatch(boot,/exApi|videoInfo\$\{PRODUCT\}Loader/);
});

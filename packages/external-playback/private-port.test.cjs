const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {createPrivateTransport}=require('./private-port.cjs');
function store(){const values=new Map(),listeners=new Map();let seq=0;
 return {values,listeners,get:k=>values.get(k),set(k,v){const old=values.get(k);values.set(k,structuredClone(v));
   for(const [key,fn] of [...listeners.values()])if(key===k)queueMicrotask(()=>fn(k,old,structuredClone(v),true));},
 remove(k){values.delete(k);},listen(k,fn){listeners.set(++seq,[k,fn]);return seq;},unlisten:id=>listeners.delete(id)};
}
const tick=()=>new Promise(r=>setTimeout(r,20));
test('private port round trips buffers, ignores replay, cleans transient account data',async()=>{
 const gm=store(),w=new JSDOM('',{url:'https://example.org/'}).window;
 w.postMessage=()=>{throw Error('Must never expose packets to page');};
 const t=createPrivateTransport(w,gm),p=t.port('random-private-channel','parent'),f=t.port('random-private-channel','frame');
 const messages=[];f.addEventListener('message',e=>messages.push(e.data));
 p.postMessage({body:{method:'POST'},buffer:new w.Uint8Array([1,2,3]).buffer});await tick();
 assert.equal(messages.length,1);assert.deepEqual([...new w.Uint8Array(messages[0].buffer)],[1,2,3]);
 assert.equal(gm.values.size,0);
 gm.set('random-private-channel:p',{seq:1,data:'replay'});await tick();assert.equal(messages.length,1);
 p.close();f.close();assert.equal(gm.values.size,0);w.close();
});
test('origin alone or arbitrary frame token cannot authorize a bridge',()=>{
 const gm=store(),w={name:'nicovideoApiZenzaWatchExternalTrialLoader#https://example.org',top:{},
  location:{hash:'#fake',origin:'https://www.nicovideo.jp'},document:{referrer:'https://example.org/'},addEventListener(){}};
 const t=createPrivateTransport(w,gm);assert.equal(t.acceptFrame(),false);assert.equal(t.isEnabledOrigin('https://example.org'),false);
 gm.set('ticket:nicovideoApi:fake',{type:'nicovideoApi',origin:'https://example.org',frameOrigin:'https://www.nicovideo.jp',expires:Date.now()-1});
 assert.equal(t.acceptFrame(),false);
});
test('one private ticket bootstraps the existing gate without a DOM message or transferred port',async()=>{
 const gm=store(),w=new JSDOM('',{url:'https://example.org/'}).window;let active,initialized=0;
 w.postMessage=()=>{throw Error('Unexpected page message');};
 const parent=createPrivateTransport(w,gm);
 const gate={_type:'nicovideoApi',_baseUrl:'https://www.nicovideo.jp/robots.txt',_generation:1,
  _onMessage(e){initialized++;active=e.ports[0];this._initializeStatus='done';},_disconnect(){}};
 parent.connectGate(gate,'testToken','ZenzaWatchExternalTrial');
 const fw={name:gate.loaderFrame.name,top:{},location:{hash:'#testToken',origin:'https://www.nicovideo.jp'},
  document:{referrer:'https://example.org/'},addEventListener(){},ArrayBuffer:w.ArrayBuffer,Uint8Array:w.Uint8Array,Date:w.Date,Blob:w.Blob};
 const frame=createPrivateTransport(fw,gm);assert.equal(frame.acceptFrame(),true);
 assert.equal(createPrivateTransport(fw,gm).acceptFrame(),false,'ticket cannot be reused');
 const fp=frame.postGate({status:'ok',command:'initialized'},{type:'nicovideoApi',token:'testToken'});await tick();
 assert.equal(initialized,1);assert.ok(active);assert.equal(gm.values.size,0);
 const got=[];fp.addEventListener('message',e=>got.push(e.data));active.postMessage({body:{command:'fetch'}});await tick();
 assert.equal(got[0].body.command,'fetch');assert.equal(gm.values.size,0);
 active.close();fp.close();gate._frameObserver.disconnect();w.close();
});

test('disposing a player releases GM listeners and cancels queued packets without pagehide',async()=>{
 const gm=store(),w=new JSDOM('',{url:'https://example.org/'}).window;
 const t=createPrivateTransport(w,gm),p=t.port('closing','parent'),f=t.port('closing','frame');
 p.postMessage({large:[1,2,3]});t.dispose();await tick();
 assert.equal(gm.listeners.size,0);assert.equal(gm.values.size,0);
 t.dispose();w.close();
});

test('peer close releases detached loader listeners without waiting for pagehide',async()=>{
 const gm=store(),w=new JSDOM('',{url:'https://example.org/'}).window;
 const parent=createPrivateTransport(w,gm),child=createPrivateTransport(w,gm);
 const p=parent.port('peer-close','parent');child.port('peer-close','frame');
 assert.equal(gm.listeners.size,2);p.close();await tick();
 assert.equal(gm.listeners.size,0);assert.equal(gm.values.size,0);
 parent.dispose();child.dispose();w.close();
});

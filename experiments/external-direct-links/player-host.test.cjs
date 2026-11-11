const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {createPlayerHost}=require('./player-host.cjs');
test('player lives in a separate Nico document; private messages open and close it',async()=>{
 const parent=new JSDOM('<style>button{width:900px}h1{border:20px solid red}</style>',{url:'https://example.org/'}).window;
 const values=new Map(),channels=new Map();
 const gm={get:k=>values.get(k),set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
 const transport={port(channel,side){const listeners=[];const pair=channels.get(channel)||{};channels.set(channel,pair);pair[side]=listeners;return {addEventListener:(_,f)=>listeners.push(f),postMessage:data=>queueMicrotask(()=>{for(const f of pair[side==='parent'?'frame':'parent']||[])f({data});}),close(){pair[side]=[];}};}};
 const host=createPlayerHost(parent,gm,transport,{});
 await assert.rejects(host.open('sm9',{isTrusted:false}));assert.equal(parent.document.querySelector('iframe'),null);
 const opened=host.open('sm9',{isTrusted:true});const frame=parent.document.querySelector('iframe');
 assert.equal(new URL(frame.src).origin,'https://www.nicovideo.jp');assert.equal(parent.document.querySelector('.zenzaPlayerContainer'),null);
 const childDom=new JSDOM('<pre>robots</pre>',{url:frame.src,referrer:'https://example.org/'});
 let id;const child={document:childDom.window.document,location:childDom.window.location,name:frame.name,top:{},addEventListener(){}};
 const worker=createPlayerHost(child,gm,transport,{open:async value=>{id=value;}});
 assert.equal(worker.accept(),true);await opened;assert.equal(id,'sm9');assert.equal(child.document.querySelector('pre'),null);
 assert.equal(child.document.querySelector('style'),null);assert.equal(worker.accept(),false);
 worker.close();await new Promise(r=>setImmediate(r));assert.equal(parent.document.querySelector('iframe'),null);
 parent.close();childDom.window.close();
});

test('repeated real private-channel closes leave no retained listener and allow reopening',async()=>{
 const {createPrivateTransport}=require('./private-port.cjs');
 const parent=new JSDOM('',{url:'https://example.org/'}).window;
 const values=new Map(),listeners=new Map();let next=0;
 const gm={get:k=>values.get(k),remove:k=>values.delete(k),listen:(k,fn)=>{listeners.set(++next,[k,fn]);return next;},unlisten:id=>listeners.delete(id),
  set(k,v){const old=values.get(k);values.set(k,v);for(const [key,fn] of [...listeners.values()])if(key===k)queueMicrotask(()=>fn(k,old,v,true));}};
 const transport=createPrivateTransport(parent,gm),host=createPlayerHost(parent,gm,transport,{});
 for(let i=0;i<3;i++){
  const opened=host.open('sm9',{isTrusted:true}),frame=parent.document.querySelector('iframe');
  const dom=new JSDOM('',{url:frame.src,referrer:'https://example.org/'}),cw=dom.window;
  const child={document:cw.document,location:cw.location,name:frame.name,top:{},addEventListener(){},ArrayBuffer:cw.ArrayBuffer,Uint8Array:cw.Uint8Array,Date:cw.Date,Blob:cw.Blob};
  const childTransport=createPrivateTransport(child,gm),worker=createPlayerHost(child,gm,childTransport,{open:async()=>{}});
  assert(worker.accept());await opened;assert.equal(listeners.size,2);
  await worker.close();await new Promise(r=>setImmediate(r));
  assert.equal(parent.document.querySelector('iframe'),null);assert.equal(listeners.size,0);assert.equal(values.size,0);dom.window.close();
 }
 transport.dispose();parent.close();
});

test('transport termination removes the host even if the semantic closed message is lost',async()=>{
 const parent=new JSDOM('',{url:'https://example.org/'}).window;
 let remoteClose,listener,closed=0;
 const gm={set(){},remove(){}};
 const transport={port(_channel,_side,onClose){remoteClose=onClose;return {addEventListener(_name,fn){listener=fn;},postMessage(){},close(){closed++;}};}};
 const host=createPlayerHost(parent,gm,transport,{});
 const pending=host.open('sm9',{isTrusted:true});listener({data:{type:'opened',requestId:1}});await pending;
 assert(parent.document.querySelector('iframe'));
 assert.equal(typeof remoteClose,'function','termination must be wired to host teardown');remoteClose();
 assert.equal(parent.document.querySelector('iframe'),null);assert.equal(closed,1);parent.close();
});

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

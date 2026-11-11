const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {frameTopologyChanged}=require('./panel-observer.cjs');
test('ordinary panel updates do not rescan frames; inserted and removed frames still do',async()=>{
 const w=new JSDOM('<div id="panel"></div>').window;let scans=0;
 const observer=new w.MutationObserver(records=>{if(frameTopologyChanged(records))scans++;});observer.observe(w.document.body,{childList:true,subtree:true});
 const tick=()=>new Promise(resolve=>w.setTimeout(resolve,0));
 try{
   const panel=w.document.getElementById('panel');for(let i=0;i<20;i++){panel.textContent=String(i);await tick();}
   assert.equal(scans,0);const host=w.document.createElement('div');host.append(w.document.createElement('iframe'));panel.append(host);await tick();assert.equal(scans,1);
   host.remove();await tick();assert.equal(scans,2);
 }finally{observer.disconnect();w.close();}
});

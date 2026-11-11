// Offline call-count reproduction, not a browser timing benchmark.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
async function run(){
 const source=fs.readFileSync(path.join(__dirname,'../../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js'),'utf8');
 const start=source.indexOf('  _listen(){'),end=source.indexOf('  _unlisten(){',start);
 assert.ok(start>0&&end>start);
 const method=Function('return ({'+source.slice(start,end)+'})')()._listen;
 const w=new JSDOM('<div id="unrelated"></div><iframe></iframe>',{url:'https://www.nicovideo.jp/robots.txt'}).window;
 let scans=0;const original=w.document.querySelectorAll.bind(w.document);
 w.document.querySelectorAll=(selector)=>{if(selector==='iframe')scans++;return original(selector);};
 const panel={win:w,doc:w.document,listeners:[],onOutside(){},onEscape(){},_listen:method};
 const observer=new w.MutationObserver(()=>panel._listen());
 observer.observe(w.document.body,{childList:true,subtree:true});
 try{
   for(let i=0;i<20;i++){
     const element=w.document.createElement('span');w.document.getElementById('unrelated').replaceChildren(element);
     await new Promise(resolve=>w.setTimeout(resolve,0));
   }
   assert.equal(scans,20);
   assert.equal(panel.listeners.length,2,'listeners themselves are deduplicated');
   console.log(JSON.stringify({unrelatedMutationBatches:20,fullDocumentIframeScans:scans,attachedWindows:panel.listeners.length,note:'call counts only; no real-browser duration measurement'}));
 }finally{observer.disconnect();w.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});

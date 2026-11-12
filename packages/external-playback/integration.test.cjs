const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {sendBlogClick,receiveBlogClicks}=require('./generated/blog-clicks');
const {watchLegacyTrial}=require('./generated/coexistence');
test('embed bridge requires a matching frame and private trusted-click proof; consumes it once',async()=>{
 const w=new JSDOM('<iframe src="https://ext.nicovideo.jp/thumb/sm9"></iframe>',{url:'https://example.org'}).window;
 const frame=w.document.querySelector('iframe'),values=new Map(),opened=[];
 const gm={get:k=>values.get(k),set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
 const dispose=receiveBlogClicks(w,gm,()=>({}),(id,e)=>{opened.push([id,e.isTrusted]);return Promise.resolve();});
 const nonce='12345678-1234-1234-1234-123456789abc',key='blog-click-v1:'+nonce;
 const dispatch=(source=frame.contentWindow,origin='https://ext.nicovideo.jp')=>w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:{type:'ZenzaBlogPartsClick',nonce}}));
 dispatch();assert.equal(opened.length,0);
 values.set(key,{id:'sm9',time:Date.now()});dispatch(w);dispatch(frame.contentWindow,'https://evil.example');assert.equal(opened.length,0);
 dispatch();dispatch();assert.deepEqual(opened,[['sm9',true]]);assert.equal(values.has(key),false);
 values.set(key,{id:'sm9',time:Date.now()-11000});dispatch();assert.equal(opened.length,1);
 assert.equal(sendBlogClick(frame.contentWindow,gm,'sm9',{isTrusted:false}),false);
 dispose();w.close();
});
test('companion silently suspends when old trial appears, without migration notices',async()=>{
 const w=new JSDOM('<div data-zenza-external-overlay data-zenza-companion></div>').window;let stopped=0;
 const dispose=watchLegacyTrial(w,()=>stopped++);assert.equal(stopped,0);
 const old=w.document.createElement('div');old.dataset.zenzaExternalInline='';w.document.body.append(old);
 await new Promise(r=>w.setTimeout(r,0));assert.equal(stopped,1);assert.equal(w.document.querySelector('[data-zenza-companion-notice]'),null);dispose();w.close();
});
test('ordinary official preferences migrate into a new companion store',()=>{
 const {connectOfficialExternalSettings}=require('./generated/official-settings');
 const w=new JSDOM('',{url:'https://www.nicovideo.jp/'}).window;const store=new Map();
 w.localStorage.setItem('ZenzaWatch_externalLinks.displayMode','"hover"');
 const dispose=connectOfficialExternalSettings(w,{get:k=>store.get(k),set:(k,v)=>store.set(k,v)});
 assert.equal(store.get('external-links-v1')['externalLinks.displayMode'],'hover');dispose();w.close();
});
const {createRuntimeSession}=require('./launcher.cjs');
test('closing during authentication prevents later initialization and playback',async()=>{
 let release,started;const entered=new Promise(r=>started=r);let initialized=0,played=0;
 const session=createRuntimeSession({hasExistingRuntime:()=>false,enable:async()=>{},startRuntime:async()=>session.configure({connect:async()=>{},api:{fetch:()=>{started();return new Promise(r=>release=r);}},setLogin(){},initialize:async()=>initialized++,open:async()=>played++})});
 const opening=session.open('sm9',{isTrusted:true});await entered;assert.equal(session.close(),false);
 release({status:200,json:async()=>({meta:{status:200},data:{mylists:[]}})});
 await assert.rejects(opening,/PLAYER_CLOSED/);assert.equal(initialized,0);assert.equal(played,0);
});

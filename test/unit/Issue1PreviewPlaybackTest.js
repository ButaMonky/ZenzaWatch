// Issue #1 / Task202: page previews yield playback to Zenza, not unrelated media.
const assert=require('assert');const {JSDOM}=require('jsdom');const {EventEmitter}=require('events');
const {beginSection,read,createContext,run}=require('../helpers/extractSource');
function fixture(){
 const dom=new JSDOM('<!doctype html><body><a href="/watch/sm9"><video id="preview"></video></a><div class="zen-family"><a href="/watch/sm9"><video id="zenza"></video></a></div><video id="unrelated"></video><a href="https://other.example/watch/sm9"><video id="foreign"></video></a></body>',{url:'https://www.nicovideo.jp/tag/test'}),win=dom.window;
 const ctx=createContext({window:win,document:win.document,location:win.location,URL:win.URL,textUtil:{},uq:()=>({}),ZenzaWatch:{}});
 run(beginSection('packages/lib/src/nico/nicoUtil.js'),ctx);
 const guard='packages/zenza/src/init/PagePreviewGuard.js';try{run(beginSection(guard),ctx);}catch(e){if(!String(e).includes('ENOENT'))throw e;}
 run(beginSection('packages/zenza/src/menu/HoverMenu.js')+';globalThis.Menu=HoverMenu;',ctx);
 const menu=Object.create(ctx.Menu.prototype),player=new EventEmitter();player.isOpen=false;
 const videos={};for(const v of win.document.querySelectorAll('video')){v.stops=0;let paused=false;Object.defineProperty(v,'paused',{get:()=>paused});v.pause=()=>{paused=true;v.stops++;};v.start=()=>{paused=false;v.dispatchEvent(new win.Event('play'));};videos[v.id]=v;}
 menu.setPlayer(player);return{dom,win,menu,player,videos,open(){player.isOpen=true;player.emit('open');},close(){player.isOpen=false;player.emit('close');},dispose(){menu._pagePreviewGuard?.dispose();win.close();}};
}
describe('Issue1 preview playback ownership',()=>{
 it('pauses an already-playing thumbnail when the player opens',()=>{const f=fixture();try{f.open();assert.strictEqual(f.videos.preview.paused,true);assert.strictEqual(f.videos.preview.stops,1);}finally{f.dispose();}});
 it('blocks a preview which tries to restart while Zenza remains open',()=>{const f=fixture();try{f.open();f.videos.preview.start();assert.strictEqual(f.videos.preview.paused,true);}finally{f.dispose();}});
 it('captures play events on a newly mounted thumbnail video',()=>{const f=fixture();try{f.open();const a=f.win.document.createElement('a');a.href='/shorts/ss123';const v=f.win.document.createElement('video');let stops=0;v.pause=()=>stops++;Object.defineProperty(v,'paused',{value:false});a.append(v);f.win.document.body.append(a);v.dispatchEvent(new f.win.Event('play'));assert.strictEqual(stops,1);}finally{f.dispose();}});
 it('does not pause Zenza media, unrelated video or another website link',()=>{const f=fixture();try{f.open();for(const key of ['zenza','unrelated','foreign']){f.videos[key].start();assert.strictEqual(f.videos[key].stops,0);}}finally{f.dispose();}});
 it('releases the guard on close and never resumes media itself',()=>{const f=fixture();try{let plays=0;f.videos.preview.play=()=>plays++;f.open();f.close();const stops=f.videos.preview.stops;f.videos.preview.start();assert.strictEqual(f.videos.preview.stops,stops);assert.strictEqual(plays,0);}finally{f.dispose();}});
 it('does not accumulate handlers across repeated open/close',()=>{const f=fixture();try{for(let i=0;i<5;i++){f.open();f.close();}f.open();const before=f.videos.preview.stops;f.videos.preview.start();assert.strictEqual(f.videos.preview.stops,before+1);}finally{f.dispose();}});
 it('disposing/replacing the player releases its listeners',()=>{const f=fixture();try{f.open();const other=new EventEmitter();other.isOpen=false;f.menu.setPlayer(other);assert.strictEqual(f.player.listenerCount('open'),0);const before=f.videos.preview.stops;f.videos.preview.start();assert.strictEqual(f.videos.preview.stops,before);}finally{f.dispose();}});
});

describe('Task203 preview claim before local/remote open',()=>{
 it('claims only the clicked preview until pointer leaves the link',()=>{
  const f=fixture();try{
   const link=f.win.document.querySelector('a[href="/watch/sm9"]');
   f.menu._pagePreviewGuard.claim(link);
   assert.strictEqual(f.videos.preview.paused,true);
   f.videos.preview.start();assert.strictEqual(f.videos.preview.paused,true);
   f.videos.unrelated.start();assert.strictEqual(f.videos.unrelated.stops,0);
   link.dispatchEvent(new f.win.Event('pointerleave'));
   const before=f.videos.preview.stops;f.videos.preview.start();
   assert.strictEqual(f.videos.preview.stops,before);
  }finally{f.dispose();}
 });
});
describe('Task203 preview claim cleanup',()=>{
 it('releases a claimed preview when the guard is disposed',()=>{
  const f=fixture();try{
   const link=f.win.document.querySelector('a[href="/watch/sm9"]');
   f.menu._pagePreviewGuard.claim(link);
   f.menu._pagePreviewGuard.dispose();
   const before=f.videos.preview.stops;f.videos.preview.start();
   assert.strictEqual(f.videos.preview.stops,before);
  }finally{f.win.close();}
 });
});
describe('Task203 claimed preview DOM lifetime',()=>{
 it('releases a removed thumbnail instead of retaining the detached subtree',async()=>{
  const f=fixture();try{
   const guard=f.menu._pagePreviewGuard,link=f.win.document.querySelector('a[href="/watch/sm9"]');
   guard.claim(link);link.remove();
   await new Promise(resolve=>f.win.setTimeout(resolve,0));
   f.win.document.body.append(link);
   const before=f.videos.preview.stops;f.videos.preview.start();
   assert.strictEqual(f.videos.preview.stops,before);
   assert.strictEqual(guard.claimedLinks.size,0);
   assert.strictEqual(guard.listening,false);
  }finally{f.dispose();}
 });
 it('closing the local player releases claims added while it was already open',()=>{
  const f=fixture();try{
   f.open();f.menu._pagePreviewGuard.claim(f.win.document.querySelector('a[href="/watch/sm9"]'));
   f.close();const before=f.videos.preview.stops;f.videos.preview.start();
   assert.strictEqual(f.videos.preview.stops,before);
  }finally{f.dispose();}
 });
});

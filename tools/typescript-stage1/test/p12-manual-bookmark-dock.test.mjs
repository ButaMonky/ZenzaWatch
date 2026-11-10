import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ManualBookmarkDock} from '../p12-src/ManualBookmarkDock.ts';
import {ManualBookmarkSession} from '../p12-src/ManualBookmarkSession.ts';
import {updateManualBookmark,addManualBookmark,renameManualBookmark,removeManualBookmark}
  from '../p12-src/ManualBookmarkPolicy.ts';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const step=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
class Repo {
 constructor(){this.rows=new Map();this.closed=0;this.loadOverride=null;}
 async load(videoId){return this.loadOverride?
   this.loadOverride(videoId):this.rows.get(videoId)||[];}
 async add(draft,duration){const rows=addManualBookmark(
   this.rows.get(draft.videoId)||[],draft,duration);
   this.rows.set(draft.videoId,rows);return rows;}
 async rename(videoId,id,label,now,duration){
   const rows=renameManualBookmark(this.rows.get(videoId)||[],
     videoId,id,label,now);
   this.rows.set(videoId,rows);return rows;
 }
 async remove(videoId,id){
   const rows=removeManualBookmark(this.rows.get(videoId)||[],videoId,id);
   this.rows.set(videoId,rows);return rows;
 }
 async update(videoId,id,changes,now,duration){
  const rows=updateManualBookmark(this.rows.get(videoId)||[],videoId,id,changes,now,duration);
  this.rows.set(videoId,rows);return rows;
 }
 close(){this.closed++;}
}
function harness(setup=()=>{}){
 const dom=new JSDOM('<!doctype html><html><body>'+
   '<div class="zenzaPlayerContainer"><canvas id="native-canvas"></canvas>'+
   '<div id="native"><input id="native-seek" type="range"/>'+
   '<zenza-seekbar-label class="resumePointer"></zenza-seekbar-label></div>'+
   '<div class="zenzaWatchVideoInfoPanel"><div class="tabs videoInfoTab">'+
   '<div class="zenzaWatchVideoInfoPanelContent">'+
   '<div class="publicStatus"></div><div class="seriesList"></div>'+
   '<div class="videoDescription"></div></div></div></div></div>'+
   '</body></html>');
 const doc=dom.window.document;setup(dom.window);
 const native=doc.getElementById('native');
 const seek=doc.getElementById('native-seek');
 const marker=native.querySelector('.resumePointer');
 const canvas=doc.getElementById('native-canvas');
 const repo=new Repo(),session=new ManualBookmarkSession(repo);
 let active='sm1',now=120,time=65,next=0;
 const seeks=[];
 const dock=ManualBookmarkDock.mount(doc.body,session,{
   currentVideoId:()=>active,currentTime:()=>time,timestamp:()=>now,
   newId:()=>('B'+(++next)),seek:t=>seeks.push(t)
 });
 const click=action=>dock.element.querySelector(
   '[data-bookmark-action="'+action+'"]');
 const close=()=>{dock.dispose();dom.window.close();};
 return {dom,doc,native,seek,marker,canvas,repo,session,dock,seeks,click,close,
   active:value=>active=value,now:value=>now=value,time:value=>time=value};
}
test('closed-by-default dock mounts only inside information tab, before series',()=>{
 const h=harness();
 const details=h.dock.element;
 assert.equal(details.tagName,'SECTION');
 assert.equal(details.hidden,true);
 assert.equal(details.querySelector('.zw-points-heading').textContent,'しおり・ABリピート');
 assert.equal(details.dataset.bookmarkOwner,'manual');
 assert.equal(details.nextElementSibling.className,'seriesList');
 assert.equal(h.native.querySelector('#native-seek'),h.seek);
 assert.equal(h.native.querySelector('.resumePointer'),h.marker);
 assert.equal(h.doc.getElementById('native-canvas'),h.canvas);
 assert.throws(()=>ManualBookmarkDock.mount(h.doc.body,h.session,{
   currentVideoId:()=> 'sm1',currentTime:()=>65,
   timestamp:()=>120,newId:()=> 'B4',seek:()=>{}
 }),/already owned/);
 h.close();assert.equal(h.repo.closed,1);
 assert.equal(h.doc.querySelector('.zenzaManualBookmarkDock'),null);
 assert.equal(h.native.querySelector('.resumePointer'),h.marker);
});
test('add, rename, seek and remove use independent manual bookmark storage',async()=>{
 const h=harness();
 await h.dock.activate('sm1',200);
 h.dock.toggle(h.doc.querySelector('.zenzaPlayerContainer'));
 h.dock.element.querySelector('[data-bookmark-label]').value='Scene alpha';
 h.click('add').click();await step();
 assert.equal(h.repo.rows.get('sm1')[0].label,'Scene alpha');
 assert.equal(h.doc.querySelectorAll('.zenzaManualBookmarkDock li').length,1);
 const rename=h.dock.element.querySelector('input[data-bookmark-rename-id="B1"]');
 rename.value='Scene beta';h.now(130);
 h.click('rename').click();await step();
 assert.equal(h.repo.rows.get('sm1')[0].label,'Scene beta');
 h.click('seek').click();assert.deepEqual(h.seeks,[65]);
 h.click('remove').click();await step();
 assert.equal(h.repo.rows.get('sm1').length,0);
 assert.equal(h.native.querySelector('#native-seek'),h.seek);
 assert.equal(h.native.querySelector('.resumePointer'),h.marker);
 h.close();
});
test('input shortcuts stay in manual dock, native range keys still bubble',async()=>{
 const h=harness();
 await h.dock.activate('sm1',200);
 let bubbled=0;
 h.doc.body.addEventListener('keydown',()=>bubbled++);
 const entry=h.dock.element.querySelector('input[data-bookmark-label]');
 entry.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{
   bubbles:true,cancelable:true,key:'ArrowRight'
 }));
 assert.equal(bubbled,0);
 h.seek.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{
   bubbles:true,cancelable:true,key:'ArrowRight'
 }));
 assert.equal(bubbled,1);
 h.close();
});
test('bookmark summary and action keyboard events cannot trigger player shortcuts',async()=>{
 const h=harness();
 await h.dock.activate('sm1',200);
 let down=0,up=0;
 h.doc.body.addEventListener('keydown',()=>down++);
 h.doc.body.addEventListener('keyup',()=>up++);
 const send=(target,type,key)=>{
  const evt=new h.dom.window.KeyboardEvent(type,{bubbles:true,cancelable:true,key});
  target.dispatchEvent(evt);
  assert.equal(evt.defaultPrevented,false,'do not block browser default behavior');
 };
 const summary=h.dock.element.querySelector('.zw-points-heading');
 const add=h.click('add');
 const field=h.dock.element.querySelector('input[data-bookmark-label]');
 for(const target of [summary,add,field]){
  send(target,'keydown',' ');
  send(target,'keyup',' ');
 }
 assert.equal(down,0,'player must never receive dock keydown');
 assert.equal(up,0,'player must never receive dock keyup');
 send(h.seek,'keydown','ArrowRight');
 send(h.seek,'keyup','ArrowRight');
 assert.equal(down,1,'unrelated native range retains normal keys');
 assert.equal(up,1,'native keyup retains normal keys');
 h.close();
});
test('stale video cannot seek, remove or rename after switch',async()=>{
 const h=harness();
 await h.dock.activate('sm1',200);
 h.click('add').click();await step();
 const before=JSON.stringify(h.repo.rows.get('sm1'));
 h.active('sm2');
 h.click('seek').click();h.click('remove').click();
 h.click('rename').click();await step();
 assert.deepEqual(h.seeks,[]);
 assert.equal(JSON.stringify(h.repo.rows.get('sm1')),before);
 await h.dock.activate('sm2',300);
 assert.equal(h.dock.element.querySelectorAll('li').length,0);
 assert.equal(h.repo.rows.get('sm1').length,1);
 h.close();
});
test('deactivation and dispose revoke listeners without modifying neighbor DOM',async()=>{
 const h=harness();
 await h.dock.activate('sm1',200);
 h.click('add').click();await step();
 h.dock.deactivate();
 assert.equal(h.session.snapshot.videoId,null);
 assert.equal(h.repo.rows.get('sm1').length,1);
 h.dock.dispose();h.dock.dispose();
 assert.equal(h.repo.closed,1);
 assert.equal(h.native.querySelector('input'),h.seek);
 assert.equal(h.doc.getElementById('native-canvas'),h.canvas);
 assert.equal(h.doc.querySelector('.zenzaManualBookmarkDock'),null);
 h.dom.window.close();
});
test('missing info tab rejects before adding any UI or taking an owner',()=>{
 const dom=new JSDOM('<!doctype html><html><body><input type="range"/></body></html>');
 const repo=new Repo(),session=new ManualBookmarkSession(repo);
 assert.throws(()=>ManualBookmarkDock.mount(dom.window.document.body,session,{
   currentVideoId:()=>null,currentTime:()=>0,timestamp:()=>0,
   newId:()=> 'B1',seek:()=>{}
 }),/mount missing/);
 assert.equal(dom.window.document.querySelector('details'),null);
 assert.equal(dom.window.document.querySelector('input').type,'range');
 session.dispose();dom.window.close();
});

test('floating editor keeps native details and checkbox actions away from player click cancellation',async()=>{
 const h=harness();
 try{
  await h.dock.activate('sm1',200);
  h.click('add').click();await step();
  const player=h.doc.querySelector('.zenzaPlayerContainer');
  let playerClicks=0;
  // NicoVideoPlayerDialogView cancels bubbled clicks on the video container.
  player.addEventListener('click',event=>{playerClicks++;event.preventDefault();});
  h.dock.toggle(player);await step();
  const editor=h.dock.element.querySelector('.zw-bookmark-edit');
  editor.querySelector('summary').click();
  assert.equal(editor.open,true,'native editor disclosure must open inside the player');
  assert.equal(playerClicks,0,'dock clicks belong to the dock');
  const checkbox=h.doc.createElement('input');checkbox.type='checkbox';h.dock.element.append(checkbox);
  checkbox.click();assert.equal(checkbox.checked,true,'native checkbox default must survive');
  h.click('remove').click();await step();
  assert.equal(h.repo.rows.get('sm1').length,0,'delete remains reachable and functional');
  player.click();assert.equal(playerClicks,1,'outside player controls remain unchanged');
 }finally{h.close();}
});

test('toolbar launches one anchored floating panel without a video information launcher',async()=>{
 const h=harness();await h.dock.activate('sm1',100);
 const host=h.doc.querySelector('.zenzaPlayerContainer');
 const trigger=h.doc.createElement('button');trigger.className='playbackPointsSwitch';host.append(trigger);
 host.getBoundingClientRect=()=>({left:100,top:100,width:900,height:600,right:1000,bottom:700});
 trigger.getBoundingClientRect=()=>({left:160,top:650,width:30,height:30,right:190,bottom:680});
 Object.defineProperty(host,'clientWidth',{value:900});Object.defineProperty(host,'clientHeight',{value:600});
 assert.equal(h.dock.element.hidden,true);
 assert.equal(h.doc.querySelector('.zw-points-launcher'),null);h.dock.toggle(host,trigger);
 assert.equal(h.dock.element.hidden,false);assert.equal(h.dock.element.querySelector(':scope > summary'),null);
 assert.equal(h.dock.element.parentElement,host);assert.equal(h.dock.element.style.left,'60px');
 assert.equal(h.dock.element.style.bottom,'-18px');
 h.dock.close();assert.equal(h.dock.element.hidden,true);h.close();
});

test('toolbar-only dock can open without a trigger using safe fallback placement',()=>{
 const h=harness(),host=h.doc.querySelector('.zenzaPlayerContainer');
 host.getBoundingClientRect=()=>({left:100,top:100,width:900,height:600,right:1000,bottom:700});
 Object.defineProperty(host,'clientWidth',{value:900});Object.defineProperty(host,'clientHeight',{value:600});
 h.dock.toggle(host);assert.equal(h.dock.element.style.left,'12px');assert.equal(h.dock.element.style.top,'auto');
 assert.equal(h.dock.element.style.bottom,'-18px');assert.equal(h.doc.querySelector('.zw-points-launcher'),null);h.close();
});

test('floating placement observes host and trigger resizing and releases observation on close',()=>{
 const observed=new Set();let resize;
 const h=harness(win=>{win.ResizeObserver=class{constructor(fn){resize=fn;}observe(node){observed.add(node);}disconnect(){observed.clear();}};});
 const host=h.doc.querySelector('.zenzaPlayerContainer'),trigger=h.doc.createElement('button');host.append(trigger);
 let width=900;
 host.getBoundingClientRect=()=>({left:0,top:0,width,height:600,right:width,bottom:600});
 trigger.getBoundingClientRect=()=>({left:500,top:550,width:30,height:30,right:530,bottom:580});
 Object.defineProperty(host,'clientWidth',{get:()=>width});Object.defineProperty(host,'clientHeight',{value:600});
 h.dock.toggle(host,trigger);assert(observed.has(host));assert(observed.has(trigger));assert(observed.has(h.dock.element));
 assert.equal(h.dock.element.style.left,'488px');width=600;resize();assert.equal(h.dock.element.style.left,'188px');
 h.dock.close();assert.equal(observed.size,0);h.close();
});

test('Task1002 panel bottom matches comment increase anchor without changing width',()=>{
 const observed=new Set();let resize;
 const h=harness(win=>{Object.defineProperty(win,'innerHeight',{value:900});win.ResizeObserver=class{constructor(fn){resize=fn;}observe(node){observed.add(node);}unobserve(node){observed.delete(node);}disconnect(){observed.clear();}};});
 const host=h.doc.querySelector('.zenzaPlayerContainer'),trigger=h.doc.createElement('button'),anchor=h.doc.createElement('button');anchor.className='commentHistorySwitch';host.append(trigger,anchor);
 host.getBoundingClientRect=()=>({left:0,top:100,width:1000,height:700,right:1000,bottom:800});
 Object.defineProperty(host,'clientWidth',{value:1000});Object.defineProperty(host,'clientHeight',{value:700});
 trigger.getBoundingClientRect=()=>({left:100,top:750,width:30,height:30,right:130,bottom:780});
 let anchorTop=820;anchor.getBoundingClientRect=()=>({left:500,top:anchorTop,width:30,height:30,right:530,bottom:anchorTop+30});
 h.dock.toggle(host,trigger);assert.equal(800-parseFloat(h.dock.element.style.bottom),810);assert(observed.has(anchor));
 assert.equal(h.dock.element.style.width,'');assert.equal(h.dock.element.style.height,'');assert.equal(h.dock.element.style.top,'auto');
 anchorTop=790;resize();assert.equal(800-parseFloat(h.dock.element.style.bottom),780);h.close();
});
test('Task1002 converts viewport bottom through a scaled bordered host',()=>{
 const h=harness(win=>Object.defineProperty(win,'innerHeight',{value:900}));
 const host=h.doc.querySelector('.zenzaPlayerContainer'),trigger=h.doc.createElement('button'),anchor=h.doc.createElement('button');anchor.className='commentHistorySwitch';host.append(trigger,anchor);
 host.getBoundingClientRect=()=>({left:20,top:40,width:1206,height:906,right:1226,bottom:946});
 for(const [name,value] of Object.entries({clientWidth:800,clientHeight:600,offsetWidth:804,offsetHeight:604,clientLeft:2,clientTop:2}))Object.defineProperty(host,name,{value});
 trigger.getBoundingClientRect=()=>({left:200,top:800,width:45,height:45,right:245,bottom:845});
 anchor.getBoundingClientRect=()=>({left:500,top:850,width:45,height:45,right:545,bottom:895});
 h.dock.toggle(host,trigger);assert(Math.abs(40+(2+600-parseFloat(h.dock.element.style.bottom))*1.5-840)<.001);
 assert(Math.abs(parseFloat(h.dock.element.style.left)-(200-23)/1.5)<.001);h.close();
});
test('Task1002 missing comment anchor uses 50px fallback and tiny viewport remains bounded',()=>{
 const h=harness(win=>Object.defineProperty(win,'innerHeight',{value:50}));
 const host=h.doc.querySelector('.zenzaPlayerContainer'),trigger=h.doc.createElement('button');host.append(trigger);
 host.getBoundingClientRect=()=>({left:0,top:0,width:300,height:50,right:300,bottom:50});
 Object.defineProperty(host,'clientWidth',{value:300});Object.defineProperty(host,'clientHeight',{value:50});
 trigger.getBoundingClientRect=()=>({left:20,top:40,width:20,height:10,right:40,bottom:50});
 h.dock.toggle(host,trigger);assert.equal(h.dock.element.style.bottom,'16px');assert(parseFloat(h.dock.element.style.maxHeight)<=18);h.close();
});

test('Task1002 hidden reference falls back and fullscreen/ancestor transitions reposition',()=>{
 const h=harness(win=>Object.defineProperty(win,'innerHeight',{value:900}));
 const host=h.doc.querySelector('.zenzaPlayerContainer'),trigger=h.doc.createElement('button'),anchor=h.doc.createElement('button');anchor.className='commentHistorySwitch';host.append(trigger,anchor);
 host.getBoundingClientRect=()=>({left:0,top:100,width:1000,height:700,right:1000,bottom:800});
 Object.defineProperty(host,'clientWidth',{value:1000});Object.defineProperty(host,'clientHeight',{value:700});
 trigger.getBoundingClientRect=()=>({left:100,top:750,width:30,height:30,right:130,bottom:780});
 let top=820,visible=false;anchor.getBoundingClientRect=()=>({left:500,top,width:visible?30:0,height:visible?30:0,right:530,bottom:top+30});
 h.dock.toggle(host,trigger);assert.equal(h.dock.element.style.bottom,'-50px','hidden anchor uses viewport bottom50');
 visible=true;h.doc.dispatchEvent(new h.dom.window.Event('fullscreenchange'));assert.equal(h.dock.element.style.bottom,'-10px');
 top=780;h.doc.documentElement.dispatchEvent(new h.dom.window.Event('transitionend',{bubbles:true}));assert.equal(h.dock.element.style.bottom,'30px');
 top=750;h.doc.dispatchEvent(new h.dom.window.Event('webkitfullscreenchange'));assert.equal(h.dock.element.style.bottom,'60px');
 h.dock.close();top=700;h.doc.documentElement.dispatchEvent(new h.dom.window.Event('transitionend',{bubbles:true}));assert.equal(h.dock.element.style.bottom,'60px');h.close();
});

test('Task1003 static bookmark heading never collapses the panel; toolbar and Escape still close',async()=>{
 const h=harness();await h.dock.activate('sm1',200);
 const host=h.doc.querySelector('.zenzaPlayerContainer'),trigger=h.doc.createElement('button');host.append(trigger);
 h.dock.toggle(host,trigger);const heading=h.dock.element.querySelector('.zw-points-heading');
 assert(heading);assert.equal(h.dock.element.tagName,'SECTION');
 heading.click();heading.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 heading.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true}));
 assert.equal(h.dock.element.hidden,false);assert.equal(trigger.getAttribute('aria-expanded'),'true');
 h.dock.toggle(host,trigger);assert.equal(h.dock.element.hidden,true);
 h.dock.toggle(host,trigger);heading.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(h.dock.element.hidden,true);assert.equal(h.doc.activeElement,trigger);h.close();
});

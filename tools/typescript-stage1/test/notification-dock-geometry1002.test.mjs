import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function fixture(t,{scale=1,anchor=true}={}){
 const dom=new JSDOM('<div id="host"><button id="notification"></button><button class="commentHistorySwitch"></button></div>');
 t.after(()=>dom.window.close());const {window}=dom,document=window.document;
 Object.defineProperty(window,'innerHeight',{value:1000,writable:true});
 const host=document.querySelector('#host'),button=document.querySelector('#notification'),comment=document.querySelector('.commentHistorySwitch');
 Object.defineProperty(host,'offsetHeight',{value:600});let anchorTop=900;
 host.getBoundingClientRect=()=>({top:100,height:600*scale,width:900,left:0,bottom:100+600*scale,right:900});
 comment.getBoundingClientRect=()=>({top:anchorTop,height:anchor?30:0,width:anchor?40:0});
 const api=loadSource('nico-src/NotificationHistoryPanel.ts','NotificationHistoryPanel',{window,document,NotificationJournal:{list:async()=>[],subscribe:()=>()=>{}}});
 const controller=api.mountDock({container:host,button});t.after(()=>controller.dispose());
 controller.toggle();return {window,document,host,controller,dock:host.querySelector('.zenzaNotificationDock'),setTop:value=>anchorTop=value};
}
test('notification dock expands to comment toolbar bottom without inner 640px cap',async t=>{
 const h=fixture(t);await flush();assert.equal(h.dock.style.top,'16px');assert.equal(h.dock.style.height,'774px');
 const css=h.document.querySelector('style').textContent;assert(css.includes('.zenzaNotificationDock .zenzaNotificationHistory{max-height:none;'));
 h.setTop(950);h.window.dispatchEvent(new h.window.Event('resize'));await flush();assert.equal(h.dock.style.height,'824px');
});
test('scaled host converts physical viewport coordinates and fullscreen updates while dispose detaches',async t=>{
 const h=fixture(t,{scale:1.5});await flush();assert.equal(parseFloat(h.dock.style.top),16/1.5);assert.equal(parseFloat(h.dock.style.height),774/1.5);
 h.setTop(800);h.document.dispatchEvent(new h.window.Event('fullscreenchange'));await flush();assert.equal(parseFloat(h.dock.style.height),674/1.5);
 h.controller.dispose();const old=h.dock.style.height;h.setTop(700);h.window.dispatchEvent(new h.window.Event('resize'));await flush();assert.equal(h.dock.style.height,old);
});
test('missing measurable launcher uses 50 physical pixel bottom and class layout changes refresh',async t=>{
 const h=fixture(t,{anchor:false});await flush();assert.equal(h.dock.style.height,'834px');
 h.window.innerHeight=900;h.host.classList.add('fullscreen');await flush();assert.equal(h.dock.style.height,'734px');
});
test('unrelated comment animation attributes do not trigger layout reads',async t=>{
 const h=fixture(t);await flush();let reads=0;
 const measure=h.host.getBoundingClientRect;h.host.getBoundingClientRect=()=>{reads++;return measure();};
 const comment=h.document.createElement('span');h.host.append(comment);comment.style.transform='translateX(5px)';comment.className='moving-comment';
 await flush();assert.equal(reads,0);
 h.document.querySelector('.commentHistorySwitch').style.transform='scale(1.2)';await flush();assert.equal(reads,1);
});

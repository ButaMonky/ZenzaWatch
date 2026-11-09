import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {CommentHistoryPanel} from '../src/panel.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('visibility button is available during fetch and explicitly shows hidden state without altering auto preference',()=>{
 const dom=new JSDOM('<html><head></head><body><button id="anchor"></button></body></html>');const win=dom.window;
 let state={enabled:true,hidden:false,videoId:'sm1',phase:'fetching',goal:5000,additionalCount:1000,cachedAdditional:1000,appliedAdditional:0,appliedTarget:5000,normalCount:10,pages:1,cacheAvailable:false};
 const listeners=new Set(),changes=[];
 const controller={get state(){return state;},subscribe(fn){listeners.add(fn);fn(state);return()=>listeners.delete(fn);},setHidden(value){changes.push(value);state={...state,hidden:value};for(const fn of listeners)fn(state);return Promise.resolve(state);}};
 const prefs={get:()=>({valid:true,enabled:true,settings:{maxAdditionalComments:5000,includeEasy:false}}),subscribe:()=>()=>{}};
 const panel=new CommentHistoryPanel({controller,preferences:prefs,window:win,anchor:()=>win.document.querySelector('#anchor')});
 try{
  panel.open();const button=win.document.querySelector('[data-ch-visibility]');assert(button,'prominent visibility control exists');
  assert.equal(button.disabled,false);assert.match(button.textContent,/非表示/);
  button.click();assert.deepEqual(changes,[true]);assert.match(button.textContent,/再表示/);
  assert.match(win.document.querySelector('[data-ch-visibility-status]').textContent,/非表示中/);
  assert.equal(win.document.querySelector('[data-ch-enabled]').checked,true);
  button.click();assert.deepEqual(changes,[true,false]);
 }finally{panel.dispose();win.close();}
});

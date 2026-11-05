'use strict';
const assert=require('assert'),path=require('path');
const {pathToFileURL}=require('url');
const {JSDOM}=require('jsdom');
let Panel;
before(async()=>{({ManualBookmarkPanel:Panel}=await new Function('u','return import(u)')(pathToFileURL(path.resolve('packages/zenza/src/resume/ManualBookmarkPanel.js')).href));});
function fixture(){
 const dom=new JSDOM('<main></main>');const root=dom.window.document.querySelector('main');
 let listener,time=12;const calls=[];
 const session={snapshot:{status:'ready',videoId:'sm9',bookmarks:[]},subscribe(fn){listener=fn;fn(this.snapshot);return()=>{};},async add(...args){calls.push(['add',...args]);return {status:'applied'};}};
 const panel=new Panel(root,session,{currentVideoId:()=>session.snapshot.videoId,currentTime:()=>time,timestamp:()=>100,newId:()=> 'B1',seek:t=>calls.push(['seek',t]),duration:()=>120,automaticTime:()=>42,editAutomatic:async t=>{calls.push(['edit',t]);return true;},deleteAutomatic:async()=>true,repeatEnabled:()=>true});
 const click=a=>root.querySelector('[data-point-action="'+a+'"]').click();
 const field=(name,value)=>{root.querySelector('[data-point-field="'+name+'"]').value=value;};
 return {dom,root,panel,calls,click,field,setTime:t=>time=t,switchVideo:()=>{session.snapshot={status:'ready',videoId:'sm10',bookmarks:[]};listener(session.snapshot);}};
}
describe('Playback point panel',()=>{
 it('parses explicit times and rejects malformed/nonfinite input',()=>{
  assert.equal(typeof Panel.parseTime,'function');
  for(const [s,n] of [['0',0],['12.5',12.5],['1:02',62],['1:02:03.5',3723.5]]) assert.equal(Panel.parseTime(s),n);
  for(const s of ['', '-1','1:99','1e3','Infinity','1:2:3:4']) assert.equal(Panel.parseTime(s),null);
 });
 it('sets A/B from current position and loops only on active playback at B',()=>{
  const f=fixture();f.click('set-a');f.setTime(20);f.click('set-b');f.click('repeat');
  f.calls.length=0;f.panel.tick(19,false,false);assert.deepEqual(f.calls,[]);
  f.panel.tick(20,true,false);f.panel.tick(20,false,true);assert.deepEqual(f.calls,[]);
  f.panel.tick(20,false,false);assert.deepEqual(f.calls,[['seek',12]]);
  f.panel.tick(20,false,false);assert.equal(f.calls.length,1,'await landing before another seek');
  f.panel.tick(12,false,false);f.panel.tick(20,false,false);assert.equal(f.calls.length,2);
  f.panel.dispose();f.dom.window.close();
 });
 it('invalid or reversed range cannot start and explains why',()=>{
  const f=fixture();f.field('a','30');f.field('b','20');f.click('repeat');f.panel.tick(30,false,false);
  assert.deepEqual(f.calls,[]);assert.match(f.root.textContent,/A.*B|B.*A/);f.panel.dispose();f.dom.window.close();
 });
 it('switching video clears loop and ignores old points',()=>{
  const f=fixture();f.click('set-a');f.setTime(20);f.click('set-b');f.click('repeat');f.calls.length=0;f.switchVideo();f.panel.tick(25,false,false);assert.deepEqual(f.calls,[]);f.panel.dispose();f.dom.window.close();
 });
 it('edits automatic position without creating a manual bookmark',async()=>{
  const f=fixture();f.field('automatic','1:05');f.click('save-automatic');await Promise.resolve();
  assert.deepEqual(f.calls,[['edit',65]]);f.panel.dispose();f.dom.window.close();
 });
});

describe('Playback point UI review regressions',()=>{
 it('carries rounded milliseconds into seconds when setting A',()=>{
  const f=fixture();f.setTime(12.9999);f.click('set-a');
  assert.equal(Panel.parseTime(f.root.querySelector('[data-point-field="a"]').value),13);
  f.panel.dispose();f.dom.window.close();
 });
 it('refreshes untouched automatic field while retaining genuine input',()=>{
  const f=fixture();
  f.root.querySelector('[data-point-field="automatic"]').value='9';
  f.panel.refreshPreferences();
  assert.equal(f.root.querySelector('[data-point-field="automatic"]').value,'0:42');
  const input=f.root.querySelector('[data-point-field="automatic"]');input.value='15';
  input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));f.panel.refreshPreferences();
  assert.equal(f.root.querySelector('[data-point-field="automatic"]').value,'15');
  f.panel.dispose();f.dom.window.close();
 });
});

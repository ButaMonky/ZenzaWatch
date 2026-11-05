import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ManualBookmarkPanel} from '../p12-src/ManualBookmarkPanel.ts';
import {ManualBookmarkSession} from '../p12-src/ManualBookmarkSession.ts';
import {addManualBookmark,removeManualBookmark,renameManualBookmark}
  from '../p12-src/ManualBookmarkPolicy.ts';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const step=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
class Repo{
 constructor(){this.rows=new Map();this.failWrite=false;this.closed=0;}
 async load(id){return this.rows.get(id)||[];}
 async add(draft,duration){
  if(this.failWrite)throw Error('private database failure with credentials');
  const rows=addManualBookmark(this.rows.get(draft.videoId)||[],draft,duration);
  this.rows.set(draft.videoId,rows);return rows;
 }
 async rename(id,bookmarkId,label,now,duration){
  const rows=renameManualBookmark(this.rows.get(id)||[],id,bookmarkId,label,now);
  this.rows.set(id,rows);return rows;
 }
 async remove(id,bookmarkId){
  const rows=removeManualBookmark(this.rows.get(id)||[],id,bookmarkId);
  this.rows.set(id,rows);return rows;
 }
 close(){this.closed++;}
}
function harness(){
 const dom=new JSDOM('<!doctype html><html><body>'+
  '<div id="native"><input id="native-seek" type="range">'+
  '<zenza-seekbar-label class="resumePointer"></zenza-seekbar-label></div>'+
  '<aside id="manual-panel"></aside></body></html>');
 const document=dom.window.document;
 const native=document.querySelector('#native');
 const seekRange=document.querySelector('#native-seek');
 const nativeMarker=document.querySelector('zenza-seekbar-label');
 const root=document.querySelector('#manual-panel');
 const repo=new Repo(),session=new ManualBookmarkSession(repo);
 let active='sm1',now=100,time=70,next=0;const seeks=[];
 const panel=new ManualBookmarkPanel(root,session,{
  currentVideoId:()=>active,currentTime:()=>time,timestamp:()=>now,
  newId:()=>('B'+(++next)),seek:seconds=>seeks.push(seconds)
 });
 const button=action=>root.querySelector('[data-bookmark-action="'+action+'"]');
 const close=()=>{panel.dispose();session.dispose();dom.window.close();};
 return {dom,root,native,seekRange,nativeMarker,repo,session,panel,seeks,button,close,
  active:value=>active=value,time:value=>time=value,now:value=>now=value};
}
test('panel starts idle and never alters the native seekbar sibling',()=>{
 const h=harness();
 assert.equal(h.root.querySelector('[data-bookmark-status]').textContent,'再生する動画を選択してください');
 assert.equal(h.root.querySelector('[role="region"]').getAttribute('aria-label'),'手動しおり');
 assert.equal(h.root.querySelector('h3').textContent,'手動しおり');
 assert.equal(h.native.querySelector('#native-seek'),h.seekRange);
 assert.equal(h.native.querySelector('.resumePointer'),h.nativeMarker);
 h.close();
});
test('explicit Add stores and renders a manual point, separate from automatic marker',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 const label=h.root.querySelector('[data-bookmark-label]');
 assert.equal(label.getAttribute('aria-label'),'しおりの名前');
 assert.equal(h.button('add').textContent,'しおりを追加');
 label.value='Manual 1';
 h.button('add').click();
 await step();
 assert.equal(h.repo.rows.get('sm1').length,1);
 assert.equal(h.root.querySelector('li span').textContent,'1:10 Manual 1');
 assert.equal(h.button('seek').textContent,'ここから再生');
 assert.equal(h.button('remove').textContent,'削除');
 assert.equal(h.nativeMarker.textContent,'');
 assert.equal(h.native.querySelector('.resumePointer'),h.nativeMarker);
 h.close();
});
test('manual seek button uses the stored time and does not trigger native click',async()=>{
 const h=harness();
 let nativeClicks=0;h.native.addEventListener('click',()=>nativeClicks++);
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 h.button('seek').click();
 assert.deepEqual(h.seeks,[70]);
 assert.equal(nativeClicks,0);
 h.close();
});
test('Rename updates only its manual bookmark label without moving native markers',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 const original=h.repo.rows.get('sm1')[0];
 const field=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 assert(field,'rename field must belong to the selected bookmark');
 assert.equal(field.getAttribute('aria-label'),'しおり名を編集');
 field.value='改名したしおり';
 h.now(200);
 h.button('rename').click();await step();
 const edited=h.repo.rows.get('sm1')[0];
 assert.equal(edited.label,'改名したしおり');
 assert.equal(edited.time,original.time);
 assert.equal(edited.createdAt,original.createdAt);
 assert.equal(edited.updatedAt,200);
 assert.equal(h.root.querySelector('li span').textContent,'1:10 改名したしおり');
 assert.equal(h.native.querySelector('.resumePointer'),h.nativeMarker);
 h.close();
});
test('Rename refuses an action on a bookmark from a stale video',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 const before=JSON.stringify(h.repo.rows.get('sm1'));
 const field=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 assert(field);
 field.value='must-not-save';
 h.active('sm2');
 h.button('rename').click();await step();
 assert.equal(JSON.stringify(h.repo.rows.get('sm1')),before);
 assert.equal(h.repo.rows.has('sm2'),false);
 h.close();
});
test('Remove is scoped to a single manual bookmark, not watch history',async()=>{
 const h=harness();
 const auto={resume:[{time:95}],resumeClearedAt:300};
 const before=JSON.stringify(auto);
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 h.button('remove').click();await step();
 assert.equal(h.repo.rows.get('sm1').length,0);
 assert.equal(JSON.stringify(auto),before);
 h.close();
});
test('stale-video click cannot seek or write for a now-different video',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 h.active('sm2');
 h.button('seek').click();h.button('remove').click();
 assert.deepEqual(h.seeks,[]);
 assert.equal(h.repo.rows.get('sm1').length,1);
 await h.session.activate('sm2',300);
 assert.equal(h.root.querySelectorAll('li').length,0);
 assert.equal(h.repo.rows.get('sm1').length,1);
 h.close();
});
test('untrusted bookmark label becomes textContent, never active HTML',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.root.querySelector('[data-bookmark-label]').value='<img src=x onerror=alert(1)>';
 h.button('add').click();await step();
 assert.equal(h.root.querySelectorAll('img').length,0);
 assert(h.root.textContent.includes('<img src=x onerror=alert(1)>'));
 h.close();
});
test('storage error shows a generic status without leaking private exception',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.repo.failWrite=true;h.button('add').click();await step();
 assert.equal(h.root.querySelector('[data-bookmark-status]').textContent,
  'しおりの保存に失敗しました');
 assert(!h.root.textContent.includes('credentials'));
 h.close();
});
test('disposing panel unsubscribes and removes its listeners without clearing storage',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);h.button('add').click();await step();
 const original=h.repo.rows.get('sm1').length;
 h.panel.dispose();assert.equal(h.root.childNodes.length,0);
 await h.session.add('B9',120,300);
 assert.equal(h.root.childNodes.length,0);
 assert.equal(h.repo.rows.get('sm1').length,original+1);
 h.session.dispose();h.dom.window.close();
});
test('native range keyboard remains untouched by panel event handlers',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 const event=new h.dom.window.KeyboardEvent('keydown',
  {bubbles:true,cancelable:true,key:'ArrowRight'});
 h.seekRange.dispatchEvent(event);
 assert.equal(event.defaultPrevented,false);
 assert.equal(h.native.querySelector('#native-seek'),h.seekRange);
 h.close();
});

test('same-video background insert keeps unsaved rename input draft',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 const input=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 assert(input);
 input.value='unsaved draft';
 input.focus();input.setSelectionRange(4,4);
 await h.session.add('B2',120,101,'background addition');
 const refreshed=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 assert(refreshed);
 assert.equal(refreshed.value,'unsaved draft');
 assert.equal(h.dom.window.document.activeElement,refreshed);
 assert.equal(refreshed.selectionStart,4);
 h.button('rename').click();await step();
 assert.equal(h.repo.rows.get('sm1').find(row=>row.id==='B1').label,
  'unsaved draft');
 h.close();
});

test('same-video canonical rename replaces an unsubmitted conflicting draft',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 const input=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 input.value='stale local draft';
 await h.session.rename('B1','authoritative rename',200);
 const refreshed=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 assert.equal(refreshed.value,'authoritative rename');
 h.close();
});

test('switching video does not carry an unsaved rename across equal IDs',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.button('add').click();await step();
 h.root.querySelector('input[data-bookmark-rename-id="B1"]').value='private sm1 draft';
 await h.session.activate('sm2',300);
 await h.session.add('B1',50,200,'sm2 label');
 const refreshed=h.root.querySelector('input[data-bookmark-rename-id="B1"]');
 assert.equal(refreshed.value,'sm2 label');
 h.close();
});

test('same-video background change preserves unsubmitted new-bookmark label and caret',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 const input=h.root.querySelector('input[data-bookmark-label]');
 input.value='scene I am drafting';
 input.focus();input.setSelectionRange(3,8);
 await h.session.add('B1',100,201,'another saved bookmark');
 const updated=h.root.querySelector('input[data-bookmark-label]');
 assert.equal(updated.value,'scene I am drafting');
 assert.strictEqual(h.dom.window.document.activeElement,updated);
 assert.equal(updated.selectionStart,3);
 assert.equal(updated.selectionEnd,8);
 assert.strictEqual(h.native.querySelector('#native-seek'),h.seekRange);
 h.close();
});
test('successful Add clears submitted new-label draft while retaining bookmark record',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 const input=h.root.querySelector('input[data-bookmark-label]');
 input.value='submitted label';
 h.button('add').click();await step();
 assert.equal(h.repo.rows.get('sm1')[0].label,'submitted label');
 assert.equal(h.root.querySelector('input[data-bookmark-label]').value,'');
 h.close();
});
test('failed Add leaves the unsubmitted label for retry instead of wiping it',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 const input=h.root.querySelector('input[data-bookmark-label]');
 input.value='keep on failure';
 h.repo.failWrite=true;
 h.button('add').click();await step();
 assert.equal(h.root.querySelector('[data-bookmark-status]').dataset.bookmarkStatus,'error');
 assert.equal(h.root.querySelector('input[data-bookmark-label]').value,'keep on failure');
 h.repo.failWrite=false;
 h.button('add').click();await step();
 assert.equal(h.repo.rows.get('sm1')[0].label,'keep on failure');
 h.close();
});
test('new-video activation never transfers a previous new-bookmark draft',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 h.root.querySelector('input[data-bookmark-label]').value='private for sm1';
 h.active('sm2');await h.session.activate('sm2',300);
 assert.equal(h.root.querySelector('input[data-bookmark-label]').value,'');
 h.close();
});

test('completed Add never clears a newer draft typed while the original save was pending',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 let release=()=>{};
 const waiting=new Promise(resolve=>{release=resolve;});
 const persist=h.repo.add.bind(h.repo);
 h.repo.add=async(...args)=>{await waiting;return persist(...args);};
 const input=h.root.querySelector('input[data-bookmark-label]');
 input.value='save this';
 h.button('add').click();
 input.value='next unsaved idea';
 release();await step();
 assert.equal(h.repo.rows.get('sm1')[0].label,'save this');
 assert.equal(h.root.querySelector('input[data-bookmark-label]').value,
  'next unsaved idea');
 h.close();
});

test('same-text retyping during an in-flight Add remains a new unsaved draft',async()=>{
 const h=harness();
 await h.session.activate('sm1',300);
 let release=()=>{};
 const gate=new Promise(resolve=>{release=resolve;});
 const persist=h.repo.add.bind(h.repo);
 h.repo.add=async(...args)=>{await gate;return persist(...args);};
 const field=h.root.querySelector('input[data-bookmark-label]');
 field.value='repeat label';
 h.button('add').click();
 field.value='another draft';
 field.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
 field.value='repeat label';
 field.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
 release();await step();
 assert.equal(h.repo.rows.get('sm1')[0].label,'repeat label');
 assert.equal(h.root.querySelector('input[data-bookmark-label]').value,
  'repeat label','same visible text can represent a later edit generation');
 h.close();
});

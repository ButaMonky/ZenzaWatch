import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ManualBookmarkPanel} from '../p12-src/ManualBookmarkPanel.ts';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const step=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function harness(extra={},setup=()=>{}){
 const dom=new JSDOM('<section id="root"></section>'),root=dom.window.document.querySelector('#root');
 setup(dom.window,root);
 let active='sm1',listener; const calls=[],ranges=[],previews=[],cleanups=[];
 const row={id:'b1',videoId:'sm1',time:10,endTime:20,label:'range',createdAt:1,updatedAt:1};
 const session={snapshot:{videoId:'sm1',status:'ready',bookmarks:[row]},
 subscribe(fn){listener=fn;fn(this.snapshot);return ()=>{};},
 async add(...args){calls.push(['add',...args]);return {status:'applied'};},
 async update(...args){calls.push(['update',...args]);return {status:'applied'};},
 async remove(){},async rename(){}};
 const panel=new ManualBookmarkPanel(root,session,{currentVideoId:()=>active,currentTime:()=>42,duration:()=>100,
 timestamp:()=>99,newId:()=>'new',seek:t=>calls.push(['seek',t]),automaticTime:()=>30,recordingEnabled:()=>true,
 setRecordingEnabled:v=>calls.push(['record',v]),onRepeatRangeChange:r=>ranges.push(r),
 createScenePreview:(host,id,time)=>{previews.push([id,time]);return ()=>cleanups.push([id,time]);},...extra});
 return {root,dom,panel,session,calls,ranges,previews,cleanups,
 click:s=>{assert(root.querySelector(s),s);root.querySelector(s).click();},
 switchVideo(){active='sm2';session.snapshot={videoId:'sm2',status:'ready',bookmarks:[]};listener(session.snapshot);},
 close(){panel.dispose();dom.window.close();}};
}
test('compact tabs show resume first and recording control outside edit',()=>{
 const h=harness();
 assert.deepEqual([...h.root.querySelectorAll('[data-point-tab]')].map(n=>n.dataset.pointTab),['automatic','manual','repeat']);
 const check=h.root.querySelector('[data-recording-enabled]');assert(check);assert.equal(check.closest('details'),null);
 assert.equal(h.root.querySelector('[data-point-section="automatic"]').hidden,false);
 check.checked=false;check.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));
 assert.deepEqual(h.calls.at(-1),['record',false]);h.close();
});
test('saved range enters repeat tab and publishes active range; drafts and teardown clear it',()=>{
 const h=harness();h.click('[data-bookmark-action="repeat-range"]');
 assert.equal(h.panel.isRepeating,true);assert.deepEqual(h.ranges.at(-1),{a:10,b:20,active:true});
 assert.equal(h.root.querySelector('[data-point-section="repeat"]').hidden,false);
 const field=h.root.querySelector('[data-point-field="a"]');field.value='12';
 field.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
 assert.deepEqual(h.ranges.at(-1),{a:12,b:20,active:false});
 h.switchVideo();assert.equal(h.ranges.at(-1),null);h.close();assert.equal(h.ranges.at(-1),null);
});
test('manual save submits time label and optional end atomically, repeat draft can be saved',async()=>{
 const h=harness();h.click('[data-point-tab="manual"]');
 h.root.querySelector('[data-bookmark-start-id]').value='15';
 h.root.querySelector('[data-bookmark-end-id]').value='25';
 h.root.querySelector('[data-bookmark-rename-id]').value='edited';
 h.click('[data-bookmark-action="rename"]');await step();
 assert.deepEqual(h.calls.at(-1),['update','b1',{time:15,endTime:25,label:'edited'},99]);
 assert(h.panel.setRepeatRange(30,60,false));h.click('[data-point-action="save-range"]');await step();
 assert.deepEqual(h.calls.at(-1),['add','new',30,99,'区間 0:30',60]);h.close();
});
test('previews only lease active tab and release on tab switch and hide',()=>{
 const h=harness();assert.deepEqual(h.previews,[['sm1',30]]);
 h.click('[data-point-tab="manual"]');assert.equal(h.cleanups.length,1);
 assert.deepEqual(h.previews.at(-1),['sm1',10]);
 h.panel.setVisible(false);assert.equal(h.cleanups.length,h.previews.length);h.close();
});
test('library retries failures, collapses historical groups and guards late results',async()=>{
 let count=0;
 const h=harness({loadLibrary:async()=>{if(++count===1)throw Error('secret');return [
 {videoId:'sm1',title:'current',duration:100,updatedAt:2,automaticTime:30,bookmarks:[]},
 {videoId:'sm2',title:'history',duration:100,updatedAt:1,automaticTime:12,bookmarks:[]}];}});
 h.click('[data-library-action="open"]');await step();
 assert(h.root.textContent.includes('再試行'));assert(!h.root.textContent.includes('secret'));
 h.click('[data-library-action="retry"]');await step();
 const groups=h.root.querySelectorAll('[data-library-video]');assert.equal(groups.length,2);
 assert.equal(groups[0].open,true);assert.equal(groups[1].open,false);
 assert(!h.previews.some(([id])=>id==='sm2'));h.close();
});

test('late library read cannot reopen the library after return or video switch',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 const h=harness({loadLibrary:()=>pending});h.click('[data-library-action="open"]');
 h.click('[data-library-action="back"]');h.switchVideo();
 resolve([{videoId:'sm1',title:'stale private title',duration:100,updatedAt:1,automaticTime:2,bookmarks:[]}]);await step();
 assert(!h.root.textContent.includes('stale private title'));assert.equal(h.root.querySelector('[data-library-groups]'),null);h.close();
});
test('library search filters names and kinds; failed edit preserves input and retry succeeds',async()=>{
 let failed=true;const edits=[];
 const entry={videoId:'sm2',title:'history',duration:100,updatedAt:1,automaticTime:12,
 bookmarks:[{id:'r',videoId:'sm2',time:4,endTime:9,label:'chorus',createdAt:1,updatedAt:1}]};
 const h=harness({loadLibrary:async()=>[entry],editLibraryBookmark:async(...args)=>{edits.push(args);if(failed)throw Error('secret');}});
 h.click('[data-library-action="open"]');await step();
 const search=h.root.querySelector('[data-library-search]');search.value='chorus';
 search.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
 assert.equal(h.root.querySelectorAll('[data-library-row]').length,1);
 assert.equal(h.root.querySelector('[data-library-video]').open,false);
 const start=h.root.querySelector('[data-library-start]');start.value='6';
 h.click('[data-library-action="save"]');await step();
 assert.equal(h.root.querySelector('[data-library-start]').value,'6');assert(!h.root.textContent.includes('secret'));
 failed=false;h.click('[data-library-action="save"]');await step();
 assert.deepEqual(edits.at(-1),['sm2','r',{time:6,endTime:9,label:'chorus'},100]);h.close();
});
test('library cross-video range action carries both endpoints and current range stays local',async()=>{
 const opens=[];const h=harness({openLibraryPosition:(...args)=>opens.push(args),loadLibrary:async()=>[
 {videoId:'sm2',title:'history',duration:100,updatedAt:1,automaticTime:null,
 bookmarks:[{id:'r',videoId:'sm2',time:4,endTime:9,label:'chorus',createdAt:1,updatedAt:1}]}]});
 h.click('[data-library-action="open"]');await step();h.click('[data-library-action="repeat"]');
 assert.deepEqual(opens,[['sm2',4,9]]);assert.equal(h.root.querySelector('[data-library-groups]'),null);h.close();
});
test('editing endpoints updates repeat preview and allows B at exact duration',()=>{
 const h=harness();assert(h.panel.setRepeatRange(10,100));
 assert.equal(h.ranges.at(-1).b,100);
 const before=h.previews.length;
 const a=h.root.querySelector('[data-point-field="a"]');a.value='18';a.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
 assert(h.previews.length>before);assert(h.previews.some(([,time])=>time===18));
 assert.equal(h.panel.setRepeatRange(100,101),false);h.close();
});
test('disposed pending library loads never create preview leases',async()=>{
 let resolve;const h=harness({loadLibrary:()=>new Promise(r=>resolve=r)});
 h.click('[data-library-action="open"]');h.panel.dispose();const before=h.previews.length;
 resolve([{videoId:'sm2',title:'late',duration:100,updatedAt:1,automaticTime:3,bookmarks:[]}]);await step();
 assert.equal(h.previews.length,before);assert.equal(h.root.childNodes.length,0);h.dom.window.close();
});

test('pending library edit from an old video cannot block editing the new owner',async()=>{
 let release,first=true;const writes=[];
 const video=id=>({videoId:id,title:id,duration:100,updatedAt:1,automaticTime:3,bookmarks:[]});
 const h=harness({loadLibrary:async()=>[video('sm1'),video('sm2')],
 editLibraryAutomatic:(...args)=>{writes.push(args);if(first){first=false;return new Promise(r=>release=r);}return Promise.resolve();}});
 h.click('[data-library-action="open"]');await step();h.click('[data-library-action="save-auto"]');
 h.switchVideo();h.click('[data-library-action="open"]');await step();
 h.click('[data-library-video="sm2"] [data-library-action="save-auto"]');await step();
 assert.equal(writes.length,2);release();await step();h.close();
});
test('current automatic action saves current position and pending result retains a newer draft',async()=>{
 let release;const saves=[];
 const h=harness({editAutomatic:t=>{saves.push(t);return new Promise(r=>release=r);}});
 h.click('[data-point-action="current-automatic"]');assert.deepEqual(saves,[42]);
 const field=h.root.querySelector('[data-point-field="automatic"]');field.value='55';
 field.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));release(true);await step();
 h.panel.refreshPreferences();assert.equal(h.root.querySelector('[data-point-field="automatic"]').value,'55');h.close();
});
test('IntersectionObserver gates previews, releases exits, and rejects late hidden callbacks',()=>{
 const observers=[];let scrollRoot;
 const h=harness({},(win,root)=>{
  scrollRoot=win.document.createElement('details');scrollRoot.className='zenzaManualBookmarkDock';scrollRoot.open=true;
  root.before(scrollRoot);scrollRoot.append(root);
  win.IntersectionObserver=class {
   constructor(callback,options){this.callback=callback;this.options=options;this.hosts=[];observers.push(this);}
   observe(host){this.hosts.push(host);} disconnect(){this.disconnected=true;}
   emit(host,isIntersecting){this.callback([{target:host,isIntersecting}]);}
  };
 });
 assert.equal(h.previews.length,0,'offscreen hosts never load');
 const observer=observers.at(-1),host=observer.hosts[0];
 assert.equal(observer.options.root,scrollRoot);assert.equal(observer.options.rootMargin,'100px');
 observer.emit(host,true);assert.equal(h.previews.length,1);
 observer.emit(host,false);assert.equal(h.cleanups.length,1);
 observer.emit(host,true);assert.equal(h.previews.length,2);
 h.panel.setVisible(false);assert.equal(h.cleanups.length,2);assert(observer.disconnected);
 observer.emit(host,true);assert.equal(h.previews.length,2,'revoked observer cannot reacquire');
 h.close();
});
test('fallback limits expanded preview hosts and search does not expand historical videos',async()=>{
 const rows=Array.from({length:50},(_,i)=>({id:'b'+i,videoId:'sm1',time:i,label:'scene '+i,createdAt:1,updatedAt:1}));
 const h=harness({loadLibrary:async()=>[
 {videoId:'sm1',title:'scene current',duration:100,updatedAt:1,automaticTime:null,bookmarks:rows},
 ...Array.from({length:10},(_,i)=>({videoId:'old'+i,title:'scene history',duration:100,updatedAt:1,automaticTime:2,bookmarks:[]}))]});
 h.click('[data-library-action="open"]');await step();
 assert.equal(h.previews.length-h.cleanups.length,12);
 const search=h.root.querySelector('[data-library-search]');search.value='scene';
 search.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
 assert.equal(h.root.querySelectorAll('[data-library-video][open]').length,1);
 assert.equal(h.previews.length-h.cleanups.length,12);h.close();
});
test('observer bounds concurrent hosts and fills released slots from visible candidates',async()=>{
 const observers=[];
 const h=harness({loadLibrary:async()=>[{videoId:'sm1',title:'current',duration:100,updatedAt:1,automaticTime:null,
 bookmarks:Array.from({length:40},(_,i)=>({id:'b'+i,videoId:'sm1',time:i,label:'scene',createdAt:1,updatedAt:1}))}]},win=>{
 win.IntersectionObserver=class {
  constructor(callback){this.callback=callback;this.hosts=[];observers.push(this);}observe(host){this.hosts.push(host);}disconnect(){}
 };
 });
 h.click('[data-library-action="open"]');await step();
 const observer=observers.at(-1);observer.callback(observer.hosts.map(target=>({target,isIntersecting:true})));
 assert.equal(h.previews.length-h.cleanups.length,12);
 observer.callback([{target:observer.hosts[0],isIntersecting:false}]);
 assert.equal(h.cleanups.length,1);assert.equal(h.previews.length-h.cleanups.length,12);
 h.close();assert.equal(h.previews.length,h.cleanups.length);
});
test('successful automatic edit replaces its scene and delete releases it',async()=>{
 const h=harness({editAutomatic:async()=>true,deleteAutomatic:async()=>true});
 h.root.querySelector('[data-point-field="automatic"]').value='45';
 h.click('[data-point-action="save-automatic"]');await step();
 assert.equal(h.root.querySelector('[data-point-section="automatic"] [data-scene-time]').dataset.sceneTime,'45');
 assert.deepEqual(h.previews.at(-1),['sm1',45]);
 h.click('[data-point-action="delete-automatic"]');await step();
 assert.equal(h.root.querySelector('[data-point-section="automatic"] [data-scene-time]'),null);
 assert.equal(h.cleanups.length,h.previews.length);h.close();
});

test('observer limits distinct videos to three and releases a video before admitting another',async()=>{
 const observers=[];
 const h=harness({loadLibrary:async()=>Array.from({length:4},(_,i)=>({
 videoId:'sm'+(i+1),title:'video '+i,duration:100,updatedAt:1,automaticTime:i,bookmarks:[]}))},win=>{
 win.IntersectionObserver=class {
  constructor(callback){this.callback=callback;this.hosts=[];observers.push(this);}observe(host){this.hosts.push(host);}disconnect(){}
 };
 });
 h.click('[data-library-action="open"]');await step();
 for(const group of h.root.querySelectorAll('[data-library-video]')){
  group.open=true;group.dispatchEvent(new h.dom.window.Event('toggle'));
 }
 const observer=observers.at(-1);assert.equal(observer.hosts.length,4);
 observer.callback(observer.hosts.map(target=>({target,isIntersecting:true})));
 assert.equal(h.previews.length,3);assert.equal(new Set(h.previews.map(([id])=>id)).size,3);
 observer.callback([{target:observer.hosts[0],isIntersecting:false}]);
 assert.equal(h.cleanups.length,1);assert.equal(h.previews.length,4);
 assert.deepEqual(h.previews.at(-1),['sm4',3]);h.close();
});

'use strict';
// #234 synthetic two-tab IndexedDB behavior; never read real browser profiles.
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require('jsdom');
const {describe,it,before}=typeof global.describe==='function'?global:require('node:test');
let Session,Dock;
const load=rel=>new Function('u','return import(u)')(
  pathToFileURL(path.resolve(rel)).href);
before(async()=>{
  ({ManualBookmarkSession:Session}=await load('packages/zenza/src/resume/ManualBookmarkSession.js'));
  ({ManualBookmarkDock:Dock}=await load('packages/zenza/src/resume/ManualBookmarkDock.js'));
});
const bookmark=(id,label='alpha')=>({id,videoId:'sm9',time:15,
  label,createdAt:100,updatedAt:100});
const step=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function shared(){
  const rows=new Map([['sm9',[bookmark('B1')]]]);
  const logs=[];let blocked=null,shouldFail=false;
  const factory=()=>({
    async load(videoId){
      logs.push(['load',videoId]);
      if(shouldFail)throw Error('SYNTHETIC_SECRET');
      return (rows.get(videoId)||[]).map(v=>({...v}));
    },
    async add(draft){
      logs.push(['add',draft.videoId]);
      if(blocked)await blocked.promise;
      const all=rows.get(draft.videoId)||[];
      const next=[...all,{id:draft.id,videoId:draft.videoId,time:draft.time,
        label:draft.label||'',createdAt:draft.now,updatedAt:draft.now}];
      rows.set(draft.videoId,next);return next;
    },
    async rename(id,bookmarkId,label,now){
      const next=(rows.get(id)||[]).map(b=>b.id===bookmarkId?
        {...b,label,updatedAt:now}:b);
      rows.set(id,next);return next;
    },
    async remove(id,bookmarkId){
      const next=(rows.get(id)||[]).filter(b=>b.id!==bookmarkId);
      rows.set(id,next);return next;
    },
    close(){}
  });
  return {rows,logs,factory,
    failReads:v=>shouldFail=v,
    blockWrites(){
      let resolve;const promise=new Promise(r=>resolve=r);
      blocked={promise,resolve};return ()=>{blocked.resolve();blocked=null;};
    }};
}
function dockFixture(storage){
  const dom=new JSDOM('<!doctype html><body><div class="zenzaPlayerContainer"><div class="zenzaWatchVideoInfoPanel"><div class="tabs videoInfoTab"><div class="zenzaWatchVideoInfoPanelContent"><div class="seriesList"></div></div></div></div></div></body>');
  const doc=dom.window.document,host=doc.querySelector('.zenzaPlayerContainer');
  let active='sm9';
  const session=new Session(storage.factory());
  const dock=Dock.mount(host,session,{
    currentVideoId:()=>active,currentTime:()=>15,timestamp:()=>200,
    newId:()=> 'B999',seek() {},duration:()=>120
  });
  const content=()=>dock.element;
  return {dom,doc,host,session,dock,content,active:id=>active=id,
    destroy(){dock.dispose();dom.window.close();}};
}
describe('#234 shared manual bookmark refresh on Dock reopen',()=>{
  it('publishes a committed library edit to another open tab',async()=>{
    const before=global.window,peers=[];
    class Channel{
      constructor(){peers.push(this);}
      postMessage(data){for(const peer of peers)if(peer!==this)peer.onmessage?.({data});}
      close(){}
    }
    global.window={BroadcastChannel:Channel};let a,b;
    try{
      const storage=shared();a=new Session(storage.factory());b=new Session(storage.factory());
      await a.activate('sm9',120);await b.activate('sm9',120);
      await storage.factory().remove('sm9','B1');
      a.notifyCommittedChange();await step();
      assert.equal(a.snapshot.bookmarks.length,0);assert.equal(b.snapshot.bookmarks.length,0);
    }finally{a?.dispose();b?.dispose();if(before===undefined)delete global.window;else global.window=before;}
  });
  it('retains a peer invalidation received during a local write',async()=>{
    const before=global.window,peers=[];
    class Channel{
      constructor(){peers.push(this);}
      postMessage(data){for(const peer of peers)if(peer!==this)peer.onmessage?.({data});}
      close(){}
    }
    global.window={BroadcastChannel:Channel};
    let b;
    try{
      const s=shared(),repository=s.factory();
      let release;
      repository.add=()=>new Promise(resolve=>{release=()=>resolve([bookmark('B1'),bookmark('B2')]);});
      b=new Session(repository);await b.activate('sm9',120);
      const write=b.add('B2',40,200);
      s.rows.set('sm9',[bookmark('B1'),bookmark('B2'),bookmark('B3','peer')]);
      peers[0].onmessage({data:{kind:'changed'}});
      release();await write;await step();
      assert.equal(b.snapshot.bookmarks.length,3,'pending peer update must be reread after local commit');
    }finally{b?.dispose();if(before===undefined)delete global.window;else global.window=before;}
  });
  it('rereads after an invalidation arrives while an earlier read is pending',async()=>{
    const before=global.window,peers=[];
    class Channel{constructor(){peers.push(this);}postMessage(){}close(){}}
    global.window={BroadcastChannel:Channel};
    let b;
    try{
      const s=shared(),repository=s.factory();
      b=new Session(repository);await b.activate('sm9',120);
      const original=repository.load;let release,reads=0;
      repository.load=id=>++reads===1?new Promise(resolve=>{release=()=>resolve([bookmark('B1')]);}):original(id);
      const refresh=b.refreshIfIdle();
      s.rows.set('sm9',[bookmark('B1'),bookmark('B2')]);
      peers[0].onmessage({data:{kind:'changed'}});
      release();await refresh;await step();
      assert.equal(b.snapshot.bookmarks.length,2,'second invalidation cannot be coalesced into stale read');
      assert.equal(reads,2);
    }finally{b?.dispose();if(before===undefined)delete global.window;else global.window=before;}
  });
  it('reloads cross-tab additions on explicit reopen and updates the list',async()=>{
    const s=shared(),a=new Session(s.factory()),b=dockFixture(s);
    await a.activate('sm9',120);await b.dock.activate('sm9',120);
    assert.equal(b.content().querySelectorAll('li').length,1);
    await a.add('B2',40,200,'Tab A');
    assert.equal(b.content().querySelectorAll('li').length,1);
    b.dock.toggle(b.host);
    await step();
    assert.equal(b.session.snapshot.bookmarks.length,2);
    assert.equal(b.content().querySelectorAll('li').length,2);
    b.destroy();a.dispose();
  });
  it('does not rerender unchanged snapshots or discard unsaved rename drafts',async()=>{
    const s=shared(),a=new Session(s.factory()),b=dockFixture(s);
    await a.activate('sm9',120);await b.dock.activate('sm9',120);
    const field=b.content().querySelector('input[data-bookmark-rename-id="B1"]');
    field.value='Not submitted';
    const oldSnapshot=b.session.snapshot;
    await b.session.refreshIfIdle();
    assert.strictEqual(b.session.snapshot,oldSnapshot,'unchanged row must not publish');
    assert.strictEqual(b.content().querySelector('input[data-bookmark-rename-id="B1"]'),field);
    await a.add('B2',40,200,'Tab A');
    b.dock.toggle(b.host);await step();
    assert.equal(b.content().querySelector('input[data-bookmark-rename-id="B1"]').value,'Not submitted');
    b.destroy();a.dispose();
  });
  it('a transient refresh failure preserves existing markers and ready state',async()=>{
    const s=shared(),b=dockFixture(s);await b.dock.activate('sm9',120);
    const before=b.session.snapshot;
    s.failReads(true);
    const result=await b.session.refreshIfIdle();
    assert.equal(result.status,'error');
    assert.strictEqual(b.session.snapshot,before);
    assert.equal(b.session.snapshot.status,'ready');
    assert.equal(b.content().querySelectorAll('li').length,1);
    s.failReads(false);b.destroy();
  });
  it('never refreshes during a pending local write',async()=>{
    const s=shared(),b=dockFixture(s);await b.dock.activate('sm9',120);
    const release=s.blockWrites(),pending=b.session.add('B2',40,220,'local');
    const n=s.logs.filter(x=>x[0]==='load').length;
    const result=await b.session.refreshIfIdle();
    assert.equal(result.status,'stale');
    assert.equal(s.logs.filter(x=>x[0]==='load').length,n);
    release();await pending;
    assert.equal(b.session.snapshot.bookmarks.length,2);
    b.destroy();
  });
  it('late refresh from a previous video cannot replace a new video',async()=>{
    const s=shared(),b=dockFixture(s);await b.dock.activate('sm9',120);
    let release;const original=b.session.repository.load.bind(b.session.repository);
    b.session.repository.load=(id,limit)=>id==='sm9'?
      new Promise(resolve=>{release=()=>resolve([bookmark('B1'),bookmark('B2')]);}):
      original(id,limit);
    const pending=b.session.refreshIfIdle();
    b.active('sm10');await b.dock.activate('sm10',100);
    release();const result=await pending;
    assert.equal(result.status,'stale');
    assert.equal(b.session.snapshot.videoId,'sm10');
    assert.equal(b.session.snapshot.bookmarks.length,0);
    b.destroy();
  });
  it('visible-tab event refreshes an open Dock and stops after dispose',async()=>{
    const s=shared(),a=new Session(s.factory()),b=dockFixture(s);
    await a.activate('sm9',120);await b.dock.activate('sm9',120);
    Object.defineProperty(b.doc,'visibilityState',{configurable:true,get:()=> 'visible'});
    b.dock.toggle(b.host);await step();
    await a.add('B2',30,220,'second tab');
    b.doc.dispatchEvent(new b.dom.window.Event('visibilitychange'));
    await step();
    assert.equal(b.session.snapshot.bookmarks.length,2);
    let called=0;b.session.refreshIfIdle=()=>{called++;return Promise.resolve();};
    b.destroy();
    b.doc.dispatchEvent(new b.dom.window.Event('visibilitychange'));
    assert.equal(called,0);
    a.dispose();
  });
  it('BroadcastChannel carries invalidation only and updates an already-open peer',async()=>{
    const before=global.window,peers=new Set(),payloads=[];
    class Channel{
      constructor(name){this.name=name;this.closed=false;peers.add(this);}
      postMessage(data){
        payloads.push(data);
        for(const peer of peers)if(peer!==this&&!peer.closed){
          peer.onmessage?.({data});
        }
      }
      close(){this.closed=true;peers.delete(this);}
    }
    global.window={BroadcastChannel:Channel};
    let a,b;
    try{
      const s=shared();
      a=new Session(s.factory());b=new Session(s.factory());
      await a.activate('sm9',120);await b.activate('sm9',120);
      await a.add('B2',45,260,'private-test-label');
      await step();
      assert.equal(b.snapshot.bookmarks.length,2);
      assert.deepEqual(payloads,[{kind:'changed'}]);
      assert(!JSON.stringify(payloads).includes('sm9'));
      assert(!JSON.stringify(payloads).includes('private-test-label'));
      // Reading must never re-broadcast and create an update storm.
      assert.equal(payloads.length,1);
    }finally{
      a?.dispose();b?.dispose();
      if(before===undefined)delete global.window;
      else global.window=before;
    }
    assert.equal(peers.size,0,'all channels close at disposal');
  });
});

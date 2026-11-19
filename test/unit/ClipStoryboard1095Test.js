'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const raw=(buffer=false)=>({watchId:'sm9',status:'ok',format:'domand',duration:40,storyboard:{
  thumbnail:{width:16,height:9},rows:1,columns:4,interval:5000,count:8,
  images:[0,1].map(i=>({url:'https://example.test/sheet'+i,...(buffer?{buffer:new ArrayBuffer(3)}:{})}))}});
function fixture() {
  const doc=new JSDOM('<main></main>').window.document;
  const calls={reads:[],requests:[],cells:[],revokes:[],events:{},worker:0};
  const create=doc.createElement.bind(doc);
  doc.createElement=tag=>{
    const node=create(tag);
    if(tag==='canvas')node.getContext=()=>({putImageData(){},drawImage(...args){calls.cells.push(args.slice(1,5));}});
    if(tag==='img')Object.defineProperty(node,'src',{set(url){if(url){calls.requests.push(url);queueMicrotask(()=>node.onload?.());}}});
    return node;
  };
  const worker={async readCachedCell(){calls.worker++;return null;}};
  const db={async getPreview(key,t){calls.reads.push([key,t]);return null;}};
  const context=vm.createContext({document:doc,console,ArrayBuffer,Blob,Map,Set,AbortController,setTimeout,clearTimeout,
    URL:{createObjectURL:()=> 'blob:sheet',revokeObjectURL:url=>calls.revokes.push(url)},
    StoryboardWorker:worker,StoryboardCacheDb:db,SeekBarThumbnail:{},global:{debug:{}},Emitter:class{emit(){}},exports:{}});
  for(const name of ['StoryboardInfoModel','Storyboard']){
    const source=fs.readFileSync('tools/typescript-stage1/nico-src/'+name+'.ts','utf8');
    vm.runInContext(stripTypeScriptTypes(source).replace(/export \{([^}]+)\};/g,(_,ids)=>ids.split(',').map(id=>'exports.'+id.trim()+'='+id.trim()+';').join('')),context);
  }
  const board=Object.create(context.exports.Storyboard.prototype);
  board.config={props:{enableStoryboard:true}}; board.model=new context.exports.StoryboardInfoModel({});
  board.on=(key,fn)=>(calls.events[key]??=new Set()).add(fn);
  board.off=(key,fn)=>calls.events[key].delete(fn);
  board.savedScenes=()=>{throw Error('clip must not open a saved-scene network session');};
  const hosts=Array.from({length:8},()=>create('div'));
  return {board,hosts,worker,db,calls,emit:key=>{for(const fn of calls.events[key]||[])fn();}};
}
describe('Task1095 clip storyboard reuse',()=>{
  it('uses the shared worker first and discards a cancelled frame',async()=>{
    const {board,worker,hosts,calls}=fixture();board._watchId='sm9';board.model.update(raw());
    let resolve;worker.readCachedCell=()=>new Promise(r=>resolve=r);
    const draw=board.createClipPreviewSource('sm9');const off=draw(hosts[0],7);
    await tick();off();resolve({width:4,height:3});await tick();
    assert.equal(hosts[0].children.length,0);assert.equal(calls.requests.length,0);assert.equal(calls.reads.length,0);
    worker.readCachedCell=async id=>{assert.equal(id,'sm9');return {width:4,height:3};};
    draw(hosts[1],7);await tick();assert.ok(hosts[1].querySelector('canvas'));
    assert.equal(calls.reads.length,0);
  });
  it('reads each persistent sheet once, draws the correct cells and reuses them after panning',async()=>{
    const {board,db,hosts,calls}=fixture();
    db.getPreview=async(key,t)=>{calls.reads.push([key,t]);const data=raw();data.storyboard.images[t<20?0:1].buffer=new ArrayBuffer(3);return data;};
    const draw=board.createClipPreviewSource('sm9');
    const releases=hosts.map((host,i)=>draw(host,i*5));await tick();await tick();
    assert.equal(calls.reads.length,2);assert.equal(calls.requests.length,2);
    assert.deepEqual(calls.cells.map(c=>c[0]).sort((a,b)=>a-b),[0,0,16,16,32,32,48,48]);
    releases.forEach(off=>off());draw(hosts[0],25);await tick();
    assert.equal(calls.requests.length,2);assert.equal(calls.reads.length,2);
  });
  it('waits for the matching player load and settles on success, error, invalid response and reset',async()=>{
    const {board,hosts,emit}=fixture();board.state={};board.emit=emit;board._watchId='sm9';
    board._requestId=1;board._loadingWatchId='sm9';
    const draw=board.createClipPreviewSource('sm9');draw(hosts[0],1);await tick();
    assert.equal(hosts[0].getAttribute('aria-busy'),'true');
    board._onStoryboardInfoLoad(1,null);await tick();
    assert.equal(hosts[0].textContent,'画像なし');
    board._loadingWatchId='sm9';emit('loading');await tick();
    assert.equal(hosts[0].getAttribute('aria-busy'),'true');
    board._onStoryboardInfoLoadFail(1,'test');await tick();
    assert.equal(hosts[0].textContent,'画像なし');
    board._loadingWatchId='sm10';emit('loading');await tick();
    assert.equal(hosts[0].getAttribute('aria-busy'),'false');
    board._loadingWatchId='sm9';emit('loading');await tick();emit('reset');
    assert.equal(hosts[0].textContent,'画像なし');
    board._onStoryboardInfoLoad(1,raw(true));await tick();
    assert.ok(hosts[0].querySelector('canvas'));
  });
  it('does not reuse a warm sheet while the storyboard setting is disabled',async()=>{
    const {board,hosts,worker,calls,emit}=fixture();board._watchId='sm9';board.model.update(raw(true));
    const draw=board.createClipPreviewSource('sm9');draw(hosts[0],1);await tick();
    assert.ok(hosts[0].querySelector('canvas'));assert.equal(calls.requests.length,1);
    board.config.props.enableStoryboard=false;emit('reset');
    worker.readCachedCell=async()=>{throw Error('disabled worker must not run');};
    draw(hosts[1],1);await tick();
    assert.ok(hosts.slice(0,2).every(host=>!host.querySelector('canvas')));
    assert.equal(calls.requests.length,1);assert.equal(calls.reads.length,0);
  });
  it('shares current sheet URLs and never starts historical network loading on a cold miss',async()=>{
    const {board,db,hosts,calls,emit}=fixture();
    const draw=board.createClipPreviewSource('sm9');const off=draw(hosts[0],0);await tick();
    assert.equal(hosts[0].textContent,'画像なし');assert.deepEqual(calls.requests,[]);off();
    board._watchId='sm9';board.model.update(raw());emit('update');
    const live=board.createClipPreviewSource('sm9');hosts.map((host,i)=>live(host,i*2));await tick();await tick();
    assert.deepEqual(calls.requests,['https://example.test/sheet0']);
    assert.ok(hosts.every(h=>h.querySelector('canvas')));
    board._watchId='sm10';board.model.update({...raw(),watchId:'sm10'});db.getPreview=async()=>null;emit('reset');await tick();
    assert.ok(hosts.every(h=>!h.querySelector('canvas')));
  });
});

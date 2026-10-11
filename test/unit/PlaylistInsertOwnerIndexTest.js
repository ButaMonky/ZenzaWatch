'use strict';
const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {extract,run} = require('../helpers/extractSource');

const rawInfo=id=>({
  id, title:'title '+id, duration:60, commentCount:1, mylistCount:1,
  viewCount:1, thumbnail:'https://example.invalid/x.jpg',
  postedAt:'2020/01/01 00:00:00'
});
function deferred() {
  let resolve, reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise, resolve, reject};
}
function fixture(path) {
  const h=createPlaylistContext();
  // The playlist harness already declares PlayList in this VM. Evaluate
  // the generated class as an expression to avoid redeclaring that binding.
  const Klass=path==='packages/zenza/src/Playlist/PlayList.js' ?
    h.PlayList : run('('+extract(path,'PlayList','class')+')',h.c);
  const p=new Klass();
  p.initialize({loop:false,container:null,loader:{}});
  p.view={scrollToItem(){},scrollTop(){},hasFocus:false};
  const a=h.item('smA'), b=h.item('smB'), c=h.item('smC');
  p.model.setItem([a,b,c]);p.setIndex(1);
  const waits=[],events=[];
  p._thumbInfoLoader={load:id=>{
    const d=deferred();waits.push({id,...d});return d.promise;
  }};
  p.on('command',(...args)=>events.push(args));
  return {h,p,a,b,c,waits,events,order:()=>Array.from(p.model.items,x=>x.watchId)};
}
for(const path of ['packages/zenza/src/Playlist/PlayList.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task382 AUD-41 next-play insertion follows stable item ownership '+path,
    function() {
    this.timeout(18000);
    it('inserts behind the original anchor after reorder during metadata fetch',async()=>{
      const f=fixture(path),pending=f.p.insert('smX');
      f.p.model.appendItem(f.h.item('smD'));
      f.p.model.reverse();
      assert.deepStrictEqual(f.order(),['smD','smC','smB','smA']);
      f.waits[0].resolve(rawInfo('smX'));
      await pending;
      assert.deepStrictEqual(f.order(),['smD','smC','smB','smX','smA']);
      assert.strictEqual(f.p._activeItem,f.b);
      assert.strictEqual(f.p._index,2);
    });
    it('updates insertion position after a preceding item is added',async()=>{
      const f=fixture(path),pending=f.p.insert('smX');
      f.p.model.insertItem(f.h.item('smZ'),0);
      f.waits[0].resolve(rawInfo('smX'));
      await pending;
      assert.deepStrictEqual(f.order(),['smZ','smA','smB','smX','smC']);
      assert.strictEqual(f.p._activeItem,f.b);
    });
    it('places failed metadata fallback behind the moved anchor',async()=>{
      const f=fixture(path),pending=f.p.insert('smX');
      f.p.model.appendItem(f.h.item('smD'));
      f.p.model.reverse();
      f.waits[0].reject({status:'fail'});
      await pending;
      assert.deepStrictEqual(f.order(),['smD','smC','smB','smX','smA']);
      assert.strictEqual(f.events.filter(x=>x[0]==='alert').length,1);
    });
    it('ignores completion once a different playlist model owns the view',async()=>{
      const f=fixture(path),pending=f.p.insert('smX');
      const old=f.p.model;
      f.p.model=new f.h.PlayListModel({});
      f.p.model.setItem([f.h.item('smD')]);
      f.waits[0].resolve(rawInfo('smX'));
      await pending;
      assert.deepStrictEqual(f.order(),['smD']);
      assert.strictEqual(old.findByWatchId('smX'),undefined);
      assert.deepStrictEqual(f.events,[]);
    });
    it('does not append to a playlist after its original anchor disappears',async()=>{
      const f=fixture(path),pending=f.p.insert('smX');
      f.p.model.removeItem(f.b);
      f.waits[0].resolve(rawInfo('smX'));
      await pending;
      assert.strictEqual(f.p.model.findByWatchId('smX'),undefined);
      assert.deepStrictEqual(f.order(),['smA','smC']);
    });
    it('preserves normal behavior when there is no asynchronous index change',async()=>{
      const f=fixture(path),pending=f.p.insert('smX');
      f.waits[0].resolve(rawInfo('smX'));
      await pending;
      assert.deepStrictEqual(f.order(),['smA','smB','smX','smC']);
      assert.strictEqual(f.events.filter(x=>x[0]==='notifyHtml').length,1);
    });
    it('inserts at the head when no active video exists',async()=>{
      const f=fixture(path);
      f.p.setIndex(-1,true);
      const pending=f.p.insert('smX');
      f.waits[0].resolve(rawInfo('smX'));
      await pending;
      assert.deepStrictEqual(f.order(),['smX','smA','smB','smC']);
    });
  });
}

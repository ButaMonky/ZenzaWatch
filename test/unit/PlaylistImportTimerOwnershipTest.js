'use strict';
const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {extract, run} = require('../helpers/extractSource');

function fixture(file) {
  const h=createPlaylistContext(), timers=[], commands=[];
  const P=file==='packages/zenza/src/Playlist/PlayList.js' ?
    h.PlayList : run('('+extract(file,'PlayList','class')+')', h.c);
  const p=new P();
  p.initialize({loop:false,container:null,loader:{}});
  p.view={scrollToItem(){},scrollTop(){},hasFocus:false};
  p.on('command',(...args)=>commands.push(args));
  h.c.setTimeout=(fn,ms)=>{
    timers.push({fn,ms});
    return timers.length;
  };
  h.c.console={log(){},warn(){},error(){},time(){},timeEnd(){}};
  const data=(prefix,index=0,count=3)=>JSON.stringify({
    items:Array.from({length:count},(_,n)=>({
      id:prefix+(n+1), title:'fixture-'+prefix+'-'+(n+1),
      length_seconds:60, num_res:1, thumbnail_url:'https://example.invalid/p.jpg'
    })),
    index,enable:false,loop:false
  });
  const start=(prefix,index=0,count=3)=>{
    p._onImportFileCommand(data(prefix,index,count));
    return timers.filter(t=>t.ms===2000).at(-1);
  };
  const play=()=>commands.filter(x=>x[0]==='openNow').map(x=>x[1]);
  const snapshot=()=>Array.from(p.model.items,x=>x.watchId);
  return {h,p,timers,commands,data,start,play,snapshot};
}
for(const file of ['packages/zenza/src/Playlist/PlayList.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task383 AUD-41 stale import timer ownership ('+file+')',function(){
    this.timeout(16000);
    it('old import cannot open an item from the newer imported playlist',()=>{
      const f=fixture(file),a=f.start('smA',2),b=f.start('smB',0);
      assert.deepStrictEqual(f.snapshot(),['smB1','smB2','smB3']);
      a.fn();
      assert.deepStrictEqual(f.play(),[],'A must not open B3');
      b.fn();
      assert.deepStrictEqual(f.play(),['smB1']);
      assert.strictEqual(f.p._activeItem.watchId,'smB1');
    });
    it('even two imports with the same index are latest-only',()=>{
      const f=fixture(file),a=f.start('smA',1),b=f.start('smB',1);
      a.fn();b.fn();
      assert.deepStrictEqual(f.play(),['smB2']);
    });
    it('does not open a row from a replaced playlist after a non-import change',()=>{
      const f=fixture(file),a=f.start('smA',1);
      f.p.model.setItem([f.h.item('smX'),f.h.item('smY')]);
      f.p.setIndex(0,true);
      a.fn();
      assert.deepStrictEqual(f.play(),[]);
      assert.deepStrictEqual(f.snapshot(),['smX','smY']);
    });
    it('does not override a user-selected different item during the delay',()=>{
      const f=fixture(file),a=f.start('smA',2);
      f.p.setIndex(0,true);
      a.fn();
      assert.deepStrictEqual(f.play(),[]);
      assert.strictEqual(f.p._activeItem.watchId,'smA1');
    });
    it('does not open a stale target after rows are reordered',()=>{
      const f=fixture(file),a=f.start('smA',0);
      f.p.model.reverse();
      a.fn();
      assert.deepStrictEqual(f.play(),[]);
    });
    it('replays the imported index when unchanged and keeps original delay',()=>{
      const f=fixture(file),a=f.start('smA',1);
      assert.strictEqual(a.ms,2000);
      assert.deepStrictEqual(f.play(),[]);
      a.fn();
      assert.deepStrictEqual(f.play(),['smA2']);
      assert.strictEqual(f.p._activeItem.watchId,'smA2');
    });
    it('normalizes out-of-range index without opening an invalid row',()=>{
      const f=fixture(file),a=f.start('smA',999);
      a.fn();
      assert.deepStrictEqual(f.play(),['smA3']);
    });
    it('does not open any item from an empty imported list',()=>{
      const f=fixture(file),a=f.start('smA',0,0);
      a.fn();
      assert.deepStrictEqual(f.play(),[]);
    });
    it('invalid JSON does not schedule a new callback or corrupt pending valid import',()=>{
      const f=fixture(file),a=f.start('smA',1);
      f.p._onImportFileCommand('{broken');
      assert.strictEqual(f.timers.filter(t=>t.ms===2000).length,1);
      a.fn();
      assert.deepStrictEqual(f.play(),['smA2']);
    });
    it('an explicit replacement of playlist model invalidates import completion',()=>{
      const f=fixture(file),a=f.start('smA',1);
      f.p.model=new f.h.PlayListModel({});
      f.p.model.setItem([f.h.item('smOther')]);
      a.fn();
      assert.deepStrictEqual(f.play(),[]);
      assert.deepStrictEqual(f.snapshot(),['smOther']);
    });
  });
}

'use strict';
const assert=require('assert');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {extract,run}=require('../helpers/extractSource');

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function fixture(path) {
  const h=createPlaylistContext(), requests=[],updates=[];
  const P=path==='packages/zenza/src/Playlist/PlayList.js' ?
    h.PlayList : run('('+extract(path,'PlayList','class')+')',h.c);
  for(const key of ['SEARCH_LIMIT_DEFAULT','SEARCH_LIMIT_MIN','SEARCH_LIMIT_MAX']){
    P[key]=h.PlayList[key];
  }
  const p=new P();
  p.initialize({loop:false,container:null,loader:{}});
  p.view={scrollToItem(){},scrollTop(){},hasFocus:false};
  p.model.setItem([h.item('smSeed')]);p.setIndex(0);
  h.c.console={log(){},error(){},warn(){},time(){},timeEnd(){}};
  p._playlistApiLoader={load:(descriptor, msgInfo)=>{
    const d=deferred();requests.push({kind:'load',descriptor,msgInfo,...d});
    return d.promise;
  }};
  p._nicoSearchApiLoader={searchMore:(word,opts,limit)=>{
    const d=deferred();requests.push({kind:'search',word,opts,limit,...d});
    return d.promise;
  }};
  p.on('update',()=>updates.push('update'));
  const ids=()=>Array.from(p.model.items,item=>item.watchId);
  const complete=(n,list)=>{
    const q=requests[n];
    if(q.kind==='load'){q.resolve(list.map(id=>h.raw(id)));}
    else{q.resolve({list:list.map(id=>h.raw(id))});}
  };
  const load=(valid,options={})=>
    p.load({type:'mylist',id:'123'}, {watchId:'smSeed',...options},
      {thread:'A'},valid);
  const search=(valid,options={})=>
    p.loadSearchVideo('word',{watchId:'smSeed',...options},100,valid);
  return {h,p,requests,updates,ids,complete,load,search};
}
for(const path of ['packages/zenza/src/Playlist/PlayList.js',
  'dist/ZenzaWatch-dev.user.js']){
  describe('Task385 navigation ownership before playlist commit '+path,()=>{
    for(const [mode,start] of [['mylist','load'],['search','search']]){
      it('discards A success after owner invalidation: '+mode,async()=>{
        const f=fixture(path);let valid=true;
        const pending=f[start](()=>valid);
        valid=false;
        f.complete(0,['smA']);
        const result=await pending;
        assert.strictEqual(result.status,'superseded');
        assert.deepStrictEqual(f.ids(),['smSeed']);
        assert.deepStrictEqual(f.updates,[]);
      });
      it('preserves same-video success and list replacement: '+mode,async()=>{
        const f=fixture(path);let valid=true;
        const pending=f[start](()=>valid);
        f.complete(0,['smA','smB']);
        const result=await pending;
        assert.strictEqual(result.status,'ok');
        assert.deepStrictEqual(f.ids(),['smA','smB']);
        assert.ok(f.updates.length>0);
      });
      it('turns obsolete network failure into ignored result: '+mode,async()=>{
        const f=fixture(path);let valid=true;
        const pending=f[start](()=>valid);
        valid=false;
        f.requests[0].reject(new Error('obsolete-failure'));
        const result=await pending;
        assert.strictEqual(result.status,'superseded');
        assert.deepStrictEqual(f.ids(),['smSeed']);
      });
      it('preserves live network failures on the current video: '+mode,async()=>{
        const f=fixture(path);
        const pending=f[start](()=>true);
        f.requests[0].reject(new Error('current-failure'));
        await assert.rejects(pending,/current-failure/);
        assert.deepStrictEqual(f.ids(),['smSeed']);
      });
      it('still works without an optional ownership validator: '+mode,async()=>{
        const f=fixture(path);
        const pending=f[start](undefined);
        f.complete(0,['smA']);
        assert.strictEqual((await pending).status,'ok');
        assert.deepStrictEqual(f.ids(),['smA']);
      });
      it('guards additive requests after video navigation too: '+mode,async()=>{
        const f=fixture(path);let valid=true;
        const pending=f[start](()=>valid,{insert:true});
        valid=false;
        f.complete(0,['smA']);
        assert.strictEqual((await pending).status,'superseded');
        assert.deepStrictEqual(f.ids(),['smSeed']);
      });
    }
  });
}

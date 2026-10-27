'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {extract,createContext,run}=require('../helpers/extractSource');
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};

function fixture(hostname='www.nicovideo.jp'){
  const dom=new JSDOM('<html><body><div id="mylistPocket-popup"><img slot="video-thumbnail"></div></body></html>',
    {url:'https://'+hostname+'/my'});
  const image=dom.window.document.querySelector('img');
  const loadResolutions=new Map();
  const fetchResolutions=new Map();
  const calls=[];
  const view={
    _slot:{'video-thumbnail':image},
    _videoInfo:null,
    reset(){this._videoInfo=null;},
    show(){},
    bind(info){this._videoInfo=info;image.src=info.videoThumbnail||'';}
  };
  const context=createContext({
    window:dom.window,
    DOMParser:dom.window.DOMParser,
    location:{hostname},
    PocketThumbnail:null,
    VideoInfo:{createByThumbInfo:thumb=>({
      status:'ok',watchId:thumb.v,videoThumbnail:thumb.thumbnail
    })},
    util:{hasLargeThumbnail:()=>false},
    ThumbInfoLoader:{load(id){return new Promise(resolve=>loadResolutions.set(id,resolve));}},
    netUtil:{fetch(url,options){
      calls.push({url,options});
      return new Promise(resolve=>fetchResolutions.set(url,resolve));
    }}
  });
  run('const ThumbnailSourcePolicy='+extract('packages/lib/src/nico/ThumbnailSourcePolicy.js','ThumbnailSourcePolicy','var')+';',context);
  run('const PocketThumbnail='+extract(
    'packages/zenza/src/pocket/PocketThumbnail.js','PocketThumbnail','var')+
    ';this.PocketThumbnail=PocketThumbnail;',context);
  run('this.newLoader='+extract('src/_pocket.js','createVideoInfoLoader','var')+';',context);
  const load=context.newLoader(view);
  const ready=(id,thumb='https://cdn.example/legacy.jpg')=>{
    loadResolutions.get(id)({v:id,videoId:id,id,title:'Video',thumbnail:thumb});
  };
  const answer=(id,thumb)=>fetchResolutions.get(
    'https://www.nicovideo.jp/watch/'+id)({
      ok:true,text:async()=>'<meta name="server-response" content="'+
        JSON.stringify({data:{response:{$watchV4:{data:{video:{id,thumbnail:{
          ogp:thumb,url:'https://cdn.example/legacy.jpg'
        }}}}}}}).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'
    });
  return {dom,view,image,load,ready,answer,calls,loadResolutions,fetchResolutions,
    context,cleanup(){dom.window.close();}};
}

describe('Task713 MylistPocket popup TypeScript integration',()=>{
  let h;
  afterEach(()=>{if(h){h.cleanup();h=null;}});
  it('shows a legacy thumb immediately, then upgrades to 1280x720 from watch API',async()=>{
    h=fixture();
    const task=h.load('sm48192121');
    h.ready('sm48192121');
    await task;await flush();
    assert.strictEqual(h.image.src,'https://cdn.example/legacy.jpg');
    assert.strictEqual(h.calls.length,1);
    assert.strictEqual(h.calls[0].options.credentials,'include');
    h.answer('sm48192121','https://img.cdn.nimg.jp/s/large/r1280x720l?key=test');
    await flush();
    assert.strictEqual(h.image.src,'https://img.cdn.nimg.jp/s/large/r1280x720l?key=test');
    h.image.onerror();
    assert.strictEqual(h.image.src,'https://cdn.example/legacy.jpg');
  });
  it('ignores a previous popup’s late legacy response',async()=>{
    h=fixture();
    const first=h.load('sm1');
    const second=h.load('sm2');
    h.ready('sm2','https://cdn.example/two.jpg');
    await second;await flush();
    h.ready('sm1','https://cdn.example/one.jpg');
    await first;await flush();
    assert.strictEqual(h.image.src,'https://cdn.example/two.jpg');
    assert.strictEqual(h.calls.length,1);
    assert.strictEqual(h.calls[0].url,'https://www.nicovideo.jp/watch/sm2');
  });
  it('does not let a late watch response replace the next video thumb',async()=>{
    h=fixture();
    const one=h.load('sm11');
    h.ready('sm11');
    await one;await flush();
    const two=h.load('sm12');
    h.ready('sm12','https://cdn.example/current.jpg');
    await two;await flush();
    h.answer('sm11','https://cdn.example/stale-high');
    await flush();
    assert.strictEqual(h.image.src,'https://cdn.example/current.jpg');
  });
  it('does not update a popup after it has been hidden',async()=>{
    h=fixture();
    const task=h.load('sm51');
    h.ready('sm51','https://cdn.example/before-hide.jpg');
    await task;await flush();
    h.view._hostDom={classList:{contains:()=>false}};
    h.answer('sm51','https://cdn.example/high-after-hide.jpg');
    await flush();
    assert.strictEqual(h.image.src,'https://cdn.example/before-hide.jpg');
  });
  it('dismisses the loading state when the loaded video model throws',async()=>{
    h=fixture();
    h.context.VideoInfo.createByThumbInfo=()=>{
      throw new ReferenceError('PocketThumbnail is not defined');
    };
    const result=h.load('sm75');
    h.ready('sm75');
    await assert.doesNotReject(result);
    assert.strictEqual(h.view._videoInfo.status,'fail');
    assert.strictEqual(h.view._videoInfo.description,'通信失敗');
  });
  it('preserves old behavior on non-www sites without extra watch calls',async()=>{
    h=fixture('www.google.com');
    const one=h.load('sm48192199');
    h.ready('sm48192199','https://cdn.example/legacy.jpg');
    await one;await flush();
    assert.strictEqual(h.image.src,'https://cdn.example/legacy.jpg');
    assert.strictEqual(h.calls.length,0);
  });
});

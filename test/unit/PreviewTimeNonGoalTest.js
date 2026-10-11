'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {loadClass, createContext} = require('../helpers/extractSource');

function fixture(path, singleton = false) {
  const dom = new JSDOM('<body><a id="a" href="/watch/sm9">'+
    '<video></video><span>Watch</span></a><a id="b" href="/watch/sm10">Next</a></body>',
    {url:'https://www.nicovideo.jp/search/test'});
  const win=dom.window, opened=[], remote=[], sent=[];
  const claims=[];
  const nicoUtil = {
    getWatchId:url=>(/\/watch\/(sm\d+)/.exec(url)||[])[1]||null,
    parseWatchQuery:query=>({from:query})
  };
  const ctx=createContext({window:win,document:win.document,location:win.location,
    URL:win.URL,nicoUtil,ZenzaWatch:{emitter:{emit(){}},external:{
      sendOrOpen:(id,params)=>remote.push({id,params}),
      send:(id,params)=>sent.push({id,params})
    }}});
  const Menu=loadClass(path,'HoverMenu',ctx);
  const menu=Object.create(Menu.prototype);
  menu._playerConfig={getValue:key=>
    key==='enableSingleton'?singleton:false};
  const player={open:(id,params)=>opened.push({id,params})};
  menu._getPlayer=async()=>player;
  menu._pagePreviewGuard={claim(link) {
    claims.push(link);
    const video=link.querySelector('video');
    if(video){ video.currentTime=0; }
  }};
  const video=win.document.querySelector('video');
  video.currentTime=28.5;
  const click=(selector,opts={})=>{
    const target=win.document.querySelector(selector);
    const e=new win.MouseEvent('click',{bubbles:true,cancelable:true,
      button:0,...opts});
    target.dispatchEvent(e);
    return e;
  };
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));};
  return {win,menu,video,opened,remote,sent,claims,click,flush,
    close:()=>dom.window.close()};
}

for(const source of ['packages/zenza/src/menu/HoverMenu.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task378 AUD-08 preview seek transfer is a permanent non-goal '+source,()=>{
    it('keeps preview media ownership guard but never imports its time',async()=>{
      const f=fixture(source);
      try{
        f.menu._overrideWatchLink();
        const event=f.click('#a span');
        await f.flush();
        assert.strictEqual(event.defaultPrevented,true);
        assert.strictEqual(f.claims.length,1);
        assert.strictEqual(f.video.currentTime,0,'still pauses the thumbnail');
        assert.strictEqual(f.opened.length,1);
        assert.strictEqual(f.opened[0].id,'sm9');
        assert.strictEqual(f.opened[0].params.currentTime,undefined);
      } finally {f.close();}
    });
    it('does not import preview time through singleton playback',async()=>{
      const f=fixture(source,true);
      try{
        f.menu._overrideWatchLink();
        f.click('#a video');
        await f.flush();
        assert.strictEqual(f.remote.length,1);
        assert.strictEqual(f.remote[0].params.currentTime,undefined);
      } finally {f.close();}
    });
    it('does not import preview time through Shift-send',async()=>{
      const f=fixture(source);
      try{
        f.menu._overrideWatchLink();
        f.click('#a video',{shiftKey:true});
        await f.flush();
        assert.strictEqual(f.sent.length,1);
        assert.strictEqual(f.sent[0].params.currentTime,undefined);
      } finally {f.close();}
    });
    it('keeps direct caller-supplied seek time intact',async()=>{
      const f=fixture(source);
      try{
        await f.menu._open('sm9',{currentTime:42});
        assert.strictEqual(f.opened[0].params.currentTime,42);
      } finally{f.close();}
    });
    it('keeps hover-button opens independent of thumbnail time',async()=>{
      const f=fixture(source);
      try{
        f.menu._watchId='sm9';f.menu._hoverElement=f.win.document.querySelector('#a');
        f.menu._onClick({ctrlKey:false,shiftKey:false});
        await f.flush();
        assert.strictEqual(f.opened[0].params.currentTime,undefined);
      } finally{f.close();}
    });
    it('retains each pending open own options across rapid A/B clicks',async()=>{
      const f=fixture(source);
      try{
        const pending=[];
        f.menu._getPlayer=()=>new Promise(resolve=>pending.push(resolve));
        const first=f.menu._open('sm9',{currentTime:7,query:'A'});
        const second=f.menu._open('sm10',{currentTime:19,query:'B'});
        const player={open:(id,params)=>f.opened.push({id,params})};
        pending[1](player);await second;
        pending[0](player);await first;
        assert.strictEqual(f.opened.length,2);
        assert.deepStrictEqual(f.opened.map(x=>[x.id,x.params.currentTime,x.params.query]),
          [['sm10',19,'B'],['sm9',7,'A']]);
      } finally{f.close();}
    });
    it('does not leak an earlier thumbnail position into a normal link',async()=>{
      const f=fixture(source);
      try{
        f.menu._overrideWatchLink();
        f.click('#a');
        f.click('#b');
        await f.flush();
        assert.strictEqual(f.opened.length,2);
        assert.strictEqual(f.opened[0].params.currentTime,undefined);
        assert.strictEqual(f.opened[1].params.currentTime,undefined);
      } finally{f.close();}
    });
  });
}

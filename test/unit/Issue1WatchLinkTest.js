// Issue #1 / Task202: use actual URL classification and native DOM propagation.
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function fixture(html='', url='https://www.nicovideo.jp/tag/test') {
 const dom=new JSDOM('<!doctype html><body>'+html+'</body>',{url}),win=dom.window,opens=[],sent=[];
 const uq=selector=>{const el=typeof selector==='string'?win.document.querySelector(selector):selector;return {on(name,fn){el.addEventListener(name,fn);return this;}};};
 const ctx=createContext({window:win,document:win.document,location:win.location,URL:win.URL,uq,
  textUtil:{parseQuery:q=>Object.fromEntries(new URLSearchParams(q))},ZenzaWatch:{emitter:{emit(){}}},cssUtil:{px:value=>value},setTimeout:()=>0});
 run(beginSection('packages/lib/src/nico/nicoUtil.js')+';globalThis.nico=nicoUtil;',ctx);
 run(beginSection('packages/zenza/src/menu/HoverMenu.js')+';globalThis.Menu=HoverMenu;',ctx);
 const menu=Object.create(ctx.Menu.prototype);menu._playerConfig={props:{overrideWatchLink:true}};
 menu._open=id=>opens.push(id);menu._send=id=>sent.push(id);
 return {dom,win,ctx,menu,opens,sent};
}
function click(f,a,options={}) {a.dispatchEvent(new f.win.MouseEvent('mouseover',{bubbles:true}));const e=new f.win.MouseEvent('click',{bubbles:true,cancelable:true,button:0,...options});a.dispatchEvent(e);return e;}
describe('Issue1 exact video URL classification',()=>{
 for(const route of ['tag_shorts/test','search_shorts/test','tag_shorts/sm9','search_shorts/sm9','tag_shorts/watch/sm9','tag/test?next=/watch/sm9'])
  it('leaves listing navigation alone: '+route,()=>{const f=fixture();try{assert.strictEqual(f.ctx.nico.getWatchId('https://www.nicovideo.jp/'+route),null);}finally{f.dom.window.close();}});
 for(const [url,id] of [['/watch/sm9','sm9'],['/watch/1234567890','1234567890'],['/shorts/ss123','ss123'],['//sp.nicovideo.jp/watch/so123?from=5','so123'],['https://nico.ms/nm123?from=2','nm123'],['https://www.nicovideo.jp/watch/lv123','lv123']])
  it('retains video link '+url,()=>{const f=fixture();try{assert.strictEqual(f.ctx.nico.getWatchId(url),id);}finally{f.dom.window.close();}});
});
describe('Issue1 link click ownership',()=>{
 it('claims a header click before its earlier target navigation handler',()=>{const f=fixture('<div id="CommonHeader"><a href="/watch/sm9"><span>video</span></a></div>');try{const a=f.win.document.querySelector('a');let navigations=0;a.addEventListener('click',()=>navigations++);f.menu._overrideWatchLink();const e=click(f,a.querySelector('span'));assert.strictEqual(navigations,0);assert.deepStrictEqual(f.opens,['sm9']);assert(e.defaultPrevented);}finally{f.win.close();}});
 it('does not hijack the shorts search link',()=>{const f=fixture('<a href="/search_shorts/test">short</a>');try{f.menu._overrideWatchLink();assert.strictEqual(click(f,f.win.document.querySelector('a')).defaultPrevented,false);assert.deepStrictEqual(f.opens,[]);}finally{f.win.close();}});
 for(const mods of [{ctrlKey:true},{metaKey:true},{altKey:true},{button:1},{button:2}])
  it('preserves browser modified click '+JSON.stringify(mods),()=>{const f=fixture('<a href="/watch/sm9">video</a>');try{f.menu._overrideWatchLink();const e=click(f,f.win.document.querySelector('a'),mods);assert.strictEqual(e.defaultPrevented,false);assert.deepStrictEqual(f.opens,[]);}finally{f.win.close();}});
 it('keeps Shift sending to the other Zenza player',()=>{const f=fixture('<a href="/watch/sm9">video</a>');try{f.menu._overrideWatchLink();assert(click(f,f.win.document.querySelector('a'),{shiftKey:true}).defaultPrevented);assert.deepStrictEqual(f.sent,['sm9']);assert.deepStrictEqual(f.opens,[]);}finally{f.win.close();}});
 for(const html of ['<a class="noHoverMenu" href="/watch/sm9">skip</a>','<a href="https://other.example/watch/sm9">outside</a>','<a href="/watch/sm9"><button>other action</button></a>','<a href="/watch/lv123">live</a>'])
  it('leaves excluded links and nested actions alone: '+html,()=>{const f=fixture(html);try{f.menu._overrideWatchLink();const e=click(f,f.win.document.querySelector('button')||f.win.document.querySelector('a'));assert.strictEqual(e.defaultPrevented,false);assert.deepStrictEqual(f.opens,[]);}finally{f.win.close();}});
 it('opens a keyboard-activated or newly inserted link without prior mouseover',()=>{const f=fixture();try{f.menu._overrideWatchLink();f.win.document.body.innerHTML='<a href="/watch/sm9">video</a>';const e=new f.win.MouseEvent('click',{bubbles:true,cancelable:true,detail:0});f.win.document.querySelector('a').dispatchEvent(e);assert(e.defaultPrevented);assert.deepStrictEqual(f.opens,['sm9']);}finally{f.win.close();}});
});

describe('Task203 preview claim integration',()=>{
 it('claims the clicked video link before opening Zenza',()=>{
  const f=fixture('<a href="/watch/sm9"><span>video</span></a>');try{
   const claimed=[];f.menu._pagePreviewGuard={claim:link=>claimed.push(link)};
   f.menu._overrideWatchLink();click(f,f.win.document.querySelector('span'));
   assert.strictEqual(claimed.length,1);
   assert.strictEqual(claimed[0],f.win.document.querySelector('a'));
   assert.deepStrictEqual(f.opens,['sm9']);
  }finally{f.win.close();}
 });
});
describe('Task203 video-top primary watch button',()=>{
 it('treats the official 視聴する button as the parent video link action',()=>{
  const html='<a href="/watch/sm9"><button class="VideoIntroductionPlayerContainer-watchPageButton"><span>視聴する</span></button></a>';
  const f=fixture(html);try{
   f.menu._overrideWatchLink();
   const e=click(f,f.win.document.querySelector('span'));
   assert.strictEqual(e.defaultPrevented,true);
   assert.deepStrictEqual(f.opens,['sm9']);
  }finally{f.win.close();}
 });
});
describe('Task311 official React search-card click ownership', () => {
 const markup='<div class="videoCard" data-anchor="1" data-anchor-href="/watch/sm311" role="button" tabindex="0">' +
   '<a href="/watch/sm311" class="thumb"><img></a>' +
   '<a href="/watch/sm311" class="title">タイトル</a>' +
   '<div class="description">キャプション</div>' +
   '<div class="metas"><time>投稿日</time></div>' +
   '<div class="blank">余白</div>' +
   '<a href="/user/12" data-anchor-href="/user/12" class="owner">投稿者</a>' +
   '<button class="menu">別操作</button></div>';
 for (const selector of ['.thumb img','.title','.description','time','.blank','.videoCard']) {
   it('opens Zenza for the video card region '+selector,()=>{
     const f=fixture(markup,'https://www.nicovideo.jp/search/test');
     try {
       let navigated=0;
       f.win.document.querySelector('.videoCard').addEventListener('click',()=>navigated++);
       f.menu._overrideWatchLink();
       const e=click(f,f.win.document.querySelector(selector));
       assert(e.defaultPrevented);
       assert.deepStrictEqual(f.opens,['sm311']);
       assert.strictEqual(navigated,0);
     }finally{f.dom.window.close();}
   });
 }
 for (const selector of ['.owner','.menu']) {
   it('does not hijack a nested action '+selector,()=>{
     const f=fixture(markup,'https://www.nicovideo.jp/search/test');
     try {
       f.menu._overrideWatchLink();
       const e=click(f,f.win.document.querySelector(selector));
       assert.strictEqual(e.defaultPrevented,false);
       assert.deepStrictEqual(f.opens,[]);
     }finally{f.dom.window.close();}
   });
 }
 it('preserves modifier clicks on the caption',()=>{
   const f=fixture(markup,'https://www.nicovideo.jp/tag/test');
   try{
     f.menu._overrideWatchLink();
     const e=click(f,f.win.document.querySelector('.description'),{ctrlKey:true});
     assert.strictEqual(e.defaultPrevented,false);
     assert.deepStrictEqual(f.opens,[]);
   }finally{f.dom.window.close();}
 });
});

describe('Task311 Google results hover / playback bridge',()=>{
 const sample = [
   'https://www.nicovideo.jp/watch/sm42?from=google',
   'https://www.google.com/url?url=https%3A%2F%2Fwww.nicovideo.jp%2Fwatch%2Fsm42%3Ffrom%3Dgoogle',
   'https://www.google.co.jp/url?q=https%3A%2F%2Fwww.nicovideo.jp%2Fwatch%2Fsm42'
 ];
 for(const url of sample){
   it('recognizes a verified video destination '+url.slice(0,47),()=>{
     const f=fixture('<a class="googleResult" href="'+url+'"><h3>video</h3></a>',
       'https://www.google.com/search?q=nicovideo');
     try{
       let displayed=0;
       f.menu._$view={css(){return this;},addClass(){displayed++;return this;},removeClass(){return this;}};
       const h3=f.win.document.querySelector('h3');
       f.menu._onHover({target:h3});
       f.menu._onHoverEnd({target:h3});
       assert.strictEqual(f.menu._watchId,'sm42');
       assert.strictEqual(displayed,1);
       f.menu._onClick({ctrlKey:false,shiftKey:false});
       assert.deepStrictEqual(f.opens,['sm42']);
     }finally{f.dom.window.close();}
   });
 }
 it('ignores Google redirect results outside the Nicovideo whitelist',()=>{
   const f=fixture('<a href="/url?q=https%3A%2F%2Fevil.invalid%2Fwatch%2Fsm42"><h3>fake</h3></a>',
     'https://www.google.co.jp/search?q=test');
   try{
     let displayed=0;
     f.menu._$view={css(){return this;},addClass(){displayed++;return this;}};
     const target=f.win.document.querySelector('h3');
     f.menu._onHover({target});
     f.menu._onHoverEnd({target});
     assert.strictEqual(displayed,0);
     assert.strictEqual(f.menu._watchId,undefined);
   }finally{f.dom.window.close();}
 });
});

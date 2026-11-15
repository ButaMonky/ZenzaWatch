'use strict';
// Task1046: 視聴履歴の拡張機能（ニコつべSaver など）が ZenzaWatch で見た動画を記録できるよう、
// URL を書き換えている間だけ公式の視聴ページと同じ名前の部品を置き、戻すときに取り除く。
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {JSDOM}=require('jsdom');
const load=(enabled)=>{
  const dom=new JSDOM('<!doctype html><html><head><title>タグ検索 - ニコニコ動画</title><meta property="og:image" content="https://page/og.png"><script type="application/ld+json">{"author":{"name":"PAGE"}}</script></head><body><span class="link_name">header-user</span></body></html>',{url:'https://www.nicovideo.jp/tag/x'});
  const w=dom.window;
  const src=fs.readFileSync(path.join(__dirname,'../../packages/zenza/src/init/WatchPageHistory.js'),'utf8');
  const body=src.slice(src.indexOf('//===BEGIN==='),src.indexOf('//===END==='));
  const timers=[];
  const _={debounce:(fn)=>{let pending=null;const f=(...a)=>{pending=a;timers.push(()=>{if(pending){const p=pending;pending=null;fn(...p);}});};f.cancel=()=>{pending=null;};return f;}};
  const WPH=new Function('window','document','history','location','_','PRODUCT','navigator','NicoVideoApi',body+';return WatchPageHistory;')(w,w.document,w.history,w.location,_,'ZenzaWatch',w.navigator,{});
  const handlers={};
  const dialog={_requestId:1,on:(n,f)=>{handlers[n]=f;},_playerConfig:{getValue:k=>k==='historyExtension.enable'?enabled:undefined,onkey(){}}};
  WPH.initialize(dialog);
  const flush=()=>{const t=timers.shift();t&&t();};
  return {w,handlers,flush};
};
const info={watchId:'sm45555',title:'動画の題名',owner:{name:'投稿者'},genre:{label:'ゲーム'},
  tagList:[{tag:'東方'},{tag:'実況'}],betterThumbnail:'https://nicovideo.cdn.nimg.jp/thumbnails/1/1.L',duration:680};
describe('Task1046 history extension bridge',()=>{
  it('places watch-page parts before page parts while the URL is the video, and removes them on restore',()=>{
    const {w,handlers,flush}=load(undefined);
    handlers.open();handlers.loadVideoInfo(info);flush();
    const d=w.document;
    assert.strictEqual(w.location.pathname,'/watch/sm45555');
    assert.strictEqual(d.title,'動画の題名 - ニコニコ動画');
    const ld=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
    assert.strictEqual(ld.author.name,'投稿者');assert.strictEqual(ld.duration,'PT0H11M20S'.replace('0H',''));
    assert.strictEqual(d.querySelector('meta[property="og:image"]').getAttribute('content'),info.betterThumbnail);
    assert.strictEqual(d.querySelector('.VideoOwnerInfo-pageLink, .ProgramProvider-name, [data-name="username"], .link_name').textContent,'投稿者');
    assert.strictEqual(d.querySelector('.GenreRankLabel').textContent,'ゲーム');
    assert.deepStrictEqual(Array.from(d.querySelectorAll('.TagItem-name'),e=>e.textContent),['東方','実況']);
    handlers.close();
    assert.strictEqual(d.querySelectorAll('[data-zenza-history-bridge]').length,0);
    assert.strictEqual(w.location.pathname,'/tag/x');
  });
  it('uses 未設定 when the genre is missing and does nothing when disabled',()=>{
    let t=load(undefined);
    t.handlers.open();t.handlers.loadVideoInfo({...info,genre:null});t.flush();
    assert.strictEqual(t.w.document.querySelector('.GenreRankLabel').textContent,'未設定');
    t=load(false);
    t.handlers.open();t.handlers.loadVideoInfo(info);t.flush();
    assert.strictEqual(t.w.document.querySelectorAll('[data-zenza-history-bridge]').length,0);
    assert(t.w.document.title.includes('by 投稿者 - ZenzaWatch'));
  });
});

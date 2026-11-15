'use strict';
// Task1046/1047: 視聴履歴の拡張機能（ニコつべSaver など）が ZenzaWatch で見た動画を記録できるよう、
// URL を書き換えている間だけ公式の視聴ページと同じ名前の部品を置き、戻すときに取り除く。
// 連携の中身は packages/zenza/src/init/ExtensionIntegrations.js（正本は nico-src/ExtensionIntegrations.ts）。
// このテストはニコつべSaver 4.1 との約束事（読まれる部品の名前・題名の形・置く順番）の記録でもある。
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {JSDOM}=require('jsdom');
const part=f=>{
  const src=fs.readFileSync(path.join(__dirname,'../../packages/zenza/src/init/'+f),'utf8');
  return src.slice(src.indexOf('//===BEGIN==='),src.indexOf('//===END==='));
};
const load=(settings={})=>{
  const dom=new JSDOM('<!doctype html><html><head><title>タグ検索 - ニコニコ動画</title><meta property="og:image" content="https://page/og.png"><script type="application/ld+json">{"author":{"name":"PAGE"}}</script></head><body><span class="link_name">header-user</span></body></html>',{url:'https://www.nicovideo.jp/tag/x'});
  const w=dom.window;
  const body=part('ExtensionIntegrations.js')+part('WatchPageHistory.js');
  const timers=[];
  const _={debounce:(fn)=>{let pending=null;const f=(...a)=>{pending=a;timers.push(()=>{if(pending){const p=pending;pending=null;fn(...p);}});};f.cancel=()=>{pending=null;};return f;}};
  const WPH=new Function('window','document','history','location','_','PRODUCT','navigator','NicoVideoApi',body+';return WatchPageHistory;')(w,w.document,w.history,w.location,_,'ZenzaWatch',w.navigator,{});
  const handlers={};
  const dialog={_requestId:1,on:(n,f)=>{handlers[n]=f;},_playerConfig:{getValue:k=>settings[k],onkey(){}}};
  WPH.initialize(dialog);
  // 最初に積まれた debounce（動画情報の反映）だけを実行する。URL を戻す方は実行しない
  const flush=()=>{const t=timers.shift();t&&t();};
  return {w,handlers,flush};
};
const info={watchId:'sm45555',title:'動画の題名',owner:{name:'投稿者'},genre:{label:'ゲーム'},
  tagList:[{tag:'東方'},{tag:'実況'}],betterThumbnail:'https://nicovideo.cdn.nimg.jp/thumbnails/1/1.L',duration:680};
const marks=w=>w.document.querySelectorAll('[data-zenza-extension-integration]').length;
describe('Task1046/1047 extension integrations (ニコつべSaver)',()=>{
  it('places watch-page parts before page parts while the URL is the video, and removes them on close',()=>{
    const {w,handlers,flush}=load();
    handlers.open();handlers.loadVideoInfo(info);flush();
    const d=w.document;
    assert.strictEqual(w.location.pathname,'/watch/sm45555');
    assert.strictEqual(d.title,'動画の題名 - ニコニコ動画');
    const ld=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
    assert.strictEqual(ld.author.name,'投稿者');assert.strictEqual(ld.duration,'PT11M20S');
    assert.strictEqual(d.querySelector('meta[property="og:image"]').getAttribute('content'),info.betterThumbnail);
    assert.strictEqual(d.querySelector('.VideoOwnerInfo-pageLink, .ProgramProvider-name, [data-name="username"], .link_name').textContent,'投稿者');
    assert.strictEqual(d.querySelector('.GenreRankLabel').textContent,'ゲーム');
    assert.deepStrictEqual(Array.from(d.querySelectorAll('.TagItem-name'),e=>e.textContent),['東方','実況']);
    handlers.close();
    assert.strictEqual(marks(w),0);
    assert.strictEqual(w.location.pathname,'/tag/x');
  });
  it('uses 未設定 when the genre is missing',()=>{
    const t=load();
    t.handlers.open();t.handlers.loadVideoInfo({...info,genre:null});t.flush();
    assert.strictEqual(t.w.document.querySelector('.GenreRankLabel').textContent,'未設定');
  });
  for(const key of ['extensionIntegration.enable','extensionIntegration.nicotubeSaver','historyExtension.enable']){
    it('does nothing when '+key+' is off (keeps the usual ZenzaWatch title)',()=>{
      const t=load({[key]:false});
      t.handlers.open();t.handlers.loadVideoInfo(info);t.flush();
      assert.strictEqual(t.w.location.pathname,'/watch/sm45555');
      assert.strictEqual(marks(t.w),0);
      assert(t.w.document.title.includes('by 投稿者 - ZenzaWatch'));
    });
  }
  it('keeps the adapter list and module comments that explain how to add one',()=>{
    const ts=fs.readFileSync(path.join(__dirname,'../../tools/typescript-stage1/nico-src/ExtensionIntegrations.ts'),'utf8');
    assert(ts.includes('■ アダプターを追加するとき（手順）'));
    assert(ts.includes('合わせたバージョン: 4.1'));
    assert(ts.includes("const ADAPTERS: readonly IntegrationAdapter[] = Object.freeze([nicotubeSaver]);"));
  });
});

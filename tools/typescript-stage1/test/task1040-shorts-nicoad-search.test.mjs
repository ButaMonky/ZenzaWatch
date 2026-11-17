import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNicoFamily} from './dialog-roles.mjs';
import {loadSource} from './nonvisual-audit-source-harness.mjs';
// Task1040: 投稿ショート動画も投稿動画一覧へ・動画の最後のニコニ広告の通知設定・検索欄のはみ出し調整
// Task1060: NicoVideoPlayerDialog は部品に分割したので、分割先も含めて読む。
const read=readNicoFamily; // Task1063: 分割したモジュールは分割先も含めて読む
test('user shorts are fetched from v3 users videos (short) across pages and mapped to playlist items',async()=>{
 const urls=[];
 const page=(n,count)=>({meta:{status:200},data:{totalCount:150,items:Array.from({length:count},(_,i)=>({series:null,essential:{id:'ss'+(n*1000+i),title:'t',registeredAt:'2026-11-1'+(n)+'T00:00:00+09:00'}}))}});
 const netUtil={fetch:async(url,opt)=>{urls.push([url,opt.headers]);const n=Number(new URL(url).searchParams.get('page'));return {json:async()=>page(n,n===1?100:50)};}};
 const loader=loadSource('nico-src/PlaylistApiLoader.ts','PlaylistApiLoader',{netUtil,CacheStorage:class{getItem(){return null}setItem(){}},sessionStorage:{}});
 const items=await loader.loadUserShorts('89213907');
 assert.equal(items.length,150);assert.equal(items[0].watchId,'ss1000');assert.equal(items[0].content.id,'ss1000');
 assert.equal(urls.length,2);
 assert(urls[0][0].startsWith('https://nvapi.nicovideo.jp/v3/users/89213907/videos?selectContentType=short&sortKey=registeredAt&sortOrder=desc'));
 assert.equal(urls[0][1]['X-Frontend-Id'],6);
 await assert.rejects(()=>loader.loadUserShorts('../x'));
});
test('uploader playlist merges videos and shorts by posted time and supports long/short only',()=>{
 const s=read('nico-src/PlayList.ts');
 assert(s.includes("['long', 'short'].includes(playlist.contentType)"));
 assert(s.includes('merged.sort((a: Loose, b: Loose) => time(b) - time(a));'));
 assert(s.includes("shortsNotice = '（ショート動画は取得できませんでした）';"));
});
test('nicoad end screen has its own diagnostics operation and recording setting (default on)',()=>{
 const r=read('nico-src/RequestDiagnostics.ts');assert(r.includes("'nicoad-end': '動画の最後のニコニ広告'"));
 assert(r.includes("url.searchParams.get('frameId') === '12') { return 'nicoad-end'; }"));
 assert(read('nico-src/NotificationJournalPolicy.ts').includes("'nicoad-end': 'nicoadEnd'"));
 assert(read('advanced-src/Config.ts').includes("'notificationHistory.record.nicoadEnd': true"));
 assert(read('advanced-src/ModernAdvancedSettingsModel.ts').includes("['notificationHistory.record.nicoadEnd','動画の最後のニコニ広告'"));
 assert(read('nico-src/NicoVideoPlayerDialog.ts').includes("RequestDiagnostics.begin('nicoad-end', videoId, 'response'"));
 const p=policy();const e=p.normalize({level:'error',category:'network',source:'nicoad-end',message:'x',details:{operation:'nicoad-end'}},{id:'a',timestamp:1});
 assert.equal(p.recordingGroup(e),'nicoadEnd');
});
const policy=()=>loadSource('nico-src/NotificationJournalPolicy.ts','NotificationJournalPolicy');
test('search panel is pushed down by measured overflow, without browser detection or transform',()=>{
 const v=read('nico-src/VideoInfoPanel.ts');
 assert(v.includes('_keepSearchPanelInView()'));
 assert(v.includes('margin-top: calc(var(--search-top-offset, 0px) - var(--search-controls-height));'));
 const body=v.slice(v.indexOf('  _keepSearchPanelInView() {'),v.indexOf('  _updateFocus() {'));
 assert(!/isFirefox|userAgent/.test(body));
});

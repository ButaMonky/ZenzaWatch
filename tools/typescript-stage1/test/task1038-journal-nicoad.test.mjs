import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
// Task1038: いいね・ニコるの記録、上限での優先保持、ニコニ広告の終了画面、投稿直後の日時、ニコるのアニメーション
const policy=()=>loadSource('nico-src/NotificationJournalPolicy.ts','NotificationJournalPolicy');
const journal=()=>{const NotificationJournalPolicy=policy(),NotificationJournalStore=loadSource('nico-src/NotificationJournalStore.ts','NotificationJournalStore');
 return loadSource('nico-src/NotificationJournal.ts','NotificationJournal',{NotificationJournalPolicy,NotificationJournalStore});};
const like={level:'success',category:'like',source:'like',message:'いいね！しました「動画」',videoId:'sm9',activity:{kind:'like',text:'ありがとう',videoTitle:'動画'}};
const nicoru={level:'success',category:'comment',source:'nicoru',message:'ニコりました「草」（動画）',videoId:'sm9',
 details:{operation:'nicoru',outcome:'accepted'},activity:{kind:'nicoru',text:'草',videoTitle:'動画',positionMs:12340}};
test('like and nicoru activities keep date, video id, title, comment text and position',()=>{
 const p=policy(),id={id:'a',timestamp:1800000000000};
 const l=p.normalize(like,id),n=p.normalize(nicoru,id);
 assert.equal(l.activity.kind,'like');assert.equal(l.activity.videoTitle,'動画');assert.equal(l.videoId,'sm9');assert.equal(l.timestamp,1800000000000);
 assert.equal(n.activity.kind,'nicoru');assert.equal(n.activity.text,'草');assert.equal(n.activity.positionMs,12340);
 assert.equal(p.isProtectedActivity(l),true);assert.equal(p.isProtectedActivity(n),true);
 assert.equal(p.normalize({...like,level:'error'},id).activity,undefined);
 assert.equal(p.normalize({...like,category:'comment'},id).activity,undefined);
});
test('when the record limit is reached, like/nicoru entries are removed last',async()=>{
 const j=journal();j.configureRetention(100,0);
 j.record(like);j.record(nicoru);
 for(let i=0;i<150;i++)j.record({level:'info',category:'network',source:'test',message:'通知'+i});
 const rows=await j.list(Number.MAX_SAFE_INTEGER);
 assert.equal(rows.length,100);
 assert(rows.some(r=>r.activity&&r.activity.kind==='like'));assert(rows.some(r=>r.activity&&r.activity.kind==='nicoru'));
});
test('history panel lists beyond 2000 rows and finds like entries by the word いいね',async t=>{
 const {JSDOM}=(await import('node:module')).createRequire(import.meta.url)('jsdom');
 const dom=new JSDOM('<!doctype html><div class="activeTab" id="root"></div>',{url:'https://www.nicovideo.jp/'});t.after(()=>dom.window.close());
 const p=policy();const records=[];
 for(let i=0;i<2500;i++)records.push(p.normalize({level:'info',category:'network',source:'x',message:'通知'+i},{id:'n'+i,timestamp:1800000000000-i}));
 records.push(p.normalize({...like,message:'しました「別名」'},{id:'like1',timestamp:1700000000000}));
 let asked=0;const nj={list:async n=>{asked=n;return records;},subscribe:()=>()=>{},toDiagnosticEntry:e=>p.toDiagnosticEntry(e)};
 const panel=loadSource('nico-src/NotificationHistoryPanel.ts','NotificationHistoryPanel',{window:dom.window,document:dom.window.document,NotificationJournal:nj,Blob,URL});
 const root=dom.window.document.querySelector('#root');panel.mount(root);await flush();
 assert(asked>2000,'panel must not cap the list at 2000');
 const search=root.querySelector('input[type="search"],input');assert(search);
 search.value='いいね';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await flush();await new Promise(r=>setTimeout(r,400));
 const ids=[...root.querySelectorAll('[data-entry-id]')].map(e=>e.getAttribute('data-entry-id'));
 assert(ids.includes('like1'),'like entry should be found by kind label');
});
const dialogSrc=readFileSync(new URL('../nico-src/NicoVideoPlayerDialog.ts',import.meta.url),'utf8');
test('nicoad end screen parses official response into up to 10 cards with supporter and points',()=>{
 const m=dialogSrc.match(/static nicoadEndItems\(body: Loose\): Loose\[\] \{([\s\S]*?)\n  \}\n/);assert(m);
 const fn=new Function('body',m[1].replace(/: Loose/g,''));
 const ads=[];for(let i=0;i<12;i++)ads.push({contentId:'sm'+(100+i),title:'t'+i,thumbnailUrl:'https://nicovideo.cdn.nimg.jp/x.jpg',userName:i?'けん':'',activePoint:150000,decoration:'gold'});
 ads.push({contentId:'lv1',title:'live'},{contentId:'javascript:x'});
 const items=fn({data:{nicoads:ads}});
 assert.equal(items.length,10);assert.equal(items[0].supporter,'ゲスト');assert.equal(items[1].supporter,'けん');
 assert.equal(items[1].point,150000);assert.equal(items[1].decoration,'gold');
 assert.deepEqual(JSON.parse(JSON.stringify(fn({}))),[]);
 assert(dialogSrc.includes("frameId=12&limit=10"));assert(dialogSrc.includes("'x-frontend-id': '6'"));
 assert(/props\['nicoadEnd\.enable'\] === false/.test(dialogSrc));
});
test('nicoad end setting is available in normal and advanced settings under uaa.enable',()=>{
 const panel=readFileSync(new URL('../nico-src/SettingPanelElement.ts',import.meta.url),'utf8');
 const adv=readFileSync(new URL('../advanced-src/ModernAdvancedSettingsModel.ts',import.meta.url),'utf8');
 const conf=readFileSync(new URL('../advanced-src/Config.ts',import.meta.url),'utf8');
 assert(panel.indexOf('data-setting-name="nicoadEnd.enable"')>panel.indexOf('data-setting-name="uaa.enable"'));
 assert(adv.includes("'nicoadEnd.enable':'uaa.enable'"));assert(conf.includes("'nicoadEnd.enable': true"));
});
test('posted comment gets the current date instead of 1970 and nicoru uses animated svg',()=>{
 const cp=readFileSync(new URL('../nico-src/CommentPlayer.ts',import.meta.url),'utf8');
 assert(/Math\.floor\(Date\.now\(\) \/ 1000\)/.test(cp));
 const panel=readFileSync(new URL('../nico-src/CommentPanel.ts',import.meta.url),'utf8');
 assert(panel.includes('nicoru-animated'));assert(panel.includes('zenzaNicoruRotate'));assert(/<svg[^>]*class="nicoru-icon"/.test(panel));
});

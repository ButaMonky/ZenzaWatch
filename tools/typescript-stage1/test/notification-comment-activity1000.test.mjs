import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const policy=()=>loadSource('nico-src/NotificationJournalPolicy.ts','NotificationJournalPolicy');
const accepted={level:'success',category:'comment',message:'コメント投稿成功',videoId:'sm9',source:'comment',details:{outcome:'accepted',postedNo:1},
 activity:{kind:'comment-post',text:'自分のコメント\n<img src=x onerror=alert(1)>',videoTitle:'自分の動画名',positionMs:12340}};
const identity={id:'comment1',timestamp:1800000000000};
test('accepted comment activity preserves bounded private text separately from diagnostics',()=>{
 const p=policy(),entry=p.normalize(accepted,identity);
 assert.equal(entry.activity.text,accepted.activity.text);assert.equal(entry.activity.positionMs,12340);
 const long=p.normalize({...accepted,activity:{...accepted.activity,text:'あ'.repeat(5000),videoTitle:'題'.repeat(600)}},identity);
 assert.equal(long.activity.text.length,4096);assert.equal(long.activity.videoTitle.length,512);
 const report=p.toDiagnosticEntry({...entry,unknownPrivate:'secret',details:{...entry.details,text:'secret'}});
 assert.equal(report.activity,undefined);assert.equal(report.unknownPrivate,undefined);
 assert(!JSON.stringify(report).includes('自分の'));assert(!JSON.stringify(report).includes('secret'));
 assert.equal(report.details.postedNo,1);
});
for(const change of [{level:'error'},{level:'warning',details:{outcome:'unknown'}},{category:'network'},{details:{outcome:'rejected'}}])
 test('nonaccepted notification never retains private comment '+JSON.stringify(change),()=>{
  assert.equal(policy().normalize({...accepted,...change},identity).activity,undefined);
 });
test('invalid activity fields cannot create external links or unbounded position',()=>{
 const entry=policy().normalize({...accepted,activity:{...accepted.activity,positionMs:Infinity,videoTitle:{secret:'x'},extra:'secret'}},identity);
 assert.equal(entry.activity.positionMs,undefined);assert.equal(entry.activity.videoTitle,undefined);assert.equal(entry.activity.extra,undefined);
});
test('journal keeps personal activity locally and suppresses only its generic popup echo',async()=>{
 const NotificationJournalPolicy=policy(),NotificationJournalStore=loadSource('nico-src/NotificationJournalStore.ts','NotificationJournalStore');
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal',{NotificationJournalPolicy,NotificationJournalStore});
 const saved=journal.record(accepted);
 assert.equal(journal.record({message:accepted.message,source:'popup'}),null);
 const rows=await journal.list();assert.equal(rows.length,1);assert.equal(rows[0].activity.text,accepted.activity.text);
 assert.equal(journal.toDiagnosticEntry(saved).activity,undefined);
});
test('numeric channel watch IDs are retained while arbitrary URL inputs are rejected',()=>{
 const p=policy();assert.equal(p.normalize({...accepted,videoId:'1234567890'},identity).videoId,'1234567890');
 for(const id of ['https://example.com/','javascript:alert(1)','../sm9','12345678901234567'])assert.equal(p.normalize({...accepted,videoId:id},identity).videoId,'');
});
async function fixture(t){
 const dom=new JSDOM('<!doctype html><div class="activeTab" id="root"></div>',{url:'https://www.nicovideo.jp/search/test'});
 t.after(()=>dom.window.close());const records=[policy().normalize(accepted,identity)];
 const blobs=[],copies=[];
 const journal={list:async()=>records,subscribe:()=>()=>{},toDiagnosticEntry:entry=>policy().toDiagnosticEntry(entry)};
 Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async text=>copies.push(text)},configurable:true});
 dom.window.HTMLAnchorElement.prototype.click=function(){};
 const panel=loadSource('nico-src/NotificationHistoryPanel.ts','NotificationHistoryPanel',{
  window:dom.window,document:dom.window.document,NotificationJournal:journal,Blob,
  URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL(){}}
 });
 const root=dom.window.document.querySelector('#root');panel.mount(root);await flush();
 return {dom,root,records,blobs,copies};
}
test('list and details display own comment as text with video and position; copies omit private activity',async t=>{
 const h=await fixture(t);assert(h.root.querySelector('.znh-activity-preview').textContent.includes('自分のコメント'));
 h.root.querySelector('[data-entry-id]').click();const detail=h.root.querySelector('.znh-detail');
 assert.equal(detail.querySelector('.znh-activity-text').textContent,accepted.activity.text);
 assert.equal(detail.querySelector('a').href,'https://www.nicovideo.jp/watch/sm9');
 assert(detail.textContent.includes('自分の動画名'));assert(detail.textContent.includes('0:12'));assert.equal(detail.querySelector('img'),null);
 detail.querySelector('[data-history-action="copy"]').click();await flush();
 assert.equal(h.copies.length,1);assert(!h.copies[0].includes('自分の'));assert(!h.copies[0].includes('<img'));
});
test('JSON diagnostics export omits comment and title while local search can find them',async t=>{
 const h=await fixture(t),query=h.root.querySelector('input');query.value='自分のコメント';query.dispatchEvent(new h.dom.window.Event('input'));await flush();
 assert.equal(h.root.querySelectorAll('.znh-entry').length,1);
 [...h.root.querySelectorAll('button')].find(button=>button.textContent==='JSON保存').click();await flush();
 assert.equal(h.blobs.length,1);const text=await h.blobs[0].text();assert(!text.includes('自分の'));assert(!text.includes('activity'));
 assert.equal(JSON.parse(text)[0].details.postedNo,1);
});
test('clipboard-unavailable fallback also contains diagnostics only',async t=>{
 const h=await fixture(t);Object.defineProperty(h.dom.window.navigator,'clipboard',{value:undefined});
 h.root.querySelector('[data-entry-id]').click();h.root.querySelector('[data-history-action="copy"]').click();await flush();
 const report=h.root.querySelector('textarea').value;assert(report.includes('postedNo'));assert(!report.includes('自分の'));assert(!report.includes('<img'));
});
test('legacy notifications still open without activity or invented personal text',async t=>{
 const h=await fixture(t);delete h.records[0].activity;
 h.root.querySelector('[data-entry-id]').click();assert.equal(h.root.querySelector('.znh-activity'),null);
 assert(h.root.querySelector('.znh-detail').textContent.includes('コメント投稿成功'));
});

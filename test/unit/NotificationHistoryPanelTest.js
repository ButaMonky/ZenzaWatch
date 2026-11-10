'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createContext, extract, run} = require('../helpers/extractSource');

const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(records) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'https://www.nicovideo.jp/watch/sm9'
  });
  const subscribers = new Set();
  const journal = {
    toDiagnosticEntry: entry => ({...entry, activity: undefined}),
    list: async () => records,
    clear: async () => { records.length = 0; return true; },
    subscribe: callback => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
  };
  const context = createContext({
    document: dom.window.document, window: dom.window,
    NotificationJournal: journal
  });
  run('const NotificationHistoryPanel = ' +
    extract('src/NotificationHistoryPanel.js', 'NotificationHistoryPanel', 'var') +
    ';globalThis.__panel=NotificationHistoryPanel;', context);
  const root = dom.window.document.getElementById('root');
  root.classList.add('activeTab');
  context.__panel.mount(root);
  return {dom, root, journal, notify:()=>subscribers.forEach(f=>f())};
}

describe('NotificationHistoryPanel (synthetic DOM)', () => {
  it('does not invent occurrence metadata for legacy records and offers copy fallback',async()=>{
    const records=[{id:'old',timestamp:1,category:'network',level:'warning',source:'advertising',message:'old',details:{reason:'not-found',statusCode:404}}];
    const h=setup(records);await flush();h.root.querySelector('[data-entry-id]').click();
    const detail=h.root.querySelector('.znh-detail');assert(detail.textContent.includes('記録なし（旧版など）'));assert(detail.textContent.includes('従来の記録時刻'));
    detail.querySelector('[data-history-action="copy"]').click();await flush();
    assert(detail.querySelector('textarea').value.includes('HTTP') || detail.querySelector('textarea').value.includes('statusCode'));
    records.length=0;h.notify();await flush();assert(h.root.querySelector('.znh-detail').hidden);
    h.dom.window.close();
  });
  it('switches to selected detail, updates recovery and returns to filtered list without nested scroll',async()=>{
    const records=[{id:'x',timestamp:1800000002000,firstOccurredAt:1800000000000,lastOccurredAt:1800000002000,version:'2.7.370-task994',build:'2026-11-10 12:00Z abc1234',category:'network',source:'advertising',level:'warning',message:'広告取得失敗',details:{phase:'response',reason:'http',statusCode:503,count:2,outcome:'failed'}}];
    const h=setup(records);await flush();h.root.querySelector('[data-entry-id="x"]').click();
    assert(h.root.querySelector('.znh-list').hidden);assert(h.root.querySelector('.znh-detail').textContent.includes('2.7.370-task994'));
    assert(h.root.querySelector('.znh-detail').textContent.includes('初回発生'));
    records[0]={...records[0],recoveredAt:1800000003000,details:{...records[0].details,outcome:'recovered'}};h.notify();await flush();
    assert(h.root.querySelector('.znh-detail').textContent.includes('復旧済み'));
    h.root.querySelector('[data-history-back]').click();assert(!h.root.querySelector('.znh-list').hidden);
    assert(!h.dom.window.document.getElementById('zenzaNotificationHistoryStyle').textContent.includes('.znh-list{overflow:auto'));
    h.dom.window.close();
  });

  it('shows grouped occurrence count and recovery without opening technical details', async () => {
    const h=setup([{id:'diagnostic',timestamp:Date.now(),category:'network',level:'success',
      message:'動画情報：復旧',details:{count:3,outcome:'recovered'}}]);
    await flush();
    assert(h.root.querySelector('.znh-head').textContent.includes('発生 3回・復旧済み'));
    h.dom.window.close();
  });
  it('renders entries as text and never interprets notification HTML', async () => {
    const records = [{
      id: 'example', timestamp: Date.now(), category: 'network', level: 'error',
      message: '<img src=x onerror=alert(1)>',
      videoId: 'sm9', source: 'network',
      details: {statusCode: 400, errorCode: 'BAD_REQUEST'}
    }];
    const h = setup(records);
    await flush();
    assert.strictEqual(h.root.querySelectorAll('.znh-entry').length, 1);
    assert.strictEqual(h.root.querySelectorAll('img').length, 0);
    assert(h.root.textContent.includes('<img src=x onerror=alert(1)>'));
    assert(h.root.textContent.includes('sm9'));
    h.dom.window.close();
  });
  it('filters categories without changing stored records', async () => {
    const now=Date.now();
    const records=[
      {id:'1',timestamp:now,category:'like',level:'success',message:'ありがとう',details:{}},
      {id:'2',timestamp:now-1,category:'comment',level:'error',message:'投稿失敗',details:{}}
    ];
    const h=setup(records);
    await flush();
    const select=h.root.querySelector('select');
    select.value='comment';
    select.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));
    await flush();
    const entries=h.root.querySelectorAll('.znh-entry');
    assert.strictEqual(entries.length,1);
    assert(entries[0].textContent.includes('投稿失敗'));
    assert.strictEqual(records.length,2);
    h.dom.window.close();
  });
  it('does not mount duplicate panels to the same tab', () => {
    const h=setup([]);
    const ctx=createContext({document:h.dom.window.document,window:h.dom.window});
    assert.strictEqual(h.root.querySelectorAll('.zenzaNotificationHistory').length,1);
    assert.strictEqual(h.root.querySelectorAll('#zenzaNotificationHistoryStyle').length,0);
    assert.strictEqual(h.dom.window.document.querySelectorAll('#zenzaNotificationHistoryStyle').length,1);
    assert(ctx);
    h.dom.window.close();
  });
});

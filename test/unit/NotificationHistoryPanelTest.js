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
  return {dom, root, journal};
}

describe('NotificationHistoryPanel (synthetic DOM)', () => {
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

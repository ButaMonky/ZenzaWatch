'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createContext, extract, beginSection, run} = require('../helpers/extractSource');

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
  run(beginSection('packages/lib/src/infra/RequestDiagnostics.js'), context);
  run('const NotificationHistoryPanel = ' +
    extract('src/NotificationHistoryPanel.js', 'NotificationHistoryPanel', 'var') +
    ';globalThis.__panel=NotificationHistoryPanel;', context);
  const root = dom.window.document.getElementById('root');
  root.classList.add('activeTab');
  context.__panel.mount(root);
  return {dom, root, journal, notify:()=>subscribers.forEach(f=>f())};
}

describe('NotificationHistoryPanel (synthetic DOM)', () => {
  it('copies only the selected problem using registered labels, field names and repair paths', async () => {
    const records = [{id:'sm912345', timestamp:1, category:'network', level:'warning', source:'comment-read',
      version:'2.7.473-task1096', message:'生のエラー文 https://private.invalid/?key=secretValue',
      videoId:'sm912345', build:'untrustedBuild', activity:{kind:'comment-post', text:'投稿した本文', videoTitle:'個人の動画名'},
      details:{phase:'response', reason:'schema', missing:'data.threads', outcome:'failed',
        statusCode:503, errorCode:'RESPONSE_SCHEMA', module:'privateFolder/owned.ts', where:'secretFunction',
        requestId:'privateRequest', threadId:98765432}},
      {id:'peer', timestamp:1, category:'player', level:'error', message:'別の問題', source:'storyboard', details:{}}];
    const h = setup(records);
    try {
      let copied;
      Object.defineProperty(h.dom.window.navigator, 'clipboard', {value:{writeText:async value => { copied=value; }}});
      await flush();
      h.root.querySelector('[data-entry-id="sm912345"]').click();
      const detail = h.root.querySelector('.znh-detail');
      const button = detail.querySelector('[data-history-action="copy"]');
      assert(button.textContent.includes('修復レポート'));
      button.click();
      await flush();
      for (const expected of ['2.7.473-task1096','コメント取得','comment-read','応答の確認','schema','RESPONSE_SCHEMA',
        'data.threads','503','packages/comment-history/src/core.mjs','docs/maintenance/REPAIR_GUIDE.md']) {
        assert(copied.includes(expected), expected);
      }
      for (const privateText of ['生のエラー文','https:','secretValue','sm912345','untrustedBuild','投稿した本文','個人の動画名',
        'privateFolder','secretFunction','privateRequest','98765432','別の問題','storyboard']) {
        assert(!copied.includes(privateText), privateText);
      }
      assert(detail.querySelector('[role="status"]').textContent.includes('コピーしました'));
    } finally { h.dom.window.close(); }
  });

  it('copies the history operation and fixed key rejection code without the actual key', async () => {
    const h = setup([{id:'history', timestamp:1, category:'network', level:'warning', source:'comment-history-read',
      details:{phase:'response', reason:'permission', statusCode:400, errorCode:'INVALID_TOKEN', threadKey:'private-value'}}]);
    try {
      await flush();
      h.root.querySelector('[data-entry-id]').click();
      h.root.querySelector('[data-history-action="copy"]').click();
      await flush();
      const text = h.root.querySelector('textarea').value;
      for (const expected of ['コメント増量','INVALID_TOKEN','400','permission']) assert(text.includes(expected),expected);
      assert(!text.includes('private-value'));
    } finally { h.dom.window.close(); }
  });

  it('identifies the failed key or playback field in the copied report', async () => {
    for (const [source, field, label] of [
      ['playback-position','response.json','再生位置の保存'],
      ['watch-later-add','meta.status','あとで見るへの追加'],
      ['mylist-remove','meta.status','マイリストからの削除'],
      ['tag-add','data.tags[].name','タグの追加'],
      ['tag-remove','meta.status','タグの削除'],
      ['tag-key','data.tag.edit.editKey','タグ編集キー'],
      ['tag-suggest','candidates[]','タグ候補'],
      ['dictionary','articles[].request_title','大百科'],
      ['comment-key','data.threadKey','コメント取得キー'],
      ['video-session','data.contentUrl','配信URL'],
      ['video-session','response.json','配信URL'],
      ['video-session','data.session.content_uri','配信URL']
    ]) {
      const h = setup([{id:'issue', timestamp:1, category:'network', level:'warning', source,
        details:{phase:'response', reason:'schema', missing:field, errorCode:'RESPONSE_SCHEMA',
          contentUrl:'https://secret.invalid/signed', threadKey:'private-value'}}]);
      try {
        await flush();
        h.root.querySelector('[data-entry-id]').click();
        h.root.querySelector('[data-history-action="copy"]').click();
        await flush();
        const report = h.root.querySelector('textarea').value;
        for (const expected of [source,field,label]) assert(report.includes(expected),expected);
        assert(!/secret.invalid|private-value/.test(report));
      } finally { h.dom.window.close(); }
    }
  });

  it('offers a selectable safe report after clipboard rejection for incomplete or unrecognized records', async () => {
    const h = setup([{id:'legacy', level:'error', category:'system', version:'2.7.473-secretValue',
      source:'privateSource', message:'privateMessage', details:{phase:'privatePhase', operation:'constructor',
        reason:'privateReason', missing:'privateIdentifier', module:'privateFolder/file.js', errorCode:'privateCode',
        apiStatus:'privateStatus', statusCode:600}}]);
    try {
      Object.defineProperty(h.dom.window.navigator, 'clipboard', {value:{writeText:async () => { throw new Error('denied'); }}});
      await flush();
      h.root.querySelector('[data-entry-id]').click();
      const detail = h.root.querySelector('.znh-detail');
      detail.querySelector('[data-history-action="copy"]').click();
      await flush();
      const text = detail.querySelector('textarea');
      assert(text.readOnly && text.selectionEnd === text.value.length);
      assert(text.value.includes('docs/maintenance/REPAIR_GUIDE.md'));
      assert(text.value.includes('記録なし'));
      assert(!/private|secretValue|constructor|Invalid Date|HTTP状態|API状態/.test(text.value));
      assert(detail.querySelector('[role="status"]').textContent.includes('選択'));
    } finally { h.dom.window.close(); }
  });

  it('displays the registered operation name and the applicable repository source path', async () => {
    const records = [{id:'clip', timestamp:1, category:'network', level:'warning', source:'clip-permission',
      message:'クリップの応答形式を確認できません', details:{module:'src/ShareOfficialClip.js'}}];
    const h = setup(records);
    try {
      await flush();
      h.root.querySelector('[data-entry-id]').click();
      const detail = h.root.querySelector('.znh-detail');
      assert(detail.textContent.includes('クリップ投稿の利用確認'));
      assert(detail.textContent.includes('src/ShareOfficialClip.js'));
      assert(!detail.textContent.includes('tools/typescript-stage1/src/'));
    } finally { h.dom.window.close(); }
  });
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

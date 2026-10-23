'use strict';
const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');

function harness(extra = {}) {
  const context = createContext(Object.assign({indexedDB: undefined}, extra));
  run('const NotificationJournal = ' +
    extract('src/NotificationJournal.js', 'NotificationJournal', 'var') +
    ';globalThis.__journal=NotificationJournal;', context);
  return context.__journal;
}

describe('NotificationJournal source-only, no network', () => {
  it('stores entries in session when IndexedDB is unavailable', async () => {
    const journal = harness();
    let updates = 0;
    const unsubscribe = journal.subscribe(() => { updates++; });
    const item = journal.record({
      level: 'error', category: 'comment', message: 'コメント投稿に失敗しました',
      videoId: 'sm12345', source: 'comment',
      details: {statusCode: 400, outcome: 'unknown'}
    });
    assert(item.id);
    assert.strictEqual(updates, 1);
    const list = await journal.list();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].message, 'コメント投稿に失敗しました');
    assert.strictEqual(list[0].details.statusCode, 400);
    assert.strictEqual(list[0].details.outcome, 'unknown');
    unsubscribe();
    journal.record({message: 'other'});
    assert.strictEqual(updates, 1);
  });

  it('never persists arbitrary payload, raw response, comment text, or credential fields', async () => {
    const journal = harness();
    const secret = 'SYNTHETIC_SECRET_VALUE';
    const item = journal.record({
      category: 'network', level: 'error',
      message: 'https://api.example/v1/info?token=' + secret + '#session ' +
        'Bearer ' + secret + ' cookie=' + secret,
      videoId: 'javascript:alert(1)',
      source: 'netUtil',
      details: {
        statusCode: 403, errorCode: 'TOKEN_EXPIRED', reason: 'network',
        token: secret, comment: secret, body: secret, url: 'https://bad.test/?k=' + secret,
        headers: {Authorization: secret}, result: {userId: secret}
      }
    });
    const serialized = JSON.stringify(item);
    assert(!serialized.includes(secret), serialized);
    assert(!serialized.includes('Authorization'));
    assert(!serialized.includes('javascript:'));
    assert.strictEqual(item.videoId, '');
    assert.strictEqual(item.details.statusCode, 403);
    assert.strictEqual(item.details.errorCode, 'TOKEN_EXPIRED');
    assert.deepStrictEqual(Object.keys(item.details).sort(),
      ['errorCode', 'reason', 'statusCode']);
  });

  it('keeps classified event and suppresses only its duplicate generic popup', async () => {
    const journal = harness();
    const first = journal.record({
      category: 'comment', level: 'success', source: 'comment',
      message: 'コメント投稿成功', videoId: 'sm9'
    });
    const duplicate = journal.record({
      category: 'general', level: 'info', source: 'popup',
      message: 'コメント投稿成功', videoId: 'sm9'
    });
    assert(first);
    assert.strictEqual(duplicate, null);
    assert.strictEqual((await journal.list()).length, 1);
    journal.record({category: 'general', message: '別の通知'});
    journal.record({category: 'general', message: '別の通知'});
    assert.strictEqual((await journal.list()).length, 3);
  });

  it('does not suppress a notification belonging to a different video', async () => {
    const journal = harness();
    journal.record({category: 'like', message: 'ありがとう', videoId: 'sm9'});
    journal.record({category: 'general', message: 'ありがとう', videoId: 'sm10'});
    assert.strictEqual((await journal.list()).length, 2);
  });

  it('bounds both strings and session records', async () => {
    const journal = harness();
    journal.record({category: 'system', message: 'x'.repeat(3000)});
    assert.strictEqual((await journal.list())[0].message.length, 1024);
    for (let i = 0; i < 2020; i++) {
      journal.record({category: 'general', message: 'item-' + i});
    }
    const stored = await journal.list(5000);
    assert.strictEqual(stored.length, 2000);
    assert(stored.some(x => x.message === 'item-2019'));
    assert(!stored.some(x => x.message === 'item-0'));
  });

  it('clears session records even when IndexedDB cannot open', async () => {
    const journal = harness();
    journal.record({message: 'notice'});
    assert.strictEqual(await journal.clear(), false);
    assert.strictEqual((await journal.list()).length, 0);
  });
});

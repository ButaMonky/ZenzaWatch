'use strict';
const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');
const {sharedStorage} = require('../helpers/notificationSharedStorage');

const flush = () => new Promise(resolve => setImmediate(resolve));
function fakeIndexedDb({failWrite = 0} = {}) {
  const world=sharedStorage(),db=world.factory({failWrite});
  db.locks=world.locks;
  Object.defineProperty(db,'records',{get:()=>world.stores.get('entries')||new Map()});
  return db;
}
function journal(indexedDB) {
  const context = createContext({indexedDB,navigator:{locks:indexedDB.locks}});
  for (const name of ['NotificationJournalPolicy', 'NotificationJournalStore']) {
    run('const ' + name + ' = ' + extract('packages/zenza/src/notification/' + name + '.js', name, 'var') + ';', context);
  }
  run('const NotificationJournal = ' +
    extract('src/NotificationJournal.js', 'NotificationJournal', 'var') +
    ';globalThis.__journal=NotificationJournal;', context);
  return context.__journal;
}
describe('NotificationJournal IndexedDB contract (synthetic)', () => {
  it('keeps a failed newer grouped write in memory after an older commit', async () => {
    const db=fakeIndexedDb({failWrite:2}), first=journal(db);
    const input={message:'failure',details:{outcome:'failed'}};
    first.recordDiagnostic('diag-write-1',input);
    first.recordDiagnostic('diag-write-1',input);
    await flush();
    assert.strictEqual((await first.list())[0].details.count,2);
    assert.strictEqual((await journal(db).list())[0].details.count,1);
  });
  it('does not resurrect diagnostic groups cleared by a subscriber', async () => {
    const db=fakeIndexedDb(), first=journal(db);let clearing;
    const unsubscribe=first.subscribe(()=>{unsubscribe();clearing=first.clear();});
    first.recordDiagnostic('diag-clear-1',{message:'failure',details:{outcome:'failed'}});
    await clearing;
    first.recordDiagnostic('diag-clear-1',{message:'recovery',details:{outcome:'recovered'}});
    await flush();assert.strictEqual((await journal(db).list()).length,0);
  });
  it('groups a nested diagnostic report before notifying subscribers', async () => {
    const db=fakeIndexedDb(), first=journal(db);
    const input={message:'failure',details:{outcome:'failed'}};
    const unsubscribe=first.subscribe(()=>{unsubscribe();first.recordDiagnostic('diag-nested-1',input);});
    first.recordDiagnostic('diag-nested-1',input);
    await flush();const rows=await journal(db).list();
    assert.strictEqual(rows.length,1);assert.strictEqual(rows[0].details.count,2);
  });
  it('groups repeated request failures, marks recovery in place, and resets on clear', async () => {
    const db = fakeIndexedDb(), first = journal(db);
    const failed = {category:'network', message:'動画情報：失敗', details:{outcome:'failed', operation:'video-info'}};
    const initial = first.recordDiagnostic('diag-video-1', failed);
    first.recordDiagnostic('diag-video-1', failed);
    first.recordDiagnostic('diag-video-1', {category:'network', level:'success', message:'動画情報：復旧', details:{outcome:'recovered'}});
    await flush();
    const rows = await journal(db).list();
    assert.strictEqual(rows.length,1);assert.strictEqual(rows[0].id,initial.id);
    assert.strictEqual(rows[0].details.count,2);assert.strictEqual(rows[0].details.outcome,'recovered');
    first.recordDiagnostic('diag-video-2',failed);await first.clear();
    first.recordDiagnostic('diag-video-2',{message:'復旧',details:{outcome:'recovered'}});
    await flush();assert.strictEqual((await first.list()).length,0);
  });
  it('keeps a new notification recorded by a clear subscriber, but cancels older queued writes', async () => {
    const db = fakeIndexedDb();
    const first = journal(db);
    first.record({message: 'before clear'});
    const unsubscribe = first.subscribe(() => {
      unsubscribe();
      first.record({message: 'after clear'});
    });
    assert.strictEqual(await first.clear(), true);
    await flush();
    const rows = await journal(db).list();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].message, 'after clear');
  });
  it('persists an event across journal instances without leaking auth metadata', async () => {
    const db = fakeIndexedDb();
    const first = journal(db);
    first.record({
      category: 'network', level: 'error', message: 'HTTP 400',
      videoId: 'sm19', details: {statusCode: 400, token: 'SYNTHETIC_SECRET'}
    });
    await flush();
    const second = journal(db);
    const rows = await second.list();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].videoId, 'sm19');
    assert.strictEqual(rows[0].details.statusCode, 400);
    assert.strictEqual(JSON.stringify(rows).includes('SYNTHETIC_SECRET'), false);
    assert.strictEqual(db.records.size, 1);
  });
  it('clears stored events and removes memory shadow after persistence', async () => {
    const db = fakeIndexedDb();
    const first = journal(db);
    first.record({category: 'like', message: 'ありがとうございます', videoId: 'sm9'});
    await flush();
    const second = journal(db);
    assert.strictEqual((await second.list()).length, 1);
    assert.strictEqual(await second.clear(), true);
    assert.strictEqual((await second.list()).length, 0);
    assert.strictEqual((await first.list()).length, 0,
      'committed entries must not linger in a stale session mirror');
  });
});

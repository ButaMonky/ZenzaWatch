'use strict';
const assert=require('assert');
const {sharedStorage,turn}=require('../helpers/notificationSharedStorage');
const failed={category:'network',message:'synthetic failure',details:{outcome:'failed'}};
describe('Issue262 cross-tab clear ordering (synthetic)',()=>{
  it('reserves append before open and never inserts it behind a later clear',async()=>{
    const world=sharedStorage(),a=world.journal({holdOpen:true}),b=world.journal();
    a.api.record({message:'before'});let complete=false;
    const clearing=b.api.clear().then(value=>{complete=true;return value;});
    await turn();await turn();
    const passedBeforeRelease=complete;
    a.db.release();await clearing;
    assert.strictEqual(passedBeforeRelease,false,'clear waits for the already-reserved operation');
    assert.strictEqual((await b.api.list()).length,0);
  });
  it('keeps new records after clear with localStorage blocked and equal clocks',async()=>{
    const world=sharedStorage(),a=world.journal({now:1000}),b=world.journal({now:1000});
    a.api.record({message:'before'});await a.api.list();await b.api.clear();
    a.api.record({message:'after'});
    assert.deepStrictEqual(Array.from(await a.api.list(),x=>x.message),['after']);
    assert.deepStrictEqual(Array.from(await world.journal().api.list(),x=>x.message),['after']);
  });
  it('removes old failed-write fallback without removing new fallback on late clear notification',async()=>{
    const world=sharedStorage(),a=world.journal({failWrite:true,now:1000}),b=world.journal({now:1000});
    a.api.record({message:'before'});assert.strictEqual((await a.api.list()).length,1);
    await b.api.clear();
    a.api.record({message:'after'});
    assert.deepStrictEqual(Array.from(await a.api.list(),x=>x.message),['after']);
    world.deliver(true);
    assert.deepStrictEqual(Array.from(await a.api.list(),x=>x.message),['after']);
  });
  it('does not resurrect an old diagnostic group on recovery after peer clear',async()=>{
    const world=sharedStorage(),a=world.journal(),b=world.journal();
    a.api.recordDiagnostic('diag-fixture',failed);await a.api.list();await b.api.clear();
    a.api.recordDiagnostic('diag-fixture',{message:'recovered',details:{outcome:'recovered'}});
    assert.strictEqual((await a.api.list()).length,0);
  });
  it('starts a fresh diagnostic group after peer clear even when clocks go backwards',async()=>{
    const world=sharedStorage(),a=world.journal({now:1000}),b=world.journal({now:2000});
    const old=a.api.recordDiagnostic('diag-fixture',failed);await a.api.list();await b.api.clear();
    a.options.now=500;a.api.recordDiagnostic('diag-fixture',failed);
    const rows=await a.api.list();assert.strictEqual(rows.length,1);
    assert.notStrictEqual(rows[0].id,old.id);assert.strictEqual(rows[0].details.count,1);
    assert.strictEqual(rows[0].firstOccurredAt,500);
  });
  it('does not suppress a new generic notification using a cleared classified event',async()=>{
    const world=sharedStorage(),a=world.journal({now:1000}),b=world.journal({now:1000});
    a.api.record({category:'like',message:'same',videoId:'sm9'});await a.api.list();await b.api.clear();
    a.api.record({category:'general',source:'popup',message:'same'});
    const rows=await a.api.list();assert.strictEqual(rows.length,1);assert.strictEqual(rows[0].category,'general');
  });
  it('does not report clear success or discard old stored records after transaction abort',async()=>{
    const world=sharedStorage(),a=world.journal(),b=world.journal({failClear:true});
    a.api.record({message:'before'});await a.api.list();
    assert.strictEqual(await b.api.clear(),false);
    assert.deepStrictEqual(Array.from(await a.api.list(),x=>x.message),['before']);
  });
  it('never promotes an unknown-epoch fallback after metadata access recovers',async()=>{
    const world=sharedStorage(),a=world.journal({failMetadata:true}),b=world.journal();
    a.api.record({message:'unknown'});await a.api.list();
    await b.api.clear();a.options.failMetadata=false;
    a.api.record({message:'known'});await a.api.list();world.deliver(true);
    assert.deepStrictEqual(Array.from(await world.journal().api.list(),x=>x.message),['known']);
    assert.strictEqual(world.stores.get('entries').size,1);
  });
  it('ignores reversed older clear messages after observing the latest epoch',async()=>{
    const world=sharedStorage(),a=world.journal({failWrite:true}),b=world.journal();
    await b.api.clear();a.api.record({message:'old fallback'});await a.api.list();
    await b.api.clear();a.api.record({message:'latest fallback'});await a.api.list();
    world.deliver(true);
    assert.deepStrictEqual(Array.from(await a.api.list(),x=>x.message),['latest fallback']);
  });
});

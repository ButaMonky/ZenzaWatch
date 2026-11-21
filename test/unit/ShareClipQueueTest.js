const assert = require('node:assert/strict');
const vm = require('node:vm');
const {beginSection} = require('../helpers/extractSource');

function queueWith(locks) {
  return vm.runInNewContext(beginSection('src/ShareClipQueue.js') + '\nShareClipQueue', {
    navigator:{locks}, AbortController, queueMicrotask, console
  });
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise,resolve};
}
describe('share clip reservations', () => {
  it('serializes output, skips a cancelled reservation, and advances after a failure',async () => {
    const queue = queueWith(), events = [], firstDone = deferred();
    const task = (name,run) => queue.enqueue({name,kind:'mp4',from:0,to:3,run});
    const first = task('first', async () => { events.push('first'); await firstDone.promise; });
    const second = queue.enqueue({name:'discard',onCancel:() => events.push('cancel'),run:() => assert.fail()});
    const third = task('failure', () => { events.push('failure'); throw Error('unavailable'); });
    const last = task('last', () => { events.push('last'); });
    assert.equal(first.cancel(),false);
    assert.equal(second.cancel(),true);
    assert.equal(second.cancel(),false);
    assert.deepEqual(events,['first','cancel']);
    firstDone.resolve();
    await Promise.all([first.done,second.done,third.done,last.done]);
    assert.deepEqual(events,['first','cancel','failure','last']);
    assert.deepEqual([first.state,second.state,third.state,last.state],['finished','cancelled','failed','finished']);
    assert.equal(queue.items.length,0);
  });
  it('holds the turn during asynchronous cancellation cleanup and delivers independent subscriptions',async()=>{
    const queue=queueWith(), ended=deferred(), events=[];
    const length=[];
    const off=queue.subscribe(items=>length.push(items.length));
    const a=queue.enqueue({name:'A',allowRunningCancel:true,async run(signal) {
      signal.addEventListener('abort',()=>events.push('abort'));
      await ended.promise;
      events.push('cleanup');
    }});
    const b=queue.enqueue({name:'B',run:()=>events.push('B')});
    assert.equal(a.cancel(),true);
    assert.deepEqual(events,['abort']);
    ended.resolve();
    await b.done;
    assert.deepEqual(events,['abort','cleanup','B']);
    assert.equal(a.state,'cancelled');
    assert.equal(length[0],0);
    assert.equal(length.at(-1),0);
    off();
  });
  it('releases the snapshot if a subscriber cancels as the turn is granted', async () => {
    const queue = queueWith();
    let cleanups = 0;
    queue.subscribe(items => {
      if (items[0]?.state === 'running') items[0].cancel();
    });
    const item = queue.enqueue({
      allowRunningCancel:true,
      run:() => assert.fail('cancelled work started'),
      onCancel:() => { cleanups++; }
    });
    await item.done;
    assert.equal(cleanups,1);
    assert.equal(item.state,'cancelled');
  });
  it('releases prepared resources when the browser refuses to grant the lock',async()=>{
    const error=Error('lock denied'), reports=[];
    const queue=queueWith({request:()=>Promise.reject(error)});
    const item=queue.enqueue({name:'A',run:()=>assert.fail(),onError:e=>reports.push(e.message),onCancel:reason=>reports.push(reason)});
    await item.done;
    assert.deepEqual(reports,['lock denied','failed']);
    assert.equal(item.state,'failed');
    assert.equal(queue.items.length,0);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {flush, loadSource} from './nonvisual-audit-source-harness.mjs';

const response = (status, body) => ({status, json: async () => body});
const ok = response(200, {meta:{status:200}});
const operations = {
  'watch-later-add': (api, owner) => api.addDeflistItem('smPrivate', 'privateMemo', false, owner),
  'watch-later-remove': (api, owner) => api.removeDeflistItem('smPrivate', owner),
  'mylist-add': (api, owner) => api.addMylistItem('smPrivate', 77, 'privateMemo', owner),
  'mylist-remove': (api, owner) => api.removeMylistItem('smPrivate', 77, owner)
};

function setup(...queue) {
  const events = [], changes = [], writes = [];
  const diagnostics = loadSource('nico-src/RequestDiagnostics.ts', 'RequestDiagnostics');
  diagnostics.setSink(event => events.push(event));
  const api = loadSource('nico-src/MylistApiLoader.ts', 'MylistApiLoader', {
    URLSearchParams, sessionStorage:{}, window:{}, RequestDiagnostics:diagnostics,
    CacheStorage:class {removeItem() {}},
    emitter:{on() {}, emitAsync(...args) {changes.push(args);}},
    netUtil:{fetch:async (url, opts) => {
      if (!opts.method) {
        const kind = url.includes('watch-later') ? 'watchLater' : 'mylist';
        return response(200, {meta:{status:200}, data:{[kind]:{items:[{watchId:'smPrivate',itemId:81}]}}});
      }
      writes.push({url, opts});
      if (!queue.length) throw Error('unexpected write');
      const next = queue.shift();
      return typeof next === 'function' ? next() : next;
    }}
  });
  return {api, writes, events, changes};
}

for (const [operation, act] of Object.entries(operations)) {
  test(operation + ' validates both statuses and only publishes recovery after confirmation', async () => {
    const h = setup(response(403,{meta:{status:200}}), response(200,null),
      response(200,{meta:{status:200},error:{code:'privateApiCode',description:'privateDescription'}}),
      {status:200, json:async () => {throw SyntaxError('privateBody');}},
      () => {throw new TypeError('privateTransport');}, ok, ok);
    for (const reason of ['permission','schema','service','schema','network']) {
      const index = h.writes.length;
      await assert.rejects(act(h.api), error => error.status === 'fail');
      assert.equal(h.writes.length,index+1);
      assert.equal(h.events.at(-1)?.operation,operation);
      assert.equal(h.events.at(-1).reason,reason);
      assert.equal(h.events.at(-1).method,operation.endsWith('-add') ? 'POST' : 'DELETE');
      assert.deepEqual(h.changes,[]);
    }
    assert.deepEqual(h.events.slice(0,2).map(e => [e.statusCode,e.apiStatus,e.missing]),
      [[403,200,undefined],[200,undefined,'meta.status']]);
    assert.equal(h.events[2].errorCode,'OTHER');
    assert.equal(h.events[3].missing,'json');
    assert.equal((await act(h.api)).status,'ok');
    await flush();
    assert.equal(h.events.filter(e => e.operation === operation && e.outcome === 'recovered').length,1);
    assert.equal(h.changes.length,operation === 'mylist-add' ? 2 : 1);
    assert.equal(h.writes.length,operation === 'mylist-add' ? 7 : 6);
    assert.ok(h.writes.every(w => w.opts.diagnosticActive() === false));
    assert.doesNotMatch(JSON.stringify(h.events),/smPrivate|privateMemo|privateApiCode|privateDescription|privateBody|privateTransport|itemIds=/);
  });
}

test('watch-later duplicate keeps the saved item and does not recover a failed write', async () => {
  const conflict = {meta:{status:409},error:{code:'CONFLICT'}};
  const h = setup(response(503,conflict), response(409,conflict), ok);
  const act = operations['watch-later-add'];
  await assert.rejects(act(h.api));
  assert.match((await act(h.api)).message,/登録済み/);
  assert.deepEqual(h.events.map(e => e.outcome),['failed']);
  assert.deepEqual(h.changes,[]);
  await act(h.api);
  assert.deepEqual(h.events.map(e => e.outcome),['failed','recovered']);
  assert.deepEqual(h.writes.map(w => w.opts.method),['POST','POST','POST']);
});

test('another group or the opposite operation cannot clear a failed add', async () => {
  const h = setup(response(200, {meta:{status:403}}),ok,ok,ok,ok,ok);
  const add = group => h.api.addMylistItem('smPrivate',group);
  await assert.rejects(add(77));
  await add(78);
  await flush();
  await h.api.removeMylistItem('smPrivate',77);
  assert.deepEqual(h.events.map(e => [e.outcome,e.operation]),[['failed','mylist-add']]);
  await add(77);
  await flush();
  assert.deepEqual(h.events.map(e => [e.outcome,e.operation]),[['failed','mylist-add'],['recovered','mylist-add']]);
});

for (const [operation, act] of Object.entries(operations)) {
  test(operation + ' suppresses a stale request and stale completion', async () => {
    let current = false, resolve;
    const owner = {isCurrent:() => current};
    const h = setup(() => new Promise(r => {resolve = r;}));
    await assert.rejects(act(h.api, owner), e => e.code === 'STALE');
    assert.equal(h.writes.length,0);
    current = true;
    const pending = act(h.api, owner);
    await flush();
    assert.equal(h.writes.length,1);
    current = false;
    resolve(ok);
    await assert.rejects(pending, e => e.code === 'STALE');
    assert.deepEqual(h.events,[]);
    assert.deepEqual(h.changes,[]);
    assert.equal(h.writes.length,1);
  });
}

for (const [command, operation] of [
  ['deflistAdd','watch-later-add'], ['deflistRemove','watch-later-remove'],
  ['mylistAdd','mylist-add'], ['mylistRemove','mylist-remove']
]) {
  test('player command ' + command + ' keeps service text out of popup history and skips dispatch after navigation', async () => {
    const commands = loadSource('nico-src/NicoVideoPlayerDialogCommands.ts','NicoVideoPlayerDialogCommands');
    const actions = loadSource('nico-src/NicoVideoPlayerDialogUserActions.ts','NicoVideoPlayerDialogUserActions', {
      util:{isLogin:() => true}, window:{setTimeout:callback => callback()}
    });
    const h = setup(response(200,{meta:{status:403},error:{code:'FORBIDDEN',description:'privateDescription'}}));
    const messages = [];
    const dialog = {...actions, _mylistApiLoader:h.api, _state:{isOpen:true}, _requestId:1,
      _watchId:'smPrivate', _videoInfo:{watchId:'smPrivate',owner:{}},
      _playerConfig:{props:{},getValue:() => false}, execCommand:(...args) => messages.push(args)};
    const param = command.startsWith('mylist') ? {mylistId:77,mylistName:'privateList'} : 'smPrivate';
    commands._onCommand.call(dialog, command, param);
    await flush();
    assert.equal(h.events[0]?.operation,operation);
    assert.equal(h.events[0].reason,'permission');
    assert.equal(messages.length,1);
    assert.equal(messages[0][0],'alert');
    assert.match(messages[0][1],/一覧/);
    assert.doesNotMatch(JSON.stringify(messages),/privateDescription|privateList/);
    commands._onCommand.call(dialog, command, param);
    dialog._requestId++;
    await flush();
    assert.equal(h.writes.length,1);
    assert.equal(messages.length,1);
    assert.equal(h.events.length,1);
  });
}

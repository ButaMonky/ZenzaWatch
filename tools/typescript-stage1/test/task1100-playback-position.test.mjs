import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSource} from './nonvisual-audit-source-harness.mjs';

function fixture() {
  const events = [], calls = [], replies = [];
  const diag = loadSource('nico-src/RequestDiagnostics.ts','RequestDiagnostics');
  diag.setSink(event => events.push(event));
  const writer = loadSource('nico-src/PlaybackPosition.ts','PlaybackPosition', {
    RequestDiagnostics:diag, netUtil:{fetch:async (url, options) => {
      calls.push(options);
      return replies.shift()();
    }}
  });
  const respond = (status, text) => replies.push(() => ({status,text:async () => text}));
  return {events,calls,replies,respond,save: id => writer.record(id,17)};
}

test('playback position separates wire, body and API errors and recovers per video after an empty acknowledgement',async () => {
  const h = fixture();
  h.respond(403,'{}');
  await assert.rejects(h.save('sm101'));
  h.respond(200,'{"meta":{"status":200,"errorCode":"PRIVATE_MARKER"}}');
  await assert.rejects(h.save('sm101'));
  h.respond(200,'{"meta":{"status":403}}');
  await assert.rejects(h.save('sm101'));
  h.respond(200,'{');
  await assert.rejects(h.save('sm101'));
  h.respond(204,'');await h.save('sm102');
  h.respond(204,'');await h.save('sm101');
  assert.deepEqual(h.events.map(e=>e.reason),['permission','service','permission','schema','recovered']);
  assert.equal(h.events[0].statusCode,403);
  assert.equal(h.events[1].errorCode,'OTHER');
  assert.equal(h.events[2].apiStatus,403);
  assert.equal(h.events[3].missing,'response.json');
  assert.equal(h.events[4].key,h.events[0].key);
  assert(h.events.every(e=>e.operation==='playback-position' && e.module==='nico-src/PlaybackPosition.ts'));
  assert(!/PRIVATE_MARKER|sm101/.test(JSON.stringify(h.events)));
  assert(h.calls.every(o=>o.method==='PUT' && o.diagnosticActive()===false));
  assert.equal(h.calls.length,6);
});

test('playback-position diagnostics accept older receipts but never infer recovery from missing API metadata',async () => {
  const h = fixture();
  h.respond(200,'{"data":{"playbackPosition":17}}');
  assert.equal((await h.save('sm101')).status,200);
  assert.equal(h.events[0].missing,'meta.status');
  h.respond(200,'{"meta":{"status":"204"}}');await h.save('sm101');
  assert.equal(h.events[1].outcome,'recovered');
  h.replies.push(()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});});
  await assert.rejects(h.save('sm101'));
  assert.equal(h.events[2].reason,'timeout');
  h.respond(200,'');await h.save('sm101');
  assert.equal(h.events[3].outcome,'recovered');
  await assert.rejects(h.save('invalid'));
  assert.equal(h.events.length,4);
});

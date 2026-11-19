import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './nonvisual-audit-source-harness.mjs';

const response = (body, status = 200) => ({status, json: async () => body});
const tags = (items, status = 200) => response({meta:{status}, data:{tags:items}});
const expired = () => response({meta:{status:403, errorCode:'FORBIDDEN'}}, 403);
const key = (editKey, wire = 200, api = 200) => response({meta:{status:api}, data:{tag:{edit:{editKey}}}}, wire);

function fixture(name, ...queue) {
  const calls = [], events = [];
  const diagnostics = loadSource('nico-src/RequestDiagnostics.ts', 'RequestDiagnostics');
  diagnostics.setSink(e => events.push(e));
  const transport = {async fetch(url, options) {
    calls.push({url, options});
    assert.ok(queue.length, 'unexpected request');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  }};
  const subject = loadSource('nico-src/' + name + '.ts', name, {
    netUtil:transport, util:transport, URLSearchParams, RequestDiagnostics:diagnostics,
    window:{console:{warn() {}}}
  });
  return {api:name === 'TagEditApi' ? new subject() : subject, calls, events};
}

test('tag suggestions keep their string-array fallback and cache only verified replies', async () => {
  const cases = [
    [response({}, 403), 'permission', undefined, []],
    [response({candidates:['private-candidate']}, 503), 'http', undefined, []],
    [response({}), 'schema', 'candidates', []],
    [response({candidates:['ok', null]}), 'schema', 'candidates[]', ['ok']]
  ];
  for (const [bad, reason, missing, expected] of cases) {
    const h = fixture('TagSuggestLoader', bad, response({candidates:[]}));
    for (const result of [expected, [], []]) assert.deepEqual(Array.from(await h.api.load('private-term')), result);
    assert.equal(h.calls.length, 2);
    assert.deepEqual(h.events.map(e => e.outcome), ['failed','recovered']);
    assert.equal(h.events[0].reason, reason);
    assert.equal(h.events[0].missing, missing);
    assert.equal(h.events[0].statusCode, bad.status);
    assert.equal(h.events[0].apiStatus, undefined);
    assert.doesNotMatch(JSON.stringify(h.events), /private-/);
  }
});

for (const [method, operation] of [['load','tags'], ['add','tag-add'], ['remove','tag-remove']]) {
  const change = api => method === 'load' ? api.load('sm9','private-key') :
    api[method]({videoId:'sm9', editKey:'private-key', tag:'private-tag'});
  test(operation + ' keeps legacy tag rows but records a body-level rejection', async () => {
    const data = {tags:[],error_msg:'private-action-message'};
    const h = fixture('TagEditApi',response({meta:{status:200},data}),tags([]));
    assert.equal((await change(h.api)).error_msg,data.error_msg);
    assert.equal(h.events[0].reason,'service');
    assert.equal(h.events[0].operation,operation);
    await change(h.api);
    assert.equal(h.events[1].outcome,'recovered');
    assert(!JSON.stringify(h.events).includes(data.error_msg));
    assert.equal(h.calls.length,2);
  });
  test(operation + ' validates the tag names and can recover on an empty list', async () => {
    for (const [bad, missing] of [[tags('private'), 'data.tags'], [tags([null]), 'data.tags[].name']]) {
      const h = fixture('TagEditApi', bad, tags([]));
      await assert.rejects(change(h.api), e => e.kind === 'API');
      assert.equal((await change(h.api)).tags.length, 0);
      assert.equal(h.calls.length, 2);
      assert.deepEqual(h.events.map(e => [e.operation, e.outcome]), [[operation, 'failed'], [operation, 'recovered']]);
      assert.equal(h.events[0].missing, missing);
      assert.equal(h.events[0].apiStatus, 200);
      assert.equal(h.events[0].statusCode, 200);
      assert.doesNotMatch(JSON.stringify(h.events), /private/);
    }
  });
  test(operation + ' rejects API errors even with success-shaped data', async () => {
    const h = fixture('TagEditApi', response({meta:{status:200,errorCode:'private-code'}, data:{tags:[]}}));
    await assert.rejects(change(h.api));
    assert.equal(h.calls.length, 1);
    assert.equal(h.events[0].reason, 'service');
    assert.equal(h.events[0].errorCode, 'OTHER');
    assert.doesNotMatch(JSON.stringify(h.events), /private/);
  });
}

test('tag writes never replay when key refresh fails HTTP, API, schema or transport validation', async () => {
  for (const [bad, reason, missing] of [
    [key('private-key', 503), 'http'],
    [key('private-key', 200, 403), 'permission'],
    [key(7), 'schema', 'data.tag.edit.editKey'],
    [key('  '), 'schema', 'data.tag.edit.editKey'],
    [{status:200,json:async () => { throw SyntaxError('private-json'); }}, 'schema', 'json'],
    [Object.assign(Error('private'), {status:'timeout'}), 'timeout']
  ]) {
    const h = fixture('TagEditApi', expired(), bad);
    const updates = [];
    await assert.rejects(h.api.add({videoId:'sm9',tag:'private-tag', editKey:'old',onEditKeyUpdate:k=>updates.push(k)}));
    assert.equal(h.calls.length, 2);
    assert.equal(updates.length, 0);
    assert.deepEqual(h.events.map(e => e.operation), ['tag-add','tag-key']);
    assert.equal(h.events[1].reason, reason);
    assert.equal(h.events[1].missing, missing);
    assert.doesNotMatch(JSON.stringify(h.events), /private/);
  }
});

test('an explicitly rejected key allows exactly one replay with the verified replacement', async () => {
  const h = fixture('TagEditApi', expired(), key('private-fresh'), tags([]));
  const updates = [];
  await h.api.remove({videoId:'sm9',tag:'private-tag',editKey:'old',onEditKeyUpdate:k=>updates.push(k)});
  assert.deepEqual(updates, ['private-fresh']);
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[2].options.headers['X-Tag-Edit-Key'], 'private-fresh');
  assert.deepEqual(h.events.map(e => [e.operation,e.outcome]), [['tag-remove','failed'],['tag-remove','recovered']]);
  assert.doesNotMatch(JSON.stringify(h.events), /private/);
});

test('uncertain mutation failures never issue an automatic second write', async () => {
  for (const [reply, expected] of [
    [response({meta:{status:403,errorCode:'KEY_EXPIRED'}}, 503), {reason:'http',statusCode:503,apiStatus:403}],
    [response({meta:{status:403,errorCode:'NOT_OWNER'}}), {reason:'permission',statusCode:200,apiStatus:403}],
    [response({meta:{status:'200'},data:{tags:[]}}), {reason:'schema',missing:'meta.status',statusCode:200}],
    [{status:200,json:async () => { throw TypeError('private-stream'); }}, {reason:'network',statusCode:200}],
    [Object.assign(Error('private'), {statusCode:403}), {reason:'network',statusCode:undefined}],
    [Object.assign(Error('private'), {name:'AbortError'}), null]
  ]) {
    const h = fixture('TagEditApi', reply);
    await assert.rejects(h.api.add({videoId:'sm9',tag:'private-tag',editKey:'private-key'}));
    assert.equal(h.calls.length, 1);
    assert.equal(h.events.length, expected ? 1 : 0);
    for (const [field,value] of Object.entries(expected || {})) assert.equal(h.events[0][field], value);
    assert.doesNotMatch(JSON.stringify(h.events), /private/);
  }
});

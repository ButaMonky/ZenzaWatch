import test from 'node:test';
import assert from 'node:assert/strict';
import {OfficialPlayerRoute as original} from
  '../../../packages/zenza/src/menu/OfficialPlayerRoute.js';
import {OfficialPlayerRoute as typed} from
  '../.generated/OfficialPlayerRoute.js';

const ids = ['sm9', 'so1', 'nm42', 'a/b c', '', 0, null, undefined];
const times = [undefined, -3, 0, 0.01, 0.999, 1, 1.9,
  3599, Infinity, NaN, '12', 'not a number', 9007199254740992];
const queries = [null, undefined, {}, {zenza_official: '1'},
  {zenza_official: '0'}, {zenza_official: 1}, {other: '1'}];

test('the TypeScript port has 104 identical legacy URL results', () => {
  assert.equal(typed.PARAM, original.PARAM);
  for (const id of ids) {
    for (const time of times) {
      assert.equal(typed.makeUrl(id, time), original.makeUrl(id, time),
        'URL parity for ' + String(id) + ' at ' + String(time));
    }
  }
});
test('route guard parity for null, string, and wrong-typed markers', () => {
  for (const query of queries) {
    assert.equal(typed.isOfficialRequest(query),
      original.isOfficialRequest(query));
  }
});
test('neither implementation changes the default official route policy', () => {
  const url = new URL(typed.makeUrl('sm9', 1.9));
  assert.equal(url.origin, 'https://www.nicovideo.jp');
  assert.equal(url.searchParams.get('zenza_official'), '1');
  assert.equal(url.searchParams.get('from'), '1');
  assert.equal(new URL(typed.makeUrl('sm9', 0)).searchParams.has('from'), false);
});

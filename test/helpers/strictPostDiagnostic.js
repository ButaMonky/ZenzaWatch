'use strict';
const assert = require('assert');

// B18/R5: test the approved primitive-only logger contract, never filter away leaks.
function assertSafePostDiagnosticRecord(args) {
  assert(Array.isArray(args) && args.length === 3, 'exactly three logger arguments');
  assert.strictEqual(args[0], '[ZenzaWatch][CommentPost]');
  const payload = args[1];
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'diagnostic object');
  assert.strictEqual(Object.prototype.toString.call(payload), '[object Object]');
  const numbers = new Set(['attempt','statusCode','retryAfterMs','delayMs','nextAttempt','commandCount']);
  const booleans = new Set(['retryScheduled','postKeyPresent','challengeRequired','hasNo','hasId']);
  for (const key of Reflect.ownKeys(payload)) {
    assert.strictEqual(typeof key, 'string', 'no symbol payload keys');
    const value = payload[key];
    if (numbers.has(key)) {
      assert(typeof value === 'number' && Number.isFinite(value) && value >= 0,
        'finite nonnegative numeric field: '+key);
      if (key === 'statusCode') {
        assert(Number.isInteger(value) && value >= 100 && value <= 599, 'valid HTTP status');
      }
    } else {
      assert(booleans.has(key), 'unapproved diagnostic field: '+key);
      assert.strictEqual(typeof value, 'boolean', 'boolean field: '+key);
    }
  }
  assert.strictEqual(typeof args[2], 'string', 'copyable JSON string');
  let parsed;
  assert.doesNotThrow(() => { parsed = JSON.parse(args[2]); }, 'valid diagnostic JSON');
  assert.deepStrictEqual(parsed, JSON.parse(JSON.stringify(payload)), 'object and JSON agree');
  assert.strictEqual(args[2], JSON.stringify(payload), 'exact compact JSON projection');
}

module.exports = {assertSafePostDiagnosticRecord};

const assert = require('assert');
const fs = require('fs');
const path = require('path');
function section(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../', file), 'utf8');
  const begin = '//===BEGIN===';
  const end = '//===END===';
  assert.strictEqual(source.split(begin).length, 2, 'unique begin marker');
  assert.strictEqual(source.split(end).length, 2, 'unique end marker');
  return source.slice(source.indexOf(begin) + begin.length, source.indexOf(end));
}
function emitterClass() {
  return new Function(section('packages/lib/src/Emitter.js') + '\nreturn Emitter;')();
}

function fallback() {
  const handlers = {}, queued = [], logs = [];
  const logger = {};
  ['log', 'warn', 'error', 'trace', 'info', 'time', 'timeEnd'].forEach(key => { logger[key] = (...args) => logs.push(args); });
  const window = {addEventListener: (name, fn) => { handlers[name] = fn; }, console: logger};
  // Evaluate actual complete module section with browser boundaries stubbed.
  const bcast = new Function('Emitter', 'PRODUCT', 'global', 'Config', 'NicoVideoApi', 'self', 'location', 'window', 'console',
    section('packages/lib/src/message/messageUtil.js') + '\nreturn BroadcastEmitter;')(
    emitterClass(), 'ZenzaWatch', {debug: {}}, {}, {}, {}, {host: 'www.nicovideo.jp'}, window, logger);
  bcast.emitAsync = (...args) => queued.push(args);
  assert.strictEqual(typeof handlers.storage, 'function', 'fallback listener installed without BroadcastChannel');
  return {send: overrides => handlers.storage(Object.assign({type: 'storage', key: 'ZenzaWatch_message', oldValue: null, newValue: null}, overrides)), queued, logs};
}
describe('ZW-084 StorageEvent fallback', () => {
  it('ignores clear, removal, unchanged value and other prefixes', () => {
    const h = fallback();
    [{key: null}, {newValue: null}, {oldValue: 'same', newValue: 'same'},
      {key: 'Other_message', newValue: '{bad'}, {type: 'message', newValue: '{bad'}]
      .forEach(event => assert.doesNotThrow(() => h.send(event)));
    assert.deepStrictEqual(h.queued, []);
  });
  it('ignores invalid JSON and unusable envelopes without logging payloads', () => {
    const h = fallback();
    ['{private-invalid', 'null', '[]', '42', '{}', '{"body":null}', '{"body":"private"}', '{"body":{}}']
      .forEach(newValue => assert.doesNotThrow(() => h.send({newValue})));
    assert.deepStrictEqual(h.queued, []);
    assert.deepStrictEqual(h.logs, []);
  });
  it('delivers one valid message unchanged without raw payload logging', () => {
    const h = fallback(), body = {command: 'openVideo', params: {watchId: 'sm9'}};
    h.send({newValue: JSON.stringify({body})});
    assert.deepStrictEqual(h.queued, [['message', body, 'broadcast']]);
    assert.deepStrictEqual(h.logs, []);
  });
});

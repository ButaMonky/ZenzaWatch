'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {once} = require('node:events');
const {JSDOM} = require('jsdom');
const {startReceiver} = require('./x-oauth-loopback.cjs');

const address = '127.0.0.1:48765';
const path = '/callback?state=' + 'A'.repeat(43) + '&code=synthetic-code';
function request(target, host = address, method = 'GET') {
  return new Promise((resolve,reject) => {
    const req = http.request({host:'127.0.0.1', port:48765, path:target, method, headers:{Host:host}, agent:false}, res => {
      let body = '';
      res.setEncoding('utf8').on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({status:res.statusCode, headers:res.headers, body}));
    });
    req.on('error',reject).end();
  });
}

test('accepts one valid navigation only on the registered loopback address', async t => {
  const server = startReceiver();
  t.after(() => server.close());
  await once(server,'listening');
  assert.deepEqual(server.address(), {address:'127.0.0.1', family:'IPv4', port:48765});
  for (const [target, host, method] of [
    [path, 'attacker.example:48765'], [path, 'localhost:48765'], [path, address, 'POST'],
    ['/'], ['/callback'], ['/alias/../' + path.slice(1)], [path + '&code=another'], [path + '&error=denied'],
    ['/callback?state=wrong&code=synthetic-code'], [path + '&access_token=synthetic']
  ]) assert((await request(target,host,method)).status >= 400);
  const finished = once(server,'close');
  const response = await request(path);
  assert.equal(response.status,200);
  assert.equal(response.headers['cache-control'],'no-store');
  assert.equal(response.headers['referrer-policy'],'no-referrer');
  assert.match(response.headers['content-security-policy'],/frame-ancestors 'none'/);
  assert(!response.body.includes('synthetic-code'));
  assert(!response.body.includes('A'.repeat(43)));
  await finished;
  await assert.rejects(request(path));
  for (const hasOpener of [true,false]) {
    const messages = [], copied = [];
    let expire;
    const page = new JSDOM(response.body, {
      url:'http://' + address + path, runScripts:'dangerously',
      beforeParse(w) {
        w.opener = hasOpener ? {postMessage(...args) { messages.push(args); }} : null;
        w.setTimeout = (fn, ms) => { assert.equal(ms,30000); expire = fn; };
        Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value => copied.push(value)}});
      }
    });
    try {
      const w = page.window;
      assert.equal(w.location.search,'');
      assert.equal(messages.length, hasOpener ? 1 : 0);
      if (hasOpener) {
        const [message, target] = messages[0];
        assert.equal(target,'https://www.nicovideo.jp');
        assert.equal(message.type,'zenza-x-oauth-complete');
        assert.equal(message.url,'http://' + address + path);
      }
      w.document.querySelector('button').click();
      assert.deepEqual(copied,['http://' + address + path]);
      expire();
      assert(w.document.querySelector('button').disabled);
      assert.equal(w.document.querySelector('input').value,'');
    } finally { page.window.close(); }
  }
});

test('relays denial and expires an idle receiver', async () => {
  const receiver = startReceiver();
  await once(receiver,'listening');
  const closed = once(receiver,'close');
  const denied = await request('/callback?state=' + 'a'.repeat(43) + '&error=access_denied');
  assert.equal(denied.status,200);
  await closed;
  const idle = startReceiver(25);
  await once(idle,'close');
  await assert.rejects(request(path));
});

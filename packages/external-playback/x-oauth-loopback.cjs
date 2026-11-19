'use strict';

// Standalone companion for the optional X OAuth 2.0 public-client flow.
const http = require('node:http');
const {createHash} = require('node:crypto');

const port = 48765;
const host = '127.0.0.1';
const authority = host + ':' + port;
const path = '/callback';

function relay() {
  const field = document.querySelector('input');
  const copy = document.querySelector('button');
  const status = document.querySelector('[role=status]');
  field.value = location.origin + location.pathname + location.search;
  history.replaceState(null, '', location.pathname);
  try {
    window.opener?.postMessage({type:'zenza-x-oauth-complete', url:field.value}, 'https://www.nicovideo.jp');
  } catch (_) { /* Manual completion also works when browsers isolate the opener. */ }
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = 'コピーしました。共有画面に貼り付けて連携を完了してください。';
    } catch (_) {
      field.focus();
      field.select();
      status.textContent = '選択したURLをコピーして、共有画面へ貼り付けてください。';
    }
  };
  setTimeout(() => {
    field.value = '';
    copy.disabled = true;
    status.textContent = '認可URLの表示を終了しました。未連携の場合は受信ツールを再起動し、Xで再度認可してください。';
  }, 30000);
}
// HTML parsers normalize line endings before validating the script hash.
const script = '(' + relay.toString().replace(/\r\n?/g, '\n') + ')()';
const hash = createHash('sha256').update(script).digest('base64');
const page = `<!doctype html><html lang="ja"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>X連携を完了する</title>
<h1>X連携を完了する</h1><p>元のZenzaWatch共有画面を確認してください。連携済みなら、このタブを閉じられます。</p>
<p>画面が切り替わらない場合は、下のURLをコピーし、共有画面の「認可後に画面が切り替わらない場合」に貼り付けて30秒以内に連携を完了してください。</p>
<label>今回の認可URL <input readonly spellcheck="false" autocomplete="off"></label>
<button type="button">認可URLをコピー</button><p role="status"></p>
<script>${script}</script></html>`;

function validQuery(query) {
  const params = new URLSearchParams(query);
  const permitted = ['state','code','error','error_description','error_uri','iss'];
  for (const name of params.keys()) {
    if (!permitted.includes(name) || params.getAll(name).length !== 1) return false;
  }
  return /^[A-Za-z0-9_-]{43}$/.test(params.get('state') || '') &&
    params.has('code') !== params.has('error') && Boolean(params.get('code') || params.get('error'));
}

function startReceiver(timeoutMs = 10 * 60 * 1000) {
  let consumed = false;
  const server = http.createServer({maxHeaderSize:16384}, (req, res) => {
    const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'Connection':'close',
      'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'sha256-" + hash + "'"};
    const reject = status => { res.writeHead(status, headers); res.end(); };
    if (req.headersDistinct.host?.length !== 1 || req.headers.host !== authority) return reject(400);
    if (req.method !== 'GET') return reject(405);
    if (!req.url.startsWith(path + '?')) return reject(404);
    if (req.headers['sec-fetch-dest'] && req.headers['sec-fetch-dest'] !== 'document') return reject(403);
    if (!validQuery(req.url.slice(path.length + 1))) return reject(400);
    if (consumed) return reject(410);
    consumed = true;
    server.close();
    res.once('finish', () => server.closeAllConnections());
    res.writeHead(200, {...headers, 'Content-Type':'text/html; charset=utf-8'});
    res.end(page);
  });
  server.on('clientError', (_error, socket) => socket.destroy());
  const timer = setTimeout(() => {
    consumed = true;
    server.close();
    server.closeAllConnections();
  }, timeoutMs);
  timer.unref();
  server.once('close', () => clearTimeout(timer));
  server.listen(port, host);
  return server;
}

if (require.main === module) {
  const server = startReceiver();
  server.once('listening', () => console.log('Xの認可結果を10分間待ちます。元の共有画面で「Xで連携を許可」を選んでください。'));
  server.once('error', err => {
    console.error(err.code === 'EADDRINUSE' ? '受信ポート48765は使用中です。既に起動した受信ツールを確認してください。' :
      '認可結果の受信を開始できませんでした。');
    process.exitCode = 1;
  });
}
module.exports = {startReceiver};

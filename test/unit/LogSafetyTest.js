// Task 088（監査v2 ZW-056）: 通常のログ（console）に、投稿本文・キー・トークン・ユーザーID が出ないことの回帰テスト。
// 修正前は、コメント投稿・ニコる・削除の送信内容（postKey・本文等）、スレッドの読み込み（threadKey）、
// スレッド情報（userId）、ゲートの「invalid token」（双方のトークン）をそのまま console に出していた。
// 合成の秘密の文字列を各入力へ入れて実際に動かし、console に渡った値のどこにも原文が無いことを確かめる。
// あわせて、ソース全体で「秘密の名前の変数を console にそのまま渡している」箇所が無いことを構文から確かめる。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {REPO_ROOT} = require('../helpers/buildSandbox');
const {beginSection, createContext, run, read} = require('../helpers/extractSource');

const SECRETS = {
  postKey: 'SYNTH-POSTKEY-7f3a',
  threadKey: 'SYNTH-THREADKEY-91c2',
  retryThreadKey: 'SYNTH-THREADKEY-RETRY-55aa',
  nicoruKey: 'SYNTH-NICORUKEY-0b1e',
  deleteKey: 'SYNTH-DELETEKEY-c4d5',
  text: 'SYNTH-BODY-こんにちは-8e9f',
  command: 'SYNTH-COMMAND-private-55ef',
  userId: 'SYNTH-USERID-123456',
  token: 'SYNTH-GATE-TOKEN-abcd'
};

function captureConsole() {
  const calls = [];
  const rec = kind => (...args) => calls.push({kind, args});
  const con = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug', 'trace']) { con[k] = rec(k); }
  con.time = con.timeEnd = con.timeLog = con.group = con.groupEnd = () => {};
  const dump = () => calls.map(c => c.args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a, (k, v) => (v instanceof URL ? v.toString() : v)); } catch (e) { return String(a); }
  }).join(' ')).join('\n');
  return {con, calls, dump};
}

function threadLoaderSubject() {
  const {con, dump, calls} = captureConsole();
  const requests = [];
  let failFirstLoad = true;
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    requests.push({url: u, opts});
    const json = body => ({json: async () => body});
    if (u.includes('/v1/comment/keys/post')) { return json({meta: {status: 200}, data: {postKey: SECRETS.postKey, challenge: {isRequired: true, siteKey: 'synthetic-site-key', challengeToken: SECRETS.token}}}); }
    if (u.includes('/v1/comment/keys/nicoru')) { return json({meta: {status: 200}, data: {nicoruKey: SECRETS.nicoruKey}}); }
    if (u.includes('/v1/comment/keys/delete')) { return json({meta: {status: 200}, data: {deleteKey: SECRETS.deleteKey}}); }
    if (u.includes('/v1/comment/keys/thread')) { return json({meta: {status: 200}, data: {threadKey: SECRETS.retryThreadKey}}); }
    if (/\/v1\/threads$/.test(u)) {
      if (failFirstLoad) {
        failFirstLoad = false;
        return json({meta: {status: 400, errorCode: 'EXPIRED_TOKEN', threadKey: SECRETS.threadKey}});
      }
      return json({meta: {status: 200}, data: {globalComments: [{count: 1}], threads: [{id: '1', fork: 'main', commentCount: 1, comments: [{body: SECRETS.text, userId: SECRETS.userId}]}]}});
    }
    if (/\/comments$/.test(u)) { return json({meta: {status: 200}, data: {no: 1, id: 'c1'}}); }
    if (/\/nicorus$/.test(u)) { return json({meta: {status: 200}, data: {nicoruId: 'n1', nicoruCount: 1}}); }
    if (/comment-owner-deletions$/.test(u)) { return json({meta: {status: 200}}); }
    throw new Error(`unexpected ${u}`);
  };
  const sleep = Object.assign(() => Promise.resolve(), {promise: () => Promise.resolve()});
  const c = createContext({
    console: con,
    netUtil: {fetch},
    sleep,
    PopupMessage: {alert: () => {}, notify: () => {}, debug: () => {}},
    debug: {}
  });
  c.window.console = con;
  const logSafeFile = path.join(REPO_ROOT, 'packages/lib/src/infra/logSafe.js');
  if (fs.existsSync(logSafeFile)) { run(beginSection('packages/lib/src/infra/logSafe.js'), c); }
  run(`const debug = {};\n${beginSection('packages/lib/src/nico/ThreadLoader.js').replace(/^\s*\/\/@require logSafe\s*$/m, '')}; globalThis.ThreadLoader = ThreadLoader;`, c);
  const msgInfo = {
    videoId: 'sm9', userId: SECRETS.userId, threadId: '1', language: 'ja-jp', when: 0,
    defaultThread: {is184Forced: false},
    threads: [{id: 1, forkLabel: 'main'}],
    nvComment: {server: 'https://public.nvcomment.nicovideo.jp', threadKey: SECRETS.threadKey, params: {language: 'ja-jp', targets: []}}
  };
  return {loader: c.ThreadLoader, msgInfo, dump, calls, requests};
}

// console.xxx(...) の引数の中に、秘密の名前の変数・プロパティがそのまま入っている所を探す
const SECRET_NAME = /(token|postkey|threadkey|nicorukey|deletekey|csrf|cookie|authorization|password|secret)/i;

function walk(dir) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) { return []; }
  return fs.readdirSync(abs, {withFileTypes: true}).flatMap(e => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (e.name.endsWith('.js') ? [rel] : []);
  });
}

function findSecretLogs(files) {
  const found = [];
  for (const rel of files) {
    const text = read(rel);
    let ast;
    try { ast = parser.parse(text, {sourceType: 'unambiguous', plugins: ['classProperties', 'optionalChaining']}); } catch (e) { continue; }
    traverse(ast, {
      CallExpression(p) {
        const callee = p.node.callee;
        if (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression') { return; }
        const obj = callee.object;
        const isConsole = (obj.type === 'Identifier' && obj.name === 'console') ||
          (obj.type === 'MemberExpression' && obj.property && obj.property.name === 'console');
        if (!isConsole) { return; }
        for (const argPath of p.get('arguments')) {
          argPath.traverse({
            CallExpression(q) {
              const c2 = q.node.callee;
              if (c2.type === 'MemberExpression' && c2.object.name === 'logSafe') { q.skip(); }
            },
            Identifier(q) {
              const parent = q.parent;
              // オブジェクトのキー（{token: ...} の token）は名前だけなので対象外。値として使われている識別子を見る
              if (parent.type === 'ObjectProperty' && parent.key === q.node && !parent.computed && !parent.shorthand) { return; }
              // 比べた結果（true/false）や、有無（!x）だけなら値は出ない
              if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) { return; }
              if (parent.type === 'UnaryExpression' && parent.operator === '!') { return; }
              if (SECRET_NAME.test(q.node.name)) {
                found.push(`${rel}:${q.node.loc.start.line} ${q.node.name}`);
              }
            }
          });
        }
      }
    });
  }
  return [...new Set(found)];
}

describe('通常のログに秘密の値・個人の情報を出さない（ZW-056）', function() {
  this.timeout(30000);

  it('コメントの読み込み（再試行でスレッドキーを取り直す経路を含む）で、threadKey・userId・コメント本文がログに出ない', async function() {
    const s = threadLoaderSubject();
    const r = await s.loader.load(s.msgInfo);
    assert.ok(r.threadInfo, '読み込みは成功する');
    const log = s.dump();
    assert.ok(s.calls.length > 0, 'ログは出る（処理の段階は分かる）');
    for (const k of ['threadKey', 'retryThreadKey', 'userId', 'text']) {
      assert.ok(!log.includes(SECRETS[k]), `${k} の原文がログに残っている:\n${log}`);
    }
    // 送信そのものには本物の値を使っている（ログだけを伏せる）
    assert.ok(s.requests.some(q => String(q.opts.body || '').includes(SECRETS.retryThreadKey)));
  });

  it('コメント投稿・ニコる・削除で、postKey・nicoruKey・deleteKey・本文がログに出ない（送信内容は変わらない）', async function() {
    const s = threadLoaderSubject();
    await s.loader.load(s.msgInfo);
    const posted = await s.loader.postChat(s.msgInfo, SECRETS.text, SECRETS.command, 12.3);
    assert.equal(posted.status, 'ok');
    const nicoru = await s.loader.nicoru(s.msgInfo, {text: SECRETS.text, fork: 0, no: 1});
    assert.equal(nicoru.status, 'ok');
    const deleted = await s.loader.deleteChat(s.msgInfo, {fork: 0, no: 1});
    assert.equal(deleted.status, 'ok');
    const log = s.dump();
    assert.ok(log.includes('[ZenzaWatch][CommentPost]'), '構造化された投稿診断ログが出る');
    for (const k of ['postKey', 'nicoruKey', 'deleteKey', 'text', 'command', 'userId', 'token']) {
      assert.ok(!log.includes(SECRETS[k]), `${k} の原文がログに残っている:\n${log}`);
    }
    const bodies = s.requests.map(q => String(q.opts.body || '')).join('\n');
    for (const k of ['postKey', 'nicoruKey', 'deleteKey', 'text', 'command']) {
      assert.ok(bodies.includes(SECRETS[k]), `${k} が送信内容から消えている`);
    }
  });

  it('ゲートの「invalid token」のログに、受け取ったトークン・自分のトークンが出ない', function() {
    const {con, dump} = captureConsole();
    const c = createContext({console: con, PRODUCT: 'ZenzaWatch', location: {href: 'https://www.nicovideo.jp/'}});
    c.window.console = con;
    run(beginSection('packages/lib/src/Emitter.js'), c);
    const src = read('packages/lib/src/infra/CrossDomainGate.js');
    const token = (src.match(/const TOKEN = '([^']+)'/) || [])[1];
    run(`const TOKEN = ${JSON.stringify(token)};\n${beginSection('packages/lib/src/infra/CrossDomainGate.js')}; globalThis.CrossDomainGate = CrossDomainGate;`, c);
    const gate = new c.CrossDomainGate({baseUrl: 'https://x.nicovideo.jp/', type: 'test'});
    gate._onMessage({data: {id: 'ZenzaWatch', type: 'test', token: SECRETS.token, body: {command: 'x'}}});
    const log = dump();
    assert.ok(/invalid token/.test(log), log);
    assert.ok(!log.includes(SECRETS.token), log);
    assert.ok(!log.includes(`"${token}"`), log);
  });

  it('logSafe.redact: 入れ子・配列・JSON の文字列の中の秘密の値を伏せ、元の値は変えない', function() {
    const c = createContext({});
    run(`${beginSection('packages/lib/src/infra/logSafe.js')}; globalThis.logSafe = logSafe;`, c);
    const v = {a: {postKey: SECRETS.postKey, list: [{authorization: 'Bearer x', cookie: 'c=1'}]}, videoId: 'sm9',
      packet: JSON.stringify({body: SECRETS.text, threadKey: SECRETS.threadKey, no: 3})};
    const r = c.logSafe.redact(v);
    const s = JSON.stringify(r);
    for (const k of ['postKey', 'text', 'threadKey']) { assert.ok(!s.includes(SECRETS[k]), s); }
    assert.ok(!s.includes('Bearer x') && !s.includes('c=1'), s);
    assert.ok(s.includes('sm9') && s.includes('"no\\":3'), s);
    assert.equal(v.a.postKey, SECRETS.postKey, '元の値は変えない');
  });

  it('ソース全体: 秘密の名前（token・postKey・threadKey・csrf・cookie 等）の値を console にそのまま渡していない', function() {
    const files = [
      ...walk('src').filter(f => !f.startsWith('src/yomi/') && f !== 'src/_my4.js'),
      ...fs.readdirSync(path.join(REPO_ROOT, 'packages')).flatMap(p => walk(`packages/${p}/src`))
    ];
    assert.deepEqual(findSecretLogs(files), []);
  });
});

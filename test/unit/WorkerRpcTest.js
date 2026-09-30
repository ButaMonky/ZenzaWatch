// Task 089（監査v2 R03: ZW-061〜064）: workerUtil.createCrossMessageWorker の要求と応答の回帰テスト。
// Worker は test/helpers/workerHarness.js の「Node の上の Worker に近い偽物」で動かす（生成コードは本物をそのまま実行する）。
// 実 Chromium でのオフライン確認は docs/design-pack/97_TASK_089_R03.md に記録する。
import assert from 'power-assert';

const {createWorkerHost, sleep, track, unansweredRequests} = require('../helpers/workerHarness');

// 受け取った値を、指定の時間だけ待ってから返す Worker
// 期限つきで待つ（期限を過ぎたら 'timeout'）
const within = (p, ms) => Promise.race([p.then(v => ({ok: true, v}), e => ({ok: false, e})), sleep(ms).then(() => 'timeout')]);

const echoAfterDelay = function(self) {
  self.onmessage = async ({params}) => {
    await new Promise(r => setTimeout(r, params.delay || 0));
    return params.value;
  };
};

describe('Worker の要求と応答（R03）', function() {
  this.timeout(20000);
  let host;
  afterEach(() => {
    const unhandled = host ? host.unhandled.map(String) : [];
    host && host.dispose();
    host = null;
    assert.deepEqual(unhandled, [], '未処理の reject が起きていない');
  });

  describe('ZW-061: 要求IDを Worker インスタンスごとに分ける', function() {
    it('同じ名前の Worker 2つへ別の値を送り、応答の順が逆になっても、それぞれに自分の値が一度だけ返る', async function() {
      host = createWorkerHost();
      const {workerUtil} = host;
      // 監査のプローブ（BROWSER-WORKER-COLLISION）と同じ順（A が先に終わる）と、その逆の両方
      for (const [delayA, delayB] of [[10, 80], [80, 10]]) {
        const a = workerUtil.createCrossMessageWorker(echoAfterDelay, {name: 'RepeatedName'});
        const b = workerUtil.createCrossMessageWorker(echoAfterDelay, {name: 'RepeatedName'});
        await sleep(50);
        const ra = track(a.post({command: 'echo', params: {value: 'A', delay: delayA}}));
        const rb = track(b.post({command: 'echo', params: {value: 'B', delay: delayB}}));
        await sleep(250);
        const label = `A:${delayA}ms B:${delayB}ms`;
        assert.deepEqual({a: ra.state, b: rb.state, label}, {a: 'resolved', b: 'resolved', label});
        assert.deepEqual({a: ra.value, b: rb.value, label}, {a: 'A', b: 'B', label});
        assert.equal(ra.settleCount + rb.settleCount, 2);
      }
    });

    it('同名・異名の Worker 10個へ、それぞれ3回ずつ（後に送った方が先に終わる順で）送っても、取り違えない', async function() {
      host = createWorkerHost();
      const {workerUtil} = host;
      const list = [];
      for (let i = 0; i < 10; i++) {
        list.push(workerUtil.createCrossMessageWorker(echoAfterDelay, {name: i % 2 ? 'Same' : `Other${i}`}));
      }
      await sleep(50);
      const results = [];
      list.forEach((w, i) => {
        for (let j = 0; j < 3; j++) {
          results.push({expect: `${i}-${j}`, r: track(w.post({command: 'echo', params: {value: `${i}-${j}`, delay: 60 - j * 20 - i}}))});
        }
      });
      await sleep(300);
      for (const {expect, r} of results) {
        assert.equal(r.state, 'resolved', expect);
        assert.equal(r.value, expect);
        assert.equal(r.settleCount, 1);
      }
    });

    it('Worker の中から、同じ種類（MessageChannel）の2つの port へ同時に送っても、それぞれに自分の応答が返る', async function() {
      host = createWorkerHost();
      const {workerUtil} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) {
        self.onmessage = async ({command}) => {
          if (command !== 'askBoth') { return null; }
          // eslint-disable-next-line no-undef
          const [first, extra] = await Promise.all([portMap.MessageChannel.post({command: 'ping', params: {}}), portMap.Extra.post({command: 'question', params: {}})]);
          return {first: first && typeof first.now === 'number' ? 'pong' : first, extra};
        };
      }, {name: 'PortWorker'});
      // もう1つの port の相手は、テストが手で応答する（少し遅らせて、応答の順を逆にする）
      const ch = new MessageChannel();
      ch.port1.addEventListener('message', e => {
        const {body, sessionId} = e.data;
        if (body.command === 'commandResult') { return; }
        setTimeout(() => ch.port1.postMessage({body: {command: 'commandResult', params: {command: body.command, result: 'extra-reply'}}, sessionId, status: 'ok'}), 30);
      });
      ch.port1.start();
      w.addPort(ch.port2, {name: 'Extra'}).catch(() => {});
      await sleep(80);
      const r = track(w.post({command: 'askBoth', params: {}}, {timeout: 1000}));
      await sleep(250);
      ch.port1.close();
      assert.equal(r.state, 'resolved', String(r.value && r.value.message));
      assert.deepEqual(r.value, {first: 'pong', extra: 'extra-reply'});
    });

    it('同じ名前の片方を止めても、もう片方の要求は自分の値で完了する', async function() {
      host = createWorkerHost();
      const {workerUtil} = host;
      const a = workerUtil.createCrossMessageWorker(echoAfterDelay, {name: 'RepeatedName'});
      const b = workerUtil.createCrossMessageWorker(echoAfterDelay, {name: 'RepeatedName'});
      await sleep(50);
      const ra = track(a.post({command: 'echo', params: {value: 'A', delay: 100}}));
      a.terminate();
      const rb = track(b.post({command: 'echo', params: {value: 'B', delay: 10}}));
      await sleep(200);
      assert.equal(rb.state, 'resolved');
      assert.equal(rb.value, 'B');
      assert.notEqual(ra.value, 'B');
    });
  });

  describe('ZW-062: 応答の要らない通知と、応答の要る要求（ACK）を分ける', function() {
    it('env（設定の受け渡し）は応答の要らない通知として送り、要求ID付きで送ったものには必ず応答が返る', async function() {
      host = createWorkerHost({withEnv: true, product: 'ZenzaWatch'});
      const {workerUtil, workers} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) {
        // eslint-disable-next-line no-undef
        self.onmessage = () => ({product: PRODUCT, hasConfig: typeof config === 'object'});
      }, {name: 'EnvWorker'});
      const r = await within(w.post({command: 'whoami', params: {}}), 1000);
      await sleep(50);
      assert.ok(r !== 'timeout' && r.ok, '通常の要求は完了する');
      assert.deepEqual(r.v, {product: 'ZenzaWatch', hasConfig: true}, 'env は Worker に届いている');
      const fake = workers[workers.length - 1];
      const env = fake.sent.filter(m => m.command === 'env');
      assert.equal(env.length, 1);
      assert.equal(env[0].sessionId, undefined, 'env に要求IDを付けない（応答を待たない）');
      assert.deepEqual(unansweredRequests(fake), [], '応答の返らない要求が残っていない');
    });

    it('addPort（port の受け渡し）は、Worker の中で使える状態になった時に応答（ACK）が返り、有限時間で完了する', async function() {
      host = createWorkerHost({withEnv: true});
      const {workerUtil, workers} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) {
        self.onmessage = ({command}) => {
          // eslint-disable-next-line no-undef
          if (command === 'hasPort') { return Object.keys(portMap).sort(); }
          return null;
        };
      }, {name: 'PortAckWorker'});
      const ch = new MessageChannel();
      const r = await within(w.addPort(ch.port2, {name: 'Extra'}), 1000);
      ch.port1.close();
      assert.ok(r !== 'timeout', 'addPort が完了しない');
      assert.ok(r.ok, String(r.e && r.e.message));
      const ports = await w.post({command: 'hasPort', params: {}});
      assert.deepEqual(ports, ['Extra', 'MessageChannel']);
      await sleep(30);
      assert.deepEqual(unansweredRequests(workers[workers.length - 1]), []);
    });

    it('bridge（Worker どうしを繋ぐ）が有限時間で完了し、繋いだ port で Worker どうしが要求・応答できる', async function() {
      host = createWorkerHost();
      const {workerUtil, workers} = host;
      const fn = function(self) {
        self.onmessage = async ({command, params}) => {
          if (command === 'askPeer') {
            // eslint-disable-next-line no-undef
            return portMap[params.peer].post({command: 'hello', params: {from: self.name}});
          }
          if (command === 'hello') { return `hello ${params.from}, from ${self.name}`; }
          return null;
        };
      };
      const a = workerUtil.createCrossMessageWorker(fn, {name: 'BridgeA'});
      const b = workerUtil.createCrossMessageWorker(fn, {name: 'BridgeB'});
      const r = await within(a.bridge(b), 1000);
      assert.ok(r !== 'timeout', 'bridge が完了しない');
      assert.ok(r.ok, String(r.e && r.e.message));
      const x = await within(a.post({command: 'askPeer', params: {peer: 'BridgeB'}}), 1000);
      assert.ok(x !== 'timeout' && x.ok);
      assert.equal(x.v, 'hello BridgeA, from BridgeB');
      await sleep(30);
      for (const f of workers) { assert.deepEqual(unansweredRequests(f), []); }
    });

    it('BroadcastChannel の受け渡しは応答の要らない通知として送り、未処理の reject も起きない', async function() {
      host = createWorkerHost({withEnv: true});
      const {workerUtil, workers} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) { self.onmessage = () => 'ok'; }, {name: 'BcastWorker'});
      const name = w.BroadcastChannel('ZenzaAuditBcast');
      assert.equal(typeof name, 'string');
      await sleep(80);
      const fake = workers[workers.length - 1];
      const b = fake.sent.filter(m => m.command === 'broadcast');
      assert.equal(b.length, 1);
      assert.equal(b[0].sessionId, undefined, 'broadcast に要求IDを付けない');
      assert.deepEqual(unansweredRequests(fake), []);
      assert.deepEqual(host.unhandled.map(String), []);
      w.terminate();
    });

    it('Worker の中で受け取った port は start() してから使う（addEventListener では自動で始まらないため。Node の MessagePort は自動で始まるので、ここではソースで確かめる）', function() {
      const src = require('fs').readFileSync(require('path').join(__dirname, '../../packages/lib/src/infra/workerUtil.js'), 'utf-8');
      const portCase = src.split("case 'port': {")[1].split("case 'broadcast'")[0];
      assert.ok(/port\.addEventListener\('message'/.test(portCase));
      assert.ok(/port\.start\s*&&\s*port\.start\(\)/.test(portCase), 'port.start() が無い');
    });

    it('接続（addPort・bridge）を繰り返しても、応答の返らない要求が増えない（未完了の数が0に戻る）', async function() {
      host = createWorkerHost({withEnv: true});
      const {workerUtil, workers} = host;
      const fn = function(self) { self.onmessage = () => 'ok'; };
      const list = [];
      for (let i = 0; i < 5; i++) {
        const a = workerUtil.createCrossMessageWorker(fn, {name: `LoopA${i}`});
        const b = workerUtil.createCrossMessageWorker(fn, {name: `LoopB${i}`});
        const r = await within(a.bridge(b), 1000);
        assert.ok(r !== 'timeout' && r.ok, `bridge ${i}`);
        list.push(a, b);
      }
      await sleep(50);
      for (const f of workers) { assert.deepEqual(unansweredRequests(f), []); }
      for (const w of list) { assert.equal(w.getRpcState().pending, 0, w.name); }
    });
  });

  describe('ZW-063: Worker の異常・終了・応答なしを、待っている要求の失敗として伝える', function() {
    const reasonOf = r => r.value && r.value.reason;

    it('生成コードの構文エラー（起動できない）: 待っている要求は失敗になり、以後の要求は送らずに失敗する', async function() {
      host = createWorkerHost();
      const {workerUtil, workers} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) { self.onmessage = () => 42; },
        {name: 'BrokenWorker', inject: 'this is ( not javascript'});
      const r = track(w.post({command: 'echo', params: {}}));
      await sleep(100);
      assert.equal(r.state, 'rejected');
      assert.equal(reasonOf(r), 'failed');
      const fake = workers[workers.length - 1];
      const before = fake.postCount;
      const r2 = track(w.post({command: 'echo', params: {}}));
      await sleep(20);
      assert.equal(r2.state, 'rejected');
      assert.equal(fake.postCount, before, '起動に失敗した Worker へ送らない');
      assert.equal(w.getRpcState().state, 'failed');
      assert.equal(w.getRpcState().pending, 0);
    });

    it('Worker の中の未捕捉の例外（error イベント）: その時に待っている要求は失敗になり、Worker 自体はその後も使える', async function() {
      host = createWorkerHost();
      const {workerUtil} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) {
        self.onmessage = ({command}) => {
          if (command === 'crash') {
            setTimeout(() => { throw new Error('synthetic worker failure'); }, 0);
            return new Promise(() => {});
          }
          return 'alive';
        };
      }, {name: 'CrashWorker'});
      let errorSeen = false;
      w.addEventListener('error', () => { errorSeen = true; });
      await sleep(30);
      const r = track(w.post({command: 'crash', params: {}}));
      await sleep(100);
      assert.ok(errorSeen);
      assert.equal(r.state, 'rejected');
      assert.equal(reasonOf(r), 'error');
      assert.equal(await w.post({command: 'echo', params: {}}), 'alive');
      assert.equal(w.getRpcState().pending, 0);
    });

    it('messageerror（受け取った内容を復元できない）: 待っている要求は失敗になる', async function() {
      host = createWorkerHost();
      const {workerUtil, workers} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) { self.onmessage = () => new Promise(() => {}); }, {name: 'MsgErrWorker'});
      await sleep(30);
      const r = track(w.post({command: 'hang', params: {}}));
      workers[workers.length - 1].simulateMessageError();
      await sleep(50);
      assert.equal(r.state, 'rejected');
      assert.equal(reasonOf(r), 'messageerror');
    });

    it('terminate（手動の終了）: 待っている要求は失敗になり、終了後の要求は送らずに失敗する。もう一方の Worker は影響を受けない', async function() {
      host = createWorkerHost();
      const {workerUtil, workers} = host;
      const a = workerUtil.createCrossMessageWorker(echoAfterDelay, {name: 'Same'});
      const b = workerUtil.createCrossMessageWorker(echoAfterDelay, {name: 'Same'});
      await sleep(30);
      const fakeA = workers[workers.length - 2];
      const ra = track(a.post({command: 'echo', params: {value: 'A', delay: 100}}));
      const rb = track(b.post({command: 'echo', params: {value: 'B', delay: 50}}));
      a.terminate();
      await sleep(10);
      assert.equal(ra.state, 'rejected');
      assert.equal(reasonOf(ra), 'terminated');
      assert.equal(fakeA.terminateCalls, 1, 'Worker 自体も止める');
      const before = fakeA.postCount;
      const ra2 = track(a.post({command: 'echo', params: {value: 'A2'}}));
      await sleep(100);
      assert.equal(ra2.state, 'rejected');
      assert.equal(fakeA.postCount, before, '終了した Worker へ送らない');
      assert.equal(rb.state, 'resolved');
      assert.equal(rb.value, 'B');
      assert.deepEqual(a.getRpcState(), Object.assign({}, a.getRpcState(), {state: 'disposed', pending: 0}));
      a.terminate();
      assert.equal(fakeA.terminateCalls, 1, '2回目の terminate は何もしない');
    });

    it('応答なし: 期限（Worker ごとの既定値・要求ごとの指定）を過ぎると失敗になり、期限の前に終われば失敗にならない', async function() {
      host = createWorkerHost();
      const {workerUtil} = host;
      const w = workerUtil.createCrossMessageWorker(function(self) {
        self.onmessage = async ({command, params}) => {
          if (command === 'hang') { return new Promise(() => {}); }
          await new Promise(r => setTimeout(r, params.delay));
          return 'done';
        };
      }, {name: 'HangWorker', requestTimeout: 120});
      await sleep(30);
      const byDefault = track(w.post({command: 'hang', params: {}}));
      const byRequest = track(w.post({command: 'hang', params: {}}, {timeout: 40}));
      const inTime = track(w.post({command: 'slow', params: {delay: 10}}));
      await sleep(80);
      assert.equal(byRequest.state, 'rejected');
      assert.equal(reasonOf(byRequest), 'timeout');
      assert.equal(byRequest.value.message, 'timeout', '以前と同じく message は timeout');
      assert.equal(byRequest.value.status, 'fail', '以前と同じく status は fail');
      assert.equal(byDefault.state, 'pending');
      assert.equal(inTime.state, 'resolved');
      await sleep(80);
      assert.equal(byDefault.state, 'rejected');
      assert.equal(reasonOf(byDefault), 'timeout');
      assert.equal(w.getRpcState().pending, 0);
    });

    it('既定の期限は、Worker の生成時に指定しなければ5分（300秒）', function() {
      const src = require('fs').readFileSync(require('path').join(__dirname, '../../packages/lib/src/infra/workerUtil.js'), 'utf-8');
      assert.ok(/DEFAULT_REQUEST_TIMEOUT\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(src), src.slice(0, 0));
    });
  });

  describe('ZW-064: 生成コードに入れる値（window.name・Worker の名前・PRODUCT・URL）をデータとして扱う', function() {
    const reportSelf = function(self) {
      // eslint-disable-next-line no-undef
      self.onmessage = () => ({NAME, PID, selfName: self.name, marker: typeof self.__zw064_marker});
    };
    const cases = [
      {label: '単一引用符（監査のプローブと同じ）', windowName: "audit'quoted"},
      {label: '二重引用符・逆斜線', windowName: 'a"b\\c\\\'d'},
      {label: '改行・復帰・行区切り文字', windowName: 'line1\nline2\r  end'},
      {label: 'Unicode（日本語・絵文字）', windowName: 'ニコニコ動画🎬'},
      {label: 'テンプレート文字列の記号', windowName: '`${1+1}`'},
      {label: 'コードに見える文字列（実行されないこと）', windowName: "x'; self.__zw064_marker = 1; '"}
    ];
    for (const c of cases) {
      it(`window.name: ${c.label} でも Worker が起動して通常の要求が完了し、値はそのまま届く`, async function() {
        host = createWorkerHost({windowName: c.windowName});
        const w = host.workerUtil.createCrossMessageWorker(reportSelf, {name: 'QuotedWindow'});
        const r = await within(w.post({command: 'echo', params: {}}), 1000);
        assert.ok(r !== 'timeout', '応答が無い');
        assert.ok(r.ok, String(r.e && r.e.message));
        assert.ok(r.v.PID.startsWith(`${c.windowName}:`), JSON.stringify(r.v.PID));
        assert.equal(r.v.marker, 'undefined', '文字列がコードとして実行されていない');
      });
    }

    it('Worker の名前（options.name）に引用符・逆斜線・改行・Unicode・コードに見える文字列があっても、名前がそのまま届く', async function() {
      host = createWorkerHost();
      const names = ["it's", 'a"b\\c', 'x\ny z', '動画🎬', "'); self.__zw064_marker = 1; ('", '`${0}`'];
      for (const name of names) {
        const w = host.workerUtil.createCrossMessageWorker(reportSelf, {name});
        const r = await within(w.post({command: 'echo', params: {}}), 1000);
        assert.ok(r !== 'timeout' && r.ok, JSON.stringify(name));
        assert.equal(r.v.NAME, name);
        assert.equal(r.v.marker, 'undefined');
      }
    });

    it('PRODUCT と URL（location.href）に引用符・逆斜線があっても Worker が起動する', async function() {
      host = createWorkerHost({product: "Zenza'Watch\\\n", href: "https://www.nicovideo.jp/watch/sm9?q=it's#a\\b"});
      const w = host.workerUtil.createCrossMessageWorker(reportSelf, {name: 'QuotedEnv'});
      const r = await within(w.post({command: 'echo', params: {}}), 1000);
      assert.ok(r !== 'timeout' && r.ok, String(r && r.e && r.e.message));
      assert.ok(r.v.PID.includes("https://www.nicovideo.jp/watch/sm9?q=it's#a\\b"), r.v.PID);
    });
  });
});

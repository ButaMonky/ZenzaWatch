import {netUtil} from './netUtil';
// import {globalEmitter} from '../../../../src/ZenzaWatchIndex';
import {Config} from '../../../../src/Config';
import {TOKEN, PRODUCT} from '../../../../src/ZenzaWatchIndex';
import {PopupMessage} from '../ui/PopupMessage';
import {EmitterInitFunc} from '../Emitter';
const PID = 'PID';
const bcast = {};
const portMap = {};
//===BEGIN===

const workerUtil = (() => {
  let config, TOKEN, PRODUCT = 'ZenzaWatch?', netUtil, CONSTANT, NAME = '';
  let global = null, external = null;
  // ZW-063: 応答が無い要求を失敗にするまでの既定の時間（Worker の生成時に requestTimeout、要求ごとに timeout で変えられる。0 で無期限）
  const DEFAULT_REQUEST_TIMEOUT = 5 * 60 * 1000;
  const isAvailable = !!(window.Blob && window.Worker && window.URL);

  const messageWrapper = function(self) {
    const _onmessage = self.onmessage || (() => {});
    const promises = {};
    // ZW-061: 要求IDの連番は Worker の中で1つ（同じ種類の port が複数あっても重ならない）
    let requestSeq = 0;
    const onMessage = async function(self, type, e) {
      const {body, sessionId, status} = e.data;
      const {command, params} = body;
      // console.log('onMessage', sessionId, {body, status});
      try {
        let result;
        switch (command) {
          case 'commandResult':
            if (promises[sessionId]) {
              if (status === 'ok') {
                promises[sessionId].resolve(params.result);
              } else {
                promises[sessionId].reject(new Error(params.result));
              }
              delete promises[sessionId];
            }
          return;
          case 'ping':
            result = {now: Date.now(), NAME, PID, url: location.href};
            // console.log('PONG "%s" %sms', params.NAME, Date.now() - params.now);
            break;
          case 'port': {
            // ZW-062: port は「使える状態になった」ことを応答（ACK）で返す
            const port = e.ports[0];
            portMap[params.name] = port;
            port.addEventListener('message', onMessage.bind({}, port, params.name));
            port.start && port.start();
            bindFunc(port, 'MessageChannel');
            result = {name: params.name};
            if (params.ping) {
              console.time('ping:' + sessionId);
              port.ping().then(result => {
                console.timeEnd('ping:' + sessionId);
                console.log('ok %smec', Date.now() - params.now, params);
              }).catch(err => {
                console.timeEnd('ping:' + sessionId);
                console.warn('ping fail', {err, data: e.data});
              });
            }
          }
            break;
          case 'broadcast': {
            if (!BroadcastChannel) { return; }
            const channel = new BroadcastChannel(`${params.name}`);
            channel.addEventListener('message', onMessage.bind({}, channel, 'BroadcastChannel'));
            bindFunc(channel, 'BroadcastChannel');
            bcast[params.basename] = channel;
          }
            return;
          case 'env':
            ({config, TOKEN, PRODUCT, CONSTANT} = params);
            return;
          default:
            result = await _onmessage({command, params}, type, PID);
            break;
          }
        // ZW-062: 要求ID の無いもの（通知）には応答しない
        if (sessionId === undefined || sessionId === null) { return; }
        self.postMessage({body:
          {command: 'commandResult', params:
            {command, result}}, sessionId, TYPE: type, PID, status: 'ok'
          });
      } catch(err) {
        console.error('failed', {err, command, params, sessionId, TYPE: type, PID, data: e.data});
        if (sessionId === undefined || sessionId === null) { return; }
        self.postMessage({body:
            {command: 'commandResult', params: {command, result: err.message || null}},
            sessionId, TYPE: type, PID, status: err.status || 'fail'
          });
      }
    };
    self.onmessage = onMessage.bind({}, self, self.name);

    self.onconnect = e => {
      const port = e.ports[0];
      port.onmessage = self.onmessage;
      port.start();
    };

    const bindFunc = (self, type = 'Worker') => {
      const post = function(self, body, options = {}) {
        const sessionId = `recv:${NAME}:${type}:${requestSeq++}`;
        return new Promise((resolve, reject) => {
          promises[sessionId] = {resolve, reject};
          self.postMessage({body, sessionId, PID}, options.transfer);
          if (typeof options.timeout === 'number') {
            setTimeout(() => {
              reject({status: 'fail', message: 'timeout'});
              delete promises[sessionId];
            }, options.timeout);
          }
        }).finally(() => { delete promises[sessionId]; });
      };
      const emit = function(self, eventName, data = null) {
        self.post({command: 'emit', params: {eventName, data}});
      };
      const notify = function(self, message) {
        self.post({command: 'notify', params: {message}});
      };
      const alert = function(self, message) {
        self.post({command: 'alert', params: {message}});
      };
      const ping = async function(self, options = {}) {
        const timekey = `PING "${self.name}"`;
        console.log(timekey);
        let result;
        options.timeout = options.timeout || 10000;
        try {
          console.time(timekey);
          result = await self.post({command: 'ping', params: {now: Date.now(), NAME, PID, url: location.href}}, options);
          console.timeEnd(timekey);
        } catch (e) {
          console.timeEnd(timekey);
          console.warn('ping fail', e);
        }
        return result;

        // return self.post({command: 'ping', params: {now: Date.now(), NAME, PID, url: location.href}}, options);
      };
      self.post = post.bind({sessionId: 0}, this.port || self);
      self.emit = emit.bind({}, self);
      self.notify = notify.bind({}, self);
      self.alert = alert.bind({}, self);
      self.ping = ping.bind({}, self);
      return self;
    };
    bindFunc(self);

    /**
     * @param {string} url
     * @param {object} options
     * @returns {Promise}
     */
    self.xFetch = async (url, options = {}) => {
      options = {...options, ...{signal: null}}; // remove AbortController
      if (url.startsWith(location.origin)) {
        return fetch(url, options);
      }
      const result = await self.post({command: 'fetch', params: {url, options}});
      const {buffer, init, headers} = result;
      const _headers = new Headers();
      (headers || []).forEach(a => _headers.append(...a));
      const _init = {
        status: init.status,
        statusText: init.statusText || '',
        headers: _headers
      };
      return new Response(buffer, _init);
    };
  };

  const workerUtil = {
    isAvailable,
    js: (q, ...args) => {
      const strargs = args.map(a => typeof a === 'string' ? a : a.toString);
      return String.raw(q, ...strargs);
    },
    env: params => {
      ({config, TOKEN, PRODUCT, netUtil, CONSTANT, global} =
        Object.assign({config, TOKEN, PRODUCT, netUtil, CONSTANT, global}, params));

      if (global) { ({config, TOKEN, PRODUCT, CONSTANT} = global); }
    },
    create: function(func, options = {}) {
      let cache = this.urlMap.get(func);
      const name = options.name || 'Worker';
      if (!cache) {
        // ZW-064: window.name・URL・名前・PRODUCT は文字列のリテラル（JSON.stringify）として入れる（値がコードの構文を変えない）
        const pid = `${window && window.name || 'self'}:${location.href}:${name}:${Date.now().toString(16).toUpperCase()}`;
        const src = `
        const PID = ${JSON.stringify(pid)};
        console.log('%cinit %s %s', 'font-weight: bold;', self.name || '', ${JSON.stringify(String(PRODUCT))}, location.origin);
        (${func.toString()})(self);
        `;
        const blob = new Blob([src], {type: 'text/javascript'});
        const url = URL.createObjectURL(blob);
        this.urlMap.set(func, url);
        cache = url;
      }

      if (options.type === 'SharedWorker') {
        const w = this.workerMap.get(func) || new SharedWorker(cache);
        this.workerMap.set(func, w);
        return w;
      }
      return new Worker(cache, options);
    }.bind({urlMap: new Map(), workerMap: new Map()}),


    /**
     * Promiseでやり取りできるworkerを生成する
     */
    createCrossMessageWorker: function(func, options = {}) {
      // ZW-061: 未完了の要求は、この Worker インスタンスの中だけで持つ。
      // 要求IDには、インスタンスの番号と、インスタンス内で1つの連番を入れる（同じ名前の Worker が複数あっても重ならない）
      const promises = {};
      const instanceId = this.instanceSeq++;
      let requestSeq = 0;
      const name = options.name || 'Worker';
      // ZW-063: Worker の状態。starting（起動中）→ ready（Worker から1度でも受信した）/ failed（起動できなかった）/ disposed（終了した）
      let state = 'starting';
      const requestTimeout = typeof options.requestTimeout === 'number' ? options.requestTimeout : DEFAULT_REQUEST_TIMEOUT;
      const rpcError = (reason, message) =>
        Object.assign(new Error(message || reason), {name: 'WorkerRpcError', status: 'fail', reason, workerName: name});
      const rejectAll = (reason, message) => {
        for (const id of Object.keys(promises)) {
          const p = promises[id];
          delete promises[id];
          p.reject(rpcError(reason, message));
        }
      };
      const closables = [];
      const PID = `${window && window.name || 'self'}:${location.host}:${name}:${Date.now().toString(16).toUpperCase()}`;

      const _func = `
      function (self) {
      let config = {}, PRODUCT, TOKEN, CONSTANT, NAME = ${JSON.stringify(String(name))}, bcast = {}, portMap = {};
      const {Handler, PromiseHandler, Emitter} = (${EmitterInitFunc.toString()})();
      ${options.inject ?? ''}
      (${func.toString()})(self);
      //===================================
      (${messageWrapper.toString()})(self);
      }
      `;
      const worker = workerUtil.create(_func, options);
      const self = options.type === 'SharedWorker' ? worker.port : worker;
      self.name = name;
      const onMessage = async function(self, e) {
        if (state === 'disposed') { return; }
        if (state === 'starting' || state === 'failed') { state = 'ready'; }
        const {body, sessionId, status} = e.data;
        const {command, params} = body;
        try {
          let result = 'ok';
          let transfer = null;
          switch (command) {
            case 'commandResult':
              if (promises[sessionId]) {
                if (status === 'ok') {
                  promises[sessionId].resolve(params.result);
                } else {
                  promises[sessionId].reject(new Error(params.result));
                }
                delete promises[sessionId];
              }
              return;
            case 'ping':
                result = {now: Date.now(), NAME, PID, url: location.href};
                console.timeLog && console.timeLog(params.NAME, 'PONG');
                // console.log('pong!: %sms', Date.now() - params.now, params);
                break;
            case 'emit':
              global && global.emitter.emitAsync(params.eventName, params.data);
              break;
            case 'fetch':
              result = await (netUtil || window).fetch(params.url,
                Object.assign({}, params.options || {}, {_format: 'arraybuffer'}));
              transfer = [result.buffer];
              break;
            case 'notify':
              global && global.notify(params.message);
              break;
            case 'alert':
              global && global.alert(params.message);
              break;
            default:
              self.oncommand && (result = await self.oncommand({command, params}));
              break;
          }
          if (sessionId === undefined || sessionId === null) { return; }
          self.postMessage({body: {command: 'commandResult', params: {command, result}}, sessionId, status: 'ok'}, transfer);
        } catch (err) {
          console.error('failed', {err, command, params, sessionId});
          if (sessionId === undefined || sessionId === null) { return; }
          self.postMessage({body: {command: 'commandResult', params: {command, result: err.message || null}}, sessionId, status: err.status || 'fail'});
        }
      };

      const bindFunc = (self, type = 'Worker') => {
        const post = function(self, body, options = {}) {
          // ZW-063: 起動に失敗した・終了した Worker へは送らずに失敗にする
          if (state === 'failed' || state === 'disposed') {
            return Promise.reject(rpcError(state === 'failed' ? 'failed' : 'terminated', `worker ${state}: ${name}`));
          }
          const sessionId = `send:${instanceId}:${name}:${type}:${requestSeq++}`;
          const timeout = typeof options.timeout === 'number' ? options.timeout : requestTimeout;
          let timer = null;
          return new Promise((resolve, reject) => {
              promises[sessionId] = {resolve, reject};
              self.postMessage({body, sessionId, TYPE: type, PID}, options.transfer);
              if (timeout > 0 && timeout < Infinity) {
                timer = setTimeout(() => {
                  if (!promises[sessionId]) { return; }
                  delete promises[sessionId];
                  reject(rpcError('timeout', 'timeout'));
                }, timeout);
              }
            }).finally(() => {
              timer && clearTimeout(timer);
              delete promises[sessionId];
            });
        };
        const ping = async function(self, options = {}) {
          const timekey = `PING "${self.name}" total time`;
          window.console.log(`PING "${self.name}"...`);
          let result;
          options.timeout = options.timeout || 10000;
          try {
          window.console.time(timekey);
          result = await self.post({command: 'ping', params: {now: Date.now(), NAME: self.name, PID, url: location.href}}, options);
          window.console.timeEnd(timekey);
          } catch (e) {
            console.timeEnd(timekey);
            console.warn('ping fail', e);
          }
          return result;
        };
        self.post = post.bind({sessionId: 0}, self);
        // ZW-062: 応答の要らない通知（要求IDを付けず、未完了の要求として持たない）
        self.send = (body, transfer) => self.postMessage({body, TYPE: type, PID}, transfer);
        self.ping = ping.bind({}, self);
        self.addEventListener('message', onMessage.bind({sessionId: 0}, self));
        // ZW-063: 受け取った内容を復元できなかった時は、どの要求への応答か分からないので、待っている要求を失敗にする
        self.addEventListener('messageerror', () => state !== 'disposed' && rejectAll('messageerror', `messageerror: ${name}`));
        self.start && self.start();
      };
      bindFunc(self);

      // ZW-063: Worker の error イベント（生成コードの構文エラー、Worker の中の未捕捉の例外）を、待っている要求の失敗として伝える。
      // 1度も受信しないうちの error は起動の失敗とみなす（以後の要求は送らない。後で受信があれば ready に戻す）。
      worker.addEventListener('error', e => {
        if (state === 'disposed') { return; }
        if (state === 'starting') { state = 'failed'; }
        rejectAll(state === 'failed' ? 'failed' : 'error', (e && e.message) || `worker error: ${name}`);
      });

      // ZW-063: 終了（terminate）で、待っている要求を失敗にし、繋いだ port 等を閉じる。以後の要求は送らない
      if (self === worker && typeof worker.terminate === 'function') {
        const terminate = worker.terminate.bind(worker);
        self.terminate = () => {
          if (state === 'disposed') { return; }
          state = 'disposed';
          rejectAll('terminated', `worker terminated: ${name}`);
          for (const c of closables.splice(0)) {
            try { c.close(); } catch (e) { /* 閉じられなくても続ける */ }
          }
          terminate();
        };
      }

      self.getRpcState = () => ({id: instanceId, name, state, pending: Object.keys(promises).length});

      if (config) {
        self.send({
          command: 'env',
          params: {config: config.export(true), TOKEN, PRODUCT, CONSTANT}
        });
      }

      self.addPort = (port, options = {}) => {
        const name = options.name || 'MessageChannel';
        return self.post({command: 'port', params: {port, name}}, {transfer: [port]});
      };
      const channel = new MessageChannel();
      self.addPort(channel.port2).catch(() => {});
      bindFunc(channel.port1, 'MessageChannel');
      closables.push(channel.port1);

      /**
       * Worker同士を繋げる
       * TODO: CrossDomainGate も対象にする
       */
      self.bridge = async (worker, options = {}) => {
        const name = options.name || 'MessageChannelBridge';
        const channel = new MessageChannel();
        // ZW-062: 両方の Worker から ACK が返った時点で完了（渡した port はこちらでは使えないので ping はしない）
        await self.addPort(channel.port1, {name: worker.name || name});
        await worker.addPort(channel.port2, {name: self.name || name});
      };

      self.BroadcastChannel = basename => {
        const name = `${basename || 'Broadcast'}${TOKEN || Date.now().toString(16)}`;
        self.send({command: 'broadcast', params: {basename, name}});
        const channel = new BroadcastChannel(name);
        bindFunc(channel, 'BroadcastChannel');
        closables.push(channel);

        return name;
      };

      self.ping()
        .catch(result => console.warn('FAIL', result));

      return self;
    }.bind({
      instanceSeq: 0
    })
  };
  return workerUtil;
})();
//===END===

export {workerUtil};

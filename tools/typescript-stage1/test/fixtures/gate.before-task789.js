const PRODUCT = 'ZenzaWatch';
import {workerUtil} from '../infra/workerUtil';
/*
post = {
  id: 'PRODUCT',
  type: 'nicovideoApi',
  token: 22222,
  sessionId: 11111,
  url: location.href,
  body: {command: 'hello', params: {}, status: 'ok'},
}
*/
//===BEGIN===
const gate = () => {

  const post = function(body, {type, token, sessionId, origin} = {}) {
    sessionId = sessionId || '';
    origin = origin || '';
    this.origin = origin = origin || this.origin || document.referrer;
    this.token = token = token || this.token;
    this.type = type = type || this.type;
    if (!this.channel) {
      this.channel = new MessageChannel;
    }
    const url = location.href;
    const id = PRODUCT;
    try {
      const msg = {id, type, token, url, sessionId, body};
      if (!this.port) {
        // console.info(`%c2. port connect [${window.name.split('#')[0]} ${PRODUCT}]`, 'background: #039393; color: gold; font-size: 120%;');
        msg.body = {command: 'initialized', params: msg.body};
        parent.postMessage(msg, origin, [this.channel.port2]);
        this.port = this.channel.port1;
        this.port.start();
      } else {
        this.port.postMessage(msg);
      }
    } catch (e) {
      console.error('%cError: parent.postMessage - ', 'color: red; background: yellow', e);
    }
    return this.port;
  }.bind({channel: null, port: null, origin: null, token: null, type: null});

  const parseUrl = url => {
    url = url || 'https://unknown.example.com/';
    const a = document.createElement('a');
    a.href = url;
    return a;
  };

  const isNicoServiceHost = url => {
    const host = parseUrl(url).hostname;
    return /(^[a-z0-9.-]*\.nicovideo\.jp$|^[a-z0-9.-]*\.nico(|:[0-9]+)$)/.test(host);
  };

  const isWhiteHost = url => {
    const u = parseUrl(url);
    const host = u.hostname;
    if (['account.nicovideo.jp', 'point.nicovideo.jp'].includes(host)) {
      return false;
    }
    if (isNicoServiceHost(url)) {
      return true;
    }
    if (['localhost', '127.0.0.1'].includes(host)) { return true; }
    if (localStorage.ZenzaWatch_whiteHost) {
      if (localStorage.ZenzaWatch_whiteHost.split(',').includes(host)) {
        return true;
      }
    }
    if (u.protocol !== 'https:') { return false; }
    return [
      'google.com',
      'www.google.com',
      'www.google.co.jp',
      'www.bing.com',
      'twitter.com',
      'friends.nico',
      'feedly.com',
      'www.youtube.com',
    ].includes(host) || host.endsWith('.slack.com');
  };

  const uFetch = async (params, consume = response => response) => {
    const {url, options: requestOptions = {}} = params;
    if (!isWhiteHost(url) || !isNicoServiceHost(url)) {
      return Promise.reject({status: 'fail', message: 'network error'});
    }
    const options = {...requestOptions};
    const callerSignal = options.signal;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abortReason = () => callerSignal.reason !== undefined ? callerSignal.reason :
      Object.assign(new Error('The operation was aborted'), {name: 'AbortError'});
    const timeout = (typeof options.timeout === 'number' && !isNaN(options.timeout)) ? options.timeout :
      (typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
    const racers = [];
    let timer;
    let onAbort;
    try {
      if (callerSignal && callerSignal.aborted) { throw abortReason(); }
      if (controller) { options.signal = controller.signal; }
      if (callerSignal) {
        racers.push(new Promise((resolve, reject) => {
          onAbort = () => {
            const reason = abortReason();
            reject(reason);
            if (controller) { controller.abort(reason); }
          };
          callerSignal.addEventListener('abort', onAbort, {once: true});
        }));
      }
      if (timeout > 0) {
        racers.push(new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            const error = Object.assign(new Error('timeout'), {name: 'timeout'});
            reject(error);
            if (controller) { controller.abort(error); }
          }, timeout);
        }));
      }
      racers.push(fetch(url, options).then(consume));
      return await Promise.race(racers);
    } catch (err) {
      throw {status: 'fail', message: err && err.name === 'timeout' ? 'timeout' : 'uFetch fail'};
    } finally {
      if (timer !== undefined) { clearTimeout(timer); }
      if (callerSignal && onAbort) { callerSignal.removeEventListener('abort', onAbort); }
    }
  };

  const fetchSessions = new Map();
  const xFetch = (params, sessionId = null) => {
    const command = 'fetch';
    const controller = new AbortController();
    fetchSessions.set(sessionId, controller);
    const request = {...params, options: {...params.options, signal: controller.signal}};
    return uFetch(request, async resp => {
      const buffer = await resp.arrayBuffer();
      const init = ['type', 'url', 'redirected', 'status', 'ok', 'statusText']
          .reduce((map, key) => {map[key] = resp[key]; return map;}, {});
      const headers = [...resp.headers.entries()];
      return {buffer, init, headers};
    }).then(({buffer, init, headers}) => {
      const result = {status: 'ok', command, params: {buffer, init, headers}};
      post(result, {sessionId});
      return result;
    }).catch(({status, message}) => {
      post({status, message, command}, {sessionId});
    }).finally(() => {
      if (fetchSessions.get(sessionId) === controller) { fetchSessions.delete(sessionId); }
    });
  };


  const init = ({prefix, type}) => {
    if (!window.name.startsWith(prefix)) {
      throw new Error(`unknown name "${window.name}"`);
    }
    const PID = `${window && window.name || 'self'}:${location.host}:${name}:${Date.now().toString(16).toUpperCase()}`;
    // console.info(`%c1. port open [${window.name.split('#')[0]} ${PRODUCT}]`, 'background: #039393; color: gold; font-size: 120%;');

    type = type || window.name.replace(new RegExp(`/(${PRODUCT}|)Loader$/`), '');
    const origin = document.referrer || window.name.split('#')[1];
    console.log('%cCrossDomainPort: host:%s window:%s', 'background: lightgreen;', location.host, window.name.split('#')[0]);

    if (!isWhiteHost(origin)) {
      throw new Error(`disable bridge "${origin}"`);
    }

    const TOKEN = location.hash ? location.hash.substring(1) : null;
    window.history.replaceState(null, null, location.pathname);
    const port = post({status: 'ok', command: 'initialized'}, {type, token: TOKEN, origin});
    port.addEventListener('message', event => {
      let data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
      catch (_) { return; }
      if (!data || data.token !== TOKEN || !data.body || data.body.command !== 'cancelFetch') { return; }
      event.stopImmediatePropagation();
      const controller = fetchSessions.get(data.body.params && data.body.params.sessionId);
      if (controller) { controller.abort(); }
    });
    workerUtil && workerUtil.env({TOKEN, PRODUCT});
    // console.info(`%c3. port init OK [${window.name.split('#')[0]} ${PRODUCT}]`, 'background: #039393; color: gold; font-size: 120%;');
    return {port, TOKEN, origin, type, PID};
  };

  return {post, parseUrl, isNicoServiceHost, isWhiteHost, uFetch, xFetch, init};
};

//===END===
export {gate};

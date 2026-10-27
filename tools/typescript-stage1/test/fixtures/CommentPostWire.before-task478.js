import {netUtil} from '../infra/netUtil';

//===BEGIN===
const CommentPostWire = (() => {
  // Task478: isolated posting transport; does not retry a possibly-accepted POST.
  const POST_TIMEOUT_MS = 30 * 1000;
  const safeStatusCode = value => {
    const status = Number(value);
    return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  };
  const fetchJsonWithin = async (url, options, timeoutMs = POST_TIMEOUT_MS) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let stage = 'headers';
    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        const kind = stage === 'headers' ? 'header-timeout' : 'body-timeout';
        const error = Object.assign(new Error(kind), {name: 'timeout', kind});
        reject(error);
        if (controller) { controller.abort(error); }
      }, timeoutMs);
    });
    deadline.catch(() => {});
    try {
      let res;
      try {
        res = await Promise.race([netUtil.fetch(url, {...options, timeout: timeoutMs, ...(controller ? {signal: controller.signal} : {})}), deadline]);
      } catch (e) {
        throw (e && e.kind) ? e : Object.assign(e instanceof Error ? e : new Error(String(e && e.message || e)), {kind: 'network'});
      }
      stage = 'body';
      try {
        return await Promise.race([res.json(), deadline]);
      } catch (error) {
        // HTTP status is only diagnostic metadata; never change outcome or retry behavior.
        const httpStatus = safeStatusCode(res && res.status);
        if (error && httpStatus !== undefined && error.httpStatus === undefined) {
          error.httpStatus = httpStatus;
        }
        throw error;
      }
    } finally {
      clearTimeout(timer);
    }
  };
  return {fetchJsonWithin};
})();
//===END===
export {CommentPostWire};

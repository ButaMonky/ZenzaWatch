'use strict';

// Only these fixed endpoints receive credentials from the userscript sandbox.
function createXRequest(xhr) {
  return function request(path, {method, headers, body, signal} = {}) {
    const allowed = method === 'GET'
      ? /^\/2\/(?:users\/me|media\/upload\?command=STATUS&media_id=\d{1,19})$/
      : /^\/2\/(?:oauth2\/(?:token|revoke)|tweets|media\/upload\/(?:initialize|\d{1,19}\/(?:append|finalize)))$/;
    if (typeof path !== 'string' || !['GET','POST'].includes(method) || !allowed.test(path)) throw Error('INVALID_ENDPOINT');
    const url = 'https://api.x.com' + path;
    return new Promise((resolve, reject) => {
      let handle, settled = false;
      function finish(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        callback(value);
      }
      function abort() {
        finish(reject,new Error('CANCELLED'));
        handle?.abort();
      }
      const timer = setTimeout(() => {
        finish(reject,new Error('NETWORK'));
        handle?.abort();
      },90000);
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort',abort,{once:true});
      try {
        handle = xhr({
          url, method, headers, data:body, anonymous:true, redirect:'error',
          onload(response) {
            if (response.finalUrl && response.finalUrl !== url) return finish(reject,new Error('INVALID_ENDPOINT'));
            let json;
            try { json = JSON.parse(response.responseText); } catch (_) { json = null; }
            finish(resolve,{status:response.status,json});
          },
          onerror:() => finish(reject,new Error('NETWORK')),
          onabort:() => finish(reject,new Error('CANCELLED')),
          ontimeout:() => finish(reject,new Error('NETWORK'))
        });
      } catch (error) { finish(reject,error); }
    });
  };
}

function mountXPostingBridge({request,auth,createPublisher,showDialog}) {
  if (window !== window.top || location.origin !== 'https://www.nicovideo.jp') return;
  const origin = location.origin;
  let open = false;
  const fail = code => Object.assign(new Error(code),{code});
  window.addEventListener('message', event => {
    if (open || !event.isTrusted || event.origin !== origin || event.source !== window || event.data?.type !== 'zenza-open-x-publisher') return;
    const {file,text} = event.data;
    if (!(file instanceof File) || file.type !== 'video/mp4' || !file.size || typeof text !== 'string') return;
    // Page messages can only open the preview. Access tokens, API methods and
    // the final trusted-click confirmation remain in the isolated userscript.
    let reviewed, inFlight = false, closed = false;
    async function lookup(token, signal) {
      const {status,json} = await request('/2/users/me',{method:'GET',headers:{Authorization:'Bearer '+token},signal});
      if (status === 401) throw fail('AUTH_REQUIRED');
      if (status === 402) throw fail('QUOTA');
      if (status === 403) throw fail('ACCESS_DENIED');
      if (status === 429) throw fail('RATE_LIMITED');
      const identity = json?.data;
      if (status !== 200 || typeof identity?.id !== 'string' || !/^\d{1,19}$/.test(identity.id) ||
          typeof identity.username !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(identity.username)) throw fail('ACCOUNT_UNKNOWN');
      return {id:identity.id,username:identity.username};
    }
    async function account() {
      reviewed = null;
      const token = await auth.getToken();
      const identity = await lookup(token);
      if (closed) throw fail('CANCELLED');
      reviewed = {id:identity.id,token};
      return identity;
    }
    async function publish({text:body, signal, onProgress}) {
      if (inFlight) throw fail('BUSY');
      inFlight = true;
      let beforeDispatch;
      try {
        const binding = reviewed;
        if (!binding || closed) throw fail('ACCOUNT_CHANGED');
        const publisher = createPublisher(async (path, options) => {
          let token;
          try {
            if (!auth.isLinked()) throw fail('AUTH_REQUIRED');
            token = await auth.getToken();
            if (token !== binding.token) {
              const identity = await lookup(token, signal);
              if (identity.id !== binding.id || await auth.getToken() !== token) throw fail('ACCOUNT_CHANGED');
              binding.token = token;
            }
            if (closed || signal?.aborted) throw fail('CANCELLED');
          } catch (error) {
            // The post has not been dispatched. Preserve this distinction for the dialog.
            beforeDispatch = signal?.aborted ? fail('CANCELLED') : error;
            throw beforeDispatch;
          }
          return request(path,{...options, headers:{...options.headers, Authorization:'Bearer '+token}});
        });
        return await publisher.publish({file,text:body,signal,onProgress});
      } catch (error) {
        throw beforeDispatch || error;
      } finally { inFlight = false; }
    }
    open = true;
    try {
      showDialog({file,text,auth,account,publish,onClose() { if (!closed) { closed = true; reviewed = null; open = false; } }});
    } catch (_) { open = false; }
  });
  document.documentElement.setAttribute('data-zenza-x-publisher','ready');
}
module.exports = {createXRequest,mountXPostingBridge};

'use strict';

// COOP on X can sever WindowProxy references. Only the current chunk is held in
// the manager's per-tab data. Persistent value-change notifications contain no media.
function createXDraftTransfer(gm) {
  const chunkSize = 768 * 1024;
  const maxBytes = 256 * 1024 ** 2;
  const slot = 'zenzaXDraftChunk';
  const fallback = '完成画面で動画をコピーまたは保存して、Xに添付してください。';
  const timeout = 'Xの下書きを確認できませんでした。ログイン後、' + fallback;
  const signalKey = id => 'zenza-x-draft:' + id;
  const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id);
  const encode = blob => new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.onerror = () => reject(Error(fallback));
    reader.readAsDataURL(blob);
  });
  // The source has at most one in-flight write. Finish it before releasing its
  // slot, even if the previous job was cancelled while the manager was saving.
  let writes = Promise.resolve();
  function updateChunk(id, value) {
    writes = writes.catch(() => {}).then(async () => {
      const tab = await gm.tab();
      if (value) tab[slot] = value;
      else if (tab[slot]?.id === id) delete tab[slot];
      else return;
      await gm.save(tab);
    });
    return writes;
  }
  async function send(file, text, signal, onProgress = () => {}) {
    const id = crypto.randomUUID(), key = signalKey(id);
    const intent = new URL('https://x.com/intent/tweet');
    if (typeof text === 'string' && text) intent.searchParams.set('text', text.slice(0,4096));
    if (signal.aborted) throw Error(fallback);
    const issue = (message,reason) => Object.assign(Error(message),{reason});
    const openTab = () => {
      try { return gm.open(intent.href); }
      catch (_) { throw issue('Xの下書きを別タブで開けませんでした。' + fallback,'draft-open-failed'); }
    };
    if (!gm.tabs) {
      openTab();
      throw issue('Xの下書きを開きました。このスクリプト管理拡張では自動添付できません。コピー済みならXの「Zenzaの動画をクリップボードから読み込む」を押してください。' + fallback,'draft-manager');
    }
    if (!file || file.type !== 'video/mp4' || !file.size || file.size > maxBytes) {
      openTab();
      throw issue('自動添付できるのは256 MiBまでのMP4です。' + fallback,'draft-size');
    }
    intent.hash = 'zenza-clip=' + id;
    let receiver, next = 0, busy = false, done = false, listener, timer, abort, tab;
    try {
      await new Promise((resolve,reject) => {
        const fail = (message,reason) => reject(issue(message,reason));
        abort = () => fail(fallback);
        signal.addEventListener('abort',abort,{once:true});
        const refreshTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => fail(timeout,receiver ? 'draft-transfer-timeout' : 'draft-no-receiver'),120000);
        };
        refreshTimeout();
        listener = gm.listen(key, async (_,old,msg) => {
          if (done || !validId(msg?.receiver)) return;
          if (!receiver && msg.type === 'pull' && msg.index === 0) receiver = msg.receiver;
          if (msg.receiver !== receiver) return;
          if (msg.type === 'attached' && next * chunkSize >= file.size) return resolve();
          if (msg.type === 'failed') return fail('Xの添付欄に動画を渡せませんでした。' + fallback,'draft-input');
          if (msg.type !== 'pull' || busy || msg.index !== next || next * chunkSize >= file.size) return;
          busy = true;
          try {
            const index = next, start = index * chunkSize;
            const data = await encode(file.slice(start,start + chunkSize));
            if (done || signal.aborted) return;
            await updateChunk(id,{id,index,data,size:file.size,name:file.name.slice(0,200)});
            if (done || signal.aborted) return;
            next++;
            busy = false;
            refreshTimeout();
            onProgress('draft-attach');
            gm.set(key,{type:'chunk',receiver,index});
          } catch (_) { fail(fallback); }
        });
        try {
          gm.set(key,{type:'ready',expires:Date.now()+120000});
          tab = openTab();
          onProgress('draft-receive');
          if (tab) tab.onclose = () => fail('Xの下書きが閉じられました。' + fallback,'draft-closed');
        } catch (error) { reject(error); }
      });
    } finally {
      done = true;
      if (tab) tab.onclose = null;
      clearTimeout(timer);
      signal.removeEventListener('abort',abort);
      if (listener != null) gm.unlisten(listener);
      gm.remove(key);
      await updateChunk(id,null);
    }
  }
  async function receive(id, attach, signal) {
    if (!validId(id) || signal.aborted) throw Error(fallback);
    const key = signalKey(id), receiver = crypto.randomUUID(), parts = [];
    const ready = gm.get(key);
    if (ready?.type !== 'ready' || !(ready.expires > Date.now())) throw Error(fallback);
    let size, name, next = 0, busy = false, done = false, timer, listener, abort;
    try {
      await new Promise((resolve,reject) => {
        abort = () => reject(Error(fallback));
        signal.addEventListener('abort',abort,{once:true});
        const refreshTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => reject(Error(timeout)),105000);
        };
        refreshTimeout();
        const pull = () => gm.set(key,{type:'pull',receiver,index:next});
        listener = gm.listen(key, async (_,old,msg) => {
          if (!done && msg == null) return reject(Error(fallback));
          if (done || busy || msg?.type !== 'chunk' || msg.receiver !== receiver || msg.index !== next) return;
          busy = true;
          try {
            const tabs = await gm.tabs();
            if (done || signal.aborted) return;
            const chunk = Object.values(tabs).map(tab => tab[slot]).find(part => part?.id === id && part.index === next);
            if (!chunk) throw Error(fallback);
            if (next === 0) {
              size = chunk.size;
              if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes || typeof chunk.name !== 'string') throw Error(fallback);
              name = chunk.name.replace(/\.mp4$/i,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,160) || 'clip';
            }
            const length = Math.min(chunkSize,size - chunkSize * next);
            if (length <= 0 || chunk.data?.length !== 4 * Math.ceil(length/3)) throw Error(fallback);
            const bytes = Uint8Array.from(atob(chunk.data), c => c.charCodeAt(0));
            if (bytes.length !== length) throw Error(fallback);
            // Compose the output File from immutable parts without retaining all decoded arrays on the JS heap.
            parts.push(new Blob([bytes]));
            next++;
            busy = false;
            refreshTimeout();
            if (next * chunkSize < size) return pull();
            const active = gm.get(key);
            if (active?.type !== 'chunk' || active.receiver !== receiver || active.index !== next-1) throw Error(fallback);
            attach(new File(parts,name + '.mp4',{type:'video/mp4'}));
            gm.set(key,{type:'attached',receiver});
            resolve();
          } catch (error) { reject(error); }
        });
        pull();
      });
    } catch (error) {
      if (gm.get(key)?.receiver === receiver) gm.set(key,{type:'failed',receiver});
      throw error;
    } finally {
      done = true;
      parts.length = 0;
      clearTimeout(timer);
      signal.removeEventListener('abort',abort);
      if (listener != null) gm.unlisten(listener);
    }
  }
  return {send,receive:gm.tabs ? receive : null};
}

function mountXDraftSender(getTransfer) {
  let ticket;
  const root = document.documentElement;
  window.addEventListener('click', event => {
    if (!event.isTrusted || !event.target?.closest) return;
    const button = event.target.closest('button,a');
    const dialog = button?.closest('dialog.zenzaShare[open]');
    if (!dialog) return;
    if (!button.matches('.zenzaLocalClip [data-action=create],.zenzaLocalClip [data-action=low-quality],.zenzaLocalClip [data-action=record],.zenzaLocalClip [data-action=post-x],[data-official-editor] [name=useLocal]')) return;
    if (button.dataset.action !== 'post-x' && !dialog.querySelector('.zenzaLocalClip [name=openXDraft]')?.checked) return;
    const id = crypto.randomUUID();
    ticket = id;
    root.dataset.zenzaDraftTicket = id;
    setTimeout(() => {
      if (ticket === id) ticket = null;
      if (root.dataset.zenzaDraftTicket === id) delete root.dataset.zenzaDraftTicket;
    },1500);
  },true);
  window.addEventListener('message', event => {
    const port = event.ports?.[0];
    if (!event.isTrusted || event.origin !== location.origin || event.source !== root.ownerDocument.defaultView || event.data?.type !== 'zenza-reserve-x-draft' ||
        !ticket || event.data.ticket !== ticket || !port) return;
    ticket = null;
    delete root.dataset.zenzaDraftTicket;
    const controller = new AbortController();
    const close = () => {
      controller.abort();
      port.onmessage = null;
      port.close();
      window.removeEventListener('pagehide',close);
    };
    window.addEventListener('pagehide',close,{once:true});
    let started = false;
    port.onmessage = async ({data}) => {
      if (data?.type === 'cancel') return close();
      if (started || data?.type !== 'complete') return;
      if (!(data.file instanceof File) || data.file.type !== 'video/mp4') {
        port.postMessage({error:'管理拡張で受け取ったデータをMP4として確認できませんでした。',stage:'draft-format'});
        return close();
      }
      started = true;
      try {
        port.postMessage({stage:'draft-open'});
        await getTransfer().send(data.file,data.text,controller.signal,stage => port.postMessage({progress:true,stage}));
        port.postMessage({attached:true});
      } catch (error) {
        port.postMessage({error:error?.message || 'Xへの自動添付に失敗しました。完成画面から手動で添付できます。',reason:error?.reason});
      } finally { close(); }
    };
    port.postMessage({reserved:true});
  });
}
module.exports = {createXDraftTransfer,mountXDraftSender};

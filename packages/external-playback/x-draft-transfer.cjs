'use strict';

// COOP on X can sever WindowProxy references. Only the current chunk is held in
// the manager's per-tab data. Persistent value-change notifications contain no media.
function createXDraftTransfer(gm) {
  const chunkSize = 768 * 1024;
  const maxBytes = 256 * 1024 ** 2;
  const slot = 'zenzaXDraftChunk';
  const fallback = '完成画面で動画をコピーまたは保存して、Xに添付してください。';
  const timeout = 'Xの下書きを確認できませんでした。ログイン後、' + fallback;
  const mediaFailures = new Map([
    ['draft-media-rejected','Xが動画の処理エラーを表示しました。'],
    ['draft-media-timeout','Xで動画の準備が続き、完了を確認できませんでした。'],
    ['draft-media-hidden','バックグラウンドのXで動画の準備が続き、進捗を確認できませんでした。下書きタブを一度表示してください。'],
    ['draft-media-limit','Xで動画の準備が20分以内に完了しませんでした。'],
    ['draft-media-unknown','Xが動画を投稿できる状態か確認できませんでした。']
  ]);
  const mediaIssue = reason => Object.assign(Error(mediaFailures.get(reason) + '開いているXの下書きで添付欄を確認してください。'),{reason});
  const validPercent = value => Number.isInteger(value) && value >= 0 && value <= 100;
  // The receiver, GM sender, and page have successive guard intervals. Only
  // new native upload progress can renew the idle guard. Polling cannot.
  function watchPreparation(idleMs,limitMs,reject,onChange) {
    let phase, percent, idle, limit;
    function resetIdle() {
      clearTimeout(idle);
      idle = setTimeout(() => reject(mediaIssue(phase === 'draft-prepare' ? 'draft-media-timeout' : 'draft-media-unknown')),idleMs);
    }
    function start() {
      if (limit !== undefined) return;
      limit = setTimeout(() => reject(mediaIssue('draft-media-limit')),limitMs);
      resetIdle();
    }
    function observe(next,value) {
      if (next !== 'draft-received' && next !== 'draft-prepare') return;
      if (next === 'draft-received' && phase) return;
      const advanced = next === 'draft-prepare' && validPercent(value) && (percent === undefined || value > percent);
      if (next === phase && !advanced) return;
      start();
      phase = next;
      if (advanced) percent = value;
      resetIdle();
      onChange(phase,percent);
    }
    return {start,observe,get percent() { return percent; },stop() { clearTimeout(idle); clearTimeout(limit); }};
  }
  const signalKey = id => 'zenza-x-draft:' + id;
  const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id);
  // Value-change events are hints. A suspended background tab may miss the event
  // while the request, chunk index or final acknowledgement remains in storage.
  function watchMailbox(key, accept, reject) {
    const listener = gm.listen(key, (_,old,message) => accept(message));
    const timer = setInterval(() => {
      try { accept(gm.get(key)); }
      catch (_) { reject(Error(fallback)); }
    },3000);
    return () => { clearInterval(timer); gm.unlisten(listener); };
  }
  const encode = blob => new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.onerror = () => reject(Error(fallback));
    reader.readAsDataURL(blob);
  });
  // The source has at most one in-flight write. Finish it before releasing its
  // slot, even if the previous job was cancelled while the manager was saving.
  let writes = Promise.resolve(), pendingCleanup;
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
  function openDraft(text,background,id) {
    const intent = new URL('https://x.com/intent/tweet');
    if (typeof text === 'string' && text) intent.searchParams.set('text', text.slice(0,4096));
    if (id) intent.hash = 'zenza-clip=' + id;
    try {
      const tab = gm.open(intent.href,{active:background === false,insert:true});
      if (!tab) throw Error();
      return tab;
    }
    catch (_) { throw Object.assign(Error('Xの下書きを別タブで開けませんでした。' + fallback),{reason:'draft-open-failed'}); }
  }
  async function send(file, text, signal, onProgress = () => {}, background = true) {
    const id = crypto.randomUUID(), key = signalKey(id);
    if (signal.aborted) throw Error(fallback);
    const issue = (message,reason) => Object.assign(Error(message),{reason});
    if (!gm.tabs) {
      openDraft(text,background);
      throw issue('Xの下書きを開きました。このスクリプト管理拡張では自動添付できません。コピー済みならXの「Zenzaの動画をクリップボードから読み込む」を押してください。' + fallback,'draft-manager');
    }
    if (pendingCleanup) {
      throw issue('管理拡張が前の動画の保存処理を終了していません。' + fallback,'draft-storage-busy');
    }
    if (!file || file.type !== 'video/mp4' || !file.size || file.size > maxBytes) {
      openDraft(text,background);
      throw issue('自動添付できるのは256 MiBまでのMP4です。' + fallback,'draft-size');
    }
    let receiver, next = 0, busy = false, done = false, touched = false, media, unwatch, timer, abort, tab;
    try {
      await new Promise((resolve,reject) => {
        media = watchPreparation(315000,1215000,reject,(phase,percent) => {
          clearTimeout(timer);
          onProgress(phase,percent);
        });
        const fail = (message,reason) => reject(issue(message,reason));
        abort = () => fail(fallback);
        signal.addEventListener('abort',abort,{once:true});
        const refreshTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => receiver
            ? fail('Xへの転送または添付完了の応答が90秒間ありません。Xの添付欄を確認してください。' + fallback,'draft-transfer-timeout')
            : fail(timeout,'draft-no-receiver'),receiver ? 90000 : 120000);
        };
        refreshTimeout();
        unwatch = watchMailbox(key,async msg => {
          if (done || !validId(msg?.receiver)) return;
          if (!receiver && msg.type === 'pull' && msg.index === 0) {
            receiver = msg.receiver;
            refreshTimeout();
            onProgress('draft-attach',0);
          }
          if (msg.receiver !== receiver) return;
          if (next * chunkSize >= file.size && (msg.type === 'draft-received' || msg.type === 'draft-prepare')) {
            media.observe(msg.type,msg.percent);
            return;
          }
          if (msg.type === 'attached' && next * chunkSize >= file.size) return resolve();
          if (msg.type === 'failed') {
            if (mediaFailures.has(msg.reason)) {
              if (next * chunkSize >= file.size && validPercent(msg.percent)) media.observe('draft-prepare',msg.percent);
              return reject(mediaIssue(msg.reason));
            }
            return fail('Xの添付欄に動画を渡せませんでした。' + fallback,'draft-input');
          }
          if (msg.type !== 'pull' || busy || msg.index !== next || next * chunkSize >= file.size) return;
          busy = true;
          try {
            const index = next, start = index * chunkSize;
            const data = await encode(file.slice(start,start + chunkSize));
            if (done || signal.aborted) return;
            touched = true;
            await updateChunk(id,{id,index,data,size:file.size,name:file.name.slice(0,200)});
            if (done || signal.aborted) return;
            next++;
            busy = false;
            refreshTimeout();
            onProgress('draft-attach',Math.floor(Math.min(next * chunkSize,file.size) / file.size * 100));
            gm.set(key,{type:'chunk',receiver,index});
          } catch (_) { fail(fallback); }
        },reject);
        try {
          gm.set(key,{type:'ready',expires:Date.now()+120000});
          tab = openDraft(text,background,id);
          onProgress('draft-receive');
          if (tab) tab.onclose = () => fail('Xの下書きが閉じられました。' + fallback,'draft-closed');
        } catch (error) { reject(error); }
      });
    } finally {
      done = true;
      if (tab) tab.onclose = null;
      media?.stop();
      clearTimeout(timer);
      signal.removeEventListener('abort',abort);
      unwatch?.();
      gm.remove(key);
      if (touched) {
        // Preserve write order if a manager callback arrives late. A stuck
        // manager must neither hold the clip queue nor overwrite a later file.
        pendingCleanup = updateChunk(id,null).catch(() => {}).then(() => { pendingCleanup = null; });
        try {
          await Promise.race([pendingCleanup,new Promise(resolve => { timer = setTimeout(resolve,1500); })]);
        } finally { clearTimeout(timer); }
      }
    }
  }
  async function receive(id, attach, signal) {
    if (!validId(id) || signal.aborted) throw Error(fallback);
    const key = signalKey(id), receiver = crypto.randomUUID(), parts = [];
    const ready = gm.get(key);
    if (ready?.type !== 'ready' || !(ready.expires > Date.now())) throw Error(fallback);
    const preparation = new AbortController();
    let size, name, next = 0, busy = false, done = false, media, timer, unwatch, abort;
    try {
      await new Promise((resolve,reject) => {
        media = watchPreparation(305000,1205000,reject,(type,percent) => gm.set(key,{type,receiver,percent}));
        abort = () => reject(Error(fallback));
        signal.addEventListener('abort',abort,{once:true});
        const refreshTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => reject(Error(timeout)),105000);
        };
        refreshTimeout();
        const pull = () => gm.set(key,{type:'pull',receiver,index:next});
        unwatch = watchMailbox(key,async msg => {
          if (!done && msg == null) return reject(Error(fallback));
          if (done || busy || msg?.type !== 'chunk' || msg.receiver !== receiver || msg.index !== next) return;
          busy = true;
          try {
            const tabs = await gm.tabs();
            if (done || signal.aborted) return;
            const chunk = Object.values(tabs).map(tab => tab[slot]).find(part => part?.id === id && part.index === next);
            if (!chunk) { busy = false; return; } // Tab data may become visible after its notification.
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
            const file = new File(parts,name + '.mp4',{type:'video/mp4'});
            parts.length = 0;
            clearTimeout(timer);
            media.start();
            await attach(file,preparation.signal,(phase,percent) => {
              if (!done && !signal.aborted) media.observe(phase,percent);
            });
            if (done || signal.aborted || gm.get(key)?.receiver !== receiver) return;
            gm.set(key,{type:'attached',receiver});
            resolve();
          } catch (error) { reject(error); }
        },reject);
        pull();
      });
    } catch (error) {
      if (gm.get(key)?.receiver === receiver) gm.set(key,{type:'failed',receiver,reason:mediaFailures.has(error.reason) ? error.reason : 'draft-input',percent:media?.percent});
      throw error;
    } finally {
      done = true;
      preparation.abort();
      media?.stop();
      parts.length = 0;
      clearTimeout(timer);
      signal.removeEventListener('abort',abort);
      unwatch?.();
    }
  }
  return {send,openText:(text,background) => openDraft(text,background),receive:gm.tabs ? receive : null};
}

function mountXDraftSender(getTransfer, storagePrefix) {
  let ticket;
  const root = document.documentElement;
  function grant() {
    const id = crypto.randomUUID();
    ticket = id;
    root.dataset.zenzaDraftTicket = id;
    setTimeout(() => {
      if (ticket === id) ticket = null;
      if (root.dataset.zenzaDraftTicket === id) delete root.dataset.zenzaDraftTicket;
    },1500);
  }
  window.addEventListener('click', event => {
    if (!event.isTrusted || !event.target?.closest) return;
    const button = event.target.closest('button,a');
    if (button?.matches('.hoverMenuContainer button.shareQuickAction[data-command="shareZenzaFull"]')) return grant();
    const dialog = button?.closest('dialog.zenzaShare[open]');
    if (dialog && button.matches('a[data-action=x]')) return grant();
    if (!dialog || !button.matches('.zenzaLocalClip [data-action=create],.zenzaLocalClip [data-action=low-quality],.zenzaLocalClip [data-action=record],.zenzaLocalClip [data-action=post-x],[data-official-editor] [name=useLocal]')) return;
    if (button.dataset.action === 'post-x' || dialog.querySelector('.zenzaLocalClip [name=openXDraft]')?.checked) grant();
  },true);
  // Only the configured shortcut, while its native event is still being dispatched,
  // can reserve a draft. Typing or replaying an old KeyboardEvent cannot mint a ticket.
  let keydown;
  window.addEventListener('keydown',event => { keydown = event.isTrusted ? event : null; },true);
  window.addEventListener('zenza-request-key-draft',() => {
    const event = keydown;
    if (!event?.eventPhase || event.repeat || event.isComposing || !event.keyCode ||
        event.composedPath().some(el => el.isContentEditable || el.matches?.('input,textarea,select')) ||
        !document.querySelector('.zenzaVideoPlayerDialog.is-open,.zenzaVideoPlayerDialog.show') ||
        document.querySelector('.zenzaAdvancedSettingPanel.show')) return;
    const combo = event.keyCode + (event.shiftKey ? 0x1000 : 0) + (event.ctrlKey ? 0x10000 : 0) +
      (event.altKey ? 0x100000 : 0) + (event.metaKey ? 0x1000000 : 0);
    try {
      if (Number(localStorage.getItem(storagePrefix + 'KEY_SHARE_ZENZA_FULL')) !== combo) return;
    } catch (_) { return; }
    keydown = null;
    grant();
  });
  window.addEventListener('message', event => {
    const port = event.ports?.[0];
    if (!event.isTrusted || event.origin !== location.origin || event.source !== root.ownerDocument.defaultView || event.data?.type !== 'zenza-reserve-x-draft' ||
        !ticket || event.data.ticket !== ticket || !port) return;
    ticket = null;
    delete root.dataset.zenzaDraftTicket;
    const background = event.data.background !== false;
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
      if (started || !['complete','open-text'].includes(data?.type)) return;
      started = true;
      if (data.type === 'open-text') {
        try { getTransfer().openText(data.text,background); port.postMessage({opened:true}); }
        catch (error) { port.postMessage({error:error.message,reason:'draft-open-failed'}); }
        return close();
      }
      if (!(data.file instanceof File) || data.file.type !== 'video/mp4') {
        port.postMessage({error:'管理拡張で受け取ったデータをMP4として確認できませんでした。',stage:'draft-format'});
        return close();
      }
      try {
        port.postMessage({stage:'draft-open'});
        await getTransfer().send(data.file,data.text,controller.signal,(stage,percent) => port.postMessage({stage,percent}),background);
        port.postMessage({attached:true});
      } catch (error) {
        port.postMessage({error:error?.message || 'Xへの自動添付に失敗しました。完成画面から手動で添付できます。',reason:error?.reason});
      } finally { close(); }
    };
    port.postMessage({reserved:true});
  });
}
module.exports = {createXDraftTransfer,mountXDraftSender};

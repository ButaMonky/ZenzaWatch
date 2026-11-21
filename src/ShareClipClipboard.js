//===BEGIN===
// Both origins share this format. The X tab reads the clipboard only on a trusted click.
const ShareClipClipboard = (() => {
  const type = 'application/x-zenzawatch-clip';
  const format = 'web ' + type;
  const mediaTypes = ['video/mp4','video/webm'];
  // Chromium's ClipboardHost::kMaxDataSize excludes payloads at or above this byte count.
  const maxPayloadBytes = 1024 ** 3;
  const maxHeaderBytes = 2048;
  const manualAttachment = '「動画を保存」で保存し、Xの投稿画面のメディアボタンから添付してください。';
  function supported() {
    return !!(navigator.clipboard?.write && navigator.clipboard?.read && globalThis.ClipboardItem?.supports?.(format));
  }
  function encodeHeader(file) {
    return new TextEncoder().encode(JSON.stringify({name:file.name, type:file.type}));
  }
  function copyUnavailableReason(file) {
    if (!supported()) return 'このブラウザーでは動画のコピー形式を確認できません。' + manualAttachment;
    if (!mediaTypes.includes(file?.type) || !file.size || typeof file.name !== 'string') {
      return 'コピーできる動画はMP4またはWebMです。' + manualAttachment;
    }
    const headerBytes = encodeHeader(file).length;
    if (headerBytes > maxHeaderBytes) return 'ファイル名が長すぎてコピーできません。' + manualAttachment;
    if (4 + headerBytes + file.size >= maxPayloadBytes) {
      return 'ファイル名などを含むコピー容量が1 GiB以上です。' + manualAttachment;
    }
    return '';
  }
  async function copy(file) {
    const reason = copyUnavailableReason(file);
    if (reason) throw Error(reason);
    const header = encodeHeader(file);
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0,header.length);
    const blob = new Blob([size,header,file],{type});
    try {
      await navigator.clipboard.write([new ClipboardItem({[format]:blob})]);
    } catch (error) {
      const message = error.name === 'NotAllowedError' ? 'ブラウザーのクリップボード書き込み許可を確認してください。' :
        'クリップボードへの書き込みに失敗しました。';
      throw Error(message + manualAttachment);
    }
  }
  async function read() {
    const items = await navigator.clipboard.read();
    const item = items.find(value => value.types.includes(format));
    if (!item) throw Error('ZenzaWatchの完成画面で「X用に動画をコピー」を押してください。');
    const blob = await item.getType(format);
    const invalid = () => new Error('動画を読み取れません。ZenzaWatchでもう一度コピーしてください。');
    if (blob.size < 5) throw invalid();
    const length = new DataView(await blob.slice(0,4).arrayBuffer()).getUint32(0);
    if (!length || length > maxHeaderBytes || 4 + length >= blob.size) throw invalid();
    let info;
    try { info = JSON.parse(await blob.slice(4,4+length).text()); } catch (_) { throw invalid(); }
    if (!mediaTypes.includes(info?.type) || typeof info.name !== 'string') throw invalid();
    const extension = info.type === 'video/mp4' ? '.mp4' : '.webm';
    const stem = info.name.replace(/\.(mp4|webm)$/i,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,160);
    return new File([blob.slice(4+length)],(stem || 'clip') + extension,{type:info.type});
  }
  async function copyIfGranted(file) {
    try {
      if (!document.hasFocus() || copyUnavailableReason(file) || !navigator.permissions?.query) return;
      let timer;
      let permission;
      try {
        permission = await Promise.race([navigator.permissions.query({name:'clipboard-write', allowWithoutGesture:true}),
          new Promise(resolve => { timer = setTimeout(resolve,1500); })]);
      } finally { clearTimeout(timer); }
      if (permission?.state === 'granted' && document.hasFocus()) void copy(file).catch(() => {});
    } catch (_) { /* Clipboard support is optional for direct attachment. */ }
  }
  // A waiting tab is used only if the script manager cannot accept this click.
  // Never navigate a tab that the viewer closed or navigated elsewhere.
  function reserveBrowserTab() {
    let tab;
    const ownsTab = () => {
      try { return !!tab && !tab.closed && tab.location.href === 'about:blank'; }
      catch (_) { return false; }
    };
    try {
      tab = window.open('about:blank','_blank');
      if (tab) {
        tab.opener = null;
        tab.document.title = 'ZenzaWatch ｜ Xの下書き';
        tab.document.body.textContent = 'クリップの完成後、ここにXの下書きを開きます。元のタブで視聴を続けられます。';
      }
    } catch (_) { /* Report the browser result when the MP4 is ready. */ }
    return {
      complete(file,text) {
        const fail = (message,stage) => { throw Object.assign(Error(message),{stage}); };
        if (!tab) fail('MP4は完成しました。別タブを開けませんでした。完成画面からXを開いてください。','draft-popup');
        if (!ownsTab()) fail('MP4は完成しました。待機タブが閉じられたか、別のページに移動しました。','draft-tab-closed');
        const url = new URL('https://x.com/intent/tweet');
        if (text) url.searchParams.set('text',text);
        void copyIfGranted(file);
        const link = tab.document.createElement('a');
        link.href = url.href;
        link.rel = 'noreferrer';
        link.click();
        tab = null;
        fail('Xの下書きを別タブで開きました。自動添付を開始できなかったため、完成画面から動画をコピーまたは保存して添付してください。','draft-native');
      },
      cancel() { if (ownsTab()) tab.close(); tab = null; }
    };
  }
  function reserveDraft(trustedClick = false) {
    const ticket = document.documentElement.dataset.zenzaDraftTicket;
    if (!ticket) return trustedClick ? reserveBrowserTab() : null;
    const channel = new MessageChannel();
    const port = channel.port1;
    let timer, stopped = false, pending, browserTab, acknowledge;
    let stage = 'draft-reserve';
    const ready = new Promise(resolve => { acknowledge = resolve; });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      acknowledge(false);
      port.onmessage = null;
      port.postMessage({type:'cancel'});
      port.close();
    };
    port.onmessage = ({data}) => {
      if (data?.reserved) {
        clearTimeout(timer);
        stage = 'draft-open';
        acknowledge(true);
      } else if (data?.error) {
        if (data.stage === 'draft-format') stage = data.stage;
        pending?.settle(data);
      } else if (['draft-open','draft-receive','draft-attach'].includes(data?.stage)) {
        stage = data.stage;
        pending?.refresh();
      } else if (data?.attached) pending?.settle(data);
    };
    // A late receiver must never open a second tab. The file is sent only after acknowledgement.
    timer = setTimeout(() => {
      if (trustedClick) browserTab = reserveBrowserTab();
      stop();
    },350);
    window.postMessage({type:'zenza-reserve-x-draft',ticket},location.origin,[channel.port2]);
    return {
      async complete(file,text) {
        if (!await ready) {
          if (browserTab) return browserTab.complete(file,text);
          throw Object.assign(Error('Xを開くための受付を確認できませんでした。完成画面からXを開いてください。'),{stage});
        }
        if (stopped || pending) throw Object.assign(Error('Xの自動添付を終了しました。'),{stage});
        return new Promise((resolve,reject) => {
          const settle = message => {
            stop();
            pending = null;
            if (message?.attached === true) resolve();
            else {
              const known = ['draft-open-failed','draft-manager','draft-size','draft-transfer-timeout','draft-no-receiver','draft-input','draft-closed'];
              const reason = known.includes(message?.reason) ? message.reason : stage;
              reject(Object.assign(Error(message?.error || 'Xへの自動添付の応答を確認できませんでした。完成画面から手動で添付できます。'),{stage,reason}));
            }
          };
          const refresh = () => { clearTimeout(timer); timer = setTimeout(settle,180000); };
          pending = {refresh,settle};
          refresh();
          // Clipboard permission is optional. Its response must never delay opening X.
          void copyIfGranted(file);
          try { port.postMessage({type:'complete',file,text}); }
          catch (_) { settle({error:'完成したMP4をX連携に渡せませんでした。'}); }
        });
      },
      cancel() {
        browserTab?.cancel();
        browserTab = null;
        if (pending) pending.settle({error:'Xへの自動添付を中止しました。'});
        else stop();
      }
    };
  }
  return {supported, copyUnavailableReason, copy, read, reserveDraft};
})();
//===END===
export {ShareClipClipboard};

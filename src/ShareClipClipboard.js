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
    let tab, waitingDocument;
    const ownsTab = () => {
      try { return !!tab && !tab.closed && tab.location.href === 'about:blank' && tab.document === waitingDocument; }
      catch (_) { return false; }
    };
    try {
      tab = window.open('about:blank','_blank');
      if (tab) {
        waitingDocument = tab.document;
        tab.opener = null;
        tab.document.title = 'ZenzaWatch ｜ Xの下書き';
        tab.document.body.textContent = '準備ができたら、ここにXの下書きを開きます。';
      }
    } catch (_) { /* Report the browser result when the MP4 is ready. */ }
    const fail = (message,stage) => { throw Object.assign(Error(message),{stage}); };
    function openText(text) {
      if (!tab) fail('別タブを開けませんでした。ポップアップの許可を確認してください。','draft-popup');
      if (!ownsTab()) fail('待機タブが閉じられたか、別のページに移動しました。','draft-tab-closed');
      const url = new URL('https://x.com/intent/tweet');
      if (text) url.searchParams.set('text',text);
      const link = tab.document.createElement('a');
      link.href = url.href;
      link.rel = 'noreferrer';
      link.click();
      tab = null;
    }
    return {
      openText,
      complete(file,text) {
        void copyIfGranted(file);
        openText(text);
        fail('Xの下書きを別タブで開きました。自動添付を開始できなかったため、完成画面から動画をコピーまたは保存して添付してください。','draft-native');
      },
      cancel() { if (ownsTab()) tab.close(); tab = null; }
    };
  }
  function reserveDraft(trustedClick = false,background = true) {
    if (trustedClick && !document.documentElement.dataset.zenzaDraftTicket) {
      window.dispatchEvent(new Event('zenza-request-key-draft'));
    }
    const unavailable = () => {
      throw Object.assign(Error('スクリプト管理拡張によるバックグラウンドタブの作成を確認できませんでした。Xの下書きを手動で開いてください。'),{stage:'draft-reserve',reason:'draft-background-unavailable'});
    };
    const ticket = document.documentElement.dataset.zenzaDraftTicket;
    if (!ticket) {
      if (!trustedClick) return null;
      return background ? {complete:unavailable,openText:unavailable,cancel(){}} : reserveBrowserTab();
    }
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
      port.onmessage = port.onmessageerror = null;
      port.postMessage({type:'cancel'});
      port.close();
    };
    port.onmessage = ({data}) => {
      if (data?.reserved && stage === 'draft-reserve') {
        clearTimeout(timer);
        stage = 'draft-open';
        acknowledge(true);
      } else if (data?.error) {
        if (data.stage === 'draft-format') stage = data.stage;
        pending?.settle(data);
      } else if (['draft-open','draft-receive','draft-attach','draft-received','draft-prepare'].includes(data?.stage)) {
        pending?.progress?.(data.stage,data.percent);
      } else if (data?.attached || data?.opened) pending?.settle(data);
    };
    port.onmessageerror = () => {
      if (pending) pending.settle({error:'管理拡張から転送結果を読み取れませんでした。Xの添付欄を確認してください。'});
      else stop();
    };
    // A late receiver must never open a second tab. The file is sent only after acknowledgement.
    timer = setTimeout(() => {
      if (trustedClick && !background) browserTab = reserveBrowserTab();
      stop();
    },350);
    window.postMessage({type:'zenza-reserve-x-draft',ticket,background},location.origin,[channel.port2]);
    return {
      async openText(text) {
        if (!await ready) {
          if (browserTab) return browserTab.openText(text);
          if (background) return unavailable();
          throw Error('Xを開くための受付を確認できませんでした。');
        }
        if (stopped || pending) throw Error('Xの下書きを開くための受付を終了しました。');
        return new Promise((resolve,reject) => {
          const settle = message => {
            stop();
            pending = null;
            if (message?.opened) resolve();
            else reject(Error(message?.error || 'Xの下書きを開いたことを確認できませんでした。'));
          };
          pending = {settle};
          timer = setTimeout(settle,10000);
          try { port.postMessage({type:'open-text',text}); }
          catch (_) { settle(); }
        });
      },
      async complete(file,text,onProgress = () => {}) {
        if (!await ready) {
          if (browserTab) return browserTab.complete(file,text);
          if (background) return unavailable();
          throw Object.assign(Error('Xを開くための受付を確認できませんでした。完成画面からXを開いてください。'),{stage});
        }
        if (stopped || pending) throw Object.assign(Error('Xの自動添付を終了しました。'),{stage});
        return new Promise((resolve,reject) => {
          let mediaDeadline, uploadPercent = -1;
          const settle = message => {
            stop();
            pending = null;
            if (message?.attached === true) resolve();
            else {
              const known = ['draft-open-failed','draft-manager','draft-size','draft-storage-busy','draft-transfer-timeout','draft-no-receiver','draft-input','draft-closed',
                'draft-media-rejected','draft-media-unknown','draft-media-timeout','draft-media-limit','draft-media-hidden'];
              const reason = known.includes(message?.reason) ? message.reason : stage;
              // A suspended source can miss a progress message before the final receipt.
              if (['draft-media-timeout','draft-media-limit','draft-media-hidden'].includes(reason)) stage = 'draft-prepare';
              else if (['draft-media-unknown','draft-media-rejected'].includes(reason) && stage !== 'draft-prepare') stage = 'draft-received';
              reject(Object.assign(Error(message?.error || 'Xへの自動添付の応答を確認できませんでした。完成画面から手動で添付できます。'),{stage,reason}));
            }
          };
          const refresh = () => {
            clearTimeout(timer);
            if (mediaDeadline !== undefined) {
              const delay = Math.max(0,Math.min(330000,mediaDeadline - Date.now()));
              timer = setTimeout(() => settle({reason:Date.now() >= mediaDeadline ? 'draft-media-limit' :
                stage === 'draft-prepare' ? 'draft-media-timeout' : 'draft-media-unknown',
                error:'Xの添付欄にMP4を渡しましたが、投稿できる状態を確認できませんでした。開いている下書きを確認してください。'}),delay);
            } else timer = setTimeout(settle,180000);
          };
          pending = {settle,progress(nextStage,value) {
            const percent = Number.isInteger(value) && value >= 0 && value <= 100 ? value : undefined;
            if (mediaDeadline !== undefined && nextStage !== 'draft-prepare') return;
            if (nextStage === 'draft-prepare') {
              if (stage === nextStage && (percent === undefined || percent <= uploadPercent)) return;
              if (percent !== undefined) uploadPercent = percent;
            }
            stage = nextStage;
            if (stage === 'draft-received' || stage === 'draft-prepare') mediaDeadline ??= Date.now() + 1230000;
            refresh();
            onProgress(stage,percent);
          }};
          onProgress(stage);
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

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
      const permission = await navigator.permissions.query({name:'clipboard-write', allowWithoutGesture:true});
      if (permission.state === 'granted' && document.hasFocus()) void copy(file).catch(() => {});
    } catch (_) { /* Clipboard support is optional for direct attachment. */ }
  }
  function reserveDraft() {
    const ticket = document.documentElement.dataset.zenzaDraftTicket;
    if (!ticket) return null;
    const channel = new MessageChannel();
    const port = channel.port1;
    window.postMessage({type:'zenza-reserve-x-draft',ticket}, location.origin, [channel.port2]);
    let pending, timer, closed = false;
    const stop = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      pending = null;
      port.onmessage = null;
      port.postMessage({type:'cancel'});
      port.close();
    };
    return {
      complete(file, text) {
        if (closed || pending) return Promise.reject(Error('Xの自動添付を終了しました。完成画面から手動で添付できます。'));
        return new Promise((resolve,reject) => {
          pending = reject;
          const settle = message => {
            stop();
            if (message?.attached === true) resolve();
            else reject(Error(message?.error || 'Xへの自動添付を確認できませんでした。完成画面から手動で添付できます。'));
          };
          const refreshTimeout = () => {
            clearTimeout(timer);
            timer = setTimeout(settle,180000);
          };
          port.onmessage = event => event.data?.progress === true ? refreshTimeout() : settle(event.data);
          refreshTimeout();
          // Start an already-permitted write while the source still has focus.
          // Opening X must not wait for clipboard serialization of the entire MP4.
          copyIfGranted(file).then(() => {
            if (!closed) port.postMessage({type:'complete',file,text});
          }).catch(() => settle());
        });
      },
      cancel() {
        if (closed) return;
        const reject = pending;
        stop();
        reject?.(Error('Xへの自動添付を中止しました。'));
      }
    };
  }
  return {supported, copyUnavailableReason, copy, read, reserveDraft};
})();
//===END===
export {ShareClipClipboard};

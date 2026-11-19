//===BEGIN===
// Both origins share this clipboard format. Only an explicit user gesture copies or reads it.
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
  return {supported, copyUnavailableReason, copy, read};
})();
//===END===
export {ShareClipClipboard};

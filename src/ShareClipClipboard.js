//===BEGIN===
// Both origins share this clipboard format. Only an explicit user gesture copies or reads it.
const ShareClipClipboard = (() => {
  const type = 'application/x-zenzawatch-clip';
  const format = 'web ' + type;
  const mediaTypes = ['video/mp4','video/webm'];
  function supported() {
    return !!(globalThis.ClipboardItem && navigator.clipboard?.write && navigator.clipboard?.read &&
      (!ClipboardItem.supports || ClipboardItem.supports(format)));
  }
  async function copy(file) {
    if (!mediaTypes.includes(file?.type) || !file.size) throw Error('この動画をコピーできません。');
    const header = new TextEncoder().encode(JSON.stringify({name:file.name, type:file.type}));
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0,header.length);
    const blob = new Blob([size,header,file],{type});
    await navigator.clipboard.write([new ClipboardItem({[format]:blob})]);
  }
  async function read() {
    const items = await navigator.clipboard.read();
    const item = items.find(value => value.types.includes(format));
    if (!item) throw Error('ZenzaWatchの完成画面で「X用に動画をコピー」を押してください。');
    const blob = await item.getType(format);
    const invalid = () => new Error('動画を読み取れません。ZenzaWatchでもう一度コピーしてください。');
    if (blob.size < 5) throw invalid();
    const length = new DataView(await blob.slice(0,4).arrayBuffer()).getUint32(0);
    if (!length || length > 2048 || 4 + length >= blob.size) throw invalid();
    let info;
    try { info = JSON.parse(await blob.slice(4,4+length).text()); } catch (_) { throw invalid(); }
    if (!mediaTypes.includes(info?.type) || typeof info.name !== 'string') throw invalid();
    const extension = info.type === 'video/mp4' ? '.mp4' : '.webm';
    const stem = info.name.replace(/\.(mp4|webm)$/i,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,160);
    return new File([blob.slice(4+length)],(stem || 'clip') + extension,{type:info.type});
  }
  return {supported, copy, read};
})();
//===END===
export {ShareClipClipboard};

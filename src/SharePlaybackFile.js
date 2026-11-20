//===BEGIN===
// The player must supply the original source as well as the rendered video.
// A MediaSource object URL from an HLS player is not a movie file.
const SharePlaybackFile = (() => {
  const videoCodecs = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'av01', 'vp09', 'mp4v']);
  const audioCodecs = new Set(['mp4a', 'Opus', 'ac-3', 'ec-3', 'fLaC']);
  const containers = new Set(['trak', 'mdia', 'minf', 'stbl']);
  const typeAt = (view, pos) => String.fromCharCode(view.getUint8(pos), view.getUint8(pos + 1),
    view.getUint8(pos + 2), view.getUint8(pos + 3));
  function readBox(view, offset, remaining) {
    if (remaining < 8 || view.byteLength - offset < 8) return null;
    let size = view.getUint32(offset);
    let header = 8;
    if (size === 1) {
      if (remaining < 16 || view.byteLength - offset < 16) return null;
      size = Number(view.getBigUint64(offset + 8));
      header = 16;
    } else if (!size) {
      size = remaining;
    }
    return Number.isSafeInteger(size) && size >= header && size <= remaining
      ? {type:typeAt(view, offset + 4), size, header} : null;
  }
  function plainTracks(buffer) {
    // Protection signaling may also be nested in a sample entry or sample group.
    // Fail closed on signaling and fragmented movies. The converter handles progressive MP4 files.
    if (/pssh|sinf|schm|tenc|senc|seig|encv|enca|drms|drmi|uuid|mvex/.test(new TextDecoder('latin1').decode(buffer))) return false;
    const view = new DataView(buffer);
    let hasVideo = false;
    function inspect(start, end, depth) {
      if (depth > 5) return false;
      for (let i = start; i < end;) {
        const box = readBox(view, i, end - i);
        if (!box) return false;
        const content = i + box.header;
        const next = i + box.size;
        if (containers.has(box.type) && !inspect(content, next, depth + 1)) return false;
        if (box.type === 'stsd') {
          if (next - content < 8) return false;
          const count = view.getUint32(content + 4);
          if (!count) return false;
          let pos = content + 8;
          for (let j = 0; j < count; j++) {
            const entry = readBox(view, pos, next - pos);
            if (!entry || !(videoCodecs.has(entry.type) || audioCodecs.has(entry.type))) return false;
            hasVideo ||= videoCodecs.has(entry.type);
            pos += entry.size;
          }
          if (pos !== next) return false;
        }
        i = next;
      }
      return true;
    }
    return inspect(0, view.byteLength, 0) && hasVideo;
  }
  async function isPlainMovie(blob, current) {
    if (!/^(?:video|application)\/mp4(?:;|$)/i.test(blob.type)) return false;
    let movie = false, media = false;
    for (let offset = 0, count = 0; offset < blob.size; count++) {
      if (count >= 256 || !current()) return false;
      const header = new DataView(await blob.slice(offset, offset + 16).arrayBuffer());
      const box = readBox(header, 0, blob.size - offset);
      if (!box || (!offset && box.type !== 'ftyp') ||
          !['ftyp','mdat','moov','free','skip','wide'].includes(box.type)) return false;
      if (box.type === 'mdat') media ||= box.size > box.header;
      if (box.type === 'moov') {
        if (movie || box.size > 16 * 1024 * 1024 || !current()) return false;
        movie = plainTracks(await blob.slice(offset + box.header, offset + box.size).arrayBuffer());
        if (!movie) return false;
      }
      offset += box.size;
    }
    return media && movie && current();
  }
  async function get(video, assigned, {signal, isCurrent, keepOriginal = false} = {}) {
    if (!video || !assigned || typeof isCurrent !== 'function') return null;
    const object = video.srcObject;
    const selected = video.currentSrc;
    const sameSource = () => video.srcObject === object && video.currentSrc === selected;
    if (!isCurrent() || signal?.aborted || video.mediaKeys) return null;
    // The export owns the initially selected URL/Blob. Never look up a replacement
    // after a navigation. The bytes themselves still undergo the full format check.
    const current = () => !signal?.aborted && (keepOriginal
      ? !sameSource() || !video.mediaKeys
      : isCurrent() && sameSource() && !video.mediaKeys);
    try {
      let blob;
      if (object) {
        if (!(object instanceof Blob) || object !== assigned) return null;
        blob = object;
      } else {
        if (typeof assigned !== 'string' || !selected) return null;
        const url = new URL(assigned, location.href);
        if (url.href !== selected || url.origin !== location.origin) return null;
        const options = {signal, mode:'same-origin', redirect:'error'};
        if (url.protocol === 'https:' && /\.(?:mp4|m4v)$/i.test(url.pathname)) {
          // A controlling worker could choose its own network strategy despite the cache mode.
          if (navigator.serviceWorker?.controller) return null;
          options.cache = 'only-if-cached';
        } else if (url.protocol !== 'blob:') {
          return null;
        }
        const response = await fetch(url.href, options);
        if (!current() || response.status !== 200 || response.headers.has('Content-Range') ||
            !/^(?:video|application)\/mp4(?:;|$)/i.test(response.headers.get('Content-Type') || '')) {
          await response.body?.cancel();
          return null;
        }
        blob = await response.blob();
      }
      return current() && await isPlainMovie(blob, current) ? blob : null;
    } catch (_) {
      // Cache misses, stale/revoked object URLs and unsupported files use the normal clip flow.
      return null;
    }
  }
  return {get};
})();
//===END===
export {SharePlaybackFile};

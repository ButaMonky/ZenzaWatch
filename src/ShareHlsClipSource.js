import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
//===BEGIN===
//@require RequestDiagnostics
// Build a finite, in-memory view of the selected interval. Only resources named
// by this view are opened by the converter. The player's currentTime is untouched.
const ShareHlsClipSource = (() => {
  const hosts = new Set(['delivery.domand.nicovideo.jp', 'asset.domand.nicovideo.jp']);
  const unsupported = () => Object.assign(new Error('この配信形式の区間を直接処理できません。'), {kind:'schema',missing:'playlist'});
  const resolve = (value, base) => {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.has(url.hostname)) throw unsupported();
    return url.href;
  };
  function accepts(value) {
    try { return typeof value === 'string' && /\.m3u8$/i.test(new URL(resolve(value)).pathname); }
    catch (_) { return false; }
  }
  function attributes(tag) {
    return Object.fromEntries([...tag.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)]
      .map(([,key,value]) => [key,value.replace(/^"|"$/g,'')]));
  }
  const linesOf = text => {
    const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines[0] !== '#EXTM3U') throw unsupported();
    return lines;
  };
  function chooseVariant(lines, height) {
    const variants = [], audio = [];
    for (const [i, tag] of lines.entries()) {
      const a = attributes(tag);
      if (tag.startsWith('#EXT-X-MEDIA:') && a.TYPE === 'AUDIO') audio.push({tag,a});
      if (tag.startsWith('#EXT-X-STREAM-INF:') && lines[i+1] && !lines[i+1].startsWith('#')) {
        variants.push({tag,a,path:lines[i+1],height:Number(a.RESOLUTION?.split('x')[1]) || 0});
      }
    }
    if (!variants.length) return null;
    // Match the visible picture size when several permitted quality levels exist.
    const bitrate = v => Number(v.a['AVERAGE-BANDWIDTH']) || Number(v.a.BANDWIDTH) || Infinity;
    if (height > 0) {
      const below = variants.filter(v => v.height > 0 && v.height <= height);
      if (below.length) variants.splice(0,variants.length,...below);
      variants.sort((a,b) => Math.abs(a.height-height) - Math.abs(b.height-height) || bitrate(b)-bitrate(a));
    } else {
      // Some legacy low-resolution renditions use more bytes than a newer 360p encode.
      variants.sort((a,b) => bitrate(a)-bitrate(b) || a.height-b.height);
    }
    const choice = variants[0], group = audio.filter(track => track.a['GROUP-ID'] === choice.a.AUDIO);
    const track = group.find(track => track.a.DEFAULT === 'YES') || group[0];
    if (choice.a.AUDIO && !track) throw unsupported();
    return {choice,track};
  }
  function windowPlaylist(lines, base, from, to, resources) {
    if (!lines.includes('#EXT-X-ENDLIST') || lines.some(line => /^#EXT-X-(?:BYTERANGE|DISCONTINUITY(?:$|:)|GAP|SKIP|PART:)/.test(line))) throw unsupported();
    let sequence = 0, index = 0, position = 0, duration, map, key = '#EXT-X-KEY:METHOD=NONE';
    let previousMap, previousKey, count = 0;
    const result = ['#EXTM3U','#EXT-X-VERSION:6',lines.find(line => line.startsWith('#EXT-X-TARGETDURATION:')) || '#EXT-X-TARGETDURATION:10','#EXT-X-PLAYLIST-TYPE:VOD'];
    function resource(path) {
      const url = resolve(path,base);
      resources.add(url);
      return url;
    }
    function withResource(tag) {
      if (!tag.includes('URI=')) return tag;
      if (!/URI="[^"]+"/.test(tag)) throw unsupported();
      return tag.replace(/URI="([^"]+)"/, (_,path) => 'URI="' + resource(path) + '"');
    }
    function emitKey(tag) {
      if (tag !== previousKey) result.push(withResource(tag));
      previousKey = tag;
    }
    for (const line of lines) {
      if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) sequence = Number(line.split(':')[1]);
      else if (line.startsWith('#EXT-X-KEY:')) {
        const a = attributes(line);
        if (!(a.METHOD === 'NONE' || (a.METHOD === 'AES-128' && a.URI && (!a.KEYFORMAT || a.KEYFORMAT === 'identity')))) throw unsupported();
        key = line;
      } else if (line.startsWith('#EXT-X-MAP:')) {
        if (attributes(line).BYTERANGE) throw unsupported();
        map = {tag:line,key};
      } else if (line.startsWith('#EXTINF:')) duration = Number(line.slice(8).split(',')[0]);
      else if (!line.startsWith('#')) {
        if (!(Number.isFinite(duration) && duration > 0 && Number.isSafeInteger(sequence + index))) throw unsupported();
        if (position < to && position + duration > from) {
          if (!count++) {
            result.push('#EXT-X-MEDIA-SEQUENCE:' + (sequence+index),
              '#EXT-X-PROGRAM-DATE-TIME:' + new Date(Math.round(position*1000)).toISOString());
          }
          if (map && map !== previousMap) {
            emitKey(map.key);
            result.push(withResource(map.tag));
            previousMap = map;
          }
          emitKey(key);
          result.push('#EXTINF:' + duration + ',',resource(line));
        }
        position += duration;
        index++;
        duration = undefined;
      }
    }
    if (!count || position + 0.1 < to) throw unsupported();
    return result.concat('#EXT-X-ENDLIST').join('\n');
  }
  async function create(media, {url,height,cache,videoOnly = false}, from, to, signal = new AbortController().signal) {
    const root = resolve(url), resources = new Set(), lists = new Map();
    let entry = root;
    async function request(path, text = false) {
      signal.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal.addEventListener('abort',abort,{once:true});
      const timeout = setTimeout(() => controller.abort(new DOMException('配信データの受信が時間切れになりました。','TimeoutError')),30000);
      try {
        const response = await fetch(path,{credentials:'include',mode:'cors',redirect:'error',signal:controller.signal});
        if (!response.ok) throw Object.assign(new Error('配信データを取得できません。'),{status:response.status});
        return text ? await response.text() : await response.arrayBuffer();
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort',abort);
      }
    }
    const read = async path => linesOf(await request(path,true));
    const diagnostics = (op, phase) => RequestDiagnostics.begin(op, 'domand', phase, () => !signal.aborted);
    async function loadPlaylists() {
      const lines = await read(root);
      const variant = chooseVariant(lines,height);
      if (!variant) lists.set(root,windowPlaylist(lines,root,from,to,resources));
      else {
        const master = ['#EXTM3U','#EXT-X-VERSION:6'];
        const {choice,track} = variant;
        const video = resolve(choice.path,root);
        if (videoOnly) {
          entry = video;
          lists.set(video,windowPlaylist(await read(video),video,from,to,resources));
          return;
        }
        const paths = new Set([video]);
        if (track) {
          if (track.a.URI) {
            const audio = resolve(track.a.URI,root);
            paths.add(audio);
            master.push(track.tag.replace(/URI="[^"]+"/,() => 'URI="' + audio + '"'));
          } else master.push(track.tag);
        }
        master.push(choice.tag,video);
        lists.set(root,master.join('\n'));
        await Promise.all([...paths].map(async path => {
          lists.set(path,windowPlaylist(await read(path),path,from,to,resources));
        }));
      }
    }
    const playlist = diagnostics('clip-playlist','response');
    try {
      await loadPlaylists();
      playlist.success();
    } catch (error) {
      playlist.failure(error.status || error.kind || error.name === 'TimeoutError' ? error : {kind:'network'});
      throw error;
    }
    const source = new media.CustomPathedSource(entry,async ({path}) => {
      signal.throwIfAborted();
      if (lists.has(path)) return new media.BufferSource(new TextEncoder().encode(lists.get(path)));
      if (!resources.has(path)) throw unsupported();
      const cached = cache?.get(path);
      if (cached) return new media.BlobSource(cached);
      // Parallel audio/video requests must each report failures, even when both arrive together.
      try {
        const bytes = await request(path);
        cache?.put(path,bytes);
        diagnostics('clip-segment','transport').success();
        return new media.BufferSource(bytes);
      } catch (error) {
        diagnostics('clip-segment','transport').failure(error.status || error.name === 'TimeoutError' ? error : {kind:'network'});
        throw error;
      }
    });
    return new media.Input({source,formats:media.HLS_FORMATS});
  }
  return {accepts,create};
})();
//===END===
export {ShareHlsClipSource};

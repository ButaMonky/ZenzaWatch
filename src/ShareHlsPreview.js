import {HlsLibrary} from '../packages/zenza/src/hls/HlsLibrary';
import {ShareHlsClipSource} from './ShareHlsClipSource';
//===BEGIN===
//@require HlsLibrary
//@require ShareHlsClipSource
const ShareHlsPreview = {
  accepts: url => ShareHlsClipSource.accepts(url),
  async attach(video, url, seconds, signal, targetHeight = 0) {
    if (!ShareHlsClipSource.accepts(url)) throw Error('この配信で確認再生を利用できません。');
    signal.throwIfAborted();
    const native = !!video.canPlayType('application/vnd.apple.mpegurl');
    const useNative = () => {
      video.crossOrigin = 'use-credentials';
      video.addEventListener('loadedmetadata', () => { video.currentTime = seconds; }, {once:true,signal});
      video.src = url;
    };
    if (native && !(window.MediaSource || window.ManagedMediaSource)) { useNative(); return; }
    let Hls;
    try { Hls = await HlsLibrary.load(); }
    catch (error) { if (!native) throw error; }
    signal.throwIfAborted();
    if (!Hls?.isSupported()) {
      if (native) { useNative(); return; }
      throw Error('このブラウザーでは配信の確認再生を利用できません。');
    }
    const hls = new Hls({autoStartLoad:false, startPosition:seconds, maxBufferLength:3, maxMaxBufferLength:5,
      backBufferLength:0, xhrSetup(xhr) { xhr.withCredentials = true; }});
    signal.addEventListener('abort', () => hls.destroy(), {once:true});
    hls.on(Hls.Events.MANIFEST_PARSED, (_, {levels}) => {
      if (signal.aborted || !levels.length) return;
      let selected = 0;
      const priority = targetHeight > 0
        ? level => Math.abs(level.height - targetHeight)
        : level => level.averageBitrate || level.bitrate || Infinity;
      for (let index = 1; index < levels.length; index++) {
        const score = priority(levels[index]), best = priority(levels[selected]);
        if (score < best || (targetHeight === 0 && score === best && levels[index].height < levels[selected].height)) selected = index;
      }
      hls.startLevel = hls.loadLevel = selected;
      hls.startLoad(seconds);
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal && !signal.aborted) video.dispatchEvent(new Event('error'));
    });
    hls.attachMedia(video);
    hls.loadSource(url);
  }
};
//===END===
export {ShareHlsPreview};

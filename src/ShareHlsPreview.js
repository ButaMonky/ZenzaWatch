import {HlsLibrary} from '../packages/zenza/src/hls/HlsLibrary';
import {ShareHlsClipSource} from './ShareHlsClipSource';
//===BEGIN===
//@require HlsLibrary
//@require ShareHlsClipSource
const ShareHlsPreview = {
  accepts: url => ShareHlsClipSource.accepts(url),
  async attach(video, url, seconds, signal, targetHeight = 0, onFailure) {
    if (!ShareHlsClipSource.accepts(url)) throw Error('この配信で確認再生を利用できません。');
    signal.throwIfAborted();
    const native = !!video.canPlayType('application/vnd.apple.mpegurl');
    const useNative = () => {
      video.crossOrigin = 'use-credentials';
      video.src = url;
    };
    if (native && !(window.MediaSource || window.ManagedMediaSource)) { useNative(); return; }
    let Hls;
    try { Hls = await HlsLibrary.load(); }
    catch (_) {
      signal.throwIfAborted();
      if (native) { useNative(); return; }
      onFailure({message:'プレビュー用のHLSライブラリを読み込めませんでした。',kind:'module-load',missing:'hlsLibrary'});
      return;
    }
    signal.throwIfAborted();
    if (!Hls?.isSupported()) {
      if (native) { useNative(); return; }
      onFailure({message:'このブラウザーでは配信の確認再生を利用できません。',reason:'not supported',missing:'mediaSource'});
      return;
    }
    const hls = new Hls({autoStartLoad:false, startPosition:seconds, maxBufferLength:3, maxMaxBufferLength:5,
      backBufferLength:0, xhrSetup(xhr) { xhr.withCredentials = true; }});
    signal.addEventListener('abort', () => hls.destroy(), {once:true});
    hls.on(Hls.Events.MANIFEST_PARSED, (_, {levels}) => {
      if (signal.aborted) return;
      if (!levels?.length) {
        onFailure({message:'配信一覧にプレビュー用の画質がありません。', kind:'schema', missing:'levels'});
        return;
      }
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
      if (!data.fatal || signal.aborted) return;
      const detail = String(data.details || '');
      const part = /manifest/i.test(detail) ? ['配信一覧','manifest'] :
        /level|audioTrack/i.test(detail) ? ['画質・音声の一覧','rendition'] :
        /key/i.test(detail) ? ['配信の鍵情報','key'] :
        /frag/i.test(detail) ? ['選んだ区間の配信データ','fragment'] : ['映像・音声の復号と再生','decoder'];
      const status = Number(data.response?.code);
      const failure = {message:part[0] + 'を読み込めませんでした。', missing:part[1]};
      if (status >= 400 && status <= 599) failure.status = status;
      else if (/timeout/i.test(detail)) failure.kind = 'timeout';
      else if (/parsing|incompatible/i.test(detail)) failure.kind = 'schema';
      else if (data.type === 'networkError') failure.kind = 'network';
      else failure.reason = 'not supported';
      onFailure(failure);
    });
    hls.attachMedia(video);
    hls.loadSource(url);
  }
};
//===END===
export {ShareHlsPreview};

import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
//===BEGIN===
//@require RequestDiagnostics
const ShareFastClip = (() => {
  // Mediabunny 1.66.1, MPL-2.0. https://github.com/Vanilagy/mediabunny/tree/v1.66.1
  const moduleUrl = 'https://cdn.jsdelivr.net/npm/mediabunny@1.66.1/dist/bundles/mediabunny.min.mjs';
  const digest = '19062c195ea4d32bc4eefd3a7254ae0e8a901bc0607ac3a0174013e165980498';
  let library;
  async function load() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const diagnostic = typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('clip-library', 'mediabunny', 'response');
    let failure = {kind:'network'};
    let url;
    try {
      const response = await fetch(moduleUrl, {credentials:'omit', referrerPolicy:'no-referrer', signal:controller.signal});
      if (!response.ok) {
        failure = {status:response.status};
        throw Error('変換ライブラリを取得できません。');
      }
      const bytes = await response.arrayBuffer();
      failure = {kind:'module-load'};
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      if (Array.from(hash, n => n.toString(16).padStart(2, '0')).join('') !== digest) {
        failure = {kind:'integrity'};
        throw Error('変換ライブラリを検証できません。');
      }
      url = URL.createObjectURL(new Blob([bytes], {type:'text/javascript'}));
      const module = await import(url);
      diagnostic?.success();
      return module;
    } catch (error) {
      diagnostic?.failure(controller.signal.aborted ? {kind:'timeout'} : failure);
      throw error;
    } finally {
      clearTimeout(timeout);
      if (url) URL.revokeObjectURL(url);
    }
  }
  async function convert({blob, from, to, signal, onProgress, drawFrame}) {
    if (!(blob instanceof Blob) || !Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from) throw Error('元ファイルまたは指定範囲が無効です。');
    signal?.throwIfAborted();
    if (!library) library = load().catch(error => { library = null; throw error; });
    const media = await library;
    signal?.throwIfAborted();
    const input = new media.Input({source:new media.BlobSource(blob), formats:[media.MP4, media.QTFF, media.MATROSKA, media.WEBM]});
    let conversion, cancellation;
    const cancel = () => {
      if (conversion && !cancellation) cancellation = conversion.cancel().catch(() => {});
      return cancellation;
    };
    try {
      const [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
      if (!video) throw Error('元ファイルに映像がありません。');
      const parts = [];
      const target = new media.AppendOnlyStreamTarget(new WritableStream({write(chunk) { parts.push(new Blob([chunk])); }}));
      const output = new media.Output({format:new media.Mp4OutputFormat({fastStart:'fragmented'}), target});
      const videoOptions = {codec:'avc'};
      if (drawFrame) {
        const [w, h] = await Promise.all([video.getDisplayWidth(), video.getDisplayHeight()]);
        const scale = Math.min(1, 1920 / Math.max(w,h), 1080 / Math.min(w,h));
        const width = Math.max(2, 2 * Math.round(w * scale / 2));
        const height = Math.max(2, 2 * Math.round(h * scale / 2));
        const image = document.createElement('canvas'), frame = document.createElement('canvas');
        image.width = frame.width = width;
        image.height = frame.height = height;
        const sourceCtx = image.getContext('2d'), frameCtx = frame.getContext('2d');
        Object.assign(videoOptions, {processedWidth:width, processedHeight:height, allowTransformationMetadata:false,
          process(sample) {
            signal?.throwIfAborted();
            sample.draw(sourceCtx, 0, 0, width, height);
            if (drawFrame(frameCtx, width, height, image, from + sample.timestamp) !== true) throw Error('フレームを合成できません。');
            return frame;
          }});
      }
      signal?.throwIfAborted();
      conversion = await media.Conversion.init({input, output, tracks:'primary', trim:{start:from, end:to},
        copy:{mode:'preferred', shiftTolerance:0, boundaryTolerance:0, boundaryPolicy:'shrink'},
        video:videoOptions, audio:{codec:'aac'}, tags:{}, showWarnings:false});
      if (!conversion.isValid || !conversion.utilizedTracks.includes(video) || (audio && !conversion.utilizedTracks.includes(audio))) throw Error('この端末で元の映像・音声を変換できません。');
      signal?.throwIfAborted();
      signal?.addEventListener('abort', cancel, {once:true});
      conversion.onProgress = onProgress;
      await conversion.execute();
      signal?.throwIfAborted();
      const result = new Blob(parts, {type:'video/mp4'});
      if (!result.size) throw Error('映像を書き出せませんでした。');
      return result;
    } catch (error) {
      await cancel();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      input.dispose();
    }
  }
  return {convert};
})();
//===END===
export {ShareFastClip};

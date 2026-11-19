import {CommentPictureInPicture} from '../packages/zenza/src/commentLayer/CommentPictureInPicture';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
//===BEGIN===
//@require CommentPictureInPicture
//@require ScreenFilter
const ShareClipRenderer = {
  create({video, comments = false, effects = false, config, getViewModel}) {
    if (comments && (!config?.props || typeof getViewModel !== 'function')) {
      throw new Error('コメントの描画に必要な情報を取得できません。');
    }
    let renderer = comments ? new CommentPictureInPicture.CommentRenderer({config}) : null;
    let disposed = false;
    function drawFrame(ctx, width, height, image, sec) {
      if (disposed || !image || !(width > 0 && height > 0)) return false;
      const sourceWidth = image.videoWidth ?? image.displayWidth ?? image.width;
      const sourceHeight = image.videoHeight ?? image.displayHeight ?? image.height;
      if (!(sourceWidth > 0 && sourceHeight > 0)) return false;
      const viewModel = comments && getViewModel();
      if (comments && (!Number.isFinite(sec) || typeof viewModel?.getGroup !== 'function')) {
        throw new Error('この動画のコメントを取得できません。');
      }
      const scale = Math.min(width / sourceWidth, height / sourceHeight);
      const w = sourceWidth * scale, h = sourceHeight * scale;
      const x = (width - w) / 2, y = (height - h) / 2;
      ctx.save();
      try {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        if (effects) {
          if (!('filter' in ctx) && !ScreenFilter.bypass && ScreenFilter.buildFilter() !== 'none') {
            throw new Error('このブラウザーでは選択中の画面エフェクトを書き出せません。');
          }
          ScreenFilter.drawVideo(ctx, image, x, y, w, h, {target:'clip'});
        } else {
          ctx.drawImage(image, x, y, w, h);
        }
        if (renderer) {
          renderer.draw(ctx, {viewModel, sec, width, height, now:performance.now()});
        }
        return true;
      } finally {
        ctx.restore();
      }
    }
    return {
      drawFrame,
      draw(ctx, width, height) {
        return !!video && !video.seeking && video.readyState >= 2 &&
          drawFrame(ctx, width, height, video, video.currentTime);
      },
      dispose() {
        disposed = true;
        renderer?.clearCache();
        renderer = null;
        video = getViewModel = null;
      }
    };
  }
};
//===END===
export {ShareClipRenderer};

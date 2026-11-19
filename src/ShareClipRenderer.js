import {CommentPictureInPicture} from '../packages/zenza/src/commentLayer/CommentPictureInPicture';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
//===BEGIN===
//@require CommentPictureInPicture
//@require ScreenFilter
const ShareClipRenderer = {
  // NicoChatGroupViewModel.reset() resets every member in place. Keep only the
  // layout values the canvas renderer needs, including comments already in flight.
  captureComments(viewModel, from, to) {
    if (typeof viewModel?.getGroup !== 'function') throw Error('この動画のコメントを取得できません。');
    const groups = new Map();
    const fields = ['type', 'isFixed', 'isReverse', 'isOverflow', 'fontSizePixel', 'fontCommand',
      'lineHeight', 'isLineResized', 'size', 'color', 'commentVer', 'width', 'height', 'cssScale', 'cssScaleY',
      'ypos', 'duration', 'speed', 'opacity', 'fork', 'htmlText', 'text'];
    for (const type of ['naka', 'ue', 'shita']) {
      const members = [];
      for (const chat of viewModel.getGroup(type)?.members || []) {
        const beginLeftTiming = chat.beginLeftTiming, endRightTiming = chat.endRightTiming;
        if (beginLeftTiming > to + 1 || endRightTiming < from - 2 || chat.isInvisible ||
            !chat.isInViewBySecond(beginLeftTiming)) continue;
        const copy = {beginLeftTiming, endRightTiming, isInViewBySecond(sec) {
          return sec + 1 >= this.beginLeftTiming && sec <= this.endRightTiming;
        }};
        for (const name of fields) copy[name] = chat[name];
        members.push(copy);
      }
      groups.set(type, {members});
    }
    return {getGroup:type => groups.get(type)};
  },
  create({video, comments = false, effects = false, config, getViewModel, from, to}) {
    if (comments && (!config?.props || typeof getViewModel !== 'function')) {
      throw new Error('コメントの描画に必要な情報を取得できません。');
    }
    const exporting = Number.isFinite(from) && Number.isFinite(to);
    let savedComments = null, savedStyle = null;
    if (exporting) {
      if (comments) {
        savedComments = ShareClipRenderer.captureComments(getViewModel(), from, to);
        const props = {};
        for (const key of ['baseFontBolder', 'cssFontWeight', 'baseFontFamily', 'commentLayerOpacity',
          'commentLayer.easyCommentOpacity', 'commentLayer.aiCommentOpacity']) props[key] = config.props[key];
        config = {props};
      }
      if (effects) savedStyle = ScreenFilter.captureClipStyle();
      getViewModel = null;
    }
    let renderer = comments ? new CommentPictureInPicture.CommentRenderer({config}) : null;
    let disposed = false;
    function drawFrame(ctx, width, height, image, sec) {
      if (disposed || !image || !(width > 0 && height > 0)) return false;
      const sourceWidth = image.videoWidth ?? image.displayWidth ?? image.width;
      const sourceHeight = image.videoHeight ?? image.displayHeight ?? image.height;
      if (!(sourceWidth > 0 && sourceHeight > 0)) return false;
      const viewModel = comments && (savedComments || getViewModel());
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
          if (!('filter' in ctx) && (savedStyle ? savedStyle.filter !== 'none' :
              !ScreenFilter.bypass && ScreenFilter.buildFilter() !== 'none')) {
            throw new Error('このブラウザーでは選択中の画面エフェクトを書き出せません。');
          }
          if (savedStyle) savedStyle.draw(ctx, image, x, y, w, h);
          else ScreenFilter.drawVideo(ctx, image, x, y, w, h, {target:'clip'});
        } else {
          ctx.drawImage(image, x, y, w, h);
        }
        if (renderer) {
          renderer.draw(ctx, {viewModel, sec, width, height, now:sec * 1000});
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
        savedStyle?.dispose();
        savedStyle = savedComments = null;
        renderer = null;
        video = getViewModel = null;
      }
    };
  }
};
//===END===
export {ShareClipRenderer};

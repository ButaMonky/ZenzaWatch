import {CommentDisplayBudget} from '../packages/zenza/src/commentLayer/CommentDisplayBudget';
import {NicoChat} from '../packages/zenza/src/commentLayer/NicoChat';
import {NicoChatViewModel} from '../packages/zenza/src/commentLayer/NicoChatViewModel';
import {CommentPictureInPicture} from '../packages/zenza/src/commentLayer/CommentPictureInPicture';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
//===BEGIN===
//@require CommentPictureInPicture
//@require ScreenFilter
//@require CommentDisplayBudget
//@require NicoChat
//@require NicoChatViewModel
const ShareClipRenderer = {
  // NicoChatGroupViewModel.reset() resets every member in place. Keep only the
  // layout values the canvas renderer needs, including comments already in flight.
  captureComments(viewModel, from, to, limit) {
    if (typeof viewModel?.getGroup !== 'function') throw Error('この動画のコメントを取得できません。');
    const groups = new Map(), arrivals = new Map();
    const margin = 2 * (NicoChatViewModel.SPEED_RATE || 1);
    const fields = ['type', 'isFixed', 'isReverse', 'isOverflow', 'fontSizePixel', 'fontCommand',
      'lineHeight', 'isLineResized', 'size', 'color', 'commentVer', 'width', 'height', 'cssScale', 'cssScaleY',
      'ypos', 'duration', 'speed', 'opacity', 'fork', 'htmlText', 'text'];
    for (const type of ['naka', 'ue', 'shita']) {
      const group = viewModel.getGroup(type), members = [];
      groups.set(type, {members});
      const candidates = group?.getMembersInRange ? group.getMembersInRange(from - 2, to + 1) : group?.members || [];
      for (const chat of candidates) {
        const beginLeftTiming = chat.beginLeftTiming, endRightTiming = chat.endRightTiming;
        if (beginLeftTiming > to + 1 || endRightTiming < from - (chat.isFixed ? 0 : 2) || chat.isInvisible ||
            !chat.isInViewBySecond(beginLeftTiming)) continue;
        const copy = {beginLeftTiming, endRightTiming, isInViewBySecond(sec) {
          return sec + 1 >= this.beginLeftTiming && sec <= this.endRightTiming;
        }};
        for (const name of fields) copy[name] = chat[name];
        copy.vpos = chat.vpos;
        copy.threadId = chat.threadId;
        copy.no = chat.no;
        copy.tier = CommentDisplayBudget.tierOf(chat, viewModel.isHistoryChat?.(chat));
        copy.commentArtGroup = chat.commentArtGroup;
        const tick = Math.max(0, Math.ceil((beginLeftTiming - 1 - from) * 10));
        if (!arrivals.has(tick)) arrivals.set(tick, []);
        arrivals.get(tick).push(copy);
      }
    }
    // Seek into the range, then admit each batch of new arrivals once. An admitted
    // row keeps its slot until expiry, even if a higher-priority row arrives later.
    let expires = [];
    for (const tick of [...arrivals.keys()].sort((a,b) => a-b)) {
      const time = from + tick / 10;
      expires = expires.filter(end => end > time);
      const {admitted} = CommentDisplayBudget.admit(arrivals.get(tick), {
        liveCount:expires.length, limit, tierOf:chat => chat.tier,
        order:NicoChat.SORT_FUNCTION, groupOf:chat => chat.commentArtGroup
      });
      for (const chat of admitted) {
        groups.get(chat.type).members.push(chat);
        if (chat.tier >= 0) expires.push(chat.endRightTiming + margin);
      }
    }
    return {clipAdmissionApplied:true, getGroup:type => groups.get(type)};
  },
  prepareComments(viewModel, from, to, limit, signal, isCurrent) {
    if (!viewModel?.getGroup) throw Error('この動画のコメントを取得できません。');
    const groups = ['naka','ue','shita'].map(type => viewModel.getGroup(type));
    if (groups.some(g => !g)) throw Error('コメントを読み込み中です。少し待ってから再試行してください。');
    const sources = groups.map(g => g._nicoChatGroup?._members);
    const history = viewModel.pendingHistoryLayout;
    const ready = () => !history?.pending && groups.every(g => g.clipLayoutReady !== false);
    const capture = () => ShareClipRenderer.captureComments(viewModel, from, to, limit);
    if (signal?.aborted) throw signal.reason || new DOMException('中止しました。','AbortError');
    if (ready()) return capture();
    return (async () => {
      const until = Date.now() + 20000;
      for (;;) {
        if (signal?.aborted) throw signal.reason || new DOMException('中止しました。','AbortError');
        if (history?.error) throw Error('増量コメントの反映が完了しませんでした。件数を確認してから再試行してください。');
        const expected = history?.sources || sources;
        if ((isCurrent && !isCurrent()) || groups.some((g,i) => g._nicoChatGroup?._members !== expected[i])) {
          throw Error('コメントの準備中に動画またはコメントが切り替わりました。元の動画から再試行してください。');
        }
        if (ready()) return capture();
        if (Date.now() >= until) throw Error('コメントの配置が完了しませんでした。読み込み完了後に再試行してください。');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    })();
  },
  create({video, comments = false, effects = false, config, getViewModel, from, to, signal, isCurrent}) {
    if (comments && (!config?.props || typeof getViewModel !== 'function')) {
      throw new Error('コメントの描画に必要な情報を取得できません。');
    }
    const exporting = Number.isFinite(from) && Number.isFinite(to);
    let savedComments = null, savedStyle = null;
    if (exporting) {
      if (comments) {
        savedComments = ShareClipRenderer.prepareComments(getViewModel(), from, to,
          config.props['commentLayer.maxDisplayComment'], signal, isCurrent);
        const props = {};
        for (const key of ['baseFontBolder', 'cssFontWeight', 'baseFontFamily', 'commentLayerOpacity',
          'commentLayer.easyCommentOpacity', 'commentLayer.aiCommentOpacity']) props[key] = config.props[key];
        config = {props};
      }
      if (effects) savedStyle = ScreenFilter.captureClipStyle();
      getViewModel = null;
    }
    const drawing = snapshot => ShareClipRenderer.createDrawing({video, comments, effects, config,
      getViewModel, savedComments:snapshot, savedStyle});
    return savedComments?.then ? savedComments.then(drawing, error => {
      savedStyle?.dispose();
      throw error;
    }) : drawing(savedComments);
  },
  createDrawing({video, comments, effects, config, getViewModel, savedComments, savedStyle}) {
    let renderer = comments ? new CommentPictureInPicture.CommentRenderer({config, smoothSmallText:!!savedComments}) : null;
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

// @ts-expect-error Legacy relative import is resolved in packages/zenza, not this typed mirror.
import {NicoChat} from './NicoChat';
// @ts-expect-error Same production-relative import preserved for JS parity.
import {CommentLayer} from './CommentLayer';
// @ts-expect-error Same production-relative import preserved for JS parity.
import {cssUtil} from '../../../lib/src/css/css';
// Task593: typed interface for existing comment-layer behavior.
export interface NicoChatCss3ViewContract {
  readonly chat: unknown;
  readonly cssText?: string;
  readonly renderedHtml?: string;
}
/** Normalized rendering data supplied by NicoChatViewModel. */
export interface NicoChatCssRenderInput {
  id: string;
  meta: string;
  htmlText: string;
  commentVer: string;
  size: string;
  color: string;
  fork: number;
  duration: number;
  speed: number;
  beginLeftTiming: number;
  width: number;
  height: number;
  ypos: number;
  slot: number;
  opacity: number;
  cssScale: number;
  cssScaleY: number;
  fontSizePixel: number;
  lineHeight: number;
  isDoubleResized: boolean;
  isLineResized: boolean;
  isOverflow: boolean;
  isMine: boolean;
  isUpdating: boolean;
  isInvisible: boolean;
  isSubThread: boolean;
  isPostFail: boolean;
  isReverse: boolean;
  nicotta: boolean | number;
  fontCommand: string | null | undefined;
}
export interface NicoChatCssResult {
  inline: string;
  keyframes?: string;
}
//===BEGIN===
class NicoChatCss3View {
  /**
   *
   * @param {NicoChatViewModel}chat
   * @param {string} type
   * @param {string} size
   * @param {{inline: string, keyframes: string}} cssText
   * @return {HTMLElement}
   */
  static buildChatDom (chat: NicoChatCssRenderInput, type: string, size: string, cssText?: NicoChatCssResult, document: Document = window.document): HTMLSpanElement {
    const span = document.createElement('span');
    const ver = chat.commentVer;
    const className = ['nicoChat', 'hidden', type, size];
    if (ver === 'html5') {
      className.push(ver);
    }
    if (chat.color === '#000000') {
      className.push('black');
    }

    if (chat.isDoubleResized) {
      className.push('is-doubleResized');
    } else if (chat.isLineResized) {
      className.push('is-lineResized');
    }

    if (chat.isOverflow) {
      className.push('overflow');
    }
    if (chat.isMine) {
      className.push('mine');
    }
    if (chat.isUpdating) {
      className.push('updating');
    }
    if (chat.nicotta) {
      className.push('nicotta');
    }
    let fork = chat.fork;
    className.push(`fork${fork}`);

    // if (chat.isSubThread) {
    //   className.push('subThread');
    // }

    if (chat.isPostFail) {
      className.push('fail');
    }

    const fontCommand = chat.fontCommand;
    if (fontCommand) {
      className.push(`cmd-${fontCommand}`);
    }

    span.className = className.join(' ');
    span.id = chat.id;
    span.dataset.meta = chat.meta;

    if (!chat.isInvisible) {
      const {inline, keyframes} = cssText || {};
      if (inline) {
        span.style.cssText = inline;
      }
      span.innerHTML = chat.htmlText;
      if (keyframes) {
        const style = document.createElement('style');
        style.append(keyframes);
        span.append(style);
      }
    }
    return span;
  }

  static buildStyleElement (cssText: string, document: Document = window.document): HTMLStyleElement {
    const elm = document.createElement('style');
    elm.type = 'text/css';
    elm.append(cssText);
    return elm;
  }

  static buildChatHtml (chat: NicoChatCssRenderInput, type: string, cssText: NicoChatCssResult, document: Document = window.document): string {
    const result = NicoChatCss3View.buildChatDom(chat, type, chat.size, cssText, document);
    result.removeAttribute('data-meta');
    return result.outerHTML;
  }

  static buildChatCss (chat: NicoChatCssRenderInput, type: string, currentTime: number = 0, playbackRate: number = 1): NicoChatCssResult {
    return type === NicoChat.TYPE.NAKA ?
      NicoChatCss3View._buildNakaCss(chat, type, currentTime, playbackRate) :
      NicoChatCss3View._buildFixedCss(chat, type, currentTime, playbackRate);
  }

  static _buildNakaCss(chat: NicoChatCssRenderInput, type: string, currentTime: number, playbackRate: number): NicoChatCssResult {
    let id = chat.id;
    let commentVer = chat.commentVer;
    let duration = chat.duration / playbackRate;
    let scale = chat.cssScale;
    let scaleY = chat.cssScaleY;
    let beginL = chat.beginLeftTiming;
    let screenWidth = CommentLayer.SCREEN.WIDTH;
    // let screenWidthFull = NicoCommentViewModel.SCREEN.WIDTH_FULL;
    let screenHeight = CommentLayer.SCREEN.HEIGHT;
    // let width = chat.width;
    let height = chat.height;
    let ypos = chat.ypos;
    let isSub = chat.isSubThread;
    let color = chat.color;
    //color = isSub ? util.toRgba(color ? color : '#FFFFFF', 1) : color;
    let colorCss = color ? `color: ${color};` : '';
    let fontSizePx = chat.fontSizePixel;
    let lineHeightCss = '';
    if (commentVer !== 'html5') {
      lineHeightCss = `line-height: ${Math.floor(chat.lineHeight)}px;`;
    }
    let speed = chat.speed;
    let delay = (beginL - currentTime) / playbackRate;
    let slot = chat.slot;
    let zIndex =
      (slot >= 0) ?
        (slot * 1000 + chat.fork * 1000000 + 1) :
        (1000 + beginL * 1000 + chat.fork * 1000000);
    zIndex = isSub ? zIndex: zIndex * 2;
    // let time3d = '0';//`${delay * 10}px`; //${chat.time3dp * 100}px`;
    const opacity = chat.opacity !== 1 ? `opacity: ${chat.opacity}; --chat-opacity: ${chat.opacity};` : '';

    // 4:3ベースに計算されたタイミングを16:9に補正する
    // scale無指定だとChromeでフォントがぼけるので1.0の時も指定だけする
    // TODO: 環境によって重くなるようだったらオプションにする
    const outerScreenWidth = CommentLayer.SCREEN.OUTER_WIDTH_FULL;
    const screenDiff = outerScreenWidth - screenWidth;
    const leftPos = screenWidth + screenDiff / 2;
    const durationDiff = screenDiff / speed / playbackRate;
    duration += durationDiff;
    delay -= (durationDiff * 0.5);
    // 逆再生
    const reverse = chat.isReverse ? 'animation-direction: reverse;' : '';
    let isAlignMiddle = false;
    if ((commentVer === 'html5' && (height >= screenHeight - fontSizePx / 2 || chat.isOverflow)) ||
      (commentVer !== 'html5' && height >= screenHeight - fontSizePx / 2 && height < screenHeight + fontSizePx)
    ) {
        isAlignMiddle = true;
    }
    const top = isAlignMiddle ? '50%' : `${ypos}px`;
    const isScaled = scale !== 1.0 || scaleY !== 1.0;

    const inline = `
      --chat-trans-x: -${outerScreenWidth + chat.width * scale}px;
      ${isAlignMiddle ? '--chat-trans-y: -50%' : ''};
      ${isScaled ?
        `--chat-scale-x: ${scale};--chat-scale-y: ${scaleY};` : ''}
      display: inline-block;
      position: absolute;
      will-change: transform;
      contain: layout style paint;
      visibility: hidden;
      line-height: 1.235;
      z-index: ${zIndex};
      top: ${top};
      left: ${leftPos}px;
      ${colorCss}
      ${lineHeightCss}
      ${opacity}
      font-size: ${fontSizePx}px;
      animation-name: idou-props${(isScaled || isAlignMiddle) ? '-scaled' : ''}${isAlignMiddle ? '-middle' : ''};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      ${reverse}
      transform:
        translateX(0)
        ;
      content-visibility: hidden;
    `;

    return {inline, keyframes: ''};
  }
  /**
   * @param {NicoChatViewModel} chat
   */
  static _buildFixedCss(chat: NicoChatCssRenderInput, type: string, currentTime: number, playbackRate: number): NicoChatCssResult {
    let scaleCss;
    let commentVer = chat.commentVer;
    let duration = chat.duration / playbackRate;
    let scale = chat.cssScale;// * (chat.isLineResized ? 0.5 : 1);
    let scaleY = chat.cssScaleY;
    let beginL = chat.beginLeftTiming;
    let screenHeight = CommentLayer.SCREEN.HEIGHT;
    let height = chat.height;
    let ypos = chat.ypos;
    let isSub = chat.isSubThread;
    let color = chat.color;
    // color = isSub ? util.toRgba(color ? color : '#FFFFFF', 1) : color;
    let colorCss = color ? `color: ${color};` : '';
    let fontSizePx = chat.fontSizePixel;
    let lineHeightCss = '';
    if (commentVer !== 'html5') {
      lineHeightCss = `line-height: ${Math.floor(chat.lineHeight)}px;`;
    }
    let delay = (beginL - currentTime) / playbackRate;
    let slot = chat.slot;
    let zIndex =
      (slot >= 0) ?
        (slot * 1000 + chat.fork * 1000000 + 1) :
        (1000 + beginL * 1000 + chat.fork * 1000000);
    zIndex = isSub ? zIndex: zIndex * 2;
    let time3d = '0';//`${delay * 10}px`; //${chat.time3dp * 100}px`;
    let opacity = chat.opacity !== 1 ? `opacity: ${chat.opacity}; --chat-opacity: ${chat.opacity};` : '';

    let top;
    let transY;

    // 画面高さに近い・超える時は上端または下端にぴったりつける
    if ((commentVer === 'html5' && height >= screenHeight - fontSizePx / 2 /*|| chat.isOverflow*/) ||
        (commentVer !== 'html5' && height >= screenHeight * 0.7)) {
      top = `${type === NicoChat.TYPE.BOTTOM ? 100 : 0}%`;
      transY = `${type === NicoChat.TYPE.BOTTOM ? -100 : 0}%`;
    } else {
      top = ypos + 'px';
      transY = '0';
    }
    scaleCss =
      scale === 1.0 ?
        `transform: scale3d(1, ${scaleY}, 1) translate3d(-50%, ${transY}, ${time3d});` :
        `transform: scale3d(${scale}, ${scaleY}, 1) translate3d(-50%, ${transY}, ${time3d});`;

    const inline = `
      z-index: ${zIndex};
      top: ${top};
      left: 50%;
      ${colorCss}
      ${lineHeightCss}
      ${opacity}
      font-size: ${fontSizePx}px;
      ${scaleCss}
      animation-duration: ${duration / 0.95}s;
      animation-delay: ${delay}s;
      --dokaben-scale: ${scale};
      content-visibility: hidden;
    `.trim();
    return {inline};
  }

}

//===END===
export {NicoChatCss3View};
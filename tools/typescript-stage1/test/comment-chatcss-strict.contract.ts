import {NicoChatCss3View} from '../comment-src/NicoChatCss3View';
import type {
  NicoChatCssRenderInput, NicoChatCssResult
} from '../comment-src/NicoChatCss3View';

const chat: NicoChatCssRenderInput={
  id:'chat1',meta:'{}',htmlText:'Hello',commentVer:'html5',
  size:'medium',color:'#ffffff',fork:0,duration:4,speed:120,
  beginLeftTiming:12,width:88,height:26,ypos:120,slot:2,opacity:1,
  cssScale:1,cssScaleY:1,fontSizePixel:32,lineHeight:34,
  isDoubleResized:false,isLineResized:false,isOverflow:false,
  isMine:false,isUpdating:false,isInvisible:false,isSubThread:false,
  isPostFail:false,isReverse:false,nicotta:false,fontCommand:'gothic'
};
const css: NicoChatCssResult=NicoChatCss3View.buildChatCss(chat,'naka',12,1);
const html: string=NicoChatCss3View.buildChatHtml(chat,'naka',css);
const style: HTMLStyleElement=NicoChatCss3View.buildStyleElement(css.inline);
void html;void style;
// @ts-expect-error Comment width must be a finite-model numeric field.
const badWidth: NicoChatCssRenderInput={...chat,width:'88'};
// @ts-expect-error CSS inline declaration must remain text.
const badCss: NicoChatCssResult={inline:3};
void badWidth;void badCss;

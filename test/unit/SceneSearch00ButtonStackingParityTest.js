'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
const Layout=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js',
  'SceneSearchLayout00',createContext());
function rule(selector, css){
 const at=css.indexOf(selector);
 assert(at>=0,'missing CSS selector: '+selector);
 const open=css.indexOf('{',at);
 return css.slice(open+1,css.indexOf('}',open));
}
describe('Task637: UI00 original list switch-button stacking parity',()=>{
 it('uses native visual layers: list=100, tooltip=150, flowing mini=160',()=>{
  const css=Layout.CSS;
  const box=rule('.is-scui00-active .seekBarContainer>.zenzaCommentPreview',css);
  const tooltip=rule('.is-scui00-active .seekBarToolTip.is-scui00-root',css);
  const flowing=rule('.is-scui00-active .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview',css);
  const list=rule('.is-scui00-active .seekBarContainer.enableCommentPreview>.zenzaCommentPreview',css);
  assert(!/z-index\s*:\s*320\s*!important/i.test(box),'shared 320 forces list above its exit button');
  assert(/z-index\s*:\s*150\s*!important/i.test(tooltip),'native tooltip and button must be 150');
  assert(/z-index\s*:\s*160\s*!important/i.test(flowing),'native mini preview must be 160');
  assert(/z-index\s*:\s*100\s*!important/i.test(list),'native list must be behind exit button');
 });
 it('keeps list content above native controls without a painted transparent corridor',()=>{
  const css=Layout.CSS;
  const list=rule('.is-scui00-active .seekBarContainer.enableCommentPreview>.zenzaCommentPreview',css);
  assert(list.includes("bottom:var(--scui00-list-bottom,76px)!important"));
  assert(/border-bottom\s*:\s*0\s*!important/i.test(list),
    'list must not paint a background behind the native controls');
  assert(/pointer-events\s*:\s*auto\s*!important/i.test(list),
    'comment rows remain clickable for seek');
 });
 it('does not change mini-mode setting or native button/list ownership',()=>{
  const css=Layout.CSS;
  assert(!css.includes('zenzaSeekThumbnail-image>.zenzaCommentPreview'));
  const list=rule('.is-scui00-active .seekBarContainer.enableCommentPreview>.zenzaCommentPreview',css);
  assert(!/pointer-events\s*:\s*none/i.test(list),'list rows must still work');
  assert(css.includes('.is-scui00-mini-static'));
  assert(css.includes('.is-scui00-mini-hidden'));
 });
});

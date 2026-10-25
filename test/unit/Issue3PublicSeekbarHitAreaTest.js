'use strict';
const assert=require('assert');
const {read}=require('../helpers/extractSource');
const meta="screenMode for-screen-full videoControlBar";
const fullscreenCss=()=>{
 const src=read('src/VideoControlBar.js');
 const end=src.indexOf("{className: '"+meta+"'");
 assert(end>=0,'native fullscreen style must be present');
 const start=src.lastIndexOf('util.addStyle(\x60',end);
 assert(start>=0,'native fullscreen style is missing');
 return src.slice(start,end);
};
describe('Issue #3 public right seek hit-area regression',()=>{
 it('keeps Task101 right controls over seekbar and its open menus',()=>{
   const css=fullscreenCss();
   assert.match(css,/\.seekBarContainer\s*\{[^}]*z-index:\s*300\s*;/);
   assert.match(css,/\.controlItemContainer\.right\s*\{[^}]*z-index:\s*310\s*;/);
   assert.match(css,/\.videoControlBar\.is-menuOpen\s+\.controlItemContainer\.right\s*\{[^}]*z-index:\s*320\s*;/);
 });
 it('lets only noninteractive right-column wrappers pass through seek input',()=>{
   const css=fullscreenCss();
   assert.match(css,/\.videoControlBar\s+\.controlItemContainer\.right,\s*\.videoControlBar\s+\.controlItemContainer\.right\s*>\s*\.scalingUI\s*\{\s*pointer-events:\s*none\s*;/);
   assert.match(css,/:where\(\.videoControlBar\s+\.controlItemContainer\.right\s*>\s*\.scalingUI\)\s*>\s*\.controlButton\s*\{\s*pointer-events:\s*auto\s*;/);
   assert.doesNotMatch(css,/\.videoControlBar\.is-menuOpen\s+\.controlItemContainer\.right\s*\{[^}]*pointer-events\s*:\s*auto/);
 });
 it('does not displace the tooltip or seekbar from earlier fullscreen fixes',()=>{
   const css=fullscreenCss();
   assert.doesNotMatch(css,/zenzaCommentPreview|seekBarToolTip/);
   assert.match(css,/\.seekBar\s*\{[^}]*height:\s*24px/);
 });
 it('bundles only the public seek fix in its installable userscript',()=>{
   const dist=read('dist/ZenzaWatch-dev.user.js');
   const source=read('src/_template.js');
   const version=source.match(/^\/\/ @version\s+(\S+)/m)?.[1];
   assert(version&&version.startsWith('2.7.317-'),version);
   assert(dist.includes(version),'distributed version differs from source');
   assert(dist.includes('pointer-events: none;'));
   assert(dist.includes(':where(.videoControlBar .controlItemContainer.right > .scalingUI) > .controlButton'));
   assert(dist.includes('https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaWatch-dev.user.js'));
   assert(!dist.includes('NotificationHistoryPanel'),'private-only new features must not leak');
 });
});

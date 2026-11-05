'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {JSDOM}=require('jsdom');
const native=require('../../tools/qa/scene-vcb-real-source.cjs');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/VideoControlBar.js'),'utf8');
describe('real VideoControlBar source contract for scene-search Chromium QA',()=>{
 it('preserves the original native range and all three control sections',()=>{
  const dom=new JSDOM('<!doctype html><body>'+native.markup+'</body>');
  const bar=dom.window.document.querySelector('.videoControlBar');
  const range=bar.querySelector('input.seekRange');
  assert(bar&&range);assert.equal(range.type,'range');
  assert.equal(bar.querySelectorAll('input.seekRange').length,1);
  assert.equal(range.id,'range');
  assert.equal(bar.querySelector('.seekBar').id,'seek');
  for(const side of ['left','center','right']){
   assert(bar.querySelector('.controlItemContainer.'+side+' .scalingUI'));
   assert(bar.querySelector('.controlItemContainer.'+side+' .controlButton'));
  }
  assert(bar.querySelectorAll('canvas.heatMap').length===1);
  dom.window.close();
 });
 it('uses the real fullscreen pointer-through and native hover styles',()=>{
  const styles=native.css;
  assert(styles.videoControlBar.includes('.seekBar:hover'));
  assert(styles.videoControlBar.includes('.seekRange'));
  assert(styles.videoControlBar.includes('::-webkit-slider-thumb'));
  assert(styles['screenMode for-screen-full videoControlBar'].includes('pointer-events: none'));
  assert(styles['screenMode for-screen-full videoControlBar'].includes('pointer-events: auto'));
  assert.equal(native.barHeight,40);
 });
 it('ships verbatim seek/drag/long-press/wheel handlers, not stub code',()=>{
  for(const name of ['_getTimelineGeometry','_timeToPos',
   '_onSeekBarMouseDown','_onSeekBarMouseMove',
   '_onSeekRangeInput','_scheduleStoryboardLongPress','_cancelStoryboardLongPress',
   '_bindDragEvent','_unbindDragEvent','_onWheelSeek','_posToTime']){
   assert(native.methods.includes(name+'('),name);
  }
  assert(native.methods.includes('TimelineGeometry.create('),
   'the real geometry dependency must remain in the extracted method');
  assert(native.methods.includes('TimelineGeometry.timeToRatio('),
   'the real time-to-local conversion must not be replaced by a fixture stub');
  assert(native.methods.includes('}, 200)')||
   native.methods.includes('}, 200);'));
  assert(native.wheelMethods.includes('onWheel(e)'));
  assert(native.wheelMethods.includes('dispatchSeek()'));
  assert(native.tooltipMethods.includes('update(sec, left)'));
  assert.equal(native.checksum,crypto.createHash('sha256').update(source).digest('hex'));
 });
 it('refuses unrelated markup or constants instead of using a test-only replacement',()=>{
  assert(native.markup.includes('notificationHistorySwitch controlButton'));
  assert(native.markup.includes('commentHistorySwitch controlButton'));
  assert(native.markup.includes('playbackRateSelectMenu'));
  assert(native.markup.includes('zenzaPopupMenu'));
  assert(native.css.videoControlBar.includes('height: var(--zenza-control-bar-height, 40px)'));
 });
});

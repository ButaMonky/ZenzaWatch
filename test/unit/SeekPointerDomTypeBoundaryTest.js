'use strict';
// Task191: native seek pointer ownership must remain a typed DOM boundary.
// This guard is intentionally layout-neutral: no mouse/seek/SCUI behavior changes.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.resolve(
  __dirname,'../../tools/typescript-stage1/nico-src/VideoControlBar.ts'),'utf8');

describe('Task191 native seekbar DOM owner types',()=>{
  it('keeps the control marker typed as a real HTML element',()=>{
    assert(source.includes('type NativeSeekPointerTarget = HTMLElement;'));
    const bar=source.slice(source.indexOf('class VideoControlBar extends Emitter'),
      source.indexOf('class SmoothSeekBarPointer'));
    assert(bar.includes('declare _seekBarPointer: NativeSeekPointerTarget;'));
  });
  it('requires the same marker contract at SmoothSeekBarPointer constructor',()=>{
    const pointer=source.slice(source.indexOf('class SmoothSeekBarPointer'),
      source.indexOf('class WheelSeeker'));
    assert(pointer.includes('declare _pointer: NativeSeekPointerTarget;'));
    assert(pointer.includes('constructor(params: {'));
    assert(pointer.includes('pointer: NativeSeekPointerTarget;'));
    assert(pointer.includes('getTimelineGeometry: () => TimelineGeometryClass | null;'));
    assert(pointer.includes('this._pointer.style.transform'));
    assert(pointer.includes('this._pointer.classList.toggle'));
  });
});

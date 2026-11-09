'use strict';
// Task189: the video description/timer generations guard against stale updates.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(path.resolve(
  __dirname,'../../tools/typescript-stage1/nico-src/VideoInfoPanel.ts'),'utf8');
const panel=src.slice(src.indexOf('class VideoInfoPanel extends Emitter {'),
  src.indexOf('class VideoHeaderPanel extends Emitter {'));

describe('Task189 typed video information async generations',()=>{
  it('keeps generation and initialization flags explicit rather than Loose',()=>{
    assert(panel.includes('declare _descriptionGeneration: ZenzaDescriptionGeneration | undefined;'));
    assert(panel.includes('declare _autoZenTubeTimerGeneration: ZenzaZenTubeTimerGeneration | undefined;'));
    assert(panel.includes('declare _isInitialized: boolean | undefined;'));
  });
  it('checks delayed updates against current timer, description and model identity',()=>{
    assert(panel.includes('this._descriptionGeneration !== descriptionGeneration'));
    assert(panel.includes('timerGeneration !== this._autoZenTubeTimerGeneration'));
    assert(panel.includes('this._videoInfo !== videoInfo'));
  });
});

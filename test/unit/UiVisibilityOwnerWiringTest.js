'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read}=require('../helpers/extractSource');
const required={
  'src/NicoVideoPlayerDialog.js':["'hover'"],
  'src/VideoControlBar.js':["'bar'"],
  'src/VideoInfoPanel.js':["'info'","'header'","'related'"],
  'src/CommentInputPanel.js':["'comment'"]
};
describe('Task318 visibility owner boundaries',()=>{
  it('connects each UI owner once to the central visibility registry',()=>{
    for(const [file,scopes] of Object.entries(required)){
      const content=read(file);
      assert(content.includes('UiVisibilityRegistry.connect'),file);
      for(const scope of scopes){
        assert(content.includes(scope),file+' missing '+scope);
      }
    }
    assert(read('src/Config.js').includes('UiVisibilityRegistry.defaults()'));
    assert(read('src/ModernAdvancedSettingsModel.js')
      .includes('UiVisibilityRegistry.descriptors()'));
  });
  it('returns to video details if hidden related-video tab was requested',()=>{
    const dom=new JSDOM('<!doctype html><html><body></body></html>');
    const events=[];
    const ctx=createContext({
      Emitter:class {},global:{emitter:{emit:(...args)=>events.push(args)}},
      document:dom.window.document,window:dom.window
    });
    const View=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',ctx);
    const view=Object.create(View.prototype);
    const state={currentTab:'relatedVideoTab'};
    const settings={videoInfoPanelTab:'relatedVideoTab'};
    const calls=[];
    view._playerConfig={props:settings,getValue:key=>
      key==='ui.info.relatedTab'?false:true};
    view._state=state;
    view.videoInfoPanel={selectTab:key=>calls.push(key)};
    view.selectTab('relatedVideoTab');
    assert.strictEqual(state.currentTab,'videoInfoTab');
    assert.strictEqual(settings.videoInfoPanelTab,'videoInfoTab');
    assert.deepStrictEqual(calls,['videoInfoTab']);
    assert.strictEqual(events[0][1],'videoInfoTab');
    dom.window.close();
  });
});

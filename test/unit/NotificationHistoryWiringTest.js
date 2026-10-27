"use strict";
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');
function setup() {
  const button = {hidden:false};
  const container = {querySelector:() => button};
  const calls = [];
  const context = createContext({Emitter:class {}, NotificationHistoryPanel:{mountDock(options) {
    assert.strictEqual(options.container,container); assert.strictEqual(options.button,button);
    calls.push('mount'); return {toggle(){calls.push('toggle');},dispose(){calls.push('dispose');}};
  }}});
  const Dialog = loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',context);
  const dialog = Object.assign(Object.create(Dialog.prototype),{_state:{isOpen:true},_$playerContainer:[container]});
  return {dialog,calls,button};
}
describe('Notification history player wiring',()=>{
  it('routes repeated commands through one mount and remounts after player hide',()=>{
    const h=setup();
    h.dialog._onCommand('toggle-notificationHistory');
    h.dialog._onCommand('toggle-notificationHistory');
    assert.deepStrictEqual(h.calls,['mount','toggle','toggle']);
    h.dialog.hide(); h.dialog.hide();
    assert.deepStrictEqual(h.calls,['mount','toggle','toggle','dispose']);
    h.dialog._onCommand('toggle-notificationHistory');
    assert.strictEqual(h.calls.length,4);
    h.dialog.show(); h.dialog._onCommand('toggle-notificationHistory');
    assert.deepStrictEqual(h.calls.slice(-2),['mount','toggle']);
  });
  it('allows the shortcut command to activate history when the trigger is hidden',()=>{
    const h=setup(); h.button.hidden=true;
    h.dialog._onCommand('toggle-notificationHistory'); assert.deepStrictEqual(h.calls,['mount','toggle']);
  });
  it('migrates saved tab selection and legacy select commands to video information',()=>{
    const events=[];
    const context=createContext({Emitter:class {},global:{emitter:{emit:(...args)=>events.push(args)}}});
    const View=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',context);
    const view=Object.assign(Object.create(View.prototype),{_playerConfig:{props:{},getValue:()=>true},
      _state:{},videoInfoPanel:{selectTab:name=>events.push(name)}});
    view.selectTab('notificationHistory');
    assert.strictEqual(view._state.currentTab,'videoInfoTab');
    assert.strictEqual(view._playerConfig.props.videoInfoPanelTab,'videoInfoTab');
    assert.strictEqual(events[0],'videoInfoTab');
    const h=setup();h.dialog._onCommand('selectTab','notificationHistory');
    assert.strictEqual(h.dialog._state.currentTab,'videoInfoTab');
  });
});

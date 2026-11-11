import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createContext,loadClass}=createRequire(import.meta.url)('../../../test/helpers/extractSource');
test('opacity and toolbar preference updates do not rewrite unchanged UI size',()=>{
 const Mapper=loadClass('src/NicoVideoPlayerDialog.js','VariablesMapper',createContext({VideoControlBar:{BASE_HEIGHT:48,BASE_SEEKBAR_HEIGHT:4},css:{px:n=>n+'px'}}));
 const mapper=Object.create(Mapper.prototype),writes=[];
 mapper.config={props:{menuScale:1,commentLayerOpacity:.5,fullscreenControlBarMode:'auto'}};
 mapper.state={menuScale:1,commentLayerOpacity:1,fullscreenControlBarMode:'auto'};
 mapper.element={dataset:{}};mapper.emitter={emit(){}};mapper.setVar=(k,v)=>writes.push([k,v]);
 mapper.update();assert.deepEqual(writes,[['--zenza-comment-layer-opacity',.5]]);
 writes.length=0;mapper.config.props.fullscreenControlBarMode='always';mapper.update();assert.deepEqual(writes,[]);
 mapper.config.props.menuScale=1.5;mapper.update();assert.equal(writes.length,2);
});

test('screen mode refresh skips duplicates but preserves fullscreen, force and reopen',()=>{
 let full=false,writes=0;
 const Dialog=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',createContext({Emitter:class{},document:{body:{dataset:{}}},util:{fullscreen:{now:()=>full}}}));
 const d=Object.create(Dialog.prototype);d._state={isOpen:true,screenMode:'normal'};
 d._$body={raf:{toggleClass(){},removeClass(){}}};d._updateScreenModeStyle=()=>writes++;d._syncActionFeedbackIsolation=()=>{};
 d._applyScreenMode();d._applyScreenMode();assert.equal(writes,1);
 full=true;d._applyScreenMode();assert.equal(writes,2);
 d._applyScreenMode(true);assert.equal(writes,3);
 d._clearClass();d._applyScreenMode();assert.equal(writes,4);
});

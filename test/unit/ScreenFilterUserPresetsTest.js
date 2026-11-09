import assert from 'assert';
import {ScreenFilter, ScreenFilterPanel} from '../../packages/zenza/src/videoPlayer/ScreenFilter';
const {loadClass,createContext}=require('../helpers/extractSource');
const fs=require('fs');

const config = (raw = '') => ({props:{'screenFilter.userPresets':raw},on(){}});
describe('ScreenFilter named user presets', function() {
  beforeEach(()=>ScreenFilter._reset());
  afterEach(()=>ScreenFilter._reset());
  it('persists normalized adjustments, reloads and applies without changing flips or built-ins',()=>{
    const c=config(); ScreenFilter.initialize(c); ScreenFilter.set('brightness',123);
    c.props['screenFilter.flipH']=true;
    const saved=ScreenFilter.saveUserPreset('夜用');
    const stored=c.props['screenFilter.userPresets'];
    assert(!stored.includes('flipH'));
    ScreenFilter._reset(); ScreenFilter.initialize(config(stored));
    assert.equal(ScreenFilter.getUserPresets()[0].label,'夜用');
    ScreenFilter.applyPreset(saved.id);
    assert.equal(ScreenFilter.read().brightness,123);
    assert.equal(ScreenFilter.detectPreset(),saved.id);
    ScreenFilter.reset(); assert.equal(ScreenFilter.detectPreset(),'standard');
    assert.equal(ScreenFilter.getUserPresets().length,1);
    ScreenFilter.deleteUserPreset(saved.id);
    assert.equal(ScreenFilter.getUserPresets().length,0);
    assert.equal(ScreenFilter.applyPreset(saved.id),null);
    assert(ScreenFilter.PRESETS.some(p=>p.id==='standard'));
  });
  it('rejects blank and duplicate names without changing saved data',()=>{
    const c=config(); ScreenFilter.initialize(c);
    assert.throws(()=>ScreenFilter.saveUserPreset('  '));
    ScreenFilter.saveUserPreset('A'); const before=c.props['screenFilter.userPresets'];
    assert.throws(()=>ScreenFilter.saveUserPreset(' A '));
    assert.equal(c.props['screenFilter.userPresets'],before);
  });
  it('preserves damaged data and refuses writes that did not persist',()=>{
    const c=config('{broken'); ScreenFilter.initialize(c);
    assert.throws(()=>ScreenFilter.saveUserPreset('A'));
    assert.equal(c.props['screenFilter.userPresets'],'{broken');
    const blocked=config(); Object.defineProperty(blocked.props,'screenFilter.userPresets',{get:()=>'',set(){}});
    ScreenFilter.initialize(blocked);
    assert.throws(()=>ScreenFilter.saveUserPreset('A'));
    assert.equal(ScreenFilter.getUserPresets().length,0);
  });
  it('preserves malformed outer JSON through real DataStorage restore and refuses to overwrite it',async()=>{
    const DataStorage=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',createContext());
    const c=Object.create(DataStorage.prototype),key='screenFilter.userPresets';
    const configSource=fs.readFileSync('tools/typescript-stage1/advanced-src/Config.ts','utf8');
    assert.match(configSource,/preserveInvalidKeys:[^\n]+screenFilter\.userPresets/);
    c.default={[key]:''};c._data={};c.prefix='TEST_';c._ignoreExportKeys=[];c.options={preserveInvalidKeys:[key]};
    c.storage={TEST_screenFilter_userPresets:'unused'};c.storage[c.getStorageKey(key)]='{broken';
    await c.restore();c.props=c._makeProps(c.default);ScreenFilter.initialize(c);
    assert.equal(c.props[key],'');assert.equal(c.storage[c.getStorageKey(key)],'{broken');
    assert.throws(()=>ScreenFilter.saveUserPreset('A'));
    assert.equal(c.storage[c.getStorageKey(key)],'{broken');
  });
  it('keeps descriptions visible by default, remembers the toggle, and groups header controls',()=>{
    const c=config();ScreenFilter.initialize(c);const panel=new ScreenFilterPanel({config:c});panel.open();
    const q=s=>panel.view.querySelector(s);
    try{
      assert.equal(panel.view.classList.contains('sf-hide-descriptions'),false);
      for(const action of ['reset','split','toggle-descriptions'])assert(q('.sfHead [data-action="'+action+'"]'));
      assert(q('.sfPresetColumn [data-user-preset-buttons]'));
      assert(q('.sfAdjustColumn .sfRows'));
      q('[data-action="toggle-descriptions"]').click();assert.equal(c.props['screenFilter.showDescriptions'],false);
      assert.equal(panel.view.classList.contains('sf-hide-descriptions'),true);
      panel.close();panel.open();assert.equal(panel.view.classList.contains('sf-hide-descriptions'),true);
      q('[data-action="toggle-descriptions"]').click();assert.equal(c.props['screenFilter.showDescriptions'],true);
      q('[data-preset="vivid"]').focus();q('[data-preset="vivid"]').click();assert.equal(ScreenFilter.read().saturate,135);assert.equal(document.activeElement,q('[data-preset="vivid"]'));
      q('[data-preset="vivid"]').click();assert.equal(ScreenFilter.detectPreset(),'standard');
    }finally{panel.close();panel.view.remove();}
  });
  it('renames and overwrites a saved preset without modifying built-ins',()=>{
    const c=config();ScreenFilter.initialize(c);ScreenFilter.set('brightness',110);
    const saved=ScreenFilter.saveUserPreset('A');ScreenFilter.renameUserPreset(saved.id,'B');
    ScreenFilter.set('brightness',140);ScreenFilter.overwriteUserPreset(saved.id);
    ScreenFilter.reset();ScreenFilter.togglePreset(saved.id);assert.equal(ScreenFilter.read().brightness,140);
    ScreenFilter.togglePreset(saved.id);assert.equal(ScreenFilter.detectPreset(),'standard');
    assert.equal(ScreenFilter.getUserPresets()[0].label,'B');
    assert.throws(()=>ScreenFilter.overwriteUserPreset('standard'));
    assert.throws(()=>ScreenFilter.renameUserPreset('standard','X'));
  });
  it('undoes one adjustment or a complete preset, redoes it, and discards redo after a new edit',()=>{
    ScreenFilter.initialize(config());ScreenFilter.set('brightness',120);ScreenFilter.applyPreset('vivid');
    assert.equal(ScreenFilter.canUndo,true);ScreenFilter.undo();
    assert.equal(ScreenFilter.read().brightness,120);assert.equal(ScreenFilter.read().saturate,100);
    ScreenFilter.undo();assert.equal(ScreenFilter.detectPreset(),'standard');
    ScreenFilter.redo();assert.equal(ScreenFilter.read().brightness,120);
    ScreenFilter.set('brightness',130);assert.equal(ScreenFilter.canRedo,false);
  });
  it('filters unchanged rows without losing values and remembers comparison position',()=>{
    const c=config();ScreenFilter.initialize(c);const panel=new ScreenFilterPanel({config:c});panel.open();
    try{
      ScreenFilter.set('brightness',125);
      panel.view.querySelector('[data-action="toggle-changed-only"]').click();
      assert.equal(c.props['screenFilter.changedOnly'],true);
      assert.equal(panel.view.querySelector('[data-key="brightness"]').hidden,false);
      assert.equal(panel.view.querySelector('[data-key="contrast"]').hidden,true);
      panel.view.querySelector('[data-action="undo"]').click();assert.equal(ScreenFilter.read().brightness,100);
      panel.view.querySelector('[data-action="redo"]').click();assert.equal(ScreenFilter.read().brightness,125);
      ScreenFilter.setSplitPosition(65);assert.equal(c.props['screenFilter.splitPosition'],65);
      ScreenFilter.setSplitPosition(200);assert.equal(ScreenFilter.splitPosition,100);
      ScreenFilter.setSplitPosition(-5);assert.equal(ScreenFilter.splitPosition,0);
    }finally{panel.close();panel.view.remove();}
  });
  it('drags the comparison boundary without saving every move, cancels and supports the keyboard',function(){
    this.timeout(10000);
    const c=config();ScreenFilter.initialize(c);ScreenFilter.set('brightness',125);
    const raf=global.requestAnimationFrame,caf=global.cancelAnimationFrame;let tick;
    global.requestAnimationFrame=fn=>{tick=fn;return 1;};global.cancelAnimationFrame=()=>{};
    // Model the actual player hierarchy and use its production stacking rules.
    // jsdom cannot hit-test; these assertions catch a handle trapped below the
    // transparent touch cover before sending any synthetic pointer events.
    const parent=document.createElement('div');parent.className='zenzaPlayerContainer';
    parent.innerHTML='<div class="videoPlayer"><video class="zenzaWatchVideoElement"></video><div class="touchWrapper"></div></div><iframe class="commentLayerFrame"></iframe>';
    document.body.append(parent);
    const video=parent.querySelector('video'),player=video.parentElement;
    const comment=parent.querySelector('iframe'),touch=parent.querySelector('.touchWrapper');
    const css=document.createElement('style');
    const rule=(path,selector)=>{
      const lines=fs.readFileSync(path,'utf8').split('\n'),start=lines.findIndex(line=>line.trim()===selector+' {');
      assert(start>=0,'production CSS selector exists: '+selector);
      const source=lines.slice(start).join('\n');
      return source.slice(0,source.indexOf('}')+1);
    };
    css.textContent=[
      rule('tools/typescript-stage1/nico-src/NicoVideoPlayerDialog.ts','.zenzaPlayerContainer .videoPlayer'),
      rule('tools/typescript-stage1/nico-src/NicoVideoPlayerDialog.ts','.zenzaPlayerContainer .commentLayerFrame'),
      rule('tools/typescript-stage1/nico-src/NicoVideoPlayer.ts','.touchWrapper'),
      rule('tools/typescript-stage1/nico-src/NicoVideoPlayerDialog.ts','.zenzaScreenMode_small .zenzaPlayerContainer > :not(.commentLayerFrame):not(.loadingMessageContainer)')
    ].join('\n');document.head.append(css);
    for(const [key,value] of Object.entries({videoWidth:640,videoHeight:360,readyState:2,offsetWidth:640,offsetHeight:360,offsetLeft:0,offsetTop:0}))Object.defineProperty(video,key,{value});
    const proto=window.HTMLCanvasElement.prototype,original=proto.getContext;
    const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});proto.getContext=()=>ctx;
    const event=(target,type,x)=>target.dispatchEvent(new window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:x}));
    const panel=new ScreenFilterPanel({config:c});panel.open();
    try{
      ScreenFilter.setSplit(true);tick();const handle=parent.querySelector('.zenzaScreenFilterSplitHandle'),canvas=parent.querySelector('canvas');
      const computed=element=>window.getComputedStyle(element);
      assert.equal(handle.parentElement,parent,'handle escapes the video stacking context');
      assert.equal(canvas.parentElement,player,'unfiltered video stays below comments');
      assert.equal(computed(touch).zIndex,'10');
      assert(Number(computed(handle).zIndex)>Number(computed(player).zIndex));
      assert(Number(computed(handle).zIndex)>Number(computed(comment).zIndex));
      assert.equal(computed(handle).pointerEvents,'auto');
      assert.equal(computed(canvas).pointerEvents,'none');
      // Native layout is unavailable in jsdom. Supply measured rectangles for
      // normal, fullscreen, translated small mode, and a scaled container.
      Object.defineProperty(parent,'offsetWidth',{value:640});
      Object.defineProperty(parent,'offsetHeight',{value:360});
      const layouts=[
        {mode:'normal',root:[80,40,640,360],picture:[80,40,640,360],want:[320,180]},
        {mode:'fullscreen',root:[0,0,640,360],picture:[0,0,640,360],want:[320,180]},
        {mode:'small',root:[0,0,640,360],picture:[300,200,640,360],want:[620,380]},
        {mode:'small',root:[100,50,320,180],picture:[140,80,320,180],want:[400,240]}
      ];
      for(const layout of layouts){
        document.body.classList.add('zenzaScreenMode_'+layout.mode);
        const rect=([left,top,width,height])=>({left,top,width,height});
        parent.getBoundingClientRect=()=>rect(layout.root);canvas.getBoundingClientRect=()=>rect(layout.picture);
        tick();
        assert.equal(parseFloat(handle.style.left),layout.want[0],layout.mode+' horizontal position');
        assert.equal(parseFloat(handle.style.top),layout.want[1],layout.mode+' vertical position');
        assert.equal(computed(handle).pointerEvents,'auto');
        document.body.classList.remove('zenzaScreenMode_'+layout.mode);
      }
      parent.getBoundingClientRect=()=>({left:0,top:0,width:640,height:360});
      canvas.getBoundingClientRect=()=>({left:0,top:0,width:640,height:360});tick();
      event(handle,'pointerdown',320);event(window,'pointermove',480);
      assert.equal(ScreenFilter.splitPosition,75);assert.equal(c.props['screenFilter.splitPosition'],undefined);assert.equal(panel.isOpen,true);
      event(window,'pointerup',480);assert.equal(c.props['screenFilter.splitPosition'],75);
      event(handle,'pointerdown',480);event(window,'pointermove',200);event(window,'pointercancel',200);assert.equal(ScreenFilter.splitPosition,75);
      handle.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert.equal(ScreenFilter.splitPosition,74);
      event(handle,'pointerdown',400);event(window,'pointermove',300);window.dispatchEvent(new window.Event('blur'));assert.equal(ScreenFilter.splitPosition,74);
      event(window,'pointermove',200);assert.equal(ScreenFilter.splitPosition,74);
      event(handle,'pointerdown',400);event(window,'pointermove',300);
      ScreenFilter.setSplit(false);assert.equal(handle.hidden,true);
      event(window,'pointerup',300);assert.equal(c.props['screenFilter.splitPosition'],74);
      ScreenFilter.setSplit(true);tick();event(handle,'pointerdown',400);
      ScreenFilter._reset();event(window,'pointermove',300);event(window,'pointerup',300);
      assert.equal(parent.querySelector('.zenzaScreenFilterSplitHandle'),null);
      assert.equal(parent.querySelector('canvas'),null);
      assert.equal(c.props['screenFilter.splitPosition'],74);
    }finally{ScreenFilter._reset();panel.close();panel.view.remove();parent.remove();css.remove();proto.getContext=original;global.requestAnimationFrame=raf;global.cancelAnimationFrame=caf;}
  });
  it('bounds the light comparison copy and throttles only new frames, not boundary edits',()=>{
    const c=config();c.props['screenFilter.renderQuality']='light';ScreenFilter.initialize(c);ScreenFilter.set('brightness',125);
    const raf=global.requestAnimationFrame,caf=global.cancelAnimationFrame;let tick,draws=0;
    global.requestAnimationFrame=fn=>{tick=fn;return 1;};global.cancelAnimationFrame=()=>{};
    const parent=document.createElement('div'),video=document.createElement('video');
    video.className='zenzaWatchVideoElement';parent.append(video);document.body.append(parent);
    for(const [key,value] of Object.entries({videoWidth:3840,videoHeight:2160,readyState:2,offsetWidth:1920,offsetHeight:1080,offsetLeft:0,offsetTop:0}))Object.defineProperty(video,key,{value});
    const proto=window.HTMLCanvasElement.prototype,original=proto.getContext;
    const ctx=new Proxy({drawImage(){draws++;}}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});proto.getContext=()=>ctx;
    try{
      ScreenFilter.setSplit(true);tick(1000);
      const canvas=parent.querySelector('.zenzaScreenFilterSplit');
      assert(canvas.width<=854&&canvas.height<=480,'light comparison has a bounded pixel budget');
      assert(Math.abs(canvas.width/canvas.height-16/9)<0.01,'light copy keeps the video aspect ratio');
      assert.equal(draws,1);
      video.currentTime=1;tick(1016);assert.equal(draws,1,'skip a frame less than 1/30 second later');
      tick(1034);assert.equal(draws,2);
      ScreenFilter.setSplitPosition(60);tick(1035);assert.equal(draws,3,'boundary edits redraw immediately');
      c.props['screenFilter.flipH']=true;tick(1036);assert.equal(draws,4,'flip changes redraw immediately');
      c.props['screenFilter.renderQuality']='normal';tick(1037);
      assert.equal(canvas.width,1920);assert.equal(canvas.height,1080);assert.equal(draws,5);
      video.currentTime=2;tick(1038);assert.equal(draws,6,'normal comparison preserves full-rate drawing');
    }finally{ScreenFilter._reset();parent.remove();proto.getContext=original;global.requestAnimationFrame=raf;global.cancelAnimationFrame=caf;}
  });
  it('uses the advanced ordering for both preset groups without changing canonical order',()=>{
    const c=config();ScreenFilter.initialize(c);const a=ScreenFilter.saveUserPreset('A'),b=ScreenFilter.saveUserPreset('B');
    c.props['screenFilter.presetOrder']=JSON.stringify(['vivid','standard',b.id,a.id]);
    const panel=new ScreenFilterPanel({config:c});panel.open();
    try{assert.equal(panel.view.querySelector('.sfPresetColumn .sfPresets button').dataset.preset,'vivid');assert.equal(panel.view.querySelector('[data-user-preset-buttons] button').dataset.preset,b.id);assert.equal(ScreenFilter.getPresetList(false)[0].id,'standard');}
    finally{panel.close();panel.view.remove();}
  });
  it('saves and applies through panel controls and treats a name as text',()=>{
    const c=config(); ScreenFilter.initialize(c); const panel=new ScreenFilterPanel({config:c});
    panel.open();
    try {
      const q=s=>panel.view.querySelector(s);
      ScreenFilter.set('brightness',120);
      q('[data-action="new-user-preset"]').click();
      q('[data-user-preset-name]').value='<img src=x>';
      q('[data-action="save-user-preset"]').click();
      assert.equal(ScreenFilter.getUserPresets().length,1);
      assert.equal(panel.view.querySelector('img'),null);
      assert.equal(q('[data-user-preset-buttons] button').textContent,'<img src=x>');
      ScreenFilter.reset(); q('[data-user-preset-buttons] button').click();
      assert.equal(ScreenFilter.read().brightness,120);
      q('[data-user-preset-buttons] button').click();assert.equal(ScreenFilter.detectPreset(),'standard');
      q('[data-action="edit-user-presets"]').click();q('[data-user-preset-buttons] button').click();
      q('[data-action="delete-user-preset"]').click();
      assert.equal(ScreenFilter.getUserPresets().length,1);
      q('[data-action="confirm-user-preset"]').click();
      assert.equal(ScreenFilter.getUserPresets().length,0);
    } finally {panel.close();panel.view.remove();}
  });
});

import assert from 'assert';
import {ScreenFilter,ScreenFilterPanel} from '../../packages/zenza/src/videoPlayer/ScreenFilter';
describe('Screen filter shared scroll and compact controls',()=>{
 beforeEach(()=>ScreenFilter._reset());afterEach(()=>ScreenFilter._reset());
 it('persists a compact preset-only view without resetting adjustments',()=>{
  const config={props:{},on(){}};ScreenFilter.initialize(config);ScreenFilter.set('brightness',120);
  const panel=new ScreenFilterPanel({config});panel.open();
  try{
   const q=s=>panel.view.querySelector(s),button=q('[data-action="toggle-adjustments"]');assert(button);
   button.click();assert.equal(config.props['screenFilter.showAdjustments'],false);assert(q('.sfAdjustColumn').hidden);assert(panel.view.classList.contains('sf-compact'));
   assert.equal(button.textContent,'調整欄を表示');assert.equal(ScreenFilter.read().brightness,120);
   panel.close();panel.open();assert(q('.sfAdjustColumn').hidden);
   button.click();assert(!q('.sfAdjustColumn').hidden);
   for(const name of ['sfPresetColumn','sfAdjustColumn'])assert.notEqual(window.getComputedStyle(q('.'+name)).overflowY,'auto');
   assert.equal(window.getComputedStyle(panel.view).overflowY,'auto');
  }finally{panel.close();panel.view.remove();}
 });
 it('keeps compact title actions above secondary actions and preserves changed-only state',()=>{
  const config={props:{'screenFilter.changedOnly':true},on(){}};
  ScreenFilter.initialize(config);ScreenFilter.set('brightness',120);
  const panel=new ScreenFilterPanel({config});panel.open();
  try{
   const q=s=>panel.view.querySelector(s),toggle=q('[data-action="toggle-adjustments"]');
   toggle.click();
   const titleRow=q('.sfTitle').parentElement;
   assert.deepEqual(Array.from(titleRow.querySelectorAll('button'),b=>b.dataset.action),['toggle-adjustments','undo','redo']);
   const secondary=q('[data-action="reset"]').parentElement;
   assert.notEqual(secondary,titleRow);
   assert.deepEqual(Array.from(secondary.querySelectorAll('button:not([hidden])'),b=>b.dataset.action),['reset','split','toggle-descriptions']);
   assert.equal(q('[data-action="split"]').textContent,'左右で見比べる');
   assert(q('[data-action="split"]').title.includes('左半分に元の映像'));
   const changed=q('[data-action="toggle-changed-only"]');
   assert(changed.hidden);assert.equal(config.props['screenFilter.changedOnly'],true);
   assert.equal(q('.sfHead').nextElementSibling,q('.sfQuality'));
   toggle.click();assert(!changed.hidden);assert.equal(changed.getAttribute('aria-pressed'),'true');
   assert(q('.sfRow[data-key="contrast"]').hidden);assert(!q('.sfRow[data-key="brightness"]').hidden);
  }finally{panel.close();panel.view.remove();}
 });
 it('shares the wide header line and reserves separate rows only in compact mode',()=>{
  const config={props:{},on(){}};ScreenFilter.initialize(config);
  const panel=new ScreenFilterPanel({config});panel.open();
  try{
   const q=s=>panel.view.querySelector(s),style=s=>window.getComputedStyle(q(s));
   assert.equal(style('.sfTitleRow').display,'contents');
   assert.notEqual(style('.sfFoot').width,'100%');
   assert.equal(style('[data-action="undo"]').order,'2');
   q('[data-action="toggle-adjustments"]').click();
   assert.equal(style('.sfTitleRow').display,'flex');
   assert.equal(style('.sfTitleRow').width,'100%');
   assert.equal(style('.sfFoot').width,'100%');
  }finally{panel.close();panel.view.remove();}
 });
 it('resets all adjustments and comparison from the panel while retaining flips and adjustment undo',()=>{
  const raf=global.requestAnimationFrame,caf=global.cancelAnimationFrame;
  global.requestAnimationFrame=()=>1;global.cancelAnimationFrame=()=>{};
  const config={props:{},on(){}};ScreenFilter.initialize(config);
  ScreenFilter.set('brightness',120);
  ScreenFilter.execCommand('toggle-screenFilter.flipH');ScreenFilter.execCommand('toggle-screenFilter.flipV');
  const panel=new ScreenFilterPanel({config});panel.open();
  try{
   const q=s=>panel.view.querySelector(s);
   ScreenFilter.setSplit(true);assert.equal(q('[data-action="split"]').getAttribute('aria-pressed'),'true');
   q('[data-action="reset"]').click();
   assert.equal(ScreenFilter.isSplit,false);
   assert.equal(q('[data-action="split"]').getAttribute('aria-pressed'),'false');
   assert.equal(ScreenFilter.detectPreset(),'standard');
   assert.equal(config.props['screenFilter.flipH'],true);assert.equal(config.props['screenFilter.flipV'],true);
   q('[data-action="undo"]').click();assert.equal(ScreenFilter.read().brightness,120);assert.equal(ScreenFilter.isSplit,false);
   q('[data-action="redo"]').click();assert.equal(ScreenFilter.detectPreset(),'standard');
   ScreenFilter.setSplit(true);q('[data-action="reset"]').click();assert.equal(ScreenFilter.isSplit,false);
  }finally{ScreenFilter._reset();panel.close();panel.view.remove();global.requestAnimationFrame=raf;global.cancelAnimationFrame=caf;}
 });
 it('exposes explicit normal/light quality without saving it into presets',()=>{
  const config={props:{},on(){}};ScreenFilter.initialize(config);const panel=new ScreenFilterPanel({config});panel.open();
  try{
   const select=panel.view.querySelector('[data-render-quality]');assert(select);assert.equal(select.value,'normal');
   select.value='light';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(config.props['screenFilter.renderQuality'],'light');
   const preset=ScreenFilter.saveUserPreset('A');assert.equal(preset.values.renderQuality,undefined);
  }finally{panel.close();panel.view.remove();}
 });
});

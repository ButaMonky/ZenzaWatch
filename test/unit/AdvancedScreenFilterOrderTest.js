const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {stripTypeScriptTypes}=require('module');
const {JSDOM}=require('jsdom');
function load(name){
 const source=fs.readFileSync('tools/typescript-stage1/advanced-src/'+name+'.ts','utf8').split('//===BEGIN===')[1].split('//===END===')[0];
 return vm.runInNewContext(stripTypeScriptTypes(source)+'\n'+name,{JSON,Map,Set,console});
}
function setup(order=''){
 const Model=load('ModernAdvancedSettingsModel');
 const defaults={'screenFilter.showDescriptions':true,'screenFilter.showAdjustments':true,'screenFilter.renderQuality':'normal','screenFilter.changedOnly':false,'screenFilter.presetOrder':'','screenFilter.userPresets':'','screenFilter.splitPosition':50,'commentHistory.enabled':false};
 const values={...defaults,'screenFilter.presetOrder':order};
 const config={default:defaults,getValue:k=>values[k],setValue:(k,v)=>values[k]=v};
 const presets=[{id:'a',label:'標準'},{id:'b',label:'明るい'},{id:'user_1',label:'保存1',user:true},{id:'user_2',label:'保存2',user:true}];
 const model=new Model({config,screenFilterPresets:()=>presets});return {model,values,presets};
}
describe('Advanced screen filter preferences and staged preset ordering',()=>{
 it('uses human labels and a dedicated reorder editor, never raw preset JSON',()=>{
  const {model}=setup();
  assert.equal(model.descriptor('screenFilter.presetOrder').type,'screen-preset-order');
  assert.equal(model.descriptor('screenFilter.userPresets'),null);
  assert.equal(model.descriptor('commentHistory.enabled').label,'自動で増量');
  assert.equal(model.descriptor('screenFilter.splitPosition').max,100);
  assert.equal(model.descriptor('screenFilter.showAdjustments').label,'画面フィルターの調整欄を表示');
  assert.deepEqual(Array.from(model.descriptor('screenFilter.renderQuality').options,o=>o.value),['normal','light']);
 });
 it('stages reorder within each group and supports cancel, save and default',()=>{
  const {model,values}=setup();model.moveScreenFilterPreset('b',-1);
  assert.equal(values['screenFilter.presetOrder'],'');
  assert.equal(model.screenFilterPresetList()[0].id,'b');
  model.cancel();assert.equal(model.screenFilterPresetList()[0].id,'a');
  model.moveScreenFilterPreset('user_2',-1);model.save();
  assert.deepEqual(JSON.parse(values['screenFilter.presetOrder']),['a','b','user_2','user_1']);
  model.resetItem('screenFilter.presetOrder');assert.equal(model.screenFilterPresetList()[2].id,'user_1');
 });
 it('ignores unknown/duplicate order ids without rewriting untouched stored data',()=>{
  const raw='["missing","b","b","a"]';const {model,presets,values}=setup(raw);
  assert.deepEqual(Array.from(model.screenFilterPresetList(),p=>p.id),['b','a','user_1','user_2']);
  assert.equal(model.get('screenFilter.presetOrder'),raw);assert.equal(model.isDirty(),false);
  presets.push({id:'missing',label:'再登録',user:true});
  assert(model.screenFilterPresetList().some(p=>p.id==='missing'));model.save();assert.equal(values['screenFilter.presetOrder'],raw);
 });
 it('keeps temporarily missing ids during moves and safely reads malformed order',()=>{
  const {model}=setup('["missing","a","b"]');model.moveScreenFilterPreset('b',-1);
  assert(JSON.parse(model.get('screenFilter.presetOrder')).includes('missing'));
  const malformed=setup('{broken').model;
  assert.deepEqual(Array.from(malformed.screenFilterPresetList(),p=>p.id),['a','b','user_1','user_2']);
  assert.equal(malformed.moveScreenFilterPreset('user_1',-1),false);
 });
 it('imports all eleven effect controls from canonical parameters with labels, descriptions and bounds',()=>{
  const source=fs.readFileSync('tools/typescript-stage1/nico-src/ScreenFilter.ts','utf8');
  const params=vm.runInNewContext(source.slice(source.indexOf('  const PARAMS = ['),source.indexOf('  const PARAM_MAP ='))+';PARAMS');
  const keys=['bloom','bloomThreshold','bloomRadius','posterize','edge','edgeStyle','rgbShift','grain','grainSize','scanlines','scanlineSpacing'];
  const defaults=Object.fromEntries(params.map(p=>['screenFilter.'+p.key,p.def]));
  const Model=load('ModernAdvancedSettingsModel');
  const model=new Model({config:{default:defaults,getValue:k=>defaults[k]},screenFilterParams:params});
  for(const key of keys){
    const param=params.find(p=>p.key===key),descriptor=model.descriptor('screenFilter.'+key);
    assert(descriptor,key);assert.equal(descriptor.label,param.label);assert.notEqual(descriptor.label,key);
    assert.equal(descriptor.description,param.desc);assert(descriptor.description.length>0);
    if(key==='edgeStyle'){
      assert.equal(descriptor.type,'select');assert.equal(descriptor.options.length,3);
      assert.deepEqual(Array.from(descriptor.options,o=>o.value),['sketch','neon','emboss']);
    }else{
      assert.equal(descriptor.type,'slider');assert.equal(descriptor.min,param.min);
      assert.equal(descriptor.max,param.max);assert.equal(descriptor.step,param.step);
      model.set(descriptor.id,param.max+param.step);
      assert(model.validate().some(error=>error.id===descriptor.id));model.resetItem(descriptor.id);
    }
  }
 });
 it('renders accessible grouped buttons and stages their changes',()=>{
  const {model}=setup();const UI=load('ModernAdvancedSettingsUI');const dom=new JSDOM('<body>');
  const ui=Object.create(UI.prototype);ui.doc=dom.window.document;ui.model=model;ui._renderCards=()=>{};ui._refreshFooter=()=>{};
  const controls=ui._renderScreenPresetOrderControls();
  assert.equal(controls.querySelectorAll('fieldset').length,2);
  assert.equal(controls.querySelectorAll('input,textarea').length,0);
  const up=controls.querySelector('[data-zw-screen-preset="b"][data-zw-screen-preset-move="-1"]');
  assert.equal(up.getAttribute('aria-label'),'明るいを上へ');up.click();
  assert.equal(model.screenFilterPresetList()[0].id,'b');dom.window.close();
 });
});

const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
describe('settings context storage separation',()=>{
 for(const mode of ['ginza','others']) it(mode+' keeps base and contextual settings separate and notifies the correct consumers',()=>{
  const ctx=createContext({util:{isGinzaWatchUrl:()=>mode==='ginza'},location:{host:mode==='ginza'?'www.nicovideo.jp':'example.org'}});
  const Data=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',ctx);
  const Player=loadClass('src/NicoVideoPlayerDialog.js','PlayerConfig',ctx);
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
  const defaults={screenMode:'normal',['screenMode:'+mode]:'big',autoPlay:true,['autoPlay:'+mode]:false};
  const events=[],config=Object.create(Data.prototype);
  Object.assign(config,{default:defaults,props:{...defaults},_data:{...defaults},storage:{},prefix:'CFG_',_changed:new Map(),emitAsync:(...args)=>events.push(args),emit(){}});
  Player.wrapKey(config);
  const model=new Model({config});assert.equal(model.get('autoPlay'),true);
  model.set('screenMode','wide');model.set('screenMode:'+mode,'3D');assert.equal(model.save(),2);
  assert.equal(config.storage.CFG_screenMode,'"wide"');assert.equal(config.storage['CFG_screenMode:'+mode],'"3D"');
  assert.equal(config.getValue('screenMode'),'3D');
  assert(!events.some(e=>e[0]==='update-screenMode'&&e[1]==='wide'));
  assert(events.some(e=>e[0]==='update-screenMode'&&e[1]==='3D'));
  assert(events.some(e=>e[0]==='stored-screenMode'&&e[1]==='wide'));
  config.setValue('screenMode','small');assert.equal(config.getStoredValue('screenMode'),'wide');
  assert.equal(config.getStoredValue('screenMode:'+mode),'small');
  const exported=config.export(true);assert.equal(exported.screenMode,'wide');assert.equal(exported['screenMode:'+mode],'small');
 });
});

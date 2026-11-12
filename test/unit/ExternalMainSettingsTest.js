const assert=require('assert'),fs=require('fs');
const {JSDOM}=require('jsdom');const {createContext,loadClass}=require('../helpers/extractSource');
describe('External preferences in main advanced settings',()=>{
 it('registers every companion preference and refreshes storage before opening',async()=>{
  const dom=new JSDOM(''),ctx=createContext({document:dom.window.document,URL});
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
  const descriptors=Model.externalLinkSettings();assert.equal(descriptors.length,10);
  for(const d of descriptors){assert.equal(d.category,Model.CATEGORIES.at(-1));assert(fs.readFileSync('src/Config.js','utf8').includes(JSON.stringify(d.id)));}
  const Controller=loadClass('src/AdvancedSettingsController.js','AdvancedSettingsController',ctx);
  const calls=[];const controller=new Controller({document:dom.window.document,config:{default:{'externalLinks.enabled':true,volume:1},promise:async()=>{},refresh:async key=>calls.push(key)},createPanel:()=>({show:()=>calls.push('show'),dispose(){},hide(){}})});
  await controller.open();assert.deepStrictEqual(calls,['externalLinks.enabled','show']);controller.dispose();dom.window.close();
 });
});

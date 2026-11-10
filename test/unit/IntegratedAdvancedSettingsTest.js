'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run,read}=require('../helpers/extractSource');
function setup(extra={}) {
 const dom=new JSDOM('<body></body>',{url:'https://www.nicovideo.jp/my'});
 const ctx=createContext({document:dom.window.document,...extra});
 run(beginSection('src/AdvancedSettingsController.js')+';globalThis.Controller=AdvancedSettingsController;',ctx);
 return {dom,Controller:ctx.Controller};
}
describe('integrated advanced settings lifecycle',()=>{
 it('creates lazily once after restore and uses the same config for repeated opens',async()=>{
  const {dom,Controller}=setup();let restore,created=0,shown=0;
  const config={promise:()=>new Promise(r=>{restore=r;})};
  const ctl=new Controller({config,createPanel:c=>{assert.strictEqual(c,config);created++;return {show(){shown++;},hide(){},dispose(){}};},document:dom.window.document});
  assert.equal(created,0);const a=ctl.open(),b=ctl.open();restore();await Promise.all([a,b]);
  assert.equal(created,1);await ctl.open();assert.equal(created,1);assert(shown>=2);ctl.dispose();dom.window.close();
 });
 it('retries failed initialization and does not create a panel after disposal',async()=>{
  const {dom,Controller}=setup();let calls=0;
  const ctl=new Controller({config:{promise:async()=>{}},createPanel:()=>{if(++calls===1)throw Error('fail');return {show(){},hide(){},dispose(){}};},document:dom.window.document});
  await assert.rejects(ctl.open());await ctl.open();assert.equal(calls,2);ctl.dispose();await ctl.open();assert.equal(calls,2);dom.window.close();
 });
 it('mounts one recoverable my-page entry and removes its own entry on disposal',async()=>{
  const {dom,Controller}=setup();let shown=0;
  const ctl=new Controller({config:{promise:async()=>{}},createPanel:()=>({show(){shown++;},hide(){},dispose(){}}),document:dom.window.document});
  ctl.mountEntry();ctl.mountEntry();assert.equal(dom.window.document.querySelectorAll('[data-zw-advanced-entry]').length,1);
  dom.window.document.querySelector('[data-zw-advanced-entry]').click();await new Promise(r=>setImmediate(r));assert.equal(shown,1);
  ctl.dispose();assert.equal(dom.window.document.querySelectorAll('[data-zw-advanced-entry]').length,0);dom.window.close();
 });
 it('keeps the retired distribution announcement-only and settings-free',()=>{
  const source=read('src/_settingsRetired.js');
  assert(source.includes('削除してください'));assert(!source.includes('localStorage'));assert(!source.includes('//@require Config'));
 });
 it('routes the player settings command to the integrated API',()=>{
  let opened=0;const ctx=createContext({ZenzaWatch:{emitter:{emit(){}},api:{openAdvancedSettings(){opened++;return Promise.resolve();}}},PopupMessage:{alert(){}}});
  run(beginSection('src/RootDispatcher.js')+';globalThis.dispatcher=RootDispatcher;',ctx);
  ctx.dispatcher.execCommand('openAdvancedSettings');assert.equal(opened,1);
 });
});

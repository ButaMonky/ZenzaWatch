'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run,read}=require('../helpers/extractSource');
function setup(extra={},html='<body></body>') {
 const dom=new JSDOM(html,{url:'https://www.nicovideo.jp/my'});
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
 it('places a standalone contrasting button beside existing account controls in normal flow',()=>{
  const {dom,Controller}=setup({},'<body><div><button class="accountEdit">profile</button></div></body>');
  const doc=dom.window.document,account=doc.querySelector('.accountEdit');
  const ctl=new Controller({config:{promise:async()=>{}},createPanel:()=>({show(){},hide(){},dispose(){}}),document:doc});
  ctl.mountEntry();const host=doc.querySelector('[data-zw-advanced-host]'),button=doc.querySelector('[data-zw-advanced-entry]');
  assert(host);assert.strictEqual(account.nextElementSibling,host);assert.strictEqual(host.querySelector('button'),button);
  const style=dom.window.getComputedStyle(button);assert.notEqual(style.position,'fixed');assert.notEqual(style.backgroundColor,'rgba(0, 0, 0, 0)');
  assert.notEqual(style.color,style.backgroundColor);assert(host.querySelector('style').textContent.includes(':focus-visible'));
  assert.strictEqual(doc.querySelector('.accountEdit'),account);ctl.dispose();dom.window.close();
 });
 it('relocates its owned entry after SPA replacement and hides outside my page',async()=>{
  const {dom,Controller}=setup({},'<body><div id="root"><main aria-label="nicovideo-content">original</main></div></body>');
  const doc=dom.window.document,root=doc.querySelector('#root');
  const ctl=new Controller({config:{promise:async()=>{}},createPanel:()=>({show(){},hide(){},dispose(){}}),document:doc});
  ctl.mountEntry();const button=doc.querySelector('[data-zw-advanced-entry]');
  root.innerHTML='<main aria-label="nicovideo-content">replacement</main>';await new Promise(r=>setImmediate(r));
  const host=doc.querySelector('[data-zw-advanced-host]');assert(host);assert.strictEqual(host.nextElementSibling,root.querySelector('main'));
  assert.strictEqual(host.querySelector('button'),button);assert.equal(doc.querySelectorAll('[data-zw-advanced-entry]').length,1);
  dom.window.history.pushState({},'', '/search/example');root.querySelector('main').textContent='search';await new Promise(r=>setImmediate(r));assert.equal(host.hidden,true);
  dom.window.history.pushState({},'', '/my/watchlater');dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));assert.equal(host.hidden,false);
  ctl.dispose();root.innerHTML='<main>after disposal</main>';await new Promise(r=>setImmediate(r));assert.equal(doc.querySelector('[data-zw-advanced-host]'),null);dom.window.close();
 });
 it('uses normal flow fallback and moves to content when the SPA mounts later',async()=>{
  const {dom,Controller}=setup();const doc=dom.window.document;
  const ctl=new Controller({config:{promise:async()=>{}},createPanel:()=>({show(){},hide(){},dispose(){}}),document:doc});
  ctl.mountEntry();const host=doc.querySelector('[data-zw-advanced-host]');assert(host);assert.strictEqual(host.parentElement,doc.body);
  assert.notEqual(dom.window.getComputedStyle(host).position,'fixed');
  const main=doc.createElement('main');doc.body.prepend(main);await new Promise(r=>setImmediate(r));assert.strictEqual(host.nextElementSibling,main);
  ctl.dispose();dom.window.close();
 });
 it('retains button contrast in light and dark pages and never mounts inside its own dialog',()=>{
  const {dom,Controller}=setup({},'<body><section class="zw-modern-root"><main>settings content</main></section></body>');
  const doc=dom.window.document,ctl=new Controller({config:{promise:async()=>{}},createPanel:()=>({show(){},hide(){},dispose(){}}),document:doc});
  ctl.mountEntry();const host=doc.querySelector('[data-zw-advanced-host]'),button=host.querySelector('button');
  assert.strictEqual(host.parentElement,doc.body);
  for(const background of ['#fff','#111']){
   doc.body.style.backgroundColor=background;const style=dom.window.getComputedStyle(button);
   assert.equal(style.backgroundColor,'rgb(23, 33, 45)');assert.equal(style.color,'rgb(244, 247, 255)');assert.equal(style.borderTopStyle,'solid');
  }
  ctl.dispose();dom.window.close();
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

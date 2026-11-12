'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
const {createContext,run,beginSection}=require('../helpers/extractSource');
function canonical(file,name,ctx) {
 const source=stripTypeScriptTypes(fs.readFileSync(path.resolve(__dirname,'../../tools/typescript-stage1',file),'utf8'))
  .replace(/^import .*;$/mg,'').replace(/^export\s*\{[^}]*\};?$/mg,'');
 run(source+';globalThis.Subject='+name+';',ctx);return ctx.Subject;
}
describe('AUD cooperative watch link ownership',()=>{
 function fixture(){
  const dom=new JSDOM('<body><a href="/watch/sm9"><span>video</span></a></body>',{url:'https://www.nicovideo.jp/ranking'});
  const win=dom.window,opens=[],ctx=createContext({window:win,document:win.document,location:win.location,ZenzaWatch:{emitter:{emit(){}}}});
  const tasks=[];win.setTimeout=(fn,ms=0)=>{if(ms===0)tasks.push(fn);return 0;};
  run(beginSection('packages/zenza/src/menu/WatchClickNavigation.js'),ctx);
  run(beginSection('packages/lib/src/nico/nicoUtil.js'),ctx);
  const Menu=canonical('nico-src/HoverMenu.ts','HoverMenu',ctx),menu=Object.create(Menu.prototype);
  menu._playerConfig={props:{'overrideWatchLink:allowPropagation':true}};
  menu._open=id=>opens.push(id);menu._send=id=>opens.push(id);menu._overrideWatchLink();
  return {win,opens,close:()=>win.close(),click:(options={})=>{const e=new win.MouseEvent('click',{bubbles:true,cancelable:true,...options});win.document.querySelector('span').dispatchEvent(e);while(tasks.length)tasks.shift()();return e;}};
 }
 it('lets body read markers observe the original claimed click and prevents cooperative navigation',()=>{
  const f=fixture();try{let read=0,navigated=0;
   f.win.document.body.addEventListener('click',()=>read++);
   f.win.document.querySelector('a').addEventListener('click',e=>{if(!e.defaultPrevented)navigated++;});
   assert(f.click().defaultPrevented);assert.strictEqual(read,1);assert.strictEqual(navigated,0);assert.deepStrictEqual(f.opens,['sm9']);
  }finally{f.close();}
 });
 it('exposes the limitation that listeners ignoring cancellation can still navigate',()=>{
  const f=fixture();try{let noncooperative=0;f.win.document.body.addEventListener('click',()=>noncooperative++);
   f.click();assert.strictEqual(noncooperative,1);assert.deepStrictEqual(f.opens,['sm9']);
  }finally{f.close();}
 });
 for(const options of [{ctrlKey:true},{metaKey:true},{altKey:true},{button:1}])it('preserves modified click '+JSON.stringify(options),()=>{
  const f=fixture();try{assert.strictEqual(f.click(options).defaultPrevented,false);assert.deepStrictEqual(f.opens,[]);}finally{f.close();}
 });
});
describe('AUD related menu window isolation',()=>{
 const Order=canonical('advanced-src/RelatedMenuOrder.ts','RelatedMenuOrder',createContext());
 for(const id of ['twitter','tree','ad'])it('isolates default '+id+' windows from their opener',()=>{
  let args;Order.openUrl(id,'https://example.com/',{},(...a)=>args=a);
  assert.strictEqual(args[1],'_blank');assert(/(?:^|,)noopener(?:,|$)/.test(args[2]));
  if(id==='ad')assert(args[2].includes('width=428'));
 });
 it('preserves explicit same-tab navigation',()=>{let args;Order.openUrl('tree','https://example.com/',{openMode:'same-tab'},(...a)=>args=a);assert.deepStrictEqual(args,['https://example.com/','_self']);});
});
describe('AUD unsupported settings stay preserved without editable controls',()=>{
 it('does not offer the ineffective external override or YouTube quality switch in advanced settings',()=>{
  const dom=new JSDOM('<label><input type="checkbox" data-setting-name="bestZenTube">quality</label>');
  try {
   const Model=canonical('advanced-src/ModernAdvancedSettingsModel.ts','ModernAdvancedSettingsModel',createContext());
   const values={'overrideWatchLink:others':true,bestZenTube:true,overrideGinza:true,overrideWatchLink:true,'overrideWatchLink:allowPropagation':false};
   const model=new Model({config:{default:values,getValue:key=>values[key],setValue(){throw new Error('must preserve saved values');}},legacyRoot:dom.window.document.body});
   assert(!model.search('').some(d=>['overrideWatchLink:others','bestZenTube','overrideGinza','overrideWatchLink:allowPropagation'].includes(d.id)));
   assert(model.descriptor('overrideWatchLink').description.includes('外部サイト'));
   assert(model.descriptor('overrideWatchLink:allowPropagation'));
   assert.strictEqual(values.bestZenTube,true);assert.strictEqual(values['overrideWatchLink:others'],true);
  }finally{dom.window.close();}
 });
 it('renders the legacy YouTube quality control disabled with an unsupported explanation',()=>{
  const Panel=canonical('nico-src/SettingPanelElement.ts','SettingPanelElement',createContext({DialogElement:class{}}));
  const empty=new Proxy({},{get:(_,key)=>key===Symbol.toPrimitive?()=> '':empty});
  const conf=new Proxy({bestZenTube:true},{get:(o,k)=>o[k]||empty});
  const html=Panel.getPlayerSettingMenu((parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),conf);
  const dom=new JSDOM(html);try{const input=dom.window.document.querySelector('[data-setting-name="bestZenTube"]');assert(input.disabled);assert(input.parentElement.textContent.includes('非対応'));}finally{dom.window.close();}
 });
});

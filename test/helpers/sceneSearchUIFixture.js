'use strict';
const assert=require('assert'),{JSDOM}=require('jsdom');
const {loadClass}=require('./extractSource');
const {fixture}=require('./sceneSearchSettingsFixture');
async function uiFixture(stored={}){
 const dom=new JSDOM('<!doctype html><html><body><section id="panel"></section></body></html>',
  {url:'https://www.nicovideo.jp/my'});
 const data=Object.fromEntries(Object.entries(stored).map(([k,v])=>['SC_'+k,JSON.stringify(v)]));
 const h=fixture(data,dom);await h.config.restore();h.model.cancel();
 const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',h.context);
 const panel=dom.window.document.getElementById('panel');
 let ui;
 const create=()=>{ui=new UI({panel,model:h.model,storage:dom.window.localStorage,confirm:()=>true,onClose:()=>{}});
  ui.selected={category:'画面・映像',subcategory:'シーンサーチ'};ui.expanded.add('画面・映像');
  ui._renderNavigation();ui._renderCards();};
 create();
 const q=s=>panel.querySelector(s),all=s=>[...panel.querySelectorAll(s)];
 const click=s=>{const el=q(s);assert(el,s);el.click();};
 const input=id=>q('[data-setting-name="'+id+'"]');
 const toggle=(id,value)=>{const el=input(id);assert(el,id);el.checked=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 return {...h,dom,panel,q,all,click,input,toggle,
  openSection:name=>click('[data-zw-sub="画面・映像|'+name+'"]'),
  modified:id=>q('[data-zw-id="'+id+'"]')?.classList.contains('is-modified'),
  reopen(){ui.dispose();panel.replaceChildren();h.model.cancel();create();},
  dispose(){ui.dispose();dom.window.close();}
 };
}
module.exports={uiFixture};

'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {extract,createContext,run}=require('../helpers/extractSource');
describe('Pocket ranking NG stylesheet lifecycle',()=>{
 it('replaces rules after tag edits, clears on OFF, and reuses one sheet on re-enable',()=>{
  const dom=new JSDOM('<head></head><body></body>'),hooks={},config={props:{enable:false,tag:'old'},onkey(k,fn){hooks[k]=fn;}};
  const ctx=createContext({document:dom.window.document});
  try {
   run('globalThis.hideTagCss='+extract('src/_pocket.js','hideTagCss','var')+';globalThis.init='+extract('src/_pocket.js','initRankingNgStyle','var'),ctx);
   ctx.init(config);const sheet=dom.window.document.querySelector('style');assert(sheet);assert.strictEqual(sheet.textContent,'');
   config.props.enable=true;hooks.enable(true);assert(sheet.textContent.includes('?tag=old'));
   config.props.tag='new\n\nnew';hooks.tag(config.props.tag);assert(!sheet.textContent.includes('?tag=old'));assert.strictEqual(sheet.textContent.split('?tag=new').length,2);
   config.props.enable=false;hooks.enable(false);assert.strictEqual(sheet.textContent,'');
   config.props.enable=true;hooks.enable(true);assert(sheet.textContent.includes('?tag=new'));assert.strictEqual(dom.window.document.querySelectorAll('style').length,1);
  }finally{dom.window.close();}
 });
});

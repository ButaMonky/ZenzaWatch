'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
const {createContext,run,beginSection}=require('../helpers/extractSource');
function fixture(){
 const dom=new JSDOM('<body><section id="panel"><a href="/watch/sm9">video</a></section></body>',{url:'https://www.nicovideo.jp/search/test'});
 const window=dom.window,document=window.document;
 const ctx=createContext({window,document,location:window.location,cssUtil:{px:n=>n+'px'}});
 run(beginSection('packages/lib/src/nico/nicoUtil.js'),ctx);
 run(stripTypeScriptTypes(fs.readFileSync(path.resolve(__dirname,'../../tools/typescript-stage1/nico-src/HoverMenu.ts'),'utf8')).replace(/^export\s*\{[^}]*\};?$/mg,'')+';globalThis.Subject=HoverMenu;',ctx);
 const menu=Object.create(ctx.Subject.prototype),view=document.createElement('zen-button'),target=document.querySelector('a');
 view.className='ZenButton';document.body.append(view);
 menu._$view={0:view,css(v){Object.assign(view.style,v);return this;},addClass(c){view.classList.add(c);return this;},removeClass(c){view.classList.remove(c);return this;}};
 menu._hoverElement=target;let opened=0;menu._open=()=>opened++;menu._send=()=>opened++;
 return {dom,window,document,menu,view,target,opened:()=>opened};
}
describe('Zen hover surface ownership',()=>{
 it('keeps the button inside the hovered link and dropdown',()=>{const f=fixture();try{f.menu._onHoverEnd({target:f.target});assert(f.target.contains(f.view));assert(f.document.querySelector('#panel').contains(f.view));}finally{f.dom.window.close();}});
 it('does not clear hover when moving from the link to Zen',()=>{const f=fixture();try{f.menu._onHoverEnd({target:f.target});f.menu._onMouseout({target:f.target,relatedTarget:f.view});assert.strictEqual(f.menu._hoverElement,f.target);}finally{f.dom.window.close();}});
 it('owns only its button click, opens once and suppresses anchor navigation',()=>{const f=fixture();try{f.menu._onHoverEnd({target:f.target});let official=0;f.target.addEventListener('click',()=>official++);f.view.addEventListener('click',e=>f.menu._onClick(e));const e=new f.window.MouseEvent('click',{bubbles:true,cancelable:true,button:0});f.view.dispatchEvent(e);assert(e.defaultPrevented);assert.equal(official,0);assert.equal(f.opened(),1);assert(!f.view.classList.contains('show'));}finally{f.dom.window.close();}});
});

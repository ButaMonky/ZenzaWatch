'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,extract,run}=require('../helpers/extractSource');
function fixture(){
 const dom=new JSDOM('<body><section><a href="/watch/sm9"><span>video</span></a></section><div class="mylistPocketHoverMenu"><button class="command" data-command="info">?</button></div></body>',{url:'https://www.nicovideo.jp/'}),win=dom.window;
 const ctx=createContext({window:win,document:win.document,Emitter:class{},util:{resolveNicoVideoLink:()=>({watchId:'sm9'})}});
 try{run(require('../helpers/extractSource').beginSection('packages/zenza/src/pocket/PocketHoverSurface.js'),ctx);}catch(e){if(!String(e).includes('ENOENT'))throw e;}
 run(extract('src/_pocket.js','HoverMenu')+';globalThis.Subject=HoverMenu;',ctx);
 const menu=Object.create(ctx.Subject.prototype);menu._view=win.document.querySelector('.mylistPocketHoverMenu');menu._hoverElement=win.document.querySelector('a');
 return {dom,win,menu,target:menu._hoverElement};
}
describe('MylistPocket hover ancestry',()=>{
 it('keeps controls inside the video link',()=>{const f=fixture();try{f.menu._onHoverEnd({target:f.target});assert(f.target.contains(f.menu._view));assert.equal(f.menu._view.style.position,'fixed');}finally{f.dom.window.close();}});
 it('keeps the hovered target when entering its controls',()=>{const f=fixture();try{f.menu._onHoverEnd({target:f.target});f.menu._onMouseout({target:f.target,relatedTarget:f.menu._view});assert.strictEqual(f.menu._hoverElement,f.target);}finally{f.dom.window.close();}});
 it('ignores padding mousedown without throwing or invoking an action',()=>{const f=fixture();try{assert.doesNotThrow(()=>f.menu._onMousedown(new f.win.MouseEvent('mousedown')));}finally{f.dom.window.close();}});
 for(const command of ['info','playlist-queue','deflist-add'])it('owns '+command+' once without forwarding to the link',()=>{const f=fixture();try{f.menu._onHoverEnd({target:f.target});let calls=0,official=0;f.menu.emit=()=>calls++;f.menu._videoInfo=()=>calls++;f.menu._deflist=()=>calls++;f.target.addEventListener('mousedown',()=>official++);const b=f.menu._view.querySelector('button');b.dataset.command=command;f.menu._view.addEventListener('mousedown',e=>f.menu._onMousedown(e));b.dispatchEvent(new f.win.MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));assert.equal(calls,1);assert.equal(official,0);}finally{f.dom.window.close();}});
});

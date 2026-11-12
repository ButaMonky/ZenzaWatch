'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
const {createContext,run,beginSection}=require('../helpers/extractSource');
function fixture(inner){
 const dom=new JSDOM('<body><div data-anchor-href="/watch/sm9" role="button">'+inner+'</div></body>',{url:'https://www.nicovideo.jp/search/test'});
 const win=dom.window,opens=[],ctx=createContext({window:win,document:win.document,location:win.location,ZenzaWatch:{emitter:{emit(){}}}});
 win.setTimeout=()=>0;run(beginSection('packages/lib/src/nico/nicoUtil.js'),ctx);
 const source=stripTypeScriptTypes(fs.readFileSync(path.resolve(__dirname,'../../tools/typescript-stage1/nico-src/HoverMenu.ts'),'utf8')).replace(/^export\s*\{[^}]*\};?$/mg,'');
 run(source+';globalThis.Subject=HoverMenu;',ctx);
 const menu=Object.create(ctx.Subject.prototype);menu._playerConfig={props:{}};menu._open=id=>opens.push(id);menu._send=id=>opens.push(id);menu._overrideWatchLink();
 return {win,opens,click(){const e=new win.MouseEvent('click',{bubbles:true,cancelable:true,composed:true,button:0});win.document.querySelector('#hit').dispatchEvent(e);return e;}};
}
describe('generic nested action boundaries in video cards',()=>{
 for(const inner of [
  '<a href="/user/12"><span id="hit">owner</span></a>',
  '<a href="/tag/test"><span id="hit">tag</span></a>',
  '<a href="https://live.nicovideo.jp/watch/lv12"><span id="hit">live</span></a>',
  '<a href="https://example.test/watch/sm9"><span id="hit">other host</span></a>',
  '<a href="#menu"><span id="hit">menu</span></a>',
  '<a href="/watch/sm9" download><span id="hit">download</span></a>',
  '<button><span id="hit">action</span></button>',
  '<label><input type="checkbox"><span id="hit">toggle</span></label>',
  '<div contenteditable=""><span id="hit">editing</span></div>',
  '<div contenteditable="plaintext-only"><span id="hit">editing</span></div>'
 ])it('preserves the original action: '+inner,()=>{const f=fixture(inner);try{let reached=0;f.win.document.body.addEventListener('click',()=>reached++);assert.equal(f.click().defaultPrevented,false);assert.deepStrictEqual(f.opens,[]);assert(reached>=1);if(inner.includes('<label>'))assert.equal(f.win.document.querySelector('input').checked,true);}finally{f.win.close();}});
 for(const inner of ['<span id="hit">blank</span>','<time id="hit">date</time>','<a href="/watch/sm10"><span id="hit">video</span></a>'])it('retains one video launch: '+inner,()=>{const f=fixture(inner);try{assert(f.click().defaultPrevented);assert.deepStrictEqual(f.opens,[inner.includes('sm10')?'sm10':'sm9']);}finally{f.win.close();}});
});

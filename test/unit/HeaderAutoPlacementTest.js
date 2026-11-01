'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {REPO_ROOT}=require('../helpers/buildSandbox');
const {classText}=require('../helpers/nativeCssFixture.cjs');
const source=fs.readFileSync(path.join(REPO_ROOT,'src/VideoInfoPanel.js'),'utf8');
function classList(initial=[]){const s=new Set(initial);return {contains:k=>s.has(k),add:(...ks)=>ks.forEach(k=>s.add(k)),remove:(...ks)=>ks.forEach(k=>s.delete(k)),toggle:(k,on)=>on?s.add(k):s.delete(k)};}
function fixture(top){
 const classes=classList(),style={removeProperty(){},getPropertyValue(){return '';}};
 const state={top},view={classList:classes,style,getBoundingClientRect(){const overlay=classes.contains('is-onscreen');const height=overlay?100:119;const y=overlay?state.top:state.top-height-8;return {top:y,bottom:y+height,height};}};
 const context={Emitter:class{},Config:{props:{'videoHeader.position':'auto'}},Fullscreen:{now:()=>false},document:{body:{classList:classList(['zenzaScreenMode_big']),style}},window:{console:{log(){}}}};
 vm.createContext(context);vm.runInContext(classText(source,'VideoHeaderPanel')+';globalThis.Header=VideoHeaderPanel;',context);
 const subject=Object.create(context.Header.prototype);subject._$view=[view];subject.classList=classes;
 return {subject,classes,state};
}
describe('automatic header placement accounts for the outside gap',()=>{
 it('does not oscillate after hiding tags changes the overlay height',()=>{
  const h=fixture(100);const values=[];for(let i=0;i<5;i++){h.subject._onResize();values.push(h.classes.contains('is-onscreen'));}
  assert.deepStrictEqual(values,[true,true,true,true,true]);
 });
 it('keeps the legacy outside decision at the -20px boundary',()=>{
  const h=fixture(107);for(let i=0;i<5;i++){h.subject._onResize();assert.strictEqual(h.classes.contains('is-onscreen'),false);}
 });
 it('returns outside when there is room and overlays again after shrinking',()=>{
  const h=fixture(100);h.subject._onResize();h.state.top=200;h.subject._onResize();assert.strictEqual(h.classes.contains('is-onscreen'),false);
  h.state.top=100;for(let i=0;i<4;i++){h.subject._onResize();assert.strictEqual(h.classes.contains('is-onscreen'),true);}
 });
 it('tests the same 8px gap that the native stylesheet applies',()=>assert.match(source,/bottom:\s*calc\(100%\s*\+\s*8px\)/));
});

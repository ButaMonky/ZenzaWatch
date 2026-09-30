const assert=require('assert');
const {JSDOM}=require('jsdom');
const {read,beginSection,createContext,run}=require('../helpers/extractSource');
function subject(){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="player"><div class="touchWrapper"></div></div></body></html>');
 const w=dom.window;w.HTMLCanvasElement.prototype.getContext=()=>({});
 const style=w.document.createElement('style');style.textContent=read('src/NicoVideoPlayer.js').match(/    \.touchWrapper \{[^}]+\}/)[0];w.document.head.append(style);
 const c=createContext({window:w,document:w.document});const Credit=run(beginSection('packages/zenza/src/videoPlayer/SupporterCredit.js')+';SupporterCredit;',c);
 const parent=w.document.querySelector('#player'),view=new Credit.CreditView({parentNode:parent});view._initializeDom();
 return {dom,w,view,parent};
}
describe('Supporter credit skip interaction layer',()=>{
 it('keeps credit controls above the actual player touch shield',()=>{
  const h=subject();try{h.view.view.classList.add('is-show','is-visible');
   const credit=h.w.getComputedStyle(h.view.view),touch=h.w.getComputedStyle(h.parent.querySelector('.touchWrapper'));
   assert(Number(credit.zIndex)>Number(touch.zIndex),'skip parent must be above the touch shield');
   assert.strictEqual(credit.pointerEvents,'none');assert.strictEqual(h.w.getComputedStyle(h.view.view.querySelector('.scSkip')).pointerEvents,'auto');
  }finally{h.dom.window.close();}
 });
 it('dispatches one skip without bubbling a playback click',()=>{
  const h=subject();try{let skip=0,play=0;h.view.onSkip=()=>skip++;h.parent.onclick=()=>play++;
   h.view.view.querySelector('.scSkip').click();assert.strictEqual(skip,1);assert.strictEqual(play,0);
  }finally{h.dom.window.close();}
 });
 it('hides the entire credit layer before display',()=>{
  const h=subject();try{assert.strictEqual(h.w.getComputedStyle(h.view.view).display,'none');}finally{h.dom.window.close();}
 });
});

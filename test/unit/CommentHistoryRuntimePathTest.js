'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {read,extract,beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
function runtime(){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div class="zenzaPlayerContainer"><div class="videoControlBar"><button class="commentHistorySwitch controlButton" data-command="toggle-commentHistoryPanel"><svg><path/></svg></button></div></div></body></html>',{url:'https://www.nicovideo.jp/tag/test'});
 const win=dom.window;const c=createContext({window:win,document:win.document,CustomEvent:win.CustomEvent,AbortController:win.AbortController,console});
 run(beginSection('packages/lib/src/Emitter.js')+'; globalThis.__emit=EmitterInitFunc().Emitter;',c);c.Emitter=c.__emit;
 run(beginSection('packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js')+'; globalThis.__history=ZenzaCommentHistoryCore;',c);
 run(beginSection('packages/lib/src/dom/domEvent.js')+'; globalThis.__domEvent=domEvent;',c);c.util=c.__domEvent;
 const D=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',c),d=Object.create(D.prototype);
 const V=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',c),v=Object.create(V.prototype);
 const B=loadClass('src/VideoControlBar.js','VideoControlBar',c),b=Object.create(B.prototype);
 d._nicoVideoPlayer={clearCommentHistory(){}};d._playerConfig={};d._view=v;
 const container=win.document.querySelector('.zenzaPlayerContainer');
 v.on('command',d._onCommand.bind(d));
 container.addEventListener('command',e=>{e.stopPropagation();e.preventDefault();v._onCommand(e.detail.command,e.detail.param);});
 const bar=container.querySelector('.videoControlBar');bar.addEventListener('command',b._onCommandEvent.bind(b));bar.addEventListener('click',b._onClick.bind(b));
 return {dom,win,d,c,button:bar.querySelector('button'),close(){d._commentHistory?.dispose();dom.window.close();}};
}
describe('Task201 real toolbar to history panel runtime',function(){
 this.timeout(15000);
 it('opens from the actual toolbar click, dispatcher and feature factory',function(){
  const r=runtime();try {r.button.querySelector('path').dispatchEvent(new r.win.MouseEvent('click',{bubbles:true,cancelable:true}));
   assert(r.d._commentHistory,'feature constructed');assert(r.win.document.querySelector('.zenzaCommentHistoryPanel.is-open'),'panel attached and open');
  }finally{r.close();}
 });
});

function realStyles(r){
 const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
 for(const file of ['src/VideoControlBar.js','src/NicoVideoPlayerDialog.js']){
  const text=read(file);traverse(parser.parse(text,{sourceType:'module'}),{CallExpression(p){
   const n=p.node,arg=n.arguments[0];if(n.callee.type!=='MemberExpression'||n.callee.object.name!=='util'||n.callee.property.name!=='addStyle'||arg?.type!=='TemplateLiteral')return;
   const raw=text.slice(arg.start,arg.end);if(!raw.includes('.controlButton:focus-within')&&!raw.includes('body.zenzaScreenMode_big >*'))return;
   r.c.VideoControlBar={BASE_HEIGHT:60};r.c.util.toRgba=()=> 'rgba(255,255,204,0.3)';
   run('globalThis.__css='+raw,r.c);const style=r.win.document.createElement('style');style.textContent=r.c.__css;r.win.document.head.append(style);
  }});
 }
}
describe('Task201 actual Zenza stylesheet interaction',function(){
 this.timeout(15000);
 it('keeps the native history button hit-testable when mouse-down focuses it',function(){
  const r=runtime();try{realStyles(r);r.button.focus();assert(r.button.matches(':focus-within'));
   assert.strictEqual(r.win.getComputedStyle(r.button).pointerEvents,'auto');
  }finally{r.close();}
 });
 for(const mode of ['normal','big','wide','3D'])it('does not classify the history controls as background page in '+mode,function(){
  const r=runtime();try{realStyles(r);r.win.document.body.className='zenzaScreenMode_'+mode;r.button.click();
   const input=r.win.document.querySelector('[data-ch-enabled]');assert(input);
   assert.strictEqual(r.win.getComputedStyle(input).pointerEvents,'auto');
  }finally{r.close();}
 });
});

describe('Task201 existing menu behavior',function(){
 this.timeout(15000);
 it('retains focus suppression on existing submenu containers',function(){
  const r=runtime();try{realStyles(r);const menu=r.win.document.createElement('div');menu.className='controlButton';menu.tabIndex=0;r.button.parentNode.append(menu);menu.focus();
   assert.strictEqual(r.win.getComputedStyle(menu).pointerEvents,'none');
  }finally{r.close();}
 });
 it('opening and closing the panel does not enable history or change preferences',function(){
  const r=runtime();try{r.button.click();const f=r.d._commentHistory;assert(f.panel.isOpen);assert.strictEqual(f.controller.state.enabled,false);
   r.button.click();assert(!f.panel.isOpen);assert.strictEqual(r.win.localStorage.length,0);
  }finally{r.close();}
 });
});

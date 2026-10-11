'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,extract,run,loadClass}=require('../helpers/extractSource');
function setup(){
  const dom=new JSDOM('<!doctype html><body><div id="player"><div class="hoverMenuContainer">'+
    '<div class="toggleLikeButton menuButton"></div><div class="zenzaTweetButton menuButton"></div>'+
    '<div class="mylistButton mylistAddMenu menuButton"></div>'+
    '<div class="mylistButton deflistAdd menuButton"></div>'+
    '<div class="showCommentSwitch menuButton"></div><div class="ngFilterSwitch menuButton"></div>'+
    '<div class="closeButton menuButton"></div></div></div></body>',{
      url:'https://www.nicovideo.jp/watch/sm9'});
  const changes=new Map(),values={'ui.hover.like':false,'ui.hover.tweet':true};
  const config={getValue:k=>values[k]??true,onkey(k,cb){changes.set(k,cb);}};
  const emitter={on(){}};
  const util={$:()=>({on(){}}),isLogin:()=>false};
  util.$.html=()=>({appendTo(){}});
  const ctx=createContext({document:dom.window.document,window:dom.window,
    global:{emitter},util});
  ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
  run(extract('src/NicoVideoPlayerDialog.js','VideoHoverMenu')+
    ';globalThis.Subject=VideoHoverMenu;',ctx);
  const menu=Object.create(ctx.Subject.prototype);
  menu._container=dom.window.document.getElementById('player');
  menu._config=config;
  menu._initializeMylistSelectMenu=async()=>{};
  return {menu,dom,values,changes,Subject:ctx.Subject};
}
describe('Task318 hover-menu icon visibility',()=>{
  it('hides only requested icons at initial mount while keeping close visible',async()=>{
    const h=setup();await h.menu._initializeDom();
    const q=s=>h.menu._view.querySelector(s);
    assert(q('.toggleLikeButton').hidden);
    assert(!q('.zenzaTweetButton').hidden);
    assert(!q('.closeButton').hidden);
    assert.strictEqual(h.changes.size,6);
    h.dom.window.close();
  });
  it('reflects a setting update without removing the button or its command',async()=>{
    const h=setup();await h.menu._initializeDom();
    const like=h.menu._view.querySelector('.toggleLikeButton');
    h.values['ui.hover.like']=true;
    h.changes.get('ui.hover.like')();
    assert.strictEqual(like.hidden,false);
    h.values['ui.hover.watchLater']=false;
    h.changes.get('ui.hover.watchLater')();
    assert(h.menu._view.querySelector('.mylistButton.deflistAdd').hidden);
    assert(h.menu._view.querySelector('.closeButton'));
    h.dom.window.close();
  });
  it('contains precisely the optional six icons, not playback/close/recovery',()=>{
    const h=setup();
    assert.strictEqual(h.Subject.VISIBILITY.length,6);
    assert(!h.Subject.VISIBILITY.some(([,selector])=>/close|reload|togglePlay/.test(selector)));
    h.dom.window.close();
  });
});
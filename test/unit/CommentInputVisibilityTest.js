'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read}=require('../helpers/extractSource');
function setup(visible=true,rel='src/CommentInputPanel.js') {
  const dom=new JSDOM('<!doctype html><body><div id="panel" class="commentInputPanel">'+
    '<input class="commandInput"><input class="commentInput"></div></body>',{
      url:'https://www.nicovideo.jp/watch/sm9'});
  const win=dom.window;
  const ctx=createContext({Emitter:class {},document:win.document});
  ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
  const Panel=loadClass(rel,'CommentInputPanel',ctx);
  const view=win.document.getElementById('panel');
  const q=sel=>view.querySelector(sel);
  const wrap=el=>({0:el,focus(){el.focus();},blur(){el.blur();},
    hasFocus(){return win.document.activeElement===el;}});
  const values={'ui.commentInput':visible};
  const callbacks=new Map();
  const config={props:values,getValue:key=>values[key],
    onkey(key,fn){callbacks.set(key,fn);}};
  const panel=Object.create(Panel.prototype);
  Object.assign(panel,{_$view:[view],_$commandInput:wrap(q('.commandInput')),
    _$commentInput:wrap(q('.commentInput')),config,_hasFocus:false});
  const events=[];
  panel.emit=type=>events.push(type);
  panel._togglePopover=()=>{};
  return {Panel,panel,dom,view,values,events,callbacks};
}
describe('Task318 comment-entry visibility without losing behavior',()=>{
  it('hides the whole input panel but preserves its DOM and input contents',()=>{
    const h=setup(false);
    h.view.querySelector('.commentInput').value='入力途中';
    h.panel._applyVisibility();
    assert.strictEqual(h.view.hidden,true);
    assert.strictEqual(h.view.querySelector('.commentInput').value,'入力途中');
    h.panel.focus();
    assert.notStrictEqual(h.dom.window.document.activeElement,
      h.view.querySelector('.commentInput'),'hidden field must not capture focus');
    h.values['ui.commentInput']=true;
    h.panel._applyVisibility();
    assert.strictEqual(h.view.hidden,false);
    assert.strictEqual(h.view.querySelector('.commentInput').value,'入力途中');
    h.dom.window.close();
  });
  it('releases focus and corresponding pause state if hidden while typing',()=>{
    const h=setup(true);
    h.panel._applyVisibility();
    h.panel.focus();
    assert.strictEqual(h.dom.window.document.activeElement,
      h.view.querySelector('.commentInput'));
    h.values['ui.commentInput']=false;
    h.panel._applyVisibility();
    assert.strictEqual(h.view.hidden,true);
    assert(h.events.includes('blur'),'normal blur event must be emitted');
    h.panel._onBlur(); // the existing 500ms debounced blur must not re-emit
    assert.strictEqual(h.events.filter(event=>event==='blur').length,1);
    assert.notStrictEqual(h.dom.window.document.activeElement,
      h.view.querySelector('.commentInput'));
    h.dom.window.close();
  });
  it('wires initial visibility and live Config events without changing posting',()=>{
    const source=read('src/CommentInputPanel.js');
    assert(source.includes('UiVisibilityRegistry.connect('));
    assert(source.includes('.commentInputPanel[hidden] { display: none !important; }'));
    assert(!source.includes("this._$commentInput.remove()"));
    const h=setup();
    h.panel._applyVisibility();
    assert.strictEqual(h.view.hidden,false);
    h.dom.window.close();
  });
});

describe('Task318 comment input Config subscription integration',()=>{
  it('installs one change handler and applies the restored value immediately',()=>{
    const h=setup(false);
    const stub=h.panel;
    h.Panel.prototype._initializeDom=function(){
      this._$view=stub._$view;
      this._$commandInput=stub._$commandInput;
      this._$commentInput=stub._$commentInput;
    };
    const instance=new h.Panel({
      $playerContainer:h.view.parentNode,playerConfig:stub.config});
    assert(h.view.hidden,'initially saved OFF');
    assert(h.callbacks.has('ui.commentInput'));
    assert(h.callbacks.has('autoPauseCommentInput'));
    h.values['ui.commentInput']=true;
    h.callbacks.get('ui.commentInput')();
    assert.strictEqual(h.view.hidden,false);
    assert.strictEqual(instance._$view[0],h.view);
    h.dom.window.close();
  });
});

describe('Task318 compiled player parity',()=>{
  it('keeps hidden-field focus isolation in the generated dev userscript',()=>{
    const h=setup(false,'dist/ZenzaWatch-dev.user.js');
    h.panel._applyVisibility();
    assert(h.view.hidden);
    h.panel.focus();
    assert.notStrictEqual(h.dom.window.document.activeElement,
      h.view.querySelector('.commentInput'));
    h.values['ui.commentInput']=true;
    h.panel._applyVisibility();
    assert(!h.view.hidden);
    h.dom.window.close();
  });
});

'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');

function harness(initial=5,callback=()=>{}) {
  const dom=new JSDOM('<!doctype html><html><body><main id="mount"></main></body></html>',
    {url:'https://example.invalid'});
  const document=dom.window.document;
  const Class=loadClass('packages/zenza/src/sceneSearch/SceneSeekStepControl.js',
    'SceneSeekStepControl',createContext({document}));
  const values=[],seeks=[],compacts=[],errors=[],menuChanges=[];
  let step=initial;
  const control=new Class({document,getSeconds:()=>step,
    setSeconds:value=>{callback(value);step=value;values.push(value);},
    onSeek:delta=>seeks.push(delta),
    onCompactChange:(value,layout)=>compacts.push([value,layout]),
    onMenuChange:open=>menuChanges.push(open),
    onError:error=>errors.push(error.message)});
  const container=document.getElementById('mount');
  control.mount(container);
  const get=id=>control.root.querySelector('[data-scui="'+id+'"]');
  const click=id=>get(id).click();
  const close=()=>dom.window.close();
  return {dom,document,container,control,get,click,close,
    values,seeks,compacts,menuChanges,errors,get step(){return step;}};
}

describe('SCUI-05 seek-step compact control',function(){
  it('renders presets and opens/closes the menu with focus',()=>{
    const h=harness();
    assert.strictEqual(h.control.root.querySelectorAll('[data-scui="preset"]').length,8);
    assert.strictEqual(h.get('panel').hidden,true);
    h.click('open');
    assert.strictEqual(h.get('panel').hidden,false);
    assert.strictEqual(h.get('open').getAttribute('aria-expanded'),'true');
    assert.strictEqual(h.document.activeElement,h.get('custom'));
    h.click('cancel');
    assert.strictEqual(h.get('panel').hidden,true);
    assert.deepStrictEqual(h.menuChanges,[true,false],
      'the parent can release its hover/focus lock when menu closes');
    h.close();
  });
  it('steps backward/forward and persists a preset without touching other settings',()=>{
    const h=harness(5);
    h.click('back');h.click('forward');
    assert.deepStrictEqual(h.seeks,[-5,5]);
    h.click('open');
    const b=Array.from(h.control.root.querySelectorAll('[data-scui="preset"]'))
      .find(x=>x.dataset.seconds==='15');
    b.click();
    assert.strictEqual(h.step,15);
    assert.deepStrictEqual(h.values,[15]);
    assert.strictEqual(h.get('panel').hidden,true);
    h.click('back');
    assert.deepStrictEqual(h.seeks,[-5,5,-15]);
    h.close();
  });
  it('zero hides and disables arrows, shrinks preview, restores on nonzero',()=>{
    const h=harness();
    assert.strictEqual(h.control.root.classList.contains('is-compact'),false);
    assert.strictEqual(h.get('back').hidden,false);
    assert.strictEqual(h.control.setStep(0),true);
    assert.strictEqual(h.get('back').hidden,true);
    assert.strictEqual(h.get('forward').hidden,true);
    assert.strictEqual(h.get('back').disabled,true);
    assert.strictEqual(h.get('back').style.display,'none');
    assert.strictEqual(h.control.root.style.getPropertyValue('--scene-preview-min-width'),'124px');
    assert.strictEqual(h.control.seek(-1),false);
    assert.deepStrictEqual(h.seeks,[]);
    assert.strictEqual(h.control.setStep(3),true);
    assert.strictEqual(h.get('back').hidden,false);
    assert.strictEqual(h.get('back').disabled,false);
    assert.strictEqual(h.control.root.style.getPropertyValue('--scene-preview-min-width'),'180px');
    assert.deepStrictEqual(h.compacts.map(x=>x[0]),[false,true,false]);
    h.close();
  });
  it('allows a custom integer in range and rejects malformed/out of range atomically',()=>{
    const h=harness(5);
    h.click('open');
    for(const bad of ['','-1','3.5','601','abc','1e2']){
      h.get('custom').value=bad;
      h.click('save');
      assert.strictEqual(h.step,5,'still unchanged: '+bad);
      assert.strictEqual(h.get('panel').hidden,false);
    }
    h.get('custom').value='600';h.click('save');
    assert.strictEqual(h.step,600);
    assert.strictEqual(h.get('panel').hidden,true);
    assert.deepStrictEqual(h.values,[600]);
    h.close();
  });
  it('Esc and outside pointerdown close; disposal removes all listeners',()=>{
    const h=harness();
    h.click('open');
    const escape=new h.dom.window.KeyboardEvent('keydown',{bubbles:true,key:'Escape'});
    h.get('custom').dispatchEvent(escape);
    assert.strictEqual(h.get('panel').hidden,true);
    h.click('open');
    h.document.body.dispatchEvent(new h.dom.window.Event('pointerdown',{bubbles:true}));
    assert.strictEqual(h.get('panel').hidden,true);
    h.click('open');
    h.control.dispose();h.control.dispose();
    assert.strictEqual(h.container.children.length,0);
    assert.strictEqual(h.control.root,null);
    h.close();
  });
  it('handles persistence errors without lying about saved seconds',()=>{
    const h=harness(5,()=>{throw new Error('Storage unavailable');});
    assert.strictEqual(h.control.setStep(30),false);
    assert.strictEqual(h.step,5);
    assert.strictEqual(h.control.seconds,5);
    assert.deepStrictEqual(h.errors,['Storage unavailable']);
    h.close();
  });
});

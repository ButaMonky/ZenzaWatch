// Task450: synthetic DOM-only parity, never loads NicoNico pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';
import {renderStyleLegacy} from '../scripts/sync-style-switcher.mjs';
import {JSDOM} from 'jsdom';
import {StyleSwitcher as typed} from '../.generated/StyleSwitcher.js';
import {StyleSwitcher as runtime} from
  '../../../packages/lib/src/css/StyleSwitcher.js';

const expectedOriginalHash='bd6dacf910e00e745642d46634b0e872a644f45a7cc7287442bd087e821e9c17';
const original=readFileSync(new URL('./fixtures/StyleSwitcher.before-task450.js',import.meta.url),'utf8');
const actual=readFileSync(new URL('../../../packages/lib/src/css/StyleSwitcher.js',import.meta.url),'utf8');
const transpiled=readFileSync(new URL('../.generated/StyleSwitcher.js',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const lf=s=>s.replace(/\r\n/g,'\n');

function originalImplementation(doc){
  const start=original.indexOf('//===BEGIN==='),end=original.indexOf('//===END===');
  assert.ok(start>=0&&end>start);
  const context=createContext({Array,Object,document:doc,window:{document:doc}});
  runInContext(original.slice(start+13,end)+'\nglobalThis.Style = StyleSwitcher;',context,{
    timeout:1000
  });
  return context.Style;
}

function syntheticDocument(){
  const item=disabled=>({disabled,dataset:{switch:'unset'}});
  const elements={
    '.enabled':[item(true),item(true)],
    '.disabled':[item(false)],
    '.base.one':[item(true),item(false)],
    '.base.two':[item(false)],
    '.base.three':[item(false)],
    '.base.none':[]
  };
  const calls=[];
  const doc={head:{querySelectorAll(selector){
    calls.push(selector);
    return elements[selector]||[];
  }}};
  return {doc,calls,elements};
}
function state(x){
  return {calls:x.calls.slice(),elements:Object.fromEntries(
    Object.entries(x.elements).map(([k,a])=>[k,a.map(e=>({
      disabled:e.disabled,marker:e.dataset.switch
    }))])
  )};
}
function withDocument(doc,fn){
  const priorDoc=globalThis.document,priorWindow=globalThis.window;
  try{globalThis.document=doc;globalThis.window={document:doc};return fn();}
  finally{
    if(priorDoc===undefined)delete globalThis.document;
    else globalThis.document=priorDoc;
    if(priorWindow===undefined)delete globalThis.window;
    else globalThis.window=priorWindow;
  }
}
function perform(Style,scenario){
  const x=syntheticDocument();
  const impl=Style==='original'?originalImplementation(x.doc):Style;
  withDocument(x.doc,()=>{
    if(scenario==='update-both')impl.update({
      on:'.enabled',off:'.disabled',document:x.doc
    });
    if(scenario==='update-empty')impl.update({on:'',off:null,document:x.doc});
    if(scenario==='update-overlap')impl.update({
      on:'.base.one',off:'.base.one',document:x.doc
    });
    if(scenario==='add')impl.addClass('.base','one','two');
    if(scenario==='remove')impl.removeClass('.base','one','two');
    if(scenario==='toggle-default')impl.toggleClass('.base','one');
    if(scenario==='toggle-true')impl.toggleClass('.base','one',true);
    if(scenario==='toggle-false')impl.toggleClass('.base','one',false);
    if(scenario==='toggle-zero')impl.toggleClass('.base','one',0);
    if(scenario==='unmatched')impl.toggleClass('.base','none');
    if(scenario==='combine'){
      impl.update({on:'.enabled',document:x.doc});
      impl.addClass('.base','one','three');
      impl.removeClass('.base','two');
      impl.toggleClass('.base','one');
    }
  });
  return state(x);
}

test('canonical TypeScript emits the tracked, marker-based legacy module',()=>{
  assert.equal(sha(original),expectedOriginalHash);
  assert.equal(lf(actual),renderStyleLegacy(transpiled));
  assert.equal((actual.match(/\/\/===BEGIN===/g)||[]).length,1);
  assert.equal((actual.match(/\/\/===END===/g)||[]).length,1);
});
test('rejects unexpected compiler output, imports, exports and marker injection',()=>{
  assert.throws(()=>renderStyleLegacy('export {StyleSwitcher};'),/STYLE_TS_EXPORT_INVALID/);
  assert.throws(()=>renderStyleLegacy('class Extra {}\nexport { StyleSwitcher };'),
    /STYLE_TS_OUTPUT_INVALID/);
  assert.throws(()=>renderStyleLegacy('class StyleSwitcher { //===END===\n}\nexport { StyleSwitcher };'),
    /STYLE_TS_OUTPUT_INVALID/);
});
for(const scenario of [
  'update-both','update-empty','update-overlap','add','remove',
  'toggle-default','toggle-true','toggle-false','toggle-zero','unmatched','combine'
]){
  test('matches the original behavior in scenario '+scenario,()=>{
    const expected=perform('original',scenario);
    assert.deepEqual(perform(typed,scenario),expected);
    assert.deepEqual(perform(runtime,scenario),expected);
  });
}

test('real DOM style and link elements keep the original enable/disable behavior',()=>{
  const dom=new JSDOM('<!doctype html><html><head>'+
    '<style class="zenza-open">body{color:black}</style>'+
    '<style class="screenMode">body{opacity:1}</style>'+
    '<link rel="stylesheet" class="screenMode" href="/style.css">'+
    '</head><body></body></html>',{url:'https://example.invalid/'});
  try{
    const doc=dom.window.document;
    const open=doc.head.querySelector('style.zenza-open');
    const disabled=doc.head.querySelectorAll('.screenMode');
    open.disabled=true;
    disabled.forEach(node=>node.disabled=false);
    runtime.update({on:'style.zenza-open',off:'.screenMode',document:doc});
    assert.equal(open.disabled,false);
    assert.equal(open.dataset.switch,'on');
    for(const node of disabled){
      assert.equal(node.disabled,true);
      assert.equal(node.dataset.switch,'off');
    }
    withDocument(doc,()=>{
      runtime.toggleClass('style','screenMode');
      assert.equal(doc.head.querySelector('style.screenMode').disabled,false);
      runtime.removeClass('style','screenMode');
      assert.equal(doc.head.querySelector('style.screenMode').disabled,true);
    });
  }finally{
    dom.window.close();
  }
});

'use strict';
// Canonical TS is stripped in memory; no shared generated outputs are mutated.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
const parser=require('@babel/parser');
const {JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../../tools/typescript-stage1/nico-src');
const source=fs.readFileSync(path.join(base,'VideoControlBar.ts'),'utf8');
function classSource(file,name){
  const js=stripTypeScriptTypes(fs.readFileSync(path.join(base,file+'.ts'),'utf8'));
  const ast=parser.parse(js,{sourceType:'module',allowUndeclaredExports:true});
  for(const entry of ast.program.body){
    const node=entry.declaration||entry;
    if(node.type==='ClassDeclaration'&&node.id.name===name)return js.slice(node.start,node.end);
  }
  throw new Error(name+' missing');
}
function fixture(){
  const dom=new JSDOM('<div class="seekBarContainer"><div class="seekBar"><input class="seekRange" type="range"><div class="seekBarPointer"></div></div></div>');
  const ctx=vm.createContext({Emitter:class{},Number});
  vm.runInContext(classSource('TimelineGeometry','TimelineGeometry')+';'+
    classSource('SceneResumeMarkerPresenter','SceneResumeMarkerPresenter')+';'+
    classSource('VideoControlBar','VideoControlBar')+';globalThis.Bar=VideoControlBar',ctx);
  const bar=Object.create(ctx.Bar.prototype);
  const seek=dom.window.document.querySelector('.seekBar');
  Object.assign(bar,{_seekBar:seek,_playerState:{videoInfo:{watchId:'sm1'}},
    _$view:[dom.window.document.body],_$seekBarContainer:[seek.parentElement],
    _startTimer(){},_stopTimer(){},_cancelStoryboardLongPress(){},
    resetBufferedRange(){},refreshAutoResumePointers(){},
    storyboard:{reset(){},load(){}},_pointer:{},_wheelSeeker:{},
    _playerConfig:{},_$view:{raf:{toggleClass(){}}}});
  // Lifecycle setters touch native range and labels: use isolated values here.
  Object.defineProperty(bar,'duration',{value:100,writable:true});
  Object.defineProperty(bar,'currentTime',{value:0,writable:true});
  bar._$view=[dom.window.document.body];
  return {bar,seek,dom};
}
describe('AB range native seekbar overlay',()=>{
  it('renders passive draft and active ranges inside the native geometry owner',()=>{
    const {bar,seek,dom}=fixture();
    bar.setABRepeatRange({a:25,b:75,active:false},100,'sm1');
    const layer=seek.querySelector('.abRepeatRangeLayer');
    assert(layer);assert.equal(layer.getAttribute('aria-hidden'),'true');
    assert.equal(layer.querySelector('.abRepeatRangeBand').style.left,'25%');
    assert.equal(layer.querySelector('.abRepeatRangeBand').style.width,'50%');
    assert(!layer.classList.contains('is-active'));
    assert.equal(layer.querySelector('.abRepeatMarkerA').textContent,'A');
    assert.equal(layer.querySelector('.abRepeatMarkerB').textContent,'B');
    assert.equal(layer.querySelectorAll('button,input,[tabindex]').length,0);
    const range=seek.querySelector('input');
    bar.setABRepeatRange({a:25,b:75,active:true},100,'sm1');
    assert.equal(seek.querySelector('input'),range);
    assert(layer.classList.contains('is-active'));
    dom.window.close();
  });
  it('accepts partial drafts, clamps finite endpoints, and suppresses invalid/reversed bands',()=>{
    const {bar,seek,dom}=fixture();
    for(const [a,b,markers,band] of [[10,null,1,false],[null,90,1,false],
      [80,20,2,false],[30,30,2,false],[NaN,90,1,false],[10,Infinity,1,false],
      [-10,120,2,true],[0,100,2,true]]){
      bar.setABRepeatRange({a,b,active:true},100,'sm1');
      assert.equal(seek.querySelectorAll('.abRepeatMarker').length,markers);
      assert.equal(!!seek.querySelector('.abRepeatRangeBand'),band);
      assert.equal(seek.querySelector('.abRepeatRangeLayer').classList.contains('is-active'),band);
    }
    assert.equal(seek.querySelector('.abRepeatMarkerB').style.left,'100%');
    assert.equal(seek.querySelector('.abRepeatRangeBand').style.width,'100%');
    bar.setABRepeatRange({a:0,b:100,active:true},NaN,'sm1');
    assert.equal(seek.querySelector('.abRepeatRangeLayer').childElementCount,0);
    dom.window.close();
  });
  it('ignores stale video updates and clears on null, open, close and video replacement',()=>{
    const {bar,seek,dom}=fixture();
    const set=()=>bar.setABRepeatRange({a:10,b:20,active:true},100,'sm1');
    const count=()=>seek.querySelectorAll('.abRepeatMarker').length;
    set();
    bar.setABRepeatRange({a:50,b:60,active:true},100,'sm2');
    assert.equal(seek.querySelector('.abRepeatMarkerA').style.left,'10%');
    bar.setABRepeatRange(null,100,'sm1');assert.equal(count(),0);
    set();bar._onPlayerClose();assert.equal(count(),0);
    set();assert.equal(count(),0,'late result after close must remain hidden');
    bar._onPlayerOpen('sm2');set();assert.equal(count(),0,'old player state during open must not render');
    bar._playerState.videoInfo.watchId='sm2';
    bar.setABRepeatRange({a:10,b:20,active:true},100,'sm2');assert.equal(count(),2);
    bar._onLoadVideoInfo({watchId:'sm3',duration:100});assert.equal(count(),0);
    dom.window.close();
  });
  it('shares native height and scaling instead of hardcoding hover coordinates or intercepting input',()=>{
    const rule=source.match(/\.timelineMarkerLayer\s*\{([^}]+)\}/);
    assert(rule,'overlay geometry CSS');
    assert(/position:\s*absolute/.test(rule[1]));
    assert(/inset:\s*0/.test(rule[1]));
    assert(/pointer-events:\s*none/.test(rule[1]));
    assert(!/height:\s*\d+px/.test(rule[1]));
    const band=source.match(/\.timelineInterval\s*\{([^}]+)\}/)[1];
    assert(/top:\s*0/.test(band));assert(/height:\s*100%/.test(band));
    const hover=source.match(/\.seekBar:hover\s*\{([^}]+)\}/)[1];
    assert(/height:\s*24px/.test(hover));
    assert(!/\.abRepeatRangeLayer[^{}]*:hover/.test(source));
    assert(/\.abRepeatRangeLayer\s*\{\s*z-index:\s*195/.test(source),'stay below native pointer z-index 200');
    const method=source.slice(source.indexOf('    setABRepeatRange('),source.indexOf('    _clearABRepeatRange('));
    assert(method.includes('SceneResumeMarkerPresenter.projectInterval'));
    assert(!/addEventListener|setInterval|requestAnimationFrame|getBoundingClientRect/.test(method));
  });
});

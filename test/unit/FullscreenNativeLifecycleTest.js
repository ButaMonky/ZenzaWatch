'use strict';
const assert=require('assert');
const {createContext,extract,run}=require('../helpers/extractSource');
const SOURCE='packages/lib/src/dom/Fullscreen.js';
const DIST='dist/ZenzaWatch-dev.user.js';

function createHarness(file,mode='standard'){
  const events=[], emissions=[], css=[], calls=[];
  const document={
    body:{},
    getElementById(id){return id==='found'?target:null;},
    addEventListener(type,handler,capture){events.push({type,handler,capture});}
  };
  let target={};
  const setFullscreen=(element,on)=>{
    if(mode==='standard'||mode==='dual')document.fullscreenElement=on?element:null;
    if(mode==='webkit')document.webkitFullscreenElement=on?element:null;
    if(mode==='moz')document.mozFullScreenElement=on?element:null;
    if(mode==='ms')document.msFullscreenElement=on?element:null;
  };
  const enter=(kind)=>{calls.push('enter:'+kind);setFullscreen(target,true);};
  const exit=(kind)=>{calls.push('exit:'+kind);setFullscreen(target,false);};
  if(mode==='standard'||mode==='dual'){
    target.requestFullscreen=()=>enter('standard');
    document.exitFullscreen=()=>exit('standard');
  }
  if(mode==='webkit'||mode==='dual'){
    target.webkitRequestFullScreen=()=>enter('webkit');
    document.webkitCancelFullScreen=()=>exit('webkit');
  }
  if(mode==='moz'){
    target.mozRequestFullScreen=()=>enter('moz');
    document.mozCancelFullScreen=()=>exit('moz');
  }
  if(mode==='ms'){
    target.msRequestFullscreen=()=>enter('ms');
    document.msExitFullscreen=()=>exit('ms');
  }
  const context=createContext({
    document, _:{noop(){}},
    ClassList:()=>({toggle:(key,value)=>css.push([key,value])}),
    global:{emitter:{emit:(key,value)=>emissions.push([key,value])}}
  });
  run('globalThis.__actual = '+extract(file,'Fullscreen','var'),context);
  const fullscreen=context.__actual;
  function fire(type='fullscreenchange'){
    let stopped=false, nativeFired=0;
    const ev={stopImmediatePropagation(){stopped=true;}};
    for(const entry of events.filter(e=>e.type===type)){
      if(stopped)break;
      entry.handler(ev);
      nativeFired++;
    }
    return {stopped,nativeFired};
  }
  return {document,target,events,emissions,css,calls,fullscreen,fire};
}
describe('Task356 AUD-29 Fullscreen helper request/event ownership',()=>{
  for(const [name,file] of [['source',SOURCE],['generated dist',DIST]]){
    it(name+' skips invalid targets without installing listeners',()=>{
      const h=createHarness(file);
      for(let i=0;i<100;i++)h.fullscreen.request('missing');
      assert.strictEqual(h.events.length,0);
      assert.deepStrictEqual(h.calls,[]);
      h.fullscreen.request('found');
      assert.strictEqual(h.events.length,4);
      assert.deepStrictEqual(h.calls,['enter:standard']);
    });
    it(name+' registers exactly one capture listener per event across requests',()=>{
      const h=createHarness(file);
      for(let i=0;i<20;i++)h.fullscreen.request(h.target);
      assert.strictEqual(h.events.length,4);
      assert.strictEqual(h.events.filter(e=>e.type==='fullscreenchange').length,1);
      assert.ok(h.events.every(e=>e.capture===true));
      assert.strictEqual(h.calls.length,20);
    });
    it(name+' uses standard APIs for enter/exit and reports the active target',()=>{
      const h=createHarness(file);
      assert.strictEqual(h.fullscreen.now(),false);
      assert.strictEqual(h.fullscreen.get(),null);
      h.fullscreen.request(h.target);
      assert.strictEqual(h.fullscreen.now(),true);
      assert.strictEqual(h.fullscreen.get(),h.target);
      h.fullscreen.cancel();
      assert.strictEqual(h.fullscreen.now(),false);
      assert.strictEqual(h.fullscreen.get(),null);
      assert.deepStrictEqual(h.calls,['enter:standard','exit:standard']);
    });
    it(name+' prefers standards over simultaneously available vendor methods',()=>{
      const h=createHarness(file,'dual');
      h.fullscreen.request(h.target);
      h.fullscreen.cancel();
      assert.deepStrictEqual(h.calls,['enter:standard','exit:standard']);
    });
    it(name+' broadcasts fullscreen changes without hiding native events',()=>{
      const h=createHarness(file);
      h.fullscreen.request(h.target);
      let nativeCount=0;
      h.document.addEventListener('fullscreenchange',()=>{nativeCount++;},false);
      const observed=h.fire();
      assert.strictEqual(observed.stopped,false);
      assert.strictEqual(nativeCount,1);
      assert.deepStrictEqual(h.emissions,[['fullscreenStatusChange',true]]);
      assert.deepStrictEqual(h.css,[['is-fullscreen',true]]);
      h.fullscreen.cancel();
      h.fire();
      assert.strictEqual(nativeCount,2);
      assert.deepStrictEqual(h.emissions,[
        ['fullscreenStatusChange',true],['fullscreenStatusChange',false]]);
    });
    it(name+' retains WebKit, Firefox and MS legacy entry/exit fallbacks',()=>{
      for(const vendor of ['webkit','moz','ms']){
        const h=createHarness(file,vendor);
        h.fullscreen.request(h.target);
        assert.strictEqual(h.fullscreen.now(),true,vendor);
        assert.strictEqual(h.fullscreen.get(),h.target,vendor);
        h.fullscreen.cancel();
        assert.strictEqual(h.fullscreen.now(),false,vendor);
        assert.deepStrictEqual(h.calls,['enter:'+vendor,'exit:'+vendor]);
      }
    });
    it(name+' recognizes older state flags even without an element getter',()=>{
      const h=createHarness(file,'webkit');
      h.document.webkitFullscreenElement=null;
      h.document.webkitIsFullScreen=true;
      assert.strictEqual(h.fullscreen.now(),true);
      assert.strictEqual(h.fullscreen.get(),null);
      h.fullscreen.cancel();
      assert.deepStrictEqual(h.calls,['exit:webkit']);
    });
  }
});

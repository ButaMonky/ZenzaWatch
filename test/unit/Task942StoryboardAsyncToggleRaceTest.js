'use strict';
// Use the real Storyboard implementation with a queued DataStorage-like onkey.
// DataStorage.emitAsync notifies on a later timer, after props already changed.
const assert=require('assert');
const {createContext,loadClass,read,run,beginSection}=require('../helpers/extractSource');

function setup(initial=false,externalConfig=null){
  const queue=[],listeners=new Map(),actions=[];
  const store={enableStoryboardBar:initial,enableStoryboard:true};
  const props=new Proxy(store,{set(target,key,value){
    if(target[key]!==value){
      target[key]=value;
      queue.push([String(key),value]);
    }
    return true;
  }});
  const config={
    props,
    onkey(key,fn){
      const handlers=listeners.get(key)||new Set();
      handlers.add(fn);listeners.set(key,handlers);
    },
    offkey(key,fn){listeners.get(key)?.delete(fn);}
  };
  class View{
    constructor(params){this.isEnable=!!params.enable;actions.push(['created',this.isEnable]);}
    enable(){this.isEnable=true;actions.push(['enable']);}
    disable(){this.isEnable=false;actions.push(['disable']);}
    toggle(){this.isEnable=!this.isEnable;actions.push(['toggle',this.isEnable]);}
  }
  class Model{constructor(){this.isAvailable=true;}}
  class Emitter{on(){return this;}emitResolve(){}}
  const ctx=createContext({
    Emitter,StoryboardView:View,StoryboardInfoModel:Model,
    StoryboardInfoLoader:{load(){throw Error('network not allowed');}},
    global:{debug:{}}
  });
  const S=loadClass('packages/zenza/src/storyboard/Storyboard.js','Storyboard',ctx);
  const board=new S({playerConfig:externalConfig||config,state:{},container:{}});
  const deliver=()=>{
    const next=queue.shift();
    if(!next)return false;
    for(const fn of listeners.get(next[0])||[])fn(next[1]);
    return true;
  };
  const drain=()=>{while(deliver()){}};
  return {board,config,store,actions,queue,deliver,drain,listeners};
}

describe('Task942 storyboard async notification + toolbar click races',()=>{
  it('a click immediately after a shortcut flips the latest CONFIG state, not the stale view',()=>{
    const h=setup(false);h.board._initializeStoryboard();
    h.config.props.enableStoryboardBar=true; // shortcut, update event not delivered yet
    h.board.toggle(); // user clicks bar toggle again -> must turn it OFF
    assert.strictEqual(h.config.props.enableStoryboardBar,false,
      'Click incorrectly wrote the already-current value instead of toggling it');
    assert.strictEqual(h.board.view.isEnable,false);
    h.drain();
    assert.strictEqual(h.board.view.isEnable,false,'delayed shortcut event reopened the bar');
    assert.deepStrictEqual(h.actions,[['created',false]],'no redundant UI transitions');
  });
  it('old queued true/false notifications cannot flicker the latest false state',()=>{
    const h=setup(false);h.board._initializeStoryboard();
    h.config.props.enableStoryboardBar=true;
    h.config.props.enableStoryboardBar=false;
    assert.strictEqual(h.queue.length,2);
    h.deliver(); // old event "true"; config is already false
    assert.strictEqual(h.board.view.isEnable,false,'outdated event must not open');
    h.deliver();
    assert.deepStrictEqual(h.actions,[['created',false]],'stale events caused extra animation');
  });
  it('a delayed event that predates initial view construction is ignored',()=>{
    const h=setup(false);
    h.config.props.enableStoryboardBar=true;
    h.config.props.enableStoryboardBar=false;
    h.board._initializeStoryboard();
    h.drain();
    assert.strictEqual(h.board.view.isEnable,false);
    assert.deepStrictEqual(h.actions,[['created',false]]);
  });
  it('rapid double toolbar clicks remain two independent toggles',()=>{
    const h=setup(false);h.board._initializeStoryboard();
    h.board.toggle();h.board.toggle();
    assert.strictEqual(h.config.props.enableStoryboardBar,false);
    h.drain();
    assert.strictEqual(h.board.view.isEnable,false);
    assert.deepStrictEqual(h.actions,[['created',false],['toggle',true],['toggle',false]]);
  });
  it('still responds to a genuine new preference change when delivered',()=>{
    const h=setup(false);h.board._initializeStoryboard();
    h.config.props.enableStoryboardBar=true;
    h.deliver();
    assert.strictEqual(h.board.view.isEnable,true);
    h.config.props.enableStoryboardBar=false;
    h.deliver();
    assert.strictEqual(h.board.view.isEnable,false);
    assert.deepStrictEqual(h.actions,[['created',false],['enable'],['disable']]);
  });
  it('preserves the latest setting when actual DataStorage emits updates asynchronously',async()=>{
    // Real DataStorage.getValue/onkey + real Emitter.emitAsync, not a bespoke proxy.
    const context=createContext({
      localStorage:{},console,
      bounce:{time:fn=>fn},
      objUtil:{bridge(dest,source){
        for(const name of Object.getOwnPropertyNames(Object.getPrototypeOf(source))){
          if(typeof source[name]==='function'){dest[name]=source[name].bind(source);}
        }
      }}
    });
    run(beginSection('packages/lib/src/Emitter.js'),context);
    const DataStorage=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',context);
    const prefs=new DataStorage({enableStoryboardBar:false,enableStoryboard:true},
      {prefix:'Task942',storage:{}});
    await prefs.promise('restore');
    const h=setup(false,prefs);
    h.board._initializeStoryboard();
    // Real props setter queues Emitter.emitAsync. No shortcut callback yet.
    prefs.props.enableStoryboardBar=true;
    h.board.toggle();
    assert.strictEqual(prefs.props.enableStoryboardBar,false);
    assert.strictEqual(h.board.view.isEnable,false);
    await new Promise(resolve=>setTimeout(resolve,30));
    assert.strictEqual(prefs.getValue('enableStoryboardBar'),false);
    assert.strictEqual(h.board.view.isEnable,false);
    assert.deepStrictEqual(h.actions,[['created',false]],
      'late DataStorage notifications must not produce false flash');
  });
  it('the reverse race also respects the latest OFF preference before a click',()=>{
    const h=setup(true);h.board._initializeStoryboard();
    h.config.props.enableStoryboardBar=false; // shortcut still queued
    h.board.toggle(); // click should restore ON
    assert.strictEqual(h.config.props.enableStoryboardBar,true);
    assert.strictEqual(h.board.view.isEnable,true);
    h.drain();
    assert.strictEqual(h.board.view.isEnable,true);
    assert.deepStrictEqual(h.actions,[['created',true]]);
  });
  it('reusing the storyboard across video initialization does not duplicate listeners',()=>{
    const h=setup(false);h.board._initializeStoryboard();
    h.board._initializeStoryboard();
    h.board._initializeStoryboard();
    assert.strictEqual(h.listeners.get('enableStoryboardBar')?.size,1);
    h.config.props.enableStoryboardBar=true;
    h.drain();
    assert.deepStrictEqual(h.actions,[['created',false],['enable']]);
  });
  it('retains the distinct storyboard BAR shortcut and private distribution channel',()=>{
    const b=read('src/VideoControlBar.js'),s=read('packages/zenza/src/ShortcutActions.js');
    assert(b.includes('this.storyboard.toggle()'));
    assert(s.includes("command: 'toggle-enableStoryboardBar'"));
    assert(s.includes("command: 'toggle-enableStoryboard'"));
    const dist=read('dist/ZenzaWatch-dev.user.js');
    assert(dist.includes('ZenzaWatch/raw/develop'));
  });
});

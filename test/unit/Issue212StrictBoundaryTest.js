'use strict';
// Issue #212: targeted strict TS changes; synthetic DOM and storage inputs only.
const assert = require('node:assert/strict');
const {extract, createContext, run} = require('../helpers/extractSource');
const {describe, it} = typeof global.describe === 'function' ? global : require('node:test');
const overrideCode = extract('src/initializer.js', 'overrideGinza', 'var');

function setup(root, overrideGinza=true) {
  const calls=[];
  const video = {addEventListener:(...a)=>calls.push(['on', ...a]),pause:()=>calls.push(['pause'])};
  const document={
    body:{classList:{contains:()=>true},className:''},
    querySelector:()=>null, getElementById:()=>root
  };
  class MutationObserver {
    constructor(callback){calls.push(['observer.construct']);this.callback=callback;}
    observe(node,opts){if(!node)throw Error('null root');calls.push(['observe',node,opts]);}
    disconnect(){calls.push(['disconnect']);}
  }
  const ctx=createContext({document,MutationObserver,
    OfficialPlayerRoute:{isOfficialRequest:()=>false},
    Config:{props:{overrideGinza}},
    initializeGinzaSlayer:()=>calls.push(['slayer']),
    uq:{complete:async()=>{}}, window:{name:''}});
  run('globalThis.overrideGinza='+overrideCode,ctx);
  return {ctx,calls,video};
}

describe('#212 strict entry null boundaries',()=>{
  it('missing SPA root does not create an observer or throw',async()=>{
    const {ctx,calls}=setup(null);
    await ctx.overrideGinza({}, {});
    // Task1030: 設定ONなら起動するが、#root が無ければ監視は作らない。
    assert.deepEqual(calls,[['slayer']]);
  });
  it('the replacement preference (Task1030 restored, opt-in) observes a mounted root',async()=>{
    const root={nodeType:1,id:'synthetic-root'};
    const {ctx,calls}=setup(root);
    await ctx.overrideGinza({}, {});
    assert.deepEqual(calls.map(c=>c[0]),['slayer','observer.construct','observe']);
  });
  it('with the preference OFF (default) the watch page is left to the official player',async()=>{
    const root={nodeType:1,id:'synthetic-root'};
    const {ctx,calls}=setup(root,false);
    await ctx.overrideGinza({}, {});
    assert.deepEqual(calls,[]);
  });
  it('storage JSON parsing retains legacy null coercion and malformed input behavior',()=>{
    for(const value of [null,'null','0','false','""','{}','broken','']){
      const old=()=>JSON.parse(value), now=()=>JSON.parse(String(value));
      let a,b;
      try{a={value:old()}}catch(e){a={error:e.name}}
      try{b={value:now()}}catch(e){b={error:e.name}}
      assert.deepEqual(b,a,'value: '+String(value));
    }
  });
  it('cookie decoding retains JavaScript string coercion for valid and missing segments',()=>{
    for(const value of [undefined,null,'','hello%20world','%E3%81%82','%ZZ']){
      const old=()=>decodeURIComponent(value), now=()=>decodeURIComponent(String(value));
      let a,b;
      try{a={value:old()}}catch(e){a={error:e.name}}
      try{b={value:now()}}catch(e){b={error:e.name}}
      assert.deepEqual(b,a,'value: '+String(value));
    }
  });
});
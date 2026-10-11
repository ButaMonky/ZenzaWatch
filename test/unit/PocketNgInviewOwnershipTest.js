'use strict';
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');

const flush=async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  await new Promise(resolve=>setImmediate(resolve));
};
function fixture(path) {
  let current=true,inview=null,cleanup=0,setup=0;
  const queue=[],present=new Set(),disabledClasses=new Set();
  const ngConfig={props:{enable:true}};
  const ctx=createContext({
    window:{IntersectionObserver:class {}},
    console:{error(){},warn(){}},
    getNgEnv:async()=>({query:'.video',container:{}}),
    initNgConfig:()=>({ngConfig,favConfig:{props:{}}}),
    initNgChecker:()=>({ngChecker:{isNg:()=>true},
      favChecker:{isMatch:()=>false}}),
    initIntersectionObserver:callback=>{
      inview=callback;
      return {disconnect(){}};
    },
    initNgDom:()=>{setup++;return ()=>{cleanup++;};},
    QueueLoader:{load:(id,node,isCancelled)=>{
      let resolve;
      const promise=new Promise(done=>resolve=done);
      queue.push({id,node,isCancelled,resolve});
      return promise;
    }}
  });
  const context={ngConfig,favConfig:{props:{}},checkers:{
    ngChecker:{isNg:()=>false},favChecker:{isMatch:()=>false}
  }};
  run('globalThis.initNg='+extract(path,'initNg','var'),ctx);
  const node={
    dataset:{},textContent:'',querySelector:()=>null,querySelectorAll:()=>[],
    classList:{
      add:(...names)=>names.forEach(n=>present.add(n)),
      remove:(...names)=>names.forEach(n=>present.delete(n)),
      toggle:(name,value)=>value?present.add(name):present.delete(name),
      contains:name=>present.has(name)
    }
  };
  return {ctx,node,queue,present,context,ngConfig,start:(params={query:'.video',container:{}})=>
    ctx.initNg(params,()=>current,context),
    startDiscovery:()=>ctx.initNg(undefined,()=>current,context),
    isCurrent:()=>current,off:()=>{current=false;ngConfig.props.enable=false;},
    on:()=>{current=true;ngConfig.props.enable=true;},
    callback:()=>inview,setup:()=>setup,cleanup:()=>cleanup};
}
for(const path of ['src/_pocket.js','dist/MylistPocket.user.js']){
  describe('Task389 Pocket NG late thumbnail responses and DOM ownership '+path,()=>{
    it('does not write NG classes after disabling mid-request',async()=>{
      const f=fixture(path);
      await f.start();
      f.callback()(f.node,'sm1');
      assert.strictEqual(f.queue.length,1);
      assert.strictEqual(f.queue[0].isCancelled(),false);
      f.off();
      assert.strictEqual(f.queue[0].isCancelled(),true);
      f.queue[0].resolve({status:'ok',watchId:'sm1',title:'data',id:'sm1'});
      await flush();
      assert.strictEqual(f.present.has('is-ng-rejected'),false);
      assert.strictEqual(f.present.has('is-ng-resolved'),false);
    });
    it('does not enqueue new thumbnail work after disabling',async()=>{
      const f=fixture(path);
      await f.start();
      f.off();f.callback()(f.node,'sm1');
      assert.strictEqual(f.queue.length,0);
    });
    it('ignores async discovery completed after an OFF toggle',async()=>{
      const f=fixture(path);
      let resolveDiscovery;
      f.ctx.getNgEnv=()=>new Promise(resolve=>resolveDiscovery=resolve);
      const started=f.startDiscovery();
      f.off();
      // Wait for the discovery to resolve after the session is obsolete.
      if(resolveDiscovery){
        resolveDiscovery({query:'.video',container:{}});
      }
      await started;
      assert.strictEqual(f.setup(),0);
    });
    it('returns observer disposer on successful initialization',async()=>{
      const f=fixture(path);
      const stop=await f.start();
      assert.strictEqual(typeof stop,'function');
      assert.strictEqual(f.setup(),1);
      stop();
      assert.strictEqual(f.cleanup(),1);
    });
  });
}

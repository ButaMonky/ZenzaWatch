'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function configFixture(file, initiallyOn = false, initNgOverride) {
  const hooks = [], classes = new Map(), started = [], stopped = [];
  const ngConfig = {
    props: {enable: initiallyOn, word: '', tag: '', owner: ''},
    onkey(key, fn) {hooks.push({key, fn});},
    on() {}
  };
  const favConfig = {props: {word:'',tag:'',owner:''},on(){}};
  const ctx = createContext({
    config: {namespace: name => name === 'ng' ? ngConfig : favConfig},
    document: {body: {classList: {toggle(name, state) {classes.set(name, state);}}}},
    initNgChecker() {return {ngChecker:{},favChecker:{}};},
    initNg: initNgOverride || (async (params,isCurrent) => {
      started.push({params,isCurrent});
      return () => {stopped.push(params);};
    }),
    console: {warn() {}}
  });
  run('globalThis.initNgConfig = ' + extract(file, 'initNgConfig', 'var'), ctx);
  run('globalThis.lifecycle = ' + extract(file, 'createNgLifecycle', 'var'), ctx);
  const lifecycle = ctx.lifecycle();
  const toggle = enabled => {
    ngConfig.props.enable = enabled;
    for (const hook of hooks.filter(h => h.key === 'enable')) {hook.fn(enabled);}
  };
  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  return {lifecycle,ngConfig,hooks,classes,started,stopped,toggle,flush};
}
for (const file of ['src/_pocket.js', 'dist/MylistPocket.user.js']) {
  describe('Task389 AUD-19 Pocket NG runtime toggling '+file, function() {
    this.timeout(8000);
    it('registers an enable observer even when disabled at startup', async () => {
      const h = configFixture(file, false);
      await h.lifecycle.observe();
      assert.strictEqual(h.classes.get('is-ng-disable'),true);
      assert.strictEqual(h.hooks.filter(x=>x.key==='enable').length,1);
      assert.strictEqual(h.started.length,0);
      h.toggle(true);await h.flush();
      assert.strictEqual(h.started.length,1);
      assert.strictEqual(h.started[0].isCurrent(),true);
      assert.strictEqual(h.classes.get('is-ng-disable'),false);
    });
    it('disconnects NG observers when toggling ON to OFF', async () => {
      const h=configFixture(file,true);
      await h.lifecycle.observe();await h.flush();
      assert.strictEqual(h.started.length,1);
      h.toggle(false);await h.flush();
      assert.strictEqual(h.stopped.length,1);
      assert.strictEqual(h.started[0].isCurrent(),false);
      assert.strictEqual(h.classes.get('is-ng-disable'),true);
    });
    it('restarts once per toggle and avoids duplicate config subscribers',async()=>{
      const h=configFixture(file,false);
      await h.lifecycle.observe();
      for(let i=0;i<3;i++){
        h.toggle(true);await h.flush();
        h.toggle(false);await h.flush();
      }
      h.toggle(true);await h.flush();
      assert.strictEqual(h.started.length,4);
      assert.strictEqual(h.stopped.length,3);
      assert.strictEqual(h.hooks.filter(x=>x.key==='enable').length,1);
    });
    it('tracks optional external observe scopes across toggle cycles',async()=>{
      const h=configFixture(file,false);
      await h.lifecycle.observe();
      await h.lifecycle.observe({query:'.popupVideo',container:{id:'popup'}});
      assert.strictEqual(h.started.length,0);
      h.toggle(true);await h.flush();
      assert.strictEqual(h.started.length,2);
      assert.strictEqual(h.started[1].params.query,'.popupVideo');
      h.toggle(false);await h.flush();
      assert.strictEqual(h.stopped.length,2);
      h.toggle(true);await h.flush();
      assert.strictEqual(h.started.length,4);
    });
    it('does not attach observers if an ON->OFF happens before async discovery completes',async()=>{
      const pending=[];
      const h=configFixture(file,false,async(params,isCurrent)=>{
        const dispose=()=>h.stopped.push(params);
        h.started.push({params,isCurrent});
        return new Promise(resolve=>pending.push(()=>resolve(dispose)));
      });
      await h.lifecycle.observe();
      h.toggle(true);await h.flush();
      assert.strictEqual(h.started.length,1);
      h.toggle(false);await h.flush();
      pending.shift()();await h.flush();
      assert.strictEqual(h.stopped.length,1);
      assert.strictEqual(h.started[0].isCurrent(),false);
    });
    it('does not restart a stopped session on repeated OFF',async()=>{
      const h=configFixture(file,true);
      await h.lifecycle.observe();await h.flush();
      h.toggle(false);await h.flush();
      h.toggle(false);await h.flush();
      assert.strictEqual(h.stopped.length,1);
      assert.strictEqual(h.started.length,1);
    });
  });
}

for (const file of ['src/_pocket.js','dist/MylistPocket.user.js']) {
  describe('Task389 Pocket NG observer resource ownership '+file,()=>{
    function fixture() {
      const updates=[], views=[], intersection={observed:[],disposed:0,
        observe(item){this.observed.push(item);},
        disconnect(){this.disposed++;}
      };
      const node={classList: {classes:new Set(),
        contains(name){return this.classes.has(name);},
        add(name){this.classes.add(name);},
        remove(...names){names.forEach(name=>this.classes.delete(name));}}};
      const container={dataset:{},
        querySelectorAll(){return [node];}};
      const ctx=createContext({
        util:{addStyle:()=>updates.push('style')},
        __ng_css__:'.ng-visibility{display:none}',
        document:{querySelectorAll:()=>[node]},
        MutationObserver:class {
          constructor(callback){this.callback=callback;views.push(this);}
          observe(){this.observing=true;}
          disconnect(){this.observing=false;}
        }
      });
      run('globalThis.initNgDom = '+extract(file,'initNgDom','var'),ctx);
      return {ctx,updates,views,intersection,container,node,
        call:()=>ctx.initNgDom({intersectionObserver:intersection,
          query:'a.video',container,subtree:true})};
    }
    it('returns a disposer that disconnects intersection and mutation observers',()=>{
      const f=fixture();
      const stop=f.call();
      assert.strictEqual(typeof stop,'function');
      assert.strictEqual(f.views.length,1);
      assert.strictEqual(f.views[0].observing,true);
      assert.strictEqual(f.intersection.observed.length,1);
      stop();
      assert.strictEqual(f.views[0].observing,false);
      assert.strictEqual(f.intersection.disposed,1);
      assert.strictEqual(f.node.classList.contains('is-ng-wait'),false);
    });
    it('does not accumulate duplicate style elements across NG re-enables',()=>{
      const f=fixture();
      const a=f.call();a();
      const b=f.call();b();
      assert.deepStrictEqual(f.updates,['style']);
    });
  });
}

for (const file of ['src/_pocket.js','dist/MylistPocket.user.js']) {
  describe('Task389 Pocket NG pending work cancellation '+file,()=>{
    it('does not launch an obsolete NG request after OFF while it waits in the queue',async()=>{
      let started=[], resolveFirst=[], cancelled=false;
      const ctx=createContext({
        util:{getSleepPromise:()=>info=>Promise.resolve(info)},
        ThumbInfoLoader:{load(id){
          started.push(id);
          return new Promise(resolve=>resolveFirst.push(resolve));
        }},
        window:{}
      });
      run('globalThis.queue = '+extract(file,'QueueLoader','var'),ctx);
      const active=Array.from({length:6},(_,i)=>ctx.queue.load('sm'+i));
      const last=ctx.queue.load('sm6',null,()=>cancelled);
      assert.strictEqual(started.length,6);
      cancelled=true;
      resolveFirst[0]({watchId:'sm0',fromCache:true});
      await active[0];
      await new Promise(resolve=>setImmediate(resolve));
      assert.strictEqual(started.length,6,'OFF queue must not launch new HTTP work');
      assert.strictEqual((await last).status,'cancelled');
      for(let i=1;i<6;i++){resolveFirst[i]({watchId:'sm'+i,fromCache:true});}
      await Promise.all(active.slice(1));
    });
    it('does not write attributes from a stale in-flight request after OFF',async()=>{
      let resolveNetwork,cancelled=false;
      const attrs=[],marks=[];
      const node={setAttribute:(k,v)=>attrs.push([k,v]),
        classList:{add:name=>marks.push(name)}};
      const ctx=createContext({
        util:{getSleepPromise:()=>x=>Promise.resolve(x)},
        ThumbInfoLoader:{load:()=>new Promise(resolve=>resolveNetwork=resolve)},
        window:{}
      });
      run('globalThis.queue = '+extract(file,'QueueLoader','var'),ctx);
      const pending=ctx.queue.load('sm1',node,()=>cancelled);
      cancelled=true;
      resolveNetwork({watchId:'sm1',fromCache:true});
      const result=await pending;
      assert.strictEqual(result.status,'cancelled');
      assert.deepStrictEqual(attrs,[]);
    });
  });
}

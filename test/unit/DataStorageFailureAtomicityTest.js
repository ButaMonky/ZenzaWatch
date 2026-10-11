'use strict';
const assert=require('assert');
const {createContext,beginSection,loadClass,run}=require('../helpers/extractSource');

const paths=[
  ['source','packages/lib/src/infra/DataStorage.js'],
  ['Zenza dist','dist/ZenzaWatch-dev.user.js'],
  ['Pocket dist','dist/MylistPocket.user.js'],
  ['Advanced Settings dist','dist/ZenzaAdvancedSettings.user.js']
];
const deferredTick=()=>new Promise(resolve=>setTimeout(resolve,12));
function subject(path,store,defaults={volume:0.3,mute:false},options={}){
  const logs=[];
  const logger={log(){},warn:(...a)=>logs.push(['warn',a]),error:(...a)=>logs.push(['error',a])};
  const c=createContext({
    console:logger,localStorage:{},bounce:{time:fn=>fn},
    objUtil:{bridge:(dest,src)=>{
      for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(src))){
        if(typeof src[k]==='function')dest[k]=src[k].bind(src);
      }
    }}
  });
  run(beginSection('packages/lib/src/Emitter.js'),c);
  const DataStorage=loadClass(path,'DataStorage',c);
  const instance=new DataStorage(defaults,{prefix:'CFG',storage:store,...options});
  return {instance,logs,c};
}
function storage(initial={}){return {...initial};}
function quotaStore(original){
  const err=new Error('quota');err.name='QuotaExceededError';
  const backing=storage(original);
  const proxy=new Proxy(backing,{set(obj,k,v){
    if(k==='CFG_volume')throw err;
    return Reflect.set(obj,k,v);
  }});
  return {proxy,backing,err};
}
describe('Task358 AUD-21: DataStorage write/restore failure atomicity',()=>{
  for(const [label,path] of paths){
    it(label+' rejects a quota write without memory or event commits',async()=>{
      const s=quotaStore({CFG_volume:'0.3'});
      const {instance:obj,logs}=subject(path,s.proxy);
      await obj.promise('restore');
      const changes=[],updates=[];
      obj.on('change',v=>changes.push(new Map(v)));
      obj.on('update',(...x)=>updates.push(x));
      obj.setValue('volume',0.9);
      await deferredTick();
      assert.strictEqual(obj.getValue('volume'),0.3);
      assert.strictEqual(obj.props.volume,0.3);
      assert.strictEqual(s.backing.CFG_volume,'0.3');
      assert.strictEqual(changes.length,0);
      assert.strictEqual(updates.length,0);
      assert.strictEqual(logs.filter(x=>x[0]==='error').length,1);
    });
    it(label+' continues to accept unrelated writes after a failed write',async()=>{
      const s=quotaStore({CFG_volume:'0.3'});
      const {instance:obj}=subject(path,s.proxy);
      await obj.promise('restore');
      const updates=[];obj.on('update',(...args)=>updates.push(args));
      obj.setValue('volume',0.7);
      obj.setValue('mute',true);
      await deferredTick();
      assert.strictEqual(obj.getValue('volume'),0.3);
      assert.strictEqual(obj.getValue('mute'),true);
      assert.strictEqual(s.backing.CFG_volume,'0.3');
      assert.strictEqual(s.backing.CFG_mute,'true');
      assert.deepStrictEqual(updates,[['mute',true]]);
    });
    it(label+' keeps state unchanged when JSON serialization throws',async()=>{
      const store=storage();
      const {instance:obj}=subject(path,store);
      await obj.promise('restore');
      const circular={};circular.self=circular;
      let change=0;obj.on('change',()=>change++);
      obj.setValue('volume',circular);
      await deferredTick();
      assert.strictEqual(obj.getValue('volume'),0.3);
      assert.strictEqual(store.CFG_volume,undefined);
      assert.strictEqual(change,0);
    });
    it(label+' retains readonly in-memory semantics',async()=>{
      const store=storage({CFG_volume:'0.7'});
      const {instance:obj}=subject(path,store,undefined,{readonly:true});
      await obj.promise('restore');
      assert.strictEqual(obj.getValue('volume'),0.7);
      obj.setValue('volume',0.6);
      assert.strictEqual(obj.getValue('volume'),0.6);
      assert.strictEqual(store.CFG_volume,'0.7');
    });
    it(label+' resolves startup readiness with defaults on storage-read denial',async()=>{
      const store={hasOwnProperty(){throw new Error('storage-denied');}};
      const {instance:obj,logs}=subject(path,store);
      const readiness=await Promise.race([
        obj.promise('restore').then(()=> 'ready',()=> 'rejected'),
        new Promise(resolve=>setTimeout(()=>resolve('pending'),120))
      ]);
      assert.strictEqual(readiness,'ready');
      assert.strictEqual(obj.props.volume,0.3);
      assert.strictEqual(obj.getValue('volume'),0.3);
      assert.strictEqual(obj.restoreError.message,'storage-denied');
      assert.ok(logs.length>0);
    });
    it(label+' discards partial restore data if a later storage key fails',async()=>{
      const disk={CFG_volume:'0.8',hasOwnProperty(key){
        if(key==='CFG_mute')throw new Error('read-permission');
        return Object.prototype.hasOwnProperty.call(this,key);
      }};
      const {instance:obj}=subject(path,disk);
      await obj.promise('restore');
      assert.strictEqual(obj.getValue('volume'),0.3);
      assert.strictEqual(obj.getValue('mute'),false);
      assert.strictEqual(obj.restoreError.message,'read-permission');
    });
    it(label+' loads ordinary persisted values and exposes the normal props',async()=>{
      const disk={CFG_volume:'0.8',CFG_mute:'true'};
      const {instance:obj,logs}=subject(path,disk);
      await obj.promise('restore');
      assert.strictEqual(obj.props.volume,0.8);
      assert.strictEqual(obj.props.mute,true);
      assert.strictEqual(obj.restoreError,null);
      assert.strictEqual(logs.length,0);
    });
    it(label+' recovers malformed JSON without changing the other key',async()=>{
      const disk={CFG_volume:'{bad',CFG_mute:'true'};
      const {instance:obj}=subject(path,disk);
      await obj.promise('restore');
      assert.strictEqual(obj.getValue('volume'),0.3);
      assert.strictEqual(obj.getValue('mute'),true);
      assert.strictEqual(disk.CFG_volume,undefined);
    });
  }
});

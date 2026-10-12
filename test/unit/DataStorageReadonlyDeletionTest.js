'use strict';
const assert=require('assert');
const {createContext,beginSection,loadClass,run}=require('../helpers/extractSource');
const artifacts=[['source','packages/lib/src/infra/DataStorage.js'],
  ['Zenza','dist/ZenzaWatch-dev.user.js'],['Pocket','dist/MylistPocket.user.js'],
  ['Advanced','dist/ZenzaAdvancedSettings.user.js']];
function subject(file,readonly,initial={CFG_volume:'0.9',CFG_mute:'true',CFG_debug:'true'},extra={}) {
  const disk={...initial}, operations=[];
  let denied=false;
  Object.defineProperty(disk,'removeItem',{value:key=>{
    operations.push(['remove',key]); delete disk[key];
  }});
  const store=new Proxy(disk,{
    get(target,key,receiver){
      operations.push(['read',String(key)]);
      if(denied)throw new Error('denied');
      return Reflect.get(target,key,receiver);
    },
    set(target,key,value){operations.push(['write',key]);return Reflect.set(target,key,value);},
    deleteProperty(target,key){operations.push(['delete',key]);return Reflect.deleteProperty(target,key);}
  });
  const logger={log(){},warn(){},error(){}};
  const context=createContext({console:logger,localStorage:{},bounce:{time:fn=>fn},
    objUtil:{bridge(dest,src){
      for(const key of Object.getOwnPropertyNames(Object.getPrototypeOf(src))) {
        if(typeof src[key]==='function')dest[key]=src[key].bind(src);
      }
    }}});
  run(beginSection('packages/lib/src/Emitter.js'),context);
  const Storage=loadClass(file,'DataStorage',context);
  const storage=new Storage({volume:0.3,mute:false,debug:false},
    {prefix:'CFG',storage:store,readonly,ignoreExportKeys:['debug'],...extra});
  return {storage,disk,operations,deny(){denied=true;operations.length=0;},
    mutations:()=>operations.filter(x=>x[0]!=='read')};
}
for(const [label,file] of artifacts) {
  describe('Task410 readonly deletion boundary ('+label+')',()=>{
    it('resets one memory value without removing readonly persisted data',async()=>{
      const h=subject(file,true); await h.storage.promise('restore');
      h.operations.length=0; h.storage.deleteValue('volume');
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      assert.strictEqual(h.disk.CFG_volume,'0.9');
      assert.deepStrictEqual(h.mutations(),[]);
    });
    it('clears readonly memory defaults but preserves storage and ignored keys',async()=>{
      const h=subject(file,true); await h.storage.promise('restore');
      h.operations.length=0; h.storage.clearConfig();
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      assert.strictEqual(h.storage.getValue('mute'),false);
      assert.strictEqual(h.storage.getValue('debug'),true);
      assert.deepStrictEqual({...h.disk},{CFG_volume:'0.9',CFG_mute:'true',CFG_debug:'true'});
      assert.deepStrictEqual(h.mutations(),[]);
      assert.strictEqual(h.storage.silently,false);
    });
    it('performs readonly deletes without touching an inaccessible backend',async()=>{
      const h=subject(file,true); await h.storage.promise('restore');
      h.deny(); h.storage.deleteValue('volume');
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      assert.deepStrictEqual(h.operations,[]);
    });
    it('performs readonly clear without touching an inaccessible backend',async()=>{
      const h=subject(file,true); await h.storage.promise('restore');
      h.deny(); h.storage.clearConfig();
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      assert.strictEqual(h.storage.getValue('mute'),false);
      assert.deepStrictEqual(h.operations,[]);
    });
    it('falls back in memory without deleting malformed readonly JSON',async()=>{
      const h=subject(file,true,{CFG_volume:'invalid-json',CFG_mute:'true'});
      await h.storage.promise('restore');
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      assert.strictEqual(h.storage.getValue('mute'),true);
      assert.strictEqual(h.disk.CFG_volume,'invalid-json');
      assert.deepStrictEqual(h.mutations(),[]);
    });
    it('preserves writable delete and clear behavior',async()=>{
      const h=subject(file,false); await h.storage.promise('restore');
      h.storage.deleteValue('volume');
      assert.strictEqual(h.disk.CFG_volume,undefined);
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      h.storage.clearConfig();
      assert.strictEqual(h.disk.CFG_mute,undefined);
      assert.strictEqual(h.disk.CFG_debug,'true');
      assert.strictEqual(h.storage.getValue('debug'),true);
    });
    it('still repairs malformed writable JSON and honors explicit preservation',async()=>{
      const h=subject(file,false,{CFG_volume:'invalid-json'});
      await h.storage.promise('restore');
      assert.strictEqual(h.disk.CFG_volume,undefined);
      assert.strictEqual(h.storage.getValue('volume'),0.3);
      const p=subject(file,false,{CFG_volume:'invalid-json'},{preserveInvalidKeys:['volume']});
      await p.storage.promise('restore');
      assert.strictEqual(p.disk.CFG_volume,'invalid-json');
      assert.strictEqual(p.storage.getValue('volume'),0.3);
    });
    it('keeps existing readonly set and import operations in memory only',async()=>{
      const h=subject(file,true); await h.storage.promise('restore');
      h.operations.length=0;
      h.storage.setValue('volume',0.6);
      assert.strictEqual(h.storage.getValue('volume'),0.6);
      h.storage.import({volume:0.5,mute:false});
      assert.strictEqual(h.storage.getValue('volume'),0.5);
      assert.strictEqual(h.disk.CFG_volume,'0.9');
      assert.deepStrictEqual(h.mutations(),[]);
    });
  });
}

'use strict';
const assert=require('assert');
const util=require('util');
const {createContext,beginSection,loadClass,run,read}=require('../helpers/extractSource');
const marker='S411_PRIVATE_FIXTURE_CONTENT';
const artifacts=[['source','packages/lib/src/infra/DataStorage.js'],
  ['Zenza','dist/ZenzaWatch-dev.user.js'],['Pocket','dist/MylistPocket.user.js'],
  ['Advanced','dist/ZenzaAdvancedSettings.user.js']];
function subject(file,raw,options={}) {
  const disk={CFG_value:raw,CFG_flag:'true'},logs=[];
  const logger={log:(...args)=>logs.push({level:'log',args}),
    error:(...args)=>logs.push({level:'error',args}),warn(){}};
  const c=createContext({console:logger,localStorage:{},bounce:{time:fn=>fn},
    objUtil:{bridge(dest,src){
      for(const key of Object.getOwnPropertyNames(Object.getPrototypeOf(src))) {
        if(typeof src[key]==='function')dest[key]=src[key].bind(src);
      }
    }}});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  const Storage=loadClass(file,'DataStorage',c);
  const storage=new Storage({value:'default',flag:false},{prefix:'CFG',storage:disk,...options});
  return {storage,disk,logs};
}
function privateDiagnostic(logs) {
  assert(logs.length>0,'retain a diagnostic rather than disabling the logger');
  const text=util.inspect(logs,{depth:6});
  assert(!text.includes(marker),'do not log stored contents or exception excerpts');
  assert(text.includes('value'),'retain the setting key for diagnosis');
}
for(const [label,file] of artifacts) {
  describe('Task411 storage diagnostic privacy ('+label+')',()=>{
    it('reports restore failure without its stored value or parse exception text',async()=>{
      const h=subject(file,marker);await h.storage.promise('restore');
      assert.strictEqual(h.storage.getValue('value'),'default');
      assert.strictEqual(h.storage.getValue('flag'),true);
      assert.strictEqual(h.disk.CFG_value,undefined);
      assert(h.logs.some(x=>x.level==='error'));
      privateDiagnostic(h.logs);
    });
    it('keeps refresh state and reports only safe diagnostic metadata',async()=>{
      const h=subject(file,JSON.stringify('previous'));await h.storage.promise('restore');
      h.disk.CFG_value=marker;h.logs.length=0;
      const value=await h.storage.refresh('value');
      assert.strictEqual(value,'previous');
      assert.strictEqual(h.disk.CFG_value,marker);
      privateDiagnostic(h.logs);
    });
    it('clears writable settings without printing their former contents',async()=>{
      const h=subject(file,JSON.stringify(marker));await h.storage.promise('restore');
      h.logs.length=0;h.storage.clearConfig();
      assert.strictEqual(h.disk.CFG_value,undefined);
      assert.strictEqual(h.storage.getValue('value'),'default');
      assert.strictEqual(h.storage.getValue('flag'),false);
      privateDiagnostic(h.logs);
    });
    it('preserves malformed readonly data while protecting its diagnostic',async()=>{
      const h=subject(file,marker,{readonly:true});await h.storage.promise('restore');
      assert.strictEqual(h.disk.CFG_value,marker);
      assert.strictEqual(h.storage.getValue('value'),'default');
      privateDiagnostic(h.logs);
    });
    it('preserves explicitly retained malformed data without logging its contents',async()=>{
      const h=subject(file,marker,{preserveInvalidKeys:['value']});
      await h.storage.promise('restore');
      assert.strictEqual(h.disk.CFG_value,marker);
      assert.strictEqual(h.storage.getValue('value'),'default');
      privateDiagnostic(h.logs);
    });
    it('leaves valid persisted preferences and ordinary startup diagnostics unchanged',async()=>{
      const h=subject(file,JSON.stringify(marker));await h.storage.promise('restore');
      assert.strictEqual(h.storage.getValue('value'),marker);
      assert.strictEqual(h.disk.CFG_value,JSON.stringify(marker));
      assert.deepStrictEqual(h.logs,[]);
    });
  });
}
describe('Task411 Pocket diagnostic version accuracy',()=>{
  for(const file of ['src/_pocket.js','dist/MylistPocket.user.js']) {
    it(file+' keeps the console banner aligned with userscript metadata',()=>{
      const text=read(file);
      const metadata=/^\/\/\s*@version\s+(\S+)/m.exec(text);
      const banner=/console\.log\('%cMylistPocket ([^']+)'/.exec(text);
      assert(metadata&&banner);
      assert.strictEqual(banner[1],metadata[1]);
    });
  }
});

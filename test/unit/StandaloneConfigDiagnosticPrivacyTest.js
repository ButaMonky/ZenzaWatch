'use strict';
const assert=require('assert');
const util=require('util');
const {createContext,extract,run,beginSection}=require('../helpers/extractSource');
const marker='STANDALONE_PRIVATE_FIXTURE';
const variants=[
  ['GamePad source','src/_gamepad.js','Config','get','set'],
  ['GamePad dist','dist/ZenzaGamePad.user.js','Config','get','set'],
  ['HeatSync source','src/_heatsync.js','config','getValue','setValue'],
  ['HeatSync dist','dist/HeatSync.user.js','config','getValue','setValue']
];
function subject([,file,name,get,set],raw) {
  const disk={Fixture_config_debug:raw},logs=[],events=[];
  let readError=null,reads=0;
  const store={
    hasOwnProperty:key=>Object.prototype.hasOwnProperty.call(disk,key),
    getItem(key){reads++;if(readError)throw readError;return disk[key];},
    setItem(key,value){disk[key]=value;},removeItem(key){delete disk[key];}
  };
  const c=createContext({PRODUCT:'Fixture',localStorage:store,
    console:{log(){},error:(...args)=>logs.push(args)},
    broadcast:{send(){}},util:{emitter:{on(){}}},
    _:{contains:(a,x)=>a.includes(x)}});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  run('globalThis.__config = '+extract(file,name,'var')+';',c);
  const config=c.__config;
  config.on('@update',data=>events.push({key:data.key,value:data.value}));
  return {disk,logs,events,config,get:key=>config[get](key),set:(key,v)=>config[set](key,v),
    deny(){readError=new Error(marker);reads=0;},reads:()=>reads};
}
function safeDiagnostic(logs) {
  assert(logs.length>0,'diagnostic remains available');
  const text=util.inspect(logs,{depth:6});
  assert(!text.includes(marker),'do not expose stored values or exception excerpts');
  assert(text.includes('debug'),'keep the setting key for diagnosis');
}
for(const variant of variants) {
  describe('Standalone config diagnostic privacy ('+variant[0]+')',()=>{
    it('restores the default for malformed JSON without logging private data',()=>{
      const h=subject(variant,marker);
      assert.strictEqual(h.get('debug'),false);
      assert.strictEqual(h.disk.Fixture_config_debug,marker);
      safeDiagnostic(h.logs);
    });
    it('preserves valid startup values without adding diagnostics',()=>{
      const h=subject(variant,'true');
      assert.strictEqual(h.get('debug'),true);
      assert.strictEqual(h.disk.Fixture_config_debug,'true');
      assert.deepStrictEqual(h.logs,[]);
    });
    it('refreshes malformed data to the default without exposing the contents',()=>{
      const h=subject(variant,'true');
      h.disk.Fixture_config_debug=marker;h.config.refresh();
      assert.strictEqual(h.get('debug'),false);
      assert.strictEqual(h.disk.Fixture_config_debug,marker);
      safeDiagnostic(h.logs);
    });
    it('does not reread a denied value merely to report the failure',()=>{
      const h=subject(variant,'true');h.deny();
      assert.doesNotThrow(()=>h.config.refresh());
      assert.strictEqual(h.get('debug'),false);
      assert.strictEqual(h.disk.Fixture_config_debug,'true');
      assert.strictEqual(h.reads(),1);
      safeDiagnostic(h.logs);
    });
    it('retains normal setter persistence and update notification',()=>{
      const h=subject(variant,'false');h.set('debug',true);
      assert.strictEqual(h.get('debug'),true);
      assert.strictEqual(h.disk.Fixture_config_debug,'true');
      assert.deepStrictEqual(h.events,[{key:'debug',value:true}]);
      assert.deepStrictEqual(h.logs,[]);
    });
    it('keeps unchanged refresh silent and publishes changed refresh values',()=>{
      const h=subject(variant,'false');h.config.refresh(true);
      assert.deepStrictEqual(h.events,[]);
      h.disk.Fixture_config_debug='true';h.config.refresh(true);
      assert.strictEqual(h.get('debug'),true);
      assert.deepStrictEqual(h.events,[{key:'debug',value:true}]);
      assert.deepStrictEqual(h.logs,[]);
    });
  });
}

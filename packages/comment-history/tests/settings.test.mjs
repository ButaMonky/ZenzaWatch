import test from 'node:test';import assert from 'node:assert/strict';
import {SETTINGS_SCHEMA,DEFAULT_SETTINGS,normalizeSettings,SettingsStore} from '../src/settings.mjs';
test('settings descriptors have stable keys independent of any UI element',()=>{
 assert(SETTINGS_SCHEMA.length>=9);assert(SETTINGS_SCHEMA.every(d=>d.key===`commentHistory.${d.name}`));
 assert.equal(DEFAULT_SETTINGS.maxAdditionalComments,5000);assert.equal(DEFAULT_SETTINGS.includeEasy,false);
 assert.equal(normalizeSettings({}).minIntervalMs,1500);
});
test('invalid, unsafe and unknown setting values are rejected',()=>{
 for(const patch of [{minIntervalMs:0},{maxRetries:99},{maxAdditionalComments:Infinity},{includeEasy:'false'},{typo:1}]){
  assert.throws(()=>normalizeSettings(patch),e=>e.code==='OPTION');
 }
});
test('two UI facades can share persisted values and unknown versions are not overwritten',()=>{
 let record,writes=0;const read=()=>record;const write=x=>{record=x;writes++;};
 const a=new SettingsStore({read,write});a.patch({maxAdditionalComments:2000});
 const b=new SettingsStore({read,write});assert.equal(b.get().maxAdditionalComments,2000);
 assert.equal(record.version,1);assert.equal(record.schema,'nico-comment-history-settings');
 record={schema:'nico-comment-history-settings',version:99,values:{future:true}};
 assert.throws(()=>b.get(),e=>e.code==='SETTINGS_VERSION');assert.equal(writes,1);assert.equal(record.version,99);
});
test('bad patch does not write and returned settings cannot mutate storage',()=>{
 let record,writes=0;const s=new SettingsStore({read:()=>record,write:x=>{record=x;writes++;}});
 assert.throws(()=>s.patch({minIntervalMs:2}));assert.equal(writes,0);s.patch({maxPages:9});s.get().maxPages=1;
 assert.equal(s.get().maxPages,9);
});
test('facades merge fresh values, not stale UI snapshots',()=>{
 let record;const opts={read:()=>record,write:x=>{record=x;}};const a=new SettingsStore(opts),b=new SettingsStore(opts);
 a.patch({maxPages:3});b.patch({maxAdditionalComments:8});assert.equal(a.get().maxPages,3);assert.equal(a.get().maxAdditionalComments,8);
});
test('known version with missing values is not silently reset during a settings patch',()=>{
 let writes=0;const s=new SettingsStore({read:()=>({schema:'nico-comment-history-settings',version:1}),write:()=>writes++});
 assert.throws(()=>s.patch({maxPages:1}),e=>e.code==='OPTION');assert.equal(writes,0);
});

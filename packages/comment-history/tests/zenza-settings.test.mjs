import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_SETTINGS,SETTINGS_SCHEMA} from '../src/settings.mjs';
const file=new URL('../src/zenza-settings.mjs',import.meta.url),api=fs.existsSync(file)?await import(file):{};
const key=n=>'ZenzaWatch_commentHistory.'+n;
function storage() { const values=new Map([['ZenzaWatch_volume','0.8']]);const writes=[];return {values,writes,getItem:k=>values.get(k)??null,setItem(k,v){writes.push(k);values.set(k,String(v));},removeItem(k){writes.push(k);values.delete(k);}}; }
function bus() {const listeners=new Set(),sent=[];return {sent,publish(e){sent.push(e);for(const f of [...listeners])f(e);},subscribe(f){listeners.add(f);return()=>listeners.delete(f);},get size(){return listeners.size;}};}
function repo(options={}){assert.equal(typeof api.ZenzaSettingsRepository,'function');return new api.ZenzaSettingsRepository({storage:storage(),...options});}
test('repository reads all nine defaults without writes',()=>{const st=storage(),r=repo({storage:st});assert.deepEqual(r.get(),DEFAULT_SETTINGS);assert.equal(st.writes.length,0);assert.equal(SETTINGS_SCHEMA.length,9);});
test('patch changes only selected keys, preserving unrelated values',()=>{const st=storage(),r=repo({storage:st});r.patch({maxPages:15});assert.deepEqual(st.writes,[key('maxPages')]);assert.equal(st.values.get('ZenzaWatch_volume'),'0.8');assert.equal(r.get().maxPages,15);});
test('patch rereads storage, not stale panel snapshot',()=>{const st=storage(),r=repo({storage:st});r.get();st.values.set(key('includeEasy'),'true');const next=r.patch({maxPages:3});assert.equal(next.includeEasy,true);});
test('invalid patch is fully rejected before the first write',()=>{const st=storage(),r=repo({storage:st});for(const p of [{maxPages:3,minIntervalMs:0},{maxPages:'3'},{includeEasy:1},{bad:1},JSON.parse('{"__proto__":1}')])assert.throws(()=>r.patch(p));assert.equal(st.writes.length,0);});
test('malformed or unsupported saved value is preserved without default overwrite',()=>{
  const st=storage(),r=repo({storage:st});for(const raw of ['{','"future"','null','0']){st.values.set(key('maxPages'),raw);assert.throws(()=>r.patch({includeEasy:true}),{code:'SETTINGS_INVALID'});assert.equal(st.values.get(key('maxPages')),raw);}assert.equal(st.writes.length,0);
});
test('no-op patches do not persist or notify',()=>{const st=storage(),b=bus(),r=repo({storage:st,bus:b});r.patch({maxPages:100});assert.equal(st.writes.length,0);assert.equal(b.sent.length,0);});
test('failed write rolls back completed writes and reports failure, not success',()=>{
  const st=storage();st.values.set(key('maxPages'),'8');const set=st.setItem.bind(st);let once=true;
  st.setItem=(k,v)=>{if(k===key('includeEasy')&&once){once=false;throw Error('quota secret');}set(k,v);};
  const b=bus(),r=repo({storage:st,bus:b});assert.throws(()=>r.patch({maxPages:3,includeEasy:true}),e=>e.code==='SETTINGS_WRITE'&&!e.message.includes('secret'));
  assert.equal(st.values.get(key('maxPages')),'8');assert.equal(st.values.has(key('includeEasy')),false);assert.equal(b.sent.length,0);
});
test('read-back detects ignored writes',()=>{const st=storage(),b=bus();st.setItem=()=>{};const r=repo({storage:st,bus:b});assert.throws(()=>r.patch({maxPages:4}),{code:'SETTINGS_WRITE'});assert.equal(b.sent.length,0);});
test('external deletion becomes default on refresh',()=>{const st=storage();st.values.set(key('maxPages'),'3');const r=repo({storage:st}),seen=[];r.subscribe(s=>seen.push(s.maxPages));st.values.delete(key('maxPages'));r.refresh();assert.deepEqual(seen,[100]);});
test('two views synchronize through keys-only notification, without echo writes',()=>{
  const st=storage(),b=bus(),a=repo({storage:st,bus:b}),c=repo({storage:st,bus:b}),seen=[];
  c.subscribe(x=>seen.push(x.maxPages));a.patch({maxPages:3});assert.deepEqual(seen,[3]);assert.equal(b.sent.length,1);assert.deepEqual(st.writes,[key('maxPages')]);
  assert.deepEqual(b.sent[0],{type:'comment-history-settings',keys:['commentHistory.maxPages']});
});
test('reset writes only selected defaults and does not call global Config.import',()=>{
  const st=storage(),r=repo({storage:st});r.patch({maxPages:3,includeEasy:true});st.writes.length=0;r.reset(['maxPages']);assert.equal(r.get().maxPages,100);assert.equal(r.get().includeEasy,true);assert.equal(st.values.get('ZenzaWatch_volume'),'0.8');assert.deepEqual(st.writes,[key('maxPages')]);
});
test('unsubscribe and dispose release listeners and forbid later writes',()=>{const b=bus(),r=repo({bus:b});let n=0;const off=r.subscribe(()=>n++);off();r.patch({maxPages:4});assert.equal(n,0);r.dispose();r.dispose();assert.equal(b.size,0);assert.throws(()=>r.patch({maxPages:5}),{code:'DISPOSED'});});
test('returned setting snapshots are immutable and cannot change the store',()=>{const r=repo(),s=r.get();assert(Object.isFrozen(s));assert.throws(()=>{s.maxPages=2;});assert.equal(r.get().maxPages,100);});

test('rollback does not overwrite an intervening writer and reports incomplete recovery',()=>{
  const st=storage(),set=st.setItem.bind(st);let trigger=true;
  st.setItem=(k,v)=>{if(k===key('includeEasy')&&trigger){trigger=false;st.values.set(key('maxPages'),'9');throw Error('quota');}set(k,v);};
  const b=bus(),r=repo({storage:st,bus:b});
  assert.throws(()=>r.patch({maxPages:3,includeEasy:true}),e=>e.code==='SETTINGS_WRITE'&&e.rollbackComplete===false);
  assert.equal(st.values.get(key('maxPages')),'9');assert.equal(b.sent.length,0);
});
test('bus notifications carrying arbitrary values cannot alter saved settings',()=>{
  const st=storage(),b=bus(),r=repo({storage:st,bus:b});
  b.publish({type:'comment-history-settings',keys:['commentHistory.maxPages'],values:{maxPages:99}});
  b.publish({type:'comment-history-settings',keys:['volume'],values:{volume:0}});
  assert.equal(r.get().maxPages,100);assert.equal(st.values.get('ZenzaWatch_volume'),'0.8');assert.equal(st.writes.length,0);
});
test('observer exceptions do not turn a successful save into failure',()=>{
  const r=repo();r.subscribe(()=>{throw new Error('view closed');});assert.equal(r.patch({maxPages:3}).maxPages,3);
});
test('storage access error never leaks the raw exception',()=>{
  const st=storage(),r=repo({storage:st});st.getItem=()=>{throw new Error('SENSITIVE_CONTEXT');};
  assert.throws(()=>r.get(),e=>e.code==='SETTINGS_READ'&&!JSON.stringify(e).includes('SENSITIVE_CONTEXT'));
});

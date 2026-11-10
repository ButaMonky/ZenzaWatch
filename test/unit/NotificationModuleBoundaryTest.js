'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
function load(name){
 const path='tools/typescript-stage1/nico-src/'+name+'.ts';
 assert(fs.existsSync(path),'Missing notification boundary: '+name);
 const source=stripTypeScriptTypes(fs.readFileSync(path,'utf8'))
  .replace(/^export\s*\{[^}]*\};?\s*$/gm,'');
 const context=vm.createContext({URL,Date,Math,Promise,Map,Set});
 vm.runInContext(source+';globalThis.subject='+name+';',context);
 return context.subject;
}
describe('Notification feature boundaries',()=>{
 it('normalizes a deterministic record without UI or storage access',()=>{
  const policy=load('NotificationJournalPolicy');
  const result=policy.normalize({message:'failed https://example.test/api?private=hidden',
   source:'comment',videoId:'sm12',details:{statusCode:503,extra:'omit'}},
   {id:'event-1',timestamp:42});
  assert.equal(result.id,'event-1');assert.equal(result.timestamp,42);
  assert.equal(result.message,'failed https://example.test/api');
  assert.deepStrictEqual(Object.keys(result.details),['statusCode']);
  assert.equal(policy.normalize(null,{id:'x',timestamp:1}),null);
 });
 it('has independent unavailable-storage owners that resolve without throwing',async()=>{
  const factory=load('NotificationJournalStore');
  const a=factory.create(undefined),b=factory.create(undefined);
  assert.notStrictEqual(a,b);
  let commits=0;a.append({id:'a'},()=>commits++);
  assert.equal(await a.clear(),false);assert.equal((await b.list()).length,0);
  await Promise.resolve();assert.equal(commits,0);
 });
 it('does not persist pre-clear records after a delayed open completes',async()=>{
  const factory=load('NotificationJournalStore');let request;const writes=[];
  const db={objectStoreNames:{contains:()=>true},close(){},transaction(){
   const tx={objectStore:()=>({put:v=>writes.push(v.id),clear(){
    Promise.resolve().then(()=>tx.oncomplete?.());}})};return tx;
  }};
  const store=factory.create({open(){request={result:db};return request;}});
  store.append({id:'old'},()=>{});const clearing=store.clear();
  request.onsuccess();assert.equal(await clearing,true);
  await Promise.resolve();assert.deepStrictEqual(writes,[]);
 });
});

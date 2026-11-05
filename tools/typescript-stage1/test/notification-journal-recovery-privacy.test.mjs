import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
function fixture(){
 const requests=[];let throwNext=false;
 const indexedDB={open(){if(throwNext){throwNext=false;throw Error('synthetic open failure');}const request={};requests.push(request);return request;}};
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal',{indexedDB});
 const database=()=>({closed:0,close(){this.closed++;},transaction(){return {objectStore(){return {getAll(){const request={result:[]};queueMicrotask(()=>request.onsuccess?.());return request;}};}};}});
 const succeed=(request=requests.at(-1),db=database())=>{request.result=db;request.onsuccess();return db;};
 return {journal,requests,succeed,database,throwNext(){throwNext=true;}};
}
for(const failure of ['throw','error','blocked'])test('AUD68 retries open after '+failure,async()=>{
 const h=fixture();if(failure==='throw')h.throwNext();
 const failed=h.journal.list();if(failure!=='throw')h.requests[0]['on'+failure]();await failed;
 const retried=h.journal.list();assert.equal(h.requests.length,failure==='throw'?1:2);
 h.succeed();await retried;
});
test('AUD68 shares one concurrent open and reconnects after abnormal close',async()=>{
 const h=fixture(),calls=Array.from({length:10},()=>h.journal.list());assert.equal(h.requests.length,1);
 const old=h.succeed();await Promise.all(calls);assert.equal(typeof old.onclose,'function');old.onclose();
 const next=h.journal.list();assert.equal(h.requests.length,2);const current=h.succeed();await next;
 old.onclose();await h.journal.list();assert.equal(h.requests.length,2);assert.equal(current.closed,0);
});
test('AUD68 blocked late success cannot replace a retried current connection',async()=>{
 const h=fixture(),first=h.journal.list(),oldRequest=h.requests[0];oldRequest.onblocked();await first;
 const next=h.journal.list();assert.equal(h.requests.length,2);const current=h.succeed();await next;
 const stale=h.succeed(oldRequest);assert.equal(stale.closed,1);await h.journal.list();assert.equal(current.closed,0);assert.equal(h.requests.length,2);
});
test('AUD68 versionchange closes only its connection and permits reopen',async()=>{
 const h=fixture(),first=h.journal.list(),old=h.succeed();await first;old.onversionchange();assert.equal(old.closed,1);
 const next=h.journal.list();assert.equal(h.requests.length,2);h.succeed();await next;
});

const secrets=[24,32,43,47,48].map(length=>'S'.repeat(length));
for(const token of secrets)test('AUD69 masks opaque URL path length '+token.length,async()=>{
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal');
 const row=journal.record({message:'failed https://example.invalid/access/'+token+'?token=hidden#fragment'});
 assert(!row.message.includes(token));assert(!row.message.includes('hidden'));assert(!JSON.stringify(await journal.list()).includes(token));
});
for(const input of ['wss://example.invalid/path/'+secrets[0],'/access/'+secrets[0],
 'https://example.invalid/'+secrets[0].split('').map(c=>'%'+c.charCodeAt(0).toString(16)).join(''),
 '/access/'+secrets[0].slice(0,12)+'%2F'+secrets[0].slice(12),
 '{"access_token":"short-secret-value"}'])test('AUD69 masks encoded/relative/socket/JSON credentials '+input.slice(0,16),()=>{
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal');const row=journal.record({message:input});
 assert(!row.message.includes('short-secret-value'));assert(!row.message.includes(secrets[0]));assert(!row.message.includes('%53'));assert(!row.message.includes('%2F'));
});
test('AUD69 retains public watch IDs and ordinary diagnostic labels',async()=>{
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal');
 const row=journal.record({message:'HTTP400 https://www.nicovideo.jp/watch/sm9',videoId:'sm9',details:{errorCode:'BAD_REQUEST',statusCode:400}});
 assert(row.message.includes('/watch/sm9'));assert.equal(row.videoId,'sm9');assert.equal(row.details.errorCode,'BAD_REQUEST');await flush();
});

for(const separator of ['+','.','~','='])for(const absolute of [true,false])test('AUD69 masks URL path punctuation '+separator+' '+absolute,()=>{
 const token='S'.repeat(12)+separator+'S'.repeat(11);
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal');
 const row=journal.record({message:(absolute?'https://example.invalid':'')+'/access/'+token});
 assert(!row.message.includes(token));
});
test('AUD69 masks the whole JSON credential including escaped quotes',()=>{
 const journal=loadSource('nico-src/NotificationJournal.ts','NotificationJournal');
 const row=journal.record({message:JSON.stringify({token:'synthetic"credential-tail'})});
 assert(!row.message.includes('credential-tail'));
});

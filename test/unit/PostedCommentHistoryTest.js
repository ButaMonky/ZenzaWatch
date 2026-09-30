import assert from 'power-assert';
const {beginSection,createContext,run}=require('../helpers/extractSource');
function subject(){
 const records=new Map();const cache={updateTime:async({key})=>records.get(key),put(record){records.set(record.watchId,record);return Promise.resolve(record);}};
 const c=createContext({location:{host:'www.nicovideo.jp'},IndexedDbStorage:{open:async()=>({cache})}});
 run(beginSection('packages/lib/src/nico/WatchInfoCacheDb.js')+';globalThis.subject=WatchInfoCacheDb;',c);return c.subject;
}
describe('投稿コメント履歴（ZW-026 / Task116）',function(){
 it('2件の投稿内容を順に保存しJSON化できる',async function(){
  const db=subject(),a={text:'first',vpos:100},b={text:'second',vpos:200};await db.put('sm1',{comment:a});const result=await db.put('sm1',{comment:b});
  assert.equal(result.comment.length,2);assert.strictEqual(result.comment[0],a);assert.strictEqual(result.comment[1],b);assert.doesNotThrow(()=>JSON.stringify(result));
 });
 it('コメントを伴わない更新で既存履歴を維持する',async function(){
  const db=subject(),a={text:'keep'};await db.put('sm1',{comment:a});const r=await db.put('sm1',{currentTime:3});assert.equal(r.comment.length,1);assert.strictEqual(r.comment[0],a);assert.equal(r.resume[0].time,3);
 });
 it('動画が違えば履歴を共有せず投稿なしは空',async function(){
  const db=subject();await db.put('sm1',{comment:{text:'one'}});assert.equal((await db.put('sm2',{})).comment.length,0);assert.equal((await db.get('sm1')).comment.length,1);
 });
});

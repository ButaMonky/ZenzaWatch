const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');
function loader(failure){
 const c=createContext({AbortController,debug:{},console:{log(){},warn(){},error(){},time(){},timeEnd(){}},logSafe:{redact:()=>({})},
 PopupMessage:{alert(){}},sleep:async()=>{},netUtil:{fetch:async()=>({status:failure.status,headers:{get:()=>null},json:async()=>({meta:failure})})}});
 run(beginSection('packages/lib/src/nico/ThreadLoader.js')+';globalThis.loader=ThreadLoader;',c);
 return c.loader;
}
function msg(when){return {videoId:'sm9',userId:'synthetic',threadId:'10',when,threads:[],language:'ja-jp',nvComment:{server:'https://example.invalid',threadKey:'synthetic-key',params:{language:'ja-jp',targets:[]}}};}
async function rejection(p){try{await p;throw Error('unexpected success');}catch(e){return e;}}
describe('Task209 actionable but sanitised past-log failure',()=>{
 it('names historical mode and safe server status/code',async()=>{
  const e=await rejection(loader({status:403,errorCode:'FORBIDDEN'}).load(msg(1572253829)));
  assert(e.message.includes('過去ログ'));assert(e.message.includes('403'));assert(e.message.includes('FORBIDDEN'));
 });
 it('does not expose unvalidated server text through the alert message',async()=>{
  const e=await rejection(loader({status:403,errorCode:'private token and comment body'}).load(msg(1572253829)));
  assert(e.message.includes('過去ログ'));assert(!e.message.includes('private'));assert(!e.message.includes('token'));
 });
 it('keeps the ordinary latest-load failure message contract',async()=>{
  const e=await rejection(loader({status:403,errorCode:'FORBIDDEN'}).load(msg(0)));
  assert.strictEqual(e.message,'コメントサーバーの通信失敗');
 });
});

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); await new Promise(r=>setImmediate(r)); };
async function probe({openFail=false,getFail=false,writeFail=false,cached=false,networkFail=false,token='fixture',host='ext.nicovideo.jp'}={}) {
 let resolveDb,rejectDb;
 const dbReady=new Promise((resolve,reject)=>{resolveDb=resolve;rejectDb=reject;});
 const listeners=[],posts=[],fetches=[];
 let initialized=0;
 const info={status:'ok',v:'sm9',id:'sm9',title:'fixture'};
 const db={get:async()=>{if(getFail)throw Error('cache read');return cached?{thumbInfo:info,updatedAt:Date.now()}:null;},put:async()=>{if(writeFail)throw Error('cache write');}};
 const params={url:`https://${host}/api/getthumbinfo/sm9`,options:{expireTime:60000}};
 const request={data:{body:{command:'fetch',params},sessionId:'one',token}};
 const port={addEventListener(name,callback){listeners.push(callback);}};
 const gate=()=>({
  init(){initialized++;Promise.resolve().then(()=>listeners.forEach(f=>f(request)));return {port,TOKEN:'fixture'};},
  parseUrl:url=>new URL(url),
  post:(body,options)=>posts.push({body,options}),
  uFetch:async()=>{fetches.push(1);if(networkFail)throw {status:'fail',message:'offline'};return {text:async()=>'<fixture/>'};}
 });
 const context=createContext({PRODUCT:'MylistPocket',location:{host:'ext.nicovideo.jp'},gate,ThumbInfoCacheDb:{open:()=>dbReady},parseThumbInfo:()=>({...info}),console:{log(){},warn(){},error(){}}});
 run('globalThis.subject='+extract('src/_pocket.js','thumbInfoApi','var')+';',context);
 const start=context.subject();start.catch(()=>{});
 await flush();const earlyReady=initialized;
 if(openFail)rejectDb(Error('DB unavailable'));else resolveDb(db);
 let startError;try{await start;}catch(e){startError=e;}
 await flush();
 return {earlyReady,initialized,posts,fetches,startError};
}
describe('Task156 Pocket first thumbnail request',()=>{
 it('registers the receiver before the first request after ready',async()=>{const p=await probe();assert.equal(p.earlyReady,0);assert.equal(p.fetches.length,1);assert.equal(p.posts[0].options.sessionId,'one');assert.equal(p.posts[0].body.params.title,'fixture');});
 it('continues without a cache when opening IndexedDB fails',async()=>{const p=await probe({openFail:true});assert.equal(p.startError,undefined);assert.equal(p.posts[0].body.status,'ok');});
 it('continues after a cache read failure',async()=>{const p=await probe({getFail:true});assert.equal(p.fetches.length,1);assert.equal(p.posts[0].body.status,'ok');});
 it('replies even if the optional cache write fails',async()=>{const p=await probe({writeFail:true});assert.equal(p.posts[0].body.status,'ok');});
 it('keeps a valid cache hit without a network request',async()=>{const p=await probe({cached:true});assert.equal(p.fetches.length,0);assert.equal(p.posts[0].body.params.title,'fixture');});
 it('rejects an invalid message token or host',async()=>{for(const options of [{token:'wrong'},{host:'example.com'}]){const p=await probe(options);assert.equal(p.posts.length,0);assert.equal(p.fetches.length,0);}});
 it('returns a failure response instead of leaving the spinner pending',async()=>{const p=await probe({networkFail:true});assert.equal(p.posts[0].body.status,'fail');assert.equal(p.posts[0].options.sessionId,'one');});
});


const {test}=require('node:test'),assert=require('node:assert/strict');
const {createGmNetwork}=require('./gm-network.cjs');
test('GM transport restricts destinations before sending and preserves authenticated POST',async()=>{
 let sent;
 const network=createGmNetwork(options=>{sent=options;queueMicrotask(()=>options.onload({status:200,response:new TextEncoder().encode('{"ok":true}').buffer,responseHeaders:'Content-Type: application/json',finalUrl:options.url}));return {abort(){}};});
 for(const url of ['http://nvapi.nicovideo.jp/a','https://evil.example/','https://nicovideo.jp.evil.example/a','https://account.nicovideo.jp/login','https://u:p@nvapi.nicovideo.jp/a'])await assert.rejects(network.fetch(url));
 assert.equal(sent,undefined);
 const res=await network.fetch('https://nvapi.nicovideo.jp/v1/test',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});
 assert.deepEqual(await res.json(),{ok:true});assert.equal(sent.method,'POST');assert.equal(sent.data,'{}');assert.equal(sent.anonymous,false);
 assert.equal(sent.redirect,'error');assert.equal(sent.cookie,undefined);
});
test('GM cancellation aborts underlying request and timeout is reported',async()=>{
 let options,aborted=0;const n=createGmNetwork(o=>{options=o;return {abort(){aborted++;}};});
 const c=new AbortController();const p=n.fetch('https://nvapi.nicovideo.jp/a',{signal:c.signal});c.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(aborted,1);
 const q=n.fetch('https://nvapi.nicovideo.jp/a');options.ontimeout();await assert.rejects(q,{name:'TimeoutError'});
});
test('HLS loader sends exclusive range end correctly and supplies binary statistics',async()=>{
 let options;const n=createGmNetwork(o=>{options=o;queueMicrotask(()=>o.onload({status:206,response:new Uint8Array([1,2,3]).buffer,responseHeaders:'',finalUrl:o.url}));return {abort(){}};});
 const loader=new n.Loader({});
 await new Promise((resolve,reject)=>loader.load({url:'https://delivery.domand.nicovideo.jp/a',responseType:'arraybuffer',rangeStart:5,rangeEnd:8},{timeout:5000},{onSuccess:(r,s)=>{try{assert.equal(r.data.byteLength,3);assert.equal(s.loaded,3);assert.equal(options.headers.range,'bytes=5-7');resolve();}catch(e){reject(e);}},onError:reject,onTimeout:reject}));
 loader.destroy();
});
test('abandoned HLS request cannot deliver late media into a new video',async()=>{
 let options,aborted=0,delivered=0;const n=createGmNetwork(o=>{options=o;return {abort(){aborted++;}};});
 const l=new n.Loader();l.load({url:'https://delivery.domand.nicovideo.jp/a',responseType:'arraybuffer'},{timeout:5000},{onSuccess:()=>delivered++,onError:()=>delivered++,onTimeout:()=>delivered++});
 l.destroy();options.onload({status:200,response:new Uint8Array([1]).buffer,finalUrl:options.url});
 await new Promise(r=>setImmediate(r));assert.equal(aborted,1);assert.equal(delivered,0);
});
test('204 responses and omitted credentials retain their intended semantics',async()=>{
 let sent;const n=createGmNetwork(o=>{sent=o;queueMicrotask(()=>o.onload({status:204,response:new ArrayBuffer(0),finalUrl:o.url,responseHeaders:'Set-Cookie: secret=value\r\nX-Test: good'}));return {abort(){}};});
 const r=await n.fetch('https://nvapi.nicovideo.jp/v1/test',{method:'DELETE',credentials:'omit'});
 assert.equal(r.status,204);assert.equal(await r.text(),'');assert.equal(sent.anonymous,true);assert.equal(r.headers.get('set-cookie'),null);
});
test('hls.js default zero ranges omit Range and retain the bound stats object',async()=>{
 let sent;const n=createGmNetwork(o=>{sent=o;queueMicrotask(()=>o.onload({status:200,response:new Uint8Array([1,2]).buffer,finalUrl:o.url,responseHeaders:''}));return {abort(){}};});
 const l=new n.Loader(),boundStats=l.stats;
 await new Promise((resolve,reject)=>l.load({url:'https://delivery.domand.nicovideo.jp/a',rangeStart:0,rangeEnd:0,responseType:'arraybuffer'},{timeout:5000},{onSuccess:resolve,onError:reject,onTimeout:reject}));
 assert.equal(sent.headers.range,undefined);assert.equal(boundStats,l.stats);assert.equal(boundStats.loaded,2);assert.ok(boundStats.loading.end>=boundStats.loading.first);
});
test('HLS abort settles the consumer through onAbort exactly once',()=>{
 const n=createGmNetwork(()=>({abort(){}}));const l=new n.Loader();let calls=0;
 l.load({url:'https://delivery.domand.nicovideo.jp/a'},{timeout:5000},{onAbort:s=>{calls++;assert.equal(s.aborted,true);}});
 l.abort();l.destroy();assert.equal(calls,1);
});

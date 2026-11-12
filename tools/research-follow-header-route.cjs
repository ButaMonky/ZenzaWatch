'use strict';
// Offline, user-provided HAR only. Execute only the exact reviewed 197-character
// callback against inert navigation/element stubs, never the captured bundle.
const fs=require('fs'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const capture=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const entries=capture.log.entries;
const entry=entries.find(e=>new URL(e.request.url).pathname.endsWith('/Layout-BxKlN5K9.js'));
assert(entry,'Expected layout asset missing');
const source=entry.response.content.text;
const match=/r\.on\(`commonHeader:linkClick`,(e=>\{[^}]+\})\)/.exec(source);
assert(match,'Expected header callback missing');
const digest=crypto.createHash('sha256').update(match[1]).digest('hex');
assert.equal(digest,'d1ac9e5dcb6dec2cc32dfc6ce6c1dc831b1c163755c907575a815c9bb9e300f4','Unreviewed callback: do not execute');
const results=[];
for(const [name,cancelled,type,ctrl,target] of [
 ['ordinary',false,'click',false,''],['already-cancelled',true,'click',false,''],
 ['ctrl',false,'click',true,''],['middle',false,'auxclick',false,''],['blank-target',false,'click',false,'_blank']
]){
 const calls=[];
 const context=vm.createContext({r:{closePanel:()=>calls.push('closePanel')},o:()=>calls.push('router')});
 const nativeEvent={type,ctrlKey:ctrl,metaKey:false,defaultPrevented:cancelled,
  target:{closest:()=>({target})},preventDefault(){this.defaultPrevented=true;calls.push('preventDefault');}};
 const handler=vm.runInContext('('+match[1]+')',context,{timeout:1000});
 handler({nativeEvent,href:'https://www.nicovideo.jp/watch/sm9'});
 assert.equal(calls.includes('router'),name==='ordinary'||name==='already-cancelled');
 results.push({name,cancelledBefore:cancelled,routerCalled:calls.includes('router')});
 // Counterfactual at the actual routing boundary. This is not a deployed patch.
 if(cancelled){calls.length=0;const guarded=e=>{if(!e.nativeEvent.defaultPrevented)handler(e);};guarded({nativeEvent,href:'/watch/sm9'});assert.equal(calls.length,0);}
}
console.log(JSON.stringify({callbackSha256:digest,results,cancelledGuardModel:'passes'},null,2));

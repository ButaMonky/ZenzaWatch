const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const {stripTypeScriptTypes}=require('node:module');
const fs=require('fs');
const canonical=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/hls-src/HlsVideoElement.ts','utf8'));
const classStart=canonical.indexOf('class ZenzaVideoElement extends HTMLElement');
const classEnd=canonical.indexOf('\n      if (window.customElements',classStart);
assert(classStart>=0&&classEnd>classStart);
const canonicalClass=canonical.slice(classStart,classEnd);
function fixture({code=4, supported=true, mode='HLS-N', time=0, fail=false, missing=false, mse=false, managed=false, canonicalOwner=false}={}) {
 const c=createContext({HTMLElement:class{},Hls:missing?undefined:{isSupported:()=>supported},MediaSource:mse?class{}:undefined,ManagedMediaSource:managed?class{}:undefined});
 run(`const PLAYER_MODE=${extract('packages/zenza/src/hls/HlsVideoElement.js','PLAYER_MODE','var')}; ${canonicalOwner?canonicalClass:extract('packages/zenza/src/hls/HlsVideoElement.js','ZenzaVideoElement')};globalThis.Subject=ZenzaVideoElement;`,c);
 const p=Object.create(c.Subject.prototype), starts=[];
 Object.assign(p,{_src:'https://example.com/stream.m3u8',_video:{error:{code},currentTime:time},_resetPlayingStatus(){},_initHLSJS(src){if(fail)throw Error('init failed');starts.push(src);}});
 Object.defineProperty(p,'playerMode',{value:mode,writable:true});
 let stopped=0;const event={stopImmediatePropagation(){stopped++;}};
 return {p,starts,event,stopped:()=>stopped};
}
describe('Task155 native HLS startup fallback',()=>{
 for(const code of [3,4]) it(`falls back on native startup media error ${code}`,()=>{
  const f=fixture({code});assert.equal(f.p._onNativeHLSError(f.event),true);assert.deepEqual(f.starts,['https://example.com/stream.m3u8']);assert.equal(f.p.playerMode,'HLS-JS');assert.equal(f.stopped(),1);
 });
 it('does not retry a failed JS engine recursively',()=>{const f=fixture();f.p._onNativeHLSError(f.event);assert.equal(f.p._onNativeHLSError(f.event),false);assert.equal(f.starts.length,1);assert.equal(f.stopped(),1);});
 for(const options of [{code:1},{code:2},{supported:false},{mode:'N'},{time:12}]) it(`leaves unrelated errors visible: ${JSON.stringify(options)}`,()=>{const f=fixture(options);assert.equal(f.p._onNativeHLSError(f.event),false);assert.equal(f.starts.length,0);assert.equal(f.stopped(),0);});
 it('does not swallow the original failure if JS initialization throws',()=>{const f=fixture({fail:true});assert.equal(f.p._onNativeHLSError(f.event),false);assert.equal(f.stopped(),0);});
});

describe('Task997 native fallback after library failure (canonical TS)',()=>{
 for(const capabilities of [{mse:true},{managed:true}])for(const code of [3,4]){
  it('retries the absent library once for '+JSON.stringify({...capabilities,code}),()=>{
   const f=fixture({canonicalOwner:true,missing:true,...capabilities,code});
   assert.equal(f.p._onNativeHLSError(f.event),true);
   assert.equal(f.starts.length,1);assert.equal(f.stopped(),1);
   assert.equal(f.p._onNativeHLSError(f.event),false);
  });
 }
 for(const capabilities of [{missing:true},{supported:false,mse:true},{supported:false,managed:true}]){
  it('preserves native error without a supported retry route '+JSON.stringify(capabilities),()=>{
   const f=fixture({canonicalOwner:true,...capabilities});
   assert.equal(f.p._onNativeHLSError(f.event),false);
   assert.equal(f.starts.length,0);assert.equal(f.stopped(),0);
  });
 }
});

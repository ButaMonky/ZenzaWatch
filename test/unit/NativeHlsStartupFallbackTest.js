const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
function fixture({code=4, supported=true, mode='HLS-N', time=0, fail=false}={}) {
 const c=createContext({HTMLElement:class{},Hls:{isSupported:()=>supported}});
 run(`const PLAYER_MODE=${extract('src/_hls.js','PLAYER_MODE','var')}; ${extract('src/_hls.js','ZenzaVideoElement')};globalThis.Subject=ZenzaVideoElement;`,c);
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

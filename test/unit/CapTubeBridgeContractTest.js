'use strict';
const assert = require('assert');
const {read, extract, createContext, run} = require('../helpers/extractSource');
function extractBridge(path) {
  const code=read(path);
  const start=code.indexOf('VideoCaptureUtil.initCapTube = function()');
  const thumb=code.indexOf('VideoCaptureUtil.capTubeThumbnail =',start);
  assert(start>=0 && thumb>start,'capture bridge implementation missing');
  const after=code.slice(thumb);
  const match=after.match(/\n\s*};/);
  assert(match,'capture thumbnail method end missing');
  return code.slice(start,thumb+match.index+match[0].length);
}
function parentFixture(path) {
  const sent=[], listeners={}, timeouts=new Map();
  let id=0;
  const frame={postMessage(...args){sent.push(args);}};
  const iframe={src:'https://www.youtube.com/embed/test',contentWindow:frame};
  const c=createContext({URL,console:{warn(){}},
    location:{href:'https://www.nicovideo.jp/watch/sm9'},
    document:{querySelector:()=>iframe},
    self:{addEventListener:(event,fn)=>{listeners[event]=fn;}},
    setTimeout:fn=>{timeouts.set(++id,fn);return id;},
    clearTimeout:key=>timeouts.delete(key)});
  run('const VideoCaptureUtil={};'+extractBridge(path)+
    ';globalThis.capture=VideoCaptureUtil;',c);
  return {capture:c.capture,sent,frame,iframe,listeners,timeouts,
    receive(data,origin='https://www.youtube.com',source=frame){
      return listeners.message({source,origin,data});
    }};
}
function embedFixture(path) {
  const events={},requests=[],replies=[],calls=[];
  const parent={postMessage(...args){replies.push(args);}};
  const window={console:{log(){}},
    addEventListener:(event,fn)=>events[event]=fn};
  const c=createContext({URL, window, parent,
    document:{referrer:'https://www.nicovideo.jp/watch/sm9'},
    HOST_REG:/^[a-z0-9]*\.nicovideo\.jp$/,
    parseUrl:url=>new URL(url),
    PRODUCT:'CapTube',
    saveScreenShot:args=>calls.push(args),
    getThumbnailDataURL:async (...args)=>{
      requests.push(args);return 'data:image/png;base64,Zml4dHVyZQ==';
    }});
  run('globalThis.init = '+extract(path,'initializeEmbed','var')+';',c);
  c.init();
  return {events,requests,replies,calls,parent,
    receive(data,origin='https://www.nicovideo.jp',source=parent){
      return events.message({source,origin,data});
    }};
}
for(const [host,embed] of [
  ['packages/lib/src/dom/VideoCaptureUtil.js','src/_captube.js'],
  ['dist/ZenzaWatch-dev.user.js','dist/CapTube.user.js']]) {
  describe('Task374 CapTube iframe protocol '+host,()=>{
    it('refuses capture metadata delivery to an untrusted iframe',()=>{
      const h=parentFixture(host);
      h.iframe.src='https://attacker.invalid/embed/fixture';
      assert.strictEqual(h.capture.initCapTube(),null);
      h.capture.capTube({title:'private'});
      assert.strictEqual(h.sent.length,0);
    });
    it('sends screenshot fire-and-forget to the trusted iframe origin',()=>{
      const h=parentFixture(host);
      h.capture.capTube({title:'test',videoId:'sm9',author:'tester'});
      assert.strictEqual(h.sent.length,1);
      assert.strictEqual(h.sent[0][1],'https://www.youtube.com');
      assert.strictEqual(h.sent[0][0].body.command,'capTube');
      assert.strictEqual(h.timeouts.size,0,'no response expected for capture');
    });
    it('ignores unrelated messages and resolves thumbnail with normalized reply',async()=>{
      const h=parentFixture(host);
      const wait=h.capture.capTubeThumbnail(320,180,'image/webp');
      assert.strictEqual(h.sent.length,1);
      const [message,targetOrigin]=h.sent[0];
      assert.strictEqual(targetOrigin,'https://www.youtube.com');
      assert.strictEqual(message.body.command,'capTubeThumbnail');
      assert.doesNotThrow(()=>h.receive({some:'unrelated'}));
      assert.doesNotThrow(()=>h.receive({id:'CapTube',body:null}));
      assert.doesNotThrow(()=>h.receive({id:'CapTube',body:{command:'commandResult',
        status:'ok',params:{result:'evil'}}},'https://elsewhere.invalid'));
      const result='data:image/png;base64,Zml4dHVyZQ==';
      h.receive({id:'CapTube',sessionId:message.sessionId,
        body:{command:'commandResult',status:'ok',params:{result}}});
      assert.strictEqual(await wait,result);
      assert.strictEqual(h.timeouts.size,0);
    });
    it('rejects a failed reply and releases pending timer',async()=>{
      const h=parentFixture(host);
      const waiting=h.capture.capTubeThumbnail();
      const id=h.sent[0][0].sessionId;
      h.receive({id:'CapTube',sessionId:id,
        body:{command:'commandResult',status:'fail',params:{result:'failed'}}});
      const result=await waiting.then(()=>null,e=>e);
      assert(result);
      assert.strictEqual(h.timeouts.size,0);
    });
    it('embed accepts only same-parent valid commands, ignoring noise',async()=>{
      const h=embedFixture(embed);
      assert.doesNotThrow(()=>h.receive({some:'YouTube message'}));
      assert.doesNotThrow(()=>h.receive('{malformed-json'));
      assert.doesNotThrow(()=>h.receive({body:null}));
      h.receive({body:{command:'capTube',params:{title:'wrong'}}},
        'https://attacker.invalid');
      h.receive({body:{command:'capTube',params:{title:'wrong'}}},
        'https://www.nicovideo.jp',{});
      assert.strictEqual(h.calls.length,0);
      h.receive({body:{command:'capTube',params:{title:'ok',videoId:'sm9'}}});
      assert.strictEqual(h.calls.length,1);
      assert.strictEqual(h.calls[0].title,'ok');
      assert.strictEqual(h.replies.length,0);
      const pending=h.receive({sessionId:'ticket-1',
        body:{command:'capTubeThumbnail',params:{width:320,height:180,type:'image/webp'}}});
      await Promise.resolve(pending);
      await new Promise(resolve=>setImmediate(resolve));
      assert.strictEqual(h.requests.length,1);
      assert.deepStrictEqual(Array.from(h.requests[0]),[320,180,'image/webp']);
      assert.strictEqual(h.replies.length,1);
      assert.strictEqual(h.replies[0][1],'https://www.nicovideo.jp');
      assert.strictEqual(h.replies[0][0].body.status,'ok');
      assert.strictEqual(h.replies[0][0].body.params.result,
        'data:image/png;base64,Zml4dHVyZQ==');
    });
  });
}

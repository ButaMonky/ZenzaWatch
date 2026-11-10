'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,extract,read,run}=require('../helpers/extractSource');

function fixture(file){
  const dom=new JSDOM('<!doctype html><title>Search page</title><p>Results</p>',{
    url:'https://www.nicovideo.jp/search/example'
  });
  const document=dom.window.document,history=dom.window.history;
  const originalUrl=dom.window.location.href;
  history.replaceState({route:'search',scroll:42},'',originalUrl);
  const timers=[];
  const debounce=fn=>{
    let pending=null;
    const call=(...args)=>{pending=args;};
    call.cancel=()=>{pending=null;};
    call.flush=()=>{const args=pending;pending=null;if(args)fn(...args);};
    timers.push(call);return call;
  };
  const events={},dialog={_requestId:'A',_watchId:'smA',on(name,callback){events[name]=callback;}};
  const ctx=createContext({window:dom.window,document,location:dom.window.location,
    history,navigator:{locks:null},PRODUCT:'ZenzaWatch',NicoVideoApi:{},
    _:{debounce},setTimeout:callback=>callback()});
  const source=read(file);
  const token='const WatchPageHistory = (() => {';
  const start=source.indexOf(token),end=source.indexOf('\n})();',start);
  assert(start>=0&&end>start,'real history runtime exists');
  run(source.slice(start,end+'\n})();'.length)+';globalThis.Subject=WatchPageHistory;',ctx);
  ctx.Subject.initialize(dialog);
  return {dom,history,originalUrl,events,dialog,timers,service:ctx.Subject,close:()=>dom.window.close()};
}
const info=id=>({watchId:id,title:id,owner:{name:'fixture'}});
function modelInfo(id){
  const context=createContext();
  run(extract('src/VideoInfo.js','JSONable')+';'+extract('src/VideoInfo.js','VideoInfoModel')+
    ';globalThis.Model=VideoInfoModel;',context);
  return new context.Model({watchApiData:{videoDetail:{id,v:id,title:'model title'},uploaderInfo:{name:'model owner'}}});
}
describe('Audit #257/#258 history state and debounced event ownership',()=>{
  for(const file of ['packages/zenza/src/init/WatchPageHistory.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' reads the real VideoInfoModel prototype getters when recording a watch URL',()=>{
      const h=fixture(file),model=modelInfo('sm123');
      assert.equal(Object.hasOwn(model,'watchId'),false,'watchId is a prototype getter');
      h.events.open();h.events.loadVideoInfo(model);h.timers[1].flush();
      assert.equal(h.dom.window.location.pathname,'/watch/sm123');
      assert.equal(h.dom.window.document.title,'📺model title by model owner - ZenzaWatch');
      assert.equal(h.history.state.scroll,42);h.timers[0].flush();
      assert.equal(h.dom.window.location.href,h.originalUrl);h.close();
    });
    it(file+' snapshots metadata at the event boundary without reading unrelated properties',()=>{
      const h=fixture(file),model=modelInfo('sm123');
      Object.defineProperty(model,'unrelated',{enumerable:true,get(){throw Error('do not copy private model fields');}});
      h.events.open();assert.doesNotThrow(()=>h.events.loadVideoInfo(model));
      model._videoDetail.v='sm456';model._videoDetail.title='changed later';
      model._watchApiData.uploaderInfo.name='changed owner';h.timers[1].flush();
      assert.equal(h.dom.window.location.pathname,'/watch/sm123');
      assert.equal(h.dom.window.document.title,'📺model title by model owner - ZenzaWatch');h.close();
    });
    it(file+' accepts video metadata without an owner',()=>{
      for(const owner of [undefined,null,{}]){
        const h=fixture(file);h.events.open();
        h.events.loadVideoInfo({watchId:'smA',title:'fixture title',owner});
        assert.doesNotThrow(()=>h.timers[1].flush());
        assert.equal(h.dom.window.location.pathname,'/watch/smA');
        assert.equal(h.dom.window.document.title,'📺fixture title - ZenzaWatch');
        assert.equal(h.history.state.scroll,42);
        h.close();
      }
    });
    it(file+' preserves SPA state across watch URL and restore',()=>{
      const h=fixture(file);
      h.events.open();h.events.loadVideoInfo(info('smA'));h.timers[1].flush();
      assert.equal(h.dom.window.location.pathname,'/watch/smA');
      assert.equal(h.history.state.scroll,42);
      h.history.replaceState({route:'updated',scroll:99},'',h.dom.window.location.href);
      h.timers[0].flush();
      assert.equal(h.dom.window.location.href,h.originalUrl);
      assert.equal(h.history.state.scroll,99,'external state update survives');
      h.events.close();h.close();
    });
    it(file+' rejects old debounced A after opening B, then restores B only',()=>{
      const h=fixture(file);
      h.events.open();h.events.loadVideoInfo(info('smA'));
      h.dialog._requestId='B';h.dialog._watchId='smB';h.events.open();
      h.timers[1].flush();
      assert.equal(h.dom.window.location.href,h.originalUrl);
      h.events.loadVideoInfo(info('smB'));h.timers[1].flush();
      assert.equal(h.dom.window.location.pathname,'/watch/smB');
      h.events.close();
      assert.equal(h.dom.window.location.href,h.originalUrl);
      assert.equal(h.history.state.route,'search');
      h.close();
    });
    it(file+' does not undo an independent SPA navigation',()=>{
      const h=fixture(file);
      h.events.open();h.events.loadVideoInfo(info('smA'));h.timers[1].flush();
      h.history.pushState({route:'other'},'','/search/other');
      h.timers[0].flush();h.events.close();
      assert.equal(h.dom.window.location.pathname,'/search/other');
      assert.equal(h.history.state.route,'other');
      h.close();
    });
    it(file+' never acts on an A load after close/reopen',()=>{
      const h=fixture(file);h.events.open();
      h.events.loadVideoInfo(info('smA'));h.events.close();
      h.dialog._requestId='B';h.events.open();h.timers[1].flush();
      assert.equal(h.dom.window.location.href,h.originalUrl);
      h.close();
    });
  }
});

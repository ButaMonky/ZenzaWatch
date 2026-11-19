'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {startOrdinaryRuntime} = require('./ordinary-startup.cjs');

function fixture() {
  const input = new Map(), visibility = new Map(), storage = new Map();
  let deliver, timeout, launched = 0, disconnected = 0;
  const w = {
    name:'', location:new URL('https://www.nicovideo.jp/tag/test'), navigator:{userAgent:'desktop'},
    localStorage:{getItem:key=>storage.get(key) ?? null}, sessionStorage:{getItem:()=>null},
    document:{visibilityState:'visible',addEventListener:(k,f)=>visibility.set(k,f),removeEventListener:k=>visibility.delete(k)},
    performance:{getEntriesByName:()=>[]}, PerformanceObserver:class {
      static supportedEntryTypes = ['paint'];
      constructor(fn) { deliver=fn; }
      observe(options) { assert.deepEqual(options,{type:'paint',buffered:true}); }
      disconnect() { disconnected++; }
    },
    addEventListener:(k,f)=>input.set(k,f), removeEventListener:k=>input.delete(k),
    setTimeout:(f,ms)=>{assert.equal(ms,1200); timeout=f; return 7;}, clearTimeout:id=>assert.equal(id,7)
  };
  w.top=w;
  return {w,storage,input,visibility,start:()=>startOrdinaryRuntime(w,()=>{launched++;}),
    count:()=>launched,disconnected:()=>disconnected,timeout:()=>timeout(),
    paint:name=>deliver({getEntriesByName:key=>key===name?[{}]:[]})};
}

test('wait for content to paint, wake once and unregister observers on every exit', () => {
  for (const wake of ['first-contentful-paint','pointerdown','keydown','wheel','visibilitychange','timeout']) {
    const h=fixture(); h.start(); h.paint('first-paint');
    assert.equal(h.count(),0);
    if(wake==='first-contentful-paint')h.paint(wake);
    else if(wake==='timeout')h.timeout();
    else (h.input.get(wake)||h.visibility.get(wake))();
    h.paint('first-contentful-paint'); h.timeout();
    assert.equal(h.count(),1);
    assert.equal(h.input.size,0); assert.equal(h.visibility.size,0); assert.equal(h.disconnected(),1);
  }
});

test('start immediately when painting already happened, takeover is enabled or its status is unknown', () => {
  for (const configure of [
    h=>{h.w.performance.getEntriesByName=()=>[{}];}, h=>{h.w.document.visibilityState='hidden';},
    h=>{h.w.top={};}, h=>{h.w.location=new URL('https://www.google.com/search');},
    h=>{h.storage.set('ZenzaWatch_overrideGinza','true');}, h=>{h.storage.set('ZenzaWatch_overrideWatchLink','true');},
    h=>{h.w.navigator.userAgent='Mozilla CriOS';}, h=>{h.w.sessionStorage.getItem=()=>'saved';},
    h=>{h.w.name='watchGinza';}, h=>{h.w.location=new URL('https://www.nicovideo.jp/watch/sm9?from=21');},
    h=>{h.w.location.hash='#play';}, h=>{h.w.location.search='?continuous=1';},
    h=>{h.w.PerformanceObserver=undefined;}, h=>{h.storage.set('ZenzaWatch_overrideGinza','bad');},
    h=>{h.w.localStorage.getItem=()=>{throw Error('unavailable');};}
  ]) {
    const h=fixture(); configure(h); h.start();
    assert.equal(h.count(),1);
    assert.equal(h.input.size,0);
  }
  const h=fixture(); h.w.navigator.userAgent='Android'; h.storage.set('ZenzaWatch_overrideWatchLink','false');
  h.start(); assert.equal(h.count(),0); h.paint('first-contentful-paint'); assert.equal(h.count(),1);
});

test('search can start after first paint even when there are no result cards', () => {
  for (const wake of ['first-contentful-paint', 'pointermove']) {
    const h = fixture();
    h.w.location = new URL('https://www.nicovideo.jp/search/early');
    h.start();
    assert.equal(h.count(), 0);
    if (wake === 'pointermove') h.input.get(wake)();
    else h.paint(wake);
    h.timeout();
    assert.equal(h.count(), 1);
    assert.equal(h.input.size, 0);
  }
});

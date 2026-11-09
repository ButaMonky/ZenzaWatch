const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {stripTypeScriptTypes} = require('node:module');
const {JSDOM} = require('jsdom');

function loadRenderer() {
  const canonical = fs.readFileSync(path.resolve(__dirname, '../../tools/typescript-stage1/nico-src/ScreenFilter.ts'), 'utf8');
  const start = '// BEGIN SCREEN_FILTER_LOW_POWER_RENDERER';
  const end = '// END SCREEN_FILTER_LOW_POWER_RENDERER';
  const raw = canonical;
  assert(raw.includes(start) && raw.includes(end), 'bounded renderer implementation is missing');
  const code = raw.slice(raw.indexOf(start), raw.indexOf(end));
  return vm.runInNewContext(stripTypeScriptTypes(code) + '\ncreateScreenFilterLowPowerRenderer');
}

function fixture() {
  const dom = new JSDOM('<div id="parent"><video></video></div>');
  const doc = dom.window.document, win = dom.window;
  let video = doc.querySelector('video'), now = 0, id = 0;
  const jobs = new Map(), contexts = new Map(), calls = [], statuses = [], resizers = new Set();
  win.ResizeObserver = class {
    constructor(fn){this.fn=fn;}
    observe(){resizers.add(this);}
    disconnect(){resizers.delete(this);}
  };
  let fail = false, drawCost = 0;
  Object.defineProperty(doc, 'hidden', {value:false, writable:true});
  const prepare = el => {
    for (const [key, value] of Object.entries({videoWidth:1920,videoHeight:1080,readyState:4,paused:false,currentTime:1,
      offsetWidth:1000,offsetHeight:800,offsetLeft:12,offsetTop:20,currentSrc:'movie-a'})) {
      Object.defineProperty(el, key, {value, writable:true, configurable:true});
    }
    return el;
  };
  prepare(video);
  win.HTMLCanvasElement.prototype.getContext = function() {
    if (!contexts.has(this)) {
      const canvas = this;
      contexts.set(this, {filter:'none', clearRect(){}, fillRect(){},
        drawImage(source, ...args) {
          if (fail) throw new Error('draw unavailable');
          calls.push({canvas, source, args, filter:this.filter, time:now});
          now += drawCost;
        }});
    }
    return contexts.get(this);
  };
  win.setTimeout = (fn, delay) => {const key=++id; jobs.set(key,{fn,at:now+delay}); return key;};
  win.clearTimeout = key => jobs.delete(key);
  win.requestAnimationFrame = fn => {const key=++id; jobs.set(key,{fn,at:now+1}); return key;};
  win.cancelAnimationFrame = key => jobs.delete(key);
  const tick = ms => {
    const until=now+ms;
    for (;;) {
      const next=[...jobs.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next || next[1].at>until) break;
      jobs.delete(next[0]); now=next[1].at; next[1].fn(now);
    }
    now=Math.max(now,until);
  };
  const renderer=loadRenderer()({getVideo:()=>video,doc,win,onStatus:s=>statuses.push(s)});
  return {doc,win,renderer,calls,statuses,jobs,tick,contexts,
    get video(){return video;}, setFail:v=>{fail=v;}, setDrawCost:v=>{drawCost=v;}, resizers,
    resize:()=>resizers.forEach(observer=>observer.fn()),
    replace:()=>{const next=prepare(doc.createElement('video'));video.replaceWith(next);video=next;return next;},
    close:()=>{renderer.stop();dom.window.close();}};
}
const active={enabled:true,filter:'url(#zenzaScreenFilterSvg)',flipH:false,flipV:false};
describe('ScreenFilter bounded low power renderer', function() {
  let f;
  afterEach(()=>f && f.close());
  it('downsamples before applying the SVG and fits letterboxed video below comparison overlays',()=>{
    f=fixture();f.renderer.update(active);f.tick(40);
    assert.equal(f.calls.length,2);
    const [sample,filtered]=f.calls;
    assert.equal(sample.source,f.video);
    assert.equal(sample.filter,'none');
    assert.equal(filtered.source,sample.canvas);
    assert.equal(filtered.filter,active.filter);
    assert.deepEqual(sample.args,[0,0,853,480]);
    assert.equal(filtered.canvas.width,853);assert.equal(filtered.canvas.height,480);
    const style=filtered.canvas.style;
    assert(Math.abs(parseFloat(style.left)-12)<0.001);assert.equal(style.top,'138.75px');
    assert(Math.abs(parseFloat(style.width)-1000)<0.001);assert.equal(style.height,'562.5px');
    assert.equal(style.zIndex,'5');assert.equal(f.video.style.filter,'none');
  });
  it('caps completed frame scheduling at 30fps and coalesces repeated updates',()=>{
    f=fixture();f.renderer.update(active);
    for(let n=0;n<20;n++)f.renderer.update(active);
    f.tick(1000);
    const frames=f.calls.filter(c=>c.filter===active.filter);
    assert(frames.length>0 && frames.length<=30);
    for(let n=1;n<frames.length;n++)assert(frames[n].time-frames[n-1].time>=1000/30);
    assert.equal(f.jobs.size,1);
  });
  it('waits after expensive frame completion without queuing catch-up draws',()=>{
    f=fixture();f.setDrawCost(25);f.renderer.update(active);f.tick(1000);
    const frames=f.calls.filter(c=>c.filter===active.filter);
    assert(frames.length>0 && frames.length<=12);
    for(let n=1;n<frames.length;n++)assert(frames[n].time-frames[n-1].time>=50+1000/30);
    assert.equal(f.jobs.size,1);
  });
  it('draws a paused frame once, updates seek/flip, suspends hidden pages and resumes',()=>{
    f=fixture();f.video.paused=true;f.renderer.update(active);f.tick(100);
    assert.equal(f.calls.length,2);assert.equal(f.jobs.size,0);
    f.renderer.update({...active,flipH:true,flipV:true});f.tick(40);
    assert.equal(f.calls[3].canvas.style.transform,'scale(-1, -1)');
    f.video.dispatchEvent(new f.win.Event('seeked'));f.tick(40);assert.equal(f.calls.length,6);
    f.doc.hidden=true;f.doc.dispatchEvent(new f.win.Event('visibilitychange'));f.tick(100);
    assert.equal(f.calls.length,6);assert.equal(f.jobs.size,0);
    f.doc.hidden=false;f.doc.dispatchEvent(new f.win.Event('visibilitychange'));f.tick(40);
    assert.equal(f.calls.length,8);
  });
  it('refreshes paused video geometry on container resize and disconnects on stop',()=>{
    f=fixture();f.video.paused=true;f.renderer.update(active);f.tick(40);
    f.video.offsetWidth=800;f.resize();f.tick(40);
    assert.equal(f.calls.length,4);assert.equal(f.calls[3].canvas.style.width,'800px');
    f.renderer.stop();assert.equal(f.resizers.size,0);
  });
  it('normal/bypass cleanup removes rendering work, restores existing filter and never hides source',()=>{
    f=fixture();f.video.style.filter='brightness(1.1)';
    f.renderer.update(active);f.tick(40);
    f.renderer.update({enabled:false});
    assert.equal(f.jobs.size,0);assert.equal(f.doc.querySelector('canvas'),null);
    assert.equal(f.video.style.filter,'brightness(1.1)');assert.equal(f.video.style.opacity,'');
    f.video.dispatchEvent(new f.win.Event('play'));f.tick(100);
    assert.equal(f.calls.length,2);
  });
  it('draw failure latches unfiltered fallback and never retries on settings updates',()=>{
    f=fixture();f.setFail(true);f.renderer.update(active);f.tick(100);
    assert(f.statuses.includes('unavailable'));
    assert.equal(f.doc.querySelector('canvas').style.display,'none');
    assert.equal(f.video.style.filter,'none');assert.equal(f.jobs.size,0);
    f.setFail(false);
    for(let n=0;n<4;n++)f.renderer.update(active);
    f.video.dispatchEvent(new f.win.Event('play'));f.tick(100);
    assert.equal(f.calls.length,0);
    f.video.currentSrc='movie-b';f.video.dispatchEvent(new f.win.Event('loadeddata'));f.tick(40);
    assert.equal(f.calls.length,2);
  });
  it('restores the failure explanation after returning from a hidden document',()=>{
    f=fixture();f.setFail(true);f.renderer.update(active);f.tick(40);
    f.doc.hidden=true;f.doc.dispatchEvent(new f.win.Event('visibilitychange'));
    f.doc.hidden=false;f.doc.dispatchEvent(new f.win.Event('visibilitychange'));
    assert.equal(f.statuses[f.statuses.length-1],'unavailable');assert.equal(f.jobs.size,0);
  });
  it('handles wrapper drawable sources and source replacements without stale overlays',()=>{
    f=fixture();const wrapper=f.video;const source=f.doc.createElement('video');
    Object.defineProperties(source,{videoWidth:{value:640},videoHeight:{value:360},readyState:{value:4},paused:{value:false}});
    wrapper.drawableElement=source;
    f.renderer.update(active);f.tick(40);
    assert.equal(f.calls[0].source,source);assert.equal(f.calls[1].canvas.width,640);
    const next=f.replace();f.renderer.update(active);f.tick(40);
    assert.equal(wrapper.style.filter,'');assert.equal(f.calls[2].source,next);
    assert.equal(f.doc.querySelectorAll('canvas').length,1);
  });
  it('detects source removal while paused and cleans up without polling',async()=>{
    f=fixture();f.video.paused=true;f.renderer.update(active);f.tick(40);
    f.video.remove();await Promise.resolve();f.tick(100);
    assert.equal(f.doc.querySelector('canvas'),null);assert.equal(f.jobs.size,0);
  });
  it('waits for loaded data without frame polling and explains non-drawable sources',()=>{
    f=fixture();f.video.readyState=0;f.renderer.update(active);f.tick(100);
    assert.equal(f.calls.length,0);assert.equal(f.jobs.size,0);
    f.video.readyState=4;f.video.dispatchEvent(new f.win.Event('loadeddata'));f.tick(40);
    assert.equal(f.calls.length,2);
    f.video.drawableElement=f.doc.createElement('iframe');f.renderer.update(active);f.tick(100);
    assert(f.statuses.includes('unsupported'));assert.equal(f.jobs.size,0);
    assert.equal(f.video.style.filter,'none');
  });
});

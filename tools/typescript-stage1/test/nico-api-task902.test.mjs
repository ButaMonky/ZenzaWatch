// Task902: WatchPageHistory, BaseViewComponent, replaceRedirectLinks and HoverMenu moved to
// TypeScript. Behaviour is covered by the root suites (Issue1*, LegacyMyPageBootstrap, ...);
// this file checks the recorded fixes old vs new on the generated files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};

test('HOVERMENU-CLICK-LISTENER-ACCUM-001: repeated hovers keep one pending hide listener',()=>{
  const out={};
  for(const k of ['old','new']){
    const listeners=[];let hidden=0;
    const body={addEventListener:(type,fn,opt)=>listeners.push({type,fn,once:!!(opt&&opt.once)})};
    const H=loadLegacy(pair('HoverMenu')[k],'HoverMenu',{
      document:{body},window:{pageXOffset:0,pageYOffset:0},
      nicoUtil:{parseWatchQuery:()=>({})},cssUtil:{px:v=>v+'px'},
      ZenzaWatch:{},uq:{},PagePreviewGuard:class{},_:{debounce:f=>f}});
    const menu=Object.create(H.prototype);
    const target={classList:{contains:()=>false},getBoundingClientRect:()=>({top:1,left:2})};
    menu._$view={css(){return this;},addClass(){return this;},removeClass(){hidden++;}};
    menu._closest=()=>target;
    menu._getWatchReference=()=>({watchId:'sm9',url:new URL('https://www.nicovideo.jp/watch/sm9')});
    menu._hoverElement=target;
    for(let i=0;i<3;i++)menu._onHoverEnd({target});
    const afterHover=listeners.length;
    for(const l of listeners.splice(0))l.fn();
    menu._onHoverEnd({target});
    out[k]={afterHover,hidden,afterClickThenHover:listeners.length,once:listeners.every(l=>l.type==='click'&&l.once)};
  }
  assert.deepEqual(out.old,{afterHover:3,hidden:3,afterClickThenHover:1,once:true});
  // Task1019 以降: hover のたびに一回限りの click リスナーを足す方式をやめ、初期化時に
  // document の click → _hideButton を 1 回だけ登録する方式になった。hover を何回しても
  // リスナーは増えない（＝蓄積の不具合は形を変えても再発しない）。
  assert.deepEqual(out.new,{afterHover:0,hidden:0,afterClickThenHover:0,once:true});
  const src=pair('HoverMenu').new;
  assert.equal(src.split("document.addEventListener('click', () => this._hideButton())").length-1,1,
    'the single permanent document click hide listener must remain');
});

test('REDIRECTLINKS-SERIES-CONTAINER-001: a series page without the container is skipped',async()=>{
  const out={};
  for(const k of ['old','new']){
    const appended=[];
    const el=()=>({classList:{add(){}},style:{},href:'',dataset:{},append(...n){appended.push(n.length);},cloneNode(){return el();}});
    const firstVideo={dataset:{href:'/watch/sm9?ref=series'},href:''};
    const collection={forEach(){},closest(){return collection;}};
    const uq=Object.assign(()=>collection,{ready:async()=>{}});
    const f=loadLegacy(pair('replaceRedirectLinks')[k],'replaceRedirectLinks',{
      uq,window:{},location:{host:'www.nicovideo.jp',pathname:'/series/1',search:''},
      nicoUtil:{getMypageVer:()=>'old'},textUtil:{},cssUtil:{},_:{debounce:fn=>fn},
      document:{querySelector:s=>s==='.NC-Link.NC-MediaObject-contents'?firstVideo:null,createElement:el}});
    out[k]=await f().then(()=>'ok',e=>e.name);
    out[k+'Appended']=appended;
  }
  assert.equal(out.old,'TypeError');
  assert.equal(out.new,'ok');
  // The buttons are still built; only the missing container is skipped.
  assert.deepEqual(out.newAppended,[2]);
});

test('an initialization failure settles queued Zen clicks and leaves the native result usable', async () => {
  const actions = [];
  const H = loadLegacy(pair('HoverMenu').new, 'HoverMenu', {
    PagePreviewGuard:class {}, ZenzaWatch:{external:{send:(...args) => actions.push(args)}}
  });
  const menu = Object.create(H.prototype);
  menu._playerConfig = {getValue:() => false};
  menu._$view = {removeClass() {}};
  const pending = [menu._open('sm9'), menu._send('sm10')];
  menu.setPlayerUnavailable();
  await Promise.all(pending);
  assert.equal(await menu._getPlayer(),null);
  assert.deepEqual(actions,[]);
});

test('an explicit first local Zen click starts one watch-page read while the player is pending', async () => {
  let options, cancelled = 0, reads = 0;
  const opens = [];
  const H = loadLegacy(pair('HoverMenu').new, 'HoverMenu', {
    location:{host:'www.nicovideo.jp',pathname:'/search/test'}, document:{body:{}},
    VideoInfoLoader:{beginFirstOpenPageRead:(id, opts)=>{
      assert.equal(id,'sm9'); reads++; options=opts; return ()=>{cancelled++;};
    }},
    PagePreviewGuard:class {}
  });
  const menu = Object.create(H.prototype);
  menu._watchId='sm9';
  menu._playerConfig={props:{overrideWatchLink:false},getValue:()=>false};
  menu._hideButton=()=>{};
  menu._onClick({isTrusted:true,preventDefault(){},stopPropagation(){}});
  menu._onClick({isTrusted:true,preventDefault(){},stopPropagation(){}});
  assert.ok(options, 'read starts in the trusted click even before setPlayer');
  assert.equal(reads,1,'repeated clicks on the pending video reuse the same read');
  assert.equal(cancelled,0);
  menu.setPlayer({open:(id, opts)=>{assert.strictEqual(opts,options); opens.push(id);}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(opens,['sm9']);
  assert.equal(cancelled,1);
});

test('search setup yields until enough idle time, the deadline, or playback intent', async () => {
  for (const wake of ['idle', 'timeout', 'hover', 'open', 'hidden', 'unavailable']) {
    const callbacks = new Map(), listeners = new Map();
    let next = 0, now = 100;
    const window = {
      requestIdleCallback(fn, {timeout}) {
        assert.ok(timeout > 0 && timeout <= 400);
        callbacks.set(++next, fn);
        return next;
      },
      cancelIdleCallback: id => callbacks.delete(id)
    };
    const document = {
      hidden: false,
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener(type, fn) { assert.equal(listeners.get(type), fn); listeners.delete(type); }
    };
    const H = loadLegacy(pair('HoverMenu').new, 'HoverMenu', {document, window, performance: {now: () => now}});
    const menu = Object.create(H.prototype);
    const wait = menu.waitForPlayerIdle();
    assert.equal(menu.waitForPlayerIdle(), wait);
    const fire = (time, timedOut) => {
      const [[id, fn]] = callbacks;
      callbacks.delete(id);
      fn({didTimeout: timedOut, timeRemaining: () => time});
    };
    fire(2, false);
    assert.equal(callbacks.size, 1);
    assert.equal(listeners.size, 1);
    if (wake === 'idle') fire(14, false);
    if (wake === 'timeout') { now += 400; fire(0, false); }
    if (wake === 'hover') {
      menu._$view = [];
      const target = {};
      menu._closest = node => node === target ? node : null;
      menu._onHover({target: {}});
      assert.equal(callbacks.size, 1);
      menu._onHover({target});
    }
    if (wake === 'open') void menu._getPlayer();
    if (wake === 'hidden') { document.hidden = true; listeners.get('visibilitychange')(); }
    if (wake === 'unavailable') { menu._$view = {removeClass() {}}; menu.setPlayerUnavailable(); }
    await wait;
    assert.equal(callbacks.size, 0);
    assert.equal(listeners.size, 0);
    if (['hover', 'open', 'hidden', 'unavailable'].includes(wake)) {
      await menu.waitForPlayerIdle();
      assert.equal(callbacks.size, 0);
    }
  }
});

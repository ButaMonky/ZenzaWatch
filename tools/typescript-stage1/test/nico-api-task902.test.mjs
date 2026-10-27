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
  assert.deepEqual(out.new,{afterHover:1,hidden:1,afterClickThenHover:1,once:true});
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

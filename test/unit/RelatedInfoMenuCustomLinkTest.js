'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');
const {REPO_ROOT} = require('../helpers/buildSandbox');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function harness(links = []) {
  const dom = new JSDOM('<!doctype html><body></body>', {
    url:'https://www.nicovideo.jp/watch/sm9'});
  const win = dom.window;
  const handlers = [];
  class Emitter {
    constructor() { this._events = new Map(); }
    on(name, fn) {
      if (!this._events.has(name)) this._events.set(name, []);
      this._events.get(name).push(fn);
    }
    emit(name, ...args) {
      (this._events.get(name) || []).forEach(fn=>fn(...args));
    }
  }
  const config = {
    getValue: key => key === 'relatedMenu.customLinks' ? links : null,
    onkey: (key, fn) => handlers.push({key,fn})
  };
  const player = {currentTime: 12.1};
  const ctx = createContext({
    window:win,document:win.document,navigator:win.navigator,
    URL:win.URL,CustomEvent:win.CustomEvent,
    PRODUCT:'ZenzaWatch',Emitter,
    _: {debounce:fn=>fn},
    cssUtil: {addStyle() {}},
    ClassList:el=>({
      toggle:(k,v)=>el.classList.toggle(k,v),
      contains:k=>el.classList.contains(k),
      add:(...a)=>el.classList.add(...a),
      remove:(...a)=>el.classList.remove(...a)
    }),
    Config:config,
    ZenzaWatch:{debug:{videoControlBar:{player}}}
  });
  run(beginSection('packages/zenza/src/menu/RelatedMenuActions.js')+
    ';globalThis.Actions=RelatedMenuActions;',ctx);
  ctx.RelatedMenuActions=ctx.Actions;
  run(beginSection('packages/zenza/src/parts/BaseViewComponent.js')+
    ';globalThis.BaseViewComponent=BaseViewComponent;',ctx);
  const source=fs.readFileSync(path.join(REPO_ROOT,'src/VideoInfoPanel.js'),'utf8');
  const from=source.indexOf('class RelatedInfoMenu extends');
  const until=source.indexOf('class VideoMetaInfo extends',from);
  assert(from>=0 && until>from);
  run(source.slice(from,until)+';globalThis.RelatedInfoMenu=RelatedInfoMenu;',ctx);
  const menu=()=>new ctx.RelatedInfoMenu({parentNode:win.document.body});
  return {dom,win,ctx,menu,player,handlers,config,setLinks:v=>{links=v;handlers.forEach(h=>h.fn(v));}};
}
const video = (owner={type:'user',id:123,name:'Uploader'})=>({
  videoId:'sm9',watchId:'sm9',title:'Test & Japanese 日本語',
  owner,canOpenContentTree:false,isCommunityVideo:false,isMymemory:false
});

describe('Task313 RelatedInfoMenu DOM integration', () => {
  it('renders persistent links in both header and information menus', () => {
    const h=harness([
      {id:'history',label:'視聴履歴',url:'https://example.com/history',enabled:true},
      {id:'chart',label:'チャート',url:'https://example.com/{videoId}',enabled:true}
    ]);
    try {
      const header=h.menu(), information=h.menu();
      header.update(video());
      information.update(video());
      for (const menu of [header,information]) {
        const group=menu._customRelatedGroup;
        assert(group && !group.hidden);
        const items=menu._customRelatedItems.querySelectorAll('a[data-related-link-id]');
        assert.strictEqual(items.length,2);
        assert.strictEqual(items[1].href,'https://example.com/sm9');
        assert.strictEqual(items[1].target,'_blank');
        assert.strictEqual(items[1].rel,'noopener noreferrer');
        assert(menu._ginzaLink,'built-in menu stays intact');
      }
    } finally {h.dom.window.close();}
  });
  it('disables only links with unavailable metadata while keeping valid siblings', () => {
    const h=harness([
      {id:'user',label:'User',url:'https://example.com/{uploaderUserId}'},
      {id:'video',label:'Video',url:'https://example.com/{videoId}'}
    ]);
    try {
      const m=h.menu();m.update(video({type:'user',id:null,name:'Removed'}));
      const disabled=m._customRelatedItems.querySelector('.customRelatedDisabled');
      assert(disabled);
      assert.strictEqual(disabled.getAttribute('aria-disabled'),'true');
      assert(!disabled.closest('a'));
      assert.strictEqual(m._customRelatedItems.querySelectorAll('a').length,1);
    }finally{h.dom.window.close();}
  });
  it('uses textContent rather than injecting configured label HTML', () => {
    const h=harness([{id:'html',label:'<img src=x onerror=alert(1)>',
      url:'https://example.com/{videoId}'}]);
    try {
      const m=h.menu();m.update(video());
      assert(!m._customRelatedItems.querySelector('img'));
      assert.strictEqual(m._customRelatedItems.querySelector('a').textContent,
        '<img src=x onerror=alert(1)>');
    }finally{h.dom.window.close();}
  });
  it('refreshes link settings in both menus without another video load', () => {
    const h=harness([]);
    try {
      const a=h.menu(),b=h.menu();
      a.update(video());b.update(video());
      assert(a._customRelatedGroup.hidden);
      assert(b._customRelatedGroup.hidden);
      h.setLinks([{id:'added',label:'Added',
        url:'https://example.com/{videoId}',openInNewTab:false}]);
      for(const m of [a,b]) {
        assert(!m._customRelatedGroup.hidden);
        assert.strictEqual(m._customRelatedItems.querySelector('a').target,'_self');
      }
      h.setLinks([]);
      assert(a._customRelatedGroup.hidden && b._customRelatedGroup.hidden);
    }finally{h.dom.window.close();}
  });
  it('resolves current playback position when a custom link is activated', () => {
    const h=harness([{id:'seek',label:'Timestamp',
      url:'https://example.com/seek?t={currentTime}'}]);
    try {
      const m=h.menu();m.update(video());
      h.player.currentTime=63.7;
      const link=m._customRelatedItems.querySelector('a');
      // Allow the handler to run, but block jsdom external navigation.
      link.addEventListener('click',e=>e.preventDefault(),{capture:true});
      link.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true,cancelable:true}));
      assert.strictEqual(link.href,'https://example.com/seek?t=63');
    }finally{h.dom.window.close();}
  });
  it('registers and unregisters runtime callbacks without changing Config', () => {
    const h=harness([]);
    try {
      const m=h.menu();m.update(video());
      const calls=[];
      const off=h.ctx.Actions.register({id:'copy-video-id',label:'コピー',
        action: ctx=>calls.push(Object.keys(ctx).sort().join('|') + ':'+ctx.videoId)});
      const btn=m._customRelatedItems.querySelector('button');
      assert(btn);
      assert.strictEqual(btn.textContent,'コピー');
      btn.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true,cancelable:true}));
      assert.strictEqual(calls.length,1);
      assert(calls[0].endsWith(':sm9'));
      assert(!calls[0].includes('csrf'));
      off();
      assert(m._customRelatedGroup.hidden);
    }finally{h.dom.window.close();}
  });
});

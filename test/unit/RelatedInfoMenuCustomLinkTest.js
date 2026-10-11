'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');
const {REPO_ROOT} = require('../helpers/buildSandbox');
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function harness(links = [], order = [], hidden = [], menuVisible = true, builtinOptions = {}) {
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
    default:{'relatedMenu.customLinks':[], 'relatedMenu.order':[],
      'relatedMenu.hiddenItems':[], 'relatedMenu.builtinOptions':{}, 'ui.relatedMenu':true},
    storage:win.localStorage,
    getStorageKey:key=>'ZenzaWatch_'+key,
    async refresh(key,storage=win.localStorage) {
      const raw=storage[this.getStorageKey(key)];
      const value=raw==null?this.default[key]:JSON.parse(raw);
      if(key==='relatedMenu.customLinks'){links=value;}
      if(key==='relatedMenu.order'){order=value;}
      if(key==='relatedMenu.hiddenItems'){hidden=value;}
      if(key==='relatedMenu.builtinOptions'){builtinOptions=value;}
      if(key==='ui.relatedMenu'){menuVisible=value;}
      return value;
    },
    getValue: key => key === 'relatedMenu.customLinks' ? links :
      key === 'relatedMenu.order' ? order :
      key === 'relatedMenu.hiddenItems' ? hidden :
      key === 'relatedMenu.builtinOptions' ? builtinOptions :
      key === 'ui.relatedMenu' ? menuVisible : null,
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
  run(beginSection('src/RelatedMenuOrder.js')+
    ';globalThis.MenuOrder=RelatedMenuOrder;',ctx);
  ctx.RelatedMenuOrder=ctx.MenuOrder;
  ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
  run(beginSection('packages/zenza/src/menu/OfficialPlayerRoute.js')+
    ';globalThis.OfficialPlayerRoute=OfficialPlayerRoute;',ctx);
  run(beginSection('packages/zenza/src/parts/BaseViewComponent.js')+
    ';globalThis.BaseViewComponent=BaseViewComponent;',ctx);
  const source=fs.readFileSync(path.join(REPO_ROOT,'src/VideoInfoPanel.js'),'utf8');
  const from=source.indexOf('class RelatedInfoMenu extends');
  const until=source.indexOf('class VideoMetaInfo extends',from);
  assert(from>=0 && until>from);
  run(source.slice(from,until)+';globalThis.RelatedInfoMenu=RelatedInfoMenu;',ctx);
  const menu=()=>new ctx.RelatedInfoMenu({parentNode:win.document.body});
  return {dom,win,ctx,menu,player,handlers,config,
    setLinks:v=>{links=v;handlers.forEach(h=>h.fn(v));},
    setOrder:v=>{order=v;handlers.forEach(h=>h.fn(v));},
    setHidden:v=>{hidden=v;handlers.forEach(h=>h.fn(v));},
    setBuiltinOptions:v=>{builtinOptions=v;
      handlers.filter(h=>h.key==='relatedMenu.builtinOptions').forEach(h=>h.fn(v));},
    setMenuVisible:v=>{menuVisible=v;
      handlers.filter(h=>h.key==='ui.relatedMenu').forEach(h=>h.fn(v));}};
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
      assert.strictEqual(m._customRelatedItems.querySelectorAll('a[data-related-link-id]').length,1);
    }finally{h.dom.window.close();}
  });
  it('uses textContent rather than injecting configured label HTML', () => {
    const h=harness([{id:'html',label:'<img src=x onerror=alert(1)>',
      url:'https://example.com/{videoId}'}]);
    try {
      const m=h.menu();m.update(video());
      assert(!m._customRelatedItems.querySelector('img'));
      assert.strictEqual(m._customRelatedItems.querySelector('a[data-related-link-id]').textContent,
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
        assert.strictEqual(m._customRelatedItems.querySelector('a[data-related-link-id]').target,'_self');
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
      const link=m._customRelatedItems.querySelector('a[data-related-link-id]');
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

describe('Task318 unified related menu runtime',()=>{
  const keys=menu=>Array.from(menu._customRelatedItems.querySelectorAll(
    'li[data-related-order-key]'),li=>li.dataset.relatedOrderKey);
  it('reorders built-ins, custom links and registered actions together in both menus',()=>{
    const h=harness([{id:'history',label:'履歴',url:'https://example.com/history'}],
      ['link:history','builtin:copy-url','action:external']);
    try{
      const calls=[];
      h.ctx.Actions.register({id:'external',label:'外部機能',
        action:ctx=>calls.push(ctx.videoId)});
      const a=h.menu(),b=h.menu();a.update(video());b.update(video());
      for(const m of [a,b]){
        assert.deepStrictEqual(keys(m).slice(0,3),
          ['link:history','builtin:copy-url','action:external']);
        assert.strictEqual(keys(m).length,9);
        assert(m._ginzaLink,'official command retains its original node');
      }
      h.setOrder(['builtin:official','link:history','action:external']);
      assert.deepStrictEqual(keys(a).slice(0,3),
        ['builtin:official','link:history','action:external']);
      assert.deepStrictEqual(keys(b).slice(0,3),
        ['builtin:official','link:history','action:external']);
      const btn=a._customRelatedItems.querySelector('button[data-param="external"]');
      btn.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true,cancelable:true}));
      assert.deepStrictEqual(calls,['sm9']);
    }finally{h.dom.window.close();}
  });
  it('keeps standard condition classes and ignores dormant external IDs',()=>{
    const h=harness([],['action:gone','builtin:tree','builtin:copy-url']);
    try{
      const m=h.menu();m.update(video());
      assert.strictEqual(keys(m)[0],'builtin:tree');
      assert(!keys(m).includes('action:gone'));
      const tree=m._customRelatedItems.querySelector('[data-related-order-key="builtin:tree"]');
      assert(tree.classList.contains('parentVideoMenu'));
      assert.strictEqual(m._view.classList.contains('is-ParentVideoExist'),false);
      h.ctx.Actions.register({id:'gone',label:'再登録',action(){}});
      assert.strictEqual(keys(m)[0],'action:gone');
    }finally{h.dom.window.close();}
  });
});
describe('Task318 related-menu visibility',()=>{
  it('hides built-ins, saved links and runtime actions without deleting them',()=>{
    const h=harness([{id:'history',label:'履歴',url:'https://example.com/history'}],
      [],['builtin:ad','link:history','action:external']);
    try{
      h.ctx.Actions.register({id:'external',label:'外部',action(){}});
      const a=h.menu(),b=h.menu();
      a.update(video());b.update(video());
      for(const m of [a,b]){
        const rows=[...m._customRelatedItems.querySelectorAll('[data-related-order-key]')];
        const found=key=>rows.find(row=>row.dataset.relatedOrderKey===key);
        assert(found('builtin:ad').hidden);
        assert(found('link:history').hidden);
        assert(found('action:external').hidden);
        assert(!found('builtin:official').hidden);
        assert.strictEqual(rows.length,9);
      }
      h.setHidden([]);
      for(const m of [a,b]){
        assert(!m._customRelatedItems.querySelector('[data-related-order-key="builtin:ad"]').hidden);
        assert(!m._customRelatedItems.querySelector('[data-related-order-key="link:history"]').hidden);
      }
    }finally{h.dom.window.close();}
  });
});

describe('Task318 related-menu container visibility',()=>{
  it('hides the menu in the header and information panel, then restores both',()=>{
    const h=harness([{id:'link',label:'追加',url:'https://example.com/{videoId}'}],
      [],[],false);
    try{
      const a=h.menu(),b=h.menu();a.update(video());b.update(video());
      for(const m of [a,b]){
        assert(m._view.hidden);
        assert.strictEqual(m._view.style.display,'none');
        assert(m._customRelatedItems.querySelector('[data-related-order-key="link:link"]'));
      }
      h.setMenuVisible(true);
      for(const m of [a,b]){
        assert.strictEqual(m._view.hidden,false);
        assert.strictEqual(m._view.style.display,'');
      }
      a._shadow.open=true;
      let closed=0;a.on('close',()=>closed++);
      h.setMenuVisible(false);
      assert.strictEqual(a._shadow.open,false,'an open menu must close when hidden');
      assert.strictEqual(closed,1);
      assert(b._view.hidden);
      h.setMenuVisible(true);
      assert(!a._view.hidden);
    }finally{h.dom.window.close();}
  });
});


describe('Related menu cross-tab and same-tab settings updates',()=>{
  const keys=menu=>Array.from(menu._customRelatedItems.querySelectorAll('li[data-related-order-key]'),
    li=>li.dataset.relatedOrderKey);
  it('updates both existing menus on browser storage events without reloading',()=>{
    const h=harness();
    try {
      const a=h.menu(),b=h.menu();a.update(video());b.update(video());
      const change=(key,value)=>{
        const native='ZenzaWatch_'+key;
        const oldValue=h.win.localStorage.getItem(native);
        h.win.localStorage.setItem(native,JSON.stringify(value));
        h.win.dispatchEvent(new h.win.StorageEvent('storage',{
          key:native,oldValue,newValue:JSON.stringify(value),
          storageArea:h.win.localStorage,url:'https://www.nicovideo.jp/my'}));
      };
      change('relatedMenu.order',['builtin:copy-url','builtin:official']);
      assert.strictEqual(keys(a)[0],'builtin:copy-url');
      assert.strictEqual(keys(b)[0],'builtin:copy-url');
      change('relatedMenu.hiddenItems',['builtin:ad']);
      for(const m of [a,b]){
        assert(m._customRelatedItems.querySelector('[data-related-order-key="builtin:ad"]').hidden);
      }
      change('relatedMenu.customLinks',[{id:'chart',label:'Chart',
        url:'https://example.org/{videoId}',openInNewTab:true}]);
      for(const m of [a,b]){
        assert.strictEqual(m._customRelatedItems.querySelector('a[data-related-link-id="chart"]').href,
          'https://example.org/sm9');
      }
      change('ui.relatedMenu',false);
      assert(a._view.hidden && b._view.hidden);
      change('ui.relatedMenu',true);
      assert(!a._view.hidden && !b._view.hidden);
    }finally{h.dom.window.close();}
  });
  it('ignores unrelated/sessionStorage updates and handles a removed order key',()=>{
    const h=harness([],['builtin:copy-url']);
    try{
      const m=h.menu();m.update(video());
      h.win.dispatchEvent(new h.win.StorageEvent('storage',{
        key:'Other_app',newValue:'true',storageArea:h.win.localStorage}));
      h.win.dispatchEvent(new h.win.StorageEvent('storage',{
        key:'ZenzaWatch_relatedMenu.order',newValue:'[]',
        storageArea:h.win.sessionStorage}));
      assert.strictEqual(keys(m)[0],'builtin:copy-url');
      h.win.dispatchEvent(new h.win.StorageEvent('storage',{
        key:'ZenzaWatch_relatedMenu.order',newValue:null,storageArea:h.win.localStorage}));
      assert.strictEqual(keys(m)[0],'builtin:official','removed order returns to default');
    }finally{h.dom.window.close();}
  });
  it('refreshes both menus on same-document settings saved notifications',()=>{
    const h=harness();
    try {
      const a=h.menu(),b=h.menu();a.update(video());b.update(video());
      h.win.localStorage.setItem('ZenzaWatch_relatedMenu.order',
        JSON.stringify(['builtin:copy-url','builtin:ad']));
      h.win.dispatchEvent(new h.win.CustomEvent('ZenzaWatch-advanced-settings-saved',
        {detail:{keys:['relatedMenu.order']}}));
      assert.strictEqual(keys(a)[0],'builtin:copy-url');
      assert.strictEqual(keys(b)[0],'builtin:copy-url');
    }finally{h.dom.window.close();}
  });
});

describe('Task396 related-menu builtin and browser-opening integration',()=>{
  it('edits standard labels live without cloning menu nodes or exposing option keys',()=>{
    const h=harness([],[],[],true,{official:{label:'公式を表示'},
      twitter:{urlTemplate:'https://example.org/search?q={videoId}'}});
    try{
      const a=h.menu(),b=h.menu();a.update(video());b.update(video());
      for(const m of [a,b]){
        assert.strictEqual(m._ginzaLink.textContent,'公式を表示');
        assert.strictEqual(m._twitterLink.href,'https://example.org/search?q=sm9');
        assert.strictEqual(m._builtinRelatedItems.size,7);
      }
      h.setBuiltinOptions({official:{label:'公式で視聴',openMode:'same-tab'}});
      for(const m of [a,b]){
        assert.strictEqual(m._ginzaLink.textContent,'公式で視聴');
        assert.strictEqual(m._ginzaLink.target,'_self');
      }
    }finally{h.dom.window.close();}
  });
  it('preserves the official bypass marker and chooses per-item window behavior',()=>{
    const h=harness([],[],[],true,{official:{openMode:'new-window',popupWidth:710,popupHeight:550},
      ad:{openMode:'new-window',popupWidth:630,popupHeight:610}});
    try{
      const m=h.menu();m.update(video());
      const opened=[];h.win.open=(...args)=>{opened.push(args);return null;};
      m._onCommand('watch-ginza');
      assert(opened[0][0].includes('zenza_official=1'));
      assert(opened[0][2].includes('width=710'));
      m._onCommand('open-uad');
      assert(opened[1][0].includes('nicoad.nicovideo.jp'));
      assert(opened[1][2].includes('height=610'));
    }finally{h.dom.window.close();}
  });
  it('uses a popup only for explicitly opted-in custom links',()=>{
    const h=harness([{id:'preview',label:'Preview',
      url:'https://example.org/{videoId}',openMode:'new-window',
      popupWidth:820,popupHeight:620}]);
    try{
      const m=h.menu();m.update(video());
      const opened=[];h.win.open=(...args)=>{opened.push(args);return null;};
      const link=m._customRelatedItems.querySelector('a[data-related-link-id="preview"]');
      assert(link);
      link.dispatchEvent(new h.win.MouseEvent('click',{bubbles:true,cancelable:true}));
      assert.strictEqual(opened.length,1);
      assert(opened[0][0].includes('example.org/sm9'));
      assert(opened[0][2].includes('width=820'));
    }finally{h.dom.window.close();}
  });
});


describe('Task396 live built-in URL ownership',()=>{
  it('updates and resets both URL overrides without requiring another video load',()=>{
    const h=harness();
    try{
      const a=h.menu(),b=h.menu();a.update(video());b.update(video());
      h.setBuiltinOptions({twitter:{urlTemplate:'https://example.org/find/{videoId}'},
        tree:{urlTemplate:'https://example.org/tree/{watchId}'}});
      for(const m of [a,b]){
        assert.strictEqual(m._twitterLink.href,'https://example.org/find/sm9');
        assert.strictEqual(m._parentVideoLink.href,'https://example.org/tree/sm9');
      }
      h.setBuiltinOptions({});
      for(const m of [a,b]){
        assert.strictEqual(m._twitterLink.href,'https://twitter.com/hashtag/sm9');
        assert(m._parentVideoLink.href.startsWith('https://commons.nicovideo.jp/works/sm9?'));
      }
    }finally{h.dom.window.close();}
  });
  it('disables a configured built-in URL when its required owner variable is missing',()=>{
    const h=harness([],[],[],true,{
      twitter:{urlTemplate:'https://example.org/{uploaderUserId}'}});
    try{
      const m=h.menu();m.update(video({type:'user',id:null,name:'Removed'}));
      assert.strictEqual(m._twitterLink.getAttribute('aria-disabled'),'true');
      assert.strictEqual(m._twitterLink.hasAttribute('href'),false);
      const opened=[];h.win.open=(...args)=>opened.push(args);
      m._onCommand('open-twitter-hash');
      assert.strictEqual(opened.length,0,'must not silently open a different fallback URL');
      h.setBuiltinOptions({});
      assert.strictEqual(m._twitterLink.getAttribute('aria-disabled'),null);
      assert.strictEqual(m._twitterLink.href,'https://twitter.com/hashtag/sm9');
    }finally{h.dom.window.close();}
  });
  it('leaves Ctrl-click navigation native while refreshing the current position',()=>{
    const h=harness([],[],[],true,{twitter:{openMode:'new-window',
      urlTemplate:'https://example.org/?t={currentTime}'}});
    try{
      const m=h.menu();m.update(video());h.player.currentTime=91.7;
      const opened=[];h.win.open=(...args)=>opened.push(args);
      m._twitterLink.addEventListener('click',e=>e.preventDefault());
      m._twitterLink.dispatchEvent(new h.win.MouseEvent('click',
        {bubbles:true,cancelable:true,ctrlKey:true}));
      assert.strictEqual(opened.length,0,'Ctrl-click must not also open a scripted window');
      assert.strictEqual(m._twitterLink.href,'https://example.org/?t=91');
    }finally{h.dom.window.close();}
  });
});

describe('Task398 copy menu runtime',()=>{
  it('renders a copy button and dispatches literal text only on click at the current position',()=>{
    const h=harness([{id:'copy',label:'Copy <text>',kind:'copy',copyTemplate:'{videoTitle}\n{videoId} @{currentTime}'}]);
    try{
      const a=h.menu(),b=h.menu(),calls=[],opened=[];
      h.win.open=(...args)=>opened.push(args);
      a.update(video());b.update(video());
      a._view.addEventListener('command',e=>calls.push(e.detail));
      const row=a._customRelatedItems.querySelector('[data-related-order-key="link:copy"]');
      assert(row);assert(row.querySelector('button'));
      assert.strictEqual(row.querySelector('a'),null);
      assert.strictEqual(calls.length,0);
      h.player.currentTime=92.9;row.querySelector('button').click();
      const cmd=calls.find(x=>x.command==='copy-related-text');assert(cmd);
      assert.strictEqual(cmd.param,'Test & Japanese 日本語\nsm9 @92');
      assert.strictEqual(opened.length,0);
    }finally{h.dom.window.close();}
  });
  it('disables copy items requiring unavailable metadata',()=>{
    const h=harness([{id:'copy',label:'Copy',kind:'copy',copyTemplate:'{uploaderChannelId}'}]);
    try{
      const m=h.menu();m.update(video());
      const button=m._customRelatedItems.querySelector('[data-related-order-key="link:copy"] button');
      assert(button);assert.strictEqual(button.disabled,true);
    }finally{h.dom.window.close();}
  });
});

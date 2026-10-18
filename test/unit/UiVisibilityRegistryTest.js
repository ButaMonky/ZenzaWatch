'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read}=require('../helpers/extractSource');
const Registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',createContext({}));
const settings=()=>Registry.ITEMS;
describe('Task318 centralized visibility manifest',()=>{
  it('restores Task390 icons for existing items while keeping only seven new Task391 SVG names',()=>{
    const expected={
      'ui.bar.fullscreen':'⛶',
      'ui.bar.settings':'⚙',
      'ui.header.search':'⌕'
    };
    for(const [key,icon] of Object.entries(expected)){
      assert.strictEqual(Registry.get(key).icon,icon,'Do not redesign pre-existing icon '+key);
    }
    assert.deepStrictEqual(Array.from(Registry.SHARED_SETTINGS.map(([id,icon])=>[id,icon])),[
      ['showComment','comments-video'],['enableCommentPanel','comments-list'],
      ['enableCommentPreview','comments-preview'],['enableHeatMap','comment-heatmap'],
      ['enableStoryboard','seek-thumbnail'],['enableStoryboardBar','scene-filmstrip'],
      ['enableAdDecoration','ad-crown'],
      ['sceneSearch.enabled','seek-thumbnail'],
      ['sceneSearch.commentPreviewVisible','comments-preview'],
      ['sceneSearch.miniCommentVisible','comments-video'],
      ['sceneSearch.commentListVisible','comments-list']
    ]);
  });
  it('uses unique stable keys, a known scope and one configurable icon per UI item',()=>{
    assert(Registry.assertValidManifest());
    const keys=Array.from(settings(),item=>item.key);
    assert.strictEqual(new Set(keys).size,keys.length);
    assert(keys.length>=30);
    assert.deepStrictEqual(Array.from(Object.keys(Registry.defaults())),keys);
    assert(Object.values(Registry.defaults()).every(value=>value===true));
    assert(settings().every(item=>['hover','bar','info','header','related','comment','scene'].includes(item.scope)));
    assert.strictEqual(settings().filter(item=>item.scope==='scene').length,7,
      'all seven new scene controls remain independently hideable');
  });
  it('keeps essential play/seek/close controls while allowing recoverable buttons to hide',()=>{
    const selectors=settings().map(item=>item.selector).join(',');
    for(const protectedSelector of ['.togglePlay','.seekBarContainer',
      '.closeButton','.reloadMenu','.togglePlayMenu']){
      assert(!selectors.split(',').map(x=>x.trim()).includes(protectedSelector),protectedSelector);
    }
    for(const [key,scope,selector] of [
      ['ui.bar.fullscreen','bar','.fullscreenSwitch'],
      ['ui.bar.settings','bar','.settingPanelSwitch'],
      ['ui.header.search','header','.zenzaVideoSearchPanel']
    ]){
      const entry=Registry.get(key);
      assert(entry,key);
      assert.strictEqual(entry.scope,scope);
      assert.strictEqual(entry.selector,selector);
      assert(entry.description.includes('上級者設定') || entry.description.includes('検索'),
        'The recovery path must be described: '+key);
    }
    assert.strictEqual(settings().filter(item=>item.scope!=='scene').length,37,
      'preserve the original thirty-seven visibility settings');
    assert.strictEqual(settings().filter(item=>item.scope==='scene').length,7);
  });
  it('hides each newly optional control and restores original state without losing content',()=>{
    const dom=new JSDOM('<!doctype html><html><body>'+
      '<div id="bar"><div class="fullscreenSwitch"></div>'+
      '<div class="settingPanelSwitch" style="display:inline-flex"></div>'+
      '<button class="togglePlay">▶</button><div class="seekBarContainer"></div>'+
      '<button class="closeButton">×</button></div>'+
      '<div id="header"><div class="zenzaVideoSearchPanel">'+
      '<input class="searchWordInput" value="sm9"></div></div></body></html>');
    const bar=dom.window.document.querySelector('#bar');
    const header=dom.window.document.querySelector('#header');
    const values=Object.fromEntries(['ui.bar.fullscreen','ui.bar.settings',
      'ui.header.search'].map(key=>[key,false]));
    const config={getValue:key=>values[key]};
    for(const key of Object.keys(values)){
      Registry.apply(config,key==='ui.header.search'?header:bar,key);
    }
    for(const sel of ['.fullscreenSwitch','.settingPanelSwitch','.zenzaVideoSearchPanel']){
      const el=dom.window.document.querySelector(sel);
      assert(el.hidden && el.style.display==='none',sel);
    }
    for(const sel of ['.togglePlay','.seekBarContainer','.closeButton']){
      assert.strictEqual(dom.window.document.querySelector(sel).hidden,false,sel);
    }
    assert.strictEqual(header.querySelector('input').value,'sm9');
    for(const key of Object.keys(values)){
      values[key]=true;
      Registry.apply(config,key==='ui.header.search'?header:bar,key);
    }
    assert.strictEqual(bar.querySelector('.settingPanelSwitch').style.display,'inline-flex');
    assert.strictEqual(header.querySelector('.searchWordInput').value,'sm9');
    assert(!header.querySelector('.zenzaVideoSearchPanel').hidden);
    dom.window.close();
  });
  it('hides multiple matching DOM nodes and restores their prior inline display',()=>{
    const dom=new JSDOM('<!doctype html><body><div id="scope">'+
      '<div class="videoServerTypeMenu"></div>'+
      '<div class="videoServerTypeMenu" style="display:inline-flex"></div>'+
      '<button class="togglePlay">Play</button></div>');
    const root=dom.window.document.getElementById('scope');
    const settings={'ui.bar.quality':false};
    const config={getValue:key=>settings[key]};
    assert.strictEqual(Registry.apply(config,root,'ui.bar.quality'),2);
    const buttons=[...root.querySelectorAll('.videoServerTypeMenu')];
    assert(buttons.every(node=>node.hidden && node.style.display==='none'));
    assert(buttons.every(node=>node.style.getPropertyPriority('display')==='important'));
    assert(!root.querySelector('.togglePlay').hidden);
    settings['ui.bar.quality']=true;
    assert.strictEqual(Registry.apply(config,root,'ui.bar.quality'),2);
    assert.strictEqual(buttons[0].style.display,'');
    assert.strictEqual(buttons[1].style.display,'inline-flex');
    assert(buttons.every(node=>!node.hidden));
    dom.window.close();
  });
  it('retains pre-existing hidden state when a visibility preference is toggled',()=>{
    const dom=new JSDOM('<!doctype html><body><div class="videoTime" hidden></div>');
    const element=dom.window.document.querySelector('.videoTime');
    const config={getValue:()=>false};
    Registry.apply(config,element,'ui.bar.time');
    config.getValue=()=>true;
    Registry.apply(config,element,'ui.bar.time');
    assert(element.hidden);
    dom.window.close();
  });
  it('connects Config events per owner/scope and supports future refresh',()=>{
    const dom=new JSDOM('<!doctype html><body><section id="bar">'+
      '<div class="loopSwitch"></div></section>');
    const root=dom.window.document.getElementById('bar');
    const values={'ui.bar.loop':false};
    const handlers=new Map();
    const config={getValue:k=>values[k]??true,
      onkey(k,fn){handlers.set(k,fn);}};
    const connection=Registry.connect(config,root,'bar');
    assert(root.querySelector('.loopSwitch').hidden);
    assert.strictEqual(handlers.size,Registry.list('bar').length);
    values['ui.bar.loop']=true;
    handlers.get('ui.bar.loop')();
    assert(!root.querySelector('.loopSwitch').hidden);
    root.insertAdjacentHTML('beforeend','<div class="nextVideo"></div>');
    values['ui.bar.next']=false;
    connection.refresh();
    assert(root.querySelector('.nextVideo').hidden);
    dom.window.close();
  });
  it('syncs independent saved visibility changes in the same or other tabs',async()=>{
    const dom=new JSDOM('<!doctype html><html><body>'+
      '<div id="bar"><button class="fullscreenSwitch"></button>'+
      '<button class="settingPanelSwitch"></button></div>'+
      '<div id="header"><div class="zenzaVideoSearchPanel"><input value="sm9"></div></div>'+
      '</body></html>',{url:'https://www.nicovideo.jp/my'});
    const win=dom.window;
    const root=win.document.getElementById('bar');
    const header=win.document.getElementById('header');
    const defaults=Registry.defaults();
    const values={...defaults};
    const listeners=new Map();
    const config={
      default:defaults,storage:win.localStorage,
      getStorageKey:key=>'ZenzaWatch_'+key,
      getValue:key=>values[key],
      onkey(key,cb){listeners.set(key,cb);},
      offkey(key,cb){if(listeners.get(key)===cb)listeners.delete(key);},
      async refresh(key,otherStorage=this.storage){
        const saved=otherStorage[this.getStorageKey(key)];
        if(saved!==undefined){values[key]=JSON.parse(saved);}
      }
    };
    const bar=Registry.connect(config,root,'bar');
    const search=Registry.connect(config,header,'header');
    const write=(key,value)=>win.localStorage.setItem(config.getStorageKey(key),JSON.stringify(value));
    write('ui.bar.fullscreen',false);
    write('ui.header.search',false);
    win.dispatchEvent(new win.CustomEvent('ZenzaWatch-advanced-settings-saved',{
      detail:{keys:['ui.bar.fullscreen','ui.header.search']}}));
    await Promise.resolve();await Promise.resolve();
    assert(root.querySelector('.fullscreenSwitch').hidden);
    assert(header.querySelector('.zenzaVideoSearchPanel').hidden);
    write('ui.bar.settings',false);
    win.dispatchEvent(new win.StorageEvent('storage',{
      key:config.getStorageKey('ui.bar.settings'),
      newValue:'false',storageArea:win.localStorage}));
    await Promise.resolve();await Promise.resolve();
    assert(root.querySelector('.settingPanelSwitch').hidden);
    win.localStorage.removeItem(config.getStorageKey('ui.bar.settings'));
    win.dispatchEvent(new win.StorageEvent('storage',{
      key:config.getStorageKey('ui.bar.settings'),
      newValue:null,storageArea:win.localStorage}));
    await Promise.resolve();await Promise.resolve();
    assert(!root.querySelector('.settingPanelSwitch').hidden,'deletion restores the default');
    bar.dispose();search.dispose();
    write('ui.bar.fullscreen',true);
    win.dispatchEvent(new win.CustomEvent('ZenzaWatch-advanced-settings-saved',{
      detail:{keys:['ui.bar.fullscreen']}}));
    await Promise.resolve();await Promise.resolve();
    assert(root.querySelector('.fullscreenSwitch').hidden,'disposed owner ignores future events');
    dom.window.close();
  });
  it('unsubscribes its own observers without touching unrelated handlers',()=>{
    const dom=new JSDOM('<!doctype html><body><div class="loopSwitch"></div>');
    const handlers=new Map();
    const config={getValue:()=>true,
      onkey(key,fn){handlers.set(key,fn);},
      offkey(key,fn){assert.strictEqual(handlers.get(key),fn);handlers.delete(key);}};
    const owner=Registry.connect(config,dom.window.document.body,'bar');
    assert.strictEqual(handlers.size,Registry.list('bar').length);
    owner.dispose();
    assert.strictEqual(handlers.size,0);
    assert.strictEqual(owner.apply('ui.info.owner'),0);
    dom.window.close();
  });
  it('lists each configured selector in the actual owner template',()=>{
    const owners={
      hover:read('src/NicoVideoPlayerDialog.js'),
      bar:read('src/VideoControlBar.js'),
      info:read('src/VideoInfoPanel.js'),
      header:read('src/VideoInfoPanel.js'),
      related:read('src/VideoInfoPanel.js'),
      comment:read('src/CommentInputPanel.js'),
      scene:[
        read('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js'),
        read('packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js'),
        read('packages/zenza/src/sceneSearch/SceneSeekStepControl.js')
      ].join('\n')
    };
    for(const entry of settings()){
      for(const selector of entry.selector.split(',')){
        const segments=selector.match(/\.[a-zA-Z][a-zA-Z0-9-]*/g)||[];
        assert(segments.length>0,entry.key);
        assert(owners[entry.scope].includes(segments.at(-1).slice(1)),
          'Missing selector in source: '+entry.key+' '+selector);
      }
    }
  });
});


describe('Task391 saved shared preference runtime sync',()=>{
  it('refreshes the real player DataStorage and notifies its existing consumers once',async()=>{
    const {beginSection,run}=require('../helpers/extractSource');
    const dom=new JSDOM('<!doctype html><body><div class="loopSwitch"></div></body>',{
      url:'https://www.nicovideo.jp/my'});
    const win=dom.window,store=win.localStorage;
    const c=createContext({window:win,document:win.document,localStorage:store,
      bounce:{time:fn=>fn},objUtil:{bridge:(dest,src)=>{
        for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(src))){
          if(typeof src[k]==='function'){dest[k]=src[k].bind(src);}
        }
      }}});
    run(beginSection('packages/lib/src/Emitter.js'),c);
    const DataStorage=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',c);
    const prefs=new DataStorage({showComment:true,enableHeatMap:true},
      {storage:store,prefix:'ZenzaWatch'});
    await prefs.promise('restore');
    const updates=[];prefs.on('update',(key,value)=>updates.push([key,value]));
    const owner=Registry.connect(prefs,win.document.body,'bar');
    store.setItem('ZenzaWatch_showComment','false');
    win.dispatchEvent(new win.CustomEvent('ZenzaWatch-advanced-settings-saved',{
      detail:{keys:['showComment']}}));
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.strictEqual(prefs.getValue('showComment'),false);
    assert.deepStrictEqual(updates,[['showComment',false]]);
    win.dispatchEvent(new win.CustomEvent('ZenzaWatch-advanced-settings-saved',{
      detail:{keys:['showComment']}}));
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.strictEqual(updates.length,1,'unchanged saves do not duplicate notifications');
    store.setItem('ZenzaWatch_enableHeatMap','false');
    win.dispatchEvent(new win.StorageEvent('storage',{
      key:'ZenzaWatch_enableHeatMap',newValue:'false',storageArea:store}));
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.deepStrictEqual(updates,[['showComment',false],['enableHeatMap',false]]);
    assert.strictEqual(store.getItem('ZenzaWatch_enableHeatMap'),'false');
    owner.dispose();dom.window.close();
  });
});


describe('Task396 saved shortcut preference synchronization',()=>{
  it('notifies the current player of saved numeric keys without rewriting storage',async()=>{
    const {beginSection,run}=require('../helpers/extractSource');
    const dom=new JSDOM('<!doctype html><body></body>',{url:'https://www.nicovideo.jp/my'});
    const win=dom.window,store=win.localStorage;
    const c=createContext({window:win,document:win.document,localStorage:store,
      bounce:{time:fn=>fn},objUtil:{bridge:(dest,src)=>{
        for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(src))){
          if(typeof src[k]==='function'){dest[k]=src[k].bind(src);}
        }
      }}});
    run(beginSection('packages/lib/src/Emitter.js'),c);
    const DataStorage=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',c);
    const prefs=new DataStorage({KEY_OPEN_GINZA:0,PARAM_CUSTOM_SEEK_1:0},
      {storage:store,prefix:'ZenzaWatch'});
    await prefs.promise('restore');
    const updates=[];prefs.on('update',(key,value)=>updates.push([key,value]));
    const owner=Registry.connect(prefs,win.document.body,'bar');
    try{
      store.setItem('ZenzaWatch_KEY_OPEN_GINZA','71');
      store.setItem('ZenzaWatch_PARAM_CUSTOM_SEEK_1','-3');
      win.dispatchEvent(new win.CustomEvent('ZenzaWatch-advanced-settings-saved',{
        detail:{keys:['KEY_OPEN_GINZA','PARAM_CUSTOM_SEEK_1']}}));
      await new Promise(resolve=>setTimeout(resolve,20));
      assert.strictEqual(prefs.getValue('KEY_OPEN_GINZA'),71);
      assert.strictEqual(prefs.getValue('PARAM_CUSTOM_SEEK_1'),-3);
      assert.deepStrictEqual(updates,[['KEY_OPEN_GINZA',71],['PARAM_CUSTOM_SEEK_1',-3]]);
      win.dispatchEvent(new win.CustomEvent('ZenzaWatch-advanced-settings-saved',{
        detail:{keys:['KEY_OPEN_GINZA']}}));
      await new Promise(resolve=>setTimeout(resolve,20));
      assert.strictEqual(updates.length,2);
      store.removeItem('ZenzaWatch_KEY_OPEN_GINZA');
      win.dispatchEvent(new win.StorageEvent('storage',{
        key:'ZenzaWatch_KEY_OPEN_GINZA',newValue:null,storageArea:store}));
      await new Promise(resolve=>setTimeout(resolve,20));
      assert.strictEqual(prefs.getValue('KEY_OPEN_GINZA'),0);
      assert.strictEqual(store.getItem('ZenzaWatch_KEY_OPEN_GINZA'),null);
      assert.deepStrictEqual(updates[2],['KEY_OPEN_GINZA',0]);
    }finally{owner.dispose();dom.window.close();}
  });
});

'use strict';
const assert=require('assert');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const {createContext,beginSection,read,run}=require('../helpers/extractSource');

function loadOfficialRoute(){
  const c=createContext({URL});
  run(beginSection('packages/zenza/src/menu/OfficialPlayerRoute.js')+
    '\nthis.officialRoute=OfficialPlayerRoute;',c);
  return c.officialRoute;
}
function loadGinzaOverride(){
  const source=read('src/initializer.js');
  let init=null;
  traverse(parser.parse(source,{sourceType:'module'}),{
    VariableDeclarator(p){
      if(p.node.id.name==='overrideGinza' && !init){
        init=source.slice(p.node.init.start,p.node.init.end);
      }
    }
  });
  assert(init,'Must extract real initialized watch-page override implementation');
  const calls=[];
  const playingVideo={addEventListener(){},pause(){}};
  const c=createContext({
    window:{name:''},Config:{props:{overrideGinza:true}},
    initializeGinzaSlayer(dialog,query){calls.push({dialog,query});},
    OfficialPlayerRoute:loadOfficialRoute(),
    uq:{complete:()=>Promise.resolve()},
    document:{
      body:{classList:{contains:()=>false}},
      querySelector(selector){
        return selector.includes('video')?playingVideo:null;
      }
    }
  });
  run('this.overrideGinza = '+init+';',c);
  return {fn:c.overrideGinza,calls,window:c.window};
}

describe('Task350 official NicoNico player routing',()=>{
  it('builds a watch URL with an explicit one-time official-player route marker',()=>{
    const util=loadOfficialRoute();
    const result=util.makeUrl('sm9');
    const url=new URL(result);
    assert.strictEqual(url.origin,'https://www.nicovideo.jp');
    assert.strictEqual(url.pathname,'/watch/sm9');
    assert.strictEqual(url.searchParams.get('zenza_official'),'1');
    assert.strictEqual(util.makeUrl('so123?x=1').includes('?x=1'),false);
  });
  it('skips Zenza replacement when marker is set even if window.name was lost',async()=>{
    const test=loadGinzaOverride();
    assert.strictEqual(test.window.name,'');
    await test.fn({}, {zenza_official:'1'});
    assert.strictEqual(test.calls.length,0);
    assert.strictEqual(test.window.name,'');
  });
  it('bypasses Zenza early in the official request before boot',()=>{
    const template=read('src/_template.js');
    const guard=template.indexOf("new URLSearchParams(location.search).get('zenza_official')");
    const monkey=template.indexOf('const monkey = async');
    assert(guard>0 && monkey>guard);
    assert(template.includes('*?*zenza_official=1*'));
    assert(template.includes("window.name === 'watchGinza'"));
  });
  it('keeps replacing watch pages without the marker when enabled',async()=>{
    const test=loadGinzaOverride();
    await test.fn({}, {zenza_official:'0'});
    assert.strictEqual(test.calls.length,1);
  });
  it('preserves the existing watchGinza window-name fallback',async()=>{
    const test=loadGinzaOverride();
    test.window.name='watchGinza';
    await test.fn({}, {});
    assert.strictEqual(test.calls.length,0);
    assert.strictEqual(test.window.name,'');
  });
  it('opens the related-menu official link as a native new-tab anchor without page reload',()=>{
    const {JSDOM}=require('jsdom');
    const {loadClass}=require('../helpers/extractSource');
    const dom=new JSDOM('<!doctype html><html><body><details><summary>関連メニュー</summary>'+
      '<div class="RelatedInfoMenuBody"></div><ul class="relatedMenuItems">'+
      '<li data-related-order-key="builtin:official"><a class="ginzaLink command" target="_blank" rel="noopener noreferrer">公式プレイヤーで開く</a></li>'+
      '</ul></details></body></html>',{url:'https://www.nicovideo.jp/watch/sm9'});
    const root=dom.window.document.querySelector('details');
    let time=100.8,pauses=0,closed=0,wasPrevented=null;
    const ctx=createContext({
      document:dom.window.document,window:dom.window,
      navigator:{userAgent:'test'},_:{debounce:fn=>fn},
      ClassList:()=>({toggle(){}}),Config:{onkey(){}},
      RelatedMenuActions:{onChange:()=>()=>{},CONFIG_KEY:'relatedMenu.customLinks'},
      RelatedMenuOrder:{CONFIG_KEY:'relatedMenu.order',HIDDEN_KEY:'relatedMenu.hiddenItems'},
      UiVisibilityRegistry:{connect:()=>({})},
      OfficialPlayerRoute:loadOfficialRoute(),
      BaseViewComponent:class {
        _initDom(){}
        _onCommand(cmd){if(cmd==='pause'){pauses++;}}
      }
    });
    const Menu=loadClass('src/VideoInfoPanel.js','RelatedInfoMenu',ctx);
    const menu=Object.create(Menu.prototype);
    Object.assign(menu,{
      _view:root,_shadow:root,_elm:{},_bound:{_onBodyClick:()=>{}},
      _currentWatchId:'sm9',_relatedContext:()=>({currentTime:time}),
      _onBodyClick(){closed++;},emit(){}
    });
    Menu.prototype._initDom.call(menu);
    const link=root.querySelector('.ginzaLink');
    root.addEventListener('click',e=>{
      wasPrevented=e.defaultPrevented;
      e.preventDefault(); // The test never navigates to a live website.
    });
    link.click();
    const uri=new URL(link.href);
    assert.strictEqual(wasPrevented,false);
    assert.strictEqual(uri.searchParams.get('from'),'100');
    assert.strictEqual(uri.searchParams.get('zenza_official'),'1');
    assert.strictEqual(link.target,'_blank');
    assert(link.rel.includes('noopener'));
    assert.strictEqual(pauses,1);
    assert.strictEqual(closed,1);
    dom.window.close();
  });
  it('uses the same official URL builder for both RelatedInfoMenu and player action',()=>{
    const menu=read('src/VideoInfoPanel.js');
    const dialog=read('src/NicoVideoPlayerDialog.js');
    assert(menu.includes("this._ginzaLink.setAttribute('href', OfficialPlayerRoute.makeUrl(wid))"));
    assert(dialog.includes('OfficialPlayerRoute.makeUrl(this._watchId,this.currentTime)'));
    assert(menu.includes("window.open(officialUrl, '_blank', 'noopener')"));
    assert(menu.includes('class="ginzaLink command" target="_blank"'));
    assert(!menu.includes('rel="noopener" data-command="watch-ginza"'));
    assert(dialog.includes("'_blank', 'noopener'"));
  });
});

describe('Task350 related menu actual command path',()=>{
  it('updates the official link URL and opens the route in a named tab',()=>{
    const {loadClass}=require('../helpers/extractSource');
    const ctx=createContext({
      OfficialPlayerRoute:loadOfficialRoute(),
      window:{open(url,name,features){opened.push([url,name,features]);}},
      BaseViewComponent:class {
        _onCommand(command){otherCommands.push(command);}
      }
    });
    const opened=[],otherCommands=[],emitted=[];
    const Menu=loadClass('src/VideoInfoPanel.js','RelatedInfoMenu',ctx);
    const a={href:'',setAttribute(name,value){if(name==='href')this.href=value;}};
    const entry=()=>({setAttribute(){}});
    const view={open:true};
    const fake={
      _shadow:view,
      _ginzaLink:a,_originalLink:entry(),_twitterLink:entry(),
      _parentVideoLink:entry(),_renderCustomMenu(){},
      setState(){},emit(value){emitted.push(value)}
    };
    Menu.prototype.update.call(fake,{
      watchId:'sm9',videoId:'sm9',canOpenContentTree:false,
      isCommunityVideo:false,isMymemory:false
    });
    assert.strictEqual(new URL(a.href).searchParams.get('zenza_official'),'1');
    Menu.prototype._onCommand.call(fake,'watch-ginza');
    assert.deepStrictEqual(opened,[[a.href,'_blank','noopener']]);
    assert.deepStrictEqual(otherCommands,['pause']);
    assert.strictEqual(view.open,false);
  });
});

describe('Task350 official seek seconds forwarding',()=>{
  it('adds ?from=100 at 100.9 seconds and retains explicit Zenza bypass',()=>{
    const uri=new URL(loadOfficialRoute().makeUrl('sm9',100.9));
    assert.strictEqual(uri.searchParams.get('from'),'100');
    assert.strictEqual(uri.searchParams.get('zenza_official'),'1');
    assert.strictEqual(uri.pathname,'/watch/sm9');
  });
  it('omits invalid and zero offsets to preserve existing behavior',()=>{
    const route=loadOfficialRoute();
    for(const time of [0,-10,NaN,Infinity,undefined,null,'not-a-number']){
      assert.strictEqual(new URL(route.makeUrl('sm9',time)).searchParams.has('from'),
        false,'time='+String(time));
    }
  });
  it('uses the current time in related-menu and player command routes',()=>{
    const src=read('src/VideoInfoPanel.js');
    const dialog=read('src/NicoVideoPlayerDialog.js');
    assert(src.includes('OfficialPlayerRoute.makeUrl(this._currentWatchId,currentTime)'));
    assert(dialog.includes('OfficialPlayerRoute.makeUrl(this._watchId,this.currentTime)'));
    assert(src.includes('this._relatedContext().currentTime'));
  });
  it('updates the URL on click using latest context time',()=>{
    const {loadClass}=require('../helpers/extractSource');
    const out=[],ctx=createContext({
      OfficialPlayerRoute:loadOfficialRoute(),
      window:{open(url,target){out.push([url,target])}},
      BaseViewComponent:class{_onCommand(){}}
    });
    const Menu=loadClass('src/VideoInfoPanel.js','RelatedInfoMenu',ctx);
    let time=12.1;
    const el={href:''};
    const fake={
      _shadow:{open:true},_ginzaLink:el,_currentWatchId:'sm9',
      _relatedContext(){return {currentTime:time}},
      emit(){}
    };
    Menu.prototype._onCommand.call(fake,'watch-ginza');
    assert.strictEqual(new URL(out[0][0]).searchParams.get('from'),'12');
    time=109.9;
    Menu.prototype._onCommand.call(fake,'watch-ginza');
    assert.strictEqual(new URL(out[1][0]).searchParams.get('from'),'109');
    assert.strictEqual(el.href,out[1][0]);
    assert.strictEqual(out[1][1],'_blank');
  });
});

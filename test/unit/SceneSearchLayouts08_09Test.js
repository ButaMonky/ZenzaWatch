'use strict';
// Task485: isolated 08/09 layout contract tests without touching other owners.
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {loadClass,createContext,run,beginSection}=require('../helpers/extractSource');

function setup(width=900){
  const errors=[],virtualConsole=new VirtualConsole();
  virtualConsole.on('jsdomError',error=>errors.push(error.message));
  const dom=new JSDOM('<!doctype html><html><head></head><body>'+
    '<div id="player" style="position:relative">'+
    '<div id="host" style="position:relative"></div></div>'+
    '</body></html>',{virtualConsole});
  const d=dom.window.document;
  const ctx=createContext({document:d});
  const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
    'SceneSearchLayoutCard',ctx);
  const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
    'SceneSearchLayoutRegistry',ctx);
  const Layouts=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts08_09.js',
    'SceneSearchLayouts08_09',ctx);
  const registry=new Registry();
  Layouts.install(registry,Card);
  const host=d.getElementById('host'),actions=[];
  let frameWidth=width;
  host.getBoundingClientRect=()=>({
    x:0,y:0,left:0,top:0,right:frameWidth,bottom:520,
    width:frameWidth,height:520
  });
  const state={shown:true,pinned:false,time:71,seekStepSeconds:5,
    commentPreviewVisible:true};
  return {dom,d,host,registry,actions,errors,state,
    width:value=>{frameWidth=value;},
    create:(id,mode='normal')=>registry.create({id,mode,document:d,
      container:host,onAction:(action,info,event)=>actions.push([action,info,event]),
      settings:{}}),
    close:()=>dom.window.close()
  };
}
describe('SCUI-16 layouts 08 edge drawer and 09 separated remote',()=>{
  it('registers precisely IDs 08 and 09 with explicit unique labels',()=>{
    const h=setup();
    assert.deepStrictEqual(Array.from(h.registry.list(),item=>item.id),['08','09']);
    assert.match(h.registry.get('08').label,/引き出し/);
    assert.match(h.registry.get('09').label,/リモコン/);
    assert.throws(()=>h.registry.create({id:'11',mode:'normal',
      document:h.d,container:h.host}),/not registered/);
    h.close();
  });
  for(const id of ['08','09']){
    for(const mode of ['normal','fullscreen']){
      it('mounts '+id+'/'+mode+' once, shares buttons and removes all owners',()=>{
        const h=setup();
        const card=h.create(id,mode);
        card.mount(h.state);
        assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,1);
        assert.strictEqual(h.d.querySelectorAll('style[data-scui-layout-style]').length,1);
        assert.strictEqual(card.root.dataset.layout,id);
        assert.strictEqual(card.root.dataset.mode,mode);
        assert.strictEqual(card.root.querySelectorAll('.zenzaSceneImageBox').length,1);
        assert.strictEqual(card.root.querySelectorAll('[data-scui-action]').length,7);
        assert.strictEqual(card.root.querySelector('.zenzaSceneTime').textContent,'1:11');
        assert.strictEqual(card.root.dataset.scuiSide,'right');
        card.root.querySelector('[data-scui-action="seek-forward"]').click();
        assert.deepStrictEqual(h.actions.map(x=>x[0]),['seek-forward']);
        const style=h.d.querySelector('style').textContent;
        assert(style.includes('.zenzaSceneEdgeDrawer'));
        assert(style.includes('.zenzaSceneDetachedRemote'));
        assert(style.includes('prefers-reduced-motion:reduce'));
        assert(style.includes('zenza-control-bar-height'));
        if(id==='08'){
          const handle=card.root.querySelector('.scene-more');
          const buttons=card.root.querySelector('.zenzaSceneActions');
          assert.strictEqual(handle.parentElement.className,'zenzaSceneFoot');
          assert(!buttons.contains(handle),
            'drawer handle remains outside the invisible controls');
          handle.click();
          assert.strictEqual(card.root.classList.contains('is-expanded'),true);
          handle.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{
            key:'Escape',bubbles:true
          }));
          assert.strictEqual(card.root.classList.contains('is-expanded'),false);
        }else{
          assert.strictEqual(card.root.querySelectorAll('.zenzaSceneRemoteControls').length,1);
          assert(card.root.querySelector('[role="toolbar"]').contains(
            card.root.querySelector('.scene-seek-forward')));
        }
        card.dispose();
        card.dispose();
        assert.strictEqual(h.host.children.length,0);
        assert.strictEqual(h.d.querySelectorAll('style').length,0);
        assert.strictEqual(h.errors.length,0,h.errors.join(';'));
        assert.throws(()=>card.mount(h.state),/disposed/);
        h.close();
      });
    }
    it('uses 0-second compact state without leaving invisible seek hitboxes: '+id,()=>{
      const h=setup(360);
      const c=h.create(id);c.mount({...h.state,seekStepSeconds:0});
      assert(c.root.classList.contains('is-compact'));
      for(const action of ['seek-back','seek-forward']){
        const b=c.root.querySelector('[data-scui-action="'+action+'"]');
        assert.strictEqual(b.hidden,true);
        assert.strictEqual(b.disabled,true);
        assert.strictEqual(b.style.display,'none');
      }
      c.render({...h.state,seekStepSeconds:15,pinned:true});
      assert.strictEqual(c.root.classList.contains('is-pinned'),true);
      assert.strictEqual(c.root.querySelector('.scene-seek-back').hidden,false);
      c.onPreview({imageUrl:'https://img.example.invalid/thumb.jpg'});
      assert.strictEqual(c.root.querySelector('.zenzaSceneImage').hidden,false);
      c.dispose();h.close();
    });
    it('chooses an available side when the cursor placement nears the edge: '+id,()=>{
      const h=setup(900);
      const c=h.create(id);c.mount(h.state);
      c.root.style.setProperty('--scene-x','860px');
      c.render(h.state);
      assert.strictEqual(c.root.dataset.scuiSide,'left');
      h.width(320);c.render(h.state);
      assert.strictEqual(c.root.dataset.scuiSide,'stack',
        'when neither side fits, controls must stack under the preview');
      assert(parseFloat(c.root.style.getPropertyValue('--scene-x'))<=320,
        'clamp the card center within the narrow video frame');
      h.width(470);c.render(h.state);
      assert.strictEqual(c.root.dataset.scuiSide,id==='09'?'stack':'right',
        'medium-width video must use an available side or stack controls');
      assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,1);
      c.dispose();h.close();
    });
  }
  it('validates provider inputs and rejects duplicate registration',()=>{
    const h=setup();
    const Provider=loadClass(
      'packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts08_09.js',
      'SceneSearchLayouts08_09',createContext());
    assert.throws(()=>Provider.install({},null),/require/i);
    assert.throws(()=>Provider.install(h.registry,()=>{}),/duplicate/i);
    h.close();
  });
  it('never installs global timer/observer or listener on another owner',()=>{
    const h=setup(),before=h.d.querySelectorAll('[data-scui-layout-style]').length;
    const c=h.create('09');c.mount(h.state);
    for(let i=0;i<150;i++){c.render({...h.state,time:i,shown:i%2===0});}
    assert.strictEqual(h.d.querySelectorAll('style[data-scui-layout-style]').length,before+1);
    assert.strictEqual(h.host.children.length,1);
    c.dispose();
    assert.strictEqual(h.host.children.length,0);
    h.close();
  });
});

describe('SCUI-18 strict catalog with the real 08/09 implementation',()=>{
  it('registers and mounts all ten REAL layouts across both modes',()=>{
    const dom=new JSDOM('<!doctype html><html><head></head><body>'+
      '<div id="host" style="position:relative"></div></body></html>');
    const d=dom.window.document;
    const ctx=createContext({document:d});
    run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js'),ctx);
    run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js'),ctx);
    run('globalThis.Card=SceneSearchLayoutCard;globalThis.Registry=SceneSearchLayoutRegistry;',ctx);
    run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayouts01_02.js')+
      ';globalThis.registerClassic=registerSceneLayouts01_02;',ctx);
    const cls=(file,name)=>loadClass(file,name,ctx);
    const opts={
      Card:ctx.Card,registerClassic:ctx.registerClassic,
      SideShelf:cls('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts03_04.js',
        'SceneSearchLayouts03_04'),
      PlaybackDeck:cls('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts05_06.js',
        'SceneSearchLayouts05_06'),
      Filmstrip:cls('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout07.js',
        'SceneSearchLayout07'),
      Drawer:cls('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts08_09.js',
        'SceneSearchLayouts08_09'),
      SmartAvoid:cls('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout10.js',
        'SceneSearchLayout10'),
      clock:{now:()=>500}
    };
    const Catalog=cls('packages/zenza/src/sceneSearch/SceneSearchLayoutCatalog.js',
      'SceneSearchLayoutCatalog');
    const registry=new ctx.Registry(),host=d.getElementById('host');
    host.getBoundingClientRect=()=>({
      x:0,y:0,left:0,top:0,right:900,bottom:540,width:900,height:540
    });
    const installed=Catalog.install(registry,opts);
    assert.strictEqual(installed.complete,true);
    assert.deepStrictEqual(Array.from(installed.registered),[
      '01','02','03','04','05','06','07','08','09','10'
    ]);
    for(const mode of ['normal','fullscreen']){
      for(const id of installed.registered){
        const item=registry.create({id,mode,document:d,container:host,
          settings:{duration:3600}});
        item.mount({shown:true,pinned:false,time:150,
          seekStepSeconds:5,commentPreviewVisible:true});
        assert.strictEqual(host.querySelectorAll('.zenzaSceneSearchHost').length,
          1,mode+'/'+id);
        item.render({shown:true,pinned:false,time:150,
          seekStepSeconds:0,commentPreviewVisible:true});
        assert.strictEqual(item.root.querySelector('.scene-seek-back').hidden,
          true,'zero seconds collapses '+mode+'/'+id);
        item.dispose();
        assert.strictEqual(host.children.length,0,'dispose '+mode+'/'+id);
        assert.strictEqual(d.querySelectorAll('style[data-scui-layout-style]').length,
          0,'style cleanup '+mode+'/'+id);
      }
    }
    dom.window.close();
  });
});

describe('SCUI-18 ten-layout bootstrap dependency boundary',()=>{
  it('creates all ten without mounting a player or creating DOM side effects',()=>{
    const dom=new JSDOM('<!doctype html><html><head></head><body>'+
      '<div id="host"></div></body></html>');
    const context=createContext({document:dom.window.document});
    const sources=[
      'SceneSearchLayoutCard.js',
      'SceneSearchLayoutRegistry.js',
      'SceneSearchLayoutCatalog.js',
      'SceneSearchLayouts01_02.js',
      'layouts/SceneSearchLayouts03_04.js',
      'layouts/SceneSearchLayouts05_06.js',
      'layouts/SceneSearchLayout07.js',
      'layouts/SceneSearchLayouts08_09.js',
      'layouts/SceneSearchLayout10.js',
      'SceneSearchLayoutBootstrap.js'
    ];
    for(const file of sources){
      run(beginSection('packages/zenza/src/sceneSearch/'+file),context);
    }
    run('globalThis.bootstrap=createSceneSearchLayoutRegistry;',context);
    const registry=context.bootstrap();
    assert.deepStrictEqual(Array.from(registry.list(),x=>x.id),[
      '01','02','03','04','05','06','07','08','09','10'
    ]);
    assert.strictEqual(dom.window.document.querySelectorAll('style').length,0,
      'bootstrap is lazy and does not write to the DOM');
    assert.strictEqual(dom.window.document.querySelectorAll('.zenzaSceneSearchHost').length,0);
    const host=dom.window.document.getElementById('host');
    host.getBoundingClientRect=()=>({
      x:0,y:0,width:900,height:500,left:0,top:0,right:900,bottom:500
    });
    const item=registry.create({id:'08',mode:'fullscreen',document:dom.window.document,
      container:host,onAction:()=>{}});
    item.mount({shown:true,pinned:false,seekStepSeconds:10,time:100});
    assert.strictEqual(host.children.length,1);
    item.dispose();
    assert.strictEqual(host.children.length,0);
    assert.strictEqual(dom.window.document.querySelectorAll('style').length,0);
    dom.window.close();
  });
});

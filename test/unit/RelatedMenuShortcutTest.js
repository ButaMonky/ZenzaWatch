'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,beginSection,run}=require('../helpers/extractSource');
const item=(id,key=0,url='https://example.com/{videoId}',newTab=true)=>({
  id,label:id,url,enabled:true,openInNewTab:newTab,shortcutKey:key
});
const actions=()=>loadClass('packages/zenza/src/menu/RelatedMenuActions.js',
  'RelatedMenuActions',createContext({URL}));

describe('Task316 custom related-menu shortcut runtime',()=>{
  it('round-trips optional key with existing link schema and rejects bad keys',()=>{
    const a=actions();
    assert.strictEqual(a.validateLinks([item('one',0x1004c)]).valid,true);
    assert.strictEqual(a.validateLinks([item('one',0x1004c)]).links[0].shortcutKey,0x1004c);
    assert.strictEqual(a.validateLinks([{
      id:'old',label:'旧設定',url:'https://example.org/{watchId}'
    }]).valid,true);
    assert.strictEqual(a.validateLinks([{
      id:'old',label:'旧設定',url:'https://example.org/{watchId}'
    }]).links[0].shortcutKey,undefined);
    for(const v of ['65',-1,1.5,NaN,Infinity,100000000]){
      assert.strictEqual(a.validateLinks([item('bad',v)]).valid,false,String(v));
    }
  });
  it('opens every matched valid URL while skipping disabled and missing owners',()=>{
    const a=actions();
    const links=[
      item('first',65,'https://example.com/{videoId}',true),
      item('missing',65,'https://example.com/user/{uploaderUserId}',true),
      {...item('disabled',65),enabled:false},
      item('second',65,'https://example.com/{watchId}',true)
    ];
    const opened=[];
    const count=a.openShortcutsByIds(links,['first','missing','disabled','second'],
      {videoId:'sm1',watchId:'sm1',uploaderUserId:''},
      (url,target)=>opened.push([url,target]));
    assert.strictEqual(count,2);
    assert.deepStrictEqual(opened,[
      ['https://example.com/sm1','_blank'],
      ['https://example.com/sm1','_blank']
    ]);
  });
  it('opens only the last current-tab link in _self when multiple links collide',()=>{
    const a=actions();
    const links=[
      item('one',65,'https://example.com/1',false),
      item('two',65,'https://example.com/2',false),
      item('three',65,'https://example.com/3',true)
    ];
    const opened=[];
    a.openShortcutsByIds(links,['one','two','three'],{},(url,target)=>
      opened.push([url,target]));
    assert.deepStrictEqual(opened,[
      ['https://example.com/1','_blank'],
      ['https://example.com/3','_blank'],
      ['https://example.com/2','_self']
    ]);
  });
  it('emits all custom link matches even when a legacy action has the same key',async()=>{
    const dom=new JSDOM('<!doctype html><html><body><input id="typing"></body></html>');
    const c=createContext({window:dom.window,document:dom.window.document});
    run(beginSection('packages/lib/src/Emitter.js'),c);
    run(beginSection('packages/zenza/src/ShortcutActions.js'),c);
    run(beginSection('packages/zenza/src/ShortcutKeyEmitter.js'),c);
    run([
      'globalThis.config = new Emitter(); config.props = {};',
      "SHORTCUT_ACTIONS.forEach(action => { config.props['KEY_' + action.id] = 0; });",
      'config.props.KEY_TOGGLE_PLAY = 65;',
      "config.props['relatedMenu.customLinks'] = [",
      "{id:'one',label:'one',url:'https://example.com/1',shortcutKey:65},",
      "{id:'two',label:'two',url:'https://example.com/2',shortcutKey:65}];",
      "globalThis.external = new Emitter(); external.emitResolve('init');",
      "globalThis.keys = ShortcutKeyEmitter.create(config, document.body, external);"
    ].join('\n'),c);
    const events=[];c.keys.on('keyDown',(name,e,param)=>
      events.push([name,Array.isArray(param)?Array.from(param):param]));
    await new Promise(resolve=>setImmediate(resolve));
    const dispatch=(target,opts={})=>
      target.dispatchEvent(new dom.window.KeyboardEvent('keydown',{
        bubbles:true,composed:true,cancelable:true,keyCode:65,...opts}));
    dispatch(dom.window.document.body);
    assert.deepStrictEqual(events,[
      ['RELATED_MENU_LINKS',['one','two']],['TOGGLE_PLAY','']
    ]);
    events.length=0;
    dispatch(dom.window.document.body,{repeat:true});
    assert.deepStrictEqual(events,[['TOGGLE_PLAY','']]);
    events.length=0;
    dispatch(dom.window.document.getElementById('typing'));
    assert.deepStrictEqual(events,[]);
    dom.window.close();
  });
  it('captures each link key in the editor and warns on duplicate without blocking save',()=>{
    const dom=new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
    const c=createContext({URL,document:dom.window.document});
    const a=loadClass('packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',c);
    const P=loadClass('src/RelatedMenuSettings.js','RelatedMenuSettings',c);
    const config={value:[item('one',65),item('two',0)],props:{KEY_TOGGLE_PLAY:65},
      getValue(){return this.value;},
      setValue(key,x){this.value=x;},
      on(){},off(){}};
    const shortcuts={
      actions:[{id:'TOGGLE_PLAY',label:'再生/停止'}],
      formatKeyCombo:k=>k?'key '+k:'未設定',
      encodeKeyCombo:e=>e.keyCode
    };
    const root=dom.window.document.getElementById('host');
    const panel=P.mount(root,{config,actions:a,shortcuts});
    root.querySelector('[data-rl-expand="1"]').click();
    const btn=root.querySelector('[data-rl-record="1"]');
    assert(btn,'record key button is available on each card');
    btn.click();
    const evt=new dom.window.KeyboardEvent('keydown',
      {keyCode:65,bubbles:true,cancelable:true});
    dom.window.document.dispatchEvent(evt);
    assert.strictEqual(evt.defaultPrevented,true);
    assert.match(root.querySelector('[data-rl-shortcut-warning]').textContent,/重複/);
    assert.strictEqual(root.querySelector('[data-rl-save]').disabled,false);
    root.querySelector('[data-rl-save]').click();
    assert.strictEqual(config.value[0].shortcutKey,65);
    assert.strictEqual(config.value[1].shortcutKey,65);
    panel.dispose();dom.window.close();
  });
});

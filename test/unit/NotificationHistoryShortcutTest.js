'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
describe('Task924 notification history settings and shortcut',()=>{
  it('exposes the visibility preference and unassigned shortcut in advanced settings',()=>{
    const c=createContext();
    run(beginSection('packages/zenza/src/ShortcutActions.js'),c);
    const registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
    const item=registry.descriptors().find(item=>item.id==='ui.bar.notificationHistory');
    assert(item,'advanced settings must expose notification button visibility');
    assert.strictEqual(item.type,'boolean');
    assert.strictEqual(item.visibilityScope,'bar');
    assert.strictEqual(registry.defaults()['ui.bar.notificationHistory'],true);
    const groups=run('groupShortcutActionsByCategory()',c);
    const actions=Array.from(groups).flatMap(group=>Array.from(group.actions))
      .filter(action=>action.id==='TOGGLE_NOTIFICATION_HISTORY');
    assert.strictEqual(actions.length,1,'advanced shortcut editor must show one notification action');
    assert.strictEqual(actions[0].command,'toggle-notificationHistory');
    assert.strictEqual(run('buildDefaultKeyConfig().KEY_TOGGLE_NOTIFICATION_HISTORY',c),0);
  });
  it('updates actual formatted hints while keeping a hidden notification button keyboard-accessible',async()=>{
    const dom=new JSDOM('<!doctype html><body><input id="edit">'+
      '<div class="videoControlBar"><button class="controlButton notificationHistorySwitch" '+
      'data-command="toggle-notificationHistory"><span class="tooltip">通知履歴</span></button></div>');
    const c=createContext({window:dom.window,document:dom.window.document});
    run(beginSection('packages/lib/src/Emitter.js'),c);
    run(beginSection('packages/zenza/src/ShortcutActions.js'),c);
    run(beginSection('packages/zenza/src/ShortcutKeyEmitter.js'),c);
    run(`globalThis.config=new Emitter();config.props=buildDefaultKeyConfig();
      config.props['ui.bar.notificationHistory']=false;
      config.getValue=key=>config.props[key];
      config.onkey=(key,fn)=>config.on('update-'+key,fn);
      config.offkey=(key,fn)=>config.off('update-'+key,fn);
      globalThis.external=new Emitter();external.emitResolve('init');
      globalThis.keys=ShortcutKeyEmitter.create(config,document.body,external);`,c);
    const registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
    const root=dom.window.document.querySelector('.videoControlBar');
    const button=root.querySelector('button'),tooltip=button.querySelector('.tooltip');
    const owner=registry.connect(c.config,root,'bar');
    const log=[];c.keys.on('keyDown',name=>log.push(name));
    await new Promise(resolve=>setImmediate(resolve));
    const press=(code,target=dom.window.document.body)=>target.dispatchEvent(
      new dom.window.KeyboardEvent('keydown',{keyCode:code,bubbles:true,cancelable:true}));
    const setKey=code=>{
      c.config.props.KEY_TOGGLE_NOTIFICATION_HISTORY=code;
      c.config.emit('update','KEY_TOGGLE_NOTIFICATION_HISTORY',code);
      c.config.emit('update-KEY_TOGGLE_NOTIFICATION_HISTORY',code);
    };
    try{
      assert(button.hidden);
      assert.strictEqual(tooltip.textContent,'通知履歴');
      press(78);assert.deepStrictEqual(log,[]);
      setKey(78);
      assert.strictEqual(tooltip.textContent,'通知履歴（N）');
      press(78,dom.window.document.querySelector('#edit'));
      assert.deepStrictEqual(log,[],'editing must retain normal typing');
      press(78);assert.deepStrictEqual(log,['TOGGLE_NOTIFICATION_HISTORY']);
      setKey(72);assert.strictEqual(tooltip.textContent,'通知履歴（H）');
      press(78);assert.strictEqual(log.length,1,'old binding must be removed');
      press(72);assert.strictEqual(log.length,2);
      setKey(0);assert.strictEqual(tooltip.textContent,'通知履歴');
      press(72);assert.strictEqual(log.length,2);
      assert(button.hidden,'shortcut edits must not change button visibility');
      c.config.props['ui.bar.notificationHistory']=true;
      owner.apply('ui.bar.notificationHistory');
      assert(!button.hidden);
      assert.strictEqual(tooltip.textContent,'通知履歴');
    }finally{owner.dispose();dom.window.close();}
  });
});

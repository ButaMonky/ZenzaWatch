'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
const expected=[
 ['SCENE_PIN','画面','sceneSearch-togglePin'],
 ['SCENE_SHOW','画面','sceneSearch-togglePanel'],
 ['SCENE_CONTROLS','画面','sceneSearch-toggleControls'],
 ['SCENE_LAYOUT_NEXT','画面','sceneSearch-nextLayout'],
 ['SCENE_LAYOUT_PREV','画面','sceneSearch-prevLayout'],
 ['SCENE_SEEK_BACK','シーク','sceneSearch-seekBack'],
 ['SCENE_SEEK_FORWARD','シーク','sceneSearch-seekForward'],
 ['SCENE_STEP_UP','シーク','sceneSearch-stepUp'],
 ['SCENE_STEP_DOWN','シーク','sceneSearch-stepDown'],
 ['SCENE_COMMENT_VISIBILITY','コメント','sceneSearch-toggleCommentPreview'],
 ['SCENE_COMMENT_SEARCH','コメント','sceneSearch-toggleCommentSearch'],
 ['SCENE_IDLE_HIDE','画面','sceneSearch-toggleIdleHide']
];
function registry(){
 const c=createContext();
 run(beginSection('packages/zenza/src/ShortcutActions.js')+
    ';globalThis.registry=SHORTCUT_ACTIONS;globalThis.defaults=buildDefaultKeyConfig({KEY_SEEK_LEFT:4133});',c);
 return {actions:c.registry,defaults:c.defaults};
}
function routing(){
 const options={
  'sceneSearch.layout.normal':'02','sceneSearch.layout.fullscreen':'09',
  'sceneSearch.layout.linkFullscreen':false,
  'sceneSearch.seekStepSeconds':5,'sceneSearch.commentPreviewVisible':true,
  'sceneSearch.idleHideSeconds':4.5
 };
 const log=[],errors=[],saved=[],steps=[],events=[];
 const controller={
  snapshot:{mode:'normal',shown:false},
  show(value){this.snapshot.shown=value;log.push(['show',value]);},
  seekBy(dir){log.push(['seek',dir]);return true;},
  onPreferencesChanged(key){events.push(key);}
 };
 const interaction={
  togglePin(){log.push(['pin']);return {pinned:true};},
  idlePreferencesChanged(){log.push(['idlePrefs']);}
 };
 const seekStepControl={
  seconds:5,setStep(n){steps.push(n);this.seconds=n;return true;}
 };
 const commentSearchPanel={toggle(){log.push(['commentSearch']);}};
 const Class=loadClass('packages/zenza/src/sceneSearch/SceneSearchShortcutRouter.js',
   'SceneSearchShortcutRouter',createContext());
 const router=new Class({controller,interaction,seekStepControl,commentSearchPanel,
  getPreference:key=>options[key],
  setPreference:(key,val)=>{options[key]=val;saved.push([key,val]);},
  onToggleControls:()=>log.push(['controls']),
  onError:(error,key)=>errors.push([error,key])});
 return {options,log,events,errors,saved,steps,controller,router,seekStepControl};
}
describe('SCUI-08 shortcuts register unassigned with original categories',()=>{
 it('has exactly twelve unique actions and keeps every default key zero',()=>{
  const {actions,defaults}=registry();
  for(const [id,category,command] of expected){
   const hits=actions.filter(a=>a.id===id);
   assert.strictEqual(hits.length,1,id);
   assert.strictEqual(hits[0].category,category,id);
   assert.strictEqual(hits[0].command,command,id);
   assert.strictEqual(hits[0].defaultKey,0,id);
   assert.strictEqual(defaults['KEY_'+id],0,id);
  }
  assert.strictEqual(new Set(actions.map(x=>x.id)).size,actions.length);
  assert.strictEqual(defaults.KEY_SEEK_LEFT,undefined,'preserve provided legacy binding');
 });
 it('emitter supports newly assigned scene key without intercepting editing',async()=>{
  const dom=new JSDOM('<!doctype html><html><body><input id="edit"></body></html>');
  const c=createContext({window:dom.window,document:dom.window.document});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  run(beginSection('packages/zenza/src/ShortcutActions.js'),c);
  run(beginSection('packages/zenza/src/ShortcutKeyEmitter.js'),c);
  run(`globalThis.config=new Emitter();config.props={};
    SHORTCUT_ACTIONS.forEach(a=>config.props['KEY_'+a.id]=0);
    config.props.KEY_SCENE_PIN=66;
    globalThis.external=new Emitter();external.emitResolve('init');
    globalThis.keys=ShortcutKeyEmitter.create(config,document.body,external);`,c);
  const log=[];c.keys.on('keyDown',(name,e,param)=>log.push(name));
  await new Promise(resolve=>setImmediate(resolve));
  const key=target=>target.dispatchEvent(new dom.window.KeyboardEvent(
    'keydown',{keyCode:66,bubbles:true,composed:true,cancelable:true}));
  key(dom.window.document.getElementById('edit'));
  assert.deepStrictEqual(log,[]);
  key(dom.window.document.body);
  assert.deepStrictEqual(log,['SCENE_PIN']);
  c.config.props.KEY_SCENE_PIN=0;c.config.emit('update','KEY_SCENE_PIN',0);
  key(dom.window.document.body);
  assert.deepStrictEqual(log,['SCENE_PIN']);
  dom.window.close();
 });
});
describe('SCUI-08 shared command routing before live binding',()=>{
 it('routes pin, panel, controls, search, and signed seek',()=>{
  const h=routing();
  assert.strictEqual(h.router.handle('sceneSearch-togglePin'),true);
  h.router.handle('sceneSearch-togglePanel');
  h.router.handle('sceneSearch-toggleControls');
  h.router.handle('sceneSearch-toggleCommentSearch');
  h.router.handle('sceneSearch-seekBack');
  h.router.handle('sceneSearch-seekForward');
  assert.deepStrictEqual(h.log,[['pin'],['show',true],['controls'],
    ['commentSearch'],['seek',-1],['seek',1]]);
  assert.strictEqual(h.router.handle('unknown command'),false);
 });
 it('cycles normal/fullscreen layouts and respects linked mode',()=>{
  const h=routing();
  h.router.handle('sceneSearch-nextLayout');
  assert.strictEqual(h.options['sceneSearch.layout.normal'],'03');
  h.router.handle('sceneSearch-prevLayout');
  assert.strictEqual(h.options['sceneSearch.layout.normal'],'02');
  h.controller.snapshot.mode='fullscreen';
  h.router.handle('sceneSearch-nextLayout');
  assert.strictEqual(h.options['sceneSearch.layout.fullscreen'],'10');
  h.router.handle('sceneSearch-nextLayout');
  assert.strictEqual(h.options['sceneSearch.layout.fullscreen'],'00');
  h.options['sceneSearch.layout.linkFullscreen']=true;
  h.router.handle('sceneSearch-nextLayout');
  assert.strictEqual(h.options['sceneSearch.layout.normal'],'03');
  assert.strictEqual(h.options['sceneSearch.layout.fullscreen'],'00');
 });
 it('preserves configured preview/idle settings and step cycling',()=>{
  const h=routing();
  h.router.handle('sceneSearch-toggleCommentPreview');
  assert.strictEqual(h.options['sceneSearch.commentPreviewVisible'],false);
  h.router.handle('sceneSearch-toggleIdleHide');
  assert.strictEqual(h.options['sceneSearch.idleHideSeconds'],0);
  h.router.handle('sceneSearch-toggleIdleHide');
  assert.strictEqual(h.options['sceneSearch.idleHideSeconds'],4.5);
  assert(h.log.some(x=>x[0]==='idlePrefs'));
  h.router.handle('sceneSearch-stepUp');
  assert.strictEqual(h.seekStepControl.seconds,10);
  h.router.handle('sceneSearch-stepDown');
  assert.strictEqual(h.seekStepControl.seconds,5);
 });
});

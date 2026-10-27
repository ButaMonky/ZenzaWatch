'use strict';
// Task946: Turnstile dialog must own its keyboard events, not leak player hotkeys.
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {beginSection,createContext,run}=require('../helpers/extractSource');

async function fixture(){
  const dom=new JSDOM('<!doctype html><html><head></head><body><input id="draft"></body></html>',
    {url:'https://www.nicovideo.jp/watch/sm9',pretendToBeVisual:true});
  const window=dom.window,document=window.document;
  let options;
  window.turnstile={
    render(_element,config){options=config;return 'task946-test-widget';},
    remove(){}
  };
  const c=createContext({window,document,console,debug:{},sleep:async()=>{},
    logSafe:{redact:x=>x},PopupMessage:{alert(){}}});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  run(beginSection('packages/zenza/src/ShortcutActions.js'),c);
  run(beginSection('packages/zenza/src/ShortcutKeyEmitter.js'),c);
  run(beginSection('packages/lib/src/nico/ThreadLoader.js')+';globalThis.loader=ThreadLoader;',c);
  run(`globalThis.config=new Emitter();config.props={};
    SHORTCUT_ACTIONS.forEach(action=>{config.props['KEY_'+action.id]=0;});
    Object.assign(config.props,{KEY_TOGGLE_PLAY:32,KEY_FULLSCREEN:70,KEY_SHIFT_RESET:82});
    globalThis.external=new Emitter();external.emitResolve('init');
    globalThis.keys=ShortcutKeyEmitter.create(config,document.body,external);`,c);
  const delivered=[];
  c.keys.on('keyDown',(key)=>delivered.push('down:'+key));
  c.keys.on('keyUp',(key)=>delivered.push('up:'+key));
  await new Promise(resolve=>setImmediate(resolve));
  const send=(target,type,keyCode,key,modifiers={})=>{
    const event=new window.KeyboardEvent(type,
      {keyCode,key,bubbles:true,cancelable:true,composed:true,...modifiers});
    target.dispatchEvent(event);
    return event;
  };
  return {dom,window,document,delivered,send,
    open:()=>{
      const promise=c.loader.getChallengeToken('public-example-sitekey');
      const overlay=document.querySelector('[data-zenza-comment-challenge="active"]');
      assert(overlay,'modal must be visible');
      return {promise,overlay,button:overlay.querySelector('button')};
    },
    getOptions:()=>options,
    close:()=>dom.window.close()};
}
describe('Task946 challenge dialog keyboard ownership',function(){
  this.timeout(15000);
  it('shields player hotkeys while challenge cancel button is focused',async()=>{
    const h=await fixture();
    try{
      const {promise,overlay,button}=h.open();
      await new Promise(resolve=>setImmediate(resolve));
      assert.strictEqual(h.document.activeElement,button);
      h.send(button,'keydown',32,' ');
      h.send(button,'keydown',70,'f');
      h.send(button,'keyup',82,'r');
      assert.deepStrictEqual(h.delivered,[],'modal keys reached playback handlers');
      h.getOptions().callback('TEST-OK');
      assert.strictEqual(await promise,'TEST-OK');
      assert.strictEqual(overlay.isConnected,false);
      h.send(h.document.body,'keydown',32,' ');
      assert.deepStrictEqual(h.delivered,['down:TOGGLE_PLAY'],
        'shortcuts must resume after challenge closes');
    }finally{h.close();}
  });
  it('Escape cancels authentication without also invoking player shortcuts',async()=>{
    const h=await fixture();
    try{
      const {promise,button}=h.open();
      h.send(button,'keydown',27,'Escape');
      const error=await promise.then(()=>null,e=>e);
      assert.strictEqual(error.reason,'challenge-cancelled');
      assert.strictEqual(error.outcome,'not-sent');
      assert.deepStrictEqual(h.delivered,[]);
    }finally{h.close();}
  });
});

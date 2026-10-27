'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,read,run}=require('../helpers/extractSource');
function harness(){
  const source=read('packages/zenza/src/ShortcutActions.js');
  const block=source.split('//===BEGIN===')[1].split('//===END===')[0];
  const c=createContext({});
  run(block+';globalThis.RealActions=SHORTCUT_ACTIONS;globalThis.RealFormat=formatKeyCombo;',c);
  c.SHORTCUT_ACTIONS=c.RealActions;c.formatKeyCombo=c.RealFormat;
  const Registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
  const text=read('src/VideoControlBar.js'),tick=String.fromCharCode(96);
  const match=text.match(new RegExp('VideoControlBar\\.__tpl__\\s*=\\s*\\('+tick+'([\\s\\S]*?)'+tick+'\\)\\.trim\\(\\)'));
  assert(match,'real control bar template not found');
  const html=match[1].replace(/\$\{[^}]*\}/g,'#');
  const dom=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>');
  const root=dom.window.document.querySelector('.videoControlBar');
  assert(root,'real toolbar absent');
  const values=Object.fromEntries(c.RealActions.map(a=>['KEY_'+a.id,a.defaultKey]));
  const listeners=new Map();
  const config={props:values,getValue:key=>values[key],
    onkey(key,fn){if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);},
    offkey(key,fn){listeners.get(key)?.delete(fn);}};
  const connection=Registry.connect(config,root,'bar');
  const textFor=selector=>root.querySelector(selector)?.textContent?.trim();
  const set=(id,value)=>{values['KEY_'+id]=value;for(const fn of listeners.get('KEY_'+id)||[])fn();};
  return {dom,root,values,listeners,set,connection,textFor,close(){connection.dispose();dom.window.close();}};
}
describe('Task947: playback rate menu shortcut tooltip',function(){
  this.timeout(15000);
  it('shows both actual shift speed shortcuts without claiming menu-opening keys',()=>{
    const h=harness();
    try{
      assert.strictEqual(h.textFor('.playbackRateMenu .tooltip'),
        '再生速度（上げる: Shift + . / 下げる: Shift + ,）');
      assert.strictEqual(h.textFor('.volumeControl .tooltip'),
        '音量調整（上げる: Shift + ↑ / 下げる: Shift + ↓）');
    }finally{h.close();}
  });
  it('refreshes on rebind and unbind; does not confuse speed with temporary slow',()=>{
    const h=harness();
    try{
      h.set('SHIFT_UP',0x10000+85);h.set('SHIFT_DOWN',0x100000+68);
      assert.strictEqual(h.textFor('.playbackRateMenu .tooltip'),
        '再生速度（上げる: Ctrl + U / 下げる: Alt + D）');
      h.set('SHIFT_UP',0);
      assert.strictEqual(h.textFor('.playbackRateMenu .tooltip'),
        '再生速度（下げる: Alt + D）');
      h.set('SHIFT_DOWN',0);
      assert.strictEqual(h.textFor('.playbackRateMenu .tooltip'),'再生速度');
      h.set('SHIFT_RESET',0x1000+90);
      assert.strictEqual(h.textFor('.playbackRateMenu .tooltip'),'再生速度');
      assert.strictEqual(h.textFor('.volumeControl .tooltip'),
        '音量調整（上げる: Shift + ↑ / 下げる: Shift + ↓）');
    }finally{h.close();}
  });
  it('disposes both speed subscriptions along with the other tooltips',()=>{
    const h=harness();
    try{
      assert(h.listeners.get('KEY_SHIFT_UP')?.size>0);
      assert(h.listeners.get('KEY_SHIFT_DOWN')?.size>0);
      h.connection.dispose();
      assert([...h.listeners.values()].every(fns=>fns.size===0));
      const before=h.textFor('.playbackRateMenu .tooltip');
      h.set('SHIFT_UP',87);
      assert.strictEqual(h.textFor('.playbackRateMenu .tooltip'),before);
    }finally{h.dom.window.close();}
  });
});

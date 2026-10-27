'use strict';
const assert=require('assert');
const {createContext,loadClass,read}=require('../helpers/extractSource');
function bootPlayerPanel(){
  class DialogElement{
    constructor(){this.events={};this.props={};this.state={revision:0};this.isOpen=true;this._isConnected=true;this.renders=0;}
    requestRender(){this.renders++;}
    async disconnectedCallback(){}
  }
  const ctx=createContext({DialogElement,window:{customElements:null}});
  const Panel=loadClass('packages/components/src/element/SettingPanelElement.js',
    'SettingPanelElement',ctx);
  const listeners=new Map();
  const config={props:{backComment:false},listeners,
    onkey(key,fn){if(!listeners.has(key)){listeners.set(key,new Set());}listeners.get(key).add(fn);},
    offkey(key,fn){listeners.get(key)?.delete(fn);}
  };
  const panel=new Panel();
  panel.config=config;
  return {panel,config,listeners};
}

describe('Task401 player and advanced full-viewport setting synchronization',()=>{
  it('binds both player toggles to the same Config key and watches external updates',()=>{
    const {panel,config,listeners}=bootPlayerPanel();
    assert.strictEqual(listeners.get('backComment')?.size,1);
    assert.strictEqual(listeners.get('enableFilter')?.size,1);
    let eventStopped=false;
    panel.onChange({
      target:{dataset:{settingName:'backComment'},tagName:'INPUT',
        type:'checkbox',checked:true},
      stopPropagation(){eventStopped=true;}
    });
    assert.strictEqual(config.props.backComment,true);
    assert.strictEqual(eventStopped,true);
    const count=panel.renders;
    config.props.backComment=false;
    listeners.get('backComment').forEach(fn=>fn(false));
    assert.strictEqual(panel.renders,count+1);
    assert.strictEqual(panel.state.revision>0,true);
    panel._bindEnableFilterConfig(null);
    assert.strictEqual(listeners.get('backComment').size,0);
    assert.strictEqual(listeners.get('enableFilter').size,0);
  });
  it('uses one persistent key with distinct names and the original shortcut dispatch',()=>{
    const config=read('src/Config.js');
    const player=read('packages/components/src/element/SettingPanelElement.js');
    const advanced=read('src/ModernAdvancedSettingsModel.js');
    const shortcuts=read('packages/zenza/src/ShortcutActions.js');
    const dispatch=read('src/RootDispatcher.js');
    assert(config.includes('backComment: false'));
    assert(player.includes('data-setting-name="backComment"'));
    assert(/\[\s*['"]backComment['"]\s*,\s*['"]コメントを画面全体に流す['"]/.test(advanced));
    assert(shortcuts.includes("command: 'toggle-backComment'"));
    assert(dispatch.includes("case 'toggle-backComment':"));
    assert(dispatch.includes("case 'backComment':"));
    assert(player.includes('コメントを画面全体に流す'));
  });
});

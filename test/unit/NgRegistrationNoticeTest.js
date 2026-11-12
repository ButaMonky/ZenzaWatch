'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
describe('Comment NG registration feedback',()=>{
  for(const [command,list,label] of [
    ['addUserIdFilter','userIdFilterList','ユーザーNG'],
    ['addWordFilter','wordFilterList','NGワード'],
    ['addCommandFilter','commandFilterList','NGコマンド']
  ]) for(const enabled of [true,false]) {
    it(command+' reports registration with filter '+enabled,()=>{
      const calls=[];
      const filter={isEnable:enabled,[list]:[],[command](value){this[list].push(value);}};
      const ctx=createContext({Emitter:class {}});
      const Dialog=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',ctx);
      const dialog=Object.assign(Object.create(Dialog.prototype),{
        _nicoVideoPlayer:{filter},execCommand:(...args)=>calls.push(args)
      });
      dialog._onCommand(command,'private-value');
      assert.deepStrictEqual(filter[list],['private-value']);
      assert.strictEqual(filter.isEnable,enabled);
      assert.strictEqual(calls.length,1);
      assert.strictEqual(calls[0][0],enabled?'notify':'warning');
      assert(calls[0][1].includes(label));
      assert(!calls[0][1].includes('private-value'));
      assert.strictEqual(calls[0][1].includes('OFF'),!enabled);
      dialog._onCommand(command,'private-value');
      assert(calls[1][1].includes('登録済み'));
    });
  }
});

describe('Warning command routing',()=>{
  it('routes a warning through the shared popup dispatcher',()=>{
    const {beginSection,run}=require('../helpers/extractSource');
    const messages=[];
    const ctx=createContext({PopupMessage:{warning:message=>messages.push(message)}});
    run(beginSection('src/RootDispatcher.js')+';globalThis.dispatcher=RootDispatcher;',ctx);
    ctx.dispatcher.execCommand('warning','registered but disabled');
    assert.deepStrictEqual(messages,['registered but disabled']);
  });
});

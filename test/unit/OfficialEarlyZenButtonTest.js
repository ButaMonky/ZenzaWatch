'use strict';
const assert = require('node:assert/strict');
const {extract, createContext, run} = require('../helpers/extractSource');
const {describe, it} = typeof global.describe === 'function' ? global : require('node:test');
const source = extract('src/initializer.js', 'createOfficialPlaybackGuard', 'var');

describe('official Zen before player readiness', () => {
  it('removes the early entry and frees the official player if startup fails', async () => {
    let releases = 0;
    const error = new Error('startup unavailable');
    const ctx = createContext({
      location:{host:'www.nicovideo.jp'}, Config:{}, HoverMenu:{canStartOnSearch:()=>false},
      createOfficialPlaybackGuard:()=>({release:()=>{releases++;}}),
      initializePlayer:async()=>{throw error;}
    });
    const initialize = extract('src/initializer.js', 'initialize', 'var');
    await assert.rejects(run('(' + initialize + ')()', ctx), error);
    assert.equal(releases, 1);
  });

  for (const navigate of [false, true]) {
    it(navigate ? 'drops a pending click after changing videos' : 'opens exactly once for early repeated clicks', async () => {
      let click, installs = 0, id = 'sm9';
      const opens = [];
      const location = {pathname:'/watch/sm9', search:''};
      const area = {querySelectorAll:()=>[]};
      const ctx = createContext({
        window:{name:'',addEventListener(){},removeEventListener(){}}, location,
        document:{querySelectorAll:()=>[],querySelector:()=>area,getElementById:()=>null},
        HTMLMediaElement:class {}, WatchPageHistory:{}, OfficialPlayerRoute:{isOfficialRequest:()=>false},
        Config:{props:{overrideGinza:false},getValue:()=>false},
        util:{isGinzaWatchUrl:()=>true,getWatchId:()=>id},textUtil:{parseQuery:()=>({})},
        installOfficialLaunchButton:(_id,fn)=>{installs++;click=fn;return ()=>{};}
      });
      const guard = run('(' + source + ')()', ctx);
      assert.equal(installs,1,'button installed before player is attached');
      click(); click();
      if(navigate){id='sm10';location.pathname='/watch/sm10';}
      const dialog = {isOpen:false,on(){},open(next){opens.push(next);this.watchId=next;this.isOpen=true;}};
      guard.attach(dialog);
      await Promise.resolve();
      assert.equal(installs,1);
      assert.deepEqual(opens,navigate?[]:['sm9']);
      guard.release();
    });
  }
});

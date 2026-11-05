'use strict';
// #125 AUD-83 / #141 AUD-85: official GREEN regression of the product fix.
// The real canonical generated PlayListSession is tested from source and Dev.
const assert = require('assert');
const {extract,createContext,run} = require('../helpers/extractSource');

const KEY = 'ZenzaWatchPlaylist';
function fixture(file,{maxBytes=Infinity}={}) {
  const before = JSON.stringify({index:0,items:[{watchId:'smOLD',title:'saved'}]});
  const data = new Map([[KEY,before],['unrelated-setting','do-not-touch']]);
  const writes=[],removes=[],warnings=[];
  const storage = {
    getItem(key) {return data.has(key)?data.get(key):null;},
    setItem(key,value) {
      writes.push({key,bytes:String(value).length});
      if(String(value).length > maxBytes){
        const e=new Error('synthetic storage quota');
        e.name='QuotaExceededError';
        throw e;
      }
      data.set(key,String(value));
    },
    removeItem(key) {removes.push(key);data.delete(key);}
  };
  const context=createContext({
    sessionStorage:storage,
    window:{console:{error(){},warn:(...args)=>warnings.push(args)}}
  });
  const code=extract(file,'PlayListSession','var');
  run('const PlayListSession = '+code+';\n'+
    'PlayListSession.MAX_ITEMS = 10000;\n'+
    'PlayListSession.MIN_ITEMS = 100;\n'+
    'globalThis.subject = PlayListSession;',context);
  const items=Array.from({length:300},(_,i)=>({
    watchId:'sm'+i,title:'X'.repeat(400)
  }));
  return {session:context.subject,storage,data,writes,removes,warnings,before,items};
}

for(const [label,file] of [
  ['source','packages/zenza/src/Playlist/PlayListSession.js'],
  ['generated Dev','dist/ZenzaWatch-dev.user.js']
]) {
  describe('#125/#141 playlist storage repaired GREEN ('+label+')',()=>{
    it('preserves the old backup byte-for-byte after ALL quota writes fail',()=>{
      const h=fixture(file,{maxBytes:0});
      assert.strictEqual(h.session.restore().items[0].watchId,'smOLD');
      h.session.save({index:200,items:h.items});
      // GREEN (#125): failed atomic setItem must not delete the old backup.
      assert(h.writes.length>1);
      assert.strictEqual(h.removes.filter(key=>key===KEY).length,0);
      assert.strictEqual(h.data.get(KEY),h.before);
      assert.strictEqual(h.session.restore().items[0].watchId,'smOLD');
      assert.strictEqual(h.data.get('unrelated-setting'),'do-not-touch');
    });

    it('keeps the inactive index -1 after successful quota trim',()=>{
      const h=fixture(file,{maxBytes:60000});
      h.session.save({index:-1,items:h.items});
      const saved=h.session.restore();
      assert(saved&&saved.items.length<h.items.length);
      assert(saved.items.length>=100);
      // GREEN (#141): trimming must not select a video that was inactive.
      assert.strictEqual(saved.index,-1);
      assert.strictEqual(saved.items[0].watchId,'sm0');
      assert.strictEqual(h.data.get('unrelated-setting'),'do-not-touch');
      assert(h.writes.some(w=>w.bytes>60000));
    });

    it('keeps the selected video ID when a successful trim surrounds it',()=>{
      const h=fixture(file,{maxBytes:60000});
      h.session.save({index:200,items:h.items});
      const saved=h.session.restore();
      assert(saved&&saved.items.length<h.items.length);
      assert(saved.index>=0&&saved.index<saved.items.length);
      assert.strictEqual(saved.items[saved.index].watchId,'sm200');
      assert.strictEqual(h.data.get('unrelated-setting'),'do-not-touch');
    });

    it('preserves the old backup when a non-quota storage error occurs',()=>{
      const h=fixture(file,{maxBytes:0});
      h.storage.setItem=()=>{throw new TypeError('synthetic adapter failure');};
      h.session.save({index:200,items:h.items});
      assert.strictEqual(h.data.get(KEY),h.before);
      assert.strictEqual(h.removes.length,0);
    });
  });
}

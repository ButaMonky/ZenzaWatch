'use strict';
const assert = require('assert');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {extract, createContext, run} = require('../helpers/extractSource');

function gateMethod(file, name) {
  const code = 'const worker = '+extract(file, 'nicovideo', 'var')+';';
  const ast = parser.parse(code, {sourceType: 'unambiguous',
    plugins: ['classProperties']});
  let result;
  traverse(ast, {noScope: true, VariableDeclarator(path) {
    if (result === undefined && path.node.id.name === name) {
      result = code.slice(path.node.init.start, path.node.init.end);
    }
  }});
  assert(result, 'GateAPI.nicovideo missing '+name);
  return result;
}
function fixture(file, broadcast = true) {
  const saved = {}, sent = [], delivered = [];
  const store = {setItem(k, v) {saved[k] = String(v);this[k] = String(v);},
    getItem(k) {return Object.hasOwn(saved, k) ? saved[k] : null;}};
  const bc = broadcast ? {postMessage: value => sent.push(value)} : null;
  const context = createContext({PREFIX: 'ZenzaWatch', PRODUCT: 'ZenzaWatch', kvs:null,
    localStorage:store, broadcastChannel:bc, isOk:true,
    post:(body,opts)=>delivered.push({body,opts}),
    console:{warn(){}, log(){}}});
  run('globalThis.handlers = {'+
    ['saveConfig','onStorage','onBroadcastMessage'].map(name=>
      name+': ('+gateMethod(file,name)+')').join(',')+'};', context);
  return {save:context.handlers.saveConfig,
    onStorage:context.handlers.onStorage,
    onBroadcast:context.handlers.onBroadcastMessage,
    context,saved,sent,delivered,store};
}
for(const file of ['packages/lib/src/nico/GateAPI.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task377 AUD-03 cross-tab config live sync ('+file+')', () => {
    it('stores JSON but broadcasts a typed value only on changes', () => {
      const h=fixture(file);
      h.save({key:'volume',value:0.5});
      assert.strictEqual(h.saved.ZenzaWatch_volume,'0.5');
      assert.strictEqual(h.sent.length,1);
      assert.strictEqual(h.sent[0].body.command,'configSync');
      assert.strictEqual(h.sent[0].body.params.key,'volume');
      assert.strictEqual(h.sent[0].body.params.value,0.5);
      h.save({key:'volume',value:0.5});
      assert.strictEqual(h.sent.length,1);
    });
    it('forwards a typed broadcast message to the receiving port', () => {
      const send=fixture(file), receive=fixture(file);
      const value={enabled:true, filters:['one','two']};
      send.save({key:'rule',value});
      receive.onBroadcast({data:send.sent[0]});
      assert.strictEqual(receive.delivered.length,1);
      assert.strictEqual(receive.delivered[0].body.command,'configSync');
      assert.deepStrictEqual(JSON.parse(JSON.stringify(
        receive.delivered[0].body.params)),{key:'rule',value});
    });
    it('does not broadcast data written under a foreign prefix', () => {
      const h=fixture(file);
      h.save({prefix:'otherApp',key:'enabled',value:true});
      assert.strictEqual(h.saved.otherApp_enabled,'true');
      assert.deepStrictEqual(h.sent,[]);
    });
    it('preserves the existing ordinary message relay', () => {
      const h=fixture(file);
      const packet={body:{command:'message',
        params:{command:'ping',params:{now:1}}},sessionId:'abc'};
      h.onBroadcast({data:packet});
      assert.strictEqual(h.delivered.length,1);
      assert.strictEqual(h.delivered[0].body.command,'message');
      assert.strictEqual(h.delivered[0].opts.sessionId,'abc');
    });
    it('parses stored JSON values in the storage-event fallback', () => {
      const h=fixture(file,false);
      h.onStorage({type:'storage',key:'ZenzaWatch_muted',
        oldValue:'false',newValue:'true'});
      h.onStorage({type:'storage',key:'ZenzaWatch_config',
        oldValue:'null',newValue:'{"array":[1,2]}'});
      assert.strictEqual(h.delivered.length,2);
      assert.strictEqual(h.delivered[0].body.params.value,true);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(
        h.delivered[1].body.params.value)),{array:[1,2]});
    });
    it('ignores malformed storage values rather than propagating them', () => {
      const h=fixture(file,false);
      assert.doesNotThrow(()=>h.onStorage({type:'storage',
        key:'ZenzaWatch_volume',oldValue:'0',newValue:'not-json'}));
      assert.deepStrictEqual(h.delivered,[]);
    });
    it('ignores invalid broadcast envelopes without throwing', () => {
      const h=fixture(file);
      for(const data of [null,'{malformed-json',{}, {body:null},
        {body:{command:'configSync',params:null}}]){
        assert.doesNotThrow(()=>h.onBroadcast({data}));
      }
      assert.deepStrictEqual(h.delivered,[]);
    });
    it('does not forward storage changes before initialization', () => {
      const h=fixture(file,false);
      h.context.isOk=false;
      h.onStorage({type:'storage',key:'ZenzaWatch_volume',
        oldValue:'0.2',newValue:'0.8'});
      assert.deepStrictEqual(h.delivered,[]);
    });
    it('preserves null, boolean and arrays through broadcast', () => {
      const h=fixture(file);
      for(const value of [null,false,[1,2,3]]){
        h.save({key:'sample',value});
        const payload=h.sent[h.sent.length-1];
        assert.deepStrictEqual(JSON.parse(JSON.stringify(
          payload.body.params.value)),value);
      }
    });
  });
}

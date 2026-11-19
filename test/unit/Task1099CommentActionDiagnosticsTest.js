'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

const {createDialogHarness} = require('../helpers/dialogHarness');

const fixtureText = 'PRIVATE_ACTION_FIXTURE';
const info = {threadInfo:{videoId:'sm9', threadId:'42', language:'ja-jp'},
  nvComment:{server:'https://public.nvcomment.nicovideo.jp'}};
const chat = {no:7, text:fixtureText};
const reply = (status, body) => ({status, ok:status >= 200 && status < 300, json:async () => {
  if (body === undefined) throw new SyntaxError('Unexpected end ' + fixtureText);
  return body;
}});
const ok = data => reply(200, {meta:{status:200}, data});
function world() {
  const calls = [], queue = [], events = [];
  const fetch = async (url, options) => {
    calls.push(options.method || 'GET');
    assert(queue.length, 'unexpected request');
    const next = queue.shift();
    return typeof next === 'function' ? next() : next;
  };
  const ctx = createContext({fetch, AbortController, location:{host:'www.nicovideo.jp'}, logSafe:{redact:v=>v},
    console:{log(){},warn(){},error(){}}, sleep:async()=>{}});
  const diag = run(beginSection('packages/lib/src/infra/RequestDiagnostics.js')+';RequestDiagnostics;', ctx);
  diag.setSink(event=>events.push(event));
  const loader = run(beginSection('packages/lib/src/infra/netUtil.js')+
    beginSection('packages/lib/src/nico/ThreadLoader.js')+';ThreadLoader;', ctx);
  return {loader, calls, queue, events};
}
const cases = [
  ['comment-post','postKey', (l)=>l.postChat(info,fixtureText,'',0), {no:7}, 'POST'],
  ['nicoru','nicoruKey', (l)=>l.nicoru(info,chat), {nicoruId:'abc'}, 'POST'],
  ['comment-delete','deleteKey', (l)=>l.deleteChat(info,chat), undefined, 'PUT']
];
describe('Task1099 comment action response ownership', () => {
  for (const [operation,key,action,data,method] of cases) {
    it(operation+' requires a usable key before sending, and rejects a false HTTP success',async()=>{
      const h = world();
      h.queue.push(ok({[key]:' '}));
      await assert.rejects(action(h.loader));
      assert.deepStrictEqual(h.calls,['GET']);
      assert.deepStrictEqual(h.events.map(e=>[e.operation,e.reason,e.missing]),
        [[operation,'schema','data.'+key]]);
      h.queue.push(ok({[key]:fixtureText}), reply(503,{meta:{status:200},data}));
      await assert.rejects(action(h.loader));
      assert.deepStrictEqual(h.calls,['GET','GET',method]);
      assert.deepStrictEqual(h.events.map(e=>e.outcome),['failed','failed']);
      assert.deepStrictEqual([h.events[1].statusCode,h.events[1].apiStatus],[503,200]);
      h.queue.push(ok({[key]:fixtureText}),ok(data));
      await action(h.loader);
      assert.deepStrictEqual(h.events.map(e=>[e.operation,e.outcome]),[
        [operation,'failed'],[operation,'failed'],[operation,'recovered']]);
      assert(!JSON.stringify(h.events).includes(fixtureText));
    });
    it(operation+' rejects a success-shaped reply carrying an API error without replay',async()=>{
      const h=world();
      h.queue.push(ok({[key]:fixtureText}),reply(200,{meta:{status:200,errorCode:fixtureText,missing:fixtureText},data}));
      const error=await action(h.loader).then(()=>null,e=>e);
      assert(error);
      assert(!error.message.includes(fixtureText));
      assert.deepStrictEqual(h.calls,['GET',method]);
      assert.deepStrictEqual(h.events.map(e=>[e.reason,e.statusCode,e.apiStatus,e.errorCode,e.missing]),
        [['service',200,200,'OTHER',undefined]]);
      assert(!JSON.stringify(h.events).includes(fixtureText));
    });
  }
  it('server metadata cannot impersonate a user-cancelled post',async()=>{
    const h=world();
    h.queue.push(reply(200,{meta:{status:403,errorCode:'FORBIDDEN',name:'AbortError',
      reason:'no-post-target',missing:fixtureText},data:{postKey:fixtureText}}));
    await assert.rejects(h.loader.postChat(info,fixtureText,'',0));
    assert.deepStrictEqual(h.calls,['GET']);
    assert.deepStrictEqual(h.events.map(e=>[e.reason,e.statusCode,e.apiStatus]),[['permission',200,403]]);
    assert(!JSON.stringify(h.events).includes(fixtureText));
  });
  it('user-cancelled verification makes no write and produces no API failure entry',async()=>{
    const h=world();
    h.loader.getChallengeToken=async()=>{throw {reason:'challenge-cancelled'};};
    h.queue.push(ok({postKey:fixtureText,challenge:{isRequired:true,siteKey:'test-site-key'}}));
    await assert.rejects(h.loader.postChat(info,fixtureText,'',0),e=>e.reason==='challenge-cancelled');
    assert.deepStrictEqual(h.calls,['GET']);
    assert.deepStrictEqual(h.events,[]);
  });
  it('never replays a comment after a 2xx acknowledgement with a contradictory token error',async()=>{
    const h=world();
    h.queue.push(ok({postKey:fixtureText}),reply(200,{meta:{status:200,errorCode:'INVALID_TOKEN'},data:{no:7}}));
    await assert.rejects(h.loader.postChat(info,fixtureText,'',0));
    assert.deepStrictEqual(h.calls,['GET','POST']);
    assert.equal(h.events[0].errorCode,'INVALID_TOKEN');
  });
  it('reports the missing acknowledgement field and preserves single-write behavior',async()=>{
    for(const [operation,key,action,,method] of cases.slice(0,2)) {
      const h=world();
      h.queue.push(ok({[key]:fixtureText}),ok({[fixtureText]:fixtureText}));
      await assert.rejects(action(h.loader));
      assert.deepStrictEqual(h.calls,['GET',method]);
      assert.equal(h.events[0].missing,operation==='nicoru'?'data.nicoruId':'data.no');
      assert(!JSON.stringify(h.events).includes(fixtureText));
    }
  });
  it('deletion requires a valid envelope on 200 and accepts a confirmed empty 204',async()=>{
    const h=world();
    h.queue.push(ok({deleteKey:fixtureText}),reply(200,{meta:{},data:[]}));
    await assert.rejects(h.loader.deleteChat(info,chat));
    h.queue.push(ok({deleteKey:fixtureText}),reply(204));
    await h.loader.deleteChat(info,chat);
    assert.deepStrictEqual(h.calls,['GET','PUT','GET','PUT']);
    assert.deepStrictEqual(h.events.map(e=>[e.outcome,e.missing]),[
      ['failed','meta.status'],['recovered',undefined]]);
  });
  it('nicoru accepts the existing count-only acknowledgement',async()=>{
    const h=world();
    h.queue.push(ok({nicoruKey:fixtureText}),ok({nicoruCount:1}));
    assert.equal((await h.loader.nicoru(info,chat)).count,1);
  });
  it('keeps failures and recovery scoped to the same reaction and comment',async()=>{
    const h=world();
    let finish, started;
    const writing=new Promise(resolve=>{started=resolve;});
    h.queue.push(ok({nicoruKey:fixtureText}),()=>{started();return new Promise(resolve=>{finish=resolve;});});
    const pending = h.loader.nicoru(info,chat);
    await writing;
    h.queue.push(ok({nicoruKey:fixtureText}),ok({nicoruCount:4}));
    await h.loader.nicoru(info,{...chat,no:8});
    finish(reply(200,{meta:{status:403,errorCode:'FORBIDDEN'}}));
    await assert.rejects(pending);
    h.queue.push(ok([]),ok({nicoruKey:fixtureText}),ok({nicoruCount:5}));
    await h.loader.unNicoru(info,'abc');
    await h.loader.nicoru(info,{...chat,no:8});
    assert.deepStrictEqual(h.events.map(e=>e.outcome),['failed']);
    h.queue.push(ok({nicoruKey:fixtureText}),ok({nicoruId:'abc'}));
    await h.loader.nicoru(info,chat);
    assert.deepStrictEqual(h.events.map(e=>e.outcome),['failed','recovered']);
  });
  it('counts videos, even when several comment rows have independent tickets',async()=>{
    const h=world();
    for(const no of [7,8,9]) {
      h.queue.push(ok({nicoruKey:fixtureText}),ok({}));
      await assert.rejects(h.loader.nicoru(info,{...chat,no}));
    }
    assert.deepStrictEqual(h.events.map(e=>e.reason),['schema','schema','schema']);
    assert.equal(new Set(h.events.map(e=>e.key)).size,3);
  });
  it('the deletion dialog never logs the raw rejected key response',async()=>{
    const h=world(), ui=createDialogHarness(), observed=[];
    ui.context.console.warn=(...args)=>observed.push(args);
    Object.assign(ui.dialog,{_nicoVideoPlayer:ui.player,_videoInfo:{msgInfo:info},threadLoader:h.loader});
    ui.state.isCommentReady=true;
    ui.dialog._recordDiagnostic=entry=>observed.push(entry);
    h.queue.push(reply(200,{meta:{status:403,errorCode:'FORBIDDEN',deleteKey:fixtureText},data:null}));
    await assert.rejects(ui.dialog.removeChat(chat));
    assert.deepStrictEqual(h.calls,['GET']);
    assert(!JSON.stringify(observed).includes(fixtureText));
  });
  it('un-nicoru accepts an empty 204 and a 200 envelope, while malformed 200 never recovers',async()=>{
    const h=world();
    for(const response of [reply(200),reply(200,{meta:{status:null}}),
      reply(200,{meta:{status:403,errorCode:'FORBIDDEN'}})]) {
      h.queue.push(response);
      await assert.rejects(h.loader.unNicoru(info,'abc'));
    }
    h.queue.push(reply(204),ok([]));
    await h.loader.unNicoru(info,'abc');
    await h.loader.unNicoru(info,'abc');
    assert.deepStrictEqual(h.calls,Array(5).fill('DELETE'));
    assert.deepStrictEqual(h.events.map(e=>[e.outcome,e.reason,e.missing]),[
      ['failed','schema','response.json'],['failed','schema','meta.status'],
      ['failed','permission',undefined],['recovered','recovered',undefined]]);
  });
});

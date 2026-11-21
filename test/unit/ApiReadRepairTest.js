const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {extract, createContext, run} = require('../helpers/extractSource');

function setup(name, globals) {
  const events = [];
  const ctx = createContext({...globals, events});
  run('var RequestDiagnostics = '+extract('packages/lib/src/infra/RequestDiagnostics.js','RequestDiagnostics','var')+
    '; RequestDiagnostics.setSink(e=>events.push(e));',ctx);
  run('globalThis.api = '+extract('packages/lib/src/nico/'+name+'.js',name,'var')+';',ctx);
  return {api:ctx.api,events};
}
describe('repair reports for optional API reads', () => {
  it('does not display a missing search total as zero', async () => {
    let payload = {meta:{status:200},data:{}};
    const events = [];
    const ctx = createContext({Emitter:class {}, NicoSearchApiV2Loader:{},events,
      fetch:async()=>new Response(JSON.stringify(payload))});
    run('var RequestDiagnostics = '+extract('packages/lib/src/infra/RequestDiagnostics.js','RequestDiagnostics','var')+
      '; RequestDiagnostics.setSink(e=>events.push(e));',ctx);
    run(extract('src/VideoSearchForm.js','VideoSearchForm','class')+';this.form=VideoSearchForm;',ctx);
    await assert.rejects(ctx.form.fetchWordCount('PrivateWord','tag'));
    assert.equal(events[0]?.missing,'data.totalCount');
    payload.data.totalCount=0;
    assert.equal(await ctx.form.fetchWordCount('PrivateWord','tag'),0);
    assert.equal(events.at(-1).outcome,'recovered');
    assert(!JSON.stringify(events).includes('PrivateWord'));
  });
  it('records malformed XML and distinguishes a successful empty ranking feed', async () => {
    const dom = new JSDOM('');
    try {
      let body = '<html><title>PrivateTitle</title></html>';
      const {api,events} = setup('NicoRssLoader',{DOMParser:dom.window.DOMParser, netUtil:{fetch:async () => new Response(body)}});
      await api.loadRanking({});
      assert.equal(events[0]?.operation,'ranking-rss');
      assert.equal(events[0].missing,'rss.channel');
      body = '<rss><channel></channel></rss>';
      await api.loadRanking({});
      assert.equal(events.at(-1).outcome,'recovered');
      assert(!JSON.stringify(events).includes('PrivateTitle'));
    } finally { dom.window.close(); }
  });
  it('identifies the exact tree side and preserves the valid first-page 404', async () => {
    let response = () => new Response(JSON.stringify({meta:{status:200},data:{parents:{total:1}}}));
    const {api,events} = setup('CommonsTreeLoader',{netUtil:{fetch:async () => response()}});
    await assert.rejects(api.loadRelatives('sm9','parents'));
    assert.equal(events[0]?.operation,'commons-parents');
    assert.equal(events[0].missing,'data.parents.contents');
    response = () => new Response(null,{status:404});
    const empty = await api.loadRelatives('sm9','parents');
    assert.equal(empty.total,0);
    assert.equal(events.at(-1).outcome,'recovered');
  });
  it('separates an unreadable thumb gateway reply from a deleted video', async () => {
    let reply = {status:'fail',code:'INVALID_RESPONSE'};
    class Gate { async fetch() { return reply; } }
    const {api,events} = setup('ThumbInfoLoader',{CrossDomainGate:Gate});
    await assert.rejects(api.load('sm9'));
    assert.equal(events[0]?.missing,'thumb.status');
    reply = {status:'ok'};
    await api.load('sm9');
    assert.equal(events.at(-1).outcome,'recovered');
  });
});

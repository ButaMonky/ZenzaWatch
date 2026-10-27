// Task461: RecommendAPILoader / NVWatchCaller / MatrixRankingLoader parity.
// Pre-migration fixtures vs generated runtimes on identical offline fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {renderNicoLegacy} from '../scripts/sync-nico-api.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>[read(NICO_API_BY_NAME[name].fixture),read(NICO_API_BY_NAME[name].runtime)];

async function compare(name,makeGlobals,cases){
  const [before,after]=pair(name);
  let n=0;
  for(const [label,run,scenario] of cases){
    const a=makeGlobals(scenario),b=makeGlobals(scenario);
    const sa=loadLegacy(before,name,a.globals),sb=loadLegacy(after,name,b.globals);
    const ra=await settle(()=>run(sa)),rb=await settle(()=>run(sb));
    assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
    assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' side effects');
    if(ra.ok&&ra.value&&typeof ra.value==='object'){
      assert.equal(rb.value===b.shared,ra.value===a.shared,label+' identity');
    }
    n++;
  }
  return n;
}

test('IIFE renderer accepts only the declared shape',()=>{
  const spec=NICO_API_BY_NAME.NVWatchCaller;
  assert.equal(spec.shape,'iife');
  assert.ok(renderNicoLegacy(spec,'const NVWatchCaller = (() => {\n    return {};\n})();\nexport { NVWatchCaller };'));
  assert.throws(()=>renderNicoLegacy(spec,'const NVWatchCaller = {\n};\nexport { NVWatchCaller };'),/UNEXPECTED_TOP_LEVEL/);
  assert.throws(()=>renderNicoLegacy(spec,'const NVWatchCaller = (() => {\n})();\nstart();\nexport { NVWatchCaller };'),/UNEXPECTED_TOP_LEVEL/);
  assert.throws(()=>renderNicoLegacy(NICO_API_BY_NAME.MatrixRankingLoader,
    'const MatrixRankingLoader = (() => {\n})();\nexport { MatrixRankingLoader };'),/UNEXPECTED_TOP_LEVEL/);
});

// ---------- RecommendAPILoader ----------
function recommendGlobals(scenario){
  const log=[];
  const shared={items:[{id:'sm1'}]};
  const body=scenario.body==='DATA'?{meta:{status:200},data:shared}:scenario.body;
  const netUtil={fetch:(url,opts)=>{
    log.push(['fetch',url,opts]);
    if(scenario.fetchFails)return Promise.reject(Error('offline'));
    return Promise.resolve({json:async()=>{
      if(scenario.jsonFails)throw SyntaxError('bad json');
      return body;
    }});
  }};
  const textUtil={encodeBase64:s=>{log.push(['b64',s]);return 'B64:'+s;}};
  const window={console:{warn:(...args)=>{log.push(['warn',...args]);}}};
  return {globals:{netUtil,textUtil,window,JSON,Error,encodeURIComponent,Promise},log,shared};
}
test('RecommendAPILoader: recipe encoding, URL, data identity and failure classes',async()=>{
  const ok={body:'DATA'};
  const n=await compare('RecommendAPILoader',recommendGlobals,[
    ['default recipe',a=>a.load({videoId:'sm9'}),ok],
    ['explicit recipe',a=>a.load({videoId:'sm9',recipe:{id:'custom',videoId:'sm1'}}),ok],
    ['no videoId',a=>a.load({}),ok],
    ['no argument (TypeError)',a=>a.load(),ok],
    ['series numeric id',a=>a.loadSeries(123),ok],
    ['series with title',a=>a.loadSeries('7',{title:'タイトル'}),ok],
    ['series empty title falls back',a=>a.loadSeries(5,{title:''}),ok],
    ['meta 400',a=>a.load({videoId:'sm9'}),{body:{meta:{status:400},data:1}}],
    ['meta status string',a=>a.load({videoId:'sm9'}),{body:{meta:{status:'200'}}}],
    ['meta missing',a=>a.load({videoId:'sm9'}),{body:{data:1}}],
    ['null body (TypeError)',a=>a.load({videoId:'sm9'}),{body:null}],
    ['primitive body',a=>a.load({videoId:'sm9'}),{body:7}],
    ['json fails',a=>a.load({videoId:'sm9'}),{jsonFails:true}],
    ['fetch fails',a=>a.load({videoId:'sm9'}),{fetchFails:true}]
  ]);
  assert.equal(n,14);
});

// ---------- NVWatchCaller ----------
function watchGlobals(scenario){
  const log=[],shared={status:204};
  const netUtil={fetch:(url,opts)=>{
    log.push(['fetch',url,opts]);
    return scenario.fail?Promise.reject(Error('blocked')):Promise.resolve(shared);
  }};
  const console={warn:(...args)=>{log.push(['warn',...args]);}};
  return {globals:{netUtil,console,encodeURIComponent},log,shared};
}
test('NVWatchCaller: encoded tracking ID, headers, fire-and-forget failure',async()=>{
  const n=await compare('NVWatchCaller',watchGlobals,[
    ['plain id',a=>a.call('abc123'),{}],
    ['needs encoding',a=>a.call('a/b?c=d&e f'),{}],
    ['undefined id',a=>a.call(undefined),{}],
    ['transport failure resolves undefined',a=>a.call('abc'),{fail:true}]
  ]);
  assert.equal(n,4);
});

// ---------- MatrixRankingLoader ----------
function rankingGlobals(scenario){
  const log=[];
  const netUtil={fetch:(url,opts)=>{
    log.push(['fetch',url,opts]);
    if(scenario.fail)return Promise.reject(Error('offline'));
    return Promise.resolve({text:async()=>scenario.html});
  }};
  class DOMParser{
    parseFromString(html,type){
      log.push(['parse',html,type]);
      return {getElementById:id=>{
        log.push(['byId',id]);
        if(scenario.element==='none')return null;
        return {dataset:scenario.element==='noattr'?{}:{app:scenario.app}};
      }};
    }
  }
  return {globals:{netUtil,DOMParser,JSON},log,shared:null};
}
test('MatrixRankingLoader: embedded JSON and markup-change failures',async()=>{
  const n=await compare('MatrixRankingLoader',rankingGlobals,[
    ['valid app json',a=>a.load(),{html:'<div>',app:'{"genres":[1,2]}'}],
    ['element missing (TypeError)',a=>a.load(),{html:'<p>',element:'none'}],
    ['data-app missing (SyntaxError)',a=>a.load(),{html:'<p>',element:'noattr'}],
    ['invalid json',a=>a.load(),{html:'<p>',app:'{oops'}],
    ['fetch fails',a=>a.load(),{fail:true}]
  ]);
  assert.equal(n,5);
});

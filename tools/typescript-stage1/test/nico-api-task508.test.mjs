// Task508: exact pre-migration / TS-generated nicoUtil behavior without live services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico, read, loadLegacy, snapshot, settle} from './nico-api-harness.mjs';

emitNico();
const spec = NICO_API_BY_NAME.nicoUtil;
const oldSource = read(spec.fixture);
const newSource = read(spec.runtime);
const encode = value => Buffer.from(JSON.stringify(value),'utf8').toString('base64');
const input = (playlist, extra={}) => JSON.stringify({
  query:'keep', ...extra, ...(playlist === undefined ? {} : {playlist: encode(playlist)})
});

function makeWorld(options={}) {
  const calls=[];
  const header = options.header ?? {initConfig:{user:{isPremium:true,isLogin:false}}};
  const document = {
    cookie: options.cookie ?? 'foo=1; nicohistory=sm9%2Csm10',
    querySelector(selector) {
      calls.push(['querySelector',selector]);
      if (selector.startsWith('#CommonHeader[')) {
        return options.legacy ? null : {dataset:{commonHeader:JSON.stringify(header)}};
      }
      return options.selectors?.includes(selector) ? {} : null;
    },
    getElementsByClassName(name) {
      calls.push(['getElementsByClassName',name]);
      return options.language === null ? [] : [{lang:options.language ?? 'ja-JP'}];
    }
  };
  const window={
    open(...args) {calls.push(['window.open',args]); return null;},
    decodeURIComponent: decodeURIComponent
  };
  const textUtil={
    parseQuery(query) {calls.push(['parseQuery',query]); return JSON.parse(query);},
    decodeBase64(s) {calls.push(['decodeBase64',s]); return Buffer.from(s,'base64').toString('utf8');},
    secToTime(seconds) {calls.push(['secToTime',seconds]); return '05:20';}
  };
  const globals = {document,window,textUtil,URL,location:{href:options.href ?? 'https://www.nicovideo.jp/watch/sm9'},URIError};
  return {globals,calls,document};
}

async function parity(label,steps,options={}) {
  const left=makeWorld(options),right=makeWorld(options);
  const old=loadLegacy(oldSource,'nicoUtil',left.globals);
  const now=loadLegacy(newSource,'nicoUtil',right.globals);
  for(const [i,{name,args=[]}] of steps.entries()) {
    const run = util => name==='getNicoHistory' ? util.getNicoHistory : util[name](...args);
    const a=await settle(()=>run(old));
    const b=await settle(()=>run(now));
    assert.deepEqual(snapshot(b),snapshot(a),`${label}:${i}:${name}`);
  }
  assert.deepEqual(snapshot(right.calls),snapshot(left.calls),label+' side-effects');
}
const step=(name,...args)=>({name,args});

test('nicoUtil query decode preserves playlist shape, malformed input and selectors',async()=>{
  const cases=[
    undefined, {type:'series',context:{seriesId:101}},
    {type:'user-uploaded',context:{userId:'u',sort:'desc'}},
    {type:'mylist',context:{mylistId:'m',sort:'asc'}},
    {type:'watchlater',context:{foo:1}},
    {type:'search',context:{word:'test'}},
    {type:'other',context:{}}, 0, true, null, 'opaque', []
  ];
  const steps=cases.map(value=>step('parseWatchQuery',input(value)));
  steps.push(step('parseWatchQuery','invalid-json'));
  steps.push(step('parseWatchQuery',JSON.stringify({playlist:'***'})));
  await parity('query',steps);
});

test('nicoUtil thumbnail thresholds and URL parsing preserve exact behavior',async()=>{
  const ids=['sm1','sm16371887','sm16371888','sm35374758','nm50000000','so123456','ab123','SM123','','abc'];
  const urls=[
    'https://www.nicovideo.jp/watch/sm9',
    'https://www.nicovideo.jp/shorts/so1',
    'https://nico.ms/sm9',
    'https://www.nicovideo.jp/watch/sm9?foo=bar',
    'https://www.nicovideo.jp/watch/sm9/more',
    'https://evil.example/watch/sm9',
    'javascript:alert(1)', 'not a url',
    'https://www.nicovideo.jp/search/sm9'
  ];
  await parity('thumbnail-and-urls',[
    ...ids.flatMap(id=>[step('hasLargeThumbnail',id),step('getThumbnailUrlByVideoId',id)]),
    ...urls.flatMap(url=>[step('getWatchId',url),step('isGinzaWatchUrl',url)]),
    step('getWatchId'),step('isGinzaWatchUrl')
  ]);
});
test('nicoUtil header, locale, cookies and window side-effects preserve parity',async()=>{
  const all=[
    step('getCommonHeader'),step('isLegacyHeader'),
    step('isPremiumLegacy'),step('isLoginLegacy'),
    step('isPremium'),step('isLogin'),step('getPageLanguage'),
    step('getNicoHistory'),step('getMypageVer'),
    step('openMylistWindow','sm9'),
    step('openTweetWindow',{watchId:'sm9',duration:320,isChannel:false,title:'Foo@bar',videoId:'sm9'}),
    step('openTweetWindow',{watchId:'so42',duration:35,isChannel:true,title:'Channel',videoId:'so42'})
  ];
  await parity('modern',all);
  await parity('legacy',all,{legacy:true,language:null,cookie:'foo=2'});
  await parity('legacy-cookie-bad',all,{legacy:true,cookie:'nicohistory=%ZZ'});
  await parity('header-malformed',all,{header:{}});
});

test('nicoUtil export and original fixture pinned',()=>{
  assert.equal(spec.shape,'object');
  assert.match(oldSource,/const nicoUtil\s*=\s*\{/);
  assert.match(newSource,/GENERATED FROM tools\/typescript-stage1\/nico-src\/nicoUtil\.ts/);
  assert.match(newSource,/export \{nicoUtil\};/);
});

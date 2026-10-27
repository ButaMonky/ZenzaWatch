// Task457: NVApi/LikeApi TypeScript migration — sync, shape and behavior parity.
// Pre-migration JS fixtures and generated runtimes run against identical fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NICO_API_MODULES,NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {renderNicoLegacy,syncNicoApi} from '../scripts/sync-nico-api.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
emitNico();
emitNico('tsconfig.nico.contract.json');

test('registry is fixed and every pre-migration fixture matches its recorded hash',()=>{
  assert.deepEqual(NICO_API_MODULES.map(s=>s.name).slice(0,2),['NVApi','LikeApi']);
  for(const key of ['id','runtime','manifest','source','emitted','fixture']){
    assert.equal(new Set(NICO_API_MODULES.map(s=>s[key])).size,NICO_API_MODULES.length,key);
  }
  for(const spec of NICO_API_MODULES){
    assert.equal(sha(read(spec.fixture)),spec.originalSha256,spec.name);
    // Task640: infra/netUtil.js was the first runtime outside nico/; Task726 adds a fixed
    // list of infra helpers. Anything else outside nico/ is still rejected.
    // Task916: two notification runtimes have exact, fixed src/ ownership.
    // Preserve the existing restricted allowlist for every other module.
    if (spec.name === 'NotificationJournal' || spec.name === 'NotificationHistoryPanel') {
      assert.equal(spec.runtime, 'src/' + spec.name + '.js');
    } else {
      assert.match(spec.runtime,/^(?:packages\/(?:lib\/src\/(?:nico\/[A-Za-z]+|infra\/(?:netUtil|sleep|env|dimport|speech|StorageWriter|CacheStorage|MediaSessionApi|bounce|AntiPrototype-js|logSafe|objUtil|Observable|workerUtil|IndexedDbStorage|CrossDomainGate)|dom\/(?:ClassListWrapper|Clipboard|domEvent|domUtil|watchResize|Fullscreen|MediaTimeline|VideoCaptureUtil)|text\/(?:reg|textUtil)|ui\/(?:PopupMessage|TextLabel)|css\/css|message\/(?:gate|messageUtil)|Emitter|uQuery)|zenza\/src\/(?:videoPlayer\/(?:createVideoElement|YouTubeWrapper|SupporterCredit|ScreenFilter|PipPageThumbnail)|Playlist\/(?:PlayListModel|RelatedVideoList|PlayListSession|VideoListModel|VideoList|VideoListItem|PlayList|VideoListItemView|VideoListView|PlayListView)|storyboard\/(?:Storyboard|StoryboardInfoModel|SeekBarThumbnail|StoryboardView|StoryboardWorker)|heatMap\/HeatMapWorker|audio\/AudioAdjuster|init\/(?:MylistPocketDetector|externalStartup|PlayerSession|PagePreviewGuard|inintCssProps|WatchPageHistory|replaceRedirectLinks)|parts\/(?:saveMymemory|FrameLayer|BaseViewComponent|CustomElements)|ShortcutKeyEmitter|ShortcutActions|menu\/HoverMenu)|components\/src\/element\/(?:BaseCommandElement|SettingPanelElement|VideoItemElement|DialogElement))|src\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer|VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog|RootDispatcher|initializer|State|CommentPlayer|_uquery|_captube|_shape|_heatsync|_gamepad|_hls))\.js$/);
    }
  }
});

test('generated runtimes and manifests are current (read-only check)',()=>{
  const results=syncNicoApi('--check');
  assert.equal(results.length,NICO_API_MODULES.length);
  assert.ok(results.every(r=>r.status==='PASS'));
});

test('legacy build directives are preserved in each runtime',()=>{
  for(const spec of NICO_API_MODULES){
    const before=read(spec.fixture),after=read(spec.runtime);
    // Task726: `import` statements only exist outside the BEGIN/END section; text
    // inside it (e.g. dimport's module loader template) is not a directive.
    const directives=t=>{
      let inSection=false;
      return t.split('\n').map(s=>s.trim()).filter(s=>{
        if(/^\/\/===BEGIN===$/.test(s)){inSection=true;return true;}
        if(/^\/\/===END===$/.test(s)){inSection=false;return true;}
        return (!inSection&&/^import\s/.test(s))||/^\/\/@(?:require|dev-require)/.test(s);
      });
    };
    const expected = directives(before);
    if (spec.name === 'PopupMessage') {
      // Task926: PopupMessage reads validated notification preferences via Config,
      // then records the same messages through NotificationJournal. Both newly
      // required runtime dependencies must be preserved in this exact order.
      expected.splice(expected.indexOf('//===BEGIN==='), 0,
        "import {Config} from '../../../../src/Config';",
        "import {NotificationJournal} from '../../../../src/NotificationJournal';");
      expected.splice(expected.indexOf('//===END==='), 0,
        '//@require Config', '//@require NotificationJournal');
    }
    assert.deepEqual(directives(after), expected, spec.name);
    // Task475: compare exported names, since legacy exports may span lines.
    const exported=t=>[...t.matchAll(/^export\s*\{([^}]*)\}/gm)]
      .flatMap(m=>m[1].split(',').map(s=>s.trim()).filter(Boolean)).sort();
    assert.deepEqual(exported(after),exported(before),spec.name+' exports');
  }
});

test('renderer rejects unexpected compiler output shapes',()=>{
  const spec=NICO_API_BY_NAME.NVApi;
  const ok='const NVApi = {\n    a: 1\n};\nexport { NVApi };\n';
  assert.ok(renderNicoLegacy(spec,ok).includes('//===BEGIN==='));
  assert.throws(()=>renderNicoLegacy(spec,'const NVApi = {\n};\nexport { Other };'),/UNEXPECTED_EXPORT/);
  assert.throws(()=>renderNicoLegacy(spec,'import x from "y";\nconst NVApi = {\n};\nexport { NVApi };'),/UNEXPECTED_OUTPUT/);
  assert.throws(()=>renderNicoLegacy(spec,'const helper = 1;\nconst NVApi = {\n};\nexport { NVApi };'),/UNEXPECTED_TOP_LEVEL/);
  assert.throws(()=>renderNicoLegacy(spec,'const NVApi = {\n};\nfetch(1);\nexport { NVApi };'),/UNEXPECTED_TOP_LEVEL/);
  assert.throws(()=>renderNicoLegacy(spec,'//===END===\nconst NVApi = {\n};\nexport { NVApi };'),/UNEXPECTED_OUTPUT/);
  assert.throws(()=>renderNicoLegacy({...spec},ok),/UNREGISTERED_NICO_API_MODULE/);
});

// ---------- NVApi parity ----------
function nvHarness(code,behavior){
  const calls=[],warns=[];
  const netUtil={fetch:(url,opts)=>{calls.push([url,opts]);return behavior();}};
  // Like the real console.warn, the fake returns undefined (legacy catch returned its value).
  const api=loadLegacy(code,'NVApi',{netUtil,console:{warn:(...a)=>{warns.push(a);}}});
  return {api,calls,warns};
}
const nvCases=[
  ['default GET',api=>api.call('https://nvapi.nicovideo.jp/v1/a')],
  ['explicit DELETE',api=>api.call('https://nvapi.nicovideo.jp/v1/a',{method:'DELETE'})],
  ['empty method falls back',api=>api.call('https://nvapi.nicovideo.jp/v1/a',{method:''})],
  ['headers follow mutable FRONT_ID',api=>{api.FRONT_ID='9';return api.call('u');}]
];
test('NVApi: identical request, response identity and failure handling',async()=>{
  const before=read(NICO_API_BY_NAME.NVApi.fixture),after=read(NICO_API_BY_NAME.NVApi.runtime);
  for(const [name,run] of nvCases){
    for(const mode of ['ok','fail']){
      const response={status:200};
      const behavior=()=>mode==='ok'?Promise.resolve(response):Promise.reject(Error('offline'));
      const a=nvHarness(before,behavior),b=nvHarness(after,behavior);
      const ra=await run(a.api),rb=await run(b.api);
      assert.equal(ra,mode==='ok'?response:undefined,name);
      assert.equal(rb,ra,name+' '+mode);
      assert.deepEqual(snapshot(b.calls),snapshot(a.calls),name);
      // Task503 deliberately improves the legacy error diagnostics: the
      // public request/response contract stays the same, but raw error
      // objects, URLs and parameters must not be printed on failure.
      if (mode === 'ok') {
        assert.deepEqual(snapshot(b.warns),snapshot(a.warns),name);
      } else {
        assert.equal(a.warns.length,1,name+' legacy warning was emitted');
        assert.deepEqual(snapshot(b.warns),[['nvapi fail']],name+' redacted warning');
      }
    }
  }
});

// ---------- LikeApi parity ----------
function likeHarness(code,response){
  const calls=[];
  const NVApi={call:(url,params)=>{calls.push([url,params]);return Promise.resolve(response);}};
  return {api:loadLegacy(code,'LikeApi',{NVApi,Object,Error,Promise}),calls};
}
const res=(status,body,{throws=false}={})=>({status,json:async()=>{
  if(throws)throw SyntaxError('bad json');return body;}});
const likeCases=[
  ['no response (network)',()=>undefined],
  ['201 with thanks',()=>res(201,{meta:{status:201},data:{thanksMessage:'ありがとう'}})],
  ['unparseable 200',()=>res(200,null,{throws:true})],
  ['unparseable 503',()=>res(503,null,{throws:true})],
  ['403 errorCode',()=>res(403,{meta:{status:403,errorCode:'FORBIDDEN'}})],
  ['meta.status not number',()=>res(500,{meta:{status:'201'}})],
  ['meta 2xx overrides http error',()=>res(500,{meta:{status:200}})],
  ['primitive body',()=>res(200,'text')],
  ['truthy non-object meta',()=>res(404,{meta:1})],
  ['null body 204',()=>res(204,null)],
  ['falsy body 200',()=>res(200,0)],
  ['zero meta status',()=>res(200,{meta:{status:0}})],
  ['missing meta',()=>res(200,{data:{}})]
];
const likeCalls=[
  ['like',api=>api.like('sm9')],
  ['unlike',api=>api.unlike('sm9')],
  ['call default',api=>api.call('so1&x=1')],
  ['call DELETE',api=>api.call('sm9','DELETE')]
];
test('LikeApi: identical URLs, results and classified errors for every response shape',async()=>{
  const before=read(NICO_API_BY_NAME.LikeApi.fixture),after=read(NICO_API_BY_NAME.LikeApi.runtime);
  let compared=0;
  for(const [caseName,make] of likeCases){
    for(const [callName,run] of likeCalls){
      const label=caseName+' / '+callName;
      const responseA=make(),responseB=make();
      const a=likeHarness(before,responseA),b=likeHarness(after,responseB);
      const ra=await settle(()=>run(a.api)),rb=await settle(()=>run(b.api));
      assert.equal(rb.ok,ra.ok,label);
      assert.deepEqual(snapshot(rb),snapshot(ra),label);
      assert.deepEqual(snapshot(b.calls),snapshot(a.calls),label);
      if(!ra.ok){
        assert.deepEqual(Object.keys(rb.error).sort(),Object.keys(ra.error).sort(),label);
        assert.ok(['NETWORK','API'].includes(rb.error.kind),label);
      }
      compared++;
    }
  }
  assert.equal(compared,likeCases.length*likeCalls.length);
});

test('LikeApi: successful body object identity is preserved (no cloning)',async()=>{
  const body={meta:{status:201},data:{thanksMessage:'x'}};
  const {api}=likeHarness(read(NICO_API_BY_NAME.LikeApi.runtime),res(201,body));
  assert.equal(await api.like('sm9'),body);
});

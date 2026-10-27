'use strict';
// Task457: root Mocha gate for TypeScript-canonical NicoNico API clients.
// Needs no TypeScript install: it checks tracked manifests against tracked files
// and runs the generated runtime against offline fakes.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const manifestDir='tools/typescript-stage1/nico-api-manifests';
const file=r=>fs.readFileSync(path.join(root,r),'utf8');
const lf=x=>x.replace(/\r\n/g,'\n');
const sha=x=>crypto.createHash('sha256').update(lf(x)).digest('hex');
const manifests=fs.readdirSync(path.join(root,manifestDir)).filter(n=>n.endsWith('.json')).sort();
const section=code=>{
  const s=code.indexOf('//===BEGIN==='),e=code.indexOf('//===END===');
  return code.slice(s+13,e);
};

describe('Task457 TypeScript NicoNico API source-of-truth',()=>{
  it('tracks NVApi and LikeApi at least',()=>{
    assert(manifests.includes('NVApi.json'));
    assert(manifests.includes('LikeApi.json'));
  });
  manifests.forEach(name=>{
    it(`${name}: source and runtime hashes are current`,()=>{
      const data=JSON.parse(file(`${manifestDir}/${name}`));
      assert.strictEqual(data.schemaVersion,1);
      assert(/^tools\/typescript-stage1\/nico-src\/[A-Za-z]+\.ts$/.test(data.source));
      // Task640: infra/netUtil.js was the first runtime outside nico/; Task726 adds a
      // fixed list of infra helpers. Anything else outside nico/ is still rejected.
      // Task916: permit only the two exact TypeScript-owned src/notification outputs.
      // Unrelated paths still require the historical narrow allowlist.
      if (name === 'NotificationJournal.json' || name === 'NotificationHistoryPanel.json') {
        assert.strictEqual(data.runtime, 'src/' + name.replace(/\.json$/, '.js'));
      } else {
        assert(/^(?:packages\/(?:lib\/src\/(?:nico\/[A-Za-z]+|infra\/(?:netUtil|sleep|env|dimport|speech|StorageWriter|CacheStorage|MediaSessionApi|bounce|AntiPrototype-js|logSafe|objUtil|Observable|workerUtil|IndexedDbStorage|CrossDomainGate)|dom\/(?:ClassListWrapper|Clipboard|domEvent|domUtil|watchResize|Fullscreen|MediaTimeline|VideoCaptureUtil)|text\/(?:reg|textUtil)|ui\/(?:PopupMessage|TextLabel)|css\/css|message\/(?:gate|messageUtil)|Emitter|uQuery)|zenza\/src\/(?:videoPlayer\/(?:createVideoElement|YouTubeWrapper|SupporterCredit|ScreenFilter|PipPageThumbnail)|Playlist\/(?:PlayListModel|RelatedVideoList|PlayListSession|VideoListModel|VideoList|VideoListItem|PlayList|VideoListItemView|VideoListView|PlayListView)|storyboard\/(?:Storyboard|StoryboardInfoModel|SeekBarThumbnail|StoryboardView|StoryboardWorker)|heatMap\/HeatMapWorker|audio\/AudioAdjuster|init\/(?:MylistPocketDetector|externalStartup|PlayerSession|PagePreviewGuard|inintCssProps|WatchPageHistory|replaceRedirectLinks)|parts\/(?:saveMymemory|FrameLayer|BaseViewComponent|CustomElements)|ShortcutKeyEmitter|ShortcutActions|menu\/HoverMenu)|components\/src\/element\/(?:BaseCommandElement|SettingPanelElement|VideoItemElement|DialogElement))|src\/(?:VideoInfo|TagListView|CommentInputPanel|CommentPanel|NicoVideoPlayer|VideoControlBar|VideoInfoPanel|NicoVideoPlayerDialog|RootDispatcher|initializer|State|CommentPlayer|_uquery|_captube|_shape|_heatsync|_gamepad|_hls))\.js$/.test(data.runtime));
      }
      assert.strictEqual(data.sourceSha256,sha(file(data.source)),
        `${data.source} was edited without running npm run nico:sync`);
      assert.strictEqual(data.runtimeSha256,sha(file(data.runtime)),
        `${data.runtime} was edited by hand; edit the TypeScript source instead`);
      const code=file(data.runtime);
      // Task966: userscript entry files (src/_xxx.js) have no //===BEGIN=== section.
      const markers=/^src\/_[a-z]+\.js$/.test(data.runtime)?0:1;
      assert.strictEqual((code.match(/\/\/===BEGIN===/g)||[]).length,markers);
      assert.strictEqual((code.match(/\/\/===END===/g)||[]).length,markers);
      assert(code.includes('// GENERATED FROM '+data.source));
    });
  });
  const loadLike=NVApi=>{
    const ctx=vm.createContext({NVApi,Object,Error,Promise});
    vm.runInContext(section(file('packages/lib/src/nico/LikeApi.js'))+';globalThis.S=LikeApi;',ctx);
    return ctx.S;
  };
  it('generated LikeApi keeps endpoint, method and error classification',async()=>{
    const calls=[];
    const api=loadLike({call:(url,params)=>{calls.push([url,params.method]);
      return Promise.resolve({status:403,json:async()=>({meta:{status:403,errorCode:'FORBIDDEN'}})});}});
    const error=await api.unlike('sm9').then(()=>null,e=>e);
    assert.deepStrictEqual(calls,[['https://nvapi.nicovideo.jp/v1/users/me/likes/items?videoId=sm9','DELETE']]);
    assert.strictEqual(error.kind,'API');
    assert.strictEqual(error.status,403);
    assert.strictEqual(error.errorCode,'FORBIDDEN');
    const missing=await loadLike({call:async()=>undefined}).like('sm9').then(()=>null,e=>e);
    assert.strictEqual(missing.kind,'NETWORK');
  });
  it('Task461 generated RecommendAPILoader keeps recipe URL and meta.status gate',async()=>{
    const urls=[],warns=[];
    const make=body=>{
      const ctx=vm.createContext({
        netUtil:{fetch:url=>{urls.push(url);return Promise.resolve({json:async()=>body});}},
        textUtil:{encodeBase64:s=>Buffer.from(s).toString('base64')},
        window:{console:{warn:(...a)=>{warns.push(a[0]);}}},JSON,Error,encodeURIComponent,Promise
      });
      vm.runInContext(section(file('packages/lib/src/nico/RecommendAPILoader.js'))+';globalThis.S=RecommendAPILoader;',ctx);
      return ctx.S;
    };
    const data={items:[]};
    assert.strictEqual(await make({meta:{status:200},data}).load({videoId:'sm9'}),data);
    const recipe=JSON.parse(Buffer.from(decodeURIComponent(urls[0].match(/recipe=([^&]+)/)[1]),'base64').toString());
    assert.deepStrictEqual(recipe,{id:'video_playlist_common',videoId:'sm9'});
    assert(urls[0].startsWith('https://nvapi.nicovideo.jp/v1/recommend?recipe='));
    const rejected=await make({meta:{status:503}}).loadSeries(1).then(()=>null,e=>e);
    assert.strictEqual(rejected.message,'load recommend fail');
    assert.deepStrictEqual(warns,['load recommend fail']);
  });
});

// Task457: allowlisted NicoNico API modules whose canonical source is TypeScript.
// Fixed paths only. Adding a module requires a new owned task, a pre-migration
// fixture, its original runtime SHA-256 and parity tests (see README).
const ROOT='tools/typescript-stage1';
// shape: 'object' => `const X = {` ... `};`, 'iife' => `const X = (() => {` ... `})();` (Task461)
//        'class'  => `class X {` ... `}` (Task475)
//        'declarations' => the exact ordered list of top-level open/close lines in
//        `topLevel` and the exported names in `exportNames` (Task643: VideoSearch, whose
//        legacy file defines several top-level symbols; Task645: parseThumbInfo, a
//        function declaration that MylistPocket injects via toString(); Task646:
//        NicoQuery, an object plus a class).
const DECLARATION_MODULES=Object.freeze(['VideoSearch','parseThumbInfo','NicoQuery','ThreadLoader','VideoInfoLoader',
  'VideoSessionWorker','sleep','speech','bounce','AntiPrototypeJs','Observable','CrossDomainGate','ClassList','watchResize','MediaTimeline','css','VideoCaptureUtil','gate','messageUtil','Emitter','uQuery',
  'createVideoElement','PlayListModel','externalStartup','PlayerSession','saveMymemory','RelatedVideoList','PlayListSession',
  'VideoListModel','VideoList','VideoListItem','PlayList',
  'VideoListItemView','VideoListView','PlayListView',
  'Storyboard','StoryboardInfoModel','SeekBarThumbnail','AudioAdjuster','inintCssProps',
  'WatchPageHistory','BaseViewComponent','replaceRedirectLinks','HoverMenu',
  'CustomElements','ShortcutKeyEmitter','YouTubeWrapper',
  'StoryboardView','HeatMapWorker','SupporterCredit','StoryboardWorker','VideoInfo',
  'ScreenFilter','TagListView','CommentInputPanel','CommentPanel','NicoVideoPlayer',
  'VideoControlBar','VideoInfoPanel','NicoVideoPlayerDialog',
  'ShortcutActions','PipPageThumbnail','BaseCommandElement','SettingPanelElement','VideoItemElement','RootDispatcher','initializer','State','CommentPlayer',
  'DialogElement']);
// Task966: 'entry' => a userscript entry file without //===BEGIN===. The ==UserScript==
// header and imports stay JS (read from the runtime file); the body is generated, must keep
// exactly `topLevel` and the build directives in `directives`, and exports nothing.
const ENTRY_MODULES=Object.freeze(['UQueryEntry','CapTubeEntry','MaskedWatchEntry','HeatSyncEntry',
  'GamePadEntry','HlsEntry']);
function api({name,runtime,originalSha256,preamble,beginLines=[],extraExports=[],task,shape='object',
  topLevel=[],exportNames=[],afterEnd=[],afterEndExports=[],directives=[]}){
  if(shape==='entry'){
    if(!ENTRY_MODULES.includes(name)||!/^src\/_[a-z]+\.js$/.test(runtime)||topLevel.length<1||exportNames.length||
      extraExports.length||afterEnd.length||afterEndExports.length||beginLines.length||(preamble||[]).length)
      throw Error('NICO_API_ENTRY_INVALID');
    return Object.freeze({
      id:'nico-'+name,name,symbol:name,shape,
      source:`${ROOT}/nico-src/${name}.ts`,
      emitted:`${ROOT}/.generated/nico/${name}.js`,
      runtime,
      manifest:`${ROOT}/nico-api-manifests/${name}.json`,
      fixture:`${ROOT}/test/fixtures/${name}.before-${task}.js`,
      originalSha256,
      header:`// GENERATED FROM ${ROOT}/nico-src/${name}.ts (${task.replace('task','Task')}). Edit the .ts and run npm run nico:sync.`,
      preamble:Object.freeze([]),beginLines:Object.freeze([]),extraExports:Object.freeze([]),
      topLevel:Object.freeze([...topLevel]),exportNames:Object.freeze([]),
      afterEnd:Object.freeze([]),afterEndExports:Object.freeze([]),
      directives:Object.freeze([...directives]),
      prefix:'NICO_API_SYNC_'+name.toUpperCase()
    });
  }
  if(ENTRY_MODULES.includes(name))throw Error('NICO_API_ENTRY_INVALID');
  if(shape!=='object'&&shape!=='iife'&&shape!=='class'&&shape!=='declarations')throw Error('NICO_API_SHAPE_INVALID');
  if(extraExports.length && (name!=='ThumbInfoLoader'||extraExports.join(',')!=='parseThumbInfo'))
    throw Error('NICO_API_EXTRA_EXPORT_INVALID');
  // Task850: uQuery keeps its module-only alias `const $ = uQuery;` after //===END=== (outside
  // the bundled section, so the userscript never gets a global `$`). Only this exact case.
  if((afterEnd.length||afterEndExports.length) &&
    (name!=='uQuery'||afterEnd.join('\n')!=='const $ = uQuery;'||afterEndExports.join(',')!=='$'))
    throw Error('NICO_API_AFTER_END_INVALID');
  const declarations=shape==='declarations';
  if(declarations!==DECLARATION_MODULES.includes(name)||
    (declarations?(topLevel.length<2||exportNames.length<1||extraExports.length>0):(topLevel.length||exportNames.length)))
    throw Error('NICO_API_DECLARATIONS_INVALID');
  return Object.freeze({
    id:'nico-'+name,
    name,
    symbol:name,
    shape,
    source:`${ROOT}/nico-src/${name}.ts`,
    emitted:`${ROOT}/.generated/nico/${name}.js`,
    runtime,
    manifest:`${ROOT}/nico-api-manifests/${name}.json`,
    fixture:`${ROOT}/test/fixtures/${name}.before-${task}.js`,
    originalSha256,
    header:`// GENERATED FROM ${ROOT}/nico-src/${name}.ts (${task.replace('task','Task')}). Edit the .ts and run npm run nico:sync.`,
    preamble:Object.freeze([...preamble]),
    beginLines:Object.freeze([...beginLines]),
    extraExports:Object.freeze([...extraExports]),
    topLevel:Object.freeze([...topLevel]),
    exportNames:Object.freeze([...exportNames]),
    afterEnd:Object.freeze([...afterEnd]),
    afterEndExports:Object.freeze([...afterEndExports]),
    prefix:'NICO_API_SYNC_'+name.toUpperCase()
  });
}
export const NICO_API_MODULES=Object.freeze([
  api({
    name:'NVApi',
    runtime:'packages/lib/src/nico/NVApi.js',
    originalSha256:'2718141c1580d12d177ba66edd2edb14e9210ea2e174e76d421e211ddd93c745',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    task:'task457'
  }),
  api({
    name:'LikeApi',
    runtime:'packages/lib/src/nico/LikeApi.js',
    originalSha256:'930e32d3d5a93c2e8e73c2a6af8dc530f2973cf68bd6b992ffcb5762a010d113',
    preamble:["import {netUtil} from '../infra/netUtil';","import {NVApi} from './NVApi';"],
    beginLines:['//@require NVApi'],
    task:'task457'
  }),
  api({
    name:'RecommendAPILoader',
    runtime:'packages/lib/src/nico/RecommendAPILoader.js',
    originalSha256:'5cbcefcc24773ac9da51c3b22bae219f0220c5fa303eda30b45e3db98b9b3fa5',
    preamble:["import {netUtil} from '../infra/netUtil';","import {textUtil} from '../text/textUtil';"],
    shape:'iife',
    task:'task461'
  }),
  api({
    name:'NVWatchCaller',
    runtime:'packages/lib/src/nico/NVWatchCaller.js',
    originalSha256:'961e477ca5184a43ea90a0ca47ba92ea7ec651c23d3271788c5910beaf6c5815',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task461'
  }),
  api({
    name:'MatrixRankingLoader',
    runtime:'packages/lib/src/nico/MatrixRankingLoader.js',
    originalSha256:'51e0d563325cc933b22c2bdf3b964c3263d81b3662ae4b675d9d239f73165936',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    task:'task461'
  }),
  api({
    name:'TagSuggestLoader',
    runtime:'packages/lib/src/nico/TagSuggestLoader.js',
    originalSha256:'926722cd126ab535b62eacb16755f60ca6a551d9db029d6bc75b16392f0311f4',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task463'
  }),
  api({
    name:'PlaylistApiLoader',
    runtime:'packages/lib/src/nico/PlaylistApiLoader.js',
    originalSha256:'3d3412abbc0957add6f0b5e1157b4f29bd4372c86945998a8df3ad5a8778cd93',
    preamble:["import {netUtil} from '../infra/netUtil';","import {CacheStorage} from '../infra/CacheStorage';"],
    shape:'iife',
    task:'task463'
  }),
  api({
    name:'NicodicArticleLoader',
    runtime:'packages/lib/src/nico/NicodicArticleLoader.js',
    originalSha256:'b71cecfe21196b39cf46ef8a107ec07d0f27d1b995281afc194001c6c301fdd2',
    preamble:["import {CacheStorage} from '../infra/CacheStorage';"],
    shape:'iife',
    task:'task466'
  }),
  api({
    name:'ThumbInfoLoader',
    runtime:'packages/lib/src/nico/ThumbInfoLoader.js',
    originalSha256:'8749cbbccd60befada30dd9b15fb490511794f60b07b7a43ec3258e04efd3869',
    preamble:["import {CrossDomainGate} from '../infra/CrossDomainGate';","import {parseThumbInfo} from './parseThumbInfo';"],
    extraExports:['parseThumbInfo'],
    shape:'iife',
    task:'task469'
  }),
  api({
    name:'OwnerSupplement',
    runtime:'packages/lib/src/nico/OwnerSupplement.js',
    originalSha256:'ce43734aa8d2e14b41e010b305a7d53456d5933c6a357179c777a8a138f5d025',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task467'
  }),
  api({
    name:'MylistApiLoader',
    runtime:'packages/lib/src/nico/MylistApiLoader.js',
    originalSha256:'2a5c8ad99827df0582bd023995a29f2b2cda7f03678d3564769531df9813419d',
    // The emitter line lives outside //===BEGIN=== in the legacy file and is kept verbatim (Task471).
    preamble:["import {netUtil} from '../infra/netUtil';","import {CacheStorage} from '../infra/CacheStorage';",
      "import {Emitter} from '../Emitter';","const emitter = new Emitter();"],
    shape:'iife',
    task:'task471'
  }),
  api({
    name:'TagEditApi',
    runtime:'packages/lib/src/nico/TagEditApi.js',
    originalSha256:'060fc47ddf88b5f5727afb2d3ae652edc7985b5d3af95dc94d432cc8ea006bd6',
    preamble:["import {util} from '../../../../src/util';"],
    shape:'class',
    task:'task475'
  }),
  api({
    name:'NicoVideoApi',
    runtime:'packages/lib/src/nico/NicoVideoApi.js',
    originalSha256:'419ce78ab6dbac0c1e45dffe03e00bd85a0404231d2d1947c3ce354ed6b666f6',
    preamble:["import {CrossDomainGate} from '../infra/CrossDomainGate';"],
    shape:'iife',
    task:'task477'
  }),
  api({
    name:'NicoRssLoader',
    runtime:'packages/lib/src/nico/NicoRssLoader.js',
    originalSha256:'dd134cbe40ec9016cf9251aee20fcf12cba5ef6e8b981a835a54aaefbe0a6825',
    preamble:["import {textUtil} from '../text/textUtil';","import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task465'
  }),
  api({
    name:'AdDecorationLoader',
    runtime:'packages/lib/src/nico/AdDecorationLoader.js',
    originalSha256:'ae6ccd5d4b51168e4ed1d72fa22be47945117a324340564affa613e230feeea5',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task468'
  }),
  api({
    name:'UaaLoader',
    runtime:'packages/lib/src/nico/UaaLoader.js',
    originalSha256:'0050f990d67d1b8141f1a4ce8b50c0ee50011eb659fb3a2eb955d5b8432f18f9',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    task:'task470'
  }),
  api({
    name:'CommonsTreeLoader',
    runtime:'packages/lib/src/nico/CommonsTreeLoader.js',
    originalSha256:'84df32912838bf165ae0458aa54e4920ca48302cceb717fcf5af0fb9dc8f7f5b',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task479'
  }),
  api({
    name:'CommentPostWire',
    runtime:'packages/lib/src/nico/CommentPostWire.js',
    originalSha256:'337c177b08d16fba132910880c0d527b5cb389c638f07cb93392681a76cb7b69',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task478'
  }),
  api({
    name:'CommentPostTarget',
    runtime:'packages/lib/src/nico/CommentPostTarget.js',
    originalSha256:'b1bb816a0afb5251dfb9ae10bd0484d3ea83f2945d630e038c129d75b8cd1eba',
    preamble:[],
    task:'task502'
  }),
  api({
    name:'CommentSubmitLifetime',
    runtime:'packages/lib/src/nico/CommentSubmitLifetime.js',
    originalSha256:'7d2be606b423dd47481751a1a84e96632cee56e2a52bbe4ee56e48c02c90eeb6',
    preamble:[],
    shape:'iife',
    task:'task505'
  }),
  api({
    name:'PlaybackPosition',
    runtime:'packages/lib/src/nico/PlaybackPosition.js',
    originalSha256:'91a4b7e888668fb41f65fc30b09456027f963695b83e0c1e3ef83c731db8edb9',
    preamble:["import {netUtil} from '../infra/netUtil';"],
    shape:'iife',
    task:'task480'
  }),
  api({
    name:'CommentReadAdapter',
    runtime:'packages/lib/src/nico/CommentReadAdapter.js',
    originalSha256:'ff58d43512d68f85980f6dc68e419a46278f27bd53acbc47ce21c3678d1d044b',
    preamble:[],
    shape:'iife',
    task:'task498'
  }),
  api({
    name:'nicoUtil',
    runtime:'packages/lib/src/nico/nicoUtil.js',
    originalSha256:'4c652342d88404f463a7b94bf304eb3c5bc47eef28423e0359ae585d1eb5f61f',
    preamble:["import {textUtil} from '../text/textUtil';"],
    task:'task508'
  }),
  api({
    name:'VideoItemObserver',
    runtime:'packages/lib/src/nico/VideoItemObserver.js',
    originalSha256:'a56791b873e222f10b4fcda92365afe3bd7667b97a359c34d84a36bbeeac5193',
    preamble:["import {ThumbInfoLoader} from './ThumbInfoLoader';", "const _ = {", "  throttle: () => {}", "};"],
    shape:'iife',
    task:'task515'
  }),
  api({
    name:'GateAPI',
    runtime:'packages/lib/src/nico/GateAPI.js',
    originalSha256:'785b514c43fb5f1a262b28a7e35c166c4afef1b7b21216b98492a0d7cdf7b313',
    // `const PRODUCT` lives outside //===BEGIN=== in the legacy file (Task481).
    // The in-body //@require gate / ThumbInfoCacheDb directives come from the TS comments.
    preamble:["import {gate} from '../message/gate';","import {ThumbInfoCacheDb} from './ThumbInfoCacheDb';",
      "import {parseThumbInfo} from './parseThumbInfo';","import {WatchInfoCacheDb} from './WatchInfoCacheDb';",
      "const PRODUCT = 'ZenzaWatch';"],
    shape:'iife',
    task:'task481'
  }),
  api({
    // Task640: the shared transport lives in infra/, not nico/ (only allowed exception).
    name:'netUtil',
    runtime:'packages/lib/src/infra/netUtil.js',
    originalSha256:'23f7d1bd280ca3fa219eb1e2feb0121833422e120af1bfb4f449173dcebc2112',
    // Task641: ajax and its jQuery/NicoVideoApi stub preamble removed (NETUTIL-AJAX-001).
    preamble:[],
    task:'task640'
  }),
  api({
    name:'StoryboardCacheDb',
    runtime:'packages/lib/src/nico/StoryboardCacheDb.js',
    originalSha256:'0e518166feab3e7b400f7e68e0a11884d1a4ef1077b7a120c56b5799ae42f79d',
    preamble:["import {IndexedDbStorage} from '../infra/IndexedDbStorage';","import {NicoVideoApi} from './loader';"],
    shape:'iife',
    task:'task642'
  }),
  api({
    name:'VideoSearch',
    runtime:'packages/lib/src/nico/VideoSearch.js',
    originalSha256:'0231c8eaf1b8cb01ddd13a2d9c948618529a36e9ab74208d2f18e7975576aec9',
    preamble:["import {CrossDomainGate} from '../infra/CrossDomainGate';",
      "import {WindowMessageEmitter} from '../message/messageUtil';",
      "import {textUtil} from '../text/textUtil';","import {sleep} from '../infra/sleep';"],
    shape:'declarations',
    topLevel:['const { NicoSearchApiV2Query, NicoSearchApiV2Loader } = (function () {','})();',
      'const parseVideoSearchSortValue = (raw) => {','};'],
    exportNames:['NicoSearchApiV2Query','NicoSearchApiV2Loader','parseVideoSearchSortValue'],
    task:'task643'
  }),
  api({
    // Task645 takes over the stalled Task493 lane from current develop.
    name:'parseThumbInfo',
    runtime:'packages/lib/src/nico/parseThumbInfo.js',
    originalSha256:'355e8d4a8b06df4ea618aef853b08f6b048454cabb131128ef2e373052a7da52',
    preamble:[],
    shape:'declarations',
    topLevel:['function parseThumbInfo(xmlText) {','}'],
    exportNames:['parseThumbInfo'],
    task:'task645'
  }),
  api({
    // Task646 takes over the stalled Task495 lane from current develop.
    name:'ThumbInfoCacheDb',
    runtime:'packages/lib/src/nico/ThumbInfoCacheDb.js',
    originalSha256:'86509acdfaf82509f5a7cb251c00310c1c3ee84f4125c53ee50ebece736bcd9b',
    preamble:["import {IndexedDbStorage} from '../infra/IndexedDbStorage';",
      "import {parseThumbInfo} from './parseThumbInfo';",
      "import {global} from '../../../../src/ZenzaWatchIndex';"],
    shape:'iife',
    task:'task646'
  }),
  api({
    // Task646 takes over the stalled (BLOCKED) Task506 lane from current develop.
    name:'WatchInfoCacheDb',
    runtime:'packages/lib/src/nico/WatchInfoCacheDb.js',
    originalSha256:'c195ab7a15a622b7625a1cc76dce7ba42bf8eedc6cb49a326a34ee9e47d1f148',
    preamble:["import {IndexedDbStorage} from '../infra/IndexedDbStorage';",
      "import {VideoInfoModel} from '../../../../src/VideoInfo';"],
    shape:'iife',
    task:'task646'
  }),
  api({
    // Task646 takes over the stalled Task523 lane from current develop.
    name:'NicoQuery',
    runtime:'packages/lib/src/nico/NicoQuery.js',
    originalSha256:'1d162276bcc8ba491cc382f41187c1b41df0571f6a02ad09fdd29a895e6172ea',
    preamble:["import {textUtil} from '../text/textUtil';","import {netUtil} from '../infra/netUtil';",
      "import {MylistApiLoader} from './MylistApiLoader';","import {RecommendAPILoader} from './RecommendAPILoader';",
      "import {NicoRssLoader} from './NicoRssLoader';","import {NicoSearchApiV2Loader} from './VideoSearch';"],
    shape:'declarations',
    topLevel:['const ItemDataConverter = {','};','class NicoQuery {','}'],
    exportNames:['NicoQuery','ItemDataConverter'],
    task:'task646'
  }),
  api({
    // Task646 takes over the stalled Task504 lane from current develop.
    name:'StoryboardInfoLoader',
    runtime:'packages/lib/src/nico/StoryboardInfoLoader.js',
    originalSha256:'dbfa84769dde25a014c8cb94be8610f611f0f07eefd6c7de1e0d940ce83b7e6f',
    preamble:["import {util} from '../../../../src/util';","import {VideoSessionWorker} from './VideoSessionWorker';"],
    task:'task646'
  }),
  api({
    // Task648 takes over the stalled comment lane (Task487-498) for the remaining body.
    // `//@require` directives stay as the first lines of the build section.
    name:'ThreadLoader',
    runtime:'packages/lib/src/nico/ThreadLoader.js',
    originalSha256:'28b3f664440864f303f60bf2d88afc0d251ab6c9593bc822113dd4b0e01e2e34',
    preamble:["import {PopupMessage} from '../ui/PopupMessage';","import {sleep} from '../infra/sleep';",
      "import {netUtil} from '../../../lib/src/infra/netUtil';","import {logSafe} from '../infra/logSafe';",
      "import {CommentPostWire} from './CommentPostWire';","import {CommentReadAdapter} from './CommentReadAdapter';",
      "","const debug = {};",""],
    beginLines:["","// Task 088（監査v2 ZW-056）: 送信内容・キー・本文・ユーザーID をログに出す時は logSafe.redact を通す",
      "//@require logSafe","//@require CommentPostWire","//@require CommentReadAdapter",""],
    shape:'declarations',
    topLevel:['const { ThreadLoader } = (() => {','})();'],
    exportNames:['ThreadLoader'],
    task:'task648'
  }),
  api({
    // Task649 takes over the stalled watch-v4 lane (Task551). The legacy file uses a
    // `function` IIFE, so the exact open line is allowlisted.
    name:'VideoInfoLoader',
    runtime:'packages/lib/src/nico/VideoInfoLoader.js',
    originalSha256:'44448848976cbbe144aff37392b17cc9462a3a67e0fff7ca40bda2458cef21d5',
    preamble:["import {netUtil} from '../infra/netUtil';","import {textUtil} from '../text/textUtil';",
      "import {nicoUtil} from '../nico/nicoUtil';","import {Emitter} from '../Emitter';",
      "import {CacheStorage} from '../infra/CacheStorage';","import {CommentPostTarget} from './CommentPostTarget';","",
      "const Config = {","  getValue: () => {}","};","","const emitter = new Emitter();","const debug = {};",""],
    beginLines:['//@require CommentPostTarget'],
    shape:'declarations',
    topLevel:['const VideoInfoLoader = (function () {','})();'],
    exportNames:['VideoInfoLoader'],
    task:'task649'
  }),
  api({
    // Task651 takes over the stalled storyboard lane. createStoryboardClasses and the
    // Worker body are stringified into the Worker, so they stay self-contained.
    name:'VideoSessionWorker',
    runtime:'packages/lib/src/nico/VideoSessionWorker.js',
    originalSha256:'7c9b4492546baad66b9d48d555bf1ffba7ca90e1635813bf67f3393602ef0274',
    preamble:["import {workerUtil} from '../infra/workerUtil';","import {StoryboardCacheDb} from './StoryboardCacheDb';"],
    shape:'declarations',
    topLevel:['const createStoryboardClasses = (util) => {','};','const VideoSessionWorker = (() => {','})();'],
    exportNames:['VideoSessionWorker','createStoryboardClasses'],
    task:'task651'
  }),
  // Task726: infra helpers (precedent: Task640 netUtil) share this generator.
  api({
    name:'sleep',
    runtime:'packages/lib/src/infra/sleep.js',
    originalSha256:'7bd1996d5a227df3af4a520744bca1f70402e0f7770183d62b98bc241f85802e',
    preamble:[],
    shape:'declarations',
    topLevel:['const sleep = Object.assign(function (time = 0) {','}, {','});'],
    exportNames:['sleep'],
    task:'task726'
  }),
  api({
    name:'env',
    runtime:'packages/lib/src/infra/env.js',
    originalSha256:'8757d9c38f331b416f303c0122ef201ba260e3c8fe6c8b097bdfb3517c9bc3e3',
    preamble:["// import {browser} from './browser';"],
    task:'task726'
  }),
  api({
    name:'dimport',
    runtime:'packages/lib/src/infra/dimport.js',
    originalSha256:'2713dcbc65c450d22f9902a60baec609dbcef7c9cd535b8053de967276bc339d',
    preamble:[],
    shape:'iife',
    task:'task726'
  }),
  api({
    name:'speech',
    runtime:'packages/lib/src/infra/speech.js',
    originalSha256:'d0cb3251edecc386584cfecdc3e05593c522f7d1f9a85e6c42c953d379741bd5',
    preamble:[],
    shape:'declarations',
    topLevel:['class speech {','}','speech.promise = Promise.resolve();'],
    exportNames:['speech'],
    task:'task726'
  }),
  api({
    // `func` is stringified into a worker by workerUtil; keep it self-contained.
    name:'StorageWriter',
    runtime:'packages/lib/src/infra/StorageWriter.js',
    originalSha256:'84756b652b2a1bc178ce88cb6efb1a3e52b7f149b3a0e4664cd43b5231cd19d6',
    preamble:["import {workerUtil} from './workerUtil';"],
    shape:'iife',
    task:'task726'
  }),
  api({
    name:'CacheStorage',
    runtime:'packages/lib/src/infra/CacheStorage.js',
    originalSha256:'09a45aa85684381b67656d7179cfc49a95ec7d6d99bdc909495e481d6847ce58',
    preamble:["import {textUtil} from '../text/textUtil';","import {netUtil} from './netUtil';","",
      "const PRODUCT = 'TEST';","const _ = window._;"],
    shape:'iife',
    task:'task726'
  }),
  api({
    name:'MediaSessionApi',
    runtime:'packages/lib/src/infra/MediaSessionApi.js',
    originalSha256:'185e85b37c4d00bbde4bc15a1f4eace8e1fb7ca3269b14d744f1fe3c20e22080',
    preamble:["import {Emitter} from '../Emitter';"],
    shape:'iife',
    task:'task726'
  }),
  api({
    name:'bounce',
    runtime:'packages/lib/src/infra/bounce.js',
    originalSha256:'01f61f0be02efcbcbf10e4db7001ab7f83a00584e013bd261e7d052413dd5c9e',
    preamble:["import {PromiseHandler} from '../Emitter';"],
    shape:'declarations',
    topLevel:['const bounce = {','};','const throttle = (func, interval) => {','};',
      'throttle.time = (func, interval = 0) => throttle(func, interval);',
      'throttle.raf = function (func) {','}.bind({ req: null, count: 0, id: 0 });',
      'throttle.idle = (func) => {','};'],
    exportNames:['bounce','throttle'],
    task:'task726'
  }),
  api({
    // The runtime file name has a hyphen; the exported symbol is AntiPrototypeJs.
    name:'AntiPrototypeJs',
    runtime:'packages/lib/src/infra/AntiPrototype-js.js',
    originalSha256:'3c24f9df859b3dd97a970b99b34a7780e16905325e0ab7f828a651aea21cb075',
    preamble:[],
    shape:'declarations',
    topLevel:['const AntiPrototypeJs = function () {','}.bind({ promise: null });'],
    exportNames:['AntiPrototypeJs'],
    task:'task726'
  }),
  // Task782: remaining infra helpers (logSafe was deferred from Task726, T726-LOCK-001).
  api({
    name:'logSafe',
    runtime:'packages/lib/src/infra/logSafe.js',
    originalSha256:'9e19c189b260b090c1de86a24ec82557ea7a43c8451c530712be6692a380b9fb',
    preamble:[],
    shape:'iife',
    task:'task782'
  }),
  api({
    name:'objUtil',
    runtime:'packages/lib/src/infra/objUtil.js',
    originalSha256:'a04d13cf3472381e842cc1a846d6d9e82416d8cb1a8b9120378997a8dfbe6f96',
    preamble:["import {bounce} from './bounce';"],
    shape:'iife',
    task:'task782'
  }),
  api({
    name:'Observable',
    runtime:'packages/lib/src/infra/Observable.js',
    originalSha256:'92b977f26162e50f80e1cbcc56b3dd06c58c5531dee1fa87f7e075e950f55153',
    preamble:["import {Handler, PromiseHandler} from '../Emitter';"],
    shape:'declarations',
    topLevel:['const Observable = (() => {','})();',"const WindowResizeObserver = Observable.fromEvent(window, 'resize')"],
    exportNames:['Observable','WindowResizeObserver'],
    task:'task782'
  }),
  api({
    // Task783: messageWrapper and the worker funcs are stringified into Workers; they
    // stay self-contained. The module-level PID/bcast/portMap stay in the preamble.
    name:'workerUtil',
    runtime:'packages/lib/src/infra/workerUtil.js',
    originalSha256:'b09c4322f49d748fada318fb30e816946debe6b0e1aea6c2cde27d983fb8b92f',
    preamble:["import {netUtil} from './netUtil';","// import {globalEmitter} from '../../../../src/ZenzaWatchIndex';",
      "import {Config} from '../../../../src/Config';","import {TOKEN, PRODUCT} from '../../../../src/ZenzaWatchIndex';",
      "import {PopupMessage} from '../ui/PopupMessage';","import {EmitterInitFunc} from '../Emitter';",
      "const PID = 'PID';","const bcast = {};","const portMap = {};"],
    shape:'iife',
    task:'task783'
  }),
  api({
    name:'IndexedDbStorage',
    runtime:'packages/lib/src/infra/IndexedDbStorage.js',
    originalSha256:'526a348918b6516a2829d6c68ac35ba51366db783c375be09f52450e6409c12a',
    preamble:["import {workerUtil} from './workerUtil';"],
    shape:'iife',
    task:'task783'
  }),
  api({
    // Task784: a class with a base class (`extends Emitter`), so the exact open line is
    // allowlisted. TOKEN stays a module-level constant outside the bundled section.
    name:'CrossDomainGate',
    runtime:'packages/lib/src/infra/CrossDomainGate.js',
    originalSha256:'8b03c52f3c559e81ee9e454224df89372b3b4b68955c1cb6cbdeaec1afd85a5a',
    preamble:["import {Emitter, PromiseHandler} from '../Emitter';","import { PRODUCT } from '../../../../src/ZenzaWatchIndex';",
      "import {BroadcastEmitter} from '../message/messageUtil';","","const TOKEN = 'ranbu';"],
    shape:'declarations',
    topLevel:['class CrossDomainGate extends Emitter {','}'],
    exportNames:['CrossDomainGate'],
    task:'task784'
  }),
  // Task785: dom / text / ui helpers on the same generator.
  api({
    // The runtime file is ClassListWrapper.js; the exported symbol is ClassList.
    name:'ClassList',
    runtime:'packages/lib/src/dom/ClassListWrapper.js',
    originalSha256:'a95fad662e1d20929d3c38da7e10fc868c63d7919e931dfa5ebdee5f42baa36e',
    preamble:[],
    shape:'declarations',
    topLevel:['const ClassList = function (element) {','}.bind({ map: new WeakMap() });'],
    exportNames:['ClassList'],
    task:'task785'
  }),
  api({
    name:'Clipboard',
    runtime:'packages/lib/src/dom/Clipboard.js',
    originalSha256:'ae0cd39bfa0239c7c35b3dd18c8fb0b149271bc191dfb7d0c258d2e41491f672',
    preamble:["import {Fullscreen} from './Fullscreen';"],
    task:'task785'
  }),
  api({
    name:'domEvent',
    runtime:'packages/lib/src/dom/domEvent.js',
    originalSha256:'be7f6ee7357488e1f12bf1aab9880f960a4b3a97f360ce54517108235f5c92c1',
    preamble:["import {global} from '../../../../src/ZenzaWatchIndex';"],
    task:'task785'
  }),
  api({
    name:'domUtil',
    runtime:'packages/lib/src/dom/domUtil.js',
    originalSha256:'68cdac8796e235ca5ace9d9282d893eaed767b6bde1d4a9da9b09edc25b701c1',
    preamble:[],
    shape:'class',
    task:'task785'
  }),
  api({
    name:'watchResize',
    runtime:'packages/lib/src/dom/watchResize.js',
    originalSha256:'9be9fe67df9240d4f0f552696c80b9d75fb6d9398629b56a34695421fc5b46c0',
    preamble:[],
    shape:'declarations',
    topLevel:['const watchResize = (target, callback) => {','};'],
    exportNames:['watchResize'],
    task:'task785'
  }),
  api({
    name:'Fullscreen',
    runtime:'packages/lib/src/dom/Fullscreen.js',
    originalSha256:'364cd68d5b6fd1f128a7f20a357fd5e394d8264f4086a20499f2dc56d9ee459a',
    preamble:["// import * as _ from 'lodash';","// const emitter;","import {global} from '../../../../src/ZenzaWatchIndex';",
      "import {ClassList} from './ClassListWrapper';"],
    task:'task785'
  }),
  api({
    name:'reg',
    runtime:'packages/lib/src/text/reg.js',
    originalSha256:'a86c8469090b1f232c1e5db77e7a58230721682fab1c68add7b6a6e207e42f05',
    preamble:[],
    shape:'iife',
    task:'task785'
  }),
  api({
    name:'textUtil',
    runtime:'packages/lib/src/text/textUtil.js',
    originalSha256:'19c39fa76bc3a5eb577d964aaff841554951a6dd02bf8ef37f2c148f52a0159a',
    preamble:[],
    task:'task785'
  }),
  api({
    name:'PopupMessage',
    runtime:'packages/lib/src/ui/PopupMessage.js',
    originalSha256:'a1e742fc6a39afb3a66f5d9582e812f39bb9d3b52135e9b732e240e6275f70c4',
    preamble:["import { CONSTANT } from '../../../../src/constant';","import {css} from '../css/css';",
      "import {Config} from '../../../../src/Config';",
      "import {NotificationJournal} from '../../../../src/NotificationJournal';"],
    beginLines:['//@require Config','//@require NotificationJournal'],
    shape:'iife',
    task:'task785'
  }),
  api({
    // Task786: class plus static members assigned after the class body.
    name:'MediaTimeline',
    runtime:'packages/lib/src/dom/MediaTimeline.js',
    originalSha256:'7a69c8621d08930adeb04bf9eca40900643056afcdd5efbc013effefc5a3be96',
    preamble:["import {objUtil} from '../infra/objUtil';","import {sleep} from '../infra/sleep';"],
    shape:'declarations',
    topLevel:['class MediaTimeline {','}','MediaTimeline.MAP = {','};',
      "MediaTimeline.isSharable = ('SharedArrayBuffer' in self) && ('animate' in document.documentElement);",
      "MediaTimeline.register = function (name = 'main', media = null) {",'}.bind({ map: new Map() });',
      'MediaTimeline.get = name => MediaTimeline.register(name);'],
    exportNames:['MediaTimeline'],
    task:'task786'
  }),
  api({
    name:'css',
    runtime:'packages/lib/src/css/css.js',
    originalSha256:'c4628a7ab7dbf55597f46970ae5cde5ffe4149f1f6f1b5f242c240001d1694fd',
    preamble:["// const PRODUCT = 'Zenza';","import {global} from '../../../../src/ZenzaWatchIndex';",
      "import {bounce, throttle} from '../infra/bounce';"],
    shape:'declarations',
    topLevel:['const css = (() => {','})();','const cssUtil = css;'],
    exportNames:['css','cssUtil'],
    task:'task786'
  }),
  api({
    // Task788: `func` is stringified into the TextLabel worker; keep it self-contained.
    name:'TextLabel',
    runtime:'packages/lib/src/ui/TextLabel.js',
    originalSha256:'e29dad771e7752ff94540c06116ab6a898e137832dcf0b06887638ed820296d1',
    preamble:["import {workerUtil} from '../infra/workerUtil';"],
    shape:'iife',
    task:'task788'
  }),
  api({
    name:'VideoCaptureUtil',
    runtime:'packages/lib/src/dom/VideoCaptureUtil.js',
    originalSha256:'6909b7d74baa74adc8c98462f13266e52fb71b3d49efc81fd60ca087c5060277',
    preamble:["import {createVideoElement} from '../../../zenza/src/videoPlayer/createVideoElement';",
      "import {sleep} from '../infra/sleep';","import {CrossDomainGate} from '../infra/CrossDomainGate';",
      "import {PRODUCT} from '../../../../src/ZenzaWatchIndex';"],
    shape:'declarations',
    topLevel:['const VideoCaptureUtil = (() => {','})();',
      'VideoCaptureUtil.capture = function (src, sec, { signal, timeout = 30000 } = {}) {','}.bind({});',
      'VideoCaptureUtil.initCapTube = function () {',
      '}.bind({ promises: {}, sessionId: 1, bridge: null, frameWindow: null, messageHandler: null });',
      'VideoCaptureUtil.capTube = ({ title, videoId, author }) => {','};',
      "VideoCaptureUtil.capTubeThumbnail = (width = 320, height = 180, type = 'image/webp') => {",'};'],
    exportNames:['VideoCaptureUtil'],
    task:'task788'
  }),
  // Task789: message/ (cross-domain loader side and window/broadcast messaging).
  api({
    // PRODUCT stays a module-level constant before the bundled section.
    name:'gate',
    runtime:'packages/lib/src/message/gate.js',
    originalSha256:'624d216c929061123e9c5b37025cedb30c726c601f76c2cb4e1e08568c62a7db',
    preamble:["const PRODUCT = 'ZenzaWatch';","import {workerUtil} from '../infra/workerUtil';","/*","post = {",
      "  id: 'PRODUCT',","  type: 'nicovideoApi',","  token: 22222,","  sessionId: 11111,","  url: location.href,",
      "  body: {command: 'hello', params: {}, status: 'ok'},","}","*/"],
    shape:'declarations',
    topLevel:['const gate = () => {','};'],
    exportNames:['gate'],
    task:'task789'
  }),
  api({
    name:'messageUtil',
    runtime:'packages/lib/src/message/messageUtil.js',
    originalSha256:'f509a7e49aa1801db1a3fa367b1bdd65dc54d0ac238b34d69756a89c1bae0b2f',
    preamble:["import {Emitter} from '../Emitter';","import {global, PRODUCT} from '../../../../src/ZenzaWatchIndex';",
      "import {Config} from '../../../../src/Config';","import {NicoVideoApi} from '../nico/NicoVideoApi';",""],
    shape:'declarations',
    topLevel:['const messageUtil = {};',
      'const WindowMessageEmitter = messageUtil.WindowMessageEmitter = ((safeOrigins = []) => {',
      "})(['http://ext.nicovideo.jp', 'https://ext.nicovideo.jp']);",
      'const BroadcastEmitter = messageUtil.BroadcastEmitter = (() => {','})();'],
    exportNames:['messageUtil','BroadcastEmitter','WindowMessageEmitter'],
    task:'task789'
  }),
  api({
    // Task800: EmitterInitFunc is injected into workers via toString(); keep it a
    // self-contained function declaration (tests also locate it by that name).
    name:'Emitter',
    runtime:'packages/lib/src/Emitter.js',
    originalSha256:'5557027aa40f1635bfb2f82389f68d5c68387abc08547ad7ee6c2b3538c5478a',
    preamble:[],
    shape:'declarations',
    topLevel:['function EmitterInitFunc() {','}','const { Handler, PromiseHandler, Emitter } = EmitterInitFunc();'],
    exportNames:['EmitterInitFunc','Handler','PromiseHandler','Emitter'],
    task:'task800'
  }),
  api({
    // Task850: `$` stays a module-only alias after //===END=== (see afterEnd in api()).
    name:'uQuery',
    runtime:'packages/lib/src/uQuery.js',
    originalSha256:'e14b74a3259db8f81151ba1b17f5c44309d831046f5dbcb9d5165ed9f0cfd489',
    preamble:['','','// Arrayを継承したjQuery劣化版','//','// walkから全要素に適用できる',
      "// $('div').find('.thumbnail').walk.src = '';","// $('.message').walk.textContent = 'hello';",
      "// $('span').walk.style.color = 'blue';","import {bounce, throttle} from './infra/bounce';",
      "import {Emitter, PromiseHandler} from './Emitter';"],
    shape:'declarations',
    topLevel:['const uQuery = (() => {','})();','const uq = uQuery;'],
    exportNames:['uQuery','uq'],
    afterEnd:['const $ = uQuery;'],
    afterEndExports:['$'],
    task:'task850'
  }),
  // Task851: small packages/zenza modules (dev build only) on the same generator.
  api({
    name:"createVideoElement",
    runtime:"packages/zenza/src/videoPlayer/createVideoElement.js",
    originalSha256:"c548ca818eba1c154d8eb2b62fbb4e561b9220b2b18efa195de36d1abe48993f",
    preamble:["import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';"],
    shape:"declarations",
    topLevel:["const createVideoElement = (...args) => {","};"],
    exportNames:["createVideoElement"],
    task:'task851'
  }),
  api({
    name:"PlayListModel",
    runtime:"packages/zenza/src/Playlist/PlayListModel.js",
    originalSha256:"e04444b8a1ff3ea624b74e6ac6a2bf221e820d2434cd6bb715443cf660aa7fb1",
    preamble:["import {VideoListModel} from './VideoListModel';"],
    shape:"declarations",
    topLevel:["class PlayListModel extends VideoListModel {","}"],
    exportNames:["PlayListModel"],
    task:'task851'
  }),
  api({
    name:"MylistPocketDetector",
    runtime:"packages/zenza/src/init/MylistPocketDetector.js",
    originalSha256:"9074597a9699788071593742f08922dbb79d5ca6bab078a22930c3bd641f499d",
    preamble:[],
    shape:"iife",
    task:'task851'
  }),
  api({
    name:"externalStartup",
    runtime:"packages/zenza/src/init/externalStartup.js",
    originalSha256:"4ed43db9bc002502bc1efdaf698e2b505774fadb5e0692d3b81be6668620897f",
    preamble:["// Initialize the external-domain player without making Google search wait","// for the cross-domain configuration/login bridge (which may be blocked)."],
    shape:"declarations",
    topLevel:["const initializeExternalSite = ({ host, pathname, initializePlayer, connect, readUser, onError = () => { } }) => {","};"],
    exportNames:["initializeExternalSite"],
    task:'task851'
  }),
  api({
    name:"PlayerSession",
    runtime:"packages/zenza/src/init/PlayerSession.js",
    originalSha256:"950b637c772fb48b511a4d8254dcd5e2c6e9bc069fc4531688e815f4c4a020d9",
    preamble:["import {PRODUCT} from '../../../../src/ZenzaWatchIndex';"],
    shape:"declarations",
    topLevel:["const PlayerSession = {","};","PlayerSession.KEY = `ZenzaWatch_PlayingStatus`;"],
    exportNames:["PlayerSession"],
    task:'task851'
  }),
  api({
    name:"saveMymemory",
    runtime:"packages/zenza/src/parts/saveMymemory.js",
    originalSha256:"4eaecf62a393ca87e329bc8084b9fac403b09d28c10f58cf7b72b4dd628c828b",
    preamble:["import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';",""],
    shape:"declarations",
    topLevel:["/*","const saveMymemory = (player, videoInfo) => {","};"],
    exportNames:["saveMymemory"],
    task:'task851'
  }),
  api({
    name:"RelatedVideoList",
    runtime:"packages/zenza/src/Playlist/RelatedVideoList.js",
    originalSha256:"63ae92216138d6f9a6ef28f0606537288e430b619939c1c1868e8a403faf0e82",
    preamble:["import {VideoList} from './VideoList';","import {VideoListItem} from './VideoListItem';","import {RecommendAPILoader} from '../../../lib/src/nico/RecommendAPILoader';"],
    shape:"declarations",
    topLevel:["class RelatedVideoList extends VideoList {","}"],
    exportNames:["RelatedVideoList"],
    task:'task851'
  }),
  api({
    name:"FrameLayer",
    runtime:"packages/zenza/src/parts/FrameLayer.js",
    originalSha256:"faeb680718f10a3003688881c0e241ee118f93bca6f464139d287dbe0af1617b",
    preamble:["import {PromiseHandler} from '../../../lib/src/Emitter';",""],
    shape:"class",
    task:'task851'
  }),
  api({
    name:"PagePreviewGuard",
    runtime:"packages/zenza/src/init/PagePreviewGuard.js",
    originalSha256:"44609294a03d258c0c6ad60b61850e341233279c621bbe2ea64277a229aba0f3",
    preamble:["import {nicoUtil} from '../../../lib/src/nico/nicoUtil';"],
    shape:"class",
    task:'task851'
  }),
  api({
    name:"PlayListSession",
    runtime:"packages/zenza/src/Playlist/PlayListSession.js",
    originalSha256:"c0946bf0435dff7865891caf989d15fb21eb976c1a343cb56d79dab8e4a74ead",
    preamble:[],
    shape:"declarations",
    topLevel:["const PlayListSession = ((storage) => {","})(sessionStorage);","PlayListSession.MAX_ITEMS = 10000;","PlayListSession.MIN_ITEMS = 100;","const PlaylistSession = PlayListSession;"],
    exportNames:["PlayListSession","PlaylistSession"],
    task:'task851'
  }),
  // Task852: playlist core models (dev build).
  api({
    name:"VideoListModel",
    runtime:"packages/zenza/src/Playlist/VideoListModel.js",
    originalSha256:"04b17cf62b5dafb5d4a6215a913c91be850d93c2bac42d24f589784fc41232ac",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';","import {bounce, throttle} from '../../../lib/src/infra/bounce';","import {VideoListItem} from './VideoListItem';"],
    shape:'declarations',
    topLevel:["class VideoListModel extends Emitter {","}"],
    exportNames:["VideoListModel"],
    task:'task852'
  }),
  api({
    name:"VideoList",
    runtime:"packages/zenza/src/Playlist/VideoList.js",
    originalSha256:"5a7eb4fd9ac087390a2ac401337584de8c25a2dc20dfd1dafc1fed33a944f03c",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';","import {VideoListModel} from './VideoListModel';","import {VideoListView} from './VideoListView';","import {bounce} from '../../../lib/src/infra/bounce';","import {ThumbInfoLoader} from '../../../lib/src/nico/ThumbInfoLoader';","import {AdDecorationLoader} from '../../../lib/src/nico/AdDecorationLoader';",""],
    beginLines:["//@require AdDecorationLoader"],
    shape:'declarations',
    topLevel:["class VideoList extends Emitter {","}"],
    exportNames:["VideoList"],
    task:'task852'
  }),
  api({
    name:"VideoListItem",
    runtime:"packages/zenza/src/Playlist/VideoListItem.js",
    originalSha256:"5c0127aa27b4adc4ad434f6c7924eab9675e4079ab2b72ac63010ac37963afa4",
    preamble:["import {bounce, throttle} from '../../../lib/src/infra/bounce';","import {textUtil} from '../../../lib/src/text/textUtil';"],
    shape:'declarations',
    topLevel:["/*","class VideoListItem {","}","VideoListItem._itemId = 1;"],
    exportNames:["VideoListItem"],
    task:'task852'
  }),
  // Task870: PlayList (dev build).
  api({
    name:"PlayList",
    runtime:"packages/zenza/src/Playlist/PlayList.js",
    originalSha256:"fddac2dfd8d269699523bab69836808c550bb8423efb588c594a04d62879edb0",
    preamble:["import {VideoListItem} from './VideoListItem';","import {VideoListModel} from './VideoListModel';","import {VideoListItemView} from './VideoListItemView';","import {PlayListModel} from './PlayListModel';","import {VideoList} from './VideoList';","import {RelatedVideoList} from './RelatedVideoList';","import {NicoSearchApiV2Loader} from '../../../lib/src/nico/VideoSearch';","import {PlayListSession} from './PlayListSession';","import {VideoListView} from './VideoListView';","import {PlayListView} from './PlayListView';","","import {textUtil} from '../../../lib/src/text/textUtil';","import {PlaylistApiLoader} from '../../../lib/src/nico/PlaylistApiLoader';","import {MylistApiLoader} from '../../../lib/src/nico/MylistApiLoader';"],
    beginLines:["//@require VideoListItem","//@require VideoListModel","//@require VideoListItemView","//@require PlayListModel","//@require VideoList","//@require RelatedVideoList","//@require PlayListSession","//@require VideoListView","//@require PlayListView"],
    shape:'declarations',
    topLevel:["class PlayList extends VideoList {","}","/* Task 073: 検索でプレイリストに読み込む最大件数。本家検索API(nvapi)の上限が5000件。 */","PlayList.DETAIL_CONCURRENCY = 2;","PlayList.DETAIL_FILL_DELAY_MS = 200;","PlayList.SEARCH_LIMIT_DEFAULT = 1000; // Task 193: 設定の初期値（search.limit）と同じ","PlayList.SEARCH_LIMIT_MIN = 1;","PlayList.SEARCH_LIMIT_MAX = 5000;"],
    exportNames:["PlayList","PlayListSession","VideoListItem","VideoListModel","VideoListItemView","VideoListView","PlayListView","PlayListModel","VideoList","RelatedVideoList"],
    task:'task870'
  }),
  // Task900: playlist views (dev build).
  api({
    name:"VideoListItemView",
    runtime:"packages/zenza/src/Playlist/VideoListItemView.js",
    originalSha256:"dcb1b1aad8cbab7fc6763f3ffc7cf8650cc71c55a3f9bbc3e2434e4c7ff4e29f",
    preamble:["import {textUtil} from '../../../lib/src/text/textUtil';","import {dll} from '../../../components/src/dll';"],
    shape:'declarations',
    topLevel:["class VideoListItemView {","}","VideoListItemView.map = new WeakMap;"],
    exportNames:["VideoListItemView"],
    task:'task900'
  }),
  api({
    name:"VideoListView",
    runtime:"packages/zenza/src/Playlist/VideoListView.js",
    originalSha256:"acd32dcdebe1801eded23ff79ade947cf1934b3ad09b8b7e2323d6560a76e031",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';","import {bounce} from '../../../lib/src/infra/bounce';","import {cssUtil} from '../../../lib/src/css/css';","import {uq} from '../../../lib/src/uQuery';","import {ClassList} from '../../../lib/src/dom/ClassListWrapper';","import {sleep} from '../../../lib/src/infra/sleep';","import {VideoListItemView} from './VideoListItemView';","import {MylistPocketDetector} from '../init/MylistPocketDetector.js';","import {CONSTANT} from '../../../../src/constant';","import {FrameLayer} from '../parts/FrameLayer';","import {dll} from '../../../components/src/dll';",""],
    shape:'declarations',
    topLevel:["class VideoListView extends Emitter {","}","VideoListView.__tpl__ = (`","<!DOCTYPE html>","<html lang=\"ja\">","<head>","<meta charset=\"utf-8\">","<title>VideoList</title>","<style type=\"text/css\">","</style>","<style id=\"listItemStyle\">%CSS%</style>","<body class=\"zenzaRoot\">","<div id=\"listContainer\">","</div>","<div class=\"scrollToActive command\" title=\"いまここ\" data-command=\"scrollToActiveItem\">&#9658;</div>","<div class=\"scrollToTop command\" title=\"一番上にスクロール\" data-command=\"scrollToTop\">&#x2303;</div>","</body>","</html>"],
    exportNames:["VideoListView"],
    task:'task900'
  }),
  api({
    name:"PlayListView",
    runtime:"packages/zenza/src/Playlist/PlayListView.js",
    originalSha256:"b7a1fa434cc2c74fa4a2d553cd97423cfc063d16e2cc5caf8867499b98247b80",
    preamble:["import {VideoListView} from './VideoListView';","","import {Emitter} from '../../../lib/src/Emitter';","import {cssUtil} from '../../../lib/src/css/css';","import {ClassList} from '../../../lib/src/dom/ClassListWrapper';","import {uq} from '../../../lib/src/uQuery';","import {global} from '../../../../src/ZenzaWatchIndex';",""],
    shape:'declarations',
    topLevel:["class PlayListView extends Emitter {","}","PlayListView.__css__ = (`","PlayListView.__tpl__ = (`"],
    exportNames:["PlayListView"],
    task:'task900'
  }),
  // Task901: storyboard, audio adjuster and css-prop init (dev build).
  api({
    name:"Storyboard",
    runtime:"packages/zenza/src/storyboard/Storyboard.js",
    originalSha256:"d10c5e59db5531afef83c0e8949aaa12588fbc1126735b7324f10f9d645ff3bd",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';","import {StoryboardInfoLoader} from '../../../lib/src/nico/StoryboardInfoLoader';","import {StoryboardView} from './StoryboardView';","import {StoryboardInfoModel} from './StoryboardInfoModel';","import {SeekBarThumbnail} from './SeekBarThumbnail';","import {StoryboardWorker} from './StoryboardWorker';","import {global} from '../../../../src/ZenzaWatchIndex';","import {ClassList} from '../../../lib/src/dom/ClassListWrapper';",""],
    beginLines:["//@require StoryboardInfoModel","//@require StoryboardView","//@require SeekBarThumbnail","//@require StoryboardWorker"],
    shape:'declarations',
    topLevel:["class Storyboard extends Emitter {","}"],
    exportNames:["Storyboard","SeekBarThumbnail","StoryboardWorker"],
    task:'task901'
  }),
  api({
    name:"StoryboardInfoModel",
    runtime:"packages/zenza/src/storyboard/StoryboardInfoModel.js",
    originalSha256:"c213fa61d5e0bacc41abc8962673d45998abea92c3bd2a3db38048093a546596",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';"],
    shape:'declarations',
    topLevel:["class StoryboardInfoModel extends Emitter {","}"],
    exportNames:["StoryboardInfoModel"],
    task:'task901'
  }),
  api({
    name:"SeekBarThumbnail",
    runtime:"packages/zenza/src/storyboard/SeekBarThumbnail.js",
    originalSha256:"859f3d9a9f42f06353fba61f28e786d1b409d4f35ff1a84ea953ebf827e2d55e",
    preamble:["import {cssUtil} from '../../../lib/src/css/css';","import {uQuery} from '../../../lib/src/uQuery';","import {global} from '../../../../src/ZenzaWatchIndex';","import {StoryboardWorker} from './StoryboardWorker';","import {ClassList} from '../../../lib/src/dom/ClassListWrapper';"],
    shape:'declarations',
    topLevel:["class SeekBarThumbnail {","}","SeekBarThumbnail.BASE_WIDTH = 160;","SeekBarThumbnail.BASE_HEIGHT = 90;","SeekBarThumbnail.__tpl__ = (`","`).trim();","SeekBarThumbnail.__css__ = (`","`).trim();"],
    exportNames:["SeekBarThumbnail"],
    task:'task901'
  }),
  api({
    name:"AudioAdjuster",
    runtime:"packages/zenza/src/audio/AudioAdjuster.js",
    originalSha256:"d7dacfd7569818b80877f9b0a20c23f16bc5971f139e508cb624f460d8652a48",
    preamble:[],
    shape:'declarations',
    topLevel:["/*","const AudioAdjuster = (() => {","})();","/*","AudioAdjuster.register({","});"],
    exportNames:["AudioAdjuster"],
    task:'task901'
  }),
  api({
    name:"inintCssProps",
    runtime:"packages/zenza/src/init/inintCssProps.js",
    originalSha256:"9fb388e879fc540822f299c212b7e8853487b8992e8223a2a1f1f63fe26c6208",
    preamble:["import {cssUtil} from '../../../lib/src/css/css';","import {CONSTANT} from '../../../../src/constant';","import {global} from '../../../../src/ZenzaWatchIndex';"],
    shape:'declarations',
    topLevel:["const initCssProps = (win) => {","};"],
    exportNames:["initCssProps"],
    task:'task901'
  }),
  // ZW-NOTIFY-JOURNAL-20261023: dedicated TypeScript-canonical notification services.
  api({
    name:'NotificationJournal',
    runtime:'src/NotificationJournal.js',
    originalSha256:'55afae85195ea0a5918633cdd00dd52d88b8f74efd2fd2f47dc793e6891ab05a',
    preamble:[],
    shape:'iife',
    task:'taskNLOG20261023'
  }),
  api({
    name:'NotificationHistoryPanel',
    runtime:'src/NotificationHistoryPanel.js',
    originalSha256:'eb600e75ba3689584fbe26f07ccbe231c16b2827432ec2efc75028bb555e2e14',
    preamble:["import {NotificationJournal} from './NotificationJournal';"],
    beginLines:['//@require NotificationJournal'],
    shape:'iife',
    task:'taskNLOG20261023'
  }),
  // Task902: hover menu, base view and page helpers (dev build).
  api({
    name:"WatchPageHistory",
    runtime:"packages/zenza/src/init/WatchPageHistory.js",
    originalSha256:"75e18a9b66e94b75126789d18c90348d2eb522ee2c5abf437cdcc818b111febd",
    preamble:["import {nicoUtil} from '../../../lib/src/nico/nicoUtil';","import {PRODUCT} from '../../../../src/ZenzaWatchIndex';","const NicoVideoApi = {};",""],
    shape:'declarations',
    topLevel:["const WatchPageHistory = (() => {","})();"],
    exportNames:["WatchPageHistory"],
    task:'task902'
  }),
  api({
    name:"BaseViewComponent",
    runtime:"packages/zenza/src/parts/BaseViewComponent.js",
    originalSha256:"7fab5c2b2943f8caa6b43c5f9e25d9c54aa17fdc4073c98446ee8a4902af5b9b",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';","import {PRODUCT} from '../../../../src/ZenzaWatchIndex';","import {cssUtil} from '../../../lib/src/css/css';","import {bounce} from '../../../lib/src/infra/bounce';","import {ClassList} from '../../../lib/src/dom/ClassListWrapper';"],
    shape:'declarations',
    topLevel:["class BaseViewComponent extends Emitter {","}"],
    exportNames:["BaseViewComponent"],
    task:'task902'
  }),
  api({
    name:"replaceRedirectLinks",
    runtime:"packages/zenza/src/init/replaceRedirectLinks.js",
    originalSha256:"cafa7ce20e2014c908e2fbcf90123d29e73e3d577f3085f4d1ec6aa0161e60af",
    preamble:["import {uq} from '../../../lib/src/uQuery';","import {textUtil} from '../../../lib/src/text/textUtil';","import {cssUtil} from '../../../lib/src/css/css';","import {nicoUtil} from '../../../lib/src/nico/nicoUtil';",""],
    shape:'declarations',
    topLevel:["const replaceRedirectLinks = async () => {","};"],
    exportNames:["replaceRedirectLinks"],
    task:'task902'
  }),
  api({
    name:"HoverMenu",
    runtime:"packages/zenza/src/menu/HoverMenu.js",
    originalSha256:"c15b76744b85ae5f75a1bed53ab0d9b992ab245fe7e063536743c6eb32b2fc13",
    preamble:["import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';","import {uq} from '../../../lib/src/uQuery';","import {nicoUtil} from '../../../lib/src/nico/nicoUtil';","import {cssUtil} from '../../../lib/src/css/css';","import {PagePreviewGuard} from '../init/PagePreviewGuard';"],
    beginLines:["//@require PagePreviewGuard"],
    shape:'declarations',
    topLevel:["class HoverMenu {","}"],
    exportNames:["HoverMenu"],
    task:'task902'
  }),
  // Task960: custom elements, shortcut keys and YouTube wrapper (dev build).
  api({
    name:"CustomElements",
    runtime:"packages/zenza/src/parts/CustomElements.js",
    originalSha256:"ebeba5562f4269720cd0d5e9e5c353100f93cff41ff13bda6798ec4246a8435f",
    preamble:["// import {browser} from '../browser';","// const window = browser.window;",""],
    shape:'declarations',
    topLevel:["const CustomElements = {};","CustomElements.initialize = (() => {","*, *::after, *::before {","}",":host(.owner-comment) * {","}",".root * {","}",".root {","}",".label {","}",".root:hover .label {","}","});"],
    exportNames:["CustomElements"],
    task:'task960'
  }),
  api({
    name:"ShortcutKeyEmitter",
    runtime:"packages/zenza/src/ShortcutKeyEmitter.js",
    originalSha256:"9e68ba0215c23a2cdd4a40011bb4317e038e202a88fb001876b65dd15f6b636c",
    preamble:["import {Emitter} from '../../lib/src/Emitter';","import {SHORTCUT_ACTIONS} from './ShortcutActions';"],
    beginLines:["//@require SHORTCUT_ACTIONS"],
    shape:'declarations',
    topLevel:["class ShortcutKeyEmitter {","}"],
    exportNames:["ShortcutKeyEmitter"],
    task:'task960'
  }),
  api({
    name:"YouTubeWrapper",
    runtime:"packages/zenza/src/videoPlayer/YouTubeWrapper.js",
    originalSha256:"141f3b7151535cccf4bf81c819b50040c15942214812c41887347a1f04797394",
    preamble:["// import * as _ from 'lodash';","import {global} from '../../../../src/ZenzaWatchIndex';","import {Emitter} from '../../../lib/src/Emitter';","import {textUtil} from '../../../lib/src/text/textUtil';"],
    shape:'declarations',
    topLevel:["const { YouTubeWrapper } = (() => {","})();","global.debug.YouTubeWrapper = YouTubeWrapper;"],
    exportNames:["YouTubeWrapper"],
    task:'task960'
  }),
  // Task962: storyboard view/worker, heat map, supporter credit and video info (legacy strictness) (dev build).
  api({
    name:"StoryboardView",
    runtime:"packages/zenza/src/storyboard/StoryboardView.js",
    originalSha256:"0a44fb81d53fa303a83da3a37d3e93ff7c8d3004cf9c9e7953d6711bcea7bc5b",
    preamble:["import {Emitter} from '../../../lib/src/Emitter';","import {StoryboardInfoModel} from './StoryboardInfoModel';","import {global} from '../../../../src/ZenzaWatchIndex';","import {cssUtil} from '../../../lib/src/css/css';","import {textUtil} from '../../../lib/src/text/textUtil';","import {uq} from '../../../lib/src/uQuery';","import {domEvent} from '../../../lib/src/dom/domEvent';","import {TextLabel} from '../../../lib/src/ui/TextLabel';","import {StoryboardWorker} from './StoryboardWorker';","import {MediaTimeline} from '../../../lib/src/dom/MediaTimeline';","import {ClassList} from '../../../lib/src/dom/ClassListWrapper';","","// import {bounce} from '';"],
    shape:'declarations',
    topLevel:["class StoryboardView extends Emitter {","}","StoryboardView.__tpl__ = `","StoryboardView.__css__ = (`","`).trim();"],
    exportNames:["StoryboardView"],
    task:'task962'
  }),
  api({
    name:"HeatMapWorker",
    runtime:"packages/zenza/src/heatMap/HeatMapWorker.js",
    originalSha256:"580924190640fa0cf57a70b155be9a5e526bb3b8b4d6b5d552595bb64f36a87a",
    preamble:["import {workerUtil} from '../../../lib/src/infra/workerUtil';","import {global} from '../../../../src/ZenzaWatchIndex';","// import {WatchInfoCacheDb} from '../../../lib/src/nico/WatchInfoCacheDb';",""],
    shape:'declarations',
    topLevel:["function HeatMapInitFunc(self) {","} // end of HeatMapInitFunc","const HeatMapWorker = (() => {","})();","const HeatMap = HeatMapInitFunc({","});","const heatMapCacheEntry = (payload, currentWatchId) => {","};"],
    exportNames:["HeatMap","HeatMapWorker","heatMapCacheEntry"],
    task:'task962'
  }),
  api({
    name:"SupporterCredit",
    runtime:"packages/zenza/src/videoPlayer/SupporterCredit.js",
    originalSha256:"337984deab1563413345ba0e6cc43ce3a706dccac0161df489209c156aaaefcc",
    preamble:[],
    shape:'declarations',
    topLevel:["/*","const SupporterCredit = (() => {","})();"],
    exportNames:["SupporterCredit"],
    task:'task962'
  }),
  api({
    name:"StoryboardWorker",
    runtime:"packages/zenza/src/storyboard/StoryboardWorker.js",
    originalSha256:"516b6c9c9f604030d3cfb40f1eb6ed10987017f18f7908ddac5fe927f97a27d8",
    preamble:["import {workerUtil} from '../../../lib/src/infra/workerUtil';","import {StoryboardInfoModel} from './StoryboardInfoModel';"],
    shape:'declarations',
    topLevel:["const StoryboardWorker = (() => {","})();"],
    exportNames:["StoryboardWorker"],
    task:'task962'
  }),
  api({
    name:"VideoInfo",
    runtime:"src/VideoInfo.js",
    originalSha256:"8fe0643872460863ed2caccdca5c7415bd69aca49d1878da661cf9c72f54df04",
    preamble:["import {textUtil} from '../packages/lib/src/text/textUtil';","import {PromiseHandler} from '../packages/lib/src/Emitter';",""],
    shape:'declarations',
    topLevel:["class JSONable {","}","class DomandInfo extends JSONable {","}","class DmcInfo extends JSONable {","}","class VideoFilter {","}","class VideoInfoModel extends JSONable {","}"],
    exportNames:["DmcInfo","VideoInfoModel","VideoFilter"],
    task:'task962'
  }),
  // Task963: screen filter, tag list, comment input/panel and video player (legacy strictness) (dev build).
  api({
    name:"ScreenFilter",
    runtime:"packages/zenza/src/videoPlayer/ScreenFilter.js",
    originalSha256:"c47d2b1c3a2ef086000d14a4f14bd1f7baf17ea6de8bc5336b94a56f1fca29ed",
    preamble:[],
    shape:'declarations',
    topLevel:["/*","const ScreenFilter = (() => {","})();","/*","const ScreenFilterPanel = (() => {","})();"],
    exportNames:["ScreenFilter","ScreenFilterPanel"],
    task:'task963'
  }),
  api({
    name:"TagListView",
    runtime:"src/TagListView.js",
    originalSha256:"649a28545e4e31728b88be64ae2f47f1cdfafc94f7c62973dac48c08b5735527",
    preamble:["import {ZenzaWatch} from './ZenzaWatchIndex';","import {NicodicArticleLoader} from '../packages/lib/src/nico/loader';","import {BaseViewComponent} from '../packages/zenza/src/parts/BaseViewComponent';","import {TagEditApi} from '../packages/lib/src/nico/TagEditApi';","import {parseVideoSearchSortValue} from '../packages/lib/src/nico/VideoSearch';","import {Config} from './Config';","import {textUtil} from '../packages/lib/src/text/textUtil';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';",""],
    shape:'declarations',
    topLevel:["class TagListView extends BaseViewComponent {","}","const dicIconSvg = (left, right, opacity) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" opacity=\"' + opacity + '\">' +","TagListView.DIC_ICON_EXISTS = dicIconSvg('#d2483f', '#f0938c', '1');","TagListView.DIC_ICON_NONE = dicIconSvg('#999999', '#cccccc', '0.5');","TagListView.__shadow__ = (`","TagListView.__css__ = (`","class TagItemMenu extends HTMLElement {","}","if (window.customElements) {","}"],
    exportNames:["TagListView"],
    task:'task963'
  }),
  api({
    name:"CommentInputPanel",
    runtime:"src/CommentInputPanel.js",
    originalSha256:"6b8d08eee0ec4ef845168c27d6c6a35733cddd65ca12875dd902a6346b2bd04a",
    preamble:["import * as _ from 'lodash';","import {CONSTANT} from './constant';","import {Emitter} from './baselib';","import {css} from '../packages/lib/src/css/css';","import {uq} from '../packages/lib/src/uQuery';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';","import {UiVisibilityRegistry} from './UiVisibilityRegistry';","import {CommentSubmitLifetime} from '../packages/lib/src/nico/CommentSubmitLifetime';"],
    beginLines:["//@require UiVisibilityRegistry","//@require CommentSubmitLifetime"],
    shape:'declarations',
    topLevel:["/*","const CommandPicker = (() => {","})();","class CommentInputPanel extends Emitter {","}","CommentInputPanel.CommandPicker = CommandPicker;","CommentInputPanel.POPOVER_EDGE_MARGIN = 8;","CommentInputPanel.__css__ = (`","`).trim();","CommentInputPanel.__tpl__ = (() => {","})();"],
    exportNames:["CommentInputPanel"],
    task:'task963'
  }),
  api({
    name:"CommentPanel",
    runtime:"src/CommentPanel.js",
    originalSha256:"1d9daffb7354b5057b3dd0b509986c184266f94e1891f8df036e43945814ce94",
    preamble:["import _ from 'lodash';","import {global} from './ZenzaWatchIndex';","import {BaseViewComponent} from './util';","import {FrameLayer} from '../packages/zenza/src/parts/FrameLayer';","import {CONSTANT} from './constant';","// NICORU（ニコるアイコンの data URL）は src/_template.js の monkey 内で const として定義され、","// 連結ビルドで同じスコープに入る。どのモジュールも export していないため import では表せない（Task 087 / ZW-007）","import {Emitter} from './baselib';","import {bounce, throttle} from '../packages/lib/src/infra/bounce';","import {textUtil} from '../packages/lib/src/text/textUtil';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';","import {css} from '../packages/lib/src/css/css';","import {uq} from '../packages/lib/src/uQuery';","import {Clipboard} from '../packages/lib/src/dom/Clipboard';","import {cssUtil} from '../packages/lib/src/css/css';","import {env} from '../packages/lib/src/infra/env';","import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';",""],
    shape:'declarations',
    topLevel:["class CommentListModel extends Emitter {","}","class CommentListView extends Emitter {","}","CommentListView.ITEM_HEIGHT = 40;","CommentListView.__css__ = '';","CommentListView.__tpl__ = (`","<!DOCTYPE html>","<html lang=\"ja\">","<head>","<meta charset=\"utf-8\">","<title>CommentList</title>","<style type=\"text/css\">","/*","*/","</style>","<style id=\"listItemStyle\">%CSS%</style>","<body class=\"zenzaRoot\">","</body>","</html>","const CommentListItemView = (() => {","/*","*/","})();","class CommentListItem {","}","CommentListItem._itemId = 0;","class CommentPanelView extends Emitter {","}","CommentPanelView.__css__ = `","CommentPanelView.__tpl__ = (`","class CommentPanel extends Emitter {","}","class TimeMachineView extends BaseViewComponent {","}","TimeMachineView._shadow_ = (`","TimeMachineView.__tpl__ = ('<div class=\"TimeMachineView\"></div>').trim();"],
    exportNames:["CommentPanel"],
    task:'task963'
  }),
  api({
    name:"NicoVideoPlayer",
    runtime:"src/NicoVideoPlayer.js",
    originalSha256:"698a43dc2d2c0559dc31166c6af471de6fbf234dde3fe6346a3a82c6c630c86e",
    preamble:["import {global} from './ZenzaWatchIndex';","import {NicoCommentPlayer} from './CommentPlayer';","import {util, Config, Fullscreen, VideoCaptureUtil, BaseViewComponent} from './util';","import {YouTubeWrapper} from '../packages/zenza/src/videoPlayer/YouTubeWrapper';","import {CONSTANT} from './constant';","import {Emitter} from './baselib';","import {NicoChatFilter} from '../packages/zenza/src/commentLayer/NicoChatFilter';","import {cssUtil} from '../packages/lib/src/css/css';","import {MediaTimeline} from '../packages/lib/src/dom/MediaTimeline';","import {bounce} from '../packages/lib/src/infra/bounce';","import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';","import {AudioAdjuster} from '../packages/zenza/src/audio/AudioAdjuster';","import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';","import {SupporterCredit} from '../packages/zenza/src/videoPlayer/SupporterCredit';","import {ScreenshotFileName} from './ScreenshotFileName';",""],
    shape:'declarations',
    topLevel:["class NicoVideoPlayer extends Emitter {","}","NicoVideoPlayer.CREDIT_PRELOAD_SEC = 45;","NicoVideoPlayer.CREDIT_WAIT_MS = 5000;","class ContextMenu extends BaseViewComponent {","}","ContextMenu.__css__ = (`","ContextMenu.__tpl__ = (`","`).trim();","class VideoPlayer extends Emitter {","}","VideoPlayer.__css__ = `","class TouchWrapper extends Emitter {","}"],
    exportNames:["NicoVideoPlayer","ContextMenu","VideoPlayer"],
    task:'task963'
  }),
  // Task964: video control bar, video info panel and player dialog (legacy strictness) (dev build).
  api({
    name:"VideoControlBar",
    runtime:"src/VideoControlBar.js",
    originalSha256:"d09abbae24d0048e7b9fa3e9d28ad9d2052901457fd2107d0032f5a3c3ec5250",
    preamble:["// import * as _ from 'lodash';","import {ZenzaWatch, global} from './ZenzaWatchIndex';","import {CONSTANT} from './constant';","import {SeekBarThumbnail, Storyboard} from './StoryBoard';","import {util, BaseViewComponent} from './util';","import {Emitter} from './baselib';","import {throttle, bounce} from '../packages/lib/src/infra/bounce';","import {HeatMapWorker, heatMapCacheEntry} from '../packages/zenza/src/heatMap/HeatMapWorker';","import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';","import {TextLabel} from '../packages/lib/src/ui/TextLabel';","import {cssUtil} from '../packages/lib/src/css/css';","import {RequestAnimationFrame} from '../packages/lib/src/infra/RequestAnimationFrame';","import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';","import {VideoControlState} from './State';","import {WindowResizeObserver} from '../packages/lib/src/infra/Observable';","import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';","import {ZenzaCommentHistoryCore} from '../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js';","import {UiVisibilityRegistry} from './UiVisibilityRegistry';"],
    beginLines:["//@require ZenzaCommentHistoryCore","//@require UiVisibilityRegistry"],
    shape:'declarations',
    topLevel:["const historyTriggerKeyGuard = (event) => {","};","class VideoControlBar extends Emitter {","}","VideoControlBar.BASE_HEIGHT = CONSTANT.CONTROL_BAR_HEIGHT;","VideoControlBar.BASE_SEEKBAR_HEIGHT = 10;","util.addStyle(`","`, { className: 'videoControlBar' });","util.addStyle(`","`, { className: 'screenMode for-popup videoControlBar', disabled: true });","util.addStyle(`","`, { className: 'screenMode for-full videoControlBar', disabled: true });","util.addStyle(`","`, { className: 'screenMode for-screen-full videoControlBar', disabled: true });","VideoControlBar.__tpl__ = (`","class CommentPreviewModel extends Emitter {","}","class CommentPreviewView {","}","class CommentPreviewChatItem {","}","CommentPreviewView.MAX_HEIGHT = 200;","CommentPreviewView.WIDTH = 350;","CommentPreviewView.HOVER_WIDTH = 180;","CommentPreviewView.ITEM_HEIGHT = 20;","CommentPreviewView.__tpl__ = (`","util.addStyle(`","`, { className: 'commentPreview' });","util.addStyle(`","`, { className: 'commentPreview list' });","util.addStyle(`","`, { className: 'commentPreview hover' });","class CommentPreview {","}","class SeekBarToolTip {","}","SeekBarToolTip.__css__ = (`","SeekBarToolTip.__tpl__ = (`","class SmoothSeekBarPointer {","}","class WheelSeeker extends BaseViewComponent {","}"],
    exportNames:["VideoControlBar","HeatMapWorker","CommentPreviewModel","CommentPreviewView","CommentPreview","SeekBarToolTip"],
    task:'task964'
  }),
  api({
    name:"VideoInfoPanel",
    runtime:"src/VideoInfoPanel.js",
    originalSha256:"adefb638a20d57bf47fcb604725a2e20841a51236a2de5792cd98234af4011ce",
    preamble:["import {ZenzaWatch, global} from './ZenzaWatchIndex';","import {CONSTANT} from './constant';","import {Config} from './Config';","import {UaaLoader} from '../packages/lib/src/nico/loader';","import {RelatedVideoList} from '../packages/zenza/src/Playlist/RelatedVideoList';","import {TagListView} from './TagListView';","import {parseVideoSearchSortValue, NicoSearchApiV2Loader} from '../packages/lib/src/nico/VideoSearch';","import {TagSuggestLoader} from '../packages/lib/src/nico/TagSuggestLoader';","import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';","import {BaseViewComponent} from '../packages/zenza/src/parts/BaseViewComponent';","import {Emitter} from '../packages/lib/src/Emitter';","import {sleep} from '../packages/lib/src/infra/sleep';","import {Fullscreen} from '../packages/lib/src/dom/Fullscreen';","import {textUtil} from '../packages/lib/src/text/textUtil';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';","import {css, cssUtil} from '../packages/lib/src/css/css';","import {uq} from '../packages/lib/src/uQuery';","import {domEvent} from '../packages/lib/src/dom/domEvent';","import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';","import {MylistPocketDetector} from '../packages/zenza/src/init/MylistPocketDetector';","import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';","import {RelatedMenuOrder} from './RelatedMenuOrder';","import {UiVisibilityRegistry} from './UiVisibilityRegistry';","import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';","const VideoItemObserver = {","  observe: () => {}","};"],
    beginLines:["//@require RelatedMenuActions","//@require RelatedMenuOrder","//@require UiVisibilityRegistry","//@require OfficialPlayerRoute"],
    shape:'declarations',
    topLevel:["class VideoInfoPanel extends Emitter {","}","css.addStyle(`","css.addStyle(`","`, { className: 'screenMode for-full videoInfoPanel' });","css.addStyle(`","`, { className: 'screenMode for-popup videoInfoPanel' });","uq.ready().then(() => {","});","css.addStyle(`","`, { className: 'screenMode for-dialog videoInfoPanel' });","css.addStyle(`","`, { className: 'domain slack-com', disabled: true });","VideoInfoPanel.__tpl__ = (`","class VideoHeaderPanel extends Emitter {","}","css.addStyle(`","`, { className: 'screenMode for-popup videoHeaderPanel', disabled: true });","css.addStyle(`","`, { className: 'screenMode for-dialog videoHeaderPanel', disabled: true });","css.addStyle(`","`, { className: 'screenMode for-full videoHeaderPanel', disabled: true });","VideoHeaderPanel.__css__ = (`","VideoHeaderPanel.HOLD_LINGER_MS = 1500;","VideoHeaderPanel.__tpl__ = (`","class VideoSearchForm extends Emitter {","}","VideoSearchForm.UNORDERABLE = ['h', 'p'];","css.addStyle(`","`, { className: 'screenMode for-popup videoSearchPanel', disabled: true });","VideoSearchForm.VIDEO_ID_REG =","VideoSearchForm.MAX_VIDEO_ID_CARDS = 5;","VideoSearchForm.VIDEO_ID_SUGGEST_MODES = ['merged', 'side', 'delayed'];","VideoSearchForm.MAX_VIDEO_ID_TAGS = 10;","VideoSearchForm.VIDEO_ID_CARD_DELAY_MS = 500;","VideoSearchForm.WORD_COUNT_DELAY_MS = 300;","VideoSearchForm.WORD_COUNT_CACHE_SIZE = 200;","VideoSearchForm.__css__ = (`","VideoSearchForm.__tpl__ = (`","class UaaView extends BaseViewComponent {","}","UaaView._shadow_ = (`","UaaView.__tpl__ = ('<div class=\"uaaView\"></div>').trim();","UaaView.__css__ = (`","class RelatedInfoMenu extends BaseViewComponent {","}","RelatedInfoMenu._css_ = ('').trim();","RelatedInfoMenu._shadow_ = (`","class VideoMetaInfo extends BaseViewComponent {","}","VideoMetaInfo._css_ = ('').trim();","VideoMetaInfo._shadow_ = (`"],
    exportNames:["VideoInfoPanel","VideoHeaderPanel","VideoSearchForm","UaaView","RelatedInfoMenu","VideoMetaInfo"],
    task:'task964'
  }),
  api({
    name:"NicoVideoPlayerDialog",
    runtime:"src/NicoVideoPlayerDialog.js",
    originalSha256:"f8aee1bd20743c27ff2e5142bf08836ec1685afeb86ec8cdbd74995b08adeb89",
    preamble:["import * as $ from 'jquery';","import * as _ from 'lodash';","import {global} from './ZenzaWatchIndex';","import {CONSTANT} from './constant';","import {PlaybackPosition, VideoInfoLoader, NVWatchCaller, CommonsTreeLoader} from '../packages/lib/src/nico/loader';","import {Fullscreen, ShortcutKeyEmitter, util} from './util';","import {SHORTCUT_ACTIONS} from '../packages/zenza/src/ShortcutActions';","import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';","import {UiVisibilityRegistry} from './UiVisibilityRegistry';","import {NotificationJournal} from './NotificationJournal';","import {NotificationHistoryPanel} from './NotificationHistoryPanel';","import {RelatedMenuOrder} from './RelatedMenuOrder';","import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';","import {NicoVideoPlayer} from './NicoVideoPlayer';","import {VideoFilter, VideoInfoModel} from './VideoInfo';","import {CommentInputPanel} from './CommentInputPanel';","import {CommentPanel} from './CommentPanel';","import {VideoControlBar} from './VideoControlBar';","import {SceneSearchPlayerBinding} from '../packages/zenza/src/sceneSearch/SceneSearchPlayerBinding';","import {VideoInfoPanel} from './VideoInfoPanel';","import {PlayList, PlayListSession} from '../packages/zenza/src/Playlist/PlayList';","import {Emitter} from './baselib';","import {ThreadLoader} from '../packages/lib/src/nico/ThreadLoader';","import {sleep} from '../packages/lib/src/infra/sleep';","import {VideoSessionWorker} from '../packages/lib/src/nico/VideoSessionWorker';","import {PlayerState} from './State';","import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';","import {objUtil} from '../packages/lib/src/infra/objUtil';","import {MylistApiLoader} from '../packages/lib/src/nico/MylistApiLoader';","import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';","import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';","import {css, cssUtil} from '../packages/lib/src/css/css';","import {textUtil} from '../packages/lib/src/text/textUtil';","import {MediaSessionApi} from '../packages/lib/src/infra/MediaSessionApi';","import {LikeApi} from '../packages/lib/src/nico/LikeApi.js';","import {AudioAdjuster} from '../packages/zenza/src/audio/AudioAdjuster';","import {ScreenFilter, ScreenFilterPanel} from '../packages/zenza/src/videoPlayer/ScreenFilter';","import {ZenzaCommentHistoryCore} from '../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js';",""],
    beginLines:["//@require ZenzaCommentHistoryCore","//@require MediaSessionApi","//@require LikeApi","//@require AudioAdjuster","//@require SHORTCUT_ACTIONS","//@require RelatedMenuActions","//@require UiVisibilityRegistry","//@require RelatedMenuOrder","//@require OfficialPlayerRoute","//@require SceneSearchPlayerBinding","//@require NotificationHistoryPanel"],
    shape:'declarations',
    topLevel:["class PlayerConfig {","}","class VideoWatchOptions {","}","class NicoVideoPlayerDialogView extends Emitter {","}","util.addStyle(`","`, { className: 'screenMode for-full', disabled: true });","util.addStyle(`","`, { className: 'screenMode for-popup', disabled: true });","util.addStyle(`","body.zenzaScreenMode_sideView,","body.zenzaScreenMode_small {","}","`, { className: 'domain slack-com', disabled: true });","util.addStyle(`","`, { className: 'screenMode for-dialog', disabled: true });","util.addStyle(`","`, { className: 'zenza-open', disabled: true });","NicoVideoPlayerDialogView.__css__ = `","NicoVideoPlayerDialogView.__tpl__ = (`","class NicoVideoPlayerDialog extends Emitter {","}","class VideoHoverMenu {","}","util.addStyle(`","util.addStyle(`","VideoHoverMenu.__tpl__ = (`","class VariablesMapper {","}"],
    exportNames:["PlayerConfig","VideoWatchOptions","PlayerState","NicoVideoPlayerDialog","NicoVideoPlayerDialogView","VideoHoverMenu","VariablesMapper"],
    task:'task964'
  }),
  // Task965: shortcut actions, elements, dispatcher, initializer, state and comment player (legacy strictness) (dev build).
  api({
    name:"ShortcutActions",
    runtime:"packages/zenza/src/ShortcutActions.js",
    originalSha256:"c313e0b1cb7869d0fe7e4023d2afc3ad38688ac95d009d407ed1b1d7ea6d54a1",
    preamble:["// Task 059: ショートカットキー設定の中核モジュール。","//","// 「どんなショートカットキーが存在するか」「既定のキーは何か」「押されたら","// 何をするか」を、この1ファイルの配列 SHORTCUT_ACTIONS に集約する。","//","// 【今後、新しい機能・設定を追加するタスクへの恒久的なお願い】","// 新しい設定項目やトグル機能を追加した場合は、原則として必ずこの配列に","// 対応するショートカットキーのエントリも1つ追加すること（既定キーは","// 0 = 未設定のままでよい。ユーザーが設定パネルで自由に割り当てられる","// ようにする、という意味の追加でよい）。追加を忘れないよう、この配列の","// 直前と直後にもコメントで注意書きを置いてある。","//","// 【設計方針】","// - id: 'KEY_' + id という名前でConfig.jsのプロパティに保存される","//   （例: id='TOGGLE_PLAY' なら Config.props.KEY_TOGGLE_PLAY）。","//   これは既存(レガシー)のショートカットキーと完全に同じ命名規則・","//   同じ整数エンコード方式（keyCode + 修飾キーのビットフラグ合算）を","//   踏襲しており、後方互換性を壊さない。","// - legacy: true の項目は、ShortcutKeyEmitter.js の既存のswitch文と","//   NicoVideoPlayerDialog.js の既存のTABLEで「個別に」処理されている","//   既存ショートカット。挙動は一切変更していない（既定キーの値も","//   src/Config.jsの記述と完全に一致させてある）。","// - legacy: false（省略可）の項目は、この配列に登録するだけで","//   自動的に有効になる「汎用ショートカット」。command プロパティに","//   NicoVideoPlayerDialog.execCommand() へそのまま渡すコマンド文字列を","//   指定する。実行対象のコマンドは、既存の execCommand の switch文、","//   または RootDispatcher.js の 'toggle-<設定名>' / 'update-<設定名>'","//   汎用ハンドラで既に処理できるものを選ぶこと（真新しいコマンド文字列を","//   使う場合は、NicoVideoPlayerDialog.js か RootDispatcher.js 側に","//   対応するcaseを1行追加する必要がある。詳細は","//   claude/design-pack/67_TASK_059_SHORTCUT_KEY_SETTINGS.md 参照）。","// - defaultKey: 0 は「既定では未割り当て」を意味する。新しく追加する","//   ショートカットは、既存のキー配置と衝突しないよう、基本的に","//   defaultKey: 0（未設定）から始め、ユーザー自身が上級者向け設定パネルで","//   好きなキーを割り当てる運用にしている（B系のバグ修正と違い、勝手に","//   新しいデフォルトキーバインドを増やすとユーザーの既存の操作感覚と","//   衝突する恐れがあるため）。"],
    shape:'declarations',
    topLevel:["const KEY_MOD = {","};","const encodeKeyCombo = (e) => {","};","const KEY_NAME_TABLE = {","};","for (let i = 96; i <= 105; i++) {","}","const formatKeyCombo = (code) => {","};","const SHORTCUT_ACTIONS = [","];","const buildDefaultKeyConfig = (existingDefaults = {}) => {","};","const groupShortcutActionsByCategory = () => {","};"],
    exportNames:["SHORTCUT_ACTIONS","KEY_MOD","encodeKeyCombo","formatKeyCombo","buildDefaultKeyConfig","groupShortcutActionsByCategory"],
    task:'task965'
  }),
  api({
    name:"PipPageThumbnail",
    runtime:"packages/zenza/src/videoPlayer/PipPageThumbnail.js",
    originalSha256:"83b9266307b490bf955f0e028c3734f9230a98c5ac0e643a806dfa22f28eb94d",
    preamble:["// Task638: Native/video-with-comments PiP keeps playing the video in the floating","// window; only the *original ZenzaWatch page player* shows its thumbnail.","// A plain <img> intentionally avoids canvas readback and cross-origin CORS limits.","import {ThumbnailSourcePolicy} from '../../../lib/src/nico/ThumbnailSourcePolicy';"],
    beginLines:["//@require ThumbnailSourcePolicy"],
    shape:'declarations',
    topLevel:["const PipPageThumbnail = (() => {","})();"],
    exportNames:["PipPageThumbnail"],
    task:'task965'
  }),
  api({
    name:"BaseCommandElement",
    runtime:"packages/components/src/element/BaseCommandElement.js",
    originalSha256:"bdf493f291f04a3a788e10ac23fa2e49ffe7933eef247ca43b88e8639aabb853",
    preamble:["// import {html, render} from 'lit/html.js';","// import * as lit from 'https://esm.run/lit';","import * as lit from '../../../../node_modules/lit/html.js';","// import * as lit from 'https://esm.run/lit';","// const {html, render} = lit;","const dll = {lit};","import {util} from '../../../../src/util.js';"],
    shape:'declarations',
    topLevel:["class BaseCommandElement extends HTMLElement {","}"],
    exportNames:["BaseCommandElement"],
    task:'task965'
  }),
  api({
    name:"SettingPanelElement",
    runtime:"packages/components/src/element/SettingPanelElement.js",
    originalSha256:"bde61a3ce9e1f4094889e8286fc2867cefa052990122244017d0a0731416bfc2",
    preamble:["","import { DialogElement } from './DialogElement.js';","import { domEvent } from '../../../lib/src/dom/domEvent';","// import {textUtil} from '../../../lib/src/text/textUtil';","// import {cssUtil} from '../../../lib/src/css/css';","const dll = {};"],
    shape:'declarations',
    topLevel:["const { SettingPanelElement } = (() => {","})();"],
    exportNames:["SettingPanelElement"],
    task:'task965'
  }),
  api({
    name:"VideoItemElement",
    runtime:"packages/components/src/element/VideoItemElement.js",
    originalSha256:"6053a3bfe21ddabf9f46c03a036ac6af93150ca1d1ccd15c684f604127480333",
    preamble:["import { BaseCommandElement } from './BaseCommandElement.js';","import {textUtil} from '../../../lib/src/text/textUtil';","// import {util} from '../util/util.js';","// console.info('BaseCommandElement', BaseCommandElement);","const dll = {};"],
    shape:'declarations',
    topLevel:["const { VideoItemElement, VideoItemProps } = (() => {","})();"],
    exportNames:["VideoItemElement","VideoItemProps"],
    task:'task965'
  }),
  api({
    name:"RootDispatcher",
    runtime:"src/RootDispatcher.js",
    originalSha256:"c87ba817c6a4963a653d5ed26eebb958313b7916899c59b937f4c3bb2a2a63c8",
    preamble:["import {ZenzaWatch, PRODUCT} from './ZenzaWatchIndex';","import {PopupMessage} from './util';","import {PlayerConfig} from './NicoVideoPlayerDialog';","import {Clipboard} from '../packages/lib/src/dom/Clipboard';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';","import {CommentPictureInPicture} from '../packages/zenza/src/commentLayer/CommentPictureInPicture';","import {PipPageThumbnail} from '../packages/zenza/src/videoPlayer/PipPageThumbnail';","import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';","import {RelatedMenuOrder} from './RelatedMenuOrder';","import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';"],
    beginLines:["//@require CommentPictureInPicture","//@require PipPageThumbnail","//@require RelatedMenuOrder","//@require RelatedMenuActions"],
    shape:'declarations',
    topLevel:["const RootDispatcher = (() => {","})();"],
    exportNames:["RootDispatcher"],
    task:'task965'
  }),
  api({
    name:"initializer",
    runtime:"src/initializer.js",
    originalSha256:"286e0b76e918bd2e2380301cd0688b4228e2a0bc6a4e00f2c5671deba709e353",
    preamble:["import {ZenzaWatch, global} from './ZenzaWatchIndex';","import {","  Config,","  PlayerSession,","  util,","  WatchPageHistory","} from './util';","import {PlaylistSession} from '../packages/zenza/src/Playlist/PlayListSession';","import {NicoComment} from './CommentPlayer';","import {NicoVideoPlayerDialog, PlayerConfig, PlayerState} from './NicoVideoPlayerDialog';","import {initializeGinzaSlayer} from './GinzaSlayer';","import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';","import {CONSTANT} from './constant';","import {CustomElements} from '../packages/zenza/src/parts/CustomElements';","import {RootDispatcher} from './RootDispatcher';","import {BroadcastEmitter} from '../packages/lib/src/message/messageUtil';","import {HoverMenu} from '../packages/zenza/src/menu/HoverMenu';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';","import {replaceRedirectLinks} from '../packages/zenza/src/init/replaceRedirectLinks';","import {cssUtil} from '../packages/lib/src/css/css';","import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';","import {StoryboardWorker} from '../packages/zenza/src/storyboard/StoryboardWorker';","import {VideoSessionWorker} from '../packages/lib/src/nico/VideoSessionWorker';","import {StoryboardCacheDb} from '../packages/lib/src/nico/StoryboardCacheDb';","import {CommentLayoutWorker} from '../packages/zenza/src/commentLayer/CommentLayoutWorker';","import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';","import {domEvent} from '../packages/lib/src/dom/domEvent';","import {uq} from '../packages/lib/src/uQuery';","// import {domUtil} from '../packages/lib/src/dom/domUtil';","import {textUtil} from '../packages/lib/src/text/textUtil';","const START_PAGE_QUERY = 'hoge=fuga';",""],
    shape:'declarations',
    topLevel:["const { initialize } = (() => {","})();"],
    exportNames:["initialize"],
    task:'task965'
  }),
  api({
    name:"State",
    runtime:"src/State.js",
    originalSha256:"31b9ea39072514c933c9137b1badb692583bfb644277f60f1129a585da8dbb62",
    preamble:["import {Emitter} from './baselib';","import {global} from './ZenzaWatchIndex';","import {CONSTANT} from './constant';","import {bounce} from '../packages/lib/src/infra/bounce';","import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';"],
    shape:'declarations',
    topLevel:["class BaseState extends Emitter {","}","class PlayerState extends BaseState {","}","class VideoControlState extends BaseState {","}"],
    exportNames:["BaseState","PlayerState","VideoControlState"],
    task:'task965'
  }),
  api({
    name:"CommentPlayer",
    runtime:"src/CommentPlayer.js",
    originalSha256:"49bc7bfa40997386454d557fd6d2ff151273c720bc655077c97a4621b15ea334",
    preamble:["import * as _ from 'lodash';","import {global} from './ZenzaWatchIndex';","import {Config, PopupMessage, VideoCaptureUtil} from './util';","import {NicoScripter} from '../packages/zenza/src/commentLayer/NicoScripter';","import {SlotLayoutWorker} from '../packages/zenza/src/commentLayer/SlotLayoutWorker';","import {Emitter} from './baselib';","import {bounce} from '../packages/lib/src/infra/bounce';","import {sleep} from '../packages/lib/src/infra/sleep';","import {ZenzaCommentHistoryCore} from '../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js';","","import {CommentLayer} from '../packages/zenza/src/commentLayer/CommentLayer';","import {NicoChatFilter} from '../packages/zenza/src/commentLayer/NicoChatFilter';","import {NicoTextParser} from '../packages/zenza/src/commentLayer/NicoTextParser';","import {NicoChat} from '../packages/zenza/src/commentLayer/NicoChat';","import {NicoChatViewModel} from '../packages/zenza/src/commentLayer/NicoChatViewModel';","import {OffscreenLayer} from '../packages/zenza/src/commentLayer/OffscreenLayer';","import {NicoChatCss3View} from '../packages/zenza/src/commentLayer/NicoChatCss3View';","import {NicoChatGroup} from '../packages/zenza/src/commentLayer/NicoChatGroup';","import {NicoChatGroupViewModel} from '../packages/zenza/src/commentLayer/NicoChatGroupViewModel';","import {NicoComment} from '../packages/zenza/src/commentLayer/NicoComment';","import {NicoCommentViewModel} from '../packages/zenza/src/commentLayer/NicoCommentViewModel';","import {NicoCommentCss3PlayerView} from '../packages/zenza/src/commentLayer/NicoCommentCss3PlayerView';"],
    beginLines:["//@require ZenzaCommentHistoryCore","//@require NicoTextParser","//@require CommentLayer"],
    shape:'declarations',
    topLevel:["class NicoCommentPlayer extends Emitter {","}","NicoComment.offscreenLayer = OffscreenLayer(Config);","const updateSpeedRate = () => {","};","Config.onkey('commentSpeedRate', updateSpeedRate);","Config.onkey('autoCommentSpeedRate', updateSpeedRate);","Config.onkey('playbackRate', updateSpeedRate);","updateSpeedRate();","Object.assign(global.debug, {","});"],
    exportNames:["NicoCommentPlayer","NicoComment","NicoCommentViewModel","NicoChatGroup","NicoChatGroupViewModel","NicoChat","NicoChatViewModel","NicoCommentCss3PlayerView","NicoChatFilter"],
    task:'task965'
  }),
  // Task966: userscript entry scripts (legacy strictness) (dev build).
  api({
    name:"UQueryEntry",
    runtime:"src/_uquery.js",
    originalSha256:"c6e63907071136d1fe7be4172ceb687d4c07d006592f32aab02d36f64280a8b8",
    shape:'entry',
    topLevel:["AntiPrototypeJs().then(() => {","});"],
    directives:["//@require ../packages/lib/src/infra/AntiPrototype-js.js","//@version","//@environment","//@require ../packages/lib/src/Emitter.js","//@require bounce","//@require ../packages/lib/src/uQuery.js"],
    task:'task966'
  }),
  api({
    name:"CapTubeEntry",
    runtime:"src/_captube.js",
    originalSha256:"01a667c226c12692a98a631240f36b39429dcc2eea4e70ebbf3f842f26baf9fc",
    shape:'entry',
    topLevel:["(() => {","})();"],
    directives:["//@require EmitterInitFunc","//@require throttle","//@require cssUtil","//@require workerUtil"],
    task:'task966'
  }),
  api({
    name:"MaskedWatchEntry",
    runtime:"src/_shape.js",
    originalSha256:"640567980a330e34de593c3017fa1d5a536b391fa89f1d6ddab73fb020eddc43",
    shape:'entry',
    topLevel:["(() => {","})();"],
    directives:["//@version","//@environment","//@require throttle","//@require css"],
    task:'task966'
  }),
  api({
    name:"HeatSyncEntry",
    runtime:"src/_heatsync.js",
    originalSha256:"4bf9a6a2e1753d48f477d3a68548b7eacfec3876d1e367c95190dc2a38f7304d",
    shape:'entry',
    topLevel:["(() => {","})();"],
    directives:["//@require Emitter","//@require ZenzaDetector"],
    task:'task966'
  }),
  api({
    name:"GamePadEntry",
    runtime:"src/_gamepad.js",
    originalSha256:"77b1cf07ea3e4c8d4d8437808c98d59533f178530a32c12a45794bb0b3c67650",
    shape:'entry',
    topLevel:["(async (window) => {","})(globalThis ? globalThis.window : window);"],
    directives:["//@require ZenzaDetector"],
    task:'task966'
  }),
  api({
    name:"HlsEntry",
    runtime:"src/_hls.js",
    originalSha256:"37fe249f2bff92fb77990d2e5940e30f5a46a5212473ade3b420a349a948a722",
    shape:'entry',
    topLevel:["const HLS_JS_VERSION = '1.7.3';","const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3';","const MODULES = `","AntiPrototypeJs();","AntiPrototypeJs().then(() => {","});"],
    directives:["//@require AntiPrototypeJs","//@require Emitter","//@require workerUtil"],
    task:'task966'
  }),
  // Task966: dialog element (legacy strictness) (dev build).
  api({
    name:"DialogElement",
    runtime:"packages/components/src/element/DialogElement.js",
    originalSha256:"6f5bd9070adf70e08d21e25d271c25ede9b2f5a0d110ae0eaf6015c84505b178",
    preamble:["import { BaseCommandElement } from './BaseCommandElement.js';","import {textUtil} from '../../../lib/src/text/textUtil';","import {cssUtil} from '../../../lib/src/css/css';","const dll = {};"],
    shape:'declarations',
    topLevel:["const { DialogElement, DialogProps } = (() => {","})();"],
    exportNames:["DialogElement","DialogProps"],
    task:'task966'
  })
]);
export const NICO_API_BY_NAME=Object.freeze(
  Object.fromEntries(NICO_API_MODULES.map(spec=>[spec.name,spec])));

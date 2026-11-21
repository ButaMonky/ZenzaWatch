// ==UserScript==
// @name           ZenzaWatch
// @namespace      https://github.com/segabito/
// @description    ニコニコ動画の速くて軽い動画プレイヤー
// @match          *://www.nicovideo.jp/*
// @match          *://ext.nicovideo.jp/
// @match          *://ext.nicovideo.jp/#*
// @match          *://blog.nicovideo.jp/*
// @match          *://ch.nicovideo.jp/*
// @match          *://com.nicovideo.jp/*
// @match          *://commons.nicovideo.jp/*
// @match          *://dic.nicovideo.jp/*
// @match          *://ex.nicovideo.jp/*
// @match          *://info.nicovideo.jp/*
// @match          *://search.nicovideo.jp/*
// @match          *://uad.nicovideo.jp/*
// @match          *://snapshot.search.nicovideo.jp/*
// @match          *://*.nicovideo.jp/smile*
// @match          *://site.nicovideo.jp/*
// @match          *://anime.nicovideo.jp/*
// @match          https://www.upload.nicovideo.jp/niconico-garage/video/*
// @match          https://www.google.co.jp/search*
// @match          https://www.google.com/search*
// @match          https://*.bing.com/search*
// @match          https://feedly.com/*
// @exclude        *://ads.nicovideo.jp/*
// @exclude        *://www.nicovideo.jp/watch/*?edit=*
// @exclude        *://www.nicovideo.jp/watch/*?*zenza_official=1*
// @exclude        *://ch.nicovideo.jp/tool/*
// @exclude        *://flapi.nicovideo.jp/*
// @exclude        *://dic.nicovideo.jp/p/*
// @exclude        *://ext.nicovideo.jp/thumb/*
// @exclude        *://ext.nicovideo.jp/thumb_channel/*
// @grant          none
// @author         segabito
// @version        2.7.503-task1127
// @run-at         document-body
// @require        https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// ==/UserScript==
import {AntiPrototypeJs} from '../packages/lib/src/infra/AntiPrototype-js';
import {Emitter, Handler, EmitterInitFunc, PromiseHandler} from '../packages/lib/src/Emitter';
import {Config, NaviConfig} from './Config';
import {uQuery, uq} from '../packages/lib/src/uQuery';
import {util} from './util';
import {components} from '../packages/components/src/index';
import * as bundledPlayerUi from '../packages/components/src/dll.js';
import {PlayerState} from './State';
import {VideoInfoLoader} from '../packages/lib/src/nico/loader';
import {ThumbInfoLoader, PlaylistApiLoader, MylistApiLoader, CacheStorage, CrossDomainGate, UaaLoader, PlaybackPosition, NicoVideoApi, RecommendAPILoader, NVWatchCaller, CommonsTreeLoader, NicoRssLoader, MatrixRankingLoader} from '../packages/lib/src/nico/loader';
import {selectAutoResume} from '../packages/zenza/src/resume/AutoResumePolicy';
import {AutoResumeClearCoordinator} from '../packages/zenza/src/resume/AutoResumeClearCoordinator';
import {IndexedDbManualBookmarkBackend, ManualBookmarkRepository} from '../packages/zenza/src/resume/ManualBookmarkStore';
import {ManualBookmarkSession} from '../packages/zenza/src/resume/ManualBookmarkSession';
import {ManualBookmarkDock} from '../packages/zenza/src/resume/ManualBookmarkDock';
import {VideoInfoModel} from './VideoInfo';
import {NicoSearchApiV2Loader} from '../packages/lib/src/nico/VideoSearch';
import {TagSuggestLoader} from '../packages/lib/src/nico/TagSuggestLoader';
import {TagEditApi} from '../packages/lib/src/nico/TagEditApi';
import {StoryboardInfoLoader} from '../packages/lib/src/nico/StoryboardInfoLoader';
import {ThreadLoader} from '../packages/lib/src/nico/ThreadLoader';
import {workerUtil} from '../packages/lib/src/infra/workerUtil';
import {IndexedDbStorage} from '../packages/lib/src/infra/IndexedDbStorage';
import {GateAPI} from '../packages/lib/src/nico/GateAPI';
import {boot} from './boot';
import {YouTubeWrapper} from '../packages/zenza/src/videoPlayer/YouTubeWrapper';
import {AudioAdjuster} from '../packages/zenza/src/audio/AudioAdjuster';
import {ScreenFilter, ScreenFilterPanel} from '../packages/zenza/src/videoPlayer/ScreenFilter';
import {SupporterCredit} from '../packages/zenza/src/videoPlayer/SupporterCredit';
import {NicoVideoPlayer} from './NicoVideoPlayer';
import {StoryboardModel} from './StoryBoard';
import {VideoControlBar} from './VideoControlBar';
import {CommentPreview} from './CommentPreview';
import {SeekBarToolTip} from './SeekBarToolTip';
import {SmoothSeekBarPointer} from './SmoothSeekBarPointer';
import {NicoTextParser} from '../packages/zenza/src/commentLayer/NicoTextParser';
import {NicoCommentPlayer} from './CommentPlayer';
import {CommentLayoutWorker} from '../packages/zenza/src/commentLayer/CommentLayoutWorker';
import {SlotLayoutWorker} from '../packages/zenza/src/commentLayer/SlotLayoutWorker';
import {NicoScripter} from '../packages/zenza/src/commentLayer/NicoScripter';
import {CommentPanel} from './CommentPanel';
import {PlayList} from '../packages/zenza/src/Playlist/PlayList';
import {VideoSessionWorker} from '../packages/lib/src/nico/VideoSessionWorker';
import {StoryboardCacheDb} from '../packages/lib/src/nico/StoryboardCacheDb';
import {NicoVideoPlayerDialog} from './NicoVideoPlayerDialog';
import {RootDispatcher} from './RootDispatcher';
import {CommentInputPanel} from './CommentInputPanel';
// import {SettingPanel} from './SettingPanel';
import {TagListView} from './TagListView';
import {VideoInfoPanel} from './VideoInfoPanel';
import {VideoHeaderPanel} from './VideoHeaderPanel';
import {VideoSearchForm} from './VideoSearchForm';
import {UaaView} from './UaaView';
import {RelatedInfoMenu} from './RelatedInfoMenu';
import {VideoMetaInfo} from './VideoMetaInfo';
import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';
import {initializeGinzaSlayer} from './GinzaSlayer';
import {initialize} from './initializer';
import {initializeExternalSite} from '../packages/zenza/src/init/externalStartup';
import {CustomElements} from '../packages/zenza/src/parts/CustomElements';
import {CONSTANT} from './constant';
import {TextLabel} from '../packages/lib/src/ui/TextLabel';
import {DiagnosticConsole} from '../packages/zenza/src/diagnostics/DiagnosticConsole';
import {parseThumbInfo} from '../packages/lib/src/nico/parseThumbInfo';
import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';
import {ENV,VER} from './ZenzaWatchIndex';
import {ZenzaWatch, global, NICORU, dll, TOKEN} from './ZenzaContext';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
import {netUtil} from '../packages/lib/src/infra/netUtil';
import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
import {initCssProps} from '../packages/zenza/src/init/inintCssProps';
import {WindowResizeObserver} from '../packages/lib/src/infra/Observable';
import {dimport} from '../packages/lib/src/infra/dimport';
import {MediaTimeline} from '../packages/lib/src/dom/MediaTimeline';
import {cssUtil} from '../packages/lib/src/css/css';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {domUtil} from '../packages/lib/src/dom/domUtil';
import {createAdvancedSettingsPanel} from './_setting';
import {AdvancedSettingsController} from './AdvancedSettingsController';
import {NicodicArticleLoader} from '../packages/lib/src/nico/NicodicArticleLoader';
import {NotificationJournal} from './NotificationJournal';
import {PopupMessage} from '../packages/lib/src/ui/PopupMessage';
//@require AntiPrototypeJs
AntiPrototypeJs();
(() => {
  try {
    if (window.top === window) {
      window.ZenzaLib = { _ };
      console.log('@require', JSON.stringify({lodash: _.VERSION}));
    }
  } catch(e) {
    window.top === window && console.warn('@require failed!', location, e);
  }
})();

(function (window) {
  const self = window;
  const document = window.document;
  'use strict';
  const PRODUCT = 'ZenzaWatch';
// 公式プレイヤーがurlを書き換えてしまうので読み込んでおく
  const START_PAGE_QUERY = (location.search ? location.search.substring(1) : '');
  // Task350: a user explicitly requesting the official watch page must not
  // initialize Zenza (or any of its players/worker observers) in that tab.
  // The legacy named-window case remains for older link handlers.
  if (location.hostname === 'www.nicovideo.jp' && /^\/watch\/[^/]+/.test(location.pathname) &&
      (new URLSearchParams(location.search).get('zenza_official') === '1' ||
        window.name === 'watchGinza')) {
    if (window.name === 'watchGinza') { window.name = ''; }
    return;
  }
  // Share one observer between the serialized player and the session client.
  //@require RequestDiagnostics
  const monkey = async (_product, START_PAGE_QUERY) /*** (｀・ω・´)9m ***/ => {
    const Array = window.PureArray ? window.PureArray : window.Array;
    let console = window.console;
    let $ = window.ZenzaJQuery || window.jQuery, _ = window.ZenzaLib ? window.ZenzaLib._ : window._;
    let CONFIG = null;
    //@require ZenzaWatch
    let {dimport, workerUtil, IndexedDbStorage, Handler, PromiseHandler, Emitter, parseThumbInfo, WatchInfoCacheDb, StoryboardCacheDb, VideoSessionWorker, RequestDiagnostics} = window.ZenzaLib;
    START_PAGE_QUERY = decodeURIComponent(START_PAGE_QUERY);

    //@version
    //@environment
    //@build

    console.log(
      `%c${PRODUCT}@${ENV} v${VER}%c  (ﾟ∀ﾟ) ｾﾞﾝｻﾞ!  %cNicorü? %c田%c \n\nbuild: ${BUILD}\nplatform: ${navigator.platform}\nua: ${navigator.userAgent}`,
      'font-family: Chalkduster; font-size: 200%; background: #039393; color: #ffc; padding: 8px; text-shadow: 2px 2px #888;',
      '',
      'font-family: "Chalkboard SE", Chalkduster,HeadLineA; font-size: 24px;',
      'display: inline-block; font-size: 24px; color: transparent; background-repeat: no-repeat; background-position: center; background-size: contain;' +
      `background-image: url(${NICORU});`,
      'line-height: 1.25; font-weight: bold; '
    );

//@require Config
await Config.promise('restore');
//@require uQuery

    Object.assign(ZenzaWatch, {
      version: VER,
      // コンソールから window.ZenzaWatch.build で、今動いているビルドを
      // すぐ確認できるようにしておく（Task 039）
      build: BUILD,
      env: ENV,
      debug: {WatchInfoCacheDb, StoryboardCacheDb},
      api: {},
      init: {},
      lib: { $: window.ZenzaLib.$ || $, _ },
      external: {},
      util,
      modules: {Emitter, Handler},
      config: Config,
      emitter: new Emitter(),
      state: {},
      dll
    });
    //@require RelatedMenuActions
    // Supported integration point for trusted external userscripts.
    ZenzaWatch.relatedMenu = RelatedMenuActions;
    //@bundle bundledPlayerUi
    Object.assign(dll, bundledPlayerUi.dll);

    const Navi = {
      version: VER,
      env: ENV,
      debug: {},
      config: NaviConfig,
      emitter: new Emitter(),
      state: {}
    };
    delete window.ZenzaLib;

    if (location.host.match(/\.nicovideo\.jp$/)) {
      window.ZenzaWatch = ZenzaWatch;
      window.Navi = Navi;
    } else {
      window.ZenzaWatch = {config: ZenzaWatch.config};
      window.Navi = {config: Navi.config};
    }
    window.ZenzaWatch.emitter = ZenzaWatch.emitter = new Emitter();
    const debug = ZenzaWatch.debug;
    const emitter = ZenzaWatch.emitter;
    emitter.emitResolve('lit-html', dll.lit);

    // const modules = ZenzaWatch.modules;
//@require CONSTANT
Object.assign(global, {
  emitter, debug,
  external: ZenzaWatch.external, PRODUCT, TOKEN, CONSTANT,
  notify: msg => ZenzaWatch.external.execCommand('notify', msg),
  alert: msg => ZenzaWatch.external.execCommand('alert', msg),
  config: Config,
  api: ZenzaWatch.api,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  NICORU,
  dll
});
//@require ClassList
//@require domUtil
//@require util
ZenzaWatch.lib.$ = uQuery;
workerUtil.env({netUtil, global});
//@require initCssProps
initCssProps();
WindowResizeObserver.subscribe(({width, height}) => {
  global.innerWidth  = width;
  global.innerHeight = height;
  cssUtil.setProps(
    [document.documentElement, '--inner-width', cssUtil.number(width)],
    [document.documentElement, '--inner-height', cssUtil.number(height)]
  );
});
//@require components
//@require PlayerState
//@require VideoInfoLoader
//@require selectAutoResume
//@require AutoResumeClearCoordinator
//@require ManualBookmarkRepository
//@require ManualBookmarkSession
//@require ManualBookmarkDock
//@require VideoInfoModel
//@require NicoSearchApiV2Loader
//@require TagSuggestLoader
//@require TagEditApi
Object.assign(ZenzaWatch.api, {
  VideoInfoLoader,
  ThumbInfoLoader,
  PlaylistApiLoader,
  MylistApiLoader,
  CacheStorage,
  UaaLoader,
  PlaybackPosition,
  NicoVideoApi,
  RecommendAPILoader,
  NVWatchCaller,
  CommonsTreeLoader,
  NicoRssLoader,
  MatrixRankingLoader,
  NicoSearchApiV2Loader,
  TagSuggestLoader,
  // Task 079b: MylistPocket の動画情報パネルのタグにも大百科の有無を反映するため公開
  NicodicArticleLoader
});
ZenzaWatch.init.playlistApiLoader = PlaylistApiLoader;
ZenzaWatch.init.mylistApiLoader = MylistApiLoader;
//@require MediaTimeline
WatchInfoCacheDb.api(NicoVideoApi);
StoryboardCacheDb.api(NicoVideoApi);

//@require StoryboardInfoLoader
// ZenzaWatch.api.DmcStoryboardInfoLoader = DmcStoryboardInfoLoader;
ZenzaWatch.api.StoryboardInfoLoader = StoryboardInfoLoader;

//@require ThreadLoader

//@require YouTubeWrapper

//@require AudioAdjuster
//@require ScreenFilter
//@require SupporterCredit
//@require NicoVideoPlayer

//@require StoryboardModel

//@require VideoControlBar
//@require CommentPreview
//@require SeekBarToolTip
//@require SmoothSeekBarPointer

//@require NicoCommentPlayer

//@require CommentLayoutWorker

//@require SlotLayoutWorker

//@require NicoScripter

//@require CommentPanel

//@require PlayList

//@require NicoVideoPlayerDialog

//@require RootDispatcher

//@require CommentInputPanel

//@require TagListView

//@require VideoInfoPanel
//@require VideoHeaderPanel
//@require VideoSearchForm
//@require UaaView
//@require RelatedInfoMenu
//@require VideoMetaInfo

//@require initializeGinzaSlayer

//@require initialize
//@require initializeExternalSite
//@require createAdvancedSettingsPanel
//@require AdvancedSettingsController

//@require CustomElements

//@require TextLabel
//@require DiagnosticConsole
ZenzaWatch.modules.TextLabel = TextLabel;

    if (window.name === 'commentLayerFrame') {
      return;
    }

    // Task1052: 上級者設定「診断（上級者向け）」の詳細ログ。初期設定は OFF で、OFF の間は何も記録しない。
    DiagnosticConsole.install({
      window, config: Config, version: ZenzaWatch.version, build: ZenzaWatch.build,
      emitter: ZenzaWatch.emitter, debugRoot: ZenzaWatch.debug,
      journal: typeof NotificationJournal !== 'undefined' ? NotificationJournal : undefined
    });

    if (location.host === 'www.nicovideo.jp') {
      const advancedSettings = new AdvancedSettingsController({
        config: Config, createPanel: config => createAdvancedSettingsPanel(config, _), document,
        onError: () => PopupMessage.alert('上級者設定を開けませんでした。もう一度お試しください。')
      });
      ZenzaWatch.api.openAdvancedSettings = () => advancedSettings.open();
      ZenzaWatch.api.closeAdvancedSettings = () => advancedSettings.close();
      uq.ready().then(() => {
        if (/^\/my(?:\/|$)/.test(location.pathname)) { advancedSettings.mountEntry(); }
      });
      DiagnosticConsole.mark('ZenzaWatch の初期化（initialize）を開始');
      return initialize();
    }

    uq.ready().then(() => initializeExternalSite({
      host: location.hostname,
      pathname: location.pathname,
      initializePlayer: () => initialize(),
      connect: () => NicoVideoApi.configBridge(Config),
      readUser: async () => {
        window.console.log('%cZenzaWatch Bridge: %s', 'background: lightgreen;', location.host);
        if (document.getElementById('siteHeaderNotification')) { return; }
        const response = await NicoVideoApi.fetch('https://www.nicovideo.jp/', {credentials: 'include'});
        const html = await response.text();
        const dom = new DOMParser().parseFromString(html, 'text/html');
        // The current site may not expose the legacy #CommonHeader shape.
        const commonHeader = dom.querySelector('#CommonHeader')?.dataset?.commonHeader;
        if (!commonHeader) { return; }
        const userData = JSON.parse(commonHeader)?.initConfig?.user;
        if (!userData) { return; }
        const isLogin = !!userData.isLogin;
        const isPremium = !!userData.isPremium;
        nicoUtil.isLogin = () => isLogin;
        nicoUtil.isPremium = util.isPremium = () => isPremium;
      },
      onError: err => window.console.warn('ZenzaWatch external site bridge unavailable', err?.message || err)
    })).catch(err => window.console.warn('ZenzaWatch external initialization failed', err?.message || err));


  }; // end of monkey
(() => {
//@require dimport
//@require Emitter
//@require workerUtil
//@require IndexedDbStorage
//@require WatchInfoCacheDb
//@require parseThumbInfo
//@require StoryboardCacheDb
//@require VideoSessionWorker

  window.ZenzaLib = Object.assign(window.ZenzaLib || {}, {
    workerUtil, dimport,
    IndexedDbStorage, WatchInfoCacheDb,
    Handler, PromiseHandler, Emitter, EmitterInitFunc,
    parseThumbInfo, StoryboardCacheDb, VideoSessionWorker, RequestDiagnostics
  });
})();

//@require GateAPI

//@require boot
  boot(monkey, PRODUCT, START_PAGE_QUERY);

})(globalThis ? globalThis.window : window);
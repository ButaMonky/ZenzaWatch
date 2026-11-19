import type {ZenzaDialogRequestId} from './PlayerLifetimeTypes';
/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialog.js (Task964).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
declare const NicoVideoPlayerDialogView: typeof import('./NicoVideoPlayerDialogView').NicoVideoPlayerDialogView;
// Task1060: 役割ごとに分けたメソッド（下の for で prototype に取り付ける）。
declare const NicoVideoPlayerDialogPrefetch: typeof import('./NicoVideoPlayerDialogPrefetch').NicoVideoPlayerDialogPrefetch;
declare const NicoVideoPlayerDialogPlaylistSources: typeof import('./NicoVideoPlayerDialogPlaylistSources').NicoVideoPlayerDialogPlaylistSources;
declare const NicoVideoPlayerDialogComments: typeof import('./NicoVideoPlayerDialogComments').NicoVideoPlayerDialogComments;
declare const NicoVideoPlayerDialogResume: typeof import('./NicoVideoPlayerDialogResume').NicoVideoPlayerDialogResume;
declare const NicoVideoPlayerDialogUserActions: typeof import('./NicoVideoPlayerDialogUserActions').NicoVideoPlayerDialogUserActions;
declare const NicoVideoPlayerDialogNotifications: typeof import('./NicoVideoPlayerDialogNotifications').NicoVideoPlayerDialogNotifications;
declare const NicoVideoPlayerDialogNicoadEnd: typeof import('./NicoVideoPlayerDialogNicoadEnd').NicoVideoPlayerDialogNicoadEnd;
declare const NicoVideoPlayerDialogCommands: typeof import('./NicoVideoPlayerDialogCommands').NicoVideoPlayerDialogCommands;
// legacy-to-ts: names provided by other bundled modules
declare const AudioAdjuster: typeof import('./AudioAdjuster').AudioAdjuster;
declare const CommentPanel: typeof import('./CommentPanel').CommentPanel;
declare const Emitter: typeof import('./Emitter').Emitter;
declare const Fullscreen: typeof import('./Fullscreen').Fullscreen;
declare const MediaSessionApi: typeof import('./MediaSessionApi').MediaSessionApi;
declare const NVWatchCaller: typeof import('./NVWatchCaller').NVWatchCaller;
declare const NicoVideoPlayer: typeof import('./NicoVideoPlayer').NicoVideoPlayer;
declare const PlayList: typeof import('./PlayList').PlayList;
declare const PlayListSession: typeof import('./PlayListSession').PlayListSession;
declare const PlayerState: typeof import('./State').PlayerState;
type AutoResumeDeleted = Readonly<{videoId:string;local:'cleared';remote:'acknowledged'|'unavailable'|'failed'|'stale-video';fullyAcknowledged:boolean;retryRemote:boolean}>;
type AutoResumeClearAgent={delete(videoId:string):Promise<AutoResumeDeleted>};
declare const AutoResumeClearCoordinator:new(deps:{
  clearLocal:(videoId:string,reason:'deleted')=>Promise<unknown>;
  saveRemoteZero?:(videoId:string,seconds:0)=>Promise<unknown>;
  isLoggedIn:()=>boolean;activeVideoId?:()=>string|null|undefined;
  activeSessionToken?:()=>unknown;
})=>AutoResumeClearAgent;
declare const ScreenFilter: typeof import('./ScreenFilter').ScreenFilter;
declare const ShortcutKeyEmitter: typeof import('./ShortcutKeyEmitter').ShortcutKeyEmitter;
declare const ThreadLoader: typeof import('./ThreadLoader').ThreadLoader;
declare const ThumbInfoLoader: typeof import('./ThumbInfoLoader').ThumbInfoLoader;
declare const VideoFilter: typeof import('./VideoInfo').VideoFilter;
declare const VideoInfoLoader: typeof import('./VideoInfoLoader').VideoInfoLoader;
declare const VideoInfoModel: typeof import('./VideoInfo').VideoInfoModel;
declare const VideoSessionWorker: typeof import('./VideoSessionWorker').VideoSessionWorker;
declare const WatchInfoCacheDb: typeof import('./WatchInfoCacheDb').WatchInfoCacheDb;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const global: import('./shared-types/ZenzaGlobal').ZenzaGlobal;
declare const textUtil: typeof import('./textUtil').textUtil;
declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil;

class PlayerConfig {
  declare static instance: Loose;
  static getInstance(config?: Loose) {
    if (!PlayerConfig.instance) {
      PlayerConfig.instance = this.wrapKey(config);
    }
    return PlayerConfig.instance;
  }
  static wrapKey(config?: Loose, mode: Loose = '') {
    if (!mode && util.isGinzaWatchUrl()) {
      mode = 'ginza';
    } else if (location && location.host.indexOf('.nicovideo.jp') < 0) {
      mode = 'others';
    }
    if (!mode) { return config; }
    config.getNativeKey = (key?: Loose) => {
      switch(mode) {
        case 'ginza':
          if (['autoPlay', 'screenMode'].includes(key)) {
            return `${key}:${mode}`;
          }
        break;
        case 'others':
          if (['autoPlay', 'screenMode', 'overrideWatchLink'].includes(key)) {
            return `${key}:${mode}`;
          }
        break;
      }
      return key;
    };
    return config;
  }
}

class VideoWatchOptions {
  declare _config: Loose;
  declare _options: Loose;
  declare _watchId: Loose;
  constructor(watchId?: Loose, options?: Loose, config?: Loose) {
    this._watchId = watchId;
    this._options = options || {};
    this._config = config;
  }
  get rawData() {
    return this._options;
  }
  get eventType() {
    return this._options.eventType || '';
  }
  get query() {
    return this._options.query || {};
  }
  get videoLoadOptions() {
    let options = {
      economy: this.isEconomySelected
    };
    return options;
  }
  get mylistLoadOptions() {
    let options = {};
    let query = this.query;
    (options as Loose).shuffle = parseInt(query.shuffle, 10) === 1;
    (options as Loose).watchId = this._watchId;
    return options;
  }
  get isPlaylistStartRequest() {
    let eventType = this.eventType;
    let query = this.query;
    if (eventType !== 'click' || query.continuous !== '1') {
      return false;
    }
    if (query.playlist.type) {
      return true;
    }
    return false;
  }
  hasKey(key?: Loose) {
    return _.has(this._options, key);
  }
  get isOpenNow() {
    return this._options.openNow === true;
  }
  get isEconomySelected() {
    return _.isBoolean(this._options.economy) ?
      this._options.economy : this._config.getValue('smileVideoQuality') === 'eco';
  }
  get isAutoCloseFullScreen() {
    return !!this._options.autoCloseFullScreen;
  }
  get isReload() {
    return this._options.reloadCount > 0;
  }
  get videoServerType() {
    return this._options.videoServerType ?? this._config.getValue('videoServerType');
  }
  get isAutoZenTubeDisabled() {
    return !!this._options.isAutoZenTubeDisabled;
  }
  get reloadCount() {
    return this._options.reloadCount;
  }
  get currentTime() {
    if (_.isNumber(this._options.currentTime))
      return (parseFloat as Loose)(this._options.currentTime, 10);

    return !isNaN(this.query.from) ?
      (parseFloat as Loose)(this.query.from, 10) : 0;
  }
  createForVideoChange(options?: Loose) {
    options = options || {};
    delete this._options.economy;
    _.defaults(options, this._options);
    options.openNow = true;
    delete options.videoServerType;
    options.isAutoZenTubeDisabled = false;
    options.currentTime = 0;
    options.reloadCount = 0;
    options.query = {};
    return options;
  }
  createForReload(options?: Loose) {
    options = options || {};
    delete this._options.economy;
    options.isAutoZenTubeDisabled = typeof options.isAutoZenTubeDisabled === 'boolean' ?
      options.isAutoZenTubeDisabled : true;
    _.defaults(options, this._options);
    options.openNow = true;
    options.reloadCount = options.reloadCount ? (options.reloadCount + 1) : 1;
    options.query = {};
    return options;
  }
  createForSession(options?: Loose) {
    options = options || {};
    _.defaults(options, this._options);
    options.query = {};
    return options;
  }
}

/** Task1061: 動画を開いてからの計測（marks は開いてからの経過ms）。 */
interface DialogOpenTiming {
  started: number; videoId: string; requestId: string; used: boolean; cacheHits: number; reported: boolean;
  source?: string | undefined; marks?: Record<string, number>;
  infoSource?: string; infoReuseBlocked?: string | null; infoAgeSec?: number; firstPlayingReported?: boolean;
}
/**
 * TODO: 分割 まにあわなくなっても知らんぞー
 */
class NicoVideoPlayerDialog extends Emitter {
  declare _actionFeedbackCommandDepth: number | undefined;
  declare emitAsync: Loose;
  declare emit: Loose;
  declare emitResolve: Loose;
  declare promise: Loose;
  declare _$playerContainer: Loose;
  declare _commentHistory: Loose;
  declare _commentLoadController: Loose;
  declare _commentPanel: Loose;
  declare _commonsTreeAccum: Loose;
  declare _commonsTreeJob: Loose;
  declare _nicodicGate: Loose;
  declare _nicoadEnd: Loose;
  declare _nicodicPlaylistToken: Loose;
  declare _commonsTreeLastResult: Loose;
  declare _commonsTreeProgress: Loose;
  declare _commonsTreeToken: Loose;
  declare _deflistMutationOwner: Loose;
  declare _escBlockExpiredAt: Loose;
  declare _id: Loose;
  declare _keyEmitter: Loose;
  declare _lastCurrentTime: Loose;
  declare _lastOpenAt: Loose;
  declare _likePendingModels: Loose;
  declare _mylistApiLoader: Loose;
  declare _mylistMutationOwner: Loose;
  declare _nextVideo: Loose;
  declare _nicoVideoPlayer: Loose;
  declare _nicoVideoPlayerInit: Loose;
  declare _notificationHistoryDock: Loose;
  declare _offScreenLayer: Loose;
  declare _playerConfig: Loose;
  declare _playlist: Loose;
  declare _playlistPrefetch: Loose;
  declare _prefetchPausedTimer: number;
  declare _prefetchReporter: Loose;
  declare _prefetchPreparer: Loose;
  declare _prefetchPending: Loose;
  /** Task1061: 先読みと一緒に届いたコメントなど（動画を開くたびに捨てる） */
  declare _prefetchCompanions: Loose;
  /** Task1061: 1回の切り替えの計測値（_diagOpenTiming / _reportPrefetchTiming / _markTiming が使う） */
  declare _prefetchTiming: DialogOpenTiming | undefined;
  declare _prefetchMarkSignature: string | undefined;
  /** Task1029: ウォームスワップ（温めた2つ目のプレーヤーへの差し替え）の方針。 */
  /** Task1029: 調査用。同じ内容を繰り返し出さないための記録。 */
  declare _diagSeen: Loose;
  declare _diagEnvDone: Loose;
  declare _requestId: ZenzaDialogRequestId | null | undefined;
  declare _savePlaybackPositionNow: Loose;
  declare _playbackPositionSaves:Map<string,Promise<unknown>>|undefined;
  declare _autoResumeClearCoordinator:AutoResumeClearAgent|null|undefined;
  declare _autoResumeSaveSuppress:Readonly<{
    watchId:string;requestId:unknown;videoInfo:unknown;
  }>|undefined;
  declare _outgoingAutoResumeSaveSuppress:unknown;
  declare _state: Loose;
  declare _threadInfo: Loose;
  declare _videoFilter: Loose;
  declare _videoInfo: Loose;
  declare _videoSession: Loose;
  declare _videoTimers: Loose;
  declare _videoWatchOptions: Loose;
  declare _view: Loose;
  declare _watchId: string | null | undefined;
  declare threadLoader: Loose;
  // Task 090（監査v2 ZW-017）: キャッシュ・プレイリストの初期化を待つ最長の時間（ミリ秒）
  static get OPTIONAL_LOAD_TIMEOUT() { return 3000; }
  /** Task1030: 先読みした視聴メタデータを再利用してよい最長の古さ。いいね状態等の個人データも含むため短めにする。 */
  static get PREFETCH_DATA_MAX_AGE_MS() { return 10 * 60 * 1000; }
  constructor(params?: Loose) {
    super();
    this.initialize(params);
  }
  initialize(params?: Loose) {
    // this._offScreenLayer = params.offScreenLayer;
    this._playerConfig = params.config;
    this._state = params.state;

    this._keyEmitter = params.keyHandler || ShortcutKeyEmitter.create(
      params.config,
      document.body,
      global.emitter
    );

    this._initializeDom();

    this._keyEmitter.on('keyDown', this._onKeyDown.bind(this));
    this._keyEmitter.on('keyUp', this._onKeyUp.bind(this));

    this._id = 'ZenzaWatchDialog_' + Date.now() + '_' + Math.random();
    this._playerConfig.on('update', this._onPlayerConfigUpdate.bind(this));

    this._escBlockExpiredAt = -1;

    this._videoFilter = new VideoFilter(
      this._playerConfig.props.videoOwnerFilter,
      this._playerConfig.props.videoTagFilter
    );

    this._bindPlaybackPositionSavers();

    this._onToggleLike = _.debounce(this._onToggleLike.bind(this), 1000);

    this.promise('firstVideoInitialized').then(() => console.log('firstVideoInitialized'));
  }
  async _initializeDom() {
    this._view = new NicoVideoPlayerDialogView({
      dialog: this,
      playerConfig: this._playerConfig,
      nicoVideoPlayer: this._nicoVideoPlayer,
      playerState: this._state,
      currentTimeGetter: () => this.currentTime
    });
    await this._view.promise('dom-ready');

    this._initializeCommentPanel();

    this._$playerContainer = this._view.get$Container();
    this._view.on('command', this._onCommand.bind(this));
    this._view.on('postChat', (e?: Loose, chat?: Loose, cmd?: Loose) => {
      this.addChat(chat, cmd)
        .then(() => e.resolve())
        .catch(() => e.reject());
    });
    MediaSessionApi.onCommand(this._onCommand.bind(this));
  }
  async _initializeNicoVideoPlayer() {
    if (this._nicoVideoPlayer) {
      return this._nicoVideoPlayer;
    }
    await this._view.promise('dom-ready');
    const config = this._playerConfig;
    const nicoVideoPlayer = this._nicoVideoPlayer = new NicoVideoPlayer({
      node: this._$playerContainer,
      playerConfig: config,
      playerState: this._state,
      volume: Math.max(config.props.volume, 0),
      loop: config.props.loop,
    });
    // The active Dock owns the AB range. Intercept only native video end so
    // SupporterCredit cannot postpone a B=duration return to A.
    nicoVideoPlayer.beforeSupporterCreditEnd=()=>{
      const dock=this._view?.manualBookmarkDock;
      if(!dock?.isRepeating||!this.isOpen)return false;
      if(!dock.repeatAtEnd())return false;
      this.play();
      return true;
    };
    nicoVideoPlayer.onRepeatEndTimeout=()=>{
      this._view?.manualBookmarkDock?.stopUnresponsiveRepeat();
    };

    // Task 074: 音声の自動調整（倍率が変わるたびにプレイヤーへ反映する）
    AudioAdjuster.initialize(config);
    nicoVideoPlayer.audioGain = AudioAdjuster.gain;
    AudioAdjuster.onChange((gain?: Loose) => { nicoVideoPlayer.audioGain = gain; });

    this.threadLoader = ThreadLoader;

    nicoVideoPlayer.on('loadedMetaData', this._onLoadedMetaData.bind(this));
    nicoVideoPlayer.on('ended', this._onVideoEnded.bind(this));
    nicoVideoPlayer.on('canPlay', this._onVideoCanPlay.bind(this));
    nicoVideoPlayer.on('play', this._onVideoPlay.bind(this));
    nicoVideoPlayer.on('pause', this._onVideoPause.bind(this));
    nicoVideoPlayer.on('playing', this._onVideoPlaying.bind(this));
    nicoVideoPlayer.on('seeking', this._onVideoSeeking.bind(this));
    nicoVideoPlayer.on('seeked', this._onVideoSeeked.bind(this));
    nicoVideoPlayer.on('stalled', this._onVideoStalled.bind(this));
    nicoVideoPlayer.on('waiting', this._onVideoStalled.bind(this));
    nicoVideoPlayer.on('timeupdate', this._onVideoTimeUpdate.bind(this));
    nicoVideoPlayer.on('progress', this._onVideoProgress.bind(this));
    nicoVideoPlayer.on('aspectRatioFix', this._onVideoAspectRatioFix.bind(this));
    nicoVideoPlayer.on('commentParsed', this._onCommentParsed.bind(this));
    nicoVideoPlayer.on('commentChange', this._onCommentChange.bind(this));
    nicoVideoPlayer.on('commentFilterChange', this._onCommentFilterChange.bind(this));
    nicoVideoPlayer.on('videoPlayerTypeChange', this._onVideoPlayerTypeChange.bind(this));

    nicoVideoPlayer.on('error', this._onVideoError.bind(this));
    nicoVideoPlayer.on('abort', this._onVideoAbort.bind(this));

    nicoVideoPlayer.on('volumeChange', this._onVolumeChange.bind(this));
    nicoVideoPlayer.on('volumeChange', _.debounce(this._onVolumeChangeEnd.bind(this), 1500));
    nicoVideoPlayer.on('command', this._onCommand.bind(this));

    this.emitResolve('nicovideo-player-ready');
    return nicoVideoPlayer;
  }
  /** Task1035: 外部サイトからの再生用の枠の中で動いているか。 */
  static isExternalPlayback(): boolean {
    try {
      return window !== window.top && window.name === 'ZenzaWatchExternalTrialPlayer' &&
        location.hostname === 'www.nicovideo.jp';
    } catch (_) { return false; }
  }
  _onPlayerConfigUpdate(key?: Loose, value?: Loose) {
    if (key === 'playlist.prefetchAhead.showMark') this._updatePrefetchMarks();
    // Task1055: 先読みを止める条件の切り替えは、準備済みのデータを捨てずに判断だけやり直す。
    if (key === 'loop' || key === 'playlist.prefetchAhead.skipWhenLoop' ||
        key === 'playlist.prefetchAhead.skipWhenDataSaver' || key === 'playlist.prefetchAhead.skipWhenPaused') {
      this._syncPausedPrefetchTimer();
      this._updateNextPrefetch();
    }
    if (typeof key === 'string' &&
      (key === 'playlist.prefetchAhead.enabled' ||
       key === 'videoServerType' || key === 'domandVideoQuality' ||
       key === 'autoDisableNew' || key.startsWith('video.hls.'))) {
      this._playlistPrefetch?.reset();
      this._updateNextPrefetch();
    }
    if(['resume.recordEnabled','abRepeat.enabled'].includes(key)||(typeof key==='string'&&key.startsWith('bookmark.'))){
      this._view?.manualBookmarkDock?.refreshPreferences();
    }
    // Task 063: enableCommentPanel(コメントパネル表示ON/OFF)は動画プレイヤー
    // (_nicoVideoPlayer)の有無に関係なく効かせたいタブ表示の切り替えなので、
    // 下の「動画プレイヤーが無ければ何もしない」ガードより前で個別に処理する。
    // 以前はこのイベント自体は受け取っていたが、値を読んで実際に表示/非表示へ
    // 反映する処理が無く、ショートカットで切り替えても見た目が変わらなかった
    // （上級設定監査で発見したバグ）。
    if (key === 'enableCommentPanel') {
      this._applyCommentPanelVisibility(value);
      return;
    }
    if (!this._nicoVideoPlayer) { return; }
    const np = this._nicoVideoPlayer, filter = np.filter;
    switch (key) {
      case 'enableFilter':
        filter.isEnable = value;
        break;
      case 'wordFilter':
        filter.wordFilterList = value;
        break;
      case 'wordRegFilter':
      case 'wordRegFilterFlags':
        filter.setWordRegFilter(
          key === 'wordRegFilter' ? value : this._playerConfig.props.wordRegFilter,
          key === 'wordRegFilterFlags' ? value : this._playerConfig.props.wordRegFilterFlags);
        break;
      case 'userIdFilter':
        filter.userIdFilterList = value;
        break;
      case 'commandFilter':
        filter.commandFilterList = value;
        break;
      case 'ngComposite.rules':
        filter.compositeRules=value;
        break;
      case 'filter.fork0':
      case 'filter.fork1':
      case 'filter.fork2':
      case 'filter.fork3':
      case 'filter.defaultThread':
      case 'filter.ownerThread':
      case 'filter.communityThread':
      case 'filter.nicosThread':
      case 'filter.easyThread':
      case 'filter.aiThread':
      case 'filter.extraDefaultThread':
      case 'filter.extraOwnerThread':
      case 'filter.extraCommunityThread':
      case 'filter.extraNicosThread':
      case 'filter.extraEasyThread':
      case 'removeNgMatchedUser':
        filter[key.replace(/^.*\./, '')] = value;
        break;
    }
  }
  // Task 063: enableCommentPanelの実体。falseの時は「コメント」タブ自体を
  // (タブボタンごと)隠す。現在アクティブなタブがまさに「コメント」だった
  // 場合は、非表示のタブが選択されたままになって何も見えなくならないよう
  // 動画情報タブへ切り替える。CSS側は下のスタイル定義
  // (.hideCommentPanelTab)を参照。
  //
  // Task 064: toggleClass()・selectTab()はどちらもNicoVideoPlayerDialogView
  // 側にのみ定義されたメソッド（このクラスNicoVideoPlayerDialog自身には無い）
  // で、実際のDOM操作はthis._view（NicoVideoPlayerDialogViewのインスタンス）
  // へ委譲する設計になっている。Task 063では誤ってthis.toggleClass()/
  // this.selectTab()のように自分自身のメソッドとして呼び出しており、
  // 「this.toggleClass is not a function」で例外が発生し、ZenzaWatch自体が
  // 起動できなくなる重大な不具合になっていた（ユーザー実機で発覚）。
  // this._view経由の呼び出しに修正。
  _applyCommentPanelVisibility(enable?: Loose) {
    this._view.toggleClass('hideCommentPanelTab', !enable);
    if (!enable && this._state.currentTab === 'comment') {
      this._view.selectTab('videoInfoTab');
    }
  }
  _updateScreenMode(mode?: Loose) {
    this.emit('screenModeChange', mode);
  }
  /**
   * Task199 (review R01/R03): the accumulated result of one parent/child job. A resume merges into it;
   * a different video, request or fresh scan starts a new one. Only IDs and kinds are kept (no response
   * bodies, no credentials).
   */
  static newCommonsTreeAccum(videoId?: Loose, requestId?: Loose) {
    return {
      jobId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      videoId, requestId, startedAt: new Date().toISOString(),
      works: {parents: new Map(), children: new Map()},
      sides: {parents: (null as Loose), children: (null as Loose)},
      added: new Set(), existing: new Set(), overflow: new Set(), lastAddedWatchId: (null as Loose)
    };
  }
  static mergeCommonsTreeWorks(accum?: Loose, tree?: Loose) {
    for (const kind of ['parents', 'children']) {
      const side = tree[kind];
      if (!side || side.skipped) { continue; }
      for (const w of side.works || []) {
        if (!w || !w.contentId || accum.works[kind].has(w.contentId)) { continue; }
        accum.works[kind].set(w.contentId, {globalId: w.contentId, contentKind: w.contentKind || null,
          visibleStatus: w.visibleStatus || null, isVideo: w.isVideo === true});
      }
      accum.sides[kind] = {
        total: Number.isFinite(side.total) ? side.total : null,
        complete: side.complete === undefined ? null : side.complete === true,
        stopReason: side.stopReason || null,
        nextOffset: typeof side.nextOffset === 'number' ? side.nextOffset : null
      };
    }
  }
  static mergeCommonsTreeReport(accum?: Loose, report?: Loose, requestedIds?: Loose) {
    for (const id of report.addedIds || []) {
      accum.added.add(id);
      accum.overflow.delete(id);
      accum.lastAddedWatchId = id;
    }
    for (const id of report.existingIds || []) { accum.existing.add(id); }
    for (const id of report.overflow || []) { if (!accum.added.has(id)) { accum.overflow.add(id); } }
    if (!report.addedIds && Array.isArray(requestedIds) && requestedIds.length) {
      // older playlist implementations without addedIds: remember the batch end for ordering only
      accum.lastAddedWatchId = requestedIds[requestedIds.length - 1];
    }
  }
  static buildCommonsTreeResult(accum?: Loose) {
    const list = (kind?: Loose) => [...accum.works[kind].values()];
    const all = list('parents').concat(list('children'));
    const videos = (kind?: Loose) => list(kind).filter(w => w.isVideo).map(w => w.globalId);
    const strip = (w?: Loose) => ({globalId: w.globalId, contentKind: w.contentKind, visibleStatus: w.visibleStatus});
    const sides = ['parents', 'children'].map(k => accum.sides[k]).filter(Boolean);
    return {
      // formatRevision 2 (Task199) only adds fields: parents/children stay the video-candidate IDs as in revision 1
      format: 'zenza-commons-tree-1', formatRevision: 2,
      videoId: accum.videoId, jobId: accum.jobId, startedAt: accum.startedAt, fetchedAt: new Date().toISOString(),
      parents: videos('parents'), children: videos('children'),
      allWorks: {parents: list('parents').map(strip), children: list('children').map(strip)},
      nonVideo: all.filter(w => !w.isVideo).length,
      addedIds: [...accum.added], existingIds: [...accum.existing], overflow: [...accum.overflow],
      counts: {
        allWorks: all.length, parents: accum.works.parents.size, children: accum.works.children.size,
        videoCandidates: all.filter(w => w.isVideo).length, nonVideo: all.filter(w => !w.isVideo).length,
        added: accum.added.size, existing: accum.existing.size, overflow: accum.overflow.size
      },
      sides: {parents: accum.sides.parents, children: accum.sides.children},
      complete: sides.length > 0 && sides.every(sd => sd.complete === true)
    };
  }
  // Task197: abort the running parent/child job (HTTP, waits and display-info fill)
  /**
   * Task1037: 大百科記事の本文に載っている動画の ID を、載っている順に返す（重複は最初の1回だけ）。
   * 記事本文のリンクには nicopedia_from=nicopedia_article_body_pc が付く（広告は …_nicoad_…、
   * 掲示板は …_bbs_… で区別できる）。この印が見つからないときは、記事の形式が変わった可能性が
   * あるので、広告・掲示板の印が付いたものを除いた全リンクで代用し marker=false を返す。
   */
  static extractNicodicVideoIds(html: string): {ids: string[]; marker: boolean} {
    const text = typeof html === 'string' ? html : '';
    const pick = (re: RegExp): string[] => {
      const seen = new Set<string>(), ids: string[] = [];
      for (const m of text.matchAll(re)) {
        const id = m[1];
        if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
      }
      return ids;
    };
    const marked = pick(/watch\/((?:sm|nm|so|ss)\d+)\?[^"'\s>]*nicopedia_from=nicopedia_article_body/g);
    if (marked.length) { return {ids: marked, marker: true}; }
    const all = pick(/(?:www\.nicovideo\.jp\/watch|nico\.ms)\/((?:sm|nm|so|ss)\d+)(?![^"'\s>]*nicopedia_from=nicopedia_(?:bbs|article_nicoad))/g);
    return {ids: all, marker: false};
  }
  _onPlaylistStatusUpdate() {
    let playlist = this._playlist;
    this._playerConfig.setValue('playlistLoop', playlist.isLoop);
    this._state.isPlaylistEnable = playlist.isEnable;
    if (playlist.isEnable) {
      this._playerConfig.setValue('loop', false);
    }
    this._view.blinkTab('playlist');
    this._updateNextPrefetch();
  }
  _onCommentPanelStatusUpdate() {
    let commentPanel = this._commentPanel;
    this._playerConfig.setValue(
      'enableCommentPanelAutoScroll', commentPanel.isAutoScroll);
  }
  _onVideoPlayerTypeChange(type: Loose = '') {
    switch (type.toLowerCase()) {
      case 'youtube':
        this._state.setState({isYouTube: true});
        break;
      default:
        this._state.setState({isYouTube: false});
    }
  }
  _onNicosSeek(time?: Loose) {
    const ct = this.currentTime;
    console.info('nicosSeek!', time);
    if (this.isPlaylistEnable) {
      // 連続再生中は後方へのシークのみ有効にする
      if (ct < time) {
        this.execCommand('fastSeek', time);
      }
    } else {
      this.execCommand('fastSeek', time);
    }
  }
  show() {
    this._state.isOpen = true;
  }
  hide() {
    this._closeNotificationHistory();
    this._state.isOpen = false;
  }
  async open(watchId?: Loose, options?: Loose) {
    if (!watchId) {
      return;
    }
    this._hideNicoadEndScreen();
    // 連打対策
    if (Date.now() - this._lastOpenAt < 1500 && this._watchId === watchId) {
      return;
    }

    this.refreshLastPlayerId();
    options = new VideoWatchOptions(watchId, options, this._playerConfig);

    // Task 090（監査v2 ZW-014）: プレイリストへ入れるだけの時は、今の再生の世代（requestId）と options を変えない
    if (!options.isPlaylistStartRequest &&
      this.isPlaying && this.isPlaylistEnable && !options.isOpenNow) {
      this._onPlaylistInsert(watchId);
      return;
    }
    // A playlist click may bypass playNextVideo(). Cache ownership belongs to
    // the actual watch request, not the next-button UI.
    const abandoned = this._prefetchPending?.prepared;
    this._prefetchPending = null;
    if (abandoned && !abandoned.adopted) abandoned.dispose();
    this._playlistPrefetch?.interrupt?.('waiting');
    const candidate = this._prefetchFeatureEnabled() ? this._playlistPrefetch?.take(watchId) : null;
    const prepared = candidate?.settings === this._prefetchSettingsKey() &&
      candidate?.watchId === watchId &&
      typeof candidate?.sessionInfo?.url === 'string' ? candidate : null;
    if (candidate && !prepared) candidate.dispose();
    this._updatePrefetchMarks();
    this._cancelCommentLoad();
    this._abortCommonsTreeJob();  // Task197: switching video stops the parent/child job
    // Keep the outgoing session's deletion barrier while the new request takes
    // ownership. Its final save below must not resurrect an acknowledged clear.
    this._outgoingAutoResumeSaveSuppress = this._isAutoResumeSaveSuppressed() ?
      this._autoResumeSaveSuppress : undefined;
    this._requestId = 'play-' + Math.random() as ZenzaDialogRequestId;
    this._prefetchCompanions = null;
    this._prefetchTiming = {
      started: this._prefetchNow(), videoId: watchId, requestId: this._requestId,
      used: false, cacheHits: 0, reported: false
    };
    this._prefetchPending = prepared ? {requestId: this._requestId, prepared} : null;
    this._videoWatchOptions = options;
    this._clearVideoTimers();

    console.log('Video open requested');
    // Task188: HLS.jsではmanifest解析時点の互換canplayで止まる。実再生の確認ではない（実再生はzenza-readinessで別記録）
    console.time('Video readiness notification');

    // Task 090（監査v2 ZW-012）: この open の世代。await の後で、別の open・close があったら先へ進まない
    const requestId = this._requestId;
    let nicoVideoPlayer = this._nicoVideoPlayer;
    if (!nicoVideoPlayer) {
      // 最初のプレイヤーの準備中にもう一度開かれても、プレイヤーは1つだけ作る
      this._nicoVideoPlayerInit = this._nicoVideoPlayerInit ||
        this._initializeNicoVideoPlayer().catch(err => {
          this._nicoVideoPlayerInit = null;
          throw err;
        });
      nicoVideoPlayer = await this._nicoVideoPlayerInit;
      if (this._requestId !== requestId) {
        return;
      }
    } else {
      if (this._videoInfo) {
        this._saveFinalPlaybackPosition(this._videoInfo.contextWatchId, this.currentTime);
      }
      nicoVideoPlayer.close();
      this._view.clearPanel();
      this.emit('beforeVideoOpen');
      if (this._videoSession) {
        this._videoSession.close();
      }
    }

    this._state.resetVideoLoadingStatus();

    this._state.isCommentReady = false;
    // Task 090（ZW-025）: 前の動画への投稿の「投稿中」は外す（前の投稿の完了は、新しい動画の表示を変えない）
    this._state.isCommentPosting = false;
    this._watchId = watchId;
    this._lastCurrentTime = 0;
    this._lastOpenAt = Date.now();
    this._state.isError = false;

    // Task 090（監査v2 ZW-017）: 再生に必須なのは動画情報だけ。手元のキャッシュ（IndexedDB）とプレイリストの初期化は
    // 失敗しても・いつまでも終わらなくても（期限 OPTIONAL_LOAD_TIMEOUT）、無しで先へ進む
    const optional = (label?: Loose, func?: Loose, fallback?: Loose, onGiveUp = () => {}) => new Promise(resolve => {
      const timer = window.setTimeout(() => {
        window.console.warn(`${label}: timeout`);
        onGiveUp();
        resolve(fallback);
      }, NicoVideoPlayerDialog.OPTIONAL_LOAD_TIMEOUT);
      Promise.resolve().then(func).then(
        result => { window.clearTimeout(timer); resolve(result); },
        () => { window.clearTimeout(timer); window.console.warn(`${label}: fail`); onGiveUp(); resolve(fallback); });
    });
    Promise.all([
      this._loadVideoInfoForOpen(watchId, options, prepared),
      optional('WatchInfoCacheDb.get', () => WatchInfoCacheDb.get(watchId), null),
      // プレイリストを待つ処理（再生可能になった時の playlist-ready 待ち）が止まらないよう、諦めた時も ready にする
      optional('initializePlaylist', () => this._initializePlaylist(), undefined, () => this.emitResolve('playlist-ready'))  //videoinfo取得に300msくらいかかってるぽいから他のことやろうか
    ]).then(this._onVideoInfoLoaderLoad.bind(this, requestId)
    ).catch(this._onVideoInfoLoaderFail.bind(this, requestId));

    this.show();
    if (this._playerConfig.getValue('autoFullScreen') && !util.fullscreen.now()) {
      nicoVideoPlayer.requestFullScreen();
    }
    this.emit('open', watchId, options);
    global.emitter.emitAsync('DialogPlayerOpen', watchId, options);
    global.emitter.emitResolve('firstPlayerOpen');
  }
  get isOpen() {
    return this._state.isOpen;
  }
  reload(options?: Loose) {
    options = this._videoWatchOptions.createForReload(options);

    if (this._lastCurrentTime > 0) {
      options.currentTime = this._lastCurrentTime;
    }
    this.open(this._watchId, options);
  }
  get currentTime() {
    if (!this._nicoVideoPlayer) {
      return 0;
    }
    const ct = this._nicoVideoPlayer.currentTime * 1;
    if (!this._state.isError && ct > 0) {
      this._lastCurrentTime = ct;
    }
    return this._lastCurrentTime;
  }
  set currentTime(sec: Loose) {
    if (!this._nicoVideoPlayer) {
      return;
    }
    sec = Math.max(0, sec);
    this._nicoVideoPlayer.currentTime=sec;
    this._lastCurrentTime = sec;
    MediaSessionApi.updatePositionStateByMedia(this);
  }
  get id() { return this._id;}
  get isLastOpenedPlayer() {
    return this.id === this._playerConfig.props.lastPlayerId;
  }
  refreshLastPlayerId() {
    if (this.isLastOpenedPlayer) {
      return;
    }
    this._playerConfig.props.lastPlayerId = '';
    this._playerConfig.props.lastPlayerId = this.id;
  }
  /**
   * Task1030: 動画情報の取得元を決める。
   * 先読み済みで新しいメタデータがあれば watch ページを取り直さずにそれを使う
   * （実測で切り替え時間の大半がこの再取得だった）。使えない・失敗したときは通常どおり取得する。
   */
  _loadVideoInfoForOpen(watchId: string, options: Loose, prepared: Loose): Promise<Loose> {
    const reason = this._prefetchDataReuseBlock(watchId, options, prepared);
    const timing = this._prefetchTiming;
    if (reason) {
      if (timing) { timing.infoSource = 'network'; timing.infoReuseBlocked = reason; }
      return VideoInfoLoader.load(watchId, options.videoLoadOptions, options.rawData);
    }
    if (timing) {
      timing.infoSource = 'prefetch';
      timing.infoAgeSec = Math.round((Date.now() - prepared.dataAt) / 1000);
    }
    return VideoInfoLoader.adoptPrefetched(watchId, prepared.data, options.videoLoadOptions)
      .catch((error: Loose) => {
        if (timing) { timing.infoSource = 'network'; timing.infoReuseBlocked = 'adopt-failed'; }
        this._diag('ZENZA_INFO_REUSE', {watchId, fallback: true,
          error: String(error?.name || error?.message || error).slice(0, 80)});
        return VideoInfoLoader.load(watchId, options.videoLoadOptions);
      });
  }
  async _onVideoInfoLoaderLoad(requestId: Loose, [videoInfoData, localCacheData]: Loose) {
    console.log('Video info load completed');
    if (this._requestId !== requestId) {
      return;
    }
    this._markTiming('videoInfo');
    const videoInfo = this._videoInfo = new VideoInfoModel(videoInfoData, localCacheData);
    this._watchId = videoInfo.watchId;
    WatchInfoCacheDb.putBestEffort(this._watchId as string, {videoInfo});
    let serverType;
    let videoQuality;
    if (!videoInfo.isDomandOnly && this._playerConfig.props.autoDisableNew && videoInfo.maybeBetterQualityServerType === 'dmc') {
      serverType = 'dmc';
      videoQuality = this._playerConfig.props.dmcVideoQuality;
    } else if (videoInfo.isDomandOnly || (this._videoWatchOptions.videoServerType === 'domand' && videoInfo.isDomandAvailable)) {
      serverType = 'domand';
      videoQuality = this._playerConfig.props.domandVideoQuality;
    } else if (videoInfo.isDmcOnly || (this._videoWatchOptions.videoServerType === 'dmc' && videoInfo.isDmcAvailable)) {
      serverType = 'dmc';
      videoQuality = this._playerConfig.props.dmcVideoQuality;
    } else {
      serverType = 'domand';
      videoQuality = this._playerConfig.props.domandVideoQuality;
    }

    this._state.setState({
      isDomandAvailable: videoInfo.isDomandAvailable,
      isDmcAvailable: videoInfo.isDmcAvailable,
      isCommunity: videoInfo.isCommunityVideo,
      isMymemory: videoInfo.isMymemory,
      isChannel: videoInfo.isChannel,
      isLiked: videoInfo.isLiked
    });
    MediaSessionApi.updateByVideoInfo(this._videoInfo);
    // Task 074: 音声の自動調整。動画ごとの音量倍率を音量に掛ける（設定 audio.autoAdjust）
    AudioAdjuster.setContext({
      watchId: videoInfo.watchId,
      loudness: videoInfo.loudness,
      isChannel: videoInfo.isChannel
    });

    const isHLSRequired = videoInfo.isHLSRequired;
    const isHLSSupported = !!global.debug.isHLSSupported ||
      document.createElement('video').canPlayType('application/vnd.apple.mpegURL') !== '' ||
      document.createElement('video').canPlayType('application/x-mpegURL') !== '';
    const useHLS = isHLSSupported && (isHLSRequired || !this._playerConfig.props['video.hls.enableOnlyRequired'] || serverType != 'dmc');
    // Task 090（監査v2 ZW-012）: セッションはこの読み込みのローカル変数で持ち、await の後ごとに、
    // 別の動画を開いた・閉じた（requestId が変わった）かを確かめる。古い読み込みの結果は画面へ入れない
    const isStale = () => this._requestId !== requestId;
    const pending = this._prefetchPending?.requestId === requestId ? this._prefetchPending.prepared : null;
    if (this._prefetchPending?.requestId === requestId) this._prefetchPending = null;
    const runtime = global.debug?.playlistPrefetch;
    // The scheduler checks expiry at take(); check again just before the real
    // session transfer, keeping the existing 60-second safety margin.
    if (pending && Number.isFinite(pending.expiresAt) && pending.expiresAt <= Date.now() + 60000) {
      try { this._getPrefetchReporter()?.staleAdoption?.(pending.watchId); }
      catch (_) { /* optional diagnostics must not prevent ordinary playback */ }
    }
    const canAdopt = pending && this._prefetchFeatureEnabled() &&
      serverType === 'domand' && useHLS && !this._videoFilter.isNgVideo(videoInfo) &&
      pending.watchId === videoInfo.watchId &&
      pending.settings === this._prefetchSettingsKey() &&
      typeof pending.sessionInfo?.url === 'string' &&
      typeof pending.session?.promote === 'function' &&
      (!Number.isFinite(pending.expiresAt) || pending.expiresAt > Date.now() + 60000) &&
      typeof runtime?.bytes?.activate === 'function';
    let session: Loose = null, cachedSessionInfo: Loose = null;
    if (canAdopt) {
      try {
        await pending.session.promote();
        if (isStale()) {
          pending.dispose();
          return;
        }
        runtime.bytes.activate(pending.bytes);
        pending.adopted = true;
        this._prefetchCompanions = pending.companions ?
          Object.assign({watchId: pending.watchId}, pending.companions) : null;
        if (this._prefetchTiming && this._prefetchTiming.requestId === this._requestId) {
          this._prefetchTiming.used = true;
          this._prefetchTiming.source = pending.sessionInfo?.url;
        }
        session = pending.session;
        cachedSessionInfo = pending.sessionInfo;
      } catch (_) { pending.dispose(); }
    } else if (pending) {
      pending.dispose();
    }
    if (!session) {
      try {
        session = await VideoSessionWorker.create({videoInfo, videoQuality, serverType, useHLS, diagnosticActive: () => !isStale()});
      } catch (error) {
        if (!isStale()) { this._onVideoSessionFail(serverType, error); }
        return;
      }
      if (isStale()) {
        Promise.resolve(session.close()).catch(() => {});
        return;
      }
    }
    this._videoSession = session;

    if (this._videoFilter.isNgVideo(videoInfo)) {
      return this._onVideoFilterMatch();
    }

    try {
      if (session.isDmc) {
        await NVWatchCaller.call(videoInfo.dmcInfo.trackingId);
        if (isStale()) {
          return;
        }
      }
      const sessionInfo = cachedSessionInfo || await session.connect();
      if (isStale()) {
        return;
      }
      this._markTiming('session');
      this.setVideo(sessionInfo.url);
      this._markTiming('setVideo');
      videoInfo.setCurrentVideo(sessionInfo.url);
      this.emit('videoServerType', sessionInfo.type, sessionInfo, videoInfo);
    } catch (e) {
      if (isStale()) {
        return;
      }
      this._onVideoSessionFail(session.serverType, e);
    }
    this._state.videoInfo = videoInfo;

    this.loadComment(videoInfo.msgInfo);

    this.emit('loadVideoInfo', videoInfo);
    this.emitResolve('firstVideoInitialized', this._watchId);

    if (Fullscreen.now() || this._playerConfig.props.screenMode === 'wide') {
      this.execCommand('notifyHtml',
        `<img src="${textUtil.escapeHtml(videoInfo.thumbnail)}" style="width: 96px;">` +
        util.escapeToZenkaku(videoInfo.title)
      );
    }
  }
  setVideo(url?: Loose) {
    this._state.setState({
      isYouTube: url.indexOf('youtube') >= 0,
      currentSrc: url
    });
  }
  /**
   * Task 090（監査v2 ZW-016）: 今の動画（requestId）に属するタイマー（エラー・NG の後の自動の「次へ」、再生エラーの後の再読み込み）。
   * 別の動画を開く・閉じると取り消し、動く時にも同じ動画のままかを確かめる。
   */
  _setVideoTimer(func?: Loose, ms?: Loose) {
    const requestId = this._requestId;
    const timers = this._videoTimers = this._videoTimers || new Set();
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (this._requestId !== requestId) {
        return;
      }
      func();
    }, ms);
    timers.add(id);
    return id;
  }
  _clearVideoTimers() {
    if (!this._videoTimers) {
      return;
    }
    for (const id of this._videoTimers) {
      window.clearTimeout(id);
    }
    this._videoTimers.clear();
  }
  _onVideoInfoLoaderFail(requestId?: Loose, e?: Loose) {
    // Task 090（監査v2 ZW-015）: 失敗の中身は Error・DOMException・{message, info, reason}・文字列等さまざま。
    // 以前は info が無い時にも e.info.isPlayable を読んで2つ目の例外になっていた
    if (!e || typeof e !== 'object') {
      e = {message: e === undefined || e === null ? '' : String(e)};
    }
    const watchId = e.watchId;
    // Task174 (F14): e.info is the raw converted watch response; never log it whole.
    window.console.error('Video info load failed');
    if (this._requestId !== requestId) {
      return;
    }
    if (this._prefetchPending?.requestId === requestId) {
      const held = this._prefetchPending.prepared;
      this._prefetchPending = null;
      if (held && !held.adopted) held.dispose();
    }
    this._recordDiagnostic({
      category: 'network', level: 'error',
      message: e.message || '動画情報の取得に失敗しました',
      videoId: watchId || this._watchId, source: 'videoInfo',
      details: {reason: e.reason, kind: e.type}
    });
    (this as Loose)._setErrorMessage(e.message || '通信エラー', watchId);
    // Terminal video-info failures cannot leave the player in its loading state.
    this._state.setState({isError: true, isLoading: false});
    if (e.info) {
      this._videoInfo = new VideoInfoModel(e.info);
      this._state.videoInfo = this._videoInfo;
      this.emit('loadVideoInfoFail', this._videoInfo);
    } else {
      // Do not expose the last successfully opened video's model on an error.
      this._videoInfo = null;
      this._state.videoInfo = null;
      this.emit('loadVideoInfoFail');
    }
    global.emitter.emitAsync('loadVideoInfoFail', e);

    if (!this.isPlaylistEnable) {
      return;
    }
    if (e.reason === 'forbidden' || e.reason === 'not found' ||
      (e.info && e.info.isPlayable === false)) {
      this._setVideoTimer(() => this.playNextVideo(), 3000);
    }
  }
  _onVideoSessionFail(serverType?: Loose, result?: Loose) {
    const server = serverType === 'dmc' ? 'dmc.nico' : serverType;
    window.console.error('Video session failed',
      serverType === 'dmc' ? 'dmc' : serverType === 'domand' ? 'domand' : 'other');
    this._recordDiagnostic({
      category: 'player', level: 'error', message: '動画の読み込みに失敗しました',
      videoId: this._watchId, source: 'videoSession',
      details: {reason: serverType}
    });
    (this as Loose)._setErrorMessage(
      `動画の読み込みに失敗しました(${server}) ${result && result.message || ''}`, this._watchId);
    this._state.setState({isError: true, isLoading: false});
    if (this.isPlaylistEnable) {
      this._setVideoTimer(() => this.playNextVideo(), 3000);
    }
  }
  /**
   * Task 090（監査v2 ZW-021）: 再生開始（play() の Promise）の失敗の分け方。
   * DOMException は name（NotAllowedError・AbortError 等）で分ける。ZenzaHLS はセッション切れを
   * new DOMException('SessionClosedError')（message に入る）で返すので、message・name・独自の kind のどれでも分かるようにする。
   */
  static classifyPlayStartError(err?: Loose) {
    const name = err && err.name;
    const kind = err && (err.kind || err.message);
    if (name === 'SessionClosedError' || kind === 'SessionClosedError') {
      return 'sessionClosed';
    }
    if (name === 'NotAllowedError') {
      return 'notAllowed';   // 自動再生のブロック
    }
    if (name === 'AbortError') {
      return 'aborted';      // 再生開始を待っている間に動画変更などで中断された等
    }
    return 'unknown';
  }
  _onVideoPlayStartFail(err?: Loose) {
    window.console.error('Video play start failed');
    const type = NicoVideoPlayerDialog.classifyPlayStartError(err);
    this._recordDiagnostic({
      category: 'player', level: type === 'aborted' || type === 'notAllowed' ? 'warning' : 'error',
      message: '動画の再生開始に失敗しました',
      videoId: this._watchId, source: 'playStart',
      details: {kind: type, errorName: err && err.name}
    });
    console.warn('Play request rejected', type);
    switch (type) {
      case 'sessionClosed':
        // TODO: DMCのセッション切れなら自動リロード
        // 以前は存在しない this._playserState を読んで、ここに来ると例外になっていた
        if (this._state.isError) { break; }
        (this as Loose)._setErrorMessage('動画の再生開始に失敗しました', this._watchId);
        this._state.setVideoErrorOccurred();
        break;
      case 'aborted':
      case 'notAllowed':
      default:
        break;
    }

    // 失敗した再生開始は、種類によらず必ず知らせる（以前は DOMException 以外を黙って捨てていた）
    this.emit('loadVideoPlayStartFail', type);
    global.emitter.emitAsync('loadVideoPlayStartFail', type);
  }
  _onVideoFilterMatch() {
    window.console.error('ng video', this._watchId);
    this._setErrorMessage('再生除外対象の動画または投稿者です');
    this._state.isError = true;
    this.emit('error');
    if (this.isPlaylistEnable) {
      this._setVideoTimer(() => this.playNextVideo(), 3000);
    }
  }
  _setErrorMessage(msg?: Loose) {
    this._state.errorMessage = msg;
  }
  _onLoadedMetaData() {
    // Task 077c: 動画が変わったら自動レベル補正を測り直す
    ScreenFilter.resetAutoLevels();
    // YouTubeは動画指定時にパラメータで開始位置を渡すので不要
    if (this._state.isYouTube) {
      return;
    }

    // パラメータで開始秒数が指定されていたらそこにシーク
    let currentTime = this._videoWatchOptions.currentTime;
    if (currentTime > 0) {
      // Task1041: 終わりの位置（残り3秒以内）から始めると、すぐ終わって再生できないように見える。最初から再生する。
      const duration = this._nicoVideoPlayer?.duration;
      if (this._videoWatchOptions.eventType !== 'officialManual' && NicoVideoPlayerDialog.isNearPlaybackEnd(currentTime, duration) && Number(duration) > 6) {
        this.execCommand('notify', '保存されていた位置が動画の最後だったため、最初から再生します');
        return;
      }
      this.currentTime=currentTime;
    }
  }
  async _onVideoCanPlay() {
    if (!this._state.isLoading) {
      return;
    }
    this._markTiming('canPlay');
    this._diagOpenTiming();
    this._reportPrefetchTiming();
    const requestId = this._requestId;
    const watchId = this._watchId;
    const videoInfo = this._videoInfo;
    const watchOptions = this._videoWatchOptions;
    console.timeEnd('Video readiness notification');
    this._playerConfig.props.lastWatchId = this._watchId;
    WatchInfoCacheDb.putBestEffort(this._watchId as string, {watchCount: 1});

    await this.promise('playlist-ready');

    // An older canPlay wait must not finish for a newly opened video.
    if (!this._state.isLoading || this._requestId !== requestId ||
        this._watchId !== watchId || this._videoInfo !== videoInfo ||
        this._videoWatchOptions !== watchOptions) {
      return;
    }

    // Task 090（ZW-017）: プレイリストを作れなかった時も、再生可能の処理は続ける
    if (this._playlist && this._videoWatchOptions.isPlaylistStartRequest) {

      let option = this._videoWatchOptions.mylistLoadOptions;
      let query = this._videoWatchOptions.query;

      // 通常時はプレイリストの置き換え、
      // 連続再生中はプレイリストに追加で読み込む
      option.append = this.isPlaying && this._playlist.isEnable;

      // //www.nicovideo.jp/watch/sm20353707 // プレイリスト開幕用動画
      console.log('playlist option:', option);

      option.limit = this._playerConfig.props['search.limit'];

      const owner = this._capturePlaylistLoadOwner();
      const isCurrent = ():boolean => this._isCurrentPlaylistLoadOwner(owner);
      const onFailure = ():void => {
        if (isCurrent()) { window.console.warn('Initial playlist load failed'); }
      };
      try {
        void owner.playlist.load(query.playlist, option, owner.videoInfo.msgInfo, isCurrent)
          .catch(onFailure);
      } catch (_) { onFailure(); }
      this._playlist.toggleEnable(true);
    }
    // チャンネル動画は、1本の動画がwatchId表記とvideoId表記で2本登録されてしまう。
    // そこでwatchId表記のほうを除去する
    this._playlist && this._playlist.insertCurrentVideo(this._videoInfo);
    if (this._playlist && this._videoInfo.watchId !== this._videoInfo.videoId &&
      this._videoInfo.videoId.startsWith('so')) {
      this._playlist.removeItemByWatchId(this._videoInfo.watchId);
    }

    this._state.setVideoCanPlay();
    this.emitAsync('canPlay', this._watchId, this._videoInfo, this._videoWatchOptions);
    this.emitResolve('firstVideoCanPlay', this._watchId, this._videoInfo, this._videoWatchOptions);

    // プレイリストによって開かれた時は、自動再生設定に関係なく再生する
    if (this._videoWatchOptions.eventType === 'playlist' && this.isOpen) {
      this.play();
    }
    if (this._nextVideo) {
      const nextVideo = this._nextVideo;
      this._nextVideo = null;
      if (this._playlist && this._playerConfig.props.enableNicosJumpVideo) {
        const nv = this._playlist.findByWatchId(nextVideo);
        if (nv && nv.isPlayed()) {
          return;
        } // 既にリストにあって再生済みなら追加しない(無限ループ対策)
        this.execCommand('notify', '@ジャンプ: ' + nextVideo);
        this.execCommand('playlistInsert', nextVideo);
      }
    }

  }
  _onVideoPlay() {
    this._state.setPlaying();
    MediaSessionApi.updatePositionStateByMedia(this);
    this.emit('play');
  }
  _onVideoPlaying() {
    this._state.setPlaying();
    this._syncPausedPrefetchTimer();
    this._hideNicoadEndScreen();
    this._diagFirstPlaying();
    this.emit('playing');
    this._updateNextPrefetch();
  }
  _onVideoSeeking() {
    this._playlistPrefetch?.interrupt?.('seeking');
    this._state.isSeeking = true;
    this.emit('seeking');
  }
  _onVideoSeeked() {
    this._state.isSeeking = false;
    // Short/high-rate loops may reach B again before the next timeupdate.
    // Preserve the real landing sample without trusting a bare seeked signal.
    // Dialog.currentTime retains its last positive display value at 0/NaN.
    // Read the actual media sample so 0s works and cached targets cannot fake ACK.
    this._view?.manualBookmarkDock?.acknowledgeLoopSeek?.(this._nicoVideoPlayer?.currentTime);
    MediaSessionApi.updatePositionStateByMedia(this);
    this.emit('seeked');
  }
  _onVideoPause() {
    if (this._playerConfig?.getValue('playlist.prefetchAhead.skipWhenPaused') !== false) {
      this._playlistPrefetch?.interrupt?.('not-playing');
    }
    this._syncPausedPrefetchTimer();
    this._state.setPausing();
    // Metadata may have been cleared by a failed replacement video request.
    // A late native pause must not dereference null or save an old watch ID.
    if (this._videoInfo?.contextWatchId) {
      this._savePlaybackPosition(this._videoInfo.contextWatchId, this.currentTime);
    }
    this.emit('pause');
  }
  _onVideoStalled() {
    this._playlistPrefetch?.interrupt?.('waiting');
    this._state.isStalled = true;
    this.emit('stalled');
  }
  _onVideoTimeUpdate() {
    this._state.isStalled = false;
    this._view?.manualBookmarkDock?.tick(this.currentTime,!this.isPlaying,!!this._state.isSeeking);
    this._updateNextPrefetch();
  }
  _onVideoProgress(range?: Loose, currentTime?: Loose) {
    this.emit('progress', range, currentTime);
  }
  async _onVideoError(e?: Loose) {
    this._state.setVideoErrorOccurred();
    // Cached startup fragments may be stale/corrupt if HLS failed to decode.
    // Remove only this transient startup handoff; the ordinary retry remains intact.
    if (e?.type !== 'youtube') {
      try { global.debug?.playlistPrefetch?.bytes?.clear?.(); } catch (_) { /* never block recovery */ }
    }
    if (e.type === 'youtube') {
      return this._onYouTubeVideoError(e);
    }
    if (!this._videoInfo) {
      this._setErrorMessage('動画の再生に失敗しました。');
      return;
    }

    const retry = (params?: Loose) => {
      this._setVideoTimer(() => {
        if (!this.isOpen) {
          return;
        }
        this.reload(params);
      }, 3000);
    };

    const requestId = this._requestId;
    const sessionState = await this._videoSession.getState();
    if (this._requestId !== requestId) {
      return;  // Task 090（ZW-012）: 待っている間に別の動画を開いた・閉じた
    }
    const {isDomand, isDmc, isDeleted, isAbnormallyClosed} = sessionState;
    const videoWatchOptions = this._videoWatchOptions;
    const code = (e && e.target && e.target.error && e.target.error.code) || 0;
    window.console.error('Video playback failed',
      Number.isInteger(code) && code >= 0 && code <= 4 ? code : 0);
    this._recordDiagnostic({
      category: 'player', level: 'error',
      message: '動画の再生に失敗しました',
      videoId: this._watchId, source: 'videoError',
      details: {errorCode: 'MEDIA_ERR_' + code,
        kind: isDmc ? 'dmc' : isDomand ? 'domand' : 'other'}
    });

    if (Date.now() - this._lastOpenAt > 3 * 60 * 1000 && isDeleted && !isAbnormallyClosed) {

      if (videoWatchOptions.reloadCount < 5) {
        (retry as Loose)();
      } else {
        this._setErrorMessage('動画のセッションが切断されました。');
      }
    } else if (isDomand && this._videoInfo.isDmcAvailable) {
      this._setErrorMessage('Domand動画の再生に失敗しました。DMC動画に接続します。');
      retry({videoServerType: 'dmc'});
    } else if (isDmc && this._videoInfo.isDomandAvailable) {
      this._setErrorMessage('DMC動画の再生に失敗しました。Domand動画に接続します。');
      retry({videoServerType: 'domand'});
    } else {
      this._setErrorMessage('動画の再生に失敗しました。');
    }

    this.emit('error', e, code);
  }
  _onYouTubeVideoError(e?: Loose) {
    window.console.error('YouTube playback failed');
    this._recordDiagnostic({
      category: 'player', level: 'error',
      message: e && e.description || 'YouTube動画の再生に失敗しました',
      videoId: this._watchId, source: 'youtube',
      details: {reason: e && e.reason}
    });
    this._setErrorMessage(e.description);
    this.emit('error', e);
    if (e.fallback) {
      this._setVideoTimer(() => this.reload({isAutoZenTubeDisabled: true}), 3000);  // Task 090（ZW-016）
    }
  }
  _onVideoAbort() {
    this.emit('abort');
  }
  _onVideoAspectRatioFix(ratio?: Loose) {
    this.emit('aspectRatioFix', ratio);
  }
  _onVideoEnded() {
    // No current metadata: this ended event belongs to an invalidated source.
    if (!this._videoInfo) return;
    if(this._view?.manualBookmarkDock?.repeatAtEnd()){
      this.play();return;
    }
    // ループ再生中は飛んでこない
    this.emitAsync('ended');
    this._state.setVideoEnded();
    if(this._playerConfig?.getValue('resume.clearOnComplete')!==false){
      this._saveFinalPlaybackPosition(this._videoInfo.contextWatchId, 0);
      this._clearCompletedAutoResume();
    }
    if (this.isPlaylistEnable && this._playlist.hasNext) {
      this.playNextVideo({eventType: 'playlist'});
      return;
    } else if (this._playlist) {
      this._playlist.toggleEnable(false);
    }

    const isAutoCloseFullScreen =
      this._videoWatchOptions.hasKey('autoCloseFullScreen') ?
        this._videoWatchOptions.isAutoCloseFullScreen :
        this._playerConfig.getValue('autoCloseFullScreen');
    if (Fullscreen.now() && isAutoCloseFullScreen) {
      Fullscreen.cancel();
    }
    global.emitter.emitAsync('videoEnded');
    // Task1038: リピートも連続再生もせず止まったときは、公式と同じくニコニ広告された動画を並べる。
    void this._showNicoadEndScreen();
  }
  /**
   * Task1038: 動画の最後に「ニコニ広告」された動画（公式の視聴ページと同じ最大10件）を表示する。
   * API: GET api.nicoad.nicovideo.jp/v1/nicoad?frameId=12&limit=10&tags=…&excludeVideoIds=…（公式の視聴ページの通信を参照）。
   * 宣伝した人（提供）と宣伝ポイント（activePoint）も出す。クリックは公式の計測URLを通さず、ZenzaWatch で開く。
   */
  static nicoadEndItems(body: Loose): Loose[] {
    const list = Array.isArray(body?.data?.nicoads) ? body.data.nicoads : [];
    return list.filter((ad: Loose) => ad && typeof ad.contentId === 'string' && /^(?:sm|nm|so|ss)\d+$/.test(ad.contentId) &&
      ad.contentType !== 'live').slice(0, 10).map((ad: Loose) => ({
      id: ad.contentId,
      title: typeof ad.title === 'string' ? ad.title : ad.contentId,
      thumbnail: typeof ad.thumbnailUrl === 'string' && /^https:\/\//.test(ad.thumbnailUrl) ? ad.thumbnailUrl : '',
      supporter: typeof ad.userName === 'string' && ad.userName ? ad.userName : 'ゲスト',
      point: Number.isFinite(Number(ad.activePoint)) ? Number(ad.activePoint) : Number(ad.totalPoint) || 0,
      decoration: ['gold', 'silver', 'bronze'].includes(ad.decoration) ? ad.decoration : '',
      mask: ad.mustMask === true
    }));
  }
  static ensureNicoadEndStyle() {
    if (document.getElementById('zenzaNicoadEndStyle')) { return; }
    const style = document.createElement('style');
    style.id = 'zenzaNicoadEndStyle';
    style.textContent = `
      .zenzaNicoadEnd { position:absolute; inset:0; z-index:200; display:flex; flex-direction:column; gap:1.5%;
        padding:2% 2.5%; box-sizing:border-box; background:rgba(0,0,0,.82); color:#fff; overflow:auto;
        font-family:YuGothic,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif; container-type:inline-size; }
      .zenzaNicoadEnd-header { display:flex; align-items:center; justify-content:space-between; font-weight:bold;
        font-size:clamp(12px,2.2cqw,22px); }
      .zenzaNicoadEnd-close { background:none; border:0; color:#fff; font-size:1.4em; cursor:pointer; line-height:1; }
      .zenzaNicoadEnd-list { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:2cqw 1.6cqw; }
      .zenzaNicoadEnd-item { all:unset; cursor:pointer; display:flex; flex-direction:column; gap:.3em; min-width:0;
        font-size:clamp(10px,1.35cqw,15px); }
      .zenzaNicoadEnd-item:focus-visible { outline:2px solid #fcd842; outline-offset:2px; }
      .zenzaNicoadEnd-thumb { position:relative; aspect-ratio:16/9; background:#222 center/cover no-repeat; border-radius:4px; overflow:hidden; }
      .zenzaNicoadEnd-thumb.is-mask { filter:blur(10px) brightness(.7); }
      .zenzaNicoadEnd-item.is-gold .zenzaNicoadEnd-thumb { box-shadow:0 0 0 3px #e8c13a; }
      .zenzaNicoadEnd-item.is-silver .zenzaNicoadEnd-thumb { box-shadow:0 0 0 3px #c9ccd1; }
      .zenzaNicoadEnd-item.is-bronze .zenzaNicoadEnd-thumb { box-shadow:0 0 0 3px #c58a54; }
      .zenzaNicoadEnd-thumb::before { content:"📣"; position:absolute; left:0; top:0; padding:.15em .35em;
        background:#fcd842; border-bottom-right-radius:6px; font-size:.9em; }
      /* Task1045: 左上のマークも装飾の色に合わせる（以前は銀・銅でも金色だった） */
      .zenzaNicoadEnd-item.is-silver .zenzaNicoadEnd-thumb::before { background:#c9ccd1; }
      .zenzaNicoadEnd-item.is-bronze .zenzaNicoadEnd-thumb::before { background:#c58a54; }
      .zenzaNicoadEnd-item:hover .zenzaNicoadEnd-title { text-decoration:underline; }
      .zenzaNicoadEnd-title { font-weight:bold; line-height:1.3; display:-webkit-box; -webkit-box-orient:vertical;
        -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; }
      .zenzaNicoadEnd-by { color:#f0b400; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .zenzaNicoadEnd-pt { color:#f0b400; }
      .zenzaNicoadEnd-pt::before { content:"📣 "; }
    `;
    (document.head || document.documentElement).append(style);
  }
  _onVolumeChange(vol?: Loose, mute?: Loose) {
    this.emit('volumeChange', vol, mute);
  }
  _onVolumeChangeEnd(vol?: Loose, mute?: Loose) {
    this.emit('volumeChangeEnd', vol, mute);
  }
  /** Task1041: 残り3秒以内（または終わりを越えた位置）なら「最後まで見た」とみなす */
  static isNearPlaybackEnd(seconds:unknown,duration:unknown):boolean {
    const t=Number(seconds),d=Number(duration);
    return Number.isFinite(t)&&Number.isFinite(d)&&d>0&&t>=d-3;
  }
  close() {
    this._hideNicoadEndScreen();
    this._view?.manualBookmarkDock?.deactivate();
    this._keyEmitter?.releaseTemporaryPlaybackRate?.();
    if (this.isPlaying) {
      // Keep the resume API's context ID while preserving legacy fallback.
      const contextWatchId = this._videoInfo?.contextWatchId || this._watchId;
      this._saveFinalPlaybackPosition(contextWatchId, this.currentTime);
    }
    // A completed video must not be recreated in local resume history by close().
    WatchInfoCacheDb.putBestEffort(this._watchId as string,
      {currentTime: (this._state.isEnded||this._isAutoResumeSaveSuppressed())?
        0:this.currentTime});
    if (Fullscreen.now()) {
      Fullscreen.cancel();
    }
    this.pause();
    this.hide();
    this._cancelCommentLoad();
    this._abortCommonsTreeJob();  // Task197
    this._playlistPrefetch?.reset();
    if (this._prefetchPausedTimer) { window.clearInterval(this._prefetchPausedTimer); this._prefetchPausedTimer = 0; }
    this._updatePrefetchMarks();
    if (this._prefetchPending?.prepared && !this._prefetchPending.prepared.adopted) {
      this._prefetchPending.prepared.dispose();
    }
    this._prefetchPending = null;
    this._requestId = null;  // Task 090（ZW-012）: 閉じた後に、読み込み中だった動画の結果を使わない
    this._clearVideoTimers();  // Task 090（ZW-016）
    this._refresh();
    this.emit('close');
    global.emitter.emitAsync('DialogPlayerClose');
  }
  _refresh() {
    if (this._nicoVideoPlayer) {
      this._nicoVideoPlayer.close();
    }
    if (this._videoSession) {
      this._videoSession.close();
    }
  }
  async _initializePlaylist() {
    if (this._playlist) {
      return;
    }
    const $container = this._view.appendTab('playlist', 'プレイリスト');
    this._playlist = new PlayList({
      loader: ThumbInfoLoader,
      container: $container[0],
      loop: this._playerConfig.props.playlistLoop,
      retentionLimit: this._playerConfig.props['playlist.maxItems'],
      enableAdDecoration: this._playerConfig.props.enableAdDecoration,
      debugCheckAdDecoration: this._playerConfig.props.debugCheckAdDecoration
    });
    if (typeof this._playerConfig.onkey === 'function') {
      this._playerConfig.onkey('playlist.maxItems', () => {
        this._playlist?.setRetentionLimit(this._playerConfig.props['playlist.maxItems']);
      });
    }
    this._playlist.on('command', this._onCommand.bind(this));
    this._playlist.on('update', _.debounce(this._onPlaylistStatusUpdate.bind(this), 100));
    // Task 090（ZW-017）: 保存しておいたプレイリストが壊れていても、プレイリストの準備（と動画を開くこと）は止めない
    try {
      if (PlayListSession.isExist()) {
        this._playlist.restoreFromSession();
      }
    } catch (err) {
      window.console.warn('playlist restore fail', err);
    }
    this.emitResolve('playlist-ready');
  }
  _initializeCommentPanel() {
    if (this._commentPanel) {
      return;
    }
    const $container = this._view.appendTab('comment', 'コメント');
    this._commentPanel = new CommentPanel({
      player: this,
      $container: $container,
      autoScroll: this._playerConfig.props.enableCommentPanelAutoScroll,
      language: this._playerConfig.props.commentLanguage
    });
    this._commentPanel.on('command', this._onCommand.bind(this));
    this._commentPanel.on('deleteChat', (e?: Loose, chat?: Loose) => {
      this.removeChat(chat)
        .then(() => e.resolve(), (err?: Loose) => e.reject(err));
    });
    this._commentPanel.on('update', _.debounce(this._onCommentPanelStatusUpdate.bind(this), 100));
    // Task 063: タブ生成直後、現在の設定値をすぐに反映する(_onPlayerConfigUpdate
    // は値が「変わった」時にしか呼ばれないため、初期状態はここで別途適用する)。
    this._applyCommentPanelVisibility(this._playerConfig.props.enableCommentPanel);
    this.emitResolve('commentpanel-ready');
  }
  get isPlaylistEnable() {
    return this._playlist && this._playlist.isEnable;
  }
  playNextVideo(options?: Loose) {
    if (!this._playlist || !this.isOpen) {
      return;
    }
    let opt = this._videoWatchOptions.createForVideoChange(options);

    let nextId = this._playlist.selectNext();
    if (nextId) {
      this.open(nextId, opt);
    }
  }
  playPreviousVideo(options?: Loose) {
    if (!this._playlist || !this.isOpen) {
      return;
    }
    let opt = this._videoWatchOptions.createForVideoChange(options);

    let prevId = this._playlist.selectPrevious();
    if (prevId) {
      this.open(prevId, opt);
    }
  }
  play() {
    if (!this._state.isError && this._nicoVideoPlayer) {
      this._nicoVideoPlayer.play().catch((e?: Loose) => {
        this._onVideoPlayStartFail(e);
      });
    }
  }
  pause() {
    if (!this._state.isError && this._nicoVideoPlayer) {
      this._nicoVideoPlayer.pause();
      this._state.setPausing();
    }
  }
  get isPlaying() {
    return this._state.isPlaying;
  }
  get paused() {
    return this._nicoVideoPlayer ? this._nicoVideoPlayer.paused : true;
  }
  togglePlay() {
    if (!this._state.isError && this._nicoVideoPlayer) {
      if (this.isPlaying) {
        this.pause();
        return;
      }

      this._nicoVideoPlayer.togglePlay().catch((e?: Loose) => {
        this._onVideoPlayStartFail(e);
      });
    }
  }
  set volume(v: Loose) {
    if (this._nicoVideoPlayer) {
      this._nicoVideoPlayer.volume = v;
    }
  }
  get volume() {
    return this._playerConfig.props.volume;
  }
  get duration() {
    if (!this._videoInfo) {
      return 0;
    }
    return this._videoInfo.duration;
  }
  get bufferedRange() {return this._nicoVideoPlayer.bufferedRange;}
  get nonFilteredChatList() {return this._nicoVideoPlayer.nonFilteredChatList;}
  get chatList() {return this._nicoVideoPlayer.chatList;}
  get playingStatus() {
    if (!this._nicoVideoPlayer || !this._nicoVideoPlayer.isPlaying) {
      return {};
    }

    const session = {
      playing: true,
      watchId: this._watchId,
      url: location.href,
      currentTime: this._nicoVideoPlayer.currentTime
    };

    const options = this._videoWatchOptions.createForSession();
    Object.keys(options).forEach(key => {
      (session as Loose)[key] = session.hasOwnProperty(key) ? (session as Loose)[key] : options[key];
    });

    return session;
  }
  get watchId() {
    return this._watchId;
  }
  get currentTab() {
    return this._state.currentTab;
  }
  getId() { return this.id; }
  getDuration() { return this.duration; }
  getBufferedRange() { return this.bufferedRange; }
  getNonFilteredChatList() { return this.nonFilteredChatList;}
  getChatList() { return this.chatList; }
  getPlayingStatus() { return this.playingStatus; }
  getMymemory() {
    return this._nicoVideoPlayer.getMymemory();
  }
}

// Task1060: 役割ごとのファイルに分けたメソッドを、クラスのメソッドと同じ形（列挙されない）で取り付ける。
type DialogRoleMethods = typeof NicoVideoPlayerDialogPrefetch &
  typeof NicoVideoPlayerDialogPlaylistSources &
  typeof NicoVideoPlayerDialogComments &
  typeof NicoVideoPlayerDialogResume &
  typeof NicoVideoPlayerDialogUserActions &
  typeof NicoVideoPlayerDialogNotifications &
  typeof NicoVideoPlayerDialogNicoadEnd &
  typeof NicoVideoPlayerDialogCommands;
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
interface NicoVideoPlayerDialog extends DialogRoleMethods {}
for (const role of [NicoVideoPlayerDialogPrefetch, NicoVideoPlayerDialogPlaylistSources, NicoVideoPlayerDialogComments, NicoVideoPlayerDialogResume, NicoVideoPlayerDialogUserActions, NicoVideoPlayerDialogNotifications, NicoVideoPlayerDialogNicoadEnd, NicoVideoPlayerDialogCommands]) {
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(role))) {
    Object.defineProperty(NicoVideoPlayerDialog.prototype, key, {...descriptor, enumerable: false});
  }
}

export {
  PlayerConfig,
  VideoWatchOptions,
  PlayerState,
  NicoVideoPlayerDialog
};

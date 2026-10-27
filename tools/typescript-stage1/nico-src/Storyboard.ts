/**
 * Canonical TypeScript source for packages/zenza/src/storyboard/Storyboard.js (Task901).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
declare class Emitter {
  constructor(...args: Loose[]);
  on(name: string, callback: (...args: Loose[]) => unknown): this;
  emit(name: string, ...args: unknown[]): unknown;
  promise(name: string): Promise<unknown>;
  emitResolve(name: string, ...args: unknown[]): unknown;
}
/** Sibling storyboard modules and globals used here. */
declare const StoryboardInfoLoader: {load(serverType: unknown, videoInfo: Loose): Promise<Loose>};
declare const StoryboardView: new (params: Loose) => Loose;
declare const StoryboardInfoModel: new (data: Loose) => Loose;
declare const SeekBarThumbnail: Loose;
declare const StoryboardWorker: Loose;
declare const global: {debug: Loose};


class Storyboard extends Emitter {
  declare _loadingWatchId: Loose;
  declare _requestId: Loose;
  declare _watchId: Loose;
  declare _currentVideoInfo: Loose;
  declare _currentVideoWatchId: Loose;
  declare config: Loose;
  declare container: Loose;
  declare loader: Loose;
  declare model: Loose;
  declare state: Loose;
  declare view: Loose;
  constructor(...args: Loose[]) {
    super();
    this.initialize(...(args as [Loose]));
  }
  initialize(params?: Loose) {
    this.config = params.playerConfig;
    this.container = params.container;
    this.state = params.state;
    this.loader = params.loader || StoryboardInfoLoader;
    /** @type {StoryboardInfoModel} */
    this.model = new StoryboardInfoModel({});
    this._currentVideoInfo = null;
    this._currentVideoWatchId = null;
    // Task943: Master thumbnails switch is independent from filmstrip layout.
    // The switch must work for the current video, even if thumbnails were
    // initially disabled before the player emitted loadVideoInfo/canPlay.
    this.config.onkey?.('enableStoryboard', () => this._onStoryboardMasterChange());
    global.debug.storyboard = this;
  }
  _initializeStoryboard() {
    if (this.view) {
      return;
    }
    this.view = new StoryboardView({
      model: this.model,
      container: this.container,
      enable: this.config.props.enableStoryboardBar===true &&
        this.config.props.enableStoryboard===true,
      state: this.state
    });
    // Task941: toolbar clicks already update Config, but the advanced setting
    // and TOGGLE_STORYBOARD_BAR shortcut previously changed only the stored flag.
    // Listen after the view is created; pre-load changes are applied above.
    this.config.onkey?.('enableStoryboardBar', () =>
      this._onStoryboardBarVisibilityChange());
    this.emitResolve('dom-ready');
  }
  _onStoryboardBarVisibilityChange() {
    if(!this.view){return;}
    // Task942: DataStorage.onkey emits asynchronously. A queued event may
    // represent an older value, including one set before this view existed.
    // Always reconcile with the current Config value, never the event payload.
    const enabled=this.config.props.enableStoryboard===true &&
      this.config.props.enableStoryboardBar===true;
    // A toolbar click sets view.isEnable before it writes Config. Do not
    // toggle the view a second time or restart the animation on that event.
    if(this.view.isEnable===enabled){return;}
    if(enabled){this.view.enable();}
    else{this.view.disable();}
  }
  _onStoryboardMasterChange() {
    // DataStorage publishes asynchronously; always read the latest saved
    // value instead of the event payload to avoid stale notifications.
    if(this.config.props.enableStoryboard!==true){
      // Old async master notifications can arrive repeatedly for one OFF.
      // Do not reset workers or fire a synthetic reset on an already empty
      // storyboard; revoke in-flight owners and loaded geometry just once.
      const hadStoryboard=this._loadingWatchId!=null ||
        this.state.isStoryboardAvailable===true || this.model.isAvailable===true;
      this._loadingWatchId=null;
      this._requestId=null; // late loader responses no longer own this video
      this.state.isStoryboardAvailable=false;
      if(hadStoryboard){
        this.model.reset(); // SeekBarThumbnail hides and clears its worker model
        this.emit('reset',this.model);
      }
      this._onStoryboardBarVisibilityChange();
      return;
    }
    this._onStoryboardBarVisibilityChange();
    // Reuse the current videoInfo already delivered by the player, without
    // waiting for a future canPlay or forcing a video/page reload.
    if(this._currentVideoInfo){
      this.load(this._currentVideoWatchId,this._currentVideoInfo);
    }
  }
  reset() {
    this._currentVideoInfo=null;
    this._currentVideoWatchId=null;
    this._loadingWatchId = null;
    this._requestId = null;
    if (!this.model) { return; }
    this.state.isStoryboardAvailable = false;
    this.model.reset();
    this.emit('reset', this.model);
  }
  onVideoCanPlay(watchId?: Loose, videoInfo?: Loose) {
    this.load(watchId, videoInfo);
  }
  /**
   * Task 070: 一般会員でも取得する（access-rights/storyboard は一般会員でも 201 を返す。2026-09-17実機確認）。
   * 動画情報の取得直後（loadVideoInfo）と canPlay の両方から呼ばれ、同じ動画では1回だけ読み込む。
   */
  load(watchId?: Loose, videoInfo?: Loose) {
    // Record only a video with storyboard metadata, including when disabled.
    // reset() clears this ownership on the next player.open event.
    if(videoInfo?.hasStoryboard){
      const currentKey=videoInfo.watchId||watchId;
      if(typeof currentKey==='string' && currentKey){
        this._currentVideoInfo=videoInfo;
        this._currentVideoWatchId=currentKey;
      }
    }
    if (!this.config.props.enableStoryboard || !videoInfo || !videoInfo.hasStoryboard) {
      return;
    }
    const key = videoInfo.watchId || watchId;
    if (this._loadingWatchId === key) {
      return;
    }
    this._loadingWatchId = key;
    this._watchId = watchId;
    const resuestId = this._requestId =  Math.random();

    this._initializeStoryboard();
    const startedAt = performance.now();
    this.loader.load(this.config.props.videoServerType, videoInfo)
      .then(async (info: Loose) => {
        await this.promise('dom-ready');
        console.log('storyboard loaded: %s %sms%s', watchId,
          Math.round(performance.now() - startedAt), info && info.fromCache ? ' (cache)' : '');
        return info;
      })
      .then(this._onStoryboardInfoLoad.bind(this, resuestId))
      .catch(this._onStoryboardInfoLoadFail.bind(this, resuestId));
  }
  _onStoryboardInfoLoad(resuestId?: Loose, rawData?: Loose) {
    if (resuestId !== this._requestId || this.config?.props?.enableStoryboard===false) {
      return; // video changed or master was disabled before notification
    }
    this.model.update(rawData);
    this.emit('update', this.model);

    // A successful HTTP/Worker reply can still contain malformed storyboard
    // geometry. Never advertise unavailable images or block future retries.
    this.state.isStoryboardAvailable = this.model.isAvailable;
    if (!this.model.isAvailable) { this._loadingWatchId = null; }
  }
  _onStoryboardInfoLoadFail(resuestId?: Loose, err?: Loose) {
    if (resuestId !== this._requestId || this.config?.props?.enableStoryboard===false) {
      return; // obsolete loader failure after reset / feature disabled
    }
    console.warn('onStoryboardInfoFail',this._watchId, err);
    this._loadingWatchId = null; // 次の canPlay で再試行できるように
    this.model.update(null);
    this.emit('update', this.model);
    this.state.isStoryboardAvailable = false;
  }
  setCurrentTime(sec?: Loose, forceUpdate?: Loose) {
    if (this.view && this.model.isAvailable) {
      this.view.setCurrentTime(sec, forceUpdate);
    }
  }
  set currentTime(sec: Loose) {
    this.setCurrentTime(sec);
  }
  toggle() {
    if (!this.view) { return; }
    // Task942: when a shortcut has already written Config but its update
    // event has not fired, the view may still show the previous state.
    // A click must toggle the latest preference, not that stale view state.
    const next=this.config.props.enableStoryboardBar!==true;
    const shouldShow=next&&this.config.props.enableStoryboard===true;
    if(this.view.isEnable!==shouldShow){this.view.toggle();}
    this.config.props.enableStoryboardBar=next;
  }
}

export {Storyboard, SeekBarThumbnail, StoryboardWorker};

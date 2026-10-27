/**
 * Canonical TypeScript source for src/State.js (Task965).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const CONSTANT: Loose;
declare const Emitter: Loose;
declare const _: Loose;
declare const global: Loose;
declare const nicoUtil: Loose;


class BaseState extends Emitter {
  declare emit: Loose;
  declare off: Loose;
  declare on: Loose;
  declare static instance: Loose;
  declare _boundOnChange: Loose;
  declare _changed: Loose;
  declare _name: Loose;
  declare _state: Loose;
  declare _timestamp: Loose;
  declare instance: Loose;
  static getInstance() {
    if (!this.instance) {
      this.instance = new (this.constructor as Loose)();
    }
    return this.instance;
  }

  static defineProps(self?: Loose, props = {}) {
    const def = {};
    Object.keys(props).sort()
      .forEach(key => {
        (def as Loose)[key] = {
          enumerable: !key.startsWith('_'),
          get() { return self._state[key]; },
          set(val?: Loose) { self.setState(key, val); }
        };
    });
    Object.defineProperties(self, def);
  }

  constructor(state?: Loose) {
    super();

    this._name = '';
    this._state = state;
    this._changed = new Map;
    this._timestamp = performance.now();
    this._boundOnChange = _.debounce(this._onChange.bind(this), 0);
    (this.constructor as Loose).defineProps(this, state);
  }
  _updateTimestamp() {
    return this._timestamp = performance.now();
  }

  onkey(key?: Loose, func?: Loose) {return this.on(`update-${key}`, func);}
  offkey(key?: Loose, func?: Loose) {return this.off(`update-${key}`, func);}

  _onChange() {
    const changed = this._changed;
    if (!changed.size) {
      return;
    }
    this.emit('change', changed, changed.size);
    for (const [key, val] of changed) {
      this.emit('update', key, val);
      this.emit(`update-${key}`, val);
    }
    this._changed.clear();
  }

  setState(key?: Loose, val?: Loose) {
    if (typeof key === 'string') {
      return this._setState(key, val);
    }
    for (const [k, v] of (key instanceof Map ? key : Object.entries(key))) {
      this._setState(k, v);
    }
  }

  _setState(key?: Loose, val?: Loose) {
    if (!this._state.hasOwnProperty(key)) {
      console.warn('%cUnknown property %s = %s', 'background: yellow;', key, val);
    }
    if (this._state[key] === val) {
      return;
    }
    this._state[key] = val;
    this._changed.set(key, val);
    this._boundOnChange();
  }
}

class PlayerState extends BaseState {
  declare emit: Loose;
  declare static instance: Loose;
  declare _chatList: Loose;
  declare _videoInfo: Loose;
  declare name: Loose;
  declare thumbnail: Loose;
  declare videoCount: Loose;
  static getInstance(config?: Loose) {
    if (!PlayerState.instance) {
      PlayerState.instance = new PlayerState(config);
    }
    return PlayerState.instance;
  }
  constructor(config?: Loose) {
    super({
      isAbort: false,
      isBackComment: config.props.backComment,
      isChanging: false,
      isCanPlay: false,
      isChannel: false,
      isShowComment: config.props.showComment,
      isCommentReady: false,
      isCommentPosting: false,
      isCommunity: false,
      isWaybackMode: false,
      isDebug: config.props.debug,
      isDomandAvailable: false,
      isDmcAvailable: false,
      isError: false,
      isEnded: false,
      isLoading: false,
      isLoop: config.props.loop,
      isMute: config.props.mute,
      isMymemory: false,
      isLiked: false,
      isOpen: false,
      isPausing: true,
      isPlaylistEnable: false,
      isPlaying: false,
      isSeeking: false,
      isRegularUser: !nicoUtil.isPremium(),
      isStalled: false,
      isUpdatingDeflist: false,
      isUpdatingMylist: false,
      isNotPlayed: true,
      isYouTube: false,

      isEnableFilter: config.props.enableFilter,
      sharedNgLevel: config.props.sharedNgLevel,

      currentSrc: '',
      currentTab: config.props.videoInfoPanelTab,
      // aspectRatio: 9/16,

      errorMessage: '',
      screenMode: config.props.screenMode,
      playbackRate: config.props.playbackRate,
      thumbnail: '',
      videoCount: {},
      videoSession: {}
    });
    this.name = 'Player';
  }

  set videoInfo(videoInfo: Loose) {
    // Task904: failed video loads clear the current info. A null payload must
    // not be passed to update() or dereferenced while reporting the failure.
    if (videoInfo == null) {
      this._videoInfo = null;
      global.debug.videoInfo = null;
      this.videoCount = {};
      this.thumbnail = '';
      this.emit('update-videoInfo', null);
      return;
    }
    if (this._videoInfo) {
      this._videoInfo.update(videoInfo);
    } else {
      this._videoInfo = videoInfo;
    }
    global.debug.videoInfo = videoInfo;
    this.videoCount = videoInfo.count;
    this.thumbnail = videoInfo.betterThumbnail;
    this.emit('update-videoInfo', videoInfo);
  }

  get videoInfo() {
    return this._videoInfo;
  }

  set chatList(chatList: Loose) {
    this._chatList = chatList;
    this.emit('update-chatList', this._chatList);
  }

  get chatList() {
    return this._chatList;
  }

  resetVideoLoadingStatus() {
    this.setState({
      isLoading: true,
      isPlaying: false,
      isPausing: true,
      isCanPlay: false,
      isSeeking: false,
      isStalled: false,
      isError: false,
      isAbort: false,
      isMymemory: false,
      isCommunity: false,
      isChannel: false,
      isEnded: false,
      currentSrc: CONSTANT.BLANK_VIDEO_URL
    });
  }

  setVideoCanPlay() {
    this.setState({
      isStalled: false, isLoading: false, isPausing: true, isNotPlayed: true, isError: false, isSeeking: false, isCanPlay: true, isEnded: false
    });
  }

  setPlaying() {
    this.setState({
      isPlaying: true,
      isPausing: false,
      isCanPlay: false,
      isLoading: false,
      isNotPlayed: false,
      isError: false,
      isStalled: false,
      isEnded: false
    });
  }

  setPausing() {
    this.setState({isPlaying: false, isPausing: true});
  }

  setVideoEnded() {
    this.setState({isPlaying: false, isPausing: true, isSeeking: false, isEnded: true});
  }

  setVideoErrorOccurred() {
    this.setState({isError: true, isPlaying: false, isPausing: true, isLoading: false, isSeeking: false});
  }
}

class VideoControlState extends BaseState {
  declare name: Loose;
  constructor(state = {}) {
    super(Object.assign({
      isSeeking: false,
      isDragging: false,
      isWheelSeeking: false,
      isStoryboardAvailable: false
    }, state));
    this.name = 'VideoControl';
  }
}

export {
  BaseState,
  PlayerState,
  VideoControlState
};

import {global} from './ZenzaWatchIndex';
import {NicoCommentPlayer} from './CommentPlayer';
import {util, Config, Fullscreen, VideoCaptureUtil, BaseViewComponent} from './util';
import {YouTubeWrapper} from '../packages/zenza/src/videoPlayer/YouTubeWrapper';
import {CONSTANT} from './constant';
import {Emitter} from './baselib';
import {NicoChatFilter} from '../packages/zenza/src/commentLayer/NicoChatFilter';
import {cssUtil} from '../packages/lib/src/css/css';
import {MediaTimeline} from '../packages/lib/src/dom/MediaTimeline';
import {bounce} from '../packages/lib/src/infra/bounce';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {AudioAdjuster} from '../packages/zenza/src/audio/AudioAdjuster';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
import {SupporterCredit} from '../packages/zenza/src/videoPlayer/SupporterCredit';

//===BEGIN===


/**
 * VideoPlayer + CommentPlayer = NicoVideoPlayer
 *
 * とはいえmasterはVideoPlayerでCommentPlayerは表示位置を受け取るのみ。
 *
 */
class NicoVideoPlayer extends Emitter {
  constructor(params) {
    super();
    this.initialize(params);
  }
  initialize(params) {
    let conf = this._playerConfig = params.playerConfig;

    this._fullscreenNode = params.fullscreenNode;
    this._state = params.playerState;

    this._state.onkey('videoInfo', this.setVideoInfo.bind(this));

    const playbackRate = conf.props.playbackRate;

    const onCommand = (command, param) => this.emit('command', command, param);
    this._videoPlayer = new VideoPlayer({
      volume: conf.props.volume,
      loop: conf.props.loop,
      mute: conf.props.mute,
      autoPlay: conf.props.autoPlay,
      playbackRate,
      debug: conf.props.debug
    });
    this._videoPlayer.on('command', onCommand);

    this._commentPlayer = new NicoCommentPlayer({
      // offScreenLayer: params.offScreenLayer,
      filter: {
        enableFilter: conf.props.enableFilter,
        wordFilter: conf.props.wordFilter,
        wordRegFilter: conf.props.wordRegFilter,
        wordRegFilterFlags: conf.props.wordRegFilterFlags,
        userIdFilter: conf.props.userIdFilter,
        commandFilter: conf.props.commandFilter,
        removeNgMatchedUser: conf.props.removeNgMatchedUser,
        fork0: conf.props['filter.fork0'],
        fork1: conf.props['filter.fork1'],
        fork2: conf.props['filter.fork2'],
        fork3: conf.props['filter.fork3'],
        defaultThread: conf.props['filter.defaultThread'],
        ownerThread: conf.props['filter.ownerThread'],
        communityThread: conf.props['filter.communityThread'],
        nicosThread: conf.props['filter.nicosThread'],
        easyThread: conf.props['filter.easyThread'],
        aiThread: conf.props['filter.aiThread'],
        extraDefaultThread: conf.props['filter.extraDefaultThread'],
        extraOwnerThread: conf.props['filter.extraOwnerThread'],
        extraCommunityThread: conf.props['filter.extraCommunityThread'],
        extraNicosThread: conf.props['filter.extraNicosThread'],
        extraEasyThread: conf.props['filter.extraEasyThread'],
        sharedNgLevel: conf.props.sharedNgLevel
      },
      showComment: conf.props.showComment,
      debug: conf.props.debug,
      playbackRate,
    });
    this._commentPlayer.on('command', onCommand);

    this._contextMenu = new ContextMenu({
      parentNode: params.node.length ? params.node[0] : params.node,
      playerState: this._state
    });
    this._contextMenu.on('command', onCommand);

    if (params.node) {
      this.appendTo(params.node);
    }

    this._initializeEvents();
    this._initializeSupporterCredit();

    this._onTimer = this._onTimer.bind(this);
    this._beginTimer();

    global.debug.nicoVideoPlayer = this;
  }
  _beginTimer() {
    this._stopTimer();
    this._videoWatchTimer =
      self.setInterval(this._onTimer, 100);
  }
  _stopTimer() {
    if (!this._videoWatchTimer) {
      return;
    }
    self.clearInterval(this._videoWatchTimer);
    this._videoWatchTimer = null;
  }
  _initializeEvents() {
    const eventBridge = function(...args) {
      this.emit(...args);
    };
    this._videoPlayer.on('volumeChange', this._onVolumeChange.bind(this));
    this._videoPlayer.on('dblclick', this._onDblClick.bind(this));
    this._videoPlayer.on('aspectRatioFix', this._onAspectRatioFix.bind(this));
    this._videoPlayer.on('play', this._onPlay.bind(this));
    this._videoPlayer.on('playing', this._onPlaying.bind(this));
    this._videoPlayer.on('seeking', this._onSeeking.bind(this));
    this._videoPlayer.on('seeked', this._onSeeked.bind(this));
    this._videoPlayer.on('stalled', eventBridge.bind(this, 'stalled'));
    this._videoPlayer.on('timeupdate', eventBridge.bind(this, 'timeupdate'));
    this._videoPlayer.on('waiting', eventBridge.bind(this, 'waiting'));
    this._videoPlayer.on('progress', eventBridge.bind(this, 'progress'));
    this._videoPlayer.on('pause', this._onPause.bind(this));
    this._videoPlayer.on('ended', this._onEnded.bind(this));
    this._videoPlayer.on('loadedMetaData', this._onLoadedMetaData.bind(this));
    this._videoPlayer.on('canPlay', this._onVideoCanPlay.bind(this));
    this._videoPlayer.on('durationChange', eventBridge.bind(this, 'durationChange'));
    this._videoPlayer.on('playerTypeChange', eventBridge.bind(this, 'videoPlayerTypeChange'));
    this._videoPlayer.on('buffercomplete', eventBridge.bind(this, 'buffercomplete'));

    // マウスホイールとトラックパッドで感度が違うのでthrottoleをかますと丁度良くなる(?)
    this._videoPlayer.on('mouseWheel',
      _.throttle(this._onMouseWheel.bind(this), 50));

    this._videoPlayer.on('abort', eventBridge.bind(this, 'abort'));
    this._videoPlayer.on('error', eventBridge.bind(this, 'error'));

    this._videoPlayer.on('click', this._onClick.bind(this));
    this._videoPlayer.on('contextMenu', this._onContextMenu.bind(this));
    this._commentPlayer.on('parsed', eventBridge.bind(this, 'commentParsed'));
    this._commentPlayer.on('change', eventBridge.bind(this, 'commentChange'));
    this._commentPlayer.on('filterChange', eventBridge.bind(this, 'commentFilterChange'));
    this._state.on('update', this._onPlayerStateUpdate.bind(this));
  }
  _onVolumeChange(vol, mute) {
    this._playerConfig.props.volume = vol;
    this._playerConfig.props.mute = mute;
    this._supporterCredit && this._supporterCredit.setVolume(vol,
      mute || !this._playerConfig.props['supporterCredit.voice']);
    this.emit('volumeChange', vol, mute);
  }
  /*
   * Task 080: 動画の最後に流れる「提供」画面（SupporterCredit.js）。
   * 動画が最後まで再生された時（ended）に、提供音声の長さだけ表示してから、
   * 本来の ended（連続再生の次の動画へ進む等）を出す。
   *   - その間もコメントは流れ続ける（コメントの時刻 = 動画の長さ + 提供画面の経過時間）
   *   - 一時停止・再開は提供画面に効く。シーク・別の動画・閉じる時は提供画面をやめる
   *   - リピート再生中（video.loop）は ended 自体が来ないので出ない。YouTube では出さない
   */
  _initializeSupporterCredit() {
    const credit = this._supporterCredit =
      new SupporterCredit.CreditView({parentNode: this._videoPlayer._body});
    credit.onEnd = () => {
      this._creditCommentHold = {
        videoTime: this._videoPlayer.currentTime,
        commentTime: this._creditBaseTime + credit.duration
      };
      this._emitEnded();
    };
    credit.onSkip = () => {
      if (!credit.isActive) { return; }
      credit.stop();
      credit.onEnd();
    };
    this._creditData = null;
    this._creditAbort = null;
    this._playerConfig.onkey('supporterCredit.enable', v => {
      if (!v) {
        this._cancelSupporterCredit();
      } else if (this.videoInfo && !this._creditData) {
        this._loadSupporterCredit(this.videoInfo);
      }
    });
  }
  /*
   * Task 081: 読み込みは動画を開いた時ではなく「残りが CREDIT_PRELOAD_SEC 秒になった時」に始める。
   * （開いた直後は動画・コメントの読み込みと取り合って、Zenza の表示が遅くなっていたため）
   * ここでは何を読むかを覚えておくだけ。実際の読み込みは _kickSupporterCreditLoad。
   */
  _loadSupporterCredit(videoInfo) {
    this._cancelSupporterCredit();
    this._creditAbort && this._creditAbort.abort();
    this._creditAbort = null;
    this._creditData = null;
    this._creditLoading = null;
    this._creditRequest = null;
    const props = this._playerConfig.props;
    if (!videoInfo || !props['supporterCredit.enable']) { return; }
    const videoId = videoInfo.videoId;
    if (!videoId || !/^[a-z]{2}\d+$/.test(videoId)) { return; }
    const tags = (videoInfo.tagList || [])
      .map(t => t && (t.name || t.tag || t.text)).filter(t => typeof t === 'string' && t);
    this._creditRequest = {videoId, tags};
  }
  /** 提供画面の情報・絵・音声を読み始める（1本の動画につき1回）。読み込み中の Promise を返す */
  _kickSupporterCreditLoad() {
    if (this._creditLoading) { return this._creditLoading; }
    const req = this._creditRequest;
    if (!req) { return null; }
    this._creditRequest = null;
    const props = this._playerConfig.props;
    const abort = this._creditAbort = new AbortController();
    const credit = this._supporterCredit;
    const loading = this._creditLoading = SupporterCredit.load({videoId: req.videoId, tags: req.tags, signal: abort.signal})
      .then(async data => {
        if (abort.signal.aborted || !data) { return; }
        await credit.prepare(data, {gift: !!props['supporterCredit.gift']});
        if (!abort.signal.aborted) {
          this._creditData = data;
        }
      }).catch(e => window.console.warn('提供画面の情報を読めませんでした', e))
      .finally(() => {
        if (this._creditLoading === loading) { this._creditLoading = null; }
      });
    return loading;
  }
  /** 残り時間が少なくなったら読み込みを始める（_onTimer から呼ぶ） */
  _checkSupporterCreditPreload() {
    if (!this._creditRequest) { return; }
    const duration = this._videoPlayer.duration;
    if (!isFinite(duration) || duration <= 0) { return; }
    if (duration - this._videoPlayer.currentTime <= NicoVideoPlayer.CREDIT_PRELOAD_SEC) {
      this._kickSupporterCreditLoad();
    }
  }
  /** 提供画面を出せる状態なら出す。出したら true */
  _tryStartSupporterCredit() {
    const credit = this._supporterCredit;
    const props = this._playerConfig.props;
    if (!credit || credit.isActive || !this._creditData || !credit.isReady ||
      !props['supporterCredit.enable'] || this._videoPlayer._isYouTube) {
      return false;
    }
    if (props['supporterCredit.skipInPlaylist'] && this._state.isPlaylistEnable) {
      return false;
    }
    const duration = this._videoPlayer.duration;
    this._creditBaseTime = isFinite(duration) && duration > 0 ? duration : this._videoPlayer.currentTime;
    this._creditCommentHold = null;
    const video = this.drawableVideoElement;
    const ok = credit.start({
      volume: this._videoPlayer.volume,
      muted: this._videoPlayer.muted,
      voice: !!props['supporterCredit.voice'],
      videoElement: video && (video.drawableElement || video)
    });
    if (!ok) { return false; }
    this._isPlaying = true;
    this._isEnded = false;
    typeof this._state.setPlaying === 'function' && this._state.setPlaying();
    return true;
  }
  /** 提供画面を途中でやめる（ended は出さない）。表示中だったら true */
  _cancelSupporterCredit() {
    const credit = this._supporterCredit;
    this._creditCommentHold = null;
    this._creditWaiting = null;
    if (!credit || !credit.isActive) { return false; }
    credit.stop();
    return true;
  }
  get isSupporterCreditActive() {
    return !!(this._supporterCredit && this._supporterCredit.isActive);
  }
  _onPlayerStateUpdate(key, value) {
    switch (key) {
      case 'isLoop':
        this._videoPlayer.isLoop=value;
        break;
      case 'playbackRate':
        this._videoPlayer.playbackRate=value;
        this._commentPlayer.playbackRate=value;
        break;
      case 'isAutoPlay':
        this._videoPlayer.isAutoPlay=value;
        break;
      case 'isShowComment':
        if (value) {
          this._commentPlayer.show();
        } else {
          this._commentPlayer.hide();
        }
        break;
      case 'isMute':
        this._videoPlayer.muted = value;
        break;
      case 'sharedNgLevel':
        this.filter.sharedNgLevel = value;
        break;
      case 'currentSrc':
        this.setVideo(value);
        break;
    }
  }
  _onMouseWheel(e, delta) {
    if (delta > 0) { // up
      return this.volumeUp();
    }
    if (delta < 0) { // down
      return this.volumeDown();
    }
  }
  volumeUp() {
    const v = Math.max(0.01, this._videoPlayer.volume);
    const r = v < 0.05 ? 1.3 : 1.1;
    this._videoPlayer.volume = Math.max(0, v * r);
  }
  volumeDown() {
    const v = this._videoPlayer.volume;
    const r = 1 / 1.2;
    this._videoPlayer.volume =  v * r;
  }
  _onTimer() {
    this._checkSupporterCreditPreload();
    // Task 080: 提供画面の間も、動画の続きの時刻としてコメントを流し続ける
    const credit = this._supporterCredit;
    if (credit && credit.isActive) {
      this._commentPlayer.currentTime = this._creditBaseTime + credit.currentTime;
      return;
    }
    const videoTime = this._videoPlayer.currentTime;
    const hold = this._creditCommentHold;
    if (hold) {
      // 提供画面が終わった直後は、動画の位置が変わるまでコメントの時刻を戻さない（巻き戻りの再描画を防ぐ）
      if (videoTime === hold.videoTime) {
        this._commentPlayer.currentTime = hold.commentTime;
        return;
      }
      this._creditCommentHold = null;
    }
    this._commentPlayer.currentTime = videoTime;
  }
  _onAspectRatioFix(ratio) {
    this._commentPlayer.setAspectRatio(ratio);
    this.emit('aspectRatioFix', ratio);
  }
  _onLoadedMetaData() {
    this.emit('loadedMetaData');
  }
  _onVideoCanPlay() {
    this.emit('canPlay');
    if (this.autoplay && !this.paused) {
      this._video.play().catch(err => {
        if (err instanceof DOMException) {
          // 他によくあるのはcode: 20 Aborted など
          if (err.code === 35 /* NotAllowedError */) {
            this.dispatchEvent(new CustomEvent('autoplay-rejected'));
          }
        }
      });
    }
  }
  _onPlay() {
    this._isPlaying = true;
    this.emit('play');
  }
  _onPlaying() {
    this._isPlaying = true;
    this.emit('playing');
  }
  _onSeeking() {
    this._isSeeking = true;
    this.emit('seeking');
  }
  _onSeeked() {
    this._isSeeking = false;
    this.emit('seeked');
  }
  _onPause() {
    this._isPlaying = false;
    this.emit('pause');
  }
  _onEnded() {
    // Task 080: 提供画面を出す時は、終わってから ended を出す
    if (this._tryStartSupporterCredit()) {
      return;
    }
    // Task 081: 最後へ一気にシークした時などで読み込みが間に合っていなければ、少しだけ待つ
    const props = this._playerConfig.props;
    const loading = props['supporterCredit.enable'] && !this._videoPlayer._isYouTube &&
      !(props['supporterCredit.skipInPlaylist'] && this._state.isPlaylistEnable) &&
      this._kickSupporterCreditLoad();
    if (loading) {
      const token = this._creditWaiting = {videoTime: this._videoPlayer.currentTime};
      Promise.race([loading, new Promise(r => setTimeout(r, NicoVideoPlayer.CREDIT_WAIT_MS))]).then(() => {
        if (this._creditWaiting !== token) { return; } // その間にシーク・別の動画など
        this._creditWaiting = null;
        if (Math.abs(this._videoPlayer.currentTime - token.videoTime) > 0.5) { return; } // 待っている間に最初から再生し直した
        if (!this._tryStartSupporterCredit()) {
          this._emitEnded();
        }
      });
      return;
    }
    this._emitEnded();
  }
  _emitEnded() {
    this._isPlaying = false;
    this._isEnded = true;
    this.emit('ended');
  }
  _onClick() {
    this._contextMenu.hide();
  }
  _onDblClick() {
    if (this._playerConfig.props.enableFullScreenOnDoubleClick) {
      this.toggleFullScreen();
    }
  }
  _onContextMenu(e) {
    if (!this._contextMenu.isOpen) {
      e.stopPropagation();
      e.preventDefault();
      this._contextMenu.show(e.clientX, e.clientY);
    }
  }
  setVideo(url) {
    this._cancelSupporterCredit();
    let e = {src: url, url: null, promise: null};
    // デバッグ用
    global.emitter.emit('beforeSetVideo', e);
    if (e.url) {
      url = e.url;
    }
    if (e.promise) {
      return e.promise.then(url => {
        this._videoPlayer.setSrc(url);
        this._isEnded = false;
      });
    }
    this._videoPlayer.setSrc(url);
    this._isEnded = false;
    this._isSeeking = false;
  }
  setThumbnail(url) {
    this._videoPlayer.thumbnail = url;
  }
  play() {
    if (this.isSupporterCreditActive) {
      this._supporterCredit.resume();
      this._isPlaying = true;
      typeof this._state.setPlaying === 'function' && this._state.setPlaying();
      return Promise.resolve();
    }
    return this._videoPlayer.play();
  }
  pause() {
    if (this.isSupporterCreditActive) {
      this._supporterCredit.pause();
      this._isPlaying = false;
      return Promise.resolve();
    }
    this._videoPlayer.pause();
    return Promise.resolve();
  }
  togglePlay() {
    if (this.isSupporterCreditActive) {
      return this._supporterCredit.isPlaying ? this.pause() : this.play();
    }
    return this._videoPlayer.togglePlay();
  }
  /** Task 080: 提供画面の最中にシークされたら、提供画面をやめて動画へ戻る */
  _beforeSeek() {
    const wasPlaying = this.isSupporterCreditActive && this._supporterCredit.isPlaying;
    if (this._cancelSupporterCredit()) {
      this._isEnded = false;
      wasPlaying && Promise.resolve().then(() => this._videoPlayer.play()).catch(() => {});
    }
  }
  setPlaybackRate(playbackRate) {
    playbackRate = Math.max(0, Math.min(playbackRate, 10));
    this._videoPlayer.playbackRate = playbackRate;
    this._commentPlayer.setPlaybackRate(playbackRate);
  }
  fastSeek(t) {
    this._beforeSeek();
    this._videoPlayer.fastSeek(Math.max(0, t));
  }
  set currentTime(t) {
    this._beforeSeek();
    this._videoPlayer.currentTime = Math.max(0, t);
  }
  get currentTime() { return this._videoPlayer.currentTime;}
  get vpos() {
    // Task 081: 提供画面の間に投稿したコメントは、本家と同じく「動画の長さ＋経過時間」の位置に付ける
    const credit = this._supporterCredit;
    if (credit && credit.isActive) {
      return (this._creditBaseTime + credit.currentTime) * 100;
    }
    return this.currentTime * 100;
  }
  get duration() {return this._videoPlayer.duration;}
  get chatList() {return this._commentPlayer.chatList;}
  get nonFilteredChatList() {return this._commentPlayer.nonFilteredChatList;}
  appendTo(node) {
    node = util.$(node)[0];
    this._parentNode = node;
    this._videoPlayer.appendTo(node);
    this._commentPlayer.appendTo(node);
  }
  close() {
    this._cancelSupporterCredit();
    this._creditAbort && this._creditAbort.abort();
    this._videoPlayer.close();
    this._commentPlayer.close();
  }
  closeCommentPlayer() {
    this._commentPlayer.close();
  }
  toggleFullScreen() {
    if (Fullscreen.now()) {
      Fullscreen.cancel();
    } else {
      this.requestFullScreen();
    }
  }
  requestFullScreen() {
    Fullscreen.request(this._fullscreenNode || this._parentNode);
  }
  canPlay() {
    return this._videoPlayer.canPlay();
  }
  // Task 070: コメント付きPiP用。実際に映像を描画している<video>（HLS時も含む）
  get drawableVideoElement() {
    return this._videoPlayer && this._videoPlayer._video;
  }
  // Task 070: コメント付きPiP用。コメントの表示位置の計算結果
  get commentViewModel() {
    return this._commentPlayer && this._commentPlayer._viewModel;
  }
  get isPlaying() {
    return !!this._isPlaying;
  }
  get paused() {
    return this._videoPlayer.paused;
  }
  get isSeeking() {
    return !!this._isSeeking;
  }
  get bufferedRange() {return this._videoPlayer.bufferedRange;}
  addChat(text, cmd, vpos, options) {
    if (!this._commentPlayer) {
      return;
    }
    const nicoChat = this._commentPlayer.addChat(text, cmd, vpos, options);
    console.log('addChat:', text, cmd, vpos, options, nicoChat);
    return nicoChat;
  }
  removeChat(nicoChat) {
    if (!this._commentPlayer) {
      return;
    }
    this._commentPlayer.removeChat(nicoChat);
    console.log('removeChat:', nicoChat);
  }
  /**
   * @returns {NicoChatFilter}
   */
  get filter() {return this._commentPlayer.filter;}
  /**
   * @returns {VideoInfoModel}
   */
  get videoInfo() {return this._videoInfo;}
  set videoInfo(info) {this._videoInfo = info;}
  getMymemory() {return this._commentPlayer.getMymemory();}
  getScreenShot() {
    window.console.time('screenShot');

    const fileName = this._getSaveFileName();
    const video = this._videoPlayer.videoElement;

    // Task 077: 画面フィルター（明るさ・反転など）を反映する（設定でOFFにできる）
    return VideoCaptureUtil.videoToCanvas(video).then(({canvas}) => {
      VideoCaptureUtil.saveToFile(ScreenFilter.processCanvas(canvas, {target: 'screenshot'}), fileName);
      window.console.timeEnd('screenShot');
    });
  }
  getScreenShotWithComment() {
    window.console.time('screenShotWithComment');

    const fileName = this._getSaveFileName({suffix: 'C'});
    const video = this._videoPlayer.videoElement;
    const html = this._commentPlayer.getCurrentScreenHtml();

    // Task 077: 動画の部分だけに画面フィルターを掛ける（コメントには掛けない）
    const processVideoCanvas = canvas => ScreenFilter.processCanvas(canvas, {target: 'screenshot'});
    return VideoCaptureUtil.nicoVideoToCanvas({video, html, processVideoCanvas}).then(({canvas}) => {
      VideoCaptureUtil.saveToFile(canvas, fileName);
      window.console.timeEnd('screenShotWithComment');
    });
  }
  _getSaveFileName({suffix = ''} = {}) {
    const title = this._videoInfo.title;
    const watchId = this._videoInfo.watchId;
    const currentTime = this._videoPlayer.currentTime;
    const time = util.secToTime(currentTime).replace(':', '_');
    const prefix = Config.props['screenshot.prefix'] || '';

    return `${prefix}${title} - ${watchId}@${time}${suffix}.png`;
  }
  get isCorsReady() {return this._videoPlayer && this._videoPlayer.isCorsReady;}
  get volume() { return this._videoPlayer.volume;}
  set volume(v) {this._videoPlayer.volume = v;}
  // Task 074: 音量に掛ける倍率（音声の自動調整など）。1 = 変化なし
  get audioGain() { return this._videoPlayer.audioGain; }
  set audioGain(v) { this._videoPlayer.audioGain = v; }
  getDuration() {return this._videoPlayer.duration;}
  getChatList() {return this._commentPlayer.chatList;}
  getVpos() {return Math.floor(this.vpos);}
  setComment(xmlText, options) {this._commentPlayer.setComment(xmlText, options);}
  getNonFilteredChatList() {return this._commentPlayer.nonFilteredChatList;}
  getBufferedRange() {return this._videoPlayer.bufferedRange;}
  setVideoInfo(v) {
    this.videoInfo = v;
    this._loadSupporterCredit(v);
  }
  getVideoInfo() { return this.videoInfo; }
}
// Task 081: 提供画面の読み込みを始める残り秒数と、最後に間に合わなかった時に待つ時間
NicoVideoPlayer.CREDIT_PRELOAD_SEC = 45;
NicoVideoPlayer.CREDIT_WAIT_MS = 5000;


class ContextMenu extends BaseViewComponent {
  constructor({parentNode, playerState}) {
    super({
      parentNode,
      name: 'VideoContextMenu',
      template: ContextMenu.__tpl__,
      css: ContextMenu.__css__
    });
    this._playerState = playerState;
    this._state = {
      isOpen: false
    };

    this._bound.onBodyClick = this.hide.bind(this);
  }

  _initDom(...args) {
    super._initDom(...args);
    global.debug.contextMenu = this;
    const onMouseDown = this._bound.onMouseDown = this._onMouseDown.bind(this);
    this._bound.onBodyMouseUp = this._onBodyMouseUp.bind(this);
    this._bound.onRepeat = this._onRepeat.bind(this);
    this._view.classList.toggle('is-pictureInPictureEnabled', document.pictureInPictureEnabled);
    this._view.addEventListener('mousedown', onMouseDown);
    this._isFirstShow = true;
    this._view.addEventListener('contextmenu', (e) => {
      setTimeout(() => {
        this.hide();
      }, 100);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  _onClick(e) {
    if (e && e.button !== 0) {
      return;
    }

    if (e.type !== 'mousedown') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    super._onClick(e);
  }

  _onMouseDown(e) {
    if (e.target && e.target.getAttribute('data-is-no-close') === 'true') {
      e.stopPropagation();
      this._onClick(e);
    } else if (e.target && e.target.getAttribute('data-repeat') === 'on') {

      e.stopPropagation();
      this._onClick(e);
      this._beginRepeat(e);
    } else {
      e.stopPropagation();
      this._onClick(e);
      setTimeout(() => {
        this.hide();
      }, 100);
    }
  }

  _onBodyMouseUp() {
    this._endRepeat();
  }

  _beginRepeat(e) {
    this._repeatEvent = e;
    document.body.addEventListener('mouseup', this._bound.onBodyMouseUp);

    this._repeatTimer = window.setInterval(this._bound.onRepeat, 200);
    this._isRepeating = true;
  }

  _endRepeat() {
    this._repeatEvent = null;
    // this._isRepeating = false;
    if (this._repeatTimer) {
      window.clearInterval(this._repeatTimer);
      this._repeatTimer = null;
    }
    document.body.removeEventListener('mouseup', this._bound.onBodyMouseUp);
  }

  _onRepeat() {
    if (!this._isRepeating) {
      this._endRepeat();
      return;
    }
    if (this._repeatEvent) {
      this._onClick(this._repeatEvent);
    }
  }

  show(x, y) {
    document.body.addEventListener('click', this._bound.onBodyClick);
    const view = this._view;

    this._onBeforeShow(x, y);

    view.style.left =
      cssUtil.px(Math.max(0, Math.min(x, global.innerWidth - view.offsetWidth)));
    view.style.top =
      cssUtil.px(Math.max(0, Math.min(y + 20, global.innerHeight - view.offsetHeight)));
    this.setState({isOpen: true});
    global.emitter.emitAsync('showMenu');
  }

  hide() {
    document.body.removeEventListener('click', this._bound.onBodyClick);
    util.$(this._view).css({left: '', top: ''});
    this._endRepeat();
    this.setState({isOpen: false});
    global.emitter.emitAsync('hideMenu');
  }

  get isOpen() {
    return this._state.isOpen;
  }

  _onBeforeShow() {
    // チェックボックスなどを反映させるならココ
    const pr = parseFloat(this._playerState.playbackRate, 10);
    const view = util.$(this._view);
    view.find('.selected').removeClass('selected');
    view.find('.playbackRate').forEach(elm => {
      const p = parseFloat(elm.dataset.param, 10);
      if (Math.abs(p - pr) < 0.01) {
        elm.classList.add('selected');
      }
    });
    view.find('[data-config]').forEach(menu => {
      const name = menu.dataset.config;
      menu.classList.toggle('selected', !!global.config.props[name]);
    });
    view.find('.seekToResumePoint')
      .css('display', this._playerState.videoInfo.initialPlaybackTime > 0 ? '' : 'none');
    if (this._isFirstShow) {
      this._isFirstShow = false;
      const handler = (command, param) => {
        this.emit('command', command, param);
      };
      global.emitter.emitAsync('videoContextMenu.addonMenuReady',
        view.find('.empty-area-top'), handler
      );
      global.emitter.emitAsync('videoContextMenu.addonMenuReady.list',
        view.find('.listInner ul'), handler
      );
      global.emitter.emitResolve('videoContextMenu.addonMenuReady',
        {container: view.find('.empty-area-top'), handler}
      );
      global.emitter.emitResolve('videoContextMenu.addonMenuReady.list',
        {container: view.find('.listInner ul'), handler}
      );
    }
  }
}

ContextMenu.__css__ = (`
  .zenzaPlayerContextMenu {
    position: fixed;
    background: rgba(255, 255, 255, 0.8);
    overflow: visible;
    padding: 8px;
    border: 1px outset #333;
    box-shadow: 2px 2px 4px #000;
    transition: opacity 0.3s ease;
    min-width: 200px;
    z-index: 150000;
    user-select: none;
    color: #000;
  }
  .zenzaPlayerContextMenu.is-Open {
    display: block;
    opacity: 0.5;
  }
  .zenzaPlayerContextMenu.is-Open:hover {
    opacity: 1;
  }
  .is-fullscreen .zenzaPlayerContextMenu {
    position: absolute;
  }

  .zenzaPlayerContextMenu:not(.is-Open) {
    display: none;
    /*left: -9999px;
    top: -9999px;
    opacity: 0;*/
  }

  .zenzaPlayerContextMenu ul {
    padding: 0;
    margin: 0;
  }

  .zenzaPlayerContextMenu ul li {
    position: relative;
    line-height: 120%;
    margin: 2px;
    overflow-y: visible;
    white-space: nowrap;
    cursor: pointer;
    padding: 2px 14px;
    list-style-type: none;
    float: inherit;
  }
  .is-playlistEnable .zenzaPlayerContextMenu li.togglePlaylist:before,
  .is-flipV          .zenzaPlayerContextMenu li.toggle-flipV:before,
  .is-flipH          .zenzaPlayerContextMenu li.toggle-flipH:before,
  .zenzaPlayerContextMenu ul                 li.selected:before {
    content: '✔';
    left: -10px;
    color: #000 !important;
    position: absolute;
  }
  .zenzaPlayerContextMenu ul li:hover {
    background: #336;
    color: #fff;
  }
  .zenzaPlayerContextMenu ul li.separator {
    border: 1px outset;
    height: 2px;
    width: 90%;
  }
  .zenzaPlayerContextMenu.show {
    opacity: 0.8;
  }
  .zenzaPlayerContextMenu .listInner {
  }

  .zenzaPlayerContextMenu .controlButtonContainer {
    position: absolute;
    bottom: 100%;
    left: 50%;
    width: 110%;
    transform: translate(-50%, 0);
    white-space: nowrap;
  }
  .zenzaPlayerContextMenu .controlButtonContainerFlex {
    display: flex;
  }

  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton {
    flex: 1;
    height: 48px;
    font-size: 24px;
    line-height: 46px;
    border: 1px solid;
    border-radius: 4px;
    color: #333;
    background: rgba(192, 192, 192, 0.95);
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
    box-shadow: 0 0 0;
    opacity: 1;
    margin: auto;
  }

  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.screenShot {
    flex: 1;
    font-size: 24px;
  }

  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.playbackRate {
    flex: 2;
    font-size: 14px;
  }
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.rate010,
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.rate100,
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.rate200 {
    flex: 3;
    font-size: 24px;
  }
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.seek5s {
    flex: 2;
  }
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton.seek15s {
    flex: 3;
  }
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton:hover {
    transform: translate(0px, -4px);
    box-shadow: 0px 4px 2px #666;
  }
  .zenzaPlayerContextMenu .controlButtonContainerFlex > .controlButton:active {
    transform: none;
    box-shadow: 0 0 0;
    border: 1px inset;
  }

  [data-command="picture-in-picture"],
  [data-command="picture-in-picture-comment"] {
    display: none;
  }
  .is-pictureInPictureEnabled [data-command="picture-in-picture"],
  .is-pictureInPictureEnabled [data-command="picture-in-picture-comment"] {
    display: block;
  }

  `).trim();

ContextMenu.__tpl__ = (`
  <div class="zenzaPlayerContextMenu">
    <div class="controlButtonContainer">
      <div class="controlButtonContainerFlex">
        <div class="controlButton command screenShot" data-command="screenShot"
          data-param="0.1" data-type="number" data-is-no-close="true">
          &#128247;<div class="tooltip">スクリーンショット</div>
        </div>
        <div class="empty-area-top" style="flex:4;" data-is-no-close="true"></div>
      </div>
      <div class="controlButtonContainerFlex">
        <div class="controlButton command rate010 playbackRate" data-command="playbackRate"
          data-param="0.1" data-type="number" data-repeat="on">
          &#128034;<div class="tooltip">コマ送り(0.1倍)</div>
        </div>
        <div class="controlButton command rate050 playbackRate" data-command="playbackRate"
          data-param="0.5" data-type="number" data-repeat="on">
          <div class="tooltip">0.5倍速</div>
        </div>
        <div class="controlButton command rate075 playbackRate" data-command="playbackRate"
          data-param="0.75" data-type="number" data-repeat="on">
          <div class="tooltip">0.75倍速</div>
        </div>

        <div class="controlButton command rate100 playbackRate" data-command="playbackRate"
          data-param="1.0" data-type="number" data-repeat="on">
          &#9655;<div class="tooltip">標準速</div>
        </div>

        <div class="controlButton command rate125 playbackRate" data-command="playbackRate"
          data-param="1.25" data-type="number" data-repeat="on">
          <div class="tooltip">1.25倍速</div>
        </div>
        <div class="controlButton command rate150 playbackRate" data-command="playbackRate"
          data-param="1.5" data-type="number" data-repeat="on">
          <div class="tooltip">1.5倍速</div>
        </div>
        <div class="controlButton command rate200 playbackRate" data-command="playbackRate"
          data-param="2.0" data-type="number" data-repeat="on">
          &#128007;<div class="tooltip">2倍速</div>
        </div>
      </div>
      <div class="controlButtonContainerFlex seekToResumePoint">
        <div class="controlButton command"
        data-command="seekToResumePoint"
        >▼ここまで見た
          <div class="tooltip">レジューム位置にジャンプ</div>
        </div>
      </div>
      <div class="controlButtonContainerFlex">
        <div class="controlButton command seek5s"
          data-command="seekBy" data-param="-5" data-type="number" data-repeat="on"
          >⇦
            <div class="tooltip">5秒戻る</div>
        </div>
        <div class="controlButton command seek15s"
          data-command="seekBy" data-param="-15" data-type="number" data-repeat="on"
          >⇦
            <div class="tooltip">15秒戻る</div>
        </div>
        <div class="controlButton command seek15s"
          data-command="seekBy" data-param="15" data-type="number" data-repeat="on"
          >⇨
            <div class="tooltip">15秒進む</div>
        </div>
        <div class="controlButton command seek5s"
          data-command="seekBy" data-param="5" data-type="number" data-repeat="on"
          >⇨
            <div class="tooltip">5秒進む</div>
        </div>
      </div>
    </div>
    <div class="listInner">
      <ul>
        <li class="command" data-command="togglePlay">停止/再開</li>
        <li class="command" data-command="seekTo" data-param="0">先頭に戻る</li>
        <hr class="separator">
        <li class="command toggleLoop"        data-config="loop" data-command="toggle-loop">リピート</li>
        <li class="command togglePlaylist"    data-command="togglePlaylist">連続再生</li>
        <li class="command toggleShowComment" data-config="showComment" data-command="toggle-showComment">コメントを表示</li>
        <li class="command" data-command="picture-in-picture">P in P</li>
        <li class="command" data-command="picture-in-picture-comment">P in P(コメント付き)</li>
        <hr class="separator">

        <li class="command toggle-flipH" data-config="screenFilter.flipH" data-command="toggle-flipH">左右反転</li>
        <li class="command toggle-flipV" data-config="screenFilter.flipV" data-command="toggle-flipV">上下反転</li>

        <hr class="separator">

        <li class="command"
          data-command="reload">動画のリロード</li>
        <li class="command"
          data-command="copy-video-watch-url">動画URLをコピー</li>
        <li class="command debug" data-config="debug"
          data-command="toggle-debug">デバッグ</li>
        <li class="command mymemory"
          data-command="saveMymemory">コメントの保存</li>
      </ul>
    </div>
  </div>
`).trim();


/**
 *  Video要素をラップした物
 *
 */
class VideoPlayer extends Emitter {
  constructor(params) {
    super();
    this._initialize(params);
    global.debug.timeline = MediaTimeline.register('main', this);
  }

  _initialize(params) {
    this._id = 'video' + Math.floor(Math.random() * 100000);
    this._resetVideo(params);

    util.addStyle(VideoPlayer.__css__);
  }

  _reset() {
    this.removeClass('is-play is-pause is-abort is-error');
    this._isPlaying = false;
    this._canPlay = false;
  }

  addClass(className) {
    this.classList.add(...className.split(/\s/));
  }

  removeClass(className) {
    this.classList.remove(...className.split(/\s/));
  }

  toggleClass(className, v) {
    const classList = this.classList;
    className.split(/[ ]+/).forEach(name => {
      classList.toggle(name, v);
    });
  }

  _resetVideo(params) {
    params = params || {};
    if (this._videoElement) {
      params.autoplay = this._videoElement.autoplay;
      params.loop = this._videoElement.loop;
      params.mute = this._videoElement.muted;
      // Task 074: 倍率を掛けた後の値ではなく、ユーザーが決めた音量を引き継ぐ
      params.volume = this.volume;
      params.playbackRate = this._videoElement.playbackRate;
      this._videoElement.remove();
    }

    const options = {
      autobuffer: true,
      preload: 'auto',
      mute: !!params.mute,
      'playsinline': true,
      'webkit-playsinline': true
    };

    const volume =
      params.hasOwnProperty('volume') ? parseFloat(params.volume) : 0.5;
    const playbackRate = this._playbackRate =
      params.hasOwnProperty('playbackRate') ? parseFloat(params.playbackRate) : 1.0;

    const video = util.createVideoElement();
    const body = document.createElement('div');
    util.$(body)
      .addClass(`videoPlayer nico ${this._id}`);
    util.$(video)
      .addClass('videoPlayer-video')
      .attr(options);
    body.id = 'ZenzaWatchVideoPlayerContainer';
    this._body = body;
    this.classList = ClassList(body);
    body.append(video);
    video.pause();

    this._video = video;
    this._video.className = 'zenzaWatchVideoElement';
    video.controlslist = 'nodownload';
    video.controls = false;
    video.autoplay = !!params.autoPlay;
    video.loop = !!params.loop;
    this._videoElement = video;

    this._isPlaying = false;
    this._canPlay = false;

    this.volume = volume;
    this.muted = params.mute;
    this.playbackRate = playbackRate;

    this._touchWrapper = new TouchWrapper({
      parentElement: body
    });
    this._touchWrapper.on('command', (command, param) => {
      if (command === 'contextMenu') {
        this._emit('contextMenu', param);
        return;
      }
      this.emit('command', command, param);
    });

    this._initializeEvents();

    global.debug.video = this._video;
    Object.assign(global.external, {getVideoElement: () => this._video});
  }

  _initializeEvents() {
    const eventBridge = function(name, ...args) {
      console.log('%c_on-%s:', 'background: cyan;', name, ...args);
      this.emit(name, ...args);
    };

    util.$(this._video)
      .on('canplay', this._onCanPlay.bind(this))
      .on('canplaythrough', eventBridge.bind(this, 'canplaythrough'))
      .on('loadstart', eventBridge.bind(this, 'loadstart'))
      .on('loadeddata', eventBridge.bind(this, 'loadeddata'))
      .on('loadedmetadata', eventBridge.bind(this, 'loadedmetadata'))
      .on('ended', eventBridge.bind(this, 'ended'))
      .on('emptied', eventBridge.bind(this, 'emptied'))
      // .on('stalled', this._onStalled.bind(this))
      .on('suspend', eventBridge.bind(this, 'suspend'))
      .on('waiting', eventBridge.bind(this, 'waiting'))
      .on('progress', this._onProgress.bind(this))
      .on('durationchange', this._onDurationChange.bind(this))
      .on('abort', this._onAbort.bind(this))
      .on('error', this._onError.bind(this))
      .on('buffercomplete', eventBridge.bind(this, 'buffercomplete'))

      .on('pause', this._onPause.bind(this))
      .on('play', this._onPlay.bind(this))
      .on('playing', this._onPlaying.bind(this))
      .on('seeking', this._onSeeking.bind(this))
      .on('seeked', this._onSeeked.bind(this))
      .on('volumechange', this._onVolumeChange.bind(this))
      .on('contextmenu', eventBridge.bind(this, 'contextmenu'))
      .on('click', eventBridge.bind(this, 'click'))
    ;

    const touch = util.$(this._touchWrapper.body);
    touch
      .on('click', eventBridge.bind(this, 'click'))
      .on('dblclick', this._onDoubleClick.bind(this))
      .on('contextmenu', eventBridge.bind(this, 'contextmenu'))
      .on('wheel', this._onMouseWheel.bind(this), {passive: true})
    ;
  }

  _onCanPlay(...args) {
    console.log('%c_onCanPlay:', 'background: cyan; color: blue;', ...args);

    this.playbackRate = this.playbackRate;
    // リピート時にも飛んでくるっぽいので初回だけにする
    if (!this._canPlay) {
      this._canPlay = true;
      this.removeClass('is-loading');
      if (Config.props.enableResume && this._video.currentTime == 0) {
        this.emit('command', 'seekToResumePoint')
      }
      this.emit('canPlay', ...args);
      if (this._video.videoHeight < 1) {
        this._isAspectRatioFixed = false;
      } else {
        this._isAspectRatioFixed = true;
        this.emit('aspectRatioFix',
          this._video.videoHeight / Math.max(1, this._video.videoWidth));
      }
      if (this._isYouTube && Config.props.bestZenTube) {
        this._videoYouTube.selectBestQuality();
      }
    }
  }

  _onProgress() {
    //console.log('%c_onProgress:', 'background: cyan;', arguments);
    this.emit('progress', this._video.buffered, this._video.currentTime);
  }

  _onDurationChange() {
    console.log('%c_onDurationChange:', 'background: cyan;', arguments);
    this.emit('durationChange', this._video.duration);
  }

  _onAbort() {
    if (this._isYouTube) {
      return;
    } // TODO: YouTube側のエラーハンドリング
    // console.warn('%c_onAbort:', 'background: cyan; color: red;');
    this._isPlaying = false;
    this.addClass('is-abort');
    this.emit('abort');
  }

  _onError(e) {
    if (this._isYouTube) {
      return;
    }
    if (this._videoElement.src === CONSTANT.BLANK_VIDEO_URL ||
      !this._videoElement.src ||
      this._videoElement.src.match(/^https?:$/) ||
      this._videoElement.src === '//'
    ) {
      return;
    }
    window.console.error('error src', this._video.src);
    window.console.error('%c_onError:', 'background: cyan; color: red;', arguments);
    this.addClass('is-error');
    this._canPlay = false;
    this.emit('error', {
      code: (e && e.target && e.target.error && e.target.error.code) || 0,
      target: e.target || this._video,
      type: 'normal'
    });
  }

  _onYouTubeError(e) {
    window.console.error('error src', this._video.src);
    window.console.error('%c_onError:', 'background: cyan; color: red;', e);
    this.addClass('is-error');
    this._canPlay = false;
    let fallback = false;

    const code = e.data;
    const description = (() => {
      switch (code) {
        case 2:
          return 'YouTube Error: パラメータエラー (2 invalid parameter)';
        case 5:
          return 'YouTube Error: HTML5 関連エラー (5 HTML5 error)';
        case 100:
          fallback = true;
          return 'YouTube Error: 動画が見つからないか、非公開 (100 video not found)';
        case 101:
        case 150:
          fallback = true;
          return `YouTube Error: 外部での再生禁止 (${code} forbidden)`;
        default:
          return `YouTube Error: (code${code})`;
      }
    })();

    this.emit('error', {
      code,
      description,
      fallback,
      target: this._videoElement,
      type: 'youtube'
    });
  }

  _onPause() {
    console.log('%c_onPause:', 'background: cyan;', arguments);
    //this.removeClass('is-play');

    this._isPlaying = false;
    this.emit('pause');
  }

  _onPlay() {
    console.log('%c_onPlay:', 'background: cyan;', arguments);
    this.addClass('is-play');
    this._isPlaying = true;
    this.emit('play');
  }

  _onPlaying() {
    console.log('%c_onPlaying:', 'background: cyan;', arguments);
    this._isPlaying = true;

    if (!this._isAspectRatioFixed) {
      this._isAspectRatioFixed = true;
      this.emit('aspectRatioFix',
        this._video.videoHeight / Math.max(1, this._video.videoWidth));
    }

    this.emit('playing');
  }

  _onSeeking() {
    console.log('%c_onSeeking:', 'background: cyan;', arguments);
    this.emit('seeking', this._video.currentTime);
  }

  _onSeeked() {
    console.log('%c_onSeeked:', 'background: cyan;', arguments);

    this.emit('seeked', this._video.currentTime);
  }

  _onVolumeChange() {
    console.log('%c_onVolumeChange:', 'background: cyan;', arguments);
    // Task 074: 外（ブラウザのUI・PiPウィンドウなど）から音量が変わった場合は、
    // 倍率を割り戻してユーザーの音量として扱う
    const gain = this._isYouTube ? 1 : this.audioGain;
    const expected = Math.max(0, Math.min(1, this.volume * gain));
    if (Math.abs(this._video.volume - expected) > 0.01) {
      this._userVolume = Math.max(0, Math.min(1, this._video.volume / (gain || 1)));
    }
    this.emit('volumeChange', this.volume, this.muted);
  }

  _onDoubleClick(e) {
    console.log('%c_onDoubleClick:', 'background: cyan;', arguments);
    e.preventDefault();
    e.stopPropagation();
    this.emit('dblclick');
  }

  _onMouseWheel(e) {
    if (e.buttons || e.shiftKey) {
      return;
    }
    console.log('%c_onMouseWheel:', 'background: cyan;', e);
    e.stopPropagation();
    const delta = e.deltaY * -1;
    if (Number.isNaN(delta)) {
      return;
    }
    this.emit('mouseWheel', e, delta);
  }

  _onStalled(e) {
    this.emit('stalled', e);
    this._video.addEventListener('timeupdate', () => this.emit('timeupdate'), {once: true});
  }

  canPlay() {
    return !!this._canPlay;
  }

  async play() {
    if (this._currentVideo.currentTime === this.duration) {
      this.currentTime = 0;
    }
    const p = await this._video.play();
    this._isPlaying = true;
    return p;
  }

  pause() {
    this._video.pause();
    this._isPlaying = false;
    return Promise.resolve();
  }

  get isPlaying() {
    return !!this._isPlaying && !!this._canPlay;
  }
  get paused() {
    return this._video.paused;
  }
  set thumbnail(url) {
    console.log('%csetThumbnail: %s', 'background: cyan;', url);

    this._thumbnail = url;
    this._video.poster = url;
    //this.emit('setThumbnail', url);
  }
  get thumbnail() {
    return this._thumbnail;
  }

  set src(url) {
    console.log('%csetSc: %s', 'background: cyan;', url);

    this._reset();

    this._src = url;
    this._isPlaying = false;
    this._canPlay = false;
    this._isAspectRatioFixed = false;
    this.addClass('is-loading');

    if (/(youtube\.com|youtu\.be)/.test(url)) {
      const currentTime = this._currentVideo.currentTime;
      this._initYouTube().then(() => {
        // 通常使用では(video|YouTube) -> YouTubeへの遷移しか存在しないので
        // 逆方向の想定は色々端折っている
        return this._videoYouTube.setSrc(url, currentTime);
      }).then(() => {
        this._changePlayer('YouTube');
      });
      return;
    }

    this._changePlayer('normal');
    if (url.indexOf('dmc.nico') >= 0 && location.host.indexOf('.nicovideo.jp') >= 0) {
      this._video.crossOrigin = 'use-credentials';
    } else if (this._video.crossOrigin) {
      this._video.crossOrigin = null;
    }

    this._video.src = url;
  }
  get src() {return this._src;}

  get _isYouTube() {return this._videoYouTube && this._currentVideo === this._videoYouTube;}

  _initYouTube() {
    if (this._videoYouTube) {
      return Promise.resolve(this._videoYouTube);
    }
    const yt = this._videoYouTube = new YouTubeWrapper({
      parentNode: this._body.appendChild(document.createElement('div')),
      volume: this._volume,
      autoplay: this._videoElement.autoplay
    });
    const eventBridge = function(...args) {
      this.emit(...args);
    };

    yt.on('canplay', this._onCanPlay.bind(this));
    yt.on('loadedmetadata', eventBridge.bind(this, 'loadedmetadata'));
    yt.on('ended', eventBridge.bind(this, 'ended'));
    yt.on('stalled', eventBridge.bind(this, 'stalled'));
    yt.on('pause', this._onPause.bind(this));
    yt.on('play', this._onPlay.bind(this));
    yt.on('playing', this._onPlaying.bind(this));

    yt.on('seeking', this._onSeeking.bind(this));
    yt.on('seeked', this._onSeeked.bind(this));
    yt.on('volumechange', this._onVolumeChange.bind(this));
    yt.on('error', this._onYouTubeError.bind(this));

    global.debug.youtube = yt;
    return Promise.resolve(this._videoYouTube);
  }

  _changePlayer(type) {
    switch (type.toLowerCase()) {
      case 'youtube':
        if (this._currentVideo !== this._videoYouTube) {
          const yt = this._videoYouTube;
          this.addClass('is-youtube');
          yt.autoplay = this._currentVideo.autoplay;
          yt.loop = this._currentVideo.loop;
          yt.muted = this._currentVideo.muted;
          yt.volume = this.volume;
          yt.playbackRate = this._currentVideo.playbackRate;
          this._currentVideo = yt;
          this._videoElement.src = CONSTANT.BLANK_VIDEO_URL;
          this.emit('playerTypeChange', 'youtube');
        }
        break;
      default:
        if (this._currentVideo === this._videoYouTube) {
          this.removeClass('is-youtube');
          this._videoElement.loop = this._currentVideo.loop;
          this._videoElement.muted = this._currentVideo.muted;
          this.volume = this._currentVideo.volume;
          this._videoElement.playbackRate = this._currentVideo.playbackRate;
          this._currentVideo = this._videoElement;
          this._videoYouTube.src = '';
          this.emit('playerTypeChange', 'normal');
        }
        break;
    }
  }

  /*
   * Task 074: 「音量」と「実際に出す音量」を分ける。
   * volume はユーザーが決めた音量（設定に保存されるのはこちら）。
   * 実際の<video>のvolumeには、音声の自動調整などの倍率(audioGain)を掛けた値を入れる。
   * こうしないと、倍率を掛けた音量がそのまま設定に保存されて、動画を変えるたびに音が小さくなっていく。
   */
  set volume(vol) {
    vol = Math.max(Math.min(1, vol), 0);
    this._userVolume = vol;
    this._applyVolume();
  }
  get volume() {
    return typeof this._userVolume === 'number' ? this._userVolume : Math.max(0, this._video.volume);
  }
  set audioGain(gain) {
    const g = (typeof gain === 'number' && isFinite(gain) && gain > 0) ? Math.min(gain, 1) : 1;
    if (this._audioGain === g) { return; }
    this._audioGain = g;
    this._applyVolume();
  }
  get audioGain() { return typeof this._audioGain === 'number' ? this._audioGain : 1; }
  _applyVolume() {
    // YouTube(ZenTube)側は倍率の情報が無いのでそのまま
    const gain = this._isYouTube ? 1 : this.audioGain;
    const next = Math.max(0, Math.min(1, this.volume * gain));
    if (Math.abs(this._video.volume - next) > 0.0001) {
      this._video.volume = next;
    }
  }
  set muted(v) {
    v = !!v;
    if (this._video.muted !== v) {
      this._video.muted = v;
    }
  }
  get muted() {return this._video.muted;}

  get currentTime() {
    if (!this._canPlay) {
      return 0;
    }
    return this._video.currentTime;
  }

  set currentTime(sec) {
    const cur = this._video.currentTime;
    if (cur !== sec) {
      this._video.currentTime = sec;
      this.emit('seek', this._video.currentTime);
    }
  }

  /**
   * fastSeekが使えたら使う。 現状Firefoxのみ？
   * - currentTimeによるシーク 位置は正確だが遅い
   * - fastSeekによるシーク キーフレームにしか飛べないが速い(FLashに近い)
   * なので、smile動画のループはこっちを使ったほうが再現度が高くなりそう
   */
  fastSeek(sec) {
    if (typeof this._video.fastSeek !== 'function' || this._isYouTube) {
      return this.currentTime=sec;
    }
    // dmc動画はキーフレーム間隔が1秒とか意味不明な仕様なのでcurrentTimeでいい
    if (this._src.indexOf('dmc.nico') >= 0) {
      return this.currentTime = sec;
    }
    this._video.fastSeek(sec);
    this.emit('seek', this._video.currentTime);
  }

  get duration() {return this._video.duration;}


  togglePlay() {
    if (this.isPlaying) {
      return this.pause();
    } else {
      return this.play();
    }
  }

  get vpos() {return this._video.currentTime * 100;}
  set vpos(vpos) {this._video.currentTime = vpos / 100;}
  get isLoop() {return !!this._video.loop;}
  set isLoop(v) {this._video.loop = !!v; }
  set playbackRate(v) {
    console.log('setPlaybackRate', v);
    //if (!ZenzaWatch.util.isPremium()) { v = Math.min(1, v); }
    // たまにリセットされたり反映されなかったりする？
    this._playbackRate = v;
    const video = this._video;
    video.playbackRate = 1;
    window.setTimeout(() => video.playbackRate = parseFloat(v), 100);
  }
  get playbackRate() {return this._playbackRate;}
  get bufferedRange() {return this._video.buffered;}
  set isAutoPlay(v) {this._video.autoplay = v;}
  get isAutoPlay() {return this._video.autoPlay;}
  setSrc(url) { this.src = url;}
  setVolume(v) { this.volume = v; }
  getVolume() { return this.volume; }
  setMute(v) { this.muted = v;}
  isMuted() { return this.muted; }
  getDuration() { return this.duration; }
  getVpos() { return this.vpos; }
  setVpos(v) { this.vpos = v; }
  getIsLoop() {return this.isLoop;}
  setIsLoop(v) {this.isLoop = !!v; }
  setPlaybackRate(v) { this.playbackRate = v; }
  getPlaybackRate() { return this.playbackRate; }
  getBufferedRange() { return this.bufferedRange; }
  setIsAutoPlay(v) {this.isAutoplay = v;}
  getIsAutoPlay() {return this.isAutoPlay;}

  appendTo(node) {node.append(this._body);}

  close() {
    this._video.pause();

    this._video.removeAttribute('src');
    this._video.removeAttribute('poster');

    // removeAttribute('src')では動画がクリアされず、
    // 空文字を指定しても base hrefと連結されて
    // http://www.nicovideo.jpへのアクセスが発生する. どないしろと.
    this._videoElement.src = CONSTANT.BLANK_VIDEO_URL;
    //window.console.info('src', this._video.src, this._video.getAttribute('src'));
    if (this._videoYouTube) {
      this._videoYouTube.src = '';
    }
  }

  /**
   * 画面キャプチャを取る。
   * CORSの制限があるので保存できない。
   */
  getScreenShot() {
    if (!this.isCorsReady) {
      return null;
    }
    const video = this._video;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video.drawableElement || video, 0, 0);
    return canvas;
  }

  get isCorsReady() {return this._video.crossOrigin === 'use-credentials';}

  get videoElement() {return this._videoElement;}

  get _video() {return this._currentVideo;}

  set _video(v) {this._currentVideo = v;}
}

VideoPlayer.__css__ = `
    .videoPlayer iframe,
    .videoPlayer .zenzaWatchVideoElement {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
    }
    .zenzaWatchVideoElement {
      display: block;
      transition: transform 0.4s ease;
    }

    .is-flipH .zenzaWatchVideoElement {
      transform: perspective(400px) rotateY(180deg);
    }
    .is-flipV .zenzaWatchVideoElement {
      transform: perspective(400px) rotateX(180deg);
    }
    .is-flipV.is-flipH .zenzaWatchVideoElement {
      transform: perspective(400px) rotateX(180deg) rotateY(180deg);
    }

    /* iOSだとvideo上でマウスイベントが発生しないのでカバーを掛ける */
    .touchWrapper {
      display: block;
      position: absolute;
      opacity: 0;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      touch-action: none;
    }
    /* YouTubeのプレイヤーを触れる用にするための隙間 */
    .is-youtube .touchWrapper {
      width:  calc(100% - 100px);
      height: calc(100% - 150px);
    }

    .is-loading .touchWrapper,
    .is-error .touchWrapper {
      display: none !important;
    }

    .videoPlayer.is-youtube .zenzaWatchVideoElement {
      display: none;
    }

    .videoPlayer iframe {
      display: none;
    }

    .videoPlayer.is-youtube iframe {
      display: block;
    }


  `.trim();


class TouchWrapper extends Emitter {
  constructor({parentElement}) {
    super();
    this._parentElement = parentElement;

    this._config = global.config.namespace('touch');
    this._isTouching = false;
    this._maxCount = 0;
    this._currentPointers = [];

    this._debouncedOnSwipe2Y = _.debounce(this._onSwipe2Y.bind(this), 400);
    this._debouncedOnSwipe3X = _.debounce(this._onSwipe3X.bind(this), 400);
    this.initializeDom();
  }

  initializeDom() {
    let body = this._body = document.createElement('div');
    body.className = 'touchWrapper';

    body.addEventListener('click', this._onClick.bind(this));

    body.addEventListener('touchstart', this._onTouchStart.bind(this), {passive: true});
    body.addEventListener('touchmove', this._onTouchMove.bind(this), {passive: true});
    body.addEventListener('touchend', this._onTouchEnd.bind(this), {passive: true});
    body.addEventListener('touchcancel', this._onTouchCancel.bind(this), {passive: true});

    this._onTouchMoveThrottled =
      _.throttle(this._onTouchMoveThrottled.bind(this), 200);

    if (this._parentElement) {
      this._parentElement.appendChild(body);
    }
    global.debug.touchWrapper = this;
  }

  get body() {
    return this._body;
  }

  _onClick() {
    this._lastTap = 0;
  }

  _onTouchStart(e) {
    let identifiers =
      this._currentPointers.map(touch => {
        return touch.identifier;
      });
    if (e.changedTouches.length > 1) {
      e.preventDefault();
    }

    [...e.changedTouches].forEach(touch => {
      if (identifiers.includes(touch.identifier)) {
        return;
      }
      this._currentPointers.push(touch);
    });

    this._maxCount = Math.max(this._maxCount, this.touchCount);
    this._startCenter = this._getCenter(e);
    this._lastCenter = this._getCenter(e);
    this._isMoved = false;
  }

  _onTouchMove(e) {
    if (e.targetTouches.length > 1) {
      e.preventDefault();
    }
    this._onTouchMoveThrottled(e);
  }

  _onTouchMoveThrottled(e) {
    if (!e.targetTouches) {
      return;
    }
    if (e.targetTouches.length > 1) {
      e.preventDefault();
    }
    let startPoint = this._startCenter;
    let lastPoint = this._lastCenter;
    let currentPoint = this._getCenter(e);

    if (!startPoint || !currentPoint) {
      return;
    }
    let width = this._body.offsetWidth;
    let height = this._body.offsetHeight;
    let diff = {
      count: this.touchCount,
      startX: startPoint.x,
      startY: startPoint.y,
      currentX: currentPoint.x,
      currentY: currentPoint.y,
      moveX: currentPoint.x - lastPoint.x,
      moveY: currentPoint.y - lastPoint.y,
      x: currentPoint.x - startPoint.x,
      y: currentPoint.y - startPoint.y,
    };

    diff.perX = diff.x / width * 100;
    diff.perY = diff.y / height * 100;
    diff.perStartX = diff.startX / width * 100;
    diff.perStartY = diff.startY / height * 100;
    diff.movePerX = diff.moveX / width * 100;
    diff.movePerY = diff.moveY / height * 100;


    if (Math.abs(diff.perX) > 2 || Math.abs(diff.perY) > 1) {
      this._isMoved = true;
    }

    if (diff.count === 2) {
      if (Math.abs(diff.movePerX) >= 0.5) {
        this._execCommand('seekRelativePercent', diff);
      }
      if (Math.abs(diff.perY) >= 20) {
        this._debouncedOnSwipe2Y(diff);
      }
    }

    if (diff.count === 3) {
      if (Math.abs(diff.perX) >= 20) {
        this._debouncedOnSwipe3X(diff);
      }
    }

    this._lastCenter = currentPoint;
    return diff;
  }

  _onSwipe2Y(diff) {
    this._execCommand(diff.perY < 0 ? 'shiftUp' : 'shiftDown');
    this._startCenter = this._lastCenter;
  }

  _onSwipe3X(diff) {
    this._execCommand(diff.perX < 0 ? 'playNextVideo' : 'playPreviousVideo');
    this._startCenter = this._lastCenter;
  }

  _execCommand(command, param) {
    if (!this._config.props.enable) {
      return;
    }
    if (!command) {
      return;
    }
    this.emit('command', command, param);
  }

  _onTouchEnd(e) {
    if (!e.changedTouches) {
      return;
    }
    let identifiers =
      Array.from(e.changedTouches).map(touch => {
        return touch.identifier;
      });
    let currentTouches = [];

    currentTouches = this._currentPointers.filter(touch => {
      return !identifiers.includes(touch.identifier);
    });

    this._currentPointers = currentTouches;

    //touchstartは複数タッチでも一回にまとまって飛んでくるが、
    //touchendは指の数だけ飛んでくるっぽい？
    //window.console.log('onTouchEnd', this._isMoved, e.changedTouches.length, this._maxCount, this.touchCount);
    if (!this._isMoved && this.touchCount === 0) {
      const config = this._config;
      this._lastTap = this._maxCount;
      window.console.info('touchEnd', this._maxCount, this._isMoved);
      switch (this._maxCount) {
        case 2:
          this._execCommand(config.props.tap2command);
          break;
        case 3:
          this._execCommand(config.props.tap3command);
          break;
        case 4:
          this._execCommand(config.props.tap4command);
          break;
        case 5:
          this._execCommand(config.props.tap5command);
          break;
      }
      this._maxCount = 0;
      this._isMoved = false;
    }

  }

  _onTouchCancel(e) {
    if (!e.changedTouches) {
      return;
    }
    let identifiers =
      Array.from(e.changedTouches).map(touch => {
        return touch.identifier;
      });
    let currentTouches = [];

    window.console.log('onTouchCancel', this._isMoved, e.changedTouches.length);
    currentTouches = this._currentPointers.filter(touch => {
      return !identifiers.includes(touch.identifier);
    });

    this._currentPointers = currentTouches;
  }

  get touchCount() {
    return this._currentPointers.length;
  }

  _getCenter(e) {
    let x = 0, y = 0;
    Array.from(e.touches).forEach(t => {
      x += t.pageX;
      y += t.pageY;
    });
    return {x: x / e.touches.length, y: y / e.touches.length};
  }
}


//===END===

export {
  NicoVideoPlayer,
  ContextMenu,
  VideoPlayer
};

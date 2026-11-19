/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogCommands.js (Task1060: NicoVideoPlayerDialog.ts から役割ごとに分割).
 * コマンド（メニュー・ショートカット）の実行とキー操作。
 * NicoVideoPlayerDialog.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// Task1060: 本体のクラス（実行時は同じスコープにある）。
type Dialog = import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
declare const NicoVideoPlayerDialog: typeof import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
// legacy-to-ts: names provided by other bundled modules
declare const Fullscreen: typeof import('./Fullscreen').Fullscreen;
declare const MediaSessionApi: typeof import('./MediaSessionApi').MediaSessionApi;
declare const OfficialPlayerRoute: Loose;
declare const RelatedMenuActions: typeof import('./external/RelatedMenuActions').RelatedMenuActions;
declare const RelatedMenuOrder: typeof import('./external/RelatedMenuOrder').RelatedMenuOrder;
declare const SHORTCUT_ACTIONS: typeof import('./ShortcutActions').SHORTCUT_ACTIONS;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil;

/** コマンド（メニュー・ショートカット）の実行とキー操作。 */
const NicoVideoPlayerDialogCommands = {
  execCommand(this: Dialog, command?: Loose, param?: Loose) {
    return this._onCommand(command, param);
  },
  _onCommand(this: Dialog, command?: Loose, param?: Loose, request?: Loose) {
    const outer = !this._actionFeedbackCommandDepth;
    this._actionFeedbackCommandDepth = (this._actionFeedbackCommandDepth || 0) + 1;
    try {
    if(typeof command==='string'&&command.startsWith('sceneSearch-')){
      return this._view?.sceneSearchBinding?.handleShortcut(command)===true;
    }
    let v;
    switch (command) {
      case 'volume':
        this.volume = param;
        break;
      case 'volumeBy':
        this.volume = this._nicoVideoPlayer.volume * param;
        break;
      case 'volumeUp':
        this._nicoVideoPlayer.volumeUp();
        break;
      case 'volumeDown':
        this._nicoVideoPlayer.volumeDown();
        break;
      case 'togglePlay':
        this.togglePlay();
        break;
      case 'pause':
        this.pause();
        break;
      case 'play':
        this.play();
        break;
      case 'fullscreen':
      case 'toggle-fullscreen':
        this._nicoVideoPlayer.toggleFullScreen();
        break;
      case 'deflistAdd':
        return this._onDeflistAdd(param);
      case 'deflistRemove':
        return this._onDeflistRemove(param);
      case 'playlistAdd':
      case 'playlistAppend':
        this._onPlaylistAppend(param);
        break;
      case 'playlistInsert':
        this._onPlaylistInsert(param);
        break;
      case 'playlistSetMylist':
        this._onPlaylistSetMylist(param);
        break;
      case 'playlistSetUploadedVideo':
        this._onPlaylistSetUploadedVideo(param);
        break;
      case 'playlistSetSearchVideo':
        this._onPlaylistSetSearchVideo(param);
        break;
      case 'playlistSetSeries':
        this._onPlaylistSetSeriesVideo(param);
      break;
      case 'playlistSetCommonsTree':
        this._onPlaylistSetCommonsTree();
        break;
      case 'playlistSetNicodic':
        void this._onPlaylistSetNicodic(param);
        break;
      case 'playNextVideo':
        this.playNextVideo();
        break;
      case 'playPreviousVideo':
        this.playPreviousVideo();
        break;
      case 'shufflePlaylist':
          this._playlist.shuffle();
        break;
      case 'togglePlaylist':
          this._playlist.toggleEnable();
        break;
      case 'toggle-like':
        return this._onToggleLike();
      case 'mylistAdd':
        return this._onMylistAdd(param.mylistId, param.mylistName);
      case 'mylistRemove':
        return this._onMylistRemove(param.mylistId, param.mylistName);
      case 'mylistWindow':
        util.openMylistWindow(this._videoInfo.watchId);
        break;
      case 'seek':
      case 'seekTo':
        this.currentTime = param * 1;
        break;
      case 'seekBy':
        this.currentTime = this.currentTime + param * 1;
        break;
      case 'seekPrevFrame':
      case 'seekNextFrame':
        this.execCommand('pause');
        this.execCommand('seekBy', command === 'seekNextFrame' ? 1/60 : -1/60);
        break;
      case 'seekRelativePercent': {
        const dur = this._videoInfo.duration;
        const mv = Math.abs(param.movePerX) > 10 ?
          (param.movePerX / 2) : (param.movePerX / 8);
        const pos = this.currentTime + (mv * dur / 100);
        this.currentTime=Math.min(Math.max(0, pos), dur);
        break;
      }
      case 'seekToResumePoint':
        this.currentTime=this._videoInfo.initialPlaybackTime;
        break;
      case 'toggle-playbackPoints': {
        const view=this._view;
        try{
          view?._initializeVideoInfoPanel?.();
          const host=view?._$playerContainer?.[0];
          const trigger=host?.querySelector('.playbackPointsSwitch');
          if(!host||!view?.manualBookmarkDock){
            view?._showManualBookmarkUnavailable?.();
            break;
          }
          view._clearManualBookmarkUnavailable?.();
          // A previous IndexedDB read may have failed after a successful mount.
          view._retryFailedManualBookmarkSession?.();
          view.manualBookmarkDock.toggle(host,trigger);
        }catch{
          try{view?.manualBookmarkDock?.close?.();}catch{}
          view?._showManualBookmarkUnavailable?.();
        }
        break;
      }
      case 'deleteAutomaticResume':
        return this._deleteAutomaticResume();
      case 'addWordFilter':
        this._registerCommentNg('addWordFilter', param, 'NGワード');
        break;
      case 'setWordRegFilter':
        this._nicoVideoPlayer.filter.setWordRegFilter(
          param, this._nicoVideoPlayer.filter.wordRegFilterFlags);
        break;
      case 'setWordRegFilterFlags':
        this._nicoVideoPlayer.filter.setWordRegFilter(
          this._nicoVideoPlayer.filter.wordRegFilterSource, param);
        break;
      case 'addUserIdFilter':
        this._registerCommentNg('addUserIdFilter', param, 'ユーザーNG');
        break;
      case 'addCommandFilter':
        this._registerCommentNg('addCommandFilter', param, 'NGコマンド');
        break;
      case 'setWordFilterList':
        this._nicoVideoPlayer.filter.wordFilterList = param;
        break;
      case 'setUserIdFilterList':
        this._nicoVideoPlayer.filter.userIdFilterList = param;
        break;
      case 'setCommandFilterList':
        this._nicoVideoPlayer.filter.commandFilterList = param;
        break;
      case 'openNow':
        this.open(param, {openNow: true});
        break;
      case 'open':
        this.open(param);
        break;
      case 'close':
        (this as Loose).close(param);
        break;
      case 'reload':
        this.reload({currentTime: this.currentTime});
        break;
      case 'openGinza': {
        const option=RelatedMenuOrder.getOption(
          this._playerConfig.getValue(RelatedMenuOrder.OPTIONS_KEY),'official');
        const time=option.includePosition===false?0:this.currentTime;
        const url=OfficialPlayerRoute.makeUrl(this._watchId,time);
        RelatedMenuOrder.openUrl('official',url,option,(...args: Loose[])=>window.open(...args));
        break;
      }
      case 'reloadComment':
        this.reloadComment(param);
        break;
      case 'playbackRate':
        this._playerConfig.setValue(command, param);
        MediaSessionApi.updatePositionStateByMedia(this);
        break;
      case 'shiftUp':
        this._stepPlaybackRate(1);
        break;
      case 'shiftDown':
        this._stepPlaybackRate(-1);
        break;
      case 'screenShot':
        if (this._state.isYouTube) {
          util.capTube({
            title: this._videoInfo.title,
            videoId: this._videoInfo.videoId,
            author: this._videoInfo.owner.name
          });
          return;
        }
        this._nicoVideoPlayer.getScreenShot();
        break;
      case 'screenShotWithComment':
        if (this._state.isYouTube) {
          return;
        }
        this._nicoVideoPlayer.getScreenShotWithComment();
        break;
      // Task 077: 画面フィルター。反転は画面フィルターの設定に統合した
      // （右クリックメニュー・ショートカットのどちらから来ても同じ処理になる）。
      case 'toggle-flipH':
        this.execCommand('toggle-screenFilter.flipH');
        break;
      case 'toggle-flipV':
        this.execCommand('toggle-screenFilter.flipV');
        break;
      case 'toggle-screenFilterPanel':
        this._view && this._view.toggleScreenFilterPanel();
        break;
      case 'toggle-commentHistoryPanel':
        this._ensureCommentHistory()?.panel.toggle();
        break;
      case 'nextVideo':
        this._nextVideo = param;
        break;
      case 'nicosSeek':
        this._onNicosSeek(param);
        break;
      case 'fastSeek':
        this._nicoVideoPlayer.fastSeek(param);
        break;
      case 'setVideo':
        this.setVideo(param);
        break;
      case 'toggle-notificationHistory':
        this._toggleNotificationHistory();
        break;
      case 'selectTab':
        this._state.currentTab = param === 'notificationHistory' ? 'videoInfoTab' : param;
        break;
      case 'nicoru': {
        // The click belongs to the original video's comment thread, even if
        // the player changes before the queued API call starts.
        const videoInfo = this._videoInfo;
        const requestId = this._requestId;
        const msgInfo = videoInfo?.msgInfo;
        const loader = this.threadLoader;
        Promise.resolve().then(() => loader.nicoru(msgInfo, param))
          .then(result => {
            request?.resolve?.(result);
            // Task1038: ニコるは日時・コメント本文・動画ID・動画タイトル・コメントの位置を残す。
            const chat = param as Loose;
            const text = typeof chat?.text === 'string' ? chat.text : '';
            const title = typeof videoInfo?.title === 'string' ? videoInfo.title : '';
            const vpos = Number(chat?.vpos);
            this._recordDiagnostic({
              category: 'comment', level: 'success', source: 'nicoru',
              message: 'ニコりました' + (text ? '「' + text.slice(0, 80) + '」' : '') + (title ? '（' + title + '）' : ''),
              videoId: videoInfo?.watchId || videoInfo?.videoId,
              details: {operation: 'nicoru', outcome: 'accepted'},
              activity: {kind: 'nicoru', text: text || '（本文なし）', videoTitle: title,
                ...(Number.isFinite(vpos) && vpos >= 0 ? {positionMs: Math.floor(vpos * 10)} : {})}
            });
          })
          .catch(e => {
            request?.reject?.(e);
            if (this._videoInfo !== videoInfo || this._requestId !== requestId || this._state?.isOpen === false) { return; }
            this.execCommand('alert', e?.message || 'ニコれなかった＞＜');
          });
        break;
      }
      case 'nicoru-cancel': {
        // Task1039: ニコるの取り消し（公式の DELETE /v1/users/me/nicoru/send/{nicoruId}）。
        const videoInfo = this._videoInfo;
        const requestId = this._requestId;
        const loader = this.threadLoader;
        const chat = param as Loose;
        Promise.resolve().then(() => loader.unNicoru(videoInfo?.msgInfo, chat?.nicoruId))
          .then(result => {
            request?.resolve?.(result);
            const text = typeof chat?.text === 'string' ? chat.text : '';
            const title = typeof videoInfo?.title === 'string' ? videoInfo.title : '';
            this._recordDiagnostic({
              category: 'comment', level: 'success', source: 'nicoru',
              message: 'ニコるを取り消しました' + (text ? '「' + text.slice(0, 80) + '」' : '') + (title ? '（' + title + '）' : ''),
              videoId: videoInfo?.watchId || videoInfo?.videoId,
              details: {operation: 'nicoru-cancel', outcome: 'accepted'}
            });
          })
          .catch(e => {
            request?.reject?.(e);
            if (this._videoInfo !== videoInfo || this._requestId !== requestId || this._state?.isOpen === false) { return; }
            this.execCommand('alert', e?.message || 'ニコるを取り消せなかった＞＜');
          });
        break;
      }
      case 'update-smileVideoQuality':
        this._playerConfig.props.videoServerType = 'smile';
        this._playerConfig.props.smileVideoQuality = param;
        this.reload({videoServerType: 'smile', economy: param === 'eco'});
        break;
      case 'update-dmcVideoQuality':
        this._playerConfig.props.videoServerType = 'dmc';
        this._playerConfig.props.dmcVideoQuality = param;
        this.reload({videoServerType: 'dmc'});
        break;
      case 'update-domandVideoQuality':
        this._playerConfig.props.videoServerType = 'domand';
        this._playerConfig.props.domandVideoQuality = param;
        this.reload({videoServerType: 'domand'});
        break;
      case 'update-videoServerType':
        this._playerConfig.props.videoServerType = param;
        this.reload({videoServerType: param === 'domand' ? 'domand' : 'dmc'});
        break;
      case 'update-commentLanguage':
        if (this._playerConfig.props.commentLanguage === param) {
          break;
        }
        this._playerConfig.props.commentLanguage = param;
        this.reloadComment();
        break;
      case 'saveMymemory':
        util.saveMymemory(this, this._state.videoInfo);
        break;
      default:
        this.emit('command', command, param);
    }
    } finally {
      this._actionFeedbackCommandDepth--;
      if (outer && this._state?.isOpen && !this._view?._keyboardFeedbackCommand) {
        // Presentation must not turn a completed player/API command into an error.
        try { this._view?._flashActionFeedback?.(command, param); } catch (_) {}
      }
    }
  },
  _onKeyDown(this: Dialog, name?: Loose, e?: Loose, param?: Loose) {
    this._onKeyEvent(name, e, param);
  },
  _onKeyUp(this: Dialog, name?: Loose, e?: Loose, param?: Loose) {
    this._onKeyEvent(name, e, param);
  },
  _onKeyEvent(this: Dialog, name?: Loose, e?: Loose, param?: Loose) {
    // Task938: toggles are one action per physical key press. Holding a
    // shortcut must not rapidly alternate ON/OFF or restart its status cue.
    if (e?.repeat && ['VIEW_COMMENT','TOGGLE_COMMENT','TOGGLE_NG_FILTER'].includes(name)) {
      e.preventDefault?.();
      e.stopPropagation?.();
      return;
    }
    if (name === 'OPEN_OFFICIAL_WATCH') {
      if (!this._state.isOpen && !e?.repeat) { this.emit('requestOfficialLaunch', e); }
      return;
    }
    if (!this._state.isOpen) {
      const lastWatchId = this._playerConfig.props.lastWatchId;
      if (name === 'RE_OPEN' && lastWatchId) {
        this.open(lastWatchId);
        e.preventDefault();
      }
      return;
    }
    const TABLE = {
      'RE_OPEN': 'reload',
      'PAUSE': 'pause',
      'TOGGLE_PLAY': 'togglePlay',
      'SPACE': 'togglePlay',
      'FULL': 'toggle-fullscreen',
      'TOGGLE_PLAYLIST': 'togglePlaylist',
      'DEFLIST': 'deflistAdd',
      'DEFLIST_REMOVE': 'deflistRemove',
      'VIEW_COMMENT': 'toggle-showComment',
      'TOGGLE_COMMENT': 'toggle-showComment',
      'TOGGLE_LOOP': 'toggle-loop',
      'MUTE': 'toggle-mute',
      'VOL_UP': 'volumeUp',
      'VOL_DOWN': 'volumeDown',
      'SEEK_TO': 'seekTo',
      'SEEK_BY': 'seekBy',
      'SEEK_PREV_FRAME': 'seekPrevFrame',
      'SEEK_NEXT_FRAME': 'seekNextFrame',
      'NEXT_VIDEO': 'playNextVideo',
      'PREV_VIDEO': 'playPreviousVideo',
      'PLAYBACK_RATE': 'playbackRate',
      'SHIFT_UP': 'shiftUp',
      'SHIFT_DOWN': 'shiftDown',
      'SCREEN_MODE': 'screenMode',
      'SCREEN_SHOT': 'screenShot',
      'SCREEN_SHOT_WITH_COMMENT': 'screenShotWithComment'
    };
    const runCommand = (command: string) => {
      const view = this._view;
      const previous = view?._keyboardFeedbackCommand;
      if (view) { view._keyboardFeedbackCommand = command; }
      try {
        this.execCommand(command, param);
        try { view?._flashActionFeedback?.(command, param); } catch (_) {}
      } finally {
        if (view) { view._keyboardFeedbackCommand = previous; }
      }
    };
    switch (name) {
      case 'RELATED_MENU_LINKS': {
        const context=RelatedMenuActions.makeContext(this._state.videoInfo,this.currentTime);
        RelatedMenuActions.openShortcutsByIds(
          this._playerConfig.getValue(RelatedMenuActions.CONFIG_KEY),param,context,
          (url?: Loose,target?: Loose,features?: Loose) => window.open(url,target,
            features || (target === '_blank' ? 'noopener,noreferrer' : undefined)),
          (text?: Loose)=>this.execCommand('copy-related-text',text) as Loose
        );
        break;
      }
      case 'ESC':
        // ESCキーは連打にならないようブロック期間を設ける
        if (Date.now() < this._escBlockExpiredAt) {
          console.log('block ESC');
          break;
        }
        this._escBlockExpiredAt = Date.now() + 1000 * 2;
        if (!Fullscreen.now()) {
          this.close();
        }
        break;
      case 'INPUT_COMMENT':
        this._view.focusToCommentInput();
        break;
      default:
        if ((TABLE as Loose)[name]) {
          runCommand((TABLE as Loose)[name]);
          break;
        }
        // Task 059: ShortcutActions.js に登録された「新規」ショートカット
        // (legacyでないもの)の汎用ディスパッチ。新しいショートカットを
        // 追加する時は、ShortcutActions.js にエントリを1つ足すだけでよく、
        // このTABLEやswitch文自体を変更する必要はない。
        {
          const action = SHORTCUT_ACTIONS.find((a?: Loose) => a.id === name && !a.legacy && a.command);
          if (!action) { return; }
          runCommand(action.command);
        }
    }
    const screenMode = this._playerConfig.props.screenMode;
    if (['small', 'sideView'].includes(screenMode) && ['TOGGLE_PLAY'].includes(name)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  },
  // Task945 / Discussion #40: choose the next fixed rate, never add a fraction
  // to 0.1 (which makes four downs and four ups drift from 1.0 to 1.1).
  // Preserve the legacy 2x-to-3x half-steps, then use quarter-speed
  // presets again from 3x through 10x (Discussion #40 follow-up).
  _stepPlaybackRate(this: Dialog, direction?: Loose) {
    const configured = Number.parseFloat(this._playerConfig.getValue('playbackRate'));
    const current = Number.isFinite(configured) ? configured : 1;
    const steps = [0.1];
    for (let quarter = 1; quarter <= 8; quarter++) { steps.push(quarter / 4); }
    steps.push(2.5, 3);
    for (let quarter = 13; quarter <= 40; quarter++) { steps.push(quarter / 4); }
    // A manually entered rate may be between steps; move to the adjacent
    // preset in the requested direction rather than relative to that value.
    let next = direction > 0 ? 10 : 0.1;
    const epsilon = 1e-8;
    if (direction > 0) {
      for (const rate of steps) {
        if (rate > current + epsilon) { next = rate; break; }
      }
    } else {
      for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i]!;
        if (step < current - epsilon) { next = step; break; }
      }
    }
    this._playerConfig.setValue('playbackRate', next);
  },
};

export {NicoVideoPlayerDialogCommands};

/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogUserActions.js (Task1060: NicoVideoPlayerDialog.ts から役割ごとに分割).
 * マイリスト・とりあえずマイリスト（あとで見る）・いいね。
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
declare const LikeApi: typeof import('./LikeApi').LikeApi;
declare const MylistApiLoader: typeof import('./MylistApiLoader').MylistApiLoader;
declare const ThumbInfoLoader: typeof import('./ThumbInfoLoader').ThumbInfoLoader;
declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil;

/** マイリスト・とりあえずマイリスト（あとで見る）・いいね。 */
const NicoVideoPlayerDialogUserActions = {
  _onDeflistAdd(this: Dialog, watchId?: Loose) {
    if (this._deflistMutationOwner || this._state.isUpdatingDeflist || !util.isLogin()) {
      return;
    }
    const videoInfo = this._videoInfo;
    const requestId = this._requestId;
    const isCurrent = () => this._videoInfo === videoInfo && this._requestId === requestId && this._state.isOpen !== false;
    const lockOwner = {};
    this._deflistMutationOwner = lockOwner;
    const unlock = () => {
      if (this._deflistMutationOwner === lockOwner) {
        this._deflistMutationOwner = null;
        this._state.isUpdatingDeflist = false;
      }
    };
    this._state.isUpdatingDeflist = true;
    // Keep ownership until the request settles; a timer cannot cancel a server mutation.

    watchId = watchId || this._videoInfo.watchId;
    let description: Loose;
    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }
    const {enableAutoMylistComment} = this._playerConfig.props;
    (() => {
      if (watchId === this._watchId || !enableAutoMylistComment) {
        return Promise.resolve(this._videoInfo);
      }
      return ThumbInfoLoader.load(watchId);
    })().then((info?: Loose) => {
      const originalVideoId = info.originalVideoId ?
        `元動画: ${info.originalVideoId}` : '';
      description = enableAutoMylistComment ?
          `投稿者: ${info.owner.name} ${info.owner.linkId} ${originalVideoId}` : '';
    }).then(() => this._mylistApiLoader.addDeflistItem(watchId, description))
      .then((result?: Loose) => { if (isCurrent()) { this.execCommand('notify', result.message); } })
      .catch((err?: Loose) => { if (isCurrent()) { this.execCommand('alert', err.message ? err.message : 'あとで見るに登録失敗'); } })
      .then(() => {
      window.setTimeout(unlock, 2000);
    });
  },
  _onDeflistRemove(this: Dialog, watchId?: Loose) {
    if (this._deflistMutationOwner || this._state.isUpdatingDeflist || !util.isLogin()) {
      return;
    }
    const videoInfo = this._videoInfo;
    const requestId = this._requestId;
    const isCurrent = () => this._videoInfo === videoInfo && this._requestId === requestId && this._state.isOpen !== false;
    const lockOwner = {};
    this._deflistMutationOwner = lockOwner;
    const unlock = () => {
      if (this._deflistMutationOwner === lockOwner) {
        this._deflistMutationOwner = null;
        this._state.isUpdatingDeflist = false;
      }
    };
    this._state.isUpdatingDeflist = true;
    // Keep ownership until the request settles; a timer cannot cancel a server mutation.

    watchId = watchId || this._videoInfo.watchId;
    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }

    Promise.resolve().then(() => this._mylistApiLoader.removeDeflistItem(watchId))
      .then((result?: Loose) => { if (isCurrent()) { this.execCommand('notify', result.message); } })
      .catch((err?: Loose) => { if (isCurrent()) { this.execCommand('alert', err.message); } })
      .then(() => {
        window.setTimeout(unlock, 2000);
      });
  },
  _onToggleLike(this: Dialog) {
    if (!util.isLogin()) { return; }
    const videoInfo = this._videoInfo;
    if (!videoInfo) { return; }
    // Model-specific ownership also survives A -> B -> the same A instance.
    const pending = this._likePendingModels || (this._likePendingModels = new WeakSet());
    if (pending.has(videoInfo)) { return; }
    pending.add(videoInfo);
    const videoId = videoInfo.videoId;
    const isLiked = videoInfo.isLiked;
    let request: Promise<Loose>;
    try {
      request = isLiked ? LikeApi.unlike(videoId) : LikeApi.like(videoId);
    } catch (error) {
      request = Promise.reject(error);
    }
    Promise.resolve(request).then(result => {
      const message = result.data ? (result.data.thanksMessage || '') : '';
      const popupText = message || (isLiked ? '(･A･)ﾉｼ' : '(･∀･)ｨｨﾈ!!');
      // Persist the actual API result for its original video even after navigation.
      // This must not update the newly opened video's model or show a stale popup.
      // Task1038: いいねは日時・動画ID・動画タイトルを自分の活動として残す（検索で「いいね」でも見つかる）。
      const title = typeof videoInfo.title === 'string' ? videoInfo.title : '';
      this._recordDiagnostic({
        category: 'like', level: 'success',
        message: (isLiked ? 'いいね！を取り消しました' : 'いいね！しました') + (title ? '「' + title + '」' : '') +
          (message ? ' ' + message : ''),
        videoId, source: 'like', details: {operation: isLiked ? 'unlike' : 'like'},
        ...(isLiked ? {} : {activity: {kind: 'like', text: message || '', videoTitle: title}})
      });
      if (this._videoInfo !== videoInfo) { return; }
      if (message) {
        this.execCommand('notify', `${message}`);
        // The thank-you note belongs to the successful Like, not unlike.
        // Do not replace an earlier Like note with an unlike response.
        if (!isLiked) {
          this._view.emit('likeThanksMessage', {message, videoId});
        }
      } else {
        this.execCommand('notify',
          isLiked ? '(･A･)ﾉｼ' : '(･∀･)ｨｨﾈ!!');
        // No new note is not a deletion request. Keep the previously received
        // thank-you visible when the user unlikes or receives an empty response.
      }
      this._state.isLiked = this._videoInfo.isLiked = !isLiked;
    }).catch(err => {
      this._recordDiagnostic({
        category: 'like', level: 'error',
        message: err && err.message || 'いいね！できなかった',
        videoId, source: 'like',
        details: {kind: err && err.kind, statusCode: err && err.status,
          errorCode: err && err.errorCode}
      });
      console.warn(err);
      if (this._videoInfo === videoInfo) {
        // Task 066: 失敗理由（HTTPステータス・errorCode）が分かるようにする
        this.execCommand('alert', (err && err.message) || 'いいね！できなかった');
      }
    }).finally(() => {
      // Finishing one model must not unlock another model's pending request.
      pending.delete(videoInfo);
    });
  },
  _onMylistAdd(this: Dialog, groupId?: Loose, mylistName?: Loose) {
    if (this._mylistMutationOwner || this._state.isUpdatingMylist || !util.isLogin()) {
      return;
    }

    const videoInfo = this._videoInfo;
    const requestId = this._requestId;
    const isCurrent = () => this._videoInfo === videoInfo && this._requestId === requestId && this._state.isOpen !== false;
    const lockOwner = {};
    this._mylistMutationOwner = lockOwner;
    const unlock = () => {
      if (this._mylistMutationOwner === lockOwner) {
        this._mylistMutationOwner = null;
        this._state.isUpdatingMylist = false;
      }
    };

    this._state.isUpdatingMylist = true;
    // Keep ownership until the request settles; a timer cannot cancel a server mutation.

    const owner = this._videoInfo.owner;
    const originalVideoId = this._videoInfo.originalVideoId ?
      `元動画: ${this._videoInfo.originalVideoId}` : '';
    const watchId = this._videoInfo.watchId;
    const description =
      this._playerConfig.getValue('enableAutoMylistComment') ?
        `投稿者: ${owner.name} ${owner.linkId} ${originalVideoId}` : '';
    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }

    Promise.resolve().then(() => this._mylistApiLoader.addMylistItem(watchId, groupId, description))
      .then((result?: Loose) => { if (isCurrent()) { this.execCommand('notify', `${result.message}: ${mylistName}`); } })
      .catch((err?: Loose) => { if (isCurrent()) { this.execCommand('alert', `${err.message}: ${mylistName}`); } })
      .then(() => {
        window.setTimeout(unlock, 2000);
      });
  },
  _onMylistRemove(this: Dialog, groupId?: Loose, mylistName?: Loose) {
    if (this._mylistMutationOwner || this._state.isUpdatingMylist || !util.isLogin()) {
      return;
    }

    const videoInfo = this._videoInfo;
    const requestId = this._requestId;
    const isCurrent = () => this._videoInfo === videoInfo && this._requestId === requestId && this._state.isOpen !== false;
    const lockOwner = {};
    this._mylistMutationOwner = lockOwner;
    const unlock = () => {
      if (this._mylistMutationOwner === lockOwner) {
        this._mylistMutationOwner = null;
        this._state.isUpdatingMylist = false;
      }
    };

    this._state.isUpdatingMylist = true;
    // Keep ownership until the request settles; a timer cannot cancel a server mutation.

    let watchId = this._videoInfo.watchId;

    if (!this._mylistApiLoader) {
      this._mylistApiLoader = MylistApiLoader;
    }

    Promise.resolve().then(() => this._mylistApiLoader.removeMylistItem(watchId, groupId))
      .then((result?: Loose) => { if (isCurrent()) { this.execCommand('notify', `${result.message}: ${mylistName}`); } })
      .catch((err?: Loose) => { if (isCurrent()) { this.execCommand('alert', `${err.message}: ${mylistName}`); } })
      .then(() => {
        window.setTimeout(unlock, 2000);
      });
  },
};

export {NicoVideoPlayerDialogUserActions};

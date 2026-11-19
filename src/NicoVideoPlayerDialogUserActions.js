import * as $ from 'jquery';
import * as _ from 'lodash';
import {global} from './ZenzaContext';
import {CONSTANT} from './constant';
import {PlaybackPosition, VideoInfoLoader, NVWatchCaller, CommonsTreeLoader} from '../packages/lib/src/nico/loader';
import {Fullscreen, ShortcutKeyEmitter, util} from './util';
import {SHORTCUT_ACTIONS} from '../packages/zenza/src/ShortcutActions';
import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
import {NotificationJournal} from './NotificationJournal';
import {NotificationHistoryPanel} from './NotificationHistoryPanel';
import {RelatedMenuOrder} from './RelatedMenuOrder';
import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';
import {NicoVideoPlayer} from './NicoVideoPlayer';
import {VideoFilter, VideoInfoModel} from './VideoInfo';
import {CommentInputPanel} from './CommentInputPanel';
import {CommentPanel} from './CommentPanel';
import {VideoControlBar} from './VideoControlBar';
import {SceneSearchPlayerBinding} from '../packages/zenza/src/sceneSearch/SceneSearchPlayerBinding';
import {AutoResumeClearCoordinator} from '../packages/zenza/src/resume/AutoResumeClearCoordinator';
import {IndexedDbManualBookmarkBackend, ManualBookmarkRepository} from '../packages/zenza/src/resume/ManualBookmarkStore';
import {ManualBookmarkSession} from '../packages/zenza/src/resume/ManualBookmarkSession';
import {ManualBookmarkDock} from '../packages/zenza/src/resume/ManualBookmarkDock';
import {SavedVideoThumbnail} from '../packages/zenza/src/resume/SavedVideoThumbnail';
import {VideoInfoPanel} from './VideoInfoPanel';
import {PlayList, PlayListSession} from '../packages/zenza/src/Playlist/PlayList';
import {Emitter} from './baselib';
import {ThreadLoader} from '../packages/lib/src/nico/ThreadLoader';
import {sleep} from '../packages/lib/src/infra/sleep';
import {VideoSessionWorker} from '../packages/lib/src/nico/VideoSessionWorker';
import {PlayerState} from './State';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {objUtil} from '../packages/lib/src/infra/objUtil';
import {MylistApiLoader} from '../packages/lib/src/nico/MylistApiLoader';
import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';
import {WatchInfoCacheDb} from '../packages/lib/src/nico/WatchInfoCacheDb';
import {css, cssUtil} from '../packages/lib/src/css/css';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {MediaSessionApi} from '../packages/lib/src/infra/MediaSessionApi';
import {LikeApi} from '../packages/lib/src/nico/LikeApi.js';
import {AudioAdjuster} from '../packages/zenza/src/audio/AudioAdjuster';
import {ScreenFilter, ScreenFilterPanel} from '../packages/zenza/src/videoPlayer/ScreenFilter';
import {ZenzaCommentHistoryCore} from '../packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js';
import {NicoVideoPlayerDialog} from './NicoVideoPlayerDialog';

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogUserActions.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** マイリスト・とりあえずマイリスト（あとで見る）・いいね。 */
const NicoVideoPlayerDialogUserActions = {
    _onDeflistAdd(watchId) {
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
        let description;
        if (!this._mylistApiLoader) {
            this._mylistApiLoader = MylistApiLoader;
        }
        const { enableAutoMylistComment } = this._playerConfig.props;
        (() => {
            if (watchId === this._watchId || !enableAutoMylistComment) {
                return Promise.resolve(this._videoInfo);
            }
            return ThumbInfoLoader.load(watchId);
        })().then((info) => {
            const originalVideoId = info.originalVideoId ?
                `元動画: ${info.originalVideoId}` : '';
            description = enableAutoMylistComment ?
                `投稿者: ${info.owner.name} ${info.owner.linkId} ${originalVideoId}` : '';
        }).then(() => this._mylistApiLoader.addDeflistItem(watchId, description, false, { isCurrent }))
            .then((result) => { if (isCurrent()) {
            this.execCommand('notify', result.message);
        } })
            .catch(() => { if (isCurrent()) {
            this.execCommand('alert', 'あとで見るへの追加を確認できません。一覧で登録状態を確認してください。');
        } })
            .then(() => {
            window.setTimeout(unlock, 2000);
        });
    },
    _onDeflistRemove(watchId) {
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
        Promise.resolve().then(() => this._mylistApiLoader.removeDeflistItem(watchId, { isCurrent }))
            .then((result) => { if (isCurrent()) {
            this.execCommand('notify', result.message);
        } })
            .catch((err) => {
            if (isCurrent()) {
                this.execCommand('alert', err?.status === 'not_found' ? 'あとで見るに動画が見つかりません。' :
                    'あとで見るからの削除を確認できません。一覧で登録状態を確認してください。');
            }
        })
            .then(() => {
            window.setTimeout(unlock, 2000);
        });
    },
    _onToggleLike() {
        if (!util.isLogin()) {
            return;
        }
        const videoInfo = this._videoInfo;
        if (!videoInfo) {
            return;
        }
        // Model-specific ownership also survives A -> B -> the same A instance.
        const pending = this._likePendingModels || (this._likePendingModels = new WeakSet());
        if (pending.has(videoInfo)) {
            return;
        }
        pending.add(videoInfo);
        const videoId = videoInfo.videoId;
        const isLiked = videoInfo.isLiked;
        let request;
        try {
            request = isLiked ? LikeApi.unlike(videoId) : LikeApi.like(videoId);
        }
        catch (error) {
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
                videoId, source: 'like', details: { operation: isLiked ? 'unlike' : 'like' },
                ...(isLiked ? {} : { activity: { kind: 'like', text: message || '', videoTitle: title } })
            });
            if (this._videoInfo !== videoInfo) {
                return;
            }
            if (message) {
                this.execCommand('notify', `${message}`);
                // The thank-you note belongs to the successful Like, not unlike.
                // Do not replace an earlier Like note with an unlike response.
                if (!isLiked) {
                    this._view.emit('likeThanksMessage', { message, videoId });
                }
            }
            else {
                this.execCommand('notify', isLiked ? '(･A･)ﾉｼ' : '(･∀･)ｨｨﾈ!!');
                // No new note is not a deletion request. Keep the previously received
                // thank-you visible when the user unlikes or receives an empty response.
            }
            this._state.isLiked = this._videoInfo.isLiked = !isLiked;
        }).catch(err => {
            this._recordDiagnostic({
                category: 'like', level: 'error',
                message: err && err.message || 'いいね！できなかった',
                videoId, source: 'like',
                details: { kind: err && err.kind, statusCode: err && err.status,
                    errorCode: err && err.errorCode }
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
    _onMylistAdd(groupId, mylistName) {
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
        const description = this._playerConfig.getValue('enableAutoMylistComment') ?
            `投稿者: ${owner.name} ${owner.linkId} ${originalVideoId}` : '';
        if (!this._mylistApiLoader) {
            this._mylistApiLoader = MylistApiLoader;
        }
        Promise.resolve().then(() => this._mylistApiLoader.addMylistItem(watchId, groupId, description, { isCurrent }))
            .then((result) => { if (isCurrent()) {
            this.execCommand('notify', `${result.message}: ${mylistName}`);
        } })
            .catch(() => { if (isCurrent()) {
            this.execCommand('alert', 'マイリストへの追加を確認できません。一覧で登録状態を確認してください。');
        } })
            .then(() => {
            window.setTimeout(unlock, 2000);
        });
    },
    _onMylistRemove(groupId, mylistName) {
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
        Promise.resolve().then(() => this._mylistApiLoader.removeMylistItem(watchId, groupId, { isCurrent }))
            .then((result) => { if (isCurrent()) {
            this.execCommand('notify', `${result.message}: ${mylistName}`);
        } })
            .catch((err) => {
            if (isCurrent()) {
                this.execCommand('alert', err?.status === 'not_found' ? 'マイリストに動画が見つかりません。' :
                    'マイリストからの削除を確認できません。一覧で登録状態を確認してください。');
            }
        })
            .then(() => {
            window.setTimeout(unlock, 2000);
        });
    },
};
//===END===
export {NicoVideoPlayerDialogUserActions};

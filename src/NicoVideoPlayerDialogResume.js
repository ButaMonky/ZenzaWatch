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

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogResume.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** 続きから再生（自動の再生位置の保存・削除・編集）。 */
const NicoVideoPlayerDialogResume = {
    // A completed video's own cache key must be invalidated even when the
    // server's final zero save cannot be sent (offline or logged out).
    // Never delete the full video cache record or include its ID in error logs.
    _clearCompletedAutoResume() {
        if (this._playerConfig?.getValue('resume.clearOnComplete') === false ||
            this._playerConfig?.getValue('resume.recordEnabled') === false)
            return;
        const watchId = this._watchId;
        if (!watchId || typeof WatchInfoCacheDb.clearAutomaticResume !== 'function')
            return;
        try {
            Promise.resolve(WatchInfoCacheDb.clearAutomaticResume(watchId, 'completed'))
                .catch(() => console.warn('Automatic resume local clear failed'));
        }
        catch (_) {
            console.warn('Automatic resume local clear failed');
        }
    },
    _isAutoResumeSaveSuppressed() {
        if (this._playerConfig?.getValue('resume.recordEnabled') === false)
            return true;
        const owner = this._autoResumeSaveSuppress;
        return !!owner && owner.videoInfo === this._videoInfo &&
            ((owner.watchId === this._watchId && owner.requestId === this._requestId) ||
                // Native pause from closing the outgoing media can arrive after open()
                // rotates the request. A newly loaded model never inherits this barrier.
                owner === this._outgoingAutoResumeSaveSuppress);
    },
    /** Delete only the current video's automatic position when explicitly requested.
     * Other watch-cache metadata and the separate manual bookmark DB are untouched.
     */
    async _editAutomaticResume(seconds) {
        const vi = this._videoInfo, watchId = this._watchId, requestId = this._requestId;
        if (!vi || vi.watchId !== watchId || !Number.isFinite(seconds) || seconds < 0 ||
            !Number.isFinite(vi.duration) || seconds >= vi.duration)
            return false;
        try {
            const record = await WatchInfoCacheDb.put(watchId, { currentTime: seconds, explicitResume: true });
            if (this._videoInfo !== vi || this._watchId !== watchId || this._requestId !== requestId)
                return false;
            if (record?.watchId !== watchId || record.resumeOverride !== seconds)
                return false;
            vi._cacheData = { ...(vi._cacheData || {}), ...record };
            this._autoResumeSaveSuppress = undefined;
            this._view?.videoControlBar?.refreshAutoResumePointers?.(vi);
            return true;
        }
        catch {
            return false;
        }
    },
    _deleteAutomaticResume() {
        const vi = this._videoInfo;
        const watchId = this._watchId;
        if (!vi || typeof watchId !== 'string' || !watchId ||
            vi.watchId !== watchId) {
            return Promise.resolve(null);
        }
        const owner = Object.freeze({ watchId, requestId: this._requestId, videoInfo: vi });
        // Pending deletion must also suppress a racing close/pause cache append.
        this._autoResumeSaveSuppress = owner;
        if (!this._autoResumeClearCoordinator) {
            this._autoResumeClearCoordinator = new AutoResumeClearCoordinator({
                clearLocal: async (videoId, reason) => {
                    const currentRequest = this._requestId;
                    const currentInfo = this._videoInfo;
                    const record = await WatchInfoCacheDb.clearAutomaticResume(videoId, reason);
                    if (record?.watchId === videoId && Array.isArray(record.resume) &&
                        record.resume.length === 0 && record.resumeClearReason === 'deleted' &&
                        this._watchId === videoId && this._videoInfo?.watchId === videoId &&
                        this._requestId === currentRequest && this._videoInfo === currentInfo) {
                        const current = this._videoInfo;
                        current._cacheData = { ...(current._cacheData || {}), ...record };
                        this._view?.videoControlBar?.refreshAutoResumePointers?.(current);
                    }
                    return record;
                },
                saveRemoteZero: (videoId, seconds) => {
                    const current = this._videoInfo;
                    const requestId = this._requestId;
                    if (!current || this._watchId !== videoId ||
                        current.watchId !== videoId) {
                        throw new Error('Automatic resume video changed');
                    }
                    return this._queuePlaybackPositionSave(current.videoId, () => {
                        // A previous PUT may keep this operation queued across open/close.
                        // Recheck the same playback owner before dispatching the clear.
                        if (this._requestId !== requestId || this._videoInfo !== current ||
                            this._watchId !== videoId) {
                            throw new Error('Automatic resume video changed');
                        }
                        return PlaybackPosition.record(current.videoId, seconds, current.msgInfo.frontendId, current.msgInfo.frontendVersion);
                    });
                },
                isLoggedIn: () => util.isLogin(),
                activeVideoId: () => this._watchId,
                activeSessionToken: () => this._requestId
            });
        }
        const isCurrent = () => this._watchId === owner.watchId &&
            this._requestId === owner.requestId && this._videoInfo === owner.videoInfo;
        return this._autoResumeClearCoordinator.delete(watchId).then(result => {
            // Completion must only be announced for the same playback generation.
            if (isCurrent() && result.remote !== 'stale-video') {
                const message = result.fullyAcknowledged ?
                    '「ここまで見た」の自動位置を削除しました' :
                    result.remote === 'unavailable' ?
                        'この端末の自動位置を削除しました。サーバー側は未確認です' :
                        'この端末の自動位置を削除しました。サーバー側の削除は未確認です';
                try {
                    this.execCommand('notify', message);
                }
                catch { }
            }
            return result;
        }, () => {
            // A failed local clear is not a committed deletion; restore ordinary saves.
            if (this._autoResumeSaveSuppress === owner)
                this._autoResumeSaveSuppress = undefined;
            if (isCurrent()) {
                try {
                    this.execCommand('alert', '自動位置を削除できませんでした');
                }
                catch { }
            }
            // Never log the watch ID, server response, tokens or private paths.
            window.console.warn('Automatic resume delete failed');
            return null;
        });
    },
    // Task178 (F10): ordinary saves (pause etc.) stay throttled, but the final save of a
    // video (ended -> 0, close, switching to another video) must not be dropped by the
    // throttle window that a pause right before it consumed.
    _bindPlaybackPositionSavers() {
        this._savePlaybackPositionNow = this._savePlaybackPosition.bind(this);
        this._savePlaybackPosition =
            _.throttle(this._savePlaybackPositionNow, 1000, { trailing: false });
    },
    _saveFinalPlaybackPosition(contextWatchId, ct) {
        const save = this._savePlaybackPositionNow || this._savePlaybackPosition;
        save.call(this, contextWatchId, ct);
    },
    _queuePlaybackPositionSave(videoId, record) {
        // Watch aliases can share a video: serialize the actual PUT resource.
        const queues = this._playbackPositionSaves || (this._playbackPositionSaves = new Map());
        const previous = queues.get(videoId);
        let operation;
        if (previous) {
            // A failed earlier save must not poison a later explicit clear.
            operation = previous.then(record, record);
        }
        else {
            // Preserve immediate dispatch for unrelated videos and the first save.
            try {
                operation = Promise.resolve(record());
            }
            catch (error) {
                operation = Promise.reject(error);
            }
        }
        queues.set(videoId, operation);
        const release = () => { if (queues.get(videoId) === operation)
            queues.delete(videoId); };
        void operation.then(release, release);
        // Keep this operation's rejection visible to its own caller.
        return operation;
    },
    _savePlaybackPosition(contextWatchId, ct) {
        if (this._playerConfig?.getValue('resume.recordEnabled') === false)
            return;
        const current = this._videoInfo;
        // Task1041: 最後まで（残り3秒以内）見た位置は「ここまで見た」に残さない。
        // 以前はサーバーへの保存だけがこの判定をしていて、手元の履歴には動画の終わりの位置が残っていた。
        // 連続再生で次の動画へ進むと、終了時に消した位置を open() の保存が終わりの位置で上書きし、
        // しおりの保存一覧の「続きへ」が押せない（終わりの位置）か、開いてもすぐ終わって再生できなかった。
        const nearEnd = NicoVideoPlayerDialog.isNearPlaybackEnd(ct, this.duration) || !!this._state?.isEnded;
        if (current && current.contextWatchId === contextWatchId && Number.isFinite(ct) && ct > 0 && !nearEnd &&
            !this._isAutoResumeSaveSuppressed()) {
            const watchId = this._watchId, requestId = this._requestId;
            void Promise.resolve(WatchInfoCacheDb.putBestEffort(watchId, { currentTime: ct })).then(record => {
                if (!record || this._videoInfo !== current || this._watchId !== watchId || this._requestId !== requestId)
                    return;
                current._cacheData = { ...current._cacheData, ...record };
                current._resumeInfo = { ...current._resumeInfo, initialPlaybackPosition: ct };
                this._view?.videoControlBar?.refreshAutoResumePointers?.(current);
                this._view?.manualBookmarkDock?.refreshPreferences();
            }).catch(() => { });
        }
        if (!util.isLogin()) {
            return;
        }
        const vi = this._videoInfo;
        if (!vi) {
            return;
        }
        // Do not restore a position deleted by the user in this playback session.
        // Explicit completion/server-zero (ct===0) remains permitted.
        if (ct > 0 && this._isAutoResumeSaveSuppressed())
            return;
        const dr = this.duration;
        console.info('%csave PlaybackPosition:', 'background: cyan', ct, dr); // Task 088: csrfToken はログに出さない
        if (vi.contextWatchId !== contextWatchId) {
            return;
        }
        if (Math.abs(ct - dr) < 3) {
            return;
        }
        const isShortContent = /^ss\d+$/i.test(String(vi.videoId)) || /^ss\d+$/i.test(String(contextWatchId));
        if (dr < 120 && isShortContent) {
            return;
        } // 短尺でも通常long-formは記録し、ss系ショートだけ従来どおり除外
        // Task177 (F09): contextWatchId only guards which video is current; the v2 API
        // takes the canonical video.id (a numeric channel watch ID is not renamed).
        this._queuePlaybackPositionSave(vi.videoId, () => {
            if (this._playerConfig?.getValue('resume.recordEnabled') === false)
                return Promise.resolve();
            return PlaybackPosition.record(vi.videoId, ct, vi.msgInfo.frontendId, vi.msgInfo.frontendVersion);
        }).catch((e) => {
            window.console.warn('save playback fail', { reason: e && e.reason, status: e && e.status });
        });
    },
};
//===END===
export {NicoVideoPlayerDialogResume};

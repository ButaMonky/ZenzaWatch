import * as $ from 'jquery';
import * as _ from 'lodash';
import {global} from './ZenzaWatchIndex';
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

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogComments.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** コメントの読み込み・投稿・削除・NG 登録と、コメント履歴。 */
const NicoVideoPlayerDialogComments = {
    _ensureCommentHistory() {
        if (this._commentHistory) {
            return this._commentHistory;
        }
        if (!this._nicoVideoPlayer) {
            return null;
        }
        try {
            return this._commentHistory = ZenzaCommentHistoryCore.createHistoryFeature({
                dialog: this, config: this._playerConfig, window
            });
        }
        catch (error) {
            console.warn('Comment history initialization failed', { code: error?.code || 'INIT' });
            return null;
        }
    },
    _registerCommentNg(command, value, label) {
        if (typeof value !== 'string' || !value.trim()) {
            return;
        }
        const filter = this._nicoVideoPlayer.filter;
        const listKey = command === 'addWordFilter' ? 'wordFilterList' :
            command === 'addUserIdFilter' ? 'userIdFilterList' : 'commandFilterList';
        const exists = filter[listKey].includes(value);
        filter[command](value);
        const message = exists ? label + 'は登録済みです。' : label + 'に登録しました。';
        this.execCommand(filter.isEnable ? 'notify' : 'warning', filter.isEnable ? message :
            message + '\nNGフィルターがOFFのため、現在は適用されません。');
    },
    _onCommentParsed() {
        const lang = this._playerConfig.getValue('commentLanguage');
        this.emit('commentParsed', lang, this._threadInfo);
        global.emitter.emit('commentParsed');
    },
    _onCommentChange() {
        const lang = this._playerConfig.getValue('commentLanguage');
        this.emit('commentChange', lang, this._threadInfo);
        global.emitter.emit('commentChange');
    },
    _onCommentFilterChange(filter) {
        const config = this._playerConfig;
        config.props.enableFilter = filter.isEnable;
        config.props.wordFilter = filter.wordFilterList;
        config.props.userIdFilter = filter.userIdFilterList;
        config.props.commandFilter = filter.commandFilterList;
        this.emit('commentFilterChange', filter);
    },
    _cancelCommentLoad() {
        // Task200: the history job belongs to the old normal-comment generation.
        this._commentHistory?.controller.invalidate();
        const previous = this._commentLoadController;
        this._commentLoadController = null;
        if (previous) {
            previous.abort();
        }
    },
    loadComment(msgInfo, loadOptions = {}) {
        this._cancelCommentLoad();
        const companion = this._takePrefetchComments(msgInfo, loadOptions);
        if (companion) {
            // 投稿・ニコる・削除は ThreadLoader が msgInfo.threadInfo を読む。通常の読み込みでは
            // ThreadLoader.load() が msgInfo へ書き込むが、先読みのコメントは先読み時の別の
            // msgInfo で読み込んでいるため、今の msgInfo には付いていなかった。
            // （"Cannot destructure property 'videoId' of 'msgInfo.threadInfo'" でコメント関係が
            // 全て失敗していた。先読みした動画でだけ起きる。）
            if (msgInfo && companion.threadInfo) {
                msgInfo.threadInfo = companion.threadInfo;
                // 言語の自動切り替え（INVALID_PARAMETER 時の既定言語への退避）も load() が書く値。
                if (companion.threadInfo.language) {
                    msgInfo.language = companion.threadInfo.language;
                }
            }
            const heldRequestId = this._requestId;
            return Promise.resolve().then(() => {
                if (this._requestId === heldRequestId)
                    this._onCommentLoadSuccess(heldRequestId, companion);
            });
        }
        const controller = this._commentLoadController = new AbortController();
        const requestId = this._requestId;
        const isCurrent = () => this._commentLoadController === controller &&
            this._requestId === requestId && !controller.signal.aborted;
        msgInfo.language = this._playerConfig.props.commentLanguage;
        this._playerConfig.props.commentLanguage = msgInfo.language;
        // Never let caller options override the lifecycle-owned abort signal.
        return this.threadLoader.load(msgInfo, { ...loadOptions, signal: controller.signal }).then((result) => { if (isCurrent()) {
            this._onCommentLoadSuccess(requestId, result);
        } }, (error) => { if (isCurrent()) {
            this._onCommentLoadFail(requestId, error);
        } }).finally(() => {
            if (this._commentLoadController === controller) {
                this._commentLoadController = null;
            }
        });
    },
    reloadComment(param = {}) {
        const msgInfo = Object.assign({}, this._videoInfo.msgInfo);
        if (param && Object.prototype.hasOwnProperty.call(param, 'when')) {
            if (!Number.isSafeInteger(param.when) || param.when < 0 || param.when > Math.floor(Date.now() / 1000)) {
                return this.execCommand('alert', '過去ログの日時が不正です。日時を選び直してください。');
            }
            msgInfo.when = param.when;
        }
        // Only this explicit UI action is permitted to refresh the thread key early.
        return this.loadComment(msgInfo, { manualReload: true });
    },
    _onCommentLoadSuccess(requestId, result) {
        if (requestId !== this._requestId) {
            return;
        }
        let options = {
            replacement: this._videoInfo.replacementWords,
            duration: this._videoInfo.duration,
            // Task 081: 提供画面を出す設定なら、動画の後ろ（提供画面の間）のコメントを詰めない
            creditDuration: this._playerConfig.props['uaa.enable'] && this._playerConfig.props['supporterCredit.enable'] ? 30 : 0,
            mainThreadId: result.threadInfo.threadId,
            // Composite NG video-ID predicates need the original watch identity.
            watchId: this._watchId,
            format: result.format
        };
        this._nicoVideoPlayer.closeCommentPlayer();
        this._threadInfo = result.threadInfo;
        this._nicoVideoPlayer.setComment(result.body, options);
        // 選択中の言語がその動画で使えず、ThreadLoader側でサーバー既定言語に
        // フォールバックして読み込めた場合、設定を書き換えずにいると次に開く
        // 動画でも同じ言語指定で失敗→リトライを繰り返してしまう。
        // 実際に使えた言語で設定を更新し、以後は最初から成功するようにする
        // （Task B-5 追加調査）。
        if (result.threadInfo.language && result.threadInfo.language !== this._playerConfig.props.commentLanguage) {
            this._playerConfig.props.commentLanguage = result.threadInfo.language;
        }
        WatchInfoCacheDb.putBestEffort(this._watchId, { threadInfo: result.threadInfo });
        this._state.isCommentReady = true;
        this._state.isWaybackMode = result.threadInfo.isWaybackMode;
        this.emit('commentReady', result, this._threadInfo);
        // Task200: reuse the successful normal result; history never changes posting metadata.
        const history = this._ensureCommentHistory?.();
        if (history) {
            void history.controller.normalReady({ videoInfo: this._videoInfo, result, generation: requestId });
        }
        if (result.threadInfo.totalResCount !== this._videoInfo.count.comment) {
            this._state.count = {
                ...this._state.count, comment: result.threadInfo.totalResCount
            };
            this.emit('videoCount', { comment: result.threadInfo.totalResCount });
        }
    },
    _onCommentLoadFail(requestId, e) {
        if (requestId !== this._requestId) {
            return;
        }
        this._recordDiagnostic({
            category: 'comment', level: 'error',
            message: e && e.message || 'コメントの読み込みに失敗しました',
            videoId: this._watchId, source: 'comment',
            details: { errorCode: e && e.errorCode, reason: e && e.reason }
        });
        this.execCommand('alert', e && e.message);
    },
    _logCommentPostWarning(details) {
        // Keep rejection diagnostics readable when copied from Chrome DevTools.
        const safe = { ...details };
        if (typeof safe.reason === 'string' && !/^[a-z0-9-]{1,80}$/i.test(safe.reason)) {
            safe.reason = 'other';
        }
        window.console.warn('[ZenzaWatch][CommentPost]', safe, JSON.stringify(safe));
        // Existing console diagnostics remain unchanged. Persist only approved
        // fields, and avoid duplicating the detailed final-result notification.
        if (safe.phase !== 'dialog-result') {
            this._recordDiagnostic({
                category: 'comment', level: 'warning',
                message: 'コメント投稿の事前確認で問題がありました',
                videoId: safe.videoId, source: 'comment',
                details: safe
            });
        }
    },
    async addChat(text, cmd, vpos = null, options = {}) {
        const precheckRejectReason = !this._nicoVideoPlayer ? 'player-unavailable' :
            !this.threadLoader ? 'thread-loader-unavailable' :
                !this._state.isCommentReady ? 'comment-not-ready' :
                    this._state.isCommentPosting ? 'post-already-in-flight' : '';
        if (precheckRejectReason) {
            this._logCommentPostWarning({
                phase: 'dialog-precheck',
                event: 'rejected',
                reason: precheckRejectReason,
                videoId: this._watchId || null,
                isCommentReady: !!this._state.isCommentReady,
                isCommentPosting: !!this._state.isCommentPosting
            });
            return Promise.reject();
        }
        if (!util.isLogin()) {
            this._logCommentPostWarning({
                phase: 'dialog-precheck',
                event: 'rejected',
                reason: 'not-logged-in',
                videoId: this._watchId || null
            });
            return Promise.reject();
        }
        // Task 090（監査v2 ZW-025）: 投稿を始めた時の動画・スレッド・世代を固定する。
        // 結果の記録（履歴・blockNo）は元の動画へ、今の画面の更新（投稿中の表示・通知）は同じ動画のままの時だけ行う
        const requestId = this._requestId;
        const watchId = this._watchId;
        const threadInfo = this._threadInfo;
        const isCurrent = () => this._requestId === requestId;
        // Task183 (F07): a video without a post target cannot be posted to; tell the user
        // and do not add a local "posting" comment.
        if (!threadInfo || threadInfo.threadId === null || threadInfo.threadId === undefined || threadInfo.canPost === false) {
            this._logCommentPostWarning({
                phase: 'dialog-precheck',
                event: 'rejected',
                reason: 'no-post-target',
                videoId: watchId || null,
                hasThreadInfo: !!threadInfo,
                hasPostTarget: !!(threadInfo && threadInfo.threadId !== null && threadInfo.threadId !== undefined && threadInfo.canPost !== false)
            });
            this.execCommand('alert', 'この動画ではコメントを投稿できません（投稿先のスレッドがありません）');
            return Promise.reject({ status: 'fail', reason: 'no-post-target' });
        }
        const threadId = this._threadInfo.threadId * 1;
        // force184のスレッドに184コマンドをつけてしまうとエラー. 同じなんだから無視すりゃいいだろが
        if (!threadInfo.is184Forced) {
            cmd = cmd ? ('184 ' + cmd) : '184';
        }
        Object.assign(options, { isMine: true, isUpdating: true, thread: threadId });
        vpos = (!isNaN(vpos) && typeof vpos === 'number') ? vpos : this._nicoVideoPlayer.vpos;
        const submittedActivity = {
            kind: 'comment-post', text,
            videoTitle: this._videoInfo?.title,
            positionMs: Math.floor((vpos || 0) * 10)
        };
        const nicoChat = this._nicoVideoPlayer.addChat(text, cmd, vpos, options);
        this._state.isCommentPosting = true;
        console.time('コメント投稿');
        const onSuccess = (result) => {
            console.timeEnd('コメント投稿');
            nicoChat.isUpdating = false;
            nicoChat.no = result.no;
            // 同じ動画のまま（コメントの読み直しでスレッドの情報が新しくなっていても）なら今のスレッドへ、切り替えた後なら元のスレッドへ
            if (typeof result.blockNo === 'number' && Number.isFinite(result.blockNo)) {
                (isCurrent() ? this._threadInfo : threadInfo).blockNo = result.blockNo;
            }
            WatchInfoCacheDb.putBestEffort(watchId, { comment: { text, cmd, vpos, options } });
            this._recordDiagnostic({
                category: 'comment', level: 'success', message: 'コメント投稿成功',
                videoId: watchId, source: 'comment',
                activity: submittedActivity,
                details: { threadId, postedNo: result.no, outcome: 'accepted' }
            });
            if (isCurrent()) {
                this.execCommand('notify', 'コメント投稿成功');
                this._state.isCommentPosting = false;
            }
            return Promise.resolve(result);
        };
        const onFail = (err) => {
            err = err || {};
            this._logCommentPostWarning({
                phase: 'dialog-result',
                event: 'failure',
                videoId: watchId || null,
                reason: typeof err.reason === 'string' ? err.reason : undefined,
                statusCode: Number.isInteger(Number(err.statusCode)) ? Number(err.statusCode) : undefined,
                outcome: ['not-sent', 'rejected', 'unknown'].includes(err.outcome) ? err.outcome : undefined
            });
            this._recordDiagnostic({
                category: 'comment',
                level: err.outcome === 'unknown' ? 'warning' : 'error',
                message: err.message || 'コメント投稿に失敗しました',
                videoId: watchId, source: 'comment',
                details: { threadId, outcome: err.outcome, reason: err.reason,
                    statusCode: err.statusCode }
            });
            console.timeEnd('コメント投稿');
            nicoChat.isPostFail = true;
            nicoChat.isUpdating = false;
            if (err.blockNo && typeof err.blockNo === 'number') {
                (isCurrent() ? this._threadInfo : threadInfo).blockNo = err.blockNo;
            }
            if (isCurrent()) {
                this.execCommand('alert', err.message);
                this._state.isCommentPosting = false;
            }
            return Promise.reject(err);
        };
        const msgInfo = this._videoInfo.msgInfo;
        // Task780: Turnstile verification can take minutes. Never send that delayed
        // authenticated comment to a video whose player generation was replaced.
        return this.threadLoader.postChat(msgInfo, text, cmd, vpos, isCurrent)
            .then(onSuccess).catch(onFail);
    },
    removeChat(chat) {
        if (!this._nicoVideoPlayer ||
            !this.threadLoader ||
            !this._state.isCommentReady) {
            return Promise.reject(new Error('コメント削除の準備ができていません'));
        }
        if (!util.isLogin()) {
            return Promise.reject(new Error('ログインが必要です'));
        }
        console.time('コメント削除');
        // The in-flight server operation belongs to the originally opened video.
        const videoInfo = this._videoInfo;
        const player = this._nicoVideoPlayer;
        const msgInfo = videoInfo.msgInfo;
        return this.threadLoader.deleteChat(msgInfo, chat)
            .then((result) => {
            console.timeEnd('コメント削除');
            this._recordDiagnostic({
                category: 'comment', level: 'success', message: 'コメント削除成功',
                videoId: videoInfo && videoInfo.videoId,
                source: 'comment', details: { operation: 'delete' }
            });
            if (this._videoInfo === videoInfo && this._nicoVideoPlayer === player) {
                this.execCommand('notify', 'コメント削除成功');
                player.removeChat(chat);
            }
        })
            .catch((err) => {
            err = err || {};
            this._recordDiagnostic({
                category: 'comment', level: 'error',
                message: err.message || 'コメント削除に失敗しました',
                videoId: videoInfo && videoInfo.videoId, source: 'comment',
                details: { operation: 'delete', statusCode: err.statusCode,
                    errorCode: err.errorCode, reason: err.reason }
            });
            console.warn('コメント削除に失敗しました', err);
            console.timeEnd('コメント削除');
            if (this._videoInfo === videoInfo && this._nicoVideoPlayer === player) {
                this.execCommand('alert', err.message);
            }
            return Promise.reject(err);
        });
    },
};
//===END===
export {NicoVideoPlayerDialogComments};

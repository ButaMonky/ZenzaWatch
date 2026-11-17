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

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogPlaylistSources.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** プレイリストへの読み込み（マイリスト・投稿動画・検索・シリーズ・コンテンツツリー・大百科）と、読み込みの持ち主の管理。 */
const NicoVideoPlayerDialogPlaylistSources = {
    _onPlaylistAppend(watchId) {
        this._playlist.append(watchId);
    },
    _onPlaylistInsert(watchId) {
        this._playlist.insert(watchId);
    },
    _capturePlaylistLoadOwner() {
        return {
            videoInfo: this._videoInfo,
            watchId: this._watchId,
            requestId: this._requestId,
            playlist: this._playlist
        };
    },
    _isCurrentPlaylistLoadOwner(owner) {
        return this._videoInfo === owner.videoInfo &&
            this._watchId === owner.watchId &&
            this._requestId === owner.requestId &&
            this._playlist === owner.playlist;
    },
    _acceptPlaylistLoadResult(owner, result) {
        if (!this._isCurrentPlaylistLoadOwner(owner))
            return false;
        if (result && typeof result === 'object' && 'status' in result) {
            if (result.status === 'superseded')
                return false;
            if (result.status === 'ok' && 'message' in result && typeof result.message === 'string')
                return true;
        }
        this._reportPlaylistLoadFailure(owner, result, 'プレイリストの読込結果を確認できませんでした');
        return false;
    },
    _reportPlaylistLoadFailure(owner, error, fallback) {
        if (!this._isCurrentPlaylistLoadOwner(owner))
            return;
        const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message ?
            error.message : fallback;
        this.execCommand('alert', message);
    },
    _onPlaylistSetMylist(id) {
        const owner = this._capturePlaylistLoadOwner();
        let option = { watchId: this._watchId };
        // 通常時はプレイリストの置き換え、
        // 連続再生中はプレイリストに追加で読み込む
        option.insert = this._playlist.isEnable;
        owner.playlist.load({ type: 'mylist', id }, option, owner.videoInfo.msgInfo, () => this._isCurrentPlaylistLoadOwner(owner)).then((result) => {
            // A stale response must never insert the new video's metadata into the old list.
            if (!this._acceptPlaylistLoadResult(owner, result)) {
                return;
            }
            this.execCommand('notify', result.message);
            this._state.currentTab = 'playlist';
            owner.playlist.insertCurrentVideo(owner.videoInfo);
        }, (err) => this._reportPlaylistLoadFailure(owner, err, 'マイリストのロード失敗'));
    },
    _onPlaylistSetUploadedVideo(param) {
        // Task1042: {id, contentType: 'long' | 'short'} で種類を絞れる（文字列なら動画とショートの両方）
        const id = param && typeof param === 'object' ? param.id : param;
        const contentType = param && typeof param === 'object' && ['long', 'short'].includes(param.contentType) ? param.contentType : 'all';
        const owner = this._capturePlaylistLoadOwner();
        let option = { watchId: this._watchId };
        // 通常時はプレイリストの置き換え、
        // 連続再生中はプレイリストに追加で読み込む
        option.insert = this._playlist.isEnable;
        owner.playlist.load({ type: 'user-uploaded', id, ...(contentType === 'all' ? {} : { contentType }) }, option, owner.videoInfo.msgInfo, () => this._isCurrentPlaylistLoadOwner(owner)).then((result) => {
            if (!this._acceptPlaylistLoadResult(owner, result)) {
                return;
            }
            this.execCommand('notify', result.message);
            this._state.currentTab = 'playlist';
            owner.playlist.insertCurrentVideo(owner.videoInfo);
        }, (err) => this._reportPlaylistLoadFailure(owner, err, '投稿動画一覧のロード失敗'));
    },
    _onPlaylistSetSearchVideo(params) {
        const owner = this._capturePlaylistLoadOwner();
        let option = Object.assign({ watchId: this._watchId }, params.option || {});
        let word = params.word;
        // 通常時はプレイリストの置き換え、
        // 連続再生中はプレイリストに追加で読み込む
        option.insert = this._playlist.isEnable;
        if (option.owner) {
            const owner = this._videoInfo && this._videoInfo.owner;
            let ownerId = parseInt(owner && owner.id, 10);
            // Task 066: 投稿者IDが取れていない動画（投稿者欄が空の動画で、補完にも
            // 失敗した場合）では NaN のまま検索条件に入り、検索が壊れていた。
            if (isNaN(ownerId)) {
                window.console.warn('投稿者IDが不明のため、投稿者で絞り込まずに検索します', this._videoInfo && this._videoInfo.watchId);
                this.execCommand('notify', '投稿者IDが不明のため、投稿者で絞り込まずに検索します');
                ownerId = null;
            }
            if (ownerId === null) {
                // 絞り込みなし
            }
            else if (this._videoInfo.isChannel) {
                option.channelId = ownerId;
            }
            else {
                option.userId = ownerId;
            }
        }
        delete option.owner;
        let query = this._videoWatchOptions.query;
        const selectedContentType = option.selectContentType;
        option = Object.assign(option, query);
        // An explicit search-panel selection takes precedence over the opening URL.
        if (selectedContentType === 'long' || selectedContentType === 'short') {
            option.selectContentType = selectedContentType;
        }
        this._state.currentTab = 'playlist';
        // Task 073: 以前は件数を渡しておらず、常に既定の300件だった。
        // 設定（search.limit、上級者向け設定で変更可）の件数を渡す。範囲外の値はPlayList側で丸める。
        const searchLimit = this._playerConfig.props['search.limit'];
        owner.playlist.loadSearchVideo(word, option, searchLimit, () => this._isCurrentPlaylistLoadOwner(owner)).then((result) => {
            if (!this._acceptPlaylistLoadResult(owner, result)) {
                return;
            }
            this.execCommand('notify', result.message);
            owner.playlist.insertCurrentVideo(owner.videoInfo);
            global.emitter.emitAsync('searchVideo', { word, option });
            window.setTimeout(() => {
                if (this._isCurrentPlaylistLoadOwner(owner)) {
                    owner.playlist.scrollToActiveItem();
                }
            }, 1000);
        }, (err) => {
            this._reportPlaylistLoadFailure(owner, err, '検索失敗または該当無し: 「' + word + '」');
        });
    },
    _onPlaylistSetSeriesVideo(id) {
        const owner = this._capturePlaylistLoadOwner();
        let option = { watchId: this._watchId };
        option.insert = this._playlist.isEnable;
        this._state.currentTab = 'playlist';
        owner.playlist.load({ type: 'series', id }, option, owner.videoInfo.msgInfo, () => this._isCurrentPlaylistLoadOwner(owner)).then((result) => {
            if (!this._acceptPlaylistLoadResult(owner, result)) {
                return;
            }
            this.execCommand('notify', result.message);
            owner.playlist.insertCurrentVideo(owner.videoInfo);
            window.setTimeout(() => {
                if (this._isCurrentPlaylistLoadOwner(owner)) {
                    owner.playlist.scrollToActiveItem();
                }
            }, 1000);
        }, (err) => this._reportPlaylistLoadFailure(owner, err, `シリーズリストの取得に失敗: series/${id}`));
    },
    /**
     * ニコニ・コモンズのコンテンツツリー（親作品・子作品）のうち、
     * 動画であるものをプレイリストに読み込む（Task 043）。
     *
     * 並び順は「親作品 → 子作品」。ユーザーとの相談の結果、今回は
     * 順番で分かるようにするだけとし、行の色分けや区切り線は将来の課題とした。
     * 辿るのは直接の親子のみ（孫以降は辿らない）。
     */
    async _onPlaylistSetCommonsTree() {
        const videoId = this._videoInfo ? this._videoInfo.videoId : null;
        if (!videoId) {
            return this.execCommand('alert', '動画の情報がまだ読み込めていません');
        }
        // Task181 (F04): bind this request to the video, the player request and the
        // latest click; a switch, close or newer click makes every later step a no-op.
        const requestId = this._requestId;
        const watchId = this._watchId;
        // Task197: a newer click, a video switch or close also aborts the running job itself
        // (HTTP, body read, retry wait, display-info fill), not only its later steps.
        this._abortCommonsTreeJob();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this._commonsTreeJob = controller;
        const signal = controller ? controller.signal : undefined;
        const token = this._commonsTreeToken = {};
        const isCurrent = () => this._commonsTreeToken === token && this._requestId === requestId &&
            this._watchId === watchId && !!this._videoInfo && this._videoInfo.videoId === videoId &&
            !(signal && signal.aborted);
        // Task191 (COM-03): if the previous request for this same video stopped at the cap
        // (or failed part way), this explicit request continues from where it stopped and
        // fetches at most the same cap again; nothing is fetched automatically.
        const prev = this._commonsTreeProgress;
        const progress = (prev && prev.videoId === videoId && prev.requestId === requestId) ? prev : null;
        // Task199 (review R03): a resume continues the same accumulated job; a fresh scan starts a new one
        const accumBase = this._commonsTreeAccum;
        const accum = (progress && accumBase && accumBase.jobId === progress.jobId &&
            accumBase.videoId === videoId && accumBase.requestId === requestId) ? accumBase :
            NicoVideoPlayerDialog.newCommonsTreeAccum(videoId, requestId);
        this._commonsTreeProgress = null;
        this.execCommand('notify', progress ? 'コンテンツツリーの続きを取得中...' : 'コンテンツツリーを取得中...');
        // Task197: one operation scans the whole direct parent/child range (Task194); progress is
        // reported at most once a second. Manual "continue" is only needed after a failure.
        let lastProgressAt = 0;
        const onProgress = (p) => {
            const now = Date.now();
            if (!isCurrent() || now - lastProgressAt < 1000) {
                return;
            }
            lastProgressAt = now;
            const label = p.kind === 'parents' ? '親作品' : '子作品';
            this.execCommand('notify', `コンテンツツリーを取得中...（${label} ${Math.min(p.offset, p.total)}/${p.total}件目）`);
        };
        const loadOptions = { fullScan: true, signal, onProgress };
        if (progress) {
            loadOptions.offsets = { parents: progress.parents, children: progress.children };
        }
        let tree;
        try {
            tree = await CommonsTreeLoader.load(videoId, undefined, loadOptions);
        }
        catch (e) {
            if (!isCurrent()) {
                return;
            }
            // Task191: a failed continuation can be retried from the same place
            this._commonsTreeProgress = progress;
            window.console.error('コンテンツツリーの取得に失敗', e && e.message);
            return this.execCommand('alert', (e && e.message) || 'コンテンツツリーの取得に失敗しました');
        }
        if (!isCurrent() || tree.cancelled) {
            return;
        }
        // 再生できるのは公開中の動画だけ。コモンズ素材や非公開・削除済みは除外する。
        const parents = tree.parents.works.filter((w) => w.isVideo);
        const children = tree.children.works.filter((w) => w.isVideo);
        const skipped = (tree.parents.works.length - parents.length) +
            (tree.children.works.length - children.length);
        // Task180 (F03/COM-02/COM-03): a failed side is "unknown", not "0 items".
        // Task191 (COM-03): report the scanned range (start + rows returned) against the total.
        const sideNotes = [];
        const scanned = (side) => (side.startOffset || 0) + (side.fetchedCount ?? side.works.length);
        for (const [label, side] of [['親作品', tree.parents], ['子作品', tree.children]]) {
            if (side.skipped) {
                continue;
            }
            if (side.failed && side.partial) {
                sideNotes.push(`${label}は途中で取得に失敗（全${side.total}件中${scanned(side)}件目まで取得）`);
            }
            else if (side.failed) {
                sideNotes.push(`${label}の取得に失敗（件数不明）`);
            }
            else if (side.truncated || (side.stopReason === 'limit' && side.total > scanned(side))) {
                sideNotes.push(`${label}は全${side.total}件中${scanned(side)}件目まで取得（上限）`);
            }
            else if (['empty-before-end', 'repeated-page', 'no-progress'].includes(side.stopReason) ||
                (side.totalChanges && side.totalChanges.length)) {
                // Task197: inconsistent pages are a partial result, never "all fetched"
                sideNotes.push(`${label}は一覧の途中で応答が矛盾したため一部のみ（全${side.total}件中${side.works.length}件）`);
            }
            else if (side.complete === false) {
                // Task198 (review R02): any other explicitly incomplete side is not a normal result either
                sideNotes.push(`${label}は一部のみ取得（理由: ${side.stopReason || '不明'}）`);
            }
        }
        // Task198 (review R02): explicit complete:false (Task194 scan) is carried to the UI. An old-style
        // result without the field (complete undefined) keeps its previous meaning.
        const incompleteSide = [tree.parents, tree.children].some(side => side && !side.skipped && side.complete === false);
        const resumable = [tree.parents, tree.children].some(side => typeof side.nextOffset === 'number');
        // stored only once this request has finished (a superseded request must not leave a
        // continuation point that skips rows it never added)
        const nextProgress = !resumable ? null : { videoId, requestId, jobId: accum.jobId,
            parents: typeof tree.parents.nextOffset === 'number' ? tree.parents.nextOffset : null,
            children: typeof tree.children.nextOffset === 'number' ? tree.children.nextOffset : null };
        if (resumable) {
            sideNotes.push('もう一度「親作品・子作品」を選ぶと続きを取得します');
        }
        const failureNote = sideNotes.length ? `／${sideNotes.join('／')}` : '';
        const anyFailed = !!(tree.parents.failed || tree.children.failed || resumable || incompleteSide);
        // Task199 (review R01/R03): every work (video or not) of this step is merged into the job result
        NicoVideoPlayerDialog.mergeCommonsTreeWorks(accum, tree);
        this._commonsTreeAccum = accum;
        if (!parents.length && !children.length) {
            this._commonsTreeProgress = nextProgress;
            this._commonsTreeLastResult = NicoVideoPlayerDialog.buildCommonsTreeResult(accum);
            if (anyFailed) {
                return this.execCommand('notify', `追加できる親作品・子作品はありませんでした${skipped > 0 ? `（動画以外・非公開${skipped}件は除外）` : ''}${failureNote}`);
            }
            // Task 074: コンテンツツリー自体が無い動画（APIが404）も「0件」として普通に伝える
            const notRegistered = tree.parents.notFound && tree.children.notFound;
            return this.execCommand('notify', skipped > 0 ?
                `親作品・子作品は0件でした（動画以外・非公開の作品${skipped}件は追加できません）` :
                (notRegistered ?
                    'この動画はコンテンツツリーに登録されていません（親作品・子作品0件）' :
                    '親作品・子作品は0件でした'));
        }
        // 親 → 子 の順に並べる
        const watchIds = parents.concat(children).map((w) => w.contentId);
        // Task197: all IDs are added at once without waiting for ~1000 per-video detail loads (Task196);
        // details are filled for visible items, overflow beyond the playlist capacity is reported and kept.
        const report = {};
        const option = { watchId, isCancelled: () => !isCurrent(), deferDetails: true, report };
        // Task192 (COM-04): with_meta display hints (if the response had them) for items whose
        // full video information cannot be loaded
        const hints = {};
        parents.concat(children).forEach((w) => { if (w.meta) {
            hints[w.contentId] = w.meta;
        } });
        if (Object.keys(hints).length) {
            option.hints = hints;
        }
        option.insert = this._playlist.isEnable;
        // Task199 (review R03): a resumed batch goes right after the previous batch of the same job,
        // not before it (insert mode puts items behind the active item otherwise)
        if (option.insert && accum.lastAddedWatchId) {
            option.insertAfterWatchId = accum.lastAddedWatchId;
        }
        this._state.currentTab = 'playlist';
        const added = await this._playlist.appendWatchIds(watchIds, option);
        if (added === null || !isCurrent()) {
            return;
        }
        const detail = `親作品${parents.length}件・子作品${children.length}件`;
        // APIが総数を返すので、取得できた件数が総数に満たない場合は伝える
        const total = tree.parents.total + tree.children.total;
        const fetched = tree.parents.works.length + tree.children.works.length;
        const truncated = failureNote || (!progress && total > fetched && !tree.complete ? `／全${total}件中${fetched}件を取得` : '');
        this._commonsTreeProgress = nextProgress;
        // Task197/199: keep the whole job result (all works, overflow, added/existing) for the JSON export
        const overflow = Array.isArray(report.overflow) ? report.overflow : [];
        NicoVideoPlayerDialog.mergeCommonsTreeReport(accum, report, watchIds);
        this._commonsTreeLastResult = NicoVideoPlayerDialog.buildCommonsTreeResult(accum);
        const overflowNote = overflow.length ?
            `／プレイリストの上限（${report.capacity}件）のため${overflow.length}件は未追加` : '';
        const existingNote = report.existing ? `／${report.existing}件は既にプレイリストにあります` : '';
        const pending = added > 0 ? '。表示情報を補完しています' : '';
        if (added === 0 && !overflow.length) {
            this.execCommand('notify', `追加できる動画がありませんでした（${detail}はすべて既にプレイリストにあります${truncated}）`);
        }
        else {
            this.execCommand('notify', `プレイリストに${added}件追加しました（${detail}${skipped > 0 ? `／動画以外${skipped}件は除外` : ''}${existingNote}${overflowNote}${truncated}）${pending}`);
        }
        if (added > 0) {
            this._fillCommonsTreeDisplayInfo(videoId, tree, { signal, isCurrent });
        }
        this._playlist.insertCurrentVideo(this._videoInfo);
        window.setTimeout(() => {
            if (isCurrent()) {
                this._playlist.scrollToActiveItem();
            }
        }, 1000);
    },
    _getNicodicGate() {
        if (this._nicodicGate) {
            return this._nicodicGate;
        }
        this._nicodicGate = new CrossDomainGate({
            baseUrl: 'https://dic.nicovideo.jp/robots.txt',
            origin: 'https://dic.nicovideo.jp/',
            type: 'nicodic'
        });
        return this._nicodicGate;
    },
    /** Task1037: 大百科記事に載っている動画をすべてプレイリストへ入れる。 */
    async _onPlaylistSetNicodic(articleUrl) {
        let url;
        try {
            url = new URL(String(articleUrl));
        }
        catch (_) {
            return;
        }
        if (url.hostname !== 'dic.nicovideo.jp' || !/^\/(?:v|a)\/[^/]+\/?$/.test(url.pathname)) {
            return;
        }
        const href = 'https://dic.nicovideo.jp' + url.pathname;
        const requestId = this._requestId, watchId = this._watchId;
        const token = this._nicodicPlaylistToken = {};
        const isCurrent = () => this._nicodicPlaylistToken === token && this._requestId === requestId && this._watchId === watchId;
        const articleName = decodeURIComponent(url.pathname.replace(/^\/(?:v|a)\//, '').replace(/\/$/, ''));
        this.execCommand('notify', `大百科「${articleName}」の記事から動画を取得中...`);
        const diagnostic = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('dictionary', href, 'response', isCurrent);
        let html = '';
        try {
            const gate = this._getNicodicGate();
            const res = await gate.fetch(href, { _format: 'text', timeout: 30000 });
            if (!res || typeof res.text !== 'function') {
                throw Object.assign(new Error('NICODIC_GATE_UNAVAILABLE'), { status: 0 });
            }
            if (!res.ok) {
                throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
            }
            html = await res.text();
        }
        catch (e) {
            diagnostic?.failure(e);
            if (!isCurrent()) {
                return;
            }
            window.console.warn('大百科記事の取得に失敗', e?.message);
            return this.execCommand('alert', `大百科記事を取得できませんでした（${e?.message || '通信エラー'}）`);
        }
        if (!isCurrent()) {
            return;
        }
        const { ids, marker } = NicoVideoPlayerDialog.extractNicodicVideoIds(html);
        if (!ids.length) {
            diagnostic?.failure({ kind: 'schema', missing: 'nicopedia_article_body links' });
            return this.execCommand('notify', `大百科「${articleName}」の記事に動画は見つかりませんでした`);
        }
        if (marker) {
            diagnostic?.success();
        }
        else {
            diagnostic?.failure({ kind: 'schema', missing: 'nicopedia_from=nicopedia_article_body' });
        }
        const report = {};
        const option = { watchId, isCancelled: () => !isCurrent(), deferDetails: true, report,
            insert: this._playlist.isEnable };
        this._state.currentTab = 'playlist';
        const added = await this._playlist.appendWatchIds(ids, option);
        if (added === null || !isCurrent()) {
            return;
        }
        const overflow = Array.isArray(report.overflow) ? report.overflow : [];
        const notes = [
            report.existing ? `${report.existing}件は既にプレイリストにあります` : '',
            overflow.length ? `プレイリストの上限（${report.capacity}件）のため${overflow.length}件は未追加` : '',
            marker ? '' : '記事の形式が想定と違うため、本文以外の動画も含まれる可能性があります'
        ].filter(Boolean);
        this.execCommand('notify', `大百科「${articleName}」から${added}件をプレイリストに追加しました（記事内の動画${ids.length}件` +
            (notes.length ? '／' + notes.join('／') : '') + '）');
        if (this._videoInfo) {
            this._playlist.insertCurrentVideo(this._videoInfo);
        }
    },
    _abortCommonsTreeJob() {
        const job = this._commonsTreeJob;
        this._commonsTreeJob = null;
        if (job && !job.signal.aborted) {
            job.abort();
        }
    },
    /**
     * Task197: after the IDs are added, fetch the display info (with_meta=1, at most 100 per request,
     * one request at a time) and apply it to the still-incomplete items only. Failure or cancellation
     * keeps the IDs; duration/tags/counts are never confirmed from this info.
     */
    async _fillCommonsTreeDisplayInfo(videoId, tree, { signal, isCurrent }) {
        if (!CommonsTreeLoader.scanMeta) {
            return;
        }
        let applied = 0, complete = true;
        for (const side of [tree.parents, tree.children]) {
            if (!side || side.skipped || !(side.total > 0) || !isCurrent()) {
                continue;
            }
            const r = await CommonsTreeLoader.scanMeta(videoId, side.kind || (side === tree.parents ? 'parents' : 'children'), side.total, {
                signal,
                onPage: ({ map }) => {
                    if (isCurrent() && this._playlist) {
                        applied += this._playlist.applyHints(map);
                        map.clear();
                    }
                }
            }).catch(() => ({ complete: false }));
            complete = complete && r.complete !== false;
        }
        if (!isCurrent()) {
            return;
        }
        this.execCommand('notify', complete ?
            `親作品・子作品の表示情報を補完しました（${applied}件。詳細は表示した項目から順に取得します）` :
            `親作品・子作品の表示情報の一部を取得できませんでした（動画は追加済み。表示した項目から詳細を取得します）`);
    },
};
//===END===
export {NicoVideoPlayerDialogPlaylistSources};

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
import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogNicoadEnd.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** 動画の終わりに出す、ニコニ広告した人の一覧（終了画面）。 */
const NicoVideoPlayerDialogNicoadEnd = {
    async _showNicoadEndScreen() {
        const props = this._playerConfig?.props || {};
        if (!props['uaa.enable'] || props['nicoadEnd.enable'] === false) {
            return;
        }
        if (NicoVideoPlayerDialog.isExternalPlayback()) {
            return;
        }
        const videoInfo = this._videoInfo;
        const parent = this._nicoVideoPlayer?._videoPlayer?._body;
        if (!videoInfo || !parent || this._nicoVideoPlayer?._videoPlayer?._isYouTube) {
            return;
        }
        const videoId = videoInfo.videoId;
        if (!/^[a-z]{2}\d+$/.test(String(videoId))) {
            return;
        }
        const requestId = this._requestId;
        const tags = (videoInfo.tagList || []).map((t) => t && (t.name || t.tag || t.text))
            .filter((t) => typeof t === 'string' && t).slice(0, 30);
        const url = 'https://api.nicoad.nicovideo.jp/v1/nicoad?frameId=12&limit=10' +
            '&tags=' + encodeURIComponent(tags.join(',')) + '&excludeVideoIds=' + encodeURIComponent(videoId) +
            '&allowSensitiveContents=true&decoration=video';
        const diagnostic = typeof RequestDiagnostics === 'undefined' ? null :
            RequestDiagnostics.begin('nicoad-end', videoId, 'response', () => this._requestId === requestId, undefined, { url, method: 'GET' });
        let items = [];
        let res;
        try {
            res = await fetch(url, { credentials: 'include', headers: { 'x-frontend-id': '6', 'x-frontend-version': '0' } });
            if (!res.ok) {
                diagnostic?.response(res);
                return;
            }
            const body = await res.json();
            const valid = Array.isArray(body?.data?.nicoads);
            diagnostic?.decoded(res, body?.meta, valid ? undefined : 'data.nicoads', false);
            if (!valid)
                return;
            items = NicoVideoPlayerDialog.nicoadEndItems(body);
        }
        catch (e) {
            diagnostic?.failure(RequestDiagnostics.readFailure(res, e));
            return;
        }
        // 待っている間に再生・別の動画・閉じる操作があったら出さない。
        if (this._requestId !== requestId || !this._state?.isEnded || this.isPlaying || !items.length) {
            return;
        }
        this._hideNicoadEndScreen();
        NicoVideoPlayerDialog.ensureNicoadEndStyle();
        const view = document.createElement('div');
        view.className = 'zenzaNicoadEnd';
        view.setAttribute('role', 'region');
        view.setAttribute('aria-label', 'ニコニ広告された動画');
        const header = document.createElement('div');
        header.className = 'zenzaNicoadEnd-header';
        const title = document.createElement('span');
        title.textContent = 'ニコニ広告';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'zenzaNicoadEnd-close';
        close.textContent = '×';
        close.title = '閉じる';
        close.addEventListener('click', e => { e.stopPropagation(); this._hideNicoadEndScreen(); });
        header.append(title, close);
        const list = document.createElement('div');
        list.className = 'zenzaNicoadEnd-list';
        for (const item of items) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'zenzaNicoadEnd-item' + (item.decoration ? ' is-' + item.decoration : '');
            card.title = item.title;
            const thumb = document.createElement('div');
            thumb.className = 'zenzaNicoadEnd-thumb' + (item.mask ? ' is-mask' : '');
            if (item.thumbnail) {
                thumb.style.backgroundImage = 'url("' + item.thumbnail.replace(/["\\]/g, '') + '")';
            }
            const name = document.createElement('div');
            name.className = 'zenzaNicoadEnd-title';
            name.textContent = item.title;
            const by = document.createElement('div');
            by.className = 'zenzaNicoadEnd-by';
            by.textContent = '提供：' + item.supporter;
            const pt = document.createElement('div');
            pt.className = 'zenzaNicoadEnd-pt';
            pt.textContent = item.point.toLocaleString('ja-JP') + 'pt';
            card.append(thumb, name, by, pt);
            card.addEventListener('click', e => {
                e.stopPropagation();
                this._hideNicoadEndScreen();
                this.open(item.id, { openNow: true });
            });
            list.append(card);
        }
        view.append(header, list);
        for (const type of ['mousedown', 'dblclick', 'wheel']) {
            view.addEventListener(type, e => e.stopPropagation());
        }
        parent.append(view);
        this._nicoadEnd = view;
    },
    _hideNicoadEndScreen() {
        const view = this._nicoadEnd;
        this._nicoadEnd = null;
        try {
            view?.remove();
        }
        catch (_) { /* noop */ }
    },
};
//===END===
export {NicoVideoPlayerDialogNicoadEnd};

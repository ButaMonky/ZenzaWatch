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

// GENERATED FROM tools/typescript-stage1/nico-src/NicoVideoPlayerDialogNotifications.ts (Task1060). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/** 通知と通知履歴パネル。 */
const NicoVideoPlayerDialogNotifications = {
    _recordDiagnostic(entry) {
        try {
            if (typeof NotificationJournal !== 'undefined') {
                NotificationJournal.record(entry);
            }
        }
        catch (_) { /* diagnostics must never interrupt player operations */ }
    },
    _toggleNotificationHistory() {
        if (!this._state.isOpen || typeof NotificationHistoryPanel === 'undefined') {
            return;
        }
        const container = this._$playerContainer && this._$playerContainer[0];
        const button = container && container.querySelector('.notificationHistorySwitch');
        if (!button) {
            return;
        }
        if (!this._notificationHistoryDock) {
            this._notificationHistoryDock = NotificationHistoryPanel.mountDock({ container, button });
        }
        this._notificationHistoryDock.toggle();
    },
    _closeNotificationHistory() {
        this._notificationHistoryDock?.dispose();
        this._notificationHistoryDock = null;
    },
};
//===END===
export {NicoVideoPlayerDialogNotifications};

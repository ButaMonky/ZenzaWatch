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
import {VideoHoverMenu} from './VideoHoverMenu';
import {NicoVideoPlayerDialog} from './NicoVideoPlayerDialog';

// GENERATED FROM tools/typescript-stage1/nico-src/VariablesMapper.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class VariablesMapper {
    get nextState() {
        const { menuScale, commentLayerOpacity, fullscreenControlBarMode } = this.config.props;
        return { menuScale, commentLayerOpacity, fullscreenControlBarMode };
    }
    get videoControlBarHeight() {
        return ((VideoControlBar.BASE_HEIGHT - VideoControlBar.BASE_SEEKBAR_HEIGHT) *
            this.state.menuScale + VideoControlBar.BASE_SEEKBAR_HEIGHT);
    }
    constructor({ config, element }) {
        this.config = config;
        this.state = {
            menuScale: 0,
            commentLayerOpacity: 0,
            fullscreenControlBarMode: 'auto'
        };
        this.element = element || document.body;
        this.emitter = new Emitter();
        const update = _.debounce(this.update.bind(this), 500);
        Object.keys(this.state).forEach(key => config.onkey(key, () => {
            // Toolbar-mode selection should apply immediately, not half a second later.
            if (key === 'fullscreenControlBarMode') {
                update.cancel();
                this.update();
            }
            else {
                update();
            }
        }));
        update();
    }
    on(...args) {
        this.emitter.on(...args);
    }
    shouldUpdate(state, nextState) {
        return Object.keys(state).some(key => state[key] !== nextState[key]);
    }
    setVar(key, value) {
        cssUtil.setProps([this.element, key, value]);
    }
    update() {
        const state = this.state;
        const nextState = this.nextState;
        if (!this.shouldUpdate(state, nextState)) {
            return;
        }
        const { menuScale, commentLayerOpacity, fullscreenControlBarMode } = nextState;
        this.state = nextState;
        Object.assign(this.element.dataset, { fullscreenControlBarMode });
        if (state.menuScale !== menuScale) {
            this.setVar('--zenza-ui-scale', menuScale);
            this.setVar('--zenza-control-bar-height', css.px(this.videoControlBarHeight));
        }
        if (state.commentLayerOpacity !== commentLayerOpacity) {
            this.setVar('--zenza-comment-layer-opacity', commentLayerOpacity);
        }
        this.emitter.emit('update', nextState);
    }
}
//===END===
export {
  VariablesMapper
};

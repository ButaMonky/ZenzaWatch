import {ZenzaWatch, global} from './ZenzaContext';
import {CONSTANT} from './constant';
import {Config} from './Config';
import {UaaLoader} from '../packages/lib/src/nico/loader';
import {RelatedVideoList} from '../packages/zenza/src/Playlist/RelatedVideoList';
import {TagListView} from './TagListView';
import {parseVideoSearchSortValue, NicoSearchApiV2Loader} from '../packages/lib/src/nico/VideoSearch';
import {TagSuggestLoader} from '../packages/lib/src/nico/TagSuggestLoader';
import {ThumbInfoLoader} from '../packages/lib/src/nico/ThumbInfoLoader';
import {BaseViewComponent} from '../packages/zenza/src/parts/BaseViewComponent';
import {Emitter} from '../packages/lib/src/Emitter';
import {sleep} from '../packages/lib/src/infra/sleep';
import {Fullscreen} from '../packages/lib/src/dom/Fullscreen';
import {textUtil} from '../packages/lib/src/text/textUtil';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
import {css, cssUtil} from '../packages/lib/src/css/css';
import {uq} from '../packages/lib/src/uQuery';
import {domEvent} from '../packages/lib/src/dom/domEvent';
import {ClassList} from '../packages/lib/src/dom/ClassListWrapper';
import {MylistPocketDetector} from '../packages/zenza/src/init/MylistPocketDetector';
import {RelatedMenuActions} from '../packages/zenza/src/menu/RelatedMenuActions';
import {RelatedMenuOrder} from './RelatedMenuOrder';
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
import {OfficialPlayerRoute} from '../packages/zenza/src/menu/OfficialPlayerRoute';
const VideoItemObserver = {
  observe: () => {}
};
// GENERATED FROM tools/typescript-stage1/nico-src/VideoMetaInfo.ts (Task1063). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class VideoMetaInfo extends BaseViewComponent {
    constructor({ parentNode }) {
        super({
            parentNode,
            name: 'VideoMetaInfo',
            template: '<div class="VideoMetaInfo"></div>',
            shadow: VideoMetaInfo._shadow_,
            css: VideoMetaInfo.__css__
        });
        this._state = {};
        this._bound.update = this.update.bind(this);
    }
    _initDom(...args) {
        super._initDom(...args);
        const shadow = this._shadow || this._view;
        this._elm = Object.assign({}, this._elm, {
            postedAt: shadow.querySelector('.postedAt'),
            body: shadow.querySelector('.videoMetaInfo'),
            viewCount: shadow.querySelector('.viewCount'),
            commentCount: shadow.querySelector('.commentCount'),
            mylistCount: shadow.querySelector('.mylistCount'),
            likeCount: shadow.querySelector('.likeCount'),
            likeColumn: shadow.querySelector('.likeColumn')
        });
    }
    update(videoInfo) {
        this._elm.postedAt.textContent = new Date(videoInfo.postedAt).toLocaleString();
        this._elm.likeColumn.hidden = true;
        this._elm.likeCount.textContent = '';
        this._elm.likeCount.title = '';
        const count = videoInfo.count;
        this.updateVideoCount(count);
    }
    updateVideoCount(count) {
        for (const key of ['comment', 'view', 'mylist', 'like']) {
            // Comment-only refreshes must preserve likes; full video changes reset them.
            if (!Object.prototype.hasOwnProperty.call(count, key)) {
                continue;
            }
            const value = count[key];
            // Dialog expands a comment-only event with view/mylist: undefined.
            // Undefined means no update, not a request to erase existing counts.
            if (value === undefined) {
                continue;
            }
            const valid = Number.isSafeInteger(value) && value >= 0;
            const element = this._elm[`${key}Count`];
            if (key === 'like') {
                this._elm.likeColumn.hidden = !valid;
            }
            element.textContent = valid ? value.toLocaleString() : '';
            element.title = valid ? value.toLocaleString() : '';
        }
    }
}
VideoMetaInfo._css_ = ('').trim();
VideoMetaInfo._shadow_ = (`
    <style>
      .VideoMetaInfo .postedAtOuter {
        display: inline-block;
        margin-right: 24px;
      }
      .VideoMetaInfo .postedAt {
        font-weight: bold
      }

      .VideoMetaInfo .countOuter {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0 8px;
      }

      .VideoMetaInfo .countOuter .column {
        display: inline-flex;
        gap: 4px;
        white-space: nowrap;
      }

      .VideoMetaInfo .column[hidden] { display: none; }

      .VideoMetaInfo .count {
        font-weight: bolder;
      }

      .userVideo .channelVideo,
      .channelVideo .userVideo
      {
        display: none !important;
      }

      :host-context(.userVideo) .channelVideo,
      :host-context(.channelVideo) .userVideo
      {
        display: none !important;
      }

    </style>
    <div class="VideoMetaInfo root">
      <span class="postedAtOuter">
        <span class="userVideo">投稿日:</span>
        <span class="channelVideo">配信日:</span>
        <span class="postedAt"></span>
      </span>

      <span class="countOuter">
        <span class="column"><span>再生:</span><span class="count viewCount"></span></span>
        <span class="column"><span>コメント:</span><span class="count commentCount"></span></span>
        <span class="column"><span>マイリスト:</span><span class="count mylistCount"></span></span>
        <span class="column likeColumn" hidden><span>いいね:</span><span class="count likeCount"></span></span>
      </span>
    </div>
  `);
//===END===
export {
  VideoMetaInfo
};

/**
 * Canonical TypeScript source for src/VideoMetaInfo.js (Task1063: VideoInfoPanel.ts から分割).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const BaseViewComponent: typeof import('./BaseViewComponent').BaseViewComponent;
declare const css: typeof import('./css').css;

class VideoMetaInfo extends BaseViewComponent {
  declare static _css_: Loose;
  declare _view: Loose;
  declare _shadow: Loose;
  declare _bound: Loose;
  declare static __css__: Loose;
  declare static _shadow_: Loose;
  declare _elm: Loose;
  declare _state: Loose;
  constructor({parentNode}: Loose) {
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

  _initDom(...args: [Loose]) {
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

  update(videoInfo?: Loose) {
    this._elm.postedAt.textContent = new Date(videoInfo.postedAt).toLocaleString();
    this._elm.likeColumn.hidden = true;
    this._elm.likeCount.textContent = '';
    this._elm.likeCount.title = '';
    const count = videoInfo.count;
    this.updateVideoCount(count);
  }

  updateVideoCount(count?: Loose) {
    for (const key of ['comment', 'view', 'mylist', 'like']) {
      // Comment-only refreshes must preserve likes; full video changes reset them.
      if (!Object.prototype.hasOwnProperty.call(count, key)) { continue; }
      const value = count[key];
      // Dialog expands a comment-only event with view/mylist: undefined.
      // Undefined means no update, not a request to erase existing counts.
      if (value === undefined) { continue; }
      const valid = Number.isSafeInteger(value) && value >= 0;
      const element = this._elm[`${key}Count`];
      if (key === 'like') { this._elm.likeColumn.hidden = !valid; }
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

export {
  VideoMetaInfo
};

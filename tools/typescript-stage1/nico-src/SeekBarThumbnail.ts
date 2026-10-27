/**
 * Canonical TypeScript source for packages/zenza/src/storyboard/SeekBarThumbnail.js (Task901).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
/** Libraries and the storyboard worker used here. */
declare const cssUtil: {addStyle(css: string): unknown};
declare const uQuery: Loose;
declare const global: {debug: Loose};
declare const StoryboardWorker: {createThumbnail(params: Loose): Loose};
declare const ClassList: (element: Element) => Loose;
declare const _: {isNumber(v: unknown): v is number};

class SeekBarThumbnail {
  declare _container: Loose;
  declare _currentTime: Loose;
  declare _model: Loose;
  declare _scale: Loose;
  declare _view: Loose;
  declare classList: Loose;
  declare isAvailable: Loose;
  declare thumbnail: Loose;
  declare static BASE_WIDTH: number;
  declare static BASE_HEIGHT: number;
  declare static __tpl__: string;
  declare static __css__: string;
  declare static styleAdded: boolean;
  constructor(params?: Loose) {
    this._container = params.container;
    this._scale = _.isNumber(params.scale) ? params.scale : 1.0;
    this._currentTime = 0;

    params.storyboard.on('reset', this._onStoryboardReset.bind(this));
    params.storyboard.on('update', this._onStoryboardUpdate.bind(this));

    global.debug.seekBarThumbnail = this;
  }
  _onStoryboardUpdate(model?: Loose) {
    this._model = model;
    if (!model.isAvailable) {
      this._onStoryboardReset();
      return;
    }

    if (this.thumbnail) {
      // Task901 (SEEKBARTHUMB-SETINFO-UNHANDLED-001): after a failed worker setup every setInfo
      // rejects; catch it like the reset path instead of leaking an unhandled rejection.
      Promise.resolve(this.thumbnail.setInfo(model.rawData))
        .catch((err: unknown) => console.warn('SeekBarThumbnail setInfo failed', err));
    } else {
      this.initializeView(model);
    }
    // this.thumbnail.resize({width: model.cellWidth, height: model.cellHeight});

    this.isAvailable = true;
    this.show();
  }
  _onStoryboardReset() {
    this.isAvailable = false;
    this._model = null;
    this.hide();
    // Also clear the worker model, so an old thumbnail cannot be reused.
    if (this.thumbnail) {
      Promise.resolve(this.thumbnail.setInfo(null)).catch(() => {});
    }
  }
  get isVisible() {
    return this._view ? this.classList.contains('is-visible') : false;
  }
  show() {
    if (!this._view) {
      return;
    }
    this.classList.add('is-visible');
  }
  hide() {
    if (!this._view) {
      return;
    }
    this.classList.remove('is-visible');
  }
  initializeView(model?: Loose) {
    if (this.thumbnail) { return; }

    if (!SeekBarThumbnail.styleAdded) {
      cssUtil.addStyle(SeekBarThumbnail.__css__);
      SeekBarThumbnail.styleAdded = true;
    }
    const view = this._view = uQuery.html(SeekBarThumbnail.__tpl__)[0];
    this.classList = ClassList(view);

    this.thumbnail = StoryboardWorker.createThumbnail({
      container: view.querySelector('.zenzaSeekThumbnail-image'),
      canvas: view.querySelector('.zenzaSeekThumbnail-thumbnail'),
      info: model.rawData,
      name: 'StoryboardThumbnail'
    });

    if (this._container) {
      this._container.append(view);
    }
  }
  set currentTime(sec: Loose) {
    this._currentTime = sec;
    if (!this.isAvailable || !this.thumbnail) {
      return;
    }
    this.thumbnail.currentTime = sec;
  }

}
SeekBarThumbnail.BASE_WIDTH = 160;
SeekBarThumbnail.BASE_HEIGHT = 90;

SeekBarThumbnail.__tpl__ = (`
  <div class="zenzaSeekThumbnail">
    <div class="zenzaSeekThumbnail-image"><canvas width="160" height="90" class="zenzaSeekThumbnail-thumbnail"></canvas></div>
  </div>
`).trim();

SeekBarThumbnail.__css__ = (`
  .is-error .zenzaSeekThumbnail,
  .is-loading .zenzaSeekThumbnail {
    display: none !important;
  }

  .zenzaSeekThumbnail {
    display: none;
    pointer-events: none;
  }

  .zenzaSeekThumbnail-image {
    width: 160px;
    height: 90px;
    opacity: 0.8;
    margin: auto;
    background: #999;
  }

  .enableCommentPreview .zenzaSeekThumbnail {
    width: 100%;
    height: 100%;
    display: none !important;
  }

  .zenzaSeekThumbnail.is-visible {
    display: block;
    overflow: hidden;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.3);
    margin: 0 auto 4px;
    z-index: 100;
  }
`).trim();

export {SeekBarThumbnail};

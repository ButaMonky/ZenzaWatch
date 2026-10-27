/**
 * Canonical TypeScript source for packages/zenza/src/videoPlayer/PipPageThumbnail.js (Task965).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const ThumbnailSourcePolicy: Loose;

const PipPageThumbnail = (() => {
  class Controller {
    declare _imageIndex: Loose;
    declare _imageSources: Loose;
    declare _pipStateTimer: Loose;
    declare _sourcesKey: Loose;
    declare _window: Loose;
    declare activePip: Loose;
    declare config: Loose;
    declare document: Loose;
    declare getContainer: Loose;
    declare getVideo: Loose;
    declare image: Loose;
    declare nativePipElement: Loose;
    declare overlay: Loose;
    declare state: Loose;
    constructor({document, state, config, getContainer, getVideo}: Loose) {
      this.document = document;
      this._window = document.defaultView || null;
      this._pipStateTimer = null;
      this.state = state;
      this.config = config;
      this.getContainer = getContainer;
      this.getVideo = getVideo;
      this.activePip = null;
      this.overlay = null;
      this.image = null;
      this.nativePipElement = null;
      this._imageSources = [];
      this._imageIndex = 0;
      this._sourcesKey = '';
      this._onEnter = this._onEnter.bind(this);
      this._onLeave = this._onLeave.bind(this);
      this._refresh = this._refresh.bind(this);
      this._checkPipState = this._checkPipState.bind(this);
      // PiP events do not bubble. Capture phase also observes browser-UI PiP.
      document.addEventListener('enterpictureinpicture', this._onEnter, true);
      document.addEventListener('leavepictureinpicture', this._onLeave, true);
      // Chrome may return focus to the page without delivering a usable
      // leavepictureinpicture event (e.g. through its native restore button).
      document.addEventListener('visibilitychange', this._checkPipState);
      if (this._window) {
        this._window.addEventListener('focus', this._checkPipState);
        this._window.addEventListener('pageshow', this._checkPipState);
      }
      state.on('update-videoInfo', this._refresh);
      config.on('update', this._refresh);
    }
    _isPlayerPip(target?: Loose) {
      if (!target || !target.classList) { return false; }
      // The comment PiP's hidden canvas-backed video is different from the
      // original page video, but the page placeholder is the same.
      if (target.classList.contains('zenzaCommentPipVideo')) { return true; }
      if (!target.classList.contains('zenzaWatchVideoElement')) { return false; }
      const root = this.getContainer();
      // HLS can swap the active video reference while the DOM still owns the
      // source video. Only accept a ZenzaWatch-owned player, not other sites'.
      return target === this.getVideo() || !!(root && root.contains(target));
    }

    _getThumbnailUrls() {
      const info = this.state.videoInfo;
      const detail = info && info._videoDetail;
      const rawData = info && info._rawData;
      const thumbnail = rawData && rawData._data &&
        rawData._data.video && rawData._data.video.thumbnail;
      const video = this.getVideo();
      // Task952: share CDN priority and goptim exclusion with MylistPocket,
      // without sharing PiP state, UI, caches or network behaviour.
      const mode = this.config.props.pipPageThumbnailSource === 'legacy' ?
        'legacy' : 'smart';
      const rest = [
        detail && detail.largeThumbnail,
        info && info.largeThumbnail,
        thumbnail && thumbnail.largeUrl,
        rawData && rawData.thumbnailUrl,
        thumbnail && thumbnail.middleUrl,
        info && info.betterThumbnail,
        info && info.thumbnail,
        thumbnail && thumbnail.url,
        this.state.thumbnail,
        video && video.getAttribute('poster')
      ];
      const candidates = ThumbnailSourcePolicy.select(thumbnail, rest, {mode});
      const result: Loose = [];
      for (const raw of candidates) {
        if (typeof raw !== 'string' || !raw.trim()) { continue; }
        try {
          const url = new URL(raw, this.document.baseURI);
          if (/^https?:$/.test(url.protocol) && !result.includes(url.href)) {
            result.push(url.href);
          }
        } catch (_) { /* invalid metadata: try the next candidate */ }
      }
      return result;
    }

    activate(target?: Loose) {
      if (!this._isPlayerPip(target)) { return false; }
      if (this.activePip !== target) {
        this.stop();
        this.activePip = target;
        if (target.classList.contains('zenzaWatchVideoElement')) {
          // An element-bound listener also works if the element is detached.
          this.nativePipElement = target;
          target.addEventListener('leavepictureinpicture', this._onLeave);
        }
        this._startPipStateWatch();
      }
      this._refresh();
      return true;
    }
    _onEnter(event?: Loose) { this.activate(event.target); }
    _onLeave(event?: Loose) {
      if (event.target === this.activePip) { this.stop(); }
    }
    _startPipStateWatch() {
      // Only poll during PiP, and only where the native state API exists.
      // This is a backup for lost events; focus/visibility checks are instant.
      if (this._pipStateTimer !== null || !this._window ||
          typeof this._window.setInterval !== 'function' ||
          this.document.pictureInPictureElement === undefined) { return; }
      this._pipStateTimer = this._window.setInterval(this._checkPipState, 500);
    }
    _checkPipState() {
      if (!this.activePip) { return; }
      const actual = this.document.pictureInPictureElement;
      // An undefined property means an unsupported/test environment.
      // A null property means the browser has returned the video to the page.
      if (actual !== undefined && actual !== this.activePip) {
        this.stop();
      }
    }
    _refresh() {
      if (!this.activePip) { return; }
      // Stale native video elements must not leave an orphan page image.
      if (!this._isPlayerPip(this.activePip)) {
        this.stop();
        return;
      }
      const root = this.getContainer();
      const urls = this._getThumbnailUrls();
      const key = urls.join('\n');
      if (key !== this._sourcesKey) {
        this._sourcesKey = key;
        this._imageSources = urls;
        this._imageIndex = 0;
      }
      if (this.config.props.pipPageThumbnail === false || !root ||
          this._imageIndex >= this._imageSources.length) {
        this._removeOverlay();
        return;
      }
      if (!this.overlay || this.overlay.parentNode !== root) {
        this._removeOverlay();
        const overlay = this.document.createElement('div');
        overlay.className = 'zenzaPipPageThumbnail';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText = 'position:absolute;inset:0;z-index:6;' +
          'pointer-events:none;overflow:hidden;background:#000;';
        root.appendChild(overlay);
        this.overlay = overlay;
      }
      this._showImage(this._imageSources[this._imageIndex]);
    }
    _showImage(url?: Loose) {
      if (this.image && this.image.getAttribute('src') === url) { return; }
      // Each source gets a new element. A late failure from an older source
      // cannot invalidate the next one.
      const image = this.document.createElement('img');
      image.alt = '';
      image.style.cssText = 'display:block;width:100%;height:100%;' +
        'object-fit:contain;';
      // Do not set crossOrigin. <img> may show signed CDN URLs without CORS.
      image.onerror = () => {
        if (this.image !== image) { return; }
        this._imageIndex++;
        if (this._imageIndex < this._imageSources.length) {
          this._showImage(this._imageSources[this._imageIndex]);
        } else {
          this._removeOverlay();
        }
      };
      const previous = this.image;
      this.image = image;
      this.overlay.appendChild(image);
      image.setAttribute('src', url);
      if (previous) {
        previous.onerror = null;
        previous.remove();
      }
    }
    _removeOverlay() {
      if (this.image) { this.image.onerror = null; }
      if (this.overlay) { this.overlay.remove(); }
      this.overlay = this.image = null;
    }
    stop() {
      this.activePip = null;
      if (this._pipStateTimer !== null && this._window) {
        this._window.clearInterval(this._pipStateTimer);
      }
      this._pipStateTimer = null;
      if (this.nativePipElement) {
        this.nativePipElement.removeEventListener(
          'leavepictureinpicture', this._onLeave);
        this.nativePipElement = null;
      }
      this._sourcesKey = '';
      this._imageSources = [];
      this._imageIndex = 0;
      this._removeOverlay();
    }
    dispose() {
      this.stop();
      this.document.removeEventListener('enterpictureinpicture', this._onEnter, true);
      this.document.removeEventListener('leavepictureinpicture', this._onLeave, true);
      this.document.removeEventListener('visibilitychange', this._checkPipState);
      if (this._window) {
        this._window.removeEventListener('focus', this._checkPipState);
        this._window.removeEventListener('pageshow', this._checkPipState);
      }
      if (this.state.off) { this.state.off('update-videoInfo', this._refresh); }
      if (this.config.off) { this.config.off('update', this._refresh); }
    }
  }

  let current: Loose = null;
  return {
    initialize(params?: Loose) {
      if (current) { current.dispose(); }
      return (current = new Controller(params));
    },
    stop() { if (current) { current.stop(); } },
    stopFor(target?: Loose) {
      if (current && current.activePip === target) { current.stop(); }
    },
    activate(target?: Loose) { return !!(current && current.activate(target)); }
  };
})();

export {PipPageThumbnail};

import type {ZenzaHlsEngine, ZenzaHlsReadinessStage, ZenzaHlsReadinessRecord, ZenzaHlsLifetime, ZenzaHlsErrorData} from '../nico-src/HlsLifecycleTypes';
import type {HlsConfigAccess, HlsStorageClient, HlsDebounce} from './HlsStorage';
/** Extracted HLS implementation (Task997); preserve legacy playback/cache behavior. */
// Internal browser/hls.js compatibility records remain loose during extraction.
type Loose = any;

export interface HlsVideoElementDependencies {
  Config: HlsConfigAccess;
  Storage: HlsStorageClient;
  debounce: HlsDebounce;
  throttle: HlsDebounce;
  HLS_JS_URL: string;
  loadLibrary(): Promise<Loose>;
}
export function createHlsVideoElement({Config, Storage, debounce, throttle, HLS_JS_URL, loadLibrary}: HlsVideoElementDependencies): CustomElementConstructor {
  const window = globalThis.window as Loose;
  const console = window.console;
  const existing = window.customElements?.get('zenza-video');
  if (existing) { return existing; }
    const ZenzaVideoElement = (({Hls, throttle}) => {
      // TODO: ニコニコ動画の仕様に依存する部分を切り離して、もう少し汎用的にする

      const PLAYER_MODE = {
        HLS_JS: 'HLS-JS',
        HLS_NATIVE: 'HLS-N',
        DEFAULT: 'N'
      };

      const HLS_ERROR_CODE = {
        ABORT:   MediaError.MEDIA_ERR_ABORTED           + 1000,
        NETWORK: MediaError.MEDIA_ERR_NETWORK           + 1000,
        DECODE:  MediaError.MEDIA_ERR_DECODE            + 1000,
        UNKNOWN: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED + 1000
      };

      // readonly の Event.target を無理やり書き換える (意味ないかも)
      const overrideTarget = (event?: Loose, target?: Loose) => {
        return event;
      };

      let FragmentLoaderClass: Loose;
      const createFragmentLoader = (Hls?: Loose) => {

        const frag2hash = (fragment?: Loose) => {
          const url = fragment.url;
          // 修正前は`this.levels`だったが、frag2hashはアロー関数で、
          // レキシカルなthis（このスクリプトの実行コンテキストではトップ
          // レベルのグローバルオブジェクト）に固定されており、呼び出し方
          // （FragmentLoaderClass.frag2hash(...)等）を変えてもthisは
          // 決して書き換わらない。一方、_onHLSJSManifestParsedが実際に
          // levelsを書き込んでいるのはFragmentLoaderClass（下でこの外側の
          // 変数に代入される）自身なので、そちらを直接参照する必要がある。
          const levels = FragmentLoaderClass && FragmentLoaderClass.levels;

          const match = /\/nicovideo-([a-z0-9]+)_.*\/([\d]+)\/ts\/([\d]+)\.ts/.exec(url);
          if (!match) { return null; }
          const [, videoId, , sn] = match;
          let rel = '';
          if (fragment.levelkey && fragment.levelkey.reluri) {
            const m = /h=(.*?)&/.exec(fragment.levelkey.reluri);
            rel = m ? `-${m[1]}` : '';
          }
          if (levels && levels[fragment.level]) {
            const {width, height, bitrate, attrs} = levels[fragment.level];
            const fps = attrs['FRAME-RATE'] ? `${attrs['FRAME-RATE']}fps` : '(unknown)fps';
            return {hash: `${videoId}-${width}x${height}-${bitrate}bps-${fps}-${sn}${rel}`, videoId};
          }
          return {hash: `${videoId}-${fragment.level}-${sn}${rel}`, videoId};
        };

        const hasCache = async (fragment?: Loose) => {
          const key = frag2hash(fragment);
          return key ? await Storage.hasData(key).catch(() => false) : false;
        };

        const preloadFragment = async (fragment?: Loose, url?: Loose) => {
          const key = frag2hash(fragment);
          if (!key) { return false; }
          // A hint may outlive GC or another tab's clear; confirm persisted presence.
          if (await hasCache(fragment)) { fragment.hasCache = true; return true; }
          fragment.hasCache = false;
          if (fragment.failed >= 3) { return false; }
          const abc = new AbortController();
          const timeout = debounce(() => abc.abort(), 30000);
          timeout();
          try {
            const params = {method: 'GET', credentials: 'include', cache: 'force-cache', signal: abc.signal};
            const request = new Request(url, params as Loose);
            while ((fragment.failed || 0) < 3) {
              const res = await fetch(request, params as Loose).catch((): Response | null => null);
              if (res && res.ok && res.status !== 206) {
                const buffer = await res.arrayBuffer();
                const saved = await Storage.save({...key, meta: {
                  contentLength: buffer.byteLength, sn: fragment.sn, resp: {url},
                  level: fragment.level, total: buffer.byteLength, stats: {}, url
                }}, buffer).catch(() => false);
                fragment.hasCache = saved !== false && saved != null;
                if (fragment.hasCache) { fragment.failed = 0; }
                return fragment.hasCache;
              }
              fragment.failed = (fragment.failed || 0) + 1;
              console.warn('HLS preload request failed');
              if (abc.signal.aborted || (res && res.status >= 400 && res.status < 500)) { break; }
              if (fragment.failed < 3) { await new Promise(resolve => setTimeout(resolve, 3000)); }
            }
            return false;
          } finally { timeout.cancel(); }
        };

        // hls.config.fLoader にはクラスのインスタンスではなく定義を渡す
        // loaderはexportされていないため、Hls.DefaultConfig.loader経由で継承する
        // @see https://github.com/video-dev/hls.js/blob/master/docs/API.md#loader
        let lastFragLoadingTime = 0;
        let BLOCK_INTERVAL = 3000;
        class FragmentLoader extends Hls.DefaultConfig.loader {
          declare _config: Loose;
          declare _isAborted: Loose;
          declare _isDestroyed: Loose;


          constructor(config?: Loose) {
            super(config);
            this._config = config;
            this._isAborted = false;
            this._isDestroyed = false;
            Storage.gc();
          }

          /***
           *
           * @param {{url: string, frag: fragment, responseType: string, progressData: boolean}} context
           * @param config
           * @param {{onSuccess: function, onError: function, onTimout: function, onProgress: function}} callbacks
           * @returns {*}
           */
          async load(context?: Loose, config?: Loose, callbacks?: Loose) {
            if (!context.frag || !/\.(ts|cmfa|cmfv)/.test(context.url)) {
              window.console.info('HLS fragment uses default loader');
              return super.load(context, config, callbacks);
            }

            if (/\.cmf(a|v)/.test(context.url)) {
              return super.load(context, config, callbacks);
            }

            const frag = context.frag;
            const level = frag.level;

            const key = frag2hash(frag);
            if (!key) { return super.load(context, config, callbacks); }
            const {hash, videoId} = key;

            const {onSuccess, onError} = callbacks;
            if (!context.rangeStart && !context.rangeEnd) {

              callbacks.onSuccess = async (resp?: Loose, stats?: Loose, context?: Loose, details: Loose = null) => {
                const status = details instanceof XMLHttpRequest ? details.status : 200;

                if (status === 206
               //     buffer.byteLength !== contentLength
                ) {
                  console.warn('CONTENT LENGTH MISMATCH!', resp.data.slice().length, frag.loaded);//, contentLength);
                } else if (Config.get('enable_db_cache') && !window.Prototype) {
                  const buffer = resp.data.slice();
                  frag.hasCache = false;
                  Storage.save({
                    hash,
                    videoId,
                    meta: {
                      contentLength: context.frag.loaded,
                      sn: context.frag.sn,
                      resp: {
                        url: resp.url
                      },
                      level,
                      total: context.frag.loaded,
                      stats,
                      url: context.url
                    }
                  }, buffer).then(saved => {
                    if (!this._isAborted && !this._isDestroyed) {
                      frag.hasCache = saved !== false && saved != null;
                    }
                  }).catch(() => console.warn('HLS cache write failed'));
                }

                onSuccess(resp, stats, context, details);
              };

              // prototype.js のあるページでは動かないどころかブラクラ化する
              if (Config.get('enable_db_cache')) {
                // console.log('***load', hash, Config.get('enable_db_cache'),window.Prototype);
                const [meta, buffer] = await Storage.load({hash}).catch((): Loose => [null, null]) || [null, null];
                if (this._isAborted || this._isDestroyed) { return; }
                // console.log('cache?', !!meta, hash);
                if (meta && buffer && typeof buffer.slice === 'function') {
                  frag.hasCache = true;
                  Storage.touch({hash}).catch(() => console.warn('HLS cache touch failed'));
                  onSuccess({url: meta.url, data: buffer }, meta.stats, context, null);
                  return;
                }
              }
            }

            callbacks.onError = (resp?: Loose /* = {code, text} */, context?: Loose, xhr?: Loose) => {
              if (this._isAborted) {
                console.warn('HLS fragment failed after abort');
                onError({code: 0, text: `error after aborted ${resp.code}: ${resp.text}`}, context, xhr);
                return;
              }
              onError(resp, context, xhr);
            };

            return this._load(context, config, callbacks, this._config.fragLoadingMaxRetry);
          }

          /**
           * バッドノウハウの塊
           * シーク連打などで短時間に多量のアクセスがあると弾かれるようになるため、
           * クライアント側でウェイトをかける。
           */
          _load(context?: Loose, config?: Loose, callbacks?: Loose, maxRetry: Loose = 3) {
            if (this._isDestroyed) {
              return;
            }
            const now = performance.now();
            const timeDiff = now - lastFragLoadingTime;

            const sn = context.frag.sn; // ts の番号が入ってる

            if (!this._isBoostTime(sn) && timeDiff < BLOCK_INTERVAL) {
              if (maxRetry > 0) {
                setTimeout(() => {
                    if (this._isAborted) { return; }
                    this._load(context, config, callbacks, maxRetry - 1);
                  },
                  Math.max(
                    this._config.fragLoadingRetryDelay, BLOCK_INTERVAL - timeDiff)
                );
              } else {
                callbacks.onError(
                  {code: 429, text: 'Too Many Requests(blocked)'},
                  context,
                  {status: 429, statusText: ''}
                );
              }
              return;
            }

            lastFragLoadingTime = now;
            super.load(context, config, callbacks);
          }

          abort() {
            this._isAborted = true;
            super.abort();
          }

          destroy() {
            this._isDestroyed = true;
            this._isAborted = true;
            super.destroy();
          }

          // 再生開始直後だけは自粛したくないタイム
          _isBoostTime(sn?: Loose) {
            return sn <= 3;
          }

        }


        FragmentLoaderClass = FragmentLoader;
        FragmentLoaderClass.frag2hash = frag2hash;
        FragmentLoaderClass.hasCache = hasCache;
        FragmentLoaderClass.preloadFragment = preloadFragment;
        return FragmentLoaderClass;
      };
      /** @param  */
      const objectUrlMap = {}; // {url: ObjectURL, time: number}
      const keyclean = () => {
        const keys = Object.keys(objectUrlMap)
          .sort((a, b) => (a as Loose).time - (b as Loose).time);
        while (keys.length > 100) {
          const key = keys.shift();
          URL.revokeObjectURL((objectUrlMap as Loose)[key].url);
          delete (objectUrlMap as Loose)[key];
        }
      };
      const overrideKeyloader = (hls?: Loose) => {
        const keyloader = hls.coreComponents.find((h?: Loose) => h.hasOwnProperty('decryptkey'));
        if (!keyloader) {
          console.warn('keyloader not founnd', hls.coreComponents);
          return;
        }
        keyloader.onKeyLoading_org = keyloader.onKeyLoading.bind(keyloader)
        keyloader.onKeyLoading = function(this: Loose, data?: Loose) {
          const uri = data.frag.decryptdata.uri;
          const objUrl = (objectUrlMap as Loose)[uri].url;
          if (objUrl) {
            data.frag.decryptdata.uri = objUrl;
          }
          return this.onKeyLoading_org(data);

        }.bind(keyloader);

        keyloader.loadsuccess_org = keyloader.loadsuccess.bind(keyloader);
        keyloader.loadsuccess = function(this: Loose, response?: Loose, stats?: Loose, context?: Loose) {
          if (this.decrypturl.startsWith('blob')) {
            return this.loadsuccess_org(response, stats, context);
          }
          const blob = new Blob([new DataView(response.data)]);
          (objectUrlMap as Loose)[this.decrypturl] =
            {url: URL.createObjectURL(blob), time: Date.now()};
          keyclean();
          return this.loadsuccess_org(response, stats, context);
        }.bind(keyloader);

      };

      let idCounter = 0;

      const parseUrl = (url?: Loose) => {
        const a = document.createElement('a');
        a.href = url;
        return a;
      };

      const compareHash = (url1?: Loose, url2?: Loose) => {
        console.log('compareHash\n"%s"\n"%s"', parseUrl(url1).search, parseUrl(url2).search);
        return parseUrl(url1).search === parseUrl(url2).search;
      };

      // The global type-only contract is shared with negative lifetime tests.
      type HlsStartupEngine = ZenzaHlsEngine;

      class ZenzaVideoElement extends HTMLElement {
        declare buffered: Loose;
        declare _bufferStats: Loose;
        declare _error: Loose;
        declare _error429Count: Loose;
        declare _eventWrapperMap: Loose;
        declare _fragmentLoader: Loose;
        declare _hls: HlsStartupEngine | null;
        declare _hlsConfig: Loose;
        declare _id: Loose;
        declare _isBufferCompleted: Loose;
        declare _isForbidden403: Loose;
        declare _isSeeking: Loose;
        declare _isStalledBy403: Loose;
        declare _label: Loose;
        declare _lastBandwidthNotify: Loose;
        declare _levelData: Loose;
        declare _manifest: Loose;
        declare _playerMode: Loose;
        declare _readiness: ZenzaHlsReadinessRecord | undefined;
        declare _root: Loose;
        declare _seekingTime: Loose;
        declare _shadow: Loose;
        declare _src: Loose;
        declare _throttledCurrentTime: Loose;
        declare _video: Loose;
        declare _videoCount: number;
        static get template() {
          return `
            <style>
              .root {
                width: 100%; height: 100%;
                display: contents;
              }
              video {
                width: 100%;
                height: 100%;
              }
              .label {
                position: absolute;
                z-index: 100;
                top: 16px;
                right: 32px;
                padding: 0 4px;
                font-size: 14pt;
                color: #000;
                background: #888;
                border: 1px solid #888;
                font-family: 'Arial Black';
                pointer-events: none;
                mix-blend-mode: luminosity;
                transition: 0.2s opacity;
                opacity: 0.5;
              }

              .label:empty {
                opacity: 0 !important;
                transition: none;
              }

              .is-playing .label {
                opacity: 0;
              }

              :host([show-video-label="on"]) .root .label:not(:empty) {
                opacity: 1 !important;
              }

              .label.blink {
                transform: rotateX(360deg);
                transition: 0.4s transform;
              }

            </style>
            <div class="root">
              <video></video>
              <div class="label"></div>
            </div>
          `;
        }

        constructor() {
          super();

          this._src = '';
          this._hls = null;
          this._hlsConfig = {};
          this._videoCount = 0;
          this._id = `id:${idCounter++}`;
          this._bufferStats = [];

          this._playerMode = PLAYER_MODE.DEFAULT;
          this._eventWrapperMap = new Map();

          const shadow = this._shadow = this.attachShadow({mode: 'open'});
          shadow.innerHTML = (this.constructor as Loose).template;

          const root = this._root = shadow.querySelector('.root');
          const video = this._video = root.querySelector('video');
          this._label = root.querySelector('.label');

          // Register before bridged player listeners so recoverable native errors stay local.
          video.addEventListener('error', (event?: Loose) => this._onNativeHLSError(event));

          video.addEventListener('playing', () => {
            root.classList.add('is-playing');
            this.label = `${this.playerMode}: ${this._video.videoWidth}x${this._video.videoHeight}`;
          });

          video.addEventListener('pause', () => {
            root.classList.remove('is-playing');
          });

          // Task188（HLS追補C）: manifest解析・実メディアのcanplay・最初のplaying・時刻進行・最初の映像を区別して記録する
          ['canplay', 'playing', 'timeupdate', 'loadeddata'].forEach(name =>
            video.addEventListener(name, (event?: Loose) => this._onMediaReadinessEvent(event)));

          this._throttledCurrentTime = throttle((sec?: Loose) => {
            this._isSeeking = false;
            this._video.currentTime = sec;
          }, 500);

          this._resetPlayingStatus();

          this._bridgeProps(video, [
            'autoplay',
            'buffered',
            'crossOrigin',
            'controls',
            'controlslist',
            'currentSrc',
            //'currentTime',
            'defaultMuted',
            'defaultPlaybackRate',
            'duration',
            'ended',
            'loop',
            'muted',
            'networkState',
            'paused',
            'playbackRate',
            'played',
            'playsinline',
            'poster',
            'preload',
            'readyState',
            'seekable',
            //'seeking',
            'videoHeight',
            'videoWidth',
            'volume',

            'tagName',

            'fastSeek',
            'getVideoPlaybackQuality',
            'pause',
            //'play',
            'unload',
            'requestPictureInPicture'
          ]);
        }

        play() {
          if (this._isStalledBy403) {
            return Promise.reject(new DOMException('SessionClosedError'));
          }
          return this._video.play().catch((e?: Loose) => {
            //if (this._isForbidden403) {
            //  return Promise.reject(new DOMException('SessionClosedError'));
            //}
            return Promise.reject(e);
          });
        }

        get shadow() {
          return this._shadow;
        }

        get drawableElement() {
          // 使用例
          // ctx.drawImage(video.drawableElement || video, 0, 0);
          return this._video;
        }

        get currentTime() {
          if (this._isSeeking) {
            return this._seekingTime;
          }
          return this._video.currentTime;
        }

        set currentTime(v: Loose) {
          if (this.playerMode === PLAYER_MODE.HLS_JS &&
            this._hlsConfig.autoStartLoad === false) {
            if (this._hls) { this._hls.startLoad(v); }
            return;
          }

          this._seekingTime = v;
          if (this.isInBuffer(v)) {
            // シーク先がバッファ内にある時は即反映
            this._isSeeking = false;
            this._throttledCurrentTime.cancel();
            this._video.currentTime = v;
          } else {
            // シーク連打時のネットワークアクセス抑制
            this._isSeeking = true;
            this._throttledCurrentTime(v);
            this.dispatchEvent(new Event('seeking'));
          }
        }

        isInBuffer(sec?: Loose) {
          if (sec < this.currentTime) { return true; }
          const range = this.buffered;
          if (!range || !range.length) {
            return false;
          }
          try {
            for (let i = 0, len = range.length; i < len; i++) {
              const start = range.start(i);
              const end   = range.end(i);
              if (start <= sec && end >= sec) {
                return true;
              }
            }
          } catch(e) {
            console.error(e);
          }
          return false;
        }

        get seeking() {
          return this._isSeeking || this._video.seeking;
        }

        get src() {
          return this._src;
        }

        set src(v: Loose) {
          const videoCount = ++this._videoCount;
          this._resetPlayingStatus();
          if (v === '' || v === '//') {
            this._src = '';
            this._destroyHLSJS();
            if (this._videoCount !== videoCount) { return; }
            this._video.src = '';
            this.playerMode = PLAYER_MODE.DEFAULT;
            return;
          }

          if (/\.m3u8(|\?.*?)$/.test(v)) {
            if (this._useNativeHLS) {
              this._destroyHLSJS();
              if (this._videoCount !== videoCount) { return; }
              this._src = v;
              this.playerMode = PLAYER_MODE.HLS_NATIVE;
              this._video.src = v;
              return;
            }
            this._initHLSJS(v);
            // An init/load hook can synchronously replace or clear the source.
            if (this._videoCount !== videoCount) { return; }

            this._src = v;
            this.playerMode = PLAYER_MODE.HLS_JS;
            return;
          }

          this._destroyHLSJS();
          if (this._videoCount !== videoCount) { return; }
          this._src = v;
          this.playerMode = PLAYER_MODE.DEFAULT;
          this._video.src = v;
        }

        canPlayType(type?: Loose) {
          switch(type) {
            case 'application/x-mpegURL':
            case 'vnd.apple.mpegURL':
              return Hls?.isSupported?.() ? 'maybe' : this._video.canPlayType(type);
            default:
              return this._video.canPlayType(type);
          }
        }

        get error() {
          return this._error || this._video.error;
        }

        load() {
          if (this.playerMode === PLAYER_MODE.HLS_JS) {
            return;
          }
          this._video.load();
        }

        disconnectedCallback() {
          ++this._videoCount;
          this._throttledCurrentTime.cancel();
          this._isSeeking = false;
          this._seekingTime = this._video.currentTime;
          this._destroyHLSJS();
          for (const [func, events] of this._eventWrapperMap.entries()) {
            for (const [eventName, captures] of events.entries()) {
              for (const capture of [...captures.keys()]) {
                this.removeEventListener(eventName, func, capture);
              }
            }
          }
          this._eventWrapperMap.clear();
        }

        setAttribute(attr?: Loose, value?: Loose) {
          this._video.setAttribute(attr, value);
          super.setAttribute(attr, value);
        }

        removeAttribute(attr?: Loose) {
          this._video.removeAttribute(attr);
          super.removeAttribute(attr);
        }

        getAttribute(attr?: Loose) {
          return this._video.getAttribute(attr);
        }

        addEventListener(eventName?: Loose, callback?: Loose, options: Loose = false) {
          if (!callback) { return; }
          const capture = typeof options === 'boolean' ? options : !!options?.capture;
          if (options && options.signal && options.signal.aborted) { return; }
          const events = this._eventWrapperMap.get(callback) || new Map();
          const captures = events.get(eventName) || new Map();
          if (captures.has(capture)) { return; }
          const wrapper = (event?: Loose) => {
            if (options && options.once) { this.removeEventListener(eventName, callback, {capture}); }
            const forwarded = overrideTarget(event, this);
            if (typeof callback === 'function') { callback.call(this, forwarded); }
            else { callback.handleEvent(forwarded); }
          };
          const abort = () => this.removeEventListener(eventName, callback, {capture});
          captures.set(capture, {wrapper, signal: options && options.signal, abort});
          events.set(eventName, captures);
          this._eventWrapperMap.set(callback, events);
          super.addEventListener(eventName, wrapper, options);
          this._video.addEventListener(eventName, wrapper, options);
          if (options && options.signal) { options.signal.addEventListener('abort', abort, {once: true}); }
        }

        removeEventListener(eventName?: Loose, callback?: Loose, options: Loose = false) {
          const capture = typeof options === 'boolean' ? options : !!options?.capture;
          super.removeEventListener(eventName, callback, {capture});
          this._video.removeEventListener(eventName, callback, {capture});
          const events = this._eventWrapperMap.get(callback);
          const captures = events && events.get(eventName);
          const entry = captures && captures.get(capture);
          if (!entry) { return; }
          super.removeEventListener(eventName, entry.wrapper, {capture});
          this._video.removeEventListener(eventName, entry.wrapper, {capture});
          if (entry.signal) { entry.signal.removeEventListener('abort', entry.abort); }
          captures.delete(capture);
          if (!captures.size) { events.delete(eventName); }
          if (!events.size) { this._eventWrapperMap.delete(callback); }
        }

        _bridgeProps(obj?: Loose, props: Loose = []) {
          props.forEach((prop?: Loose) => {
            if (!(prop in obj)) {
              return;
            }
            if (typeof obj[prop] === 'function') {
              (this as Loose)[prop] = (...args: Loose[]) => {
                return obj[prop](...args);
              };
            } else {
              Object.defineProperty(this, prop, {
                get() { return obj[prop]; }, set(v) { obj[prop] = v; }
              });
            }
          });
        }

        _resetPlayingStatus() {
          this._error = null;
          this._isForbidden403 = false;
          this._isStalledBy403 = false;
          this._error429Count = 0;
          this._seekingTime = 0;
          this._isSeeking = false;
          this._isBufferCompleted = false;
          this._throttledCurrentTime.cancel();
          this._bufferStats = [];
          this._resetReadiness();
        }

        // Task188（HLS追補C）: 「再生可能」の判定を段階に分ける。manifestReadyはhls.jsがmanifestを読めただけで、
        // 映像の復号・再生の成功を意味しない（互換のためにloadedmetadata/canplayは引き続き合成するが、
        // それはsynthetic=trueとして区別する）。実再生の確認は mediaCanPlay と firstProgress/firstFrame で行う。
        _resetReadiness() {
          this._readiness = {
            manifestReady: false, mediaCanPlay: false, firstPlaying: false, firstProgress: false, firstFrame: false,
            origin: ZenzaVideoElement.now(), at: {}, playingTime: null
          };
        }

        static now() {
          return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        }

        _markReadiness(stage: ZenzaHlsReadinessStage) {
          const r = this._readiness;
          if (!r || r[stage]) { return false; }
          r[stage] = true;
          r.at[stage] = Math.round(ZenzaVideoElement.now() - r.origin);
          this.dispatchEvent(new CustomEvent('zenza-readiness', {detail: {stage, mode: this.playerMode, ms: r.at[stage]}}));
          if (stage === 'firstProgress' || stage === 'firstFrame') {
            // 秒数と段階名だけを出す（URL・キー・識別子は出さない）
            console.info('[Zenza] playback readiness', this.playerMode, JSON.stringify(r.at));
          }
          return true;
        }

        _onMediaReadinessEvent(event?: Loose) {
          const video = this._video;
          if (!video || !this._readiness) { return; }
          switch (event && event.type) {
            case 'canplay':
              // 実メディアのcanplay（readyState>=HAVE_FUTURE_DATA）だけを数える
              if (video.readyState >= 3) { this._markReadiness('mediaCanPlay'); }
              break;
            case 'playing':
              if (this._markReadiness('firstPlaying')) { this._readiness.playingTime = video.currentTime; }
              break;
            case 'timeupdate': {
              const r = this._readiness;
              if (r.firstPlaying && !video.paused && !video.seeking && video.readyState >= 2 &&
                  Number.isFinite(video.currentTime) && video.currentTime > r.playingTime) {
                this._markReadiness('firstProgress');
              }
              break;
            }
            case 'loadeddata':
              if (video.readyState >= 2 && video.videoWidth > 0) { this._markReadiness('firstFrame'); }
              break;
          }
        }

        get readiness() {
          const r: Partial<ZenzaHlsReadinessRecord> = this._readiness || {};
          return {
            manifestReady: !!r.manifestReady, mediaCanPlay: !!r.mediaCanPlay, firstPlaying: !!r.firstPlaying,
            firstProgress: !!r.firstProgress, firstFrame: !!r.firstFrame,
            isMediaPlaying: !!(r.mediaCanPlay && (r.firstProgress || r.firstFrame)),
            at: {...(r.at || {})}
          };
        }

        _onNativeHLSError(event?: Loose) {
          const code = this._video.error?.code;
          const canRetry = Hls ? Hls.isSupported?.() : !!(window.MediaSource || window.ManagedMediaSource);
          if (this.playerMode !== PLAYER_MODE.HLS_NATIVE ||
              ![3, 4].includes(code) || this._video.currentTime !== 0 || !canRetry) {
            return false;
          }
          // canPlayType is only a hint: some browsers reject the actual HLS stream.
          // Switching mode before initialization permits one fallback per source.
          this.playerMode = PLAYER_MODE.HLS_JS;
          this._resetPlayingStatus();
          // Task173: stop the native load first so the two engines do not read the
          // same delivery session concurrently. (The session itself is not renewed here.)
          this._video.removeAttribute?.('src');
          try {
            this._initHLSJS(this._src);
          } catch (_) {
            return false;
          }
          event.stopImmediatePropagation();
          return true;
        }

        get _useNativeHLS() {
          if (!this._video.canPlayType('application/x-mpegURL')) {
            return false;
          }
          const preference = this.getAttribute('use-native-hls');
          if (preference === 'force') {
            return true;
          }
          // Task173: when hls.js/MSE can play the stream, do not let native HLS consume the
          // delivery session first. A later hls.js re-fetch of the same signed key URL was
          // observed to return a different key for the same encrypted fragment.
          return preference === 'yes' && !(typeof Hls !== 'undefined' && Hls.isSupported());
        }

        set playerMode(v: Loose) {
          this._playerMode = v;
          this.label = v;
          super.setAttribute('data-player-mode', v);
        }

        get playerMode() {
          return this._playerMode;
        }

        get label() {
          return this._label.textContent;
        }

        set label(v: Loose) {
          if (this._label.textContent === v) { return; }
          this._label.textContent = v;
        }

        get hlsConfig() {
          return this._hlsConfig;
        }

        set hlsConfig(config: Loose) {
          // Queue a complete snapshot for the next engine. Changing a live hls.config
          // cannot reliably reconfigure its controllers and must not interrupt playback.
          this._hlsConfig = Object.assign({}, this._hlsConfig, config);
        }

        get hls() {
          return this._hls;
        }

        _destroyHLSJS() {
          const hls: HlsStartupEngine | null = this._hls;
          if (hls) {
            // Release ownership before engine callbacks can install a replacement.
            this._hls = null;
            if (this._fragmentLoader) {
              delete this._hlsConfig.fLoader;
              delete this._fragmentLoader;
            }
            try {
              hls.stopLoad();
            } finally {
              try {
                hls.detachMedia();
              } finally {
                hls.destroy();
              }
            }
          }
        }

        _initHLSJS(src: string) {
          const videoCount = this._videoCount;
          this._destroyHLSJS();
          if (this._videoCount !== videoCount) { return this._hls; }
          if (!Hls) {
            // Keep the established synchronous startup when the library is ready.
            // A new src/clear/disconnect owns a new count and cancels this continuation.
            const isCurrent = () => this._videoCount === videoCount && this._src === src;
            void Promise.resolve().then(() => loadLibrary()).then(library => {
              Hls = library;
              if (!isCurrent()) { return; }
              if (!Hls) { throw new Error('HLS library unavailable'); }
              this._initHLSJS(src);
            }).catch(() => {
              if (!isCurrent()) { return; }
              this._error = {code: HLS_ERROR_CODE.NETWORK, message: 'HLS playback could not be started'};
              this.dispatchEvent(overrideTarget(new ErrorEvent('error'), this));
            });
            return null;
          }

          if (!this._hls) {
            this._fragmentLoader = createFragmentLoader(Hls);
            this._hlsConfig.fLoader = this._fragmentLoader;
            const hls: HlsStartupEngine = new Hls(Object.assign({}, this._hlsConfig));
            this._hls = hls;
            let lifetime:ZenzaHlsLifetime={phase:'active',engine:hls};
            const owned=(listener:(...args:unknown[])=>void)=>(...args:unknown[]):void=>{
              if(lifetime.phase!=='active'||this._hls!==lifetime.engine||this._videoCount!==videoCount)return;
              listener(...args);
            };

            try {
              // The public init hook also exposes destroy() directly.
              hls.on(Hls.Events.DESTROYING, () => {
                lifetime={phase:'disposed',engine:null};
                if (this._hls !== hls) { return; }
                this._hls = null;
                delete this._hlsConfig.fLoader;
                delete this._fragmentLoader;
              });
              hls.on(Hls.Events.MANIFEST_PARSED,
                owned(this._onHLSJSManifestParsed.bind(this)));
              hls.on(Hls.Events.LEVEL_LOADED,
                owned(this._onHLSJSLevelLoaded.bind(this)));
              hls.on(Hls.Events.LEVEL_SWITCHED,
                owned(this._onHLSJSLevelSwitched.bind(this)));
              hls.on(Hls.Events.ERROR,
                owned(this._onHLSJSError.bind(this)));
              hls.on(Hls.Events.FRAG_LOADED,
                owned(this._onHLSJSFragLoaded.bind(this)));
              hls.on(Hls.Events.BUFFER_EOS,
                owned(this._onHLSJSBufferEOS.bind(this)));
              this.dispatchEvent(new CustomEvent('init-hls-js', {detail: {hls}}));
              if (this._hls !== hls) { return this._hls; }

              // Fetch the authorized manifest while MediaSource attachment proceeds.
              // startFragPrefetch/ABR/encryption settings remain unchanged.
              hls.loadSource(src);
              if (this._hls === hls) { hls.attachMedia(this._video); }
            } catch (error) {
              if (this._hls === hls) {
                try { this._destroyHLSJS(); } catch (_) { /* Keep the startup error. */ }
              }
              throw error;
            }
          }
          return this._hls;
        }

        _onHLSJSManifestParsed(eventName?: unknown, raw?: unknown) {
          if(!raw||typeof raw!=='object')return;
          const data=raw as Record<string,unknown>;
          if(!Array.isArray(data.levels))return;
          //console.log('%cHls.Events.MANIFEST_PARSED', 'background: cyan;', this._src);
          this._manifest = data;
          this._levelData = [];
          if (this._fragmentLoader) {
            this._fragmentLoader.levels = data.levels;
          }
          this._markReadiness('manifestReady');
          // 互換イベント: 開始待ち・コメント表示等が依存するので残す。ただし実メディアの準備完了ではない
          // （media.readyState=0 / buffered=0でも出る）ので、detail.synthetic=trueで区別できるようにする（Task188）
          const detail = {synthetic: true, stage: 'manifestReady'};
          this.dispatchEvent(new CustomEvent('loadedmetadata', {detail}));
          this.dispatchEvent(new CustomEvent('canplay', {detail}));
        }

        _onHLSJSLevelLoaded(eventName?: unknown, raw?: unknown) {
          if(!raw||typeof raw!=='object')return;
          const data=raw as Record<string,unknown>;
          if(typeof data.level!=='number'||!Number.isSafeInteger(data.level)||data.level<0||
             !data.details||typeof data.details!=='object')return;
          const details=data.details as Record<string,unknown>;
          if(typeof details.endSN!=='number'||!Number.isSafeInteger(details.endSN)||details.endSN<0||details.endSN>0xffffffff)return;
          //console.log('%cHls.Events.LEVEL_LOADED', 'background: cyan;', this._src);//, data);
          this._levelData[data.level] = data.details;
          this._bufferStats.length = details.endSN;
        }

        _onHLSJSLevelSwitched()  {
          const hls = this._hls;
          if(!hls)return;
          const level = hls.levels[hls.currentLevel];

          const labelText = `${this.playerMode}: ${this._video.videoWidth}x${this._video.videoHeight}`;
          if (this.label !== labelText) {
            this.label = labelText;
            this._blinkLabel();
          }

          if (hls.levels.length > 1 && level && typeof level.bitrate === 'number') {
            // Task 079: 以前はここで「切り替わった画質のビットレート×0.8」を
            // abrEwmaDefaultEstimate（次回の最初の画質を決める推定回線速度）へ
            // 書き戻していた。hls.jsは推定速度×0.95以下の画質から始めるため、
            // 次の動画は必ず今回より1段低い画質から始まり、回を重ねるごとに
            // 360p等の低画質へ落ちていく（自動なのに常に低画質になる原因）。
            // 実際に測った回線速度(hls.bandwidthEstimate)を渡す形に変えた。
            this.dispatchEvent(new CustomEvent('levelswitched', {detail: {
              level: hls.currentLevel,
              width: this._video.videoWidth,
              height: this._video.videoHeight,
              bitrate: level.bitrate,
              bandwidth: hls.bandwidthEstimate
            }}));
          }
        }

        _onHLSJSFragBuffered(eventName?: Loose, data?: Loose) {
          const { trequest, tfirst, tbuffered, total} = data.stats;
          const { duration, level, sn } = data.frag;
          const totalTime = tbuffered - trequest;
          const transferKbps = Math.round((total * 8) / ((tbuffered - trequest) - (tfirst - trequest)));
          const dataKbps = Math.round((total * 8) / duration);
          this._bufferStats[sn] = {totalTime, transferKbps, dataKbps, level, sn};
          // console.log('rate', {totalTime, transferKbps, dataKbps, level, sn});
        }

        _blinkLabel() {
          this._label.classList.add('blink');
          setTimeout(() => { this._label.classList.remove('blink'); }, 1000);
        }

        // @see https://github.com/video-dev/hls.js/blob/master/docs/API.md#fifth-step-error-handling
        _onHLSJSError(e?: unknown, raw?: unknown) {
          if(!raw||typeof raw!=='object')return;
          const value=raw as Record<string,unknown>;
          if(typeof value.fatal!=='boolean'||typeof value.type!=='string'||typeof value.details!=='string')return;
          const response=value.response&&typeof value.response==='object'?
            value.response as Record<string,unknown>:null;
          const data:ZenzaHlsErrorData={fatal:value.fatal,type:value.type,details:value.details,
            ...(response&&typeof response.code==='number'?{response:{code:response.code}}:{})};
          if (data.fatal) {
            return this._onHLSJSFatalError(e, data);
          }

          console.info('%cHls.Events.ERROR: WARN', 'background: cyan;',
            this._id,
            data.type,
            `isForbidden403: ${this._isForbidden403}, isStalledBy403: ${this._isStalledBy403}, isSeeking: ${this._isSeeking}`
          );

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              if (this._isBufferCompleted) { return; }
              const code = data.response ? data.response.code : 0;

              if (code === 429) {
                // 短時間でアクセスしすぎると出る
                this._error429Count++;
                // TODO: インターバルを伸ばす？ (そしていつ戻す？)
                //this._hls.config.fragLoadingRetryDelay += 500;
              } else if (code === 403) {
                // 403になるとそのセッションは死ぬ
                console.warn('HLS request forbidden', 403);
                this._isForbidden403 = true;
                //this._hls.stopLoad();
              }
            }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if ([Hls.ErrorDetails.BUFFER_STALLED_ERROR,
                   Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE
                  ].includes(data.details)) {

                // 403でバッファも尽きた時はどうしようもないのでエラー飛ばす
                if (this._isForbidden403) {
                  this._isStalledBy403 = true;
                  const event = new ErrorEvent('error');
                  this._error = {
                    code: HLS_ERROR_CODE.NETWORK,
                    message: `403 Forbidden, ${data.details}`
                  };
                  this.dispatchEvent(overrideTarget(event, this));
                } else {
                 // this.dispatchEvent(new Event('stalled'));
                }
              }
              break;
          }
          return;
        }

        _onHLSJSFatalError(e: unknown, data: ZenzaHlsErrorData) {
          console.error('HLS fatal error');
          let code;
          // サンプルコードではここで自動リカバーしているが、
          // サーバーの障害でエラーが起きてる場合は追加攻撃になりかねないので、やめておく
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              code = HLS_ERROR_CODE.NETWORK;
              if (this._isBufferCompleted) { return; }
              //hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              code = HLS_ERROR_CODE.DECODE;
              //hls.recoverMediaError();
              break;
            default:
              code = HLS_ERROR_CODE.UNKNOWN;
              break;
          }

          const event = new ErrorEvent('error');
          this._error = {
            code: code,
            message: data.details
          };
          this.dispatchEvent(overrideTarget(event, this));
        }

        _onHLSJSFragLoaded() {
          // Task 079: 実測の回線速度を数秒おきに知らせる（次回の最初の画質に使う）
          const hls = this._hls;
          if (!hls || this.dataset.usecase === 'capture') { return; }
          const now = Date.now();
          if (now - (this._lastBandwidthNotify || 0) < 5000) { return; }
          this._lastBandwidthNotify = now;
          const bandwidth = hls.bandwidthEstimate;
          if (typeof bandwidth === 'number' && isFinite(bandwidth) && bandwidth > 0) {
            this.dispatchEvent(new CustomEvent('bandwidthestimate', {detail: {bandwidth}}));
          }
        }

        _onHLSJSBufferEOS() {
          this._isBufferCompleted = true;
          this.dispatchEvent(new CustomEvent('buffercomplete', {detail:
            {src: this._src}
          }));
        }
      }

      if (window.customElements && !window.customElements.get('zenza-video')) {
        window.customElements.define('zenza-video', ZenzaVideoElement);
      }
      if (!Hls) {
        loadLibrary().then(library => { Hls = library; })
          .catch(() => console.warn('HLS library unavailable'));
      } else {
        console.info('hls.js ready:', Hls.version);
      }
      return ZenzaVideoElement;
    })({Hls: window.Hls, throttle});


  return ZenzaVideoElement;
}

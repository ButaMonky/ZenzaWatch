/** HLS settings keep their existing storage keys and defaults. */
type Loose = any;
interface HlsConfigStore {raw: Record<string, Loose>; get(key:string):Loose; set(key:string,value:Loose):void; applySettings(patch:Record<string,unknown>):boolean; on(...args:Loose[]):void;}
const createHlsConfig = (Emitter: Loose, HLS_JS_VERSION: string): {Config:HlsConfigStore;DEFAULT_CONFIG:Record<string,Loose>;settingBounds:Record<string,[number,number]>;nativeHlsPreference:(value?:Loose)=>string;debounce:Loose;throttle:Loose} => {
    // Task173: 'force' = always native HLS; true = native only where hls.js cannot play.
    const nativeHlsPreference = (value?: Loose) => value === 'force' ? 'force' : (value ? 'yes' : 'no');

    const DEFAULT_CONFIG = {
      // hls.js 以外のパラメータ
      segment_duration: 4000, // dmc!
      use_native_hls: true,   // hls.jsが使えない環境でブラウザがHLS対応ならそっちを使う（'force'で常にネイティブ）
      show_video_label: false, //
      autoAbrEwmaDefaultEstimate: true,
      hls_js_ver: HLS_JS_VERSION, // 表示用。読み込む版は HLS_JS_URL に固定（保存された古い値は使わない）

      enable_db_cache: !true,
      cache_expire_time: 6 * 60 * 60 * 1000,

      // 以下、 hls.js 関連

      // Domand動画にはcookiesが必要
      xhrSetup: (xhr?: Loose, url?: Loose) => {
        xhr.withCredentials = true;
        xhr.ontimeout = () => {
          window.console.log('HLS request timeout');
        };
      },

      // なんとなくわかる物
      debug: false, // used by logger
      autoStartLoad: true, // used by stream-controller
      startLevel: -1, // undefined, // used by level-controller
      capLevelOnFPSDrop: false, // used by fps-controller
      capLevelToPlayerSize: false, // used by cap-level-controller
      // Task 079b: hls.js 1.5以降は、ブラウザの MediaCapabilities.decodingInfo() が
      // smooth:false と答えた画質を「自動」の候補から外す。GPUのドライバーが無い／
      // ハードウェアアクセラレーションが無効な環境では、Chromeが60fpsの480p・720p等を
      // 一律 smooth:false と答えるため、回線が十分速くても360p(30fps)に固定されていた
      // （2026-09-19、ユーザーのChrome〔Microsoft Basic Render Driver〕で実測）。
      // CPUでも十分再生できる場合が多いので、この判定を使わない。
      useMediaCapabilities: false, // used by abr-controller
      maxBufferLength: 30, // used by stream-controller
      maxBufferSize: 60 * 1000 * 1000, // used by stream-controller
      maxMaxBufferLength: 600, //600, // used by stream-controller
      minAutoBitrate: 0, // used by hls
      abrEwmaFastVoD: 3, // used by abr-controller
      abrEwmaSlowVoD: 9, // used by abr-controller
      abrEwmaDefaultEstimate: 5e5, // 500 kbps  // used by abr-controller
      abrBandWidthFactor: 0.95, // used by abr-controller
      abrBandWidthUpFactor: 0.7, // used by abr-controller
      abrMaxWithRealBitrate: false, // used by abr-controller
      manifestLoadingTimeOut: 30000, // used by playlist-loader
      manifestLoadingMaxRetry: 3, // used by playlist-loader
      manifestLoadingRetryDelay: 3000, //1000, // used by playlist-loader
      manifestLoadingMaxRetryTimeout: 64000, // used by playlist-loader
      levelLoadingTimeOut: 10000, // used by playlist-loader
      levelLoadingMaxRetry: 4, // used by playlist-loader
      levelLoadingRetryDelay: 3000, //1000, // used by playlist-loader
      levelLoadingMaxRetryTimeout: 64000, // used by playlist-loader
      fragLoadingTimeOut: 20000, // used by fragment-loader
      fragLoadingMaxRetry: 5, //6 // used by fragment-loader
      fragLoadingRetryDelay: 1000, // used by fragment-loader
      fragLoadingMaxRetryTimeout: 64000, // used by fragment-loader

      // よくわからん物
      startPosition: -1, // used by stream-controller
      maxBufferHole: 0.5, // used by stream-controller
      highBufferWatchdogPeriod: 3, // used by stream-controller
      nudgeOffset: 0.1, // used by stream-controller
      nudgeMaxRetry: 3, // used by stream-controller
      maxFragLookUpTolerance: 0.25, // used by stream-controller
      enableWorker: true, // used by demuxer
      enableSoftwareAES: true, // used by decrypter

      startFragPrefetch: false, // used by stream-controller
      fpsDroppedMonitoringPeriod: 5000, // used by fps-controller
      fpsDroppedMonitoringThreshold: 0.2, // used by fps-controller
      appendErrorMaxRetry: 3, // used by buffer-controller
      stretchShortVideoTrack: false, // used by mp4-remuxer
      maxAudioFramesDrift: 1, // used by mp4-remuxer
      forceKeyFrameOnDiscontinuity: true, // used by ts-demuxer
      maxStarvationDelay: 4, // used by abr-controller
      maxLoadingDelay: 4, // used by abr-controller
      emeEnabled: false, // used by eme-controller

      // 生放送関連っぽい物
      abrEwmaFastLive: 3, // used by abr-controller
      abrEwmaSlowLive: 9, // used by abr-controller
      initialLiveManifestSize: 1, // used by stream-controller
      liveSyncDurationCount: 3, // used by stream-controller
      liveMaxLatencyDurationCount: Infinity, // used by stream-controller
      liveSyncDuration: (undefined as Loose), // used by stream-controller
      liveMaxLatencyDuration: (undefined as Loose), // used by stream-controller
      liveDurationInfinity: false, // used by buffer-controller
    };
    (DEFAULT_CONFIG as Loose).clone = (() => {
      return Object.assign({}, DEFAULT_CONFIG);
    });

    // Public controls may change these values only; credentials and loader hooks stay owned here.
    const editableKeys = new Set(['maxBufferLength', 'maxBufferSize', 'maxMaxBufferLength',
      'minAutoBitrate', 'startLevel', 'abrEwmaDefaultEstimate', 'autoAbrEwmaDefaultEstimate',
      'capLevelOnFPSDrop', 'capLevelToPlayerSize', 'show_video_label', 'enable_db_cache', 'debug']);
    const numericBounds: Record<string, [number, number]> = {
      maxBufferLength: [0, 300], maxMaxBufferLength: [0, 1200], maxBufferSize: [0, 1e9],
      minAutoBitrate: [0, 50e6], abrEwmaDefaultEstimate: [0, 50e6], startLevel: [-1, 100],
      startPosition: [-1, Number.MAX_SAFE_INTEGER], cache_expire_time: [0, 365 * 86400000],
      abrBandWidthFactor: [0, 1], abrBandWidthUpFactor: [0, 1], fpsDroppedMonitoringThreshold: [0, 1]
    };
    const invalid = Symbol('invalid HLS setting');
    const validate = (key: string, value: Loose): Loose => {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key)) return invalid;
      const original = (DEFAULT_CONFIG as Loose)[key];
      if (key === 'use_native_hls' && value === 'force') return value;
      if (typeof original === 'boolean') return typeof value === 'boolean' ? value : invalid;
      if (original === undefined && (key === 'liveSyncDuration' || key === 'liveMaxLatencyDuration')) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : invalid;
      }
      if (typeof original !== 'number') return invalid; // Never deserialize executable hooks or version identity.
      if (value === Infinity && original === Infinity) return value;
      if (typeof value !== 'number' || !Number.isFinite(value)) return invalid;
      const [min, max] = numericBounds[key] || [0, Number.MAX_SAFE_INTEGER];
      const bounded = Math.min(max, Math.max(min, value));
      return key === 'startLevel' ? Math.round(bounded) : bounded;
    };
    const reconcile = (config: Record<string, Loose>) => {
      config.maxMaxBufferLength = Math.max(config.maxBufferLength, config.maxMaxBufferLength);
    };
    const Config = (() => {
      const config: Record<string, Loose> = {...DEFAULT_CONFIG}, emitter = new Emitter();
      Object.keys(DEFAULT_CONFIG).forEach(key => {
        try {
          const saved = localStorage[`ZenzaWatch_video.hls.${key}`];
          if (saved) {
            const value = validate(key, JSON.parse(saved));
            if (value !== invalid) config[key] = value;
          }
        } catch (_) { /* unavailable/corrupt persistence must not stop the player */ }
      });
      reconcile(config);
      const publish = (next: Record<string, Loose>) => {
        const changes = Object.keys(next).filter(key => config[key] !== next[key]);
        // Publish an internally consistent snapshot before delivering update events.
        Object.assign(config, next);
        changes.forEach(key => {emitter.emit(`update-${key}`, config[key]); emitter.emit('update', {key, value: config[key]});});
      };
      const persist = (next: Record<string, Loose>): boolean => {
        const changed = Object.keys(next).filter(key => config[key] !== next[key]);
        const previous = new Map<string, string | undefined>();
        try {
          changed.forEach(key => {
            const storageKey = `ZenzaWatch_video.hls.${key}`;
            previous.set(storageKey, localStorage[storageKey]);
            localStorage[storageKey] = JSON.stringify(next[key]);
          });
        } catch (_) {
          // Roll back only keys touched by this save, never unrelated preferences.
          previous.forEach((value, key) => {try {if (value === undefined) delete localStorage[key]; else localStorage[key] = value;} catch (_) {}});
          return false;
        }
        publish(next);
        return true;
      };
      return {
        raw: config,
        get: (key: string) => config[key],
        set: (key: string, value: Loose) => {
          const checked = validate(key, value);
          if (checked === invalid) return;
          const next = {...config, [key]: checked}; reconcile(next);
          if (!persist(next)) {publish(next); console.warn('HLS settings could not be saved');}
        },
        applySettings: (patch: Record<string, unknown>): boolean => {
          if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
          const next = {...config};
          for (const key of Object.keys(patch)) {
            if (!editableKeys.has(key)) continue;
            const checked = validate(key, patch[key]);
            if (checked === invalid) return false;
            next[key] = checked;
          }
          reconcile(next);
          return persist(next);
        },
        on: (...args: Loose[]) => { emitter.on(...args); },
        off: (...args: Loose[]) => { emitter.off(...args); },
        emit: (...args: Loose[]) => { emitter.emit(...args); }
      };
    })();

    const debounce = (func?: Loose, interval?: Loose) => {
      let timer: Loose;
      const result = (...args: Loose[]) => {
        if (timer) {
          timer = clearTimeout(timer);
        }
        timer = setTimeout(() => {
          func(...args);
        }, interval);
      };
      result.cancel = () => {
        if (timer) { timer = clearTimeout(timer); }
      };
      return result;
    };

    const throttle = (func?: Loose, interval?: Loose) => {
      let lastTime = 0;
      let lastArgs: Loose = null;
      let timer: Loose;
      const result = (...args: Loose[]) => {
        const now = performance.now();
        const timeDiff = now - lastTime;

        if (timeDiff < interval) {
          lastArgs = args;
          if (!timer) {
            timer = setTimeout(() => {
              lastTime = performance.now();
              timer = null;
              func.apply(null, lastArgs);
              lastArgs = null;
            }, Math.max(interval - timeDiff, 0));
          }
          return;
        }

        if (timer) {
          timer = clearTimeout(timer);
        }
        lastTime = now;
        lastArgs = null;
        func(...args);
      };
      result.cancel = () => {
        if (timer) {
          timer = clearTimeout(timer);
        }
      };
      return result;
    };
return {Config, DEFAULT_CONFIG, settingBounds: numericBounds, nativeHlsPreference, debounce, throttle};
};
export {createHlsConfig};

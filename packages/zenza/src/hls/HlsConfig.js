// GENERATED FROM tools/typescript-stage1/hls-src/HlsConfig.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
const createHlsConfig = (Emitter, HLS_JS_VERSION) => {
    // Task173: 'force' = always native HLS; true = native only where hls.js cannot play.
    const nativeHlsPreference = (value) => value === 'force' ? 'force' : (value ? 'yes' : 'no');
    const DEFAULT_CONFIG = {
        // hls.js 以外のパラメータ
        segment_duration: 4000, // dmc!
        use_native_hls: true, // hls.jsが使えない環境でブラウザがHLS対応ならそっちを使う（'force'で常にネイティブ）
        show_video_label: false, //
        autoAbrEwmaDefaultEstimate: true,
        hls_js_ver: HLS_JS_VERSION, // 表示用。読み込む版は HLS_JS_URL に固定（保存された古い値は使わない）
        enable_db_cache: !true,
        cache_expire_time: 6 * 60 * 60 * 1000,
        // 以下、 hls.js 関連
        // Domand動画にはcookiesが必要
        xhrSetup: (xhr, url) => {
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
        maxSeekHole: 2, // used by stream-controller
        lowBufferWatchdogPeriod: 0.5, // used by stream-controller
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
        liveSyncDuration: undefined, // used by stream-controller
        liveMaxLatencyDuration: undefined, // used by stream-controller
        liveDurationInfinity: false, // used by buffer-controller
    };
    DEFAULT_CONFIG.clone = (() => {
        return Object.assign({}, DEFAULT_CONFIG);
    });
    const Config = (() => {
        const config = {}, emitter = new Emitter();
        Object.keys(DEFAULT_CONFIG).forEach(key => {
            const storageKey = `ZenzaWatch_video.hls.${key}`;
            config[key] = DEFAULT_CONFIG[key];
            try {
                const saved = localStorage[storageKey];
                if (saved)
                    config[key] = JSON.parse(saved);
            }
            catch (_) { /* unavailable/corrupt persistence must not stop the player */ }
        });
        return {
            raw: config,
            get: (key) => {
                return config[key];
            },
            set: (key, value) => {
                if (!DEFAULT_CONFIG.hasOwnProperty(key)) {
                    return;
                }
                const storageKey = `ZenzaWatch_video.hls.${key}`;
                if (config[key] !== value) {
                    config[key] = value;
                    try {
                        localStorage[storageKey] = JSON.stringify(value);
                    }
                    catch (_) {
                        console.warn('HLS settings could not be saved');
                    }
                    emitter.emit(`update-${key}`, value);
                    emitter.emit('update', { key, value });
                }
            },
            on: (...args) => { emitter.on(...args); },
            off: (...args) => { emitter.off(...args); },
            emit: (...args) => { emitter.emit(...args); }
        };
    })();
    const debounce = (func, interval) => {
        let timer;
        const result = (...args) => {
            if (timer) {
                timer = clearTimeout(timer);
            }
            timer = setTimeout(() => {
                func(...args);
            }, interval);
        };
        result.cancel = () => {
            if (timer) {
                timer = clearTimeout(timer);
            }
        };
        return result;
    };
    const throttle = (func, interval) => {
        let lastTime = 0;
        let lastArgs = null;
        let timer;
        const result = (...args) => {
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
    return { Config, DEFAULT_CONFIG, nativeHlsPreference, debounce, throttle };
};
//===END===
export {createHlsConfig};

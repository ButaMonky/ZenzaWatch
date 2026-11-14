/** Page-world owner of integrated HLS installation and existing settings. */
type Loose = any;
declare const HlsLibrary: typeof import('./HlsLibrary').HlsLibrary;
declare const createHlsConfig: typeof import('./HlsConfig').createHlsConfig;
declare const createHlsStorage: typeof import('./HlsStorage').createHlsStorage;
declare const createHlsVideoElement: typeof import('./HlsVideoElement').createHlsVideoElement;
declare const defineHlsDebugElements: typeof import('./HlsDebugElements').defineHlsDebugElements;
declare const PlaylistPreloader: typeof import('./PlaylistPreloader').PlaylistPreloader;
declare const HlsPrefetch: typeof import('./HlsStartupPrefetch').HlsPrefetch;
declare const createPlaylistStartupPreparer: typeof import('../nico-src/PlaylistStartupPreparer').createPlaylistStartupPreparer;
declare const describeError: typeof import('../nico-src/PlaylistStartupPreparer').describeError;
declare const createPrefetchReporter: typeof import('../nico-src/PrefetchReporter').createPrefetchReporter;
interface HlsRuntimeDependencies {Emitter:Loose;dimport:(url:string)=>Promise<Loose>}
interface HlsInstalledRuntime {createVideoElement:(usecase?:string)=>HTMLElement}
const HlsRuntime = {
  install(ZenzaWatch:Loose,dependencies:HlsRuntimeDependencies):Promise<HlsInstalledRuntime> {
    const window=globalThis.window as Loose,console=window.console;
    const key=Symbol.for('ZenzaWatch.integratedHls');
    if(window[key])return window[key];
    if(window.ZenzaHLS?.createVideoElement && window.customElements?.get('zenza-video')){
      ZenzaWatch.debug.createVideoElement=window.ZenzaHLS.createVideoElement;
      ZenzaWatch.debug.isHLSSupported=true;
      return window[key]=Promise.resolve(window.ZenzaHLS);
    }
    const pending=(async()=>{
      const {Config,DEFAULT_CONFIG,settingBounds,nativeHlsPreference,debounce,throttle}=createHlsConfig(dependencies.Emitter,HlsLibrary.version);
      let primaryVideo:Loose;
      const library=HlsLibrary.load();
      // Register the factory synchronously; player construction waits for the load below.
      const Storage=createHlsStorage(Config,debounce);
      const optionalPrefetch = typeof HlsPrefetch === 'undefined' ? undefined : HlsPrefetch;
      createHlsVideoElement({Config,Storage,debounce,throttle,HLS_JS_URL:HlsLibrary.url,loadLibrary:()=>HlsLibrary.load(),Prefetch:optionalPrefetch});
      await library.catch(()=>{console.warn('HLS library unavailable; checking native playback');});
    const initDebug = ({hlsConfig, html, render, ZenzaWatch}: Loose) => {
      ZenzaWatch.emitter.promise('videoControBar.addonMenuReady').then(({container}: Loose) => {
        const div = html`<div class="command controlButton" data-command="toggleHLSDebug">
            <div class="controlButtonInner">hls</div>
          </div>`;
        ZenzaWatch.util.addStyle(`
          .controlButton[data-command=toggleHLSDebug] {
            font-family: Avenir;
          }`, {className: 'ZenzaHLS'});
        render(div, container);
      });
      ZenzaWatch.emitter.once('command-toggleHLSDebug', () => {
        defineHlsDebugElements(hlsConfig, {html, render, Storage, HTMLDialogElement: window.HTMLDialogElement || window.HTMLDivElement});
        const d = document.createElement('video-debug-dialog');
        d.className = 'zen-family';
        (d as Loose).hlsConfig = hlsConfig;
        (d as Loose).defaultConfig = DEFAULT_CONFIG;
        (d as Loose).settingBounds = settingBounds;
        (d as Loose).versionInfo = {zenza: ZenzaWatch.version, hls: window.Hls?.version || HlsLibrary.version};
        d.addEventListener('save', e => {
          const dialog = d as Loose;
          dialog.setSaving?.(true);
          try {
            if (!Config.applySettings((e as Loose).detail.config)) {
              dialog.setStatus?.('設定を保存できませんでした。入力内容とブラウザーの保存領域を確認してください。', 'error');
              return;
            }
            // Full validated snapshot retains credentials, retry policy and decoding defaults.
            if (primaryVideo) {
              primaryVideo.hlsConfig = Config.raw;
              primaryVideo.setAttribute('show-video-label', Config.get('show_video_label') ? 'on' : 'off');
            }
            dialog.hlsConfig = {...Config.raw};
            dialog.setStatus?.('保存しました。バッファ・画質設定は次の動画から反映します。', 'success');
          } finally {dialog.setSaving?.(false);}
        });
        d.addEventListener('reset', () => {
          (d as Loose).reset(DEFAULT_CONFIG);
          (d as Loose).setStatus?.('初期値に戻しました。保存すると反映します。');
        });
        Config.on('update-abrEwmaDefaultEstimate', (value?: Loose) => {
          if (typeof value !== 'number' || isNaN(value)) { return; }
          (d as Loose).setValue('abrEwmaDefaultEstimate', value);
        });

        ZenzaWatch.debug.hlsDebugDialog = d;
        document.body.append(d);
        (d as Loose).open();

        ZenzaWatch.emitter.on('command-toggleHLSDebug', () => {
          ZenzaWatch.debug.hlsDebugDialog.toggle();
        });
      });
    };

    const init = () => {
      console.info('ZenzaWatch integrated HLS', ZenzaWatch.version);

      const hlsConfig = Object.assign({}, Config.raw);
      // Task 079: Config は emit('update', {key, value}) の形で知らせるので、
      // 以前の (key, value) => … では hlsConfig が一度も更新されていなかった。
      Config.on('update', ({key}: Loose = {}) => {
        if (key) {
          Object.assign(hlsConfig, Config.raw);
          if (primaryVideo) primaryVideo.hlsConfig = hlsConfig;
        }
      });

      let lastLevel = -1;
      // Task 079: 次回の最初の画質は「実際に測った回線速度」から決める。
      // （旧実装の「画質のビットレート×0.8」は回を重ねるごとに下がっていく）
      const saveBandwidthEstimate = (bandwidth?: Loose) => {
        if (!Config.get('autoAbrEwmaDefaultEstimate')) { return; }
        if (typeof bandwidth !== 'number' || !isFinite(bandwidth) || bandwidth <= 0) { return; }
        Config.set('abrEwmaDefaultEstimate', Math.round(Math.min(bandwidth, 50 * 1000 * 1000)));
      };
      // 旧実装で下がりきった保存値を一度だけ戻す
      try {
        const RESET_KEY = 'ZenzaWatch_video.hls._task079EstimateReset';
        if (!localStorage[RESET_KEY]) {
          localStorage[RESET_KEY] = '1';
          if (Config.get('abrEwmaDefaultEstimate') < 5 * 1000 * 1000) {
            Config.set('abrEwmaDefaultEstimate', 5 * 1000 * 1000);
          }
        }
      } catch (e) {
        console.warn('ZenzaHLS: estimate reset failed', e);
      }
      const createVideoElement = (usecase?: Loose) => {
        if (!window.customElements) {
          return document.createElement('video');
        }
        const video =  document.createElement('zenza-video');
        if (usecase === 'capture') {
          //return null;
          // 静止画キャプチャ用なのにどんどんバッファするのは無駄なので抑える
          video.setAttribute('data-usecase', 'capture');
          // Task 079: 以前は Object.assign(hlsConfig, …) で、本編の動画と共有している
          // 設定オブジェクトそのものを書き換えていた（キャプチャ用の設定が本編に混ざる）。
          (video as Loose).hlsConfig = Object.assign({}, hlsConfig, {
            autoStartLoad: false,
            // maxBufferSize: 0,
            // maxBufferLength: 5,
            // maxMaxBufferLength: 5,
            manifestLoadingRetryDelay: 5000,
            levelLoadingRetryDelay: 5000,
            fragLoadingRetryDelay: 5000,
            fragLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 1,
            abrEwmaDefaultEstimate: ZenzaWatch.debug.hlsConfig.abrEwmaDefaultEstimate,
            startLevel: lastLevel
          });
          video.addEventListener('init-hls-js', ({detail: {hls}}: Loose) => {
            hls.autoLevelCapping = lastLevel;
          });
        } else {
          video.setAttribute('show-video-label', Config.get('show_video_label') ? 'on' : 'off');
          (video as Loose).hlsConfig = hlsConfig;
          video.addEventListener('levelswitched', e => {
            const detail = (e as Loose).detail;
            //const kbps = Math.round(detail.bitrate * 10 / 1024) / 10;
            //console.log('Hls.Events.LEVEL_SWITCHED level: %s, size: %sx%s, %sKbps',
            //  detail.level,
            //  detail.width,
            //  detail.height,
            //  kbps
            //);
            lastLevel = detail.level;
            saveBandwidthEstimate(detail.bandwidth);
          });
          video.addEventListener('bandwidthestimate', e => {
            saveBandwidthEstimate((e as Loose).detail.bandwidth);
          });
          primaryVideo = video;
        }
        video.setAttribute('use-native-hls', nativeHlsPreference(Config.get('use_native_hls')));
        return video;
      };

      // The HLS bridge is inert until the Nico dialog explicitly opts into prefetch.
      if (optionalPrefetch && typeof PlaylistPreloader !== 'undefined' &&
          typeof createPlaylistStartupPreparer !== 'undefined' &&
          typeof createPrefetchReporter !== 'undefined' && typeof describeError !== 'undefined') {
      ZenzaWatch.debug.playlistPrefetch = {
        trialDiagnostics: false,
        createPreparer: createPlaylistStartupPreparer,
        createReporter: createPrefetchReporter,
        describeError,
        create: (prepare:Loose, onReady:Loose, onEvent:Loose) => new PlaylistPreloader(prepare, undefined, onReady, onEvent,
          (value:Loose) => value?.bytes?.bytes || 0, (value:Loose) => value?.expiresAt),
        bytes: Object.assign({}, HlsPrefetch, {prepare: (source:string, signal:AbortSignal) => HlsPrefetch.prepare(source, signal, {
          startLevel: Number(Config.get('startLevel')), bandwidthEstimate: Number(Config.get('abrEwmaDefaultEstimate'))})}),
        supported: () => window.location.hostname === 'www.nicovideo.jp' && primaryVideo?.playerMode === 'HLS-JS',
        sample: () => ({currentTime:primaryVideo?.currentTime,duration:primaryVideo?.duration,
          buffered:primaryVideo?.buffered,rate:primaryVideo?.playbackRate,
          seeking:primaryVideo?.seeking,ended:primaryVideo?.ended})
      };
      }
      window.ZenzaHLS = {
        createVideoElement
      };

        // The dialog must still deliver an HLS src after a transient library failure,
        // so the registered element can retry on an MSE-capable browser.
        ZenzaWatch.debug.isHLSSupported = !!(window.Hls?.isSupported?.() ||
          (!window.Hls && (window.MediaSource || window.ManagedMediaSource)) ||
          document.createElement('video').canPlayType('application/vnd.apple.mpegurl'));

        ZenzaWatch.debug.hlsConfig = {};
        Object.keys(Config.raw).forEach(key => {
          Object.defineProperty(ZenzaWatch.debug.hlsConfig, key, {
            get() { return Config.get(key); },
            set(v) { Config.set(key, v); }
          });
        });

        ZenzaWatch.debug.createVideoElement = createVideoElement;
      void dependencies.dimport('https://esm.run/lit@2.0.2/html.js')
        .then(({html,render})=>initDebug({hlsConfig,html,render,ZenzaWatch}))
        .catch(()=>console.warn('HLS settings UI unavailable'));
    };
    init();
    return window.ZenzaHLS as HlsInstalledRuntime;
    })();
    window[key]=pending;
    void pending.catch(()=>{if(window[key]===pending)delete window[key];});
    return pending;
  }
};
export {HlsRuntime};

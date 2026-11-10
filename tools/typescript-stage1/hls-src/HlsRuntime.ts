/** Page-world owner of integrated HLS installation and existing settings. */
type Loose = any;
declare const HlsLibrary: typeof import('./HlsLibrary').HlsLibrary;
declare const createHlsConfig: typeof import('./HlsConfig').createHlsConfig;
declare const createHlsStorage: typeof import('./HlsStorage').createHlsStorage;
declare const createHlsVideoElement: typeof import('./HlsVideoElement').createHlsVideoElement;
declare const defineHlsDebugElements: typeof import('./HlsDebugElements').defineHlsDebugElements;
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
      const {Config,DEFAULT_CONFIG,nativeHlsPreference,debounce,throttle}=createHlsConfig(dependencies.Emitter,HlsLibrary.version);
      let primaryVideo:Loose;
      const library=HlsLibrary.load();
      // Register the factory synchronously; player construction waits for the load below.
      const Storage=createHlsStorage(Config,debounce);
      createHlsVideoElement({Config,Storage,debounce,throttle,HLS_JS_URL:HlsLibrary.url,loadLibrary:()=>HlsLibrary.load()});
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
      ZenzaWatch.emitter.promise('videoContextMenu.addonMenuReady.list').then(({container}: Loose) => {
        const li = html`<li class="command" data-command="toggleHLSDebug">HLS設定</li>`;
        render(li, container);
      });

      ZenzaWatch.emitter.once('command-toggleHLSDebug', () => {
        defineHlsDebugElements(hlsConfig, {html, render, Storage, HTMLDialogElement: window.HTMLDialogElement || window.HTMLDivElement});
        const d = document.createElement('video-debug-dialog');
        d.className = 'zen-family';
        (d as Loose).hlsConfig = hlsConfig;
        d.addEventListener('change', e => {
          if ((e as Loose).detail.name === 'show_video_label') {
            Config.set((e as Loose).detail.name, (e as Loose).detail.value);
            if (primaryVideo) {
              primaryVideo.setAttribute('show-video-label',
                (e as Loose).detail.value ? 'on' : 'off');
            }
          } else if ((e as Loose).detail.name === 'autoAbrEwmaDefaultEstimate') {
            Config.set((e as Loose).detail.name, (e as Loose).detail.value);
          }
        });
        d.addEventListener('save', e => {
          const config = (e as Loose).detail.config;
          Object.keys(config).forEach(key => {
            if (config[key] !== Config.get(key)) {
              Config.set(key, config[key]);
            }
          });
          if (primaryVideo) {
            primaryVideo.hlsConfig = config;
          }
        });
        d.addEventListener('reset', () => {
          const config = Object.assign({}, DEFAULT_CONFIG);
          (d as Loose).reset(config);
          if (primaryVideo) {
            primaryVideo.hlsConfig = config;
          }
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
      Config.on('update', ({key, value}: Loose = {}) => {
        if (key) { (hlsConfig as Loose)[key] = value; }
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

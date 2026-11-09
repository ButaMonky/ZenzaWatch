// GENERATED FROM tools/typescript-stage1/nico-src/ScreenFilter.ts (Task963). Edit the .ts and run npm run nico:sync.
//===BEGIN===
// legacy-to-ts: names provided by other bundled modules
/*
 * Task 077 / 077b / 077c: 画面フィルター（バックログ D-34）
 *
 * 動画の映像だけに、明るさ・コントラスト・ガンマなどの補正を掛ける仕組み。
 * コメント層やボタンには掛けない（.zenzaWatchVideoElement にだけ効かせる）。
 *
 * 【加工の方式（077c で高速化）】
 *   色の処理（明るさ・コントラスト・彩度・暖色・色相・反転・色温度・色かぶり・着色）は、
 *   すべて1枚の色変換行列（feColorMatrix）にまとめて1回で処理する。
 *   明るさの曲線（黒/白レベル・ガンマ・自動レベル補正・着色の色）は、
 *   1枚の対応表（feComponentTransfer、65点）にまとめて1回で処理する。
 *   → 以前は CSS の brightness()…hue-rotate() を5段つないでいた。GPUなしの計測で
 *     5段: 約38fps → 行列1枚: 約59fps（フィルターなし60fps）。
 *   シャープはアンシャープマスク（ぼかした絵との差を足す）。周りの画素を見る処理なので
 *   これだけは重い。ぼかしは CSS の blur()（SVGのぼかしより数倍速い）。
 *   周辺減光は映像の上に影を重ねるだけ（処理はほぼゼロ）。
 *
 * 左右反転・上下反転（旧 toggle-flipH / toggle-flipV）もここで設定を持つが、
 * 見た目の反映は今まで通り transform（.is-flipH / .is-flipV クラス）で行う。
 *
 * 設定は Config の 'screenFilter.*' に保存する（全部の動画で共通・次回も残る）。
 * ただし反転だけは従来通り「ページを開き直すと元に戻る」（initialize で OFF に戻す）。
 *
 * スクリーンショット・コメント付きPiP は canvas に描き直しているため、
 * drawVideo() / processCanvas() で同じ加工を canvas にも掛ける（ctx.filter）。
 * 通常の P in P はブラウザが <video> をそのまま小窓に出すので加工できない。
 *
 * Task 080: 「使う」ON/OFF を廃止した。プリセット「標準」（全部が既定値）の時が OFF、
 * それ以外は自動で ON。標準の時は filter: none・SVGなし・タイマーなし・影の要素なしで、
 * 何も処理しない（077c で確認済みの作りのまま）。以前「使う」を OFF にしていた人は、
 * 初回に値を「標準」へ戻し、元の値は ON/OFF ショートカット用に保存しておく（移行）。
 * 「押している間だけ元の映像」は廃止し、画面の左半分だけ元の映像を重ねる比較モードにした。
 */
const ScreenFilter = (() => {
    // BEGIN SCREEN_FILTER_LOW_POWER_RENDERER
    // SVG sees only the downsampled scratch canvas. The source video stays visible
    // underneath, unfiltered, so unsupported/failed rendering cannot blank playback.
    const createScreenFilterLowPowerRenderer = ({ getVideo, onStatus = () => { }, doc = document, win = window }) => {
        let options = {}, running = false, video = null, source = null;
        let canvas = null, scratch = null, ctx = null, sample = null;
        let timer = 0, raf = 0, observer = null, savedFilter = '', savedPriority = '';
        let failed = false, sourceKey = '', status = '', attached = [], resizer = null;
        const events = ['play', 'pause', 'seeked', 'loadeddata', 'loadedmetadata', 'emptied', 'resize'];
        const report = (next) => { if (next !== status) {
            status = next;
            onStatus(next);
        } };
        const cancel = () => {
            if (timer)
                win.clearTimeout(timer);
            if (raf)
                win.cancelAnimationFrame(raf);
            timer = raf = 0;
        };
        const hide = () => { if (canvas)
            canvas.style.display = 'none'; };
        const detach = () => {
            cancel();
            if (resizer)
                resizer.disconnect();
            resizer = null;
            attached.forEach(el => events.forEach(name => el.removeEventListener(name, wake)));
            attached = [];
            if (video) {
                if (savedFilter)
                    video.style.setProperty('filter', savedFilter, savedPriority);
                else
                    video.style.removeProperty('filter');
            }
            if (canvas)
                canvas.remove();
            video = source = canvas = scratch = ctx = sample = null;
            failed = false;
            sourceKey = '';
        };
        const sync = () => {
            const found = getVideo();
            const next = found && found.isConnected !== false && found.parentNode ? found : null;
            const drawable = next && (next.drawableElement || next);
            if (next !== video || drawable !== source || (canvas && canvas.parentNode !== next?.parentNode)) {
                detach();
                video = next;
                source = drawable;
                if (video) {
                    savedFilter = video.style.getPropertyValue('filter');
                    savedPriority = video.style.getPropertyPriority('filter');
                    video.style.setProperty('filter', 'none', 'important');
                    attached = source !== video ? [video, source] : [video];
                    attached = attached.filter(el => el && el.addEventListener);
                    attached.forEach(el => events.forEach(name => el.addEventListener(name, wake)));
                    if (win.ResizeObserver) {
                        resizer = new win.ResizeObserver(wake);
                        resizer.observe(video);
                    }
                }
            }
            const key = source && (source.currentSrc || source.src || '');
            if (key !== sourceKey) {
                sourceKey = key;
                failed = false;
                hide();
            }
            return !!video;
        };
        const schedule = () => {
            if (!running || timer || raf || failed || doc.hidden || !video ||
                source?.tagName !== 'VIDEO' || !source.videoWidth || !source.videoHeight || source.readyState < 2)
                return;
            // Wait AFTER the previous draw completes: slow draws never queue catch-up work.
            timer = win.setTimeout(() => {
                timer = 0;
                raf = win.requestAnimationFrame(draw);
            }, 1000 / 30);
        };
        const draw = () => {
            raf = 0;
            if (!running || doc.hidden || !sync() || failed)
                return;
            if (source?.tagName !== 'VIDEO' || !source.videoWidth || !source.videoHeight || source.readyState < 2) {
                hide();
                return;
            }
            const vw = source.videoWidth, vh = source.videoHeight;
            const ew = video.offsetWidth, eh = video.offsetHeight;
            if (!ew || !eh) {
                hide();
                return;
            }
            try {
                if (!canvas) {
                    scratch = doc.createElement('canvas');
                    canvas = doc.createElement('canvas');
                    canvas.className = 'zenzaScreenFilterLowPower';
                    canvas.setAttribute('aria-hidden', 'true');
                    canvas.style.cssText = 'position:absolute;z-index:5;pointer-events:none;display:none;';
                    video.after(canvas);
                    sample = scratch.getContext('2d', { alpha: false });
                    ctx = canvas.getContext('2d', { alpha: false });
                    if (!sample || !ctx || !('filter' in ctx))
                        throw new Error('Canvas filter unavailable');
                }
                const ratio = Math.min(1, 854 / vw, 480 / vh);
                const w = Math.max(1, Math.floor(vw * ratio)), h = Math.max(1, Math.floor(vh * ratio));
                if (canvas.width !== w || canvas.height !== h) {
                    scratch.width = canvas.width = w;
                    scratch.height = canvas.height = h;
                }
                sample.filter = 'none';
                sample.drawImage(source, 0, 0, w, h);
                ctx.filter = options.filter || 'none';
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(scratch, 0, 0, w, h);
                const scale = Math.min(ew / vw, eh / vh), cw = vw * scale, ch = vh * scale;
                Object.assign(canvas.style, {
                    display: 'block', left: `${video.offsetLeft + (ew - cw) / 2}px`,
                    top: `${video.offsetTop + (eh - ch) / 2}px`, width: `${cw}px`, height: `${ch}px`,
                    transform: `scale(${options.flipH ? -1 : 1}, ${options.flipV ? -1 : 1})`
                });
                report('active');
                if (!source.paused && !source.ended)
                    schedule();
            }
            catch (e) {
                failed = true;
                cancel();
                hide();
                report('unavailable');
            }
        };
        function wake() {
            if (!running)
                return;
            if (!sync()) {
                report('waiting');
                return;
            }
            if (doc.hidden) {
                cancel();
                hide();
                report('hidden');
                return;
            }
            if (source?.tagName !== 'VIDEO') {
                cancel();
                hide();
                report('unsupported');
                return;
            }
            if (failed) {
                report('unavailable');
                return;
            }
            if (!source.videoWidth || !source.videoHeight || source.readyState < 2) {
                cancel();
                hide();
                report('waiting');
                return;
            }
            schedule();
        }
        const stop = () => {
            running = false;
            if (observer)
                observer.disconnect();
            observer = null;
            doc.removeEventListener('visibilitychange', wake);
            win.removeEventListener('resize', wake);
            detach();
            report('normal');
        };
        const update = (next) => {
            options = Object.assign({}, options, next);
            if (!options.enabled) {
                stop();
                return;
            }
            if (!running) {
                running = true;
                doc.addEventListener('visibilitychange', wake);
                win.addEventListener('resize', wake);
                observer = new win.MutationObserver(() => {
                    const found = getVideo();
                    if (found !== video || video?.isConnected === false ||
                        (video && (video.drawableElement || video) !== source) ||
                        (canvas && canvas.parentNode !== video?.parentNode))
                        wake();
                });
                observer.observe(doc.documentElement, { childList: true, subtree: true });
            }
            wake();
        };
        return { start: update, update, stop };
    };
    // END SCREEN_FILTER_LOW_POWER_RENDERER
    const PREFIX = 'screenFilter.';
    const SVG_ID = 'zenzaScreenFilterSvg';
    const STYLE_ID = 'zenzaScreenFilterStyle';
    const CSS_VAR = '--zenza-screen-filter';
    const VIGNETTE_CLASS = 'zenzaScreenFilterVignette';
    /*
     * 調整項目の一覧。設定パネル（プレイヤー内のフィルターパネル・上級者用設定）の
     * 表示もこの配列から作るので、項目を足す時はここに1つ足せばよい。
     *   group: 'basic' 色と明るさ / 'tone' 明暗の細かい調整 / 'style' 雰囲気
     *   heavy: true … 周りの画素を見る処理で重い（説明に書く）
     */
    const PARAMS = [
        {
            key: 'brightness', label: '明るさ', group: 'basic',
            min: 0, max: 200, step: 1, def: 100, unit: '%',
            desc: '画面全体を明るく／暗くします。上げすぎると明るい所が真っ白に飛びます。' +
                '暗い動画を見やすくしたい時は、下の「ガンマ」の方が自然に明るくなります。'
        },
        {
            key: 'contrast', label: 'コントラスト', group: 'basic',
            min: 0, max: 200, step: 1, def: 100, unit: '%',
            desc: '明るい所と暗い所の差の強さです。上げるとメリハリが出てくっきり、' +
                '下げると柔らかい（眠たい）感じになります。'
        },
        {
            key: 'saturate', label: '彩度（色の濃さ）', group: 'basic',
            min: 0, max: 300, step: 1, def: 100, unit: '%',
            desc: '色の濃さです。0 で白黒、100 が元のまま、上げると色が鮮やかになります。'
        },
        {
            key: 'temperature', label: '色温度', group: 'basic',
            min: -100, max: 100, step: 1, def: 0, unit: '', signed: true,
            desc: 'マイナスで青っぽく（涼しい感じ）、プラスでオレンジっぽく（暖かい感じ）なります。' +
                '夜は少しプラスにすると目に優しくなります。'
        },
        {
            key: 'tint', label: '色かぶり補正', group: 'basic',
            min: -100, max: 100, step: 1, def: 0, unit: '', signed: true,
            desc: '映像が緑っぽい時はプラス（赤紫の方向へ）、赤紫っぽい時はマイナス（緑の方向へ）に動かすと自然な色に戻ります。'
        },
        {
            key: 'hue', label: '色相（色のずらし）', group: 'basic',
            min: -180, max: 180, step: 1, def: 0, unit: '°',
            desc: 'すべての色を虹の順番にずらします（例: 赤→黄→緑…）。普段は 0 のままで大丈夫です。' +
                '遊びや、見分けにくい色がある時の補助に。'
        },
        {
            key: 'sepia', label: 'セピア', group: 'basic',
            min: 0, max: 100, step: 1, def: 0, unit: '%',
            desc: '古い写真のような茶色っぽい色味に寄せます。色温度より色が抜けた感じになります。'
        },
        {
            key: 'invert', label: '階調反転（ネガ）', group: 'basic', type: 'boolean', def: false,
            desc: '明るい所と暗い所を入れ替えます（写真のネガのような見た目）。' +
                '白い背景の資料動画を暗くしたい時は、プリセットの「反転（暗転）」を選ぶと色味が保たれます。'
        },
        {
            key: 'gamma', label: 'ガンマ（中間の明るさ）', group: 'tone',
            min: 0.3, max: 3.0, step: 0.01, def: 1.0, unit: '', digits: 2,
            desc: '真っ黒・真っ白はそのままに、中くらいの明るさだけを持ち上げ／下げます。' +
                '1 より大きくすると、白飛びさせずに暗い部分が見えやすくなります。暗い動画にいちばん効く項目です。'
        },
        {
            key: 'blackLevel', label: '黒レベル', group: 'tone',
            min: -50, max: 50, step: 1, def: 0, unit: '', signed: true,
            desc: 'いちばん暗い部分の調整です。プラスにすると真っ黒な所が少し持ち上がって暗部が見えやすく' +
                '（そのぶん黒が灰色っぽく）なり、マイナスにすると黒が引き締まります。'
        },
        {
            key: 'whiteLevel', label: '白レベル', group: 'tone',
            min: -50, max: 50, step: 1, def: 0, unit: '', signed: true,
            desc: 'いちばん明るい部分の調整です。マイナスにすると白が少し抑えられて、まぶしさ・白飛びが和らぎます。' +
                'プラスにすると明るい部分がより明るくなります。'
        },
        {
            key: 'autoLevels', label: '自動レベル補正', group: 'tone', type: 'boolean', def: false,
            desc: '動画ごとに、いちばん暗い所が黒・いちばん明るい所が白になるよう自動で合わせます（0.5秒ごとに少しずつ）。' +
                '白っぽくかすんだ動画や、全体が暗い動画に効きます。処理はとても軽いです。'
        },
        {
            key: 'sharpen', label: 'シャープ（輪郭の強調）', group: 'tone', heavy: true,
            min: 0, max: 100, step: 1, def: 0, unit: '',
            desc: '輪郭をくっきりさせます。ぼやけた低画質の動画に。20〜40 くらいがおすすめです。' +
                '周りの画素を調べる処理なので、この項目だけは少し重めです（グラフィックボードの無いパソコンで動画がカクつく時は 0 に）。'
        },
        {
            key: 'blur', label: 'ぼかし', group: 'style',
            min: 0, max: 20, step: 0.1, def: 0, unit: 'px',
            desc: '映像をぼかします。ブロックノイズやチラつきが気になる時は 1 前後、はっきりぼかしたい時は 5 以上に。' +
                '画面上の大きさ（ピクセル）で効くので、大きな画面ほど強めにすると同じ見え方になります。'
        },
        {
            key: 'vignette', label: '周辺減光', group: 'style',
            min: 0, max: 100, step: 1, def: 0, unit: '%',
            desc: '画面の周りをだんだん暗くして、映画やカメラのような雰囲気にします。映像の上に影を重ねるだけなので、処理はほぼゼロです。'
        },
        {
            key: 'colorize', label: '着色（モノトーン）', group: 'style', type: 'select', def: 'none',
            options: [
                ['none', 'なし'],
                ['gold', 'ゴールド'],
                ['sepia', 'セピア（古写真）'],
                ['blue', 'ブルー'],
                ['green', 'グリーン（暗視カメラ風）']
            ],
            desc: '映像をいったん白黒にして、選んだ色のグラデーションで塗り直します。' +
                'ゴールドは金属っぽい高級感、セピアは古い写真、グリーンは暗視カメラのような見た目になります。'
        },
        { key: 'bloom', label: 'ブルーム（光のにじみ）', group: 'style', heavy: true,
            min: 0, max: 100, step: 1, def: 0, unit: '%',
            desc: '明るい色をぼかして重ねます。0で無効。強くすると白飛びしやすく、ぼかし処理の負荷が増えます。' },
        { key: 'bloomThreshold', label: 'ブルームの明るさ基準', group: 'style',
            min: 0, max: 95, step: 1, def: 70, unit: '%',
            desc: '高いほど明るい色だけが光ります。ブルームが0の間は映像に影響しません。' },
        { key: 'bloomRadius', label: 'ブルームの広がり', group: 'style',
            min: 0.5, max: 12, step: 0.5, def: 3, unit: 'px',
            desc: '光を広げる範囲です。大きいほど柔らかく広がります。' },
        { key: 'posterize', label: 'ポスタライズ（階調数）', group: 'style',
            min: 0, max: 16, step: 1, def: 0, unit: '',
            desc: '0で無効。1・2は各色2段階、3以上はその段階数に減色します。少ないほどポスター風になります。' },
        { key: 'edge', label: '輪郭エフェクトの強さ', group: 'style', heavy: true,
            min: 0, max: 100, step: 1, def: 0, unit: '%',
            desc: '輪郭を抽出した映像と混ぜます。100で輪郭だけ、0で無効。周囲の画素を調べる処理を使います。' },
        { key: 'edgeStyle', label: '輪郭エフェクトの種類', group: 'style', type: 'select', def: 'sketch',
            options: [['sketch', '鉛筆スケッチ'], ['neon', 'ネオン輪郭'], ['emboss', 'エンボス']],
            desc: '白地の線画、黒地の色付き輪郭、浮き彫りから選びます。強さが0の間は映像に影響しません。' },
        { key: 'rgbShift', label: 'RGBずらし（色収差）', group: 'style',
            min: -12, max: 12, step: 0.5, def: 0, unit: 'px', signed: true,
            desc: '赤と青を左右へ逆向きにずらします。符号で方向を反転、0で無効。' },
        { key: 'grain', label: 'フィルム粒子', group: 'style',
            min: 0, max: 100, step: 1, def: 0, unit: '%',
            desc: '固定の白黒粒子を重ねます。粒子は動かず、細かなフィルムの質感を加えます。0で無効。' },
        { key: 'grainSize', label: 'フィルム粒子の大きさ', group: 'style',
            min: 1, max: 4, step: 0.5, def: 1, unit: '',
            desc: '粒子を細かく／粗くします。フィルム粒子が0の間は映像に影響しません。' },
        { key: 'scanlines', label: '走査線（CRT風）', group: 'style',
            min: 0, max: 100, step: 1, def: 0, unit: '%',
            desc: '細い横線を重ねてブラウン管風にします。0で無効。RGBずらしや周辺減光と組み合わせられます。' },
        { key: 'scanlineSpacing', label: '走査線の間隔', group: 'style',
            min: 2, max: 8, step: 1, def: 4, unit: 'px',
            desc: '横線の間隔です。画面サイズによって見え方が変わります。' }
    ];
    const PARAM_MAP = PARAMS.reduce((map, p) => { map[p.key] = p; return map; }, {});
    const DEFAULTS = PARAMS.reduce((map, p) => { map[p.key] = p.def; return map; }, {});
    /*
     * プリセット。values に書いていない項目は既定値に戻る（前のプリセットの値が残らない）。
     * 反転（左右・上下）とフィルターの ON/OFF はプリセットでは変えない。
     */
    const PRESETS = [
        { id: 'standard', label: '標準', values: {},
            desc: 'すべて元のまま（フィルターなし）。' },
        { id: 'dark', label: '暗い動画を見やすく', values: { gamma: 1.35, blackLevel: 4, contrast: 105 },
            desc: '夜のシーンや古い実況動画など、暗くて見えにくい動画向け。白飛びさせずに暗い所を持ち上げます。' },
        { id: 'sharp', label: 'くっきり', values: { contrast: 112, saturate: 110, sharpen: 30 },
            desc: 'ぼやけた低画質の動画向け。輪郭とメリハリを強めます。輪郭の強調を使うので少しだけ重めです。' },
        { id: 'vivid', label: 'ビビッド', values: { saturate: 135, contrast: 108 },
            desc: 'アニメやゲーム実況の色を鮮やかに。' },
        { id: 'faded', label: '色あせ補正', values: { saturate: 130, contrast: 110, autoLevels: true },
            desc: '古い動画や色の薄い動画向け。色を濃くし、明るさの範囲も自動で合わせます。' },
        { id: 'cinema', label: 'シネマ（銀残し風）', values: { saturate: 55, contrast: 120, gamma: 0.92, vignette: 35 },
            desc: '映画でよく使われる「銀残し」風。色を抜いて硬めの階調にし、周りを少し暗くします。' },
        { id: 'film', label: 'フィルム（レトロ）', values: { saturate: 80, blackLevel: 7, whiteLevel: -6, temperature: 12 },
            desc: '黒を少し浮かせて白を抑え、色を少し抜いた、昔のフィルムのような柔らかい見た目。' },
        { id: 'pastel', label: 'パステル', values: { saturate: 70, blackLevel: 14, contrast: 90, gamma: 1.1 },
            desc: '明るく淡い色合いに。' },
        { id: 'cool', label: '寒色', values: { temperature: -35 },
            desc: '青っぽく涼しい色合いに。' },
        { id: 'warm', label: '暖色', values: { temperature: 35 },
            desc: 'オレンジっぽく暖かい色合いに。' },
        { id: 'eyeCare', label: '目に優しい（夜）', values: { brightness: 85, saturate: 90, temperature: 30 },
            desc: '暗い部屋で見る時向け。少し暗く、暖かい色にして青い光を減らします。' },
        { id: 'gold', label: 'ゴールド', values: { colorize: 'gold', contrast: 105 },
            desc: '明るさを金色のグラデーションに置き換えます（黄金質・金属質のような見た目）。' },
        { id: 'mono', label: '白黒', values: { saturate: 0 },
            desc: '色を抜いて白黒にします。雰囲気づくりや、色のチカチカが気になる時に。' },
        { id: 'monoHigh', label: '白黒（硬調）', values: { saturate: 0, contrast: 135 },
            desc: 'コントラストの強い白黒。' },
        { id: 'invert', label: '反転（暗転）', values: { invert: true, hue: 180 },
            desc: '白い背景の資料動画などを暗い画面にします（色味はなるべく保ったまま明暗だけ反転）。' },
        { id: 'softGlow', label: 'ソフトグロー', values: { bloom: 35, bloomThreshold: 65, bloomRadius: 4 },
            desc: '明るい色を柔らかくにじませます。' },
        { id: 'popPoster', label: 'ポップポスター', values: { posterize: 4, saturate: 130, contrast: 110 },
            desc: '色を各4段階に減らし、鮮やかなポスター風に。' },
        { id: 'pencilSketch', label: '鉛筆スケッチ', values: { edge: 100, edgeStyle: 'sketch' },
            desc: '白地に輪郭を描く線画風。' },
        { id: 'neonEdges', label: 'ネオン輪郭', values: { edge: 100, edgeStyle: 'neon', saturate: 150 },
            desc: '黒地に色付きの輪郭を浮かべます。' },
        { id: 'emboss', label: '浮き彫り', values: { edge: 100, edgeStyle: 'emboss', saturate: 0 },
            desc: '輪郭に明暗を付けた浮き彫り風。' },
        { id: 'chromatic', label: '色収差', values: { rgbShift: 3 },
            desc: '赤と青の輪郭を左右にずらします。' },
        { id: 'grainFilm', label: '粒子フィルム', values: { grain: 45, saturate: 75, blackLevel: 5, temperature: 10 },
            desc: '固定粒子と淡い暖色を合わせたフィルム風。' },
        { id: 'retroCrt', label: 'レトロCRT', values: { scanlines: 45, scanlineSpacing: 4, rgbShift: 1, vignette: 30, saturate: 115 },
            desc: '走査線・軽い色収差・周辺減光でブラウン管風に。' }
    ];
    const PRESET_MAP = PRESETS.reduce((map, p) => { map[p.id] = p; return map; }, {});
    /* 着色（colorize）のグラデーション。暗い所→明るい所の順の色（0〜1） */
    const COLORIZE_MAPS = {
        gold: [[0.08, 0.04, 0.01], [0.45, 0.28, 0.08], [0.85, 0.62, 0.25], [1, 0.9, 0.6]],
        sepia: [[0.1, 0.06, 0.03], [0.45, 0.33, 0.2], [0.8, 0.68, 0.5], [1, 0.95, 0.85]],
        blue: [[0.02, 0.05, 0.12], [0.15, 0.3, 0.55], [0.5, 0.7, 0.9], [0.9, 0.97, 1]],
        green: [[0, 0.05, 0], [0.1, 0.45, 0.1], [0.4, 0.85, 0.35], [0.85, 1, 0.8]]
    };
    let config = null;
    let bypass = false;
    let applyScheduled = false;
    let lastCss = null;
    let lastSvgKey = null;
    let lastVignette = null;
    const listeners = new Set();
    // 自動レベル補正の現在値（入力の黒点・白点。0〜1）。設定には保存しない
    const auto = { black: 0, white: 1, available: true, timer: null, canvas: null };
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const digitsOf = (p) => p.digits !== undefined ? p.digits : (String(p.step).split('.')[1] || '').length;
    const normalize = (key, value) => {
        const p = PARAM_MAP[key];
        if (!p) {
            return value;
        }
        if (p.type === 'boolean') {
            return value === true || value === 'true';
        }
        if (p.type === 'select') {
            return p.options.some(([v]) => v === value) ? value : p.def;
        }
        let v = parseFloat(value);
        if (!isFinite(v)) {
            v = p.def;
        }
        v = clamp(v, p.min, p.max);
        return parseFloat(v.toFixed(digitsOf(p)));
    };
    const prop = (key) => config && config.props ? config.props[PREFIX + key] : undefined;
    const setProp = (key, value) => {
        if (!config || !config.props) {
            return;
        }
        if (config.props[PREFIX + key] !== value) {
            config.props[PREFIX + key] = value;
        }
    };
    /** 今の設定値（調整項目だけ）を正規化して返す */
    const read = () => {
        const values = {};
        PARAMS.forEach(p => { values[p.key] = normalize(p.key, prop(p.key)); });
        return values;
    };
    let historyCurrent = null;
    const historyPast = [], historyFuture = [];
    const snapshot = () => ({ ...read(), flipH: !!prop('flipH'), flipV: !!prop('flipV') });
    const sameSnapshot = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const recordHistory = () => {
        const next = snapshot();
        if (historyCurrent && !sameSnapshot(historyCurrent, next)) {
            historyPast.push(historyCurrent);
            if (historyPast.length > 50)
                historyPast.shift();
            historyFuture.length = 0;
        }
        historyCurrent = next;
    };
    const stepHistory = (back) => {
        recordHistory();
        const from = back ? historyPast : historyFuture, to = back ? historyFuture : historyPast;
        const target = from[from.length - 1];
        if (!target)
            return false;
        const before = snapshot();
        Object.entries(target).forEach(([key, value]) => setProp(key, value));
        const actual = snapshot();
        if (!sameSnapshot(target, actual)) {
            recordHistory();
            apply();
            return false;
        }
        from.pop();
        to.push(before);
        historyCurrent = actual;
        apply();
        return true;
    };
    // Task 080: 「使う」を廃止。標準（全部既定値）なら何も掛からないので、常に有効として扱う
    const isEnabled = () => true;
    const isDefaultValue = (key, value) => {
        const p = PARAM_MAP[key];
        if (p.type === 'boolean') {
            return !!value === !!p.def;
        }
        if (p.type === 'select') {
            return value === p.def;
        }
        return Math.abs(value - p.def) < 1e-6;
    };
    const sameValue = (p, a, b) => {
        if (p.type === 'boolean') {
            return !!a === !!b;
        }
        if (p.type === 'select') {
            return a === b;
        }
        return Math.abs(a - b) < 1e-6;
    };
    const getUserPresets = () => {
        const invalid = () => new Error('保存されたマイプリセットを読み込めません。データは変更していません。');
        let raw = prop('userPresets');
        // DataStorage caches defaults after malformed outer JSON. Inspect the
        // preserved storage value as well, never mistake corruption for no presets.
        if (config?.storage && typeof config.getStorageKey === 'function') {
            try {
                const stored = config.storage[config.getStorageKey(PREFIX + 'userPresets')];
                raw = stored === undefined || stored === null ? '' : JSON.parse(stored);
            }
            catch {
                throw invalid();
            }
        }
        if (raw === undefined || raw === '')
            return [];
        if (typeof raw !== 'string' || raw.length > 100000)
            throw invalid();
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            throw invalid();
        }
        if (!Array.isArray(data) || data.length > 20)
            throw invalid();
        const ids = new Set(), names = new Set();
        return data.map(entry => {
            if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' ||
                !/^user_[a-z0-9_-]+$/.test(entry.id) || typeof entry.label !== 'string' ||
                !entry.label.trim() || entry.label.length > 40 || ids.has(entry.id) || names.has(entry.label.trim()) ||
                !entry.values || typeof entry.values !== 'object' || Array.isArray(entry.values))
                throw invalid();
            ids.add(entry.id);
            names.add(entry.label.trim());
            const values = {};
            for (const p of PARAMS) {
                const value = entry.values[p.key];
                if (value !== undefined && (typeof value !== typeof p.def ||
                    (typeof value === 'number' && !Number.isFinite(value))))
                    throw invalid();
                values[p.key] = normalize(p.key, value === undefined ? p.def : value);
            }
            return { id: entry.id, label: entry.label.trim(), values };
        });
    };
    const writeUserPresets = (presets) => {
        if (!config?.props || config.readonly)
            throw new Error('マイプリセットを保存できませんでした。');
        const json = JSON.stringify(presets);
        setProp('userPresets', json);
        if (prop('userPresets') !== json || JSON.stringify(getUserPresets()) !== json)
            throw new Error('マイプリセットを保存できませんでした。');
        emitChange();
    };
    const saveUserPreset = (name) => {
        const label = name.trim();
        if (!label || label.length > 40)
            throw new Error('名前を1〜40文字で入力してください。');
        const presets = getUserPresets();
        if (presets.some(p => p.label === label))
            throw new Error('同じ名前があります。別の名前で保存してください。');
        if (presets.length >= 20)
            throw new Error('保存できるのは20件までです。不要なプリセットを削除してください。');
        const preset = { id: 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2), label, values: read() };
        writeUserPresets([...presets, preset]);
        return preset;
    };
    const deleteUserPreset = (id) => {
        const presets = getUserPresets();
        if (!presets.some(p => p.id === id))
            throw new Error('このマイプリセットは見つかりません。');
        writeUserPresets(presets.filter(p => p.id !== id));
    };
    const renameUserPreset = (id, name) => {
        const label = name.trim(), presets = getUserPresets(), preset = presets.find(p => p.id === id);
        if (!preset)
            throw new Error('このマイプリセットは見つかりません。');
        if (!label || label.length > 40)
            throw new Error('名前を1〜40文字で入力してください。');
        if (presets.some(p => p.id !== id && p.label === label))
            throw new Error('同じ名前があります。別の名前で保存してください。');
        preset.label = label;
        writeUserPresets(presets);
    };
    const overwriteUserPreset = (id) => {
        const presets = getUserPresets(), preset = presets.find(p => p.id === id);
        if (!preset)
            throw new Error('このマイプリセットは見つかりません。');
        preset.values = read();
        writeUserPresets(presets);
    };
    const allPresets = () => {
        // Corrupt user storage must not disable the built-in filters or playback.
        try {
            return [...PRESETS, ...getUserPresets()];
        }
        catch {
            return PRESETS;
        }
    };
    const orderedPresets = (items) => {
        try {
            const order = JSON.parse(prop('presetOrder') || '[]');
            if (!Array.isArray(order))
                return items;
            const positions = new Map();
            order.forEach(id => { if (typeof id === 'string' && !positions.has(id))
                positions.set(id, positions.size); });
            return [...items].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
        }
        catch {
            return items;
        }
    };
    const getPresetList = (sorted = true) => {
        let users = [];
        try {
            users = getUserPresets();
        }
        catch { }
        const list = [...PRESETS.map(p => ({ id: p.id, label: p.label, user: false })), ...users.map(p => ({ id: p.id, label: p.label, user: true }))];
        return sorted ? orderedPresets(list) : list;
    };
    /** 今の値が一致するプリセットのid。どれとも違えば 'custom'（手動調整中） */
    const detectPreset = (values = read()) => {
        const found = allPresets().find(preset => PARAMS.every(p => {
            const target = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
            return sameValue(p, values[p.key], target);
        }));
        return found ? found.id : 'custom';
    };
    /** 何か1つでも効いているか（ボタンを光らせる判定） */
    const isActive = (values = read()) => isEnabled() && PARAMS.some(p => !isDefaultValue(p.key, values[p.key]));
    // ---- 色変換行列（3行×4列: RGBの係数＋足し算）。CSSの filter 関数と同じ式 ----
    const IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
    /** a を先に掛けてから b を掛けた合成行列（b ∘ a） */
    const compose = (a, b) => {
        const r = [];
        for (let i = 0; i < 3; i++) {
            r.push([0, 1, 2].map(j => b[i][0] * a[0][j] + b[i][1] * a[1][j] + b[i][2] * a[2][j])
                .concat(b[i][0] * a[0][3] + b[i][1] * a[1][3] + b[i][2] * a[2][3] + b[i][3]));
        }
        return r;
    };
    const diag = (r, g, b, o = 0) => [[r, 0, 0, o], [0, g, 0, o], [0, 0, b, o]];
    const saturateMatrix = (s) => [
        [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0],
        [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0],
        [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0]
    ];
    const sepiaMatrix = (a) => {
        const k = 1 - a;
        return [
            [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0],
            [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0],
            [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0]
        ];
    };
    const hueMatrix = (deg) => {
        const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
        return [
            [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0],
            [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0],
            [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0]
        ];
    };
    const LUMA = [0.2126, 0.7152, 0.0722];
    /** 色の処理を全部まとめた行列。何もしない時は null */
    const buildColorMatrix = (values) => {
        let m = IDENTITY, changed = false;
        const add = (x) => { m = compose(m, x); changed = true; };
        if (!isDefaultValue('brightness', values.brightness)) {
            const b = values.brightness / 100;
            add(diag(b, b, b));
        }
        if (!isDefaultValue('contrast', values.contrast)) {
            const c = values.contrast / 100;
            add(diag(c, c, c, 0.5 - 0.5 * c));
        }
        if (!isDefaultValue('saturate', values.saturate)) {
            add(saturateMatrix(values.saturate / 100));
        }
        if (!isDefaultValue('sepia', values.sepia)) {
            add(sepiaMatrix(values.sepia / 100));
        }
        if (!isDefaultValue('hue', values.hue)) {
            add(hueMatrix(values.hue));
        }
        if (values.invert) {
            add(diag(-1, -1, -1, 1));
        }
        if (!isDefaultValue('temperature', values.temperature) || !isDefaultValue('tint', values.tint)) {
            const t = values.temperature / 100, n = values.tint / 100;
            add(diag(1 + 0.10 * t + 0.04 * n, 1 - 0.12 * n, 1 - 0.15 * t + 0.04 * n));
        }
        if (values.colorize !== 'none') {
            add([LUMA.concat(0), LUMA.concat(0), LUMA.concat(0)]);
        }
        return changed ? m : null;
    };
    /**
     * 黒レベル/白レベルを「出力 = slope × 入力 + intercept」に変換する。
     *   黒レベル +n … 出力の黒を n% 持ち上げる / -n … 入力の n% 以下を真っ黒にする（締める）
     *   白レベル -n … 出力の白を n% 下げる     / +n … 入力の (100-n)% 以上を真っ白にする（伸ばす）
     */
    const levelsToLinear = (blackLevel, whiteLevel) => {
        const b = blackLevel / 100, w = whiteLevel / 100;
        const inBlack = b < 0 ? -b : 0, outBlack = b > 0 ? b : 0;
        const inWhite = w > 0 ? 1 - w : 1, outWhite = w < 0 ? 1 + w : 1;
        const slope = (outWhite - outBlack) / Math.max(0.01, inWhite - inBlack);
        const intercept = outBlack - slope * inBlack;
        return { slope: +slope.toFixed(4), intercept: +intercept.toFixed(4) };
    };
    const TONE_TABLE_SIZE = 65;
    const lerpColor = (stops, x, ch) => {
        const pos = clamp(x, 0, 1) * (stops.length - 1);
        const i = Math.min(stops.length - 2, Math.floor(pos));
        const f = pos - i;
        return stops[i][ch] * (1 - f) + stops[i + 1][ch] * f;
    };
    const useAutoLevels = (values) => values.autoLevels && auto.available &&
        (auto.black > 0.004 || auto.white < 0.996);
    /** 明るさの曲線（自動レベル→黒/白レベル→ガンマ→着色）を1枚の対応表にする。何もしない時は null */
    const buildToneTables = (values) => {
        const levels = !isDefaultValue('blackLevel', values.blackLevel) || !isDefaultValue('whiteLevel', values.whiteLevel);
        const gamma = !isDefaultValue('gamma', values.gamma);
        const colorize = values.colorize !== 'none' && COLORIZE_MAPS[values.colorize];
        const autoOn = useAutoLevels(values);
        if (!levels && !gamma && !colorize && !autoOn) {
            return null;
        }
        const { slope, intercept } = levelsToLinear(values.blackLevel, values.whiteLevel);
        const exponent = 1 / values.gamma;
        const tables = [[], [], []];
        for (let i = 0; i < TONE_TABLE_SIZE; i++) {
            let x = i / (TONE_TABLE_SIZE - 1);
            if (autoOn) {
                x = clamp((x - auto.black) / Math.max(0.05, auto.white - auto.black), 0, 1);
            }
            x = clamp(slope * x + intercept, 0, 1);
            x = Math.pow(x, exponent);
            for (let ch = 0; ch < 3; ch++) {
                tables[ch].push(+(colorize ? lerpColor(colorize, x, ch) : x).toFixed(4));
            }
        }
        return tables.map((t) => t.join(' '));
    };
    /*
     * シャープ: アンシャープマスク。出力 = (1 + a) × 元の絵 − a × ぼかした絵。
     * a = シャープ/100 × 6（シャープ25で a=1.5。077 の3×3畳み込みと同じくらいの効き）。
     * 077b は a = シャープ/100 × 2 で、効きが弱すぎた（077c で修正）。
     */
    const SHARPEN_GAIN = 6;
    /** SVGフィルターの中身（<filter> の子要素）を作る。何もしない時は '' */
    /** Optional artistic stages. No external images, frame reads, or animated noise. */
    const buildArtisticEffects = (values = {}, input = 'SourceGraphic') => {
        const parts = [];
        const n = (key) => normalize(key, values[key]);
        const f = (value) => +value.toFixed(4);
        if (n('bloom') > 0) {
            const threshold = n('bloomThreshold') / 100;
            const slope = f(1 / (1 - threshold));
            const intercept = f(-threshold / (1 - threshold));
            const channel = (ch) => `<feFunc${ch} type="linear" slope="${slope}" intercept="${intercept}"/>`;
            parts.push(`<feComponentTransfer in="${input}" result="sfBloomBright">${channel('R')}${channel('G')}${channel('B')}</feComponentTransfer>`);
            parts.push(`<feGaussianBlur in="sfBloomBright" stdDeviation="${n('bloomRadius')}" result="sfBloomBlur"/>`);
            parts.push(`<feComposite in="${input}" in2="sfBloomBlur" operator="arithmetic" k1="0" k2="1" k3="${f(n('bloom') / 100 * 1.5)}" k4="0" result="sfBloom"/>`);
            input = 'sfBloom';
        }
        if (n('posterize') > 0) {
            const levels = Math.max(2, n('posterize'));
            const table = Array.from({ length: levels }, (_, i) => f(i / (levels - 1))).join(' ');
            const channel = (ch) => `<feFunc${ch} type="discrete" tableValues="${table}"/>`;
            parts.push(`<feComponentTransfer in="${input}" result="sfPosterize">${channel('R')}${channel('G')}${channel('B')}</feComponentTransfer>`);
            input = 'sfPosterize';
        }
        if (n('edge') > 0) {
            const style = n('edgeStyle');
            let source = input;
            if (style === 'sketch') {
                parts.push(`<feColorMatrix in="${input}" type="saturate" values="0" result="sfEdgeMono"/>`);
                source = 'sfEdgeMono';
            }
            const kernel = style === 'emboss' ? '-2 -1 0 -1 1 1 0 1 2' :
                style === 'neon' ? '-1 -1 -1 -1 8 -1 -1 -1 -1' : '1 1 1 1 -8 1 1 1 1';
            const bias = style === 'emboss' ? 0.5 : style === 'sketch' ? 1 : 0;
            parts.push(`<feConvolveMatrix in="${source}" order="3" kernelMatrix="${kernel}" divisor="1" bias="${bias}" edgeMode="duplicate" preserveAlpha="true" result="sfEdgeKernel"/>`);
            const amount = n('edge') / 100;
            parts.push(`<feComposite in="${input}" in2="sfEdgeKernel" operator="arithmetic" k1="0" k2="${f(1 - amount)}" k3="${f(amount)}" k4="0" result="sfEdge"/>`);
            input = 'sfEdge';
        }
        const shift = n('rgbShift');
        if (shift !== 0) {
            ['R', 'G', 'B'].forEach((channel, index) => {
                const matrix = Array.from({ length: 4 }, (_, row) => Array.from({ length: 5 }, (_, col) => row === col && (row === index || row === 3) ? 1 : 0).join(' ')).join(' ');
                parts.push(`<feColorMatrix in="${input}" type="matrix" values="${matrix}" result="sfRgb${channel}"/>`);
            });
            parts.push(`<feOffset in="sfRgbR" dx="${shift}" dy="0" result="sfRgbOffsetR"/>`);
            parts.push(`<feOffset in="sfRgbB" dx="${-shift}" dy="0" result="sfRgbOffsetB"/>`);
            parts.push('<feComposite in="sfRgbOffsetR" in2="sfRgbG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="sfRgbRG"/>');
            parts.push('<feComposite in="sfRgbRG" in2="sfRgbOffsetB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="sfRgb"/>');
            input = 'sfRgb';
        }
        if (n('grain') > 0) {
            // Limit noise generation to one small, deterministic tile, then repeat it.
            parts.push(`<feTurbulence type="fractalNoise" baseFrequency="${f(0.8 / n('grainSize'))}" numOctaves="1" seed="17" stitchTiles="stitch" width="64" height="64" result="sfGrainNoise"/>`);
            parts.push(`<feColorMatrix in="sfGrainNoise" type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 0 ${f(n('grain') / 100)}" width="64" height="64" result="sfGrainTile"/>`);
            parts.push('<feTile in="sfGrainTile" result="sfGrainTexture"/>');
            parts.push(`<feBlend in="sfGrainTexture" in2="${input}" mode="soft-light" result="sfGrain"/>`);
            input = 'sfGrain';
        }
        if (n('scanlines') > 0) {
            const period = n('scanlineSpacing');
            parts.push(`<feFlood flood-color="black" flood-opacity="${f(n('scanlines') / 100 * 0.85)}" width="1" height="1" result="sfScanStripe"/>`);
            // feTile repeats the input primitive subregion, including its transparent gap.
            parts.push(`<feMerge width="1" height="${period}" result="sfScanTile"><feMergeNode in="sfScanStripe"/></feMerge>`);
            parts.push('<feTile in="sfScanTile" result="sfScanPattern"/>');
            parts.push(`<feComposite in="sfScanPattern" in2="${input}" operator="over" result="sfScanlines"/>`);
            input = 'sfScanlines';
        }
        return { markup: parts.join(''), output: input };
    };
    const buildSvgFilterMarkup = (values) => {
        const parts = [];
        let input = 'SourceGraphic';
        const m = buildColorMatrix(values);
        if (m) {
            const v = m.map(row => [row[0], row[1], row[2], 0, row[3]].map(n => +n.toFixed(5)).join(' ')).join('  ');
            parts.push(`<feColorMatrix type="matrix" values="${v}  0 0 0 1 0" result="sfColor"/>`);
            input = 'sfColor';
        }
        const tables = buildToneTables(values);
        if (tables) {
            const f = (ch, i) => `<feFunc${ch} type="table" tableValues="${tables[i]}"/>`;
            parts.push(`<feComponentTransfer in="${input}" result="sfTone">${f('R', 0)}${f('G', 1)}${f('B', 2)}</feComponentTransfer>`);
            input = 'sfTone';
        }
        if (!isDefaultValue('sharpen', values.sharpen)) {
            const amount = +(values.sharpen / 100 * SHARPEN_GAIN).toFixed(3);
            parts.push(`<feGaussianBlur in="${input}" stdDeviation="0.6" result="sfBlur"/>`);
            parts.push(`<feComposite in="${input}" in2="sfBlur" operator="arithmetic" k1="0" k2="${+(1 + amount).toFixed(3)}" k3="${-amount}" k4="0" result="sfSharpen"/>`);
            input = 'sfSharpen';
        }
        const artistic = buildArtisticEffects(values, input);
        if (artistic.markup) {
            parts.push(artistic.markup);
        }
        return parts.join('');
    };
    /** SVG フィルターを画面外に1つだけ置き、値に合わせて中身を差し替える */
    const ensureSvg = (markup) => {
        if (typeof document === 'undefined') {
            return;
        }
        if (markup === lastSvgKey && document.getElementById(SVG_ID)) {
            return;
        }
        lastSvgKey = markup;
        let svg = document.getElementById(`${SVG_ID}-root`);
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = `${SVG_ID}-root`;
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('width', '0');
            svg.setAttribute('height', '0');
            svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
            (document.body || document.documentElement).append(svg);
        }
        svg.innerHTML =
            `<filter id="${SVG_ID}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${markup}</filter>`;
    };
    /**
     * CSS の filter 文字列を作る（canvas の ctx.filter にもそのまま使える）。
     * 何も掛けない時は 'none'。周辺減光はここに含まない（映像の上に重ねる影で表現する）。
     */
    const buildFilter = (values = read(), { enabled = isEnabled() } = {}) => {
        if (!enabled) {
            return 'none';
        }
        const list = [];
        const markup = buildSvgFilterMarkup(values);
        if (markup) {
            ensureSvg(markup);
            list.push(`url(#${SVG_ID})`);
        }
        if (!isDefaultValue('blur', values.blur)) {
            list.push(`blur(${values.blur}px)`);
        }
        return list.length ? list.join(' ') : 'none';
    };
    /** 周辺減光の影の濃さ（0〜1）。効かない時は 0 */
    const vignetteAlpha = (values = read()) => (!isEnabled() || bypass) ? 0 : +(values.vignette / 100 * 0.85).toFixed(3);
    const vignetteBackground = (alpha) => `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${alpha}) 100%)`;
    const ensureStyle = () => {
        if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
      .zenzaWatchVideoElement {
        filter: var(${CSS_VAR}, none);
      }
      .${VIGNETTE_CLASS} {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 6;
        pointer-events: none;
        display: none;
      }
      .${VIGNETTE_CLASS}.is-active {
        display: block;
      }
    `;
        (document.head || document.documentElement).append(style);
    };
    /* 周辺減光: 動画要素のすぐ後ろ（同じ親の中）に影の要素を置く。コメントより下になる */
    const applyVignette = (alpha) => {
        if (typeof document === 'undefined') {
            return;
        }
        const key = String(alpha);
        const videos = document.querySelectorAll('.zenzaWatchVideoElement');
        videos.forEach(video => {
            const parent = video.parentNode;
            if (!parent) {
                return;
            }
            let el = parent.querySelector(`:scope > .${VIGNETTE_CLASS}`);
            if (!el) {
                if (!alpha) {
                    return;
                }
                el = document.createElement('div');
                el.className = VIGNETTE_CLASS;
                video.after(el);
            }
            el.classList.toggle('is-active', alpha > 0);
            if (alpha > 0) {
                el.style.background = vignetteBackground(alpha);
            }
        });
        lastVignette = key;
    };
    const emitChange = () => {
        recordHistory();
        listeners.forEach(fn => {
            try {
                fn();
            }
            catch (e) {
                window.console.warn('ScreenFilter listener error', e);
            }
        });
    };
    let lowPowerStatus = 'normal';
    let lowPowerRenderer = null;
    const updateLowPower = (values, filter) => {
        const enabled = prop('renderQuality') === 'light' && !bypass &&
            ['bloom', 'posterize', 'edge', 'rgbShift', 'grain', 'scanlines'].some(key => normalize(key, values[key]) !== 0);
        if (enabled && !lowPowerRenderer) {
            lowPowerRenderer = createScreenFilterLowPowerRenderer({
                getVideo: () => document.querySelector('.zenzaWatchVideoElement'),
                onStatus: (status) => { lowPowerStatus = status; emitChange(); }
            });
        }
        lowPowerRenderer?.update({ enabled, filter, flipH: !!prop('flipH'), flipV: !!prop('flipV') });
    };
    /** Reflect settings; light mode downsamples before SVG work instead of filtering the full video. */
    const apply = (values = read(), { notify = true } = {}) => {
        applyScheduled = false;
        if (typeof document === 'undefined') {
            return 'none';
        }
        ensureStyle();
        const css = bypass ? 'none' : buildFilter(values);
        if (css !== lastCss) {
            lastCss = css;
            document.documentElement.style.setProperty(CSS_VAR, css);
        }
        updateLowPower(values, css);
        applyVignette(vignetteAlpha(values));
        updateAutoLevelsTimer(values);
        notify && emitChange();
        return css;
    };
    const scheduleApply = () => {
        if (applyScheduled) {
            return;
        }
        applyScheduled = true;
        Promise.resolve().then(() => apply());
    };
    // ---- 自動レベル補正: 0.5秒ごとに映像を小さく縮めて、暗い所・明るい所を調べる ----
    const AUTO_W = 64, AUTO_H = 36;
    const sampleAutoLevels = () => {
        if (!isEnabled() || bypass) {
            return;
        }
        const video = document.querySelector('.zenzaWatchVideoElement');
        if (!video || video.paused || video.readyState < 2 || !video.videoWidth) {
            return;
        }
        try {
            if (!auto.canvas) {
                auto.canvas = document.createElement('canvas');
                auto.canvas.width = AUTO_W;
                auto.canvas.height = AUTO_H;
                auto.ctx = auto.canvas.getContext('2d', { willReadFrequently: true });
            }
            const ctx = auto.ctx;
            ctx.drawImage(video.drawableElement || video, 0, 0, AUTO_W, AUTO_H);
            const data = ctx.getImageData(0, 0, AUTO_W, AUTO_H).data;
            const hist = new Uint32Array(256);
            for (let i = 0; i < data.length; i += 4) {
                hist[(data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8]++;
            }
            const total = AUTO_W * AUTO_H, cut = total * 0.005;
            let low = 0, high = 255, acc = 0;
            for (let i = 0; i < 256; i++) {
                acc += hist[i];
                if (acc > cut) {
                    low = i;
                    break;
                }
            }
            acc = 0;
            for (let i = 255; i >= 0; i--) {
                acc += hist[i];
                if (acc > cut) {
                    high = i;
                    break;
                }
            }
            // 伸ばしすぎない（黒点は最大25%、白点は最小75%、幅は最低40%）
            let b = Math.min(low / 255, 0.25), w = Math.max(high / 255, 0.75);
            if (w - b < 0.4) {
                return;
            }
            b = auto.black * 0.7 + b * 0.3;
            w = auto.white * 0.7 + w * 0.3;
            if (Math.abs(b - auto.black) < 0.004 && Math.abs(w - auto.white) < 0.004) {
                return;
            }
            auto.black = b;
            auto.white = w;
            apply(read(), { notify: false });
        }
        catch (e) {
            // 配信元の許可（CORS）が無い映像では調べられない。以後は止める
            auto.available = false;
            window.console.warn('ScreenFilter: 自動レベル補正はこの映像では使えません', e && e.name);
            stopAutoLevels();
            emitChange();
        }
    };
    const stopAutoLevels = () => {
        if (auto.timer) {
            clearInterval(auto.timer);
            auto.timer = null;
        }
    };
    const updateAutoLevelsTimer = (values) => {
        const want = values.autoLevels && isEnabled() && auto.available && typeof window !== 'undefined';
        if (want && !auto.timer) {
            auto.timer = setInterval(sampleAutoLevels, 500);
        }
        else if (!want && auto.timer) {
            stopAutoLevels();
            auto.black = 0;
            auto.white = 1;
        }
    };
    /** 動画が変わった時に呼ぶ（自動レベル補正をやり直す） */
    const resetAutoLevels = () => {
        auto.black = 0;
        auto.white = 1;
        auto.available = true;
        scheduleApply();
    };
    /** 値を1つ変える（パネル・ショートカット用）。範囲外は丸める */
    const set = (key, value) => {
        if (!PARAM_MAP[key]) {
            return;
        }
        recordHistory();
        setProp(key, normalize(key, value));
        recordHistory();
        scheduleApply();
    };
    /** スライダーを動かしている間のプレビュー（保存はしない） */
    const preview = (key, value) => {
        const values = read();
        values[key] = normalize(key, value);
        // パネルへは通知しない（通知するとパネルが保存済みの値でつまみを戻してしまう。077b）
        apply(values, { notify: false });
    };
    const applyPreset = (id) => {
        const preset = allPresets().find(p => p.id === id);
        if (!preset) {
            return null;
        }
        recordHistory();
        PARAMS.forEach(p => {
            const v = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
            setProp(p.key, normalize(p.key, v));
        });
        recordHistory();
        scheduleApply();
        return preset;
    };
    const reset = () => applyPreset('standard');
    const isPresetActive = (id) => {
        const preset = allPresets().find(p => p.id === id);
        if (!preset)
            return false;
        const values = read();
        return PARAMS.every(p => sameValue(p, values[p.key], preset.values[p.key] ?? p.def));
    };
    const togglePreset = (id) => isPresetActive(id) ? reset() : applyPreset(id);
    const nextPreset = () => {
        const current = detectPreset();
        const index = PRESETS.findIndex(p => p.id === current);
        const next = PRESETS[(index + 1) % PRESETS.length];
        return applyPreset(next.id);
    };
    const formatValue = (key, value) => {
        const p = PARAM_MAP[key];
        if (!p) {
            return String(value);
        }
        if (p.type === 'boolean') {
            return value ? 'ON' : 'OFF';
        }
        if (p.type === 'select') {
            const o = p.options.find(([v]) => v === value);
            return o ? o[1] : String(value);
        }
        const text = Number(value).toFixed(digitsOf(p));
        return `${p.signed && value > 0 ? '+' : ''}${text}${p.unit || ''}`;
    };
    /** 'brightness:+5' のような文字列で値を増減する（ショートカット用） */
    const adjust = (param) => {
        const [key, deltaText] = String(param || '').split(':');
        const p = PARAM_MAP[key];
        if (!p || p.type === 'boolean' || p.type === 'select') {
            return null;
        }
        const delta = parseFloat(deltaText) || 0;
        const next = normalize(key, normalize(key, prop(key)) + delta);
        set(key, next);
        return { param: p, value: next };
    };
    const onOff = (v) => v ? 'ON' : 'OFF';
    /** 全部の調整項目が既定値（＝エフェクトOFF） */
    const isStandard = (values = read()) => PARAMS.every(p => isDefaultValue(p.key, values[p.key]));
    const saveValues = (values) => {
        try {
            setProp('saved', JSON.stringify(values));
        }
        catch (e) { /* 保存できなくても動作は続ける */ }
    };
    const loadSaved = () => {
        const raw = prop('saved');
        if (!raw) {
            return null;
        }
        try {
            const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return v && typeof v === 'object' ? v : null;
        }
        catch (e) {
            return null;
        }
    };
    /**
     * RootDispatcher から呼ばれる。画面に出すメッセージ（無ければ null）を返す。
     *   toggle-screenFilter.enable / .flipH / .flipV / .invert / .autoLevels、
     *   screenFilter-preset(id) / screenFilter-nextPreset / screenFilter-reset / screenFilter-adjust('key:±n')
     */
    const execCommand = (command, param) => {
        switch (command) {
            case 'toggle-screenFilter.enable': {
                // Task 080: 「使う」の代わりに、今の設定 ⇔ 標準 を行き来する
                const values = read();
                if (!isStandard(values)) {
                    saveValues(values);
                    applyPreset('standard');
                    return 'エフェクト: OFF（標準に戻しました。もう一度押すと元の設定に戻ります）';
                }
                const saved = loadSaved();
                if (!saved) {
                    return 'エフェクト: 標準のままです（戻す設定がありません）';
                }
                PARAMS.forEach(p => {
                    setProp(p.key, normalize(p.key, saved[p.key] !== undefined ? saved[p.key] : p.def));
                });
                scheduleApply();
                const preset = PRESET_MAP[detectPreset()];
                return `エフェクト: ON（${preset ? preset.label : '手動で調整した設定'}）`;
            }
            case 'toggle-screenFilter.split': {
                const v = setSplit(!split.on);
                return v ? '画面フィルター: 左半分に元の映像を表示' : '画面フィルター: 比較表示をやめました';
            }
            case 'toggle-screenFilter.flipH': {
                const v = !prop('flipH');
                setProp('flipH', v);
                return `左右反転: ${onOff(v)}`;
            }
            case 'toggle-screenFilter.flipV': {
                const v = !prop('flipV');
                setProp('flipV', v);
                return `上下反転: ${onOff(v)}`;
            }
            case 'toggle-screenFilter.invert':
            case 'toggle-screenFilter.autoLevels': {
                const key = command.replace('toggle-screenFilter.', '');
                const v = !normalize(key, prop(key));
                set(key, v);
                return `${PARAM_MAP[key].label}: ${onOff(v)}`;
            }
            case 'screenFilter-preset': {
                const preset = applyPreset(param);
                if (!preset) {
                    return null;
                }
                return `画面フィルター: ${preset.label}`;
            }
            case 'screenFilter-nextPreset': {
                const preset = nextPreset();
                return preset ? `画面フィルター: ${preset.label}` : null;
            }
            case 'screenFilter-reset':
                reset();
                return '画面フィルター: 標準に戻しました';
            case 'screenFilter-adjust': {
                const result = adjust(param);
                if (!result) {
                    return null;
                }
                return `${result.param.label}: ${formatValue(result.param.key, result.value)}`;
            }
        }
        return null;
    };
    const isCanvasTarget = (target) => {
        const key = target === 'screenshot' ? 'applyToScreenshot' : 'applyToCommentPip';
        const v = prop(key);
        return v === undefined ? true : !!v;
    };
    /**
     * canvas へ動画（または動画を描いた canvas）を、フィルター・反転・周辺減光つきで描く。
     * target: 'screenshot' | 'commentPip'（それぞれの「反映する」設定を見る）
     */
    const drawVideo = (ctx, source, dx, dy, w, h, { target = 'commentPip' } = {}) => {
        const use = isCanvasTarget(target);
        const filter = use && !bypass ? buildFilter() : 'none';
        const flipH = use && !!prop('flipH'), flipV = use && !!prop('flipV');
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, w, h);
        ctx.clip();
        if (filter !== 'none') {
            ctx.filter = filter;
        }
        if (flipH || flipV) {
            ctx.translate(dx + (flipH ? w : 0), dy + (flipV ? h : 0));
            ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
            ctx.drawImage(source, 0, 0, w, h);
        }
        else {
            ctx.drawImage(source, dx, dy, w, h);
        }
        ctx.restore();
        const alpha = use ? vignetteAlpha() : 0;
        if (alpha > 0) {
            const cx = dx + w / 2, cy = dy + h / 2;
            const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.hypot(w, h) / 2);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(0,0,0,${alpha})`);
            ctx.save();
            ctx.fillStyle = g;
            ctx.fillRect(dx, dy, w, h);
            ctx.restore();
        }
    };
    /** スクリーンショット用: 加工済みの新しい canvas を返す（加工が無ければそのまま返す） */
    const processCanvas = (canvas, { target = 'screenshot' } = {}) => {
        if (!isCanvasTarget(target)) {
            return canvas;
        }
        const filter = bypass ? 'none' : buildFilter();
        if (filter === 'none' && !prop('flipH') && !prop('flipV') && !vignetteAlpha()) {
            return canvas;
        }
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext('2d');
        drawVideo(ctx, canvas, 0, 0, canvas.width, canvas.height, { target });
        return out;
    };
    // ---- Task 080: 画面の左半分だけ元の映像を重ねて見比べる ----
    // フィルターは <video> 全体に CSS で掛かるので、左半分の上に「加工前の映像」を
    // canvas へ描いて重ねる（drawImage は加工前のフレームを描く）。反転中は反転して描く。
    const SPLIT_CLASS = 'zenzaScreenFilterSplit';
    const split = { on: false, raf: 0, canvas: null, ctx: null, lastKey: '', lastGeometryKey: '', lastDrawTime: 0, handle: null, dragging: false, pointerId: null, position: null };
    const getSplitPosition = () => {
        const value = split.position ?? Number(prop('splitPosition') ?? 50);
        return Number.isFinite(value) ? clamp(value, 0, 100) : 50;
    };
    const setSplitPosition = (value, persist = true) => {
        if (!Number.isFinite(value))
            return getSplitPosition();
        const position = Math.round(clamp(value, 0, 100));
        if (persist) {
            setProp('splitPosition', position);
            split.position = null;
        }
        else
            split.position = position;
        split.lastKey = '';
        return getSplitPosition();
    };
    const moveSplit = (event) => {
        if (!split.dragging || !split.canvas || event.pointerId !== split.pointerId)
            return;
        if (event.buttons === 0) {
            endSplitDrag();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const rect = split.canvas.getBoundingClientRect();
        if (rect.width)
            setSplitPosition((event.clientX - rect.left) / rect.width * 100, false);
    };
    const endSplitDrag = (event) => {
        if (!split.dragging)
            return;
        if (event && event.pointerId !== split.pointerId)
            return;
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (event?.type === 'pointerup')
            setSplitPosition(getSplitPosition());
        else
            split.position = null;
        split.dragging = false;
        split.lastKey = '';
        const pointerId = split.pointerId;
        split.pointerId = null;
        if (pointerId !== null && split.handle?.hasPointerCapture?.(pointerId))
            split.handle.releasePointerCapture(pointerId);
        window.removeEventListener('blur', cancelSplitDrag);
        window.removeEventListener('pointermove', moveSplit, true);
        window.removeEventListener('pointerup', endSplitDrag, true);
        window.removeEventListener('pointercancel', endSplitDrag, true);
    };
    const cancelSplitDrag = () => endSplitDrag();
    const ensureSplitHandle = (parent) => {
        if (!split.handle) {
            const handle = split.handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'zenzaScreenFilterSplitHandle';
            handle.setAttribute('role', 'slider');
            handle.setAttribute('aria-label', '左右比較の境界位置');
            handle.setAttribute('aria-valuemin', '0');
            handle.setAttribute('aria-valuemax', '100');
            handle.setAttribute('aria-orientation', 'horizontal');
            handle.textContent = '↔';
            handle.style.cssText = 'position:absolute;z-index:102;width:28px;height:44px;transform:translate(-50%,-50%);padding:0;border:1px solid #aaa;border-radius:5px;background:#18181cee;color:#fff;cursor:ew-resize;touch-action:none;pointer-events:auto;';
            handle.addEventListener('pointerdown', event => {
                if (event.button !== 0)
                    return;
                event.preventDefault();
                event.stopPropagation();
                split.dragging = true;
                split.pointerId = event.pointerId;
                try {
                    handle.setPointerCapture?.(event.pointerId);
                }
                catch { }
                window.addEventListener('blur', cancelSplitDrag);
                window.addEventListener('pointermove', moveSplit, true);
                window.addEventListener('pointerup', endSplitDrag, true);
                window.addEventListener('pointercancel', endSplitDrag, true);
            });
            handle.addEventListener('lostpointercapture', cancelSplitDrag);
            for (const name of ['click', 'dblclick', 'mousedown', 'mouseup', 'keyup'])
                handle.addEventListener(name, event => event.stopPropagation());
            handle.addEventListener('keydown', event => {
                event.stopPropagation();
                let next = getSplitPosition();
                if (event.key === 'ArrowLeft')
                    next -= event.shiftKey ? 10 : 1;
                else if (event.key === 'ArrowRight')
                    next += event.shiftKey ? 10 : 1;
                else if (event.key === 'Home')
                    next = 0;
                else if (event.key === 'End')
                    next = 100;
                else
                    return;
                event.preventDefault();
                setSplitPosition(next);
            });
        }
        if (split.handle.parentNode !== parent)
            parent.appendChild(split.handle);
        return split.handle;
    };
    const hideSplitCanvas = () => {
        if (split.canvas) {
            split.canvas.style.display = 'none';
        }
        if (split.handle)
            split.handle.hidden = true;
        endSplitDrag();
        split.lastKey = '';
    };
    const drawSplit = (timestamp) => {
        split.raf = 0;
        if (!split.on || typeof document === 'undefined') {
            return;
        }
        split.raf = requestAnimationFrame(drawSplit);
        const video = document.querySelector('.zenzaWatchVideoElement');
        const src = video && (video.drawableElement || video);
        const parent = video && video.parentNode;
        if (!src || !parent || !src.videoWidth || src.readyState < 2 || isStandard()) {
            hideSplitCanvas();
            return;
        }
        let canvas = split.canvas;
        if (!canvas || canvas.parentNode !== parent) {
            canvas = split.canvas || document.createElement('canvas');
            canvas.className = SPLIT_CLASS;
            canvas.style.cssText = 'position:absolute;z-index:7;pointer-events:none;';
            video.after(canvas);
            split.canvas = canvas;
            split.ctx = canvas.getContext('2d');
            split.lastKey = '';
        }
        const vw = src.videoWidth, vh = src.videoHeight;
        const ew = video.offsetWidth, eh = video.offsetHeight;
        if (!ew || !eh) {
            hideSplitCanvas();
            return;
        }
        const scale = Math.min(ew / vw, eh / vh);
        const cw = vw * scale, ch = vh * scale;
        const left = video.offsetLeft + (ew - cw) / 2, top = video.offsetTop + (eh - ch) / 2;
        const flipH = !!prop('flipH'), flipV = !!prop('flipV');
        const position = getSplitPosition();
        Object.assign(canvas.style, {
            display: 'block', left: `${left}px`, top: `${top}px`, width: `${cw}px`, height: `${ch}px`
        });
        // The touch cover is z10 inside videoPlayer (z100), with comments at z101.
        // Place only the small button above both; the rest of the video keeps its
        // normal hit targets. Measure the canvas after layout so small-mode motion
        // and scaling are reflected even while the video is paused.
        const handleParent = video.closest('.zenzaPlayerContainer') || parent;
        const handle = ensureSplitHandle(handleParent);
        handle.hidden = false;
        const picture = canvas.getBoundingClientRect(), bounds = handleParent.getBoundingClientRect();
        const scaleX = handleParent.offsetWidth ? bounds.width / handleParent.offsetWidth : 1;
        const scaleY = handleParent.offsetHeight ? bounds.height / handleParent.offsetHeight : 1;
        handle.style.left = `${(picture.left + picture.width * position / 100 - bounds.left) / (scaleX || 1) - handleParent.clientLeft + handleParent.scrollLeft}px`;
        handle.style.top = `${(picture.top + picture.height / 2 - bounds.top) / (scaleY || 1) - handleParent.clientTop + handleParent.scrollTop}px`;
        handle.setAttribute('aria-valuenow', String(position));
        const light = prop('renderQuality') === 'light';
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const geometryKey = [left, top, cw, ch, vw, vh, flipH, flipV, position, light, dpr].join(',');
        const key = [src.currentTime, geometryKey].join(',');
        if (key === split.lastKey) {
            return;
        }
        const now = typeof timestamp === 'number' ? timestamp : performance.now();
        // Keep pointer/keyboard edits immediate; only repeated video frames are
        // capped in light mode so the original-side copy stays inexpensive too.
        if (light && split.lastKey && geometryKey === split.lastGeometryKey && now - split.lastDrawTime < 1000 / 30)
            return;
        split.lastKey = key;
        split.lastGeometryKey = geometryKey;
        split.lastDrawTime = now;
        const copyScale = Math.min(cw * dpr / vw, ch * dpr / vh, 1, ...(light ? [854 / vw, 480 / vh] : []));
        const w = Math.max(1, Math.round(vw * copyScale));
        const h = Math.max(1, Math.round(vh * copyScale));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = split.ctx;
        const half = Math.round(w * position / 100);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, half, h);
        ctx.clip();
        ctx.translate(flipH ? w : 0, flipV ? h : 0);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(src, 0, 0, w, h);
        ctx.restore();
        // 境目の線と、左右それぞれの説明
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(half - 1, 0, 2, h);
        const fs = Math.max(11, Math.round(h / 30));
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.textBaseline = 'top';
        const label = (text, x, align) => {
            ctx.textAlign = align;
            ctx.lineWidth = Math.max(2, fs / 5);
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeText(text, x, fs * 0.6);
            ctx.fillStyle = '#fff';
            ctx.fillText(text, x, fs * 0.6);
        };
        label('元の映像', half - fs * 0.6, 'right');
        label('エフェクト', half + fs * 0.6, 'left');
    };
    const setSplit = (v) => {
        split.on = !!v;
        if (split.on) {
            !split.raf && (split.raf = requestAnimationFrame(drawSplit));
        }
        else {
            split.raf && cancelAnimationFrame(split.raf);
            split.raf = 0;
            hideSplitCanvas();
        }
        emitChange();
        return split.on;
    };
    const initialize = (playerConfig) => {
        if (config === playerConfig) {
            return;
        }
        config = playerConfig;
        // Task 080: 「使う」を OFF にしていた人の移行。値は ON/OFF 切り替え用に保存して、標準に戻す
        if (prop('enable') === false) {
            const values = read();
            if (!isStandard(values)) {
                saveValues(values);
            }
            PARAMS.forEach(p => setProp(p.key, p.def));
            setProp('enable', true);
        }
        // 反転は従来通り「ページを開き直すと元に戻る」扱いにする（ずっと反転したままの事故防止）
        setProp('flipH', false);
        setProp('flipV', false);
        historyPast.length = 0;
        historyFuture.length = 0;
        historyCurrent = snapshot();
        if (config && typeof config.on === 'function') {
            config.on('update', (key) => {
                if (typeof key === 'string' && key.startsWith(PREFIX)) {
                    scheduleApply();
                }
            });
        }
        apply();
    };
    return {
        PREFIX,
        PARAMS,
        PARAM_MAP,
        PRESETS,
        getPresetList,
        DEFAULTS,
        COLORIZE_MAPS,
        initialize,
        read,
        set,
        undo: () => stepHistory(true),
        redo: () => stepHistory(false),
        get canUndo() { recordHistory(); return historyPast.length > 0; },
        get canRedo() { recordHistory(); return historyFuture.length > 0; },
        preview,
        apply,
        applyPreset,
        isPresetActive,
        togglePreset,
        getUserPresets,
        saveUserPreset,
        deleteUserPreset,
        renameUserPreset,
        overwriteUserPreset,
        reset,
        nextPreset,
        adjust,
        detectPreset,
        isActive,
        buildFilter,
        buildSvgFilterMarkup,
        buildColorMatrix,
        buildToneTables,
        levelsToLinear,
        formatValue,
        normalize,
        execCommand,
        drawVideo,
        processCanvas,
        isEnabled,
        isStandard,
        setSplit,
        setSplitPosition,
        get splitPosition() { return getSplitPosition(); },
        get isSplit() { return split.on; },
        resetAutoLevels,
        get autoLevelsAvailable() { return auto.available; },
        get renderStatus() { return lowPowerStatus; },
        get flipH() { return !!prop('flipH'); },
        get flipV() { return !!prop('flipV'); },
        /** （旧）押している間だけ元の映像。Task 080 からパネルでは使っていない */
        setBypass(v) {
            bypass = !!v;
            apply();
        },
        get bypass() { return bypass; },
        onChange(fn) {
            typeof fn === 'function' && listeners.add(fn);
            return () => listeners.delete(fn);
        },
        /** テスト用 */
        _reset() {
            listeners.clear();
            lowPowerRenderer?.stop();
            lowPowerRenderer = null;
            lowPowerStatus = 'normal';
            historyPast.length = 0;
            historyFuture.length = 0;
            historyCurrent = null;
            config = null;
            bypass = false;
            lastCss = null;
            lastSvgKey = null;
            lastVignette = null;
            stopAutoLevels();
            auto.black = 0;
            auto.white = 1;
            auto.available = true;
            listeners.clear();
            split.on = false;
            if (split.raf)
                cancelAnimationFrame(split.raf);
            split.raf = 0;
            endSplitDrag();
            split.canvas?.remove();
            split.handle?.remove();
            split.canvas = null;
            split.ctx = null;
            split.handle = null;
            split.position = null;
        }
    };
})();
/*
 * プレイヤー内の「画面フィルター」パネル。
 * 動画を見ながら調整できるよう、画面の右上に小さく出す（動画は隠さない）。
 * 全画面の時は全画面の要素の中へ、それ以外は body へ置く（全画面中も見えるように）。
 */
const ScreenFilterPanel = (() => {
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
    const CSS = `
    .zenzaScreenFilterPanel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 960px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      overscroll-behavior: contain;
      z-index: 6060000;
      display: none;
      box-sizing: border-box;
      padding: 12px 14px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(24, 24, 28, 0.9);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      color: #ddd;
      font-size: 12px;
      line-height: 1.5;
      text-align: left;
      font-family: 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif;
      user-select: none;
    }
    .zenzaScreenFilterPanel.is-open {
      display: block;
      /* Task 080: 開く時のアニメーション。右下（エフェクトボタンの方向）から、
         少し縮んだ状態でふわっと広がる */
      transform-origin: var(--sf-origin, 100% 100%);
      animation: zenzaScreenFilterPanelIn 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
    }
    .zenzaScreenFilterPanel.is-open.is-closing {
      pointer-events: none;
      animation: zenzaScreenFilterPanelOut 0.16s ease-in both;
    }
    @keyframes zenzaScreenFilterPanelIn {
      from { opacity: 0; transform: translate(12px, 18px) scale(0.86); filter: blur(2px); }
      to   { opacity: 1; transform: none; filter: none; }
    }
    @keyframes zenzaScreenFilterPanelOut {
      from { opacity: 1; transform: none; }
      to   { opacity: 0; transform: translate(8px, 12px) scale(0.92); }
    }
    @media (prefers-reduced-motion: reduce) {
      .zenzaScreenFilterPanel.is-open,
      .zenzaScreenFilterPanel.is-open.is-closing { animation-duration: 0.01s; }
    }
    .zenzaScreenFilterPanel .sfSection {
      animation: zenzaScreenFilterSectionIn 0.3s ease-out both;
    }
    .zenzaScreenFilterPanel .sfSection:nth-of-type(2) { animation-delay: 0.03s; }
    .zenzaScreenFilterPanel .sfSection:nth-of-type(3) { animation-delay: 0.06s; }
    .zenzaScreenFilterPanel .sfSection:nth-of-type(4) { animation-delay: 0.09s; }
    .zenzaScreenFilterPanel .sfSection:nth-of-type(5) { animation-delay: 0.12s; }
    @keyframes zenzaScreenFilterSectionIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: none; }
    }
    .zenzaScreenFilterPanel button.is-on {
      background: #2d6a3e;
      border-color: #5fbf78;
      color: #fff;
    }
    .zenzaScreenFilterPanel * { box-sizing: border-box; }
    .zenzaScreenFilterPanel .sfHead {
      flex-shrink: 0;
      position: sticky;
      top: -12px;
      z-index: 3;
      flex-wrap: wrap;
      margin: -12px -14px 8px;
      padding: 12px 14px 8px;
      background: rgb(24, 24, 28);
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .zenzaScreenFilterPanel .sfTitle {
      font-size: 15px;
      font-weight: bold;
      color: #fff;
      flex: 1;
    }
    .zenzaScreenFilterPanel button {
      font-size: 12px;
      color: #eee;
      background: #3a3a44;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
    }
    .zenzaScreenFilterPanel button:hover { background: #4a4a58; }
    .zenzaScreenFilterPanel .sfIntro,
    .zenzaScreenFilterPanel .sfDesc,
    .zenzaScreenFilterPanel .sfNote {
      color: #aaa;
      font-size: 11px;
    }
    .zenzaScreenFilterPanel .sfSection {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .zenzaScreenFilterPanel .sfSectionTitle {
      font-weight: bold;
      color: #fff;
      margin-bottom: 2px;
    }
    .zenzaScreenFilterPanel .sfPresets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      margin-top: 4px;
    }
    .zenzaScreenFilterPanel .sfPresets button { text-align: left; }
    .zenzaScreenFilterPanel .sfUserPresetRow{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .zenzaScreenFilterPanel .sfUserPresetRow input,.zenzaScreenFilterPanel .sfUserPresetRow select{flex:1 1 160px;min-width:0;max-width:100%;box-sizing:border-box;font:inherit;color:#eee;background:#25252d;border:1px solid #666;border-radius:4px;padding:6px 8px}
    .zenzaScreenFilterPanel .sfUserPresetRow input:focus-visible,.zenzaScreenFilterPanel .sfUserPresetRow select:focus-visible{outline:2px solid #9cf;outline-offset:2px}
    .zenzaScreenFilterPanel .sfPresets button.is-current {
      background: #2d6a3e;
      border-color: #5fbf78;
      color: #fff;
    }
    .zenzaScreenFilterPanel .sfPresetState { margin-top: 4px; color: #9c9; font-size: 11px; }
    .zenzaScreenFilterPanel .sfRow { margin-top: 8px; }
    .zenzaScreenFilterPanel .sfRowHead {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .zenzaScreenFilterPanel .sfLabel { flex: 1; color: #eee; }
    .zenzaScreenFilterPanel .sfValue {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-family: monospace;
      color: #fff;
    }
    .zenzaScreenFilterPanel .sfNum {
      width: 62px;
      padding: 1px 3px;
      text-align: right;
      font: 12px monospace;
      color: inherit;
      background: #111;
      border: 1px solid #555;
      border-radius: 3px;
    }
    .zenzaScreenFilterPanel .sfUnit { min-width: 16px; color: #aaa; }
    .zenzaScreenFilterPanel .sfValue.is-changed .sfNum { color: #7fd38f; border-color: #4a8a58; }
    .zenzaScreenFilterPanel select.sfSelect {
      font-size: 12px;
      color: #eee;
      background: #111;
      border: 1px solid #555;
      border-radius: 3px;
      padding: 2px 4px;
    }
    .zenzaScreenFilterPanel .sfRowReset {
      padding: 0 6px;
      font-size: 11px;
    }
    .zenzaScreenFilterPanel input[type=range] {
      width: 100%;
      margin: 2px 0 0;
      cursor: pointer;
    }
    .zenzaScreenFilterPanel label.sfCheck {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      color: #eee;
    }
    .zenzaScreenFilterPanel .sfFoot {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 0 0 auto;
      justify-content: flex-end;
    }
    .zenzaScreenFilterPanel .sfTitleRow{display:contents}
    .zenzaScreenFilterPanel .sfTitleRow>button{order:2}
    .zenzaScreenFilterPanel .sfHead .sfTitle{flex:1 0 auto}
    .zenzaScreenFilterPanel .sfHead button{min-height:28px;white-space:nowrap}
    .zenzaScreenFilterPanel .sfHead .sfFoot{order:1}
    .zenzaScreenFilterPanel.sf-compact .sfTitleRow{display:flex;align-items:center;gap:6px;width:100%;min-width:0}
    .zenzaScreenFilterPanel.sf-compact .sfHead .sfFoot{width:100%;justify-content:flex-start}
    .zenzaScreenFilterPanel.sf-compact .sfHead button{padding-left:6px;padding-right:6px}
    .zenzaScreenFilterPanel .sfBody{display:grid;grid-template-columns:minmax(220px,30%) minmax(0,1fr);gap:18px;align-items:start}
    .zenzaScreenFilterPanel .sfBody>*{min-width:0}
    .zenzaScreenFilterPanel.sf-compact{width:380px}
    .zenzaScreenFilterPanel.sf-compact .sfBody{grid-template-columns:minmax(0,1fr)}
    .zenzaScreenFilterPanel .sfQuality{flex-shrink:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px}
    .zenzaScreenFilterPanel .sfQuality select{background:#111;color:#ddd;border:1px solid #555;padding:3px;font:inherit;max-width:100%}
    .zenzaScreenFilterPanel [data-render-status]{color:#ffcf99;font-size:11px}
    .zenzaScreenFilterPanel .sfAdjustColumn{padding-left:16px;border-left:1px solid rgba(255,255,255,.12)}
    .zenzaScreenFilterPanel .sfRows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:6px 18px;align-items:start}
    .zenzaScreenFilterPanel .sfRow{min-width:0}
    .zenzaScreenFilterPanel .sfRowHead{flex-wrap:wrap}
    .zenzaScreenFilterPanel .sfPresets button{min-width:0;overflow-wrap:anywhere}
    .zenzaScreenFilterPanel .sfUserPresetHead{display:flex;justify-content:space-between;align-items:center;gap:6px}
    .zenzaScreenFilterPanel .sfSavePreset{width:100%;margin-top:8px}
    .zenzaScreenFilterPanel .sfUserPresetForm{margin-top:8px}
    .zenzaScreenFilterPanel .sfUserPresetForm input{display:block;width:100%;min-width:0;color:#eee;background:#111;border:1px solid #555;border-radius:3px;padding:5px;font:inherit}
    .zenzaScreenFilterPanel .sfUserPresetStatus{font-size:11px;color:#9c9;margin-top:6px;overflow-wrap:anywhere}
    .zenzaScreenFilterPanel [data-user-preset-confirm]{margin-top:8px;overflow-wrap:anywhere}
    .zenzaScreenFilterPanel button.is-editing{outline:2px dashed #9c9;outline-offset:1px}
    .zenzaScreenFilterPanel .sfFold>summary{color:#fff;font-weight:bold;cursor:pointer}
    .zenzaScreenFilterPanel .sfFold>div{padding-top:6px}
    .zenzaScreenFilterPanel [hidden]{display:none!important}
    .zenzaScreenFilterPanel.sf-hide-descriptions .sfIntro,
    .zenzaScreenFilterPanel.sf-hide-descriptions .sfDesc,
    .zenzaScreenFilterPanel.sf-hide-descriptions .sfNote{display:none}
    @media(max-width:700px){
      .zenzaScreenFilterPanel .sfBody{grid-template-columns:1fr;gap:0}
      .zenzaScreenFilterPanel .sfAdjustColumn{border-left:0;padding-left:0}
      .zenzaScreenFilterPanel .sfRows{grid-template-columns:1fr}
      .zenzaScreenFilterPanel .sfHead .sfFoot{justify-content:flex-start;margin-left:0}
    }
    .zenzaScreenFilterPanel.is-disabled .sfAdjust { opacity: 0.45; }
    .zenzaScreenFilterPanel .sfDesc.is-unavailable::after {
      content: attr(data-unavailable);
      display: block;
      color: #ff9f8f;
    }
  `;
    const rowHtml = (p) => {
        if (p.type === 'boolean') {
            return `
        <div class="sfRow" data-key="${p.key}">
          <label class="sfCheck"><input type="checkbox" data-param="${p.key}"> ${esc(p.label)}</label>
          <div class="sfDesc">${esc(p.desc)}</div>
        </div>`;
        }
        if (p.type === 'select') {
            return `
        <div class="sfRow" data-key="${p.key}">
          <div class="sfRowHead">
            <span class="sfLabel">${esc(p.label)}</span>
            <select class="sfSelect" data-param="${p.key}">
              ${p.options.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join('')}
            </select>
          </div>
          <div class="sfDesc">${esc(p.desc)}</div>
        </div>`;
        }
        // Task 077c: つまみ（細かく1刻み）と、数字を直接入れられる欄の両方を置く
        return `
      <div class="sfRow" data-key="${p.key}">
        <div class="sfRowHead">
          <span class="sfLabel">${esc(p.label)}</span>
          <span class="sfValue">
            <input type="number" class="sfNum" data-num="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" title="数字を直接入力できます（Enterで決定）">
            <span class="sfUnit">${esc(p.unit || '')}</span>
          </span>
          <button type="button" class="sfRowReset" data-reset="${p.key}" title="この項目だけ元に戻す">↺</button>
        </div>
        <input type="range" data-param="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}">
        <div class="sfDesc">${esc(p.desc)}</div>
      </div>`;
    };
    const TEMPLATE = () => `
    <div class="sfHead">
      <span class="sfTitle">画面フィルター</span>
    </div>
    <div class="sfIntro">
      動画の映像だけに効きます（コメントやボタンには効きません）。
      設定は全部の動画で共通で、次に開いた時も残ります。
      プリセット「標準」の時がOFFです（何も処理しません）。それ以外を選ぶと自動でONになります。
    </div>
    <div class="sfSection">
      <div class="sfSectionTitle">かんたん設定（プリセット）</div>
      <div class="sfDesc">迷ったらここから選んでください。選んだあとに下のつまみで微調整もできます。</div>
      <div class="sfPresets">
        ${ScreenFilter.PRESETS.map(p => `<button type="button" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`).join('')}
      </div>
      <div class="sfPresetState"></div>
      <div class="sfNote">
        ボタンにマウスを乗せると、それぞれの説明が出ます。
        ぼかし・輪郭の強調・追加エフェクトは負荷が増えます。追加エフェクトでカクつく場合は、
        描画品質の「軽量」を試してください。処理量を抑える代わりに、解像度と更新頻度が下がります。
      </div>
    </div>
    <div class="sfSection sfUserPresets">
      <div class="sfUserPresetHead"><div class="sfSectionTitle">マイプリセット</div><button type="button" data-action="edit-user-presets" aria-pressed="false">編集</button></div>
      <div class="sfDesc">今の色・明るさ・画質を名前付きで保存します（20件まで）。反転や反映する場所は含みません。</div>
      <div class="sfPresets" data-user-preset-buttons></div>
      <button type="button" class="sfSavePreset" data-action="new-user-preset">＋ 今の設定を保存</button>
      <div class="sfUserPresetForm" data-user-preset-new hidden>
        <label>新しいプリセット名<input type="text" data-user-preset-name maxlength="40" placeholder="例：夜に見る動画"></label>
        <div class="sfUserPresetRow"><button type="button" data-action="save-user-preset">保存する</button><button type="button" data-action="cancel-user-preset">キャンセル</button></div>
      </div>
      <div class="sfUserPresetForm" data-user-preset-edit hidden>
        <label>編集するプリセット名<input type="text" data-user-preset-rename maxlength="40"></label>
        <div class="sfUserPresetRow"><button type="button" data-action="rename-user-preset">名前を変更</button><button type="button" data-action="overwrite-user-preset">今の設定で上書き</button><button type="button" data-action="delete-user-preset">削除</button></div>
      </div>
      <div data-user-preset-confirm hidden>
        <div data-user-preset-confirm-text></div>
        <div class="sfUserPresetRow"><button type="button" data-action="confirm-user-preset">確定</button><button type="button" data-action="cancel-confirm-user-preset">キャンセル</button></div>
      </div>
      <div class="sfUserPresetStatus" data-user-preset-status role="status" aria-live="polite"></div>
    </div>
    <div class="sfSection sfAdjust">
      <div class="sfSectionTitle">色と明るさ</div>
      <div class="sfNote">つまみは1刻みで動かせます。右の数字の欄に直接入力もできます（キーボードの←→でも1ずつ動きます）。</div>
      ${ScreenFilter.PARAMS.filter(p => p.group === 'basic').map(rowHtml).join('')}
    </div>
    <div class="sfSection sfAdjust">
      <div class="sfSectionTitle">明暗・画質の細かい調整（暗い動画向け）</div>
      ${ScreenFilter.PARAMS.filter(p => p.group === 'tone').map(rowHtml).join('')}
    </div>
    <div class="sfSection sfAdjust">
      <div class="sfSectionTitle">雰囲気</div>
      ${ScreenFilter.PARAMS.filter(p => p.group === 'style').map(rowHtml).join('')}
    </div>
    <div class="sfSection">
      <div class="sfSectionTitle">変形（反転）</div>
      <label class="sfCheck"><input type="checkbox" data-setting="flipH"> 左右反転（鏡のように左右を入れ替える）</label>
      <label class="sfCheck"><input type="checkbox" data-setting="flipV"> 上下反転（上下をさかさまにする）</label>
      <div class="sfDesc">反転はページを開き直すと元に戻ります。「標準に戻す」をしても反転はそのままです。</div>
    </div>
    <div class="sfSection">
      <div class="sfSectionTitle">フィルターを反映する場所</div>
      <label class="sfCheck"><input type="checkbox" data-setting="applyToScreenshot"> スクリーンショットにも反映する</label>
      <label class="sfCheck"><input type="checkbox" data-setting="applyToCommentPip"> P in P(コメント付き) にも反映する</label>
      <div class="sfNote">
        通常の P in P は、ブラウザが動画をそのまま小窓に出す仕組みのため、フィルターは反映されません。
      </div>
    </div>
    <div class="sfFoot">
      <button type="button" data-action="reset" title="すべての調整を標準に戻し、左右比較を終了します（反転はそのまま）">すべて標準に戻す</button>
      <button type="button" data-action="split" title="画面の左半分に元の映像、右半分にエフェクトを掛けた映像を並べて見比べます（もう一度押すと元に戻ります）">左右で見比べる</button>
    </div>
  `;
    class Panel {
        _presetEditing = false;
        _editingPresetId = '';
        _pendingPresetAction = null;
        constructor({ config }) {
            this.config = config;
            this.view = null;
            this._onFullscreenChange = this._onFullscreenChange.bind(this);
            this._refresh = this._refresh.bind(this);
        }
        _initializeDom() {
            if (this.view) {
                return;
            }
            if (!document.getElementById('zenzaScreenFilterPanelStyle')) {
                const style = document.createElement('style');
                style.id = 'zenzaScreenFilterPanelStyle';
                style.textContent = CSS;
                (document.head || document.documentElement).append(style);
            }
            const view = this.view = document.createElement('div');
            // zen-family: Zenza は再生中、body直下の zen-family 以外の要素の中身を
            // pointer-events: none にしている（裏のページの無効化）。付けないとパネルが操作できない。
            view.className = 'zenzaScreenFilterPanel zen-family';
            view.innerHTML = TEMPLATE();
            const header = view.querySelector('.sfHead');
            const titleRow = document.createElement('div');
            titleRow.className = 'sfTitleRow';
            titleRow.append(header.querySelector('.sfTitle'));
            header.append(titleRow);
            const actions = view.querySelector('.sfFoot');
            header.append(actions);
            const descriptions = document.createElement('button');
            descriptions.type = 'button';
            descriptions.dataset.action = 'toggle-descriptions';
            actions.append(descriptions);
            for (const [action, label, title] of [['toggle-adjustments', '調整欄を隠す', '調整欄の表示を切り替える'], ['undo', '↶', '一つ前に戻す'], ['redo', '↷', '一つ先に進む'], ['toggle-changed-only', '変更した項目だけ表示', '変更した項目だけ表示']]) {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.action = action;
                button.textContent = label;
                button.title = title;
                button.setAttribute('aria-label', title);
                (action === 'toggle-changed-only' ? actions : titleRow).append(button);
            }
            const body = document.createElement('div');
            body.className = 'sfBody';
            const presets = document.createElement('div');
            presets.className = 'sfPresetColumn';
            const adjustments = document.createElement('div');
            adjustments.className = 'sfAdjustColumn';
            presets.append(view.querySelector('.sfIntro'));
            const quality = document.createElement('div');
            quality.className = 'sfQuality';
            quality.innerHTML = '<label>追加エフェクトの描画品質 <select data-render-quality><option value="normal">通常（元の解像度）</option><option value="light">軽量（最大480p・30fps）</option></select></label><span data-render-status role="status" aria-live="polite"></span>';
            header.after(quality);
            const sections = Array.from(view.querySelectorAll(':scope > .sfSection'));
            for (const [index, section] of sections.entries()) {
                if (index < 2) {
                    presets.append(section);
                    continue;
                }
                const rows = document.createElement('div');
                rows.className = 'sfRows';
                section.querySelectorAll(':scope > .sfRow').forEach(row => rows.append(row));
                if (rows.childElementCount)
                    section.append(rows);
                if (index > 2) {
                    const details = document.createElement('details');
                    details.className = 'sfSection sfFold';
                    const title = section.querySelector('.sfSectionTitle');
                    const summary = document.createElement('summary');
                    summary.textContent = title.textContent;
                    title.remove();
                    section.classList.remove('sfSection');
                    details.append(summary, section);
                    adjustments.append(details);
                }
                else
                    adjustments.append(section);
            }
            const empty = document.createElement('div');
            empty.dataset.changedEmpty = '';
            empty.textContent = '変更した項目はありません。';
            empty.hidden = true;
            adjustments.prepend(empty);
            body.append(presets, adjustments);
            view.append(body);
            // 全画面中はプレイヤーの中に置かれるため、クリック等がプレイヤー側
            // （再生/一時停止の切り替え・preventDefault）へ伝わらないようにする。
            ['click', 'dblclick', 'mousedown', 'mouseup', 'wheel', 'contextmenu', 'keydown', 'keyup']
                .forEach(name => view.addEventListener(name, e => e.stopPropagation()));
            // Esc でパネルだけ閉じる（プレイヤー自体は閉じない）
            view.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.close();
                }
            });
            view.addEventListener('input', e => {
                const key = e.target.dataset.param;
                if (key && e.target.type === 'range') {
                    ScreenFilter.preview(key, e.target.value);
                    this._updateValueLabel(key, ScreenFilter.normalize(key, e.target.value), { force: true });
                }
            });
            view.addEventListener('change', e => {
                if (e.target.hasAttribute('data-render-quality')) {
                    try {
                        const value = e.target.value;
                        if (this.config.readonly)
                            throw new Error();
                        this.config.props['screenFilter.renderQuality'] = value;
                        if (this.config.props['screenFilter.renderQuality'] !== value)
                            throw new Error();
                        ScreenFilter.apply();
                        this._refresh();
                    }
                    catch {
                        view.querySelector('[data-render-status]').textContent = '描画品質を保存できませんでした。';
                    }
                    return;
                }
                const { param, setting, num } = e.target.dataset;
                if (num) {
                    const v = ScreenFilter.normalize(num, e.target.value);
                    e.target.value = v;
                    ScreenFilter.set(num, v);
                    const range = this.view.querySelector(`input[type=range][data-param="${num}"]`);
                    range && (range.value = v);
                    if (!ScreenFilter.isEnabled()) {
                        this.config.props['screenFilter.enable'] = true;
                    }
                }
                else if (param) {
                    ScreenFilter.set(param, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
                    if (!ScreenFilter.isEnabled()) {
                        this.config.props['screenFilter.enable'] = true;
                    }
                }
                else if (setting) {
                    this.config.props[`screenFilter.${setting}`] = !!e.target.checked;
                }
            });
            view.addEventListener('click', e => {
                const target = e.target.closest('button');
                if (!target) {
                    return;
                }
                const { preset, reset, action } = target.dataset;
                if (action === 'edit-user-presets' || action?.endsWith('-user-preset')) {
                    this._handleUserPresetAction(action);
                }
                else if (action === 'undo' || action === 'redo') {
                    (action === 'undo' ? ScreenFilter.undo : ScreenFilter.redo)();
                    this._refresh();
                }
                else if (action === 'toggle-adjustments') {
                    try {
                        const value = this.config.props['screenFilter.showAdjustments'] === false;
                        if (this.config.readonly)
                            throw new Error();
                        this.config.props['screenFilter.showAdjustments'] = value;
                        if (this.config.props['screenFilter.showAdjustments'] !== value)
                            throw new Error();
                        this._refresh();
                        this._updateOrigin();
                    }
                    catch {
                        this.view.querySelector('[data-render-status]').textContent = '調整欄の表示設定を保存できませんでした。';
                    }
                }
                else if (action === 'toggle-changed-only') {
                    this.config.props['screenFilter.changedOnly'] = !this.config.props['screenFilter.changedOnly'];
                    this._refresh();
                }
                else if (action === 'toggle-descriptions') {
                    const value = this.config.props['screenFilter.showDescriptions'] === false;
                    try {
                        if (this.config.readonly)
                            throw new Error();
                        this.config.props['screenFilter.showDescriptions'] = value;
                        if (this.config.props['screenFilter.showDescriptions'] !== value)
                            throw new Error();
                        this._refresh();
                    }
                    catch {
                        this.view.querySelector('[data-user-preset-status]').textContent = '説明の表示設定を保存できませんでした。';
                    }
                }
                else if (preset) {
                    if (this._presetEditing && target.hasAttribute('data-user-preset')) {
                        this._editingPresetId = preset;
                        this._pendingPresetAction = null;
                        const saved = ScreenFilter.getUserPresets().find(p => p.id === preset);
                        if (saved)
                            view.querySelector('[data-user-preset-rename]').value = saved.label;
                        this._refreshUserPresets();
                    }
                    else {
                        ScreenFilter.togglePreset(preset);
                        this._refresh();
                    }
                }
                else if (reset) {
                    ScreenFilter.set(reset, ScreenFilter.PARAM_MAP[reset].def);
                }
                else if (action === 'reset') {
                    ScreenFilter.reset();
                    ScreenFilter.setSplit(false);
                }
                else if (action === 'split') {
                    ScreenFilter.setSplit(!ScreenFilter.isSplit);
                }
            });
            // Task 080: パネルの外を押したら閉じる（エフェクトボタン自身は除く。ボタンは開閉の切り替え）。
            // 動画の上を押して閉じた時は、その1回のクリックで再生/一時停止が切り替わらないようにする。
            this._onOutsidePointerDown = (e) => {
                if (!this.isOpen || this.view.classList.contains('is-closing')) {
                    return;
                }
                const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
                if (path.includes(this.view)) {
                    return;
                }
                if (path.some((el) => el && el.classList && (el.classList.contains('screenFilterSwitch') || el.classList.contains('zenzaScreenFilterSplitHandle')))) {
                    return;
                }
                const onVideo = path.some((el) => el && el.classList &&
                    (el.classList.contains('videoPlayer') || el.classList.contains('commentLayerFrame')));
                this.close();
                if (onVideo) {
                    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
                    window.addEventListener('click', swallow, { capture: true, once: true });
                    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 600);
                }
            };
            ScreenFilter.onChange(this._refresh);
            document.addEventListener('fullscreenchange', this._onFullscreenChange);
            document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
        }
        _updateValueLabel(key, value, { force = false } = {}) {
            const row = this.view.querySelector(`.sfRow[data-key="${key}"]`);
            const label = row && row.querySelector('.sfValue');
            const num = label && label.querySelector('.sfNum');
            if (!num) {
                return;
            }
            if (force || document.activeElement !== num) {
                num.value = value;
            }
            label.classList.toggle('is-changed', Math.abs(value - ScreenFilter.PARAM_MAP[key].def) > 1e-6);
        }
        _handleUserPresetAction(action) {
            const q = (selector) => this.view.querySelector(selector);
            const status = q('[data-user-preset-status]');
            try {
                if (action === 'new-user-preset') {
                    q('[data-user-preset-new]').hidden = false;
                    q('[data-user-preset-name]').focus();
                }
                else if (action === 'cancel-user-preset') {
                    q('[data-user-preset-new]').hidden = true;
                }
                else if (action === 'save-user-preset') {
                    const saved = ScreenFilter.saveUserPreset(q('[data-user-preset-name]').value);
                    q('[data-user-preset-name]').value = '';
                    q('[data-user-preset-new]').hidden = true;
                    status.textContent = `「${saved.label}」を保存しました。`;
                    this._refresh();
                }
                else if (action === 'edit-user-presets') {
                    this._presetEditing = !this._presetEditing;
                    this._editingPresetId = '';
                    this._pendingPresetAction = null;
                    q('[data-user-preset-new]').hidden = true;
                    status.textContent = this._presetEditing ? '編集するマイプリセットを選んでください。' : '';
                }
                else if (action === 'rename-user-preset') {
                    ScreenFilter.renameUserPreset(this._editingPresetId, q('[data-user-preset-rename]').value);
                    status.textContent = '名前を変更しました。';
                }
                else if (action === 'overwrite-user-preset' || action === 'delete-user-preset') {
                    const saved = ScreenFilter.getUserPresets().find(p => p.id === this._editingPresetId);
                    if (!saved)
                        throw new Error('編集するマイプリセットを選んでください。');
                    this._pendingPresetAction = { action, id: saved.id };
                    q('[data-user-preset-confirm-text]').textContent = action === 'delete-user-preset' ? `「${saved.label}」を削除しますか？` : `「${saved.label}」を今の調整値で上書きしますか？`;
                }
                else if (action === 'cancel-confirm-user-preset') {
                    this._pendingPresetAction = null;
                }
                else if (action === 'confirm-user-preset' && this._pendingPresetAction) {
                    const pending = this._pendingPresetAction;
                    if (pending.action === 'delete-user-preset') {
                        ScreenFilter.deleteUserPreset(pending.id);
                        this._editingPresetId = '';
                        status.textContent = '削除しました。現在の映像の調整はそのままです。';
                    }
                    else {
                        ScreenFilter.overwriteUserPreset(pending.id);
                        status.textContent = '今の調整値で上書きしました。';
                    }
                    this._pendingPresetAction = null;
                    this._refresh();
                }
                this._refreshUserPresets();
            }
            catch (error) {
                status.textContent = error instanceof Error ? error.message : 'マイプリセットを保存できませんでした。';
            }
        }
        _refreshUserPresets() {
            const q = (selector) => this.view.querySelector(selector);
            const list = q('[data-user-preset-buttons]');
            try {
                const order = ScreenFilter.getPresetList().map(p => p.id);
                const presets = ScreenFilter.getUserPresets().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
                const signature = JSON.stringify(presets.map(p => [p.id, p.label]));
                if (list.dataset.signature !== signature) {
                    list.replaceChildren();
                    for (const preset of presets) {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.dataset.preset = preset.id;
                        button.dataset.userPreset = '';
                        button.textContent = preset.label;
                        list.append(button);
                    }
                    if (!presets.length) {
                        const empty = document.createElement('span');
                        empty.textContent = 'まだ保存されていません';
                        list.append(empty);
                    }
                    list.dataset.signature = signature;
                }
                if (!presets.some(p => p.id === this._editingPresetId)) {
                    this._editingPresetId = '';
                    this._pendingPresetAction = null;
                }
                list.querySelectorAll('button').forEach((button) => {
                    button.classList.toggle('is-editing', this._presetEditing && button.dataset.preset === this._editingPresetId);
                    button.classList.toggle('is-current', ScreenFilter.isPresetActive(button.dataset.preset || ''));
                    button.setAttribute('aria-pressed', String(ScreenFilter.isPresetActive(button.dataset.preset || '')));
                });
            }
            catch (error) {
                q('[data-user-preset-status]').textContent = error instanceof Error ? error.message : '保存データを読み込めません。';
            }
            const edit = q('[data-action="edit-user-presets"]');
            edit.textContent = this._presetEditing ? '編集を終了' : '編集';
            edit.setAttribute('aria-pressed', String(this._presetEditing));
            q('[data-action="new-user-preset"]').hidden = this._presetEditing;
            q('[data-user-preset-edit]').hidden = !this._presetEditing || !this._editingPresetId;
            q('[data-user-preset-confirm]').hidden = !this._pendingPresetAction;
        }
        _refresh() {
            if (!this.view || !this.isOpen) {
                return;
            }
            this._refreshUserPresets();
            const values = ScreenFilter.read();
            const props = this.config.props;
            const showAdjustments = props['screenFilter.showAdjustments'] !== false;
            this.view.classList.toggle('sf-compact', !showAdjustments);
            this.view.querySelector('.sfAdjustColumn').hidden = !showAdjustments;
            const adjustmentButton = this.view.querySelector('[data-action="toggle-adjustments"]');
            adjustmentButton.textContent = showAdjustments ? '調整欄を隠す' : '調整欄を表示';
            adjustmentButton.setAttribute('aria-expanded', String(showAdjustments));
            this.view.querySelector('[data-render-quality]').value = props['screenFilter.renderQuality'] === 'light' ? 'light' : 'normal';
            const qualityStatus = {
                active: '軽量で描画中（最大480p・30fps）',
                waiting: '軽量描画の映像を待っています。',
                hidden: '非表示中は軽量描画を停止しています。',
                unsupported: 'この映像は軽量描画に対応していません。元の映像を表示しています。',
                unavailable: '軽量描画を実行できませんでした。元の映像を表示しています。'
            };
            this.view.querySelector('[data-render-status]').textContent = qualityStatus[ScreenFilter.renderStatus] || '';
            const changedOnly = !!props['screenFilter.changedOnly'];
            const changedButton = this.view.querySelector('[data-action="toggle-changed-only"]');
            changedButton.hidden = !showAdjustments;
            changedButton.setAttribute('aria-pressed', String(changedOnly));
            changedButton.classList.toggle('is-on', changedOnly);
            this.view.querySelector('[data-action="undo"]').disabled = !ScreenFilter.canUndo;
            this.view.querySelector('[data-action="redo"]').disabled = !ScreenFilter.canRedo;
            for (const p of ScreenFilter.PARAMS) {
                const row = this.view.querySelector(`.sfRow[data-key="${p.key}"]`);
                if (row)
                    row.hidden = changedOnly && values[p.key] === p.def;
            }
            const rows = Array.from(this.view.querySelectorAll('.sfAdjustColumn .sfRow[data-key]'));
            this.view.querySelector('[data-changed-empty]').hidden = !changedOnly || rows.some(row => !row.hidden);
            for (const section of Array.from(this.view.querySelectorAll('.sfAdjustColumn > .sfSection'))) {
                const parameters = Array.from(section.querySelectorAll('.sfRow[data-key]'));
                section.hidden = changedOnly && parameters.length > 0 && parameters.every(row => row.hidden);
                if (changedOnly && section.tagName === 'DETAILS' && !section.hidden)
                    section.open = true;
            }
            const builtin = this.view.querySelector('.sfPresetColumn .sfPresets');
            const presetOrder = ScreenFilter.getPresetList().filter(p => !p.user).map(p => p.id);
            const orderSignature = JSON.stringify(presetOrder);
            if (builtin.dataset.order !== orderSignature) {
                for (const id of presetOrder) {
                    const button = builtin.querySelector(`[data-preset="${id}"]`);
                    if (button)
                        builtin.append(button);
                }
                builtin.dataset.order = orderSignature;
            }
            const descriptions = props['screenFilter.showDescriptions'] !== false;
            this.view.classList.toggle('sf-hide-descriptions', !descriptions);
            const descriptionButton = this.view.querySelector('[data-action="toggle-descriptions"]');
            descriptionButton.textContent = descriptions ? '説明を非表示' : '説明を表示';
            descriptionButton.setAttribute('aria-pressed', String(descriptions));
            ScreenFilter.PARAMS.forEach(p => {
                const input = this.view.querySelector(`[data-param="${p.key}"]`);
                if (!input) {
                    return;
                }
                if (p.type === 'boolean') {
                    input.checked = !!values[p.key];
                }
                else if (p.type === 'select') {
                    input.value = values[p.key];
                }
                else {
                    // 操作中（フォーカス中）のつまみは書き換えない。ドラッグ中はプレビューだけで
                    // まだ保存していないため、ここで保存値に戻すとつまみが跳ね返ってしまう。
                    if (document.activeElement !== input) {
                        input.value = values[p.key];
                        this._updateValueLabel(p.key, values[p.key]);
                    }
                }
            });
            this.view.querySelectorAll('[data-setting]').forEach((input) => {
                const name = input.dataset.setting;
                const v = props[`screenFilter.${name}`];
                input.checked = v === undefined ? name !== 'flipH' && name !== 'flipV' : !!v;
            });
            const current = ScreenFilter.detectPreset(values);
            this.view.querySelectorAll('[data-preset]').forEach((button) => {
                const active = ScreenFilter.isPresetActive(button.dataset.preset || '');
                button.classList.toggle('is-current', active);
                button.setAttribute('aria-pressed', String(active));
            });
            let userPresets = [];
            try {
                userPresets = ScreenFilter.getUserPresets();
            }
            catch { /* Keep the built-in controls usable. */ }
            const preset = [...ScreenFilter.PRESETS, ...userPresets].find(p => p.id === current);
            this.view.querySelector('.sfPresetState').textContent = preset ?
                `いまの設定: ${preset.label}` : 'いまの設定: 手動で調整中（どのプリセットとも違う値）';
            const autoRow = this.view.querySelector('.sfRow[data-key="autoLevels"] .sfDesc');
            if (autoRow) {
                autoRow.classList.toggle('is-unavailable', !ScreenFilter.autoLevelsAvailable);
                autoRow.dataset.unavailable = ScreenFilter.autoLevelsAvailable ? '' : 'この動画では使えません（配信元が映像の読み取りを許可していないため）';
            }
            const splitButton = this.view.querySelector('[data-action="split"]');
            if (splitButton) {
                splitButton.classList.toggle('is-on', ScreenFilter.isSplit);
                splitButton.setAttribute('aria-pressed', String(ScreenFilter.isSplit));
            }
        }
        _getParentNode() {
            const fs = document.fullscreenElement || document.webkitFullscreenElement;
            return fs || document.body;
        }
        _onFullscreenChange() {
            if (!this.view || !this.isOpen) {
                return;
            }
            const parent = this._getParentNode();
            if (this.view.parentNode !== parent) {
                parent.append(this.view);
            }
        }
        get isOpen() {
            return !!(this.view && this.view.classList.contains('is-open') &&
                !this.view.classList.contains('is-closing'));
        }
        open() {
            this._initializeDom();
            const parent = this._getParentNode();
            if (this.view.parentNode !== parent) {
                parent.append(this.view);
            }
            clearTimeout(this._closeTimer);
            this.view.classList.remove('is-closing');
            this._updateOrigin();
            // アニメーションを毎回最初から再生するため、一度外してから付け直す
            this.view.classList.remove('is-open');
            void this.view.offsetWidth;
            this.view.classList.add('is-open');
            this._refresh();
            window.addEventListener('pointerdown', this._onOutsidePointerDown, { capture: true });
        }
        /** エフェクトボタンがある方向からパネルが出てくるように、変形の起点を合わせる */
        _updateOrigin() {
            const button = document.querySelector('.screenFilterSwitch');
            const rect = button && button.getBoundingClientRect();
            if (!rect || !rect.width) {
                this.view.style.removeProperty('--sf-origin');
                return;
            }
            const vw = window.innerWidth, vh = window.innerHeight;
            const panelW = this.view.getBoundingClientRect().width || Math.min(960, vw - 32);
            const panelLeft = vw - 16 - panelW;
            const x = Math.max(0, Math.min(100, ((rect.left + rect.width / 2) - panelLeft) / panelW * 100));
            const y = rect.top > vh / 2 ? 100 : 0;
            this.view.style.setProperty('--sf-origin', `${x.toFixed(1)}% ${y}%`);
        }
        close() {
            if (!this.view || !this.isOpen) {
                return;
            }
            window.removeEventListener('pointerdown', this._onOutsidePointerDown, { capture: true });
            this.view.classList.add('is-closing');
            clearTimeout(this._closeTimer);
            this._closeTimer = setTimeout(() => {
                this.view.classList.remove('is-open', 'is-closing');
            }, 170);
            ScreenFilter.bypass && ScreenFilter.setBypass(false);
        }
        toggle() {
            this.isOpen ? this.close() : this.open();
        }
    }
    return Panel;
})();
//===END===
export {
  ScreenFilter,
  ScreenFilterPanel
};

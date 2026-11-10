// GENERATED FROM tools/typescript-stage1/hls-src/HlsDebugElements.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
function defineHlsDebugElements(config, { html, render, Storage, HTMLDialogElement }) {
    const window = globalThis.window;
    const console = window.console;
    const Array = window.PureArray || window.Array;
    const existing = window.customElements?.get('video-debug-dialog');
    if (existing) {
        return existing;
    }
    if (!HTMLDialogElement || !window.customElements) {
        return;
    }
    class VideoDebugInput extends HTMLElement {
        static get observedAttributes() { return ['value']; }
        static get props() {
            return [
                { name: 'name', type: 'string' },
                { name: 'value', type: 'string' },
            ];
        }
        constructor() {
            super();
            this._props = {};
            this.constructor.props.forEach(({ name, type }) => {
                const attr = this.getAttribute(name);
                switch (type) {
                    case 'boolean':
                        this._props[name] = attr === 'true';
                        break;
                    case 'number':
                        if (!attr) {
                            return;
                        }
                        this._props[name] = parseFloat(attr);
                        break;
                    default:
                        this._props[name] = attr;
                }
            });
            this._shadow = this.attachShadow({ mode: 'open' });
            render(this.html(this._props), this._shadow);
            this._input = this._shadow.querySelector('input');
            this._root = this._shadow.querySelector('.root, input');
            this._details = this._shadow.querySelector('.details');
            this._detailsText = this._shadow.querySelector('.detailsText');
            const details = (this.getAttribute('details') || '').trim();
            this._details.hidden = !details;
            if (details) {
                this._detailsText.innerHTML = details.replace(/\n/g, '<br>');
            }
            const text = (this.getAttribute('text') || '').trim();
            if (text) {
                this._root.querySelector('.labelText').textContent = text;
            }
        }
        html(props) {
            return html `
            <input name="${props.name}" value="${props.value}">
            `;
        }
        set defaultValue(v) {
            this._defaultValue = v;
            this.setAttribute('default-value', v);
            this._root.classList.toggle('is-changed', this.value !== this.defaultValue);
        }
        set value(v) {
            if (this._props.value === v) {
                return;
            }
            this._props.value = v;
            this._input.value = v;
            this.setAttribute('value', v);
            this._input.setAttribute('data-value', v);
            this._root.classList.toggle('is-changed', this.value !== this.defaultValue);
            this.dispatchEvent(new Event('change'));
        }
        get name() {
            return this._props.name || '';
        }
        get value() {
            return this._props.value;
        }
        get defaultValue() {
            return this._defaultValue;
        }
        reset() {
            this.value = this.defaultValue;
        }
        attributeChangedCallback(attrName, oldVal, newVal) {
            if (attrName === 'value' && oldVal !== newVal) {
                this.value = newVal;
            }
        }
    }
    class VideoDebugCheckbox extends VideoDebugInput {
        static get props() {
            return [
                { name: 'name', type: 'string' },
                { name: 'value', type: 'boolean' }
            ];
        }
        constructor() {
            super();
            this._input.checked = this._props.value;
            this._input.addEventListener('change', () => {
                this.value = this._input.checked;
            });
        }
        html(props) {
            return html `
            <style>
              .root {
                display: block;
                position: relative;
                white-space: nowrap;
                padding: 8px 8px 16px;
              }

              .labelText {
                display: inline-block;
                text-align: right;
                font-family: monospace;
                padding: 0 8px;
              }

              .is-changed .labelText {
                font-weight: bolder;
                color: blue;
              }

              input[type=checkbox] {
                transform: scale(2);
                margin-right: 8px;
              }

              label {
                min-width: 300px;
                padding: 8px;
                cursor: pointer;
              }

              label:hover {
              }

              .details {
                padding-left: 16px;
              }
              .summary {
                outline: 0
              }
              .detailsText {
                color: #666;
              }


            </style>
            <div class="root">
              <label>
              <input type="checkbox" name="${props.name}">
                <span class="labelText">${props.name}<content></content></span>
              </label>
              <slot></slot>
              <details class="details">
                <summary class="summary">詳細</summary>
                <div class="detailsText"></div>
              </details>

            </div>
            `;
        }
        set value(v) {
            v = typeof v === 'boolean' ? v : (v === 'true');
            if (this._props.value === v) {
                return;
            }
            this._props.value = v;
            this._input.checked = v;
            this.setAttribute('value', v);
            this._root.classList.toggle('is-changed', v !== this.defaultValue);
            this.dispatchEvent(new Event('change'));
        }
        get value() {
            return this._props.value;
        }
    }
    if (!window.customElements.get('video-debug-checkbox')) {
        window.customElements.define('video-debug-checkbox', VideoDebugCheckbox);
    }
    class VideoDebugSlider extends VideoDebugInput {
        static get props() {
            return [
                { name: 'name', type: 'string' },
                { name: 'value', type: 'number' },
                { name: 'min', type: 'number' },
                { name: 'max', type: 'number' },
                { name: 'step', type: 'number' }
            ];
        }
        constructor() {
            super();
            this._input.addEventListener('input', () => {
                this.value = this._input.value;
            });
        }
        html(props) {
            return html `
            <style>
              .root {
                display: block;
                position: relative;
                white-space: nowrap;
                padding: 0 8px 16px;
              }
              .labelText {
                display: inline-block;
                text-align: right;
                font-family: monospace;
                padding: 0 16px;
              }

              .is-changed .labelText {
                font-weight: bolder;
                color: blue;
              }

              input[type=range] {
                position: relative;
                -webkit-appearance: none;
                min-width: 400px;
                vertical-align: baseline;
              }

              input[type=range]:focus,
              input[type=range]:active {
                outline: none;
              }

              input[type=range]::after {
                content: attr(data-value);
                position: absolute;
                bottom: 20px;
                right: 4px;
                transform: scale(1.2);
              }

              input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                pointer-events: none;
                position: relative;
                border: none;
                width: 16px;
                height: 16px;
                display: block;
                background-color: #262626;
                border-radius: 50%;
                -webkit-border-radius: 50%;
              }
              input[type=range]:active::-webkit-slider-thumb {
                box-shadow: 0 0 4px #888;
              }

              label {
                display: inline-block;
                min-width: 300px;
                cursor: pointer;
              }

              label:hover {
              }

              .details {
                padding-left: 16px;
              }
              .summary {
                outline: 0
              }
              .detailsText {
                color: #666;
              }

            </style>
            <div class="root">
            <label>
              <input type="range"
                min="${props.min}"
                max="${props.max}"
                step="${props.step}"
                value="${props.value}"
              >
              <span class="labelText">${props.name}<content></content></span>

            </label>
            <details class="details">
              <summary class="summary">詳細</summary>
              <div class="detailsText"></div>
            </details>
            </div>`;
        }
        set value(v) {
            v = parseFloat(v);
            const diff = Math.abs(this._props.value - v);
            if (diff <= 0.01) {
                return;
            }
            this._props.value = v;
            this._input.value = v;
            this.setAttribute('value', v);
            this._input.setAttribute('data-value', v.toLocaleString());
            this._root.classList.toggle('is-changed', this.value !== this.defaultValue);
            this.dispatchEvent(new Event('change'));
        }
        get value() {
            return this._props.value;
        }
    }
    if (!window.customElements.get('video-debug-slider')) {
        window.customElements.define('video-debug-slider', VideoDebugSlider);
    }
    class VideoDebugDialog extends HTMLElement {
        static get observedAttributes() {
            return [
                'enable_db_cache',
                'cache_expire_time',
                'debug',
                'startLevel',
                'capLevelOnFPSDrop',
                'capLevelToPlayerSize',
                'maxBufferLength',
                'maxBufferSize',
                'maxMaxBufferLength',
                'minAutoBitrate',
                'abrEwmaFastVoD',
                'abrEwmaSlowVoD',
                'abrEwmaDefaultEstimate',
                'abrBandWidthFactor',
                'abrBandWidthUpFactor',
                'abrMaxWithRealBitrate'
            ];
        }
        constructor() {
            super();
            this._hlsConfig = {};
            this._elm = {};
        }
        set hlsConfig(v) {
            this._hlsConfig = v;
            Object.keys(v).forEach(key => {
                if (this._elm[key]) {
                    this._elm[key].value = v[key];
                }
                //this.setAttribute(key, v[key]);
            });
        }
        get hlsConfig() {
            return this._hlsConfig;
        }
        reset(config) {
            if (!this._shadow) {
                return;
            }
            Object.keys(this._elm).forEach(key => {
                if (config && config[key]) {
                    this._elm[key].defaultValue = config[key];
                }
                this._elm[key].reset();
            });
        }
        get isOpen() {
            if (!this._root) {
                return;
            }
            return !!this._root.open;
        }
        open() {
            if (!this._root) {
                return;
            }
            if (!this._root.open) {
                this._root.showModal();
            }
        }
        close() {
            if (!this._root) {
                return;
            }
            if (this._root.open) {
                this._root.close();
            }
        }
        toggle() {
            if (!this._root) {
                return;
            }
            if (this.isOpen) {
                this.close();
            }
            else {
                this.open();
            }
        }
        connectedCallback() {
            if (!this._shadow) {
                this._shadow = this.attachShadow({ mode: 'open' });
                render(this.html(this._hlsConfig), this._shadow);
                this._root = this._shadow.querySelector('.root');
                Array.from(this._shadow.querySelectorAll('video-debug-checkbox, video-debug-slider')).forEach((elm) => {
                    this._elm[elm.name] = elm;
                    elm.defaultValue = this.hlsConfig[elm.name];
                    elm.value = this.hlsConfig[elm.name];
                    elm.addEventListener('change', (e) => {
                        //this.setAttribute(e.target.name, e.target.value);
                        this.dispatchEvent(new CustomEvent('change', { detail: { name: e.target.name, value: e.target.value } }));
                    });
                });
                this._root.addEventListener('click', this._onClick.bind(this));
            }
        }
        setValue(key, value) {
            if (this._elm && this._elm[key]) {
                this._elm[key].value = value;
            }
        }
        getValue(key) {
            if (this._elm && this._elm[key]) {
                return this._elm[key].value;
            }
        }
        _onClick(e) {
            const target = e.target;
            if (target === this._root) {
                this.close();
                return;
            }
            const commandElement = target.closest('[data-command]');
            if (!commandElement) {
                return;
            }
            const command = commandElement.getAttribute('data-command');
            //const param   = commandElement.getAttribute('data-param');
            switch (command) {
                case 'toggle':
                    this.toggle();
                    break;
                case 'save':
                    {
                        const config = {};
                        Object.keys(this._elm).forEach(key => {
                            config[key] = this._elm[key].value;
                        });
                        this.dispatchEvent(new CustomEvent('save', { detail: { config } }));
                    }
                    break;
                case 'reset':
                    this.dispatchEvent(new CustomEvent('reset'));
                    break;
                case 'clear-cache':
                    if (target.classList.contains('is-busy')) {
                        break;
                    }
                    target.classList.add('is-busy');
                    Storage.clear().catch(() => console.warn('HLS cache clear failed'));
                    setTimeout(() => target.classList.remove('is-busy'), 5000);
                    break;
                default:
                    return;
            }
            e.preventDefault();
            e.stopPropagation();
        }
        attributeChangedCallback(attrName, oldVal, newVal) {
            if (this._elm[attrName]) {
                this._elm[attrName].value = newVal;
            }
        }
        //adoptedCallback() {}
        html( /* config */) {
            return html `
          <style>
            .root {
              position: fixed;
              width: 640px;
              max-height: 80vh;
              /*max-height: calc(100vh - 32px);*/
              /*top: 100vh;*/
              z-index: 10000;
              overflow-x: hidden;
              overflow-y: auto;
              /*transform: translate(0, -32px);*/
              background: rgba(240, 240, 240, 0.95);
              color: #000;
              padding: 0;
              border: 0;
              border-radius: 4px;
              transition: 0.2s transform ease, 0.2s box-shadow ease, 0.2s opacity;
              user-select: none;
              opacity: 1;
              box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.8);
              /* mix-blend-mode: hard-light;*/
            }

            .root::backdrop {
              /*
              background:
                linear-gradient(to bottom, rgba(0, 0, 80, 0.5), rgba(0, 0, 0, 0.5));
                */
              background: rgba(0, 0, 0, 0.2);
            }

            a {
              outline: none;
            }

            .dialogInner {
              padding: 0 8px 8px;
            }

            .title {
              padding: 0 8px;
              text-shadow: 2px 2px 2px #ccc;
            }

            .description {
              padding: 0px 8px 8px;
            }

            .buttomContainer {
              text-align: center;
            }

            button[data-command] {
              width: 100px;
              margin: 8px;
              padding: 8px;
              cursor: pointer;
              white-space: nowrap;
            }

            button[data-command="clear-cache"] {
              width: auto;
            }
            button[data-command="clear-cache"]:active,
            button[data-command="clear-cache"].is-busy {
              cursor: wait;
              opacity: 0.5;
            }

            .video-debug-checkbox {
              display: inline-block;
            }

          </style>
          <dialog class="root">
            <div class="dialogInner">
            <h1 class="title">HLS 設定</h1>
            <p class="description">
            設定はリロード後に反映されます。
            詳しいドキュメントは
            <a href="https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning" target="_blank">こちら</a>
            </p>
            <video-debug-slider
              name="maxBufferLength"
              text="最少バッファ量(秒)"
              details="
最低限バッファを確保する量 (秒数指定)
↓と比較して大きいほうが確保される
          "
              min="0" max="300" step="5"></video-debug-slider>

            <video-debug-slider
              name="maxBufferSize"
              text="最少バッファ量(byte)"
              details="
最低限バッファを確保する量 (バイト数指定)
↑と比較して大きいほうが確保される
          "
              min="0" max="1000000000" step="1000"></video-debug-slider>

            <video-debug-slider
              name="maxMaxBufferLength"
              text="最大バッファ量(秒)"
              details="
バッファを確保する量の上限 (秒数指定)。
あまり大きな値を入れてもブラウザの制限に引っかかるので効果なし。
"
              min="0" max="1200" step="5"></video-debug-slider>

            <video-debug-slider
              name="minAutoBitrate"
              text="下限ビットレート"
              details="
自動画質選択時のビットレート下限。
これより低いビットレートは選択されなくなる。
          "
              min="0" max="6000000" step="100000"></video-debug-slider>

            <video-debug-slider
              name="startLevel"
              details="
自動画質再生時に最初に選択される画質。-1 はオート。
0 からは画質の低い順
"
              min="-1" max="4" step="1"></video-debug-slider>

            <video-debug-slider
              name="abrEwmaDefaultEstimate"
              details="
自動画質再生時に最初に見積もる回線速度。
大きめの値を入れると最初から高画質が選択されやすくなる。
          "
              min="0" max="6000000" step="1000"></video-debug-slider>

            <video-debug-checkbox
              name="autoAbrEwmaDefaultEstimate"
              text="abrEwmaDefaultEstimate の値を自動で調整する"
            ></video-debug-checkbox>


            <video-debug-checkbox
              name="capLevelOnFPSDrop"
              text="フレームレートが落ちたら画質を下げる"
            ></video-debug-checkbox>

            <video-debug-checkbox
              name="capLevelToPlayerSize"
              text="プレイヤーの表示サイズで画質を制限する"
            ></video-debug-checkbox>

            <video-debug-checkbox
              name="show_video_label"
              text="再生中に動画情報を表示"
            ></video-debug-checkbox>

            <video-debug-checkbox
              name="enable_db_cache"
              text="IndexedDBに動画データをキャッシュする(実験中)"
              details="画質ごとにキャッシュが作られるので、画質設定は「自動」以外を推奨"
            >
              <button type="button" data-command="clear-cache">
                キャッシュのクリア
              </button>
            </video-debug-checkbox>

            <video-debug-checkbox
              name="debug"
            ></video-debug-checkbox>

            <div class="buttomContainer">
              <button type="button" data-command="save">設定の保存</button>
              <button type="button" data-command="reset">リセット</button>
              <button type="button" data-command="toggle">閉じる</button>
            </div>
            </div>
          </dialog>`;
        }
    }
    if (!window.customElements.get('video-debug-dialog')) {
        window.customElements.define('video-debug-dialog', VideoDebugDialog);
    }
    return VideoDebugDialog;
}
//===END===
export {defineHlsDebugElements};

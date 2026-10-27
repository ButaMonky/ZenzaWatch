/**
 * Canonical TypeScript source for packages/zenza/src/parts/FrameLayer.js (Task851).
 */
/**
 * Raw DOM / API values whose shape this module does not own; one documented loose alias.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
export interface FrameLayerParams {container: HTMLElement; className?: string; html: string}
type FrameWindow = Window & {isVisible?: boolean};
type EventConstructor = new (type: string, init?: Event) => Event;
/** PromiseHandler (packages/lib/src/Emitter.js): a promise resolved from outside. */
declare const PromiseHandler: new () => Promise<FrameWindow> & {resolve(value: FrameWindow): unknown};

class FrameLayer {
  declare promise: Promise<FrameWindow> & {resolve(value: FrameWindow): unknown};
  declare container: HTMLElement;
  declare _isVisible: boolean | null;
  declare intersectionObserver: IntersectionObserver;
  declare iframe: HTMLIFrameElement;
  declare contentWindow: FrameWindow;
  declare bridgeFunc: (e: Event) => void;
  declare _html: string;
  constructor(params: FrameLayerParams) {
    this.promise = new PromiseHandler();
    this.container = params.container;
    this._initialize(params);
    this._isVisible = null;

    this.intersectionObserver = new IntersectionObserver(entries => {
      const win = this.contentWindow;
      const isVisible = entries[0]!.isIntersecting;
      if (this._isVisible !== isVisible) {
        this._isVisible = win.isVisible = isVisible;
        this.iframe.dispatchEvent(new CustomEvent('visibilitychange', {detail: {isVisible, name: win.name}}));
      }
    });
}
  get isVisible() {
    return this._isVisible;
  }
  get frame() {
    return this.iframe;
  }
  /**
   * @returns Promise<window>
   */
  wait() {
    return this.promise;
  }
  _initialize(params: FrameLayerParams) {
    const iframe = this._getIframe();
    iframe.className = params.className || '';
    iframe.loading = 'eager';

    const onload = () => {
      iframe.onload = null;
      this.iframe = iframe;
      const contentWindow = this.contentWindow = iframe.contentWindow as FrameWindow;
      this.intersectionObserver.observe(iframe);
      this.bridgeFunc = e => {
        this.iframe.dispatchEvent(new (e.constructor as EventConstructor)(e.type, e));
      };
      this.promise.resolve(contentWindow);
    };

    const html = this._html = params.html;
    if ('srcdoc' in (iframe.constructor as Loose).prototype) {
      // 先に本来のsrcdocをセットしてからDOMへ追加する（追加が先だと、
      // _getIframe()で仮に入れているプレースホルダーのsrcdocへのナビゲーションと、
      // このあと本来のsrcdocへ書き換えるナビゲーションが二重に走ってしまい、
      // ブラウザによっては前者のロードで先に'load'が発火することがある。
      // その場合 doc.body が空のまま_initializeFrame/_initFrame等が呼ばれ、
      // classListやuQueryがnullを参照して例外になる。先に本来のsrcdocへ
      // 書き換えてから追加すれば、ナビゲーションは1回で済む）。
      iframe.onload = onload;
      iframe.srcdoc = html;
      this.container.append(iframe);
    } else {
      // MS IE/Edge用
      this.container.append(iframe);
      const d = (iframe.contentWindow as Window).document;
      d.open();
      d.write(html);
      d.close();
      window.setTimeout(onload, 0);
    }
  }
  _getIframe() {
    const iframe = Object.assign(document.createElement('iframe'), {
      loading: 'eager', srcdoc: '<html></html>', sandbox: 'allow-same-origin allow-scripts'
    });
    return iframe;
  }
  addEventBridge(name: string, options?: boolean | AddEventListenerOptions) {
    this.wait().then(w => w.addEventListener(name, this.bridgeFunc, options));
    return this;
  }
  removeEventBridge(name: string) {
    this.wait().then(w => w.removeEventListener(name, this.bridgeFunc));
    return this;
  }
}

export {FrameLayer};

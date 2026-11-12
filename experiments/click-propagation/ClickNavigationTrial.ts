/** Official CommonHeader public event adapter; no third-party script knowledge. */
class OfficialHeaderClickBridge {
  private claimed = new WeakSet<Event>();
  private hooked = new WeakSet<object>();
  private covered = false;
  private enabled = true;
  private blocked = 0;
  private w: Window & typeof globalThis;
  constructor(w: Window & typeof globalThis) {
    this.w = w;
    this.install();
    // The official loader constructs the header in the script's target load
    // handler. Capture runs first, after the UMD export has been assigned.
    w.document.addEventListener('load', this.onLoad, true);
    w.addEventListener('pageshow', () => { this.enabled = true; w.document.addEventListener('load', this.onLoad, true); });
    w.addEventListener('pagehide', () => {
      this.enabled = false;
      w.document.removeEventListener('load', this.onLoad, true);
    });
  }
  private onLoad = (e: Event): void => {
    if (e.target instanceof this.w.HTMLScriptElement) this.install();
  };
  private install(): void {
    const exported = (this.w as unknown as {CommonHeader?: {default?: {prototype?: {on?: Function}}}}).CommonHeader;
    const proto = exported?.default?.prototype;
    if (!proto || typeof proto.on !== 'function' || this.hooked.has(proto)) return;
    // Existing registrations cannot be removed with the public API. Never
    // claim coverage when the header was already mounted before interception.
    if (this.w.document.querySelector('#CommonHeader')?.childElementCount) return;
    const original = proto.on;
    const bridge = this;
    const wrapped = function(this: unknown, name: string, listener: unknown, ...args: unknown[]) {
      if (name !== 'commonHeader:linkClick' || typeof listener !== 'function') {
        return Reflect.apply(original, this, [name, listener, ...args]);
      }
      const guarded = function(this: unknown, payload: {nativeEvent?: Event}, ...rest: unknown[]) {
        if (bridge.enabled && payload?.nativeEvent && bridge.claimed.has(payload.nativeEvent)) {
          bridge.blocked++;
          return;
        }
        return Reflect.apply(listener, this, [payload, ...rest]);
      };
      const result = Reflect.apply(original, this, [name, guarded, ...args]);
      bridge.covered = true;
      return result;
    };
    try { proto.on = wrapped; if (proto.on === wrapped) this.hooked.add(proto); } catch { /* fallback */ }
  }
  claim(event: MouseEvent): {mode: string; blocked: () => number} {
    const header = this.w.document.querySelector('#CommonHeader');
    const inside = !!header && event.composedPath().includes(header);
    if (!inside) return {mode: 'ordinary', blocked: () => 0};
    if (this.enabled && this.covered) {
      const before = this.blocked;
      this.claimed.add(event);
      return {mode: 'header-bridge', blocked: () => this.blocked - before};
    }
    event.stopImmediatePropagation();
    return {mode: 'header-safe-fallback', blocked: () => 0};
  }
}
class ClickNavigationTrial {
  private static bridges = new WeakMap<Window, OfficialHeaderClickBridge>();
  static install(w: Window & typeof globalThis): void {
    if (!this.bridges.has(w)) this.bridges.set(w, new OfficialHeaderClickBridge(w));
  }
  static begin(w: Window & typeof globalThis, event: MouseEvent, _watchId: string, launch: () => void): void {
    this.install(w);
    event.preventDefault();
    const result = this.bridges.get(w)!.claim(event);
    let bodyReached = false;
    const observe = (e: Event) => { if (e === event) bodyReached = true; };
    w.document.body.addEventListener('click', observe);
    w.setTimeout(() => {
      w.document.body.removeEventListener('click', observe);
      launch();
      w.console.info('ZENZA_CLICK_TRIAL ' + JSON.stringify({version: 'click1018.3',
        mode: result.mode, headerCallbacksBlocked: result.blocked(), bodyReached}));
    }, 0);
  }
}

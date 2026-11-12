// Generated from WatchClickNavigation.ts; run node tools/generate-watch-click-navigation.cjs
//===BEGIN===
/** Official CommonHeader public event adapter; no third-party script knowledge. */
class OfficialHeaderClickBridge {
          claimed = new WeakSet       ();
          hooked = new WeakSet        ();
          covered = false;
          enabled = true;
          blocked = 0;
          w                            ;
  constructor(w                            ) {
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
          onLoad = (e       )       => {
    if (e.target instanceof this.w.HTMLScriptElement) this.install();
  };
          install()       {
    const exported = (this.w                                                                         ).CommonHeader;
    const proto = exported?.default?.prototype;
    if (!proto || typeof proto.on !== 'function' || this.hooked.has(proto)) return;
    // Existing registrations cannot be removed with the public API. Never
    // claim coverage when the header was already mounted before interception.
    if (this.w.document.querySelector('#CommonHeader')?.childElementCount) return;
    const original = proto.on;
    const bridge = this;
    const wrapped = function(               name        , listener         , ...args           ) {
      if (name !== 'commonHeader:linkClick' || typeof listener !== 'function') {
        return Reflect.apply(original, this, [name, listener, ...args]);
      }
      const guarded = function(               payload                       , ...rest           ) {
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
  claim(event            )                                        {
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
class WatchClickNavigation {
          static bridges = new WeakMap                                   ();
  static install(w                            )       {
    if (!this.bridges.has(w)) this.bridges.set(w, new OfficialHeaderClickBridge(w));
  }
  static begin(w                            , event            , _watchId        , launch            )       {
    this.install(w);
    event.preventDefault();
    this.bridges.get(w) .claim(event);
    w.setTimeout(launch, 0);
  }
}
WatchClickNavigation.install(window);
//===END===
export {WatchClickNavigation};

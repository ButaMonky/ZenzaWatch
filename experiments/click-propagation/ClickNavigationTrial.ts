/** Experiment only. No extension detection, synthetic clicks or saved state. */
class ClickNavigationTrial {
  private static active = new WeakMap<Window, () => void>();
  static begin(w: Window & typeof globalThis, event: MouseEvent, watchId: string, launch: () => void): void {
    this.active.get(w)?.();
    const path = event.composedPath();
    const seen: string[] = [];
    const cleanups: Array<() => void> = [];
    const report = {version: 'click1018.2', windowOpenBlocked: 0, navigationBlocked: 0,
      navigationSupported: false, openGuardInstalled: false, bodyReached: false,
      documentReached: false, stopped: false, launched: false, superseded: false, path: path.filter(n => n instanceof w.Element)
        .slice(0, 12).map(n => { const el = n as Element; return {tag: el.tagName,
          role: el.getAttribute('role'), dataKeys: el.getAttributeNames().filter(k => k.startsWith('data-'))}; }), seen};
    let active = true;
    const matches = (raw: unknown): boolean => {
      if (typeof raw !== 'string' && !(raw instanceof w.URL)) return false;
      try {
        const url = new w.URL(String(raw), w.location.href);
        return /^https?:$/.test(url.protocol) && url.hostname === 'www.nicovideo.jp' &&
          url.pathname === '/watch/' + watchId;
      } catch { return false; }
    };
    // Install only for this dispatch turn; restore before the player starts.
    // No history, Event prototype, addEventListener or third-party APIs are patched.
    const originalOpen = w.open;
    const guardedOpen: typeof w.open = function(this: Window, url, target, features) {
      if (active && matches(url)) { report.windowOpenBlocked++; return null; }
      return Reflect.apply(originalOpen, this, [url, target, features]);
    };
    try { w.open = guardedOpen; report.openGuardInstalled = w.open === guardedOpen; } catch { /* diagnostic below */ }
    cleanups.push(() => { if (w.open === guardedOpen) w.open = originalOpen; });
    const navigation = (w as unknown as {navigation?: EventTarget}).navigation;
    if (navigation) {
      report.navigationSupported = true;
      const listener = (raw: Event) => {
        const e = raw as Event & {destination: {url: string}};
        if (active && e.cancelable && matches(e.destination.url)) {
          e.preventDefault(); report.navigationBlocked++;
        }
      };
      navigation.addEventListener('navigate', listener);
      cleanups.push(() => navigation.removeEventListener('navigate', listener));
    }
    for (const [index, node] of path.entries()) {
      if (!(node instanceof w.EventTarget)) continue;
      const listener = (e: Event) => {
        if (e !== event) return;
        seen.push(String(index));
        if (node === w.document.body) report.bodyReached = true;
        if (node === w.document) report.documentReached = true;
        report.stopped ||= e.cancelBubble;
      };
      node.addEventListener('click', listener);
      cleanups.push(() => node.removeEventListener('click', listener));
    }
    event.preventDefault();
    const release = () => {
      active = false;
      for (const dispose of cleanups.splice(0)) dispose();
      if (this.active.get(w) === release) this.active.delete(w);
    };
    this.active.set(w, release);
    w.setTimeout(() => {
      if (!active) { report.superseded = true; w.console.info('ZENZA_CLICK_TRIAL ' + JSON.stringify(report)); return; }
      release();
      try { launch(); report.launched = true; }
      finally { w.console.info('ZENZA_CLICK_TRIAL ' + JSON.stringify(report)); }
    }, 0);
  }
}

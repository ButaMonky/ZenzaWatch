/**
 * Canonical TypeScript source for packages/lib/src/ui/PopupMessage.js (Task785).
 * Toast style notify/alert/debug messages (text by default; HTML only when asked).
 */
/** The part of css (packages/lib/src/css/css.js) used here. */
declare const css: {addStyle(styles: string): unknown};
// The actual journal source is TypeScript; the legacy bundler supplies its runtime symbol.
declare const NotificationJournal: typeof import('./NotificationJournal').NotificationJournal;
/** Config is supplied by the userscript dependency loader. */
declare const Config: {getValue?(key: string): unknown};

const PopupMessage = (() => {
  const __css__ = `
    .zenzaPopupMessage {
      --notify-color: #0c0;
      --alert-color: #c00;
      --shadow-color: #ccc;

      z-index: 100000;
      opacity: 0;
      display: block;
      min-width: 150px;
      margin-bottom: 8px;
      padding: 8px 16px;
      white-space: nowrap;
      font-weight: bolder;
      overflow-y: hidden;
      text-align: center;

      color: #fff;
      box-shadow: 2px 2px 0 var(--shadow-color, #ccc);
      border-radius: 4px;
      pointer-events: none;
      user-select: none;

      animation: zenza-popup-message-animation 5s;
      animation-fill-mode: forwards;
    }

    .zenzaPopupMessage.notify {
      background: var(--notify-color, #0c0);
    }

    .zenzaPopupMessage.alert {
      background: var(--alert-color, #0c0);
    }

    .zenzaPopupMessage.debug {
      background: #333;
    }

    /* できれば広告に干渉したくないけど仕方なく */
    div[data-follow-container] {
      position: static !important;
    }

    @keyframes zenza-popup-message-animation {
      0%  { transform: translate3d(0, -100px, 0); opacity: 0; }
      10% { transform: translate3d(0, 0, 0); }
      20% { opacity: 1; }
      80% { opacity: 1; }
      90% { opacity: 0; }
    }
  `;

  let initialized = false;
  const initialize = () => {
    if (initialized) { return; }
    initialized = true;
    css.addStyle(__css__);
  };

  const storedColor = (key: string): string | null => {
    // Invalid/stale imported preferences never reach CSS. Keep pre-Task926 defaults.
    let value: unknown;
    try { value = Config.getValue?.(key); } catch (_) { return null; }
    return typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value) ? value : null;
  };
  const storedTransparency = (): number => {
    let value: unknown;
    try { value = Config.getValue?.('popup.backgroundTransparency'); } catch (_) { return 0; }
    // Invalid imports do not override the established opaque appearance.
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
  };
  const transparentColor = (hex: string, percent: number): string => {
    const raw = hex.slice(1);
    const full = raw.length === 3 ? [...raw].map(ch => ch + ch).join('') : raw;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${1 - percent / 100})`;
  };
  const create = (msg: string, className: string, allowHtml = false) => {
    const d = document.createElement('div');
    d.className = `zenzaPopupMessage ${className}`;
    const key = className === 'notify' ? 'popup.notifyColor' :
      className === 'alert' ? 'popup.alertColor' : null;
    if (key) {
      const configured = storedColor(key);
      const percent = storedTransparency();
      if (configured || percent > 0) {
        const fallback = className === 'notify' ? '#0c0' : '#c00';
        d.style.setProperty(className === 'notify' ? '--notify-color' : '--alert-color',
          percent > 0 ? transparentColor(configured || fallback, percent) : configured!);
      }
    }
    allowHtml ? (d.innerHTML = msg) : (d.textContent = msg);
    d.addEventListener('animationend', () => d.remove(), {once: true});
    return d;
  };

  const show = (msg: Element) => {
    initialize();
    const target = document.querySelector('.popupMessageContainer');
    (target || document.body).prepend(msg);
  };

  const nt = (msg: string | undefined, allowHtml: boolean, type: string, consoleStyle: string) => {
    if (msg === undefined) {
      msg = '不明なエラー';
      window.console.error('undefined message sent');
      window.console.trace();
    }
    // Every displayed popup (including ThreadLoader's direct alerts) passes
    // through this single canonical boundary. Never store raw HTML/payloads.
    try {
      NotificationJournal.record({
        category: 'general',
        level: type === 'alert' ? 'error' : 'info',
        message: allowHtml ? msg.replace(/<[^>]*>/g, ' ') : msg,
        source: 'popup'
      });
    } catch (_) { /* history never interferes with notifications */ }
    console.log('%c%s', consoleStyle, msg);
    show(create(msg, type, allowHtml));
  };

  const notify = (msg?: string, allowHtml = false) =>
    nt(msg, allowHtml, 'notify', 'background: #080; color: #fff; padding: 8px;');

  const alert = (msg?: string, allowHtml = false) =>
    nt(msg, allowHtml, 'alert', 'background: #800; color: #fff; padding: 8px;');

  const debug = (msg?: string, allowHtml = false) =>
    nt(msg, allowHtml, 'debug', 'background: #333; color: #fff; padding: 8px;');

  return {notify, alert, debug};
})();

export { PopupMessage };

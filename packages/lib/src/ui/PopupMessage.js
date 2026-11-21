import { CONSTANT } from '../../../../src/constant';
import {css} from '../css/css';
import {Config} from '../../../../src/Config';
import {NotificationJournal} from '../../../../src/NotificationJournal';
// GENERATED FROM tools/typescript-stage1/nico-src/PopupMessage.ts (Task785). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require Config
//@require NotificationJournal
const PopupMessage = (() => {
    const __css__ = `
    .zenzaPopupMessage {
      --notify-color: #0c0;
      --alert-color: #c00;
      --warning-color: #c60;
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

    .zenzaShareNoticeHost {
      all: initial; position: fixed; inset: max(12px,env(safe-area-inset-top)) 12px auto auto;
      z-index: 2147483647; width: min(28rem,calc(100vw - 24px)); margin: 0; padding: 0;
      background: transparent; border: 0; overflow: visible; pointer-events: none;
    }
    .popupMessageContainer .zenzaShareResult {
      white-space: normal; overflow-wrap: anywhere; max-width: min(28rem,calc(100vw - 64px));
    }
    .zenzaShareNoticeHost::backdrop {background:transparent;pointer-events:none}
    .zenzaShareNoticeHost .zenzaPopupMessage {
      white-space: normal; overflow-wrap: anywhere; font: 600 15px/1.5 system-ui,sans-serif;
      animation-duration: 7s;
    }
    @media(prefers-reduced-motion:reduce) {
      .zenzaShareNoticeHost .zenzaPopupMessage {animation:none;opacity:1}
    }
    .zenzaPopupMessage.notify {
      background: var(--notify-color, #0c0);
    }

    .zenzaPopupMessage.alert {
      background: var(--alert-color, #0c0);
    }

    .zenzaPopupMessage.warning {
      background: var(--warning-color, #c60);
      white-space: pre-line;
      overflow-wrap: anywhere;
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
        if (initialized) {
            return;
        }
        initialized = true;
        css.addStyle(__css__);
    };
    const storedColor = (key) => {
        // Invalid/stale imported preferences never reach CSS. Keep pre-Task926 defaults.
        let value;
        try {
            value = Config.getValue?.(key);
        }
        catch (_) {
            return null;
        }
        return typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value) ? value : null;
    };
    const storedTransparency = () => {
        let value;
        try {
            value = Config.getValue?.('popup.backgroundTransparency');
        }
        catch (_) {
            return 0;
        }
        // Invalid imports do not override the established opaque appearance.
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
    };
    const transparentColor = (hex, percent) => {
        const raw = hex.slice(1);
        const full = raw.length === 3 ? [...raw].map(ch => ch + ch).join('') : raw;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${1 - percent / 100})`;
    };
    const create = (msg, className, allowHtml = false) => {
        const d = document.createElement('div');
        d.className = `zenzaPopupMessage ${className}`;
        const key = className === 'notify' ? 'popup.notifyColor' :
            className === 'alert' ? 'popup.alertColor' :
                className === 'warning' ? 'popup.warningColor' : null;
        if (key) {
            const configured = storedColor(key);
            const percent = storedTransparency();
            if (configured || percent > 0) {
                const fallback = className === 'notify' ? '#0c0' : className === 'warning' ? '#c60' : '#c00';
                d.style.setProperty(className === 'notify' ? '--notify-color' : className === 'warning' ? '--warning-color' : '--alert-color', percent > 0 ? transparentColor(configured || fallback, percent) : configured);
            }
        }
        allowHtml ? (d.innerHTML = msg) : (d.textContent = msg);
        d.addEventListener('animationend', () => d.remove(), { once: true });
        return d;
    };
    let noticeHost;
    const waitingNotices = [];
    function showShareNotice(msg) {
        if (document.hidden) {
            waitingNotices.push(msg);
            if (waitingNotices.length > 3)
                waitingNotices.shift();
            document.addEventListener('visibilitychange', showWaiting);
            return;
        }
        const dialog = document.querySelector('dialog[open]');
        const player = document.querySelector('.zenzaVideoPlayerDialog.is-open .popupMessageContainer');
        if (!dialog && player?.getClientRects().length && (!document.fullscreenElement || document.fullscreenElement.contains(player))) {
            msg.classList.add('zenzaShareResult');
            player.prepend(msg);
            return;
        }
        if (!noticeHost?.isConnected) {
            noticeHost = document.createElement('div');
            noticeHost.className = 'zenzaShareNoticeHost';
            noticeHost.setAttribute('role', 'status');
            noticeHost.setAttribute('aria-live', 'polite');
            const supportsPopover = typeof noticeHost.showPopover === 'function';
            if (supportsPopover)
                noticeHost.setAttribute('popover', 'manual');
            const fallback = dialog || document.fullscreenElement || document.body;
            const parent = supportsPopover ? document.body : fallback;
            parent.appendChild(noticeHost);
            if (supportsPopover) {
                try {
                    noticeHost.showPopover();
                }
                catch (_) {
                    noticeHost.removeAttribute('popover');
                    fallback.appendChild(noticeHost);
                }
            }
        }
        const host = noticeHost;
        host.prepend(msg);
        while (host.childElementCount > 3)
            host.lastElementChild?.remove();
        window.setTimeout(() => {
            msg.remove();
            if (!host.childElementCount) {
                host.remove();
                if (host === noticeHost)
                    noticeHost = undefined;
            }
        }, 7200);
    }
    function showWaiting() {
        if (document.hidden)
            return;
        document.removeEventListener('visibilitychange', showWaiting);
        for (const msg of waitingNotices.splice(0))
            showShareNotice(msg);
    }
    const show = (msg, shareNotice = false) => {
        initialize();
        if (shareNotice) {
            showShareNotice(msg);
            return;
        }
        const target = document.querySelector('.popupMessageContainer');
        (target || document.body).prepend(msg);
    };
    const nt = (msg, allowHtml, type, consoleStyle, journal) => {
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
                level: type === 'alert' ? 'error' : type === 'warning' ? 'warning' : journal?.level || 'info',
                message: allowHtml ? msg.replace(/<[^>]*>/g, ' ') : msg,
                source: journal?.source || 'popup', details: journal?.details
            });
        }
        catch (_) { /* history never interferes with notifications */ }
        console.log('%c%s', consoleStyle, msg);
        show(create(msg, type, allowHtml), journal?.source === 'x-draft' || journal?.source === 'official-share' || journal?.source === 'clip-export');
    };
    const notify = (msg, allowHtml = false, journal) => nt(msg, allowHtml, 'notify', 'background: #080; color: #fff; padding: 8px;', journal);
    const alert = (msg, allowHtml = false, journal) => nt(msg, allowHtml, 'alert', 'background: #800; color: #fff; padding: 8px;', journal);
    const warning = (msg, allowHtml = false, journal) => nt(msg, allowHtml, 'warning', 'background: #c60; color: #fff; padding: 8px;', journal);
    const debug = (msg, allowHtml = false) => nt(msg, allowHtml, 'debug', 'background: #333; color: #fff; padding: 8px;');
    return { notify, alert, warning, debug };
})();
//===END===
export {PopupMessage};

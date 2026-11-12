import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';
import {uq} from '../../../lib/src/uQuery';
import {nicoUtil} from '../../../lib/src/nico/nicoUtil';
import {cssUtil} from '../../../lib/src/css/css';
import {PagePreviewGuard} from '../init/PagePreviewGuard';
// GENERATED FROM tools/typescript-stage1/nico-src/HoverMenu.ts (Task902). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require PagePreviewGuard
class HoverMenu {
    constructor(param) {
        this.initialize(param);
    }
    initialize(param) {
        this._playerConfig = param.playerConfig;
        const $view = this._$view = uq('<zen-button class="ZenButton"><div class="ZenButtonInner scalingUI">Zen</div></zen-button>');
        if (!nicoUtil.isGinzaWatchUrl() &&
            this._playerConfig.props.overrideWatchLink &&
            location && location.host.endsWith('.nicovideo.jp')) {
            this._overrideWatchLink();
        }
        else {
            this._onHoverEnd = _.debounce(this._onHoverEnd.bind(this), 500);
            $view.on(location.host.includes('google') ? 'mouseup' : 'click', this._onClick.bind(this));
            // Google opens on mouseup; also cancel its following anchor click.
            if (location.host.includes('google')) {
                $view.on('click', (e) => { e.preventDefault(); e.stopPropagation(); });
            }
            ZenzaWatch.emitter.on('hideHover', () => this._hideButton());
            document.addEventListener('scroll', () => this._hideButton(), true);
            window.addEventListener('resize', () => this._hideButton());
            document.addEventListener('click', () => this._hideButton());
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this._hideButton();
                }
            });
            uq('body')
                .on('mouseover', this._onHover.bind(this))
                .on('mouseover', this._onHoverEnd)
                .on('mouseout', this._onMouseout.bind(this))
                .append($view);
        }
    }
    setPlayer(player) {
        if (this._player !== player) {
            this._pagePreviewGuard?.dispose();
            this._pagePreviewGuard = new PagePreviewGuard(player);
        }
        this._player = player;
        if (this._playerResolve) {
            this._playerResolve(player);
        }
    }
    _getPlayer() {
        if (this._player) {
            return Promise.resolve(this._player);
        }
        if (!this._playerPromise) {
            this._playerPromise = new Promise(resolve => {
                this._playerResolve = resolve;
            });
        }
        return this._playerPromise;
    }
    _closest(target) {
        if (!target?.closest) {
            return null;
        }
        // The official search result uses a div[data-anchor-href] for its entire
        // card; thumbnail/title are nested anchors but caption/date are not.
        // Google can wrap video destinations in /url redirects.
        const selector = location.host.includes('google') ?
            'a[href],a[data-href]' :
            'a[href*="watch/"],a[href*="shorts/"],a[href*="nico.ms/"],a[data-href],[data-anchor-href],.UadVideoItem-link';
        return target.closest(selector);
    }
    _getWatchReference(target) {
        if (!target) {
            return null;
        }
        // An actual anchor navigates to href, not to its dataset attributes. In
        // particular, a native official-player link may carry a stale data-href
        // from a surrounding card; do not replace its explicit official route.
        const href = target.getAttribute?.('href');
        const nativeHref = typeof href === 'string' && href.trim() &&
            !href.trim().startsWith('#') ? href : null;
        const candidates = [
            nativeHref,
            nativeHref ? target.href : null,
            target.getAttribute?.('data-href'),
            target.getAttribute?.('data-anchor-href')
        ];
        for (const candidate of candidates) {
            if (typeof candidate !== 'string' || !candidate) {
                continue;
            }
            let url;
            try {
                url = new URL(candidate, location.href);
                // Resolve one Google /url?url= or ?q= hop, but never arbitrary hosts.
                if (/^(?:www\.)?google\.(?:com|co\.jp)$/.test(url.hostname) &&
                    url.pathname === '/url') {
                    const destination = url.searchParams.get('url') || url.searchParams.get('q');
                    if (!destination || !/^https?:\/\//.test(destination)) {
                        continue;
                    }
                    url = new URL(destination);
                }
            }
            catch (_) {
                continue;
            }
            if (!/^https?:$/.test(url.protocol) ||
                !['www.nicovideo.jp', 'sp.nicovideo.jp', 'nico.ms'].includes(url.hostname)) {
                continue;
            }
            const watchId = nicoUtil.getWatchId(url.href);
            if (watchId && /^[a-z0-9]+$/.test(watchId) && !watchId.startsWith('lv')) {
                return { watchId, url };
            }
        }
        return null;
    }
    _onHover(e) {
        if (this._$view[0]?.contains(e.target)) {
            return;
        }
        const target = this._closest(e.target);
        if (target) {
            this._hoverElement = target;
        }
    }
    _onMouseout(e) {
        if (this._hoverElement?.contains(e.relatedTarget)) {
            return;
        }
        if (this._hoverElement === this._closest(e.target)) {
            this._hoverElement = null;
        }
    }
    _onHoverEnd(e) {
        if (!this._hoverElement) {
            return;
        }
        const target = this._closest(e.target);
        if (this._hoverElement !== target) {
            return;
        }
        if (!target || target.classList.contains('noHoverMenu')) {
            return;
        }
        const ref = this._getWatchReference(target);
        if (!ref) {
            return;
        }
        this._query = nicoUtil.parseWatchQuery(ref.url.search.slice(1));
        this._watchId = ref.watchId;
        const offset = target.getBoundingClientRect();
        const view = this._$view[0];
        if (view) {
            // Keep native mouse ancestry inside the link/dropdown. The top layer
            // avoids clipping without moving the control outside that ancestry.
            if (view.parentElement !== target) {
                if (view.matches(':popover-open')) {
                    view.hidePopover?.();
                }
                target.appendChild(view);
            }
            view.setAttribute('popover', 'manual');
            Object.assign(view.style, { position: 'fixed', inset: 'auto', margin: '0',
                padding: '0', border: '0', background: 'transparent', overflow: 'visible',
                transform: 'translate(-50%, -50%)', textAlign: 'center', textIndent: '0' });
            const inner = view.querySelector('.ZenButtonInner');
            if (inner) {
                Object.assign(inner.style, { textAlign: 'center', textIndent: '0' });
            }
        }
        this._$view.css({
            top: cssUtil.px(offset.top + (view ? 0 : window.pageYOffset)),
            left: cssUtil.px(offset.left + (view ? 0 : window.pageXOffset))
        }).addClass('show');
        if (view?.isConnected && !view.matches(':popover-open')) {
            view.showPopover?.();
        }
    }
    _hideButton() {
        this._onHoverEnd.cancel?.();
        const view = this._$view[0];
        if (view?.matches(':popover-open')) {
            view.hidePopover?.();
        }
        this._$view.removeClass('show');
        this._hoverElement = null;
    }
    _onClick(e) {
        e.preventDefault();
        e.stopPropagation();
        const watchId = this._watchId;
        if (e.ctrlKey || e.metaKey || e.altKey || (e.button != null && e.button !== 0)) {
            return;
        }
        this._hideButton();
        if (e.shiftKey) {
            // 秘密機能。最後にZenzaWatchを開いたウィンドウで開く
            this._send(watchId);
        }
        else {
            this._open(watchId);
        }
    }
    open(watchId, params) {
        this._open(watchId, params);
    }
    async _open(watchId, params) {
        // Keep the independent Task376 race fix: own each pending request's options.
        const option = Object.assign({
            economy: this._playerConfig.getValue('forceEconomy'),
            query: this._query,
            eventType: 'click'
        }, params);
        this._playerOption = option;
        const player = await this._getPlayer();
        if (this._playerConfig.getValue('enableSingleton')) {
            ZenzaWatch.external.sendOrOpen(watchId, option);
        }
        else {
            player.open(watchId, option);
        }
    }
    send(watchId, params) {
        this._send(watchId, params);
    }
    async _send(watchId, params) {
        await this._getPlayer();
        ZenzaWatch.external.send(watchId, Object.assign({ query: this._query }, params));
    }
    /** Resolve intent without canceling events, changing previews or opening a player. */
    _resolveWatchClick(e) {
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) {
            return null;
        }
        const path = e.composedPath();
        // A nested link owns its click even when it is not a video link. Skipping it
        // would incorrectly fall through to the surrounding card's video route.
        const target = path.find((node) => typeof node?.matches === 'function' &&
            node.matches('a[href],a[data-href],[data-anchor-href],.UadVideoItem-link'));
        if (!target || target.classList.contains('noHoverMenu') ||
            path.some(node => node?.classList?.contains('zen-family')) ||
            target.hasAttribute('download')) {
            return null;
        }
        const action = path.find((node) => typeof node?.matches === 'function' &&
            node.matches('button,input,select,textarea,label,[role="button"],[contenteditable]:not([contenteditable="false"])'));
        const primaryWatchButton = action?.matches('.VideoIntroductionPlayerContainer-watchPageButton');
        if (action && !primaryWatchButton && action !== target &&
            (target.contains(action) || path.indexOf(action) < path.indexOf(target))) {
            return null;
        }
        const ref = this._getWatchReference(target);
        if (!ref || ref.url.searchParams.get('zenza_official') === '1') {
            return null;
        }
        return { target, ...ref };
    }
    _overrideWatchLink() {
        // Task202 / issue #1: claim a real video click before page/React navigation.
        // Late mouseover-installed handlers can run after the official header handler.
        if (this._watchLinkClick) {
            return;
        }
        const onClick = this._watchLinkClick = (e) => {
            const intent = this._resolveWatchClick(e);
            if (!intent) {
                return;
            }
            const { target, watchId, url } = intent;
            // AUD-08 WONTFIX: never import thumbnail preview time into playback.
            // The existing preview guard only pauses page media; it does not seek Zenza.
            this._pagePreviewGuard?.claim(target);
            e.preventDefault();
            // Preserve navigation ownership by default. Cooperative scripts can opt
            // into the original click; page routers must then respect defaultPrevented.
            const propagate = this._playerConfig?.getValue?.('overrideWatchLink:allowPropagation') ??
                this._playerConfig?.props?.['overrideWatchLink:allowPropagation'];
            if (!propagate) {
                e.stopImmediatePropagation();
            }
            this._query = nicoUtil.parseWatchQuery(url.search.substr(1));
            if (e.shiftKey) {
                this._send(watchId);
            }
            else {
                this._open(watchId);
            }
            window.setTimeout(() => ZenzaWatch.emitter.emit('hideHover'), 1500);
        };
        document.addEventListener('click', onClick, true);
    }
}
//===END===
export {
  HoverMenu
};

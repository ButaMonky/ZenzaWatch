/**
 * Canonical TypeScript source for packages/zenza/src/menu/HoverMenu.js (Task902).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
/** The lodash function used here. */
declare const _: {debounce<T extends (...args: Loose[]) => unknown>(fn: T, wait?: number): T & {cancel(): void}};
declare const ZenzaWatch: {
  emitter: {on(name: string, fn: (...args: Loose[]) => unknown): unknown; emit(name: string, ...args: unknown[]): unknown};
  external: {sendOrOpen(watchId: Loose, option: Loose): unknown; send(watchId: Loose, option: Loose): unknown};
};
declare const uq: Loose;
declare const nicoUtil: {
  isGinzaWatchUrl(url?: string): boolean;
  getWatchId(url: string): string | null | undefined;
  parseWatchQuery(query: string): Loose;
};
declare const cssUtil: {px(v: number): unknown};
declare class PagePreviewGuard {
  constructor(player: Loose);
  claim(target: Element): unknown;
  dispose(): void;
}


class HoverMenu {
  declare _$view: Loose;
  declare _hidePending: Loose;
  declare _hoverElement: Loose;
  declare _pagePreviewGuard: Loose;
  declare _player: Loose;
  declare _playerConfig: Loose;
  declare _playerOption: Loose;
  declare _playerPromise: Loose;
  declare _playerResolve: Loose;
  declare _query: Loose;
  declare _watchId: Loose;
  declare _watchLinkClick: Loose;
  constructor(param?: Loose) {
    this.initialize(param);
  }
  initialize(param?: Loose) {
    this._playerConfig = param.playerConfig;

    const $view = this._$view = uq(
      '<zen-button class="ZenButton"><div class="ZenButtonInner scalingUI">Zen</div></zen-button>'
    );

    if (!nicoUtil.isGinzaWatchUrl() &&
      this._playerConfig.props.overrideWatchLink &&
      location && location.host.endsWith('.nicovideo.jp')) {
      this._overrideWatchLink();
    } else {
      this._onHoverEnd = _.debounce(this._onHoverEnd.bind(this), 500);
      $view.on(
        location.host.includes('google') ? 'mouseup' : 'click', this._onClick.bind(this));
      ZenzaWatch.emitter.on('hideHover', () => $view.removeClass('show'));
      uq('body')
        .on('mouseover', this._onHover.bind(this))
        .on('mouseover', this._onHoverEnd)
        .on('mouseout', this._onMouseout.bind(this))
        .append($view);
    }
  }
  setPlayer(player?: Loose) {
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
      this._playerPromise = new Promise<Loose>(resolve => {
        this._playerResolve = resolve;
      });
    }
    return this._playerPromise;
  }
  _closest(target?: Loose) {
    if (!target?.closest) { return null; }
    // The official search result uses a div[data-anchor-href] for its entire
    // card; thumbnail/title are nested anchors but caption/date are not.
    // Google can wrap video destinations in /url redirects.
    const selector = location.host.includes('google') ?
      'a[href],a[data-href]' :
      'a[href*="watch/"],a[href*="shorts/"],a[href*="nico.ms/"],a[data-href],[data-anchor-href],.UadVideoItem-link';
    return target.closest(selector);
  }
  _getWatchReference(target?: Loose) {
    if (!target) { return null; }
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
      if (typeof candidate !== 'string' || !candidate) { continue; }
      let url;
      try {
        url = new URL(candidate, location.href);
        // Resolve one Google /url?url= or ?q= hop, but never arbitrary hosts.
        if (/^(?:www\.)?google\.(?:com|co\.jp)$/.test(url.hostname) &&
          url.pathname === '/url') {
          const destination = url.searchParams.get('url') || url.searchParams.get('q');
          if (!destination || !/^https?:\/\//.test(destination)) { continue; }
          url = new URL(destination);
        }
      } catch (_) { continue; }
      if (!/^https?:$/.test(url.protocol) ||
        !['www.nicovideo.jp', 'sp.nicovideo.jp', 'nico.ms'].includes(url.hostname)) {
        continue;
      }
      const watchId = nicoUtil.getWatchId(url.href);
      if (watchId && /^[a-z0-9]+$/.test(watchId) && !watchId.startsWith('lv')) {
        return {watchId, url};
      }
    }
    return null;
  }
  _onHover(e: Loose) {
    const target = this._closest(e.target);
    if (target) {
      this._hoverElement = target;
    }
  }
  _onMouseout(e: Loose) {
    if (this._hoverElement === this._closest(e.target)) {
      this._hoverElement = null;
    }
  }
  _onHoverEnd(e?: Loose) {
    if (!this._hoverElement) { return; }
    const target = this._closest(e.target);
    if (this._hoverElement !== target) {
      return;
    }
    if (!target || target.classList.contains('noHoverMenu')) {
      return;
    }
    const ref = this._getWatchReference(target);
    if (!ref) { return; }
    this._query = nicoUtil.parseWatchQuery(ref.url.search.slice(1));
    this._watchId = ref.watchId;

    const offset = target.getBoundingClientRect();
    this._$view.css({
      top: cssUtil.px(offset.top + window.pageYOffset),
      left: cssUtil.px(offset.left + window.pageXOffset)
    }).addClass('show');
    if (!this._hidePending) {
      this._hidePending = true;
      document.body.addEventListener('click', () => {
        this._hidePending = false;
        this._$view.removeClass('show');
      }, {once: true});
    }
  }
  _onClick(e: Loose) {
    const watchId = this._watchId;
    if (e.ctrlKey) {
      return;
    }
    if (e.shiftKey) {
      // 秘密機能。最後にZenzaWatchを開いたウィンドウで開く
      this._send(watchId);
    } else {
      this._open(watchId);
    }
  }
  open(watchId: Loose, params?: Loose) {
    this._open(watchId, params);
  }
  async _open(watchId: Loose, params?: Loose) {
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
    } else {
      player.open(watchId, option);
    }
  }
  send(watchId: Loose, params?: Loose) {
    this._send(watchId, params);
  }
  async _send(watchId: Loose, params?: Loose) {
    await this._getPlayer();
    ZenzaWatch.external.send(watchId, Object.assign({query: this._query}, params));
  }
  /** Resolve intent without canceling events, changing previews or opening a player. */
  _resolveWatchClick(e: MouseEvent): {target: Element; watchId: string; url: URL} | null {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) { return null; }
    const path = e.composedPath();
    // A nested link owns its click even when it is not a video link. Skipping it
    // would incorrectly fall through to the surrounding card's video route.
    const target = path.find((node): node is Element =>
      typeof (node as Element)?.matches === 'function' &&
      (node as Element).matches('a[href],a[data-href],[data-anchor-href],.UadVideoItem-link'));
    if (!target || target.classList.contains('noHoverMenu') ||
      path.some(node => (node as Element)?.classList?.contains('zen-family')) ||
      target.hasAttribute('download')) { return null; }
    const action = path.find((node): node is Element =>
      typeof (node as Element)?.matches === 'function' &&
      (node as Element).matches('button,input,select,textarea,label,[role="button"],[contenteditable]:not([contenteditable="false"])'));
    const primaryWatchButton = action?.matches('.VideoIntroductionPlayerContainer-watchPageButton');
    if (action && !primaryWatchButton && action !== target &&
      (target.contains(action) || path.indexOf(action) < path.indexOf(target))) { return null; }
    const ref = this._getWatchReference(target);
    if (!ref || ref.url.searchParams.get('zenza_official') === '1') { return null; }
    return {target, ...ref};
  }
  _overrideWatchLink () {
    // Task202 / issue #1: claim a real video click before page/React navigation.
    // Late mouseover-installed handlers can run after the official header handler.
    if (this._watchLinkClick) { return; }
    const onClick = this._watchLinkClick = (e: Loose) => {
      const intent = this._resolveWatchClick(e);
      if (!intent) { return; }
      const {target, watchId, url} = intent;
      // AUD-08 WONTFIX: never import thumbnail preview time into playback.
      // The existing preview guard only pauses page media; it does not seek Zenza.
      this._pagePreviewGuard?.claim(target);
      e.preventDefault();
      // Preserve navigation ownership by default. Cooperative scripts can opt
      // into the original click; page routers must then respect defaultPrevented.
      const propagate = this._playerConfig?.getValue?.('overrideWatchLink:allowPropagation') ??
        this._playerConfig?.props?.['overrideWatchLink:allowPropagation'];
      if (!propagate) { e.stopImmediatePropagation(); }
      this._query = nicoUtil.parseWatchQuery(url.search.substr(1));
      if (e.shiftKey) { this._send(watchId); } else { this._open(watchId); }
      window.setTimeout(() => ZenzaWatch.emitter.emit('hideHover'), 1500);
    };
    document.addEventListener('click', onClick, true);
  }
}

export {HoverMenu};

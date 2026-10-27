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
      'a[href*="watch/"],a[href*="shorts/"],a[href*="nico.ms/"],[data-anchor-href],.UadVideoItem-link';
    return target.closest(selector);
  }
  _getWatchReference(target?: Loose) {
    if (!target) { return null; }
    const candidates = [
      target.getAttribute?.('data-href'),
      target.getAttribute?.('data-anchor-href'),
      target.getAttribute?.('href'),
      target.href
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
  _overrideWatchLink () {
    // Task202 / issue #1: claim a real video click before page/React navigation.
    // Late mouseover-installed handlers can run after the official header handler.
    if (this._watchLinkClick) { return; }
    const onClick = this._watchLinkClick = (e: Loose) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) { return; }
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
      const target = path.map((node: Loose) => this._closest(node)).find(Boolean);
      if (!target || target.classList.contains('noHoverMenu') || target.closest('.zen-family') || target.hasAttribute('download')) { return; }
      const action = path.find((node: Loose) => node?.matches?.('button,input,select,textarea,[role="button"],[contenteditable="true"]'));
      const primaryWatchButton = action?.matches?.('.VideoIntroductionPlayerContainer-watchPageButton');
      if (action && !primaryWatchButton && action !== target && (target.contains(action) || path.indexOf(action) < path.indexOf(target))) { return; }
      const ref = this._getWatchReference(target);
      if (!ref) { return; }
      const {watchId, url} = ref;
      // A deliberate official-player link must bypass this capture-phase handler.
      // Otherwise preventDefault blocks the native target=_blank navigation and
      // the current Zenza player simply reopens the same video.
      if (url.searchParams.get('zenza_official') === '1') { return; }
      // AUD-08 WONTFIX: never import thumbnail preview time into playback.
      // The existing preview guard only pauses page media; it does not seek Zenza.
      this._pagePreviewGuard?.claim(target);
      e.preventDefault();
      e.stopImmediatePropagation();
      this._query = nicoUtil.parseWatchQuery(url.search.substr(1));
      if (e.shiftKey) { this._send(watchId); } else { this._open(watchId); }
      window.setTimeout(() => ZenzaWatch.emitter.emit('hideHover'), 1500);
    };
    document.addEventListener('click', onClick, true);
  }
}

export {HoverMenu};

import {ZenzaWatch} from '../../../../src/ZenzaWatchIndex';
import {uq} from '../../../lib/src/uQuery';
import {nicoUtil} from '../../../lib/src/nico/nicoUtil';
import {cssUtil} from '../../../lib/src/css/css';
import {PagePreviewGuard} from '../init/PagePreviewGuard';
//===BEGIN===
//@require PagePreviewGuard

class HoverMenu {
  constructor(param) {
    this.initialize(param);
  }
  initialize(param) {
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
    if (!target?.closest) { return null; }
    // The official search result uses a div[data-anchor-href] for its entire
    // card; thumbnail/title are nested anchors but caption/date are not.
    // Google can wrap video destinations in /url redirects.
    const selector = location.host.includes('google') ?
      'a[href],a[data-href]' :
      'a[href*="watch/"],a[href*="shorts/"],a[href*="nico.ms/"],[data-anchor-href],.UadVideoItem-link';
    return target.closest(selector);
  }
  _getWatchReference(target) {
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
  _onHover (e) {
    const target = this._closest(e.target);
    if (target) {
      this._hoverElement = target;
    }
  }
  _onMouseout (e) {
    if (this._hoverElement === this._closest(e.target)) {
      this._hoverElement = null;
    }
  }
  _onHoverEnd (e) {
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
    document.body.addEventListener('click', () => this._$view.removeClass('show'), {once: true});
  }
  _onClick (e) {
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
  open (watchId, params) {
    this._open(watchId, params);
  }
  async _open (watchId, params) {
    this._playerOption = Object.assign({
      economy: this._playerConfig.getValue('forceEconomy'),
      query: this._query,
      eventType: 'click'
    }, params);

    const player = await this._getPlayer();
    if (this._playerConfig.getValue('enableSingleton')) {
      ZenzaWatch.external.sendOrOpen(watchId, this._playerOption);
    } else {
      player.open(watchId, this._playerOption);
    }
  }
  send (watchId, params) {
    this._send(watchId, params);
  }
  async _send (watchId, params) {
    await this._getPlayer();
    ZenzaWatch.external.send(watchId, Object.assign({query: this._query}, params));
  }
  _overrideWatchLink () {
    // Task202 / issue #1: claim a real video click before page/React navigation.
    // Late mouseover-installed handlers can run after the official header handler.
    if (this._watchLinkClick) { return; }
    const onClick = this._watchLinkClick = e => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) { return; }
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [e.target];
      const target = path.map(node => this._closest(node)).find(Boolean);
      if (!target || target.classList.contains('noHoverMenu') || target.closest('.zen-family') || target.hasAttribute('download')) { return; }
      const action = path.find(node => node?.matches?.('button,input,select,textarea,[role="button"],[contenteditable="true"]'));
      const primaryWatchButton = action?.matches?.('.VideoIntroductionPlayerContainer-watchPageButton');
      if (action && !primaryWatchButton && action !== target && (target.contains(action) || path.indexOf(action) < path.indexOf(target))) { return; }
      const ref = this._getWatchReference(target);
      if (!ref) { return; }
      const {watchId, url} = ref;
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

//===END===

export {HoverMenu};

/**
 * Canonical TypeScript source for packages/zenza/src/init/PagePreviewGuard.js (Task851).
 */
/**
 * Raw DOM / API values whose shape this module does not own; one documented loose alias.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
export interface PreviewGuardPlayer {
  on(name: string, callback: () => void): unknown;
  off(name: string, callback: () => void): unknown;
  isOpen?: boolean;
}
/** The part of nicoUtil (packages/lib/src/nico/nicoUtil.js) used here. */
declare const nicoUtil: {getWatchId(url: string): string | null | undefined};

// Issue #1 / Task202: yield only thumbnail-preview media, never the main player.
class PagePreviewGuard {
  declare player: PreviewGuardPlayer;
  declare doc: Document;
  declare active: boolean;
  declare claimedLinks: Set<Element>;
  declare claimReleases: Map<Element, () => void>;
  declare listening: boolean;
  declare onOpen: () => void;
  declare onClose: () => void;
  declare onPlay: (event: Event) => void;
  declare claimObserver?: MutationObserver | null;
  constructor(player: PreviewGuardPlayer, doc: Document = document) {
    this.player = player; this.doc = doc; this.active = false;
    this.claimedLinks = new Set(); this.claimReleases = new Map(); this.listening = false;
    this.onOpen = () => this.activate();
    this.onClose = () => this.deactivate();
    this.onPlay = event => this.pausePreview(event.target);
    player.on('open', this.onOpen); player.on('close', this.onClose);
    if (player.isOpen) { this.activate(); }
  }
  isPreview(video: Loose) {
    if (!video?.matches?.('video') || video.closest('.zen-family,.zenzaVideoPlayerDialog') ||
        video.classList.contains('zenzaWatchVideoElement')) { return false; }
    // The current official thumbnail player mounts under its actual video link.
    const link = video.closest('a[href]');
    if (!link) { return false; }
    try {
      const url = new URL(link.href, this.doc.baseURI);
      const id = nicoUtil.getWatchId(url.href);
      return /^https?:$/.test(url.protocol) &&
        ['www.nicovideo.jp', 'sp.nicovideo.jp', 'nico.ms'].includes(url.hostname) && !!id && !id.startsWith('lv');
    } catch (_) { return false; }
  }
  isClaimed(video: Loose) {
    const link = video?.closest?.('a[href]');
    return !!link && this.claimedLinks.has(link);
  }
  _startListening() {
    if (this.listening) { return; }
    this.listening = true;
    this.doc.addEventListener('play', this.onPlay, true);
    this.doc.addEventListener('playing', this.onPlay, true);
  }
  _stopListeningIfIdle() {
    if (!this.claimedLinks.size && this.claimObserver) {
      this.claimObserver.disconnect(); this.claimObserver = null;
    }
    if (!this.listening || this.active || this.claimedLinks.size) { return; }
    this.listening = false;
    this.doc.removeEventListener('play', this.onPlay, true);
    this.doc.removeEventListener('playing', this.onPlay, true);
  }
  _releaseClaim(link: Element) {
    const release = this.claimReleases.get(link);
    if (release) { link.removeEventListener('pointerleave', release); }
    this.claimedLinks.delete(link); this.claimReleases.delete(link);
    this._stopListeningIfIdle();
  }
  _watchClaimedLinks() {
    if (this.claimObserver || !this.doc.defaultView?.MutationObserver || !this.doc.documentElement) { return; }
    this.claimObserver = new this.doc.defaultView!.MutationObserver(() => {
      for (const link of this.claimedLinks) { if (!link.isConnected) { this._releaseClaim(link); } }
    });
    this.claimObserver.observe(this.doc.documentElement, {childList: true, subtree: true});
  }
  claim(link: Loose) {
    if (!link?.matches?.('a[href]') || !link.isConnected) { return; }
    if (!this.claimedLinks.has(link)) {
      const release = () => this._releaseClaim(link);
      this.claimedLinks.add(link); this.claimReleases.set(link, release);
      link.addEventListener('pointerleave', release, {once: true});
    }
    this._startListening(); this._watchClaimedLinks();
    link.querySelectorAll('video').forEach((video: Loose) => this.pausePreview(video));
  }
  _clearClaims() {
    for (const [link, release] of this.claimReleases) { link.removeEventListener('pointerleave', release); }
    this.claimedLinks.clear(); this.claimReleases.clear(); this._stopListeningIfIdle();
  }
  pausePreview(video: Loose) {
    if ((!this.active && !this.isClaimed(video)) || !this.isPreview(video) || video.paused) { return; }
    try { video.pause(); } catch (_) { /* Detached/ending previews cannot block Zenza. */ }
  }
  activate() {
    this.active = true; this._clearClaims(); this._startListening();
    this.doc.querySelectorAll('video').forEach(video => this.pausePreview(video));
  }
  deactivate() {
    this.active = false; this._clearClaims();
    // Never auto-resume or rewrite the website's preview preferences.
  }
  dispose() {
    this.deactivate(); this._clearClaims();
    this.player.off('open', this.onOpen); this.player.off('close', this.onClose);
  }
}

export {PagePreviewGuard};

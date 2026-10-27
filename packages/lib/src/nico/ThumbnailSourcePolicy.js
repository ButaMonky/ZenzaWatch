// Task952: one pure policy shared by PiP and MylistPocket. No fetch or UI.
// Accepted URL data is never fabricated or modified (signed keys are opaque).
//===BEGIN===
const ThumbnailSourcePolicy = (() => {
  const getHost = raw => {
    if (typeof raw !== 'string' || !raw.trim()) { return null; }
    try {
      const url = new URL(raw);
      return /^https?:$/.test(url.protocol) ? {host: url.hostname.toLowerCase(),
        secure: url.protocol === 'https:'} : null;
    } catch (_) { return null; }
  };
  const isDirectOriginalOgp = raw => {
    const parsed = getHost(raw);
    return !!parsed && parsed.secure && parsed.host === 'img.cdn.nimg.jp';
  };
  const isKnownCompositedOgp = raw => {
    const parsed = getHost(raw);
    return !!parsed && parsed.host === 'goptim.video.nimg.jp';
  };
  const select = (thumbnail, fallback = [], options = {}) => {
    const thumb = thumbnail && typeof thumbnail === 'object' ? thumbnail : {};
    const others = Array.isArray(fallback) ? fallback : [];
    const mode = options.mode === 'legacy' ? 'legacy' : 'smart';
    const ogp = thumb.ogp;
    const player = thumb.player;
    if (mode === 'legacy') { return [ogp, player, ...others]; }
    // img.cdn originals have been observed without overlays, while some
    // goptim social previews have a baked-in play icon. This is a known
    // delivery heuristic, not a universal pixel-level guarantee.
    const preferred = isDirectOriginalOgp(ogp) ? ogp : null;
    const backupOgp = options.includeUnknownOgp && !isKnownCompositedOgp(ogp) ?
      ogp : null;
    return [preferred, player, ...others, backupOgp]
      .filter(value => !isKnownCompositedOgp(value));
  };
  return {select, isDirectOriginalOgp, isKnownCompositedOgp};
})();
//===END===
export {ThumbnailSourcePolicy};

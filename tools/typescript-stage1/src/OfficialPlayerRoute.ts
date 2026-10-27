/**
 * Controlled TypeScript port of a pure ZenzaWatch helper.
 * Canonical implementation for the legacy OfficialPlayerRoute.js runtime module.
 * Task448's guarded generator emits the legacy build.js-compatible JavaScript.
 */
export type VideoIdLike = string | number | null | undefined;
export type OfficialRouteQuery = {zenza_official?: unknown} | null | undefined;

const OfficialPlayerRoute = Object.freeze({
  PARAM: 'zenza_official',
  /**
   * @param {string|number|null|undefined} watchId
   * @param {unknown} [currentTime=0]
   * @returns {string}
   */
  makeUrl(watchId: VideoIdLike, currentTime: unknown = 0): string {
    const url = new URL('https://www.nicovideo.jp/watch/' +
      encodeURIComponent(String(watchId ?? '')));
    url.searchParams.set(this.PARAM, '1');
    // NicoNico's official seek parameter is `from`, not `s`.
    // Use only a finite, positive whole-second position.
    const time = Number(currentTime);
    if (Number.isFinite(time) && time > 0) {
      const seconds = Math.floor(time);
      if (Number.isSafeInteger(seconds) && seconds > 0) {
        url.searchParams.set('from', String(seconds));
      }
    }
    return url.href;
  },
  /**
   * @param {{zenza_official?: unknown}|null|undefined} query
   * @returns {boolean}
   */
  isOfficialRequest(query: OfficialRouteQuery): boolean {
    return query != null && query.zenza_official === '1';
  }
});

export {OfficialPlayerRoute};

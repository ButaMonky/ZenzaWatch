// Task350: An explicit route marker for viewing a video in the official player.
// The legacy watchGinza window.name bypass is retained for old links.
// GENERATED FROM tools/typescript-stage1/src/OfficialPlayerRoute.ts (Task448).
//===BEGIN===
const OfficialPlayerRoute = Object.freeze({
    PARAM: 'zenza_official',
    /**
     * @param {string|number|null|undefined} watchId
     * @param {unknown} [currentTime=0]
     * @returns {string}
     */
    makeUrl(watchId, currentTime = 0) {
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
    isOfficialRequest(query) {
        return query != null && query.zenza_official === '1';
    }
});
//===END===
export {OfficialPlayerRoute};

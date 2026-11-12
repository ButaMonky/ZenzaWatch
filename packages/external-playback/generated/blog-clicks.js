"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBlogClick = sendBlogClick;
exports.receiveBlogClicks = receiveBlogClicks;
const settings_1 = require("./settings");
const targets_1 = require("./targets");
const prefix = 'blog-click-v1:';
/** DOM messages carry only a correlation nonce. The trusted-click proof stays in GM storage. */
function sendBlogClick(w, gm, id, event) {
    if (!event.isTrusted || !(0, targets_1.validVideoId)(id) || w === w.top)
        return false;
    const nonce = w.crypto.randomUUID(), key = prefix + nonce;
    gm.set(key, { id, time: Date.now() });
    w.parent.postMessage({ type: 'ZenzaBlogPartsClick', nonce }, '*');
    w.setTimeout(() => gm.remove(key), 10000);
    return true;
}
function receiveBlogClicks(w, gm, preferences, open) {
    const receive = (event) => {
        if (!['https://ext.nicovideo.jp', 'http://ext.nicovideo.jp'].includes(event.origin))
            return;
        const nonce = event.data?.type === 'ZenzaBlogPartsClick' ? event.data.nonce : null;
        if (typeof nonce !== 'string' || !/^[-a-f0-9]{36}$/.test(nonce))
            return;
        const frame = Array.from(w.document.querySelectorAll('iframe')).find(frame => frame.contentWindow === event.source);
        if (!frame)
            return;
        let id;
        try {
            const url = new URL(frame.src, w.location.href);
            if (url.origin !== event.origin)
                return;
            id = /^\/thumb\/([^/]+)\/?$/.exec(url.pathname)?.[1];
        }
        catch {
            return;
        }
        const key = prefix + nonce, proof = gm.get(key);
        if (!id || !(0, targets_1.validVideoId)(id) || !proof || proof.id !== id || !Number.isFinite(proof.time) || Date.now() - proof.time < 0 || Date.now() - proof.time > 10000)
            return;
        gm.remove(key);
        if (!(0, settings_1.siteEnabled)(w.location.href, (0, settings_1.readExternal)(preferences())))
            return;
        void open(id, { isTrusted: true }).catch(() => w.console.warn('ZenzaBlogPartsButton: could not open embedded video'));
    };
    w.addEventListener('message', receive);
    return () => w.removeEventListener('message', receive);
}

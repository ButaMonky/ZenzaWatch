"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchLegacyTrial = watchLegacyTrial;
/** Suspend the companion when an older external trial is active in this page. */
function watchLegacyTrial(w, stop) {
    let stopped = false;
    const check = () => {
        if (stopped || !w.document.querySelector('[data-zenza-external-overlay]:not([data-zenza-companion]),[data-zenza-external-inline]:not([data-zenza-companion])'))
            return;
        stopped = true;
        stop();
        observer.disconnect();
        const notice = w.document.createElement('div');
        notice.dataset.zenzaCompanionNotice = '';
        notice.textContent = 'ZenzaBlogPartsButtonに外部再生を統合しました。Tampermonkeyで旧「外部直接リンク検証版」を無効にして、ページを再読み込みしてください。';
        notice.style.cssText = 'position:fixed;bottom:16px;right:16px;max-width:380px;padding:16px;background:#17212d;color:white;z-index:2147483647;font:14px/1.6 sans-serif';
        w.document.documentElement.append(notice);
    };
    const observer = new w.MutationObserver(check);
    observer.observe(w.document.documentElement, { childList: true, subtree: true });
    check();
    return () => observer.disconnect();
}

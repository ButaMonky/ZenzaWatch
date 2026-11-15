import {nicoUtil} from '../../../lib/src/nico/nicoUtil';
import {PRODUCT} from '../../../../src/ZenzaWatchIndex';
const NicoVideoApi = {};

// GENERATED FROM tools/typescript-stage1/nico-src/WatchPageHistory.ts (Task902). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 *  pushStateを使ってブラウザバックの履歴に載せようと思ったけど、
 *  あらゆるページに寄生するシステムの都合上断念。
 *  とりあえず既読リンクの色が変わるようにだけする
 */
const WatchPageHistory = (() => {
    if (!window || !window.location) {
        return {
            initialize: () => { },
            pushHistory: () => { },
            pushHistoryAgency: () => { }
        };
    }
    let originalUrl = window && window.location && window.location.href;
    let originalTitle = window && window.document && window.document.title;
    let isOpen = false;
    let dialog, watchId, path, title;
    // URLを動画のものにしておく時間（Task 046）。
    //
    // このURL書き換えの目的は、ソース冒頭のコメントの通り
    // 「既読リンクの色が変わるようにする」ことだけで、ページ遷移用ではない。
    // ところが元は30秒あり、しかも動画が変わるたびにこのタイマーが
    // 振り出しに戻るため、連続再生中は実質ずっとURLが動画のままだった。
    // その状態でリロードするとその動画のページが開いてしまう、というのが
    // 「URLが残る」不具合の正体。
    // 同じファイル内の別経路（pushHistoryAgency、www以外のドメイン用）は
    // 元々3秒で戻しており、既読リンクの着色にはその程度で足りると
    // 判断されていた。それに合わせる。
    const RESTORE_DELAY = 3000;
    // 今、URLをZenzaWatchが書き換えた状態かどうか（Task 046。updateOriginalの
    // コメント参照）
    let isPushed = false;
    let pushedUrl = null;
    let navigationGeneration = 0;
    /*
     * Task1046: 視聴履歴の拡張機能（ニコつべSaver など）への情報の受け渡し。
     * こうした拡張機能は「URL が /watch/… になった」ことを見て、視聴ページの部品
     * （document.title・投稿者名・ジャンル・タグ・og:image・JSON-LD）から履歴を作る。
     * ZenzaWatch は既読リンクの着色のために URL を3秒だけ動画のものにしているが、
     * 検索・タグページなどにはその部品が無いので、従来は記録されないか、ページ側の
     * ジャンル・タグ・サムネイルが混ざっていた。URL を書き換えている間だけ、公式の
     * 視聴ページと同じ名前の部品を見えない形で置き、URL を戻すときに取り除く。
     * 置くのは公開情報（題名・投稿者名・ジャンル・タグ・サムネイル・長さ）だけ。
     * 設定 historyExtension.enable（初期値ON）で止められる。
     */
    const MARK = 'data-zenza-history-bridge';
    const removeHistoryBridge = () => {
        for (const el of Array.from(document.querySelectorAll(`[${MARK}]`))) {
            el.remove();
        }
    };
    const isHistoryBridgeEnabled = () => dialog?._playerConfig?.getValue?.('historyExtension.enable') !== false;
    const isoDuration = (sec) => {
        const n = Math.max(0, Math.floor(Number(sec) || 0));
        return `PT${Math.floor(n / 3600) ? Math.floor(n / 3600) + 'H' : ''}${Math.floor(n % 3600 / 60)}M${n % 60}S`;
    };
    const putHistoryBridge = (info) => {
        removeHistoryBridge();
        const head = document.head, body = document.body;
        if (!head || !body) {
            return;
        }
        // 拡張機能は最初に見つかったものを使うので、ページ側の要素より前に置く
        const ld = document.createElement('script');
        ld.type = 'application/ld+json';
        ld.setAttribute(MARK, '');
        ld.textContent = JSON.stringify({
            '@context': 'https://schema.org', '@type': 'VideoObject', name: info.title,
            url: `https://www.nicovideo.jp/watch/${info.watchId}`,
            ...(info.thumbnail ? { thumbnailUrl: [info.thumbnail] } : {}),
            ...(info.duration > 0 ? { duration: isoDuration(info.duration) } : {}),
            ...(info.owner ? { author: { '@type': 'Person', name: info.owner } } : {})
        });
        const og = document.createElement('meta');
        og.setAttribute('property', 'og:image');
        og.setAttribute('content', info.thumbnail || '');
        og.setAttribute(MARK, '');
        head.prepend(og, ld);
        const box = document.createElement('div');
        box.setAttribute(MARK, '');
        box.hidden = true;
        box.setAttribute('aria-hidden', 'true');
        box.style.display = 'none';
        const add = (className, text) => {
            const el = document.createElement('span');
            el.className = className;
            el.textContent = text;
            box.append(el);
        };
        if (info.owner) {
            add('VideoOwnerInfo-pageLink', info.owner);
        }
        // ジャンルが無い動画は「未設定」（拡張機能は「その他」を読み込み途中とみなして待つため）
        add('GenreRankLabel', info.genre || '未設定');
        for (const tag of info.tags) {
            add('TagItem-name', tag);
        }
        body.prepend(box);
    };
    let bridgeInfo = null;
    const restore = () => {
        removeHistoryBridge();
        if (isPushed) {
            // Another script may have navigated to a different route in the meantime.
            if (window.location.href === pushedUrl) {
                history.replaceState(history.state, null, originalUrl);
                document.title = (isOpen ? '📺' : '') + originalTitle.replace(/^📺/, '');
            }
            else {
                originalUrl = window.location.href;
                originalTitle = document.title;
            }
        }
        isPushed = false;
        pushedUrl = null;
        bouncedRestore.cancel();
    };
    const bouncedRestore = _.debounce(restore, RESTORE_DELAY);
    const pushHistory = (path, title) => {
        if (dialog?._playerConfig?.getValue('enablePushState') === false) {
            restore();
            return;
        }
        if (!isPushed)
            updateOriginal();
        // Retain the current route state, including changes made by other scripts.
        history.replaceState(history.state, null, path);
        pushedUrl = window.location.href;
        const bridge = bridgeInfo && path === `/watch/${bridgeInfo.watchId}` && isHistoryBridgeEnabled() ? bridgeInfo : null;
        // 履歴の拡張機能は題名の末尾「 - ニコニコ動画」を取り除いて保存する。URL を書き換えている間だけ公式と同じ形にする
        document.title = bridge ? `${bridge.title} - ニコニコ動画` : (isOpen ? '📺' : '') + title.replace(/^📺/, '');
        isPushed = true;
        // URL と題名を変えた後で置く（拡張機能はページ本体の変化をきっかけに URL を確かめるため）
        if (bridge) {
            putHistoryBridge(bridge);
        }
        else {
            removeHistoryBridge();
        }
        bouncedRestore();
    };
    // 「元のURL」を覚え直す。
    //
    // Task 046: ここが最も重要な修正点。元の実装は、その時点の location.href を
    // 無条件に「元のURL」として記憶していた。しかしZenzaWatch自身がURLを
    // 動画のものに書き換えている最中にこれが呼ばれると、
    // **書き換え後の動画URLが「元のURL」として記憶されてしまう**。
    // そうなると以後いくら「復元」しても動画URLに戻るだけになり、
    // 一度ズレたら二度と直らない（リロードするたびにその動画が開く）。
    //
    // pushHistory側にも似た意図のガードがあったが、
    //   if (nicoUtil.isGinzaWatchUrl(originalUrl)) { originalUrl = location.href; }
    // という、既に書き換わっているかもしれない location.href を代入し直すだけの
    // もので、汚染を止められていなかった（今回削除した）。
    //
    // 「URLが視聴ページの形かどうか」で判定する手もあるが、それだと
    // 利用者が本当に視聴ページを開いている場合まで弾いてしまう。
    // 自分が書き換えたのかどうかは自分が一番よく知っているので、
    // フラグ(isPushed)で明示的に持つ。
    const updateOriginal = () => {
        if (isPushed) {
            // Only the URL we still own may block updating the original route.
            if (window.location.href === pushedUrl)
                return;
            isPushed = false;
            pushedUrl = null;
        }
        originalUrl = window && window.location && window.location.href;
        originalTitle = window && window.document && window.document.title;
    };
    const onVideoInfoLoad = _.debounce(({ watchId, title, owner, generation, requestId, bridge }) => {
        if (dialog?._playerConfig?.getValue('enablePushState') === false || !watchId || !isOpen || generation !== navigationGeneration ||
            requestId !== dialog?._requestId) {
            return;
        }
        const name = owner?.name;
        bridgeInfo = bridge || null;
        title = `${title}${name ? ` by ${name}` : ''} - ${PRODUCT}`;
        path = `/watch/${watchId}`;
        if (location.host === 'www.nicovideo.jp') {
            return pushHistory(path, title);
        }
        if (NicoVideoApi && NicoVideoApi.pushHistory) {
            return NicoVideoApi.pushHistory(path, title);
        }
    });
    const onDialogVideoInfoLoad = (info) => {
        // VideoInfoModel exposes these as prototype getters: object spread loses them.
        // Snapshot only the public values now, before debounce or model mutation.
        const { watchId, title, owner } = info;
        let bridge = null;
        try {
            const tags = (Array.isArray(info.tagList) ? info.tagList : [])
                .map((t) => typeof t === 'string' ? t : (t?.tag || t?.name || ''))
                .filter((t) => typeof t === 'string' && t).slice(0, 100);
            const thumb = [info.betterThumbnail, info.thumbnail].find((u) => typeof u === 'string' && /^https:\/\//.test(u)) || '';
            bridge = watchId ? {
                watchId: String(watchId), title: String(title || ''), owner: typeof owner?.name === 'string' ? owner.name : '',
                genre: typeof info.genre?.label === 'string' ? info.genre.label : '', tags, thumbnail: thumb,
                duration: Number(info.duration) || 0
            } : null;
        }
        catch (_e) {
            bridge = null;
        }
        onVideoInfoLoad({ watchId, title, owner: { name: owner?.name },
            generation: navigationGeneration, requestId: dialog?._requestId, bridge });
    };
    const onDialogOpen = () => {
        navigationGeneration++;
        onVideoInfoLoad.cancel();
        updateOriginal();
        isOpen = true;
    };
    const onDialogClose = () => {
        navigationGeneration++;
        onVideoInfoLoad.cancel();
        removeHistoryBridge();
        bridgeInfo = null;
        isOpen = false;
        watchId = title = path = null;
        if (isPushed)
            restore();
        else if (window.location.href === originalUrl)
            document.title = originalTitle;
        bouncedRestore.cancel();
    };
    const initialize = (_dialog) => {
        if (dialog) {
            return;
        }
        dialog = _dialog;
        dialog?._playerConfig?.onkey?.('enablePushState', (enabled) => {
            if (!enabled) {
                navigationGeneration++;
                onVideoInfoLoad.cancel();
                restore();
            }
        });
        if (location.host === 'www.nicovideo.jp') {
            dialog.on('close', onDialogClose);
        }
        dialog.on('open', onDialogOpen);
        dialog.on('loadVideoInfo', onDialogVideoInfoLoad);
        if (location.host !== 'www.nicovideo.jp') {
            return;
        }
        window.addEventListener('beforeunload', () => { isOpen && restore(); }, { passive: true });
        window.addEventListener('error', () => { isOpen && restore(); }, { passive: true });
        window.addEventListener('unhandledrejection', updateOriginal, { passive: true });
        // Task 046: beforeunloadはタイミングによっては間に合わないことがある。
        // pagehide（タブを閉じる・別ページへ移動する時に確実に呼ばれる）と、
        // visibilitychange（タブを離れた時）でも戻しておく保険。
        window.addEventListener('pagehide', () => { isOpen && restore(); }, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && isOpen) {
                restore();
            }
        }, { passive: true });
    };
    // www.nicovideo.jp 以外で開いた時、
    // www.nicovideo.jp 配下のタブがあったら代わりに既読リンクの色を変える
    const pushHistoryAgency = async (path, title) => {
        if (dialog?._playerConfig?.getValue('enablePushState') === false)
            return;
        if (!navigator || !navigator.locks) {
            pushHistory(path, title);
            bouncedRestore.cancel();
            await new Promise(r => setTimeout(r, 3000));
            return restore();
        }
        let lastTitle = document.title;
        let lastUrl = location.href;
        // どれかひとつのタブで動けばいい
        await navigator.locks.request('pushHistoryAgency', { ifAvailable: true }, async (lock) => {
            if (!lock || dialog?._playerConfig?.getValue('enablePushState') === false) {
                return;
            }
            history.replaceState(history.state, title, path);
            const markedUrl = location.href;
            await new Promise(r => setTimeout(r, 3000));
            if (location.href === markedUrl) {
                history.replaceState(history.state, lastTitle, lastUrl);
            }
            await new Promise(r => setTimeout(r, 10000));
        });
    };
    return {
        initialize,
        pushHistory,
        pushHistoryAgency
    };
})();
//===END===
export {
  WatchPageHistory
};

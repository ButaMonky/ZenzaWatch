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
    const restore = () => {
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
        document.title = (isOpen ? '📺' : '') + title.replace(/^📺/, '');
        isPushed = true;
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
    const onVideoInfoLoad = _.debounce(({ watchId, title, owner, generation, requestId }) => {
        if (dialog?._playerConfig?.getValue('enablePushState') === false || !watchId || !isOpen || generation !== navigationGeneration ||
            requestId !== dialog?._requestId) {
            return;
        }
        const name = owner?.name;
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
        onVideoInfoLoad({ watchId, title, owner: { name: owner?.name },
            generation: navigationGeneration, requestId: dialog?._requestId });
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

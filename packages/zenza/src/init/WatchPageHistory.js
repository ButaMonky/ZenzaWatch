import {nicoUtil} from '../../../lib/src/nico/nicoUtil';
import {PRODUCT} from '../../../../src/ZenzaWatchIndex';
const NicoVideoApi = {};

//===BEGIN===
/**
 *  pushStateを使ってブラウザバックの履歴に載せようと思ったけど、
 *  あらゆるページに寄生するシステムの都合上断念。
 *  とりあえず既読リンクの色が変わるようにだけする
 */
const WatchPageHistory = (() => {
  if (!window || !window.location) {
    return {
      initialize: () => {},
      pushHistory: () => {},
      pushHistoryAgency: () => {}
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

  const restore = () => {
    history.replaceState(null, null, originalUrl);
    document.title = (isOpen ? '📺' : '') + originalTitle.replace(/^📺/, '');
    isPushed = false;
    bouncedRestore.cancel();
  };
  const bouncedRestore = _.debounce(restore, RESTORE_DELAY);

  const pushHistory = (path, title) => {
    history.replaceState(null, null, path);
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
      // 今のURLは自分で書き換えたもの。これを「元のURL」にしてはいけない
      return;
    }
    originalUrl = window && window.location && window.location.href;
    originalTitle = window && window.document && window.document.title;
  };

  const onVideoInfoLoad = _.debounce(({watchId, title, owner: {name}}) => {
    if (!watchId || !isOpen) {
      return;
    }
    title = `${title} by ${name} - ${PRODUCT}`;
    path = `/watch/${watchId}`;

    if (location.host === 'www.nicovideo.jp') {
      return pushHistory(path, title);
    }
    if (NicoVideoApi && NicoVideoApi.pushHistory) {
      return NicoVideoApi.pushHistory(path, title);
    }
  });

  const onDialogOpen = () => {
    updateOriginal();
    isOpen = true;
  };

  const onDialogClose = () => {
    isOpen = false;
    watchId = title = path = null;
    history.replaceState(null, null, originalUrl);
    document.title = originalTitle;
    isPushed = false;
    bouncedRestore.cancel();
  };

  const initialize = _dialog => {
    if (dialog) {
      return;
    }
    dialog = _dialog;

    if (location.host === 'www.nicovideo.jp') {
      dialog.on('close', onDialogClose);
    }
    dialog.on('open', onDialogOpen);
    dialog.on('loadVideoInfo', onVideoInfoLoad);

    if (location.host !== 'www.nicovideo.jp') { return; }
    window.addEventListener('beforeunload', () => {isOpen && restore()}, {passive: true});
    window.addEventListener('error', () => {isOpen && restore()}, {passive: true});
    window.addEventListener('unhandledrejection', updateOriginal, {passive: true});
    // Task 046: beforeunloadはタイミングによっては間に合わないことがある。
    // pagehide（タブを閉じる・別ページへ移動する時に確実に呼ばれる）と、
    // visibilitychange（タブを離れた時）でも戻しておく保険。
    window.addEventListener('pagehide', () => {isOpen && restore()}, {passive: true});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && isOpen) { restore(); }
    }, {passive: true});
  };
  // www.nicovideo.jp 以外で開いた時、
  // www.nicovideo.jp 配下のタブがあったら代わりに既読リンクの色を変える
  const pushHistoryAgency = async (path, title) => {
    if (!navigator || !navigator.locks) {
      pushHistory(path, title);
      bouncedRestore.cancel();
      await new Promise(r => setTimeout(r, 3000));
      return restore();
    }
    let lastTitle = document.title;
    let lastUrl = location.href;
    // どれかひとつのタブで動けばいい
    await navigator.locks.request('pushHistoryAgency', {ifAvailable: true}, async lock => {
      if (!lock) {
        return;
      }
      history.replaceState(null, title, path);
      await new Promise(r => setTimeout(r, 3000));
      history.replaceState(null, lastTitle, lastUrl);
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

export {WatchPageHistory};
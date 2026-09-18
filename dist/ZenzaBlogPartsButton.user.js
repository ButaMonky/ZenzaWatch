// ==UserScript==
// @name           ZenzaBlogPartsButton
// @namespace      https://github.com/segabito/
// @description    ニコニコ動画のブログパーツにZenzaWatch起動用ボタンを追加
// @match          *://ext.nicovideo.jp/thumb/*
// @grant          none
// @author         segabito macmoto
// @license        public domain
// @version        0.0.4
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaBlogPartsButton.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaBlogPartsButton.user.js
// ==/UserScript==
// build: 2026-09-18 16:13Z 807b380
/* eslint-disable */


(window => {
  const addStyle = (styles, id) => {
    const elm = document.createElement('style');
    elm.type = 'text/css';
    if (id) { elm.id = id; }
    elm.append(styles);
    document.head.append(elm);
    return elm;
  };

  // 埋め込み元（大百科等）のoriginを取得する。
  // Chrome/Edge/Brave系はlocation.ancestorOriginsで直接取得でき、
  // Referrer-Policyの影響を受けない（最も確実）。非対応ブラウザでは
  // document.referrerにフォールバックする。document.referrerは
  // サイト側のReferrer-Policy設定次第で空文字列になり得るため、
  // その場合は最後の手段としてpostMessageのtargetOriginを'*'にする
  // （送るメッセージ自体に機微な情報は含まれないため許容する）。
  const getParentOrigin = () => {
    try {
      if (location.ancestorOrigins && location.ancestorOrigins.length) {
        return location.ancestorOrigins[0];
      }
    } catch (e) { /* noop */ }
    try {
      if (document.referrer) {
        return new URL(document.referrer).origin;
      }
    } catch (e) { /* noop */ }
    return '*';
  };

  const postMessage = (type, message, token) => {
    const origin = getParentOrigin();
    const {command, watchId} = message;
    try {
          parent.postMessage(JSON.stringify({ // 互換のため冗長
          id: 'ZenzaWatch',
          type,
          token,
          body: {
            token,
            url: location.href,
            message: {command, watchId},
            command: 'message', params: {
              command, params: { watchId }
            }
          }
        }),
        origin);
    } catch (e) {
      alert(e);
      console.log('err', e);
    }
  };

  const __css__ = (`
    #zenzaButton {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 10000;
      line-height: 24px;
      padding: 4px 4px;
      cursor: pointer;
      font-weight: bolder;
      display: none;
    }
    body:hover #zenzaButton {
      display: inline-block;
    }
  `).trim();

  const blogPartsApi = () => {
    // location.hrefだと大百科等が付与するクエリ文字列（nicopedia_from等）まで
    // videoIdの一部として拾ってしまい、壊れたwatchId（例: "sm9?nicopedia_from=..."）を
    // ZenzaWatch本体に渡してしまうバグがあった。クエリを含まないlocation.pathnameから
    // 取得するよう修正。
    const [watchId] = location.pathname.split('/').reverse();

    // 旧実装はdocument.referrerの文字列を'/'分割してホスト名を取り出し、
    // '.nicovideo.jp'で終わるかどうかで「埋め込み元が身内かどうか」を判定していた。
    // しかしdocument.referrerはサイト側のReferrer-Policy設定次第で空文字列になり得て、
    // その場合''.split('/')の結果からホスト名相当の要素が取れず、
    // parentHost.endsWith(...)が「undefinedはendsWithを持たない」TypeErrorで例外になり、
    // blogPartsApi()全体がそこで停止して「Zen」ボタンが一切追加されなくなっていた
    // （大百科で動画が開けなくなっていた原因）。
    // 「iframeとして他ページに埋め込まれているかどうか」はwindow.top === windowで
    // 判定でき、Referrer-Policyの影響を受けないため、これに置き換えた。
    if (window.top === window) {
      window.console.log('disable bridge');
      return;
    }

    addStyle(__css__);
    const button = document.createElement('button');
    button.innerHTML = '<span>Zen</span>';
    button.id = 'zenzaButton';
    document.body.append(button);
    button.onclick = e => {
      postMessage('blogParts', {
        command: e.shiftKey ? 'send' : 'open',
        watchId
      });
    };
  };

  blogPartsApi();
})(globalThis ? globalThis.window : window);

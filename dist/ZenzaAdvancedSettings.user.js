// ==UserScript==
// @name        ZenzaWatch 上級者用設定
// @namespace   https://github.com/segabito/
// @description 上級者設定はZenzaWatch本体へ統合されました。このスクリプトは削除してください。
// @include     *//www.nicovideo.jp/my*
// @version     0.4.0-task993
// @author      segabito macmoto
// @license     public domain
// @grant       none
// @noframes
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaAdvancedSettings.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaAdvancedSettings.user.js
// ==/UserScript==
// build: 2026-11-12 16:13Z 0e7ecf1
/* eslint-disable */
(() => {
  const show = () => {
    if (document.getElementById('zenza-settings-retired-notice')) { return; }
    const box = document.createElement('aside');
    box.id = 'zenza-settings-retired-notice';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;top:16px;right:16px;max-width:380px;padding:18px;z-index:2147483647;background:#17212d;color:#eee;border:1px solid #64748b;border-radius:8px;font:14px/1.7 sans-serif;box-shadow:0 4px 24px #0008';
    const title = document.createElement('strong');
    title.textContent = '上級者設定はZenzaWatch本体に統合されました';
    const text = document.createElement('p');
    text.textContent = 'この「ZenzaWatch 上級者用設定」スクリプトは不要です。Tampermonkeyなどの管理画面から削除してください。保存済みの設定は本体が引き継ぎます。ZenzaWatch本体は削除しないでください。';
    const link = document.createElement('a');
    link.href = 'https://github.com/ButaMonky/ZenzaWatch/releases/latest';
    link.textContent = '本体を最新版に更新する';
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.color = '#91ded3';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '案内を閉じる';
    close.style.cssText = 'display:block;margin-top:12px;padding:5px 10px';
    close.addEventListener('click', () => box.remove());
    box.append(title, text, link, close); document.body.append(box);
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', show, {once:true}); }
  else { show(); }
})();

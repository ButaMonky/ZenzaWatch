// ==UserScript==
// @name           ZenzaWatch HLS Support
// @namespace      https://github.com/segabito/
// @description    HLS再生はZenzaWatch本体へ統合されました。このスクリプトは削除してください。
// @match          *://www.nicovideo.jp/*
// @match          *://blog.nicovideo.jp/*
// @match          *://ch.nicovideo.jp/*
// @match          *://com.nicovideo.jp/*
// @match          *://commons.nicovideo.jp/*
// @match          *://dic.nicovideo.jp/*
// @match          *://ex.nicovideo.jp/*
// @match          *://info.nicovideo.jp/*
// @match          *://uad.nicovideo.jp/*
// @match          *://*.nicovideo.jp/smile*
// @match          *://site.nicovideo.jp/*
// @match          *://anime.nicovideo.jp/*
// @match          https://www.upload.nicovideo.jp/niconico-garage/video/*
// @exclude        *://ads.nicovideo.jp/*
// @exclude        *://www.nicovideo.jp/watch/*?edit=*
// @exclude        *://ch.nicovideo.jp/tool/*
// @exclude        *://flapi.nicovideo.jp/*
// @exclude        *://dic.nicovideo.jp/p/*
// @grant          none
// @author         segabito macmoto
// @version        0.1.0-task997
// @noframes
// @run-at         document-start
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaHLS.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaHLS.user.js
// ==/UserScript==
// build: 2026-11-14 08:19Z 70a6d07
/* eslint-disable */


// GENERATED FROM tools/typescript-stage1/nico-src/HlsEntry.ts (Task966). Edit the .ts and run npm run nico:sync.
/** Retirement notice only: playback is owned by the main script. */
(() => {
    const show = () => {
        if (document.getElementById('zenza-hls-retired-notice')) {
            return;
        }
        const box = document.createElement('aside');
        box.id = 'zenza-hls-retired-notice';
        box.setAttribute('role', 'status');
        box.style.cssText = 'position:fixed;top:16px;right:16px;max-width:380px;padding:18px;z-index:2147483647;background:#17212d;color:#eee;border:1px solid #64748b;border-radius:8px;font:14px/1.7 sans-serif;box-shadow:0 4px 24px #0008';
        const title = document.createElement('strong');
        title.textContent = 'HLSサポートはZenzaWatch本体に統合されました';
        const text = document.createElement('p');
        text.textContent = 'ZenzaWatch本体を2.7.373以降へ更新してから、この「ZenzaWatch HLS Support」スクリプトをTampermonkeyなどの管理画面から削除してください。HLS再生と保存済みの設定は本体が引き継ぎます。ZenzaWatch本体は削除しないでください。';
        const link = document.createElement('a');
        link.href = 'https://github.com/ButaMonky/ZenzaWatch/releases/latest';
        link.textContent = '本体を最新版に更新する';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.color = '#91ded3';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '案内を閉じる';
        close.style.cssText = 'display:block;margin-top:12px;padding:5px 10px';
        close.addEventListener('click', () => box.remove());
        box.append(title, text, link, close);
        document.body.append(box);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', show, { once: true });
    }
    else {
        show();
    }
})();

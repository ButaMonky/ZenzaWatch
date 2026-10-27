// ==UserScript==
// @name        CapTube
// @namespace   https://github.com/segabito/
// @description "S"キーでYouTubeのスクリーンショット保存
// @include     https://www.youtube.com/*
// @include     https://www.youtube.com/embed/*
// @include     https://youtube.com/*
// @version     0.0.24-task966qa
// @grant       none
// @license     public domain
// ==/UserScript==

import {workerUtil} from '../packages/lib/src/infra/workerUtil';
import {cssUtil} from '../packages/lib/src/css/css';
import {EmitterInitFunc} from '../packages/lib/src/Emitter';
import {throttle} from '../packages/lib/src/infra/bounce';

// GENERATED FROM tools/typescript-stage1/nico-src/CapTubeEntry.ts (Task966). Edit the .ts and run npm run nico:sync.
(() => {
    const PRODUCT = 'CapTube';
    const global = { PRODUCT };
    //@require EmitterInitFunc
    //@require throttle
    //@require cssUtil
    //@require workerUtil
    let previewContainer = null, meterContainer = null;
    const callOnIdle = (func) => {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(func);
        }
        else {
            setTimeout(func, 0);
        }
    };
    const DataUrlConv = (() => {
        const func = function (self) {
            let canvas, ctx;
            const initCanvas = () => {
                if (canvas) {
                    return;
                }
                canvas =
                    ('OffscreenCanvas' in self) ?
                        new OffscreenCanvas(100, 100) : document.createElement('canvas');
                ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
            };
            const fromBitmap = async ({ bitmap, type, quality }) => {
                type = type || 'image/png';
                quality = quality || 1;
                initCanvas();
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                console.time('bitmap to ObjectURL');
                ctx.drawImage(bitmap, 0, 0);
                const blob = canvas.convertToBlob ?
                    (await canvas.convertToBlob({ type, quality })) :
                    (await fetch(canvas.toDataURL(type, quality)).then(response => response.blob()));
                const url = URL.createObjectURL(blob);
                console.timeEnd('bitmap to ObjectURL');
                setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
                return { url };
            };
            const fromDataURL = async ({ dataURL }) => {
                console.time('dataURL to objectURL');
                const blob = await fetch(dataURL).then(r => r.blob());
                const url = URL.createObjectURL(blob);
                console.timeEnd('dataURL to objectURL');
                setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
                return { url };
            };
            self.onmessage = async ({ command, params }) => {
                switch (command) {
                    case 'fromBitmap':
                        return fromBitmap(params);
                    case 'fromDataURL':
                        return fromDataURL(params);
                }
            };
        };
        let worker;
        let workerUnavailable = false;
        // Some sites (including current YouTube) enforce TrustedScriptURL for
        // blob: Workers. Encoding the screenshot directly preserves the capture.
        const makeBlobUrl = (blob) => {
            if (!blob || blob.size === 0) {
                throw new Error('Empty screenshot');
            }
            const url = URL.createObjectURL(blob);
            setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
            return { url };
        };
        const convertBitmapLocally = async (bitmap) => {
            const canvas = typeof OffscreenCanvas === 'function' ?
                new OffscreenCanvas(bitmap.width, bitmap.height) :
                Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
            const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
            if (!context) {
                throw new Error('Canvas context unavailable');
            }
            context.drawImage(bitmap, 0, 0);
            bitmap.close?.();
            const blob = typeof canvas.convertToBlob === 'function' ?
                await canvas.convertToBlob({ type: 'image/png' }) :
                await new Promise((resolve, reject) => canvas.toBlob((value) => value ?
                    resolve(value) : reject(new Error('Screenshot encoding failed')), 'image/png'));
            return makeBlobUrl(blob);
        };
        const convertDataURLLocally = async (dataURL) => makeBlobUrl(await (await fetch(dataURL)).blob());
        const getWorker = () => {
            if (workerUnavailable) {
                return null;
            }
            try {
                return worker = worker || workerUtil.createCrossMessageWorker(func);
            }
            catch (error) {
                workerUnavailable = true;
                console.warn('CapTube: screenshot Worker unavailable; using Canvas fallback', error);
                return null;
            }
        };
        return {
            fromBitmap: (bitmap) => {
                const activeWorker = getWorker();
                if (!activeWorker) {
                    return convertBitmapLocally(bitmap);
                }
                return activeWorker.post({
                    command: 'fromBitmap',
                    params: { bitmap }
                }, { transfer: [bitmap] });
            },
            fromDataURL: (dataURL) => {
                const activeWorker = getWorker();
                if (!activeWorker) {
                    return convertDataURLLocally(dataURL);
                }
                return activeWorker.post({
                    command: 'fromDataURL',
                    params: { dataURL }
                });
                // return new Promise(resolve => {
                //   const sessionId = 'id:' + Math.random();
                //   sessions[sessionId] = resolve;
                //   worker.postMessage({dataURL, sessionId});
                // });
            }
        };
    })();
    const __css__ = (`
    #CapTubePreviewContainer {
      position: fixed;
      padding: 16px 0 0 16px;
      width: 90%;
      bottom: 100px;
      left: 5%;
      z-index: 10000;
      pointer-events: none;
      transform: translateZ(0);
      /*background: rgba(192, 192, 192, 0.4);*/
      border: 1px solid #ccc;
      -webkit-user-select: none;
      user-select: none;
    }

    #CapTubePreviewContainer:empty {
      display: none;
    }
      #CapTubePreviewContainer canvas {
        display: inline-block;
        width: 256px;
        margin-right: 16px;
        margin-bottom: 16px;
        outline: solid 1px #ccc;
        outline-offset: 4px;
        transform: translateZ(0);
        transition:
          1s opacity      linear,
          1s margin-right linear;
      }

      #CapTubePreviewContainer canvas.is-removing {
        opacity: 0;
        margin-right: -272px;
        /*width: 0;*/
      }

    #CapTubeMeterContainer {
      pointer-events: none;
      position: fixed;
      width: 26px;
      bottom: 100px;
      left: 16px;
      z-index: 10000;
      border: 1px solid #ccc;
      transform: translateZ(0);
      -webkit-user-select: none;
      user-select: none;
     }

     #CapTubeMeterContainer::after {
       content: 'queue';
       position: absolute;
       bottom: -2px;
       left: 50%;
       transform: translate(-50%, 100%);
       color: #666;
     }

    #CapTubeMeterContainer:empty {
      display: none;
    }

      #CapTubeMeterContainer .memory {
        display: block;
        width: 24px;
        height: 8px;
        margin: 1px 0 0;
        background: darkgreen;
        opacity: 0.5;
        border: 1px solid #ccc;
      }

  `).trim();
    cssUtil.addStyle(__css__);
    const getVideoId = () => {
        let id = '';
        location.search.substring(1).split('&').forEach(item => {
            if (item.split('=')[0] === 'v') {
                id = item.split('=')[1];
            }
        });
        return id;
    };
    const toSafeName = (text) => {
        return String(text ?? '').trim()
            .replace(/</g, '＜')
            .replace(/>/g, '＞')
            .replace(/\?/g, '？')
            .replace(/:/g, '：')
            .replace(/\|/g, '｜')
            .replace(/\//g, '／')
            .replace(/\\/g, '￥')
            .replace(/"/g, '”')
            .replace(/\./g, '．');
    };
    const getVideoTitle = (params = {}) => {
        const prefix = localStorage['CapTube-prefix'] || '';
        const videoId = params.videoId || getVideoId();
        const title = document.querySelector('.title yt-formatted-string') || document.querySelector('.watch-title') || { textContent: document.title };
        // YouTube's owner markup varies by layout; never block capture when it is absent.
        const authorElement = document.querySelector('ytd-video-owner-renderer #channel-name a') ||
            document.querySelector('#owner-container yt-formatted-string') ||
            document.querySelector('#owner #channel-name a');
        const authorName = toSafeName(params.author || authorElement?.textContent ||
            document.querySelector('link[itemprop="name"]')?.getAttribute('content') || '');
        let titleText = toSafeName(params.title || title.textContent);
        titleText = `${prefix}${titleText} - by ${authorName} (v=${videoId})`;
        return titleText;
    };
    const createCanvasFromVideo = (video) => {
        console.time('createCanvasFromVideo');
        const width = video.videoWidth;
        const height = video.videoHeight;
        const { canvas, ctx } = getTransferCanvas();
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0);
        const bitmap = ('transferToImageBitmap' in canvas) ?
            canvas.transferToImageBitmap() : null;
        const thumbnail = document.createElement('canvas');
        thumbnail.width = 256;
        thumbnail.height = canvas.height * (256 / canvas.width);
        thumbnail.getContext('2d', { alpha: false, desynchronized: true })
            .drawImage(bitmap || canvas, 0, 0, thumbnail.width, thumbnail.height);
        console.timeEnd('createCanvasFromVideo');
        return { canvas, thumbnail, bitmap };
    };
    const getFileName = (video, params = {}) => {
        const title = getVideoTitle(params);
        const currentTime = video.currentTime;
        const min = Math.floor(currentTime / 60);
        const sec = (currentTime % 60 + 100).toString().substr(1, 6);
        const time = `${min}_${sec}`;
        return `${title}@${time}.png`;
    };
    const createBlobLinkElementAsync = async (canvas, fileName, bitmap) => {
        let url;
        if (bitmap) {
            ({ url } = await DataUrlConv.fromBitmap(bitmap));
        }
        else {
            console.time('canvas to DataURL');
            const dataURL = canvas.toDataURL('image/png');
            console.timeEnd('canvas to DataURL');
            ({ url } = await DataUrlConv.fromDataURL(dataURL));
        }
        return Object.assign(document.createElement('a'), {
            download: fileName, href: url
        });
    };
    const saveScreenShot = (params = {}) => {
        const video = document.querySelector('.html5-main-video');
        if (!video || !video.videoWidth || !video.videoHeight) {
            return;
        }
        const meter = document.createElement('div');
        if (meterContainer) {
            meter.className = 'memory';
            meterContainer.append(meter);
        }
        const { canvas, thumbnail, bitmap } = createCanvasFromVideo(video);
        const fileName = getFileName(video, params);
        createBlobLinkElementAsync(canvas, fileName, bitmap).then(link => {
            document.body.append(link);
            link.click();
            setTimeout(() => {
                link.remove();
                meter.remove();
                URL.revokeObjectURL(link.href);
            }, 1000);
        }).catch(error => {
            meter.remove();
            console.warn('CapTube: screenshot save failed', error);
        });
        if (!previewContainer) {
            return;
        }
        previewContainer.append(thumbnail);
        setTimeout(() => {
            thumbnail.classList.add('is-removing');
            setTimeout(() => { thumbnail.remove(); }, 2000);
        }, 1500);
    };
    const getThumbnailDataURL = async (width, height, type) => {
        const video = document.querySelector('.html5-main-video');
        if (!video) {
            return;
        }
        const canvas = document.createElement('canvas');
        const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
        const dw = video.videoWidth * scale;
        const dh = video.videoHeight * scale;
        canvas.width = dw;
        canvas.height = dh;
        canvas
            .getContext('2d', { alpha: false, desynchronized: true })
            .drawImage(video, 0, 0, dw, dh);
        return canvas.toDataURL(type);
    };
    const setPlaybackRate = (v) => {
        const video = document.querySelector('.html5-main-video');
        if (!video) {
            return;
        }
        video.playbackRate = v;
    };
    const togglePlay = () => {
        const video = document.querySelector('.html5-main-video');
        if (!video) {
            return;
        }
        if (video.paused) {
            video.play();
        }
        else {
            video.pause();
        }
    };
    const seekBy = (v) => {
        const video = document.querySelector('.html5-main-video');
        if (!video) {
            return;
        }
        const ct = Math.max(video.currentTime + v, 0);
        video.currentTime = ct;
    };
    let isVerySlow = false;
    const onKeyDown = (e) => {
        const key = e.key.toLowerCase();
        switch (key) {
            case 'd':
                setPlaybackRate(0.1);
                isVerySlow = true;
                break;
            case 's':
                saveScreenShot({});
                break;
        }
    };
    const onKeyUp = (e) => {
        //console.log('onKeyUp', e);
        const key = e.key.toLowerCase();
        switch (key) {
            case 'd':
                setPlaybackRate(1);
                isVerySlow = false;
                break;
        }
    };
    const onKeyPress = (e) => {
        const key = e.key.toLowerCase();
        switch (key) {
            case 'w':
                togglePlay();
                break;
            case 'a':
                seekBy(isVerySlow ? -0.5 : -5);
                break;
        }
    };
    const getTransferCanvas = function (width = 640, height = 480) {
        const canvas = this.canvas = this.canvas || (typeof OffscreenCanvas === 'function' ?
            new OffscreenCanvas(width, height) :
            Object.assign(document.createElement('canvas'), { width, height }));
        const ctx = this.ctx =
            this.ctx || canvas.getContext('2d', { alpha: false, desynchronized: true });
        return { canvas, ctx };
    }.bind({ canvas: null, ctx: null });
    const initDom = () => {
        const div = document.createElement('div');
        div.id = 'CapTubePreviewContainer';
        previewContainer = div;
        meterContainer = document.createElement('div');
        meterContainer.id = 'CapTubeMeterContainer';
        document.body.append(div, meterContainer);
    };
    const HOST_REG = /^[a-z0-9]*\.nicovideo\.jp$/;
    const parseUrl = (url) => Object.assign(document.createElement('a'), { href: url });
    const initialize = () => {
        initDom();
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('keypress', onKeyPress);
    };
    const initializeEmbed = () => {
        const parentHost = parseUrl(document.referrer).hostname;
        if (!HOST_REG.test(parentHost)) {
            window.console.log('disable bridge');
            return;
        }
        const origin = new URL(document.referrer).origin;
        console.log('%cinit embed CapTube', 'background: lightgreen;');
        window.addEventListener('message', async (e) => {
            if (e.source !== parent || e.origin !== origin) {
                return;
            }
            let data;
            try {
                data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            }
            catch (_) {
                return;
            }
            if (!data || typeof data !== 'object' ||
                !data.body || typeof data.body !== 'object') {
                return;
            }
            const { command, params } = data.body;
            const { sessionId } = data;
            if (command === 'capTube') {
                // Screenshot is an intentional fire-and-forget download.
                saveScreenShot(params || {});
                return;
            }
            if (command !== 'capTubeThumbnail' || !sessionId) {
                return;
            }
            let body;
            try {
                const { width = 320, height = 180, type = 'image/webp' } = params || {};
                const url = await getThumbnailDataURL(width, height, type);
                if (!url) {
                    throw new Error('thumbnail unavailable');
                }
                body = { command: 'commandResult', status: 'ok', params: { result: url } };
            }
            catch (_) {
                body = { command: 'commandResult', status: 'fail',
                    params: { result: 'thumbnail-unavailable' } };
            }
            parent.postMessage({ id: PRODUCT, sessionId, body }, origin);
        });
    };
    if (window.top !== window && location.pathname.indexOf('/embed/') === 0) {
        initializeEmbed();
    }
    else {
        initialize();
    }
})();

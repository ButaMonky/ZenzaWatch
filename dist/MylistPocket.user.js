// ==UserScript==
// @name        MylistPocket
// @namespace   https://github.com/segabito/
// @description 動画をあとで見る ＋ 簡易NG機能。 ZenzaWatchとの連携も可能。
// @match       *://www.nicovideo.jp/*
// @match       *://ext.nicovideo.jp/
// @match       *://ext.nicovideo.jp/#*
// @match       *://ch.nicovideo.jp/*
// @match       *://com.nicovideo.jp/*
// @match       *://commons.nicovideo.jp/*
// @match       *://dic.nicovideo.jp/*
// @match       *://ex.nicovideo.jp/*
// @match       *://info.nicovideo.jp/*
// @match       *://search.nicovideo.jp/*
// @match       *://uad.nicovideo.jp/*
// @match       *://site.nicovideo.jp/*
// @match       *://anime.nicovideo.jp/*
// @match       https://www.google.com/search?*
// @match       https://www.google.co.jp/search?*
// @match       https://*.bing.com/*
// @exclude     *://ads*.nicovideo.jp/*
// @exclude     *://www.upload.nicovideo.jp/*
// @exclude     *://www.nicovideo.jp/watch/*?edit=*
// @exclude     *://ch.nicovideo.jp/tool/*
// @exclude     *://flapi.nicovideo.jp/*
// @exclude     *://dic.nicovideo.jp/p/*
// @exclude     *://ext.nicovideo.jp/thumb/*
// @exclude     *://ext.nicovideo.jp/thumb_channel/*
// @version     0.5.80-task968
// @grant       none
// @author      segabito macmoto
// @license     public domain
// @require     https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// @homepageURL    https://github.com/ButaMonky/ZenzaWatch
// @supportURL     https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/MylistPocket.user.js
// @updateURL      https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/MylistPocket.user.js
// ==/UserScript==
// build: 2026-10-27 12:27Z 5e716422
/* eslint-disable */

const AntiPrototypeJs = function () {
		if (this.promise !== null || !window.Prototype || window.PureArray) {
				return this.promise || Promise.resolve(window.PureArray || window.Array);
		}
		if (document.getElementsByClassName.toString().indexOf('B,A') >= 0) {
				delete document.getElementsByClassName;
		}
		const waitForDom = new Promise(resolve => {
				if (['interactive', 'complete'].includes(document.readyState)) {
						return resolve(undefined);
				}
				document.addEventListener('DOMContentLoaded', resolve, { once: true });
		});
		const f = Object.assign(document.createElement('iframe'), {
				srcdoc: '<html><title>ここだけ時間が10年遅れてるスレ</title></html>',
				id: 'prototype',
				loading: 'eager'
		});
		Object.assign(f.style, { position: 'absolute', left: '-100vw', top: '-100vh' });
		return this.promise = waitForDom
				.then(() => new Promise(res => {
				f.onload = res;
				document.body.append(f);
		})).then(() => {
				window.PureArray = f.contentWindow.Array;
				delete window.Array.prototype.toJSON;
				delete window.String.prototype.toJSON;
				f.remove();
				return Promise.resolve(window.PureArray);
		}).catch(err => console.error(err));
}.bind({ promise: null });
AntiPrototypeJs().then(() => {
  const PRODUCT = 'MylistPocket';

  const monkey = (PRODUCT) => {
    // The monkey function is stringified and injected into the page world.
    // Its dependencies must live inside this function, not the outer userscript.
const ThumbnailSourcePolicy = (() => {
	const getHost = raw => {
		if (typeof raw !== 'string' || !raw.trim()) { return null; }
		try {
			const url = new URL(raw);
			return /^https?:$/.test(url.protocol) ? {host: url.hostname.toLowerCase(),
				secure: url.protocol === 'https:'} : null;
		} catch (_) { return null; }
	};
	const isDirectOriginalOgp = raw => {
		const parsed = getHost(raw);
		return !!parsed && parsed.secure && parsed.host === 'img.cdn.nimg.jp';
	};
	const isKnownCompositedOgp = raw => {
		const parsed = getHost(raw);
		return !!parsed && parsed.host === 'goptim.video.nimg.jp';
	};
	const select = (thumbnail, fallback = [], options = {}) => {
		const thumb = thumbnail && typeof thumbnail === 'object' ? thumbnail : {};
		const others = Array.isArray(fallback) ? fallback : [];
		const mode = options.mode === 'legacy' ? 'legacy' : 'smart';
		const ogp = thumb.ogp;
		const player = thumb.player;
		if (mode === 'legacy') { return [ogp, player, ...others]; }
		const preferred = isDirectOriginalOgp(ogp) ? ogp : null;
		const backupOgp = options.includeUnknownOgp && !isKnownCompositedOgp(ogp) ?
			ogp : null;
		return [preferred, player, ...others, backupOgp]
			.filter(value => !isKnownCompositedOgp(value));
	};
	return {select, isDirectOriginalOgp, isKnownCompositedOgp};
})();
const PocketThumbnail = (() => {
		const CACHE_MS = 5 * 60 * 1000;
		const NEGATIVE_MS = 60 * 1000;
		const MAX_CACHE = 64;
		const cache = new Map();
		const pending = new Map();
		const imageOwners = new WeakMap();
		const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ?
				value : null;
		const normalize = (values) => {
				const urls = [];
				for (const value of values) {
						if (typeof value !== 'string' || !value.trim()) {
								continue;
						}
						try {
								const url = new URL(value);
								if (url.protocol === 'https:' || url.protocol === 'http:') {
										const safe = url.protocol === 'http:' ? 'https:' + url.href.slice(5) : url.href;
										if (!urls.includes(safe)) {
												urls.push(safe);
										}
								}
						}
						catch (_) { /* skip malformed image URL */ }
				}
				return urls;
		};
		const watchUrls = (payload) => {
				const outer = record(payload);
				const data = record(outer?.data);
				const response = record(data?.response) || record(outer?.response);
				const v4 = record(record(response?.$watchV4)?.data);
				const thumb = record(record((v4 || response)?.video)?.thumbnail);
				if (!thumb) {
						return [];
				}
				return normalize(ThumbnailSourcePolicy.select(thumb, [
						thumb.large, thumb.largeUrl, thumb.middle, thumb.middleUrl,
						thumb.normal, thumb.url
				], { mode: 'smart', includeUnknownOgp: true }));
		};
		const legacyUrls = (thumbnail, hasLarge = false) => {
				const normal = normalize([thumbnail]);
				if (!normal.length) {
						return [];
				}
				const original = normal[0];
				const large = hasLarge &&
						/^https:\/\/(?:nicovideo\.cdn\.nimg\.jp|tn\.smilevideo\.jp)\//.test(original) &&
						!/[?#]/.test(original) ?
						original.replace(/\.[ML]$/, '') + '.L' : '';
				return normalize([large, original]);
		};
		const install = (image, urls, isCurrent = () => true) => {
				const sources = normalize(urls);
				if (!sources.length || !isCurrent()) {
						return;
				}
				const token = {};
				imageOwners.set(image, token);
				let cursor = 0;
				const next = () => {
						if (imageOwners.get(image) !== token || !isCurrent()) {
								return;
						}
						if (cursor >= sources.length) {
								image.onerror = null;
								return;
						}
						const url = sources[cursor++];
						image.onerror = () => { next(); };
						image.src = url;
				};
				next();
		};
		const getHighQuality = async (watchId, fetcher, hostname) => {
				if (hostname !== 'www.nicovideo.jp' ||
						!/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(watchId)) {
						return [];
				}
				const now = Date.now();
				const saved = cache.get(watchId);
				if (saved && saved.until > now) {
						return [...saved.urls];
				}
				const existing = pending.get(watchId);
				if (existing) {
						return [...await existing];
				}
				const job = (async () => {
						let urls = [];
						try {
								const url = 'https://www.nicovideo.jp/watch/' +
										encodeURIComponent(watchId) + '?responseType=json';
								const response = await fetcher(url, { credentials: 'include', timeout: 4000 });
								if (response.ok) {
										urls = watchUrls(await response.json());
								}
						}
						catch (_) {
						}
						if (cache.size >= MAX_CACHE) {
								const first = cache.keys().next().value;
								if (first !== undefined) {
										cache.delete(first);
								}
						}
						cache.set(watchId, { until: Date.now() + (urls.length ? CACHE_MS : NEGATIVE_MS), urls });
						return urls;
				})();
				pending.set(watchId, job);
				try {
						return [...await job];
				}
				finally {
						if (pending.get(watchId) === job) {
								pending.delete(watchId);
						}
				}
		};
		return { normalize, watchUrls, legacyUrls, install, getHighQuality };
})();
const PocketDescriptionCard = (() => {
	const MAX_CONCURRENT = 3;
	const ownedCards = new WeakSet();
	const safeId = id => typeof id === 'string' &&
		/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(id);
	const formatCount = value => {
		const n = Number(value);
		if (value == null || !Number.isFinite(n) || n < 0) { return '不明'; }
		if (n >= 1e8) { return String(Math.floor(n / 1e7) / 10) + '億'; }
		if (n >= 1e4) { return String(Math.floor(n / 1e3) / 10) + '万'; }
		return n.toLocaleString('ja-JP');
	};
	const formatDuration = seconds => {
		const n = Number(seconds);
		if (!Number.isFinite(n) || n < 0) { return ''; }
		const t = Math.floor(n), min = Math.floor(t / 60);
		return min + ':' + String(t % 60).padStart(2, '0');
	};
	const CSS = [
		'#mylistPocket-popup .mpp-video-card { display:grid; grid-template-columns:100px minmax(0,1fr); grid-template-rows:auto; column-gap:9px; align-items:start; min-height:84px; margin:8px 0; padding:5px; background:#303035; border:1px solid #56565c; border-radius:4px; line-height:1.3; color:#ddd; box-sizing:border-box; }',
		'#mylistPocket-popup .mpp-video-card:hover { background:#393942; }',
		'#mylistPocket-popup .mpp-video-card.is-ng-wait { outline:1px dotted rgba(192,192,192,.8); }',
		'#mylistPocket-popup .mpp-video-card.is-ng-queue { outline:2px dotted rgba(192,192,192,.8); }',
		'#mylistPocket-popup .mpp-video-card.is-ng-current { outline:3px dotted rgba(128,225,128,.8); }',
		'#mylistPocket-popup .mpp-video-card.is-ng-resolved { outline:0 solid green; }',
		'#mylistPocket-popup .mpp-video-card.is-fav-favorited { outline:3px dotted orange; outline-offset:3px; }',
		'#mylistPocket-popup .mpp-video-card.is-ng-rejected { display:none; }',
		'body.is-ng-disable #mylistPocket-popup .mpp-video-card.is-ng-rejected { display:grid!important; opacity:.5; pointer-events:auto; visibility:visible; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-thumb { position:relative; width:96px; height:72px; display:block; margin:0; padding:0; border:0; overflow:hidden; background:#151515; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-thumb img { display:block; width:96px; height:72px; object-fit:contain; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-duration { position:absolute; right:0; bottom:0; background:#000b; color:#fff; padding:1px 3px; font-size:11px; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-body { min-width:0; display:flex; flex-direction:column; gap:4px; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-title { color:#f4f3e9; font-size:13px; font-weight:bold; overflow-wrap:anywhere; text-decoration:none; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-title:hover { text-decoration:underline; color:#fff; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-meta { font-size:11px; color:#aaa; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-counters { font-size:11px; color:#bbb; display:flex; flex-wrap:wrap; gap:1px 8px; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-actions { display:flex; align-items:center; gap:7px; min-width:0; margin-top:auto; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-owner { display:flex; align-items:center; gap:5px; min-width:0; flex:1 1 auto; color:#c6c8cb; text-decoration:none; font-size:11px; line-height:20px; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-owner[href]:hover { color:#f8f8f8; text-decoration:underline; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-owner-icon { width:20px; height:20px; border-radius:50%; object-fit:cover; flex:none; background:#444; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-owner-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-info { margin-left:auto; flex:0 0 auto; white-space:nowrap; border:1px solid #777; background:#444; padding:2px 5px; color:#fff; cursor:pointer; font-size:11px; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-info:hover { background:#666; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-state { font-size:10px; color:#aab; }',
		'#mylistPocket-popup .mpp-video-card .mpp-card-state:empty { display:none; }',
		'#mylistPocket-popup .mpp-video-card.is-failed .mpp-card-state { color:#dbb; }',
		'#mylistPocket-popup .mpp-video-card.is-adDecoration-gold .mpp-card-thumb:after, #mylistPocket-popup .mpp-video-card.is-adDecoration-silver .mpp-card-thumb:after { content:""; position:absolute; top:0; left:0; width:22px; height:22px; z-index:1; background-size:contain; pointer-events:none; }',
		"#mylistPocket-popup .mpp-video-card.is-adDecoration-gold .mpp-card-thumb:after { background-image:url(\"data:image/svg+xml,%3csvg%20width='50'%20height='50'%20viewBox='0%200%2050%2050'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M48.9979%200H3.00073H1.00024C0.448108%200%200%200.448108%200%201.00024V3.00073V48.9979C0%2049.8911%201.08126%2050.3362%201.71041%2049.702L3.7109%2047.6855C3.89694%2047.4975%204.00097%2047.2444%204.00097%2046.9814V40.0097L40.0097%204.00097H46.9814C47.2454%204.00097%2047.4985%203.89694%2047.6855%203.7109L49.702%201.71041C50.3362%201.08126%2049.8911%200%2048.9979%200Z'%20fill='%23FFD700'/%3e%3cg%20clip-path='url(%23clip0_597_346)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M10.6963%205.59039C11.2495%205.04209%2012.4718%205.27496%2013.9554%206.08324L13.7742%207.09236C13.0017%206.72641%2012.4028%206.64263%2012.1231%206.92109C11.4725%207.57042%2012.7897%209.93858%2015.0717%2012.2119C17.3524%2014.4839%2019.7293%2015.8011%2020.3811%2015.1505C20.662%2014.8794%2020.5758%2014.2745%2020.2086%2013.5044L21.2141%2013.3245C22.0261%2014.8055%2022.2602%2016.0204%2021.7106%2016.5699C21.5862%2016.687%2021.4321%2016.7695%2021.2658%2016.8102L21.267%2016.8127L9.91263%2019.8486L9.34337%2021.9679C9.32858%2022.032%209.29654%2022.0911%209.24972%2022.1392C8.86405%2022.515%207.63435%2021.9051%206.4909%2020.7641C5.34745%2019.6219%204.7326%2018.3935%205.11211%2018.014C5.16016%2017.9684%205.21931%2017.9364%205.28461%2017.9216L7.4101%2017.3536L10.4499%206.03395C10.4917%205.86638%2010.5768%205.7136%2010.6963%205.59039ZM21.558%2010.6172C21.8389%2010.5421%2022.1272%2010.7084%2022.2024%2010.9881L22.2319%2011.099C22.3071%2011.3787%2022.1408%2011.6658%2021.8598%2011.7409L18.1757%2012.7254C17.8947%2012.8006%2017.6076%2012.6342%2017.5312%2012.3546L17.5017%2012.2437C17.4265%2011.964%2017.5928%2011.6769%2017.8738%2011.6017L21.558%2010.6172ZM19.2388%207.22949C19.4445%207.02496%2019.7772%207.02496%2019.983%207.22949L20.0643%207.31205C20.2701%207.51658%2020.2701%207.84802%2020.0643%208.05256L16.9556%2011.1526C16.7498%2011.3571%2016.4171%2011.3571%2016.2113%2011.1526L16.13%2011.0713C15.9242%2010.8655%2015.9242%2010.5341%2016.13%2010.3295L19.2388%207.22949ZM16.0671%205.00177L16.1607%205.01806L16.2728%205.04763C16.5538%205.12279%2016.7201%205.41111%2016.6449%205.6908L15.6567%209.36256C15.5828%209.64226%2015.2932%209.80859%2015.0135%209.73343L14.9014%209.70386C14.6205%209.6287%2014.4541%209.34162%2014.5293%209.06192L15.5175%205.38893C15.5927%205.10924%2015.8798%204.9429%2016.1607%205.01806L16.0671%205.00177Z'%20fill='%23DCA000'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_597_346'%3e%3crect%20width='18'%20height='18'%20fill='white'%20transform='translate(5%205)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\"); }",
		"#mylistPocket-popup .mpp-video-card.is-adDecoration-silver .mpp-card-thumb:after { background-image:url(\"data:image/svg+xml,%3csvg%20width='50'%20height='50'%20viewBox='0%200%2050%2050'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M48.9979%200H3.00073H1.00024C0.448108%200%200%200.448108%200%201.00024V3.00073V48.9979C0%2049.8911%201.08126%2050.3362%201.71041%2049.702L3.7109%2047.6855C3.89694%2047.4975%204.00097%2047.2444%204.00097%2046.9814V40.0097L40.0097%204.00097H46.9814C47.2454%204.00097%2047.4985%203.89694%2047.6855%203.7109L49.702%201.71041C50.3362%201.08126%2049.8911%200%2048.9979%200Z'%20fill='%23BEC8C8'/%3e%3cg%20clip-path='url(%23clip0_597_345)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M10.6963%205.59039C11.2495%205.04209%2012.4718%205.27496%2013.9554%206.08324L13.7742%207.09236C13.0017%206.72641%2012.4028%206.64263%2012.1231%206.92109C11.4725%207.57042%2012.7897%209.93858%2015.0717%2012.2119C17.3524%2014.4839%2019.7293%2015.8011%2020.3811%2015.1505C20.662%2014.8794%2020.5758%2014.2745%2020.2086%2013.5044L21.2141%2013.3245C22.0261%2014.8055%2022.2602%2016.0204%2021.7106%2016.5699C21.5862%2016.687%2021.4321%2016.7695%2021.2658%2016.8102L21.267%2016.8127L9.91263%2019.8486L9.34337%2021.9679C9.32858%2022.032%209.29654%2022.0911%209.24972%2022.1392C8.86405%2022.515%207.63435%2021.9051%206.4909%2020.7641C5.34745%2019.6219%204.7326%2018.3935%205.11211%2018.014C5.16016%2017.9684%205.21931%2017.9364%205.28461%2017.9216L7.4101%2017.3536L10.4499%206.03395C10.4917%205.86638%2010.5768%205.7136%2010.6963%205.59039ZM21.558%2010.6172C21.8389%2010.5421%2022.1272%2010.7084%2022.2024%2010.9881L22.2319%2011.099C22.3071%2011.3787%2022.1408%2011.6658%2021.8598%2011.7409L18.1757%2012.7254C17.8947%2012.8006%2017.6076%2012.6342%2017.5312%2012.3546L17.5017%2012.2437C17.4265%2011.964%2017.5928%2011.6769%2017.8738%2011.6017L21.558%2010.6172ZM19.2388%207.22949C19.4445%207.02496%2019.7772%207.02496%2019.983%207.22949L20.0643%207.31205C20.2701%207.51658%2020.2701%207.84802%2020.0643%208.05256L16.9556%2011.1526C16.7498%2011.3571%2016.4171%2011.3571%2016.2113%2011.1526L16.13%2011.0713C15.9242%2010.8655%2015.9242%2010.5341%2016.13%2010.3295L19.2388%207.22949ZM16.0671%205.00177L16.1607%205.01806L16.2728%205.04763C16.5538%205.12279%2016.7201%205.41111%2016.6449%205.6908L15.6567%209.36256C15.5828%209.64226%2015.2932%209.80859%2015.0135%209.73343L14.9014%209.70386C14.6205%209.6287%2014.4541%209.34162%2014.5293%209.06192L15.5175%205.38893C15.5927%205.10924%2015.8798%204.9429%2016.1607%205.01806L16.0671%205.00177Z'%20fill='%23889C9C'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_597_345'%3e%3crect%20width='18'%20height='18'%20fill='white'%20transform='translate(5%205)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\"); }"
	].join('\n');
	const enableZenzaLinks = container => {
		if (!container || typeof container.querySelectorAll !== 'function') { return 0; }
		const cards = container.classList?.contains('mpp-video-card') ?
			[container] : Array.from(container.querySelectorAll('.mpp-video-card'));
		let enabled = 0;
		for (const card of cards) {
			if (!ownedCards.has(card)) { continue; }
			const watchId = card.dataset && card.dataset.watchId;
			if (!safeId(watchId)) { continue; }
			for (const link of card.querySelectorAll('a.mpp-card-thumb, a.mpp-card-title')) {
				link.classList.add('command', 'noHoverMenu');
				link.dataset.command = 'zenza-open';
				link.dataset.param = watchId;
			}
			enabled++;
		}
		return enabled;
	};
	const make = (document, watchId, url, originalLabel, useZenza) => {
		if (!safeId(watchId) || !/^https:\/\/www\.nicovideo\.jp\/(?:watch|shorts)\//.test(url)) { return null; }
		const node = tag => document.createElement(tag);
		const root = node('div');
		root.className = 'mpp-video-card';
		root.dataset.watchId = watchId;
		ownedCards.add(root);
		const thumb = node('a');
		thumb.className = 'mpp-card-thumb';
		thumb.href = url;
		thumb.setAttribute('aria-label', originalLabel || watchId);
		const image = node('img');
		image.alt = '';
		image.loading = 'lazy';
		thumb.append(image);
		const duration = node('span');
		duration.className = 'mpp-card-duration';
		thumb.append(duration);
		const body = node('div');
		body.className = 'mpp-card-body';
		const title = node('a');
		title.className = 'mpp-card-title';
		title.textContent = originalLabel || watchId;
		title.title = originalLabel || watchId;
		title.href = url;
		const meta = node('span'); meta.className = 'mpp-card-meta';
		const counters = node('span'); counters.className = 'mpp-card-counters';
		const actions = node('div'); actions.className = 'mpp-card-actions';
		const ownerLink = node('a'); ownerLink.className = 'mpp-card-owner';
		const ownerIcon = node('img'); ownerIcon.className = 'mpp-card-owner-icon';
		ownerIcon.alt = ''; ownerIcon.loading = 'lazy';
		const ownerName = node('span'); ownerName.className = 'mpp-card-owner-name';
		ownerName.textContent = '投稿者を確認中…';
		ownerLink.append(ownerIcon, ownerName);
		const infoButton = node('button');
		infoButton.type = 'button';
		infoButton.className = 'command mpp-card-info';
		infoButton.dataset.command = 'info';
		infoButton.dataset.param = watchId;
		infoButton.textContent = '動画情報';
		const state = node('span'); state.className = 'mpp-card-state';
		state.textContent = '取得中…';
		actions.append(ownerLink, infoButton);
		body.append(title, meta, counters, state, actions);
		root.append(thumb, body);
		if (useZenza) { enableZenzaLinks(root); }
		return {root, image, title, thumb, duration, meta, counters,
			ownerLink, ownerIcon, ownerName, infoButton, state, watchId};
	};
	const BLANK_ICON = 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg';
	const isBlank = icon => !icon || /\/defaults\/blank(?:_s)?\.jpg/i.test(icon);
	const validIcon = icon => typeof icon === 'string' && /^https?:\/\//i.test(icon) ?
		icon.replace(/^http:/i, 'https:') : BLANK_ICON;
	const userCdnIcon = owner => {
		const id = String(owner?.id ?? '');
		if (owner?.type !== 'user' || !/^[1-9]\d{0,17}$/.test(id)) {
			return null;
		}
		const bucket = id.length > 4 ? id.slice(0, -4) : '0';
		return `https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/${bucket}/${id}.jpg`;
	};
	const selectIconSources = owner => {
		const primary = validIcon(owner?.icon || owner?.iconUrl);
		const derived = userCdnIcon(owner);
		const sources = [];
		if (!isBlank(primary)) { sources.push(primary); }
		if (derived && !sources.includes(derived)) { sources.push(derived); }
		sources.push(BLANK_ICON);
		return sources;
	};
	const showOwner = (card, owner) => {
		if (!card || !card.ownerLink) { return; }
		const label = typeof owner?.name === 'string' && owner.name.trim() ?
			owner.name.trim() : '(投稿者情報なし)';
		const type = owner?.type;
		const rawId = String(owner?.id ?? '');
		const id = type === 'channel' ? rawId.replace(/^ch/, '') : rawId;
		const valid = /^\d{1,18}$/.test(id) &&
			(type === 'user' || type === 'channel');
		card.ownerName.textContent = label;
		card.ownerName.title = label;
		if (valid) {
			card.ownerLink.href = type === 'user' ?
				`https://www.nicovideo.jp/user/${id}` :
				`https://ch.nicovideo.jp/ch${id}`;
			card.ownerLink.target = '_blank';
			card.ownerLink.rel = 'noopener noreferrer';
			card.ownerLink.title = '投稿者ページ: ' + label;
		} else {
			card.ownerLink.removeAttribute('href');
			card.ownerLink.removeAttribute('target');
			card.ownerLink.removeAttribute('title');
		}
		const img = card.ownerIcon;
		const sources = selectIconSources(owner);
		let index = 0;
		img.onerror = () => {
			if (index + 1 >= sources.length) {
				img.onerror = null;
				img.removeAttribute('src');
				return;
			}
			img.src = sources[++index];
		};
		img.src = sources[0];
	};
	const applyExtra = (card, extra) => {
		if (!card || !extra || typeof extra !== 'object') { return false; }
		if (typeof extra.likeCount === 'number' &&
				Number.isSafeInteger(extra.likeCount) && extra.likeCount >= 0 &&
				card.likeCell) {
			card.likeCell.textContent = 'いいね: ' + formatCount(extra.likeCount);
			card.likeCell.title = 'いいね: ' + extra.likeCount.toLocaleString('ja-JP');
		}
		const previous = card.info?.owner;
		const isMissing = !previous?.id ||
			['(投稿者情報なし)', '(非公開ユーザー)'].includes(previous?.name);
		const alreadyLinked = card.ownerLink?.hasAttribute('href');
		if (extra.owner && ((isMissing && !alreadyLinked) || (
			!isMissing && String(previous.id) === String(extra.owner.id) &&
			isBlank(previous.icon || previous.iconUrl)))) {
			showOwner(card, isMissing ? extra.owner : {
				...previous, icon:extra.owner.icon || previous.icon
			});
		}
		return true;
	};
	const applyInfo = (card, info, {installImage, isCurrent} = {}) => {
		if (!card || !info || info.status !== 'ok') { return false; }
		if (typeof info.title === 'string' && info.title) {
			card.title.textContent = info.title;
			card.title.title = info.title;
		}
		if (info.postedAt) { card.meta.textContent = String(info.postedAt); }
		card.duration.textContent = formatDuration(info.duration);
		const cells = [['再生', info.viewCount], ['コメ', info.commentCount],
			['マイ', info.mylistCount], ['いいね', info.likeCount]];
		card.counters.replaceChildren();
		for (const [label, val] of cells) {
			const item = card.root.ownerDocument.createElement('span');
			item.textContent = label + ': ' + formatCount(val);
			if (val !== null && val !== undefined && Number.isFinite(Number(val))) {
				item.title = label + ': ' + Number(val).toLocaleString('ja-JP');
			}
			card.counters.append(item);
			if (label === 'いいね') { card.likeCell = item; }
		}
		showOwner(card, info.owner);
		if (typeof installImage === 'function' && info.thumbnail) {
			installImage(card.image, info.thumbnail, isCurrent, info);
		}
		card.state.textContent = '';
		card.root.classList.remove('is-failed');
		return true;
	};
	const applyDecoration = (card, decoration) => {
		if (!card) { return; }
		card.root.classList.toggle('is-adDecoration-gold', decoration === 'gold');
		card.root.classList.toggle('is-adDecoration-silver', decoration === 'silver');
	};
	const hydrate = async (cards, {loadInfo, loadDecoration, loadExtra, installImage, isCurrent}) => {
		const safeCards = (cards || []).filter(card => card && safeId(card.watchId));
		if (!safeCards.length || !isCurrent()) { return; }
		let cursor = 0;
		const worker = async () => {
			while (cursor < safeCards.length && isCurrent()) {
				const card = safeCards[cursor++];
				try {
					const info = await loadInfo(card.watchId);
					if (!isCurrent() || !card.root.isConnected) { continue; }
					if (!applyInfo(card, info, {
						installImage, isCurrent: () => isCurrent() && card.root.isConnected
					})) {
						card.root.classList.add('is-failed');
						card.state.textContent = '動画情報を取得できません';
						continue;
					}
					card.info = info;
				} catch (_) {
					if (isCurrent() && card.root.isConnected) {
						card.root.classList.add('is-failed');
						card.state.textContent = '詳細情報を取得できません';
					}
				}
			}
		};
		await Promise.all(Array.from({length: Math.min(MAX_CONCURRENT, safeCards.length)}, () => worker()));
		if (!isCurrent()) { return; }
		const valid = safeCards.filter(card => card.info && card.info.status === 'ok' && card.root.isConnected);
		if (!valid.length) { return; }
		const idOf = card => safeId(card.info.videoId) ? card.info.videoId :
			safeId(card.info.id) ? card.info.id : card.watchId;
		const tasks = [];
		if (typeof loadDecoration === 'function') {
			tasks.push((async () => {
				const ids = [...new Set(valid.map(idOf))];
				try {
					const grades = await loadDecoration(ids);
					if (!isCurrent() || !(grades && typeof grades.get === 'function')) { return; }
					for (const card of valid) {
						if (card.root.isConnected) { applyDecoration(card, grades.get(idOf(card))); }
					}
				} catch (_) {
				}
			})());
		}
		if (typeof loadExtra === 'function') {
			let index = 0;
			const extraWorker = async () => {
				while (index < valid.length && isCurrent()) {
					const card = valid[index++];
					try {
						const extra = await loadExtra(idOf(card));
						if (isCurrent() && card.root.isConnected) { applyExtra(card, extra); }
					} catch (_) {
					}
				}
			};
			tasks.push(Promise.all(Array.from({
				length:Math.min(MAX_CONCURRENT, valid.length)
			}, () => extraWorker())));
		}
		await Promise.all(tasks);
	};
	return {CSS, make, enableZenzaLinks, applyInfo, applyExtra,
		showOwner, userCdnIcon, selectIconSources, applyDecoration, hydrate,
		formatCount, formatDuration};
})();
const PocketCardMetadataLoader = (() => {
	const API = 'https://nvapi.nicovideo.jp/v1/videos?watchIds=';
	const OK_TTL_MS = 10 * 60 * 1000;
	const FAILED_TTL_MS = 30 * 1000;
	const MAX_CACHE = 200;
	const cache = new Map();
	const inFlight = new Map();
	const safeId = id => typeof id === 'string' &&
		/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(id);
	const validLike = n =>
		typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
	const normalizeOwner = raw => {
		if (!raw || typeof raw !== 'object' || raw.visibility === 'hidden') {
			return null;
		}
		const type = raw.ownerType || raw.type;
		const rawId = String(raw.id ?? '');
		const isUser = type === 'user' && /^\d+$/.test(rawId);
		const isChannel = type === 'channel' && /^(?:ch)?\d+$/.test(rawId);
		if (!isUser && !isChannel) { return null; }
		const id = isChannel ? rawId.replace(/^ch/, '') : rawId;
		const name = typeof raw.name === 'string' && raw.name.trim() ?
			raw.name.trim() : '(投稿者情報なし)';
		const icon = typeof raw.iconUrl === 'string' &&
			/^https?:\/\//i.test(raw.iconUrl) ? raw.iconUrl.replace(/^http:/i,'https:') : '';
		const url = isUser ? `https://www.nicovideo.jp/user/${id}` :
			`https://ch.nicovideo.jp/ch${id}`;
		return {type: isUser ? 'user' : 'channel', id, name, icon, url};
	};
	const parse = (payload, requestedId) => {
		if (!payload || payload.meta?.status !== 200 ||
				!Array.isArray(payload.data?.items)) { return null; }
		const item = payload.data.items.find(row => row && row.watchId === requestedId);
		const video = item?.video;
		if (!video || !safeId(video.id)) { return null; }
		return {
			videoId: video.id,
			likeCount: validLike(video.count?.like) ? video.count.like : null,
			owner: normalizeOwner(video.owner)
		};
	};
	const query = async (watchId, fetcher) => {
		const fetchApi = fetcher || (typeof netUtil !== 'undefined' ? netUtil.fetch.bind(netUtil) : fetch);
		const response = await fetchApi(API + encodeURIComponent(watchId), {
			credentials:'omit', timeout:6000,
			headers:{'X-Frontend-Id':'6','X-Frontend-Version':'0'}
		});
		if (!response || !response.ok) { return null; }
		return parse(await response.json(), watchId);
	};
	const load = (watchId, fetcher) => {
		if (!safeId(watchId)) { return Promise.resolve(null); }
		const now = Date.now();
		const old = cache.get(watchId);
		if (old && old.expires > now) { return Promise.resolve(old.value); }
		if (inFlight.has(watchId)) { return inFlight.get(watchId); }
		const pending = Promise.resolve()
			.then(() => query(watchId, fetcher))
			.catch(() => null)
			.then(value => {
				cache.delete(watchId);
				cache.set(watchId, {value, expires:Date.now()+(value ? OK_TTL_MS : FAILED_TTL_MS)});
				if (cache.size > MAX_CACHE) { cache.delete(cache.keys().next().value); }
				return value;
			})
			.finally(() => inFlight.delete(watchId));
		inFlight.set(watchId, pending);
		return pending;
	};
	return {load, parse, normalizeOwner, validLike};
})();
    const console = window.console;
    const {workerUtil} = window.MylistPocketLib;
    //const $ = window.jQuery;
    console.log(`%c${PRODUCT}`,
      'font-family: "Apple LiGothic"; padding: 4px; background: red; color: white; font-size: 150%;'
    );
    const TOKEN = 'r:' + (Math.random());

    const CONSTANT = {
      BASE_Z_INDEX: 100000
    };
    const MylistPocket = {debug: {}};
    window.MylistPocket = MylistPocket;

    const protocol = location.protocol;
    const global = {
      debug: MylistPocket.debug,
      TOKEN,
      PRODUCT
    };

    const __css__ = (`
      ${PocketDescriptionCard.CSS}
      a[href*='watch/'] > g-img {
        position: inherit;
      }

      .mylistPocketHoverMenu {
        display: none;
        opacity: 0.8;
        position: absolute;
        z-index: ${CONSTANT.BASE_Z_INDEX + 100000};
        font-size: 8pt;
        padding: 0;
        line-height: 26px;
        font-weight: bold;
        text-align: center;
        transition: box-shadow 0.2s ease, opacity 0.4s ease, padding 0.2s ease;
        user-select: none;
      }

      .mylistPocketHoverMenu.is-busy {
        opacity: 0 !important;
        pointer-events: none;
      }
        .mylistPocketHoverMenu.is-otherDomain .wwwOnly {
          display: none;
        }
        .mylistPocketHoverMenu.is-otherDomain:not(.is-zenzaReady) .wwwZenzaOnly {
          display: none;
        }
        .mylistPocketHoverMenu .zenzaMenu {
          display: none;
        }
        .mylistPocketHoverMenu.is-zenzaReady .zenzaMenu {
          display: inline-block;
        }


      .mylistPocketButton {
        /*font-family: Menlo;*/
        display: block;
        font-weight: bolder;
        cursor: pointer;
        width: 32px;
        height: 26px;
        background: #ccc;
        color: black;
        cursor: pointer;
        box-shadow: 1px 1px 1px #000;
        transition:
          0.1s box-shadow ease,
          0.1s transform ease;
        font-size: 16px;
        line-height: 24px;
        -webkit-user-select: none;
        -moz-use-select: none;
        user-select: none;
        outline: none;
      }

      .mylistPocketButton:hover {
        transform: scale(1.2);
        box-shadow: 4px 4px 5px #000;
      }

      .mylistPocketButton:active {
        transform: scale(1.0);
        box-shadow: none;
        transition: none;
      }

      .is-deflistUpdating .mylistPocketButton.deflist-add::after,
      .is-deflistSuccess  .mylistPocketButton.deflist-add::after,
      .is-deflistFail     .mylistPocketButton.deflist-add::after,
      .mylistPocketButton:hover::after, #mylistPocket-poupup [tooltip] {
        content: attr(tooltip);
        position: absolute;
        /*top:  0px;
        left: 50%;*/
        top:  50%;
        right: -8px;
        padding: 2px 4px;
        white-space: nowrap;
        font-size: 12px;
        color: #fff;
        background: #333;
        transform: translate3d(-50%, -120%, 0);
        transform: translate3d(100%, -50%, 0);
        pointer-events: none;
      }

      .is-deflistUpdating .mylistPocketButton.deflist-add {
        cursor: wait;
        opacity: 0.9;
        transform: scale(1.0);
        box-shadow: none;
        transition: none;
        background: #888;
        border-style: inset;
      }
      .is-deflistSuccess .mylistPocketButton.deflist-add,
      .is-deflistFail    .mylistPocketButton.deflist-add {
        transform: scale(1.0);
        box-shadow: none;
        transition: none;
      }
      .is-deflistSuccess  .mylistPocketButton.deflist-add::after {
        content: attr(data-result);
        background: #393;
      }
      .is-deflistFail     .mylistPocketButton.deflist-add::after {
        content: attr(data-result);
        background: #933;
      }
      .is-deflistUpdating .mylistPocketButton.deflist-add::after {
        content: '更新中';
        background: #333;
      }

      .mylistPocketButton + .mylistPocketButton {
        margin-top: 4px;
      }

      .mylistPocketHoverMenu:hover {
        font-weibht: bolder;
        opacity: 1;
      }

      .mylistPocketHoverMenu:active {
      }

      .mylistPocketHoverMenu.is-show {
        display: block;
      }

      #mylistPocket-popup {
        display: none;
        perspective: 800px;
      }
      #mylistPocket-popup.is-firefox {
        /*perspective: none !important;*/
        position: fixed;
        transform: translate3d(-50%, -50%, 0);
        opacity: 0;
        transition: 0.3s opacity ease;
        top: -9999px; left: -9999px;
      }

      #mylistPocket-popup.show {
        display: block;
      }
      #mylistPocket-popup.is-firefox.show {
        top: 50%;
        left: 50%;
        opacity: 1;
      }


      #mylistPocket-popup .owner-icon {
        width: 64px;
        height: 64px;
        transform-origin: center;
        transform-origin: center;
        transition:
          0.2s transform ease,
          0.2s box-shadow ease
        ;
      }
      #mylistPocket-popup .owner-icon:hover {
      }

      #mylistPocket-popup .description a:not(.mpp-card-title):not(.mpp-card-thumb):not(.mpp-card-owner) {
        color: #ffff00 !important;
        text-decoration: none !important;
        font-weight: normal !important;
        display: inline-block;
      }
      #mylistPocket-popup .description a.watch {
        position: relative;
        display: block;
        backface-visibility: hidden;
      }

      #mylistPocket-popup .description a[data-title]:hover::after {
        content: attr(data-title);
        position: absolute;
        top: -16px;
        left: 0;
        word-break: break-all;
        line-height: 12px;
        padding: 4px;
        font-size: 12px;
        color: #333;
        background: #ffc;
        opacity: 0.8;
        user-select: none;
        pointer-events: none;
      }

      #mylistPocket-popup .description a:not(.mpp-card-title):not(.mpp-card-thumb):not(.mpp-card-owner):visited {
        color: #ffff99 !important;
      }
      #mylistPocket-popup .description button:not(.mpp-card-info) {
        /*font-family: Menlo;*/
        font-size: 16px;
        font-weight: bolder;
        margin: 4px 8px;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 0;
        background: #333;
        color: #ccc;
        border: solid 2px #ccc;
        outline: none;
      }
      #mylistPocket-popup .description button:not(.mpp-card-info):hover {
        transform: translate(-2px,-2px);
        box-shadow: 2px 2px 2px #000;
        background: #666;
        transition:
          0.2s transform ease,
          0.2s box-shadow ease
          ;
      }
      #mylistPocket-popup .description button:not(.mpp-card-info):active {
        transform: none;
        box-shadow: none;
        transition: none;
      }
      #mylistPocket-popup .description button:not(.mpp-card-info):active::hover {
        opacity: 0;
      }

      #mylistPocket-popup .watch {
        display: block;
        position: relative;
        line-height: 60px;
        box-sizing: border-box;
        padding: 4px 16px;;
        min-height: 60px;
        width: 280px;
        margin: 8px 10px;
        background: #444;
        border-radius: 4px;
      }

      #mylistPocket-popup .watch:hover {
        background: #446;
      }

      #mylistPocket-popup .videoThumbnail {
        position: absolute;
        right: 16px;
        height: 60px;
        transform-origin: center;
        transition:
          0.2s transform ease,
          0.2s box-shadow ease
        ;
      }
      #mylistPocket-popup .videoThumbnail:hover {
        transform: scale(2);
        box-shadow: 0 0 8px #888;
        transition:
          0.2s transform ease 0.5s,
          0.2s box-shadow ease 0.5s
        ;
      }


    .zenzaPlayerContainer.is-error   #mylistPocket-popup,
    .zenzaPlayerContainer.is-loading #mylistPocket-popup,
    .zenzaPlayerContainer.error   #mylistPocket-popup,
    .zenzaPlayerContainer.loading #mylistPocket-popup {
      opacity: 0;
      pointer-events: none;
    }

    .mylistPocketHoverMenu.is-guest .is-need-login {
      display: none !important;
    }

      .xDomainLoaderFrame {
        position: fixed;
        left: -100%;
        top: -100%;
        width: 64px;
        height: 64px;
        opacity: 0;
        border: 0;
      }

      body.BaseLayout {
        margin-top: 0 !important;
      }
      ${
      location.host === 'www.niovideo.jp' ? `
      #siteHeader {
        position: sticky;
        left: 0 !important;
        will-change: transform;
      }

      body.nofix #siteHeader {
        position: static;
      }

      .RankingMainContainer-header {
        position: sticky;
        top: 36px;
        z-index: 1000;
        background:
          linear-gradient(to bottom,
            rgba(255, 255, 255, 0),
            rgba(255, 255, 255, 0.7),
            rgba(255, 255, 255, 1.0),
            rgba(255, 255, 255, 0.8),
            rgba(232, 232, 255, 0)
          );
      }
      .nofix .RankingMainContainer-header {
        top: 0;
      }

      .RankingBaseItem {
        border-radius: 0 !important;
        box-shadow: none !important;
        border: 1px solid silver;
        pointer-events: none;
        user-select: none;
        display: grid;
      }
        .RankingBaseItem .Card-link {
          display: grid;
          grid-template-rows: 108px auto;
        }
          .RankingBaseItem .Card-media {
            position: static;
            pointer-events: auto;
          }
            .VideoThumbnail {
              border-radius: 0 !important;
            }
          .RankingBaseItem .Card-title {
            pointer-events: auto;
            user-select: auto;
            height: auto;
            max-height: 49px;
            -webkit-line-clamp: unset;

          }
          .RankingBaseItem .Card-secondary {
            width: 100%;
            user-select: none;
            pointer-events: none;
            align-self: end;
            overflow: hidden;

          }

      [data-nicoad-grade=gold] .Thumbnail.VideoThumbnail {
        background: #f7e01c;
      }
      [data-nicoad-grade=silver] .Thumbnail.VideoThumbnail {
        background: #dfeaec;
      }

      .MatrixRanking-body.GlobalHeader#siteHeader #siteHeaderInner {
        width: 1232px;
      }

      .MatrixRanking-body .RankingRowRank {
        line-height: 48px;
        height: 48px;
        pointer-events: none;
        user-select: none;
      }
      .MatrixRanking-body .RankingMatrixVideosRow {
        width: ${1232 + 64}px;
        margin-left: ${-64}px;
      }
      .MatrixRanking-body .RankingRowRank {
        position: sticky;
        left: -8px;
        z-index: 100;
        transform: none;
        padding-right: 16px;
        width: 64px;
        overflow: visible;
        text-align: right;
        mix-blend-mode: difference;
        text-shadow:
           1px  1px 0 #fff,
           1px -1px 0 #fff,
          -1px  1px 0 #fff,
          -1px -1px 0 #fff;

              }
      ` : ''}
    `).trim();

    const nicoadHideCss = `
      .nicoadVideoItemWrapper {
        display: none;
      }
      [aria-label="nicovideo-content"] > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div {
        > a:is([data-anchor-page="tag"], [data-anchor-page="search"]):has(div:is(.c_serviceColor\\.nicoadGold, .c_serviceColor\\.nicoadGray)) {
          display: none;
        }
      }
      [aria-label="nicovideo-content"] > div > section > div:nth-of-type(2) {
        > div > div:first-of-type > div:nth-of-type(2) > div:has(a[data-anchor-page="ranking_genre"]),
        > div > div:has(a[data-anchor-page="ranking_custom"]) {
          &:has(div:is(.c_serviceColor\\.nicoadGold, .c_serviceColor\\.nicoadGray)) {
            display: none;
          }
        }
      }
    `.trim();

    const responsiveCss = `
      [aria-label="nicovideo-content"]:has([data-anchor-page="ranking_custom"]) > section > div {
        min-width: unset;
      }
    `.trim();

    const hideTagCss = (tagName) => `
      [aria-label="nicovideo-content"] > div > section > div:nth-of-type(2) > div > div:last-of-type > div:first-of-type:has(a[data-anchor-page="ranking_genre"]):has(a[data-anchor-href^="/ranking/genre/"][data-anchor-href$="?tag=${encodeURIComponent(tagName.trim())}"]) > div:nth-of-type(2) {
        display: none;
      }
    `.trim();

    const __tpl__ = (`
      <div class="mylistPocketHoverMenu scalingUI zen-family">
        <button class="mylistPocketButton command deflist-add wwwZenzaOnly is-need-login" data-command="deflist"
          tooltip="あとで見る">&#x271A;</button>
        <button class="mylistPocketButton command info" data-command="info"
          tooltip="動画情報を表示">？</button>
        <button class="mylistPocketButton command playlist-queue zenzaMenu" data-command="playlist-queue"
          tooltip="ZenzaWatchのプレイリストに追加">▶</button>
      </div>
      </div>

      <div id="mylistPocket-popup" class="zen-family">
        <span slot="video-title">【実況】どんぐりころころの大冒険 Part1(最終回)</span>
        <a href="/watch/sm9" slot="watch-link"></a>
        <img slot="video-thumbnail" data-type="image">
        <a slot="owner-page-link" href="https://www.nicovideo.jp/user/1234" class="owner-page-link target-change" data-type="link" rel="noopener"><img slot="owner-icon" class="owner-icon" src="https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank_s.jpg" data-type="image"></img></a>

        <span slot="upload-date"     data-type="date">1970/01/01 00:00</span>
        <span slot="view-counter"    data-type="int">12,345</span>
        <span slot="mylist-counter"  data-type="int">6,789</span>
        <span slot="comment-counter" data-type="int">2,525</span>

        <span slot="duration" class="duration">1:23</span>

        <span slot="owner-id">1234</span>
        <span slot="locale-owner-name">ほげほげ</span>

        <div slot="error-description"></div>
        <div class="description" slot="description" data-type="html"></div>
        <span slot="last-res-body"></span>

      </div>

      <template id="mylistPocket-popup-template">
        <style>

          :host(#mylistPocket-popup) {
            position: fixed;
            z-index: 10000000;
            transform: translate3d(-50%, -50%, 0);
            opacity: 0;
            transition: 0.3s opacity ease;
            top: -9999px; left: -9999px;
          }

          :host(#mylistPocket-popup.show) {
            top: 50%;
            left: 50%;
            opacity: 1;
            pointer-events: auto;
          }

          .root.is-otherDomain .wwwOnly {
            display: none;
          }
          .root.is-otherDomain:not(.is-zenzaReady) .wwwZenzaOnly {
            display: none;
          }

          * {
            box-sizing: border-box;
            font-kerning: none;
          }

          a {
            color: #ffff00;
            font-weight: bold;
            display: inline-block;
          }

          a:visited {
            color: #ffff99;
          }

          button {
            font-size: 14px;
            padding: 8px 8px;
            cursor: pointer;
            border-radius: 0;
            margin: 0;
            background: #333;
            color: #ccc;
            border: solid 2px #ccc;
            outline: none;
            line-height: 20px;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
          }
          button:hover {
            transform: translate(-4px,-4px);
            box-shadow: 4px 4px 4px #000;
            background: #666;
            transition:
              0.2s transform ease,
              0.2s box-shadow ease
              ;
          }

          button.is-updating {
            cursor: wait;
          }
          button.is-active,
          button:active {
            transform: none;
            box-shadow: none;
            transition: none;
          }
          button.is-active::after,
          button:active::after {
            opacity: 0;
          }


          [tooltip] {
            position: relative;
          }

          .is-deflistUpdating .deflist-add::after,
          .is-deflistSuccess  .deflist-add::after,
          .is-deflistFail     .deflist-add::after,
          [tooltip]:hover::after {
            content: attr(tooltip);
            position: absolute;
            top:  0px;
            left: 50%;
            padding: 2px 4px;
            white-space: nowrap;
            font-size: 14px;
            color: #fff;
            background: #333;
            transform: translate3d(-50%, -120%, 0);
            pointer-events: none;

          }


          .root {
            text-align: left;
            outline-offset: 8px;
            border: 12px solid rgba(32, 32, 32, 0);
            border-radius: 20px;
            padding: 8px 0;
            background: rgba(0, 0, 0, 0.7);
            color: #ccc;
            box-shadow: 0 0 16px #000;
            transition:
              0.6s -webkit-clip-path ease,
              0.6s clip-path ease,
              0.5s transform ease;
              /*0.4s border-radius ease-out 0.4s,
              0.4s height ease-out 0.4s*/
            ;
          }

          .root * {
          }

          .root.show {
            opacity: 1;
            pointer-events: auto !important;
          }

          .root.is-loading,
          .root.is-loading.is-ok,
          .root.is-loading.is-fail {
            text-align: center;
            position: relative;
            width: 190px;
            height: 190px;
            padding: 32px;
            opacity: 0.8;
            cursor: wait;
            border-radius: 100%;
            clip-path: circle(100px at center) !important;
            transition: none;
            outline: none;
            transform: none !important;
          }
          .root.is-firefox {
          }
          .root.is-loading > * {
            pointer-events: none;
          }

          .root.is-setting {
            transform: rotateX(180deg);
          }

          .root.is-setting > *:not(.setting-panel) {
            pointer-events: none;
            z-index: 1;
          }

          .root:not(.is-setting) > .setting-panel {
            pointer-events: none;
          }

          .root.is-setting > .setting-panel {
            display: block;
            opacity: 1;
            pointer-events: auto;
          }

          .root.is-loading         .loading-inner,
          .root.is-loading.is-ok   .loading-inner,
          .root.is-loading.is-fail .loading-inner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate3d(-50%, -50%, 0);
          }

          .loading-inner .spinner {
            font-size: 64px;
            display: inline-block;
            animation-name: spin;
            animation-iteration-count: infinite;
            animation-duration: 3s;
            animation-timing-function: linear;
          }

          @keyframes spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(1800deg); }
          }



          .root.is-ok {
            width: 800px;
            /*clip-path: circle(800px at center);*/
          }

          .root.is-ok.noclip {
            clip-path: none;
          }

          .root.is-fail {
            font-size: 120%;
            white-space: nowrap;
            text-align: center;
            padding: 16px;
          }

          .root.is-loading>*:not(.loading-now),
          .root.is-loading.is-ok>*:not(.loading-now),
          .root.is-loading.is-fail>*:not(.loading-now),
          .root.is-fail:not(.is-loading)>*:not(.error-info),
          .root.is-ok:not(.is-loading)>*:not(.video-detail):not(.setting-panel) {
            display: none !important;
          }

          .root.is-loading>.loading-now,
          .root.is-fail>.error-info,
          .root.is-ok>.video-detail {
            display: block;
          }

          .header {
            padding: 8px 8px 8px;
            font-size: 12px;
          }
            .upload-date {
              margin-right: 8px;
            }
            .counter span + span {
              margin-left: 8px;
            }
            .video-title {
              font-weight: bolder;
              font-size: 22px;
              margin-bottom: 4px;
            }

            .close-button {
              position: absolute;
              right: 0;
              top: 0;
              transition: 0.2s background ease, 0.2s border-color ease;
              cursor: pointer;
              width: 48px;
              height: 48px;
              font-size: 28px;
              line-height: 36px;
              text-align: center;
              user-select: none;
              border: 6px solid rgba(80, 80, 80, 0.5);
              border-color: transparent;
              border-radius: 0 16px 0 0;
            }
            .close-button:hover {
              background: #333;
              /*border-color: rgba(0, 0, 0, 0.9);*/
              /*transform: translate(-50%, -50%) scale(2.5);*/
            }
            .close-button:active {
              /*transform: translate(-50%, -50%) scale(2) rotate(360deg);*/
              box-shadow: none;
              transition: none;
            }

            .is-setting .close-button {
              display: none;
            }




          .main {
            display: flex;
            background: rgba(0, 0, 0, 0.2);
            box-shadow: 0 0 4px rgba(0, 0, 0, 0.5) inset;
          }

          .main-left {
            width: 360px;
            padding: 8px;
            z-index: 100;
          }
            .video-thumbnail-container {
              position: relative;
              width: 360px;
              height: 270px;
              background: #000;
              /*box-shadow: 2px 2px 4px #000;*/
            }
            .video-thumbnail-container ::slotted(img) {
              width: 360px !important;
              height: 270px !important;
              object-fit: contain;
            }

            .video-thumbnail-container .duration {
              position: absolute;
              display: inline-block;
              right: 0;
              bottom: 0;
              font-size: 14px;
              background: #000;
              color: #fff;
              padding: 2px 4px;
            }
            .video-thumbnail-container:hover .duration {
              display: none;
            }


          .main-right {
            position: relative;
            padding: 0;
            flex-grow: 1;
            font-size: 14px;
          }

            ::slotted(.owner-page-link) {
              display: inline-block;
              vertical-align: middle;
            }

            .owner-page-link img {
              border: 1px solid #333;
              border-radius: 3px;
            }

            .video-info {
              /*background: rgba(0, 0, 0, 0.2);*/
              max-height: 282px;
              overflow-x: hidden;
              overflow-y: scroll;
              overscroll-behavior: contain;
            }

            *::-webkit-scrollbar,
            .video-info::-webkit-scrollbar {
              background: rgba(34, 34, 34, 0.5);
            }

            *::-webkit-scrollbar-thumb,
            .video-info::-webkit-scrollbar-thumb {
              border-radius: 0;
              background: #666;
            }

            *::-webkit-scrollbar-button,
            .video-info::-webkit-scrollbar-button {
              background: #666;
              display: none;
            }

            *::scrollbar,
            .video-info::scrollbar {
              background: #222;
            }

            *::scrollbar-thumb,
            .video-info::scrollbar-thumb {
              border-radius: 0;
              background: #666;
            }

            *::scrollbar-button,
            .video-info::scrollbar-button {
              background: #666;
              display: none;
            }

            .scrollable {
              overscroll-behavior: contain;
            }

            .owner-info {
              margin: 16px;
              display: table;
            }

              .owner-info * {
                vertical-align: middle;
                word-break: break-all;
              }

              .owner-info>* {
                display: table-cell !important;
              }

              .owner-name {
                display: inline-block;
                padding: 8px;
                font-size: 18px;
              }
              .owner-info.is-favorited {
                font-weight: bolder;
                color: orange;
              }

              .owner-info.is-ng {
                color: #888;
                text-decoration: line-through;
              }

              .is-channel .owner-name::before {
                content: 'CH';
                margin: 0 4px;
                background: #999;
                color: #333;
                padding: 2px 4px;
                border: 1px solid;
              }

              .locale-owner-name::after {
                content: ' さん';
              }

              .owner-info .add-ng-button,
              .owner-info .add-fav-button {
                visibility: hidden;
                pointer-events: none;
              }
              .is-ng-enable .owner-info:hover .add-ng-button,
              .is-ng-enable .owner-info:hover .add-fav-button {
                visibility: visible;
                pointer-events: auto;
              }

            .description {
              word-break: break-all;
              line-height: 1.5;
              padding: 0 16px 8px;
            }

            .description:first-letter {
              font-size: 24px;
            }

            .last-res-body {
              margin: 16px 16px 0;
              border: 1px solid #ccc;
              padding: 4px;
              border-radius: 4px;
              word-break: break-all;
              font-size: 12px;
              min-height: 24px;
            }


          .footer {
            padding: 8px;
            backface-visibility: hidden;
          }

            .pocket-button {
              cusror: pointer;
            }

            .pocket-button:active {
            }


            .video-tags {
              display: block;
            }

              .tag-container {
                display: inline-block;
                position: relative;
                padding: 4px 8px;
                border: 1px solid #888;
                border-radius: 4px;
                margin: 0 20px 4px 0;
              }
              .tag-container .tag {
                display: inline-block;
                font-size: 14px;
                color: #ccc;
                text-decoration: none;
                cursor: pointer;
              }
              .tag-container .tag.channel-search {
                margin-left: 8px;
                color: #ccc !important;
                padding: 0 8px;
              }
              .tag-container:hover .tag {
                color: #fff !important;
              }
              .tag-container.is-favorited .tag {
                font-weight: bolder;
                color: orange !important;
              }
              .tag-container.is-ng .tag {
                text-decoration: line-through;
                color: #888 !important;
              }
              .zenzaPlayerContainer .tagItemMenu {
                margin: 0 8px;
              }


              .tag-container       .add-ng-button,
              .tag-container       .add-fav-button {
                position: absolute !important;
                visibility: hidden;
                pointer-events: none;
              }
              .is-ng-enable .tag-container:hover .add-ng-button,
              .is-ng-enable .tag-container:hover .add-fav-button {
                visibility: visible;
                pointer-events: auto;
                width: 24px;
                height: 24px;
                line-height: 24px;
                font-size: 24px;
                vertical-align: bottom;
                display: inline-block;
              }
              .is-ng-enable .tag-container:hover .add-ng-button {
                right: -16px;
              }
              .is-ng-enable .tag-container:hover .add-fav-button {
                left: -16px;
              }

            .footer-menu {
              position: absolute;
              right: 0px;
              bottom: 0px;
              transform: translate3d(0, 120%, 0);
              opacity: 1;
              transition:
                0.4s opacity ease 0.4s,
                0.4s transform ease 0.4s;
            }

            .is-setting .video-detail .footer-menu {
              transform: translate3d(0, 0, 0);
              opacity: 0;
            }

              .footer-menu button {
                min-width: 70px;
              }

              .regular-menu {
                display: inline-block;
                background: rgba(0, 0, 0, 0.7);
                position: relative;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 0 16px #000;
              }

              .is-deflistUpdating .deflist-add {
                cursor: wait;
                opacity: 0.9;
                transform: scale(1.0);
                box-shadow: none;
                transition: none;
              }
              .is-deflistSuccess .deflist-add,
              .is-deflistFail    .deflist-add {
                transform: scale(1.0);
                box-shadow: none;
                transition: none;
              }
              .is-deflistSuccess  .deflist-add::after {
                content: attr(data-result);
                background: #393;
              }
              .is-deflistFail     .deflist-add::after {
                content: attr(data-result);
                background: #933;
              }
              .is-deflistUpdating .deflist-add::after {
                content: '更新中';
                background: #333;
              }

              .zenza-menu {
                display: none;
              }

              .is-zenzaReady .zenza-menu {
                display: inline-block;
                background: rgba(0, 0, 0, 0.7);
                margin-left: 32px;
                position: relative;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 0 16px #000;
              }

              .is-zenzaReady .zenza-menu::after {
                content: 'ZenzaWatch';
                position: absolute;
                left: 50%;
                bottom: 10px;
                padding: 2px 8px;
                transform: translate(-50%, 100%);
                pointer-events: none;
                font-weith: bolder;
                background: rgba(0, 0, 0, 0.7);
                pointer-events: none;
                border-radius: 4px;
                white-space: nowrap;
              }

              .setting-menu {
                display: inline-block;
                background: rgba(0, 0, 0, 0.7);
                margin-left: 32px;
                position: relative;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 0 16px #000;
              }

          .toggle-setting-button {
            font-size: 32px;
            border-radius: 100%;
            border: 12px solid #333;
            cursor: pointer;
            background: rgba(32, 32, 32, 1);
            transition:
              0.2s transform ease
              ;
          }

          .toggle-setting-button:hover {
            transform: scale(1.2);
            box-shadow: none;
            background: rgba(32, 32, 32, 1);
            background: transparent;
          }

          .toggle-setting-button:active {
            transform: scale(1.0);
          }

          .mylist-comment-link {
            cursor: pointer;
          }

          .setting-panel {
            opacity: 0;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            padding: 8px 12px;
            z-index: 10000;
            background: rgba(50, 50, 64, 0.9);
            border-radius: 16px;
            color: #ccc;
            /*-webkit-user-select: none;
            user-select: none;*/
            transform: rotateX(180deg);
            transition: 0.25s opacity ease 0.25s;
          }
          .is-setting .setting-panel {
            transition: 0.25s opacity ease;
          }
            .setting-panel-main {
              width: 100%;
              height: 100%;
              overflow-y: scroll;
              overflow-x: hidden;
            }

            .root:not(.is-setting) .setting-panel .footer-menu {
              transform: translate3d(0, 0, 0);
              opacity: 0;
            }

            .root.is-setting       .setting-panel .footer-menu {
              right:  -12px;
              bottom: -12px;
              transform: translate3d(0, 120%, 0);
              opacity: 1;
              transition:
                opacity 0.4s ease 0.4s,
                transform 0.4s ease 0.4s;
            }


            .close-setting-menu {
              display: inline-block;
              background: rgba(0, 0, 0, 0.7);
              margin-left: 32px;
              position: relative;
              border-radius: 8px;
              padding: 12px 16px;
              box-shadow: 0 0 16px #000;
            }

            .setting-label {
              display: inline-block;
              line-height: 24px;
              padding: 8px;
            }

            .setting-label:hover {
              text-shadow: 0 0 4px #996;
            }

            .setting-label * {
              cursor: pointer;
            }

            .setting-label input[type=checkbox] {
              transform: scale(2);
              margin: 8px;
              vertical-align: middle;
            }

            .setting-label input + span {
              font-size: 16px;
            }

            .setting-label input:checked + span {
            }


            .setting-fav,
            .setting-ng-textarea,
            .setting-fav-textarea {
              display: none;
            }

            .is-ng-enable .setting-fav {
              display: block;
            }
            .is-ng-enable .setting-ng-textarea,
            .is-ng-enable .setting-fav-textarea {
              display: flex;
            }

              .setting-ng-text-column,
              .setting-fav-text-column {
                flex: 1;
                position: relative;
                padding: 8px;
              }

                .setting-ng-text-column textarea,
                .setting-fav-text-column textarea {
                  width: 100%;
                  height: 150px;
                  background: transparent;
                  color: #ccc;
                }

            .setting-ng-label {
              display: none;
            }

            .is-ng-enable .setting-ng-label {
              display: inline-block;
            }


          .add-ng-button,
          .add-fav-button {
            display: none;
          }

          .is-ng-enable .add-ng-button,
          .is-ng-enable .add-fav-button {
            display: inline-block;
            position: relative;
            width: 32px;
            height: 32px;
            line-height: 32px;
            font-size: 28px;
            padding: 0;
            margin: 0;
            /*border-radius: 100%;*/
            border: none;
            text-align: center;
            color: red;
            font-weight: bolder;
            cursor: pointer;
            background: transparent;
            box-shadow: none;
            transition:
              0.2s transform ease,
              0.2s text-shadow ease;
          }
          .is-ng-enable .add-fav-button {
            color: orange;
          }
          .is-ng-enable .add-ng-button:hover,
          .is-ng-enable .add-fav-button:hover {
            transform: scale(1.2);
            text-shadow: 2px 2px 4px black;
          }
          .is-ng-enable .add-ng-button:active,
          .is-ng-enable .add-fav-button:active {
            transform: scale(1.0);
            text-shadow: 0   0   2px black;
          }
          .is-ng-enable .add-ng-button:hover::after,
          .is-ng-enable .add-fav-button:hover::after {
            content: 'NG登録';
            position: absolute;
            top: 0;
            left: 50%;
            transform: translate(-50%, -80%);
            font-size: 12px;
            line-height: 12px;
            white-space: nowrap;
            background: rgba(192, 192, 192, 0.8);
            color: #000;
            opacity: 0.9;
            padding: 2px 4px;
            text-shadow: none;
            font-weight: normal;
            pointer-events: none !important;
          }
          .is-ng-enable .is-ng .add-ng-button:hover::after,
          .is-ng-enable .is-ng .add-fav-button:hover::after {
            content: 'NG解除';
          }
          .is-ng-enable .add-fav-button:hover::after {
            content: '強調登録';
          }
          .is-ng-enable .is-favorited .add-fav-button:hover::after {
            content: '強調解除';
          }
          .is-ng-enable .add-ng-button:active:hover::after,
          .is-ng-enable .add-fav-button:active:hover::after {
            display: none;
          }

       </style>
        <div class="popup root">
          <div class="loading-now">
            <div class="loading-inner">
              <span class="spinner">&#8987;</span>
            </div>
          </div>
          <div class="error-info">
            <slot name="error-description"></slot>
          </div>
          <div class="video-detail">
            <div class="header">
              <div class="video-title"><slot name="video-title"></slot></div>

              <span class="upload-date">投稿: <slot name="upload-date"/></span>
              <span class="counter">
                <span class="view-counter">再生: <slot name="view-counter"/></span>
                <span class="comment-counter">コメント: <slot name="comment-counter"/></span>
                <span class="mylist-counter command2" data-command="mylist-comment-open">マイリスト:
                  <span class="mylist-comment-link command" data-command="mylist-comment-open">&#x274F;</span>
                  <slot name="mylist-counter"/>
                </span>
              </span>
              <div class="close-button command" data-command="close" tooltip="閉じる">
                &#x2716;
              </div>
            </div>

            <div class="main">

              <div class=" main-left">
                <div class="video-thumbnail-container">
                  <slot name="video-thumbnail"></slot>
                  <span class="duration"><slot name="duration"></slot></slot>
                </div>
              </div>

              <div class="video-info main-right scrollable">

                <div class="owner-info">
                  <slot name="owner-page-link"></slot>
                  <span class="owner-name"><slot name="locale-owner-name"></slot>
                  <button class="add-fav-button command" data-command="toggle-fav-owner">★</button>
                  <button class="add-ng-button command" data-command="toggle-ng-owner">&#x2716;</button>
                  </span>
                </div>

                <div class="description">
                  <slot name="description"></slot>
                </div>

                <div class="last-res-body">
                  <slot name="last-res-body"></slot>
                </div>


              </div>

            </div>

            <div class="footer">
              <div class="video-tags">
                <slot name="tag"></slot>
              </div>
            </div>
            <div class="footer-menu scalingUI">
              <div class="regular-menu">
                <button
                  class="mylistPocketButton deflist-add pocket-button command command-watch-id wwwZenzaOnly"
                  data-command="deflist-add"
                  tooltip="あとで見る"
                >あとで見る</button>
                <button
                  class="pocket-button command command-watch-id"
                  data-command="mylist-window"
                  tooltip="マイリスト"
                >マイ</button>
                <button
                  class="pocket-button command command-watch-id"
                  data-command="open-mylist-open"
                  tooltip="公開マイリスト"
                >公開</button>
                 <button
                  class="pocket-button command command-video-id"
                  data-command="twitter-hash-open"
                  tooltip="Twitterの反応"
                >#Twitter</button>
              </div>


              <div class="zenza-menu">
                <button
                  class="pocket-button command command-watch-id"
                  data-command="zenza-open-now"
                  tooltip="ZenzaWatchで開く"
                >Zen</button>
                <button
                  class="pocket-button command command-watch-id"
                  data-command="playlist-inert"
                  tooltip="プレイリスト(次に再生)"
                >playlist</button>
                <button
                  class="pocket-button command command-watch-id"
                  data-command="playlist-queue"
                  tooltip="プレイリスト(末尾に追加)"
                >▶</button>
              </div>

              <div class="setting-menu">
                <button
                  class="pocket-button command"
                  data-command="toggle-setting"
                >設 定</button>
              </div>

            </div>
          </div>
          <div class="setting-panel">

            <div class="setting-panel-main scrollable">
              <h2>MylistPocket 設定</h2>
              <label class="setting-label">
                <input
                  type="checkbox"
                  class="setting-form"
                  data-config-name="openNewWindow"
                >
                <span>タグやリンクを新しいタブで開く (次回から反映)</span>
              </label>

              <label class="setting-label">
                <input
                  type="checkbox"
                  class="setting-form"
                  data-config-name="enableAutoComment"
                  data-config-namespace="mylist"
                >
                <span>マイリストコメントに投稿者名を入れる</span>
              </label>

              <label class="setting-label">
                <input
                  type="checkbox"
                  class="setting-form"
                  data-config-name="responsive.matrix"
                  data-config-namespace=""
                >
                <span>カスタムランキングのサムネイルを画面幅に合わせて小さくする</span>
              </label>

              <h2>NG設定(リロード後に反映)</h2>
              <label class="setting-label">
                <input
                  type="checkbox"
                  class="setting-form"
                  data-config-name="enable"
                  data-config-namespace="ng"
                >
                <span>簡易NG＆強調機能を使う</span>
              </label>

              <label class="setting-label">
                <input
                  type="checkbox"
                  class="setting-form"
                  data-config-name="hide"
                  data-config-namespace="nicoad"
                >
                <span>検索結果やランキングのニコニ広告を消す</span>
              </label>

              <label class="setting-label wwwOnly wwwZenzaOnly setting-ng-label">
                <input
                  type="checkbox"
                  class="setting-form"
                  data-config-name="syncZenza"
                  data-config-namespace="ng"
                >
                <span>NGタグ・投稿者をZenzaWatchにも反映する</span>
              </label>

              <div class="setting-ng-textarea setting-ng">
                <div class="setting-ng-text-column">
                  投稿者ID
                  <textarea
                    class="setting-form"
                    data-config-name="owner"
                    data-config-namespace="ng"
                  ></textarea>
                </div>
                <div class="setting-ng-text-column">
                  タグ
                  <textarea
                    class="setting-form"
                    data-config-name="tag"
                    data-config-namespace="ng"
                  ></textarea>
                </div>
                <div class="setting-ng-text-column">
                  タイトル・説明文
                  <textarea
                    class="setting-form"
                    data-config-name="word"
                    data-config-namespace="ng"
                  ></textarea>
                </div>
               </div>
              <h2 class="setting-fav">強調表示設定</h2>
              <div class="setting-fav-textarea setting-fav">
                <div class="setting-fav-text-column">
                  投稿者ID
                  <textarea
                    class="setting-form"
                    data-config-name="owner"
                    data-config-namespace="fav"
                  ></textarea>
                </div>
                <div class="setting-fav-text-column">
                  タグ
                  <textarea
                    class="setting-form"
                    data-config-name="tag"
                    data-config-namespace="fav"
                  ></textarea>
                </div>
                <div class="setting-fav-text-column">
                  タイトル・説明文
                  <textarea
                    class="setting-form"
                    data-config-name="word"
                    data-config-namespace="fav"
                  ></textarea>
                </div>
               </div>

             </div>

            <div class="footer-menu">
              <div class="close-setting-menu">
                <button
                  class="pocket-button command"
                  data-command="toggle-setting"
                >戻 る</button>
              </div>
            </div>

          </div>
        </div>
      </template>
    `).trim();

    const __ng_css__ = `
      /* [data-decoration-video-id] ランキング  .item 検索 */

      [data-decoration-video-id]:has(.is-ng-rejected) {
        pointer-events: none;

        > * {
          display: none;
        }

        &::before {
          background-color: var(--colors-layer-surface-low-em);
          border-radius: var(--radii-m);
          box-sizing: content-box;

          @media (prefers-color-scheme: light) {
            content: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w_x6 h_x6 fill_icon.baseDisabled"><path fill="hsl(0 0% 70%)" fill-rule="evenodd" d="M20.21 5.81H14.4l2.38-2.24a.83.83 0 0 0 .05-1.17.8.8 0 0 0-1.16-.04L12 5.81 8.33 2.36a.8.8 0 0 0-1.16.04c-.3.34-.28.86.05 1.17L9.6 5.8H3.8C2.8 5.81 2 6.61 2 7.6v10.7c0 1 .8 1.8 1.79 1.8h2.26l1.35 1.56c.23.26.6.26.82 0l1.35-1.57h4.86l1.35 1.57c.23.26.6.26.82 0l1.35-1.57h2.26c1 0 1.79-.8 1.79-1.78V7.6c0-.99-.8-1.79-1.79-1.79" clip-rule="evenodd"></path></svg>');
          }
          @media (prefers-color-scheme: dark) {
            content: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w_x6 h_x6 fill_icon.baseDisabled"><path fill="hsl(0 0% 40%)" fill-rule="evenodd" d="M20.21 5.81H14.4l2.38-2.24a.83.83 0 0 0 .05-1.17.8.8 0 0 0-1.16-.04L12 5.81 8.33 2.36a.8.8 0 0 0-1.16.04c-.3.34-.28.86.05 1.17L9.6 5.8H3.8C2.8 5.81 2 6.61 2 7.6v10.7c0 1 .8 1.8 1.79 1.8h2.26l1.35 1.56c.23.26.6.26.82 0l1.35-1.57h4.86l1.35 1.57c.23.26.6.26.82 0l1.35-1.57h2.26c1 0 1.79-.8 1.79-1.78V7.6c0-.99-.8-1.79-1.79-1.79" clip-rule="evenodd"></path></svg>');
          }
        }

        &::after {
          content: 'Hide by MylistPocket';
          font-weight: var(--font-weights-bold);
          font-size: var(--font-sizes-base);
          color: var(--colors-text-on-layer-low-em);
        }

        &:is([data-anchor-page="ranking_custom"], .cq-t_inline-size[data-anchor-page="tag"], .cq-t_inline-size[data-anchor-page="search"]) {
          flex-direction: column;
          height: 100%;

          div:has(> &) {
            height: 100%;
          }

          &::before {
            width: calc(100%/4);
            height: calc(100%/4);
            padding: calc((100% * 5 / 16) / 2) calc((100% * 3 / 4) / 2);
          }
        }

        &:is([data-anchor-page="ranking_genre"], [data-anchor-page="tag"]:not(.cq-t_inline-size), [data-anchor-page="search"]:not(.cq-t_inline-size)) {
          &:has(.w_thumbnail\\.l)::before {
            width: var(--sizes-x6);
            height: var(--sizes-x6);
            padding: calc((var(--sizes-thumbnail-l) * 9 / 16 - var(--sizes-x6)) / 2) calc((var(--sizes-thumbnail-l) - var(--sizes-x6)) / 2);
          }
          &:has(.w_thumbnail\\.2xl)::before {
            width: var(--sizes-x8);
            height: var(--sizes-x8);
            padding: calc((var(--sizes-thumbnail-2xl) * 9 / 16 - var(--sizes-x8)) / 2) calc((var(--sizes-thumbnail-2xl) - var(--sizes-x8)) / 2);
          }
        }
      }

      [data-decoration-video-id]:has(.is-ng-wait),
      .item.is-ng-wait {
        outline: 1px dotted rgba(192, 192, 192, 0.8);
      }

      [data-decoration-video-id]:has(.is-ng-queue),
      .item.is-ng-queue {
        outline: 2px dotted rgba(192, 192, 192, 0.8);
      }

      [data-decoration-video-id]:has(.is-ng-current),
      .item.is-ng-current {
        outline: 3px dotted rgba(128, 225, 128, 0.8);
      }

      [data-decoration-video-id]:has(.is-ng-resolved),
      .item.is-ng-resolved {
        outline: 0px solid green;
      }

      [data-decoration-video-id]:has(.is-fav-favorited),
      .item.is-fav-favorited {
        outline: 3px dotted orange;
        outline-offset: 3px;
      }
      .item.videoRanking.is-fav-favorited {
        outline-offset: -3px;
      }

      [data-decoration-video-id]:has(.is-ng-rejected),
      .item.is-ng-rejected {
        outline: none;
      }

      .VideoItem.NC-VideoCard.is-ng-rejected,
      .VideoItem.VideoCard.is-ng-rejected {
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      }

      .VideoItem .VideoItem-postDate {
        line-height: 16px;
        vertical-align: top;
        font-size: 12px;
        color: #666;
      }

      .item.is-ng-rejected,
      .NicorepoTimelineItem.is-ng-rejected {
        display: none;
        opacity: 0;
        pointer-events: none;
      }

      body.is-ng-disable .is-ng-rejected {
        outline: none;
        display: block !important;
        pointer-events: auto;
        opacity: 0.5;
        visibility: visible;
      }

      /* チャンネル検索 */
        #search .item.is-ng-rejected {
          display: none;
        }
    `;

    // TODO: ライブラリ化
    const util = MylistPocket.util = (() => {
      const util = {};

      util.mixin = function(self, o) {
        Object.keys(o).forEach(f => {
          if (!_.isFunction(o[f])) { return; }
          if (_.isFunction(self[f])) { return; }
          self[f] = o[f].bind(o);
        });
      };
      util.attachShadowDom = function({host, tpl, mode = 'open'}) {
        const root = host.attachShadow ?
          host.attachShadow({mode}) : host.createShadowRoot();
        const node = document.importNode(tpl.content, true);
        root.appendChild(node);
        return root;
      };
      /*
       * Task 092: 動画の参照（sm/nm/so/ss の ID・/watch/・/shorts/・www./sp. の URL・nico.ms）の「解析」を1か所にまとめ、
       * 説明文の「リンク化」（httpLink）と、ページ上のリンクからの解決（resolveNicoVideoLink、HoverMenu 等）で同じものを使う。
       * 以前の httpLink は、sm〜 等を正規表現で <a> にする置換を何回も重ねた後で、既存の <a> を退避していたため、
       * フルURL・/shorts/ss〜・nico.ms・既にリンクの文字列を混ぜると、二重のリンク化や href の中の置換が起きていた
       * （例: https://www.nicovideo.jp/shorts/ss123 の中の ss123 が <a> になり、その href の中の ss123 がさらに <a> になる）。
       * 今は、HTML を一度 DOM（<template> の中なので画像の読み込み等は起きない）にしてから、
       * <a> の外の文字だけを順に見てリンクにする。文字列の置換で HTML を組み立てることはしない。
       * ZenzaWatch 本体の説明文（VideoInfoPanel）の Task 074・088 の処理とは別物（MylistPocket の中だけで使う）。
       */
      const NICO_VIDEO_ID = /^(?:sm|nm|so|ss)[0-9]+$/;
      const NICO_VIDEO_HOSTS = ['www.nicovideo.jp', 'sp.nicovideo.jp'];
      const toVideoReference = (watchId, source) => {
        const type = watchId.startsWith('ss') ? 'shorts' : 'watch';
        return {watchId, type, source, canonicalUrl: `https://www.nicovideo.jp/${type}/${watchId}`};
      };
      /**
       * sm123・/watch/sm123・/shorts/ss123・https://(www|sp).nicovideo.jp/(watch|shorts)/…・https://nico.ms/… を解析する。
       * 動画でなければ null。ss〜 の正規の URL は、今の本家に合わせて /shorts/ss〜。
       * /watch/ の後ろが数字だけ（スレッドID）のものも、以前と同じく動画として扱う。
       * @param {string} value
       * @returns {{watchId: string, type: 'watch'|'shorts', source: string, canonicalUrl: string}|null}
       */
      util.parseNicoVideoReference = function(value) {
        if (typeof value !== 'string') { return null; }
        const v = value.trim();
        if (NICO_VIDEO_ID.test(v)) { return toVideoReference(v, 'id'); }
        let url, source;
        try {
          if (/^\/(?:watch|shorts)\//.test(v)) {
            url = new URL(v, 'https://www.nicovideo.jp/');
            source = 'path';
          } else if (/^https?:\/\//i.test(v)) {
            url = new URL(v);
            source = 'url';
          } else {
            return null;
          }
        } catch (e) {
          return null;
        }
        const host = url.hostname.toLowerCase();
        const path = url.pathname;
        let m;
        if (host === 'nico.ms') {
          m = /^\/((?:sm|nm|so|ss)[0-9]+)\/?$/.exec(path);
          return m ? toVideoReference(m[1], 'nico.ms') : null;
        }
        if (!NICO_VIDEO_HOSTS.includes(host)) { return null; }
        if ((m = /^\/watch\/((?:sm|nm|so|ss)?[0-9]+)\/?$/.exec(path))) { return toVideoReference(m[1], source); }
        if ((m = /^\/shorts\/(ss[0-9]+)\/?$/.exec(path))) { return toVideoReference(m[1], source); }
        return null;
      };

      // Google のリダイレクト用のリンク（https://www.google.com/url?…&url=… または ?q=…）。1段だけ解く
      const GOOGLE_HOST = /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
      const unwrapGoogleRedirect = absoluteUrl => {
        let url;
        try { url = new URL(absoluteUrl); } catch (e) { return null; }
        if (!GOOGLE_HOST.test(url.hostname.toLowerCase()) || url.pathname !== '/url') { return null; }
        const target = url.searchParams.get('url') || url.searchParams.get('q');
        return target && /^https?:\/\//i.test(target) ? target : null;
      };
      const toAbsoluteUrl = href => {
        try {
          return new URL(href, document.baseURI || location.href).href;
        } catch (e) {
          return null;
        }
      };
      const parseAbsoluteVideoUrl = absoluteUrl => {
        const ref = absoluteUrl ? util.parseNicoVideoReference(absoluteUrl) : null;
        return ref && (ref.source === 'url' || ref.source === 'nico.ms') ? ref : null;
      };
      /**
       * ページ上のリンク（または URL の文字列）の最終的なリンク先が、www./sp.nicovideo.jp・nico.ms の動画なら、その解析結果。
       * data-href → href の順に見る。Google のリダイレクト用リンクは、中の URL が上の3つのホストの時だけ解く
       * （任意のサイトへのリダイレクトは対象にしない）。
       * @param {HTMLAnchorElement|Element|string} link
       */
      util.resolveNicoVideoLink = function(link) {
        if (!link) { return null; }
        const candidates = typeof link === 'string' ? [link] :
          (link.getAttribute ? [link.getAttribute('data-href'), link.getAttribute('href')] : []);
        for (const candidate of candidates) {
          if (!candidate) { continue; }
          const absoluteUrl = toAbsoluteUrl(candidate);
          const ref = parseAbsoluteVideoUrl(absoluteUrl) || parseAbsoluteVideoUrl(unwrapGoogleRedirect(absoluteUrl));
          if (ref) { return ref; }
        }
        return null;
      };

      // Task 088（ZenzaWatch 本体の説明文）と同じ方針: スクリプトとして動き得るものだけを取り除く
      const UNSAFE_ELEMENTS = 'script,iframe,frame,object,embed,base,meta,link,form,style';
      const UNSAFE_URL = /^[\s\u0000-\u001f]*(javascript|data|vbscript):/i;
      const sanitizeFragment = root => {
        for (const e of root.querySelectorAll(UNSAFE_ELEMENTS)) {
          e.remove();
        }
        for (const e of root.querySelectorAll('*')) {
          for (const {name, value} of [...e.attributes]) {
            const n = name.toLowerCase();
            if (n.startsWith('on') ||
              (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(n) && UNSAFE_URL.test(value))) {
              e.removeAttribute(name);
            }
          }
        }
      };

      const createLink = (href, text, className, isNewWindow) => {
        const a = document.createElement('a');
        a.setAttribute('href', href);
        a.setAttribute('rel', 'noopener');
        if (isNewWindow) { a.setAttribute('target', '_blank'); }
        a.setAttribute('class', className);
        a.textContent = text;
        return a;
      };
      const VIDEO_LINK_CLASS = 'videoLink target-change';
      // URL の直後に付きがちな句読点・閉じ括弧（対応する開き括弧が URL の中に無いもの）を外す
      const trimUrl = url => {
        const count = (s, c) => s.split(c).length - 1;
        for (;;) {
          const last = url.slice(-1);
          if ('.,:;!?\'"'.includes(last) ||
            (last === ')' && count(url, '(') < count(url, ')')) ||
            (last === ']' && count(url, '[') < count(url, ']'))) {
            url = url.slice(0, -1);
            continue;
          }
          return url;
        }
      };
      const linkForUrl = url => {
        const ref = util.parseNicoVideoReference(url);
        if (ref) { return createLink(ref.canonicalUrl, url, VIDEO_LINK_CLASS, false); }
        let m;
        if ((m = /^https?:\/\/seiga\.nicovideo\.jp\/seiga\/(im[0-9]+)$/i.exec(url))) {
          return createLink(`https://seiga.nicovideo.jp/seiga/${m[1]}`, url, 'seigaLink', true);
        }
        if ((m = /^https?:\/\/com\.nicovideo\.jp\/community\/(co[0-9]+)$/i.exec(url))) {
          return createLink(`https://com.nicovideo.jp/community/${m[1]}`, url, 'communityLink', true);
        }
        if (/^https?:\/\/www\.nicovideo\.jp\/(?:mylist|series|user)\/[0-9]/i.test(url)) {
          return createLink(url, url, VIDEO_LINK_CLASS, false);
        }
        return createLink(url, url, 'otherSite', true);
      };
      const linkForWord = word => {
        if (word.startsWith('@')) {
          return createLink(`https://twitter.com/${word.slice(1)}`, word, 'twitterLink', true);
        }
        if (/^im[0-9]+$/.test(word)) {
          return createLink(`https://seiga.nicovideo.jp/seiga/${word}`, word, 'seigaLink', true);
        }
        if (/^co[0-9]+$/.test(word)) {
          return createLink(`https://com.nicovideo.jp/community/${word}`, word, 'communityLink', true);
        }
        const ref = util.parseNicoVideoReference(word);
        if (ref) { return createLink(ref.canonicalUrl, word, VIDEO_LINK_CLASS, false); }
        return createLink(`https://www.nicovideo.jp/${word}`, word, VIDEO_LINK_CLASS, false);
      };
      // URL・@ID・watch/数字 等・sm/nm/so/ss/im/co + 数字
      const TOKEN = /(https?:\/\/[\x21-\x3b\x3d\x3f-\x7e]+)|(@[A-Za-z0-9_]+|(?:watch|shorts|mylist|series|user)\/[0-9]+|(?:sm|nm|so|ss|im|co)[0-9]+)/g;
      const WORD_CHAR = /[A-Za-z0-9_]/;
      const linkifyText = text => {
        const frag = document.createDocumentFragment();
        let pos = 0, m;
        TOKEN.lastIndex = 0;
        while ((m = TOKEN.exec(text)) !== null) {
          let token = m[0], node;
          if (m[1]) {
            const next = token.slice(1).search(/https?:\/\//i);
            token = trimUrl(next >= 0 ? token.slice(0, next + 1) : token);
            node = linkForUrl(token);
          } else {
            const before = text.charAt(m.index - 1), after = text.charAt(m.index + token.length);
            if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) {
              TOKEN.lastIndex = m.index + 1;
              continue;
            }
            node = linkForWord(token);
          }
          if (m.index > pos) { frag.append(text.slice(pos, m.index)); }
          frag.append(node);
          pos = m.index + token.length;
          TOKEN.lastIndex = pos;
        }
        if (pos === 0) { return null; }
        if (pos < text.length) { frag.append(text.slice(pos)); }
        return frag;
      };

      /**
       * 説明文（ニコニコが返す文字列。<a>・<br> を含むこともある）を、リンクを付けた DocumentFragment にする。
       * 既存の <a> の中は触らない（href も変えない。動画へのリンクなら videoLink の印だけ付ける）。
       */
      util.httpLinkFragment = function(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = html === undefined || html === null ? '' : String(html);
        const root = tpl.content;
        sanitizeFragment(root);
        for (const a of root.querySelectorAll('a')) {
          if (util.resolveNicoVideoLink(a)) {
            a.classList.add('videoLink', 'target-change');
          }
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const texts = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.parentElement && node.parentElement.closest('a')) { continue; }
          texts.push(node);
        }
        for (const node of texts) {
          const frag = linkifyText(node.data);
          if (frag) { node.replaceWith(frag); }
        }
        return root;
      };
      util.httpLink = function(html) {
        const div = document.createElement('div');
        div.append(util.httpLinkFragment(html));
        return div.innerHTML;
      };

      util.getSleepPromise = function(sleepTime, label = 'sleep') {
        return function(result) {
          return new Promise(resolve => {
            window.setTimeout(() => {
              return resolve(result);
            }, sleepTime);
          });
        };
      };

      util.isFirefox = () =>
        navigator.userAgent.toLowerCase().indexOf('firefox') >= 0;

      return util;
    })();
const bounce = {
		origin: Symbol('origin'),
		idle(func, time) {
				let reqId = null;
				let lastArgs = null;
				let promise = new PromiseHandler();
				const [caller, canceller] = ((time === undefined && self.requestIdleCallback) ?
						[self.requestIdleCallback, self.cancelIdleCallback] : [self.setTimeout, self.clearTimeout]);
				const callback = () => {
						const lastResult = func(...lastArgs);
						promise.resolve({ lastResult, lastArgs });
						reqId = lastArgs = null;
						promise = new PromiseHandler();
				};
				const result = (...args) => {
						if (reqId) {
								reqId = canceller(reqId);
						}
						lastArgs = args;
						reqId = caller(callback, time);
						return promise;
				};
				result[this.origin] = func;
				return result;
		},
		time(func, time = 0) {
				return this.idle(func, time);
		}
};
const throttle = (func, interval) => {
		let lastTime = 0;
		let timer;
		let promise = new PromiseHandler();
		const result = (...args) => {
				if (timer) {
						return promise;
				}
				const now = performance.now();
				const timeDiff = now - lastTime;
				timer = setTimeout(() => {
						lastTime = performance.now();
						timer = null;
						const lastResult = func(...args);
						promise.resolve({ lastResult, lastArgs: args });
						promise = new PromiseHandler();
				}, Math.max(interval - timeDiff, 0));
				return promise;
		};
		result.cancel = () => {
				if (timer) {
						timer = clearTimeout(timer);
				}
				promise.resolve({ lastResult: null, lastArgs: null });
				promise = new PromiseHandler();
		};
		return result;
};
throttle.time = (func, interval = 0) => throttle(func, interval);
throttle.raf = function (func) {
		let promise;
		let cancelled = false;
		let lastArgs = [];
		const callRaf = (res) => requestAnimationFrame(res);
		const onRaf = () => this.req = null;
		const onCall = () => {
				if (cancelled) {
						cancelled = false;
						return;
				}
				try {
						func(...lastArgs);
				}
				catch (e) {
						console.warn(e);
				}
				promise = null;
		};
		const result = (...args) => {
				lastArgs = args;
				if (promise) {
						return promise;
				}
				if (!this.req) {
						this.req = new Promise(callRaf).then(onRaf);
				}
				promise = this.req.then(onCall);
				return promise;
		};
		result.cancel = () => {
				cancelled = true;
				promise = null;
		};
		return result;
}.bind({ req: null, count: 0, id: 0 });
throttle.idle = (func) => {
		let id;
		const request = (self.requestIdleCallback || self.setTimeout);
		const cancel = (self.cancelIdleCallback || self.clearTimeout);
		const result = (...args) => {
				if (id) {
						return;
				}
				id = request(() => {
						id = null;
						func(...args);
				}, 0);
		};
		result.cancel = () => {
				if (id) {
						id = cancel(id);
				}
		};
		return result;
};
const css = (() => {
		const setPropsTask = [];
		const applySetProps = throttle.raf(() => {
				const tasks = setPropsTask.concat();
				setPropsTask.length = 0;
				for (const [element, prop, value] of tasks) {
						try {
								element.style.setProperty(prop, value);
						}
						catch (error) {
								console.warn('element.style.setProperty fail', { element, prop, value, error });
						}
				}
		});
		const css = {
				addStyle: (styles, option, document = window.document) => {
						const elm = Object.assign(document.createElement('style'), {
								type: 'text/css'
						}, typeof option === 'string' ? { id: option } : (option || {}));
						if (typeof option === 'string') {
								elm.id = option;
						}
						else if (option) {
								Object.assign(elm, option);
						}
						elm.classList.add(global.PRODUCT);
						elm.append(styles.toString());
						(document.head || document.body || document.documentElement).append(elm);
						elm.disabled = (option && option.disabled);
						elm.dataset.switch = elm.disabled ? 'off' : 'on';
						return elm;
				},
				registerProps(...args) {
						if (!CSS || !('registerProperty' in CSS)) {
								return;
						}
						for (const definition of args) {
								try {
										(definition.window || window).CSS.registerProperty(definition);
								}
								catch (err) {
										console.warn('CSS.registerProperty fail', definition, err);
								}
						}
				},
				setProps(...tasks) {
						setPropsTask.push(...tasks);
						return setPropsTask.length ? applySetProps() : Promise.resolve();
				},
				addModule: async function (func, options = {}) {
						if (!CSS || !('paintWorklet' in CSS)) {
								return;
						}
						if (this.modules.has(func)) {
								return this.modules.get(func);
						}
						const pending = (async () => {
								let url;
								try {
										const src = `(${func.toString()})(this, registerPaint,
						${JSON.stringify(options.config || {}, null, 2)});`;
										const blob = new Blob([src], { type: 'text/javascript' });
										url = URL.createObjectURL(blob);
										await CSS.paintWorklet.addModule(url);
										return true;
								}
								finally {
										if (url !== undefined) {
												URL.revokeObjectURL(url);
										}
								}
						})();
						this.modules.set(func, pending);
						try {
								return await pending;
						}
						catch (error) {
								this.modules.delete(func);
								throw error;
						}
				}.bind({ modules: new WeakMap }),
				escape: (value) => CSS.escape ? CSS.escape(value) : value.replace(/([\.#()[\]])/g, '\\$1'),
				number: (value) => CSS.number ? CSS.number(value) : value,
				s: (value) => CSS.s ? CSS.s(value) : `${value}s`,
				ms: (value) => CSS.ms ? CSS.ms(value) : `${value}ms`,
				pt: (value) => CSS.pt ? CSS.pt(value) : `${value}pt`,
				px: (value) => CSS.px ? CSS.px(value) : `${value}px`,
				percent: (value) => CSS.percent ? CSS.percent(value) : `${value}%`,
				vh: (value) => CSS.vh ? CSS.vh(value) : `${value}vh`,
				vw: (value) => CSS.vw ? CSS.vw(value) : `${value}vw`,
				trans: (value) => self.CSSStyleValue ? CSSStyleValue.parse('transform', value) : value,
				word: (value) => self.CSSKeywordValue ? new CSSKeywordValue(value) : value,
				image: (value) => self.CSSStyleValue ? CSSStyleValue.parse('background-image', value) : value,
		};
		return css;
})();
const cssUtil = css;
Object.assign(util, css);
Object.assign(util, workerUtil);
const nicoUtil = {
		parseWatchQuery: (query) => {
				try {
						const result = textUtil.parseQuery(query);
						const encoded = result.playlist;
						const decoded = JSON.parse(encoded && textUtil.decodeBase64(encoded) || '{}');
						if (decoded === null) {
								throw new TypeError('playlist');
						}
						const playlist = decoded;
						const context = playlist.context;
						result.playlist = { type: playlist.type };
						switch (playlist.type) {
								case 'series':
										Object.assign(result.playlist, { id: context.seriesId });
										break;
								case 'user-uploaded': {
										const { userId, ...options } = context;
										Object.assign(result.playlist, { id: userId, options });
										break;
								}
								case 'mylist': {
										const { mylistId, ...options } = context;
										Object.assign(result.playlist, { id: mylistId, options });
										break;
								}
								case 'watchlater':
								case 'search':
										Object.assign(result.playlist, { options: context });
										break;
						}
						return result;
				}
				catch (e) {
						return {};
				}
		},
		hasLargeThumbnail: (videoId) => {
				const threthold = 16371888;
				const cid = videoId.substr(0, 2);
				const fid = Number(videoId.substr(2));
				if (cid === 'nm') {
						return false;
				}
				if (cid !== 'sm' && fid < 35000000) {
						return false;
				}
				if (fid < threthold) {
						return false;
				}
				return true;
		},
		getThumbnailUrlByVideoId: (videoId) => {
				const videoIdReg = /^[a-z]{2}\d+$/;
				if (!videoIdReg.test(videoId)) {
						return null;
				}
				const fileId = parseInt(videoId.substr(2), 10);
				const large = nicoUtil.hasLargeThumbnail(videoId) ? '.L' : '';
				return fileId >= 35374758 ?
						`https://nicovideo.cdn.nimg.jp/thumbnails/${fileId}/${fileId}.L` :
						`https://tn.smilevideo.jp/smile?i=${fileId}.${large}`;
		},
		getWatchId: (url) => {
				try {
						const parsed = new URL(url || location.href, location.href);
						if (!/^https?:$/.test(parsed.protocol)) {
								return null;
						}
						const match = parsed.hostname === 'nico.ms' ?
								/^\/([a-z0-9]+)\/?$/.exec(parsed.pathname) :
								/^\/(?:watch|shorts)\/([a-z0-9]+)\/?$/.exec(parsed.pathname);
						return match ? match[1] : null;
				}
				catch (_) {
						return null;
				}
		},
		getCommonHeader: () => {
				try {
						return JSON.parse(document.querySelector('#CommonHeader[data-common-header]').dataset.commonHeader || '{}');
				}
				catch (e) {
						return { initConfig: {} };
				}
		},
		isLegacyHeader: () => !document.querySelector('#CommonHeader[data-common-header]'),
		isPremiumLegacy: () => {
				const a = 'a[href^="https://account.nicovideo.jp/premium/register"]';
				return !document.querySelector(`#topline ${a}, #CommonHeader ${a}`);
		},
		isLoginLegacy: () => {
				const a = 'a[href^="https://account.nicovideo.jp/login"]';
				return !document.querySelector(`#topline ${a}, #CommonHeader ${a}`);
		},
		isPremium: () => nicoUtil.isLegacyHeader() ? nicoUtil.isPremiumLegacy() :
				!!nicoUtil.getCommonHeader().initConfig.user.isPremium,
		isLogin: () => nicoUtil.isLegacyHeader() ? nicoUtil.isLoginLegacy() :
				!!nicoUtil.getCommonHeader().initConfig.user.isLogin,
		getPageLanguage: () => {
				try {
						const h = document.getElementsByClassName('html')[0];
						return h.lang || 'ja-JP';
				}
				catch (e) {
						return 'ja-JP';
				}
		},
		openMylistWindow: (watchId) => {
				window.open(`//www.nicovideo.jp/mylist_add/video/${watchId}`, 'nicomylistadd', 'width=500, height=400, menubar=no, scrollbars=no');
		},
		openTweetWindow: ({ watchId, duration, isChannel, title, videoId }) => {
				const nicomsUrl = `https://nico.ms/${watchId}`;
				const watchUrl = `https://www.nicovideo.jp/watch/${watchId}`;
				title = `${title}(${textUtil.secToTime(duration)})`.replace(/@/g, '@ ');
				const nicoch = isChannel ? ',+nicoch' : '';
				const url = 'https://twitter.com/intent/tweet?' +
						'url=' + encodeURIComponent(nicomsUrl) +
						'&text=' + encodeURIComponent(title) +
						'&hashtags=' + encodeURIComponent(videoId + nicoch) +
						'&original_referer=' + encodeURIComponent(watchUrl) + '';
				window.open(url, '_blank', 'width=550, height=480, left=100, top50, personalbar=0, toolbar=0, scrollbars=1, sizable=1', 0);
		},
		isGinzaWatchUrl: (url) => /^https?:\/\/www\.nicovideo\.jp\/(watch|shorts)\//.test(url || location.href),
		get getNicoHistory() {
				const entry = document.cookie.split(';').map(value => value.trim())
						.find(value => value.startsWith('nicohistory='));
				if (!entry) {
						return '';
				}
				try {
						return window.decodeURIComponent(entry.slice('nicohistory='.length));
				}
				catch (error) {
						if (!(error instanceof URIError)) {
								throw error;
						}
						return '';
				}
		},
		getMypageVer: () => document.querySelector('#js-initial-userpage-data') ? 'spa' : 'legacy'
};
Object.assign(util, nicoUtil);
const netUtil = {
		abortableFetch: async (url, params = {}) => {
				params = params || {};
				const options = { ...params };
				const callerSignal = options.signal;
				const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
				const abortReason = () => callerSignal.reason !== undefined ? callerSignal.reason :
						Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
				const timeout = (typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
				const racers = [];
				let timer;
				let onAbort;
				try {
						if (callerSignal && callerSignal.aborted) {
								throw abortReason();
						}
						if (controller) {
								options.signal = controller.signal;
						}
						if (callerSignal) {
								racers.push(new Promise((resolve, reject) => {
										onAbort = () => {
												const reason = abortReason();
												reject(reason);
												if (controller) {
														controller.abort(reason);
												}
										};
										callerSignal.addEventListener('abort', onAbort, { once: true });
								}));
						}
						if (timeout > 0) {
								racers.push(new Promise((resolve, reject) => {
										timer = setTimeout(() => {
												const error = Object.assign(new Error('timeout'), { name: 'timeout' });
												reject(error);
												if (controller) {
														controller.abort(error);
												}
										}, timeout);
								}));
						}
						racers.push(fetch(url, options));
						return await Promise.race(racers);
				}
				finally {
						if (timer !== undefined) {
								clearTimeout(timer);
						}
						if (callerSignal && onAbort) {
								callerSignal.removeEventListener('abort', onAbort);
						}
				}
		},
		fetch(url, params) {
				if (location.host !== 'www.nicovideo.jp' && typeof NicoVideoApi !== 'undefined') {
						return NicoVideoApi.fetch(url, params);
				}
				return this.abortableFetch(url, params);
		},
		jsonp: (() => {
				let callbackId = 0;
				const getFuncName = () => `JsonpCallback${callbackId++}`;
				let cw = null;
				const getFrame = () => {
						if (cw) {
								return cw;
						}
						return new Promise(resolve => {
								const iframe = document.createElement('iframe');
								iframe.srcdoc = `
					<html><head></head></html>
				`.trim();
								iframe.sandbox = 'allow-same-origin allow-scripts';
								Object.assign(iframe.style, {
										width: '32px', height: '32px', position: 'fixed', left: '-100vw', top: '-100vh',
										pointerEvents: 'none', overflow: 'hidden'
								});
								iframe.onload = () => {
										cw = iframe.contentWindow;
										resolve(cw);
								};
								(document.body || document.documentElement).append(iframe);
						});
				};
				const createFunc = async (url, funcName) => {
						let timeoutTimer = null;
						const win = await getFrame();
						const doc = win.document;
						const script = doc.createElement('script');
						return new Promise((resolve, reject) => {
								win[funcName] = (result) => {
										win.clearTimeout(timeoutTimer);
										timeoutTimer = null;
										script.remove();
										delete win[funcName];
										resolve(result);
								};
								timeoutTimer = win.setTimeout(() => {
										script.remove();
										delete win[funcName];
										if (timeoutTimer) {
												reject(new Error(`jsonp timeout ${url}`));
										}
								}, 30000);
								script.src = url;
								doc.head.append(script);
						});
				};
				return (url, funcName) => {
						if (!funcName) {
								funcName = getFuncName();
						}
						url = `${url}${url.includes('?') ? '&' : '?'}callback=${funcName}`;
						return createFunc(url, funcName);
				};
		})()
};
const AdDecorationLoader = (() => {
		const API_BASE = 'https://api.nicoad.nicovideo.jp/v1/contents/video/decoration';
		const MAX_IDS_PER_REQUEST = 100;
		const MAX_URL_LENGTH = 2000;
		const CONCURRENCY = 3;
		const splitChunks = (ids) => {
				const chunks = [];
				let current = [];
				let length = API_BASE.length + '?ids='.length;
				for (const id of ids) {
						const add = (current.length ? 1 : 0) + id.length;
						if (current.length && (current.length >= MAX_IDS_PER_REQUEST || length + add > MAX_URL_LENGTH)) {
								chunks.push(current);
								current = [];
								length = API_BASE.length + '?ids='.length;
						}
						length += (current.length ? 1 : 0) + id.length;
						current.push(id);
				}
				if (current.length) {
						chunks.push(current);
				}
				return chunks;
		};
		class AdDecorationLoader {
				async _fetchChunk(ids) {
						const url = `${API_BASE}?ids=${ids.join(',')}`;
						const res = await netUtil.fetch(url, { credentials: 'omit' });
						if (!res.ok) {
								throw new Error(`広告装飾の取得に失敗 (${res.status})`);
						}
						const json = await res.json();
						return (json && json.data && json.data.contents) || [];
				}
				async _loadChunked(watchIds, onProgress, warnPrefix) {
						const uniqIds = [...new Set((watchIds || []).filter(Boolean).map(String))];
						const result = new Map();
						const total = uniqIds.length;
						let checked = 0;
						const chunks = splitChunks(uniqIds);
						let next = 0;
						const worker = async () => {
								while (next < chunks.length) {
										const chunk = chunks[next++];
										let contents;
										try {
												contents = await this._fetchChunk(chunk);
										}
										catch (e) {
												window.console.warn(`${warnPrefix}（このチャンクは今回スキップ）`, e);
												checked += chunk.length;
												if (onProgress) {
														onProgress({ checked, total });
												}
												continue;
										}
										const byId = new Map(contents.map(c => [String(c.id), c.decoration]));
										for (const id of chunk) {
												result.set(id, byId.get(id) || 'normal');
										}
										checked += chunk.length;
										if (onProgress) {
												onProgress({ checked, total });
										}
								}
						};
						await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker()));
						return result;
				}
				async load(watchIds) {
						return this._loadChunked(watchIds, null, '広告装飾の取得に失敗');
				}
				async loadFresh(watchIds, onProgress) {
						return this._loadChunked(watchIds, onProgress, '[デバッグ全件チェック] 広告装飾の取得に失敗');
				}
		}
		return new AdDecorationLoader();
})();
Object.assign(util, netUtil);
const textUtil = {
		secToTime: (sec) => {
				return [
						Math.floor(sec / 60).toString().padStart(2, '0'),
						(Math.floor(sec) % 60).toString().padStart(2, '0')
				].join(':');
		},
		parseQuery: (query = '') => {
				query = query.startsWith('?') ? query.substr(1) : query;
				const result = {};
				query.split('&').forEach(item => {
						const sp = item.split('=');
						try {
								const key = decodeURIComponent(sp[0]);
								const val = decodeURIComponent(sp.slice(1).join('='));
								result[key] = val;
						}
						catch (error) {
								if (!(error instanceof URIError)) {
										throw error;
								}
						}
				});
				return result;
		},
		parseUrl: (url) => {
				url = url || 'https://unknown.example.com/';
				return Object.assign(document.createElement('a'), { href: url });
		},
		decodeBase64: (str) => {
				try {
						return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '='))));
				}
				catch (e) {
						return '';
				}
		},
		encodeBase64: (str) => {
				try {
						return btoa(unescape(encodeURIComponent(str)));
				}
				catch (e) {
						return '';
				}
		},
		escapeHtml: (text) => {
				const map = {
						'&': '&amp;',
						'\x27': '&#39;',
						'"': '&quot;',
						'<': '&lt;',
						'>': '&gt;'
				};
				return text.replace(/[&"'<>]/g, char => map[char]);
		},
		unescapeHtml: (text) => {
				const map = {
						'&amp;': '&',
						'&#39;': '\x27',
						'&quot;': '"',
						'&lt;': '<',
						'&gt;': '>'
				};
				return text.replace(/(&amp;|&#39;|&quot;|&lt;|&gt;)/g, char => map[char]);
		},
		escapeToZenkaku: (text) => {
				const map = {
						'&': '＆',
						'\'': '’',
						'"': '”',
						'<': '＜',
						'>': '＞'
				};
				return text.replace(/["'<>]/g, char => map[char]);
		},
		escapeRegs: (text) => {
				const match = /[\\^$.*+?()[\]{}|]/g;
				return text.replace(match, '\\$&');
		},
		convertKansuEi: (text) => {
				let match = /[〇一二三四五六七八九零壱弐惨伍]/g;
				let map = {
						'〇': '0', '零': '0',
						'一': '1', '壱': '1',
						'二': '2', '弐': '2',
						'三': '3', '惨': '3',
						'四': '4',
						'五': '5', '伍': '5',
						'六': '6',
						'七': '7',
						'八': '8',
						'九': '9',
				};
				text = text.replace(match, char => map[char]);
				text = text.replace(/([1-9]?)[十拾]([0-9]?)/g, (n, a, b) => ((a && b) ? `${a}${b}` : (a ? a * 10 : 10 + b * 1)));
				return text;
		},
		dateToString: (date) => {
				if (typeof date === 'string') {
						const origDate = date;
						date = date.replace(/\//g, '-');
						const m = /^(\d+-\d+-\d+) (\d+):(\d+):(\d+)/.exec(date);
						if (m) {
								date = new Date(m[1]);
								date.setHours(m[2]);
								date.setMinutes(m[3]);
								date.setSeconds(m[4]);
						}
						else {
								const t = Date.parse(date);
								if (isNaN(t)) {
										return origDate;
								}
								date = new Date(t);
						}
				}
				else if (typeof date === 'number') {
						date = new Date(date);
				}
				if (!date || isNaN(date.getTime())) {
						return '1970/01/01 00:00:00';
				}
				const [yy, mm, dd, h, m, s] = [
						date.getFullYear(),
						date.getMonth() + 1,
						date.getDate(),
						date.getHours(),
						date.getMinutes(),
						date.getSeconds()
				].map(n => n.toString().padStart(2, '0'));
				return `${yy}/${mm}/${dd} ${h}:${m}:${s}`;
		},
		isValidJson: (data) => {
				try {
						JSON.parse(data);
						return true;
				}
				catch (e) {
						return false;
				}
		},
		toRgba: (c, alpha = 1) => `rgba(${parseInt(c.substr(1, 2), 16)}, ${parseInt(c.substr(3, 2), 16)}, ${parseInt(c.substr(5, 2), 16)}, ${alpha})`,
		snakeToCamel: (snake) => snake.replace(/-./g, s => s.charAt(1).toUpperCase()),
		camelToSnake: (camel, separator = '_') => camel.replace(/([A-Z])/g, s => separator + s.toLowerCase())
};
Object.assign(util, textUtil);
const reg = (() => {
		const $ = Symbol('$');
		const undef = Symbol.for('undefined');
		const MAX_RESULT = 30;
		const smap = new WeakMap();
		const self = {};
		const reg = function (regex = undef, str = undef) {
				const { results, last } = smap.has(this) ?
						smap.get(this) : { results: [], last: { result: null } };
				smap.set(this, { results, last });
				if (regex === undef) {
						return last ? last.result : null;
				}
				const regstr = regex.toString();
				if (str !== undef) {
						const found = results.find(r => regstr === r.regstr && str === r.str);
						return found ? found.result : reg.call(this, regex).exec(str);
				}
				return {
						exec(str) {
								const result = regex.exec(str);
								Array.isArray(result) && result.forEach((r, i) => result['$' + i] = r);
								Object.assign(last, { str, regstr, result });
								results.push(last);
								results.length > MAX_RESULT && results.shift();
								this[$] = regex[$] = result;
								return result;
						},
						test(str) { return !!this.exec(str); }
				};
		};
		const scope = (scopeObj = {}) => reg.bind(scopeObj);
		return Object.assign(reg.bind(self), { $, scope });
})();

    MylistPocket.emitter = util.emitter = new Emitter();

    const ZenzaDetector = (function() {
      let isReady = false;
      let Zenza = null;
      const emitter = new Emitter();

      const initialize = function() {
        const onZenzaReady = () => {
          isReady = true;
          Zenza = window.ZenzaWatch;

          Zenza.emitter.on('hideHover', () => {
            util.emitter.emit('hideHover');
          });

          Zenza.emitter.on('csrfToken', (token) => {
            util.emitter.emit('csrfToken', token);
          });

          let popup = document.getElementById('mylistPocket-popup');
          let defaultContainer = document.getElementById('mylistPocketDomContainer');
          defaultContainer.classList.add('zen-family');
          let zenzaContainer;
          Zenza.emitter.on('fullScreenStatusChange', isFull => {
            if (isFull) {
              if (!zenzaContainer) {
                zenzaContainer = document.querySelector('.zenzaPlayerContainer');
              }
              zenzaContainer.appendChild(popup);
            } else {
              defaultContainer.appendChild(popup);
            }
          });
          emitter.emit('ready', Zenza);
        };

        if (window.ZenzaWatch && window.ZenzaWatch.ready) {
          window.console.log('ZenzaWatch is Ready');
          onZenzaReady();
        } else {
          document.body.addEventListener('ZenzaWatchInitialize', function() {
            window.console.log('ZenzaWatchInitialize MylistPocket');
            onZenzaReady();
          });
        }
      };

      const detect = function() {
        return new Promise(res => {
          if (isReady) {
            return res(Zenza);
          }
          emitter.on('ready', () => {
            res(Zenza);
          });
        });
      };

      return {
        initialize: initialize,
        detect: detect
      };

    })();
const objUtil = (() => {
		const isObject = (e) => e !== null && e instanceof Object;
		const PROPS = Symbol('PROPS');
		const REVISION = Symbol('REVISION');
		const CHANGED = Symbol('CHANGED');
		const HAS = Symbol('HAS');
		const SET = Symbol('SET');
		const GET = Symbol('GET');
		return {
				bridge: (self, target, keys = null) => {
						(keys || Object.getOwnPropertyNames(target.constructor.prototype))
								.filter(key => typeof target[key] === 'function')
								.forEach(key => self[key] = target[key].bind(target));
				},
				isObject,
				toMap: (obj, mapper = Map) => {
						if (obj instanceof mapper) {
								return obj;
						}
						return new mapper(Object.entries(obj));
				},
				mapToObj: (map) => {
						if (!(map instanceof Map)) {
								return map;
						}
						const obj = {};
						for (const [key, val] of map) {
								obj[key] = val;
						}
						return obj;
				}
		};
})();
const StorageWriter = (() => {
		const func = function (self) {
				self.onmessage = ({ command, params }) => {
						const { obj, replacer, space } = params;
						return JSON.stringify(obj, replacer || null, space || 0);
				};
		};
		let worker;
		const prototypePollution = window.Prototype && Array.prototype.hasOwnProperty('toJSON');
		const toJson = async (obj, replacer = null, space = 0) => {
				if (!prototypePollution || obj === null || ['string', 'number', 'boolean'].includes(typeof obj)) {
						return JSON.stringify(obj, replacer, space);
				}
				worker = worker || workerUtil.createCrossMessageWorker(func, { name: 'ToJsonWorker' });
				return worker.post({ command: 'toJson', params: { obj, replacer, space } });
		};
		const writer = Symbol('StorageWriter');
		const setItem = (storage, key, value) => {
				if (!prototypePollution || value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
						storage.setItem(key, JSON.stringify(value));
				}
				else {
						toJson(value).then(json => storage.setItem(key, json));
				}
		};
		localStorage[writer] = (key, value) => setItem(localStorage, key, value);
		sessionStorage[writer] = (key, value) => setItem(sessionStorage, key, value);
		return { writer, toJson };
})();
const Observable = (() => {
		const observableSymbol = Symbol.observable || Symbol('observable');
		const nop = Handler.nop;
		class Subscription {
				constructor({ observable, subscriber, unsubscribe, closed }) {
						this.callbacks = { unsubscribe, closed };
						this.observable = observable;
						const next = subscriber.next.bind(subscriber);
						subscriber.next = args => {
								if (this.closed || (this._filterFunc && !this._filterFunc(args))) {
										return;
								}
								return this._mapFunc ? next(this._mapFunc(args)) : next(args);
						};
						this._closed = false;
				}
				subscribe(onNext, onError, onCompleted) {
						return this.observable._subscribe({
								subscriber: Subscriber.create(onNext, onError, onCompleted),
								isNop: [onNext, onError, onCompleted].every(f => f == null),
								filterFunc: this._filterFunc, mapFunc: this._mapFunc
						});
				}
				unsubscribe() {
						if (this._closed) {
								return this;
						}
						this._closed = true;
						if (this.callbacks.unsubscribe) {
								this.callbacks.unsubscribe();
						}
						return this;
				}
				dispose() {
						return this.unsubscribe();
				}
				filter(func) {
						const _func = this._filterFunc;
						this._filterFunc = _func ? (arg => _func(arg) && func(arg)) : func;
						return this;
				}
				map(func) {
						const _func = this._mapFunc;
						this._mapFunc = _func ? arg => func(_func(arg)) : func;
						return this;
				}
				get closed() {
						if (this.callbacks.closed) {
								return this._closed || this.callbacks.closed();
						}
						else {
								return this._closed;
						}
				}
		}
		class Subscriber {
				static create(onNext = null, onError = null, onCompleted = null) {
						if (typeof onNext === 'function') {
								return new this({
										next: onNext,
										error: onError,
										complete: onCompleted
								});
						}
						return new this((onNext || {}));
				}
				constructor({ start, next, error, complete, closed } = {}) {
						this.callbacks = {
								start: typeof start === 'function' ? start : nop,
								next: typeof next === 'function' ? next : nop,
								error: typeof error === 'function' ? error : nop,
								complete: typeof complete === 'function' ? complete : nop,
								closed: typeof closed === 'function' ? closed : () => false
						};
				}
				start(arg) { this.callbacks.start(arg); }
				next(arg) { this.callbacks.next(arg); }
				error(arg) { this.callbacks.error(arg); }
				complete(arg) { this.callbacks.complete(arg); }
				get closed() {
						return this.callbacks.closed();
				}
		}
		Subscriber.nop = { start: nop, next: nop, error: nop, complete: nop, closed: nop };
		const eleMap = new WeakMap();
		class Observable {
				static of(...args) {
						return new this(o => {
								for (const arg of args) {
										o.next(arg);
								}
								o.complete();
								return () => { };
						});
				}
				static from(arg) {
						if (arg[Symbol.iterator]) {
								return this.of(...arg);
						}
						else if (arg[Observable.observavle]) {
								return arg[Observable.observavle]();
						}
				}
				static fromEvent(element, eventName) {
						const em = eleMap.get(element) || {};
						if (em && em[eventName]) {
								return em[eventName];
						}
						eleMap.set(element, em);
						return em[eventName] = new this(o => {
								const onUpdate = (e) => o.next(e);
								element.addEventListener(eventName, onUpdate, { passive: true });
								return () => element.removeEventListener(eventName, onUpdate);
						});
				}
				static interval(ms) {
						return new this(function (o) {
								const timer = setInterval(() => o.next(this.i++), ms);
								return () => clearInterval(timer);
						}.bind({ i: 0 }));
				}
				constructor(subscriberFunction) {
						this._subscriberFunction = subscriberFunction;
						this._sources = [];
						this._connection = null;
				}
				get closed() { return !!(this._connection && this._connection.closed); }
				_disposeToken(token) {
						token.done = true;
						if (!token.cleanup) {
								return;
						}
						const cleanup = token.cleanup;
						token.cleanup = null;
						try {
								cleanup();
						}
						catch (error) {
								console.warn('Observable cleanup failed', error);
						}
				}
				_finish(connection, method, value) {
						if (connection.closed) {
								return;
						}
						connection.closed = true;
						try {
								if (method) {
										connection.handlers.execMethod(method, value);
								}
						}
						finally {
								connection.handlers.clear();
								for (const token of connection.tokens) {
										this._disposeToken(token);
								}
								connection.tokens.clear();
						}
				}
				_connect(connection) {
						connection.started = true;
						const sources = [observer => this._subscriberFunction(observer),
								...this._sources.map(source => (observer) => source.subscribe({
										next: (value) => observer.next(value), error: (error) => observer.error(error),
										complete: (value) => observer.complete(value)
								}))];
						let index = 0;
						const advance = (completion) => {
								if (connection.closed) {
										return;
								}
								if (index === sources.length) {
										this._finish(connection, 'complete', completion);
										return;
								}
								const producer = sources[index++];
								const token = { done: false, cleanup: null };
								connection.tokens.add(token);
								const active = () => !connection.closed && !token.done;
								const observer = new Subscriber({
										start: (value) => { if (active()) {
												connection.handlers.execMethod('start', value);
										} },
										next: (value) => { if (active()) {
												connection.handlers.execMethod('next', value);
										} },
										error: (error) => { if (active()) {
												this._finish(connection, 'error', error);
										} },
										complete: (value) => {
												if (!active()) {
														return;
												}
												this._disposeToken(token);
												advance(value);
										},
										closed: () => !active()
								});
								this._subscriber = observer;
								try {
										const cleanup = producer(observer);
										token.cleanup = typeof cleanup === 'function' ? cleanup :
												cleanup && typeof cleanup.unsubscribe === 'function' ? () => cleanup.unsubscribe() : null;
										if (token.done || connection.closed) {
												this._disposeToken(token);
										}
								}
								catch (error) {
										observer.error(error);
								}
						};
						advance();
				}
				filter(func) {
						return this.subscribe().filter(func);
				}
				map(func) {
						return this.subscribe().map(func);
				}
				concat(arg) {
						const observable = Observable.from(arg);
						if (!observable || observable === this) {
								throw new TypeError('Invalid concatenated Observable');
						}
						const pending = [observable], seen = new Set();
						while (pending.length) {
								const source = pending.pop();
								if (source === this) {
										throw new TypeError('Cyclic concatenated Observable');
								}
								if (seen.has(source)) {
										continue;
								}
								seen.add(source);
								pending.push(...(source._sources || []));
						}
						this._sources.push(observable);
						return this;
				}
				forEach(callback) {
						let p = new PromiseHandler();
						callback(p);
						return this.subscribe({
								next: (arg) => {
										const lp = p;
										p = new PromiseHandler();
										lp.resolve(arg);
										callback(p);
								},
								error: (arg) => {
										const lp = p;
										p = new PromiseHandler();
										lp.reject(arg);
										callback(p);
								}
						});
				}
				onStart(arg) { this._subscriber.start(arg); }
				onNext(arg) { this._subscriber.next(arg); }
				onError(arg) { this._subscriber.error(arg); }
				onComplete(arg) { this._subscriber.complete(arg); }
				disconnect() {
						if (this._connection) {
								this._finish(this._connection);
						}
				}
				[observableSymbol]() { return this; }
				subscribe(onNext = null, onError = null, onCompleted = null) {
						return this._subscribe({
								subscriber: Subscriber.create(onNext, onError, onCompleted),
								isNop: [onNext, onError, onCompleted].every(f => f === null)
						});
				}
				_subscribe({ subscriber, isNop, filterFunc, mapFunc }) {
						let connection = this._connection;
						if (!connection || connection.closed) {
								connection = { closed: false, started: false, handlers: new Handler(), tokens: new Set() };
								if (!isNop) {
										this._connection = connection;
								}
						}
						const subscription = new Subscription({
								observable: this, subscriber,
								unsubscribe: () => {
										if (isNop) {
												return;
										}
										connection.handlers.remove(subscriber);
										if (connection.handlers.isEmpty) {
												this._finish(connection);
										}
								},
								closed: () => connection.closed
						}).filter(filterFunc).map(mapFunc);
						if (isNop) {
								return subscription;
						}
						connection.handlers.add(subscriber);
						try {
								subscriber.start(subscription);
						}
						catch (error) {
								subscription.unsubscribe();
								throw error;
						}
						if (!connection.closed && !connection.started) {
								this._connect(connection);
						}
						return subscription;
				}
		}
		Observable.observavle = observableSymbol;
		return Observable;
})();
const WindowResizeObserver = Observable.fromEvent(window, 'resize')
		.map(o => { return { width: window.innerWidth, height: window.innerHeight }; });
// already required
class DataStorage {
	static create(defaultData, options = {}) {
		return new DataStorage(defaultData, options);
	}
	static clone(dataStorage) {
		const options = {
			prefix:  dataStorage.prefix,
			storage: dataStorage.storage,
			ignoreExportKeys: dataStorage.options.ignoreExportKeys,
			readonly: dataStorage.readonly,
			normalizeImport: dataStorage.options.normalizeImport,
			validateImport: dataStorage.options.validateImport,
			preserveInvalidKeys: dataStorage.options.preserveInvalidKeys
		};
		return DataStorage.create(dataStorage.default, options);
	}
	constructor(defaultData, options = {}) {
		this.options = options;
		this.default = defaultData;
		this._data = Object.assign({}, defaultData);
		this.prefix = `${options.prefix || 'DATA'}_`;
		this.storage = options.storage || localStorage;
		this._ignoreExportKeys = options.ignoreExportKeys || [];
		this.readonly = options.readonly;
		this.silently = false;
		this._changed = new Map();
		this._onChange = bounce.time(this._onChange.bind(this));
		objUtil.bridge(this, new Emitter());
		this.restoreError = null;
		this.restore().catch(error => {
			this.restoreError = error;
			this._data = Object.assign({}, defaultData);
			window.console.error('DataStorage restore failed; using defaults',
				{name: error && error.name});
		}).then(() => {
			this.props = this._makeProps(defaultData);
			this.emitResolve('restore');
		});
		this.logger = (self || window).console;
		this.consoleSubscriber = {
			next: (v, ...args) => this.logger.log('next', v, ...args),
			error: (e, ...args) => this.logger.warn('error', e, ...args),
			complete: (c, ...args) => this.logger.log('complete', c, ...args)
		};
	}
	_makeProps(defaultData = {}, namespace = '') {
		namespace = namespace ? `${namespace}.` : '';
		const self = this;
		const def = {};
		const props = {};
		Object.keys(defaultData).sort()
			.filter(key => key.includes(namespace))
			.forEach(key => {
				const k = key.slice(namespace.length);
				if (k.includes('.')) {
					const ns = k.slice(0, k.indexOf('.'));
					props[ns] = this._makeProps(defaultData, `${namespace}${ns}`);
				}
				def[k] = {
					enumerable: !this._ignoreExportKeys.includes(key),
					get() { return self.getValue(key); },
					set(v) { self.setValue(key, v); }
				};
		});
		Object.defineProperties(props, def);
		return props;
	}
	_onChange() {
		const changed = this._changed;
		this.emit('change', changed);
		for (const [key, val] of changed) {
			this.emitAsync('update', key, val);
			this.emitAsync(`update-${key}`, val);
		}
		this._changed.clear();
	}
	onkey(key, callback) {
		this.on(`update-${key}`, callback);
	}
	offkey(key, callback) {
		this.off(`update-${key}`, callback);
	}
	async restore(storage) {
		storage = storage || this.storage;
		Object.keys(this.default).forEach(key => {
			const storageKey = this.getStorageKey(key);
			if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
				try {
					this._data[key] = JSON.parse(storage[storageKey]);
				} catch (e) {
					console.error('DataStorage restore parse failed for key', key);
					if (!this.readonly && !this.options?.preserveInvalidKeys?.includes(key)) { delete storage[storageKey]; }
					this._data[key] = this.default[key];
				}
			} else {
				this._data[key] = this.default[key];
			}
		});
	}
	getNativeKey(key) {
		return key;
	}
	getStorageKey(key) {
		return `${this.prefix}${key}`;
	}
	async refresh(key, storage) {
		storage = storage || this.storage;
		key = this.getNativeKey(key);
		const storageKey = this.getStorageKey(key);
		if (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined) {
			try {
				this._data[key] = JSON.parse(storage[storageKey]);
			} catch (e) {
				console.error('DataStorage refresh parse failed for key', key);
			}
		}
		return this._data[key];
	}
	getValue(key) {
		key = this.getNativeKey(key);
		return this._data[key];
	}
	deleteValue(key) {
		key = this.getNativeKey(key);
		const storageKey = this.getStorageKey(key);
		if (!this.readonly) { this.storage.removeItem(storageKey); }
		this._data[key] = this.default[key];
	}
	setValue(key, value) {
		const _key = key;
		key = this.getNativeKey(key);
		if (this._data[key] === value || value === undefined) {
			return;
		}
		const storageKey = this.getStorageKey(key);
		const storage = this.storage;
		if (!this.readonly) {
			try {
				if (typeof value === 'number' && !Number.isFinite(value)) {
					throw new TypeError('Cannot serialize non-finite DataStorage number');
				}
				const json = JSON.stringify(value);
				if (json === undefined) {
					throw new TypeError('Cannot serialize DataStorage value');
				}
				storage[storageKey] = json;
			} catch (e) {
				window.console.error(e);
				return false;
			}
		}
		this._data[key] = value;
		if (!this.silently) {
			this._changed.set(_key, value);
			this._onChange();
		}
	}
	setValueSilently(key, value) {
		const isSilent = this.silently;
		this.silently = true;
		this.setValue(key, value);
		this.silently = isSilent;
	}
	export(isAll = false) {
		const result = {};
		const _default = this.default;
		Object.keys(this.props)
			.filter(key => isAll || (_default[key] !== this._data[key]))
			.forEach(key => result[key] = this.getValue(key));
		return result;
	}
	exportJson() {
		return JSON.stringify(this.export(), null, 2);
	}
	import(data) {
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new TypeError('設定データはJSONオブジェクトで指定してください。');
		}
		const entries = Object.keys(this.default)
			.filter(key => !this._ignoreExportKeys.includes(key))
			.map(key => {
				const raw = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : this.default[key];
				const value = this.options.normalizeImport ? this.options.normalizeImport(key, raw) : raw;
				const expected = this.default[key];
				if (typeof value !== typeof expected || value === null && expected !== null ||
						Array.isArray(value) !== Array.isArray(expected) ||
						typeof value === 'number' && !Number.isFinite(value) ||
						this.options.validateImport && !this.options.validateImport(key, value)) {
					throw new TypeError(`設定値が不正です: ${key}`);
				}
				const json = JSON.stringify(value);
				if (json === undefined) { throw new TypeError(`設定値を保存できません: ${key}`); }
				return {key, value, json, storageKey: this.getStorageKey(key)};
			});
		if (!this.readonly) {
			const written = [];
			try {
				for (const entry of entries) {
					const previous = this.storage[entry.storageKey];
					this.storage[entry.storageKey] = entry.json;
					written.push({key: entry.storageKey, previous});
				}
			} catch (error) {
				for (const {key, previous} of written.reverse()) {
					try {
						if (previous === undefined) { delete this.storage[key]; }
						else { this.storage[key] = previous; }
					} catch (restoreError) { window.console.error('設定の復元に失敗しました', restoreError); }
				}
				throw error;
			}
		}
		for (const {key, value} of entries) { this._data[key] = value; }
	}
	importJson(json) {
		this.import(JSON.parse(json));
	}
	getKeys() {
		return Object.keys(this.props);
	}
	clearConfig() {
		this.silently = true;
		const storage = this.storage;
		Object.keys(this.default)
			.filter(key => !this._ignoreExportKeys.includes(key)).forEach(key => {
				const storageKey = this.getStorageKey(key);
				try {
					if (!this.readonly && (storage.hasOwnProperty(storageKey) || storage[storageKey] !== undefined)) {
						console.log('delete storage', storageKey);
						delete storage[storageKey];
					}
					this._data[key] = this.default[key];
				} catch (e) {}
		});
		this.silently = false;
	}
	namespace(name) {
		const namespace = name ? `${name}.` : '';
		const updateListeners = new Map();
		const result = {
			getValue: key => this.getValue(`${namespace}${key}`),
			setValue: (key, value) => this.setValue(`${namespace}${key}`, value),
			on: (key, func) => {
				if (key === 'update') {
					if (updateListeners.has(func)) { return result; }
					const onUpdate = (key, value) => {
						if (key.startsWith(namespace)) {
							func(key.slice(namespace.length), value);
						}
					};
					updateListeners.set(func, onUpdate);
					this.on('update', onUpdate);
					return result;
				}
				return this.onkey(`${namespace}${key}`, func);
			},
			off: (key, func) => {
				if (key === 'update') {
					if (!func) {
						for (const listener of updateListeners.values()) {
							this.off('update', listener);
						}
						updateListeners.clear();
					} else if (updateListeners.has(func)) {
						this.off('update', updateListeners.get(func));
						updateListeners.delete(func);
					}
					return result;
				}
				return this.offkey(`${namespace}${key}`, func);
			},
			onkey: (key, func) => {
				this.on(`update-${namespace}${key}`, func);
				return result;
			},
			offkey: (key, func) => {
				this.off(`update-${namespace}${key}`, func);
				return result;
			},
			props: this.props[name],
			refresh: () => this.refresh(),
			subscribe: subscriber => {
				return this.subscribe(subscriber)
					.filter(changed => changed.keys().some(k => k.startsWith(namespace)))
					.map(changed => {
						const result = new Map;
						for (const k of changed.keys()) {
							k.startsWith(namespace) && result.set(k, changed.get(k));
						}
						return result;
					});
			}
		};
		return result;
	}
	subscribe(subscriber) {
		subscriber = subscriber || this.consoleSubscriber;
		const observable = new Observable(o => {
			const onChange = changed => o.next(changed);
			this.on('change', onChange);
			return () => this.off('change', onChange);
		});
		return observable.subscribe(subscriber);
	}
	watch() {
	}
	unwatch() {
		this.consoleSubscription && this.consoleSubscription.unsubscribe();
		this.consoleSubscription = null;
	}
}

    const config = (() => {
      const DEFAULT_CONFIG = {
        debug: false,

        'videoInfo.openNewWindow': false,
        'mylist.enableAutoComment': true, // マイリストコメントに投稿者を入れる

        'responsive.matrix': false,

        'nicoad.hide': false,

        'ng.enable': false,
        'ng.owner':   '',
        'ng.word':    '',
        'ng.tag':     '',
        'ng.syncZenza': false,

        'fav.owner':   '',
        'fav.word':    '',
        'fav.tag':     ''
      };
      return new DataStorage(
        DEFAULT_CONFIG,
        {
          prefix: `${PRODUCT}_config`,
          ignoreExportKeys: [],
          readonly: !location || location.host !== 'www.nicovideo.jp',
          storage: localStorage
        }
      );
    })();

    MylistPocket.broadcast = (function(config) {
      if (!window.BroadcastChannel) { return; }
      const broadcastChannel = new window.BroadcastChannel(PRODUCT);

      const onBroadcastMessage = (e) => {
        const data = e.data;
        switch (data.type) {
          case 'config-update':
            config.refresh(true);
            break;
        }
      };

      broadcastChannel.addEventListener('message', onBroadcastMessage);

      return {
        postMessage: (...args) => { broadcastChannel.postMessage(...args); }
      };

    })(config);
    config.on('update', (key, value) => {
      if (!config.props.hasOwnProperty(key)) { return; }
      MylistPocket.broadcast.postMessage(
        {type: 'config-update', key, value, storage: 'local'}
      );
    });

    MylistPocket.config = config;



    const CacheStorage = (function() {
      let PREFIX = PRODUCT + '_cache_';

      class CacheStorage {

        constructor(storage, gc = false) {
          this._storage = storage;
          this._memory = {};
          if (gc) { this.gc(); }
          Object.keys(storage).forEach((key) => {
            if (key.indexOf(PREFIX) === 0) {
              this._memory[key] = storage[key];
            }
          });
          this.gc = bounce.time(this.gc.bind(this), 100);
        }

        _readItem(key) {
          let item;
          try {
            item = JSON.parse(this._storage[key]);
          } catch (e) {
            delete this._memory[key];
            this._storage.removeItem(key);
            return null;
          }
          if (!item || typeof item !== 'object' || Array.isArray(item) ||
              !Object.prototype.hasOwnProperty.call(item, 'data') ||
              !(item.expiredAt === '' ||
                (typeof item.expiredAt === 'number' && Number.isFinite(item.expiredAt)))) {
            delete this._memory[key];
            this._storage.removeItem(key);
            return null;
          }
          return item;
        }

        gc(now = -1) {
          const storage = this._storage;
          now = now >= 0 ? now : Date.now();
          Object.keys(storage).forEach(key => {
            if (key.indexOf(PREFIX) !== 0) { return; }
            const item = this._readItem(key);
            if (!item || item.expiredAt === '' || item.expiredAt > now) { return; }
            delete this._memory[key];
            storage.removeItem(key);
          });
        }

        setItem(key, data, expireTime) {
          key = PREFIX + key;
          const expiredAt =
            typeof expireTime === 'number' ? (Date.now() + expireTime) : '';

          const cacheData = {
            data: data,
            type: typeof data,
            expiredAt: expiredAt
          };

          this._memory[key] = cacheData;
          let serialized;
          try {
            serialized = JSON.stringify(cacheData);
            this._storage[key] = serialized;
            this.gc();
          } catch (e) {
            if (e.name === 'QuotaExceededError' ||
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              try {
                // bounce.time is deferred and has no cancel/flush API.
                CacheStorage.prototype.gc.call(this);
                this._storage[key] = serialized;
                this.gc();
              } catch (retryError) {
                // Preserve best-effort persistence and the existing memory envelope.
              }
            }
          }
        }

        getItem(key) {
          key = PREFIX + key;
          if (!(this._storage.hasOwnProperty(key) || this._storage[key] !== undefined)) {
            return null;
          }
          const item = this._readItem(key);
          if (!item) { return null; }

          if (item.expiredAt === '' || item.expiredAt > Date.now()) {
            return item.data;
          }
          return null;
        }

        removeItem(key) {
          key = PREFIX + key;
          delete this._memory[key];
          if (this._storage.hasOwnProperty(key) || this._storage[key] !== undefined) {
            this._storage.removeItem(key);
          }
        }

        clear() {
          const storage = this._storage;
          this._memory = {};
          Object.keys(storage).forEach((v) => {
            if (v.indexOf(PREFIX) === 0) {
              storage.removeItem(v);
            }
          });
        }
      }
      return CacheStorage;
    })();
    MylistPocket.debug.sessionCache = new CacheStorage(sessionStorage, true);
    MylistPocket.debug.localCache   = new CacheStorage(localStorage, true);

    const WindowMessageEmitter = (function() {
      const emitter = new Emitter();
      const knownSource = [];

      const onMessage = (event) => {
        if (_.indexOf(knownSource, event.source) < 0 //&&
            //event.origin !== location.protocol + '//ext.nicovideo.jp'
            ) { return; }

        try {
          let data = JSON.parse(event.data);
          if (data.id !== PRODUCT) { return; }

          emitter.emit('onMessage', data.body, data.type);
        } catch (e) {
          console.log(
            '%cMylistPocket.Error: window.onMessage  - ',
            'color: red; background: yellow',
            e,
            event
          );
          console.log('%corigin: ', 'background: yellow;', event.origin);
          console.log('%cdata: ',   'background: yellow;', event.data);
          console.trace();
        }
      };

      emitter.addKnownSource = (win) => {
        knownSource.push(win);
      };

      window.addEventListener('message', onMessage);

      return emitter;
    })();

class CrossDomainGate extends Emitter {
		static get hostReg() {
				return /^[a-z0-9]*\.nicovideo\.jp$/;
		}
		constructor(...args) {
				super();
				this.initialize(...args);
		}
		initialize(params) {
				this._baseUrl = params.baseUrl;
				this._origin = params.origin || location.href;
				this._type = params.type;
				this._suffix = params.suffix || '';
				this.name = params.name || params.type;
				this._sessions = {};
				this._initializeStatus = 'none';
				this._generation = 0;
				this._disposed = false;
		}
		_initializeFrame() {
				if (this._disposed) {
						return Promise.reject(new Error('Gate disposed'));
				}
				if (this.loaderFrame && !this.loaderFrame.parentNode) {
						this._disconnect(new Error('Gate frame removed'));
				}
				if (this._initializeStatus !== 'none') {
						return this.promise('initialize');
				}
				this.resetPromise('initialize');
				const pending = this.promise('initialize');
				this._initializeStatus = 'initializing';
				const generation = ++this._generation;
				this._initializeTimer = setTimeout(() => {
						if (generation === this._generation) {
								this._disconnect(Object.assign(new Error('Gate initialization timeout'), { status: 'timeout' }));
						}
				}, 60000);
				if (!this._pageHide) {
						this._pageHide = () => this._disconnect(new Error('Gate page hidden'));
						window.addEventListener('pagehide', this._pageHide);
				}
				try {
						this._initializeCrossDomainGate();
				}
				catch (error) {
						this._disconnect(error);
				}
				return pending;
		}
		_clearInitializeTimer() {
				if (this._initializeTimer !== undefined) {
						clearTimeout(this._initializeTimer);
				}
				this._initializeTimer = undefined;
		}
		_disconnect(error = new Error('Gate disconnected')) {
					this._generation;
				this._clearInitializeTimer();
				if (this._initialListener) {
						window.removeEventListener('message', this._initialListener, { capture: true });
						this._initialListener = null;
				}
				if (this._frameObserver) {
						this._frameObserver.disconnect();
						this._frameObserver = null;
				}
				if (this._initializeStatus === 'initializing') {
						this.emitReject('initialize', error);
				}
				this._initializeStatus = 'none';
				this.resetPromise('initialize');
				for (const id of Object.keys(this._sessions)) {
						this._settleSession(id, error);
				}
				if (this.port) {
						this.port.removeEventListener && this.port.removeEventListener('message', this._portListener);
						this.port.removeEventListener && this.port.removeEventListener('messageerror', this._portError);
						this.port.close && this.port.close();
				}
				this.port = null;
				this._loaderWindow = null;
				if (this.loaderFrame) {
						this.loaderFrame.remove();
						this.loaderFrame = null;
				}
		}
		dispose() {
				this._disposed = true;
				this._disconnect(new Error('Gate disposed'));
				if (this._pageHide) {
						window.removeEventListener('pagehide', this._pageHide);
						this._pageHide = null;
				}
				if (this._configListener) {
						this._config.off('update', this._configListener);
						this._configListener = null;
				}
		}
		reconnect() {
				this._disconnect(new Error('Gate reconnecting'));
				this._disposed = false;
				return this._initializeFrame();
		}
		_settleSession(id, error, result) {
				const session = this._sessions[id];
				if (!session) {
						return;
				}
				delete this._sessions[id];
				session.cleanup();
				if (arguments.length < 3) {
						if (session.command === 'fetch' && this.port) {
								try {
										this.port.postMessage({ body: { command: 'cancelFetch', params: { sessionId: id } }, token: TOKEN });
								}
								catch (_) { /* The peer may already be gone. */ }
						}
						session.reject(error);
				}
				else {
						session.resolve(result);
				}
		}
		async _waitForInitialize(pending, signal) {
				if (!signal) {
						return pending;
				}
				if (signal.aborted) {
						throw signal.reason !== undefined ? signal.reason : Object.assign(new Error('Aborted'), { name: 'AbortError' });
				}
				let onAbort;
				try {
						return await Promise.race([pending, new Promise((resolve, reject) => {
										onAbort = () => reject(signal.reason !== undefined ? signal.reason : Object.assign(new Error('Aborted'), { name: 'AbortError' }));
										signal.addEventListener('abort', onAbort, { once: true });
								})]);
				}
				finally {
						signal.removeEventListener('abort', onAbort);
				}
		}
		_initializeCrossDomainGate() {
				window.console.time(`GATE OPEN: ${this.name} ${PRODUCT}`);
				const loaderFrame = this.loaderFrame = document.createElement('iframe');
				loaderFrame.referrerPolicy = 'origin';
				loaderFrame.sandbox = 'allow-scripts allow-same-origin';
				loaderFrame.loading = 'eager';
				loaderFrame.name = `${this._type}${PRODUCT}Loader${this._suffix ? `#${this._suffix}` : ''}`;
				loaderFrame.className = `xDomainLoaderFrame ${this._type}`;
				loaderFrame.style.cssText = `
			position: fixed; left: -100vw; pointer-events: none;user-select: none; contain: strict;`;
				(document.body || document.documentElement).append(loaderFrame);
				this._loaderWindow = loaderFrame.contentWindow;
				const generation = this._generation;
				if (typeof MutationObserver !== 'undefined') {
						this._frameObserver = new MutationObserver(() => {
								if (generation === this._generation && !loaderFrame.parentNode) {
										this._disconnect(new Error('Gate frame removed'));
								}
						});
						this._frameObserver.observe(loaderFrame.parentNode, { childList: true });
				}
				const onInitialMessage = this._initialListener = (event) => {
						if (generation !== this._generation || event.source !== loaderFrame.contentWindow) {
								return;
						}
						this._onMessage(event);
						if (this._initializeStatus === 'done') {
								window.removeEventListener('message', onInitialMessage, { capture: true });
								this._initialListener = null;
						}
				};
				window.addEventListener('message', onInitialMessage, { capture: true });
				this._loaderWindow.location.replace(this._baseUrl + '#' + TOKEN);
		}
		_onMessage(event) {
				if (this._disposed) {
						return;
				}
				let data;
				try {
						data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
				}
				catch (_) {
						return;
				}
				if (!data || !data.body || typeof data.body !== 'object') {
						return;
				}
				const { id, type, token, sessionId, body } = data;
				if (id !== PRODUCT || type !== this._type || token !== TOKEN) {
						console.warn('invalid token:', { id, PRODUCT, type, _type: this._type, tokenMatches: token === TOKEN });
						return;
				}
				if (!this.port && body.command !== 'initialized') {
						return;
				}
				if (!this.port && body.command === 'initialized') {
						if (!event.ports || !event.ports[0]) {
								return;
						}
						const port = this.port = event.ports[0];
						const generation = this._generation;
						this._portListener = event => {
								if (generation === this._generation && this.port === port) {
										this._onMessage(event);
								}
						};
						this._portError = () => {
								if (generation === this._generation) {
										this._disconnect(new Error('Gate message error'));
								}
						};
						port.addEventListener('message', this._portListener);
						port.addEventListener('messageerror', this._portError);
						port.start();
						port.postMessage({ body: { command: 'ok' }, token: TOKEN });
				}
				return this._onCommand(body, sessionId);
		}
		_onCommand({ command, status, params }, sessionId = null) {
				switch (command) {
						case 'initialized':
								if (this._initializeStatus !== 'done') {
										this._initializeStatus = 'done';
										this._clearInitializeTimer();
										const originalBody = params;
										window.console.timeEnd(`GATE OPEN: ${this.name} ${PRODUCT}`);
										const result = originalBody && this._onCommand(originalBody, sessionId);
										this.emitResolve('initialize', { status: 'ok' });
										return result;
								}
								break;
						case 'message':
								BroadcastEmitter.emitAsync('message', params, 'broadcast', sessionId);
								break;
						default:
								{
										const session = this._sessions[sessionId];
										if (!session) {
												return;
										}
										if (status === 'ok') {
												this._settleSession(sessionId, null, params);
										}
										else {
												this._settleSession(sessionId, { message: status || 'fail' });
										}
								}
								break;
				}
		}
		load(url, options) {
				return this._postMessage({ command: 'loadUrl', params: { url, options } });
		}
		videoCapture(src, sec) {
				return this._postMessage({ command: 'videoCapture', params: { src, sec } })
						.then(result => Promise.resolve(result.dataUrl));
		}
		_fetch(url, options = {}) {
				const { signal, ...transferOptions } = options;
				return this._postMessage({ command: 'fetch', params: { url, options: transferOptions } }, true, '', { signal, timeout: options.timeout });
		}
		async fetch(resource, options = {}) {
				options = { ...options };
				let url = resource;
				if (resource instanceof URL) {
						url = resource.toString();
				}
				else if (resource instanceof Request) {
						url = resource.url;
						options.method ??= resource.method;
						options.headers ??= resource.headers;
						options.body ??= resource.body;
						options.credentials ??= resource.credentials;
						options.signal ??= resource.signal;
				}
				const result = await this._fetch(url, options);
				if (typeof result === 'string' || !result.buffer || !result.init || !result.headers) {
						return result;
				}
				const { buffer, init, headers } = result;
				const _headers = new Headers();
				(headers || []).forEach((a) => _headers.append(...a));
				const _init = {
						status: init.status,
						statusText: init.statusText || '',
						headers: _headers
				};
				if (options._format === 'arraybuffer') {
						return { buffer, init, headers };
				}
				return new Response(buffer, _init);
		}
		async configBridge(config) {
				const keys = config.getKeys();
				if (this._configListener) {
						this._config.off('update', this._configListener);
						this._configListener = null;
				}
				this._config = config;
				const configData = await this._postMessage({
						command: 'dumpConfig',
						params: { keys, url: '', prefix: PRODUCT }
				});
				for (const key of Object.keys(configData)) {
						config.props[key] = configData[key];
				}
				if (!this.constructor.hostReg.test(location.host) &&
						!config.props.allowOtherDomain) {
						return;
				}
				if (this._disposed) {
						return;
				}
				this._configListener = (key, value) => {
						if (key === 'autoCloseFullScreen') {
								return;
						}
						this._postMessage({ command: 'saveConfig', params: { key, value, prefix: PRODUCT } }, false).catch(() => { });
				};
				config.on('update', this._configListener);
		}
		async _postMessage(body, usePromise = true, sessionId = '', control = {}) {
				const { signal } = control;
				const abortReason = () => signal.reason !== undefined ? signal.reason :
						Object.assign(new Error('Aborted'), { name: 'AbortError' });
				if (signal && signal.aborted) {
						throw abortReason();
				}
				const pending = this._initializeFrame();
				const generation = this._generation;
				await this._waitForInitialize(pending, signal);
				if (signal && signal.aborted) {
						throw abortReason();
				}
				if (this._disposed || generation !== this._generation ||
						(control.generation !== undefined && control.generation !== generation)) {
						throw new Error('Gate disconnected before send');
				}
				sessionId = sessionId || (`gate:${Math.random()}`);
				const params = body.params || {};
				if (!usePromise) {
						this.port.postMessage({ body, sessionId, token: TOKEN }, params.transfer);
						return;
				}
				if (this._sessions[sessionId]) {
						throw new Error('Duplicate gate session');
				}
				const session = new PromiseHandler();
				const timeout = Number.isFinite(control.timeout) && control.timeout > 0 ?
						Math.min(control.timeout + 1000, 2147483647) : 60000;
				const timer = setTimeout(() => this._settleSession(sessionId, Object.assign(new Error('Gate request timeout'), { status: 'timeout' })), timeout);
				const onAbort = () => this._settleSession(sessionId, abortReason());
				session.command = body.command;
				session.cleanup = () => {
						clearTimeout(timer);
						if (signal) {
								signal.removeEventListener('abort', onAbort);
						}
				};
				this._sessions[sessionId] = session;
				if (signal) {
						signal.addEventListener('abort', onAbort, { once: true });
				}
				try {
						this.port.postMessage({ body, sessionId, token: TOKEN }, params.transfer);
				}
				catch (error) {
						this._settleSession(sessionId, error);
				}
				const result = await session;
				if (this._disposed || generation !== this._generation) {
						throw new Error('Gate disconnected after reply');
				}
				return result;
		}
		postMessage(body, promise = true) {
				return this._postMessage(body, promise);
		}
		sendMessage(body, usePromise = false, sessionId = '') {
				return this._postMessage({ command: 'message', params: body }, usePromise, sessionId);
		}
		pushHistory(path, title) {
				return this._postMessage({ command: 'pushHistory', params: { path, title } }, false);
		}
		async bridgeDb({ name, ver, stores }) {
				const worker = await this._postMessage({ command: 'bridge-db', params: { command: 'open', params: { name, ver, stores } } });
				let dbGeneration = this._generation;
				let reopening;
				const post = async (command, data, storeName, transfer) => {
						await this._initializeFrame();
						const generation = this._generation;
						if (dbGeneration !== generation) {
								if (!reopening || reopening.generation !== generation) {
										const promise = this._postMessage({ command: 'bridge-db', params: { command: 'open', params: { name, ver, stores } } }, true, '', { generation }).then(() => { dbGeneration = generation; });
										reopening = { generation, promise };
										promise.catch(() => { if (reopening && reopening.promise === promise) {
												reopening = null;
										} });
								}
								await reopening.promise;
						}
						const params = { data, storeName, transfer, name };
						return this._postMessage({ command: 'bridge-db', params: { command, params, transfer } }, true, '', { generation });
				};
				const result = { worker };
				for (const meta of stores) {
						const storeName = meta.name;
						result[storeName] = (storeName => {
								return {
										close: (params) => post('close', params, storeName),
										put: (record, transfer) => post('put', record, storeName, transfer),
										update: (data) => post('update', data, storeName),
										get: ({ key, index, timeout }) => post('get', { key, index, timeout }, storeName),
										updateTime: ({ key, index, timeout }) => post('updateTime', { key, index, timeout }, storeName),
										delete: ({ key, index, timeout }) => post('delete', { key, index, timeout }, storeName),
										gc: (expireTime = 30 * 24 * 60 * 60 * 1000, index = 'updatedAt') => post('gc', { expireTime, index }, storeName)
								};
						})(storeName);
				}
				return result;
		}
}

    const CsrfTokenLoader = (() => {
      const cacheStorage = new CacheStorage(
        location.host === 'www.nicovideo.jp' ? localStorage : sessionStorage);
      const TIMEOUT = 10 * 1000;
      const CACHE_EXPIRE_TIME = 60 * 30 * 1000;

      class CsrfTokenLoader {
        static load() {
          return new Promise((resolve, reject) => {
            const cache = cacheStorage.getItem('csrfToken');
            if (cacheStorage.getItem('csrfToken')) {
              return resolve(cache);
            }

            let timeoutTimer = window.setTimeout(() => {
              reject('timeout');
            }, TIMEOUT);

            return CsrfTokenLoader._getToken().then((token) => {
              window.clearTimeout(timeoutTimer);
              CsrfTokenLoader.saveToCache(token);
              resolve(token);
            }, (error) => {
              window.clearTimeout(timeoutTimer);
              reject(error);
            });
          });
        }

        static saveToCache(token) {
          cacheStorage.setItem('csrfToken', token, CACHE_EXPIRE_TIME);
        }

        static _getToken() {
          const url = 'https://www.nicovideo.jp/mylist_add/video/sm9';
          const tokenReg = /NicoAPI\.token *= *["']([a-z0-9-]+)["'];/;
          let m;
          return fetch(url, { credentials: 'include', _format: 'text'})
            .then(res => res.text())
            .then(result => {
            if ((m = tokenReg.exec(result))) {
              const token = m[1];
              return Promise.resolve(token);
            } else {
              return Promise.reject('token parse error');
            }
          });
        }
      }

      util.emitter.on('csrfToken', (token) => {
        CsrfTokenLoader.saveToCache(token);
      });

      return CsrfTokenLoader;
    })();

    MylistPocket.debug.CsrfTokenLoader = CsrfTokenLoader;

const OwnerSupplement = (() => {
		const BLANK_ICON = 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg';
		const loadFromNicoad = async (videoId) => {
				const net = (typeof netUtil !== 'undefined') ? netUtil :
						{ fetch: (u, o) => fetch(u, o) };
				const res = await net.fetch(`https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}`, { credentials: 'omit', timeout: 5000 });
				if (!res || !res.ok) {
						return null;
				}
				const json = await res.json();
				const d = json && json.data;
				const data = d;
				if (!data || String(data.id) !== String(videoId) || !data.ownerId) {
						return null;
				}
				return { id: String(data.ownerId), name: data.ownerName || '', icon: data.ownerIcon || '' };
		};
		const supplementThumbInfo = async (thumbInfo) => {
				if (!thumbInfo || thumbInfo.status !== 'ok' || thumbInfo.owner) {
						return thumbInfo;
				}
				const videoId = thumbInfo.videoId || thumbInfo.id;
				let found = null;
				if (videoId && !thumbInfo.isChannel && /^(sm|nm)\d+$/.test(videoId)) {
						try {
								found = await loadFromNicoad(videoId);
						}
						catch (e) {
								window.console.warn('投稿者情報の補完に失敗', videoId, e);
						}
				}
				if (found) {
						thumbInfo.owner = {
								type: 'user',
								id: found.id,
								linkId: `user/${found.id}`,
								name: found.name || '(非公開ユーザー)',
								url: `https://www.nicovideo.jp/user/${found.id}`,
								icon: (found.icon || BLANK_ICON).replace(/^http:/, 'https:'),
								isSupplemented: true
						};
				}
				else {
						thumbInfo.owner = {
								type: thumbInfo.isChannel ? 'channel' : 'user',
								id: '',
								linkId: '',
								name: '(投稿者情報なし)',
								url: '#',
								icon: BLANK_ICON,
								isSupplemented: true
						};
				}
				return thumbInfo;
		};
		return { supplementThumbInfo, loadFromNicoad };
})();
    const ThumbInfoLoader = (() => {
      const BASE_URL = 'https://ext.nicovideo.jp/';
      const MESSAGE_ORIGIN = 'https://ext.nicovideo.jp/';
      const CACHE_EXPIRE_TIME = 60 * 60 * 1000;
      //const CACHE_EXPIRE_TIME = 60 * 1000;
      let gate = null;
      let cacheStorage = new CacheStorage(sessionStorage, true);
      let failedResult = {};

      class ThumbInfoLoader {

        constructor() {
          this._emitter = new Emitter();

          gate = new CrossDomainGate({
            baseUrl: BASE_URL,
            origin: MESSAGE_ORIGIN,
            type: 'thumbInfo',
            messager: WindowMessageEmitter
          });
        }

        _onMessage(data, type) {
          if (type !== 'videoInfoLoader') { return; }
          const info = data.message;

          this.emit('load', info, 'THUMB_WATCH');
        }

        _parseXml(xmlText) {
          return parseThumbInfo(xmlText);
        }

        async load(watchId, options = {}) {
          const cacheKey = `thumbInfo_${watchId}`;
          const cache = cacheStorage.getItem(cacheKey);

          if (failedResult[`${watchId}`]) {
            return Promise.reject({data: failedResult[`${watchId}`], watchId});
          }
          if (cache) {
            // 修正前にキャッシュされた投稿者情報の無いデータにも補完を適用する
            return OwnerSupplement.supplementThumbInfo(cache);
          }

          const thumbInfo =
            await gate.fetch(`${BASE_URL}api/getthumbinfo/${watchId}`, options)
              .catch(e => { return {status: 'fail', message: e.message || `gate.fetch('${watchId}') failed` }; });
          thumbInfo.fromCache = !!cache;
          if (thumbInfo.status !== 'ok') {
            failedResult[`${watchId}`] = thumbInfo;
            return Promise.reject(thumbInfo);
          }
          // Task 069: 投稿者が退会・非公開扱い等の動画は getthumbinfo に user_id 等が無く、
          // 表示処理（投稿者アイコンの src 設定）で例外になって「読み込み中」のまま
          // 終わらなかった。広告APIから投稿者ID・名前を補い、補えなくても表示できる形にする。
          await OwnerSupplement.supplementThumbInfo(thumbInfo);
          cacheStorage.setItem(cacheKey, thumbInfo, CACHE_EXPIRE_TIME);
          return thumbInfo;
        }
      }

      const loader = new ThumbInfoLoader();
      return {
        load: watchId => loader.load(watchId),
        loadOwnerInfo: async watchId => {
          const info = await loader.load(watchId);
          const owner = info.owner;
          if (!owner) {
            return {};
          }

          const lang = util.getPageLanguage();
          const prefix = owner.type === 'user' ? '投稿者: ' : '提供: ';
          const suffix =
            (owner.type === 'user' && lang.startsWith('ja')) ? ' さん' : '';
          owner.linkId =
            owner.id ?
              (owner.type === 'user' ? `user/${owner.id}` : `ch${owner.id}`) :
              '';
          owner.localeName = `${prefix}${owner.name}${suffix}`;
          return owner;
        }
      };

    })();

    MylistPocket.debug.ThumbInfoLoader = ThumbInfoLoader;

const emitter = util.emitter;
const MylistApiLoader = (() => {
		const CACHE_EXPIRE_TIME = 5 * 60 * 1000;
		const TOKEN_EXPIRE_TIME = 59 * 60 * 1000;
		const createMylistError = (message, { status = 'fail', result, code, cause } = {}) => {
				const error = new Error(message);
				error.status = status;
				if (result !== undefined) {
						error.result = result;
				}
				if (code !== undefined) {
						error.code = code;
				}
				if (cause !== undefined) {
						error.cause = cause;
				}
				return error;
		};
		let cacheStorage = null;
		let token = '';
		if (window.ZenzaWatch) {
				emitter.on('csrfTokenUpdate', (t) => {
						token = t;
						if (cacheStorage) {
								cacheStorage.setItem('csrfToken', token, TOKEN_EXPIRE_TIME);
						}
				});
		}
		class MylistApiLoader {
				constructor() {
						if (!cacheStorage) {
								cacheStorage = new CacheStorage(sessionStorage);
						}
						if (!token) {
								token = cacheStorage.getItem('csrfToken');
								if (token) {
										console.log('cached token exists'); // Task 088: トークンの値はログに出さない
								}
						}
				}
				setCsrfToken(t) {
						token = t;
						if (cacheStorage) {
								cacheStorage.setItem('csrfToken', token, TOKEN_EXPIRE_TIME);
						}
						else {
								cacheStorage = new CacheStorage(sessionStorage);
								cacheStorage.setItem('csrfToken', token, TOKEN_EXPIRE_TIME);
						}
				}
				async _getCsrfToken() {
						if (!cacheStorage) {
								cacheStorage = new CacheStorage(sessionStorage);
						}
						token = cacheStorage.getItem('csrfToken');
						if (token) {
								console.log('cached token exists'); // Task 088: トークンの値はログに出さない
						}
						else {
								const tokenUrl = 'https://www.nicovideo.jp/my/mylist';
								const result = await netUtil.fetch(tokenUrl, {
										credentials: 'include'
								}).then((r) => r.text()).catch((result) => {
										throw new Error('マイリストトークン取得失敗', { result, status: 'fail' });
								});
								const dom = new DOMParser().parseFromString(result, 'text/html');
								const initUserpageDataContena = dom.querySelector('#js-initial-userpage-data');
								const env = JSON.parse(initUserpageDataContena.getAttribute('data-environment'));
								this.setCsrfToken(env.csrfToken);
						}
						return token;
				}
				async _getDeflistItems(frontendId = 6, frontendVersion = 0) {
						const url = 'https://nvapi.nicovideo.jp/v1/users/me/watch-later?sortKey=addedAt&sortOrder=desc';
						const page = new URLSearchParams({ pageSize: 100, page: 1 });
						let data;
						do {
								const res = await netUtil.fetch(`${url}&${page.toString()}`, {
										headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion },
										credentials: 'include'
								}).then((r) => r.json())
										.catch((e) => { throw createMylistError('あとで見るの取得失敗(2)', { result: e, cause: e }); });
								if (res.meta.status !== 200 || !res.data.watchLater) {
										throw createMylistError('あとで見るの取得失敗(1)', { result: res, code: res?.error?.code });
								}
								if (data == null) {
										data = res.data.watchLater;
								}
								else {
										data.hasInvisibleItems = data.hasInvisibleItems || res.data.watchLater.hasInvisibleItems;
										data.hasNext = res.data.watchLater.hasNext;
										data.items = data.items.concat(res.data.watchLater.items);
								}
								page.set('page', String(parseInt(page.get('page')) + 1));
						} while (data && data.hasNext);
						return data.items;
				}
				async _getMylistItems(id, frontendId = 6, frontendVersion = 0) {
						const url = `https://nvapi.nicovideo.jp/v1/users/me/mylists/${id}`;
						const page = new URLSearchParams({ pageSize: 100, page: 1 });
						let data;
						do {
								const res = await netUtil.fetch(`${url}?${page.toString()}`, {
										headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion },
										credentials: 'include'
								}).then((r) => r.json())
										.catch((e) => { throw createMylistError('マイリスト取得失敗(2)', { result: e, cause: e }); });
								if (res.meta.status !== 200 || !res.data.mylist) {
										throw createMylistError('マイリスト取得失敗(1)', { result: res, code: res?.error?.code });
								}
								if (data == null) {
										data = res.data.mylist;
								}
								else {
										data.hasInvisibleItems = data.hasInvisibleItems || res.data.mylist.hasInvisibleItems;
										data.hasNext = res.data.mylist.hasNext;
										data.items = data.items.concat(res.data.mylist.items);
								}
								page.set('page', String(parseInt(page.get('page')) + 1));
						} while (data && data.hasNext);
						return data.items;
				}
				async getMylistList({ frontendId = 6, frontendVersion = 0 } = {}) {
						const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists';
						const cacheKey = 'mylistList';
						const cacheData = cacheStorage.getItem(cacheKey);
						if (cacheData) {
								return cacheData;
						}
						const result = await netUtil.fetch(url, {
								headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion },
								credentials: 'include'
						}).then((r) => r.json())
								.catch((e) => { throw createMylistError('マイリスト一覧の取得失敗(2)', { result: e, cause: e }); });
						if (result.meta.status !== 200 || !result.data.mylists) {
								throw createMylistError(`マイリスト一覧の取得失敗(1) ${result.status}${result.message}`, { result, code: result?.error?.code });
						}
						const data = result.data.mylists;
						cacheStorage.setItem(cacheKey, data, CACHE_EXPIRE_TIME);
						return data;
				}
				async findDeflistItemByWatchId(watchId) {
						const items = await this._getDeflistItems();
						for (let item of items) {
								if (item.watchId === watchId) {
										return item;
								}
						}
						throw createMylistError('動画が見つかりません', {
								status: 'not_found',
								code: 'NOT_FOUND',
								result: { watchId, list: 'watchLater' }
						});
				}
				async findMylistItemByWatchId(watchId, groupId) {
						const items = await this._getMylistItems(groupId);
						for (let item of items) {
								if (item.watchId === watchId) {
										return item;
								}
						}
						throw createMylistError('動画が見つかりません', {
								status: 'not_found',
								code: 'NOT_FOUND',
								result: { watchId, groupId, list: 'mylist' }
						});
				}
				async removeDeflistItem(watchId, { frontendId = 6, frontendVersion = 0 } = {}) {
						const item = await this.findDeflistItemByWatchId(watchId);
						const body = `itemIds=${item.itemId}`;
						const url = 'https://nvapi.nicovideo.jp/v1/users/me/watch-later?' + body;
						const cacheKey = 'deflistItems';
						const result = await netUtil.fetch(url, {
								method: 'DELETE',
								headers: {
										'X-Frontend-Id': frontendId,
										'X-Frontend-Version': frontendVersion,
										'X-Request-With': 'https://www.nicovideo.jp'
								},
								credentials: 'include'
						}).then((r) => r.json())
								.catch((result) => {
								throw createMylistError('あとで見るから削除失敗(2)', { result, cause: result });
						});
						if (result.meta.status && result.meta.status === 200) {
								cacheStorage.removeItem(cacheKey);
								emitter.emitAsync('deflistRemove', watchId);
								return {
										status: 'ok',
										result,
										message: 'あとで見るから削除'
								};
						}
						throw createMylistError(result.error.description, {
								result, code: result.error.code
						});
				}
				async removeMylistItem(watchId, groupId, { frontendId = 6, frontendVersion = 0 } = {}) {
						const item = await this.findMylistItemByWatchId(watchId, groupId);
						let body = 'itemIds=' + item.itemId;
						const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists/' + groupId + '/items?' + body;
						const cacheKey = `mylistItems: ${groupId}`;
						const result = await netUtil.fetch(url, {
								method: 'DELETE',
								headers: {
										'X-Frontend-Id': frontendId,
										'X-Frontend-Version': frontendVersion,
										'X-Request-With': 'https://www.nicovideo.jp'
								},
								credentials: 'include'
						}).then((r) => r.json())
								.catch((result) => {
								throw createMylistError('マイリストから削除失敗(2)', { result, cause: result });
						});
						if (result.meta.status && result.meta.status === 200) {
								cacheStorage.removeItem(cacheKey);
								emitter.emitAsync('mylistRemove', watchId, groupId);
								return {
										status: 'ok',
										result,
										message: 'マイリストから削除'
								};
						}
						throw createMylistError(result.error.description, {
								result,
								code: result.error.code
						});
				}
				async addDeflistItem(watchId, description, isRetry = false, { frontendId = 6, frontendVersion = 0 } = {}) {
						let url = 'https://nvapi.nicovideo.jp/v1/users/me/watch-later';
						let body = `watchId=${watchId}&memo=`;
						if (description) {
								body += `${encodeURIComponent(description)}`;
						}
						let cacheKey = 'deflistItems';
						const result = await netUtil.fetch(url, {
								method: 'POST',
								body,
								headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion, 'X-Request-With': 'https://www.nicovideo.jp' },
								credentials: 'include'
						}).then((r) => r.json())
								.catch((err) => {
								throw createMylistError('あとで見る登録失敗(200)', {
										result: err,
										cause: err
								});
						});
						if (result.meta.status && (result.meta.status === 200 || result.meta.status === 201)) {
								cacheStorage.removeItem(cacheKey);
								emitter.emitAsync('deflistAdd', watchId, description);
								return {
										status: 'ok',
										result,
										message: 'あとで見る登録'
								};
						}
						if (result.meta.status && result.meta.status === 409 && !isRetry) {
								await this.removeDeflistItem(watchId).catch((err) => {
										throw createMylistError('あとで見る登録失敗(101)', {
												result: err.result,
												code: err.code,
												cause: err
										});
								});
								const added = await this.addDeflistItem(watchId, description, true, { frontendId, frontendVersion });
								return {
										status: 'ok',
										result: added,
										message: 'あとで見るの先頭に移動'
								};
						}
						if (!result.meta.status || !result.error) { // result.errorが残っているかは不明
								throw createMylistError('あとで見る登録失敗(100)', {
										result
								});
						}
						throw createMylistError(result.error.description, {
								result,
								code: result.error.code
						});
				}
				async addMylistItem(watchId, groupId, description, { frontendId = 6, frontendVersion = 0 } = {}) {
						let body = 'itemId=' + watchId + '&description='; //+ '&token=' + token + '&group_id=' + groupId;
						if (description) {
								body += encodeURIComponent(description);
						}
						const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists/' + groupId + '/items?' + body;
						const cacheKey = `mylistItems: ${groupId}`;
						const result = await netUtil.fetch(url, {
								method: 'POST',
								body,
								headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion, 'X-Request-With': 'https://www.nicovideo.jp' },
								credentials: 'include'
						}).then((r) => r.json())
								.catch((err) => {
								throw createMylistError('マイリスト登録失敗(200)', {
										result: err,
										cause: err
								});
						});
						if (result.meta.status && (result.meta.status === 200 || result.meta.status === 201)) {
								cacheStorage.removeItem(cacheKey);
								this.removeDeflistItem(watchId).catch(() => { });
								return { status: 'ok', result, message: 'マイリスト登録' };
						}
						if (!result.meta.status /*|| !result.error*/) {
								throw createMylistError('マイリスト登録失敗(100)', { result });
						}
						emitter.emitAsync('mylistAdd', watchId, groupId, description);
						throw createMylistError(result.error.description, {
								result, code: result.error.code
						});
				}
		}
		return new MylistApiLoader();
})();


    class HoverMenu extends Emitter {
      constructor() {
        super();
        this._init();
      }

      _init() {
        this._view = document.querySelector('.mylistPocketHoverMenu');

        this._view.addEventListener(location.host.includes('google') ? 'mouseup' : 'click', this._onClick.bind(this));
        this._view.addEventListener('mousedown', this._onMousedown.bind(this));
        this._view.addEventListener('contextmenu', this._onContextMenu.bind(this));

        this._onHoverEnd = bounce.time(this._onHoverEnd.bind(this), 500);
        document.body.addEventListener(
          'mouseover', this._onHover.bind(this), {passive: true});
        document.body.addEventListener(
          'mouseout',  this._onMouseout.bind(this), {passive: true});
        document.body.addEventListener(
          'mouseover', this._onHoverEnd, {passive: true});
        document.body.addEventListener(
          'click', () => { this.hide(); }, {passive: true});


        util.emitter.on('hideHover', () => this.hide());

        this._x = this._y = 0;

        ZenzaDetector.detect().then(ZenzaWatch => {
          this._isZenzaReady = true;
          this.addClass('is-zenzaReady');
          ZenzaWatch.emitter.on('DialogPlayerOpen', bounce.time(() => {
            this.hide();
          }, 1000));
        });

        this.toggleClass('is-otherDomain', location.host !== 'www.nicovideo.jp');
        this.toggleClass('is-guest', !util.isLogin());
        this._deflistButton = this._view.querySelector('.mylistPocketButton.deflist-add');
        MylistPocket.debug.hoverMenu = this._view;
      }

      toggleClass(className, v) {
        className.split(/ +/).forEach((c) => {
          this._view.classList.toggle(c, v);
        });
      }

      addClass(className)    { this.toggleClass(className, true); }
      removeClass(className) { this.toggleClass(className, false); }

      hide() {
        this.removeClass('is-show');
      }

      show() {
        this.addClass('is-show');
      }

      moveTo(x, y) {
        this._x = x;
        this._y = y;
        this._view.style.left = x + 'px';
        this._view.style.top  = y + 'px';
      }

      _onClick(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      _onContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      _onMousedown(e) {
        const watchId = this._watchId;
        const target = e.target.classList.contains('command') ?
          e.target : e.target.closest('.command');
        const command = target.getAttribute('data-command');
        e.preventDefault();
        e.stopPropagation();

        if (command === 'info') {
          this._videoInfo(watchId);
          this.hide();
        } else if (command === 'playlist-queue') {
          this.emit('playlist-queue', watchId, this);
        } else {
          if (e.button !== 0 || e.shiftKey) {
            this._deflistRemove(watchId);
          } else {
            this._deflist(watchId);
          }
        }
      }

      _videoInfo(watchId) {
        this.emit('info', watchId || this._watchId, this);
      }

      _deflist(watchId) {
        this.emit('deflist-add', watchId || this._watchId, this);
      }

      _deflistRemove(watchId) {
        this.emit('deflist-remove', watchId || this._watchId, this);
      }

      _onHover(e) {
        const target = this._isTargetElement(e);
        if (!target) { return; }

        this._hoverElement = target;
      }

      _onHoverEnd(e) {
        const target =
          e.target.tagName === 'A' ? e.target : e.target.closest('a');
        if (!target || this._hoverElement !== target) { return; }
        // Task 092: data-href・href・Google のリダイレクト用リンクから、最終的なリンク先の動画を解決する
        const ref = util.resolveNicoVideoLink(target);
        if (!ref) { return; }
        const watchId = target.dataset.nicoVideoId || ref.watchId;
        const offset = target.getBoundingClientRect();
        //const bodyOffset = document.body.getBoundingClientRect();
        const scrollTop  = document.documentElement.scrollTop  || document.body.scrollTop  || 0;
        const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft || 0;
        const left = offset.left + scrollLeft;
        const top  = offset.top  + scrollTop;

        if (target.classList.contains('noHoverMenu')) { return; }
        if (!watchId || !watchId.match(/^[a-z0-9]+$/)) { return; }
        if (watchId.indexOf('lv') === 0) { return; }

        this._watchId = watchId;
        this.show();
        this.moveTo(
          left + target.offsetWidth  - this._view.offsetWidth / 2,
          top  + target.offsetHeight / 2 - this._view.offsetHeight / 2
        );
      }

      _onMouseout(e) {
        const target = this._isTargetElement(e);
        if (!target) { return; }

        if (this._hoverElement === e.target) {
          this._hoverElement = null;
        }
      }

      _isTargetElement(e) {
        const target =
          e.target.tagName === 'A' ? e.target : e.target.closest('a');
        if (!target) { return false; }
        // Task 092: 以前は href の文字列のどこかに watch/〜・shorts/〜・nico.ms/〜 があれば対象にしていた
        // （Google の検索リンクの q= の中などでも当たる）。リンク先のホストとパスで判定する
        return util.resolveNicoVideoLink(target) ? target : false;
      }

      set isBusy(v) {
        this._isBusy = v;
        this.toggleClass('is-busy', v);
      }

      get isBusy() {
        return !!this._isBusy;
      }

      notifyBeginDeflistUpdate(/*watchId*/) {
        this.addClass('is-deflistUpdating');
      }

      notifyEndDeflistUpdate(result) {
        this.addClass('is-deflistSuccess');
        window.setTimeout(() => { this.removeClass('is-deflistSuccess'); }, 3000);

        this._deflistButton.setAttribute('data-result', result.message || '登録しました');
        this.removeClass('is-deflistUpdating');
      }

      notifyFailDeflistUpdate(result) {
        this.addClass('is-deflistFail');
        window.setTimeout(() => { this.removeClass('is-deflistFail'); }, 3000);

        this._deflistButton.setAttribute('data-result', result.message || '登録失敗');
        this.removeClass('is-deflistUpdating');
      }
    }


    class VideoInfoView extends Emitter {
      constructor({host, tpl}) {
        super();
        this._host = host;
        this._tpl = tpl;
        this._slot = {};

        this._baseConfig = config;
        this._config    = config.namespace('videoInfo');
        this._mylistConfig = config.namespace('mylist');
        const ngConfig  = this._ngConfig  = config.namespace('ng');
        const favConfig = this._favConfig = config.namespace('fav');
        this._nicoadConfig = config.namespace('nicoad');

        const {ngChecker, favChecker} = initNgChecker({ngConfig, favConfig});
        this._ngChecker  = ngChecker;
        this._favChecker = favChecker;
      }

      _initialize() {
        if (this._isInitialized) { return; }
        const host = this._host;
        const tpl = this._tpl;

        this._shadowRoot = util.attachShadowDom({host, tpl});
        Array.prototype.forEach.call(this._host.querySelectorAll('*'), (elm) => {
          //this._host.querySelectorAll('*').forEach((elm) => {
          const slot = elm.getAttribute('slot');
          if (!slot) { return; }
          //const type = elm.getAttribute('data-type') || 'string';
          this._slot[slot] = elm;
        });

        this._rootDom = this._shadowRoot.querySelector('.root');
        this._hostDom = this._host;

        this._rootDom.addEventListener('mousedown', e => { e.stopPropagation(); });
        this._shadowRoot.addEventListener('mousedown', e => { e.stopPropagation(); });
        this._rootDom.querySelector('.setting-panel-main').addEventListener('click', e => {
          e.stopPropagation();
        });

        this._initSettingPanel();

        const updateNgEnable = v => { this.toggleClass('is-ng-enable', v); };
        updateNgEnable(this._ngConfig.props.enable);
        this._ngConfig.onkey('enable', updateNgEnable);

        this._rootDom.addEventListener('click', this._onClick.bind(this));

        this._boundOnBodyMouseDown = this._onBodyMouseDown.bind(this);

        MylistPocket.debug.view = this;

        util.emitter.on('hideHover', () => {
          this.hide();
        });

        const debUpdateFavNg = bounce.time(this._updateFavNg.bind(this), 100);
        this._ngConfig    .on('update', debUpdateFavNg);
        this._favConfig   .on('update', debUpdateFavNg);
        //this._mylistConfig.on('update', debUpdateFavNg);

        ZenzaDetector.detect().then(() => {
          this._isZenzaReady = true;
          this.addClass('is-zenzaReady');
          // Card metadata can arrive before ZenzaWatch is ready; preserve
          // existing DOM and upgrade its native links as soon as it is.
          PocketDescriptionCard.enableZenzaLinks(this._hostDom);
          window.ZenzaWatch.emitter.on('DialogPlayerOpen', bounce.time(() => {
            this.hide();
          }, 1000));
        });

        this._videoInfoArea = this._rootDom.querySelector('.video-info');
        this._deflistButton =
          this._rootDom.querySelector('.mylistPocketButton.deflist-add');

        this.toggleClass('is-otherDomain', location.host !== 'www.nicovideo.jp');
        this.toggleClass('is-firefox', util.isFirefox());

        // Task 079: 念のため、連携部品がまだ無い時は飛ばす（初期化の失敗で
        // 情報パネル全体が開けなくなるのを防ぐ）。
        // The old description used a.videoLink. Task950 now replaces each
        // linked video with one .mpp-video-card, so keep the optional NG/fav
        // observer attached to both representations (one match per video).
        MylistPocket.external && MylistPocket.external.observe({
          query: 'a.videoLink, .mpp-video-card',
          container: this._hostDom.querySelector('.description'),
        });

        this._isInitialized = true;
      }

      _initSettingPanel() {
        const onSettingFormChange = this._onSettingFormChange.bind(this);

        const refresh = () => {
          Array.from(this._rootDom.querySelectorAll('.setting-form')).forEach(elm => {
            const name = elm.getAttribute('data-config-name');
            if (!name) { return; }
            const namespace = elm.getAttribute('data-config-namespace') || '';
            let config = this._config;
            switch (namespace) {
              case 'ng':
                config = this._ngConfig;
                break;
              case 'fav':
                config = this._favConfig;
                break;
              case 'mylist':
                config = this._mylistConfig;
                break;
              case 'nicoad':
                config = this._nicoadConfig;
                break;
              default:
                config = this._baseConfig;
            }
            const tagName = (elm.tagName.toLowerCase()).toLowerCase();
            if (tagName === 'input') {
              const type = (elm.type || '').toLowerCase();
              switch (type) {
                case 'checkbox':
                  elm.checked = !!config.props[name];
                  break;
                default:
                  elm.value   = config.props[name];
                  break;
              }
            } else if (tagName === 'select' || tagName === 'textarea') {
              elm.value = config.props[name];
            }

            elm.removeEventListener('change', onSettingFormChange);
            elm.addEventListener('change', onSettingFormChange);
          });
        };

        const onUpdate = bounce.time(refresh, 100);

        const syncZenza = bounce.time(() => {
          if (!this._ngConfig.props.syncZenza || !this._isZenzaReady) { return; }
          window.ZenzaWatch.config.setValue('videoTagFilter', this._ngConfig.props.tag);
          window.ZenzaWatch.config.setValue('videoOwnerFilter', this._ngConfig.props.owner);
        }, 1000);

        refresh();

        this._config.on('update',  onUpdate);
        this._favConfig.on('update', onUpdate);
        this._ngConfig.on('update', () => {
          onUpdate();
          syncZenza();
        });

      }

      _onSettingFormChange(e) {
        const elm = e.target;
        const name = elm.getAttribute('data-config-name');
        if (!name) { return; }
        const namespace = elm.getAttribute('data-config-namespace') || '';
        let config = this._config;
        switch (namespace) {
          case 'ng':
            config = this._ngConfig;
            break;
          case 'fav':
            config = this._favConfig;
            break;
          case 'mylist':
            config = this._mylistConfig;
            break;
          case 'nicoad':
            config = this._nicoadConfig;
            break;
          default:
            config = this._baseConfig;
        }

        const tagName = (elm.tagName.toLowerCase()).toLowerCase();
        if (tagName === 'input') {
          const type = (elm.type || '').toLowerCase();
          switch (type) {
            case 'checkbox':
              config.props[name] = elm.checked;
              break;
            default:
              config.props[name] = elm.value;
              break;
          }
        } else if (tagName === 'select' || tagName === 'textarea') {
          config.props[name] = elm.value;
        }
      }

      toggleClass(className, v) {
        className.split(/ +/).forEach((c) => {
          this._rootDom.classList.toggle(c, v);
          this._hostDom.classList.toggle(c, v);
        });
      }

      addClass(className)    { this.toggleClass(className, true); }
      removeClass(className) { this.toggleClass(className, false); }

      bind(videoInfo) {
        this._videoInfo = videoInfo;
        if (videoInfo.status === 'ok') {
          this._bindSuccess(videoInfo);
        } else {
          this._bindFail(videoInfo);
        }
        window.setTimeout(() => {
          this.removeClass('is-loading');
        }, 0);
      }

      _onClick(e) {
        const t = e.target;
        const elm =
          t.classList.contains('command') ?
            t : e.target.closest('.command');
        if (!elm) { return; }

        // 簡易 throttle
        if (elm.classList.contains('is-active')) { return; }
        elm.classList.add('is-active');
        window.setTimeout(() => { elm.classList.remove('is-active'); }, 500);

        e.preventDefault();
        e.stopPropagation();
        const command = elm.getAttribute('data-command');
        const param   = elm.getAttribute('data-param');
        switch (command) {
          case 'toggle-setting':
            this.toggleSettingPanel();
            break;
          case 'add-ng-tag':    case 'add-fav-tag':
          case 'toggle-ng-tag': case 'toggle-fav-tag': {
              const tag = elm.getAttribute('data-tag') || '';
              if (!tag) { break; }
              this.emit('command', command, {
                watchId: this._videoInfo.watchId,
                value: tag
              }, this);
            }
            break;
          case 'add-ng-owner':    case 'add-fav-owner':
          case 'toggle-ng-owner': case 'toggle-fav-owner': {
              let owner =
                (this._videoInfo.isChannel ? 'ch' : '') +
                 this._videoInfo.ownerId + '#' + this._videoInfo.ownerName;
              this.emit('command', command, {
                watchId: this._videoInfo.watchId,
                value: owner
              }, this);
            }
            break;
          case 'mylist-comment-open':
            this.emit('command', command, this._videoInfo.watchId);
            break;
          case 'close':
            this.hide();
            break;
           default:
            this.emit('command', command, param, this);
        }
      }

      _updateFavNg() {
        if (!this._isInitialized) { return; }
        if (!this._videoInfo  || this._videoInfo.status !== 'ok') { return; }

        const videoInfo = this._videoInfo;
        const ownerInfo = this._rootDom.querySelector('.owner-info');
        ownerInfo.classList.toggle('is-favorited',
          this._favChecker.isMatchOwner(videoInfo.owner));
        ownerInfo.classList.toggle('is-ng',
          this._ngChecker .isMatchOwner(videoInfo.owner));

        Array.prototype.forEach.call(
          this._rootDom.querySelectorAll('.tag-container'),
          (elm) => {
            const tag = elm.getAttribute('data-tag');
            elm.classList.toggle('is-favorited', this._favChecker.isMatchTag(tag));
            elm.classList.toggle('is-ng',        this._ngChecker.isMatchTag(tag));
          });
      }

      toggleSettingPanel() {
        this.toggleClass('is-setting');
      }

      _onBodyMouseDown() {
        document.body.removeEventListener('mousedown', this._boundOnBodyMouseDown);
        this.hide();
      }

      reset() {
        this._descriptionCardsGeneration = (this._descriptionCardsGeneration || 0) + 1;
        this._initialize();
        window.setTimeout(() => { this._videoInfoArea.scrollTop = 0; }, 0);
        this.removeClass('noclip');
        this.addClass('is-loading');
      }

      show() {
        this.addClass('show');
        document.body.addEventListener('mousedown', this._boundOnBodyMouseDown);
      }

      hide() {
        this._descriptionCardsGeneration = (this._descriptionCardsGeneration || 0) + 1;
        this._videoInfoArea.scrollTop = 0;
        this.removeClass('show is-ok is-fail noclip is-setting');
      }

      _bindSuccess(videoInfo) {
        const toCamel = p => {
          return p.replace(/-./g, s => { return s.charAt(1).toUpperCase(); });
        };

        Object.keys(this._slot).forEach((key) => {
          const camelKey = toCamel(key);
          const data = videoInfo[camelKey];

          const elm = this._slot[key];
          const type = elm.getAttribute('data-type') || 'string';
          switch (type) {
            case 'html':
              this._createDescription(elm, data);
              break;
            case 'int': {
              let i = parseInt(data, 10);
              i = i.toLocaleString ? i.toLocaleString() : i;
              elm.textContent = i;
            }
              break;
            case 'link':
              elm.href = data;
              break;
            case 'image':
              // Task 069: data が無い場合に例外で表示処理全体が止まらないようにする
              elm.src = (data || 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg').replace('http:', 'https:');
              break;
            case 'date':
              elm.textContent = data.toLocaleString();
              break;
            default:
              elm.textContent = data;
          }
        });

        const df = document.createDocumentFragment();
        //Array.prototype.forEach.call(this._host.querySelectorAll('.tag'), t => { t.remove(); });
        videoInfo.tags.forEach(tag => {
          df.appendChild((this._createTagSlot(tag, videoInfo)));
        });
        const videoTags = this._rootDom.querySelector('.video-tags');
        videoTags.innerHTML = '';
        videoTags.appendChild(df);
        this._updateNicodicMarks(videoInfo.tags, videoTags);

        Array.prototype.forEach.call(this._rootDom.querySelectorAll('.command-watch-id'), elm => {
          elm.setAttribute('data-param', videoInfo.watchId);
        });
        Array.prototype.forEach.call(this._rootDom.querySelectorAll('.command-video-id'), elm => {
          elm.setAttribute('data-param', videoInfo.videoId);
        });

        const target = this._config.props.openNewWindow ? '_blank' : '_self';
        Array.prototype.forEach.call(
          this._host.querySelectorAll('.target-change'), elm => {
          elm.target = target;
          elm.rel = 'noopener';
        });

        this._updateFavNg();

        this.toggleClass('is-channel', videoInfo.isChannel);
        this.addClass('is-ok');
        this.removeClass('is-fail');
        window.setTimeout(() => { this.addClass('noclip'); }, 800);
      }

      _createDescription(elm, data) {
        // The description uses DOM links (Task092). Reuse the playlist-style
        // metadata layout, not the old hard-coded "video deleted" thumbnails.
        const generation = (this._descriptionCardsGeneration || 0) + 1;
        this._descriptionCardsGeneration = generation;
        const ownerVideoInfo = this._videoInfo;
        elm.textContent = '';
        elm.append(util.httpLinkFragment(data));
        const cards = [];
        for (const link of Array.from(elm.querySelectorAll('a.videoLink'))) {
          const ref = util.resolveNicoVideoLink(link);
          if (!ref) { continue; }
          const card = PocketDescriptionCard.make(
            document, ref.watchId, ref.canonicalUrl, link.textContent, this._isZenzaReady);
          if (!card) { continue; }
          link.replaceWith(card.root);
          cards.push(card);
        }
        // An old popup's response must never change a newer popup's cards.
        // Fetch only after a user opened information, max 3 thumb requests
        // concurrently; one existing NicoAd batch serves all successful cards.
        const isCurrent = () => generation === this._descriptionCardsGeneration &&
          this._videoInfo === ownerVideoInfo && elm.isConnected &&
          this._hostDom.classList.contains('show');
        PocketDescriptionCard.hydrate(cards, {
          loadInfo: id => ThumbInfoLoader.load(id),
          loadDecoration: ids => AdDecorationLoader.load(ids),
          loadExtra: id => PocketCardMetadataLoader.load(id),
          installImage: (image, thumbnail, owned, info) => PocketThumbnail.install(
            image, PocketThumbnail.legacyUrls(thumbnail,
              util.hasLargeThumbnail(info.videoId || info.id || '')), owned),
          isCurrent
        }).catch(error => window.console.warn('MylistPocket: 説明文カードの取得に失敗', error));
      }

      /**
       * Task 079b: タグの「？」を、大百科の記事があるタグだけ別の色にする。
       * ZenzaWatch本体のタグ欄（TagListView._updateNicodicIcons, Task 044〜047）と
       * 同じ仕組み。記事の有無は ZenzaWatch が公開している NicodicArticleLoader
       * （大百科の記事ページのHTTPステータスで判定・1日キャッシュ）に問い合わせ、
       * 分かったものから <zenza-tag-item-menu> の data-has-nicodic を書き換える
       * （この要素は属性の変化を拾って見た目を変える）。ZenzaWatch が無い時は何もしない。
       */
      _updateNicodicMarks(tags = [], container = null) {
        const loader = window.ZenzaWatch && window.ZenzaWatch.api &&
          window.ZenzaWatch.api.NicodicArticleLoader;
        if (!loader || !container || !tags.length) { return; }
        const generation = (this._nicodicGeneration = (this._nicodicGeneration || 0) + 1);
        const names = tags.map(tag => tag.text).filter(name => name);
        Promise.resolve(loader.checkAll(names, (name, hasDic) => {
          if (generation !== this._nicodicGeneration || !hasDic) { return; }
          for (const item of container.querySelectorAll('.tag-container')) {
            if (item.getAttribute('data-tag') !== name) { continue; }
            const menu = item.querySelector('.tagItemMenu');
            if (menu) { menu.dataset.hasNicodic = '1'; }
          }
        })).catch(e => window.console.warn('MylistPocket: 大百科の有無を調べられませんでした', e));
      }

      _bindFail(videoInfo) {
        this._slot['error-description'].textContent =
          `動画情報の取得に失敗しました (${videoInfo.description})`;
        this.addClass('is-fail');
        this.removeClass('is-ok');
      }


      _createTagSlot(tag, {isChannel, owner}) {
        const text = util.escapeHtml(tag.text);
        const lock = tag.isLocked ? 'is-locked' : '';
        const span = document.createElement('span');
        const ownerId = owner ? owner.id : '';

        const a = document.createElement('a');
        const target = this._config.props.openNewWindow ? '_blank' : '_self';
        a.textContent = tag.text;
        a.className = `tag ${lock}`;
        a.target    = target;
        a.rel       = 'noopener';
        a.href      = `https://www.nicovideo.jp/tag/${encodeURIComponent(text)}`;
        span.appendChild(a);

        if (isChannel) {
          const ch = document.createElement('a');
          const target = this._config.props.openNewWindow ? '_blank' : '_self';
          ch.textContent = '[ch]';
          ch.className = `tag ${lock} channel-search`;
          ch.target    = target;
          ch.rel       = 'noopener';
          ch.title     = 'チャンネル検索';
          //ch.href      = `http://ch.nicovideo.jp/search/${encodeURIComponent(text)}?channel_id=ch${ownerId}&type=video&mode=t`;
          ch.href      = `https://ch.nicovideo.jp/search/${encodeURIComponent(text)}?type=video&mode=t`;
          span.appendChild(ch);
        }

        const fav = document.createElement('button');
        fav.className = 'add-fav-button command';
        fav.setAttribute('data-command', 'toggle-fav-tag');
        fav.setAttribute('data-tag', tag.text);
        fav.innerHTML = '★'; //'&#8416;'; // &#x2716;
        span.appendChild(fav);

        const bt = document.createElement('button');
        bt.className = 'add-ng-button command';
        bt.setAttribute('data-command', 'toggle-ng-tag');
        bt.setAttribute('data-tag', tag.text);
        bt.innerHTML = '&#x2716;'; //'&#8416;'; // &#x2716;
        span.appendChild(bt);

        const menu = `<zenza-tag-item-menu
          class="tagItemMenu"
          data-text="${encodeURIComponent(text)}"
          data-has-nicodic="0"
        ></zenza-tag-item-menu>`;
        span.insertAdjacentHTML('afterbegin', menu);

        span.className = 'tag-container';
        span.setAttribute('data-tag', tag.text);
        span.slot = 'tag';
        return span;
      }

      notifyBeginDeflistUpdate(/*watchId*/) {
        this.addClass('is-deflistUpdating');
      }

      notifyEndDeflistUpdate(result) {
        this.addClass('is-deflistSuccess');
        window.setTimeout(() => { this.removeClass('is-deflistSuccess'); }, 3000);

        this._deflistButton.setAttribute('data-result', result.message || '登録しました');
        this.removeClass('is-deflistUpdating');
      }

      notifyFailDeflistUpdate(result) {
        this.addClass('is-deflistFail');
        window.setTimeout(() => { this.removeClass('is-deflistFail'); }, 3000);

        this._deflistButton.setAttribute('data-result', result.message || '登録失敗');
        this.removeClass('is-deflistUpdating');
      }
    }


    class VideoInfo {
      static createByThumbInfo(thumbInfo) {
        const candidates = PocketThumbnail.legacyUrls(
          thumbInfo.thumbnail, util.hasLargeThumbnail(thumbInfo.videoId));
        const thumbnail = candidates[0] || thumbInfo.thumbnail || '';
        const owner = thumbInfo.owner || {};
        const isChannel = thumbInfo.isChannel;
        const rawData = {
          status:  thumbInfo.status,
          videoId: thumbInfo.id,
          watchId: thumbInfo.v,
          videoTitle: thumbInfo.title,
          videoThumbnail: thumbnail,
          uploadDate:     thumbInfo.postedAt,
          duration:       textUtil.secToTime(thumbInfo.duration),
          viewCounter:    thumbInfo.viewCount,
          mylistCounter:  thumbInfo.mylistCount,
          commentCounter: thumbInfo.commentCount,
          description:    thumbInfo.description,
          lastResBody:    thumbInfo.lastResBody,
          isChannel,
          ownerId:   owner.id,
          ownerName: owner.name,
          ownerIcon: owner.icon,
          tags: thumbInfo.tagList.map(tag => { return {text: tag.text, isLocked: tag.lock}; })
        };

        return new VideoInfo(rawData);
      }

      constructor(rawData) {
        this._rawData = rawData;
      }

      get status()           { return this._rawData.status; }
      get videoId()          { return this._rawData.videoId; }
      get watchId()          { return this._rawData.watchId; }
      get originalVideoId() {
        return (!this.isChannel && this.videoId !== this.watchId) ? this.videoId : '';
      }
      get videoTitle()       { return this._rawData.videoTitle; }
      get videoThumbnail()   { return this._rawData.videoThumbnail; }
      get description()      { return this._rawData.description; }
      get duration()         { return this._rawData.duration; }
      get owner() {
        return {
          type: this.isChannel ? 'channel' : 'user',
          id:   this.ownerId,
          linkId: this.ownerId ? (this.isChannel ? `ch${this.ownerId}` : `user/${this.ownerId}`) : 'xx',
          name: this.ownerName,
          icon: this.ownerIcon
        };
      }

      get ownerPageLink()  {
        const ownerId = this.ownerId;
        if (!ownerId) {
          return '#';
        }
        if (this.isChannel) {
          return `${protocol}//ch.nicovideo.jp/ch${ownerId}`;
        } else {
          return `${protocol}//www.nicovideo.jp/user/${ownerId}`;
        }
      }
      get ownerIcon()      { return this._rawData.ownerIcon; }
      get ownerName()      { return this._rawData.ownerName; }
      get localeOwnerName() {
        if (this.isChannel) {
          return this.ownerName;
        } else {
          // TODO: 言語依存
          if (!this.ownerId) {
            return this.ownerName || '(投稿者情報なし)';
          }
          return this.ownerName + ' さん';
        }
      }
      get ownerId()        { return this._rawData.ownerId; }
      get isChannel()      { return this._rawData.isChannel; }
      get uploadDate()     { return new Date(this._rawData.uploadDate); }

      get viewCounter()    { return this._rawData.viewCounter; }
      get mylistCounter()  { return this._rawData.mylistCounter; }
      get commentCounter() { return this._rawData.commentCounter; }

      get lastResBody()    { return this._rawData.lastResBody; }
      get tags() { return this._rawData.tags; }
    }



    const deflistAdd = (watchId) => {
      const enableAutoComment = config.props.mylist.enableAutoComment;
      if (location.host === 'www.nicovideo.jp') {
        return (() => {
          if (!enableAutoComment) { return Promise.resolve({}); }
          return ThumbInfoLoader.load(watchId);
        })().then((info) => {
          const originalVideoId = info.originalVideoId ?
            `元動画: ${info.originalVideoId}` : '';
          const description = enableAutoComment ?
            `投稿者: ${info.owner.name} ${info.owner.linkId} ${originalVideoId}` : '';
          return MylistApiLoader.addDeflistItem(watchId, description)
        });
      }

      let zenza;
      let token;
      return ZenzaDetector.detect().then((z) => {
        zenza = z;
      }).then(() => {
        return CsrfTokenLoader.load().then((t) => {
          token = t;
        }, () => { return Promise.resolve(); });
      }).then(() => {
        if (!enableAutoComment) { return {}; }
        return ThumbInfoLoader.load(watchId);
      }).then((info) => {
        if (!enableAutoComment) {
          return zenza.external.deflistAdd({watchId, token});
        }

        const originalVideoId = info.originalVideoId ?
          `元動画: ${info.originalVideoId}` : '';
        const description = enableAutoComment ?
          `投稿者: ${info.owner.name} ${info.owner.linkId} ${originalVideoId}` : '';
        return zenza.external.deflistAdd({watchId, description, token});
      });
    };

    const deflistRemove = (watchId) => {
      if (location.host === 'www.nicovideo.jp') {
        return MylistApiLoader.removeDeflistItem(watchId);
      }

      let zenza;
      let token;
      return ZenzaDetector.detect().then((z) => {
        zenza = z;
      }).then(() => {
        return CsrfTokenLoader.load().then((t) => {
          token = t;
        }, () => { return Promise.resolve(); });
      }).then(() => {
        return zenza.external.deflistRemove({watchId, token});
      });

    };



    class MatchChecker {
      constructor({word = '', tag = '', owner = ''}) {
        this.init({word, tag, owner});
      }

      init({word, tag, owner}) {
        this._tag = [];
        tag.split(/[\r\n]+/).forEach((t) => {
          if (t) { this._tag.push(t.trim()); }
        });
        this._tag = _.uniq(this._tag);

        let wordTmp = [];
        this._word = null;
        word.split(/[\r\n]+/).forEach((w) => {
          if (w) { wordTmp.push(util.escapeRegs(w.trim())); }
        });
        wordTmp = _.uniq(wordTmp);
        if (wordTmp.length > 0) {
          this._word = new RegExp('(' + wordTmp.join('|') + ')', 'i');
        }

        this._userId    = [];
        this._channelId = [];
        owner.split(/[\r\n]+/).forEach((o) => {
          if (typeof o === 'string') {
            const id = o.split('#')[0].trim();
            if (id.startsWith('ch')) {
              this._channelId.push(parseInt(id.substring(2)));
            } else {
              this._userId.push(parseInt(id));
            }
          }
        });
        this._userId    = _.uniq(this._userId);
        this._channelId = _.uniq(this._channelId);

      }

      isMatch(data) {
        if (this._isMatchTag(data.tagList)) { return true; }
        if (this._isMatchOwner(data.owner)) { return true; }
        if (this._isMatchWord({title: data.title, description: data.description})) { return true; }
      }

      _isMatchTag(tagList = []) {
        if (this._tag.length < 1) { return false; }

        const tagTmp = [];
        tagList.forEach(t => { if (t) { tagTmp.push(util.escapeRegs(t.trim ? t.trim() : t.text.trim())); } });
        const tagReg = new RegExp(' (' + tagTmp.join('|') + ') ', 'i');
        const _tag = ' ' + this._tag.join(' ') + ' ';
        return tagReg.test(_tag);
      }

      _isMatchOwner(owner) {
        const _id = owner.type === 'user' ? this._userId : this._channelId;
        return _id.includes(parseInt(owner.id, 10));
      }

      _isMatchWord({title, description}) {
        if (!this._word) { return false; }
        return this._word.test(title) || this._word.test(description);
      }

      isMatchTag(tag) {
        return this._isMatchTag([tag]);
      }

      isMatchOwner(owner) {
        return this._isMatchOwner(owner);
      }
    }

    class NgChecker extends MatchChecker {
      isNg(data) {
        return super.isMatch(data);
      }
    }

    const initDom = () => {
      util.addStyle(__css__);
      const f = document.createElement('div');
      f.id = 'mylistPocketDomContainer';
      f.innerHTML = __tpl__;
      document.body.appendChild(f);
    };

    const initZenzaBridge = () => {
      ZenzaDetector.initialize();
    };

    const createVideoInfoView = () => {
      const host = document.getElementById('mylistPocket-popup');
      const tpl  = document.getElementById('mylistPocket-popup-template');
      const vv = new VideoInfoView({host, tpl});
      return vv;
    };

    const createVideoInfoLoader = vv => {
      let requestGeneration = 0;

      const onVideoInfoLoad = (thumbInfo, requestedWatchId, generation) => {
        if (generation !== requestGeneration) { return; }
        const vi = VideoInfo.createByThumbInfo(thumbInfo);
        vv.bind(vi);

        const image = vv._slot && vv._slot['video-thumbnail'];
        if (!image) { return; }
        const hasLarge = util.hasLargeThumbnail(thumbInfo.videoId || thumbInfo.id || requestedWatchId);
        const legacy = PocketThumbnail.legacyUrls(thumbInfo.thumbnail, hasLarge);
        const isCurrent = () => generation === requestGeneration &&
          vv._videoInfo === vi && image.isConnected &&
          (!vv._hostDom || vv._hostDom.classList.contains('show'));
        // The old thumbnail remains visible immediately. High-quality metadata
        // is requested only for an explicitly opened popup, not for all cards.
        PocketThumbnail.install(image, legacy, isCurrent);
        PocketThumbnail.getHighQuality(
          vi.watchId || requestedWatchId,
          (url, options) => netUtil.fetch(url, options),
          location.hostname
        ).then(urls => {
          if (urls.length && isCurrent()) {
            PocketThumbnail.install(image, [...urls, ...legacy], isCurrent);
          }
        }).catch(() => {});
      };

      const onVideoInfoFail = generation => {
        if (generation !== requestGeneration) { return; }
        vv.bind({status: 'fail', description: '通信失敗'});
      };

      return watchId => {
        const generation = ++requestGeneration;
        vv.reset();
        vv.show();
        return ThumbInfoLoader.load(watchId, {expireTime: 60 * 60 * 1000})
          .then(thumbInfo => onVideoInfoLoad(thumbInfo, watchId, generation))
          // A synchronous display failure in the resolved handler must also
          // dismiss the loading state, not leave the information popup spinning.
          .catch(() => onVideoInfoFail(generation));
      };
    };

    const createCommandDispatcher = ({infoView}) => {
      const info = createVideoInfoLoader(infoView);

      const ngConfig  = config.namespace('ng');
      const favConfig = config.namespace('fav');
      const {ngChecker, favChecker} = initNgChecker({ngConfig, favConfig});

      const toggleFavNg = (command, param) => {
        let [cmd, namespace, key] = command.split('-');
        let _config = namespace === 'fav' ? favConfig : ngConfig;
        _config.refresh();
        const value = param.value.trim();
        let ngs = _config.props[key].trim().split(/[\r\n]/);
        const isContain = ngs.includes(value);

        if (isContain || cmd === 'remove') {
          ngs = ngs.filter((line) => {
            if (line === value) {
              window.console.info('%c-%s:%s', 'background: cyan', key, value);
            }
            return line !== value;
          });
          cmd = 'remove';
        } else if (!isContain || cmd === 'add') {
          ngs.push(value);
          window.console.info('%c+%s:%s', 'background: cyan', key, value);
          cmd = 'add';
        }

        ngs = _.uniq(ngs);

        _config.props[key] = ngs.join('\n').trim();

        const className = namespace === 'fav' ? 'is-fav-favorited' : 'is-ng-rejected';
        Array.prototype.forEach.call(
          document.querySelectorAll(`*[data-watch-id=${param.watchId}]`),
          item => { item.classList.toggle(className, cmd === 'add'); });
      };

      return (command, param, src) => {
        switch(command) {
          case 'info':
            return info(param);
          case 'load':
            return QueueLoader.load(param);
          case 'fav-status':
            return QueueLoader.load(param).then((result) => {
              if (!result || result.status === 'fail' || result.code === 'DELETED') {
                return Promise.reject({status: 'unknown', result});
              }
              if (ngChecker.isMatch(result)) {
                return {status: 'ng', result};
              }
              if (favChecker.isMatch(result)) {
                return {status: 'favorite', result};
              }
              return {status: 'default', result};
            });
          case 'mylist-window':
            window.open(
             protocol + '//www.nicovideo.jp/mylist_add/video/' + param,
             'nicomylistadd',
             'width=500, height=400, menubar=no, scrollbars=no');
            break;
          case 'twitter-hash-open':
            window.open('https://twitter.com/hashtag/' + param + '?src=hash');
            break;
          case 'open-mylist-open':
            window.open(protocol + '//www.nicovideo.jp/openlist/' + param);
            break;
          case 'mylist-comment-open':
            window.open(protocol + '//www.nicovideo.jp/mylistcomment/video/' + param);
            break;
           case 'zenza-open-now':
            if (window.ZenzaWatch.config &&
              window.ZenzaWatch.config.getValue('enableSingleton')) {
              window.ZenzaWatch.external.sendOrExecCommand('openNow', param);
            } else {
              window.ZenzaWatch.external.execCommand('openNow', param);
            }
            break;
          case 'zenza-open':
            if (window.ZenzaWatch.config.getValue('enableSingleton')) {
              window.ZenzaWatch.external.sendOrOpen(param);
            } else {
              window.ZenzaWatch.external.open(param);
            }
            break;
          case 'playlist-inert':
            window.ZenzaWatch.external.playlist.insert(param);
            break;
          case 'playlist-queue':
            window.ZenzaWatch.external.playlist.add(param);
            break;
          case 'deflist-add':
            src.notifyBeginDeflistUpdate('is-deflistUpdating');

            return deflistAdd(param)
              .then(util.getSleepPromise(1000, 'deflist-add'))
              .then((result) => {
                src.notifyEndDeflistUpdate(result);
              }, (err) => {
                console.error('deflist-add-result', err);
                src.notifyFailDeflistUpdate(err);
              });
          case 'deflist-remove':
            src.notifyBeginDeflistUpdate('is-deflistUpdating');

            return deflistRemove(param)
              .then(util.getSleepPromise(1000, 'deflist-remove'))
              .then(() => {
                src.notifyEndDeflistUpdate({message: '削除しました'});
              }, (err) => {
                console.error('deflist-remove-result', err);
                src.notifyFailDeflistUpdate(err);
              });
          case 'add-ng-word':  case 'add-ng-tag':  case 'add-ng-owner':
          case 'add-fav-word': case 'add-fav-tag': case 'add-fav-owner':
          case 'remove-ng-word':  case 'remove-ng-tag':  case 'remove-ng-owner':
          case 'remove-fav-word': case 'remove-fav-tag': case 'remove-fav-owner':
          case 'toggle-ng-word':  case 'toggle-ng-tag':  case 'toggle-ng-owner':
          case 'toggle-fav-word': case 'toggle-fav-tag': case 'toggle-fav-owner':
            toggleFavNg(command, param);
            break;
        }
      };
    };

    const initExternal = (dispatcher, hoverMenu, infoView, ngLifecycle) => {
      MylistPocket.external = {
        info: watchId => { return dispatcher('info', watchId); },
        load: watchId => { return dispatcher('load', watchId, {expireTime: 60 * 60 * 1000}); },
        getFavStatus: (watchId) => { return dispatcher('fav-status', watchId); },
        observe: (params /*{query, container, closest}*/) => { ngLifecycle.observe(params); },
        hide: () => {
          hoverMenu.hide();
          infoView.hide();
        }
      };

      MylistPocket.isReady = true;

      const ev = new CustomEvent('MylistPocketInitialized', { detail: { MylistPocket } });
      document.body.dispatchEvent(ev);
      // 過去の互換用
      if (window.jQuery) {
        window.jQuery('body').trigger('MylistPocketReady', MylistPocket);
      }
    };


    /*
     * Task 092: 同時に読み込む数を本当に MAX_LOAD（6）件以下にする。
     * 以前は6個の Promise の配列を Promise.race で待っていたため、完了時間がばらつくと、
     * 「どれか1つが終わった」ことで待っていた多くの要求が同時に動き始め、6件を超えていた
     * （再現試験で最大13〜16件）。今は、動いている数を数えて、空いた分だけ待ち行列の先頭から始める（先に来た順）。
     * 1件の成功後の50ms・失敗後の1000msの待ちは、以前と同じくその枠の中で待つ。
     * 1件が失敗・例外になっても枠は必ず戻し、残りの要求は止めない。
     */
    const QueueLoader = (() => {
      const MAX_LOAD = 6;
      const waiting = [];
      let active = 0;

      const startNext = () => {
        while (active < MAX_LOAD && waiting.length > 0) {
          const {run, resolve, reject} = waiting.shift();
          active++;
          let promise;
          try {
            promise = Promise.resolve(run());
          } catch (e) {
            promise = Promise.reject(e);
          }
          promise
            .then(resolve, reject)
            .then(() => {
              active--;
              startNext();
            });
        }
      };

      const load = function(watchId, item, isCancelled) {
        // Optional per-NG-session cancellation. Shared hover/favourite calls
        // without this argument keep their existing queue behavior.
        const cancelled = () => typeof isCancelled === 'function' && isCancelled();
        const onLoad = info => {
          if (cancelled()) { return {status: 'cancelled'}; }
          if (item) {
            watchId = info.watchId;
            item.setAttribute('data-watch-id', watchId);
            item.setAttribute('data-thumb-info', JSON.stringify(info));
          }
          const sleepTime = info.fromCache ? 0 : 50;
          return (util.getSleepPromise(sleepTime,  'success-' + watchId))(info);
        };
        const onFail = error => cancelled() ?
          {status: 'cancelled'} :
          util.getSleepPromise(1000, 'fail-' + watchId)(error);

        return new Promise((resolve, reject) => {
          waiting.push({
            run: () => {
              if (cancelled()) { return {status: 'cancelled'}; }
              if (item) { item.classList.add('is-ng-current'); }
              return ThumbInfoLoader.load(watchId).then(onLoad, onFail);
            },
            resolve,
            reject
          });
          startNext();
        });
      };

      return {
        load,
        MAX_LOAD,
        get activeCount() { return active; },
        get waitingCount() { return waiting.length; }
      };
    })();

    const waitForDom = async (query, timeout = 30000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const dom = document.querySelector(query);
        if (dom) { return dom; }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('timeout');
    };

    const getNgEnv = async () => {
      if (location.host === 'www.nicovideo.jp' &&
         (location.pathname.startsWith('/tag') ||
          location.pathname.startsWith('/search')) &&
         (await window.cookieStore?.get('new_search').catch(() => null))?.value === "false"
      ) {
        return {
          query: '.item[data-video-id]:not(.is-ng-wait)',
          container: Array.from(document.querySelectorAll('.contentBody .videoListInner')),
          subtree: false
        };
      }
      if (location.host === 'www.nicovideo.jp' &&
         (location.pathname.startsWith('/tag') ||
          location.pathname.startsWith('/search') ||
          location.pathname.startsWith('/ranking'))
      ) {
        await waitForDom('[data-anchor-page="tag"],[data-anchor-page="search"],[data-anchor-page^="ranking_"]');
        return {
          query: '[href*="watch/"]:is([data-anchor-page="tag"],[data-anchor-page="search"],[data-anchor-page^="ranking_"]):not(.is-ng-wait)',
          container: document.querySelector('[aria-label="nicovideo-content"]'),
          subtree: true
        };
      }
      if (location.host === 'www.nicovideo.jp' &&
          document.querySelector('#MyPageNicorepoApp, #UserPageNicorepoApp')) {
        return {
          query: '.NicorepoTimelineItem:not(.is-ng-wait)',
          container: document.querySelector('#MyPageNicorepoApp, #UserPageNicorepoApp'),
        };
      }

      if (location.host === 'ch.nicovideo.jp' &&
          location.pathname.startsWith('/search')) {
        return {
          query: '.item:not(.is-ng-wait)',
          container: document.querySelector('.site_body')
        };
      }

      if (location.host === 'search.nicovideo.jp') {
        return {
          query: '.video:not(.is-ng-wait)',
          container: document.querySelector('#row-results')
        };
      }


      return {query: null, container: null};
    };

    const initNgConfig = onEnable => {
      const ngConfig = config.namespace('ng');
      const favConfig = config.namespace('fav');
      // Keep the subscription alive even when NG is OFF at startup.
      const updateEnable = v => {
        const enabled = !!v;
        document.body.classList.toggle('is-ng-disable', !enabled);
        if (typeof onEnable === 'function') { onEnable(enabled); }
      };
      ngConfig.onkey('enable', updateEnable);
      updateEnable(ngConfig.props.enable);
      return {ngConfig, favConfig};
    };

    const initNgChecker = ({ngConfig, favConfig}) => {
      const ngChecker = new NgChecker({
        word:  ngConfig.props.word,
        tag:   ngConfig.props.tag,
        owner: ngConfig.props.owner
      });

      ngConfig.on('update', bounce.time(({key, value}) => {
        ngChecker.init({
          word:  ngConfig.props.word,
          tag:   ngConfig.props.tag,
          owner: ngConfig.props.owner
        });
      }, 100));


      const favChecker = new MatchChecker({
        word:  favConfig.props.word,
        tag:   favConfig.props.tag,
        owner: favConfig.props.owner
      });

      favConfig.on('update', bounce.time(({key, value}) => {
        favChecker.init({
          word:  favConfig.props.word,
          tag:   favConfig.props.tag,
          owner: favConfig.props.owner
        });
      }, 100));

       return {ngChecker, favChecker};
    };

    const initIntersectionObserver = onInview => {

      const onItemInview = item => {
        let watchId = item.dataset.id ||
          item.dataset.videoId ||
          item.dataset.watchId ||
          item.dataset.decorationVideoId;
        const ignore = () => item.classList.add('is-ng-ignore');
        if (!watchId) {
          const a = item instanceof HTMLAnchorElement ? item : item.querySelector('a[href*=\'watch/\'],a[href*="shorts/"]');
          let m;
          if (a != null &&
              a.hostname === 'www.nicovideo.jp' &&
              (m = /^\/(watch|shorts)\/([a-z0-9]+)/.exec(a.pathname)) !== null) {
            watchId = m[2];
          }
        }

        if (!watchId) {
          item.classList.add('no-watch-id');
          return ignore();
        }

        item.classList.add('is-ng-queue');
        onInview(item, watchId);
      };

      const intersectionObserver = new window.IntersectionObserver(entries => {
        entries.filter(entry => entry.isIntersecting).forEach(entry => {
          const item = entry.target;
          intersectionObserver.unobserve(item);
          onItemInview(item);
        });
      }, { rootMargin: '400px'});

      return intersectionObserver;
    };

    const initNgDom = ({intersectionObserver, query, closest, container, subtree}) => {
      subtree = typeof subtree !== 'boolean' ? false : subtree;
      if (!container) { return () => {}; }
      // NG can be enabled repeatedly; do not append another style sheet.
      if (!initNgDom._styleAdded) {
        util.addStyle(__ng_css__);
        initNgDom._styleAdded = true;
      }
      const observed = new Set();

      const update = container => {
        let items = (container || document).querySelectorAll(query);
        if (!items || items.length < 1) { return; }
        if (closest) {
          let tmp = [];
          [...items].forEach(item => {
            const c = item.closest(closest);
            if (c && !tmp.includes(c)) {
              tmp.push(c);
            }
          });
          items = tmp;
        }
        if (!items || items.length < 1) { return; }
        [...items].forEach(item => {
          //if (item.offsetLeft < 0) { return; }
          if (item.classList.contains('is-ng-ignore')) { return; }
          item.classList.add('is-ng-wait');
          observed.add(item);
          intersectionObserver.observe(item);
        });
      };
      update();

      const mutationObserver = new MutationObserver(mutations => {
        for (const record of mutations) {
          const container = record.target;
          if (record.addedNodes && record.addedNodes.length) {
            update(container);
          }
        }
      });

      const containers = Array.isArray(container) ? container : [container];
      containers.forEach(container => {
        container.dataset.isWatching = 1;
        mutationObserver.observe(
          container,
          {childList: true, characterData: false, attributes: false, subtree}
        );
      });

      return () => {
        mutationObserver.disconnect();
        intersectionObserver.disconnect();
        containers.forEach(container => {
          delete container.dataset.isWatching;
        });
        // A later ON cycle must be allowed to scan these existing DOM nodes.
        observed.forEach(item => {
          item.classList.remove('is-ng-wait', 'is-ng-queue', 'is-ng-current');
        });
      };
    };

    const initNg = async (params, isCurrent = () => true, ngContext) => {
      if (!window.IntersectionObserver || !isCurrent()) { return; }

      let {query, container, closest, subtree, callback} = params ? params : await getNgEnv();

      // Discovery may await page DOM while NG is toggled OFF.
      if (!isCurrent() || !query || !container ||
          (Array.isArray(container) && !container.length)) { return; }

      const {ngConfig, favConfig} = ngContext || initNgConfig();
      if (!ngConfig || !ngConfig.props.enable || !isCurrent()) { return; }

      const {ngChecker, favChecker} = ngContext?.checkers ||
        initNgChecker({ngConfig, favConfig});

      // Each card owns only its newest NG request within this observer session.
      const cardRequests = new WeakMap();
      const failedCodeClasses = new WeakMap();
      const onItemInview = (item, watchId) => {
        if (!isCurrent() || !ngConfig.props.enable) { return; }
        const requestId = (cardRequests.get(item) || 0) + 1;
        cardRequests.set(item, requestId);
        const owned = () => cardRequests.get(item) === requestId;
        const cancelled = () => !owned() || !isCurrent() || !ngConfig.props.enable;
        const clearFailure = () => {
          item.classList.remove('is-ng-failed');
          const code = failedCodeClasses.get(item);
          if (code) { item.classList.remove(code); }
          failedCodeClasses.delete(item);
        };

        const loadLazy = () => {
          const lazyImage = item.querySelector('.jsLazyImage');
          if (lazyImage) {
            const origImage = lazyImage.getAttribute('data-original');
            if (origImage) {
              lazyImage.src = origImage;
              lazyImage.classList.remove('jsLazyImage');
            }
          }
        };

        QueueLoader.load(watchId, item, cancelled).then(
          info => {
            // An older result must not clear the newer request's loading state.
            if (!owned()) { return; }
            item.classList.remove('is-ng-current');
            if (!isCurrent() || !ngConfig.props.enable ||
                info?.status === 'cancelled') {
              loadLazy();
              return;
            }
            const malformed = !info || typeof info !== 'object' ||
              Object.prototype.toString.call(info) === '[object Error]' ||
              !info.owner || typeof info.owner !== 'object';
            if (malformed || info.status === 'fail' || info.code === 'DELETED') {
              const code = typeof info?.code === 'string' &&
                /^[a-z0-9_-]{1,48}$/i.test(info.code) ? info.code : 'is-no-data';
              clearFailure();
              // Do not show both a previous NG verdict and a new failure.
              item.classList.remove('is-ng-rejected', 'is-ng-resolved', 'is-fav-favorited');
              if (!malformed && info.code !== 'COMMUNITY') {
                console.warn('NG thumbnail unavailable', watchId, code);
              }
              item.classList.add('is-ng-failed', code);
              failedCodeClasses.set(item, code);
            } else {
              clearFailure();
              if (callback) {
                return callback(item,
                  {watchId, info, isNg: ngChecker.isNg(info), isFav: favChecker.isMatch(info)});
              }
              // Re-enabling NG may classify a previously processed card again.
              // Never leave conflicting old and new result classes attached.
              const rejected = !!ngChecker.isNg(info);
              item.classList.toggle('is-ng-rejected', rejected);
              item.classList.toggle('is-ng-resolved', !rejected);
              item.classList.toggle('is-fav-favorited', !!favChecker.isMatch(info));

              for (let img of item.querySelectorAll('img.videoThumbnail.preview')) {
                // Preview cards only use already-known legacy metadata: never
                // flood the watch API with calls for every list item.
                PocketThumbnail.install(img, PocketThumbnail.legacyUrls(
                  info.thumbnail, util.hasLargeThumbnail(info.id || info.watchId || watchId)));
              }

              let label = item.querySelector('.label');
              item.dataset.title = info.title;
              // チャンネル動画のリンクを watch/so〜 に置き換える
              if (!(info.id || '').startsWith('so')) { return; }
              if (label &&
                  item.classList.contains('videoLink')
              ) {
                label.textContent = info.id;
                item.dataset.param = item.dataset.videoId = info.id;
                item.href = `https://www.nicovideo.jp/watch/${info.id}`;
              }
              for (let a of item.querySelectorAll(`a[href*="watch/${watchId}"]`)) {
                let href = a.getAttribute('href');
                href = href.replace(/watch\/([0-9]+)/, `watch/${info.id}`);
                a.setAttribute('href', href.replace(/^http:/, 'https:'));
              }
              for (let a of item.querySelectorAll(`a[href*="shorts/${watchId}"]`)) {
                let href = a.getAttribute('href');
                href = href.replace(/shorts\/([0-9]+)/, `shorts/${info.id}`);
                a.setAttribute('href', href.replace(/^http:/, 'https:'));
              }
            }

            loadLazy();
          }
        ).catch(() => {
          if (!owned()) { return; }
          item.classList.remove('is-ng-current');
          if (isCurrent() && ngConfig.props.enable) {
            clearFailure();
            item.classList.remove('is-ng-rejected', 'is-ng-resolved', 'is-fav-favorited');
            item.classList.add('is-ng-failed');
          }
          loadLazy();
        });
      };

      const intersectionObserver = initIntersectionObserver(onItemInview);

      return initNgDom({intersectionObserver, query, container, closest, subtree});
    };

    const createNgLifecycle = () => {
      const scopes = [];
      let generation = 0;
      let enabled = false;
      let context;

      const startScope = scope => {
        if (scope.startedIn === generation) {
          return scope.pending || Promise.resolve();
        }
        scope.startedIn = generation;
        const session = generation;
        const isCurrent = () => enabled && generation === session;
        scope.pending = Promise.resolve()
          .then(() => initNg(scope.params, isCurrent, context))
          .then(dispose => {
            if (!isCurrent()) {
              if (typeof dispose === 'function') { dispose(); }
              return;
            }
            scope.stop = typeof dispose === 'function' ? dispose : null;
          })
          .catch(error => {
            if (isCurrent()) {
              window.console.warn('Optional NG observer failed', error);
            }
          });
        return scope.pending;
      };

      const updateEnabled = value => {
        const next = !!value;
        if (enabled === next) { return; }
        enabled = next;
        generation++;
        for (const scope of scopes) {
          if (scope.stop) { scope.stop(); scope.stop = null; }
          scope.startedIn = null;
        }
        if (enabled) {
          for (const scope of scopes) { startScope(scope); }
        }
      };

      // Exactly one enable listener, even when initially OFF.
      context = initNgConfig(updateEnabled);
      context.checkers = initNgChecker(context);

      return {
        ngConfig: context.ngConfig,
        observe(params) {
          const existing = scopes.find(scope => scope.params === params);
          if (existing) { return existing.pending || Promise.resolve(); }
          const scope = {params, stop: null, pending: null, startedIn: null};
          scopes.push(scope);
          return enabled ? startScope(scope) : Promise.resolve();
        }
      };
    };

    const init = async () => {
      window.console.log('%cMylistPocket 0.5.80-task968', 'background: #ccf;');
      await config.promise('restore');
      initDom();
      initZenzaBridge();

      const infoView = createVideoInfoView();
      const dispatcher = createCommandDispatcher({infoView});

      infoView.on('command', dispatcher);

      const hoverMenu = new HoverMenu();
      hoverMenu.on('info', (watchId) => {
        hoverMenu.isBusy = true;

        // Task 079: 以前は成功時(.then)だけ is-busy を外していたため、情報パネルの
        // 表示処理が例外や失敗で終わると、ホバーメニューが透明・クリック不可の
        // まま二度と戻らなかった（「？を押すと消えて、それ以降現れない」の正体）。
        // 成功・失敗・同期例外のどれでも必ず外す。
        Promise.resolve()
          .then(() => dispatcher('info', watchId))
          .catch(err => { window.console.error('MylistPocket: 動画情報の表示に失敗', err); })
          .finally(() => { hoverMenu.isBusy = false; });
      });
      hoverMenu.on('deflist-add', (watchId, src) => {
        dispatcher('deflist-add', watchId, src);
      });
      hoverMenu.on('deflist-remove', (watchId, src) => {
        dispatcher('deflist-remove', watchId, src);
      });
      hoverMenu.on('playlist-queue', (watchId, src) => {
        dispatcher('playlist-queue', watchId, src);
      });
      MylistPocket.debug.hoverMenu = hoverMenu;

      const ngLifecycle = createNgLifecycle();
      const ngConfig = ngLifecycle.ngConfig;
      await ngLifecycle.observe().catch(() => {
        console.warn('Optional NG initialization unavailable');
      });

      if (config.props.nicoad.hide) {
        util.addStyle(nicoadHideCss);
      }

      if (document.querySelector('a[data-anchor-page^="ranking_"]') != null) {
        // Task 079: NG機能がOFFの時（や対象外のページ）は initNg() が ngConfig を
        // 返さない。以前はここで ngConfig.props を読んで例外になり、直後の
        // initExternal() まで届かず MylistPocket.external が作られなかった。
        // その結果、ランキングページで「？」を押すと VideoInfoView の初期化が
        // MylistPocket.external.observe で落ちていた。
        const ngTag = (ngConfig && ngConfig.props && ngConfig.props.enable && ngConfig.props.tag) || '';
        for (const tagName of ngTag.trim().split(/[\r\n]/)) {
          if (!tagName.trim()) { continue; }
          util.addStyle(hideTagCss(tagName));
        }
        if (config.props.responsive.matrix) {
          util.addStyle(responsiveCss);
        }
      }

      initExternal(dispatcher, hoverMenu, infoView, ngLifecycle);
    };

    init();
  };
function EmitterInitFunc() {
		class Handler {
				constructor(...args) {
						this._list = args;
				}
				get length() {
						return this._list.length;
				}
				exec(...args) {
						const pending = this._list.slice();
						for (let i = pending.length - 1; i >= 0; i--) {
								const member = pending[i];
								if (this._list.includes(member)) {
										member.apply(this._list, args);
								}
						}
				}
				execMethod(name, ...args) {
						const pending = this._list.slice();
						for (let i = pending.length - 1; i >= 0; i--) {
								const member = pending[i];
								if (this._list.includes(member)) {
										member[name](...args);
								}
						}
				}
				add(member) {
						if (this._list.includes(member)) {
								return this;
						}
						this._list.unshift(member);
						return this;
				}
				remove(member) {
						this._list = this._list.filter(m => m !== member);
						return this;
				}
				clear() {
						this._list.length = 0;
						return this;
				}
				get isEmpty() {
						return this._list.length < 1;
				}
				*[Symbol.iterator]() {
						const list = this._list || [];
						for (const member of list) {
								yield member;
						}
				}
				next() {
						return this[Symbol.iterator]();
				}
		}
		Handler.nop = () => { };
		const PromiseHandler = (() => {
				const id = function () { return `Promise${this.id++}`; }.bind({ id: 0 });
				class PromiseHandler extends Promise {
						constructor(callback = () => { }) {
								const key = new Object({ id: id(), callback, status: 'pending' });
								const cb = function (res, rej) {
										const resolve = (...args) => { this.status = 'resolved'; this.value = args; res(...args); };
										const reject = (...args) => { this.status = 'rejected'; this.value = args; rej(...args); };
										if (this.result) {
												return this.result.then(resolve, reject);
										}
										Object.assign(this, { resolve, reject });
										return callback(resolve, reject);
								}.bind(key);
								super(cb);
								this.resolve = this.resolve.bind(this);
								this.reject = this.reject.bind(this);
								this.key = key;
						}
						resolve(...args) {
								if (this.key.resolve) {
										this.key.resolve(...args);
								}
								else {
										this.key.result = Promise.resolve(...args);
								}
								return this;
						}
						reject(...args) {
								if (this.key.reject) {
										this.key.reject(...args);
								}
								else {
										this.key.result = Promise.reject(...args);
								}
								return this;
						}
						addCallback(callback) {
								Promise.resolve().then(() => callback(this.resolve, this.reject));
								return this;
						}
				}
				return PromiseHandler;
		})();
		const { Emitter } = (() => {
				let totalCount = 0;
				let warnings = [];
				class Emitter {
						on(name, callback) {
								if (!this._events) {
										Emitter.totalCount++;
										this._events = new Map();
								}
								name = name.toLowerCase();
								let e = this._events.get(name);
								if (!e) {
										const handler = new Handler(callback);
										handler.name = name;
										this._events.set(name, handler);
										e = handler;
								}
								else {
										e.add(callback);
								}
								if (e.length > 10) {
										console.warn('listener count > 10', name, e, callback);
										!Emitter.warnings.includes(this) && Emitter.warnings.push(this);
								}
								return this;
						}
						off(name, callback) {
								if (!this._events) {
										return;
								}
								name = name.toLowerCase();
								const e = this._events.get(name);
								if (!this._events.has(name)) {
										return;
								}
								else if (!callback) {
										this._events.delete(name);
								}
								else {
										for (const listener of e) {
												if (listener === callback || listener._original === callback) {
														e.remove(listener);
												}
										}
										if (e.isEmpty) {
												this._events.delete(name);
										}
								}
								if (this._events.size < 1) {
										delete this._events;
										Emitter.totalCount--;
								}
								return this;
						}
						once(name, func) {
								const wrapper = (...args) => {
										this.off(name, wrapper);
										wrapper._original = null;
										func(...args);
								};
								wrapper._original = func;
								return this.on(name, wrapper);
						}
						clear(name) {
								if (!this._events) {
										return;
								}
								if (name) {
										this._events.delete(name.toLowerCase());
								}
								else {
										delete this._events;
										Emitter.totalCount--;
								}
								return this;
						}
						emit(name, ...args) {
								if (!this._events) {
										return;
								}
								name = name.toLowerCase();
								const e = this._events.get(name);
								if (!e) {
										return;
								}
								e.exec(...args);
								return this;
						}
						emitAsync(...args) {
								if (!this._events) {
										return;
								}
								setTimeout(() => this.emit(...args), 0);
								return this;
						}
						promise(name, callback) {
								if (!this._promise) {
										this._promise = new Map;
								}
								const p = this._promise.get(name);
								if (p) {
										return callback ? p.addCallback(callback) : p;
								}
								this._promise.set(name, new PromiseHandler(callback));
								return this._promise.get(name);
						}
						emitResolve(name, ...args) {
								if (!this._promise) {
										this._promise = new Map;
								}
								if (!this._promise.has(name)) {
										this._promise.set(name, new PromiseHandler());
								}
								return this._promise.get(name).resolve(...args);
						}
						emitReject(name, ...args) {
								if (!this._promise) {
										this._promise = new Map;
								}
								if (!this._promise.has(name)) {
										this._promise.set(name, new PromiseHandler);
								}
								return this._promise.get(name).reject(...args);
						}
						resetPromise(name) {
								if (!this._promise) {
										return;
								}
								this._promise.delete(name);
						}
						hasPromise(name) {
								return this._promise && this._promise.has(name);
						}
						addEventListener(...args) { return this.on(...args); }
						removeEventListener(...args) { return this.off(...args); }
				}
				Emitter.totalCount = totalCount;
				Emitter.warnings = warnings;
				return { Emitter };
		})();
		return { Handler, PromiseHandler, Emitter };
}
const { Handler, PromiseHandler, Emitter } = EmitterInitFunc();
function parseThumbInfo(xmlText) {
		if (typeof xmlText !== 'string' || xmlText.status === 'ok') {
				return xmlText;
		}
		const parser = new DOMParser();
		const xml = parser.parseFromString(xmlText, 'text/xml');
		const val = (name) => {
				const elms = xml.getElementsByTagName(name);
				if (elms.length < 1) {
						return null;
				}
				return elms[0].textContent;
		};
		const dateToString = (dateString) => {
				const date = new Date(dateString);
				const [yy, mm, dd, h, m, s] = [
						date.getFullYear(),
						date.getMonth() + 1,
						date.getDate(),
						date.getHours(),
						date.getMinutes(),
						date.getSeconds()
				].map(n => n.toString().padStart(2, '0'));
				return `${yy}/${mm}/${dd} ${h}:${m}:${s}`;
		};
		const resp = xml.getElementsByTagName('nicovideo_thumb_response');
		if (resp.length < 1 || resp[0].getAttribute('status') !== 'ok') {
				return {
						status: 'fail',
						code: val('code'),
						message: val('description')
				};
		}
		const lengthText = val('length'), watchUrl = val('watch_url'), videoIdText = val('video_id'), thumbnailUrl = val('thumbnail_url');
		if (lengthText === null || watchUrl === null || !videoIdText || thumbnailUrl === null) {
				return {
						status: 'fail',
						code: 'INVALID_RESPONSE',
						message: 'thumbinfo response is missing required fields'
				};
		}
		const [min, sec] = lengthText.split(':');
		const duration = min * 60 + sec * 1;
		const watchId = watchUrl.split('/').reverse()[0];
		const postedAt = dateToString(new Date(val('first_retrieve')));
		const tags = [...xml.getElementsByTagName('tag')].map(tag => {
				return {
						text: tag.textContent,
						category: tag.hasAttribute('category'),
						lock: tag.hasAttribute('lock')
				};
		});
		const videoId = videoIdText;
		const isChannel = videoId.substring(0, 2) === 'so';
		const result = {
				status: 'ok',
				_format: 'thumbInfo',
				v: isChannel ? videoId : watchId,
				id: videoId,
				videoId,
				watchId: isChannel ? videoId : watchId,
				originalVideoId: (!isChannel && watchId !== videoId) ? videoId : '',
				isChannel,
				title: val('title'),
				description: val('description'),
				thumbnail: thumbnailUrl.replace(/^http:/, 'https:'),
				movieType: val('movie_type'),
				lastResBody: val('last_res_body'),
				duration,
				postedAt,
				mylistCount: parseInt(val('mylist_counter'), 10),
				viewCount: parseInt(val('view_counter'), 10),
				commentCount: parseInt(val('comment_num'), 10),
				tagList: tags
		};
		const userId = val('user_id');
		if (userId !== null && userId !== '') {
				result.owner = {
						type: 'user',
						id: userId,
						linkId: userId ? `user/${userId}` : '',
						name: val('user_nickname') || '(非公開ユーザー)',
						url: userId ? ('https://www.nicovideo.jp/user/' + userId) : '#',
						icon: val('user_icon_url') || 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg'
				};
		}
		const channelId = val('ch_id');
		if (channelId !== null && channelId !== '') {
				result.owner = {
						type: 'channel',
						id: channelId,
						linkId: channelId ? `ch${channelId}` : '',
						name: val('ch_name') || '(非公開チャンネル)',
						url: 'https://ch.nicovideo.jp/ch' + channelId,
						icon: val('ch_icon_url') || 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg'
				};
		}
		return result;
}
const workerUtil = (() => {
		let config, TOKEN, PRODUCT = 'ZenzaWatch?', netUtil, CONSTANT, NAME = '';
		let global = null, external = null;
		const DEFAULT_REQUEST_TIMEOUT = 5 * 60 * 1000;
		const isAvailable = !!(window.Blob && window.Worker && window.URL);
		const messageWrapper = function (self) {
				const _onmessage = self.onmessage || (() => { });
				const promises = {};
				let requestSeq = 0;
				const onMessage = async function (self, type, e) {
						const { body, sessionId, status } = e.data;
						const { command, params } = body;
						try {
								let result;
								switch (command) {
										case 'commandResult':
												if (promises[sessionId]) {
														if (status === 'ok') {
																promises[sessionId].resolve(params.result);
														}
														else {
																promises[sessionId].reject(new Error(params.result));
														}
														delete promises[sessionId];
												}
												return;
										case 'ping':
												result = { now: Date.now(), NAME, PID, url: location.href };
												break;
										case 'port':
												{
														const port = e.ports[0];
														portMap[params.name] = port;
														port.addEventListener('message', onMessage.bind({}, port, params.name));
														port.start && port.start();
														bindFunc(port, 'MessageChannel');
														result = { name: params.name };
														if (params.ping) {
																console.time('ping:' + sessionId);
																port.ping().then((result) => {
																		console.timeEnd('ping:' + sessionId);
																		console.log('ok %smec', Date.now() - params.now, params);
																}).catch((err) => {
																		console.timeEnd('ping:' + sessionId);
																		console.warn('ping fail', { err, data: e.data });
																});
														}
												}
												break;
										case 'broadcast':
												{
														if (!BroadcastChannel) {
																return;
														}
														const channel = new BroadcastChannel(`${params.name}`);
														channel.addEventListener('message', onMessage.bind({}, channel, 'BroadcastChannel'));
														bindFunc(channel, 'BroadcastChannel');
														bcast[params.basename] = channel;
												}
												return;
										case 'env':
												({ config, TOKEN, PRODUCT, CONSTANT } = params);
												return;
										default:
												result = await _onmessage({ command, params }, type, PID);
												break;
								}
								if (sessionId === undefined || sessionId === null) {
										return;
								}
								self.postMessage({ body: { command: 'commandResult', params: { command, result } }, sessionId, TYPE: type, PID, status: 'ok'
								});
						}
						catch (err) {
								console.error('failed', { err, command, params, sessionId, TYPE: type, PID, data: e.data });
								if (sessionId === undefined || sessionId === null) {
										return;
								}
								self.postMessage({ body: { command: 'commandResult', params: { command, result: err.message || null } },
										sessionId, TYPE: type, PID, status: err.status || 'fail'
								});
						}
				};
				self.onmessage = onMessage.bind({}, self, self.name);
				self.onconnect = (e) => {
						const port = e.ports[0];
						port.onmessage = self.onmessage;
						port.start();
				};
				const bindFunc = (self, type = 'Worker') => {
						const post = function (self, body, options = {}) {
								const sessionId = `recv:${NAME}:${type}:${requestSeq++}`;
								return new Promise((resolve, reject) => {
										promises[sessionId] = { resolve, reject };
										self.postMessage({ body, sessionId, PID }, options.transfer);
										if (typeof options.timeout === 'number') {
												setTimeout(() => {
														reject({ status: 'fail', message: 'timeout' });
														delete promises[sessionId];
												}, options.timeout);
										}
								}).finally(() => { delete promises[sessionId]; });
						};
						const emit = function (self, eventName, data = null) {
								self.post({ command: 'emit', params: { eventName, data } });
						};
						const notify = function (self, message) {
								self.post({ command: 'notify', params: { message } });
						};
						const alert = function (self, message) {
								self.post({ command: 'alert', params: { message } });
						};
						const ping = async function (self, options = {}) {
								const timekey = `PING "${self.name}"`;
								console.log(timekey);
								let result;
								options.timeout = options.timeout || 10000;
								try {
										console.time(timekey);
										result = await self.post({ command: 'ping', params: { now: Date.now(), NAME, PID, url: location.href } }, options);
										console.timeEnd(timekey);
								}
								catch (e) {
										console.timeEnd(timekey);
										console.warn('ping fail', e);
								}
								return result;
						};
						self.post = post.bind({ sessionId: 0 }, this.port || self);
						self.emit = emit.bind({}, self);
						self.notify = notify.bind({}, self);
						self.alert = alert.bind({}, self);
						self.ping = ping.bind({}, self);
						return self;
				};
				bindFunc(self);
				self.xFetch = async (url, options = {}) => {
						options = { ...options, ...{ signal: null } }; // remove AbortController
						if (url.startsWith(location.origin)) {
								return fetch(url, options);
						}
						const result = await self.post({ command: 'fetch', params: { url, options } });
						const { buffer, init, headers } = result;
						const _headers = new Headers();
						(headers || []).forEach((a) => _headers.append(...a));
						const _init = {
								status: init.status,
								statusText: init.statusText || '',
								headers: _headers
						};
						return new Response(buffer, _init);
				};
		};
		const workerUtil = {
				isAvailable,
				js: (q, ...args) => {
						const strargs = args.map(a => typeof a === 'string' ? a : String(a));
						return String.raw(q, ...strargs);
				},
				env: (params) => {
						({ config, TOKEN, PRODUCT, netUtil, CONSTANT, global } =
								Object.assign({ config, TOKEN, PRODUCT, netUtil, CONSTANT, global }, params));
						if (global) {
								({ config, TOKEN, PRODUCT, CONSTANT } = global);
						}
				},
				create: function (func, options = {}) {
						let cache = this.urlMap.get(func);
						const name = options.name || 'Worker';
						if (!cache) {
								const pid = `${window && window.name || 'self'}:${location.href}:${name}:${Date.now().toString(16).toUpperCase()}`;
								const src = `
				const PID = ${JSON.stringify(pid)};
				console.log('%cinit %s %s', 'font-weight: bold;', self.name || '', ${JSON.stringify(String(PRODUCT))}, location.origin);
				(${func.toString()})(self);
				`;
								const blob = new Blob([src], { type: 'text/javascript' });
								const url = URL.createObjectURL(blob);
								this.urlMap.set(func, url);
								cache = url;
						}
						if (options.type === 'SharedWorker') {
								const w = this.workerMap.get(func) || new SharedWorker(cache);
								this.workerMap.set(func, w);
								return w;
						}
						return new Worker(cache, options);
				}.bind({ urlMap: new Map(), workerMap: new Map() }),
				createCrossMessageWorker: function (func, options = {}) {
						const promises = {};
						const instanceId = this.instanceSeq++;
						let requestSeq = 0;
						const name = options.name || 'Worker';
						let state = 'starting';
						const requestTimeout = typeof options.requestTimeout === 'number' ? options.requestTimeout : DEFAULT_REQUEST_TIMEOUT;
						const rpcError = (reason, message) => Object.assign(new Error(message || reason), { name: 'WorkerRpcError', status: 'fail', reason, workerName: name });
						const rejectAll = (reason, message) => {
								for (const id of Object.keys(promises)) {
										const p = promises[id];
										delete promises[id];
										p.reject(rpcError(reason, message));
								}
						};
						const closables = [];
						const PID = `${window && window.name || 'self'}:${location.host}:${name}:${Date.now().toString(16).toUpperCase()}`;
						const _func = `
			function (self) {
			let config = {}, PRODUCT, TOKEN, CONSTANT, NAME = ${JSON.stringify(String(name))}, bcast = {}, portMap = {};
			const {Handler, PromiseHandler, Emitter} = (${EmitterInitFunc.toString()})();
			${options.inject ?? ''}
			(${func.toString()})(self);
			//===================================
			(${messageWrapper.toString()})(self);
			}
			`;
						const worker = workerUtil.create(_func, options);
						const self = options.type === 'SharedWorker' ? worker.port : worker;
						self.name = name;
						const onMessage = async function (self, e) {
								if (state === 'disposed') {
										return;
								}
								if (state === 'starting' || state === 'failed') {
										state = 'ready';
								}
								const { body, sessionId, status } = e.data;
								const { command, params } = body;
								try {
										let result = 'ok';
										let transfer = null;
										switch (command) {
												case 'commandResult':
														if (promises[sessionId]) {
																if (status === 'ok') {
																		promises[sessionId].resolve(params.result);
																}
																else {
																		promises[sessionId].reject(new Error(params.result));
																}
																delete promises[sessionId];
														}
														return;
												case 'ping':
														result = { now: Date.now(), NAME, PID, url: location.href };
														console.timeLog && console.timeLog(params.NAME, 'PONG');
														break;
												case 'emit':
														global && global.emitter.emitAsync(params.eventName, params.data);
														break;
												case 'fetch':
														result = await (netUtil || window).fetch(params.url, Object.assign({}, params.options || {}, { _format: 'arraybuffer' }));
														transfer = [result.buffer];
														break;
												case 'notify':
														global && global.notify(params.message);
														break;
												case 'alert':
														global && global.alert(params.message);
														break;
												default:
														self.oncommand && (result = await self.oncommand({ command, params }));
														break;
										}
										if (sessionId === undefined || sessionId === null) {
												return;
										}
										self.postMessage({ body: { command: 'commandResult', params: { command, result } }, sessionId, status: 'ok' }, transfer);
								}
								catch (err) {
										console.error('failed', { err, command, params, sessionId });
										if (sessionId === undefined || sessionId === null) {
												return;
										}
										self.postMessage({ body: { command: 'commandResult', params: { command, result: err.message || null } }, sessionId, status: err.status || 'fail' });
								}
						};
						const bindFunc = (self, type = 'Worker') => {
								const post = function (self, body, options = {}) {
										if (state === 'failed' || state === 'disposed') {
												return Promise.reject(rpcError(state === 'failed' ? 'failed' : 'terminated', `worker ${state}: ${name}`));
										}
										const sessionId = `send:${instanceId}:${name}:${type}:${requestSeq++}`;
										const timeout = typeof options.timeout === 'number' ? options.timeout : requestTimeout;
										let timer = null;
										return new Promise((resolve, reject) => {
												promises[sessionId] = { resolve, reject };
												self.postMessage({ body, sessionId, TYPE: type, PID }, options.transfer);
												if (timeout > 0 && timeout < Infinity) {
														timer = setTimeout(() => {
																if (!promises[sessionId]) {
																		return;
																}
																delete promises[sessionId];
																reject(rpcError('timeout', 'timeout'));
														}, timeout);
												}
										}).finally(() => {
												timer && clearTimeout(timer);
												delete promises[sessionId];
										});
								};
								const ping = async function (self, options = {}) {
										const timekey = `PING "${self.name}" total time`;
										window.console.log(`PING "${self.name}"...`);
										let result;
										options.timeout = options.timeout || 10000;
										try {
												window.console.time(timekey);
												result = await self.post({ command: 'ping', params: { now: Date.now(), NAME: self.name, PID, url: location.href } }, options);
												window.console.timeEnd(timekey);
										}
										catch (e) {
												console.timeEnd(timekey);
												console.warn('ping fail', e);
										}
										return result;
								};
								self.post = post.bind({ sessionId: 0 }, self);
								self.send = (body, transfer) => self.postMessage({ body, TYPE: type, PID }, transfer);
								self.ping = ping.bind({}, self);
								self.addEventListener('message', onMessage.bind({ sessionId: 0 }, self));
								self.addEventListener('messageerror', () => state !== 'disposed' && rejectAll('messageerror', `messageerror: ${name}`));
								self.start && self.start();
						};
						bindFunc(self);
						worker.addEventListener('error', (e) => {
								if (state === 'disposed') {
										return;
								}
								if (state === 'starting') {
										state = 'failed';
								}
								rejectAll(state === 'failed' ? 'failed' : 'error', (e && e.message) || `worker error: ${name}`);
						});
						if (self === worker && typeof worker.terminate === 'function') {
								const terminate = worker.terminate.bind(worker);
								self.terminate = () => {
										if (state === 'disposed') {
												return;
										}
										state = 'disposed';
										rejectAll('terminated', `worker terminated: ${name}`);
										for (const c of closables.splice(0)) {
												try {
														c.close();
												}
												catch (e) { /* 閉じられなくても続ける */ }
										}
										terminate();
								};
						}
						self.getRpcState = () => ({ id: instanceId, name, state, pending: Object.keys(promises).length });
						if (config) {
								self.send({
										command: 'env',
										params: { config: config.export(true), TOKEN, PRODUCT, CONSTANT }
								});
						}
						self.addPort = (port, options = {}) => {
								const name = options.name || 'MessageChannel';
								return self.post({ command: 'port', params: { port, name } }, { transfer: [port] });
						};
						const channel = new MessageChannel();
						self.addPort(channel.port2).catch(() => { });
						bindFunc(channel.port1, 'MessageChannel');
						closables.push(channel.port1);
						self.bridge = async (worker, options = {}) => {
								const name = options.name || 'MessageChannelBridge';
								const channel = new MessageChannel();
								await self.addPort(channel.port1, { name: worker.name || name });
								await worker.addPort(channel.port2, { name: self.name || name });
						};
						self.BroadcastChannel = (basename) => {
								const name = `${basename || 'Broadcast'}${TOKEN || Date.now().toString(16)}`;
								self.send({ command: 'broadcast', params: { basename, name } });
								const channel = new BroadcastChannel(name);
								bindFunc(channel, 'BroadcastChannel');
								closables.push(channel);
								return name;
						};
						self.ping()
								.catch((result) => console.warn('FAIL', result));
						return self;
				}.bind({
						instanceSeq: 0
				})
		};
		return workerUtil;
})();
const IndexedDbStorage = (() => {
		const workerFunc = function (self) {
				const db = Object.create(null);
				const initializing = new Map();
				const schemas = new Map();
				const controller = {
						async init({ name, ver, stores }) {
								if (db[name] && (ver === undefined || db[name].version === ver)) {
										return db[name];
								}
								const active = initializing.get(name);
								if (active) {
										await active.promise;
										return this.init({ name, ver, stores });
								}
								if (db[name]) {
										this.close({ name });
								}
								const schema = stores || schemas.get(name) || [];
								const entry = {};
								const pending = new Promise((resolve, reject) => {
										let settled = false, req;
										const fail = (error) => {
												if (settled) {
														return;
												}
												settled = true;
												clearTimeout(timer);
												try {
														req && req.transaction && req.transaction.abort();
												}
												catch (abortError) { }
												reject(error);
										};
										const timer = setTimeout(() => fail(new Error('IndexedDB open timed out')), 30000);
										entry.cancel = () => fail(new Error('IndexedDB open cancelled'));
										try {
												req = indexedDB.open(name, ver);
										}
										catch (error) {
												fail(error);
												return;
										}
										req.onblocked = () => fail(new Error('IndexedDB upgrade blocked by another connection'));
										req.onupgradeneeded = (e) => {
												if (settled) {
														try {
																req.transaction.abort();
														}
														catch (error) { }
														return;
												}
												try {
														const connection = e.target.result;
														for (const meta of schema) {
																const definition = meta.definition || {};
																const exists = connection.objectStoreNames.contains(meta.name);
																const store = exists ? req.transaction.objectStore(meta.name) :
																		connection.createObjectStore(meta.name, definition);
																if (exists && (JSON.stringify(store.keyPath) !== JSON.stringify(definition.keyPath ?? null) ||
																		store.autoIncrement !== !!definition.autoIncrement)) {
																		throw new Error('IndexedDB store migration requires an explicit data migration');
																}
																for (const idx of meta.indexes || []) {
																		if (store.indexNames.contains(idx.name)) {
																				const current = store.index(idx.name), params = idx.params || {};
																				if (JSON.stringify(current.keyPath) !== JSON.stringify(idx.keyPath) ||
																						current.unique !== !!params.unique || current.multiEntry !== !!params.multiEntry) {
																						throw new Error('IndexedDB index migration requires an explicit data migration');
																				}
																		}
																		else {
																				store.createIndex(idx.name, idx.keyPath, idx.params);
																		}
																}
														}
												}
												catch (error) {
														fail(error);
												}
										};
										req.onsuccess = (e) => {
												const connection = e.target.result;
												if (settled) {
														connection.close();
														return;
												}
												settled = true;
												clearTimeout(timer);
												const forget = () => { if (db[name] === connection) {
														delete db[name];
												} };
												connection.onversionchange = () => { connection.close(); forget(); };
												connection.onclose = forget;
												db[name] = connection;
												schemas.set(name, schema);
												resolve(connection);
										};
										req.onerror = (e) => fail(req.error || e);
								});
								entry.promise = pending;
								initializing.set(name, entry);
								try {
										return await pending;
								}
								finally {
										if (initializing.get(name) === entry) {
												initializing.delete(name);
										}
								}
						},
						close({ name }) {
								const active = initializing.get(name);
								if (active) {
										active.cancel();
										initializing.delete(name);
								}
								if (db[name]) {
										db[name].close();
										delete db[name];
								}
						},
						async getStore({ name, storeName, mode = 'readonly' }) {
								let connection;
								do {
										connection = await this.init({ name });
								} while (db[name] !== connection);
								const transaction = connection.transaction(storeName, mode);
								return { store: transaction.objectStore(storeName), transaction };
						},
						async _write({ name, storeName }, operation) {
								const { store, transaction } = await this.getStore({ name, storeName, mode: 'readwrite' });
								return new Promise((resolve, reject) => {
										let result, settled = false;
										const cleanup = () => {
												transaction.oncomplete = transaction.onabort = transaction.onerror = null;
										};
										const fail = (error) => {
												if (settled) {
														return;
												}
												settled = true;
												const reason = (error && error.target) ?
														(error.target.error || transaction.error || new Error('IndexedDB transaction failed')) : error;
												cleanup();
												try {
														transaction.abort();
												}
												catch (abortError) { }
												reject(reason || new Error('IndexedDB transaction failed'));
										};
										transaction.oncomplete = () => {
												if (settled) {
														return;
												}
												settled = true;
												cleanup();
												resolve(result);
										};
										transaction.onabort = transaction.onerror = fail;
										try {
												operation(store, value => { result = value; }, fail);
										}
										catch (error) {
												fail(error);
										}
								});
						},
						async put({ name, storeName, data }) {
								return this._write({ name, storeName }, (store, result, fail) => {
										const req = store.put(data);
										req.onsuccess = (e) => result(e.target.result);
										req.onerror = fail;
								});
						},
						async get({ name, storeName, data: { key, index, timeout } }) {
								const { store } = await this.getStore({ name, storeName });
								return new Promise((resolve, reject) => {
										const req = index ? store.index(index).get(key) : store.get(key);
										let timer;
										let settled = false;
										const finish = (callback, result) => {
												if (settled) {
														return;
												}
												settled = true;
												if (timer !== undefined) {
														clearTimeout(timer);
														timer = undefined;
												}
												req.onsuccess = req.onerror = null;
												callback(result);
										};
										req.onsuccess = (event) => finish(resolve, event.target.result);
										req.onerror = (event) => finish(reject, event);
										if (timeout) {
												timer = setTimeout(() => finish(reject, 'IndexedDB get timed out'), timeout);
										}
								});
						},
						async update({ name, storeName, data }) {
								return this._write({ name, storeName }, (store, result, fail) => {
										const req = data.index ? store.index(data.index).get(data.key) : store.get(data.key);
										req.onerror = fail;
										req.onsuccess = () => {
												try {
														if (data.onlyExisting && !req.result) {
																result(null);
																return;
														}
														const record = { ...(req.result || {}) };
														const safe = (key) => !['__proto__', 'constructor', 'prototype'].includes(key);
														for (const [key, value] of Object.entries(data.defaults || {})) {
																if (safe(key) && !record[key]) {
																		record[key] = value;
																}
														}
														for (const [key, value] of Object.entries(data.patch || {})) {
																if (safe(key)) {
																		record[key] = value;
																}
														}
														for (const [key, value] of Object.entries(data.increment || {})) {
																if (!safe(key) || !Number.isFinite(value)) {
																		throw new TypeError('Invalid increment');
																}
																record[key] = (Number.isFinite(record[key]) ? record[key] : 0) + value;
														}
														for (const [kind, first] of [['prepend', true], ['append', false]]) {
																for (const [key, values] of Object.entries(data[kind] || {})) {
																		if (!safe(key) || !Array.isArray(values)) {
																				throw new TypeError('Invalid list update');
																		}
																		const old = Array.isArray(record[key]) ? record[key] : [];
																		record[key] = first ? values.concat(old) : old.concat(values);
																}
														}
														for (const [key, length] of Object.entries(data.limits || {})) {
																if (!safe(key) || !Number.isSafeInteger(length) || length < 0) {
																		throw new TypeError('Invalid list limit');
																}
																if (Array.isArray(record[key])) {
																		record[key] = record[key].slice(0, length);
																}
														}
														const write = store.put(record);
														write.onerror = fail;
														write.onsuccess = () => result(record);
												}
												catch (error) {
														fail(error);
												}
										};
								});
						},
						async updateTime({ name, storeName, data: { key, index } }) {
								return this.update({ name, storeName, data: { key, index, onlyExisting: true, patch: { updatedAt: Date.now() } } });
						},
						async delete({ name, storeName, data: { key, index } }) {
								return this._write({ name, storeName }, (store, result, fail) => {
										let remove = 0;
										const range = IDBKeyRange.only(key);
										const req = index ? store.index(index).openCursor(range) : store.openCursor(range);
										req.onsuccess = (e) => {
												try {
														const cursor = e.target.result;
														if (!cursor) {
																result(remove > 0);
																return;
														}
														cursor.delete();
														remove++;
														cursor.continue();
												}
												catch (error) {
														fail(error);
												}
										};
										req.onerror = fail;
								});
						},
						async clear({ name, storeName }) {
								return this._write({ name, storeName }, (store, result, fail) => {
										const req = store.clear();
										req.onsuccess = () => result(undefined);
										req.onerror = fail;
								});
						},
						async gc({ name, storeName, data: { expireTime, index } }) {
								index = index || 'updatedAt';
								const now = Date.now(), ptime = performance.now();
								const expiresAt = (index !== 'expiresAt') ? (now - expireTime) : now;
								let count = 0;
								return this._write({ name, storeName }, (store, result, fail) => {
										const range = IDBKeyRange.upperBound(expiresAt);
										const req = store.index(index).openCursor(range);
										req.onsuccess = (e) => {
												try {
														const cursor = e.target.result;
														if (cursor) {
																count++;
																cursor.delete();
																cursor.continue();
														}
														else {
																result({ status: 'ok', count, time: performance.now() - ptime });
														}
												}
												catch (error) {
														fail(error);
												}
										};
										req.onerror = fail;
								}).catch((e) => {
										console.warn('IndexedDB cache cleanup failed');
										throw e;
								});
						}
				};
				self.onmessage = async ({ command, params }) => {
						try {
								switch (command) {
										case 'init':
												await controller[command](params);
												return 'ok';
										case 'put':
												return controller.put(params);
										case 'updateTime':
										case 'get':
												return controller[command](params);
										default:
												return controller[command](params) || 'ok';
								}
						}
						catch (err) {
								console.warn('command failed: ', { command, params });
								throw err;
						}
				};
				return controller;
		};
		const workers = new Map();
		const open = async ({ name, ver, stores }, func) => {
				let worker;
				if (func) {
						let _func = workerFunc;
						if (func) {
								_func = `
				(() => {
				const controller = (${workerFunc.toString()})(self);
				(${func.toString()})(self)
				})
				`;
						}
						worker = workers.get(func) || workerUtil.createCrossMessageWorker(_func, { name: `IndexedDb[${name}]` });
						workers.set(func, worker);
				}
				else {
						worker = workers.get(workerFunc) || workerUtil.createCrossMessageWorker(workerFunc, { name: 'IndexedDb' });
						workers.set(workerFunc, worker);
				}
				await worker.post({ command: 'init', params: { name, ver, stores } });
				const post = (command, data, storeName, transfer) => {
						const params = { data, name, storeName, transfer };
						return worker.post({ command, params }, { transfer });
				};
				const result = { worker };
				for (const meta of stores) {
						const storeName = meta.name;
						result[storeName] = (storeName => {
								return {
										close: (params) => post('close', params, storeName),
										put: (record, transfer) => post('put', record, storeName, transfer),
										update: (data) => post('update', data, storeName),
										get: ({ key, index, timeout }) => post('get', { key, index, timeout }, storeName),
										updateTime: ({ key, index, timeout }) => post('updateTime', { key, index, timeout }, storeName),
										delete: ({ key, index, timeout }) => post('delete', { key, index, timeout }, storeName),
										gc: (expireTime = 30 * 24 * 60 * 60 * 1000, index = 'updatedAt') => post('gc', { expireTime, index }, storeName)
								};
						})(storeName);
				}
				return result;
		};
		return { open };
})();
const ThumbInfoCacheDb = (() => {
		const THUMB_INFO = {
				name: 'thumb-info',
				ver: 1,
				stores: [
						{
								name: 'cache',
								indexes: [
										{ name: 'postedAt', keyPath: 'postedAt', params: { unique: false } },
										{ name: 'updatedAt', keyPath: 'updatedAt', params: { unique: false } }
								],
								definition: { keyPath: 'watchId', autoIncrement: false }
						}
				]
		};
		let db;
		const open = async () => {
				db = db || await IndexedDbStorage.open(THUMB_INFO);
				const cacheDb = db['cache'];
				cacheDb.gc(90 * 24 * 60 * 60 * 1000).catch(() => console.warn('Thumbnail cache cleanup failed'));
				return {
						put: async (xml, thumbInfo = null) => {
								thumbInfo = thumbInfo || parseThumbInfo(xml);
								if (thumbInfo.status !== 'ok') {
										return;
								}
								const watchId = thumbInfo.v;
								const videoId = thumbInfo.id;
								const postedAt = new Date(thumbInfo.postedAt).getTime();
								const updatedAt = Date.now();
								const record = {
										watchId,
										videoId,
										postedAt,
										updatedAt,
										xml,
										thumbInfo
								};
								await cacheDb.put(record);
								return { watchId, updatedAt };
						},
						get: (watchId) => cacheDb.updateTime({ key: watchId }),
						delete: (watchId) => cacheDb.delete({ key: watchId }),
						close: () => cacheDb.close()
				};
		};
		return { open };
})();
window.MylistPocketLib = {
  workerUtil
};
const thumbInfoApi = async function() {
const gate = () => {
		const post = function (body, { type, token, sessionId, origin } = {}) {
				sessionId = sessionId || '';
				origin = origin || '';
				this.origin = origin = origin || this.origin || document.referrer;
				this.token = token = token || this.token;
				this.type = type = type || this.type;
				if (!this.channel) {
						this.channel = new MessageChannel;
				}
				const url = location.href;
				const id = PRODUCT;
				try {
						const msg = { id, type, token, url, sessionId, body };
						if (!this.port) {
								msg.body = { command: 'initialized', params: msg.body };
								parent.postMessage(msg, origin, [this.channel.port2]);
								this.port = this.channel.port1;
								this.port.start();
						}
						else {
								this.port.postMessage(msg);
						}
				}
				catch (e) {
						console.error('%cError: parent.postMessage - ', 'color: red; background: yellow', e);
				}
				return this.port;
		}.bind({ channel: null, port: null, origin: null, token: null, type: null });
		const parseUrl = (url) => {
				url = url || 'https://unknown.example.com/';
				const a = document.createElement('a');
				a.href = url;
				return a;
		};
		const isNicoServiceHost = (url) => {
				const host = parseUrl(url).hostname;
				return /(^[a-z0-9.-]*\.nicovideo\.jp$|^[a-z0-9.-]*\.nico(|:[0-9]+)$)/.test(host);
		};
		const isWhiteHost = (url) => {
				const u = parseUrl(url);
				const host = u.hostname;
				if (['account.nicovideo.jp', 'point.nicovideo.jp'].includes(host)) {
						return false;
				}
				if (isNicoServiceHost(url)) {
						return true;
				}
				if (['localhost', '127.0.0.1'].includes(host)) {
						return true;
				}
				if (localStorage.ZenzaWatch_whiteHost) {
						if (localStorage.ZenzaWatch_whiteHost.split(',').includes(host)) {
								return true;
						}
				}
				if (u.protocol !== 'https:') {
						return false;
				}
				return [
						'google.com',
						'www.google.com',
						'www.google.co.jp',
						'www.bing.com',
						'twitter.com',
						'friends.nico',
						'feedly.com',
						'www.youtube.com',
				].includes(host) || host.endsWith('.slack.com');
		};
		const uFetch = async (params, consume = (response => response)) => {
				const { url, options: requestOptions = {} } = params;
				if (!isWhiteHost(url) || !isNicoServiceHost(url)) {
						return Promise.reject({ status: 'fail', message: 'network error' });
				}
				const options = { ...requestOptions };
				const callerSignal = options.signal;
				const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
				const abortReason = () => callerSignal.reason !== undefined ? callerSignal.reason :
						Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
				const timeout = (typeof options.timeout === 'number' && !isNaN(options.timeout)) ? options.timeout :
						(typeof params.timeout === 'number' && !isNaN(params.timeout)) ? params.timeout : 30 * 1000;
				const racers = [];
				let timer;
				let onAbort;
				try {
						if (callerSignal && callerSignal.aborted) {
								throw abortReason();
						}
						if (controller) {
								options.signal = controller.signal;
						}
						if (callerSignal) {
								racers.push(new Promise((resolve, reject) => {
										onAbort = () => {
												const reason = abortReason();
												reject(reason);
												if (controller) {
														controller.abort(reason);
												}
										};
										callerSignal.addEventListener('abort', onAbort, { once: true });
								}));
						}
						if (timeout > 0) {
								racers.push(new Promise((resolve, reject) => {
										timer = setTimeout(() => {
												const error = Object.assign(new Error('timeout'), { name: 'timeout' });
												reject(error);
												if (controller) {
														controller.abort(error);
												}
										}, timeout);
								}));
						}
						racers.push(fetch(url, options).then(consume));
						return await Promise.race(racers);
				}
				catch (err) {
						throw { status: 'fail', message: err && err.name === 'timeout' ? 'timeout' : 'uFetch fail' };
				}
				finally {
						if (timer !== undefined) {
								clearTimeout(timer);
						}
						if (callerSignal && onAbort) {
								callerSignal.removeEventListener('abort', onAbort);
						}
				}
		};
		const fetchSessions = new Map();
		const xFetch = (params, sessionId = null) => {
				const command = 'fetch';
				const controller = new AbortController();
				fetchSessions.set(sessionId, controller);
				const request = { ...params, options: { ...params.options, signal: controller.signal } };
				return uFetch(request, async (resp) => {
						const buffer = await resp.arrayBuffer();
						const init = ['type', 'url', 'redirected', 'status', 'ok', 'statusText']
								.reduce((map, key) => { map[key] = resp[key]; return map; }, {});
						const headers = [...resp.headers.entries()];
						return { buffer, init, headers };
				}).then(({ buffer, init, headers }) => {
						const result = { status: 'ok', command, params: { buffer, init, headers } };
						post(result, { sessionId });
						return result;
				}).catch(({ status, message }) => {
						post({ status, message, command }, { sessionId });
				}).finally(() => {
						if (fetchSessions.get(sessionId) === controller) {
								fetchSessions.delete(sessionId);
						}
				});
		};
		const init = ({ prefix, type }) => {
				if (!window.name.startsWith(prefix)) {
						throw new Error(`unknown name "${window.name}"`);
				}
				const PID = `${window && window.name || 'self'}:${location.host}:${name}:${Date.now().toString(16).toUpperCase()}`;
				type = type || window.name.replace(new RegExp(`/(${PRODUCT}|)Loader$/`), '');
				const origin = document.referrer || window.name.split('#')[1];
				console.log('%cCrossDomainPort: host:%s window:%s', 'background: lightgreen;', location.host, window.name.split('#')[0]);
				if (!isWhiteHost(origin)) {
						throw new Error(`disable bridge "${origin}"`);
				}
				const TOKEN = location.hash ? location.hash.substring(1) : null;
				window.history.replaceState(null, null, location.pathname);
				const port = post({ status: 'ok', command: 'initialized' }, { type, token: TOKEN, origin });
				port.addEventListener('message', event => {
						let data;
						try {
								data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
						}
						catch (_) {
								return;
						}
						if (!data || data.token !== TOKEN || !data.body || data.body.command !== 'cancelFetch') {
								return;
						}
						event.stopImmediatePropagation();
						const controller = fetchSessions.get(data.body.params && data.body.params.sessionId);
						if (controller) {
								controller.abort();
						}
				});
				workerUtil && workerUtil.env({ TOKEN, PRODUCT });
				return { port, TOKEN, origin, type, PID };
		};
		return { post, parseUrl, isNicoServiceHost, isWhiteHost, uFetch, xFetch, init };
};
  const {post, parseUrl, uFetch, init} = gate();
  // Finish asynchronous setup before advertising readiness: the parent sends its
  // first request as soon as init() opens the already-started message port.
  const db = await ThumbInfoCacheDb.open().catch(() => null);
  const {port, TOKEN} = init({prefix: `thumbInfo${PRODUCT}`, type: 'thumbInfo'});
  port.addEventListener('message', async e => {
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    const {body, sessionId, token} = data;
    const {command, params} = body;
    if (command !== 'fetch') { return; }
    const p = parseUrl(params.url);
    if (TOKEN !== token ||
      p.hostname !== location.host ||
      !p.pathname.startsWith('/api/getthumbinfo/')) {
      console.log('invalid msg: ', {origin: e.origin, tokenMatches: TOKEN === token, command: body && body.command});
      return;
    }
    params.options = params.options || {};

    const watchId = params.url.split('/').reverse()[0];
    const expiresAt = Date.now() - (params.options.expireTime || 0);
    const cache = db ? await db.get(watchId).catch(() => null) : null;
    if (cache && cache.thumbInfo.status === 'ok' && cache.updatedAt > expiresAt) {
      return post({status: 'ok', command, params: cache.thumbInfo}, {sessionId});
    }


    delete params.options.credentials;
    return uFetch(params, sessionId)
      .then(res => res.text())
      .then(async xmlText => {
        let thumbInfo = parseThumbInfo(xmlText);
        if (thumbInfo.status === 'ok') {
          if (db) db.put(xmlText, thumbInfo).catch(() => console.warn('Thumbnail cache write failed'));
        } else if (cache && cache.thumbInfo.status === 'ok') {
          thumbInfo = cache.thumbInfo;
        }
        const result = {status: 'ok', command, params: thumbInfo};
        post(result, {sessionId});
      }).catch(({status, message}) => {
        if (cache && cache.thumbInfo.status === 'ok') {
          return post({status: 'ok', command, params: cache.thumbInfo}, {sessionId});
        }
        return post({status, message, command}, {sessionId});
      });
  });
};

  const loadGm = () => {
    const script = document.createElement('script');
    script.id = `${PRODUCT}Loader`;
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('charset', 'UTF-8');
    script.append(`
    (() => {
      const {Handler, PromiseHandler, Emitter} = (${EmitterInitFunc.toString()})();
      ${parseThumbInfo.toString()}

      (${monkey.toString()})("${PRODUCT}");
    })();`);
    (document.head || document.documentElement).append(script);
  };

  const host = window.location.host || '';
  if (host === 'ext.nicovideo.jp' &&
      window.name.indexOf(`thumbInfo${PRODUCT}Loader`) >= 0) {
    thumbInfoApi();
  } else if (window === top) {
    loadGm();
  }
});

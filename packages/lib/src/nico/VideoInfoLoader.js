import {netUtil} from '../infra/netUtil';
import {textUtil} from '../text/textUtil';
import {nicoUtil} from '../nico/nicoUtil';
import {Emitter} from '../Emitter';
import {CacheStorage} from '../infra/CacheStorage';
import {CommentPostTarget} from './CommentPostTarget';

const Config = {
  getValue: () => {}
};

const emitter = new Emitter();
const debug = {};

// GENERATED FROM tools/typescript-stage1/nico-src/VideoInfoLoader.ts (Task649). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require CommentPostTarget
const VideoInfoLoader = (function () {
    const cacheStorage = new CacheStorage(sessionStorage);
    // NICOCOMPAT-04 / Task455: validate only the structural fields that the
    // existing V4-to-legacy conversion must dereference. A missing optional
    // comment/media/owner section is not itself a schema failure.
    const validWatchV4Structure = (data) => {
        const record = (value) => value !== null && typeof value === 'object' &&
            !Array.isArray(value);
        return record(data) &&
            record(data.client) &&
            typeof data.client.watchId === 'string' && !!data.client.watchId &&
            (data.client.watchTrackId === undefined ||
                typeof data.client.watchTrackId === 'string') &&
            record(data.video) && typeof data.video.id === 'string' && !!data.video.id &&
            typeof data.video.title === 'string' &&
            typeof data.video.duration === 'number' &&
            Number.isFinite(data.video.duration) && data.video.duration >= 0 &&
            record(data.video.count) &&
            (data.video.thumbnail == null || record(data.video.thumbnail)) &&
            record(data.player) && record(data.genre) &&
            record(data.tags) && Array.isArray(data.tags.items) &&
            data.tags.items.every(record);
    };
    // Task153: adapt watch v4 at the boundary; keep the existing player contract.
    const normalizeWatchV4 = async (response, requestedWatchId) => {
        const data = response?.$watchV4?.data;
        if (!data || response.errorCode)
            return response;
        if (data.errorCode)
            return data;
        if (!validWatchV4Structure(data)) {
            // Never retain raw responses, URLs or key material in diagnostics.
            return { errorCode: 'WATCH_SCHEMA', reasonCode: 'MALFORMED_WATCH_V4' };
        }
        // Lazy keys are bound to the requested ID (including numeric channel IDs).
        // Optional owner/series metadata must not make otherwise playable media fail.
        let lazy = {};
        if (data.lazy?.authKey && typeof data.client.watchTrackId === 'string' &&
            !!data.client.watchTrackId) {
            try {
                const result = await netUtil.fetch(`https://nvapi.nicovideo.jp/v4/watch/lazy/${encodeURIComponent(requestedWatchId)}`, {
                    method: 'POST', credentials: 'include', timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json', 'X-Frontend-Id': '6',
                        'X-Frontend-Version': '0', 'X-Request-With': 'https://www.nicovideo.jp'
                    },
                    body: JSON.stringify({ actionTrackId: data.client.watchTrackId, keyToken: data.lazy.authKey })
                }).then(res => res.json());
                if (result.meta?.status === 200)
                    lazy = result.data || {};
            }
            catch (_) {
                window.console.warn('watch v4 optional metadata unavailable');
            }
        }
        // Task182 (F05): lazy owner first; otherwise keep the identity carried by the
        // initial V4 data, accepting only a channel ID (ch+digits) or a numeric user ID.
        const initialOwner = data.metadata?.jsonLd?.owner;
        const fallbackOwner = (() => {
            if (!initialOwner || typeof initialOwner !== 'object') {
                return null;
            }
            const id = String(initialOwner.id ?? '');
            const icon = typeof initialOwner.iconUrl === 'string' ? initialOwner.iconUrl : undefined;
            if (initialOwner.type === 'channel' && /^ch\d+$/.test(id)) {
                return { type: 'channel', id, name: initialOwner.name, thumbnail: { url: icon, smallUrl: icon } };
            }
            if (initialOwner.type === 'user' && /^\d+$/.test(id)) {
                return { type: 'user', id, nickname: initialOwner.name, icon: { url: icon } };
            }
            return null;
        })();
        const owner = lazy.owner?.type === 'channel' || lazy.owner?.type === 'user' ? lazy.owner : fallbackOwner;
        // Task183 (F07): a missing/partial comment structure must not break video parsing,
        // but it is recorded as an issue instead of being silently treated as normal.
        const comment = data.comment && typeof data.comment === 'object' ? data.comment : {};
        const commentIssues = [];
        if (!data.comment || typeof data.comment !== 'object') {
            commentIssues.push('comment');
        }
        if (!Array.isArray(comment.threads)) {
            commentIssues.push('threads');
        }
        if (!Array.isArray(comment.layers)) {
            commentIssues.push('layers');
        }
        const media = data.media;
        return {
            ...data,
            channel: owner?.type === 'channel' ? { ...owner, thumbnail: owner.thumbnail || {} } : null,
            owner: owner?.type === 'user' ? { ...owner, iconUrl: owner.icon?.url } : null,
            series: lazy.series ?? null,
            // Task172 (F01): V4 has no content-tree flag. Keep it unknown (null) instead of
            // inventing false; an explicit boolean, if present, is preserved.
            external: { commons: { hasContentTree: typeof data.external?.commons?.hasContentTree === 'boolean' ? data.external.commons.hasContentTree : null } },
            tag: data.tags,
            video: {
                ...data.video,
                thumbnail: {
                    ...data.video.thumbnail,
                    url: data.video.thumbnail?.normal ?? data.video.thumbnail?.url,
                    middleUrl: data.video.thumbnail?.middle ?? data.video.thumbnail?.middleUrl,
                    largeUrl: data.video.thumbnail?.large ?? data.video.thumbnail?.largeUrl
                },
                viewer: { like: { isLiked: data.video.isLikedByViewer === true } }
            },
            comment: {
                ...comment, keys: {}, server: { url: comment.nvComment?.server },
                ng: { ...comment.ng, channel: comment.ng?.channel || [], owner: comment.ng?.owner || [] },
                threads: (Array.isArray(comment.threads) ? comment.threads : [])
                    .map((thread) => ({ ...thread, isDefaultPostTarget: thread.isPostTarget === true })),
                layers: (Array.isArray(comment.layers) ? comment.layers : []).map((layer) => {
                    if (!Array.isArray(layer?.components)) {
                        commentIssues.push('components');
                    }
                    return { ...layer,
                        threadIds: (Array.isArray(layer?.components) ? layer.components : [])
                            .map(({ threadId, fork }) => ({ id: threadId, fork })) };
                }),
                metadataIssues: commentIssues
            },
            media: { delivery: null, domand: media?.accessRightKey && media.contents ? {
                    ...media.contents, accessRightKey: media.accessRightKey,
                    isStoryboardAvailable: media.isStoryboardAvailable
                } : null },
            payment: { video: {
                    isAdmission: data.payment?.admission?.isEnabled === true,
                    isPpv: data.payment?.ppv?.isEnabled === true,
                    isPremium: data.payment?.premium?.isEnabled === true
                } }
        };
    };
    const parseWatchApiData = async function (json, requestedWatchId) {
        const response = await normalizeWatchV4(json?.data?.response, requestedWatchId);
        if (!response) {
            return null;
        }
        // Task 091: 削除済み・不存在などの watch API エラー応答は、通常動画の
        // client/comment/media 等を持たない。通常動画として分割代入すると、本来の
        // errorCode を読む前に TypeError になり、連続再生の「次へ」判定にも届かない。
        if (response.errorCode || !response.client) {
            const statusCode = response.statusCode || null;
            const errorCode = response.errorCode || null;
            const reasonCode = response.reasonCode || null;
            const isNotFound = errorCode === 'NOT_FOUND';
            const isForbidden = errorCode === 'FORBIDDEN';
            let message = response.deletedMessage || '';
            if (!message) {
                if (reasonCode === 'ADMINISTRATOR_DELETE_VIDEO') {
                    message = 'この動画は削除されています';
                }
                else if (isNotFound) {
                    message = '動画が見つかりません';
                }
                else if (isForbidden) {
                    message = 'この動画は視聴できません';
                }
                else {
                    message = '動画情報の取得に失敗しました';
                }
            }
            return {
                reject: true,
                reason: isNotFound ? 'not found' : (isForbidden ? 'forbidden' : 'watch api'),
                message,
                statusCode,
                errorCode,
                reasonCode
            };
        }
        const _data = response;
        // Fields read from the normalized response. Nullable: channel, community, owner,
        // media.delivery (dmcInfo), media.domand, player.initialPlayback, video.viewer, viewer.
        // genre.label is shown in the header (Task 074). Unused fields of the watch response
        // (ads, ranking, waku, video.rating ...) are deliberately not listed here: comments
        // inside the pattern were folded by tsc into trailing-whitespace lines (Task650).
        const { channel, client: { watchId, watchTrackId, }, comment: { keys: { userKey, }, layers, ng: { channel: channelNg, owner: ownerNg, }, nvComment, server: { url: commentServer, }, threads, }, community, external: { commons: { hasContentTree, }, }, genre: { key: genreKey, label: genreLabel, }, media: { delivery: dmcInfo, domand: domandInfo, }, owner, payment: { video: { isAdmission: isMemberFree, isPpv: isNeedPayment, isPremium: isPremiumFree, }, }, player: { initialPlayback, }, series, tag: { edit: tagEdit, items: tags, }, video: { count: { comment: commentCount, like: likeCount, mylist: mylistCount, view: viewCount, }, description, duration, id: videoId, registeredAt, thumbnail: { largeUrl: thumbnailUrl, url: thumbnail, player: largeThumbnail, }, title, viewer: videoStatusForViewer, }, viewer, } = _data;
        const hasLargeThumbnail = nicoUtil.hasLargeThumbnail(videoId);
        const csrfToken = null;
        const watchAuthKey = null;
        threads.forEach((thread) => {
            thread.layer = layers.find(({ threadIds }) => {
                return threadIds.some(({ id, fork }) => id === thread.id && fork === thread.fork);
            });
        });
        const resumeInfo = (() => {
            const { type = '', positionSec = null, } = { ...initialPlayback };
            return {
                initialPlaybackType: type,
                initialPlaybackPosition: positionSec ?? 0,
            };
        })();
        const isLiked = videoStatusForViewer?.like.isLiked ?? false;
        const viewerInfo = (() => {
            const { id = 0, isPremium = false, } = { ...viewer };
            return { id, isPremium };
        })();
        // Task183 (F07): no post target -> comments can still be read, but posting is
        // disabled explicitly; never fall back to an arbitrary thread such as threads[0].
        const commentMetadataIssues = Array.isArray(_data.comment?.metadataIssues) ? _data.comment.metadataIssues : [];
        const postTarget = CommentPostTarget.select(threads, commentMetadataIssues);
        const { defaultThread, threadId, canPost, postUnavailableReason, optionalThreads } = postTarget;
        const msgInfo = {
            server: commentServer,
            threadId,
            canPost,
            postUnavailableReason,
            commentMetadataIssues,
            duration,
            videoId,
            nvComment,
            userId: viewerInfo.id,
            isNeedKey: threads.findIndex((t) => t.isThreadkeyRequired) >= 0, // (isChannel || isCommunity)
            optionalThreadId: '',
            defaultThread,
            optionalThreads,
            threads,
            userKey,
            hasOwnerThread: threads.find((t) => t.isOwnerThread),
            when: null,
            frontendId: 6,
            frontendVersion: 0
        };
        const isDmc = dmcInfo?.movie.session != null;
        const isDomand = domandInfo != null;
        const isPlayable = isDmc || isDomand;
        cacheStorage.setItem('csrfToken', csrfToken, 30 * 60 * 1000);
        const playlist = { playlist: [] };
        const tagList = tags.map((tag) => {
            const { isLocked, isNicodicArticleExists, name, } = tag;
            return {
                _data: tag,
                isLocked,
                isNicodicArticleExists,
                name,
            };
        });
        let channelInfo, channelId, uploaderInfo = null;
        if (channel) {
            const { id, name, thumbnail: { smallUrl, url, }, } = { ...channel };
            channelInfo = {
                iconUrl: smallUrl ?? url ?? undefined,
                id,
                linkId: id,
                name,
            };
            channelId = id;
        }
        if (owner) {
            const { iconUrl, id, nickname, } = { ...owner };
            uploaderInfo = {
                iconUrl,
                id,
                linkId: `user/${id}`,
                name: nickname,
            };
        }
        const watchApiData = {
            videoDetail: {
                v: watchId,
                id: videoId,
                title,
                // title_original: data.video.originalTitle,
                description,
                // description_original: data.video.originalDescription,
                postedAt: registeredAt,
                thumbnail,
                largeThumbnail,
                length: duration,
                commons_tree_exists: hasContentTree,
                // width: data.video.width, // dmcInfo?.movie.videos[0].metadata.resolution.width
                // height: data.video.height, // dmcInfo?.movie.videos[0].metadata.resolution.height
                isChannel: channel && channel.id,
                isMymemory: false,
                communityId: community?.id ?? null,
                isLiked,
                channelId,
                commentCount,
                likeCount,
                mylistCount,
                viewCount,
                tagList,
                tagEdit,
            },
            viewerInfo,
            channelInfo,
            uploaderInfo,
            clientTrackId: watchTrackId,
        };
        const ngFilters = Array.prototype.concat(channelNg, ownerNg);
        const result = {
            _format: 'html5watchApi',
            _data,
            watchApiData,
            domandInfo,
            dmcInfo,
            msgInfo,
            playlist,
            isPlayable,
            isDomand,
            isDmc,
            thumbnailUrl,
            csrfToken,
            watchAuthKey,
            series,
            genreKey,
            genreLabel,
            ngFilters,
            isMemberFree,
            isNeedPayment,
            isPremiumFree,
            linkedChannelVideo: null,
            resumeInfo,
        };
        emitter.emitAsync('csrfTokenUpdate', csrfToken);
        return result;
    };
    const loadLinkedChannelVideoInfo = (originalData) => {
        const linkedChannelVideo = originalData.linkedChannelVideo;
        const originalVideoId = originalData.watchApiData.videoDetail.id;
        const videoId = linkedChannelVideo.linkedVideoId;
        if (originalVideoId === videoId) {
            originalData.linkedChannelVideo = null;
            // Task650: never reject without a reason (callers read err.reason).
            return Promise.reject({ reason: 'not supported', message: 'この動画はZenzaWatchで再生できません' });
        }
        window.console.info('%cloadLinkedChannelVideoInfo', 'background: cyan');
        return new Promise(r => {
            setTimeout(r, 1000);
        }).then(() => fetchWatchResponse(videoId, {}))
            .then(async (json) => {
            const data = await parseWatchApiData(json, videoId);
            //window.console.info('linkedChannelData', data);
            originalData.dmcInfo = data.dmcInfo;
            originalData.domandInfo = data.domandInfo;
            originalData.isPlayable = data.isPlayable;
            originalData.isDmc = data.isDmc;
            originalData.isDomand = data.isDomand;
            return originalData;
        })
            .catch(() => {
            originalData.linkedChannelVideo = null;
            return Promise.reject({ reason: 'network', message: '通信エラー(loadLinkedChannelVideoInfo)' });
        });
    };
    /**
     * Task 066: 投稿者欄が空（視聴情報の owner が null）の動画で、投稿者IDを補完する。
     *
     * 退会・非公開扱いの投稿者の動画では視聴情報に owner が無く、
     * 「投稿者の動画を検索」等で投稿者IDが NaN になって壊れていた。
     * Codexのニコニコ解析（NICO-COMMUNITY-20260914-AD-METADATA /
     * NICO-SNAPSHOT-LIVE-20260914-OWNER）で、
     *  1. 広告の単独動画情報 GET api.nicoad.nicovideo.jp/v1/contents/video/{id}
     *     の ownerId（認証不要・www からCORS可）
     *  2. スナップショット検索の userId
     * のどちらからも投稿者IDが取れ、sm46778748 で両者が一致することを実通信で確認済み。
     * 1で取れなければ2を試す。どちらも駄目なら従来通り（IDなし）のまま。
     * 投稿者の退会/非公開状態そのものは判断しない（名前は分からないので従来の表示のまま）。
     */
    const resolveMissingOwner = async (data) => {
        const wad = data && data.watchApiData;
        if (!wad || wad.channelInfo || (wad.uploaderInfo && wad.uploaderInfo.id)) {
            return;
        }
        const videoId = wad.videoDetail && wad.videoDetail.id;
        if (!videoId || !/^(sm|nm)\d+$/.test(videoId)) {
            return;
        }
        let ownerId = null, ownerName = null, ownerIcon = null, source = '';
        try {
            const res = await netUtil.fetch(`https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}`, { credentials: 'omit', timeout: 3000 });
            if (res && res.ok) {
                const json = await res.json();
                const d = json && json.data;
                if (d && String(d.id) === videoId && d.ownerId) {
                    ownerId = d.ownerId;
                    ownerName = d.ownerName || null;
                    ownerIcon = d.ownerIcon || null; // Task 069: 広告APIは投稿者アイコンURLも返す
                    source = 'nicoad';
                }
            }
        }
        catch (e) {
            // 広告履歴の無い動画は404。次の手段へ
        }
        if (!ownerId && typeof NicoSearchApiV2Loader !== 'undefined' && NicoSearchApiV2Loader.lookupOwnerIds) {
            try {
                const map = await Promise.race([
                    NicoSearchApiV2Loader.lookupOwnerIds([videoId]),
                    new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);
                const hit = map.get(videoId);
                if (hit && hit.userId) {
                    ownerId = hit.userId;
                    source = 'snapshot';
                }
            }
            catch (e) {
                window.console.warn('投稿者IDの補完(snapshot)に失敗', videoId, e);
            }
        }
        if (!ownerId) {
            window.console.info('投稿者IDを補完できませんでした', videoId);
            return;
        }
        wad.uploaderInfo = {
            iconUrl: ownerIcon || undefined,
            id: ownerId,
            linkId: `user/${ownerId}`,
            name: ownerName || undefined,
            isSupplemented: true,
            supplementedFrom: source
        };
        window.console.info('%c投稿者IDを補完しました', 'background: lightgreen;', { videoId, ownerId, source });
    };
    const onLoadPromise = async (watchId, options, isRetry, resp) => {
        const data = await parseWatchApiData(resp, watchId);
        debug.watchApiData = data;
        if (!data) {
            throw {
                reason: 'network',
                message: '通信エラー。動画情報の取得に失敗しました。(watch api)'
            };
        }
        if (data.reject) {
            throw data;
        }
        await resolveMissingOwner(data).catch(e => window.console.warn('resolveMissingOwner', e));
        if (data.isPlayable) {
            emitter.emitAsync('loadVideoInfo', data, 'WATCH_API', watchId);
            return data;
        }
        if (data.isNeedPayment && data.genreKey === 'anime' && Config.getValue('loadLinkedChannelVideo')) {
            const query = new URLSearchParams({ videoId: data.watchApiData.videoDetail.id, _frontendId: data.msgInfo.frontendId });
            const url = `https://public-api.ch.nicovideo.jp/v1/user/channelVideoDAnimeLinks?${query.toString()}`;
            const linkedChannelVideos = await netUtil.fetch(url, { credentials: 'include' }).then(r => r.json()).catch(() => ({}));
            data.linkedChannelVideo = linkedChannelVideos.data?.items?.find((ch) => {
                return !!ch.isChannelMember;
            });
            // Task650 (VI-LINKED-REJECT-001): a "linked" video with the same ID used to reject
            // with no reason, which then crashed the retry handler (TypeError) and hid the
            // payment message. Treat it as no linked video and report the payment error below.
            if (data.linkedChannelVideo != null &&
                data.linkedChannelVideo.linkedVideoId === data.watchApiData.videoDetail.id) {
                data.linkedChannelVideo = null;
            }
            if (data.linkedChannelVideo != null) {
                return await loadLinkedChannelVideoInfo(data);
            }
        }
        const error = (({ isMemberFree, isNeedPayment, isPremiumFree }) => {
            if (!isNeedPayment && isPremiumFree) {
                return {
                    reason: 'premium only',
                    message: 'プレミアム会員限定',
                };
            }
            if (!isNeedPayment && isMemberFree) {
                return {
                    reason: 'member only',
                    message: 'CH会員限定',
                };
            }
            if (!isNeedPayment) {
                return {
                    reason: 'not supported',
                    message: 'この動画はZenzaWatchで再生できません',
                };
            }
            let err = {
                reason: 'need payment',
                message: 'この動画は有料です',
            };
            if (isPremiumFree) {
                err.message += ' (プレミアム会員無料)';
            }
            if (isMemberFree) {
                err.message += ' (CH会員無料)';
            }
            return err;
        })(data);
        throw {
            ...error,
            info: data,
        };
    };
    // Task174 (F14): normal logs carry only shareable fields. err.info holds the
    // converted watch response (lazy/auth/access-right/thread keys, signed URLs).
    const safeLoadError = (err) => (err && typeof err === 'object') ? {
        reason: err.reason, message: err.message, type: err.type, name: err.name,
        errorCode: err.errorCode ?? err.info?.errorCode ?? null,
        statusCode: err.statusCode ?? err.info?.statusCode ?? null,
        isPlayable: err.info?.isPlayable, isNeedPayment: err.info?.isNeedPayment
    } : { message: String(err) };
    const createSleep = function (sleepTime) {
        return new Promise(resolve => setTimeout(resolve, sleepTime));
    };
    // Task904: The official watch page embeds the current watch-v4 response in
    // <meta name="server-response">. The old responseType=json URL now returns
    // HTTP 400 for otherwise playable videos (observed 2026-10-20).
    const parseWatchPageResponse = (html) => {
        const page = new DOMParser().parseFromString(html, 'text/html');
        const raw = page.querySelector('meta[name="server-response"]')?.getAttribute('content');
        if (!raw)
            return null;
        try {
            const json = JSON.parse(raw);
            if (json && typeof json === 'object' && json.data?.response &&
                typeof json.data.response === 'object') {
                return json;
            }
        }
        catch (_) { /* Invalid embedded JSON: report only a safe error code. */ }
        throw {
            reason: 'watch api', errorCode: 'WATCH_PAGE_SCHEMA',
            message: '公式動画ページの情報形式を読み取れませんでした'
        };
    };
    const fetchWatchResponse = async (watchId, options) => {
        const pageUrl = `https://www.nicovideo.jp/watch/${encodeURIComponent(watchId)}` +
            (options.economy === true ? '?eco=1' : '');
        const pageResponse = await netUtil.fetch(pageUrl, { credentials: 'include' });
        // Older test/extension adapters may offer json() only.
        if (typeof pageResponse.text !== 'function') {
            return pageResponse.json();
        }
        if (pageResponse.status >= 500) {
            throw { reason: 'network', message: '通信エラー(network)' };
        }
        const html = await pageResponse.text();
        const embedded = parseWatchPageResponse(html);
        if (embedded)
            return embedded;
        // Keep supporting layouts without the embedded metadata (e.g. older
        // channel/error pages), without making the legacy endpoint the normal path.
        const legacyUrl = pageUrl + (options.economy === true ? '&' : '?') + 'responseType=json';
        const legacyResponse = await netUtil.fetch(legacyUrl, { credentials: 'include' });
        try {
            const json = await legacyResponse.json();
            if (json?.data?.response)
                return json;
        }
        catch (_) { /* Legacy endpoint may return HTML or 400 without JSON. */ }
        throw {
            reason: 'watch api', errorCode: 'WATCH_PAGE_META_MISSING',
            message: '動画情報が見つかりません（公式ページの構造を要確認）'
        };
    };
    const loadPromise = function (watchId, options, isRetry = false) {
        console.log('%cloadFromWatchApiData...', 'background: lightgreen;', watchId);
        return fetchWatchResponse(watchId, options)
            .catch(err => Promise.reject(err && typeof err === 'object' && err.reason ? err :
            { reason: 'network', message: '通信エラー(network)' }))
            .then(onLoadPromise.bind(this, watchId, options, isRetry))
            .catch((err) => {
            window.console.error('err', { err: safeLoadError(err), isRetry, watchId });
            if (isRetry) {
                return Promise.reject({
                    watchId,
                    message: err.message || '動画情報の取得に失敗したか、未対応の形式です',
                    type: 'watchapi'
                });
            }
            if (err.reason === 'forbidden' || err.reason === 'not found') {
                return Promise.reject({ ...err, watchId });
            }
            else if (err.reason === 'watch api' &&
                ['WATCH_SCHEMA', 'WATCH_PAGE_SCHEMA', 'WATCH_PAGE_META_MISSING'].includes(err.errorCode)) {
                return Promise.reject({
                    watchId, reason: 'watch api', errorCode: err.errorCode,
                    message: err.message || '動画情報の形式が変更されました'
                });
            }
            else if (err.reason === 'network') {
                return createSleep(5000).then(() => {
                    window.console.warn('network error & retry');
                    return loadPromise(watchId, options, true);
                });
            }
            else if (err.reason === 'flv' && !options.economy) {
                options.economy = true;
                window.console.log('%cエコノミーにフォールバック(flv)', 'background: cyan; color: red;');
                return createSleep(500).then(() => {
                    return loadPromise(watchId, options, true);
                });
            }
            else {
                window.console.info('watch api fail', safeLoadError(err));
                return Promise.reject({
                    watchId,
                    message: err.message || '動画情報の取得に失敗',
                    info: err.info
                });
            }
        });
    };
    return {
        load: function (watchId, options) {
            const timeKey = `watchAPI:${watchId}`;
            window.console.time(timeKey);
            return loadPromise(watchId, options).then((result) => {
                window.console.timeEnd(timeKey);
                return result;
            }, (err) => {
                err.watchId = watchId;
                window.console.timeEnd(timeKey);
                return Promise.reject(err);
            });
        }
    };
})();
//===END===
export {
  VideoInfoLoader
};

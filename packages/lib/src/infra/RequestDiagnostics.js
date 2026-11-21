// GENERATED FROM tools/typescript-stage1/nico-src/RequestDiagnostics.ts (Task991). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const RequestDiagnostics = (() => {
    const labels = {
        'search-count': '検索候補の件数', 'legacy-query': '旧形式の一覧取得', 'watch-tracking': '視聴の記録',
        'ranking-page': 'ランキングページのデータ', 'channel-rss': 'チャンネルの動画RSS', 'watch-owner': '視聴ページの投稿者補完', 'watch-lazy': '視聴ページの追加情報', 'thumb-info': '動画のサムネイル情報', 'commons-parents': 'コンテンツツリーの親作品', 'commons-children': 'コンテンツツリーの子作品',
        'ranking-rss': 'ランキングRSS', 'linked-channel': 'チャンネル連動動画', 'pocket-metadata': 'ポケットの動画情報',
        'video-info': '動画情報', 'comment-read': 'コメント取得', 'comment-history-read': 'コメント増量（過去のコメントを追加取得）', 'comment-key': 'コメント取得キーの更新',
        'video-session': '再生セッション（映像の配信URL取得）', 'session-state': '再生セッションの維持',
        storyboard: '場面画像の情報', search: '検索', mylist: 'マイリスト', playlist: 'プレイリスト',
        'playback-position': '再生位置の保存',
        'mylist-add': 'マイリストへの追加', 'mylist-remove': 'マイリストからの削除',
        'watch-later-add': 'あとで見るへの追加', 'watch-later-remove': 'あとで見るからの削除',
        'tag-add': 'タグの追加', 'tag-remove': 'タグの削除',
        like: 'いいね', tags: 'タグ一覧', 'nico-api': 'ニコニコAPI',
        'tag-suggest': 'タグ候補', 'tag-key': 'タグ編集キー', advertising: 'ニコニ広告',
        'ad-decoration': '広告装飾', supporters: '広告・ギフトの支援者', gifts: 'ギフト',
        dictionary: '大百科', recommend: '関連動画・シリーズ', owner: '投稿者情報', 'owner-videos': '投稿者の動画一覧',
        'comment-post': 'コメント投稿', nicoru: 'ニコる', 'comment-delete': 'コメント削除',
        'nicoad-end': '動画の最後のニコニ広告',
        'clip-conversion': 'クリップの映像・音声変換', 'clip-preview': 'クリップの区間プレビュー',
        'clip-library': 'クリップ変換ライブラリ',
        'clip-playlist': 'クリップ区間の配信一覧', 'clip-segment': 'クリップ区間の映像・音声データ',
        'clip-permission': 'クリップ投稿の利用確認', 'clip-license': 'クリップの音声利用確認',
        'clip-create': 'クリップの作成', 'clip-status': 'クリップの生成状況',
        'clip-post': 'クリップのX投稿', 'clip-post-status': 'クリップのX投稿状況', 'clip-delete': 'クリップの削除'
    };
    /**
     * Task1036: 失敗したときに最初に見るべき TypeScript 正本（tools/typescript-stage1/）。
     * ニコニコ側の仕様変更で壊れたとき、どこを直せばよいかを通知履歴に出すため。
     */
    const modules = {
        'search-count': 'nico-src/VideoSearchForm.ts', 'legacy-query': 'nico-src/NicoQuery.ts', 'watch-tracking': 'nico-src/NVWatchCaller.ts',
        'ranking-page': 'nico-src/MatrixRankingLoader.ts', 'channel-rss': 'nico-src/NicoRssLoader.ts', 'watch-owner': 'nico-src/VideoInfoLoader.ts', 'watch-lazy': 'nico-src/VideoInfoLoader.ts', 'thumb-info': 'nico-src/ThumbInfoLoader.ts', 'commons-parents': 'nico-src/CommonsTreeLoader.ts', 'commons-children': 'nico-src/CommonsTreeLoader.ts',
        'ranking-rss': 'nico-src/NicoRssLoader.ts', 'linked-channel': 'nico-src/VideoInfoLoader.ts', 'pocket-metadata': 'packages/zenza/src/pocket/PocketCardMetadataLoader.ts',
        'video-info': 'nico-src/VideoInfoLoader.ts', 'comment-read': 'packages/comment-history/src/core.mjs',
        'comment-history-read': 'packages/comment-history/src/core.mjs',
        'comment-key': 'packages/comment-history/src/core.mjs', 'video-session': 'nico-src/VideoSessionWorker.ts',
        'session-state': 'nico-src/VideoSessionWorker.ts', storyboard: 'nico-src/Storyboard.ts',
        search: 'nico-src/VideoSearch.ts', mylist: 'nico-src/MylistApiLoader.ts', playlist: 'nico-src/PlaylistApiLoader.ts',
        'playback-position': 'nico-src/PlaybackPosition.ts',
        'mylist-add': 'nico-src/MylistApiLoader.ts', 'mylist-remove': 'nico-src/MylistApiLoader.ts',
        'watch-later-add': 'nico-src/MylistApiLoader.ts', 'watch-later-remove': 'nico-src/MylistApiLoader.ts',
        'tag-add': 'nico-src/TagEditApi.ts', 'tag-remove': 'nico-src/TagEditApi.ts',
        like: 'nico-src/LikeApi.ts', tags: 'nico-src/TagEditApi.ts', 'nico-api': 'nico-src/RequestDiagnostics.ts',
        'tag-suggest': 'nico-src/TagSuggestLoader.ts', 'tag-key': 'nico-src/TagEditApi.ts', advertising: 'nico-src/UaaLoader.ts',
        'ad-decoration': 'nico-src/AdDecorationLoader.ts', supporters: 'nico-src/SupporterCredit.ts', gifts: 'nico-src/SupporterCredit.ts',
        dictionary: 'nico-src/NicodicArticleLoader.ts', recommend: 'nico-src/RecommendAPILoader.ts', owner: 'nico-src/OwnerSupplement.ts', 'owner-videos': 'nico-src/VideoSearch.ts',
        'comment-post': 'nico-src/CommentPostWire.ts', nicoru: 'nico-src/ThreadLoader.ts', 'comment-delete': 'nico-src/ThreadLoader.ts',
        'nicoad-end': 'nico-src/NicoVideoPlayerDialog.ts',
        'clip-conversion': 'src/ShareFastClip.js', 'clip-preview': 'src/ShareHlsPreview.js',
        'clip-library': 'src/ShareFastClip.js',
        'clip-playlist': 'src/ShareHlsClipSource.js', 'clip-segment': 'src/ShareHlsClipSource.js',
        'clip-permission': 'src/ShareOfficialClip.js', 'clip-license': 'src/ShareOfficialClip.js',
        'clip-create': 'src/ShareOfficialClip.js', 'clip-status': 'src/ShareOfficialClip.js',
        'clip-post': 'src/ShareOfficialClip.js', 'clip-post-status': 'src/ShareOfficialClip.js', 'clip-delete': 'src/ShareOfficialClip.js'
    };
    const moduleFor = (operation) => modules[operation] || 'nico-src/RequestDiagnostics.ts';
    // Protocol and source field names are constants. Never persist arbitrary server property names.
    const reportFields = new Set([
        'input.segmentFormat', 'input.segmentIntegrity', 'output.codecs', 'output.encode', 'playlist', 'playlist.encryptionMethod',
        'hlsLibrary', 'mediaSource', 'levels', 'manifest', 'rendition', 'key', 'decoder', 'firstFrame',
        'recording.encrypted', 'recording.decoder', 'recording.firstFrame', 'playlist.segment', 'nicopedia_article_body links',
        'nicopedia_from=nicopedia_article_body', 'items', 'length', 'map', 'filter', 'forEach',
        'ranking.dataApp', 'rss.channel', 'rss.item', 'thumb.status', 'data.parents.contents', 'data.children.contents', 'data.parents.total', 'data.children.total',
        'data.sponsors', 'data.effects', 'data.id', 'data.contents', 'data.supporters', 'fragment', 'input.tracks', 'data.items[].id',
        'meta.status', 'data.threads', 'data.threadKey', 'data.contentUrl', 'data.session.content_uri', 'missing-thread-key', 'invalid-thread-envelope', 'invalid-global-count',
        'invalid-thread-target', 'invalid-api-meta', 'msgInfo.threadInfo', 'threadInfo', 'videoId', 'data', 'data.client',
        'data.client.watchId', 'data.client.watchTrackId', 'data.video', 'data.video.id', 'data.video.title',
        'data.video.duration', 'data.video.count', 'data.video.thumbnail', 'data.player', 'data.genre', 'data.tags',
        'data.tags.items', 'data.nicoads', 'data.isLogin', 'data.twitterLinkage.isLinked', 'data.isClipTweetAllowed',
        'data.isUseLicensedMusic', 'data.clipId', 'data.status', 'data.clipUri', 'json', 'response.json',
        'data.items', 'data.totalCount', 'data.items.essential', 'data.items.id', 'data.contentId', 'meta.totalCount', 'last_modified',
        'data.items.content', 'data.items[].watchId', 'data.items[].essential.id', 'data.watchLater.items', 'data.mylist.items',
        'data.mylists', 'data.hasNext', 'data.watchLater.hasNext', 'data.mylist.hasNext', 'data.additionals', 'storyboard',
        'articles', 'articles[].request_title', 'articles[].title', 'data.tags', 'data.tags[].name', 'data.tag.edit.editKey', 'candidates', 'candidates[]',
        'meta.errorCode', 'data.postKey', 'data.no', 'data.challenge', 'data.nicoruKey', 'data.deleteKey', 'data.nicoruId'
    ]);
    const fieldName = (value) => typeof value === 'string' && reportFields.has(value) ? value : undefined;
    /** エラーメッセージから、undefined だった場所を取り出す（JavaScript の定型文のみ）。 */
    const missingFromMessage = (message) => {
        if (typeof message !== 'string') {
            return undefined;
        }
        const m = /of '([^']{1,100})' as it is (?:undefined|null)/.exec(message) ||
            /Cannot read properties of (?:undefined|null) \(reading '([^']{1,100})'\)/.exec(message) ||
            /^([A-Za-z_$][\w$.]{0,99}) is not defined/.exec(message) ||
            /^([A-Za-z_$][\w$.]{0,99}) is not a function/.exec(message);
        // A JS exception may quote a dynamic property (even a title or a key).
        return m?.[1] && ['msgInfo.threadInfo', 'threadInfo', 'videoId', 'data', 'items', 'length', 'map', 'filter', 'forEach'].includes(m[1]) ? m[1] : undefined;
    };
    const activeTickets = new Map();
    /**
     * Task1036: 仕様変更の疑い。同じ機能で「形式を読み取れない」などの失敗が、別々の対象
     * （動画など）で SUSPECT_THRESHOLD 件以上、SUSPECT_WINDOW_MS 以内に起きたら1件だけ知らせる。
     * 1件だけの失敗は動画固有の事情と区別できないため。
     */
    const SUSPECT_THRESHOLD = 3, SUSPECT_WINDOW_MS = 30 * 60 * 1000;
    const suspects = new Map();
    const suspectReported = new Map();
    const suspectReason = (failure) => failure.reason === 'schema' ||
        (failure.reason === 'http' && [400, 410, 422].includes(Number(failure.statusCode))) ||
        (failure.reason === 'service' && [400, 410, 422].includes(Number(failure.apiStatus))) ||
        ['BAD_REQUEST', 'INVALID_PARAMETER'].includes(String(failure.errorCode));
    const noteSuspect = (operation, key, failure, now) => {
        const group = [operation, failure.endpoint, failure.method, failure.reason, failure.errorCode,
            failure.statusCode, failure.apiStatus, failure.missing, failure.bodyFormat].join('|');
        const seen = suspects.get(group) || new Map();
        seen.set(key, now);
        for (const [k, at] of seen) {
            if (now - at > SUSPECT_WINDOW_MS) {
                seen.delete(k);
            }
        }
        while (seen.size > 50) {
            seen.delete(seen.keys().next().value);
        }
        suspects.set(group, seen);
        const last = suspectReported.get(group);
        if (seen.size >= SUSPECT_THRESHOLD && (last === undefined || now - last > SUSPECT_WINDOW_MS)) {
            suspectReported.set(group, now);
            return seen.size;
        }
        return 0;
    };
    const failures = new Map();
    let sink;
    const noop = { success() { }, failure() { }, response() { }, decoded() { } };
    // Only this ephemeral scope digest is retained. URLs, queries and bodies are
    // never forwarded to the sink, used in messages, or saved by the journal.
    const scopeId = (value) => {
        let a = 2166136261, b = 5381;
        for (let i = 0; i < value.length; i++) {
            a = Math.imul(a ^ value.charCodeAt(i), 16777619);
            b = Math.imul(b, 33) ^ value.charCodeAt(i);
        }
        return (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
    };
    // Match fixed hosts and path shapes. Query parameters and captured segments never enter an event.
    const routes = [
        ['legacy-mylist', 'flapi', '/api/watch/mylistvideo'], ['legacy-uploaded', 'flapi', '/api/watch/uploadedvideo'],
        ['legacy-mylist-items', 'www', '/api/mylist/list'], ['legacy-deflist', 'www', '/api/deflist/list'],
        ['legacy-nicorepo', 'www', '/api/nicorepo/timeline/my/all'], ['watch-tracking', 'nvapi', '/v1/2ab0cbaa/watch'],
        ['ranking-page', 'www', '/ranking'], ['channel-rss', 'ch', '/{channelId}/video'],
        ['nicodic.batch', 'api.dic', '/v1/articles/article'],
        ['video.nicoad-decoration', 'api.nicoad', '/v1/contents/video/decoration'],
        ['ad-frame', 'api.nicoad', '/v1/nicoad'],
        ['ad-thanks', 'api.nicoad', '/v1/contents/video/{videoId}/thanks'],
        ['video.owner.nicoad', 'api.nicoad', '/v1/contents/video/{watchId}'],
        ['gifts', 'api.nicoad', '/v1/nage_video/{videoId}/gift/effects'],
        ['supporters', 'api.nicoad', '/v2/contents/video/{videoId}/pickup_supporters'],
        ['dictionary-article', 'dic', '/a/{word}'],
        ['video.thumbinfo', 'ext', '/api/getthumbinfo/{watchId}'],
        ['comment.delete-key', 'nvapi', '/v1/comment/keys/delete'],
        ['comment.nicoru-key', 'nvapi', '/v1/comment/keys/nicoru'],
        ['comment.post-key', 'nvapi', '/v1/comment/keys/post'],
        ['comment.read-key', 'nvapi', '/v1/comment/keys/thread'],
        ['search.playlist', 'nvapi', '/v1/playlist/search'],
        ['playlist.watchlater', 'nvapi', '/v1/playlist/watch-later'],
        ['recommend', 'nvapi', '/v1/recommend'],
        ['like.add', 'nvapi', '/v1/users/me/likes/items'],
        ['mylist.groups', 'nvapi', '/v1/users/me/mylists'],
        ['watchlater.items', 'nvapi', '/v1/users/me/watch-later'],
        ['video.likes-and-owner', 'nvapi', '/v1/videos'],
        ['search.video', 'nvapi', '/v2/search/video'],
        ['watch.playback-position', 'nvapi', '/v2/users/me/watch/history/playback-position'],
        ['clip', 'nvapi', '/v1/clips/{clipId}'],
        ['clip-post', 'nvapi', '/v1/clips/{clipId}/x-post'],
        ['playlist.mylist', 'nvapi', '/v1/playlist/mylist/{mylistId}'],
        ['playlist.series', 'nvapi', '/v1/playlist/series/{seriesId}'],
        ['playlist.uploaded', 'nvapi', '/v1/playlist/user-uploaded/{userId}'],
        ['mylist.items', 'nvapi', '/v1/users/me/mylists/{groupId}'],
        ['mylist.add', 'nvapi', '/v1/users/me/mylists/{groupId}/items'],
        ['clip-create', 'nvapi', '/v1/videos/{videoId}/clips'],
        ['clip-license', 'nvapi', '/v1/videos/{videoId}/license'],
        ['clip-permission', 'nvapi', '/v1/videos/{videoId}/tweet-possibility'],
        ['playback-grant', 'nvapi', '/v1/watch/{watchId}/access-rights/hls'],
        ['storyboard-grant', 'nvapi', '/v1/watch/{watchId}/access-rights/storyboard'],
        ['tags.list', 'nvapi', '/v2/videos/{videoId}/tags'],
        ['search.by-owner', 'nvapi', '/v3/users/{userId}/videos'],
        ['video.watch-lazy', 'nvapi', '/v4/watch/lazy/{watchId}'],
        ['watch.linked-channel', 'public-api.ch', '/v1/user/channelVideoDAnimeLinks'],
        ['commons.children', 'public-api.commons', '/v1/tree/{globalId}/relatives/children'],
        ['commons.parents', 'public-api.commons', '/v1/tree/{globalId}/relatives/parents'],
        ['comment.read', 'public.nvcomment', '/v1/threads'],
        ['comment.delete', 'public.nvcomment', '/v1/threads/{threadId}/comment-comment-owner-deletions'],
        ['comment.post', 'public.nvcomment', '/v1/threads/{threadId}/comments'],
        ['comment.nicoru', 'public.nvcomment', '/v1/threads/{threadId}/nicorus'],
        ['snapshot-version', 'snapshot.search', '/api/v2/snapshot/version'],
        ['search.snapshot', 'snapshot.search', '/api/v2/snapshot/video/contents/search'],
        ['search.suggest', 'sug.search', '/suggestion/expand/{encodedWord}'],
        ['tags.edit-key', 'www', '/api/watch/v3/{videoId}'],
        ['ranking.rss', 'www', '/ranking/genre/{genre}'],
        ['video.watch', 'www', '/watch/{watchId}'],
    ];
    const paths = new Map();
    const routesByHost = new Map();
    for (const [id, host, template] of routes) {
        paths.set(id, template);
        const hostname = host + '.nicovideo.jp';
        const group = routesByHost.get(hostname) || [];
        group.push({ id, path: new RegExp('^' + template.replace(/\{[^}]+\}/g, '[^/]+') + '/?$') });
        routesByHost.set(hostname, group);
    }
    const pathFor = (id) => typeof id === 'string' ? paths.get(id) : undefined;
    const endpointFor = (input) => {
        if (!input)
            return;
        try {
            const url = new URL(String(input), 'https://www.nicovideo.jp');
            return routesByHost.get(url.hostname)?.find(route => route.path.test(url.pathname))?.id;
        }
        catch (_) {
            return;
        }
    };
    const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
    const responseTypes = new Set(['json', 'html', 'xml', 'text', 'media', 'other']);
    const bodyFormats = new Set(['empty', 'html', 'json-like', 'xml-like', 'text', 'invalid-json']);
    const projectEvidence = (fields) => ({
        ...(pathFor(fields.endpoint) ? { endpoint: String(fields.endpoint) } : {}),
        ...(typeof fields.method === 'string' && methods.has(fields.method) ? { method: fields.method } : {}),
        ...(typeof fields.responseType === 'string' && responseTypes.has(fields.responseType) ? { responseType: fields.responseType } : {}),
        ...(typeof fields.bodyFormat === 'string' && bodyFormats.has(fields.bodyFormat) ? { bodyFormat: fields.bodyFormat } : {}),
        ...(typeof fields.lastSuccessAt === 'number' && Number.isSafeInteger(fields.lastSuccessAt) &&
            fields.lastSuccessAt > 0 && fields.lastSuccessAt <= 8640000000000000 ? { lastSuccessAt: fields.lastSuccessAt } : {})
    });
    const responseEvidence = (input) => {
        if (!input)
            return {};
        try {
            const res = input;
            const endpoint = !res.redirected && endpointFor(res.url);
            const mime = res.headers?.get?.('content-type')?.split(';')[0]?.trim().toLowerCase();
            const responseType = !mime ? undefined : /(?:\/|\+)json$/.test(mime) ? 'json' :
                ['text/html', 'application/xhtml+xml'].includes(mime) ? 'html' : /(?:\/|\+)xml$/.test(mime) ? 'xml' :
                    /^(?:audio|video|image)\//.test(mime) ? 'media' : mime.startsWith('text/') ? 'text' : 'other';
            return { ...(endpoint ? { endpoint } : {}), ...(responseType ? { responseType } : {}) };
        }
        catch (_) {
            return {};
        }
    };
    const successes = new Map();
    const knownErrorCodes = new Set(['WATCH_SCHEMA', 'WATCH_PAGE_SCHEMA', 'WATCH_PAGE_META_MISSING', 'RESPONSE_SCHEMA', 'STORYBOARD_SCHEMA',
        'SEARCH_SCHEMA', 'KEY_EXPIRED', 'INVALID_CHALLENGE_TOKEN', 'BAD_REQUEST', 'INVALID_PARAMETER', 'EXPIRED_TOKEN', 'INVALID_TOKEN', 'FORBIDDEN', 'NOT_FOUND', 'TOO_MANY_REQUESTS', 'INTERNAL_SERVER_ERROR', 'UNAUTHORIZED', 'RESOURCE_NOT_FOUND']);
    const isKnownErrorCode = (value) => typeof value === 'string' && knownErrorCodes.has(value);
    const validStatus = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
    // Only project protocol facts. Each caller owns body validation, fallback and retries.
    const responseFailure = (response, meta, missing, requireMeta = true) => {
        const wire = response?.status;
        const header = meta;
        const api = header?.status;
        const statuses = {
            ...responseEvidence(response),
            ...(validStatus(wire) ? { httpStatus: wire } : {}),
            ...(validStatus(api) ? { apiStatus: api } : {})
        };
        const rawCode = header?.errorCode;
        const code = typeof rawCode === 'string' && rawCode ? { errorCode: isKnownErrorCode(rawCode) ? rawCode : 'OTHER' } : {};
        if ((validStatus(wire) && wire >= 300) || (validStatus(api) && api >= 300))
            return { ...statuses, ...code };
        if (code.errorCode)
            return { ...statuses, ...code, kind: 'service' };
        if (missing || ((requireMeta || meta != null) && (!validStatus(api) || api < 200))) {
            return { ...statuses, kind: 'schema', errorCode: 'RESPONSE_SCHEMA', missing: missing || 'meta.status' };
        }
        return null;
    };
    const readFailure = (response, cause, bodyText) => {
        const error = cause;
        const wire = response?.status;
        // Classify only text the caller already consumed. Never clone a stream or parse a second body.
        const prefix = typeof bodyText === 'string' ? bodyText.trimStart().slice(0, 100) : undefined;
        const bodyFormat = prefix === undefined ? (response && error?.name === 'SyntaxError' ? 'invalid-json' : undefined) :
            prefix === '' ? 'empty' : /^<(?:!doctype\s+html|html|head|body)(?:\s|>|$)/i.test(prefix) ? 'html' :
                /^[{[]/.test(prefix) ? 'json-like' : /^</.test(prefix) ? 'xml-like' : 'text';
        const statuses = { ...responseEvidence(response), ...(bodyFormat ? { bodyFormat } : {}), ...(validStatus(wire) ? { httpStatus: wire } : {}) };
        if (error?.name === 'AbortError')
            return { name: 'AbortError' };
        if (validStatus(wire) && wire >= 300)
            return statuses;
        if (error?.name === 'TimeoutError' || error?.name === 'timeout' || error?.status === 'timeout') {
            return { ...statuses, kind: 'timeout' };
        }
        if (response && error?.name === 'SyntaxError')
            return { ...statuses, kind: 'schema', errorCode: 'RESPONSE_SCHEMA', missing: 'json' };
        return { ...statuses, kind: 'network' };
    };
    const classify = (error) => {
        const outer = error && typeof error === 'object' ? error : {};
        const ownsStatus = validStatus(outer.httpStatus) || validStatus(outer.apiStatus) ||
            ['schema', 'network', 'timeout'].includes(String(outer.kind)) || outer.name === 'AbortError';
        const e = !ownsStatus && outer.result && typeof outer.result === 'object' ? outer.result : outer;
        const httpStatus = e.httpStatus ?? e.statusCode ?? e.status;
        const apiStatus = validStatus(e.apiStatus) ? e.apiStatus : undefined;
        const apiRejected = apiStatus !== undefined && apiStatus >= 300 &&
            !(validStatus(httpStatus) && httpStatus >= 300);
        const status = apiRejected ? apiStatus : httpStatus;
        const fields = {
            ...projectEvidence(e),
            ...(validStatus(httpStatus) ? { statusCode: httpStatus } : {}),
            ...(apiStatus !== undefined ? { apiStatus } : {}),
            ...(typeof e.errorCode === 'string' ? { errorCode: isKnownErrorCode(e.errorCode) ? e.errorCode : 'OTHER' } : {})
        };
        // Task1036: 読めなかった項目（missing/reasonCode/スキーマ失敗の理由コード）。値は持たない。
        const missing = fieldName(e.missing) ||
            (e.kind === 'schema' || /_SCHEMA$/.test(String(e.errorCode)) ? fieldName(e.reasonCode) || fieldName(e.reason) : undefined);
        if (missing) {
            fields.missing = missing;
        }
        if (e.name === 'AbortError' || e.reason === 'cancelled') {
            return { reason: 'cancelled' };
        }
        if (e.kind === 'network') {
            return { reason: 'network', ...fields };
        }
        // Task1036: プログラムの不具合（TypeError など）は通信失敗と区別する。今回のコメント不具合は
        // 「Cannot destructure property 'videoId' of 'msgInfo.threadInfo'」で、通信に関係なかった。
        if (['TypeError', 'ReferenceError', 'RangeError', 'SyntaxError'].includes(String(e.name)) &&
            typeof e.message === 'string' && !/JSON|Unexpected token|Unexpected end/i.test(e.message)) {
            const where = missingFromMessage(e.message);
            return { reason: 'script', errorName: String(e.name), ...(where ? { missing: where } : {}) };
        }
        if (e.kind === 'integrity')
            return { reason: 'integrity', ...fields };
        if (e.kind === 'module-load')
            return { reason: 'module-load' };
        if (e.reason === 'session-closed') {
            return { reason: 'session-closed' };
        }
        if (e.kind === 'service') {
            return { reason: 'service', ...fields };
        }
        if (e.name === 'timeout' || e.name === 'TimeoutError' || e.kind === 'timeout') {
            return { reason: 'timeout', ...fields };
        }
        if (status === 404 || e.reason === 'not found') {
            return { reason: 'not-found', ...fields };
        }
        if (status === 401 || status === 403 || ['forbidden', 'need payment', 'premium only', 'member only'].includes(String(e.reason))) {
            return { reason: 'permission', ...fields };
        }
        if (apiRejected) {
            return { reason: 'service', ...fields };
        }
        if (e.reason === 'not supported') {
            return { reason: 'unavailable', ...fields };
        }
        if (e.kind === 'NO_KEY' || (e.kind === 'API' && typeof status === 'number' && status >= 200 && status < 300)) {
            return { reason: 'schema', ...fields };
        }
        if (e.kind === 'schema' || e.name === 'SyntaxError' || e.reason === 'watch api' ||
            ['WATCH_SCHEMA', 'WATCH_PAGE_SCHEMA', 'WATCH_PAGE_META_MISSING', 'RESPONSE_SCHEMA', 'STORYBOARD_SCHEMA'].includes(String(e.errorCode))) {
            return { reason: 'schema', ...fields };
        }
        if (fields.statusCode) {
            return { reason: 'http', ...fields };
        }
        if (apiStatus !== undefined && fields.errorCode) {
            return { reason: 'service', ...fields };
        }
        return { reason: 'network', ...fields };
    };
    // Only fixed protocol field names, allowlisted API codes and HTTP status reach the journal.
    const classifyHistoryRead = (error, key = false) => {
        const e = error && typeof error === 'object' ? error : {};
        const code = e.code;
        const statuses = { httpStatus: e.httpStatus, apiStatus: key ? e.apiStatus : undefined };
        if (['RESPONSE_SCHEMA', 'COMMENT_SCHEMA', 'TARGET_SCHEMA', 'TARGET_NOT_ALLOWED', 'MISSING_TARGET', 'INVALID_JSON'].includes(String(code)) ||
            (key && code === 'MISSING_KEY')) {
            const missing = e.missing === 'meta.status' || e.missing === (key ? 'data.threadKey' : 'data.threads') ? e.missing : undefined;
            return classify({ ...statuses, kind: 'schema', errorCode: 'RESPONSE_SCHEMA', ...(missing ? { missing } : {}) });
        }
        if (code === 'TIMEOUT') {
            return { reason: 'timeout' };
        }
        if (code === 'NETWORK_ERROR') {
            return { reason: 'network' };
        }
        if (code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED') {
            return { ...classify({ ...statuses, errorCode: code === 'TOKEN_INVALID' ? 'INVALID_TOKEN' : 'EXPIRED_TOKEN' }), reason: 'permission' };
        }
        if (['HTTP_ERROR', 'API_ERROR', 'RATE_LIMITED'].includes(String(code))) {
            const result = classify({ ...statuses, errorCode: e.apiCode });
            if (result.reason === 'network' || result.reason === 'http' && Number(result.statusCode) < 400) {
                result.reason = 'service';
            }
            return result;
        }
        // A cancelled run or a local request/time limit says nothing about the API.
        return { reason: 'cancelled' };
    };
    const classifyCommentKey = (error) => {
        const outer = error && typeof error === 'object' ? error : {};
        if (outer.code !== undefined && (outer.name === 'HistoryError' || outer.code === 'TIMEOUT' || outer.code === 'CANCELLED')) {
            return classifyHistoryRead(outer, true);
        }
        // Only the reader knows which status came from the HTTP response and which from its body.
        const statuses = { httpStatus: outer.httpStatus ?? outer.status, apiStatus: outer.apiStatus };
        const e = outer.result && typeof outer.result === 'object' ? outer.result : outer;
        if (e.kind === 'schema' || e.name === 'SyntaxError') {
            const missing = e.missing === 'data.threadKey' || e.missing === 'meta.status' ? e.missing : undefined;
            return classify({ ...statuses, kind: 'schema', errorCode: 'RESPONSE_SCHEMA', ...(missing ? { missing } : {}) });
        }
        // A server's meta object may contain arbitrary messages and property names.
        const result = classify({ ...statuses, errorCode: e.errorCode, name: e.name });
        if (e.errorCode === 'EXPIRED_TOKEN' || e.errorCode === 'INVALID_TOKEN') {
            result.reason = 'permission';
        }
        else if (e.errorCode && (result.reason === 'network' || result.reason === 'http' && Number(result.statusCode) < 400)) {
            result.reason = 'service';
        }
        return result;
    };
    const classifyCommentAction = (error) => {
        const e = error && typeof error === 'object' ? error : {};
        const result = e.result;
        // The action reader owns these fields. Its original exception can be a raw API envelope.
        if (validStatus(e.httpStatus) || validStatus(e.apiStatus) || e.missing || e.errorCode) {
            const failure = responseFailure({ status: e.httpStatus }, { status: e.apiStatus, errorCode: e.errorCode }, typeof e.missing === 'string' ? e.missing : undefined);
            if (failure)
                return classify(failure);
        }
        if (result?.reason === 'no-post-target' || (result?.outcome === 'not-sent' &&
            ['challenge-cancelled', 'challenge-stale-video', 'challenge-busy'].includes(String(result.reason)))) {
            return { reason: 'cancelled' };
        }
        if (result?.reason === 'challenge-timeout' || ['header-timeout', 'body-timeout'].includes(String(result?.kind ?? result?.reason))) {
            return classify({ kind: 'timeout', httpStatus: e.httpStatus });
        }
        if (result?.name === 'AbortError' || result?.name === 'TimeoutError')
            return classify(result);
        if (result?.name === 'TypeError' && ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'].includes(String(result.message))) {
            return classify({ kind: 'network', httpStatus: e.httpStatus });
        }
        return classify(result ?? error);
    };
    const begin = (operation, scope, phase, active = () => true, suspectTarget, request) => {
        if (!Object.prototype.hasOwnProperty.call(labels, operation) || !['transport', 'response', 'session'].includes(phase)) {
            return noop;
        }
        const started = Date.now();
        const key = 'diag-' + operation + '-' + phase + '-' + scopeId(scope);
        const previous = activeTickets.get(key);
        if (previous) {
            previous.superseded = true;
        }
        const state = { superseded: false };
        activeTickets.set(key, state);
        let finished = false;
        const emit = (outcome, failure) => {
            if (finished) {
                return;
            }
            finished = true;
            if (activeTickets.get(key) === state) {
                activeTickets.delete(key);
            }
            try {
                if (!active() || state.superseded || failure.reason === 'cancelled') {
                    return;
                }
                if (outcome === 'recovered') {
                    successes.delete(key);
                    successes.set(key, Date.now());
                    if (successes.size > 100)
                        successes.delete(successes.keys().next().value);
                    const seen = failures.get(key);
                    failures.delete(key);
                    if (seen === undefined || started - seen >= 600000) {
                        return;
                    }
                }
                else {
                    const endpoint = endpointFor(request?.url || (scope.startsWith('https://') ? scope : undefined));
                    const previousSuccess = successes.get(key);
                    failure = { ...failure, ...projectEvidence({ endpoint, method: request?.method?.toUpperCase(), lastSuccessAt: previousSuccess }) };
                    failures.delete(key);
                    failures.set(key, Date.now());
                    while (failures.size > 100) {
                        failures.delete(failures.keys().next().value);
                    }
                }
                const reasonLabels = {
                    integrity: '読み込んだデータの整合性を確認できませんでした', 'module-load': '変換ライブラリを読み込めません',
                    timeout: '時間切れ', 'not-found': '対象が見つかりません', permission: '権限・ログイン状態を要確認',
                    schema: '応答の形式を読み取れません', http: 'サーバーからエラー応答', network: '処理に失敗しました',
                    'session-closed': 'セッションが異常終了しました', unavailable: 'この動画の再生方式には未対応です',
                    script: 'プログラムの不具合（スクリプトエラー）', service: 'サービスで処理に失敗しました'
                };
                const module = moduleFor(operation);
                if (outcome === 'failed' && suspectReason(failure)) {
                    const distinctTargets = noteSuspect(operation, suspectTarget === undefined ? key : scopeId(suspectTarget), failure, Date.now());
                    if (distinctTargets) {
                        sink?.({ key: 'diag-spec-' + operation + '-' + failure.reason, operation, phase, outcome: 'failed', ...failure,
                            reason: 'spec-change', module, distinctTargets,
                            message: labels[operation] + '：ニコニコ側の仕様変更の可能性があります（別々の' + distinctTargets +
                                '件で同じ失敗）。修正箇所の目安: ' + module,
                            elapsedMs: 0 });
                    }
                }
                sink?.({ key, operation, phase, outcome, ...failure, module,
                    message: labels[operation] + '（' + (phase === 'transport' ? '通信' : phase === 'response' ? '応答の確認' : '処理') + '）' +
                        (outcome === 'recovered' ? '：復旧しました' : '：' + reasonLabels[failure.reason]),
                    elapsedMs: Math.max(0, Math.min(86400000, Date.now() - started)) });
            }
            catch (_) { /* Diagnostic observers must never change playback. */ }
        };
        const failure = (error) => {
            try {
                const result = phase === 'transport' && error?.name === 'TypeError' ? { reason: 'network' } :
                    operation === 'comment-history-read' ? classifyHistoryRead(error) :
                        operation === 'comment-key' ? classifyCommentKey(error) :
                            ['comment-post', 'nicoru', 'comment-delete'].includes(operation) ? classifyCommentAction(error) : classify(error);
                emit('failed', result);
            }
            catch (_) { /* untrusted error properties */ }
        };
        return {
            success: () => emit('recovered', { reason: 'recovered' }), failure,
            decoded: (response, meta, missing, requireMeta) => {
                const issue = responseFailure(response, meta, missing, requireMeta);
                if (issue)
                    failure(issue);
                else
                    emit('recovered', { reason: 'recovered' });
            },
            response: response => {
                if (validStatus(response?.status) && response.status >= 300) {
                    failure({ ...responseEvidence(response), status: response.status });
                }
                else {
                    emit('recovered', { reason: 'recovered' });
                }
            }
        };
    };
    const operationFor = (value, method) => {
        try {
            const url = new URL(String(value), 'https://www.nicovideo.jp');
            if (!/(^|\.)nicovideo\.jp$/.test(url.hostname)) {
                return null;
            }
            const p = url.pathname;
            // ShareOfficialClip owns transport and response as one ticket per stage/video.
            if (url.hostname === 'nvapi.nicovideo.jp' &&
                /^\/v1\/(?:videos\/[^/]+\/(?:tweet-possibility|license|clips)|clips\/[^/]+(?:\/x-post)?)\/?$/.test(p)) {
                return null;
            }
            const endpoint = endpointFor(url);
            // The paged Commons reader treats a first-page 404 as an empty tree.
            if (endpoint === 'commons.parents' || endpoint === 'commons.children')
                return null;
            const specific = {
                'legacy-mylist': 'legacy-query', 'legacy-uploaded': 'legacy-query', 'legacy-mylist-items': 'legacy-query',
                'legacy-deflist': 'legacy-query', 'legacy-nicorepo': 'legacy-query', 'watch-tracking': 'watch-tracking',
                'ranking-page': 'ranking-page', 'channel-rss': 'channel-rss', 'video.thumbinfo': 'thumb-info',
                'ranking.rss': 'ranking-rss', 'watch.linked-channel': 'linked-channel', 'video.likes-and-owner': 'pocket-metadata',
                'video.owner.nicoad': 'owner', 'nicodic.batch': 'dictionary', 'tags.edit-key': 'tag-key',
                'comment.post-key': 'comment-post', 'comment.post': 'comment-post', 'comment.delete-key': 'comment-delete',
                'comment.delete': 'comment-delete', 'comment.nicoru-key': 'nicoru', 'comment.nicoru': 'nicoru'
            };
            if (endpoint && specific[endpoint])
                return specific[endpoint];
            if (endpoint === 'tags.list')
                return method === 'POST' ? 'tag-add' : method === 'DELETE' ? 'tag-remove' : 'tags';
            if (endpoint === 'mylist.add')
                return method === 'POST' ? 'mylist-add' : method === 'DELETE' ? 'mylist-remove' : 'mylist';
            if (endpoint === 'watchlater.items')
                return method === 'POST' ? 'watch-later-add' : method === 'DELETE' ? 'watch-later-remove' : 'mylist';
            if (url.hostname === 'sug.search.nicovideo.jp') {
                return 'tag-suggest';
            }
            if (url.hostname === 'dic.nicovideo.jp') {
                return 'dictionary';
            }
            if (url.hostname === 'api.nicoad.nicovideo.jp') {
                if (/pickup_supporters/.test(p)) {
                    return 'supporters';
                }
                if (/\/gift\//.test(p)) {
                    return 'gifts';
                }
                if (/^\/v1\/nicoad$/.test(p) && url.searchParams.get('frameId') === '12') {
                    return 'nicoad-end';
                }
                return /\/decoration$/.test(p) ? 'ad-decoration' : 'advertising';
            }
            if (/\/recommend$/.test(p)) {
                return 'recommend';
            }
            if (url.hostname === 'nvapi.nicovideo.jp' && /^\/v1\/playlist\//.test(p)) {
                return 'playlist';
            }
            if (url.hostname === 'nvapi.nicovideo.jp' && /^\/v3\/users\/[^/]+\/videos\/?$/.test(p)) {
                return url.searchParams.get('selectContentType') === 'short' ? 'playlist' : 'owner-videos';
            }
            if (url.hostname === 'nvapi.nicovideo.jp' && p === '/v2/users/me/watch/history/playback-position')
                return 'playback-position';
            if (/\/watch-later(?:\/|$)/.test(p)) {
                return 'mylist';
            }
            if (/\/access-rights\/storyboard\/?$/.test(p)) {
                return 'storyboard';
            }
            if (/\/access-rights\//.test(p)) {
                return 'video-session';
            }
            if (/\/watch\//.test(p)) {
                return 'video-info';
            }
            if (/\/comment\/keys\/thread/.test(p)) {
                return 'comment-key';
            }
            if (/\/threads(?:\/|$)/.test(p)) {
                return 'comment-read';
            }
            if (/storyboard/.test(p)) {
                return 'storyboard';
            }
            if (/\/search(?:\/|$)/.test(p)) {
                return 'search';
            }
            if (/mylist/.test(p)) {
                return 'mylist';
            }
            if (/playlist/.test(p)) {
                return 'playlist';
            }
            if (/\/likes(?:\/|$)/.test(p)) {
                return 'like';
            }
            if (/\/tags(?:\/|$)/.test(p)) {
                return 'tags';
            }
            if (/\/videos(?:\/|$)/.test(p)) {
                return 'video-info';
            }
            return /^(nvapi|api|public\.api)\./.test(url.hostname) || /(^|\/)api(\/|$)/.test(p) ? 'nico-api' : null;
        }
        catch (_) {
            return null;
        }
    };
    const startRequest = (url, signal, active = () => true, method = 'GET') => {
        const operation = operationFor(url, method.toUpperCase());
        return operation ? begin(operation, method.toUpperCase() + ' ' + String(url), 'transport', () => !signal?.aborted && active(), undefined, { url, method }) : noop;
    };
    // Observe a caller-owned operation without changing its value, error or retry policy.
    const observe = async (operation, scope, execute, validate = () => true, active = () => true) => {
        const ticket = begin(operation, scope, 'response', active);
        let value;
        try {
            value = await execute();
        }
        catch (error) {
            ticket.failure(error);
            throw error;
        }
        try {
            const meta = value && typeof value === 'object' ?
                value.meta : undefined;
            if (typeof meta?.status === 'number' && (meta.status < 200 || meta.status >= 300)) {
                ticket.failure({ apiStatus: meta.status, errorCode: meta.errorCode });
            }
            else {
                const checked = validate(value);
                if (typeof checked === 'object') {
                    ticket.failure(checked);
                }
                else if (!checked) {
                    ticket.failure({ kind: 'schema' });
                }
                else {
                    ticket.success();
                }
            }
        }
        catch (_) {
            ticket.failure({ name: 'AbortError' });
        }
        return value;
    };
    const setSink = (next) => { sink = next; };
    const labelFor = (operation) => Object.prototype.hasOwnProperty.call(labels, operation) ? labels[operation] : undefined;
    return { begin, startRequest, observe, setSink, moduleFor, missingFromMessage, labelFor, isKnownErrorCode, responseFailure, readFailure, responseEvidence, projectEvidence, pathFor, fieldName };
})();
//===END===
export {RequestDiagnostics};

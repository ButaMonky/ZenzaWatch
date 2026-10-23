// GENERATED FROM tools/typescript-stage1/nico-src/parseThumbInfo.ts (Task645). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/nico/parseThumbInfo.js (Task645).
 * Parses the getthumbinfo XML (ext.nicovideo.jp) into the legacy thumbInfo object.
 * MylistPocket injects `parseThumbInfo.toString()` into a page script, so this
 * must stay one self-contained function declaration with no outer references.
 * (The unused `sm9` sample XML that sat before the build section was dropped.)
 */
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
    // Task647 (PT-MISSING-001): an "ok" response without these elements used to throw a
    // TypeError; report it as a failure instead, like other unusable responses.
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
//===END===
export {
  parseThumbInfo
};

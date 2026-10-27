/**
 * Canonical TypeScript source for packages/lib/src/nico/parseThumbInfo.js (Task645).
 * Parses the getthumbinfo XML (ext.nicovideo.jp) into the legacy thumbInfo object.
 * MylistPocket injects `parseThumbInfo.toString()` into a page script, so this
 * must stay one self-contained function declaration with no outer references.
 * (The unused `sm9` sample XML that sat before the build section was dropped.)
 */

export interface VideoTag {
  text: string | null;
  category: boolean;
  lock: boolean;
}
export interface OwnerInfo {
  type: 'user' | 'channel';
  id: string;
  linkId: string;
  name: string;
  url: string;
  icon: string;
}
export interface ThumbInfoData {
  status: 'ok';
  _format: 'thumbInfo';
  /** watchId */
  v: string;
  /** videoId */
  id: string;
  videoId: string;
  watchId: string;
  originalVideoId: string;
  isChannel: boolean;
  title: string | null;
  description: string | null;
  thumbnail: string;
  movieType: string | null;
  lastResBody: string | null;
  duration: number;
  postedAt: string;
  mylistCount: number;
  viewCount: number;
  commentCount: number;
  tagList: VideoTag[];
  owner?: OwnerInfo;
}
export interface ThumbInfoFailure {
  status: 'fail';
  /** e.g. 'DELETED' */
  code: string | null;
  message: string | null;
}
export type ThumbInfoResult = ThumbInfoData | ThumbInfoFailure;

/**
 * XML text is parsed; any non-string value (e.g. an already parsed object)
 * is returned unchanged. A response whose status is not "ok" becomes a failure
 * object. Required elements missing from an "ok" response throw (legacy).
 */
function parseThumbInfo(xmlText: string): ThumbInfoResult;
function parseThumbInfo<T>(xmlText: T): T;
function parseThumbInfo(xmlText: unknown): unknown {
  if (typeof xmlText !== 'string' || (xmlText as unknown as {status?: unknown}).status === 'ok') {
    return xmlText;
  }
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const val = (name: string): string | null => {
    const elms = xml.getElementsByTagName(name);
    if (elms.length < 1) {
      return null;
    }
    return (elms[0] as Element).textContent;
  };
  const dateToString = (dateString: Date): string => {
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
  if (resp.length < 1 || (resp[0] as Element).getAttribute('status') !== 'ok') {
    return {
      status: 'fail',
      code: val('code'),
      message: val('description')
    } satisfies ThumbInfoFailure;
  }

  // Task647 (PT-MISSING-001): an "ok" response without these elements used to throw a
  // TypeError; report it as a failure instead, like other unusable responses.
  const lengthText = val('length'), watchUrl = val('watch_url'), videoIdText = val('video_id'), thumbnailUrl = val('thumbnail_url');
  if (lengthText === null || watchUrl === null || !videoIdText || thumbnailUrl === null) {
    return {
      status: 'fail',
      code: 'INVALID_RESPONSE',
      message: 'thumbinfo response is missing required fields'
    } satisfies ThumbInfoFailure;
  }
  const [min, sec] = lengthText.split(':');
  const duration = (min as unknown as number) * 60 + (sec as unknown as number) * 1;
  const watchId = watchUrl.split('/').reverse()[0] as string;
  const postedAt = dateToString(new Date(val('first_retrieve') as string));
  const tags: VideoTag[] = [...xml.getElementsByTagName('tag')].map(tag => {
      return {
        text: tag.textContent,
        category: tag.hasAttribute('category'),
        lock: tag.hasAttribute('lock')
      };
    });


  const videoId = videoIdText;
  const isChannel = videoId.substring(0, 2) === 'so';
  const result: ThumbInfoData = {
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
    mylistCount: parseInt(val('mylist_counter') as string, 10),
    viewCount: parseInt(val('view_counter') as string, 10),
    commentCount: parseInt(val('comment_num') as string, 10),
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

export {parseThumbInfo};

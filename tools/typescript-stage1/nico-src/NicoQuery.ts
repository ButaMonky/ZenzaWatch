/**
 * Canonical TypeScript source for packages/lib/src/nico/NicoQuery.js (Task646).
 * `type/id?params` playlist queries (mylist, user uploads, deflist, nicorepo,
 * series, ranking, channel, tag/keyword search): parse/build, titles, search
 * parameters and fetching; plus ItemDataConverter for legacy list items.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const textUtil: {
  convertKansuEi(text: string): string;
  parseQuery(query: string): Record<string, unknown>;
};
declare const netUtil: NetUtilFetcher;
declare const MylistApiLoader: {getMylistList(): Promise<object>};
declare const RecommendAPILoader: {loadSeries(id: string, options: object): Promise<object>};
declare const NicoRssLoader: {
  loadRanking(options: {genre: string}): Promise<object>;
  load(url: string): Promise<object>;
};
declare const NicoSearchApiV2Loader: {searchMore(word: string, params: NicoQuerySearchParams): Promise<object>};

/** Legacy list item fields read by the converters (flapi / search API v2 cards). */
export interface LegacyListItemData {
  id: string;
  title: string;
  thumbnail_url?: string;
  is_middle_thumbnail?: unknown;
  length?: string;
  length_seconds?: number | string;
  num_res?: number | string;
  mylist_counter?: number | string;
  view_counter?: number | string;
  first_retrieve: string;
  create_time?: number | string;
  thread_update_time?: string;
  mylist_comment?: string;
}
export interface DeflistItem {
  item_data: {
    video_id: string;
    watch_id: string;
    title: string;
    length_seconds?: number | string;
    num_res?: number | string;
    mylist_counter?: number | string;
    view_counter?: number | string;
    thumbnail_url?: string;
    first_retrieve: number | string;
    update_time: number | string;
  };
  create_time: number | string;
  description?: string;
}
export interface ConvertedItem {
  watchId: string;
  videoId: string;
  title: string;
  duration: unknown;
  commentCount: number;
  mylistCount: number;
  viewCount: number;
  thumbnail: unknown;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
  isChannel?: boolean;
  isMymemory?: boolean;
  mylistComment?: string;
  _sortTitle: string;
}
export interface NicoQueryParams {
  title?: string;
  sort?: string;
  start?: unknown;
  end?: unknown;
  commentCount?: unknown;
  fRange?: unknown;
  lRange?: unknown;
  page?: unknown;
  genre?: unknown;
  selectContentType?: unknown;
  channelVideoListingStatus?: unknown;
  kind?: unknown;
  ownerFilter?: boolean;
  userId?: unknown;
  channelId?: unknown;
  [key: string]: unknown;
}
export interface NicoQueryParts {
  type: string;
  id?: string;
  params?: NicoQueryParams;
}
export interface NicoQuerySearchParams {
  searchType: string;
  order: 'a' | 'd';
  sort: string;
  userId: unknown;
  channelId: unknown;
  dateFrom: unknown;
  dateTo: unknown;
  commentCount: unknown;
  f_range: unknown;
  l_range: unknown;
  page: unknown;
  genre: unknown;
  selectContentType: unknown;
  channelVideoListingStatus: unknown;
  kind: unknown;
}
export interface NicoQueryRequest {
  query: string;
  type: string;
  id: string;
  params: NicoQueryParams;
  url?: string;
}

const ItemDataConverter = {
  makeSortText: (text: string): string => {
    return textUtil.convertKansuEi(text)
      .replace(/([0-9]{1,9})/g, m => m.padStart(10, '0')).replace(/([０-９]{1,9})/g, m => m.padStart(10, '０'));
  },
  fromFlapiMylistItem: (data: LegacyListItemData): ConvertedItem => {
    const isChannel = data.id.startsWith('so');
    const isMymemory = /^[0-9]+$/.test(data.id);
    const thumbnail =
      data.is_middle_thumbnail ?
        `${data.thumbnail_url}.M` : data.thumbnail_url;
    return {
      watchId: data.id,
      videoId: data.id,
      title: data.title,
      duration: (data.length_seconds as number) * 1,
      commentCount: (data.num_res as number) * 1,
      mylistCount: (data.mylist_counter as number) * 1,
      viewCount: (data.view_counter as number) * 1,
      thumbnail,
      postedAt: new Date(data.first_retrieve.replace(/-/g, '/')).toISOString(),
      createdAt: new Date((data.create_time as number) * 1000).toISOString(),
      updatedAt: new Date((data.thread_update_time as string).replace(/-/g, '/')).toISOString(),
      isChannel,
      isMymemory,
      mylistComment: data.mylist_comment || '',
      _sortTitle: ItemDataConverter.makeSortText(data.title),
    };
  },
  fromDeflistItem: (item: DeflistItem): ConvertedItem => {
    const data = item.item_data;
    const isChannel = data.video_id.startsWith('so');
    const isMymemory = !isChannel && /^[0-9]+$/.test(data.watch_id);
    return {
      watchId: isChannel ? data.video_id : data.watch_id,
      videoId: data.video_id,
      title: data.title,
      duration: (data.length_seconds as number) * 1,
      commentCount: (data.num_res as number) * 1,
      mylistCount: (data.mylist_counter as number) * 1,
      viewCount: (data.view_counter as number) * 1,
      thumbnail: data.thumbnail_url,
      postedAt: new Date((data.first_retrieve as number) * 1000).toISOString(),
      createdAt: new Date((item.create_time as number) * 1000).toISOString(),
      updatedAt: new Date((data.update_time as number) * 1000).toISOString(),
      isChannel,
      isMymemory,
      mylistComment: item.description || '',
      _sortTitle: ItemDataConverter.makeSortText(data.title),
    };
  },
  fromUploadedVideo: (data: LegacyListItemData): ConvertedItem => {
    const isChannel = data.id.startsWith('so');
    const isMymemory = /^[0-9]+$/.test(data.id);
    const thumbnail =
      data.is_middle_thumbnail ?
        `${data.thumbnail_url}.M` : data.thumbnail_url;
    const [min, sec] = (data.length as string).split(':');
    const postedAt = new Date(data.first_retrieve.replace(/-/g, '/')).toISOString();
    return {
      watchId: data.id,
      videoId: data.id,
      title: data.title,
      duration: (min as unknown as number) * 60 + (sec as unknown as number) * 1,
      commentCount: (data.num_res as number) * 1,
      mylistCount: (data.mylist_counter as number) * 1,
      viewCount: (data.view_counter as number) * 1,
      thumbnail,
      postedAt,
      createdAt: postedAt,
      updatedAt: postedAt,
      _sortTitle: ItemDataConverter.makeSortText(data.title),
    };
  },
  fromSearchApiV2: (data: LegacyListItemData): ConvertedItem => {
    const isChannel = data.id.startsWith('so');
    const isMymemory = /^[0-9]+$/.test(data.id);
    const thumbnail =
      data.is_middle_thumbnail ?
        `${data.thumbnail_url}.M` : data.thumbnail_url;
    const postedAt = new Date(data.first_retrieve.replace(/-/g, '/')).toISOString();
    return {
      watchId: data.id,
      videoId: data.id,
      title: data.title,
      duration: data.length_seconds,
      commentCount: (data.num_res as number) * 1,
      mylistCount: (data.mylist_counter as number) * 1,
      viewCount: (data.view_counter as number) * 1,
      thumbnail,
      postedAt,
      createdAt: postedAt,
      updatedAt: postedAt,
      isChannel,
      isMymemory,
      _sortTitle: ItemDataConverter.makeSortText(data.title),
    };
  }
};

class NicoQuery {
  declare type: string;
  declare id: string;
  declare params: NicoQueryParams;

  static parse(query: string | NicoQuery): NicoQuery | {type: string; id: string; params: NicoQueryParams} {
    if (query instanceof NicoQuery) {
      return query;
    }
    const [type, vars] = query.split('/') as [string, string | undefined];
    let [id, p] = (vars || '').split('?');
    id = decodeURIComponent(id || '');
    const params = textUtil.parseQuery(p || '') as NicoQueryParams;
    Object.keys(params).forEach(key => {
      try { params[key] = JSON.parse(params[key] as string);} catch(e) {}
    });
    return {
      type,
      id,
      params
    };
  }

  static build(type: string, id: string, params: NicoQueryParams): string {
    const p = Object.keys(params)
    .sort()
    .filter(key => !!params[key] && key !== 'title')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(params[key]))}`);
    // .map(key => `${encodeURIComponent(key)}=${
    //   typeof params[key] === 'string' ?
    //     encodeURIComponent(`"${escape(params[key])}"`) :
    //     encodeURIComponent(params[key])
    // }`);
    if (params.title) {
      p.push(`title=${encodeURIComponent(params.title)}`);
    }
    return `${type}/${encodeURIComponent(id)}?${p.join('&')}`;
  }

  static async fetch(query: string | NicoQuery): Promise<object & {_req: NicoQueryRequest}> {
    if (typeof query === 'string') {
      query = new NicoQuery(query);
    }

    const {type, id, params} = query;
    // self.console.info('NicoQ.query', JSON.stringify(query), query, query.toString());
    const _req: NicoQueryRequest = {
      query: query.toString(),
      type,
      id,
      params,
    };
    let result: object;
    switch (type) {
      case 'mylist':
        _req.url = `https://flapi.nicovideo.jp/api/watch/mylistvideo?id=${id}`;
        break;
      case 'user':
        _req.url = `https://flapi.nicovideo.jp/api/watch/uploadedvideo?user_id=${id}`;
        break;
      case 'mymylist':
        _req.url = `https://www.nicovideo.jp/api/mylist/list?group_id=${id}`;
        break;
      case 'deflist':
        _req.url = 'https://www.nicovideo.jp/api/deflist/list';
        break;
      case 'nicorepo':
        _req.url = 'https://www.nicovideo.jp/api/nicorepo/timeline/my/all?attribute_filter=upload&object_filter=video&client_app=pc_myrepo';
        break;
      case 'mylistlist':
        return Object.assign(
          await MylistApiLoader.getMylistList(),
          {_req}
        );
      case 'series':
        return Object.assign(
          await RecommendAPILoader.loadSeries(id, {}),
          {_req}
        );
      case 'ranking':
        return Object.assign(
          await NicoRssLoader.loadRanking({genre: id || 'all'}),
          {_req}
        );
      case 'channel':
        _req.url = `https://ch.nicovideo.jp/${id}/video?rss=2.0`;
        return Object.assign(
          await NicoRssLoader.load(_req.url),
          {_req}
        );
      case 'tag':
      case 'search':
        return Object.assign(
          await NicoSearchApiV2Loader.searchMore(id, query.searchParams),
          {_req}
        );
      default:
          throw new Error('unknown query: ' + query);
    }
    result = await netUtil.fetch(_req.url, {credentials: 'include'})
      .then(res => res.json() as Promise<object>);
    return Object.assign(result, {_req});
  }

  constructor(arg: string | NicoQueryParts) {
    if (typeof arg === 'string') {
      arg = NicoQuery.parse(arg);
    }
    const {type, id, params} = arg;
    this.type = type;
    this.id = id || '';
    this.params = Object.assign({}, params || {});
  }

  toString(): string {
    // const {type, id, params} = this;
    return NicoQuery.build(this.type, this.id, this.params);
  }

  get title(): string {
    if(this.params.title) {
      return this.params.title;
    }
    const {type, id} = this;
    switch(type) {
      case 'tag':
        return `タグ検索 「${this.searchWord}」`;
      case 'search':
        return `キーワード検索 「${this.searchWord}」`;
      case 'user':
        return `投稿動画一覧 user/${id}`;
      case 'deflist':
        return 'あとで見る';
      case 'nicorepo':
        return 'ニコレポ新着動画';
      case 'mylist':
      case 'mymylist':
        return `マイリスト mylist/${id}`;
      case 'series':
        return `シリーズ series/${id}`;
      case 'ranking':
        return `ランキング ranking/${id || 'all'}`;
      // Task647 (NQ-CHANNEL-TITLE-001): this case was '' so channel queries had no title.
      case 'channel':
        return `チャンネル動画 channel/${id}`;
      default:
        return '';
    }
  }

  set title(v: string) {
    this.params.title = v;
  }

  get baseString(): string {
    return NicoQuery.build(this.type, this.id, this.baseParams);
  }

  get string(): string {
    return this.toString();
  }

  get baseParams(): NicoQueryParams {
    const params = Object.assign({}, this.params);
    delete params.title;
    return params;
  }

  get isSearch(): boolean {
    return this.type === 'search' || this.type === 'tag';
  }

  get isSearchReady(): string | false {
    return this.isSearch && this.searchWord;
  }

  get searchWord(): string {
    return (this.id || '').trim();
  }

  get isOwnerFilterEnable(): unknown {
    return this.params.ownerFilter || this.params.userId || this.params.channelId;
  }

  set isOwnerFilterEnable(v: unknown) {
    this.params.userId = this.params.channelId = null;
    if (v) {
      this.params.ownerFilter = true;
    } else {
      this.params.ownerFilter = false;
    }
  }

  get searchParams(): NicoQuerySearchParams {
    const {type, params} = this;
    return {
      searchType: type,
      order: (params.sort || '').charAt(0) === '-' ? 'd' : 'a',
      sort: (params.sort || '').substring(1),
      userId: this.isOwnerFilterEnable && params.userId || null,
      channelId: this.isOwnerFilterEnable && params.channelId || null,
      dateFrom: params.start || null,
      dateTo: params.end || null,
      commentCount: params.commentCount || null,
      f_range: params.fRange || null,
      l_range: params.lRange || null,
      // Task189（検索追補Q01）: ページ位置・ジャンル・長さ種別・チャンネル掲載・kindも検索段階へ渡す。
      // 値の検証と、APIへ送るかどうかの判断はVideoSearch（NicoSearchNvapi.normalizeConditions）側で行う
      page: params.page || null,
      genre: params.genre || null,
      selectContentType: params.selectContentType || null,
      channelVideoListingStatus: params.channelVideoListingStatus || null,
      kind: params.kind || null
    };
  }

  nearlyEquals(query: string | NicoQuery): boolean {
    if (typeof query === 'string') {
      query = new NicoQuery(query);
    }
    return this.baseString === query.baseString;
  }

  equals(query: string | NicoQuery): boolean {
    if (typeof query === 'string') {
      query = new NicoQuery(query);
    }
    return this.toString() === query.toString();
  }
}

export {NicoQuery, ItemDataConverter};

import {CrossDomainGate} from '../infra/CrossDomainGate';
import {WindowMessageEmitter} from '../message/messageUtil';
import {textUtil} from '../text/textUtil';
import {sleep} from '../infra/sleep';
//===BEGIN===

const {NicoSearchApiV2Query, NicoSearchApiV2Loader} =
  (function () {
    // 参考: http://site.nicovideo.jp/search-api-docs/search.html
    // http://ch.nicovideo.jp/nico-lab/blomaga/ar930955
    // https://site.nicovideo.jp/search-api-docs/snapshot
    // 2024-03-01頃、公式ドキュメント(https://site.nicovideo.jp/search-api-docs/snapshot)で
    // 「FQDNの変更」が告知され、api.search.nicovideo.jp から snapshot.search.nicovideo.jp に
    // ドメインが移動した(エンドポイント/パラメータ形式自体に変更はない)。Task 023で追随。
    const BASE_URL = 'https://snapshot.search.nicovideo.jp/api/v2/snapshot';
    const API_BASE_URL = `${BASE_URL}/video/contents/search`;
    const VERSION_URL = `${BASE_URL}/version`
    const MESSAGE_ORIGIN = 'https://snapshot.search.nicovideo.jp/';
    const SORT = {
      f: 'startTime',
      v: 'viewCounter',
      r: 'commentCounter',
      m: 'mylistCounter',
      l: 'lengthSeconds',
      n: 'lastCommentTime',
      likeCount: 'likeCounter',
      // Task 068: 「ニコニコで人気」をスナップショット側でも近い並び(-_hotMylistCounter)にする
      h: '_hot',
    };

    // 公式検索の日時指定パラメータ -1h -24h -1w -1m
    const F_RANGE = {
      U_1H: 4,
      U_24H: 1,
      U_1W: 2,
      U_30D: 3
    };

    // 公式検索の動画長指定パラメータ -5min 20min-
    const L_RANGE = {
      U_5MIN: 1,
      O_20MIN: 2
    };


    let gate;

    // なぜかv2はCORSがついてないのでCrossDomainGateの力を借りる
    let initializeCrossDomainGate = function () {
      initializeCrossDomainGate = function () {
      };
      gate = new CrossDomainGate({
        baseUrl: BASE_URL,
        origin: MESSAGE_ORIGIN,
        type: 'searchApi',
        messager: WindowMessageEmitter
      });
    };

    /**
     * 公式検索ページのqueryパラメータをv2用に変換するやつ＋α
     */
    class NicoSearchApiV2Query {

      constructor(word, params = {}) {
        if (word.searchWord) {
          this._initialize(word.searchWord, word);
        } else {
          this._initialize(word, params);
        }
      }

      get q() {
        return this._q;
      }

      get targets() {
        return this._targets;
      }

      get sort() {
        return this._sort;
      }

      get order() {
        return this._order;
      }

      get limit() {
        return this._limit;
      }

      get offset() {
        return this._offset;
      }

      get fields() {
        return this._fields;
      }

      get context() {
        return this._context;
      }

      get hotField() {
        return this._hotField;
      }

      get hotFrom() {
        return this._hotFrom;
      }

      get hotTo() {
        return this._hotTo;
      }

      _initialize(word, params) {
        if (params._now) {
          this.now = params._now;
        }
        const sortTable = SORT;
        this._filters = [];
        this._q = word || params.searchWord || 'ZenzaWatch';
        this._targets =
          params.searchType === 'tag' ?
            ['tagsExact'] : ['tagsExact', 'title', 'description'];
        this._sort =
          (params.order === 'd' ? '-' : '+') +
          (params.sort && sortTable[params.sort] ?
            sortTable[params.sort] : 'lastCommentTime');
        this._order = params.order === 'd' ? 'desc' : 'asc';
        this._limit = 100;
        this._offset = Math.min(
          params.page ? Math.max(parseInt(params.page, 10) - 1, 0) * 25 : 0,
          1600
        );
        this._fields = [
          'contentId', 'title', 'description', 'tags', 'categoryTags',
          'viewCounter', 'commentCounter', 'mylistCounter', 'likeCounter',
          'lengthSeconds', 'startTime', 'thumbnailUrl'
        ];
        this._context = 'ZenzaWatch';

        const n = new Date(), now = this.now;
        if (/^._hot/.test(this.sort)) {
          // 人気が高い順ソート
          (() => {
            this._hotField = 'mylistCounter';
            this._hotFrom = new Date(now - 1 * 24 * 60 * 60 * 1000);
            this._hotTo = n;

            this._sort = '-_hotMylistCounter';
          })();
        }

        if (params.f_range &&
          [F_RANGE.U_1H, F_RANGE.U_24H, F_RANGE.U_1W, F_RANGE.U_30D]
            .includes(params.f_range * 1)) {
          this._filters.push(this._buildFRangeFilter(params.f_range * 1));
        }
        if (params.l_range &&
          [L_RANGE.U_5MIN, L_RANGE.O_20MIN].includes(params.l_range * 1)) {
          this._filters.push(this._buildLRangeFilter(params.l_range * 1));
        }
        if (params.userId && (params.userId + '').match(/^\d+$/)) {
          this._filters.push({type: 'equal', field: 'userId', value: params.userId * 1});
        }
        if (params.channelId && (params.channelId + '').match(/^\d+$/)) {
          this._filters.push({type: 'equal', field: 'channelId', value: params.channelId * 1});
        }
        if (params.commentCount && (params.commentCount + '').match(/^[0-9]+$/)) {
          this._filters.push({
            type: 'range',
            field: 'commentCounter',
            from: params.commentCount * 1
          });
        }
        if (params.utimeFrom || params.utimeTo) {
          this._filters.push(this._buildStartTimeRangeFilter({
            from: params.utimeFrom ? params.utimeFrom * 1 : 0,
            to: params.utimeTo ? params.utimeTo * 1 : now
          }));
        }
        if (params.dateFrom || params.dateTo) {
          this._filters.push(this._buildStartTimeRangeFilter({
            from: params.dateFrom ? (new Date(params.dateFrom)).getTime() : 0,
            to: params.dateTo ? (new Date(params.dateTo)).getTime() : now
          }));
        }
        // 公式検索ページの日付指定
        const dateReg = /^\d{4}-\d{2}-\d{2}$/;
        if (dateReg.test(params.start) && dateReg.test(params.end)) {
          this._filters.push(this._buildStartTimeRangeFilter({
            from: (new Date(params.start)).getTime(),
            to: (new Date(params.end)).getTime()
          }));
        }
      }

      get stringfiedFilters() {
        if (this._filters.length < 1) {
          return '';
        }
        const result = [];
        const TIMEFIELDS = ['startTime'];
        this._filters.forEach((filter) => {
          let isTimeField = TIMEFIELDS.includes(filter.field);
          if (!filter) {
            return;
          }

          if (filter.type === 'equal') {
            result.push(`filters[${filter.field}][0]=${filter.value}`);
          } else if (filter.type === 'range') {
            let from = isTimeField ? this._formatDate(filter.from) : filter.from;
            if (filter.from) {
              result.push(`filters[${filter.field}][gte]=${from}`);
            }
            if (filter.to) {
              let to = isTimeField ? this._formatDate(filter.to) : filter.to;
              result.push(`filters[${filter.field}][lte]=${to}`);
            }
          }
        });
        return result.join('&');
      }

      get filters() {
        return this._filters;
      }

      _formatDate(time) {
        const dt = new Date(time);
        return dt.toISOString().replace(/\.\d*Z/, '') + '%2b00:00'; // '%2b00:00'
      }

      _buildStartTimeRangeFilter({from = 0, to}) {
        const range = {field: 'startTime', type: 'range'};
        if (from !== undefined && to !== undefined) {
          [from, to] = [from, to].sort(); // from < to になるように
        }
        if (from !== undefined) {
          range.from = from;
        }
        if (to !== undefined) {
          range.to = to;
        }
        return range;
      }

      _buildLengthSecondsRangeFilter({from, to}) {
        const range = {field: 'lengthSeconds', type: 'range'};
        if (from !== undefined && to !== undefined) {
          [from, to] = [from, to].sort(); // from < to になるように
        }
        if (from !== undefined) {
          range.from = from;
        }
        if (to !== undefined) {
          range.to = to;
        }
        return range;
      }

      _buildFRangeFilter(range) {
        const now = this.now;
        switch (range * 1) {
          case F_RANGE.U_1H:
            return this._buildStartTimeRangeFilter({
              from: now - 1000 * 60 * 60,
              to: now
            });
          case F_RANGE.U_24H:
            return this._buildStartTimeRangeFilter({
              from: now - 1000 * 60 * 60 * 24,
              to: now
            });
          case F_RANGE.U_1W:
            return this._buildStartTimeRangeFilter({
              from: now - 1000 * 60 * 60 * 24 * 7,
              to: now
            });
          case F_RANGE.U_30D:
            return this._buildStartTimeRangeFilter({
              from: now - 1000 * 60 * 60 * 24 * 30,
              to: now
            });
          default:
            return null;
        }
      }

      _buildLRangeFilter(range) {
        switch (range) {
          case L_RANGE.U_5MIN:
            return this._buildLengthSecondsRangeFilter({
              from: 0,
              to: 60 * 5
            });
          case L_RANGE.O_20MIN:
            return this._buildLengthSecondsRangeFilter({
              from: 60 * 20
            });
        }
      }

      toString() {
        const result = [];
        result.push('q=' + encodeURIComponent(this._q));
        result.push('targets=' + this.targets.join(','));
        result.push('fields=' + this.fields.join(','));

        result.push('_sort=' + encodeURIComponent(this.sort));
        result.push('_limit=' + this.limit);
        result.push('_offset=' + this.offset);
        result.push('_context=' + this.context);

        if (this.sort === '-_hot') {
          result.push('hotField=' + this.hotField);
          result.push('hotFrom=' + this.hotFrom);
          result.push('hotTo=' + this.hotTo);
        }

        const filters = this.stringfiedFilters;
        if (filters) {
          result.push(filters);
        }

        return result.join('&');
      }

      set now(v) {
        this._now = v;
      }

      get now() {
        return this._now || Date.now();
      }

    }

    NicoSearchApiV2Query.SORT = SORT;
    NicoSearchApiV2Query.F_RANGE = F_RANGE;
    NicoSearchApiV2Query.L_RANGE = L_RANGE;

    class NicoSearchApiV2Version {
      constructor() {
        this.date = this.lastUpdate = this._baseDate;
      }

      get isLatest() {
        return (this.date - this._baseDate) > 0;
      }

      async update() {
        const now = Date.now();
        if (now - this.lastUpdate <= 1000 * 60 * 5) {
          return this.date;
        }
        initializeCrossDomainGate();
        const res =  await gate.fetch(VERSION_URL);
        const body = await res.json();
        this.date = new Date(body.last_modified);
        this.lastUpdate = new Date(res.headers.get('Date') ?? now);
        return this.date;
      }

      // スナップショット検索は日本時間5時の時点のデータなので、UTCの20時を取る
      //
      // Date.prototype.setUTCHours()はDateを書き換えた上でタイムスタンプの
      // 数値（ミリ秒のnumber）を返す（Dateオブジェクト自身は返さない）。
      // そのままreturnすると、this.date（コンストラクタ経由）やisLatestの
      // 比較（date - this._baseDate）はnumber同士の減算なので動いてしまう一方、
      // this.dateが一度もupdate()で本物のDateに置き換わらないまま
      // NicoSearchApiV2Loader.search()側でthis.version.date.getTime()を
      // 呼ぶと、numberにはgetTimeが無いため
      // 「this.version.date.getTime is not a function」で例外になる。
      // 明示的にDateオブジェクトのnowを返すよう修正。
      get _baseDate() {
        let now = new Date();
        now.setUTCHours(now.getUTCHours() >= 20 ? 20 : -4, 0, 0);
        return now;
      }
    }

    /**
     * Task 067: ニコニコ本家の検索ページと同じ検索API（nvapi /v2/search/video）。
     *
     * 以前はスナップショット検索API（1日1回更新の索引）を使っていたため、
     * 本家の検索結果と件数・並び・新着動画の有無がずれていた。
     * 2026-09-16に本家のタグ検索ページ（/tag/{word}?responseType=json）が
     * サーバー側で呼んでいる $getSearchVideoV2 と、下記のパラメータで
     * nvapi /v2/search/video を直接呼んだ結果を実機で突き合わせ、
     * 動画ID列（32件）と総件数が完全一致することを確認した:
     *
     *  - 並び順: sort=h→sortKey=hot(sortOrder=none) / f→registeredAt /
     *    v→viewCount / n→lastCommentTime / r→commentCount / m→mylistCount /
     *    l→duration / likeCount→likeCount / p→personalized(none)。
     *    order=d→desc / a→asc。
     *  - 本家はログイン状態・センシティブ設定にかかわらず sensitiveContents=mask を付ける
     *    （付けないと総件数が少なくなり一致しない）。
     *  - l_range=1→maxDuration=300 / l_range=2→minDuration=1200
     *  - f_range=4→1時間前 / 1→24時間前 / 2→1週間前 / 3→1か月前(暦月) / 5→1年前 を minRegisteredAt に
     *  - start/end(YYYY-MM-DD)→ minRegisteredAt=startT00:00:00+09:00 / maxRegisteredAt=endT23:59:59+09:00
     *  - genre→genres
     *  - pageSize=100 の先頭32件は pageSize=32 の結果と同一
     *
     * なお、本家の検索ページ(JSONルート)を直接叩くと、指定した並び順が
     * ユーザーの本家側の既定の並び順として保存されてしまう（実機で確認）ため、
     * 副作用の無い nvapi を直接呼ぶ。
     *
     * 投稿者ID/チャンネルIDやコメント数での絞り込みは本家の検索に存在しないため、
     * それらが指定された時だけ従来のスナップショット検索を使う。
     */
    const NicoSearchNvapi = (() => {
      const API_URL = 'https://nvapi.nicovideo.jp/v2/search/video';
      const PAGE_SIZE = 100;
      const OFFICIAL_PAGE_SIZE = 32; // 本家検索ページの1ページあたりの件数（page=Nの解釈用）
      // Task 073: nvapi /v2/search/video は page=50 (pageSize=100) までしか取れない
      // （page=51 は 400 INVALID_PARAMETER）。つまり1回の検索で取れるのは最大5000件。
      const MAX_API_PAGE = 50;
      const MAX_RESULT = PAGE_SIZE * MAX_API_PAGE;
      // Task 074: 2ページ目以降を同時に取得するページ数（多すぎるとAPIに負担をかけるため控えめに）
      const SEARCH_CONCURRENCY = 4;
      const SORT_KEY = {
        h: 'hot',
        f: 'registeredAt',
        v: 'viewCount',
        n: 'lastCommentTime',
        r: 'commentCount',
        m: 'mylistCount',
        l: 'duration',
        likeCount: 'likeCount',
        p: 'personalized',
        // 新しい本家URL形式（sort=registeredAt 等）がそのまま来た場合
        hot: 'hot',
        hotLikeAndMylist: 'hot',
        personalized: 'personalized',
        registeredAt: 'registeredAt',
        viewCount: 'viewCount',
        lastCommentTime: 'lastCommentTime',
        commentCount: 'commentCount',
        mylistCount: 'mylistCount',
        duration: 'duration'
      };
      const UNORDERABLE = ['hot', 'personalized'];
      const dateReg = /^\d{4}-\d{2}-\d{2}$/;

      const canHandle = (params = {}) => {
        if (params.userId || params.channelId || params.commentCount) {
          return false;
        }
        return true;
      };

      const buildQuery = (word, params = {}) => {
        const q = {};
        const sortKey = SORT_KEY[params.sort] || 'hot';
        q.sortKey = sortKey;
        if (UNORDERABLE.includes(sortKey)) {
          q.sortOrder = 'none';
        } else {
          q.sortOrder = (params.order === 'a' || params.order === 'asc') ? 'asc' : 'desc';
        }
        if (params.searchType === 'tag') {
          q.tag = word;
        } else {
          q.keyword = word;
        }
        const lRange = params.l_range * 1;
        if (lRange === 1) {
          q.maxDuration = 300;
        } else if (lRange === 2) {
          q.minDuration = 1200;
        }
        const now = params._now ? new Date(params._now) : new Date();
        const fRange = params.f_range * 1;
        const from = new Date(now.getTime());
        switch (fRange) {
          case 4: from.setTime(now.getTime() - 60 * 60 * 1000); break;
          case 1: from.setTime(now.getTime() - 24 * 60 * 60 * 1000); break;
          case 2: from.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case 3: from.setMonth(from.getMonth() - 1); break;
          case 5: from.setFullYear(from.getFullYear() - 1); break;
        }
        if ([1, 2, 3, 4, 5].includes(fRange)) {
          q.minRegisteredAt = from.toISOString();
        }
        if (dateReg.test(params.start || '')) {
          q.minRegisteredAt = `${params.start}T00:00:00+09:00`;
        }
        if (dateReg.test(params.end || '')) {
          q.maxRegisteredAt = `${params.end}T23:59:59+09:00`;
        }
        if (params.dateFrom) {
          q.minRegisteredAt = new Date(params.dateFrom).toISOString();
        }
        if (params.dateTo) {
          q.maxRegisteredAt = new Date(params.dateTo).toISOString();
        }
        if (params.utimeFrom) {
          q.minRegisteredAt = new Date(params.utimeFrom * 1000).toISOString();
        }
        if (params.utimeTo) {
          q.maxRegisteredAt = new Date(params.utimeTo * 1000).toISOString();
        }
        if (params.genre && params.genre !== 'all') {
          q.genres = params.genre;
        }
        q.sensitiveContents = 'mask';
        return q;
      };

      const toLegacyItem = item => {
        const count = item.count || {};
        const thumb = item.thumbnail || {};
        const sec = item.duration || 0;
        const dt = item.registeredAt ? textUtil.dateToString(new Date(item.registeredAt)) : '';
        return {
          // VideoListItem.createByMylistItem は content があればこちらを使う
          content: item,
          id: item.id,
          type: 0,
          length: sec ? Math.floor(sec / 60) + ':' + (sec % 60 + 100).toString().substring(1) : '',
          mylist_counter: count.mylist,
          view_counter: count.view,
          num_res: count.comment,
          like_counter: count.like,
          first_retrieve: dt,
          create_time: dt,
          thumbnail_url: thumb.listingUrl || thumb.middleUrl || thumb.url,
          title: item.title,
          description_short: item.shortDescription || '',
          description_full: item.shortDescription || '',
          length_seconds: sec,
          is_middle_thumbnail: !!(thumb.listingUrl || thumb.middleUrl)
        };
      };

      const fetchPage = async (query, page, pageSize) => {
        const qs = new URLSearchParams(Object.assign({}, query, {pageSize, page}));
        const net = (typeof netUtil !== 'undefined') ? netUtil : {fetch: (u, o) => fetch(u, o)};
        const res = await net.fetch(`${API_URL}?${qs.toString()}`, {
          credentials: 'include',
          headers: {'X-Frontend-Id': '6', 'X-Frontend-Version': '0'}
        });
        const json = await res.json();
        if (!json || !json.meta || json.meta.status !== 200 || !json.data) {
          throw Object.assign(new Error(`nvapi search failed (${json && json.meta ? `${json.meta.status} ${json.meta.errorCode || ''}` : res.status})`),
            {status: json && json.meta && json.meta.status});
        }
        return json.data;
      };

      /**
       * @return {Promise<{status:'ok', count:number, list:Object[], engine:'nvapi'}>}
       */
      const search = async (word, params = {}, maxLimit = 100) => {
        const query = buildQuery(word, params);
        // page=N は本家検索ページ(32件/ページ)のN ページ目から、と解釈する
        const officialPage = Math.max(parseInt(params.page, 10) || 1, 1);
        const startOffset = (officialPage - 1) * OFFICIAL_PAGE_SIZE;
        // Task 073: 以前は「最大10ページ(1000件)」で打ち切っていた。設定（search.limit）で
        // 最大件数を増やせるようにしたため、APIの上限（50ページ=5000件）まで取れるようにする。
        const limit = Math.min(Math.max(1, parseInt(maxLimit, 10) || 100), MAX_RESULT);
        const firstPage = Math.floor(startOffset / PAGE_SIZE) + 1;
        const firstSkip = startOffset % PAGE_SIZE;
        const toItems = (data, apiPage) => {
          let pageItems = data.items || [];
          // 本家の検索ページは1ページ目だけ additionals.suggestedVideo を先頭に差し込み、
          // 本体の一覧からは同じ動画を除く（配信JSの処理と同じ）。
          const suggested = data.additionals && data.additionals.suggestedVideo;
          if (suggested && startOffset === 0 && apiPage === 1) {
            pageItems = [suggested, ...pageItems.filter(item => item.id !== suggested.id)];
          }
          return (apiPage === firstPage ? pageItems.slice(firstSkip) : pageItems).map(toLegacyItem);
        };
        // 1ページ目は単独で取得する（総件数が分かり、失敗時はスナップショット検索へ切り替えるため）
        const first = await fetchPage(query, firstPage, PAGE_SIZE);
        const count = first.totalCount;
        let list = toItems(first, firstPage);
        // Task 074: 2ページ目以降は総件数から必要なページ数を割り出し、同時にSEARCH_CONCURRENCY件ずつ
        // 並行して取得する（以前は1ページずつ順番に取得していたため1000件で約2〜3秒かかっていた）。
        // 結果の並び順はページ順のまま。途中のページが失敗した場合は、その直前までの連続した分だけを返す。
        const available = Math.min(count, MAX_RESULT) - (firstPage - 1) * PAGE_SIZE - firstSkip;
        const wanted = Math.min(limit, Math.max(0, available));
        const lastPage = Math.min(MAX_API_PAGE, firstPage + Math.ceil(Math.max(0, wanted - list.length) / PAGE_SIZE));
        if ((first.items || []).length >= PAGE_SIZE && list.length < wanted && lastPage > firstPage) {
          const pages = [];
          for (let pg = firstPage + 1; pg <= lastPage; pg++) {
            pages.push(pg);
          }
          const results = new Array(pages.length);
          let failedAt = pages.length;
          for (let i = 0; i < pages.length && i < failedAt; i += SEARCH_CONCURRENCY) {
            const chunk = pages.slice(i, i + SEARCH_CONCURRENCY);
            await Promise.all(chunk.map((pg, k) =>
              fetchPage(query, pg, PAGE_SIZE)
                .then(data => { results[i + k] = data; })
                .catch(e => {
                  failedAt = Math.min(failedAt, i + k);
                  window.console.warn('nvapi検索: %dページ目の取得に失敗しました', pg, e);
                })
            ));
          }
          for (let i = 0; i < failedAt; i++) {
            const data = results[i];
            if (!data) { break; }
            list = list.concat(toItems(data, pages[i]));
            if ((data.items || []).length < PAGE_SIZE) { break; }
          }
          if (failedAt < pages.length) {
            window.console.warn('nvapi検索: 途中のページで失敗したため、%d件で打ち切ります', list.length);
          }
        }
        return {status: 'ok', count, list: list.slice(0, limit), engine: 'nvapi', word, params};
      };

      return {canHandle, buildQuery, search, toLegacyItem};
    })();

    class NicoSearchApiV2Loader {
      static version = new NicoSearchApiV2Version;
      static cacheStorage;
      static CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;

      static async search(word, params) {
        // Task 067: 本家と同じ検索APIを優先し、失敗時・未対応の絞り込み時のみスナップショット検索
        const searchWord = (word && word.searchWord) ? word.searchWord : word;
        const searchParams = (word && word.searchWord) ? word : (params || {});
        if (!searchParams.useSnapshotSearch && typeof searchWord === 'string' && NicoSearchNvapi.canHandle(searchParams)) {
          try {
            return await NicoSearchNvapi.search(searchWord, searchParams, 100);
          } catch (e) {
            window.console.warn('本家検索API(nvapi)での検索に失敗したため、スナップショット検索を使います', e);
          }
        }
        return NicoSearchApiV2Loader.searchBySnapshot(word, params);
      }

      static async searchBySnapshot(word, params) {
        initializeCrossDomainGate();
        const query = new NicoSearchApiV2Query(word, params);
        const url = API_BASE_URL + '?' + query.toString();
        const version = this.version.isLatest
          ? this.version.date.getTime()
          : await this.version.update().then(date => date.getTime());

        if (!this.cacheStorage) {
          this.cacheStorage = new CacheStorage(sessionStorage);
        }
        const cacheKey = `search: ${[
          `words:${query.q}`,
          `targets:${query.targets.join(',')}`,
          `sort:${query.sort}`,
          `filters:${query.stringfiedFilters}`,
          `offset:${query.offset}`,
        ].join(', ')}`;
        const cacheData = this.cacheStorage.getItem(cacheKey);
        if (cacheData && cacheData.version === version) {
          return cacheData.data;
        }

        return gate.fetch(url).then(res => res.text()).then(result => {
          result = NicoSearchApiV2Loader.parseResult(result);
          if (typeof result !== 'number' && result.status === 'ok') {
            let data = Object.assign(result, {word, params});
            this.cacheStorage.setItem(cacheKey, {data, version}, this.CACHE_EXPIRE_TIME);
            return Promise.resolve(data);
          } else {
            let description;
            switch (result) {
              default:
                description = 'UNKNOWN ERROR';
                break;
              case 400:
                description = 'INVALID QUERY';
                break;
              case 500:
                description = 'INTERNAL SERVER ERROR';
                break;
              case 503:
                description = 'MAINTENANCE';
                break;
            }
            return Promise.reject({
              status: 'fail',
              description
            });
          }
        });
      }

      /**
       * Task 066: 動画IDから投稿者ID(userId)／チャンネルID(channelId)を引く。
       * 投稿者欄が空の動画（退会・非公開扱い等）で、投稿者IDを補完するための
       * 最後の手段として使う。
       *
       * Codexのニコニコ解析（NICO-SNAPSHOT-LIVE-20260914-BATCH / -OWNER）で、
       * 空のq・filters[contentId][n]・fields=contentId,userId,channelId の指定で
       * 2件/36件/3件とも指定IDが全件返ること、sm46778748 の userId が
       * 広告単独情報APIの ownerId と一致することを実通信で確認済み。
       * ただしスナップショットは約1日1回の更新のため、新しい動画は載っていない。
       *
       * @param {string[]} watchIds
       * @return {Promise<Map<string,{userId:number|null,channelId:number|null}>>}
       */
      static async lookupOwnerIds(watchIds) {
        initializeCrossDomainGate();
        const ids = [...new Set((watchIds || []).filter(Boolean).map(String))].slice(0, 50);
        const result = new Map();
        if (!ids.length) {
          return result;
        }
        const params = [
          'q=',
          'targets=title',
          'fields=contentId,userId,channelId',
          '_sort=-startTime',
          '_offset=0',
          `_limit=${ids.length}`,
          '_context=ZenzaWatch'
        ];
        ids.forEach((id, i) => params.push(`filters[contentId][${i}]=${encodeURIComponent(id)}`));
        const res = await gate.fetch(API_BASE_URL + '?' + params.join('&'));
        const json = NicoSearchApiV2Loader._jsonParse(await res.text());
        if (!json || !json.meta || json.meta.status !== 200 || !Array.isArray(json.data)) {
          return result;
        }
        json.data.forEach(item => {
          result.set(String(item.contentId), {
            userId: item.userId || null,
            channelId: item.channelId || null
          });
        });
        return result;
      }

      /**
       * 100件以上検索する用
       */
      static async searchMore(word, params, maxLimit = 300) {
        // Task 074: 「再生中の動画の投稿者の動画のみ」。スナップショット検索の userId 絞り込みは
        // 廃止されており(400 QUERY_PARSE_ERROR)、本家検索API(nvapi)も userId を無視するため専用の方法で探す
        if (params && (params.userId || params.channelId)) {
          return NicoSearchApiV2Loader.searchByOwner(word, params, maxLimit);
        }
        // Task 067: 本家と同じ検索API（100件ずつ取得）
        if (!(params && params.useSnapshotSearch) && typeof word === 'string' && NicoSearchNvapi.canHandle(params || {})) {
          try {
            const result = await NicoSearchNvapi.search(word, params || {}, maxLimit);
            window.console.info('%c検索(nvapi): "%s" %d件/全%d件', 'background: lightgreen;', word, result.list.length, result.count);
            return result;
          } catch (e) {
            window.console.warn('本家検索API(nvapi)での検索に失敗したため、スナップショット検索を使います', e);
          }
        }
        return NicoSearchApiV2Loader.searchMoreBySnapshot(word, params, maxLimit);
      }

      /**
       * Task 074: 投稿者の動画だけから検索する。
       *  1. nvapi /v3/users/{userId}/videos でその投稿者の公開動画一覧を取得（最大5000件、並行取得）
       *  2. スナップショット検索に「動画IDの一覧（100件ずつ）＋検索語」を渡し、語に一致する動画IDだけを得る
       *     （filters[contentId][n] は今も使える。-除外やORもスナップショット側で解釈される）
       *  3. 1の一覧から一致した動画だけを残し、期間・長さで絞り込み、並び順を揃える
       * 注意: スナップショットは約1日1回の更新のため、投稿から1日以内の動画はタグ・語が一致しても出ない。
       *       チャンネル動画は投稿動画一覧のAPIが無いため未対応。ジャンルの絞り込みは反映しない。
       */
      static async searchByOwner(word, params = {}, maxLimit = 300) {
        if (params.channelId && !params.userId) {
          throw Object.assign(new Error('チャンネル動画では「投稿者の動画のみ」を使えません'), {status: 'fail'});
        }
        const userId = String(params.userId).replace(/[^0-9]/g, '');
        if (!userId) {
          throw Object.assign(new Error('投稿者IDが不明です'), {status: 'fail'});
        }
        const limit = Math.min(Math.max(1, parseInt(maxLimit, 10) || 300), 5000);
        const headers = {'X-Frontend-Id': '6', 'X-Frontend-Version': '0'};
        const net = (typeof netUtil !== 'undefined') ? netUtil : {fetch: (u, o) => fetch(u, o)};
        const fetchUserPage = async page => {
          const url = `https://nvapi.nicovideo.jp/v3/users/${userId}/videos?sortKey=registeredAt&sortOrder=desc&pageSize=100&page=${page}`;
          const res = await net.fetch(url, {credentials: 'include', headers});
          const json = await res.json();
          if (!json || !json.meta || json.meta.status !== 200 || !json.data) {
            throw new Error(`投稿動画一覧の取得に失敗 (${json && json.meta ? json.meta.status : res.status})`);
          }
          return json.data;
        };
        // 1. 投稿動画一覧（1ページ目で総数を知り、残りは4ページずつ並行取得）
        const first = await fetchUserPage(1);
        const total = Math.min(first.totalCount || 0, 5000);
        let videos = (first.items || []).map(i => i.essential).filter(Boolean);
        const lastPage = Math.ceil(total / 100);
        for (let pg = 2; pg <= lastPage; pg += 4) {
          const chunk = [];
          for (let k = pg; k < pg + 4 && k <= lastPage; k++) { chunk.push(k); }
          const pages = await Promise.all(chunk.map(k => fetchUserPage(k).catch(() => null)));
          for (const data of pages) {
            if (!data) { break; }
            videos = videos.concat((data.items || []).map(i => i.essential).filter(Boolean));
          }
        }
        // 2. スナップショットで検索語に一致する動画IDを調べる（100件ずつ）
        initializeCrossDomainGate();
        const targets = params.searchType === 'tag' ? 'tagsExact' : 'title,description,tags';
        const matched = new Set();
        const ids = videos.map(v => v.id);
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          const q = [
            `q=${encodeURIComponent(word)}`,
            `targets=${targets}`,
            'fields=contentId',
            '_sort=-startTime',
            '_offset=0',
            `_limit=${batch.length}`,
            '_context=ZenzaWatch'
          ];
          batch.forEach((id, n) => q.push(`filters[contentId][${n}]=${encodeURIComponent(id)}`));
          const res = await gate.fetch(API_BASE_URL + '?' + q.join('&'));
          const json = NicoSearchApiV2Loader._jsonParse(await res.text());
          if (!json || !json.meta || json.meta.status !== 200) {
            throw Object.assign(new Error('スナップショット検索に失敗しました'), {status: 'fail'});
          }
          (json.data || []).forEach(item => matched.add(item.contentId));
        }
        // 3. 期間・長さの絞り込みと並び順
        const now = Date.now();
        const fRange = params.f_range * 1;
        const rangeMs = {4: 3600e3, 1: 86400e3, 2: 7 * 86400e3, 3: 31 * 86400e3, 5: 365 * 86400e3}[fRange];
        const lRange = params.l_range * 1;
        let list = videos.filter(v => matched.has(v.id)).filter(v => {
          const sec = v.duration || 0;
          if (lRange === 1 && sec > 300) { return false; }
          if (lRange === 2 && sec < 1200) { return false; }
          if (rangeMs && v.registeredAt && now - new Date(v.registeredAt).getTime() > rangeMs) { return false; }
          return true;
        });
        const count = v => v.count || {};
        const SORT = {
          f: v => new Date(v.registeredAt || 0).getTime(),
          v: v => count(v).view || 0,
          r: v => count(v).comment || 0,
          m: v => count(v).mylist || 0,
          likeCount: v => count(v).like || 0,
          l: v => v.duration || 0
        };
        const key = SORT[params.sort] || SORT.f;
        const dir = (params.order === 'a' || params.order === 'asc') ? 1 : -1;
        list.sort((a, b) => (key(a) - key(b)) * dir);
        const nvapi = NicoSearchApiV2Loader.nvapi;
        const result = list.slice(0, limit).map(v => nvapi.toLegacyItem(v));
        window.console.info('%c投稿者の動画から検索: "%s" 投稿動画%d件中 %d件一致', 'background: lightgreen;', word, videos.length, list.length);
        return {status: 'ok', count: list.length, list: result, engine: 'owner', word, params};
      }

      static async searchMoreBySnapshot(word, params, maxLimit = 300) {

        const ONCE_LIMIT = 100; // 一回で取れる件数
        const PER_PAGE = 25; // 検索ページで1ページあたりに表示される件数
        const MAX_PAGE = 64; // 25 * 64 = 1600
        // Task 073: search.limit を増やせるようにしたが、スナップショット検索は
        // 1回ごとに待ち時間が伸びる（300ms × 回数）ため、従来通り1600件で打ち切る。
        maxLimit = Math.min(Math.max(1, parseInt(maxLimit, 10) || 300), PER_PAGE * MAX_PAGE);
        params = params || {};

        const result = await NicoSearchApiV2Loader.searchBySnapshot(word, params);

        const currentPage = params.page ? parseInt(params.page, 10) : 1;
        const currentOffset = (currentPage - 1) * PER_PAGE;

        if (result.count <= ONCE_LIMIT) {
          return result;
        }

        const searchCount = Math.min(
          Math.ceil((result.count - currentOffset) / PER_PAGE) - 1,
          Math.ceil((maxLimit - ONCE_LIMIT) / ONCE_LIMIT)
        );

        //// TODO: 途中で失敗したらそこまででもいいので返す？
        for (let i = 1; i <= searchCount; i++) {
          await sleep(300 * i);
          let page = currentPage + i * (ONCE_LIMIT / PER_PAGE);
          console.log('searchNext: "%s"', word, page, params);
          let res = await NicoSearchApiV2Loader.searchBySnapshot(word, Object.assign(params, {page}));
          if (res && res.list && res.list.length) {
            result.list = result.list.concat(res.list);
          } else {
            break;
          }
        }
        return Object.assign(result, {word, params});
      }

      static _jsonParse(result) {
        try {
          return JSON.parse(result);
        } catch (e) {
          window.console.error('JSON parse error', e);
          return null;
        }
      }

      static parseResult(jsonText) {
        const data = NicoSearchApiV2Loader._jsonParse(jsonText);
        if (!data) {
          return 0;
        }
        const status = data.meta.status;
        const result = {
          status: status === 200 ? 'ok' : 'fail',
          count: data.meta.totalCount,
          list: []
        };
        if (status !== 200) {
          return status;
        }
        const midThumbnailThreshold = 23608629; // .Mのついた最小ID?
        data.data.forEach(item => {
          let description = item.description ? item.description.replace(/<.*?>/g, '') : '';
          if (item.thumbnailUrl.indexOf('.M') >= 0) {
            item.thumbnail_url = item.thumbnail_url.replace(/\.M$/, '');
            item.is_middle_thumbnail = true;
          } else if (item.thumbnailUrl.indexOf('.M') < 0 &&
            item.contentId.indexOf('sm') === 0) {
            let _id = parseInt(item.contentId.substring(2), 10);
            if (_id >= midThumbnailThreshold) {
              item.is_middle_thumbnail = true;
            }
          }
          const dt = textUtil.dateToString(new Date(item.startTime));

          result.list.push({
            id: item.contentId,
            type: 0, // 0 = VIDEO,
            length: item.lengthSeconds ?
              Math.floor(item.lengthSeconds / 60) + ':' +
              (item.lengthSeconds % 60 + 100).toString().substring(1) : '',
            mylist_counter: item.mylistCounter,
            view_counter: item.viewCounter,
            num_res: item.commentCounter,
            first_retrieve: dt,
            create_time: dt,
            thumbnail_url: item.thumbnailUrl,
            title: item.title,
            description_short: description.substring(0, 150),
            description_full: description,
            length_seconds: item.lengthSeconds,
            //last_res_body:     item.lastResBody,
            is_middle_thumbnail: item.is_middle_thumbnail
          });
        });
        return result;
      }
    }

    NicoSearchApiV2Loader.nvapi = NicoSearchNvapi;
    return {NicoSearchApiV2Query, NicoSearchApiV2Loader};
  })();

/**
 * videoSearch.sort の保存値（例: "playlist" / "f" / "l,a"）を解釈する。
 *
 * 検索パネル(VideoInfoPanel.jsのVideoSearchForm)の<select name="sort">は、
 * 選んだ項目の値をそのまま「フィールド」または「フィールド,方向」という
 * 1本の文字列としてvideoSearch.sortへ保存する（方向省略時は各フィールドの
 * 既定方向＝降順'd'を意味する。例:"l"=長い順(降順)、"l,a"=短い順(昇順)）。
 *
 * タグ検索(TagListView.jsの▶ボタン)も同じvideoSearch.sortを読むが、以前は
 * こことは別に「フィールド」と「方向('desc'/'asc'という単語）」を別々の
 * キー(videoSearch.sort/videoSearch.order)として独自に解釈しようとしていた。
 * その結果、(1) 検索パネル側でこの値を変更すると、次にタグをクリックした
 * 時に"l,a"のような値がSORTテーブルの照合に失敗してlastCommentTime（コメント
 * 日時順）へ無言でフォールバックし、(2) 独自に読んでいたvideoSearch.orderは
 * 実際のUIのどこからも更新されない上に'desc'/'asc'という単語自体が
 * NicoSearchApiV2Queryの期待する単一文字'd'/'a'と一致せず常に昇順に固定される、
 * という2つの不具合が起きていた（タグ検索は動くが並び順がところどころ
 * 意図と違う、という症状の原因）。
 *
 * 解釈を1箇所にまとめ、検索パネル・タグ検索の両方がここを通すことで
 * 表記のずれを無くす。
 *
 * 【Task 058で判明した不具合の注意】この関数の定義は、必ずファイル末尾の
 * 区切りコメント（BEGIN/ENDマーカー）より前の範囲内に置くこと。build.js の
 * requireFile() はそのBEGIN/ENDマーカーの範囲だけを他ファイルへinlineするため、
 * マーカーより後に置くとビルド後のスクリプトには一切含まれず、
 * "parseVideoSearchSortValue is not defined" という実行時エラーになる
 * （Task 056で実際にこの位置に置いてしまい、タグ検索が丸ごと壊れた）。
 */
const parseVideoSearchSortValue = (raw) => {
  const parts = (raw || '').split(',');
  const isPlaylistSort = parts[0] === 'playlist';
  return {
    sort: isPlaylistSort ? 'f' : (parts[0] || 'f'),
    order: parts[1] || 'd',
    playlistSort: isPlaylistSort
  };
};
//===END===

export {
  NicoSearchApiV2Query,
  NicoSearchApiV2Loader,
  parseVideoSearchSortValue
};


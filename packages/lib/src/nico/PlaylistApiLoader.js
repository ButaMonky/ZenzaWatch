import {netUtil} from '../infra/netUtil';
import {CacheStorage} from '../infra/CacheStorage';

//===BEGIN===
const PlaylistApiLoader = (() => {
  const CACHE_EXPIRE_TIME = 5 * 60 * 1000;
  let cacheStorage = null;

  class PlaylistApiLoader {
    constructor() {
      if (!cacheStorage) {
        cacheStorage = new CacheStorage(sessionStorage);
      }
    }

    async load({ type, id, options }, { frontendId = 6, frontendVersion = 0 } = {}) {
      const { url, cacheKey } = ((type) => {
        switch (type) {
          case 'series':
            return this._buildSeriesURL(id);
          case 'user-uploaded':
            return this._buildUserUploadedURL(id, options);
          case 'mylist':
            return this._buildMylistURL(id, options);
          case 'watchlater':
            return this._buildWatchlaterURL(options);
          case 'search':
            return this._buildSearchURL(options);
          default:
            return {};
        }
      })(type);

      if (url === undefined || cacheKey === undefined) {
        throw new Error(`プレイリストの取得失敗(3) ${type}`);
      }

      // nvapi でソートされた結果をもらうのでそのままキャッシュする
      const cacheData = cacheStorage.getItem(cacheKey);
      if (cacheData) {
        return cacheData;
      }

      // nvapi に X-Frontend-Id header が必要
      const result = await netUtil.fetch(url, {
        headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion },
        credentials: 'include',
      }).then(r => r.json())
        .catch(e => { throw new Error(`プレイリストの取得失敗(2) ${type}`, e); });

      if (result.meta.status !== 200 || !result.data.items) {
        throw new Error(`プレイリストの取得失敗(1) ${type}`, result);
      }

      const data = result.data.items;
      cacheStorage.setItem(cacheKey, data, CACHE_EXPIRE_TIME);
      return data;
    }

    // 動画シリーズ
    // https://nvapi.nicovideo.jp/v1/playlist/series/${seriesId}?sortOrder=${sortOrder}&sortKey=${sortKey}
    _buildSeriesURL(seriesId) {
      const url = `https://nvapi.nicovideo.jp/v1/playlist/series/${seriesId}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // ユーザー投稿
    // https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/${userId}?sortOrder=${sortOrder}&sortKey=${sortKey}
    //
    // Task 041: cacheKeyはリクエストURLそのものから作る。
    // 以前は userId と sortKey/sortOrder だけを並べた文字列にしていたため、
    // それ以外のオプション（動画の種類の絞り込み、ページ指定など）が違っても
    // 同じキーになってしまい、**別の条件で読み込んだのに、直前に読み込んだ方の
    // 結果がキャッシュから返る**状態になっていた。
    // 返ってきたのが直前と同じ動画一覧なので、プレイリストへの追加時に
    // 「すべて重複」として弾かれ、「何も追加されない」ように見える
    // （キャッシュの有効期間は5分なので、再現したりしなかったりする）。
    // URLをそのままキーにすれば、条件が違えば必ずキーも違う。
    _buildUserUploadedURL(userId, options = {}) {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'desc', sortKey: 'registeredAt' }, options));
      const url = `https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/${userId}?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // マイリスト
    // https://nvapi.nicovideo.jp/v1/playlist/mylist/${mylistId}?sortOrder=${sortOrder}&sortKey=${sortKey}
    _buildMylistURL(mylistId, options = {}) {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'asc', sortKey: 'registeredAt' }, options));
      const url = `https://nvapi.nicovideo.jp/v1/playlist/mylist/${mylistId}?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // 後で見る
    // https://nvapi.nicovideo.jp/v1/playlist/watch-later?sortOrder=${sortOrder}&sortKey=${sortKey}
    _buildWatchlaterURL(options = {}) {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'asc', sortKey: 'registeredAt' }, options));
      const url = `https://nvapi.nicovideo.jp/v1/playlist/watch-later?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // 検索
    // https://nvapi.nicovideo.jp/v1/playlist/search?sortOrder=${sortOrder}&sortKey=${sortKey}&keyword=${keyword}&pageSize=${pageSize}&page=${page}
    _buildSearchURL(options = {}) {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'desc', sortKey: 'registeredAt' }, options));
      const url = `https://nvapi.nicovideo.jp/v1/playlist/search?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }
  }

  return new PlaylistApiLoader();
})();

//===END===

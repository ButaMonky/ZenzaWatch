/**
 * Canonical TypeScript source for packages/lib/src/nico/MylistApiLoader.js (Task471).
 * Mylist / watch-later read and write APIs (nvapi). Endpoints, HTTP methods,
 * headers, cache keys, events and error metadata (Task264 contract) are unchanged.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

export interface MylistCacheStorage {
  getItem(key: string): unknown;
  setItem(key: string, value: unknown, expireTime?: number): void;
  removeItem(key: string): void;
}
declare const CacheStorage: new (storage: Storage) => MylistCacheStorage;

/** Module-level emitter created outside the legacy build section (`const emitter = new Emitter()`). */
export interface MylistEmitter {
  on(name: 'csrfTokenUpdate', callback: (token: string) => void): unknown;
  emitAsync(name: string, ...args: unknown[]): unknown;
}
declare const emitter: MylistEmitter;

type ZenzaWindow = Window & {ZenzaWatch?: unknown};

/** Error thrown by every API here. `status` is 'fail' or 'not_found'. */
export interface MylistError extends Error {
  status: string;
  result?: unknown;
  code?: unknown;
  cause?: unknown;
}
export interface MylistErrorInit {
  status?: string;
  result?: unknown;
  code?: unknown;
  cause?: unknown;
}

export interface MylistFrontend {
  frontendId?: number;
  frontendVersion?: number;
}

/** One list entry. Only `watchId`/`itemId` are read here; the rest is passed through. */
export interface MylistItemProbe {
  readonly watchId?: unknown;
  readonly itemId?: unknown;
  readonly [key: string]: unknown;
}
/** A page of `watchLater` / `mylist`; pages are merged in place like the legacy code. */
export interface MylistPageProbe {
  hasInvisibleItems?: unknown;
  hasNext?: unknown;
  items: MylistItemProbe[];
}
/**
 * Fields read before validation. Missing `meta`/`data`/`error` throw TypeError
 * exactly as the legacy JS does (parity-tested); nothing else is assumed.
 */
export interface MylistEnvelopeProbe {
  readonly meta: {readonly status?: unknown};
  readonly data: {
    readonly watchLater?: MylistPageProbe;
    readonly mylist?: MylistPageProbe;
    readonly mylists?: unknown;
  };
  readonly error: {readonly code?: unknown; readonly description?: unknown};
  readonly status?: unknown;
  readonly message?: unknown;
}

export interface MylistOk {
  status: 'ok';
  result: unknown;
  message: string;
}

export interface MylistApiLoaderClient {
  setCsrfToken(token: unknown): void;
  _getCsrfToken(): Promise<unknown>;
  _getDeflistItems(frontendId?: number, frontendVersion?: number): Promise<MylistItemProbe[]>;
  _getMylistItems(id: string | number, frontendId?: number, frontendVersion?: number): Promise<MylistItemProbe[]>;
  /** Resolves `data.mylists` as received (cached 5 minutes). */
  getMylistList(frontend?: MylistFrontend): Promise<unknown>;
  findDeflistItemByWatchId(watchId: string): Promise<MylistItemProbe>;
  findMylistItemByWatchId(watchId: string, groupId: string | number): Promise<MylistItemProbe>;
  removeDeflistItem(watchId: string, frontend?: MylistFrontend): Promise<MylistOk>;
  removeMylistItem(watchId: string, groupId: string | number, frontend?: MylistFrontend): Promise<MylistOk>;
  addDeflistItem(watchId: string, description?: string | null, isRetry?: boolean, frontend?: MylistFrontend): Promise<MylistOk>;
  addMylistItem(watchId: string, groupId: string | number, description?: string | null, frontend?: MylistFrontend): Promise<MylistOk>;
}

const MylistApiLoader: MylistApiLoaderClient = (() => {
  // マイリスト/あとで見るの取得APIには
  // www.nicovideo.jp配下とflapi.nicovideo.jp配下の２種類がある
  // 他人のマイリストを取得するにはflapi、マイリストの編集にはwwwのapiが必要
  // データのフォーマットが微妙に異なるのでめんどくさい
  //
  // おかげでソート処理が悲しいことに
  //
  const CACHE_EXPIRE_TIME = 5 * 60 * 1000;
  const TOKEN_EXPIRE_TIME = 59 * 60 * 1000;
  const createMylistError = (message: string, {
    status = 'fail',
    result,
    code,
    cause
  }: MylistErrorInit = {}): MylistError => {
    const error = new Error(message) as MylistError;
    error.status = status;
    if (result !== undefined) { error.result = result; }
    if (code !== undefined) { error.code = code; }
    if (cause !== undefined) { error.cause = cause; }
    return error;
  };
  let cacheStorage: MylistCacheStorage | null = null;
  let token: unknown = '';


  if ((window as ZenzaWindow).ZenzaWatch) {
    emitter.on('csrfTokenUpdate', (t: string) => {
      token = t;
      if (cacheStorage) {
        cacheStorage.setItem('csrfToken', token, TOKEN_EXPIRE_TIME);
      }
    });
  }

  // URLSearchParams stringifies these numbers exactly like the legacy code.
  type NumericQuery = Record<string, string>;

  class MylistApiLoader implements MylistApiLoaderClient {
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
    setCsrfToken(t: unknown): void {
      token = t;
      if (cacheStorage) {
        cacheStorage.setItem('csrfToken', token, TOKEN_EXPIRE_TIME);
      }else{
        cacheStorage = new CacheStorage(sessionStorage);
        cacheStorage.setItem('csrfToken', token, TOKEN_EXPIRE_TIME);
      }
    }

    // どうにもトークンが取れなくなっていたので、専用の関数作成。
    // 一応、キャッシュもされている(はず)
    async _getCsrfToken(): Promise<unknown> {

        if (!cacheStorage) {
            cacheStorage = new CacheStorage(sessionStorage);
        }

        token = cacheStorage.getItem('csrfToken');

        //キャッシュにあったらそこで返す
        if (token) {
            console.log('cached token exists'); // Task 088: トークンの値はログに出さない
        }else{

            //そもそもemit元からは取れる物がないんだから、
            //マイリストページからトークン持ってくるしかないでしょ
            const tokenUrl = 'https://www.nicovideo.jp/my/mylist';
            const result = await netUtil.fetch( tokenUrl, {
            credentials: 'include'
            }).then((r: Response): Promise<string> => r.text()).catch((result: unknown): never => {
                throw new Error('マイリストトークン取得失敗', {result, status: 'fail'} as ErrorOptions);
            });

            const dom = new DOMParser().parseFromString(result, 'text/html');
            const initUserpageDataContena = dom.querySelector('#js-initial-userpage-data') as Element;
            const env = JSON.parse(initUserpageDataContena.getAttribute('data-environment') as string);

            this.setCsrfToken(env.csrfToken);
        }

        return token;

    }
    async _getDeflistItems(frontendId: number = 6, frontendVersion: number = 0): Promise<MylistItemProbe[]> {
      const url = 'https://nvapi.nicovideo.jp/v1/users/me/watch-later?sortKey=addedAt&sortOrder=desc';
      const page = new URLSearchParams({ pageSize: 100, page: 1 } as unknown as NumericQuery);
      let data: MylistPageProbe | undefined;

      do {
        // nvapi に X-Frontend-Id header が必要
        const res = await netUtil.fetch(`${url}&${page.toString()}`, {
          headers: {'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion},
          credentials: 'include'
        }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
          .catch((e: unknown): never => { throw createMylistError('あとで見るの取得失敗(2)', {result: e, cause: e}); });
        if (res.meta.status !== 200 || !res.data.watchLater) {
          throw createMylistError('あとで見るの取得失敗(1)', {result: res, code: res?.error?.code});
        }
        if (data == null) {
          data = res.data.watchLater;
        } else {
          data.hasInvisibleItems = data.hasInvisibleItems || res.data.watchLater.hasInvisibleItems;
          data.hasNext = res.data.watchLater.hasNext;
          data.items = data.items.concat(res.data.watchLater.items);
        }
        page.set('page', String(parseInt(page.get('page') as string) + 1));
      } while (data && data.hasNext);

      return data.items;
    }
    async _getMylistItems(id: string | number, frontendId: number = 6, frontendVersion: number = 0): Promise<MylistItemProbe[]> {
      const url = `https://nvapi.nicovideo.jp/v1/users/me/mylists/${id}`;
      const page = new URLSearchParams({ pageSize: 100, page: 1 } as unknown as NumericQuery);
      let data: MylistPageProbe | undefined;

      do {
        // nvapi に X-Frontend-Id header が必要
        const res = await netUtil.fetch(`${url}?${page.toString()}`, {
          headers: {'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion},
          credentials: 'include'
        }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
          .catch((e: unknown): never => { throw createMylistError('マイリスト取得失敗(2)', {result: e, cause: e}); });
        if (res.meta.status !== 200 || !res.data.mylist) {
          throw createMylistError('マイリスト取得失敗(1)', {result: res, code: res?.error?.code});
        }
        if (data == null) {
          data = res.data.mylist;
        } else {
          data.hasInvisibleItems = data.hasInvisibleItems || res.data.mylist.hasInvisibleItems;
          data.hasNext = res.data.mylist.hasNext;
          data.items = data.items.concat(res.data.mylist.items);
        }
        page.set('page', String(parseInt(page.get('page') as string) + 1));
      } while (data && data.hasNext);

      return data.items;
    }
    async getMylistList({ frontendId = 6, frontendVersion = 0 }: MylistFrontend = {}): Promise<unknown> {
      const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists';
      const cacheKey = 'mylistList';

      const cacheData = (cacheStorage as MylistCacheStorage).getItem(cacheKey);
      if (cacheData) {
        return cacheData;
      }

      // nvapi に X-Frontend-Id header が必要
      const result = await netUtil.fetch(url, {
        headers: {'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion},
        credentials: 'include'
      }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
        .catch((e: unknown): never => { throw createMylistError('マイリスト一覧の取得失敗(2)', {result: e, cause: e}); });
      if (result.meta.status !== 200 || !result.data.mylists) {
        throw createMylistError(`マイリスト一覧の取得失敗(1) ${result.status}${result.message}`, {result, code: result?.error?.code});
      }

      const data = result.data.mylists;
      (cacheStorage as MylistCacheStorage).setItem(cacheKey, data, CACHE_EXPIRE_TIME);
      return data;
    }
    async findDeflistItemByWatchId(watchId: string): Promise<MylistItemProbe> {
      const items = await this._getDeflistItems();

      for (let item of items) {
        if (item.watchId === watchId) {
          return item;
        }
      }
      throw createMylistError('動画が見つかりません', {
        status: 'not_found',
        code: 'NOT_FOUND',
        result: {watchId, list: 'watchLater'}
      });
    }
    async findMylistItemByWatchId(watchId: string, groupId: string | number): Promise<MylistItemProbe> {
      const items = await this._getMylistItems(groupId);

      for (let item of items) {
        if (item.watchId === watchId) {
          return item;
        }
      }
      throw createMylistError('動画が見つかりません', {
        status: 'not_found',
        code: 'NOT_FOUND',
        result: {watchId, groupId, list: 'mylist'}
      });
    }

    //nvapiに frontendId と frontendVersion の値が必要
    async removeDeflistItem(watchId: string, { frontendId = 6, frontendVersion = 0 }: MylistFrontend = {}): Promise<MylistOk> {
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
      }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
        .catch((result: unknown): never => {
          throw createMylistError('あとで見るから削除失敗(2)', {result, cause: result});
        });

      if (result.meta.status && result.meta.status === 200) {
        (cacheStorage as MylistCacheStorage).removeItem(cacheKey);
        emitter.emitAsync('deflistRemove', watchId);
        return {
          status: 'ok',
          result,
          message: 'あとで見るから削除'
        };
      }

      throw createMylistError(result.error.description as string, {
          result, code: result.error.code
      });
    }

    //nvapiに frontendId と frontendVersion の値が必要
    async removeMylistItem(watchId: string, groupId: string | number, { frontendId = 6, frontendVersion = 0 }: MylistFrontend = {}): Promise<MylistOk> {
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
      }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
        .catch((result: unknown): never => {
          throw createMylistError('マイリストから削除失敗(2)', {result, cause: result});
        });

      if (result.meta.status && result.meta.status === 200) {
        (cacheStorage as MylistCacheStorage).removeItem(cacheKey);
        emitter.emitAsync('mylistRemove', watchId, groupId);
        return {
          status: 'ok',
          result,
          message: 'マイリストから削除'
        };
      }

      throw createMylistError(result.error.description as string, {
        result,
        code: result.error.code
      });
    }

    //nvapiに frontendId と frontendVersion の値が必要
    async addDeflistItem(watchId: string, description?: string | null, isRetry: boolean = false, { frontendId = 6, frontendVersion = 0 }: MylistFrontend = {}): Promise<MylistOk> {
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
      }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
        .catch((err: unknown): never => {
            throw createMylistError('あとで見る登録失敗(200)', {
              result: err,
              cause: err
            });
          });
      if (result.meta.status && ( result.meta.status === 200 || result.meta.status === 201 )) {
        (cacheStorage as MylistCacheStorage).removeItem(cacheKey);
        emitter.emitAsync('deflistAdd', watchId, description);
        return {
          status: 'ok',
          result,
          message: 'あとで見る登録'
        };
      }

      if (result.meta.status && result.meta.status === 409 && !isRetry) {
          /**
           すでに登録されている場合は、いったん削除して再度追加(先頭に移動)
           例えば、とりマイの300番目に登録済みだった場合に「登録済みです」と言われても探すのがダルいし、
           他の動画を追加していけば、そのうち押し出されて消えてしまう。
           なので、重複時にエラーを出すのではなく、「消してから追加」することによって先頭に持ってくる。
           登録済みの場合、409が返ってくるようになったのでこちらで処理
           */
          await this.removeDeflistItem(watchId).catch((err: unknown): never => {
              throw createMylistError('あとで見る登録失敗(101)', {
                result: (err as MylistError).result,
                code: (err as MylistError).code,
                cause: err
              });
            });
          const added = await this.addDeflistItem(watchId, description, true, {frontendId, frontendVersion});
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

        throw createMylistError(result.error.description as string, {
          result,
          code: result.error.code
        });
    }

    //nvapiに frontendId と frontendVersion の値が必要
    async addMylistItem(watchId: string, groupId: string | number, description?: string | null, { frontendId = 6, frontendVersion = 0 }: MylistFrontend = {}): Promise<MylistOk> {
      //const url = 'https://www.nicovideo.jp/api/mylist/add';
      let body = 'itemId=' + watchId + '&description=';//+ '&token=' + token + '&group_id=' + groupId;
      if (description) {
        body += encodeURIComponent(description);
      }
      const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists/' + groupId + '/items?' + body ;
      const cacheKey = `mylistItems: ${groupId}`;

      const result = await netUtil.fetch(url, {
        method: 'POST',
        body,
        headers: {  'Content-Type': 'application/x-www-form-urlencoded', 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion, 'X-Request-With': 'https://www.nicovideo.jp'},
        credentials: 'include'
      }).then((r: Response): Promise<MylistEnvelopeProbe> => r.json())
        .catch((err: unknown): never => {
          throw createMylistError('マイリスト登録失敗(200)', {
            result: err,
            cause: err
          });
        });

      if (result.meta.status && ( result.meta.status === 200 || result.meta.status === 201 )) {
        (cacheStorage as MylistCacheStorage).removeItem(cacheKey);
        // マイリストに登録したらあとで見るから除去(=移動)
        this.removeDeflistItem(watchId).catch(() => {});
        return {status: 'ok', result, message: 'マイリスト登録'};
      }

      if (!result.meta.status /*|| !result.error*/) {
        throw createMylistError('マイリスト登録失敗(100)', {result});
      }

      // マイリストの場合は重複があっても「追加して削除」しない。
      // とりまいと違って押し出されることがないし、
      // シリーズ物が勝手に入れ替わっても困るため
      emitter.emitAsync('mylistAdd', watchId, groupId, description);

      throw createMylistError(result.error.description as string, {
          result, code: result.error.code
      });

    }
  }

  return new MylistApiLoader();
})();

export {MylistApiLoader};

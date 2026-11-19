declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
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
  /** Optional playback owner: refuse a DELETE if the originating video changed. */
  isCurrent?: (() => boolean) | undefined;
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
/** Fields used by the read and legacy write endpoints. */
export interface MylistEnvelopeProbe {
  readonly meta: {readonly status?: unknown; readonly errorCode?: unknown};
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
  _getDeflistItems(frontendId?: number, frontendVersion?: number,
    watchId?: string, isCurrent?: () => boolean): Promise<MylistItemProbe[]>;
  _getMylistItems(id: string | number, frontendId?: number, frontendVersion?: number,
    watchId?: string, isCurrent?: () => boolean): Promise<MylistItemProbe[]>;
  /** Reads the signed-in viewer's current list groups. */
  getMylistList(frontend?: MylistFrontend): Promise<unknown>;
  findDeflistItemByWatchId(watchId: string, frontend?: MylistFrontend): Promise<MylistItemProbe>;
  findMylistItemByWatchId(watchId: string, groupId: string | number,
    frontend?: MylistFrontend): Promise<MylistItemProbe>;
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
  // #261: Authenticated identity cannot be inferred from a URL or a tab's
  // sessionStorage. Never persist or reuse CSRF credentials across logins.
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
      // Keep the event API for consumers, but not a reusable auth cache.
      token = t;
    });
  }

  class MylistApiLoader implements MylistApiLoaderClient {
    constructor() {
      if (!cacheStorage) {
        cacheStorage = new CacheStorage(sessionStorage);
      }
      // Drop credentials and private list entries stored by previous versions.
      cacheStorage.removeItem('csrfToken');
      cacheStorage.removeItem('mylistList');
    }
    setCsrfToken(t: unknown): void {
      // Compatibility entry for live token events; not persisted or trusted as
      // evidence of the viewer when a write operation needs a fresh token.
      token = t;
    }

    async _getCsrfToken(): Promise<unknown> {
      // The CSRF token is tied to the authenticated page, not a fixed key
      // with a 59-minute TTL. Fetch it anew so switching A -> B cannot reuse A.
      const tokenUrl = 'https://www.nicovideo.jp/my/mylist';
      let page: string;
      try {
        page = await netUtil.fetch(tokenUrl, {credentials: 'include'})
          .then((r: Response): Promise<string> => r.text());
      } catch (_) {
        token = '';
        throw createMylistError('マイリストトークン取得失敗');
      }
      try {
        const dom = new DOMParser().parseFromString(page, 'text/html');
        const element = dom.querySelector('#js-initial-userpage-data');
        const rawEnvironment = element?.getAttribute('data-environment');
        if (!rawEnvironment) { throw new Error('missing environment'); }
        const env: unknown = JSON.parse(rawEnvironment);
        const csrfToken = (env as {csrfToken?: unknown} | null)?.csrfToken;
        if (typeof csrfToken !== 'string' || !csrfToken.trim()) {
          throw new Error('missing CSRF token');
        }
        token = csrfToken;
        return csrfToken;
      } catch (_) {
        token = '';
        throw createMylistError('マイリストトークン取得失敗（認証情報がありません）');
      }
    }
    private async _readList(url: string, kind: 'mylist' | 'watchLater' | 'mylists',
      frontendId: number, frontendVersion: number, isCurrent?: () => boolean) {
      const label = kind === 'watchLater' ? 'あとで見る' : kind === 'mylists' ? 'マイリスト一覧' : 'マイリスト';
      const ensureCurrent = () => {
        if (!isCurrent) { return; }
        let current = false;
        try { current = isCurrent() === true; } catch (_) { /* A disposed owner is stale. */ }
        if (!current) { throw createMylistError(label + '取得中止（動画が変更されました）', {code:'STALE'}); }
      };
      ensureCurrent();
      let response: Response | undefined;
      let result: MylistEnvelopeProbe;
      try {
        response = await netUtil.fetch(url, {
          headers: {'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion}, credentials: 'include',
          ...(typeof RequestDiagnostics !== 'undefined' && isCurrent ? {diagnosticActive: isCurrent} : {})
        });
        result = await response.json() as MylistEnvelopeProbe;
      } catch (cause) {
        ensureCurrent();
        const wrapped = createMylistError(label + 'の取得失敗(2)', {cause, ...(kind === 'mylists' ? {result:cause} : {})});
        if (typeof RequestDiagnostics !== 'undefined') {
          Object.assign(wrapped, RequestDiagnostics.readFailure(response, cause));
        }
        throw wrapped;
      }
      ensureCurrent();
      const failure = (missing?: string, code?: string, message = label + 'の取得失敗(1)') => {
        const wrapped = createMylistError(message, {code: code ?? result?.error?.code, ...(kind === 'mylists' ? {result} : {})});
        if (typeof RequestDiagnostics !== 'undefined') {
          const meta = result?.meta && {status:result.meta.status, errorCode:result.meta.errorCode ?? result?.error?.code};
          Object.assign(wrapped, RequestDiagnostics.responseFailure(response, meta, missing));
        }
        return wrapped;
      };
      if (response.status >= 300 || result?.meta?.status !== 200 || result?.meta?.errorCode || result?.error?.code) { throw failure('meta.status'); }
      const page = kind === 'mylists' ? undefined : result.data?.[kind];
      const items = kind === 'mylists' ? result.data?.mylists : page?.items;
      if (!Array.isArray(items)) { throw failure(kind === 'mylists' ? 'data.mylists' : 'data.' + kind + '.items'); }
      if (kind === 'mylists' && items.some(group => {
        const id: unknown = group?.id;
        return !(typeof id === 'string' && id.trim()) && !(typeof id === 'number' && Number.isSafeInteger(id));
      })) { throw failure('data.mylists'); }
      if (page?.hasNext !== undefined && typeof page.hasNext !== 'boolean') {
        throw failure('data.' + kind + '.hasNext');
      }
      return {items:items as MylistItemProbe[], hasNext:page?.hasNext === true, failure};
    }

    // Stop a single-item lookup as soon as the matching row is available.
    private async _scanItems(kind: 'watchLater' | 'mylist', id: string | number | null,
      frontendId: number, frontendVersion: number, watchId?: string,
      isCurrent?: () => boolean): Promise<MylistItemProbe[]> {
      const execute = async () => {
        const url = kind === 'watchLater' ?
          'https://nvapi.nicovideo.jp/v1/users/me/watch-later?sortKey=addedAt&sortOrder=desc&' :
          `https://nvapi.nicovideo.jp/v1/users/me/mylists/${id}?`;
        const query = new URLSearchParams({pageSize:'100', page:'1'});
        const results: MylistItemProbe[] = [];
        const fingerprints = new Set<string>();
        const label = kind === 'watchLater' ? 'あとで見る' : 'マイリスト';
        const field = 'data.' + kind + '.items';
        for (let page = 1; page <= 100; page++) {
          query.set('page', String(page));
          const {items, hasNext, failure} = await this._readList(url + query.toString(), kind, frontendId, frontendVersion, isCurrent);
          if (items.some(item => !item || typeof item !== 'object')) { throw failure(field); }
          if (watchId !== undefined) {
            const found = items.find(item => item.watchId === watchId);
            if (found) {
              if (!(typeof found.itemId === 'number' && Number.isSafeInteger(found.itemId)) &&
                  !(typeof found.itemId === 'string' && found.itemId.trim())) { throw failure(field); }
              return [found];
            }
          }
          if (hasNext && !items.length) {
            throw failure(field, 'INVALID_PAGE', label + 'の取得失敗（空ページが連続）');
          }
          if (items.length) {
            const fingerprint = JSON.stringify(items.map(item => [item.itemId, item.watchId]));
            if (fingerprints.has(fingerprint)) {
              throw failure(field, 'REPEATED_PAGE', label + 'の取得失敗（ページが重複）');
            }
            fingerprints.add(fingerprint);
          }
          if (watchId === undefined) { results.push(...items); }
          if (!hasNext) { return results; }
        }
        throw createMylistError(label + 'の取得失敗（ページ数の安全上限）', {code:'PAGE_LIMIT'});
      };
      return typeof RequestDiagnostics === 'undefined' ? execute() :
        RequestDiagnostics.observe('mylist', JSON.stringify([kind, id]), execute, Array.isArray, () => !isCurrent || isCurrent());
    }
    async _getDeflistItems(frontendId:number=6, frontendVersion:number=0,
      watchId?:string, isCurrent?:()=>boolean):Promise<MylistItemProbe[]>{
      return this._scanItems('watchLater',null,frontendId,frontendVersion,watchId,isCurrent);
    }
    async _getMylistItems(id:string|number, frontendId:number=6,
      frontendVersion:number=0, watchId?:string,
      isCurrent?:()=>boolean):Promise<MylistItemProbe[]>{
      return this._scanItems('mylist',id,frontendId,frontendVersion,watchId,isCurrent);
    }
    async getMylistList({frontendId = 6, frontendVersion = 0, isCurrent}: MylistFrontend = {}): Promise<unknown> {
      const execute = async () => {
        // /users/me/mylists must always reflect the currently signed-in viewer.
        const result = await this._readList('https://nvapi.nicovideo.jp/v1/users/me/mylists', 'mylists', frontendId, frontendVersion, isCurrent);
        return result.items;
      };
      return typeof RequestDiagnostics === 'undefined' ? execute() :
        RequestDiagnostics.observe('mylist', 'lists', execute, Array.isArray, () => !isCurrent || isCurrent());
    }
    async findDeflistItemByWatchId(watchId: string,
      {frontendId=6,frontendVersion=0,isCurrent}: MylistFrontend={}): Promise<MylistItemProbe> {
      const items = await this._getDeflistItems(frontendId,frontendVersion,watchId,isCurrent);

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
    async findMylistItemByWatchId(watchId: string, groupId: string | number,
      {frontendId=6,frontendVersion=0,isCurrent}: MylistFrontend={}): Promise<MylistItemProbe> {
      const items = await this._getMylistItems(groupId,frontendId,frontendVersion,watchId,isCurrent);

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
    async removeDeflistItem(watchId: string, { frontendId = 6, frontendVersion = 0, isCurrent }: MylistFrontend = {}): Promise<MylistOk> {
      const item = await this.findDeflistItemByWatchId(watchId,{frontendId,frontendVersion,isCurrent});
      if(isCurrent&&isCurrent()!==true)throw createMylistError('削除中止（動画が変更されました）',{code:'STALE'});

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
    async removeMylistItem(watchId: string, groupId: string | number, { frontendId = 6, frontendVersion = 0, isCurrent }: MylistFrontend = {}): Promise<MylistOk> {
      const item = await this.findMylistItemByWatchId(watchId, groupId,{frontendId,frontendVersion,isCurrent});
      if(isCurrent&&isCurrent()!==true)throw createMylistError('削除中止（動画が変更されました）',{code:'STALE'});

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
        // No DELETE/POST reorder: partial network failure must not lose a saved entry.
        return {status: 'ok', result, message: 'あとで見るに登録済み（既存の登録を保持しました）'};
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
        emitter.emitAsync('mylistAdd', watchId, groupId, description);
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
      throw createMylistError(result.error.description as string, {
          result, code: result.error.code
      });

    }
  }

  return new MylistApiLoader();
})();

export {MylistApiLoader};

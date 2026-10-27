/**
 * Canonical TypeScript source for packages/zenza/src/Playlist/PlayList.js (Task870).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
/** The parts of the playlist model used here (see VideoListModel.ts). */
interface PlaylistModelLike {
  items: Loose[];
  length: number;
  maxItems: number;
  activeIndex: number;
  on(name: string, callback: (...args: Loose[]) => unknown): unknown;
  findByItemId(id: unknown): Loose;
  findByWatchId(id: unknown): Loose;
  getItemByIndex(index: number): Loose;
  indexOf(item: Loose): number;
  setItem(items: Loose[]): void;
  appendItem(items: Loose): number | undefined;
  insertItem(items: Loose, index: number): number | undefined;
  removeItem(...items: Loose[]): void;
  moveItemTo(from: Loose, to: Loose): void;
  serialize(): unknown[];
  unserialize(data: unknown): void;
  resetPlayedItemFlag(): void;
  removePlayedItem(): void;
  removeNonActiveItem(): void;
  reverse(): void;
  shuffle(): void;
  sortBy(key: string, isDesc: boolean): void;
  _dedupe(existing: Loose[], incoming: Loose[]): Loose[];
  _commit(next: Loose[], trimFrom: string): Loose[];
}
type LoadOwner = {generation: number; model: PlaylistModelLike};
type AdditiveOwner = LoadOwner & {previous: Promise<unknown>; release: () => void};
/** The base class and collaborators (still declared here; they are separate modules). */
declare class VideoList {
  view: Loose;
  _thumbInfoLoader: Loose;
  _container: Loose;
  _initializeAdDecoration(params: Loose): void;
  _onDeflistAdd(...args: Loose[]): void;
  emit(name: string, ...args: unknown[]): unknown;
  on(name: string, callback: (...args: Loose[]) => unknown): this;
}
declare const VideoListItem: Loose;
declare const PlayListModel: new (params: Loose) => PlaylistModelLike;
declare const PlayListSession: {save(data: unknown): void; restore(): Loose};
declare const PlayListView: new (params: Loose) => Loose;
declare const PlaylistApiLoader: {load(playlist: Loose, msgInfo: Loose): Promise<Loose[]>};
declare const NicoSearchApiV2Loader: {searchMore(word: string, options: Loose, limit: number): Promise<Loose>};
declare const textUtil: {dateToString(v: unknown): string; isValidJson(v: unknown): boolean; escapeToZenkaku(v: string): string};
declare const global: {api: Loose; debug: Loose; emitter: {on(name: string, callback: (...args: Loose[]) => unknown): unknown}};
declare const _: {
  debounce<F extends (...args: never[]) => unknown>(f: F, ms: number): F;
  shuffle<T>(a: T[]): T[];
  sortBy<T>(a: T[], f: (v: T) => unknown): T[];
  isBoolean(v: unknown): v is boolean;
};
/** Re-exported modules (their own canonical sources live next to this one). */
declare const VideoListModel: Loose;
declare const VideoListItemView: Loose;
declare const VideoListView: Loose;
declare const RelatedVideoList: Loose;


class PlayList extends VideoList {
  declare _activeItem: Loose;
  declare _retentionLimit: number;
  declare _additiveListGeneration: number;
  declare _additiveLoadTail: Promise<unknown> | null;
  declare _container: Loose;
  declare _detailFillTimer: ReturnType<typeof setTimeout> | null;
  declare _detailRunning: number;
  declare _importCompletionGeneration: number;
  declare _index: number;
  declare _isEnable: boolean;
  declare _isLoop: boolean;
  declare _nicoSearchApiLoader: typeof NicoSearchApiV2Loader;
  declare _playlistApiLoader: typeof PlaylistApiLoader;
  declare _replaceLoadGeneration: number;
  declare _thumbInfoLoader: {load(watchId: string): Promise<Loose>};
  declare model: PlaylistModelLike;
  declare view: Loose;
  declare static DETAIL_CONCURRENCY: number;
  declare static DETAIL_FILL_DELAY_MS: number;
  declare static SEARCH_LIMIT_DEFAULT: number;
  declare static SEARCH_LIMIT_MIN: number;
  declare static SEARCH_LIMIT_MAX: number;
  declare static _searchSeq: number;
  initialize(params?: Loose) {
    this._thumbInfoLoader = params.loader || global.api.ThumbInfoLoader;
    this._container = params.container;

    this._index = -1;
    this._isEnable = false;
    this._isLoop = params.loop;

    this.model = new PlayListModel({});
    this.setRetentionLimit(params.retentionLimit);
    // Task 093: item の watchId の変更で model が重複を外した時も、再生位置（_index）を再生中の item に合わせる
    this.model.on('item-removed', () => this._refreshIndex());
    // Task196: 表示範囲に入った情報不明の項目の詳細を補完する
    this.model.on('update', () => this._scheduleDetailFill());

    // Task 054: プレイリストの動画に広告(ニコニ広告)の金冠・銀冠枠を表示する。
    // 実装は基底クラスVideoList側にある（RelatedVideoList等とも共通化する
    // ため）。PlayListはinitialize()自体を上書きしているので、明示的に
    // 呼び出す必要がある。
    this._initializeAdDecoration(params);

    global.debug.playlist = this;
    this.on('update', _.debounce(() => PlayListSession.save(this.serialize()), 3000));
    global.emitter.on('tabChange', tab => {
      if (tab === 'playlist') {
        this.scrollToActiveItem();
      }
    });
  }
  static normalizeRetentionLimit(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1000 &&
      value % 1000 === 0 ? Math.min(10000, value) : 3000;
  }
  setRetentionLimit(value: unknown) {
    this._retentionLimit = PlayList.normalizeRetentionLimit(value);
    // Changing a preference is not an instruction to delete current entries.
    this.model.maxItems = Math.max(this._retentionLimit, this.model.length);
  }
  _reserveLoadedItems(items: Loose[], replace = false) {
    // Reserve for an explicit successful result only, after stale-load checks.
    // The base model still handles deduplication, active-item retention and
    // rolling single-item growth. Do not let the preference cap API collection.
    const count = this.model._dedupe(replace ? [] : this.model.items, items).length;
    this.model.maxItems = Math.max(replace ? 0 : this.model.length,
      this._retentionLimit || 3000, Math.min(10000, count));
  }
  _boundedBulkItems(items: Loose[], replace = false): {items: Loose[]; overflow: number} {
    const previous = replace ? [] : this.model.items;
    const fresh = this.model._dedupe(previous, items).slice(previous.length);
    // Preserve older oversized lists until replacement. New bulk imports
    // cannot silently discard existing videos or grow past 10,000 items.
    const space = Math.max(0, 10000 - previous.length);
    const accepted = new Set(fresh.slice(0, space));
    const existingIds = new Set(previous.map(item => item.watchId));
    return {items: items.filter(item => existingIds.has(item.watchId) || accepted.has(item)),
      overflow: Math.max(0, fresh.length - space)};
  }
  serialize() {
    return {
      items: this.model.serialize(),
      index: this._index,
      enable: this._isEnable,
      loop: this._isLoop
    };
  }
  unserialize(data?: Loose) {
    if (!data || !Array.isArray(data.items)) {
      return false;
    }
    // A manual session/import restore supersedes pending network replacements.
    this._replaceLoadGeneration = (this._replaceLoadGeneration || 0) + 1;
    this._invalidateAdditiveLoads();
    this._initializeView();
    console.log('unserialize: ', data);
    // Older sessions may contain over 10k entries. Keep the active video's
    // identity/position instead of blindly taking the first 10k rows.
    const oldIndex = PlayList.normalizeRestoredIndex(data.index, data.items.length, -1);
    const start = data.items.length > 10000 && oldIndex >= 0 ?
      Math.max(0, Math.min(oldIndex - 5000, data.items.length - 10000)) : 0;
    const restored = data.items.slice(start, start + 10000);
    const restoredIndex = oldIndex < 0 ? -1 : oldIndex - start;
    this.model.maxItems = Math.max(this._retentionLimit || 3000, restored.length);
    this.model.unserialize(restored);
    this._isEnable = data.enable;
    this._isLoop = data.loop;
    this.emit('update');
    // Task 093: 保存した位置が無い・範囲外なら、再生中の item 無し（-1）にする（以前は NaN が入ることがあった）
    const index = PlayList.normalizeRestoredIndex(restoredIndex, this.model.length, -1);
    this.setIndex(index, true);
    return true;
  }
  /**
   * Task 093: 保存・書き出したプレイリストの index を、今の件数の範囲に収める。
   * 数値でない・無い・負の数は fallback、件数以上は最後の item、小数は切り捨て。件数0なら -1。
   */
  static normalizeRestoredIndex(index?: Loose, length?: Loose, fallback: Loose = 0) {
    if (!(length > 0)) {
      return -1;
    }
    const n = typeof index === 'number' ? Math.floor(index) : parseInt(index, 10);
    if (!isFinite(n) || n < 0) {
      return Math.min(fallback, length - 1);
    }
    return Math.min(n, length - 1);
  }
  restoreFromSession() {
    this.unserialize(PlayListSession.restore());
  }
  _initializeView() {
    if (this.view) {
      return;
    }
    this.view = new PlayListView({
      container: this._container,
      model: this.model,
      playlist: this
    });
    this.view.on('command', this._onCommand.bind(this));
    this.view.on('deflistAdd', this._onDeflistAdd.bind(this));
    this.view.on('moveItem', this._onMoveItem.bind(this));
  }
  _onCommand(command: Loose, param: Loose, itemId?: Loose) {
    let item;
    switch (command) {
      case 'toggleEnable':
        this.toggleEnable();
        break;
      case 'toggleLoop':
        this.toggleLoop();
        break;
      case 'shuffle':
        this.shuffle();
        break;
      case 'reverse':
        this.reverse();
        break;
      case 'sortBy': {
        let [key, order] = param.split(':') as [string, string];
        this.sortBy(key, order === 'desc');
        break;
      }
      case 'clear':
        this._setItemData([]);
        break;
      case 'select':
        item = this.model.findByItemId(itemId);
        if (!item) {
          break;
        }
        this.setIndex(this.model.indexOf(item));
        this.emit('command', 'openNow', item.watchId);
        break;
      case 'playlistRemove':
        item = this.model.findByItemId(itemId);
        this.model.removeItem(item);
        this._refreshIndex();
        this.emit('update');
        break;
      case 'removePlayedItem':
        this.removePlayedItem();
        break;
      case 'resetPlayedItemFlag':
        this.model.resetPlayedItemFlag();
        break;
      case 'removeNonActiveItem':
        this.removeNonActiveItem();
        break;
      case 'exportFile':
        this._onExportFileCommand();
        break;
      case 'importFile':
        this._onImportFileCommand(param);
        break;
      case 'scrollToActiveItem':
        this.scrollToActiveItem(true);
        break;
      default:
        this.emit('command', command, param);
    }
  }
  _onExportFileCommand() {
    const dt = new Date();
    const title = prompt('プレイリストを保存\nプレイヤーにドロップすると復元されます',
      textUtil.dateToString(dt) + 'のプレイリスト');
    if (!title) {
      return;
    }

    const data = JSON.stringify(this.serialize(), null, 2);

    // Task 093: 中身は JSON（以前は text/html にしていた）
    const blob = new Blob([data], {'type': 'application/json'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, {
      download: title + '.playlist.json',
      rel: 'noopener',
      href: url
    });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      a.remove();
      window.URL.revokeObjectURL(url);
    }, 1000);
  }
  _onImportFileCommand(fileData?: Loose) {
    if (!textUtil.isValidJson(fileData)) {
      return;
    }

    // Task 093: 以前は JSON.parse した結果ではなく元の文字列（fileData）から index を読んでいたため、
    // 保存した位置が復元されず、いつも先頭の動画を開いていた。1回だけ parse して、その結果を使う。
    const data = JSON.parse(fileData);
    if (!data || !Array.isArray(data.items)) {
      return;
    }
    // A newer import must take ownership of its own delayed resume. Capture
    // the exact restored row so other list edits cannot turn the old timer
    // into an unrelated playback request.
    const importGeneration = this._importCompletionGeneration =
      (this._importCompletionGeneration || 0) + 1;
    this.emit('command', 'pause');
    this.emit('command', 'notify', 'プレイリストを復元');
    this.unserialize(data);

    const restoredModel = this.model;
    const index = PlayList.normalizeRestoredIndex(data.index, restoredModel.length, 0);
    const item = restoredModel.getItemByIndex(index);
    const selectedItem = this._activeItem;
    window.setTimeout(() => {
      if (this._importCompletionGeneration !== importGeneration ||
          this.model !== restoredModel || this._activeItem !== selectedItem ||
          restoredModel.getItemByIndex(index) !== item) { return; }
      if (item) {
        this.setIndex(index, true);
        this.emit('command', 'openNow', item.watchId);
      }
    }, 2000);
  }
  _onMoveItem(fromItemId?: Loose, toItemId?: Loose) {
    const fromItem = this.model.findByItemId(fromItemId);
    const toItem = this.model.findByItemId(toItemId);
    if (!fromItem || !toItem) {
      return;
    }
    // const destIndex = this._model.indexOf(destItem);
    // this._model.removeItem(srcItem);
    // this._model.insertItem(srcItem, destIndex);
    this.model.moveItemTo(fromItem, toItem);
    this._refreshIndex();
  }
  _setItemData(listData: Loose[]) {
    this._invalidateAdditiveLoads();
    const items = listData.map(itemData => new VideoListItem(itemData));
    this._reserveLoadedItems(items, true);
    this.model.setItem(items);
    this.setIndex(items.length > 0 ? 0 : -1);
  }
  _replaceAll(videoListItems: Loose[], options?: Loose) {
    // Committed replacement also invalidates previously started fetches.
    this._replaceLoadGeneration = (this._replaceLoadGeneration || 0) + 1;
    this._invalidateAdditiveLoads();
    options = options || {};
    this.model.setItem(videoListItems);
    const item = this.model.findByWatchId(options.watchId);
    if (item) {
      item.isActive = true;
      item.isPlayed = true;
      this._activeItem = item;
      setTimeout(() => this.view.scrollToItem(item), 1000);
    }
    this.setIndex(this.model.indexOf(item));
  }
  // Task 041: 実際に何件追加できたかを返すようにした。
  // プレイリストは重複（同じ動画）を弾く作りになっているため、読み込んだ一覧が
  // すべて既にプレイリストに入っていると、1件も増えないまま
  // 「プレイリストに追加しました」と表示され、利用者からは
  // 「何も起きない・動画が入らない」としか分からない状態だった。
  // 呼び出し側で件数を見て、メッセージを正しく出し分けられるようにする。
  // Task 093: 以前は「件数の増え方」で数えていたため、上限（maxItems）で古い分が落ちると、
  // 新しく入っても 0件（全部登録済み）と表示されていた。「渡した item のうち、追加後に一覧にある新しい item」を数える。
  _countNewlyAdded(videoListItems: Loose[], beforeItemIds?: Loose) {
    return videoListItems.filter(item =>
      item && !beforeItemIds.has(item.itemId) && this.model.findByItemId(item.itemId) === item).length;
  }
  _appendAll(videoListItems: Loose[], options?: Loose) {
    options = options || {};
    const beforeItemIds = new Set(this.model.items.map(item => item.itemId));
    this.model.appendItem(videoListItems);
    const added = this._countNewlyAdded(videoListItems, beforeItemIds);
    const item = this.model.findByWatchId(options.watchId);
    if (item) {
      item.isActive = true;
      item.isPlayed = true;
      this._refreshIndex(false);
    }
    setTimeout(() => this.view.scrollToItem(videoListItems[0]), 1000);
    return added;
  }
  // Task296: series / uploader neighbours are placed around the active item.
  // Preserve existing objects and entries, even when the playlist is at capacity.
  _insertNeighbourItems(videoListItems: Loose[], options: Loose = {}) {
    const model = this.model;
    const anchor = (options.watchId && model.findByWatchId(options.watchId)) ||
      (this._activeItem && model.indexOf(this._activeItem) >= 0 ? this._activeItem : null);
    const incoming = model._dedupe(model.items, videoListItems).slice(model.length);
    const fresh = new Set(incoming);
    const anchorAt = anchor ? videoListItems.findIndex(item => item.watchId === anchor.watchId) : -1;
    const preceding = videoListItems.filter((item, i) => fresh.has(item) && anchorAt >= 0 && i < anchorAt);
    const following = videoListItems.filter((item, i) => fresh.has(item) && (anchorAt < 0 || i > anchorAt));
    const room = Math.max(0, (model.maxItems || 0) - model.length);
    const accepted = [...preceding, ...following].slice(0, room);
    if (!accepted.length) {
      return {added: 0, overflow: incoming.length};
    }

    if (!anchor) {
      model.insertItem(accepted, this.getIndex() + 1);
    } else {
      // Existing neighbours are fixed anchors. Index them once, then attach
      // before/after buckets; repeated findIndex/splice made large loads quadratic.
      const existing = model.items;
      const positions = new Map(existing.map((item, index) => [item.watchId, index]));
      const acceptedSet = new Set(accepted);
      const before = new Map<number, Loose[]>(), after = new Map<number, Loose[]>();
      const at = model.indexOf(anchor);
      let cursor = at;
      for (let i = anchorAt - 1; i >= 0; i--) {
        const item = videoListItems[i];
        const position = positions.get(item.watchId);
        if (position !== undefined && position < cursor) { cursor = position; }
        else if (position === undefined && acceptedSet.has(item)) {
          const bucket = before.get(cursor) || [];
          bucket.push(item); before.set(cursor, bucket);
        }
      }
      cursor = at;
      const tail = anchorAt >= 0 ? videoListItems.slice(anchorAt + 1) : videoListItems;
      for (const item of tail) {
        const position = positions.get(item.watchId);
        if (position !== undefined && position > cursor) { cursor = position; }
        else if (position === undefined && acceptedSet.has(item)) {
          const bucket = after.get(cursor) || [];
          bucket.push(item); after.set(cursor, bucket);
        }
      }
      const next: Loose[] = [];
      existing.forEach((item, index) => {
        const previous = before.get(index);
        if (previous) { for (let i=previous.length-1;i>=0;i--) { next.push(previous[i]); } }
        next.push(item);
        const following = after.get(index);
        if (following) { for (const entry of following) { next.push(entry); } }
      });
      model._commit(next, 'tail');
    }
    this._refreshIndex(false);
    return {added: accepted.length, overflow: incoming.length - accepted.length};
  }
  // Task199: insert at an explicit index (same bookkeeping as _insertAll)
  _insertAllAt(videoListItems: Loose[], index?: Loose, options?: Loose) {
    options = options || {};
    const beforeItemIds = new Set(this.model.items.map(item => item.itemId));
    this.model.insertItem(videoListItems, index);
    const added = this._countNewlyAdded(videoListItems, beforeItemIds);
    this._refreshIndex(false);
    return added;
  }
  _insertAll(videoListItems: Loose[], options?: Loose) {
    options = options || {};

    const beforeItemIds = new Set(this.model.items.map(item => item.itemId));
    this.model.insertItem(
      videoListItems,
      this.getIndex() + 1);
    const added = this._countNewlyAdded(videoListItems, beforeItemIds);
    const item = this.model.findByWatchId(options.watchId);
    if (item) {
      item.isActive = true;
      item.isPlayed = true;
      this._refreshIndex(false);
    }
    setTimeout(() => this.view.scrollToItem(videoListItems[0]), 1000);
    return added;
  }
  replaceItems(videoListItemsRawData: Loose[], options?: Loose) {
    const items = videoListItemsRawData.map(raw => new VideoListItem(raw));
    this._reserveLoadedItems(items, true);
    return this._replaceAll(items, options);
  }
  appendItems(videoListItemsRawData: Loose[], options?: Loose) {
    const items = videoListItemsRawData.map(raw => new VideoListItem(raw));
    const bounded = this._boundedBulkItems(items);
    this._reserveLoadedItems(bounded.items);
    return this._appendAll(bounded.items, options);
  }
  insertItems(videoListItemsRawData: Loose[], options?: Loose) {
    const items = videoListItemsRawData.map(raw => new VideoListItem(raw));
    const bounded = this._boundedBulkItems(items);
    this._reserveLoadedItems(bounded.items);
    return this._insertAll(bounded.items, options);
  }
  _invalidateAdditiveLoads() {
    // A new list owner invalidates prior append/insert completions.
    this._additiveListGeneration = (this._additiveListGeneration || 0) + 1;
    this._additiveLoadTail = null;
  }
  _beginAdditiveLoad(options: Loose): AdditiveOwner | null {
    if (!options.insert && !options.append) { return null; }
    const previous = this._additiveLoadTail || Promise.resolve();
    let release!: () => void;
    this._additiveLoadTail = new Promise<void>(resolve => { release = resolve; });
    return {
      previous, release,
      model: this.model,
      generation: this._additiveListGeneration || 0
    };
  }
  _isStaleAdditiveLoad(owner: AdditiveOwner | null) {
    return !!owner && (this.model !== owner.model ||
      (this._additiveListGeneration || 0) !== owner.generation);
  }
  _waitForAdditiveTurn(networkPromise: Promise<Loose>, owner: AdditiveOwner | null): Promise<Loose> {
    if (!owner) { return networkPromise; }
    // Observe network failures immediately, even while an older add is
    // pending, so deferred rejection cannot become unhandled.
    const settled = Promise.resolve(networkPromise).then(
      value => ({ok: true as const, value}),
      error => ({ok: false as const, error})
    );
    return owner.previous.then(() => settled).then(result => {
      if (result.ok) { return result.value; }
      throw result.error;
    });
  }
  _beginReplaceLoad(options: Loose): LoadOwner | null {
    // A newer add/insert request also supersedes an older pending replacement.
    const generation = this._replaceLoadGeneration =
      (this._replaceLoadGeneration || 0) + 1;
    if (options.insert || options.append) { return null; }
    this._invalidateAdditiveLoads();
    return {generation, model: this.model};
  }
  _isSupersededReplaceLoad(owner: LoadOwner | null) {
    return !!owner && (this._replaceLoadGeneration !== owner.generation ||
      this.model !== owner.model);
  }
  _isStalePlaylistLoad(owner: LoadOwner | null, isCurrent: unknown, additiveOwner: AdditiveOwner | null) {
    return this._isSupersededReplaceLoad(owner) ||
      this._isStaleAdditiveLoad(additiveOwner) ||
      (typeof isCurrent === 'function' && !isCurrent());
  }
  load(playlist?: Loose, options?: Loose, msgInfo?: Loose, isCurrent?: Loose) {
    this._initializeView();
    options = options || {};
    const replaceOwner = this._beginReplaceLoad(options);

    if (!this._playlistApiLoader) {
      this._playlistApiLoader = PlaylistApiLoader;
    }
    const timeKey: string = `loadPlaylist: ${playlist.type} ${playlist.id || playlist.options?.tag || playlist.options?.keyword}`;
    window.console.time(timeKey);

    const additiveOwner = this._beginAdditiveLoad(options);
    const network = this._playlistApiLoader.load({...playlist,
      // Independent collection safety budget, never the rolling preference.
      maxItems: 10000,
      isCurrent: () => !this._isStalePlaylistLoad(replaceOwner, isCurrent, additiveOwner)
    }, msgInfo);
    return this._waitForAdditiveTurn(network, additiveOwner).then(items => {
        window.console.timeEnd(timeKey);
        if (this._isStalePlaylistLoad(replaceOwner, isCurrent, additiveOwner)) {
          return {status: 'superseded', message: ''};
        }
        const loaded = items.playlistLoadInfo;
        const capacityNotice = loaded?.limited ?
          `（上限${loaded.maxItems}件まで取得${loaded.totalCount !== null ? `／全${loaded.totalCount}件` : ''}）` : '';
        let videoListItems = items.map((item: Loose) => VideoListItem.createByMylistItem(item));

        if (videoListItems.length < 1) {
          return Promise.reject({
            status: 'fail',
            message: 'プレイリストの取得に失敗しました'
          });
        }

        if (options.shuffle) {
          videoListItems = _.shuffle(videoListItems);
        } else if (playlist.type === 'user-uploaded' && playlist.options == null) {
          videoListItems.reverse();
        }

        const bounded = this._boundedBulkItems(videoListItems, !options.insert && !options.append);
        videoListItems = bounded.items;
        this._reserveLoadedItems(videoListItems, !options.insert && !options.append);
        let added: number | null | undefined = null;
        let overflow = bounded.overflow;
        // Task296: series/user uploads have a meaningful preceding/following order.
        // Generic mylist and search insertion retain their existing semantics.
        if (options.insert && ['series', 'user-uploaded'].includes(playlist.type)) {
          const result = this._insertNeighbourItems(videoListItems, options);
          added = result.added;
          overflow += result.overflow;
        } else if (options.insert) {
          added = this._insertAll(videoListItems, options);
        } else if (options.append) {
          added = this._appendAll(videoListItems, options);
        } else {
          this._replaceAll(videoListItems, options);
        }

        this.emit('update');
        if (overflow && added === 0) {
          return Promise.resolve({
            status: 'ok',
            message: `プレイリストの上限により${overflow}件追加できませんでした${capacityNotice}`
          });
        }
        // Task 041: 1件も増えなかった場合は、そうと分かるメッセージにする
        // （全部すでにプレイリストに入っていた、という状況を利用者が
        //   区別できないと「壊れている」ようにしか見えないため）。
        if (added === 0) {
          return Promise.resolve({
            status: 'ok',
            message: `追加できる動画がありませんでした（${videoListItems.length}件すべて既にプレイリストにあります）${capacityNotice}`
          });
        }
        return Promise.resolve({
          status: 'ok',
          message:
            (added !== null ?
              `プレイリストに${added}件追加しました${overflow ? `（上限により${overflow}件追加できませんでした）` : ''}` :
              'プレイリストに読み込みしました') + capacityNotice
        });
      }, error => {
        if (this._isStalePlaylistLoad(replaceOwner, isCurrent, additiveOwner)) {
          return {status: 'superseded', message: ''};
        }
        throw error;
      }).finally(() => {
        if (additiveOwner) { additiveOwner.release(); }
      });
  }
  /**
   * Task 073: 検索でプレイリストに読み込む最大件数（設定 search.limit）を安全な範囲に丸める。
   * 数値以外・古い設定値でも壊れないよう、必ず SEARCH_LIMIT_MIN〜SEARCH_LIMIT_MAX に収める。
   */
  static normalizeSearchLimit(value?: Loose) {
    const n = parseInt(value, 10);
    if (!isFinite(n) || n <= 0) {
      return PlayList.SEARCH_LIMIT_DEFAULT;
    }
    return Math.min(Math.max(n, PlayList.SEARCH_LIMIT_MIN), PlayList.SEARCH_LIMIT_MAX);
  }
  // Task189: 検索で適用できなかった条件を利用者へ伝える一文（無ければ空）
  static searchNotice(result?: Loose) {
    const unapplied = (result && Array.isArray(result.unappliedConditions)) ? result.unappliedConditions : [];
    const LABEL: Record<string, string> = {selectContentType: '動画の長さ種別', channelVideoListingStatus: 'チャンネル動画の掲載', kind: '投稿者の種類(kind)', genre: 'ジャンル'};
    let notice = unapplied.length ? `（未対応のため適用していない条件: ${unapplied.map((key: string) => LABEL[key] || key).join('、')}）` : '';
    // Task190: 途中のページの取得に失敗した時は、取れた分だけであることを伝える
    if (result && result.partial === true) {
      notice += `（途中のページの取得に失敗したため、取得できた${result.returnedCount ?? (result.list || []).length}件だけです）`;
    }
    return notice;
  }
  loadSearchVideo(word?: Loose, options?: Loose, limit: Loose = PlayList.SEARCH_LIMIT_DEFAULT, isCurrent?: Loose) {
    this._initializeView();
    limit = PlayList.normalizeSearchLimit(limit);

    if (!this._nicoSearchApiLoader) {
      this._nicoSearchApiLoader = NicoSearchApiV2Loader;
    }

    // Task 074: 同じ語の検索が並行して走るとconsole.timeのラベルが重複して警告になるため、番号を付ける
    const timerLabel = `loadSearchVideos${word} #${PlayList._searchSeq = (PlayList._searchSeq || 0) + 1}`;
    window.console.time(timerLabel);
    options = options || {};
    const replaceOwner = this._beginReplaceLoad(options);

    // Task 067: 検索は NicoSearchApiV2Loader.searchMore() 側で本家と同じ検索API(nvapi)を
    // 使うようになったため、Task 066で追加した「0件の時にnvapiで取り直す」処理は撤去した
    // （同じ条件で同じAPIをもう一度呼ぶだけになるため）。
    let searchResult: Loose = null;
    const loadItems = async () => {
      const result = searchResult = await this._nicoSearchApiLoader.searchMore(word, options, limit);
      const items: Loose[] = (result && result.list) || [];
      return items
        .filter(item => {
          return (item.item_data &&
            parseInt(item.item_data.deleted, 10) === 0) ||
            (item.thumbnail_url || '').indexOf('video_deleted') < 0;
        }).map(item => VideoListItem.createByMylistItem(item));
    };

    const network = loadItems();
    const additiveOwner = this._beginAdditiveLoad(options);
    return this._waitForAdditiveTurn(network, additiveOwner).then(videoListItems => {
        window.console.timeEnd(timerLabel);
        if (this._isStalePlaylistLoad(replaceOwner, isCurrent, additiveOwner)) {
          return {status: 'superseded', message: ''};
        }

        if (videoListItems.length < 1) {
          return Promise.reject({});
        }

        if (options.playlistSort) {
          // 連続再生のために結果を古い順に並べる
          // 検索対象のソート順とは別
          videoListItems = _.sortBy(
            videoListItems, (item: Loose) =>  item.postedAt + item.sortTitle);
        }

        if (options.shuffle) {
          videoListItems = _.shuffle(videoListItems);
        }

        const bounded = this._boundedBulkItems(videoListItems, !options.insert && !options.append);
        videoListItems = bounded.items;
        this._reserveLoadedItems(videoListItems, !options.insert && !options.append);
        let added: number | null | undefined = null;
        if (options.insert) {
          added = this._insertAll(videoListItems, options);
        } else if (options.append) {
          added = this._appendAll(videoListItems, options);
        } else {
          this._replaceAll(videoListItems, options);
        }

        this.emit('update');
        if (added === 0) {
          return Promise.resolve({
            status: 'ok',
            message: `追加できる動画がありませんでした（${videoListItems.length}件すべて既にプレイリストにあります）`
          });
        }
        return Promise.resolve({
          status: 'ok',
          message:
            (added !== null ?
              `検索結果を${added}件プレイリストに追加しました` :
              '検索結果をプレイリストに読み込みしました') +
              (bounded.overflow ? `（上限により${bounded.overflow}件追加できませんでした）` : '') + PlayList.searchNotice(searchResult)
        });
      }, error => {
        if (this._isStalePlaylistLoad(replaceOwner, isCurrent, additiveOwner)) {
          return {status: 'superseded', message: ''};
        }
        throw error;
      }).finally(() => {
        if (additiveOwner) { additiveOwner.release(); }
      });
  }
  /**
   * 動画IDの配列を、その順番のままプレイリストへ追加する（Task 043）。
   *
   * 既存の append(watchId) は1件ずつで、追加のたびに通知を出し
   * 末尾へスクロールする作りのため、コンテンツツリーのように
   * 十数件をまとめて入れる用途には向かない。こちらは
   *
   *  - 動画情報の取得は並行して行い（待ち時間を短くする）
   *  - 並び順は渡された配列の通りに保ち（親→子の順を崩さない）
   *  - 通知は呼び出し側でまとめて1回出せるよう、実際に追加できた件数を返す
   *
   * という形にしてある。情報が取れなかった動画（削除済み等）は
   * タイトル無しの項目として追加する（既存の append と同じ扱い）。
   *
   * @param {string[]} watchIds
   * @param {object} options insert: trueなら現在位置の次に挿入
   * @return {Promise<number>} 実際に追加できた件数
   */
  async appendWatchIds(watchIds: Loose[], options: Loose = {}) {
    this._initializeView();
    if (!Array.isArray(watchIds) || !watchIds.length) {
      return 0;
    }
    // Task192 (COM-04): optional display hints by watchId, used only when the full
    // video information cannot be loaded. They are never written to any cache.
    const hints = options.hints && typeof options.hints === 'object' ? options.hints : null;
    // Task196: 大量のID（親子作品の全件等）は、詳細の取得を待たずに一度で追加する（詳細は表示範囲から補完）
    if (options.deferDetails === true) {
      return this._appendIdsDeferred(watchIds, options, hints);
    }
    const loadOne = (watchId: string) =>
      this._thumbInfoLoader.load(watchId).then(info => {
        // APIにwatchIdを指定してもvideoIdが返るので上書きする. バッドノウハウ
        info.id = watchId;
        return VideoListItem.createByThumbInfo(info);
      }).catch(() => VideoListItem.createBlankInfo(watchId, hints && hints[watchId]));

    // 一度に全部投げると、数十件・数百件の時にAPIへ一気に負荷をかけてしまう。
    // 並列数を絞って順に処理する（Task 044）。
    // 並び順は watchIds の通りに保つ必要があるので、結果は添字で書き戻す。
    const CONCURRENCY = 8;
    // Task181 (F04): the caller may cancel (video switched / closed / superseded)
    // while metadata is loading; then nothing is added and null is returned.
    const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
    const items: Loose[] = new Array(watchIds.length);
    for (let i = 0; i < watchIds.length; i += CONCURRENCY) {
      if (isCancelled()) {
        return null;
      }
      const chunk = watchIds.slice(i, i + CONCURRENCY);
      const loaded = await Promise.all(chunk.map(loadOne));
      loaded.forEach((item, j) => { items[i + j] = item; });
    }
    if (isCancelled()) {
      return null;
    }

    const added = options.insert ?
      this._insertAll(items, options) : this._appendAll(items, options);
    this.emit('update');
    return added;
  }
  /**
   * Task196: IDの一覧を、動画の詳細（getthumbinfo）の取得を待たずにプレイリストへ追加する。
   *  - 既にプレイリストにある動画は追加しない（詳細も取りに行かない）。
   *  - 上限（model.maxItems）に入りきらない分は追加せず、report.overflow に残す（既存の項目も新しい項目も黙って捨てない）。
   *  - 全件を1回で挿入する（何度にも分けて「再生中の次」へ入れると、後の分が前に来て順番が逆転するため）。
   *  - 追加する項目は「情報不明（IDだけ）」で、表示範囲に入った項目から少しずつ詳細を補完する（_scheduleDetailFill）。
   * 戻り値は追加した件数。取消された時は null（何も追加しない）。options.report に内訳を書く。
   */
  _appendIdsDeferred(watchIds: Loose[], options: Loose = {}, hints: Loose = null) {
    const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
    const report = options.report && typeof options.report === 'object' ? options.report : {};
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of Array.isArray(watchIds) ? watchIds : []) {
      const key = id == null ? '' : String(id);
      if (!key || seen.has(key)) { continue; }
      seen.add(key);
      ids.push(key);
    }
    const existing = ids.filter(id => this.model.findByWatchId(id));
    const fresh = ids.filter(id => !this.model.findByWatchId(id));
    const room = Math.max(0, (this.model.maxItems || 0) - this.model.length);
    const accepted = fresh.slice(0, room);
    const overflow = fresh.slice(room);
    Object.assign(report, {requested: ids.length, existing: existing.length, accepted: accepted.length,
      overflow, capacity: this.model.maxItems, before: this.model.length, added: 0});
    if (isCancelled()) {
      return null;
    }
    if (!accepted.length) {
      return 0;
    }
    const items = accepted.map(id => VideoListItem.createBlankInfo(id, hints && hints[id]));
    const beforeIds = new Set(this.model.items.map(item => item.watchId));
    // Task199: a resumed batch can be placed right after a given item (the previous batch's last item)
    const anchor = options.insert && options.insertAfterWatchId ? this.model.findByWatchId(options.insertAfterWatchId) : null;
    const added = anchor ? this._insertAllAt(items, this.model.indexOf(anchor) + 1, options) :
      (options.insert ? this._insertAll(items, options) : this._appendAll(items, options));
    report.added = added;
    report.addedIds = accepted.filter(id => !beforeIds.has(id) && this.model.findByWatchId(id));
    report.existingIds = existing;
    this.emit('update');
    this._scheduleDetailFill();
    return added;
  }
  /**
   * Task196: 情報不明（IDだけ）の項目の詳細を、画面に見えている（isLazy=false）項目から順に、少ない並列数で取得して
   * 同じ項目のまま完全にする。見えていない項目は取りに行かない（約1000件の詳細を一度に待たない）。
   * 失敗しても項目とIDは残す（detailFailed）。プレイリストから外れた項目の結果は反映しない。
   */
  _scheduleDetailFill() {
    if (this._detailFillTimer) { return; }
    this._detailFillTimer = window.setTimeout(() => {
      this._detailFillTimer = null;
      this._fillDetails();
    }, PlayList.DETAIL_FILL_DELAY_MS);
  }
  _fillDetails() {
    const loader = this._thumbInfoLoader;
    if (!loader || typeof loader.load !== 'function') { return; }
    this._detailRunning = this._detailRunning || 0;
    const slots = PlayList.DETAIL_CONCURRENCY - this._detailRunning;
    if (slots <= 0) { return; }
    const active = Math.max(0, this.model.activeIndex);
    const candidates = this.model.items
      .map((item, index) => ({item, index}))
      .filter(({item}) => item.isBlankData && !item.isLazy && !item.state.detailRequested && /^[a-z]{2}\d+$/.test(item.watchId))
      .sort((a, b) => Math.abs(a.index - active) - Math.abs(b.index - active))
      .slice(0, slots);
    for (const {item} of candidates) {
      item.state.detailRequested = true;
      this._detailRunning++;
      Promise.resolve().then(() => loader.load(item.watchId)).then(info => {
        if (this.model.findByItemId(item.itemId) === item && item.isBlankData) {
          item.upgradeByThumbInfo(info);
        }
      }).catch(() => {
        item.state.detailFailed = true;
      }).then(() => {
        this._detailRunning--;
        this._scheduleDetailFill();
      });
    }
  }
  /**
   * Task196: 表示用のヒント（動画ID → {title, thumbnailUrl}）を、情報不明の項目にだけ反映する。戻り値は更新した件数。
   */
  applyHints(hintMap?: Loose) {
    if (!hintMap) { return 0; }
    const get = typeof hintMap.get === 'function' ? (id: string) => hintMap.get(id) : (id: string) => hintMap[id];
    let n = 0;
    for (const item of this.model.items) {
      if (!item.isBlankData) { continue; }
      const hint = get(item.watchId);
      if (hint && item.applyHint(hint)) { n++; }
    }
    return n;
  }
  insert(watchId?: Loose) {
    this._initializeView();
    if (this._activeItem && this._activeItem.watchId === watchId) {
      return Promise.resolve();
    }

    const model = this.model;
    const anchor = this._activeItem;
    // The numeric position can change while thumbnail metadata is loading.
    // Re-resolve the original playing item against the same playlist model.
    const getInsertIndex = () => {
      if (this.model !== model) { return null; }
      if (anchor) {
        const currentIndex = model.indexOf(anchor);
        return currentIndex >= 0 ? currentIndex + 1 : null;
      }
      return Math.min(model.length, Math.max(0, this._index + 1));
    };
    return this._thumbInfoLoader.load(watchId).then(info => {
      const index = getInsertIndex();
      if (index === null) { return; }
      // APIにwatchIdを指定してもvideoIdが返るので上書きする. バッドノウハウ
      // チャンネル動画はsoXXXXに統一したいのでvideoIdを使う. バッドノウハウ
      info.id = info.isChannel ? info.id : watchId;
      const item = VideoListItem.createByThumbInfo(info);
      model.insertItem(item, index);
      this._refreshIndex(true);

      this.emit('update');

      this.emit('command', 'notifyHtml',
        `次に再生: <img src="${item.thumbnail}" style="width: 96px;">${textUtil.escapeToZenkaku(item.title)}`
      );
    }).catch(result => {
      const index = getInsertIndex();
      if (index === null) { return; }
      const item = VideoListItem.createBlankInfo(watchId);
      model.insertItem(item, index);
      this._refreshIndex(true);

      this.emit('update');

      window.console.error(result);
      this.emit('command', 'alert', `動画情報の取得に失敗: ${watchId}`);
    });
  }
  insertCurrentVideo(videoInfo?: Loose) {
    this._initializeView();

    // Task 093: 情報不明（blank）の item も、同じ object のまま完全な情報にする（updateByVideoInfo が blank なら完全化する）。
    // 以前は blank を除外して完全な item を新しく入れようとし、重複で弾かれて「動画情報不明」が残り続けていた。
    // チャンネル動画は、数字のID（contextWatchId）で入れた item が so〜（watchId）になるので、両方で探す。
    const ids = [videoInfo.watchId, videoInfo.contextWatchId].filter(Boolean).map(id => id.toString());
    const matches = (item: Loose) => item && ids.includes(item.watchId);
    if (this._activeItem && matches(this._activeItem) && this.model.indexOf(this._activeItem) >= 0) {
      this._activeItem.updateByVideoInfo(videoInfo);
      this._activeItem.isPlayed = true;
      this.scrollToActiveItem();
      return;
    }

    let currentItem = ids.map(id => this.model.findByWatchId(id)).find(Boolean);
    if (currentItem) {
      currentItem.updateByVideoInfo(videoInfo);
      currentItem.isPlayed = true;
      this.setIndex(this.model.indexOf(currentItem));
      this.scrollToActiveItem();
      return;
    }

    const item = VideoListItem.createByVideoInfoModel(videoInfo);
    item.isPlayed = true;
    // The new playing row must be protected before the model trims a full
    // list; marking it active after insert would already have dropped it.
    item.isActive = true;
    if (this._activeItem) {
      this._activeItem.isActive = false;
    }
    this.model.insertItem(item, this._index + 1);
    this._activeItem = this.model.findByItemId(item.itemId) || this.model.findByWatchId(videoInfo.watchId) || null;
    this._refreshIndex(true);
  }
  removeItemByWatchId(watchId?: Loose) {
    const item = this.model.findByWatchId(watchId);
    if (!item || item.isActive) {
      return;
    }
    this.model.removeItem(item);
    this._refreshIndex(true);
  }
  append(watchId?: Loose) {
    this._initializeView();
    if (this._activeItem && this._activeItem.watchId === watchId) {
      return Promise.resolve();
    }

    const model = this.model;
    return this._thumbInfoLoader.load(watchId).then(info => {
      // APIにwatchIdを指定してもvideoIdが返るので上書きする. バッドノウハウ
      info.id = watchId;
      const item = VideoListItem.createByThumbInfo(info);
      //window.console.info(item, info);
      model.appendItem(item);
      this._refreshIndex();
      this.emit('update');
      this.emit('command', 'notifyHtml',
        `リストの末尾に追加: <img src="${item.thumbnail}" style="width: 96px;">${textUtil.escapeToZenkaku(item.title)}`
      );
    }).catch(result => {
      const item = VideoListItem.createBlankInfo(watchId);
      model.appendItem(item);
      this._refreshIndex(true);
      this.emit('update');

      window.console.error(result);
      this.emit('command', 'alert', '動画情報の取得に失敗: ' + watchId);
    });
  }
  getIndex() {
    return this._activeItem ? this._index : -1;
  }
  setIndex(v?: Loose, force?: Loose) {
    v = parseInt(v, 10);
    if (this._index !== v || force) {
      this._index = v;
      if (this._activeItem) {
        this._activeItem.isActive = false;
      }
      this._activeItem = this.model.getItemByIndex(v);
      if (this._activeItem) {
        this._activeItem.isActive = true;
      }
      this.emit('update');
    }
  }
  _refreshIndex(scrollToActive?: Loose) {
    this.setIndex(this.model.indexOf(this._activeItem), true);
    if (scrollToActive) {
      setTimeout(() => this.scrollToActiveItem(true), 1000);
    }
  }
  _setIndexByItemId(itemId?: Loose) {
    const item = this.model.findByItemId(itemId);
    if (item) {
      this._setIndexByItem(item);
    }
  }
  _setIndexByItem(item?: Loose) {
    const index = this.model.indexOf(item);
    if (index >= 0) {
      this.setIndex(index);
    }
  }
  toggleEnable(v?: Loose) {
    if (!_.isBoolean(v)) {
      this._isEnable = !this._isEnable;
      this.emit('update');
      return;
    }

    if (this._isEnable !== v) {
      this._isEnable = v;
      this.emit('update');
    }
  }
  toggleLoop() {
    this._isLoop = !this._isLoop;
    this.emit('update');
  }
  // Task 093: 並びを逆にした後、再生位置（_index）を再生中の item の新しい位置に直して update を出す（保存にも反映）
  reverse() {
    this.model.reverse();
    this._refreshIndex();
  }
  shuffle() {
    this.model.shuffle();
    if (this._activeItem) {
      this.model.removeItem(this._activeItem);
      this.model.insertItem(this._activeItem, 0);
      this.setIndex(0);
    } else {
      this.setIndex(-1);
    }
    this.view.scrollTop(0);
  }
  sortBy(key?: Loose, isDesc?: Loose) {
    this.model.sortBy(key, isDesc);
    this._refreshIndex(true);
    setTimeout(() => {
      this.view.scrollToItem(this._activeItem);
    }, 1000);
  }
  removePlayedItem() {
    this.model.removePlayedItem();
    this._refreshIndex(true);
    setTimeout(() => this.view.scrollToItem(this._activeItem), 1000);
  }
  removeNonActiveItem() {
    this.model.removeNonActiveItem();
    this._refreshIndex(true);
    this.toggleEnable(false);
  }
  selectNext() {
    if (!this.hasNext) {
      return null;
    }
    const index = this.getIndex();
    const len = this.length;
    if (len < 1) {
      return null;
    }

    if (index < -1) {
      this.setIndex(0);
    } else if (index + 1 < len) {
      this.setIndex(index + 1);
    } else if (this.isLoop) {
      this.setIndex((index + 1) % len);
    }
    return this._activeItem ? this._activeItem.watchId : null;
  }
  selectPrevious() {
    const index = this.getIndex();
    const len = this.length;
    if (len < 1) {
      return null;
    }

    if (index < -1) {
      this.setIndex(0);
    } else if (index > 0) {
      this.setIndex(index - 1);
    } else if (this.isLoop) {
      this.setIndex((index + len - 1) % len);
    } else {
      return null;
    }

    return this._activeItem ? this._activeItem.watchId : null;
  }
  scrollToActiveItem(force?: Loose) {
    if (this._activeItem && (force || !this.view.hasFocus)) {
      this.view.scrollToItem(this._activeItem, force);
    }
  }
  scrollToWatchId(watchId?: Loose) {
    const item = this.model.findByWatchId(watchId);
    if (item) {
      this.view.scrollToItem(item);
    }
  }
  findByWatchId(watchId?: Loose) {
    return this.model.findByWatchId(watchId);
  }

  get isEnable() {
    return this._isEnable;
  }
  get isLoop() {
    return this._isLoop;
  }

  get length() {
    return this.model.length;
  }

  get hasNext() {
    const len = this.length;
    return len > 0 && (this.isLoop || this._index < len - 1);
  }
}
/* Task 073: 検索でプレイリストに読み込む最大件数。本家検索API(nvapi)の上限が5000件。 */
PlayList.DETAIL_CONCURRENCY = 2;
PlayList.DETAIL_FILL_DELAY_MS = 200;
PlayList.SEARCH_LIMIT_DEFAULT = 1000; // Task 193: 設定の初期値（search.limit）と同じ
PlayList.SEARCH_LIMIT_MIN = 1;
PlayList.SEARCH_LIMIT_MAX = 5000;

export {
  PlayList,
  PlayListSession,
  VideoListItem,
  VideoListModel,
  VideoListItemView,
  VideoListView,
  PlayListView,
  PlayListModel,
  VideoList,
  RelatedVideoList
};

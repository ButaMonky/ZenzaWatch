import {Emitter} from '../../../lib/src/Emitter';
import {bounce, throttle} from '../../../lib/src/infra/bounce';
import {VideoListItem} from './VideoListItem';
//===BEGIN===
class VideoListModel extends Emitter {
  constructor(params) {
    super();
    this.watchIds = new Map();
    this.itemIds = new Map();
    this.uset = new Set();
    this.initialize(params);
    this.onUpdate = throttle.raf(this.onUpdate.bind(this));
  }

  initialize(params) {
    this.isUniq = params.uniq;
    this.items = [];
    this.maxItems = params.maxItems || 100;
  }

  setItemData(itemData) {
    itemData = Array.isArray(itemData) ? itemData : [itemData];
    const items = itemData.filter(itemData => itemData.has_data)
      .map(itemData => new VideoListItem(itemData));
    this.setItem(items);
  }

  /*
   * Task 093: 一覧を変える操作（setItem・appendItem・insertItem・削除・unserialize）は、最後に _commit を通す。
   *  1. isUniq なら、uniqId・watchId・itemId のどれかが同じ item を1つにする（_dedupe）
   *  2. maxItems を超えた分を落とす（_limit。落とす向きは操作ごとに以前と同じ）
   *  3. 一覧から外れた item を切り離し（groupList = null）、残った item を所属させる
   *  4. Map（watchIds・itemIds・uset）を作り直し、update を1回出す
   * 一覧から外れた item の状態を後から変えても、この model の update は起きない（ghost update を防ぐ）。
   */
  setItem(items = []) {
    items = (Array.isArray(items) ? items : [items]).filter(Boolean);
    // 置き換え: 渡された順に、重複は最初に現れた位置へまとめ、上限を超えた分は末尾を落とす（渡された先頭側を残す）
    this._commit(this._dedupe([], items), 'tail');
  }

  _commit(nextItems, trimFrom = 'tail') {
    const before = this.items || [];
    const next = this._limit(nextItems, trimFrom);
    const nextSet = new Set(next);
    for (const item of before) {
      if (!nextSet.has(item) && item.groupList === this) {
        item.groupList = null;
      }
    }
    this.items = next;
    this._refreshMaps();
    this.onUpdate();
    return next;
  }

  // 上限を超えた分を落とす。再生中（isActive）の item は落とさない
  _limit(items, trimFrom) {
    let over = items.length - this.maxItems;
    if (over <= 0) {
      return items;
    }
    const drop = new Set();
    const order = trimFrom === 'head' ? items : [...items].reverse();
    for (const item of order) {
      if (over <= 0) { break; }
      if (item.isActive) { continue; }
      drop.add(item);
      over--;
    }
    return items.filter(item => !drop.has(item)).slice(0, this.maxItems);
  }

  static _keysOf(item) {
    return [`u:${item.uniqId}`, `w:${item.watchId}`, `i:${item.itemId}`];
  }

  // 重なった2つのうち残す方。再生中 > 情報がある方（blank でない） > 先にあった方（a）
  static _preferred(a, b) {
    if (a.isActive !== b.isActive) { return a.isActive ? a : b; }
    if (a.isBlankData !== b.isBlankData) { return a.isBlankData ? b : a; }
    return a;
  }

  // 外す item の再生済み・最後に再生した時刻を、残す item へ引き継ぐ
  static _mergeState(keep, drop) {
    if (drop.isPlayed && !keep.isPlayed) { keep.isPlayed = true; }
    if (drop.state && keep.state && (drop.state.lastActivated || 0) > (keep.state.lastActivated || 0)) {
      keep.state.lastActivated = drop.state.lastActivated;
    }
  }

  /**
   * existing（既に一覧にある item。互いに重複しない前提）に続けて incoming を重複なしで並べた配列を返す。
   * - incoming が existing と重なれば、existing を残す（existing が情報不明で incoming に情報があれば、existing を同じ object のまま完全化する）
   * - incoming どうしが重なれば、最初に現れた位置に、再生中 > 情報がある方 > 先に現れた方 を残す
   * 戻り値は [...existing, ...追加分]。isUniq でなければそのまま。
   */
  _dedupe(existing, incoming) {
    if (!this.isUniq) {
      return existing.concat(incoming);
    }
    const result = [...existing];
    const owner = new Map(); // key -> result の添字
    const put = (item, index) => VideoListModel._keysOf(item).forEach(k => owner.set(k, index));
    result.forEach(put);
    const existingCount = existing.length;
    for (const item of incoming) {
      const hits = [...new Set(VideoListModel._keysOf(item).map(k => owner.get(k)).filter(i => i !== undefined))]
        .filter(i => result[i]);
      if (!hits.length) {
        put(item, result.push(item) - 1);
        continue;
      }
      if (hits.some(i => i < existingCount)) {
        // 既にある item を残す
        const target = result[Math.min(...hits)];
        // 同じ watchId の時だけ（watchId が変わる完全化は、一覧の変更の途中で別の重複を起こし得るため、ここではしない）
        if (target !== item && target.isBlankData && !item.isBlankData && target.upgradeFromItem &&
          target.watchId === item.watchId) {
          target.upgradeFromItem(item);
        }
        if (target !== item) {
          VideoListModel._mergeState(target, item);
        }
        continue;
      }
      // 同じ一括の中の重複
      const pos = Math.min(...hits);
      let keep = item;
      for (const i of hits) {
        const other = result[i];
        if (other === keep) { continue; }
        const preferred = VideoListModel._preferred(other, keep);
        const dropped = preferred === other ? keep : other;
        VideoListModel._mergeState(preferred, dropped);
        keep = preferred;
      }
      for (const i of hits) {
        VideoListModel._keysOf(result[i]).forEach(k => owner.get(k) === i && owner.delete(k));
        result[i] = null;
      }
      result[pos] = keep;
      put(keep, pos);
    }
    return result.filter(Boolean);
  }

  _refreshMaps() {
    this.uset.clear();
    this.watchIds.clear();
    this.itemIds.clear();
    this.items.forEach(item => {
      this.watchIds.set(item.watchId, item);
      this.itemIds.set(item.itemId, item);
      this.uset.add(item.uniqId);
      item.groupList = this;
    });
  }

  /**
   * Task 093: item.watchId が変わった時に item から呼ばれる。Map をすぐに直す。
   * 変更先の watchId の item が既にあれば（isUniq の時）、片方を外す:
   * 再生中 > 情報がある方（blank でない） > もともとその watchId だった item。外した方の再生済みは引き継ぐ。
   */
  onItemWatchIdChange(item, oldWatchId) {
    if (this.itemIds.get(item.itemId) !== item) {
      return;
    }
    if (this.watchIds.get(oldWatchId) === item) {
      this.watchIds.delete(oldWatchId);
    }
    const other = this.watchIds.get(item.watchId);
    if (!other || other === item || !this.isUniq) {
      this.watchIds.set(item.watchId, item);
      return;
    }
    const keep = VideoListModel._preferred(other, item);
    const drop = keep === item ? other : item;
    VideoListModel._mergeState(keep, drop);
    this._commit(this.items.filter(i => i !== drop), 'tail');
    this.emit('item-removed', [drop]);
  }

  includes(item) {
    return this.uset.has(item.uniqId) || this.watchIds.has(item.watchId) || this.itemIds.has(item.itemId);
  }

  clear() {
    this.setItem([]);
  }

  insertItem(items, index) {
    //window.console.log('insertItem', itemList, index);
    items = (Array.isArray(items) ? items : [items]).filter(Boolean);
    const added = this._dedupe(this.items, items).slice(this.items.length);
    if (!added.length) {
      return;
    }

    index = Math.min(this.items.length, (_.isNumber(index) ? Math.max(0, index) : 0));
    const next = [...this.items];
    next.splice(index, 0, ...added);
    // 挿入: 入れた位置の関係を保ち、上限を超えた分は末尾を落とす（以前と同じ向き）
    this._commit(next, 'tail');
    for (const item of added) {
      if (item.groupList === this && this.itemIds.get(item.itemId) !== item) {
        item.groupList = null;
      }
    }

    return this.indexOf(added[0]);
  }

  appendItem(items) {
    items = (Array.isArray(items) ? items : [items]).filter(Boolean);
    const next = this._dedupe(this.items, items);
    if (next.length === this.items.length) {
      return;
    }
    // 末尾に追加: 上限を超えた分は古い先頭を落とす（以前と同じ向き）
    this._commit(next, 'head');

    return this.items.length - 1;
  }

  moveItemTo(fromItem, toItem) {
    fromItem.isUpdating = true;
    toItem.isUpdating = true;
    // console.nicoru('before moveItemTo',
    //   {fromItem, index:this.indexOf(fromItem)},
    //   {toItem, index: this.indexOf(toItem)}
    // );
    const destIndex = this.indexOf(toItem);
    if (destIndex < 0 || this.indexOf(fromItem) < 0) {
      this.resetUiFlags([fromItem, toItem]);
      return;
    }
    // Task 093: 一度外してから入れ直す（以前と同じ位置関係）。途中で切り離さないよう、1回の _commit で並べ替える
    const next = this.items.filter(item => item !== fromItem);
    next.splice(Math.min(destIndex, next.length), 0, fromItem);
    this._commit(next, 'tail');
    // console.nicoru('after moveItemTo',
    //   {fromItem, index:this.indexOf(fromItem)},
    //   {toItem, index: this.indexOf(toItem)}
    // );
    this.resetUiFlags([fromItem, toItem]);
  }

  resetUiFlags(items) {
    items = items || this.items;
    items = Array.isArray(items) ? items : [items];
    for (const item of items) {
      item.isDragging = false;
      item.isDragover = false;
      item.isDropped = false;
      item.isUpdating = false;
    }
  }

  removeByFilter(filterFunc) {
    const befores = [...this.items];
    const afters = this.items.filter(filterFunc);
    if (befores.length === afters.length) {
      return false;
    }
    this._commit(afters, 'tail');
    return true;
  }

  removePlayedItem() {
    this.removeByFilter(item => item.isActive || !item.isPlayed);
  }

  removeNonActiveItem() {
    this.removeByFilter(item => item.isActive);
  }

  resetPlayedItemFlag() {
    this.items.forEach(item => item.isPlayed = false);
    this.onUpdate();
  }

  shuffle() {
    this.items = _.shuffle(this.items);
    this.onUpdate();
  }

  indexOf(item) {
    if (!item || !item.itemId) { return -1; }
    return this.items.findIndex(i => i.itemId === item.itemId);
  }

  getItemByIndex(index) {
    return this.items[index] || null;
  }

  findByItemId(itemId) {
    itemId = parseInt(itemId, 10);
    return this.itemIds.get(itemId);
  }

  findByWatchId(watchId) {
    // Task 093: 以前は watchId が無い（undefined）と例外になっていた（options.watchId を渡さない追加など）
    if (watchId === undefined || watchId === null) {
      return undefined;
    }
    watchId = watchId.toString();
    return this.watchIds.get(watchId);
  }

  removeItem(...items) {
    this.removeByFilter(item => !items.includes(item));
  }

  onItemUpdate(item) {
    // this.emit('item-update', item);
    this.onUpdate();
  }

  serialize() {
    return this.items.map(item => item.serialize());
  }

  unserialize(itemDataList) {
    const items = (Array.isArray(itemDataList) ? itemDataList : [])
      .filter(itemData => itemData && typeof itemData === 'object')
      .map(itemData => new VideoListItem(itemData));
    this.setItem(items);
  }

  sortBy(key, isDesc) {
    const table = {
      watchId: 'watchId',
      duration: 'duration',
      title: 'sortTitle',
      comment: 'commentCount',
      mylist: 'mylistCount',
      view: 'viewCount',
      postedAt: 'postedAt',
    };
    const prop = table[key];
    if (!prop) {
      return;
    }
    this.items = _.sortBy(this.items, item => item[prop]);
    if (isDesc) {
      this.items.reverse();
    }
    this.onUpdate();
  }

  reverse() {
    this.items.reverse();
    this.onUpdate();
  }

  onUpdate() {
    this.emitAsync('update', this.items);
  }

  get length() {
    return this.items.length;
  }

  get activeIndex() {
    return this.items.findIndex(i => i.isActive);
  }
}

//===END===

export {VideoListModel};
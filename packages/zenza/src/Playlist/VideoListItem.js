import {bounce, throttle} from '../../../lib/src/infra/bounce';
import {textUtil} from '../../../lib/src/text/textUtil';
//===BEGIN===
/*
 * Task 093: プレイリストの1件。3種類の identity を混同しないこと。
 *  - watchId: 今その動画を再生・検索・重複判定に使う正規の動画ID（sm〜・so〜・ss〜・スレッドIDの数字）。
 *             後から変わることがある（例: 数字のIDで入れたチャンネル動画が so〜 と分かった時。
 *             MylistPocket の情報で item.watchId = … と書き換える外部のコードもある）。
 *             変わった時は所属する model（groupList）へすぐ知らせ、findByWatchId が新しいIDで見つかるようにする。
 *  - uniqId:  item が最初に持った安定した identity（動画を開いた時の contextWatchId 等）。watchId が変わっても変えない。
 *             保存形式では uniq_id（以前から serialize が書いていた名前）。読む時は uniqId・uniq_id のどちらも受け付ける。
 *  - itemId:  実行中の item object ごとの番号（保存しない。復元すると新しい番号になる）。
 */
class VideoListItem {
  // Keep optional card metadata through all adapters; absence is not a zero count.
  static cardMetadata(source) {
    const result = {};
    const like = source.count?.like ?? source.like ?? source.like_counter;
    if (typeof like === 'number' && Number.isSafeInteger(like) && like >= 0) { result.like = like; }
    if (source.owner && typeof source.owner.name === 'string') {
      const owner = source.owner;
      const icon = owner.icon ?? owner.iconUrl;
      result.owner = {name: owner.name, id: owner.id, type: owner.type ?? owner.ownerType,
        icon: typeof icon === 'string' && /^https?:\/\//i.test(icon) ? icon : ''};
    }
    const access = source.cardAccess || {};
    for (const [key, value] of Object.entries({
      isPaymentRequired: access.paid ?? source.isPaymentRequired,
      isMemberOnly: access.member ?? source.isMemberOnly,
      isPremiumOnly: access.premium ?? source.isPremiumOnly
    })) {
      if (typeof value === 'boolean') { result[key] = value; }
    }
    return result;
  }

  static createByThumbInfo(info) {
    return new this({
      _format: 'thumbInfo',
      ...this.cardMetadata(info),
      id: info.id,
      title: info.title,
      length_seconds: info.duration,
      num_res: info.commentCount,
      mylist_counter: info.mylistCount,
      view_counter: info.viewCount,
      thumbnail_url: info.thumbnail,
      first_retrieve: info.postedAt,

      tags: info.tagList,
      movieType: info.movieType,
      owner: info.owner,
      lastResBody: info.lastResBody
    });
  }

  // Task192 (COM-04): hint = optional display hints (e.g. from the commons tree with_meta).
  // Only the title and thumbnail are used; the item stays a 'blank' (incomplete) item.
  static createBlankInfo(id, hint = null) {
    let postedAt = '0000/00/00 00:00:00';
    if (!isNaN(id)) {
      postedAt = textUtil.dateToString(new Date(id * 1000));
    }
    const hintTitle = hint && typeof hint.title === 'string' && hint.title ? hint.title : null;
    const hintThumb = hint && typeof hint.thumbnailUrl === 'string' && /^https:\/\//.test(hint.thumbnailUrl) ? hint.thumbnailUrl : null;
    return new this({
      _format: 'blank',
      id: id,
      title: hintTitle ? `${hintTitle}(動画情報不明)` : id + '(動画情報不明)',
      length_seconds: 0,
      num_res: 0,
      mylist_counter: 0,
      view_counter: 0,
      thumbnail_url: hintThumb || 'https://nicovideo.cdn.nimg.jp/web/images/bundle/nicovideo/components/Thumbnail/Thumbnail-placeholder.jpg',
      first_retrieve: postedAt,
    });
  }

  static createByMylistItem(item) {
    if (item.content) {
      const content = item.content || {};
      return new VideoListItem({
        _format: 'mylistItemRiapi',
        ...VideoListItem.cardMetadata(content),
        id: content.id,
        uniq_id: content.id,
        title: content.title,
        length_seconds: content.duration,
        num_res: content.count.comment,
        mylist_counter: content.count.mylist,
        view_counter: content.count.view,
        like: content.count.like,
        thumbnail_url: content.thumbnail.url,
        first_retrieve: content.registeredAt,
        lastResBody: content.latestCommentSummary
      });
    }

    if (item.item_data) {
      const item_data = item.item_data || {};
      return new VideoListItem({
        _format: 'mylistItemOldApi',
        ...VideoListItem.cardMetadata(item_data),
        id: item_data.watch_id,
        uniq_id: item_data.watch_id,
        title: item_data.title,
        length_seconds: item_data.length_seconds,
        num_res: item_data.num_res,
        mylist_counter: item_data.mylist_counter,
        view_counter: item_data.view_counter,
        thumbnail_url: item_data.thumbnail_url,
        first_retrieve: textUtil.dateToString(new Date(item_data.first_retrieve * 1000)),

        videoId: item_data.video_id,
        lastResBody: item_data.last_res_body,
        mylistItemId: item.item_id,
        item_type: item.item_type
      });
    }

    // APIレスポンスの統一されてなさよ・・・
    if (!item.length_seconds && typeof item.length === 'string') {
      const [min, sec] = item.length.split(':');
      item.length_seconds = min * 60 + sec * 1;
    }
    return new VideoListItem({
      _format: 'mylistItemRiapi',
      ...VideoListItem.cardMetadata(item),
      id: item.id,
      uniq_id: item.id,
      title: item.title,
      length_seconds: item.length_seconds,
      num_res: item.num_res,
      mylist_counter: item.mylist_counter,
      view_counter: item.view_counter,
      thumbnail_url: item.thumbnail_url,
      first_retrieve: item.first_retrieve,
      lastResBody: item.last_res_body
    });
  }

  static createByVideoInfoModel(info) {
    const count = info.count;
    return new VideoListItem({
      _format: 'videoInfo',
      ...VideoListItem.cardMetadata(info),
      id: info.watchId,
      uniq_id: info.contextWatchId,
      title: info.title,
      length_seconds: info.duration,
      num_res: count.comment,
      mylist_counter: count.mylist,
      view_counter: count.view,
      thumbnail_url: info.thumbnail,
      first_retrieve: info.postedAt,
      owner: info.owner
    });
  }

  constructor(rawData) {
    // Task195: 情報不明（不完全）な item は保存形式に incomplete: true を持つ。読み戻した時に不完全のまま扱う
    // （以前は _format を保存しなかったため、復元後は完全な item と見なされ、補完されないままだった）。
    // incomplete の無い旧保存形式は、これまでどおり完全な item として読む（全部を不完全に移行しない）。
    if (rawData && rawData.incomplete === true && !rawData._format) {
      rawData._format = 'blank';
    }
    this._rawData = rawData;
    this._itemId = VideoListItem._itemId++;
    this._watchId = (this._getData('id', '') || '').toString();
    this._groupList = null;
    this.state = {
      isActive: false,
      lastActivated: rawData.last_activated || 0,
      isUpdating: false,
      isPlayed: !!rawData.played,
      isLazy: true,
      isDragging: false,
      isFavorited: false,
      isDragover: false,
      isDropped: false,
      isPocketResolved: false,
      timestamp: performance.now(),
      adDecoration: null, // 広告装飾('normal'/'silver'/'gold')。未取得はnull(Task 054)
    };
    // Task 093: 以前は rawData.uniqId だけを読んでいたが、作る側（createBy…）と serialize は uniq_id と書くため、
    // 保存して読み戻すと uniqId が失われていた。どちらの名前も読む。
    const uniqId = rawData.uniqId != null && rawData.uniqId !== '' ? rawData.uniqId :
      (rawData.uniq_id != null && rawData.uniq_id !== '' ? rawData.uniq_id : this._watchId);
    this._uniq_id = uniqId.toString();
    rawData.first_retrieve = textUtil.dateToString(rawData.first_retrieve);

    this.notifyUpdate = throttle.raf(this.notifyUpdate.bind(this));
    this._updateSortTitle();
  }

  _updateSortTitle() {
    this._sortTitle = textUtil.convertKansuEi(this.title)
      .replace(/([0-9]{1,9})/g, m => m.padStart(10, '0')).replace(/([０-９]{1,9})/g, m => m.padStart(10, '０'));
  }

  equals(item) {
    return this.uniqId === item.uniqId;
  }

  _getData(key, defValue) {
    return this._rawData.hasOwnProperty(key) ?
      this._rawData[key] : defValue;
  }

  get groupList() { return this._groupList;}
  set groupList(v) { this._groupList = v;}

  notifyUpdate() {
    this.updateTimestamp();
    this._groupList && this._groupList.onItemUpdate(this);
  }

  get uniqId() { return this._uniq_id;}

  get itemId() { return this._itemId; }

  get watchId() { return this._watchId; }
  set watchId(v) {
    v = (v == null ? '' : v).toString();
    if (!v || v === this._watchId) { return; }
    const oldWatchId = this._watchId;
    this._watchId = v;
    // Task 093: 所属する model の watchId の Map をすぐに直す（重複する時は model が片方を外す）
    this._groupList && this._groupList.onItemWatchIdChange && this._groupList.onItemWatchIdChange(this, oldWatchId);
    this.notifyUpdate();
  }

  get title() { return this._getData('title', ''); }

  get sortTitle() { return this._sortTitle; }

  get duration() { return parseInt(this._getData('length_seconds', '0'), 10); }

  get count() {
    return {
      comment: parseInt(this._rawData.num_res, 10),
      mylist: parseInt(this._rawData.mylist_counter, 10),
      view: parseInt(this._rawData.view_counter, 10),
      ...(VideoListItem.cardMetadata(this._rawData).like !== undefined ? {like: this._rawData.like ?? this._rawData.like_counter} : {})
    };
  }

  get owner() { return VideoListItem.cardMetadata(this._rawData).owner || null; }
  get isPaymentRequired() { return this._rawData.isPaymentRequired === true; }
  get isMemberOnly() { return this._rawData.isMemberOnly === true; }
  get isPremiumOnly() { return this._rawData.isPremiumOnly === true; }

  get thumbnail() { return this._rawData.thumbnail_url; }

  get postedAt() { return this._rawData.first_retrieve; }

  get commentCount() { return this.count.comment; }
  get mylistCount() { return this.count.mylist; }
  get viewCount() { return this.count.view; }
  get isActive() { return this.state.isActive; }
  set isActive(v) {
    if (this.isActive === v) { return; }
    this.state.isActive = v;
    v && (this.state.lastActivated = Date.now());
    this.notifyUpdate();
  }
  get isLazy() { return this.state.isLazy; }
  set isLazy(v) {
    if (this.isLazy === v) { return; }
    this.state.isLazy = v;
    this.notifyUpdate();
  }
  get isDragging() { return this.state.isDragging; }
  set isDragging(v) {
    if (this.isDragging === v) { return; }
    this.state.isDragging = v;
    this.notifyUpdate();
  }
  get isDragover() { return this.state.isDragover; }
  set isDragover(v) {
    if (this.isDragover === v) { return; }
    this.state.isDragover = v;
    this.notifyUpdate();
  }
  get isDropped() { return this.state.isDropped; }
  set isDropped(v) {
    if (this.isDropped === v) { return; }
    this.state.isDropped = v;
    this.notifyUpdate();
  }
  get isUpdating() { return this.state.isUpdating; }
  set isUpdating(v) {
    if (this.isUpdating === v) { return; }
    this.state.isUpdating = v;
    this.notifyUpdate();
  }
  get isPlayed() { return this.state.isPlayed; }
  set isPlayed(v) {
    if (this.isPlayed === v) { return; }
    this.state.isPlayed = v;
    this.notifyUpdate();
  }
  get isFavorited() { return this.state.isFavorited; }
  set isFavorited(v) {
    if (this.isFavorited === v) { return; }
    this.state.isFavorited = v;
    this.notifyUpdate();
  }
  get isPocketResolved() { return this.state.isPocketResolved; }
  set isPocketResolved(v) {
    if (this.isPocketResolved === v) { return; }
    this.state.isPocketResolved = v;
    this.notifyUpdate();
  }
  // 広告装飾('normal'/'silver'/'gold')。未取得の間はnull(Task 054)
  get adDecoration() { return this.state.adDecoration; }
  set adDecoration(v) {
    if (this.adDecoration === v) { return; }
    this.state.adDecoration = v;
    this.notifyUpdate();
  }
  get timestamp() { return this.state.timestamp;}
  updateTimestamp() { this.state.timestamp = performance.now();}
  get isBlankData() { return this._rawData._format === 'blank'; }
  remove() {
    if (!this.groupList) { return; }
    this.groupList.removeItem(this);
    this.groupList = null;
  }
  serialize() {
    return {
      ...VideoListItem.cardMetadata(this._rawData),
      active: this.isActive,
      last_activated: this.state.lastActivated || 0,
      played: this.isPlayed,
      uniq_id: this._uniq_id,
      // Task 093: 以前は rawData.id（最初のID）を書いていたため、watchId を変えた後に保存・復元すると古いIDに戻っていた
      id: this._watchId,
      title: this._rawData.title,
      length_seconds: this._rawData.length_seconds,
      num_res: this._rawData.num_res,
      mylist_counter: this._rawData.mylist_counter,
      view_counter: this._rawData.view_counter,
      thumbnail_url: this._rawData.thumbnail_url,
      first_retrieve: this._rawData.first_retrieve,
      // Task195: 不完全な item の印（完全な item には書かない＝旧形式と同じ）
      ...(this.isBlankData ? {incomplete: true} : {})
    };
  }
  /**
   * Task195: 動画の詳細情報（getthumbinfo）で、不完全な item を同じ object のまま完全にする。
   * 完全な item には何もしない（完全な情報を書き換えない）。
   */
  upgradeByThumbInfo(info) {
    if (!this.isBlankData || !info || typeof info.title !== 'string' || !info.title) {
      return false;
    }
    return this._applyFullData({
      _format: 'thumbInfo',
      ...VideoListItem.cardMetadata(info),
      title: info.title,
      length_seconds: Number.isFinite(info.duration) ? info.duration : undefined,
      num_res: Number.isFinite(info.commentCount) ? info.commentCount : undefined,
      mylist_counter: Number.isFinite(info.mylistCount) ? info.mylistCount : undefined,
      view_counter: Number.isFinite(info.viewCount) ? info.viewCount : undefined,
      thumbnail_url: info.thumbnail,
      first_retrieve: info.postedAt,
      owner: info.owner
    });
  }
  /**
   * Task195: 表示用のヒント（親子一覧の with_meta 等）で、不完全な item のタイトル・サムネイルだけを更新する。
   * item は不完全のまま（長さ・件数・タグは確定しない）。完全な item には何もしない。
   */
  applyHint(hint) {
    if (!this.isBlankData || !hint) {
      return false;
    }
    const raw = this._rawData;
    let changed = false;
    if (typeof hint.title === 'string' && hint.title) {
      const title = `${hint.title}(動画情報不明)`;
      if (raw.title !== title) { raw.title = title; changed = true; }
    }
    if (typeof hint.thumbnailUrl === 'string' && /^https:\/\//.test(hint.thumbnailUrl) && raw.thumbnail_url !== hint.thumbnailUrl) {
      raw.thumbnail_url = hint.thumbnailUrl;
      changed = true;
    }
    if (changed) {
      this._updateSortTitle();
      this.notifyUpdate();
    }
    return changed;
  }
  /**
   * 動画情報（VideoInfoModel）で件数・サムネイル・投稿日を更新する（普通の item の軽い更新）。
   * Task 093: 情報不明（blank）の item なら、同じ object のまま完全な情報にする（upgradeByVideoInfo）。
   */
  updateByVideoInfo(videoInfo) {
    if (this.isBlankData) {
      return this.upgradeByVideoInfo(videoInfo);
    }
    const before = JSON.stringify(this.serialize());
    const rawData = this._rawData;
    Object.assign(rawData, VideoListItem.cardMetadata(videoInfo));
    const count = videoInfo.count;
    rawData.first_retrieve = textUtil.dateToString(videoInfo.postedAt);

    rawData.num_res = count.comment;
    rawData.mylist_counter = count.mylist;
    rawData.view_counter = count.view;

    rawData.thumbnail_url = videoInfo.thumbnail;

    if (JSON.stringify(this.serialize()) !== before) {
      this.notifyUpdate();
    }
  }
  /**
   * Task 093: 情報不明（createBlankInfo）の item を、同じ object のまま完全な情報にする。
   * itemId・プレイリストの中の位置・再生中・再生済み・ドラッグ等の表示の状態は変えない。
   * watchId が変わる時（チャンネル動画の so〜 等）は setter を通すので、model の Map も直る。
   */
  upgradeByVideoInfo(videoInfo) {
    const count = videoInfo.count || {};
    return this._applyFullData({
      _format: 'videoInfo',
      ...VideoListItem.cardMetadata(videoInfo),
      watchId: videoInfo.watchId,
      title: videoInfo.title,
      length_seconds: videoInfo.duration,
      num_res: count.comment,
      mylist_counter: count.mylist,
      view_counter: count.view,
      thumbnail_url: videoInfo.thumbnail,
      first_retrieve: videoInfo.postedAt,
      owner: videoInfo.owner
    });
  }
  /**
   * Task 093: 別の item（同じ動画の完全な情報）の内容で、情報不明の item を完全にする（model の重複の処理から使う）。
   */
  upgradeFromItem(item) {
    const raw = item._rawData || {};
    return this._applyFullData({
      _format: raw._format || 'upgraded',
      ...VideoListItem.cardMetadata(raw),
      watchId: item.watchId,
      title: raw.title,
      length_seconds: raw.length_seconds,
      num_res: raw.num_res,
      mylist_counter: raw.mylist_counter,
      view_counter: raw.view_counter,
      thumbnail_url: raw.thumbnail_url,
      first_retrieve: raw.first_retrieve,
      owner: raw.owner
    });
  }
  _applyFullData(data) {
    const rawData = this._rawData;
    for (const key of ['title', 'length_seconds', 'num_res', 'mylist_counter', 'view_counter', 'thumbnail_url', 'owner', 'like', 'isPaymentRequired', 'isMemberOnly', 'isPremiumOnly']) {
      if (data[key] !== undefined && data[key] !== null) {
        rawData[key] = data[key];
      }
    }
    if (data.first_retrieve) {
      rawData.first_retrieve = textUtil.dateToString(data.first_retrieve);
    }
    rawData._format = data._format;
    this._updateSortTitle();
    if (data.watchId) {
      this.watchId = data.watchId;
    }
    this.notifyUpdate();
    return true;
  }
}
VideoListItem._itemId = 1;
//===END===
export {VideoListItem};

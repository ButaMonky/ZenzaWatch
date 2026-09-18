import {VideoListItem} from './VideoListItem';
import {VideoListModel} from './VideoListModel';
import {VideoListItemView} from './VideoListItemView';
import {PlayListModel} from './PlayListModel';
import {VideoList} from './VideoList';
import {RelatedVideoList} from './RelatedVideoList';
import {NicoSearchApiV2Loader} from '../../../lib/src/nico/VideoSearch';
import {PlayListSession} from './PlayListSession';
import {VideoListView} from './VideoListView';
import {PlayListView} from './PlayListView';

import {textUtil} from '../../../lib/src/text/textUtil';
import {PlaylistApiLoader} from '../../../lib/src/nico/PlaylistApiLoader';
import {MylistApiLoader} from '../../../lib/src/nico/MylistApiLoader';
//===BEGIN===
//@require VideoListItem
//@require VideoListModel
//@require VideoListItemView
//@require PlayListModel
//@require VideoList
//@require RelatedVideoList
//@require PlayListSession
//@require VideoListView
//@require PlayListView

class PlayList extends VideoList {
  initialize(params) {
    this._thumbInfoLoader = params.loader || global.api.ThumbInfoLoader;
    this._container = params.container;

    this._index = -1;
    this._isEnable = false;
    this._isLoop = params.loop;

    this.model = new PlayListModel({});

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
  serialize() {
    return {
      items: this.model.serialize(),
      index: this._index,
      enable: this._isEnable,
      loop: this._isLoop
    };
  }
  unserialize(data) {
    if (!data) {
      return;
    }
    this._initializeView();
    console.log('unserialize: ', data);
    this.model.unserialize(data.items);
    this._isEnable = data.enable;
    this._isLoop = data.loop;
    this.emit('update');
    this.setIndex(data.index);
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
  _onCommand(command, param, itemId) {
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
        this.model.reverse();
        break;
      case 'sortBy': {
        let [key, order] = param.split(':');
        this.sortBy(key, order === 'desc');
        break;
      }
      case 'clear':
        this._setItemData([]);
        break;
      case 'select':
        item = this.model.findByItemId(itemId);
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

    const blob = new Blob([data], {'type': 'text/html'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, {
      download: title + '.playlist.json',
      rel: 'noopener',
      href: url
    });
    document.body.append(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  }
  _onImportFileCommand(fileData) {
    if (!textUtil.isValidJson(fileData)) {
      return;
    }

    this.emit('command', 'pause');
    this.emit('command', 'notify', 'プレイリストを復元');
    this.unserialize(JSON.parse(fileData));

    window.setTimeout(() => {
      const index = Math.max(0, fileData.index || 0);
      const item = this.model.getItemByIndex(index);
      if (item) {
        this.setIndex(index, true);
        this.emit('command', 'openNow', item.watchId);
      }
    }, 2000);
  }
  _onMoveItem(fromItemId, toItemId) {
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
  _setItemData(listData) {
    const items = listData.map(itemData => new VideoListItem(itemData));
    this.model.setItem(items);
    this.setIndex(items.length > 0 ? 0 : -1);
  }
  _replaceAll(videoListItems, options) {
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
  _appendAll(videoListItems, options) {
    options = options || {};
    const before = this.model.items.length;
    this.model.appendItem(videoListItems);
    const added = this.model.items.length - before;
    const item = this.model.findByWatchId(options.watchId);
    if (item) {
      item.isActive = true;
      item.isPlayed = true;
      this._refreshIndex(false);
    }
    setTimeout(() => this.view.scrollToItem(videoListItems[0]), 1000);
    return added;
  }
  _insertAll(videoListItems, options) {
    options = options || {};

    const before = this.model.items.length;
    this.model.insertItem(
      videoListItems,
      this.getIndex() + 1);
    const added = this.model.items.length - before;
    const item = this.model.findByWatchId(options.watchId);
    if (item) {
      item.isActive = true;
      item.isPlayed = true;
      this._refreshIndex(false);
    }
    setTimeout(() => this.view.scrollToItem(videoListItems[0]), 1000);
    return added;
  }
  replaceItems(videoListItemsRawData, options) {
    const items = videoListItemsRawData.map(raw => new VideoListItem(raw));
    return this._replaceAll(items, options);
  }
  appendItems(videoListItemsRawData, options) {
    const items = videoListItemsRawData.map(raw => new VideoListItem(raw));
    return this._appendAll(items, options);
  }
  insertItems(videoListItemsRawData, options) {
    const items = videoListItemsRawData.map(raw => new VideoListItem(raw));
    return this._insertAll(items, options);
  }
  load(playlist, options, msgInfo) {
    this._initializeView();

    if (!this._playlistApiLoader) {
      this._playlistApiLoader = PlaylistApiLoader;
    }
    const timeKey = `loadPlaylist: ${playlist.type} ${playlist.id || playlist.options.tag || playlist.options.keyword}`;
    window.console.time(timeKey);

    return this._playlistApiLoader
      .load(playlist, msgInfo).then(items => {
        window.console.timeEnd(timeKey);
        let videoListItems = items.map(item => VideoListItem.createByMylistItem(item));

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

        let added = null;
        if (options.insert) {
          added = this._insertAll(videoListItems, options);
        } else if (options.append) {
          added = this._appendAll(videoListItems, options);
        } else {
          this._replaceAll(videoListItems, options);
        }

        this.emit('update');
        // Task 041: 1件も増えなかった場合は、そうと分かるメッセージにする
        // （全部すでにプレイリストに入っていた、という状況を利用者が
        //   区別できないと「壊れている」ようにしか見えないため）。
        if (added === 0) {
          return Promise.resolve({
            status: 'ok',
            message: `追加できる動画がありませんでした（${videoListItems.length}件すべて既にプレイリストにあります）`
          });
        }
        return Promise.resolve({
          status: 'ok',
          message:
            added !== null ?
              `プレイリストに${added}件追加しました` :
              'プレイリストに読み込みしました'
        });
      });
  }
  /**
   * Task 073: 検索でプレイリストに読み込む最大件数（設定 search.limit）を安全な範囲に丸める。
   * 数値以外・古い設定値でも壊れないよう、必ず SEARCH_LIMIT_MIN〜SEARCH_LIMIT_MAX に収める。
   */
  static normalizeSearchLimit(value) {
    const n = parseInt(value, 10);
    if (!isFinite(n) || n <= 0) {
      return PlayList.SEARCH_LIMIT_DEFAULT;
    }
    return Math.min(Math.max(n, PlayList.SEARCH_LIMIT_MIN), PlayList.SEARCH_LIMIT_MAX);
  }
  loadSearchVideo(word, options, limit = PlayList.SEARCH_LIMIT_DEFAULT) {
    this._initializeView();
    limit = PlayList.normalizeSearchLimit(limit);

    if (!this._nicoSearchApiLoader) {
      this._nicoSearchApiLoader = NicoSearchApiV2Loader;
    }

    // Task 074: 同じ語の検索が並行して走るとconsole.timeのラベルが重複して警告になるため、番号を付ける
    const timerLabel = `loadSearchVideos${word} #${PlayList._searchSeq = (PlayList._searchSeq || 0) + 1}`;
    window.console.time(timerLabel);
    options = options || {};

    // Task 067: 検索は NicoSearchApiV2Loader.searchMore() 側で本家と同じ検索API(nvapi)を
    // 使うようになったため、Task 066で追加した「0件の時にnvapiで取り直す」処理は撤去した
    // （同じ条件で同じAPIをもう一度呼ぶだけになるため）。
    const loadItems = async () => {
      const result = await this._nicoSearchApiLoader.searchMore(word, options, limit);
      const items = (result && result.list) || [];
      return items
        .filter(item => {
          return (item.item_data &&
            parseInt(item.item_data.deleted, 10) === 0) ||
            (item.thumbnail_url || '').indexOf('video_deleted') < 0;
        }).map(item => VideoListItem.createByMylistItem(item));
    };

    return loadItems().then(videoListItems => {
        window.console.timeEnd(timerLabel);

        if (videoListItems.length < 1) {
          return Promise.reject({});
        }

        if (options.playlistSort) {
          // 連続再生のために結果を古い順に並べる
          // 検索対象のソート順とは別
          videoListItems = _.sortBy(
            videoListItems, item =>  item.postedAt + item.sortTitle);
        }

        if (options.shuffle) {
          videoListItems = _.shuffle(videoListItems);
        }

        let added = null;
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
            added !== null ?
              `検索結果を${added}件プレイリストに追加しました` :
              '検索結果をプレイリストに読み込みしました'
        });
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
  async appendWatchIds(watchIds, options = {}) {
    this._initializeView();
    if (!Array.isArray(watchIds) || !watchIds.length) {
      return 0;
    }
    const loadOne = watchId =>
      this._thumbInfoLoader.load(watchId).then(info => {
        // APIにwatchIdを指定してもvideoIdが返るので上書きする. バッドノウハウ
        info.id = watchId;
        return VideoListItem.createByThumbInfo(info);
      }).catch(() => VideoListItem.createBlankInfo(watchId));

    // 一度に全部投げると、数十件・数百件の時にAPIへ一気に負荷をかけてしまう。
    // 並列数を絞って順に処理する（Task 044）。
    // 並び順は watchIds の通りに保つ必要があるので、結果は添字で書き戻す。
    const CONCURRENCY = 8;
    const items = new Array(watchIds.length);
    for (let i = 0; i < watchIds.length; i += CONCURRENCY) {
      const chunk = watchIds.slice(i, i + CONCURRENCY);
      const loaded = await Promise.all(chunk.map(loadOne));
      loaded.forEach((item, j) => { items[i + j] = item; });
    }

    const added = options.insert ?
      this._insertAll(items, options) : this._appendAll(items, options);
    this.emit('update');
    return added;
  }
  insert(watchId) {
    this._initializeView();
    if (this._activeItem && this._activeItem.watchId === watchId) {
      return Promise.resolve();
    }

    const model = this.model;
    const index = this._index;
    return this._thumbInfoLoader.load(watchId).then(info => {
      // APIにwatchIdを指定してもvideoIdが返るので上書きする. バッドノウハウ
      // チャンネル動画はsoXXXXに統一したいのでvideoIdを使う. バッドノウハウ
      info.id = info.isChannel ? info.id : watchId;
      const item = VideoListItem.createByThumbInfo(info);
      model.insertItem(item, index + 1);
      this._refreshIndex(true);

      this.emit('update');

      this.emit('command', 'notifyHtml',
        `次に再生: <img src="${item.thumbnail}" style="width: 96px;">${textUtil.escapeToZenkaku(item.title)}`
      );
    }).catch(result => {
      const item = VideoListItem.createBlankInfo(watchId);
      model.insertItem(item, index + 1);
      this._refreshIndex(true);

      this.emit('update');

      window.console.error(result);
      this.emit('command', 'alert', `動画情報の取得に失敗: ${watchId}`);
    });
  }
  insertCurrentVideo(videoInfo) {
    this._initializeView();

    if (this._activeItem &&
      !this._activeItem.isBlankData &&
      this._activeItem.watchId === videoInfo.watchId) {
      this._activeItem.updateByVideoInfo(videoInfo);
      this._activeItem.isPlayed = true;
      this.scrollToActiveItem();
      return;
    }

    let currentItem = this.model.findByWatchId(videoInfo.watchId);
    if (currentItem && !currentItem.isBlankData) {
      currentItem.updateByVideoInfo(videoInfo);
      currentItem.isPlayed = true;
      this.setIndex(this.model.indexOf(currentItem));
      this.scrollToActiveItem();
      return;
    }

    const item = VideoListItem.createByVideoInfoModel(videoInfo);
    item.isPlayed = true;
    if (this._activeItem) {
      this._activeItem.isActive = false;
    }
    this.model.insertItem(item, this._index + 1);
    this._activeItem = this.model.findByItemId(item.itemId);
    this._refreshIndex(true);
  }
  removeItemByWatchId(watchId) {
    const item = this.model.findByWatchId(watchId);
    if (!item || item.isActive) {
      return;
    }
    this.model.removeItem(item);
    this._refreshIndex(true);
  }
  append(watchId) {
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
      this._refreshIndex();

      window.console.error(result);
      this.emit('command', 'alert', '動画情報の取得に失敗: ' + watchId);
    });
  }
  getIndex() {
    return this._activeItem ? this._index : -1;
  }
  setIndex(v, force) {
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
  _refreshIndex(scrollToActive) {
    this.setIndex(this.model.indexOf(this._activeItem), true);
    if (scrollToActive) {
      setTimeout(() => this.scrollToActiveItem(true), 1000);
    }
  }
  _setIndexByItemId(itemId) {
    const item = this.model.findByItemId(itemId);
    if (item) {
      this._setIndexByItem(item);
    }
  }
  _setIndexByItem(item) {
    const index = this.model.indexOf(item);
    if (index >= 0) {
      this.setIndex(index);
    }
  }
  toggleEnable(v) {
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
  sortBy(key, isDesc) {
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
  scrollToActiveItem(force) {
    if (this._activeItem && (force || !this.view.hasFocus)) {
      this.view.scrollToItem(this._activeItem, force);
    }
  }
  scrollToWatchId(watchId) {
    const item = this.model.findByWatchId(watchId);
    if (item) {
      this.view.scrollToItem(item);
    }
  }
  findByWatchId(watchId) {
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
PlayList.SEARCH_LIMIT_DEFAULT = 300;
PlayList.SEARCH_LIMIT_MIN = 100;
PlayList.SEARCH_LIMIT_MAX = 5000;
//===END===

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
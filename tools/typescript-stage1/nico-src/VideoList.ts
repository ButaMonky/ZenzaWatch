/**
 * Canonical TypeScript source for packages/zenza/src/Playlist/VideoList.js (Task852).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
/** The parts of Emitter, VideoListModel/View, bounce and the loaders used here. */
declare class Emitter {
  on(name: string, callback: (...args: Loose[]) => unknown): this;
  emit(name: string, ...args: unknown[]): unknown;
}
declare const VideoListModel: new (params: {uniq?: boolean; maxItems?: number}) => Loose;
declare const VideoListView: new (params: Loose) => Loose;
declare const bounce: {time<F extends (...args: never[]) => unknown>(func: F, ms: number): F};
declare const ThumbInfoLoader: Loose;
declare const AdDecorationLoader: {
  load(watchIds: string[]): Promise<Map<string, string>>;
  loadFresh(watchIds: string[], onProgress: (p: {checked: number; total: number}) => void): Promise<Map<string, string>>;
};

class VideoList extends Emitter {
  declare _adDecorationLoader: typeof AdDecorationLoader;
  declare _adDecorationRequested: Set<string>;
  declare _container: Loose;
  declare _debugAdDecorationChecked: Set<string>;
  declare _isAdDecorationEnabled: boolean;
  declare _isDebugAdDecorationCheckEnabled: boolean;
  declare _thumbInfoLoader: Loose;
  declare _watchId: Loose;
  declare model: {items: Loose[]; on(name: string, callback: (...args: Loose[]) => unknown): unknown; findByItemId(id: unknown): Loose; findByWatchId(id: unknown): Loose; setItemData(data: unknown): void};
  declare view: Loose;
  constructor(...args: Loose[]) {
    super();
    this.initialize(...(args as [Loose]));
  }
  initialize(params: Loose) {
    this._thumbInfoLoader = params.loader || ThumbInfoLoader;
    this._container = params.container;

    this.model = new VideoListModel({
      uniq: true,
      maxItems: 100
    });

    // Task 054: 広告(ニコニ広告)の金冠・銀冠をサムネイルに表示する。
    // VideoListを継承する全クラス(PlayList・RelatedVideoList等)で共通して
    // 使えるよう、基底クラス側に置く。PlayListはinitialize()自体を完全に
    // 上書きしているため、そちらでも明示的にこのメソッドを呼んでいる。
    this._initializeAdDecoration(params);

    this._initializeView();
  }
  _initializeAdDecoration(params: Loose) {
    this._isAdDecorationEnabled = params.enableAdDecoration !== false;
    this._adDecorationLoader = params.adDecorationLoader || AdDecorationLoader;
    this._adDecorationRequested = new Set();
    // PlayList自身の'update'イベント（明示的にthis.emit('update')した時だけ
    // 発火）ではなく、model側の'update'イベント（setItem/insertItem/
    // appendItem等、一覧が変わる操作すべてで確実に発火する）を基準にする。
    // 検索・シリーズ・投稿者一覧・コンテンツツリー・シャッフル等、動画一覧が
    // 変わる操作は最終的にすべてこのmodelのいずれかのメソッドを呼ぶため、
    // 「操作ごとに個別対応」ではなく「一覧が変わったら都度チェック」という
    // 形に統一している（Task 054への実機フィードバックを受けての方針）。
    // item.adDecorationをセットした時もmodel側の'update'が再度発火するが、
    // その時点では対象アイテムのadDecorationが非nullになっているため
    // フィルタで除外され、無限ループにはならない。
    this.model.on('update', this._onAdDecorationCheck.bind(this));

    // Task 055: デバッグ用の全件チェック。仕組みは分離してある（後述）。
    this._initializeDebugAdDecorationCheck(params);
  }
  _onAdDecorationCheck() {
    if (!this._isAdDecorationEnabled) {
      return;
    }
    const targets = this.model.items.filter(item =>
      item.adDecoration == null && !this._adDecorationRequested.has(item.watchId));
    if (!targets.length) {
      return;
    }

    targets.forEach(item => this._adDecorationRequested.add(item.watchId));
    const watchIds = targets.map(item => item.watchId);
    this._adDecorationLoader.load(watchIds).then(resultMap => {
      targets.forEach(item => {
        // 成功・失敗に関わらず、ここで「リクエスト中」状態を解除する。
        // 同じwatchIdのitemが通信中に置き換わっている可能性があるため、
        // 結果はrequest開始時のitemではなく現在modelに属するitemへ適用する。
        const watchId = item.watchId;
        this._adDecorationRequested.delete(watchId);
        const currentItem = this.model.findByWatchId(watchId);
        if (currentItem && resultMap.has(watchId)) {
          currentItem.adDecoration = resultMap.get(watchId);
        }
        // 取得できなかった分(通信失敗等)はadDecorationがnullのままなので、
        // 次回の一覧更新時にfilter条件(item.adDecoration == null)により
        // 自然にまたtargetsへ含まれる。
      });
    }).catch(e => {
      window.console.warn('広告装飾の取得に失敗', e);
      targets.forEach(item => this._adDecorationRequested.delete(item.watchId));
    });
  }

  /**
   * Task 055: デバッグ機能。「読み込んだ動画が本当に広告(金冠・銀冠)が
   * 付いているのか・いないのかを、キャッシュを経由せず都度サーバーへ
   * 問い合わせ直して確認し、Zenza側の表示とズレていないかコンソールへ
   * 出力する」という要望への対応。
   *
   * 非常に重い処理（一覧の全件について毎回サーバーに問い合わせる）ため、
   * 既定はOFF。設定の「デバッグモード」がONの時だけ、さらにこの専用設定
   * (debugCheckAdDecoration)がONの時だけ動く。
   *
   * 将来消しやすいよう、他の処理には一切依存させず、専用のフラグ・専用の
   * Set・専用のメソッド2つ・AdDecorationLoader.loadFresh()にすべて閉じて
   * ある。消す時は次の5箇所を削除するだけでよい。
   *   - このメソッド呼び出し(_initializeAdDecoration内の1行)
   *   - _initializeDebugAdDecorationCheck() / _onDebugAdDecorationCheck()
   *   - AdDecorationLoader.loadFresh()
   *   - Config.jsのdebugCheckAdDecorationキー
   *   - _setting.jsの対応するチェックボックス(debugOnly内)
   */
  _initializeDebugAdDecorationCheck(params: Loose) {
    this._isDebugAdDecorationCheckEnabled = !!params.debugCheckAdDecoration;
    if (!this._isDebugAdDecorationCheckEnabled) {
      return;
    }
    this._debugAdDecorationChecked = new Set();
    this.model.on('update', this._onDebugAdDecorationCheck.bind(this));
    window.console.info(
      '[Task055デバッグ] 広告装飾の全件チェックが有効です。一覧が変わるたび、' +
      '表示中の全動画をキャッシュ無しで再確認します(重い処理です)。');
  }
  _onDebugAdDecorationCheck() {
    const targets = this.model.items.filter(item =>
      !this._debugAdDecorationChecked.has(item.watchId));
    if (!targets.length) {
      return;
    }
    targets.forEach(item => this._debugAdDecorationChecked.add(item.watchId));

    const watchIds = targets.map(item => item.watchId);
    const total = watchIds.length;
    const startedAt = Date.now();
    window.console.info(
      `[Task055デバッグ] 広告装飾チェック開始: ${total}件をキャッシュ無しで再確認します（時間がかかります）...`);
    const onProgress = ({checked, total: progressTotal}: {checked: number; total: number}) => {
      window.console.info(`[Task055デバッグ] 進捗: ${checked}/${progressTotal}件`);
    };

    this._adDecorationLoader.loadFresh(watchIds, onProgress).then(freshMap => {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const rows = targets.map((item: Loose) => {
        const hasFresh = freshMap.has(item.watchId);
        const actual = hasFresh ? freshMap.get(item.watchId) : '(取得失敗)';
        // Zenza側がまだ本体の非同期チェック(_onAdDecorationCheck)を
        // 終えていないだけの項目(item.adDecoration == null)は、
        // 「不具合によるズレ」ではなく「単に未確認」なので区別する。
        // これを区別せず「値が違う」とだけ見ると、一覧の読み込み直後は
        // ほぼ全件が(まだ本体側の通信が終わっていないという理由だけで)
        // 「ズレ」として出てしまい、本当の不具合と見分けがつかなくなる。
        const isPending = item.adDecoration == null;
        const zenza = isPending ? '(未取得)' : item.adDecoration;
        const isRealMismatch = hasFresh && !isPending && zenza !== actual;
        let status: string;
        if (isRealMismatch) {
          status = 'ズレ';
        } else if (isPending) {
          status = '未取得(本体側が未チェック)';
        } else if (!hasFresh) {
          status = '取得失敗';
        } else {
          status = '一致';
        }
        return {
          watchId: item.watchId,
          title: item.title,
          zenzaの表示: zenza,
          サーバーの実際の値: actual,
          状態: status,
          ズレ: isRealMismatch
        };
      });
      const mismatches = rows.filter(row => row.ズレ);
      const pending = rows.filter(row => row.状態 === '未取得(本体側が未チェック)');

      window.console.groupCollapsed(
        `[Task055デバッグ] 広告装飾チェック完了: ${targets.length}件中 ` +
        `本当のズレ${mismatches.length}件・未取得${pending.length}件 (${elapsedSec}秒)`);
      window.console.table(rows);
      if (mismatches.length) {
        window.console.warn('ズレのある項目(表示中の値が実際の値と食い違っている):', mismatches);
      }
      if (pending.length) {
        window.console.info(
          `未取得${pending.length}件は、本体側の確認がまだ終わっていない（不具合ではない）` +
          '可能性があります。しばらく待ってから一覧を読み込み直すと再チェックされます。');
      }
      window.console.groupEnd();
    }).catch(e => {
      window.console.warn('[Task055デバッグ] 広告装飾の全件チェックに失敗', e);
      targets.forEach(item => this._debugAdDecorationChecked.delete(item.watchId));
    });
  }
  _initializeView() {
    if (this.view) {
      return;
    }
    this.view = new VideoListView({
      container: this._container,
      model: this.model,
      enablePocketWatch: true
    });

    this.view.on('command', this._onCommand.bind(this));
    this.view.on('deflistAdd', bounce.time(this._onDeflistAdd.bind(this), 300));
    this.view.on('playlistAppend', bounce.time(this._onPlaylistAppend.bind(this), 300));
  }
  update(listData: Loose, watchId: Loose) {
    if (!this.view) {
      this._initializeView();
    }
    this._watchId = watchId;
    this.model.setItemData(listData);
  }
  _onCommand(command: Loose, param: Loose): Loose {
    if (command !== 'select') {
      return this.emit('command', command, param);
    }
    const item = this.model.findByItemId(param);
    if (!item) {
      return;
    }
    const watchId = item.watchId;
    this.emit('command', 'open', watchId);
  }
  _onPlaylistAppend(watchId: Loose, itemId: Loose) {
    this.emit('command', 'playlistAppend', watchId);
    const item = this.model.findByItemId(itemId) || this.model.findByWatchId(watchId);
    if (!item) { return; }
    item.isUpdating = true;
    window.setTimeout(() => item.isUpdating = false, 1000);
  }
  _onDeflistAdd(watchId: Loose, itemId: Loose) {
    this.emit('command', 'deflistAdd', watchId);
    const item = this.model.findByItemId(itemId);
    if (!item) { return; }
    item.isUpdating = true;
    window.setTimeout(() => item.isUpdating = false, 1000);
  }
}

export {VideoList};

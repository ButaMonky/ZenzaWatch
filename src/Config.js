// import {PRODUCT} from './ZenzaWatchIndex';
const PRODUCT = 'ZenzaWatch';
import { DataStorage } from '../packages/lib/src/infra/DataStorage';
import { buildDefaultKeyConfig } from '../packages/zenza/src/ShortcutActions';

const location = {host: 'www.nicovideo.jp'};
const navigator = {};
const window = {console: console};
// let console = window.console;

//===BEGIN===
//@require ../packages/lib/src/infra/StorageWriter.js
//@require ../packages/lib/src/infra/objUtil.js
//@require ../packages/lib/src/infra/DataStorage.js
//@require buildDefaultKeyConfig
const Config = (() => {
  const DEFAULT_CONFIG = {
    debug: false,
    volume: 0.3,
    showComment: true,
    autoPlay: true,
    'autoPlay:ginza': true,
    'autoPlay:others': true,
    enableResume: false,
    loop: false,
    mute: false,
    screenMode: 'normal',
    'screenMode:ginza': 'normal',
    'screenMode:others': 'normal',
    autoFullScreen: false,
    autoCloseFullScreen: true, // 再生終了時に自動でフルスクリーン解除するかどうか
    continueNextPage: false,   // 動画再生中にリロードやページ切り替えしたら続きから開き直す
    backComment: false,        // コメントの裏流し
    autoPauseCommentInput: true, // コメント入力時に自動停止する
    sharedNgLevel: 'MID',      // NG共有の強度 NONE, LOW, MID, HIGH, MAX
    enablePushState: true,     // ブラウザの履歴に乗せる
    enableHeatMap: true,
    enableCommentPreview: false,
    enableAutoMylistComment: false, // マイリストコメントに投稿者を入れる
    menuScale: 1.0,
    enableTogglePlayOnClick: false, // 画面クリック時に再生/一時停止するかどうか
    enableDblclickClose: true, //
    smallModeOffsetX: 0, // 画面モード「小」の位置オフセットX(px)。ドラッグで動かした位置を記憶する
    smallModeOffsetY: 0, // 画面モード「小」の位置オフセットY(px)
    smallModeWidth: 0,   // 画面モード「小」の幅(px)。0 = 既定値(SIDE_PLAYER_WIDTH)を使用
    smallModeHeight: 0,  // 画面モード「小」の高さ(px)。0 = 既定値(SIDE_PLAYER_HEIGHT)を使用
    smallModeAspectLock: false, // 画面モード「小」のリサイズ時にアスペクト比を固定するか
    enableFullScreenOnDoubleClick: true,
    enableStoryboard: true, // シークバーサムネイル関連
    enableStoryboardBar: false, // シーンサーチ
    videoInfoPanelTab: 'videoInfoTab',
    fullscreenControlBarMode: 'auto', // 'always-show' 'always-hide'

    // Task 063: 以前は`forceEnable`という名前でここに定義されていたが、
    // 実際にコードから読まれていたのは`forceEconomy`という別の名前だった
    // （HoverMenu.js・initializer.jsの2箇所）。このキー自体がDEFAULT_CONFIGに
    // 存在しなかったため、エコノミーモードで強制的に開く機能は常にfalse扱いで
    // 一度も動作していなかった。正しい名前で復活させた（上級設定監査で発見）。
    forceEconomy: false, // 動画を強制的にエコノミーモードで開く(HoverMenu.js/initializer.jsが参照)
    // NG設定
    enableFilter: true,
    wordFilter: '',
    wordRegFilter: '',
    wordRegFilterFlags: 'i',
    userIdFilter: '',
    commandFilter: '',
    removeNgMatchedUser: false, // NGにマッチしたユーザーのコメント全部消す

    'filter.fork0': true, // 通常コメント
    'filter.fork1': true, // 投稿者コメント
    'filter.fork2': true, // かんたんコメント
    'filter.fork3': true, // AIキャラクターコメント

    'filter.defaultThread': true, // 通常コメント
    'filter.ownerThread': true, // 投稿者コメント
    'filter.communityThread': true, // チャンネルコメント / コミュニティコメント
    'filter.nicosThread': true, // ニコスクリプトコメント
    'filter.easyThread': true, // かんたんコメント
    'filter.aiThread': true, // AIキャラクターコメント
    'filter.extraDefaultThread': true, // ***extra-default
    'filter.extraOwnerThread': true, // ***extra-owner
    'filter.extraCommunityThread': true, // 引用コメント
    'filter.extraNicosThread': true, // ***extra-nicos
    'filter.extraEasyThread': true, // 引用かんたんコメント

    videoTagFilter: '',
    videoOwnerFilter: '',

    enableCommentPanel: true,
    enableCommentPanelAutoScroll: true,

    commentSpeedRate: 1.0,
    autoCommentSpeedRate: false,

    playlistLoop: false,
    enableAdDecoration: true, // プレイリストに広告の金冠・銀冠枠を表示する(Task 054)
    // Task 055: デバッグ用。読み込み済みの全動画について、都度サーバーへ
    // 問い合わせ直して広告装飾の表示がズレていないか確認し、コンソールへ
    // 出力する（重い処理なので既定はOFF。デバッグモード時のみ設定に表示）。
    debugCheckAdDecoration: false,
    commentLanguage: 'ja-jp',

    baseFontFamily: '',
    baseChatScale: 1.0,
    baseFontBolder: true,
    cssFontWeight: 'bold',

    allowOtherDomain: true,

    overrideWatchLink: false, // すべての動画リンクをZenzaWatchで開く
    'overrideWatchLink:others': false, // すべての動画リンクをZenzaWatchで開く

    speakLark: false, // 一発ネタのコメント読み上げ機能. 飽きたら消す
    speakLarkVolume: 1.0, // 一発ネタのコメント読み上げ機能. 飽きたら消す


    // enableCommentLayoutWorker: true, // コメントの配置計算を一部マルチスレッド化(テスト中)

    enableSingleton: false,

    // 無料期間の過ぎた動画と同じのがdアニメにあったら、
    // コメントはそのままに映像だけ持ってくる (当然ながらdアニメ加入は必要)
    loadLinkedChannelVideo: false,

    commentLayerOpacity: 1.0, //
    'commentLayer.textShadowType': '', // フォントの修飾タイプ
    'commentLayer.enableSlotLayoutEmulation': false,
    'commentLayer.ownerCommentShadowColor': '#008800', // 投稿者コメントの影の色
    'commentLayer.easyCommentOpacity': 0.5, // かんたんコメントの透明度
    'commentLayer.aiCommentOpacity': 0.5, // かんたんコメントの透明度

    overrideGinza: false,     // 動画視聴ページでもGinzaの代わりに起動する
    enableGinzaSlayer: false, // まだ実験中
    lastPlayerId: '',
    playbackRate: 1.0,
    lastWatchId: 'sm9',
    message: '',

    enableVideoSession: true,
    videoServerType: 'dmc',
    // enableDmc: true, // 新サーバーを使うかどうか
    // autoDisableDmc: true, // smileのほうが高画質と思われる動画でdmcを無効にする
    autoDisableNew: true, // dmcのほうが高画質と思われる動画でdomandを無効にする
    dmcVideoQuality: 'auto',   // 優先する画質 auto, veryhigh, high, mid, low
    domandVideoQuality: 'auto', // 優先する画質 auto, 1080p, 720, 480p, 360p, 144p
    // smileVideoQuality: 'default', // default eco
    // useWellKnownPort: false, // この機能なくなったぽい (常時true相当になった)
    // Task 063: 'video.hls.enable'と'video.hls.segmentDuration'は、コード上の
    // どこからも参照されていないことを確認したため削除した（実際にHLS切り替えの
    // 判定に使われているのは'video.hls.enableOnlyRequired'のみ）。
    'video.hls.enableOnlyRequired': true, // hlsが必須の動画だけ有効化する

    enableNicosJumpVideo: true, // @ジャンプを有効にするかどうか
    'videoSearch.ownerOnly': false, // Task 073: 検索欄を開くたびにOFFへ戻す（VideoSearchForm）
    'videoSearch.mode': 'tag',
    'videoSearch.order': 'desc',
    'videoSearch.sort': 'playlist',
    'videoSearch.word': '',
    // Task 068: 検索パネルの絞り込み（本家の検索と同じ。0/'all'は指定なし）
    'videoSearch.f_range': 0,
    'videoSearch.l_range': 0,
    'videoSearch.genre': 'all',
    // Task 072: sm〜等の動画IDを入力した時の、タグ予測と動画カードの表示方式
    //   'merged'  … A: 1つの一覧に「検索行→タグ予測→動画カード」の順でまとめる
    //   'side'    … B: 左にタグ予測、右に動画カードを並べる
    //   'delayed' … C: まずタグ予測だけ出し、入力が止まってから動画カードを追加する
    'videoSearch.videoIdSuggestMode': 'merged',
    // Task 072: 動画ヘッダー（タイトル・タグ欄）の表示位置（通常/大モード）
    //   'auto'            … 従来通り。動画の上に収まる時は外に、はみ出す時は動画に重ねて自動で隠す
    //   'outside'         … 常に動画の外（上）に表示。はみ出す時は画面上端に合わせてずらす（隠れない）
    //   'overlay'         … 常に動画に重ねて表示し、マウスを動かした時だけ表示（自動で隠す）
    //   'overlay-visible' … 常に動画に重ねて表示し、隠さない
    'videoHeader.position': 'auto',

    'uaa.enable': true,

    // Task 074: 本家と同じ「音声の自動調整」。動画ごとの音量差を小さくする
    // （視聴JSONの音量倍率を、ユーザーが決めた音量に掛ける）
    'audio.autoAdjust': false, // 既定はOFF（ONにすると音が大きい動画だけ音量が下がる）

    // Task 080: 動画の最後に流れる「提供」画面（ニコニ広告・ギフトの支援者クレジット）
    // （packages/zenza/src/videoPlayer/SupporterCredit.js）
    'supporterCredit.enable': true,       // 提供画面を表示する
    'supporterCredit.voice': true,        // 提供音声（期間ごとに変わる読み上げ）を鳴らす
    'supporterCredit.gift': true,         // ギフトが落ちてくる演出を表示する
    'supporterCredit.skipInPlaylist': false, // 連続再生中は表示しない

    // Task 077: 画面フィルター（packages/zenza/src/videoPlayer/ScreenFilter.js）。
    // 全部の動画で共通の設定（動画ごとには覚えない）。値の意味・範囲は ScreenFilter.PARAMS 参照。
    // Task 080: 「使う」は廃止（標準＝OFF、それ以外は自動でON）。旧設定の移行にだけ使う
    'screenFilter.enable': true,
    // Task 080: ON/OFFショートカットで「標準」にした時の、直前の値（JSON）
    'screenFilter.saved': '',
    'screenFilter.brightness': 100,     // 明るさ(%)
    'screenFilter.contrast': 100,       // コントラスト(%)
    'screenFilter.saturate': 100,       // 彩度(%)
    'screenFilter.sepia': 0,            // 暖色(%)
    'screenFilter.hue': 0,              // 色相(度)
    'screenFilter.blur': 0,             // ぼかし(px)
    'screenFilter.invert': false,       // 階調反転
    'screenFilter.gamma': 1.0,          // ガンマ
    'screenFilter.blackLevel': 0,       // 黒レベル（SVGフィルター）
    'screenFilter.whiteLevel': 0,       // 白レベル（SVGフィルター）
    'screenFilter.sharpen': 0,          // シャープ（SVGフィルター）
    // Task 077c: 追加した項目
    'screenFilter.temperature': 0,      // 色温度（-100 青〜+100 橙）
    'screenFilter.tint': 0,             // 色かぶり補正（-100 緑〜+100 赤紫）
    'screenFilter.autoLevels': false,   // 自動レベル補正
    'screenFilter.vignette': 0,         // 周辺減光(%)
    'screenFilter.colorize': 'none',    // 着色（none/gold/sepia/blue/green）
    'screenFilter.flipH': false,        // 左右反転（旧 toggle-flipH。ページを開き直すとOFFに戻る）
    'screenFilter.flipV': false,        // 上下反転（旧 toggle-flipV。同上）
    'screenFilter.applyToScreenshot': true, // スクリーンショットにも反映する
    'screenFilter.applyToCommentPip': true, // P in P(コメント付き)にも反映する

    'screenshot.prefix': '', // スクリーンショットのファイル名の先頭につける文字

    // Task 073: 検索でプレイリストに読み込む最大件数。上級者向け設定で変更できる。
    // 100件ごとにAPIを1回呼ぶので多くするほど遅く・重くなる。推奨は1000件まで、上限5000件
    // （本家検索APIの上限。スナップショット検索に切り替わった時は1600件まで）。
    'search.limit': 300,

    //タッチパネルがある場合は null ない場合は undefined になるらしい
    //うちのデスクトップは無いのに null だが…
    'touch.enable': window.ontouchstart !== undefined,
    'touch.tap2command': '',
    'touch.tap3command': 'toggle-mute',
    'touch.tap4command': 'toggle-showComment',
    'touch.tap5command': 'screenShot',

    // Task 063: 'navi.*'(favorite/playlistButtonMode/ownerFilter/lastSearchQuery)は
    // コード上のどこからも参照されていないことを確認したため削除した。build.jsに
    // コメントアウトされたまま残る'_navi.js'（廃止された別のユーザースクリプト
    // 「Navi」向けのビルド対象）の設定の残骸と見られる。

    autoZenTube: false,
    bestZenTube: false,

    KEY_CLOSE: 27,          // ESC
    KEY_RE_OPEN: 27 + 0x1000, // SHIFT + ESC
    KEY_HOME: 36 + 0x1000, // SHIFT + HOME

    KEY_SEEK_LEFT: 37 + 0x1000, // SHIFT + LEFT
    KEY_SEEK_RIGHT: 39 + 0x1000, // SHIFT + RIGHT
    // Task 065: KEY_SEEK_LEFT2 / KEY_SEEK_RIGHT2 (「カスタマイズ用の予備
    // スロット」2個のみ・秒数を変更する手段が無かった)はここから削除した。
    // 後継のCUSTOM_SEEK_1〜10(10個・秒数を自由入力可能)は、
    // packages/zenza/src/ShortcutActions.js側のbuildDefaultKeyConfig()に
    // よってKEY_CUSTOM_SEEK_1〜10の既定値(0=未設定)が自動的にここへ
    // マージされるため、このDEFAULT_CONFIGへ個別に書く必要はない。
    // 秒数側の既定値(PARAM_CUSTOM_SEEK_1〜10)は下のTask 065ブロック参照。
    // 1/60秒戻る・進む  本当は1コマ単位の移動にしたいが動画のフレームレートを取得できないため
    KEY_SEEK_PREV_FRAME: 188, // ,
    KEY_SEEK_NEXT_FRAME: 190, // .

    KEY_VOL_UP: 38 + 0x1000, // SHIFT + UP
    KEY_VOL_DOWN: 40 + 0x1000, // SHIFT + DOWN

    KEY_INPUT_COMMENT: 67, // C
    KEY_FULLSCREEN: 70, // F
    KEY_MUTE: 77, // M
    KEY_TOGGLE_COMMENT: 86, // V

    KEY_TOGGLE_LOOP: 82, // R 76, // L

    KEY_DEFLIST_ADD: 84,          // T
    KEY_DEFLIST_REMOVE: 84 + 0x1000, // SHIFT + T

    KEY_TOGGLE_PLAY: 32, // SPACE
    KEY_TOGGLE_PLAYLIST: 80, // P

    KEY_SCREEN_MODE_1: 49 + 0x1000, // SHIFT + 1
    KEY_SCREEN_MODE_2: 50 + 0x1000, // SHIFT + 2
    KEY_SCREEN_MODE_3: 51 + 0x1000, // SHIFT + 3
    KEY_SCREEN_MODE_4: 52 + 0x1000, // SHIFT + 4
    KEY_SCREEN_MODE_5: 53 + 0x1000, // SHIFT + 5
    KEY_SCREEN_MODE_6: 54 + 0x1000, // SHIFT + 6

    KEY_SHIFT_RESET: 49, // 1
    KEY_SHIFT_DOWN: 188 + 0x1000, // <
    KEY_SHIFT_UP: 190 + 0x1000, // >

    KEY_NEXT_VIDEO: 74, // J
    KEY_PREV_VIDEO: 75, // K

    KEY_SCREEN_SHOT: 83, // S
    KEY_SCREEN_SHOT_WITH_COMMENT: 83 + 0x1000, // SHIFT + S
  };

  // =====================================================================
  // Task 063: モバイル(Android/iPad/CriOS=iOS版Chrome)向けの既定値上書き、
  // ここに一括でまとめてある。
  //
  // ※ZenzaWatchに専用のモバイル版UIやモバイル向けビルドは存在しない。あくまで
  // 「Tampermonkey等の拡張機能が動くモバイルブラウザでたまたま動かした場合」に、
  // 下記の設定項目だけ既定値が変わる、という程度の対応。各項目は元々デスクトップ
  // 向けの一般設定としてDEFAULT_CONFIGの上の方に定義されているが、このUA判定に
  // よって上書きされる項目だけをここに一覧化しておく（監査時にユーザーから
  // 「モバイル関連の設定が探しにくい」との指摘を受けて追加）。
  //
  //   設定名                      | 通常(デスクトップ)既定値 | モバイルでの既定値
  //   ---------------------------|--------------------------|--------------------
  //   overrideWatchLink          | false                     | true
  //   enableTogglePlayOnClick    | false                     | true
  //   autoFullScreen             | false                     | true
  //   autoCloseFullScreen        | true                      | false
  //   volume                     | 0.3                       | 1.0
  //   uaa.enable                 | true                      | false
  //
  // なお enableVideoSession もここで改めてtrueを代入しているが(表には含めず)、
  // この値自体を実際に参照している箇所がコード中に無いことを2026-09の上級設定
  // 監査で確認済み。削除するか、本来の用途（動画セッション機能自体のON/OFF）
  // として実装するかは今後の検討課題として残す。
  // =====================================================================
  if (navigator &&
    navigator.userAgent &&
    navigator.userAgent.match(/(Android|iPad;|CriOS)/i)) {
    DEFAULT_CONFIG.overrideWatchLink = true;
    DEFAULT_CONFIG.enableTogglePlayOnClick = true;
    DEFAULT_CONFIG.autoFullScreen = true;
    DEFAULT_CONFIG.autoCloseFullScreen = false;
    DEFAULT_CONFIG.volume = 1.0;
    DEFAULT_CONFIG.enableVideoSession = true;
    DEFAULT_CONFIG['uaa.enable'] = false;
  }

  // Task 059: ShortcutActions.js に登録された新しいショートカットキーの
  // 既定値(KEY_*)をここでマージする。buildDefaultKeyConfig()は、上の
  // DEFAULT_CONFIGに既に存在するキー(＝レガシーの29個のショートカット)は
  // 絶対に上書きしない設計になっているため、既存のキー割り当ては一切
  // 変更されない。新しいショートカットを追加する場合は
  // packages/zenza/src/ShortcutActions.js のSHORTCUT_ACTIONS配列に
  // エントリを足すだけでよく、ここを直接編集する必要はない。
  Object.assign(DEFAULT_CONFIG, buildDefaultKeyConfig(DEFAULT_CONFIG));

  // Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10、
  // packages/zenza/src/ShortcutActions.js参照)の「秒数」側の既定値。
  // buildDefaultKeyConfig()が面倒を見るのはKEY_*(キー割り当て)だけなので、
  // PARAM_*(秒数、マイナス=戻る・プラス=進む)はここで個別に用意する。
  // 0 = 未設定(上級者向け設定パネルでは、キーも秒数も両方0のスロットは
  // 「追加」ボタンを押すまで非表示になる)。
  for (let i = 1; i <= 10; i++) {
    DEFAULT_CONFIG['PARAM_CUSTOM_SEEK_' + i] = 0;
  }

  return DataStorage.create(
    DEFAULT_CONFIG,
    {
      prefix: PRODUCT,
      ignoreExportKeys: ['message', 'lastPlayerId', 'lastWatchId', 'debug'],
      readonly: !location || location.host !== 'www.nicovideo.jp',
      storage: localStorage
    }
  );
})();
Config.exportConfig = () => Config.export();
Config.importConfig = v => Config.import(v);
Config.exportToFile = () => {
  const json = Config.exportJson();
  const blob = new Blob([json], {'type': 'text/html'});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    download: `${new Date().toLocaleString().replace(/[:/]/g, '_')}_ZenzaWatch.config.json`,
    rel: 'noopener',
    href: url
  });
  a.click();
};
const NaviConfig = Config;

//===END===


export {
  Config,
  NaviConfig
};

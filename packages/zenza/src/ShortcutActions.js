// Task 059: ショートカットキー設定の中核モジュール。
//
// 「どんなショートカットキーが存在するか」「既定のキーは何か」「押されたら
// 何をするか」を、この1ファイルの配列 SHORTCUT_ACTIONS に集約する。
//
// 【今後、新しい機能・設定を追加するタスクへの恒久的なお願い】
// 新しい設定項目やトグル機能を追加した場合は、原則として必ずこの配列に
// 対応するショートカットキーのエントリも1つ追加すること（既定キーは
// 0 = 未設定のままでよい。ユーザーが設定パネルで自由に割り当てられる
// ようにする、という意味の追加でよい）。追加を忘れないよう、この配列の
// 直前と直後にもコメントで注意書きを置いてある。
//
// 【設計方針】
// - id: 'KEY_' + id という名前でConfig.jsのプロパティに保存される
//   （例: id='TOGGLE_PLAY' なら Config.props.KEY_TOGGLE_PLAY）。
//   これは既存(レガシー)のショートカットキーと完全に同じ命名規則・
//   同じ整数エンコード方式（keyCode + 修飾キーのビットフラグ合算）を
//   踏襲しており、後方互換性を壊さない。
// - legacy: true の項目は、ShortcutKeyEmitter.js の既存のswitch文と
//   NicoVideoPlayerDialog.js の既存のTABLEで「個別に」処理されている
//   既存ショートカット。挙動は一切変更していない（既定キーの値も
//   src/Config.jsの記述と完全に一致させてある）。
// - legacy: false（省略可）の項目は、この配列に登録するだけで
//   自動的に有効になる「汎用ショートカット」。command プロパティに
//   NicoVideoPlayerDialog.execCommand() へそのまま渡すコマンド文字列を
//   指定する。実行対象のコマンドは、既存の execCommand の switch文、
//   または RootDispatcher.js の 'toggle-<設定名>' / 'update-<設定名>'
//   汎用ハンドラで既に処理できるものを選ぶこと（真新しいコマンド文字列を
//   使う場合は、NicoVideoPlayerDialog.js か RootDispatcher.js 側に
//   対応するcaseを1行追加する必要がある。詳細は
//   claude/design-pack/67_TASK_059_SHORTCUT_KEY_SETTINGS.md 参照）。
// - defaultKey: 0 は「既定では未割り当て」を意味する。新しく追加する
//   ショートカットは、既存のキー配置と衝突しないよう、基本的に
//   defaultKey: 0（未設定）から始め、ユーザー自身が上級者向け設定パネルで
//   好きなキーを割り当てる運用にしている（B系のバグ修正と違い、勝手に
//   新しいデフォルトキーバインドを増やすとユーザーの既存の操作感覚と
//   衝突する恐れがあるため）。
//===BEGIN===

// keyCode + 修飾キーのビットフラグ。既存のConfig.js / ShortcutKeyEmitter.js
// と完全に同じ値（後方互換性のため変更禁止）。
const KEY_MOD = {
  SHIFT: 0x1000,
  CTRL: 0x10000,
  ALT: 0x100000,
  META: 0x1000000
};

// KeyboardEvent から、KEY_* 設定値と同じ形式の整数を作る。
// ShortcutKeyEmitter.js（実際のキー判定）と、設定パネルの「キーを記録する」
// UI（_setting.js）の両方から共通で呼ぶことで、計算式が2箇所でズレて
// しまう事故を防ぐ。
const encodeKeyCombo = e => {
  return (e.keyCode || 0) +
    (e.metaKey ? KEY_MOD.META : 0) +
    (e.altKey ? KEY_MOD.ALT : 0) +
    (e.ctrlKey ? KEY_MOD.CTRL : 0) +
    (e.shiftKey ? KEY_MOD.SHIFT : 0);
};

const KEY_NAME_TABLE = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 19: 'Pause', 20: 'CapsLock',
  27: 'Esc', 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
  37: '←', 38: '↑', 39: '→', 40: '↓',
  45: 'Insert', 46: 'Delete',
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
  65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I',
  74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R',
  83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
  106: 'Num*', 107: 'Num+', 109: 'Num-', 110: 'Num.', 111: 'Num/',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
  173: 'Mute', 174: 'VolDown', 175: 'VolUp',
  176: 'MediaNext', 177: 'MediaPrev', 178: 'MediaStop', 179: 'MediaPlay',
  186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`',
  219: '[', 220: '\\', 221: ']', 222: '\''
};
for (let i = 96; i <= 105; i++) { KEY_NAME_TABLE[i] = 'Num' + (i - 96); }

// Config.props.KEY_* に入っている整数値を「Shift + ←」のような
// 人が読める形式の文字列にする（設定パネル表示用）。
const formatKeyCombo = code => {
  code = parseInt(code, 10) || 0;
  if (!code) { return '(未設定)'; }
  // Task 065以前に存在した KEY_SEEK_LEFT2 / KEY_SEEK_RIGHT2 の既定値
  // (99999999、「意図的に未割り当てのカスタマイズ用スロット」を表す特殊値)
  // の名残。両エントリはTask 065でCUSTOM_SEEK_1〜10に置き換えて廃止したが、
  // 過去に保存された設定データが万一残っていても壊れた表示にならないよう
  // このガードだけは念のため残してある。
  if (code >= 90000000) { return '(未割り当て/カスタム値)'; }
  const mods = [];
  let rest = code;
  if (rest >= KEY_MOD.META) { mods.push('Meta'); rest -= KEY_MOD.META; }
  if (rest >= KEY_MOD.ALT) { mods.push('Alt'); rest -= KEY_MOD.ALT; }
  if (rest >= KEY_MOD.CTRL) { mods.push('Ctrl'); rest -= KEY_MOD.CTRL; }
  if (rest >= KEY_MOD.SHIFT) { mods.push('Shift'); rest -= KEY_MOD.SHIFT; }
  mods.push(KEY_NAME_TABLE[rest] || ('#' + rest));
  return mods.join(' + ');
};

// =====================================================================
// ショートカット定義本体。
// ここから下に新しいエントリを追加していく（既存エントリの並び・値は
// 後方互換性のため変更しないこと）。
// =====================================================================
const SHORTCUT_ACTIONS = [
  // ---- 既存(レガシー)ショートカット。挙動・既定キーとも一切変更なし ----
  {id: 'CLOSE', legacy: true, category: 'プレイヤー全般', label: '閉じる',
    defaultKey: 27, command: 'close'},
  // Task 065: 「直前の動画を再度開く」という元のラベルが、プレイリストの
  // 「前の動画」(PREV_VIDEO、下記)と紛らわしく、ユーザーからの不具合報告
  // (「前の動画を開いたら再読み込みしかされない」)の原因になっていた実例が
  // あったため、ラベルのみ明確化した(挙動・既定キーは一切変更していない)。
  // 実際の動作: 動画を開いている間はその動画を再読み込みするだけ(RELOAD_VIDEO
  // と同じ)。動画を閉じている間だけ、最後に見ていた動画を開き直す特殊処理が
  // 別途ある(NicoVideoPlayerDialog._onKeyEvent参照)。
  {id: 'RE_OPEN', legacy: true, category: 'プレイヤー全般',
    label: '今見ている動画を再読み込み(閉じている時は直前に見ていた動画を開く)',
    defaultKey: 27 + KEY_MOD.SHIFT, command: 'reload'},
  {id: 'HOME', legacy: true, category: 'シーク', label: '先頭へシーク',
    defaultKey: 36 + KEY_MOD.SHIFT, command: 'seekTo', param: 0},
  {id: 'SEEK_LEFT', legacy: true, category: 'シーク', label: '5秒戻る(Shift+←/←長押しでも可)',
    defaultKey: 37 + KEY_MOD.SHIFT, command: 'seekBy', param: -5},
  {id: 'SEEK_RIGHT', legacy: true, category: 'シーク', label: '5秒進む(Shift+→/→長押しでも可)',
    defaultKey: 39 + KEY_MOD.SHIFT, command: 'seekBy', param: 5},
  {id: 'SEEK_PREV_FRAME', legacy: true, category: 'シーク', label: '1コマ戻る',
    defaultKey: 188, command: 'seekPrevFrame'},
  {id: 'SEEK_NEXT_FRAME', legacy: true, category: 'シーク', label: '1コマ進む',
    defaultKey: 190, command: 'seekNextFrame'},
  {id: 'VOL_UP', legacy: true, category: '音量', label: '音量を上げる',
    defaultKey: 38 + KEY_MOD.SHIFT, command: 'volumeUp'},
  {id: 'VOL_DOWN', legacy: true, category: '音量', label: '音量を下げる',
    defaultKey: 40 + KEY_MOD.SHIFT, command: 'volumeDown'},
  {id: 'INPUT_COMMENT', legacy: true, category: 'コメント', label: 'コメント入力欄にフォーカス',
    defaultKey: 67, command: '(専用処理)'},
  {id: 'FULLSCREEN', legacy: true, category: '画面', label: 'フルスクリーン ON/OFF',
    defaultKey: 70, command: 'toggle-fullscreen'},
  {id: 'MUTE', legacy: true, category: '音量', label: 'ミュート ON/OFF',
    defaultKey: 77, command: 'toggle-mute'},
  {id: 'TOGGLE_COMMENT', legacy: true, category: 'コメント', label: 'コメント表示 ON/OFF',
    defaultKey: 86, command: 'toggle-showComment'},
  {id: 'TOGGLE_LOOP', legacy: true, category: '再生', label: 'ループ再生 ON/OFF',
    defaultKey: 82, command: 'toggle-loop'},
  {id: 'DEFLIST_ADD', legacy: true, category: 'マイリスト', label: 'とりあえずマイリストへ追加',
    defaultKey: 84, command: 'deflistAdd'},
  {id: 'DEFLIST_REMOVE', legacy: true, category: 'マイリスト', label: 'とりあえずマイリストから削除',
    defaultKey: 84 + KEY_MOD.SHIFT, command: 'deflistRemove'},
  {id: 'TOGGLE_PLAY', legacy: true, category: '再生', label: '再生 / 一時停止',
    defaultKey: 32, command: 'togglePlay'},
  {id: 'TOGGLE_PLAYLIST', legacy: true, category: 'プレイリスト', label: 'プレイリスト表示 ON/OFF',
    defaultKey: 80, command: 'togglePlaylist'},
  {id: 'SCREEN_MODE_1', legacy: true, category: '画面', label: '画面モード: 小',
    defaultKey: 49 + KEY_MOD.SHIFT, command: 'screenMode', param: 'small'},
  {id: 'SCREEN_MODE_2', legacy: true, category: '画面', label: '画面モード: サイドビュー',
    defaultKey: 50 + KEY_MOD.SHIFT, command: 'screenMode', param: 'sideView'},
  {id: 'SCREEN_MODE_3', legacy: true, category: '画面', label: '画面モード: 3D',
    defaultKey: 51 + KEY_MOD.SHIFT, command: 'screenMode', param: '3D'},
  {id: 'SCREEN_MODE_4', legacy: true, category: '画面', label: '画面モード: 通常',
    defaultKey: 52 + KEY_MOD.SHIFT, command: 'screenMode', param: 'normal'},
  {id: 'SCREEN_MODE_5', legacy: true, category: '画面', label: '画面モード: 大',
    defaultKey: 53 + KEY_MOD.SHIFT, command: 'screenMode', param: 'big'},
  {id: 'SCREEN_MODE_6', legacy: true, category: '画面', label: '画面モード: ワイド',
    defaultKey: 54 + KEY_MOD.SHIFT, command: 'screenMode', param: 'wide'},
  {id: 'SHIFT_RESET', legacy: true, category: '再生速度', label: '押している間だけ超低速再生',
    defaultKey: 49, command: 'playbackRate'},
  {id: 'SHIFT_DOWN', legacy: true, category: '再生速度', label: '再生速度を下げる',
    defaultKey: 188 + KEY_MOD.SHIFT, command: 'shiftDown'},
  {id: 'SHIFT_UP', legacy: true, category: '再生速度', label: '再生速度を上げる',
    defaultKey: 190 + KEY_MOD.SHIFT, command: 'shiftUp'},
  {id: 'NEXT_VIDEO', legacy: true, category: 'プレイリスト', label: '次の動画',
    defaultKey: 74, command: 'playNextVideo'},
  {id: 'PREV_VIDEO', legacy: true, category: 'プレイリスト', label: '前の動画',
    defaultKey: 75, command: 'playPreviousVideo'},
  {id: 'SCREEN_SHOT', legacy: true, category: 'その他', label: 'スクリーンショット',
    defaultKey: 83, command: 'screenShot'},
  {id: 'SCREEN_SHOT_WITH_COMMENT', legacy: true, category: 'その他', label: 'スクリーンショット(コメント付き)',
    defaultKey: 83 + KEY_MOD.SHIFT, command: 'screenShotWithComment'},

  // ---- ここから新規(Task 059)。既定キーは全て未設定(0)。 ----
  // execCommandのswitch文で直接処理されており、追加の配線が不要な6件。
  {id: 'TOGGLE_LIKE', category: '再生', label: 'いいね！ ON/OFF',
    defaultKey: 0, command: 'toggle-like'},
  {id: 'PLAYLIST_SHUFFLE', category: 'プレイリスト', label: 'プレイリストをシャッフル',
    defaultKey: 0, command: 'shufflePlaylist'},
  {id: 'RELOAD_VIDEO', category: 'プレイヤー全般', label: '動画を再読み込み',
    defaultKey: 0, command: 'reload'},
  {id: 'SEEK_TO_RESUME_POINT', category: 'シーク', label: '前回の再生位置へシーク',
    defaultKey: 0, command: 'seekToResumePoint'},
  {id: 'OPEN_GINZA', category: 'プレイヤー全般', label: 'Ginza(公式プレイヤー)で開く',
    defaultKey: 0, command: 'openGinza'},
  {id: 'SAVE_MYMEMORY', category: 'その他', label: '再生位置を「おもいで」に保存',
    defaultKey: 0, command: 'saveMymemory'},

  // RootDispatcher.js に既に 'toggle-<設定名>' のcaseがあり、追加配線が不要な6件。
  {id: 'TOGGLE_BACK_COMMENT', category: 'コメント', label: 'コメントを動画の後ろに流す ON/OFF',
    defaultKey: 0, command: 'toggle-backComment'},
  {id: 'TOGGLE_NG_FILTER', category: 'フィルタ/NG', label: 'NGフィルタ全体 ON/OFF',
    defaultKey: 0, command: 'toggle-enableFilter'},
  {id: 'TOGGLE_DEBUG', category: 'その他', label: 'デバッグモード ON/OFF',
    defaultKey: 0, command: 'toggle-debug'},
  {id: 'TOGGLE_NICOS_JUMP', category: 'コメント', label: '@ジャンプ機能 ON/OFF',
    defaultKey: 0, command: 'toggle-enableNicosJumpVideo'},
  {id: 'TOGGLE_BEST_ZENTUBE', category: 'その他', label: 'ベストZenTube ON/OFF',
    defaultKey: 0, command: 'toggle-bestZenTube'},
  {id: 'TOGGLE_AUTO_COMMENT_SPEED', category: 'コメント', label: 'コメント速度自動調整 ON/OFF',
    defaultKey: 0, command: 'toggle-autoCommentSpeedRate'},

  // RootDispatcher.js側に新しく 'toggle-<設定名>' のcaseを追加した14件
  // （追加箇所: src/RootDispatcher.js の execCommand()。Task 059で追加）。
  {id: 'TOGGLE_STORYBOARD', category: '画面', label: 'シークバーのサムネイル(ストーリーボード) ON/OFF',
    defaultKey: 0, command: 'toggle-enableStoryboard'},
  {id: 'TOGGLE_STORYBOARD_BAR', category: '画面', label: 'シーンサーチバー ON/OFF',
    defaultKey: 0, command: 'toggle-enableStoryboardBar'},
  {id: 'TOGGLE_COMMENT_PANEL', category: 'コメント', label: 'コメントパネル表示 ON/OFF',
    defaultKey: 0, command: 'toggle-enableCommentPanel'},
  {id: 'TOGGLE_COMMENT_PANEL_AUTOSCROLL', category: 'コメント', label: 'コメントパネルの自動スクロール ON/OFF',
    defaultKey: 0, command: 'toggle-enableCommentPanelAutoScroll'},
  {id: 'TOGGLE_HEATMAP', category: '画面', label: '再生数ヒートマップ表示 ON/OFF',
    defaultKey: 0, command: 'toggle-enableHeatMap'},
  {id: 'TOGGLE_AD_DECORATION', category: 'プレイリスト', label: 'プレイリストの広告 金冠/銀冠枠 ON/OFF',
    defaultKey: 0, command: 'toggle-enableAdDecoration'},
  {id: 'TOGGLE_AUTOPLAY', category: '再生', label: '自動再生 ON/OFF',
    defaultKey: 0, command: 'toggle-autoPlay'},
  {id: 'TOGGLE_CONTINUE_NEXT_PAGE', category: '再生', label: 'ページ切り替え後の再生継続 ON/OFF',
    defaultKey: 0, command: 'toggle-continueNextPage'},
  {id: 'TOGGLE_AUTO_ZENTUBE', category: 'その他', label: '自動ZenTube ON/OFF',
    defaultKey: 0, command: 'toggle-autoZenTube'},
  {id: 'TOGGLE_DBLCLICK_CLOSE', category: 'プレイヤー全般', label: '背景ダブルクリックで閉じる ON/OFF',
    defaultKey: 0, command: 'toggle-enableDblclickClose'},
  {id: 'TOGGLE_SMALLMODE_ASPECT_LOCK', category: '画面', label: '「小」モードのアスペクト比ロック ON/OFF',
    defaultKey: 0, command: 'toggle-smallModeAspectLock'},
  {id: 'TOGGLE_FULLSCREEN_ON_DBLCLICK', category: '画面', label: '画面ダブルクリックでフルスクリーン ON/OFF',
    defaultKey: 0, command: 'toggle-enableFullScreenOnDoubleClick'},
  {id: 'TOGGLE_REMOVE_NG_MATCHED_USER', category: 'フィルタ/NG', label: 'NGマッチしたユーザーのコメントを全部消す ON/OFF',
    defaultKey: 0, command: 'toggle-removeNgMatchedUser'},
  {id: 'TOGGLE_COMMENT_PREVIEW', category: 'コメント', label: 'コメント欄プレビュー ON/OFF',
    defaultKey: 0, command: 'toggle-enableCommentPreview'},

  // ---- ここから新規(Task 060)。既定キーは全て未設定(0)。 ----
  // 既存の関連メニュー(RelatedInfoMenu)の項目で、これまでクリック操作
  // でしか実行できなかったもの。RootDispatcher.js側に新しくcaseを
  // 追加した3件（追加箇所: src/RootDispatcher.js の execCommand()）。
  {id: 'OPEN_NICOAD', category: 'その他', label: 'ニコニ広告で宣伝',
    defaultKey: 0, command: 'open-uad'},
  {id: 'OPEN_TWITTER_HASH', category: 'その他', label: 'twitterの反応を見る',
    defaultKey: 0, command: 'open-twitter-hash'},
  {id: 'OPEN_PARENT_VIDEO', category: 'その他', label: '親作品・コンテンツツリーを開く',
    defaultKey: 0, command: 'open-parent-video'},
  // 既存のexecCommandのswitch文(NicoVideoPlayerDialog.js)で既に処理
  // されており、追加の配線が不要な1件。
  {id: 'PLAYLIST_SET_COMMONS_TREE', category: 'プレイリスト', label: '親作品・子作品をプレイリストに追加',
    defaultKey: 0, command: 'playlistSetCommonsTree'},
  // RootDispatcher.jsに既にcaseがあり、追加配線が不要な1件。
  {id: 'COPY_WATCH_URL', category: 'その他', label: '動画URLをコピー',
    defaultKey: 0, command: 'copy-video-watch-url'},
  // 「小」モードの位置・サイズリセットボタン(.zenzaSmallModeResetButton、
  // Task 032〜で既存)を、クリックせずキーだけで押せるようにする新設1件。
  // RootDispatcher.js側に新しくcaseを追加した(既存ボタンをクリックさせる
  // だけで、位置・サイズ計算のロジック自体は一切複製していない)。
  {id: 'RESET_SMALLMODE_POSITION', category: '画面', label: '「小」モードの位置とサイズを初期状態に戻す',
    defaultKey: 0, command: 'resetSmallModePosition'},

  // ---- ここから新規(Task 065)。既定キーは全て未設定(0)。 ----
  // 旧SEEK_LEFT2/SEEK_RIGHT2(「カスタマイズ用の予備スロット」、2個のみ・
  // 秒数を変更する手段が無かった)を置き換える、自由に秒数を設定できる
  // シークショートカット。10個ぶん常に配列には存在させておき、
  // 上級者向け設定パネル側で「実際にどこまで表示するか」を制御する
  // (未使用のスロットは初期状態では隠し、「追加」ボタンで1つずつ
  // 見せていく。詳細はsrc/_setting.jsのrenderShortcutKeySettingsHtml
  // 付近参照)。
  //
  // customSeekSlot: 何番目のスロットかを表す1〜10の番号。_setting.js側で
  // 「カスタムシークのスロットかどうか」の判定・表示順の決定に使う。
  //
  // 秒数(param)は固定値ではなく、Config.props.PARAM_CUSTOM_SEEK_<n>に
  // ユーザーが自由入力した数値を使う(マイナス値=戻る、プラス値=進む)。
  // ShortcutKeyEmitter.js側で、この配列のaction.paramではなく
  // Config.props.PARAM_<id>を優先して読むよう特別扱いしてある。
  {id: 'CUSTOM_SEEK_1', category: 'シーク', label: 'カスタムシーク1(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 1},
  {id: 'CUSTOM_SEEK_2', category: 'シーク', label: 'カスタムシーク2(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 2},
  {id: 'CUSTOM_SEEK_3', category: 'シーク', label: 'カスタムシーク3(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 3},
  {id: 'CUSTOM_SEEK_4', category: 'シーク', label: 'カスタムシーク4(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 4},
  {id: 'CUSTOM_SEEK_5', category: 'シーク', label: 'カスタムシーク5(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 5},
  {id: 'CUSTOM_SEEK_6', category: 'シーク', label: 'カスタムシーク6(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 6},
  {id: 'CUSTOM_SEEK_7', category: 'シーク', label: 'カスタムシーク7(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 7},
  {id: 'CUSTOM_SEEK_8', category: 'シーク', label: 'カスタムシーク8(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 8},
  {id: 'CUSTOM_SEEK_9', category: 'シーク', label: 'カスタムシーク9(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 9},
  {id: 'CUSTOM_SEEK_10', category: 'シーク', label: 'カスタムシーク10(秒数は自由入力・マイナスで戻る)',
    defaultKey: 0, command: 'seekBy', customSeekSlot: 10},

  // ---- ここから新規(Task 070)。既定キーは未設定(0)。 ----
  {id: 'PICTURE_IN_PICTURE', category: 'その他', label: 'ピクチャーインピクチャー',
    defaultKey: 0, command: 'picture-in-picture'},
  {id: 'PICTURE_IN_PICTURE_COMMENT', category: 'その他', label: 'ピクチャーインピクチャー(コメント付き)',
    defaultKey: 0, command: 'picture-in-picture-comment'},

  // ---- ここから新規(Task 074)。既定キーは未設定(0)。 ----
  {id: 'TOGGLE_AUDIO_AUTO_ADJUST', category: 'その他', label: '音声の自動調整のON/OFF',
    defaultKey: 0, command: 'toggle-audio.autoAdjust'},

  // ---- ここから新規(Task 080 提供画面)。既定キーは未設定(0)。 ----
  {id: 'TOGGLE_SUPPORTER_CREDIT', category: 'その他', label: '動画の最後の「提供」画面の表示 ON/OFF',
    defaultKey: 0, command: 'toggle-supporterCredit.enable'},

  // ---- ここから新規(Task 080 再生速度)。本家の再生速度メニューと同じ13段階。既定キーは未設定(0)。 ----
  {id: 'PLAYBACK_RATE_10', category: '再生速度', label: '再生速度: 10倍',
    defaultKey: 0, command: 'playbackRate', param: 10},
  {id: 'PLAYBACK_RATE_5', category: '再生速度', label: '再生速度: 5倍',
    defaultKey: 0, command: 'playbackRate', param: 5},
  {id: 'PLAYBACK_RATE_4', category: '再生速度', label: '再生速度: 4倍',
    defaultKey: 0, command: 'playbackRate', param: 4},
  {id: 'PLAYBACK_RATE_3', category: '再生速度', label: '再生速度: 3倍',
    defaultKey: 0, command: 'playbackRate', param: 3},
  {id: 'PLAYBACK_RATE_2', category: '再生速度', label: '再生速度: 2倍',
    defaultKey: 0, command: 'playbackRate', param: 2},
  {id: 'PLAYBACK_RATE_1_75', category: '再生速度', label: '再生速度: 1.75倍',
    defaultKey: 0, command: 'playbackRate', param: 1.75},
  {id: 'PLAYBACK_RATE_1_5', category: '再生速度', label: '再生速度: 1.5倍',
    defaultKey: 0, command: 'playbackRate', param: 1.5},
  {id: 'PLAYBACK_RATE_1_25', category: '再生速度', label: '再生速度: 1.25倍',
    defaultKey: 0, command: 'playbackRate', param: 1.25},
  {id: 'PLAYBACK_RATE_1', category: '再生速度', label: '再生速度: 標準速度(x1)',
    defaultKey: 0, command: 'playbackRate', param: 1},
  {id: 'PLAYBACK_RATE_0_75', category: '再生速度', label: '再生速度: 0.75倍',
    defaultKey: 0, command: 'playbackRate', param: 0.75},
  {id: 'PLAYBACK_RATE_0_5', category: '再生速度', label: '再生速度: 0.5倍',
    defaultKey: 0, command: 'playbackRate', param: 0.5},
  {id: 'PLAYBACK_RATE_0_25', category: '再生速度', label: '再生速度: 0.25倍',
    defaultKey: 0, command: 'playbackRate', param: 0.25},
  {id: 'PLAYBACK_RATE_0_1', category: '再生速度', label: '再生速度: 0.1倍',
    defaultKey: 0, command: 'playbackRate', param: 0.1},

  // ---- ここから新規(Task 077 画面フィルター)。既定キーは全て未設定(0)。 ----
  // 処理は RootDispatcher.js → ScreenFilter.execCommand()（toggle-screenFilter.* / screenFilter-*）
  // と、NicoVideoPlayerDialog.js の 'toggle-screenFilterPanel' / 'toggle-flipH' / 'toggle-flipV'。
  {id: 'OPEN_SCREEN_FILTER_PANEL', category: '画面フィルター', label: '画面フィルターのパネルを開く/閉じる',
    defaultKey: 0, command: 'toggle-screenFilterPanel'},
  // Task 080: 「使う」を廃止したので、「今の設定 ⇔ 標準」を行き来するショートカットにした
  {id: 'TOGGLE_SCREEN_FILTER', category: '画面フィルター', label: 'エフェクト ON/OFF（今の設定 ⇔ 標準）',
    defaultKey: 0, command: 'toggle-screenFilter.enable'},
  {id: 'TOGGLE_SCREEN_FILTER_SPLIT', category: '画面フィルター', label: '左右で見比べる（左半分に元の映像）ON/OFF',
    defaultKey: 0, command: 'toggle-screenFilter.split'},
  {id: 'SCREEN_FILTER_NEXT_PRESET', category: '画面フィルター', label: 'プリセットを順番に切り替える',
    defaultKey: 0, command: 'screenFilter-nextPreset'},
  {id: 'SCREEN_FILTER_RESET', category: '画面フィルター', label: 'すべて標準に戻す',
    defaultKey: 0, command: 'screenFilter-reset'},
  {id: 'SCREEN_FILTER_PRESET_DARK', category: '画面フィルター', label: 'プリセット: 暗い動画を見やすく',
    defaultKey: 0, command: 'screenFilter-preset', param: 'dark'},
  {id: 'SCREEN_FILTER_PRESET_SHARP', category: '画面フィルター', label: 'プリセット: くっきり',
    defaultKey: 0, command: 'screenFilter-preset', param: 'sharp'},
  {id: 'SCREEN_FILTER_PRESET_FADED', category: '画面フィルター', label: 'プリセット: 色あせ補正',
    defaultKey: 0, command: 'screenFilter-preset', param: 'faded'},
  {id: 'SCREEN_FILTER_PRESET_EYECARE', category: '画面フィルター', label: 'プリセット: 目に優しい（夜）',
    defaultKey: 0, command: 'screenFilter-preset', param: 'eyeCare'},
  {id: 'SCREEN_FILTER_PRESET_MONO', category: '画面フィルター', label: 'プリセット: 白黒',
    defaultKey: 0, command: 'screenFilter-preset', param: 'mono'},
  {id: 'SCREEN_FILTER_PRESET_INVERT', category: '画面フィルター', label: 'プリセット: 反転（暗転）',
    defaultKey: 0, command: 'screenFilter-preset', param: 'invert'},
  // Task 077c: 追加したプリセット・項目
  {id: 'SCREEN_FILTER_PRESET_VIVID', category: '画面フィルター', label: 'プリセット: ビビッド',
    defaultKey: 0, command: 'screenFilter-preset', param: 'vivid'},
  {id: 'SCREEN_FILTER_PRESET_CINEMA', category: '画面フィルター', label: 'プリセット: シネマ（銀残し風）',
    defaultKey: 0, command: 'screenFilter-preset', param: 'cinema'},
  {id: 'SCREEN_FILTER_PRESET_FILM', category: '画面フィルター', label: 'プリセット: フィルム（レトロ）',
    defaultKey: 0, command: 'screenFilter-preset', param: 'film'},
  {id: 'SCREEN_FILTER_PRESET_PASTEL', category: '画面フィルター', label: 'プリセット: パステル',
    defaultKey: 0, command: 'screenFilter-preset', param: 'pastel'},
  {id: 'SCREEN_FILTER_PRESET_COOL', category: '画面フィルター', label: 'プリセット: 寒色',
    defaultKey: 0, command: 'screenFilter-preset', param: 'cool'},
  {id: 'SCREEN_FILTER_PRESET_WARM', category: '画面フィルター', label: 'プリセット: 暖色',
    defaultKey: 0, command: 'screenFilter-preset', param: 'warm'},
  {id: 'SCREEN_FILTER_PRESET_GOLD', category: '画面フィルター', label: 'プリセット: ゴールド',
    defaultKey: 0, command: 'screenFilter-preset', param: 'gold'},
  {id: 'SCREEN_FILTER_PRESET_MONO_HIGH', category: '画面フィルター', label: 'プリセット: 白黒（硬調）',
    defaultKey: 0, command: 'screenFilter-preset', param: 'monoHigh'},
  {id: 'SCREEN_FILTER_TEMPERATURE_UP', category: '画面フィルター', label: '色温度を暖かく(+5)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'temperature:5'},
  {id: 'SCREEN_FILTER_TEMPERATURE_DOWN', category: '画面フィルター', label: '色温度を涼しく(-5)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'temperature:-5'},
  {id: 'SCREEN_FILTER_BLUR_UP', category: '画面フィルター', label: 'ぼかしを強く(+1px)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'blur:1'},
  {id: 'SCREEN_FILTER_BLUR_DOWN', category: '画面フィルター', label: 'ぼかしを弱く(-1px)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'blur:-1'},
  {id: 'TOGGLE_SCREEN_FILTER_AUTO_LEVELS', category: '画面フィルター', label: '自動レベル補正 ON/OFF',
    defaultKey: 0, command: 'toggle-screenFilter.autoLevels'},
  {id: 'SCREEN_FILTER_BRIGHTNESS_UP', category: '画面フィルター', label: '明るさを上げる(+5%)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'brightness:5'},
  {id: 'SCREEN_FILTER_BRIGHTNESS_DOWN', category: '画面フィルター', label: '明るさを下げる(-5%)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'brightness:-5'},
  {id: 'SCREEN_FILTER_CONTRAST_UP', category: '画面フィルター', label: 'コントラストを上げる(+5%)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'contrast:5'},
  {id: 'SCREEN_FILTER_CONTRAST_DOWN', category: '画面フィルター', label: 'コントラストを下げる(-5%)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'contrast:-5'},
  {id: 'SCREEN_FILTER_SATURATE_UP', category: '画面フィルター', label: '彩度(色の濃さ)を上げる(+5%)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'saturate:5'},
  {id: 'SCREEN_FILTER_SATURATE_DOWN', category: '画面フィルター', label: '彩度(色の濃さ)を下げる(-5%)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'saturate:-5'},
  {id: 'SCREEN_FILTER_GAMMA_UP', category: '画面フィルター', label: 'ガンマを上げる(暗い所を明るく +0.05)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'gamma:0.05'},
  {id: 'SCREEN_FILTER_GAMMA_DOWN', category: '画面フィルター', label: 'ガンマを下げる(-0.05)',
    defaultKey: 0, command: 'screenFilter-adjust', param: 'gamma:-0.05'},
  {id: 'TOGGLE_SCREEN_FILTER_INVERT', category: '画面フィルター', label: '階調反転(ネガ) ON/OFF',
    defaultKey: 0, command: 'toggle-screenFilter.invert'},
  {id: 'TOGGLE_FLIP_H', category: '画面フィルター', label: '左右反転 ON/OFF',
    defaultKey: 0, command: 'toggle-flipH'},
  {id: 'TOGGLE_FLIP_V', category: '画面フィルター', label: '上下反転 ON/OFF',
    defaultKey: 0, command: 'toggle-flipV'}
  // ↑ 新しい設定・機能を追加するタスクでは、この配列にエントリを追加する
  //   ことを忘れないこと（このファイル冒頭の説明も参照）。
];

// Config.js の DEFAULT_CONFIG にマージする、KEY_* の既定値一覧を作る。
// 既にexistingDefaultsに存在するキー(＝レガシーのショートカット。
// Config.js側に直接書かれている)は絶対に上書きしない。新規追加分だけを
// 返すことで、既存の29個の既定キーバインドには一切触れない安全設計にしてある。
const buildDefaultKeyConfig = (existingDefaults = {}) => {
  const result = {};
  SHORTCUT_ACTIONS.forEach(action => {
    const propName = 'KEY_' + action.id;
    if (Object.prototype.hasOwnProperty.call(existingDefaults, propName)) { return; }
    result[propName] = action.defaultKey || 0;
  });
  return result;
};

// カテゴリ順(配列に最初に出現した順)にグルーピングする。設定パネル表示用。
const groupShortcutActionsByCategory = () => {
  const groups = [];
  const byCategory = {};
  SHORTCUT_ACTIONS.forEach(action => {
    if (!byCategory[action.category]) {
      byCategory[action.category] = {category: action.category, actions: []};
      groups.push(byCategory[action.category]);
    }
    byCategory[action.category].actions.push(action);
  });
  return groups;
};

//===END===
export {
  SHORTCUT_ACTIONS,
  KEY_MOD,
  encodeKeyCombo,
  formatKeyCombo,
  buildDefaultKeyConfig,
  groupShortcutActionsByCategory
};

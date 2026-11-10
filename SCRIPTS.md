# 同梱スクリプト一覧

`dist` フォルダに含まれる各Userscriptの役割です。インストール・更新は[公開版](https://github.com/ButaMonky/ZenzaWatch/tree/develop/dist)を使用してください。

| 区分 | ファイル | 役割・版 |
|---|---|---|
| 本体 | `ZenzaWatch-dev.user.js` | HLS / domand再生、自動画質切り替え、コメント、プレイリスト、検索、画面フィルター、上級者設定。`2.7.374-task998` |
| 任意追加 | `MylistPocket.user.js` | サムネイル上の動画情報、とりマイ、Zenzaプレイリスト追加。`0.5.88-task998` |
| 任意追加 | `ZenzaGamePad.user.js` | ゲームパッド操作。`1.5.6-task966` |
| 任意追加 | `HeatSync.user.js` | コメントの少ない部分の自動早送り。`0.0.24-task966qa` |
| 任意追加 | `MaskedWatch.user.js` | 動画上の文字・顔を検出してコメントを透過。`0.3.8-task966` |
| 任意追加 | `ZenzaBlogPartsButton.user.js` | 外部サイトの動画ブログパーツに起動ボタンを追加。`0.0.5-task928` |
| 任意追加 | `CapTube.user.js` | YouTubeのスクリーンショット撮影とZenzaWatchのキャプチャ連携。`0.0.24-task966qa` |
| 任意追加（開発者向け） | `uQuery.user.js` | コンソールのデバッグ補助。通常利用では不要。`0.0.7-task966` |
| 廃止案内 | `ZenzaHLS.user.js` | HLS本体統合に伴う削除案内のみ。新規インストール不要。`0.1.0-task997` |
| 廃止案内 | `ZenzaAdvancedSettings.user.js` | 上級者設定の本体統合に伴う削除案内のみ。新規インストール不要。`0.4.0-task993` |
| 凍結旧版 | `ZenzaWatch.user.js` | 旧通常版2.6.2。本体と同時に有効にしない |
| 凍結旧版 | `MylistFilter.user.js` | 旧マイリスト整理ツール。視聴不可動画の一括削除用 |
| 凍結旧版 | `WatchDump.user.js` | 旧デバッグ用出力。HTTPページ限定で、現在のHTTPSページには対応しない |

「凍結旧版」の3つは、[dist-manifest.json](./dist-manifest.json) の `legacyFrozen` に元のリポジトリとSHA-256を記録し、作り直しません。それ以外の10個は `npm run build` でソースから作る配布物（`active`）です。`active` には廃止案内用の2本も含み、利用時に追加が必要という意味ではありません。

## 通常の利用で必要なもの

通常の動画再生に必要なのは **`ZenzaWatch-dev.user.js` の1本だけ**です。HLS / domand再生も本体が担当します。`MylistPocket.user.js` などの任意追加は必要な機能だけ選んでください。

旧「ZenzaWatch HLS Support」は、先に本体を2.7.373以降へ更新してから、Tampermonkeyなどの管理画面で削除してください。旧 `ZenzaAdvancedSettings` も本体更新後に削除できます。本体や保存データの削除・コピーは不要です。

> [!IMPORTANT]
> `ZenzaWatch.user.js` と `ZenzaWatch-dev.user.js` を同時に有効にすると、二重に動作する可能性があります。現在は `ZenzaWatch-dev.user.js` を使用してください。

## ソースコード

| dist | 主なビルド元 |
|---|---|
| `ZenzaWatch-dev.user.js` | `src/_template.js`（HLSを含む本体） |
| `ZenzaAdvancedSettings.user.js` | `src/_settingsRetired.js`（削除案内のみ） |
| `ZenzaHLS.user.js` | `src/_hls.js`（削除案内のみ） |
| `MylistPocket.user.js` | `src/_pocket.js` |
| `ZenzaGamePad.user.js` | `src/_gamepad.js` |
| `HeatSync.user.js` | `src/_heatsync.js` |
| `MaskedWatch.user.js` | `src/_shape.js` |
| `ZenzaBlogPartsButton.user.js` | `src/_blog.js` |
| `CapTube.user.js` | `src/_captube.js` |
| `uQuery.user.js` | `src/_uquery.js` |

HLSの正本は `tools/typescript-stage1/hls-src` です。設定、キャッシュWorker、動画要素、デバッグ画面、ライブラリ読込、初期化を内部モジュールに分離し、本体に同梱します。設定は `ZenzaWatch_video.hls.*`、HLSキャッシュは `zenza_hls` v5 / `ts-data` を継続使用します。シーン画像キャッシュとは別の保存領域です。

上級者設定の画面は本体内の `src/_setting.js`、ライフサイクルは `src/AdvancedSettingsController.js`、編集状態と表示は既存の `ModernAdvancedSettingsModel/UI` が担当します。これらは `tools/typescript-stage1/advanced-src` のTypeScriptが正本です。本体と同じConfig・保存キーを使い、移行用コピーは行いません。

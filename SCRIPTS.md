# 同梱スクリプト一覧

`dist` フォルダに含まれる各Userscriptの役割をまとめています。

| ファイル | 役割 | 備考 |
|---|---|---|
| `ZenzaWatch-dev.user.js` | **ZenzaWatch本体**。動画再生、コメント、プレイリスト、検索、画面フィルターなどを提供 | 現在の推奨版。`2.7.21-task081` |
| `ZenzaWatch.user.js` | ZenzaWatch本体の旧通常版 | 現在は古いため、DEV版と同時に有効にしないこと |
| `ZenzaAdvancedSettings.user.js` | 上級者向け設定パネル | ショートカット、画面フィルター、NG等の設定 |
| `ZenzaHLS.user.js` | HLS / domand動画再生を担当 | 自動画質切り替えも担当。`0.0.24-task079b` |
| `MylistPocket.user.js` | サムネイル上の「とりマイ」「動画情報」「Zenzaプレイリスト追加」など | `0.5.18-task079b` |
| `ZenzaGamePad.user.js` | ゲームパッドでZenzaWatchを操作 | 任意 |
| `HeatSync.user.js` | コメントの少ない部分を自動で早送りする拡張 | 任意 |
| `MaskedWatch.user.js` | 画面上の文字・顔などを検出してコメント表示を調整 | 任意 |
| `ZenzaBlogPartsButton.user.js` | 外部サイトのニコニコ動画ブログパーツにZenza起動ボタンを追加 | 任意 |
| `CapTube.user.js` | YouTubeでSキーによるスクリーンショット撮影 | ZenzaWatchとは直接関係のない同梱スクリプト |
| `uQuery.user.js` | 開発者向けのコンソール補助 | 通常利用では不要 |
| `MylistFilter.user.js` | マイリストの視聴不可動画を一括削除 | 古いスクリプト |
| `WatchDump.user.js` | 動画データをコンソールへ出力するデバッグ用 | 古く、現在は実質未使用 |
| `_versions/` | タスクごとの完成品スクリプトのスナップショット | 不具合時のロールバック用 |

## 通常の利用で必要なもの

基本的には以下を使用します。

- `ZenzaWatch-dev.user.js`
- `ZenzaHLS.user.js`

必要に応じて、

- `MylistPocket.user.js`
- `ZenzaAdvancedSettings.user.js`

を追加してください。

> [!IMPORTANT]
> `ZenzaWatch.user.js` と `ZenzaWatch-dev.user.js` を同時に有効にすると、
> 二重に動作する可能性があります。
> 現在は `ZenzaWatch-dev.user.js` の利用を推奨します。

## ソースコード

各スクリプトの主なビルド元は以下です。

| dist | src |
|---|---|
| `ZenzaWatch-dev.user.js` / `ZenzaWatch.user.js` | `src/_template.js` |
| `ZenzaAdvancedSettings.user.js` | `src/_setting.js` |
| `ZenzaHLS.user.js` | `src/_hls.js` |
| `MylistPocket.user.js` | `src/_pocket.js` |
| `ZenzaGamePad.user.js` | `src/_gamepad.js` |
| `HeatSync.user.js` | `src/_heatsync.js` |
| `MaskedWatch.user.js` | `src/_shape.js` |
| `ZenzaBlogPartsButton.user.js` | `src/_blog.js` |
| `CapTube.user.js` | `src/_captube.js` |
| `uQuery.user.js` | `src/_uquery.js` |

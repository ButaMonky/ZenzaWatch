# ZenzaWatch

[segabito/ZenzaWatch](https://github.com/segabito/ZenzaWatch) をベースに、
現在のニコニコ動画環境向けの修正・機能追加を行っている非公式Forkです。

Ginzaから独立して単体で動作するHTML5版ニコニコ動画プレイヤーです。
TampermonkeyなどのUserscriptマネージャー上で動作します。

## インストール

インストール・自動更新先は、常に公開版 `ButaMonky/ZenzaWatch` です。

### かんたんインストール

TampermonkeyなどのUserscriptマネージャーをインストールした状態で、
以下のリンクをクリックしてください。

| スクリプト | インストール・用途 |
|---|---|
| **ZenzaWatch 本体** | **[インストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaWatch-dev.user.js)** · `2.7.375-task999`。通常の動画再生は本体1本で利用できます。 |
| MylistPocket | [インストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/MylistPocket.user.js) · `0.5.88-task998`。サムネイル上の動画情報、とりマイ、プレイリスト追加など。任意。 |
| ~~ZenzaAdvancedSettings~~ | **本体に統合済み・追加インストール不要。** 本体を更新後、導入済みの旧スクリプトを削除してください。保存済みの設定は引き継ぎます。[旧版の削除案内](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaAdvancedSettings.user.js) · `0.4.0-task993`。 |
| ~~ZenzaHLS（HLSサポート）~~ | **本体に統合済み・追加インストール不要。** 先に本体を2.7.373以降へ更新してから、導入済みの旧HLSスクリプトを削除してください。[旧版の削除案内](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaHLS.user.js) · `0.1.0-task997`。 |

旧スクリプトの削除はTampermonkeyなどの管理画面から行ってください。本体や保存データを削除する必要はありません。

- [ZenzaBlogPartsButton をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaBlogPartsButton.user.js)
  - 外部サイトのニコニコ動画ブログパーツにZenza起動ボタンを追加します。 (version `0.0.5-task928`)

> [!IMPORTANT]
> 現在の改良内容は `ZenzaWatch-dev.user.js` に反映されています。
>
> 古い `ZenzaWatch.user.js` と `ZenzaWatch-dev.user.js` を同時に有効にすると、
> 二重に動作する可能性があります。
> 現在は `ZenzaWatch-dev.user.js` を使用してください。

すべてのスクリプトは [dist](/dist) から確認できます。

各スクリプトの詳しい役割については
[SCRIPTS.md](/SCRIPTS.md) を参照してください。

### dist内のスクリプトの役割

| 区分 | ファイル | 役割 |
|---|---|---|
| 本体 | `ZenzaWatch-dev.user.js` | HLS / domand再生、コメント、プレイリスト、検索、上級者設定 |
| 任意追加 | `MylistPocket.user.js` | サムネイル上の動画情報、とりマイ、プレイリスト追加 |
| 任意追加 | `ZenzaGamePad.user.js` | ゲームパッド操作 |
| 任意追加 | `HeatSync.user.js` | コメントの少ない部分の自動早送り |
| 任意追加 | `MaskedWatch.user.js` | 動画上の文字・顔を検出してコメントを透過 |
| 任意追加 | `ZenzaBlogPartsButton.user.js` | 外部サイトの動画ブログパーツに起動ボタンを追加 |
| 任意追加 | `CapTube.user.js` | YouTubeのスクリーンショット撮影とZenzaWatchのキャプチャ連携 |
| 任意追加（開発者向け） | `uQuery.user.js` | コンソールのデバッグ補助。通常利用では不要 |
| 廃止案内 | `ZenzaHLS.user.js` | HLS本体統合に伴う削除案内のみ |
| 廃止案内 | `ZenzaAdvancedSettings.user.js` | 上級者設定の本体統合に伴う削除案内のみ |
| 凍結旧版 | `ZenzaWatch.user.js` | 旧2.6.2。本体と同時に有効にしない |
| 凍結旧版 | `MylistFilter.user.js` | 旧マイリスト整理ツール。視聴不可動画の一括削除用 |
| 凍結旧版 | `WatchDump.user.js` | 旧デバッグ用出力。HTTPページ限定で、現在のHTTPSページには対応しない |

任意追加のスクリプトは必要な機能だけ選んでください。廃止案内と凍結旧版の新規インストールは不要です。
各スクリプトの版とビルド元は [SCRIPTS.md](./SCRIPTS.md) を参照してください。

## 本家からの変更点

現在のニコニコ動画環境への対応を含め、
多数の修正・機能追加を行っています。

詳しくは
[本家ZenzaWatchからの変更点](./CHANGES_FROM_UPSTREAM.md)
を参照してください。

## 上級者設定の表示整理

マイページの「ZenzaWatch上級者設定」から、画面・映像 → 表示・非表示を開けます。
ボタン・パネルの表示37項目に、コメント表示・コメント一覧・コメントプレビュー・ヒートマップ・
シークサムネイル・シーンサーチ・広告装飾の共通設定7項目を加え、44項目をまとめて操作できます。
共通設定は元のカテゴリにも残り、未保存の変更・保存・キャンセル・初期値への復帰を共有します。
歯車を隠した場合もマイページの上級者設定から戻せます。
「この画面の項目だけ初期値に戻す」は、現在の小分類だけが対象です。

## 変更履歴と既知の未解決事項

詳しい変更内容は [CHANGELOG.md](/CHANGELOG.md) を参照してください。
Task391の公開前点検では、コメント送信の特定エラー、全画面シーク終端の実機確認、
サムネイルの時間制限、停止時の操作バー、NicoNGとの互換性に未完了の項目が残っています。
対象のIssue・Discussionと判定をCHANGELOG先頭に記載しています。全要望の完了を意味する更新ではありません。

## 開発者向け（ソースからのビルド）

配布物（`dist/*.user.js`）は `src/` と `packages/*/src/` から `build.js` で作ります。

```
npm ci          # package-lock.json どおりに依存を入れる
npm test        # テスト
npm run build   # dist/ の10個の配布物を作り直す（node ./build.js --dev と同じ）
```

- Node.js は `package.json` の `engines` の範囲（22.22.2 以上の 22 系、24.15.0 以上の 24 系、または 26 以上）を使ってください。
- ビルドは入力の欠け・構文エラー・書き込み失敗があると終了コード1で止まり、`dist/` を書き換えません。
- 作り直した配布物は、ビルド識別子の行（`// build: …` と `var BUILD = …`）以外は `dist/` のものと同じになります。
- `dist/` の配布物は [dist-manifest.json](/dist-manifest.json) で2種類に分けて管理しています。
  - **active**（10個）: `npm run build` でソースから作る配布物。
  - **legacy-frozen**（3個: `ZenzaWatch.user.js` 2.6.2・`MylistFilter.user.js`・`WatchDump.user.js`）: 元の作者のリポジトリから引き継いだ古い成果物。今のソースからは作り直さず、内容を変えない（SHA-256 で固定）。移行・削除の方針が決まるまで残しています。
  - どちらにも入っていない配布物があると `npm test` が失敗します。

## オリジナル版について

このリポジトリは
[segabito/ZenzaWatch](https://github.com/segabito/ZenzaWatch)
をベースにした非公式Forkです。

ニコニコ動画側の仕様変更、ブラウザ環境の変化、
長期間の更新停止によって動作しなくなった機能などを中心に、
修正・機能追加を行っています。

## ライセンス

オリジナルの `segabito/ZenzaWatch` では、作者から自由な利用を認める旨が
READMEに記載されています。

このForkで新たに追加・変更したコードについては
[MIT-0（MIT No Attribution License）](/LICENSE) を適用します。

本家由来部分については、オリジナルの
[segabito/ZenzaWatch](https://github.com/segabito/ZenzaWatch)
に記載された利用条件も参照してください。

ライセンスに関する検討経緯:

- `docs/design-pack/19_TASK_011_UPSTREAM_LICENSE_RESEARCH.md`
- `docs/design-pack/22_TASK_016_LICENSE_DECISION.md`

## 意図的に不採用とした機能（AUD-08 / 2026-10-10）

公式動画プレビューの再生位置をZenzaWatchの再生開始位置へ自動引き継ぎする機能は、
管理・保守負担が大きく不要との判断により**不採用（WONTFIX）**としています。
Task376で一度実装された部分はTask378で撤去しました。**明示的な仕様変更の承認なく再実装しないでください。**
動画リンクを開いた際のプレビュー停止、通常の再生開始位置指定、
連続クリック時の起動オプション混入を防ぐ既存の不具合修正は維持します。
この非採用方針は監査台帳のAUD-08と専用回帰テストでも管理しています。

## フィードバック

気軽な質問・感想・使い方の相談などは
[Discussions](https://github.com/ButaMonky/ZenzaWatch/discussions)
へどうぞ。

不具合報告や、再現手順・原因・修正案が分かっている場合は
[Issues](https://github.com/ButaMonky/ZenzaWatch/issues)
を利用してください。


## NicoNico API research (Task969)

The public [offline API lookup and source index](docs/research/README.md) documents 44 research entries. It is not part of the player runtime.

開発時の機能の分け方は [モジュールの境界](docs/MODULE_BOUNDARIES.md) を参照してください。

通知履歴に記録する通信・応答の範囲は [通信診断](docs/REQUEST_DIAGNOSTICS.md) を参照してください。

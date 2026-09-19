# ZenzaWatch

[segabito/ZenzaWatch](https://github.com/segabito/ZenzaWatch) をベースに、
現在のニコニコ動画環境向けの修正・機能追加を行っている非公式Forkです。

Ginzaから独立して単体で動作するHTML5版ニコニコ動画プレイヤーです。
TampermonkeyなどのUserscriptマネージャー上で動作します。

## インストール

### かんたんインストール

TampermonkeyなどのUserscriptマネージャーをインストールした状態で、
以下のリンクをクリックしてください。

#### 基本

- **[ZenzaWatch 本体をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaWatch-dev.user.js)**
  - 動画再生、コメント、プレイリスト、検索、画面フィルターなどを提供します。

- **[ZenzaHLS をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaHLS.user.js)**
  - HLS / domand動画の再生や自動画質切り替えを担当します。

基本的には上の2つをインストールしてください。

#### オプション

- [MylistPocket をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/MylistPocket.user.js)
  - サムネイル上の動画情報、とりマイ、Zenzaプレイリスト追加など。

- [ZenzaAdvancedSettings をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaAdvancedSettings.user.js)
  - ショートカット、画面フィルター、NGなどの上級者向け設定。

- [ZenzaBlogPartsButton をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaBlogPartsButton.user.js)
  - 外部サイトのニコニコ動画ブログパーツにZenza起動ボタンを追加します。

> [!IMPORTANT]
> 現在の改良内容は `ZenzaWatch-dev.user.js` に反映されています。
>
> 古い `ZenzaWatch.user.js` と `ZenzaWatch-dev.user.js` を同時に有効にすると、
> 二重に動作する可能性があります。
> 現在は `ZenzaWatch-dev.user.js` を使用してください。

すべてのスクリプトは [dist](/dist) から確認できます。

各スクリプトの詳しい役割については
[SCRIPTS.md](/SCRIPTS.md) を参照してください。

## 本家からの変更点

現在のニコニコ動画環境への対応を含め、
多数の修正・機能追加を行っています。

詳しくは
[本家ZenzaWatchからの変更点](./CHANGES_FROM_UPSTREAM.md)
を参照してください。

## 変更履歴

詳しい変更内容は [CHANGELOG.md](/CHANGELOG.md) を参照してください。

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

## フィードバック

気軽な質問・感想・使い方の相談などは
[Discussions](https://github.com/ButaMonky/ZenzaWatch/discussions)
へどうぞ。

不具合報告や、再現手順・原因・修正案が分かっている場合は
[Issues](https://github.com/ButaMonky/ZenzaWatch/issues)
を利用してください。

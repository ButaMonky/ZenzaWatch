# ZenzaWatch

[segabito/ZenzaWatch](https://github.com/segabito/ZenzaWatch) をベースに、
現在のニコニコ動画環境向けの修正・機能追加を行っている非公式Forkです。

Ginzaから独立して単体で動くHTML5版ニコニコ動画プレイヤーです。
Userscriptとして動作します。

## インストール

最新版は [dist](/dist) にあります。

通常使用する主なスクリプト:

- `ZenzaWatch-dev.user.js` — ZenzaWatch本体
- `ZenzaHLS.user.js` — HLS / domand再生
- `MylistPocket.user.js` — サムネイルの動画情報・とりマイ等
- `ZenzaAdvancedSettings.user.js` — 上級者向け設定
- `ZenzaBlogPartsButton.user.js` — 外部サイトのニコニコ大百科に Zenza 起動ボタンを追加
GitHubで対象の `.user.js` を開き、**Raw** を押すと
Tampermonkey等からインストールできます。

> [!IMPORTANT]
> 現在の改良内容は `ZenzaWatch-dev.user.js` に反映されています。
> `ZenzaWatch.user.js` は古い版のため、両方を同時に有効にしないでください。

各スクリプトの詳しい役割については [SCRIPTS.md](/SCRIPTS.md) を参照してください。

## 変更履歴

[CHANGELOG.md](/CHANGELOG.md) を参照してください。

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

気軽な質問・感想・相談は **Discussions** へどうぞ。

再現手順が分かる不具合や、原因・修正案が分かっている場合は
**Issues** を開いてください。

# ZenzaWatchのバージョン管理・過去版ダウンロード

GitHubの [Releases一覧](https://github.com/ButaMonky/ZenzaWatch/releases) に、公開版の節目ごとに当時のUserscriptを保存します。**Task番号とRelease番号は別物**です。

## 保存済みの公開版

| タグ | ZenzaWatch本体 | 主な変更 | 区分 |
|---|---|---|---|
| [v2.7.315](https://github.com/ButaMonky/ZenzaWatch/releases/tag/v2.7.315) | `2.7.315-task904` | 動画情報の読み込み修復 | 過去版 |
| [v2.7.316](https://github.com/ButaMonky/ZenzaWatch/releases/tag/v2.7.316) | `2.7.316-task801` | シーンサーチ改良の統合 | 過去版 |
| [v2.7.317](https://github.com/ButaMonky/ZenzaWatch/releases/tag/v2.7.317) | `2.7.317-task935` | Issue #3 全画面シーク操作の修正 | 先行版・実機確認待ち |

最新の通常導入は [READMEのかんたんインストール](./README.md#かんたんインストール) を使ってください。過去版は、障害の比較・手動での復元・動作記録の保存を目的としています。

## 各Releaseの中身

- `ZenzaWatch-dev.user.js`、`ZenzaHLS.user.js`、`MylistPocket.user.js`、`ZenzaAdvancedSettings.user.js`、`ZenzaBlogPartsButton.user.js`：対応する**公開Gitコミット**の配布ファイルを一切改変せずに添付
- `SHA256SUMS.txt`：元の5ファイルのチェックサム
- `pinned-rollback.zip`：手動復元用セット。5本から `@downloadURL`・`@updateURL` のメタデータ行だけを取り除き、**実行コード本文は元の配布版とバイト単位で一致**。導入手順を含む `README.txt` も収録

元のUserscriptは `@updateURL` が現在の `develop` を指すため、古い版を直接インストールしても、Tampermonkeyの自動更新によって新しい版に戻される可能性があります。特定の旧版を維持したい場合は復元用ZIPから手動でインポートしてください。手動導入後も他の同名・同namespaceスクリプトを同時に有効にせず、更新設定を確認してください。

## Releaseを作る基準

GitHub Releasesを**Taskの完了台帳として使いません**。Task番号はGitHub Issue・PR・コミット・開発タスク台帳で追跡します。Releaseは以下のような利用者向けの区切りだけで作ります。

1. 新しい安定版を公開するとき
2. 重要な不具合・安全性の修正版がまとまったとき
3. 大幅改修の前に復元可能なバージョンを残すとき

公開コードのタグは `v2.7.xxx` のような明確なバージョン名を使い、**特定のコミットSHAに固定**します。公開後のタグを別コミットへ移動しません。以前のスクリプトに新しいコードを継ぎ足して「旧版」として再配布することもしません。

非公開テスト版 `ButaMonky/ZenzaWatch-Back-up` の変更は、ユーザー向けの公開判断・品質確認が終わるまでここに混ぜません。実機確認待ちの公開候補はGitHub上で `Pre-release` と明示し、安定版と区別します。

## 旧版の検証と注意

添付された元ファイルの実行部分は、上表のタグが指すコミットの `dist/` と一致します。GitHubが自動作成するソースコードZIPとは別に、直接導入できるUserscriptファイルを保存してあります。

過去の版が**今のニコニコ動画で必ず動くとは限りません**。不具合を報告する場合は、ZenzaWatch本体と上級者設定・HLSのバージョン、通常/全画面モード、再現操作を知らせてください。

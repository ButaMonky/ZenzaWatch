# Changelog

このプロジェクト（ZenzaWatch改良版）の変更履歴です。
[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に準じた形式でまとめています。

現時点ではバージョンタグでのリリース管理を行っていないため、これまでの改修内容は
すべて `[未リリース]` セクションにまとめています。各項目の詳しい調査・修正内容は
`docs/design-pack/` 以下の対応するタスク文書を参照してください。

## [未リリース]

### Fixed

- タグ検索・動画検索が行えなくなっていた問題を修正（ニコニコ動画の検索APIドメインが
  `api.search.nicovideo.jp` から `snapshot.search.nicovideo.jp` へ移転したことへの追随）。
  （`docs/design-pack/31_TASK_023_SEARCH_API_FQDN_CHANGE.md`）
- 検索のたびに `this.version.date.getTime is not a function` エラーが発生し、
  処理が失敗することがある不具合を修正。
  （`docs/design-pack/34_TASK_026_SEARCH_VERSION_GETTIME_BUG.md`）
- プレイリスト（検索結果一覧）・コメント一覧が画面に表示されないことがある不具合を修正
  （`FrameLayer` の二重ナビゲーション競合が原因）。
  （`docs/design-pack/33_TASK_025_FRAMELAYER_DOUBLE_NAVIGATION_RACE.md`）
- マイリスト・とりあえずマイリストの取得で、Cookieが送信されず失敗することがある
  不具合（`credentials`オプションのtypo）を修正。
  （`docs/design-pack/32_TASK_024_MYLIST_RANKING_CHANNELFILTER_TYPO_FIX.md`）
- ランキングページの取得で、Cookieが送信されず失敗することがある不具合
  （`credentials`オプションのtypo）を修正。
  （`docs/design-pack/32_TASK_024_MYLIST_RANKING_CHANNELFILTER_TYPO_FIX.md`）
- マイリスト・とりあえずマイリストで、101件目以降の項目が反映されないページネーションの
  不具合を修正。
  （`docs/design-pack/32_TASK_024_MYLIST_RANKING_CHANNELFILTER_TYPO_FIX.md`）
- チャンネル絞り込み検索が正しく機能しないtypoバグ（`channelId`が`chanelId`になっていた）
  を修正。
  （`docs/design-pack/32_TASK_024_MYLIST_RANKING_CHANNELFILTER_TYPO_FIX.md`）
- ストーリーボード（プレビューサムネイル）の画質選択で、並び替えロジックのバグにより
  意図した画質が選ばれないことがある不具合を修正。
  （`docs/design-pack/27_TASK_020_NICORU_CLEANUP_AND_SORT_FIX.md`）
- `Observable.fromEvent` 利用箇所で `WeakMap` 関連のエラーが発生する不具合を
  部分的に修正。
  （`docs/design-pack/16_TASK_007_WEAKMAP_ROOT_CAUSE.md`）
- 動画のより高画質なサーバー種別（Domand/DMC）を判定するロジック
  （`maybeBetterQualityServerType`）を、実際のAPIレスポンスに基づいて再設計。
  （`docs/design-pack/30_TASK_022_VIDEOINFO_MAYBEBETTER_REDESIGN.md`）

### Changed

- ライセンスをMIT-0（帰属表示不要のMITライセンス）に統一。本家
  （`segabito/ZenzaWatch`）が「特に権利を主張する気はないので勝手に使ってください」
  という非公式な許可のみで正式なライセンスを持っていなかったため、その趣旨に沿って選定。
  （`docs/design-pack/19_TASK_011_UPSTREAM_LICENSE_RESEARCH.md`、
  `docs/design-pack/22_TASK_016_LICENSE_DECISION.md`）
- テストが最後まで実行され合否サマリーが出るよう、テスト基盤（importパス、Babel設定、
  Windows対応のnpm scripts等）を整備。
  （`docs/design-pack/09_TASK_001_TEST_IMPORT_AUDIT.md` ほかTask 002〜005）

### Removed

- 未実装のまま放置されていた読み上げ機能（`yomi/`）は、調査の結果、実装が根本的に
  欠落していることが判明したため、復活を見送り現状のまま保持（ビルド対象外）することを
  決定。
  （`docs/design-pack/21_TASK_014_YOMI_REVIVAL_BLOCKED.md`）
- デバッグ用の `console.nicoru` 呼び出しを削除。
  （`docs/design-pack/27_TASK_020_NICORU_CLEANUP_AND_SORT_FIX.md`）
- ビルドに使われていない未使用ファイルを削除。
  （`docs/design-pack/17_TASK_008_BUILD_DEPENDENCY_GRAPH.md`、
  `docs/design-pack/18_TASK_010_FULL_BUILD_CLOSURE.md`、
  `docs/design-pack/20_TASK_013_TASK_015_CLEANUP.md`）

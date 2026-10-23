# ZenzaWatch 通知・エラー履歴：オフライン実装・監査記録（2026-10-23）

## 作業ID・状態
- ID: ZW-NOTIFY-JOURNAL-20261023
- 依頼: 一時的に消える「いいね」「コメント」「通信エラー」などの通知を、あとから検索・確認・保存できるようにする
- 作業正本: GitHub develop @ a9872c21352728da7f45af5a192eeccb971d7f69（2026-10-23調査時の最新同期版）
- 作業ブランチ: task/notification-journal-offline-20261023（developへ未統合）
- ローカル接続: Desktop Commander Local: Session terminated。ユーザーより「PCはオフライン」と訂正あり。ローカル未コミット分・生成元TypeScriptは未確認
- 実機と全体ビルド: 未実行。CIとPC正本の再照合が必要。現段階を公開済み・完成とは扱わない

## 現行機能の出所と調査
- src/RootDispatcher.js: notify/alert/notifyHtml/alertHtml、他のPopupMessage直呼び
- packages/lib/src/ui/PopupMessage.js: ポップアップ表示。5秒アニメーションで消去、永続履歴なし
- src/NicoVideoPlayerDialog.js: いいねのお礼と失敗、コメント投稿・削除結果、動画情報・セッション・再生開始の失敗
- src/VideoInfoPanel.js: いいねのお礼は動画情報の更新時に消去される
- packages/lib/src/nico/ThreadLoader.js: 投稿段階ごとの詳細な診断はすでにある。accepted/rejected/not-sent/unknownを混同してはいけない
- packages/lib/src/infra/logSafe.js: 診断オブジェクトの秘匿値マスキングがあるが、任意の生ログ全文を保存してよいわけではない
- packages/lib/src/infra/IndexedDbStorage.js: put/get/update/delete/gcがあるが、汎用の履歴一覧取得APIはない
- TypeScript生成元 tools/typescript-stage1/nico-src/*.ts はGitHubには同期されていない。生成済みPopupMessage.js/ThreadLoader.jsなどの直接修正は再生成で消えるため見送り

## 独立ブランチに加えた変更
- src/NotificationJournal.js（新設）: 記録の型・値の正規化、URLクエリ/秘匿文字列対策、最大2000件の専用IndexedDB、保存失敗時のセッション内メモリ、通知重複の簡易抑制、取得・全件削除・購読
- src/NotificationHistoryPanel.js（新設）: 履歴タブ、検索、種類フィルター、詳細展開、JSON保存、全件削除。textContent表示でHTMLを実行しない。選択中以外は読み取りを開始しない
- src/RootDispatcher.js: dispatcher経由の通知・警告を画面表示を変えずに記録。ECHOの自由入力パラメータは履歴へ残さない
- src/NicoVideoPlayerDialog.js: タブ統合。いいね（画面が切り替わっていても元の動画ID）、コメント投稿結果と診断、動画情報・再生失敗を必要な項目だけで記録
- test/unit/NotificationJournalTest.js、NotificationJournalIndexedDbTest.js、NotificationHistoryPanelTest.js: ネット不要のテストを追加（合成IndexedDBで永続保存・別タブ削除も検証）

## 明確な非対応・後続修正が必要な点
1. generated由来のThreadLoader内部にある全段階（投稿キー・POST再試行・ACK不明）の細かな診断は未接続。プレイヤー側の高レベル結果のみ記録できる。ThreadLoader.jsの562行・587行にはPopupMessage.alert直呼びがあり、RootDispatcherを迂回するため履歴に未収録
2. RootDispatcherを通らないPopupMessage直呼びは取りこぼす可能性がある。正式な共通通知発行口への統合はTypeScript正本の照合後
3. ブラウザ全体のconsole.error/warnや第三者サイトのエラーを無差別に横取りしていない（秘密情報・ノイズ・性能問題があるため）
4. 別オリジン・別ブラウザ端末間の履歴同期はなし。現状は同じブラウザ・オリジンのローカル履歴
5. 既存の古い通知はさかのぼって保存できない。導入後のイベントのみ
6. ログの一部はプライバシー上切り詰め・秘匿する。Cookie、Token、コメント本文、通信ペイロードは診断履歴へ保存しない
7. PC上の未コミット修正、生成元TS、実環境ビルド、ブラウザ挙動との競合確認は未実施

## 統合前の必須チェック
- GitHub Actionsの全体テストとセキュリティチェック（結果未確認ならNOT RUN）
- PC復帰後: git status、developの先頭、未コミット変更、他作業ブランチを確認。生成元TSを尊重し、重複修正を避ける
- npm ci、build、生成前後の差分、全体テスト、コメント投稿・いいね・動画情報読込の既存回帰テスト
- ブラウザ: いいね成功/失敗/他動画遷移、投稿 accepted/rejected/not-sent/unknown、動画情報失敗、シーク・再生遅延、タブ切替、ページ再起動後の履歴復元
- 保存制限: IndexedDB利用不可・容量不足・複数タブ・大量通知・同時削除・プライバシー・JSON保存
- 既存配布物 dist/ZenzaWatch-dev.user.js 等はこのブランチでは未更新。実機に使える状態ではない
- verified時だけdevelopへ統合/配布。未確認をPASSと記さない
- 初回GitHub Actions (PR #37): secret gate PASS。quality gates: 3467 passing / 78 pending / 1 failing（BuildIntegrityTest: dist未再生成）。後続CIでは3469 passing / 78 pending / 同じ1件失敗。追加されたsource-onlyテストの個別失敗なし。最新コミットのCIは別途再確認が必要

## 再開位置
1. CI結果を確認して修正
2. PC接続復旧でローカルTS・未コミット成果照合
3. TypeScript正本側の集中通知経路とThreadLoader診断連携を設計・実装
4. dist再ビルドと全回帰、ユーザー実機検証、統合

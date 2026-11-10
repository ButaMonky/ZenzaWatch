# 上級者設定の本体統合（Task993）

目的: 画面生成・ライフサイクル・本体接続を分離してから本体に統合する。既存Config/保存キーを共有し、モデルの保存/キャンセルを維持。旧スクリプトは案内のみへ更新。

- [x] `_setting.ts` を副作用のない createAdvancedSettingsPanel(config) にする。既存モデル/UI/個別設定を維持。
- [x] AdvancedSettingsController がConfig復元待ち、遅延生成、同時openの共有、close/dispose、マイページ入口を管理。テストで重複生成/失敗再試行/後始末を確認。
- [x] 本体テンプレート、歯車メニュー、既存の上級設定への導線を接続。本体の同一Configを利用する。
- [x] 旧配布物は案内専用 `_settingsRetired.js` へ切替。同じname/namespace/updateURLで自動更新でき、設定には触れない。本体未更新時の案内リンクも表示。
- [ ] 配布・版番号・ドキュメント・テストを更新。独立レビュー、全体回帰、公開CI、ブラウザのローカルfixtureで保存/キャンセル/復帰/案内表示を検証して閉じる。両リポジトリへ統合・リリース。

基準: private b41e54fd4038c7dcefd0f81b46365da8feb58ecf / public 01c1c59e6efcbd51f8ca1db2d2792ce116bdf02a。
旧版スクリプトのインストールを勝手に削除しない。利用者自身が削除するための案内を残す。

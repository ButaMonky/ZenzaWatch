# Task970｜非公開版から公開版への統合・検証（2026-10-27）

## 目的と移植範囲

非公開リポジトリの検証済み実装を、既存公開developのIssue #3修復を維持したまま公開向けの独立ブランチに移植する。基準はprivate `4cbbeeb3fad9a716bb8195e0c06738cfc88ec729`、public `0b4896e5b69ec9b6775305f598d030a8c7f61118`。

- 開発済み製品ソース（src、packagesの実装）、TypeScript正本・生成マニフェスト、実装に必要なテストを公開。
- 再生速度の固定段階化（Task945）、通知履歴・通知色と透明度、Pocket投稿者/いいね補完、シーンサーチ、CapTube、HeatSyncなどの統合済み修正を含む。
- 公開版固有のTask935/Issue #3のCSS・Chromium検証を残す。非公開CIを前提にしたテストは公開CIに整合するよう修正する。
- アクティブな配布10本は`ZENZA_PUBLISH_CHANNEL=public`で正規再生成する。旧作者の凍結済み3本は改変しない。
- GitHub公開先のユーザースクリプト更新先は公開`ButaMonky/ZenzaWatch`の`develop`。非公開GitHub向けの更新URLは含めない。

## 公開安全性と意図的な除外

- 非公開のみの研究・監査・HANDOFF原本、個人の作業台帳・検証ログ、private publishスクリプト、HAR/Cookie/Tokenは移植しない。
- 非公開のフィクスチャ3件とキー文字列を使うテスト1件で、Gitleaksが10件検出。公開側の既存安全な4ファイルを維持し、候補全体のGitleaks再検査は0件。
- 非公開のインストール/公開パイプラインのみを対象とするユニットテストは公開用QAと置換し、動作本体のテストは保持。
- 本公開は新たな認証付きコメント投稿・タグ変更・いいね・実ユーザー設定操作を行っていない。すべてを実サイトで最終実機確認したとの主張はしない。

## 実行済み検証

- 公開向けの10本ビルド完了。生成比較（`tools/check_regeneration.js .`）10本一致、凍結3本のSHA保存、公開更新URLを確認。
- TypeScriptのNico API/エントリ128モジュール、SceneSearch10モジュールの生成・型・一致確認成功。Advanced10モジュール・Pocketサムネイル一致確認も成功。
- コメント履歴パッケージ235件PASS。
- 主要な公開機能・Issue #3のユニット検証86件PASS。
- 公開候補の全体root Mocha：`3993 passing / 74 pending / 0 failing`、終了コード0。証拠は公開Gitではなくローカルの検証ログに保管。
- Chromium：Issue #3の240地点・メニューボタン、Task939音量、Task947再生速度、Task957 Pocket、Task954プレビュー高さ、Task956全画面ボタン衝突の6種類成功。
- `gitleaks dir .`：保護フィクスチャを公開側の安全な版に戻した後、0件。
- TypeScript全体テスト：**380件成功・失敗0件、終了コード0**。Nico128、Scene10、Advanced10、Pocketの型・生成物チェックを含む。

## 統合条件

- 公開差分に実在する秘密情報や非公開用更新URLがないこと。
- TypeScript正本・生成JavaScript・配布版の再生成一致、回帰テスト、公開固有Issue #3修正の保存、作業ツリーのcleanを確認。
- 別担当による公開developの更新がある場合は競合と最新SHAを照合し、`ff-only`が成立する場合のみpushする。`reset`、`stash`、`rebase`、`amend`、`force`をしない。
- 公開後、公開`develop`の`git ls-remote`でSHA一致を確認し、品質CIと機密検査の結果を確認する。

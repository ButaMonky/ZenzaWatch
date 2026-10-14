# ZenzaWatch 品質ゲートとニコニコ互換性テスト（公開用）

対象ブランチ: `infra/nicocompat-ci-20261014`。2026-10-14 JST 時点の計画。
**新規スケジュール型のニコニコ監視は行わない。** GitHubへpush / PR / 手動ワークフロー実行があった場合だけCIが起動する。

## 自動検査

| ファイル | 処理 | 限界 |
| --- | --- | --- |
| `.github/workflows/quality.yml` | 動画・コメントの合成契約テスト、コメント履歴パッケージのビルド+217テスト、ZenzaWatch全体のMocha回帰 | ニコニコの実サイトは操作せず、APIの将来変更そのものは検出できない |
| `.github/workflows/security.yml` | Gitleaksで**現在のチェックアウトされたファイル**に秘密らしい文字列が混入していないか調査 | 過去の公開コミットを削除するものではない |
| `.github/dependabot.yml` | npmとGitHub Actionsの依存更新PR提案。自動マージなし、件数を制限 | 依存アップデートが安全かは人間の確認・テストが必要 |
| `test/compat/nico-contract.test.mjs` | 読み込み済みの**合成**watch/nvComment fixturesと主要なソース所有箇所を検査 | API/Domand/HLSの通信・ログインは行わない |

GitHub Actions権限は `contents: read`、チェックアウト時の認証情報保存を抑止する。秘密情報のレポートはartifactやPRコメントとして出力しない。Gitleaksはv8.30.1の公式リリースtarを固定SHA256で検証して起動する。

### 手動で実行

```powershell
cd <ZenzaWatch のルート>
npm ci --no-audit --no-fund
node --test test/compat/nico-contract.test.mjs
npm --prefix packages/comment-history test
npm test -- --timeout 15000 --reporter dot
gitleaks dir . --no-banner --redact --exit-code 1
```

すでにパッケージ導入済みなら `npm ci` は省略可。Gitleaksは別途PC全体へ導入済み。

## 既存Fixtureの秘密情報候補

Gitleaks v8.30.1 の初回チェックでは、旧モック/テストに10件の検出候補（JWT形式、signed thumbnail URL key、テスト用の意図的なキー文字列）があった。実トークンとして有効かどうかは**未確認**。

今回、対象の既存テスト fixture 4ファイル中10個の値を、秘密情報として使えない合成文字列へ置換した。JSONスキーマと非秘密のフィールドは維持した。現在のチェックアウトに対する `gitleaks dir` は**0件**。

ただし、**Git履歴717コミットからは別途21件の検出候補が残った**。履歴は変更しておらず、このゲートの `gitleaks dir` により削除されたことにはならない。過去の値が本物であれば、キー所有者による失効・再発行が必要。履歴の書き換えは、並行作業とリモート利用者へ重大な影響があるため別途明示承認なしに行わない。履歴監査の証跡は私的なDevTools-Shared資料に保存する。

## 不具合やAPI仕様変更が起きた際の対応

- テストが失敗した場合、どの `WATCH_SCHEMA`、`COMMENT_SCHEMA`、`RESPONSE_SCHEMA` 等に該当するかを区分する。
- テストの合成データが古いだけなのか、ニコニコ本番の仕様が変わったのかを混同しない。
- 許可された実機観測の匿名化HAR/HTMLを使い、旧/新仕様の**正しい差分**を追加した契約テストにする。
- テストだけを書き換えて成功扱いせず、ソースAdapterの修正・関連回帰・利用者確認を行ってから公開。
- 安全/権限拒否や書込失敗があっても、内容と再開条件を担当引継ぎ台帳に記録する。

## プロジェクト分離・公開ゲート

このインフラブランチは**公開済みの develop （6803d50）から作成**した。未公開の開発用 develop （328コミット先行）や Task424/SCUI worktree を混ぜていない。

CI整備の完了には、手元でのアクション設定静的検査・秘密検査・契約/全体テストに加え、公開リモートのGitHub Actionsが実際に緑になることの確認が必要。現時点ではこれらのファイルを公開用developへ統合していない。

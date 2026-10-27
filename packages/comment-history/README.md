# Comment history for ZenzaWatch (Task 200)

Independent read-only comment retrieval, bounded retries, per-video continuation, and a C-3 player panel.
Defaults: OFF until enabled; 5,000 additional comments; maximum 20,000. Enabling is persistent and applies to all tabs after normal comments load. Same-origin tab jobs are queued when Web Locks is available.

## Source ownership
Edit src/*.mjs, never src/generated/*.js. Run `npm run build:zenza` here, then `npm run build` at the repository root. The root build refuses stale generated files.
Run `npm test` here for the independent suite and `npm test` at the repository root for integration/regression tests. This package has no third-party runtime dependencies.
The right-bottom panel and advanced-settings userscript use the same settings schema and storage adapter; redesigning the settings UI does not require rewriting retrieval.

## Behavior
Data is applied after an acquisition batch ends. Further acquisition preserves the cursor and adds the selected quota, up to 20,000 total extras. Stop applies good partial results; OFF releases extras and retains normal comments and local edits. Switching videos invalidates old responses.
Task207: the fetched (cached) additional comments and the applied count are separate. `setAppliedCount(n)` (0-20,000; 0 = normal comments only while ON) applies the first n of the fetch order, keeps the in-memory cache when reducing, re-applies within the cache without network, and fetches only the missing part from the saved cursor. Only OFF, video switch and reload release the cache.
Timestamp-only paging does not prove complete historical coverage. Same-second ambiguity, malformed responses, time/request limits and errors are reported explicitly.
Current official totals and posting metadata are not replaced by historical page counts. Comment text and authentication material are never included in the public diagnostic summary.

## Integration boundaries
Generated entry points are connected by CommentPlayer, NicoVideoPlayer and NicoVideoPlayerDialog. Display preparation keeps normal comment identities and NicoScript runtime state. CommentPanel retains a reading anchor only within the same video generation.
Keep independent fixture tests and integration tests together when changing these boundaries. Browser tests with mocked transport are not evidence of successful live NicoNico retrieval.

## Task460 — TypeScript settings migration (Stage 1)

The optional TypeScript implementation is in `typescript-src/settings.ts`,
with a strict typed boundary in `typescript-src/core.d.mts`. This is a
**non-deployed compatibility stage**: the runtime and custom Zenza bundler
still consume `src/settings.mjs` unchanged. No fetch, retry, quota or
rendering behavior changes are introduced.

From this package, `npm ci --ignore-scripts --no-audit --no-fund` installs
pinned TypeScript 7.0.2 and Babel AST comparison tools. Then run
`npm run check:typescript` for a strict TS compile and semantic JS parity
check. `npm run stamp:typescript` updates the source/runtime manifest only
when the emitted JS and deployed JS have the same AST and the Git baseline
has not been edited by another owner. Runtime changes require a separate
reviewed task and full regression. The normal `npm test` also guards
the checked-in TS/JS SHA-256 manifest without needing a TypeScript compiler.

Other comment-history modules remain JavaScript until separately migrated.

## Task520 — TypeScript互換性調査モジュール

従来の`src/probe.mjs`を変更せず、TypeScript候補を
`probe-src/probe.ts`に配置しました。5段階の試験と通信回数上限、
キャンセル処理、集計レポートについて公開型を定義しています。
`probe-src/core.d.mts`と`transport.d.mts`はこの
probe専用の型境界であり、実行時のcore/transport自体の移行ではありません。

`npm run check:probe`でTypeScript7のstrict型検査・不正設定の
コンパイル拒否・Babel ASTによる既存JSとの完全一致・manifestを検証します。
`npm run stamp:probe`はGit HEAD側の旧実行JSが未変更の場合だけ
マニフェストを更新します。
`npm run check:typescript`は設定スキーマ検査に加えて
probe検査も行います。`npm test`では型ソースのSHA、
実行JSのSHA、5段階保持と上限の変更を監視します。

ビルド結果は`.generated-probe/`へ出力（Gitから除外）。
正規のZenza/bundlerは引き続き`src/probe.mjs`を使用し、
自動的にTypeScript出力を製品へ置換しません。

## Task521 — LayeredCommentStore TypeScript（非配布候補）

`layers-src/layers.ts` は旧 `src/layers.mjs` と同じ
通常/履歴コメント統合ロジックをTypeScriptで型付けしたソース候補です。
ストアの normal優先、重複処理、履歴の順序、履歴上限、削除を
strict型チェックします。

`npm run check:layers` が型・不正型契約・Babel AST一致・
保存されたSHA256 manifestを検査します。
`npm run stamp:layers` は元の実行JSを他ownerが
変更していないことをGit HEADで確認してからmanifestを更新します。
`npm run check:typescript` にもこの検査が含まれます。

JSと型宣言は`.generated-layers/`へ生成しGitでは追跡しません。
既存`src/layers.mjs`の配布・実行コードは変更せず、
他モジュールのTypeScript移行とは独立させています。

## Task514 — Browser preferences TypeScript (non-deployed)

`typescript-src/browser-preferences.ts` is a strict-typed candidate for the existing
`src/browser-preferences.mjs` storage adapter. The shipped JavaScript and userscript remain unchanged.
`npm run check:browser-typescript` runs strict and negative type contracts plus exact
Babel AST parity with the runtime; `stamp:browser-typescript` is an explicitly guarded
manifest refresh. This independent verification is included in `check:typescript`.

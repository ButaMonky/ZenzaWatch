# シーンサーチ再設計・Task801 確認版

## 確認の境界

確認版は ZenzaWatch 2.7.306-task801、単独上級者設定 0.3.63-task801。develop への統合・公開配布の置換は行わず、ユーザーの実機確認を待つ。基準は確認済み 2.7.304（f76cde6）。旧確認版と Pocket を含む他の配布物は保持する。

## 変更内容

- 表示方式を「シーク位置に追従」「位置を固定」に整理し、「従来表示」を互換用に残す。通常表示と全画面を別々に選択できる。
- サムネイル上のミニコメントと、コメントボタンで開く一覧を区別する。新2方式では隣接表示、従来表示では切替を維持する。
- 「シーンサーチのコメント表示」の親スイッチと、ミニコメント・コメントプレビューの子スイッチを追加。親OFFでも子の選択と一覧の開閉要求は保持する。
- 全方式で一覧背景0〜100%（初期90%）、サムネイル倍率50〜200%（初期100%）を共用する。画像とミニコメントは一緒に拡縮し、操作ボタンと一覧文字は縮めない。小さい画面では保存値を変えず収まる大きさに調整する。
- 上級者設定の既存トグル、初期値から変更した項目の青い強調を使用する。「表示・非表示」にも同じ設定を配置し同期する。変更の実反映は保存後。
- 自動非表示の時間は共通。ホバー・フォーカス・操作・ピン留め中は維持し、非表示後は見えない操作領域を残さない。
- 小画面の固定配置は実際に移動した動画、シークバー、入力欄・コマンド欄を基準にする。操作中は移動を抑え、終了後に再計算する。

## 検証記録

- 全体テスト：最終修正後 3,276 passing / 78既存pending / 0 failing（終了コード0）。
- シーンサーチ関連：Task5終了時 310 passing。設定保存・移行・表示非表示同期・ネイティブ要素の所有復元・非同期画像・破棄を含む。
- 独立した Chrome の製品クラス/CSS/nativeコメントモデルによる確認：518 passing / 0 failing。幅320/768/1536、通常表示、実Fullscreen API、小画面、3方式を検査。倍率50/100/150/200、背景0/40/90/100、一覧スクロール・時刻クリック・NG操作、実タイマー非表示、フォーカス維持、メニューの当たり判定、小→全画面→小、動画配置変更、上下入力欄、ピン中の画面幅縮小、高さ240pxでのシークバーの実ヒットテストと内部スクロールを含む。
- TS正本と生成JSの一致：4モジュール合格。
- sandboxで2回生成し、既存BUILDIDだけを除いた2配布物の一致を確認。
- 旧304のruntimeモジュールを同じfixtureで実行した比較は、新しい意味ベースの方式選択で想定どおり不合格。旧版に新機能の合格を要求する検査ではない。
- 旧UI07の既知の幾何不合格6件は新3方式の合格数に含めない。旧providerは互換確認用に保持する。
- 実際のニコニコ上でのログイン済みユーザー環境、拡張機能との組合せは未確認。以下の実機確認で判断する。

## 確認版のファイル

- `review/task801/ZenzaWatch-dev.user.js` SHA-256: `2f798d00cc779519e1025bad9c6f2469f64468a3b5b7820d2c516a3c48f8254a`
- `review/task801/ZenzaAdvancedSettings.user.js` SHA-256: `91c2e83736e1fc98944b2ba6738e187c3b659d14a68ae29ef3551920329db003`

各確認版の実装本文は同名distと一致し、更新先メタデータだけ確認用branchに分離している。そのbranchの公開pushは未実施で、メタデータのURLは現在利用可能な配布URLという意味ではない。通常のZenzaWatch内設定を使う場合、単独設定スクリプトの追加導入は不要。

## 実機で確認していただくこと

1. 起動ログが `2.7.306-task801` になったことを確認する。
2. 通常表示・全画面で追従/固定を選び、サムネイル上のミニコメントと右隣の一覧、スクロール・時刻クリックを確認する。
3. 背景の濃さと画像倍率を保存して変更する。ミニコメントが画像からずれず、ボタンと一覧文字が読みやすいことを確認する。
4. 親/子のスイッチと「表示・非表示」の同じ項目が同期すること、親OFF→ONで子の選択が戻ることを確認する。
5. 小画面で動画を四隅へ移動・拡縮し、コメント入力欄/コマンドを開く。固定パネルが操作部を邪魔せず、操作中に逃げ回らないことを確認する。
6. 一覧へマウスを移して操作中は消えず、操作後の自動非表示と再表示ができることを確認する。気になる点は表示モードと直前の操作を添える。

実機確認で問題があれば、この確認用branchで修正する。統合は確認結果を受けて別工程で行う。

## 独立レビュー後の修正

Astra / Extra highによる読取専用レビューを1回実施。重大な指摘はなし。次の6点を再現テストで失敗確認後に修正し、関連18テストが通過した。

1. 小画面の操作開始・終了は、発行元のViewで購読する。
2. ショートカットで初期値「追従」を明示選択した場合も保存する。
3. 別の設定画面や別タブで初期値を保存・削除した場合、保存有無に応じて表示を更新する。
4. 短い画面ではシークバーを除く高さにパネルを収め、内部スクロールで操作を保持する。
5. 従来表示のコメントボタンにも無効状態と説明を付け、無効中の操作で開閉要求を書き換えない。
6. 同じ画像要素の読み込み完了でもミニコメントの表示可否を更新する。

保留した軽微な指摘：内部スクロールで隠れた子要素の矩形が、マウスの移動経路判定に含まれる場合がある。表示維持が長くなる可能性はあるが、この判定自体がクリックを奪うことはない。今回のシークバー重なりとは別であり、追加変更を広げず記録する。

## 実装時の判断記録

以下は作業中に記録した計画との差分と、その判断が誤っていた場合の影響。後続の判断で置き換えたものも経緯として残す。

- Ruling: Keep existing prepared settings WIP and its recorded RED/GREEN evidence — already authorized tested work must not be deleted for ritual TDD — cost if wrong: baseline tests expose hidden incompatibilities.
- Task 1: Ruling: add raw miniVisible/listVisible to Preferences alongside effective flags ? settings must retain child state while parent is off ? cost if wrong: confusing draft controls.
- Task 1: Ruling: wrap Config import/export at its own boundary and preserve explicit default choices ? DataStorage imports fill new defaults and default-only export loses old-hidden overrides ? cost if wrong: backup migration changes. No changes to DataStorage.
- Task 1: Ruling: initial full suite continues as regression observation while scoped implementation proceeds; after changes a fresh whole-suite run is required, do not claim immutable baseline from the overlapping run.
- Task 2: Ruling: retain old numbered descriptors internally but hide them from user cards/search ? old preferences/providers and compatibility tests remain available while new semantic picker is primary ? cost if wrong: stale old draft could be edited through a future unfiltered UI.
- Task 2: Ruling: migration acknowledgement persists immediately as non-player UI state, and displays an error on failure ? no runtime preview changes before Save ? cost if wrong: notice may be dismissed independently from saving layout changes.
- Task 3: Ruling: add setImage/setListView methods — native storyboard arrives asynchronously and secondary list is lazy — cost if wrong: lifecycle ownership mismatch; covered by replacement/dispose tests.
- Task 3: Ruling: native VideoControlBar effective child switches are wired in Task 5 with production preferences — Task 3 validates presentation/ownership first — cost if wrong: unconnected behavior until Task 5, not a release.
- Task 4: Ruling: reserve a 76px unscaled footer and 10px border/padding in pure geometry — controls need stable space independent of image scale — cost if wrong: actual browser layout mismatch; Task 5/6 must reconcile CSS and measured bounds.
- Task 5: Ruling: exercise browser checks before closing lifecycle task — computed CSS caught stopped animation and a control overlap that DOM-only tests miss — cost if wrong: task boundary only; final browser matrix remains mandatory.
- Task 5: Ruling: preserve numbered paths for old regression fixtures/providers, select semantic layouts when production Config.resolveSceneSearch is present — production Config always supplies it; old settings stay recoverable — cost if wrong: an incomplete third-party Config adapter would retain numbered behavior.
- Task 5: Ruling: lazy list view stays mounted while closed, hidden and without hit targets — preserves primary hover mode and avoids listener churn; disposal restores native mode — cost if wrong: one extra native vpos listener while modern view remains mounted, checked at teardown.
- Task 5: Ruling: revise fixed 76px footer to a calculated footerHeight in PlacementResult consumed by View.fit — real browser 50% controls required 153px and were clipped; unscaled controls now fit at every tested scale — cost if wrong: extra vertical space; browser controls-visible checks cover it. This supersedes Task 4's fixed footer ruling.
- Task 5: Ruling: transparent portal/card gaps pass pointer input through, while real image/list/menu/search areas receive input — avoid invisible blank card space blocking video — cost if wrong: missing menu pointer rule; browser search hit test caught this and is being repaired.
- Task 6: Ruling: regenerate and version the standalone ZenzaAdvancedSettings distribution too — it imports the same Config and settings UI; leaving it unchanged breaks normal-input build parity and gives standalone users stale settings — cost if wrong: second review artifact, no Pocket changes. The plan's single-dist assumption was incomplete; use sandbox allowlist for these two only. Reserved Zenza 2.7.306-task801 and settings 0.3.62-task801.
- Task 6: Ruling: increase native list minimum width from 120px to 160px — actual 320px browser test clicked NGword when aiming at timestamp because native NG buttons overlapped it at 120px — keep native readable labels and shrink image+mini together to fit; cost if wrong: smaller thumbnail in narrow windows. Browser native-command/NG hit tests cover the reason.
- Task 6: Ruling: use the fresh whole-suite run plus a focused distribution/parity closing command for task-done rather than repeat an unchanged whole suite solely for bookkeeping — no production edits between those checks; all full-suite evidence remains in the ledger — cost if wrong: invalid evidence if source changes, in which case rebuild and repeat the whole suite.
- Task 6: Ruling: adapt the old gallery regression tests to the approved semantic picker instead of restoring obsolete eleven visible options — user approved consolidation; preserve behavioral assertions and old stored keys — cost if wrong: missed old-gallery behavior, covered separately by old-provider tests. No product change for these failures.
- Final: Ruling: dispatch the single read-only whole-branch review while the unchanged product's fresh full suite runs — implementation is committed and the only prior failures were now-migrated gallery tests; no acceptance/completion until both finish — cost if wrong: reviewer needs updated evidence if test findings require changes. This overlaps validation only, never implementation tasks.
- Final: Ruling: promote reviewer minor 'same-element native image availability does not rerender mini' to Important — a pinned preview can retain missing mini after delayed storyboard load without any subsequent render, affecting the core promised overlay — cost if wrong: one small extra presentation refresh on same-element notifications; ownership remains unchanged.

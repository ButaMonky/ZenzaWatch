# シーンサーチ Task801：実機指摘への修正確認版

## 2.7.310-task801：旧式に近い3アイコンへ整理

2.7.309でユーザーがボタンの反応を確認。その後、追加操作が画像に重なる配置を指摘された。別メニューの見本を提示したが、ユーザーは「戻る・中央にコメント一覧・進む」のコンパクトなアイコン配置を指定。移動秒数は上級者設定、検索はコメントプレビュー側、一時固定と「…」は操作部から外す。差別化は従来の画像／一覧切替と、追従・固定の横並び表示に限る方針。

- 追従・固定のサムネイル側は3アイコン。時刻は画像の下に独立した小さな行で表示し、倍率50%でも3アイコンを同じ行に収め、コメントボタンを画像中央に揃える。ミニコメントは元の画像と一緒に拡縮する。
- 「…」と画像を覆う追加操作の列を撤去。一時固定・秒数変更のボタンと秒数ポップアップも生成しない。既存ショートカットの状態処理は維持し、前後移動は上級者設定の秒数で既存seekByを呼ぶ。0秒のときは前後ボタンを隠す。
- 既存コメント検索を横の一覧内へ移設。検索アイコンと検索欄が画像に重ならない。検索から戻ると検索アイコンへ、一覧を閉じると中央の一覧ボタンへフォーカスを戻し、隠れた入力欄へ操作対象が残らないようにする。
- 従来表示の切替方式、追従・固定の同時表示、プレイヤー識別クラスzen-family、既存の表示／非表示設定との接続を維持。上級者設定単体版は0.3.63-task801から変更していない。
- TypeScript正本でPreviewViewとPlacementを変更してnico:syncで生成。7ボタン前提の高さ予約を3アイコンの実測高へ変更し、不要な縮小と空白を減らす。

検証：初回の3アイコン契約テストは旧7ボタンで失敗、検索を閉じた際のフォーカステストも隠れた検索ボタンに残ることを検出し、修正後に成功。最終関連テスト329 passing、配布ファイルの28宣言を使用したオフラインChrome検証848項目、nico:verify、サンドボックスビルドがすべて終了コード0。通常・全画面・小画面、幅320/768/1536、倍率50〜200%、ネイティブ入力保護、3アイコンの順序・中央位置・ヒット判定、一覧の横並び、旧式切替・ミニコメント切り抜きを含む。全体テストはこの版では再実行していない。

成果物：`review/task801/ZenzaWatch-dev.user.js`。SHA256: `671a42fa93d5b44821e674723dfa25846a70d50ce8e124ea3f72bf482798dfe5`。
証跡：`C:/Users/Saito/Documents/WanzaWatch-project/verify-logs/task801-310-20261018/`。
実サイトでの確認待ち。develop統合・pushは行わない。

## 2.7.309-task801：プレイヤー外と誤判定される入力無効化を修正

ユーザー提供の診断revision 2で、表示中の「…」と前後ボタンにclick listenerが存在しても、pointer-eventsがnoneになり、クリックが背後のtouchWrapper等へ届いていることを確認した。適用元はNicoVideoPlayerDialogの `body.zenzaScreenMode_* >*:not(.zen-family) *` 規則。body直下へ追加する新プレビューのportalにzen-familyがなく、プレイヤー外のページとして入力・アニメーションの無効化とcontain指定を受けていた。

修正はSceneSearchIntegrationBridgeのportalへ既存のプレイヤー識別クラスzen-familyを付けること。portal自体のpointer-events:noneは維持し、空白領域が画面全体の操作を遮らないようにする。新しいボタンや入力経路は追加していない。従来表示は既存プレイヤー内にあるため、この原因と同一とは扱わない。

検証：

- 実ソースから当該CSS規則を取り込んだオフラインChrome環境で、配布済み2.7.308の「…」クリックとヒット判定の失敗を再現（RED）。従来のfixtureはこの規則を含まず、見逃していた。
- 修正後の配布物から28宣言を抽出して検証：860項目成功、終了コード0。追従・固定、通常・全画面・小画面、画面幅320/768/1536を含む。通常・ワイド・大画面・3D・小画面の入力規則、背景ページの入力保護、「…」のマウス・Enter操作、前進による既存seekBy呼び出しを確認。
- 関連ユニットテスト：319 passing、終了コード0。全体テストはこの版で再実行していない。
- サンドボックスビルド成功。変更された配布物はZenzaWatch-dev.user.jsのみ。設定単体版は0.3.63-task801で不変。@versionと起動ログを2.7.309-task801へ更新。

成果物：`review/task801/ZenzaWatch-dev.user.js`。SHA256: `06425d86ac2ef43bfe9fa5175cf9349cd9782623b3b43878e8ded2f689f2134b`。
証跡：`C:/Users/Saito/Documents/WanzaWatch-project/verify-logs/task801-309-20261018/`。

実サイト全体や実際の再生位置更新はオフライン検証の対象外。実機修復完了とはせず、ユーザーによる「…」と前後ボタンの確認待ち。developへの統合・pushは行わない。以下の調査記録は各時点の経過として保持する。

## 2.7.308 実機確認失敗・操作経路の再調査

ユーザーは2.7.308-task801でも「…」と前後シークが反応しないと報告した。下記のオフライン検証合格を、実機修復完了と扱ってはならない。統合は引き続き保留。

ユーザー方針：旧版と同じ機能には旧版の処理を共用する。新しいUI案・ボタン追加・更新配布の整備より、操作不良の修復を優先する。

コード上で確認した共用範囲：

- ミニコメントは既存のCommentPreviewView、サムネイルは既存のSeekBarThumbnailを使用する。独立一覧も既存CommentPreviewのcreateListViewを使用する。
- 従来の前後ボタンはSeekBarToolTip._onMouseDownからcommandイベントを送り、プレイヤーのseekByへ到達する。
- 新しい前後ボタンはSceneSearchPreviewView → IntegrationBridge → ShortcutRouter → Controller → LegacyAdapterからdialog.execCommand('seekBy', delta)を呼ぶ。最終的な再生位置変更は既存処理を使用しているが、入力を受け取る手前の経路は異なる。
- 新しい一覧の行クリックは既存CommentPreviewViewのcommandイベントをポータルから元のプレイヤーへ転送している。
- 文字入力による検索欄SceneCommentSearch / SceneCommentSearchPanelは、SCUI導入時の追加実装（履歴66e311b）。既存のフィルター済みコメントを検索し、選択後は既存seekへ接続する。元のVideoControlBar / CommentPanelには同等の文字入力検索を確認できていない。「コメントサーチ」がプレビュー一覧を意味する場合、一覧自体は上記の既存部品を使っている。

検証の不足：現在のブラウザーfixtureはexecCommandを呼び出し記録へ置換し、元のtooltipの切替も簡略化している。実プレイヤー全体の入力経路と再生位置更新の検証にはなっていない。マウスのヒット判定とボタン処理を切り分けるため、現行版でTab/Enterによる「…」操作の結果をユーザーへ確認中。原因を特定する前に、イベント方式の変更を修正版として配布しない。

追加確認：ユーザーはキーボードでも「…」が開かないと回答。マウスの座標だけで説明できる問題とは扱わない。

- ブラウザー検証に `--distribution` を追加。配布済みの `review/task801/ZenzaWatch-dev.user.js` から28個の宣言を抽出して同じfixtureへ読み込み、ソースだけを検証していた不足を補った。ページ全体やTampermonkeyの実行環境の再現ではない。
- 「…」のEnter操作と、前後操作のうち進むボタンがseekByを1回呼ぶことを追加検証。配布済み2.7.308の部品では800件成功（終了コード0）。実機では依然失敗しているため、修復成功とは扱わない。ログ：`C:/Users/Saito/Documents/WanzaWatch-project/verify-logs/task801-308-distribution-input.log`。初回のEnterテストはCDP入力に文字イベントが不足したテスト側の不備で失敗し、実際のEnter入力に修正して再実行した。
- 製品コード・配布物は変更していない。実画面でのクリック直後のConsoleエラーの確認が次の調査に必要。実サイトの自動接続拒否を別手段で回避しない。

ユーザー提供Consoleログを確認：2.7.308-task801の起動あり。広告・計測通信のERR_BLOCKED_BY_CLIENT、広告情報APIの404、iframe sandbox警告、外部inject.jsの警告があるが、SCUIのボタン操作に対応する例外は見当たらない。これらを原因と断定しない。ログ内の個人識別子や閲覧情報はこの報告へ転記しない。

`review/task801/scene-input-diagnostic.js` を用意した。ユーザーがConsoleで手動実行する一時診断で、製品の更新ではない。プレビュー操作に限定してdocument capture / root bubble / 操作後の開閉状態 / 中央のヒット対象 / 取得可能なら既存click listener数を記録する。コメント本文・アカウント・URL・保存設定を読まず、通信・保存・再生操作もしない。30秒で自動解除。構文確認と独立DOMでのイベント観測・既存操作の維持・解除を検証済み。次はユーザー提供の `[SCUI診断]` 出力を確認する。

初回診断のユーザー結果：topDocument=true、followのroot clickListeners=1、events=0。開始・終了ともボタンのwidth/height=0で、pointerEvents=none。表示中の測定がないためnoneを原因と断定しない。初回診断はプレビュー外へ通り抜けたイベントを除外しており、表示時点の情報も記録していなかった。

診断revision 2では最大2分間プレビューの表示を待ち、表示検出後の30秒を観測する。表示時のgeometry・ヒット対象・ボタンからbodyまでのpointer-eventsと一致するCSS規則を記録。プレビュー領域内で別要素へ届いたクリックも記録し、全体のpointerdownは件数のみ数える。独立DOMで非表示→表示の検出、下層要素への通過クリック、既存処理の維持、解除を検証済み。製品コードと配布版は引き続き変更していない。

## 2.7.308-task801（2026-10-18）

修復を優先するユーザー指示に従い、追加ボタンの新設、設定画面の再設計、更新配布の仕組み、developへの統合は保留。

- 追従・固定の「…」：既定の hover-focus では、マウス進入で追加操作が通常のレイアウトへ現れ、クリック直前にボタンが移動していた。前回の検証は click 設定であり見逃していた。追加操作だけを画像側の重なり表示へ分離し、前後・「…」の位置とカード寸法を保つ。always 設定は通常の配置で全操作を表示する。ボタンは増やしていない。
- 従来表示：非表示中の画像を測定済みとして記録してしまい、同じDOMの再表示時に位置合わせを再試行しない問題を修正。検証環境では修正前に7pxのずれを再現。
- 従来表示：幅180pxのコメント領域を、中央の幅160pxのサムネイル画像に合わせて切り抜く。コメント行の流れるタイミングと本体のDOM所有権は変更しない。一覧モードには切り抜きを適用しない。

検証（この版の最終ファイル）：

- 関連ユニットテスト：319 passing / 0 failing、終了コード0。
- オフラインChrome検証：728 passing / 0 failing、終了コード0。通常・全画面・小画面、追従・固定・従来表示、幅320/768/1536、倍率50〜200%を含む。
- 「…」は hover-focus / click / always で、ホバーする前の座標をそのままクリックして確認。移動秒数メニューも各条件で画面内に収まり操作可能か確認。
- 旧版は非表示画像の再表示、サイズ変更、画面端の位置合わせに加え、画像内と画像外のヒット判定で実際の切り抜きを確認。
- TypeScript同期とサンドボックスビルド成功。変更された配布物は ZenzaWatch-dev.user.js のみ。設定単体版は0.3.63-task801で内容不変。
- 全体3,276件の実行結果は下記2.7.307の記録であり、今回の再実行結果とは区別する。

成果物：`review/task801/ZenzaWatch-dev.user.js`。SHA256: `831f08f7ba1550c7667f35c031fd495dccc852c91558aff776ef3e398daab87b`。
証跡：`C:/Users/Saito/Documents/WanzaWatch-project/verify-logs/task801-308-20261018/`。
実際のニコニコ画面での確認は未実施。ユーザーに「…」の操作と、旧版のミニコメントのはみ出しを確認していただくまで統合しない。

## 2.7.307-task801（2026-10-18）

ユーザーの指示により、新しい操作UIの検討・適用を保留して不具合修正を優先した。developへの統合、公開push、他の配布物の変更はしていない。上級者設定は0.3.63-task801のまま。承認済み画面案への設定UI修正の作業分は、検証ログ側に保管し、この確認版には含めない。

修正内容：

- 従来表示：コメント一覧への切替時にサムネイルの外枠と高さまで隠す。一覧を実測した操作部の上へ配置し、背景がボタンへ重ならないようにする。
- 従来表示：拡縮時の画像を中央に配置し、枠に収める。画面端で止まる操作部を基準にミニコメントも配置し、縮小時の45pxのずれをなくす。
- 追従：シークバーから離れた際も最後の横位置を保持する。表示の再計算で中央へ戻さない。
- 追従・固定：表示している操作部の高さを測り、閉じた追加操作のための空白を残さない。「…」の開閉、フォーカス、ホバーに合わせて高さを再計算する。
- 操作ボタンの増設・配置再設計は含めない。UI案は不具合の実機確認後にユーザーへ提示する。

検証：

- 旧コードで、従来表示の切替時の重なり、追従の中央移動、従来表示の画面端でのミニコメントずれを再現した。
- ブラウザーfixtureの簡略化されたtooltipを、製品の実際のtooltipテンプレートに置き換えた。以前の検証が外枠の残留を捕捉できなかった点を補う。
- 修正後の独立Chrome検証：638 passing / 0 failing。幅320/768/1536、通常・全画面・小画面、倍率50/100/150/200、画像とミニコメントの一致、左右端、一覧切替、実クリック・スクロール・自動非表示・復帰を含む。
- 関連単体検証：23 passing / 0 failing。
- 全体テスト：3,276 passing / 78既存pending / 0 failing（終了コード0、約6分）。
- TS正本を修正し、nico:syncで生成。2回のsandbox生成でBUILDIDを除いた内容の一致を確認。
- 実際のニコニコへのブラウザー接続はサイト安全ポリシーで拒否された。回避は行っておらず、ログイン済み実環境での修正確認はユーザーによる確認待ち。

確認版：review/task801/ZenzaWatch-dev.user.js
SHA-256：b6466f49794398e9a2c82463bc440445bb6bce5e9117544f072103e56bb20765

実機確認は起動ログが2.7.307-task801になったことを確かめ、以下を優先する。

1. 従来表示：コメントボタンで画像と一覧が完全に切り替わり、半透明の空枠が残らない。
2. 追従：マウスをシークバーから外しても中央へ移動しない。
3. 追従・固定：下の大きな空白がなくなり、「…」で追加操作を開いてコメント一覧などを操作できる。
4. 画像倍率を変え、画面の左右端でもミニコメントが画像からずれない。

以下は2.7.306時点の記録。検証の合格は実機における全ケースの保証ではなく、この後に受けた指摘が上記修正の根拠となっている。

---

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

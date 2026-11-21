# ZenzaWatch の修理案内

プログラミングに慣れていない方は、先に [はじめての修理（無料のAIと一緒に直す手順）](BEGINNER_REPAIR.md) を読んでください。

### 関連動画の HTTP 200 と「読めなかった項目　json」

HTTP 200 は応答が届いたことを示します。Task1112 でこの記録が1件だけ残った場合、受け取った本文の形式は復元できません。Task1120以降は「修復レポートをコピー」で、発生時のビルドと時刻、分かっている通信経路、応答の種類を一緒に渡せます。関連動画では、現在表示中の動画について HTTP 200 の本文がJSONとして読めなかった場合に限り、キャッシュを使わずに一度読み直します。再取得も失敗した場合は、空の本文、HTML、途中までJSONに見える本文などを見分ける手掛かりが残ります。「復旧未確認」は、その対象に対する後続の成功を記録していない状態です。

[関連動画・シリーズの取得](../../tools/typescript-stage1/nico-src/RecommendAPILoader.ts)・[APIの記録と安全な項目名](../../tools/typescript-stage1/nico-src/RequestDiagnostics.ts)・[API台帳からレポートまでの検査](../../tools/typescript-stage1/test/task1120-api-evidence.test.mjs)

### クリップ完成時の showTask エラー

2.7.487-task1111（ビルド `2026-11-20 14:20Z a1165344`）の `showTask@65028` と、Task1112 の `showTask@65180` は、完成メッセージの行頭の加算演算子がビルド時に消えて文字列を関数として呼び出す不具合です。Task1114でビルド処理を修正しました。調査では配布スクリプトの行番号と、ブラウザーが組み立てた `ZenzaWatchRuntime.js` の行番号を区別します。[ビルド処理](../../build.js)・[配布版での完成画面の確認](../../test/browser/task1105-x-result-panel.cjs)

### クリップの予約が進まないとき

共有画面の予約一覧で、動画名・区間・処理の種類を確認します。MP4の作成・自動添付とニコニコの投稿は同じ順番待ちを使います。予約を入れたタブを更新したり閉じたりすると、そのタブの待機中の予約は失われます。Web Locks対応ブラウザーでは、同じオリジンの別タブで実行中の処理も待ちます。

先頭の処理が終了しても次が始まらない場合は [ShareClipQueue.js](../../src/ShareClipQueue.js) のロック解放を確認します。順番が来てから失敗した場合は、MP4なら [ShareClipJobs.js](../../src/ShareClipJobs.js)、ニコニコ投稿なら [ShareOfficialClip.js](../../src/ShareOfficialClip.js) と、該当する通知履歴を確認します。別タブ間の順番は [ブラウザーテスト](../../test/browser/task1119-clip-queue.cjs) で再現できます。

### 一度再生できた動画が途中で止まるとき

通知履歴で「再生途中の修復レポート」を開いてください。ブラウザから読み込み待ちの通知を受け、前面で15秒間再生時刻が進まなかった場合に記録します。停止位置を含む受信済み区間に0.25秒を超える先のデータがある場合は、映像を進める処理を案内します。それ以外では利用中の方式に応じてHLSまたは通常の動画要素へのデータ供給を案内します。通信、デコード、映像形式についてブラウザ自身がエラーを返した場合は、待ち時間を置かずに分類できます。観測処理は [PlaybackInterruptionTrace.js](../../src/PlaybackInterruptionTrace.js)、再現試験は [PlaybackInterruptionTraceTest.js](../../test/unit/PlaybackInterruptionTraceTest.js) にあります。Chrome と ffmpeg がある環境では `node test/browser/task1103-playback-interruption.cjs` で、合成動画の途中からデータを保留し、実際の通知からコピー、復旧までを再現できます。

### 本文だけのX共有を調べるとき

2026年11月22日に公式PC版の視聴ページで配信されたコードを確認しました。X連携済みでも、添付なし（`default`）では編集した本文を `https://x.com/intent/tweet` の `text` に渡して投稿画面を開きます。公式クリップを選んだ場合（`videoClip`）に `postClipsTweet` を呼びます。Zenzaでも本文のみの共有はXの下書きを開き、利用者がXで投稿を確定します。下書きが開かない場合は本文をコピーしてXに貼り付けられます。[確認した公式PC版の共有処理](https://resource.video.nimg.jp/web/scripts/nvpc_next/assets/XShareContainer-CJnYCLEv.js)

### 共有画面を閉じた後の投稿・添付の結果を調べるとき

通知履歴で、ニコニコの直接投稿は元動画のID、Zenzaで作ったクリップはタイトルを手掛かりに結果を確認します。ニコニコの直接投稿は [ShareOfficialClip.js](../../src/ShareOfficialClip.js) がクリップ生成、連携先の再確認、投稿、結果照会を担当します。投稿を再送せずに結果を問い合わせるには、同じ動画の共有画面で「状態を再確認」を押してください。Zenzaで生成したMP4の処理とX下書きへの転送結果は [ShareClipJobs.js](../../src/ShareClipJobs.js) を確認してください。X下書きへの添付後は利用者がXで投稿します。

「ニコニコ連携でクリップ投稿」の修復レポートでは、最後に確認できた処理、失敗した段階、応答で不足した項目、取得できた場合はHTTP状態・再試行時間を確認できます。「投稿結果を照会」が失敗したときは、結果を確認するまで新しい投稿を作らず「状態を再確認」を使います。

「クリップをXの下書きに添付」の修復レポートでは、タブの受付・起動は [ShareClipClipboard.js](../../src/ShareClipClipboard.js)、管理拡張とXの受け渡しは [x-draft-transfer.cjs](../../packages/external-playback/x-draft-transfer.cjs) から確認します。「Xの受け取り待ち」は起動を要求した後、Xから受け取りを確認できていない段階です。「通常のブラウザータブで下書きを開く」では本文を渡しており、動画を添付するには完成画面のコピーまたは保存を使います。再現試験は [task1112-x-draft.cjs](../../test/browser/task1112-x-draft.cjs) です。

Task1121では、転送率が100%になると、Xの画面で添付を確認できるまで「添付完了を待っています」と表示します。受け取り開始後に90秒間進まない場合、または自動添付開始から10分経っても完了しない場合は、停止した段階を通知履歴で確認できます。先にXの添付欄を確認し、添付されていなければ完成画面に残ったMP4を使えます。検査には [管理拡張の通知欠落・保存停止を再現するテスト](../../packages/external-playback/x-draft-transfer.test.cjs) があります。

Task1122では、転送率100%の後にもX側の確認があります。「Xで動画を準備中」は、同じ下書きで処理中の表示を確認した段階です。動画の添付表示・操作可能な投稿ボタン・動画の進捗表示の終了がそろうと、次の予約へ進みます。準備中のままなら最長5分、受け取り後に準備状態を識別できなければ90秒で、自動確認を終えて理由を通知します。X側に動画が残っている場合は、同じファイルをもう一度添付する前に、開いている下書きの状態を確認してください。[X投稿画面の状態判定](../../packages/external-playback/x-clip-attachment.cjs)

Task1123では、同じ下書きの「メディアを準備中」、添付欄の「アップロード中（%）」、投稿ボタンの有効化を順に観察できます。転送率100%はブラウザー内でファイルを渡した割合です。アップロード率はXが添付欄に表示した値で、文字数カウンターやリンクカードは除外します。受け取り後にXの状態が読めないまま90秒、準備・アップロードが5分間進まない場合、またはXに渡してから20分で、自動確認を終えます。添付は繰り返さず、最後の段階と取得できた割合を確認してください。別タブ表示中の再現には、ローカルのChromeを指定して `node test/browser/task1112-x-draft.cjs --background-tab` を使います。

完成画面から同じ動画をコピーしてXで投稿できた場合は、自動添付時に選んだ投稿欄と、Xの動画読み込み開始時のタブの表示状態を確認します。Task1124ではホームのインライン投稿欄が先に現れる場合を回帰試験で再現しています。Chromeで5分02秒・約87 MiBの検証用MP4を転送した試験では、背面では動画の長さが読めず、同じタブを手前に表示すると読み込みが完了しました。実際の下書きで停止原因を判定するときは「メディアを準備中」という表示だけで判断せず、前面にした後に送信率が出るかも確認してください。

Task1125の共有メニューやキーで問題が出た場合は、[共有ボタン](../../tools/typescript-stage1/nico-src/VideoHoverMenu.ts)、[キー入力](../../tools/typescript-stage1/nico-src/ShortcutKeyEmitter.ts)、[コマンドの受け取り](../../tools/typescript-stage1/nico-src/RootDispatcher.ts)、[共有処理の呼び出し](../../src/VideoSharePanel.js)の順に確認します。ニコニコ経由は押した時点の動画と区間で自動投稿します。Zenzaは元の動画全体を予約し、Xの下書きの添付完了を確認します。どちらも管理拡張と外部サービスを模擬する[実ブラウザ試験](../../test/browser/task1125-quick-share.cjs)で検査できます。

Xのコンソールに `ZENZA_EXT` の `scope: companion` と `overlay: 1` が出た場合は、外部ページ用Zenボタンの記録です。添付や投稿の成否は、元のタブの「クリップをXの下書きに添付」レポートで確認します。動画の容量、X受領後の経過時間、最後に確認した段階が手掛かりです。広告計測や `live_pipeline/events` のブロック、Xの画面で発生したCSPエラーだけでは、動画送信に失敗したかは判別できません。

### 通常再生とクリップで見えるコメントが違うとき

まず元動画の同じ位置で、増量データが読み込み済みか、NGと同時表示件数の設定がどうなっているかを確認します。Zenzaの書き出しは [ShareClipRenderer.js](../../src/ShareClipRenderer.js) で元動画の区間を確定します。コメント抽出・表示の回帰テストは [CommentClipSnapshotTest.js](../../test/unit/CommentClipSnapshotTest.js) と [task1094-clip-renderer.cjs](../../test/browser/task1094-clip-renderer.cjs) です。ニコニコのサーバーで作る公式クリップの表示内容はニコニコ側が決めます。

### コメントを取得できたのに表示準備に失敗したとき

通知が「コメントは取得済み」と伝えている場合は [CommentPlayer.ts](../../tools/typescript-stage1/nico-src/CommentPlayer.ts) の `setComment` と、応答形式に応じた変換処理を確認します。通常コメントと先読み済みコメントの再現試験は [CommentRequestLifetimeTest.js](../../test/unit/CommentRequestLifetimeTest.js) にあります。

### 再生ボタンを押しても最初の映像が出ないとき

通知履歴で「再生開始の修復レポート」を開き、「修復レポートをコピー」を使います。最後に成功した処理、次に待っていた処理、操作からの経過時間、調査を始めるファイルが一緒に入ります。例えば「HLS配信リストの解析」に成功して「映像メタデータの受信」を待っていれば、配信URLは取得済みです。`tools/typescript-stage1/hls-src/HlsVideoElement.ts` で配信リスト受信後に動画要素へデータが届く経路を確認してください。同じ時刻にAPIの修復レポートもあれば、HTTP状態や欠けた応答項目が手掛かりになります。

15秒は待機を記録する目安です。再生を打ち切るタイムアウトではありません。画面を閉じたり動画を切り替えたりすると、その試行の監視を終了します。仕様変更か回線の遅延かは、待ち時間だけからは判定できません。段階名と編集元の対応は [PlaybackStartupTrace.js](../../src/PlaybackStartupTrace.js)、再現試験は [PlaybackStartupTraceTest.js](../../test/unit/PlaybackStartupTraceTest.js) にあります。

## 不具合を見つけた人へ

プレイヤーの操作バーで「通知履歴」を開き、問題が起きた記録を選んで「修復レポートをコピー」を押してください。コピーを許可していないブラウザでは、画面に出た報告文を選択してコピーできます。AIや保守担当にはその文と、「検索結果でZenを押した」「通常コメントは見えるが『コメント増量』の読込ボタンで追加できない」など直前の操作を伝えてください。HARを用意する必要はありません。

プレイヤー自体が開かないときは、通知履歴も開けないことがあります。その場合は、スクリプト管理画面にあるZenzaWatchの版、ブラウザとスクリプト管理拡張の名前・版、どの画面のどの操作で止まるかを伝えてください。検索語、視聴履歴、動画の題名は省いてかまいません。

## 症状から調べる

| 症状 | 最初に確かめること | 編集する元ファイル・試験 |
|---|---|---|
| ニコニコを開いた直後や再読み込みで白い時間が長い | 同じ検索ページと動画ページで、本体の有効・無効を切り替えてそれぞれ再読み込みする。Chrome の Performance で、HTML の応答開始（TTFB）、最初に内容が描画された時点（FCP）、Zenza の起動時刻を比べる。初めて開いたときと再読み込みは分け、順番を入れ替えて数回確認する。検索では、動画名と最初のサムネイルが見えた時刻も確認する。広告や読み込み中の枠が表示された時点で FCP が記録される場合がある | [描画待ちの条件と単体試験](../../packages/external-playback/ordinary-startup.test.cjs)（`npm run test:external`）・[ページへの読み込み](../../packages/external-playback/build-shells.cjs)・[プレイヤー起動](../../src/boot.js)・[二重読み込みの検査](../../test/browser/task1059-startup-boot.cjs) |
| 検索結果にZenが出ない、押しても最初の動画が開かない | 検索結果が出た瞬間に一度だけマウスを置き、Zenを一度押す。ボタンが出るまで、クリック後にZenzaの動画要素へ最初の映像が出るまでをそれぞれ確認する。通常の検索リンクは従来の動作を保つ | [ボタンの受付](../../tools/typescript-stage1/nico-src/HoverMenu.ts)・[プレイヤーの準備](../../tools/typescript-stage1/nico-src/initializer.ts)・[動画情報の引き継ぎ試験](../../test/unit/Task1101FirstOpenPageReadTest.js)・[準備中クリックのChrome試験](../../test/browser/task1096-search-startup.cjs) |
| 動画は動くが通常コメントが読めない | 日時指定の過去ログと「コメント増量」でも失敗するか。形式エラーなら欠けた項目名、権限・通信エラーならその分類を確認する | [コメント取得の共通仕様](../../packages/comment-history/src/core.mjs)・[通常取得の制御](../../tools/typescript-stage1/nico-src/ThreadLoader.ts)・[両経路の再現テスト](../../test/unit/NvThreadReadContractTest.js) |
| 日時指定の「過去ログ」が切り替わらない | 日時を選んで再読み込みするときの `when` と対象動画を確認する。通常のコメント取得と同じ読み込み口を使う | [日時指定での再読み込み](../../tools/typescript-stage1/nico-src/NicoVideoPlayerDialogComments.ts)・[日時と増量の組合せ試験](../../packages/comment-history/tests/wayback-history.test.mjs) |
| 「コメント増量」の読込・追加取得が止まる | 通常コメントの読込完了後に「読込」を押す。「自動で増量」、対象時刻、かんたんコメントの取得条件、停止したかを確認する | [履歴の通信](../../packages/comment-history/src/transport.mjs)・[ページ取得と取消](../../packages/comment-history/src/session.mjs)・[再試行の制御](../../packages/comment-history/coordinator-src/coordinator.ts) |
| 検索結果からプレイヤーや設定が開かない | サムネイルの「Zen」と通常のリンクを区別する。Zenが出ないのか、押した後に止まるのかを記録する | [検索結果のクリック](../../tools/typescript-stage1/nico-src/HoverMenu.ts)・[起動](../../src/_template.js)・[検索から設定までのブラウザ試験](../../test/browser/task1096-search-startup.cjs) |
| プレイヤーが開いても映像が始まらない | 動画情報の取得と、配信URLを受け取るための再生許可のどちらで止まったかを見る。視聴ページの取得が終わった後も配信URLの要求が始まらない場合は、補助情報のヘッダー応答と本文の完了を分けて確認する。V4の投稿者・シリーズは5秒、投稿者補完のニコニ広告は3秒で、応答本文の途中停止も打ち切る。[最初の操作と本文停止の回帰試験](../../test/unit/Task1101FirstOpenPageReadTest.js) | [動画情報](../../tools/typescript-stage1/nico-src/VideoInfoLoader.ts)・[再生許可](../../tools/typescript-stage1/nico-src/VideoSessionWorker.ts)・[動画情報の失敗試験](../../test/unit/VideoInfoLoaderErrorResponseTest.js) |
| 公式プレイヤーのZenボタンだけ消えた | 表示設定と、公式のコメント表示ボタンがあるページかを確認する。検索結果から起動できるかも確かめる | [公式プレイヤーの配置・切替](../../tools/typescript-stage1/nico-src/initializer.ts)・[ボタンとキーの試験](../../test/browser/task1092-official-manual-launch.cjs) |
| 映像は再生できるがクリップの場面画像が出ない | シークバーにも同じ場面画像があるかを確認する。画像の取得とクリップの投稿は別の操作 | [場面画像の取得](../../tools/typescript-stage1/nico-src/StoryboardInfoLoader.ts)・[場面画像の共有試験](../../test/unit/ClipStoryboard1095Test.js) |
| 流れるコメントの動きが粗い・密集時だけ変わる | 上級者設定の「コメント表示 → 表示・配置」でフレームレートを確認します。「密度に合わせる」は表示中の横に流れるコメント60件以上で指定のfps、40件以下で画面に合わせた表示です。動画自体のフレーム落ちと区別して調べます。 | [コメント描画](../../tools/typescript-stage1/comment-src/NicoCommentCss3PlayerView.ts)・[設定の定義](../../tools/typescript-stage1/advanced-src/ModernAdvancedSettingsModel.ts) |
| コメントを消しても映像が引っかかる | 映像の総フレーム数と落ちたフレーム数、再生時刻、コメント非表示の初回と切替後を比較します。多数のコメントの初期計測が連続していないか、書き出しや録画がまだ動いていないかも確認します。 | [映像フレームの回帰試験](../../test/browser/task1113-hidden-video.cjs)・[コメント計測](../../tools/typescript-stage1/comment-src/NicoChatGroupViewModel.ts) |
| 上級者設定・共有が最初のクリックで開かない | 通常ページでは同梱の追加コードを初回だけ読み込みます。配布元の組み合わせと、開き直したときに再試行できるかを確認します。 | [画面の遅延読み込み](../../packages/external-playback/optional-panels.cjs)・[初回と再表示の検査](../../test/browser/task1113-optional-panels.cjs) |
| 通常再生で流れるコメントだけが瞬間的に止まる | 動画の再生時刻が進んでいるか確認し、メインスレッドに負荷をかけたブラウザー試験で実際の画面の動きを比較します。移動のアニメーション、表示時刻、再生・一時停止時の同期を順に確認してください。 | [コメント移動の正本](../../tools/typescript-stage1/comment-src/NicoChatCss3View.ts)・[表示と再生時刻](../../tools/typescript-stage1/comment-src/NicoCommentCss3PlayerView.ts)・[画面の回帰試験](../../test/browser/task1112-main-comment-motion.cjs) |
| 場面画像は出るが、選んだ時刻のプレビューやMP4作成で止まる | 場面画像と映像・音声は別々に取得します。修復レポートで `clip-preview`（独立プレビュー）、`clip-playlist`（配信一覧）、`clip-segment`（映像・音声の断片）、`clip-conversion`（入力の解析と書き出し）を確認します。HTTPの状態と「読めなかった項目」も手がかりになります。 | [区間プレビュー](../../src/ShareHlsPreview.js)・[再生位置の待ち合わせ](../../src/ShareClipTimeline.js)・[区間データの取得](../../src/ShareHlsClipSource.js)・[変換](../../src/ShareFastClip.js) |
| 場面画像は出るが公式クリップを作れない | レポートの操作欄を確認する。利用確認、生成、状態確認、投稿で調べる通信が変わる | [公式クリップ連携](../../src/ShareOfficialClip.js)・[模擬応答での試験](../../test/unit/ShareOfficialClipTest.js) |
| 完成したMP4をXの下書きに添付できない | Task1112の `showTask@65180` は完成メッセージの加算演算子が配布時に消えたエラーです。[ビルド時の字下げ処理](../../build.js)と[配布版でMP4を生成する試験](../../test/browser/task1105-x-result-panel.cjs)を確認します。クリップ完成と下書きへの添付結果を別々に確認します。自動添付に失敗した場合も、完成画面から同じファイルを手動で添付できます。 | [クリップの完了処理](../../src/ShareClipJobs.js)・[動画のコピー](../../src/ShareClipClipboard.js)・[タブ間転送](../../packages/external-playback/x-draft-transfer.cjs)・[X側の添付](../../packages/external-playback/x-clip-attachment.cjs) |
| 下書きへのコピーまたは添付が失敗する | コピー元の許可・容量と、X側でファイルを読み込む操作を確認する。実ファイルを使った回帰試験で元データと添付後のハッシュを照合できる | [クリップボード形式](../../src/ShareClipClipboard.js)・[Xの下書きへの添付](../../packages/external-playback/x-clip-attachment.cjs)・[完成画面からの試験](../../test/browser/task1105-x-result-panel.cjs) |
| 通知が記録されない、レポートをコピーできない | 通知履歴の記録設定を確認する。保存された記録、表示、クリップボードへの書き込みの順に切り分ける | [診断の分類](../../tools/typescript-stage1/nico-src/RequestDiagnostics.ts)・[通知の記録](../../tools/typescript-stage1/nico-src/NotificationJournal.ts)・[履歴の画面](../../tools/typescript-stage1/nico-src/NotificationHistoryPanel.ts)・[操作試験](../../test/unit/NotificationHistoryPanelTest.js) |

## 「コメント増量」やほかのコメント操作を調べる

「過去ログ」は指定日時のコメントを読み直す機能です。「コメント増量」は通常取得の結果を土台に、過去のページをたどってコメントを追加します。日時指定の過去ログで増量を始めたときは、その指定日時が追加取得の起点です。

| 画面で起きたこと | 最初に開く場所 |
|---|---|
| 増量ボタン・自動で増量・読込・停止が効かない | [増量パネル](../../packages/comment-history/src/panel.mjs)・[状態と世代の管理](../../packages/comment-history/src/controller.mjs)・[操作試験](../../packages/comment-history/tests/compact-panel.test.mjs) |
| 読み込み済みの追加分と表示件数が合わない、非表示にして戻すと消える | [表示・キャッシュの制御](../../packages/comment-history/src/controller.mjs)・[通常コメントとの合成](../../packages/comment-history/src/layers.mjs)・[件数変更と追加通信の試験](../../packages/comment-history/tests/applied-count.test.mjs) |
| 追加分が別の動画に残る、停止後の古い返答が反映される | [通常コメントの読み込みと動画の切替](../../tools/typescript-stage1/nico-src/NicoVideoPlayerDialogComments.ts)・[増量セッション](../../packages/comment-history/src/session.mjs)・[動画切替の試験](../../packages/comment-history/tests/controller.test.mjs) |
| コメントを投稿できない／ニコる・投稿者による削除だけ失敗する | [投稿内容・投稿先](../../tools/typescript-stage1/nico-src/CommentPostWire.ts)・[ニコる・削除](../../tools/typescript-stage1/nico-src/ThreadLoader.ts)・[投稿](../../test/unit/CommentPostContractCheckTest.js)・[ニコる](../../test/unit/NicoruThreadOwnershipTest.js)・[削除](../../test/unit/CommentDeleteFailureOwnershipTest.js)の模擬試験。読み込み専用APIとは担当が異なる |
| 取得件数はあるのに画面上のコメントや一覧が想定と違う | [画面上の配置](../../tools/typescript-stage1/comment-src/CommentLayoutWorker.ts)・[コメント一覧](../../tools/typescript-stage1/nico-src/CommentPanel.ts)・[複合NGの判定](../../tools/typescript-stage1/advanced-src/NgCompositeRules.ts)。増量分と通常分の合成は上の表示・キャッシュの欄へ |

## 関連メニューやタグの最初のクリックが効かないとき

周囲のページから、動画の上を通らず、表示中の「関連メニュー」かタグに直接ポインターを移してクリックします。動画の上を通ったときだけ反応するなら、[ヘッダーの表示条件とクリックの当たり判定](../../tools/typescript-stage1/nico-src/VideoHeaderPanel.ts)を調べてください。開いているヘッダーと、映像に重ねて隠したヘッダーの両方を[Chromeの初回操作試験](../../test/browser/task1100-first-panel-click.cjs)で確認できます。タグ編集画面が開いた後に一覧・更新だけが失敗する場合は下表の通知を見ます。

## 検索・一覧・コメント操作・場面画像を修理するとき

通知履歴で失敗した操作を選び、「修復レポートをコピー」を押します。HTTP は通信先から返った状態、API は応答本文でニコニコが返した状態です。たとえば HTTP 200・API 403 なら、通信は届き、サービスがその操作を拒否しています。

| 起きたこと | 確認する点と編集元 |
|---|---|
| 検索や投稿者の動画一覧が空になった | 検索条件に一致する動画が0件なら正常です。応答形式の記録があるときは、[VideoSearch.ts](../../tools/typescript-stage1/nico-src/VideoSearch.ts) の検索、検索データの更新日時、投稿者一覧のうち該当する処理を調べます。 |
| 関連動画やシリーズだけが出ない | 「関連動画・シリーズ」の記録を見て、[RecommendAPILoader.ts](../../tools/typescript-stage1/nico-src/RecommendAPILoader.ts) の取得・応答判定を確認します。動画を切り替えた直後なら[表示側](../../tools/typescript-stage1/nico-src/RelatedVideoList.ts)の対象切替も確認します。 |
| マイリスト・あとで見る・連続再生で一部しか並ばない | 一覧の表示は [MylistApiLoader.ts](../../tools/typescript-stage1/nico-src/MylistApiLoader.ts)、連続再生用の一覧やショート動画は [PlaylistApiLoader.ts](../../tools/typescript-stage1/nico-src/PlaylistApiLoader.ts) を調べます。空の一覧、途中ページの失敗、中止後の再読込は[一覧の試験](../../tools/typescript-stage1/test/task1099-list-reads.test.mjs)で個別に再現できます。 |
| コメント投稿・ニコる・削除が完了しない | 投稿用キーや投稿結果の必須項目は [CommentPostWire.ts](../../tools/typescript-stage1/nico-src/CommentPostWire.ts)、追加認証・ニコる・削除は [ThreadLoader.ts](../../tools/typescript-stage1/nico-src/ThreadLoader.ts) を確認します。送信後に応答が途切れた場合は、もう一度押す前にコメント一覧を再読込して結果を確認してください。 |
| 動画の「いいね！」や取り消しが反映されない | [LikeApi.ts](../../tools/typescript-stage1/nico-src/LikeApi.ts) で操作の結果を判定します。HTTP が成功でも、本文にエラーがあれば失敗です。 |
| シークバーとクリップの両方で場面画像が出ない | [VideoSessionWorker.ts](../../tools/typescript-stage1/nico-src/VideoSessionWorker.ts) で場面画像の取得許可と画像一覧の読込を、[Storyboard.ts](../../tools/typescript-stage1/nico-src/Storyboard.ts) で表示対象の切替を確認します。取得許可で `data.contentUrl` が欠けた場合も判別できます。保存済みの画像を表示できても、新たな通信の復旧は未確認です。 |
| タグの追加・削除が反映されない | 「タグ一覧」「タグの追加」「タグの削除」「タグ編集キー」のどこで失敗したかを見て、[TagEditApi.ts](../../tools/typescript-stage1/nico-src/TagEditApi.ts) を開きます。`data.tags[].name` はタグ一覧の各行、`data.tag.edit.editKey` は編集キーの項目です。 |
| タグ候補・大百科の表示がおかしい | 「タグ候補」の `candidates` は[候補取得](../../tools/typescript-stage1/nico-src/TagSuggestLoader.ts)、「大百科」の `articles[].request_title` と `articles[].title` は[記事の一括照会](../../tools/typescript-stage1/nico-src/NicodicArticleLoader.ts)です。どちらも空の結果は正常です。 |
| 「あとで見る」やマイリストへの追加・削除が反映されない | 追加先と操作が通知名に出ます。[MylistApiLoader.ts](../../tools/typescript-stage1/nico-src/MylistApiLoader.ts) で該当する書き込みの応答を確認し、[模擬試験](../../tools/typescript-stage1/test/task1100-mylist-writes.test.mjs)で再現します。送信結果が分からないときは一覧を再取得してから次の操作を判断します。 |
| 「続きから」の再生時刻が更新されない | ニコニコ側への保存は「再生位置の保存」です。[PlaybackPosition.ts](../../tools/typescript-stage1/nico-src/PlaybackPosition.ts) のPUT応答を確認します。空の成功応答（204など）を許容し、本文があるのにAPI状態が読めない場合はその項目名を記録します。端末内だけのしおりは別の保存経路です。 |

上の操作をアカウントへの書き込みなしで検査するには、リポジトリ直下で `npm.cmd run test:core-repair` を実行します。直した機能の行に対応する試験を最初に確認してください。

## Zenを押しても映像が始まらないとき

| 画面で分かること | 報告に含めること | 保守担当が最初に確認する場所 |
|---|---|---|
| 検索結果にZenが現れない、または押してもプレイヤーの枠が開かない | スクリプト管理画面の版と、どちらの操作で止まったか。Chromeでは F12 →「コンソール」で `[ZenzaWatch] 起動診断` を検索する。本体の初期化が失敗していれば、その固定文だけを添える。スクリプト自体が実行されていなければ固定文も出ない | [起動処理](../../src/boot.js)・[検索結果から設定を開くブラウザ試験](../../test/browser/task1096-search-startup.cjs) |
| プレイヤーは開くが動画情報を読み込めない | 「通知履歴」で「動画情報」（`video-info`）の記録を開く。HTTP状態と読めなかった項目を確認する | [視聴ページと動画情報の読み込み](../../tools/typescript-stage1/nico-src/VideoInfoLoader.ts)・[応答エラーの試験](../../test/unit/VideoInfoLoaderErrorResponseTest.js) |
| タイトルは出るが映像が始まらず、「再生セッション（映像の配信URL取得）」の記録がある | `video-session` の修復レポートをコピーする。HTTP 403なら視聴条件を確認する。HTTP 200でも `data.contentUrl` が欠けていれば配信URLを読み取れなかった状態。旧配信方式では `data.session.content_uri` が該当する | [配信URLを受け取る処理](../../tools/typescript-stage1/nico-src/VideoSessionWorker.ts)・[応答と復旧の試験](../../test/unit/Task1098PlaybackSessionDiagnosticsTest.js) |

修復レポートにHTTP状態とAPI状態が両方ある場合、HTTP状態は通信の返答、API状態はその本文にある判定です。たとえばHTTP 200でもAPI状態が401なら、通信は届いていても要求は拒否されています。

映像がすでに動いていてシークバーの場面画像だけが出ない場合は通知履歴の「場面画像の情報」（`storyboard`）を確認してください。配信URL取得の記録がなく黒画面になるときは、再生が一度でも始まったか、音声は聞こえるかも伝えてください。

## コメント取得キーの更新で止まったとき

- **「コメント取得キーの更新」（`comment-key`）** が失敗したら、キーをもらう段階を調べます。`data.threadKey` は返答に必要な項目の名前です。キーの値を調べたり共有したりする必要はありません。通常取得とコメント増量が使うURLと返答の読み方は[コメントAPIの共通仕様](../../packages/comment-history/src/core.mjs)にあります。
- **「コメント増量」（`comment-history-read`）** に `INVALID_TOKEN` があれば、取得したキーで追加分を読もうとして拒否された段階です。直前にキー更新に失敗し、その後成功した場合は、キー更新の記録が「復旧済み」になります。増量自体が成功したかは増量側の記録・パネルの追加件数で確認します。通常取得の呼び出し元は[ThreadLoader](../../tools/typescript-stage1/nico-src/ThreadLoader.ts)、増量の呼び出し元は[履歴の通信処理](../../packages/comment-history/src/transport.mjs)です。

## コメント取得の仕様が変わったとき

通常取得・日時指定の過去ログは `comment-read`、コメント増量による追加取得は `comment-history-read` として記録されます。両方が使う `POST /v1/threads` の送信形式は `buildNvThreadReadRequest`、応答の共通部分は `readNvThreadEnvelope` にあります。いずれも上の「コメント取得の共通仕様」にあります。通常取得の言語切替・日時指定と、コメント増量のページごとの追加取得、各経路の再試行や取消はそれぞれの呼び出し元が担当します。

たとえば `RESPONSE_SCHEMA` と `data.threads` が出たときは、読み込みに成功した形の返答からスレッド一覧を読めなかった可能性があります。一覧が空の動画でも起きるか、同じ版で複数の動画に共通するかを確かめます。HTTP 403なら視聴条件・認証、タイムアウトなら通信状態から調べます。エラー表示を消すために空のコメント一覧を返すと、修正が効いたか判断できなくなります。

2026年11月19日の未ログインのChromeでは、公開動画で通常コメント711件を取得した後、「コメント増量」は取得キーを更新しても HTTP 400 `INVALID_TOKEN` となりました。レポートにこのコードがある場合は取得キーが拒否されています。通常コメントの件数、増量だけで起きるか、ログイン状態を確認してください。取得キーそのものを貼り付ける必要はありません。この一例から、すべての動画やログイン状態の利用条件は判断できません。 手元のHARに残っていた日時と取得件数を指定した成功応答（HTTP 200）は、コメント0件の1スレッドとして同じ読み込み処理で受理できました。「成功して0件」と「取得キーが拒否されて0件」は区別してください。

1. 下の「短い検査」を実行し、現在の結果を控えます。現行の模擬データで通っても、実サイトが同じ形式を返した証明にはなりません。
2. 必要な構造だけを残した架空の応答を[両経路の再現テスト](../../test/unit/NvThreadReadContractTest.js)に加えます。例えば「必須項目だけが欠けた応答」と「項目はあるが一覧が空の正常な応答」を区別します。直す前に、予想した理由で失敗することを確かめます。
3. 共通の仕様を直し、生成し直してから短い検査を実行します。新しい形式・既存の形式と、通常取得・コメント増量の両経路を確認します。
4. 実機では公開動画を開き、通常コメントの表示、日時指定での再読み込み、「コメント増量」の読込と停止・表示件数の変更、動画切替後に前の追加分が混ざらないことを確認します。非公開の開発版を統合する前の全体検査は [AGENTS.md](../../AGENTS.md) にあります。

### 短い検査

非公開の開発リポジトリの一番上で実行します。Windows PowerShellの例です。初めての作業用フォルダでは、先に `npm.cmd ci`、`npm.cmd --prefix tools/typescript-stage1 ci`、`npm.cmd --prefix packages/comment-history ci` を実行します。

```powershell
npm.cmd run test:comment-repair
```

起動・動画情報・配信URL取得を切り分けるときは、同じ場所で次を実行します。どちらの検査も実際のアカウントを使わず、異常な返答と修正後の動作を再現できます。

```powershell
npm.cmd run test:playback-repair
```

元ファイルを編集したときは、次の順番で配布物まで反映します。コメント履歴の共通ソースは `.mjs`、通常取得・診断・履歴画面の元ファイルは `tools/typescript-stage1/nico-src/` の `.ts` です。`src/generated/`、生成元が先頭に記載された `.js`、`dist/*.user.js` への手修正は、次回の生成で上書きされます。

```powershell
npm.cmd --prefix packages/comment-history run build:zenza
npm.cmd --prefix tools/typescript-stage1 run nico:sync
npm.cmd run build
npm.cmd run test:comment-repair
```

ほかのAPIは[用途別の索引](../research/API_QUICK_REFERENCE.md)から探せます。コメントの取得だけを調べる場合は `python tools/research_lookup.py --id comment.read --related` で担当ソースと根拠を確認できます。

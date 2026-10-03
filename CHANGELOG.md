## Task217 — コメント解析結果の再利用・NGユーザー検索の高速化

取得済みNicoChatごとに本文とHTML5/Flash方式が一致する解析済みHTMLを弱参照で再利用。本文/方式/パーサー変更で再解析し、原本データや永続保存形式は変更しない。NGユーザーは保存/UIの配列を維持し、判定バッチ内の検索をSetへ変更。寸法・配置・CA保護・取得量は従来どおり。時間予算＋0msタイマーの候補は実測で悪化したため採用せず、従来待機を維持。

## Task209 — 過去ログの日付指定を修正（2.7.137-task209）

- スレッドIDを投稿日時として扱わず、実際の動画投稿日時を下限に使用。不明な場合は下限を作らない。秒単位の指定、不正・未来日時の送信防止、Backの読込成功前に表示だけ現在へ戻らない修正を追加。
- 過去ログの失敗通知に検証済みHTTP状態・エラーコードを表示。認証情報や任意の応答本文は通知へ入れない。
- Task208の不要な関連作品JSON保存の削除も配布版に含む。提案中のUI10案・CA保護・高速化実験は今回の製品変更に含めない。
- 検証範囲：実ソースの自動回帰と隔離Chromeの日付入力・マウス操作。ログイン済みの過去ログAPIへの成功を保証する確認は未実施。

## Task208 — remove unwanted content-tree JSON export

ユーザー指定により、関連メニューの親作品・子作品JSON保存、対応コマンド、保存を勧める通知を削除。コンテンツツリー閲覧・プレイリスト追加・途中再開は維持。

## Task212 — コメントアートの可逆な配置保護（2.7.139-task212 / Advanced 0.3.35-task212）

- CA/パティシエ/full/enderや複数行を根拠に、投稿者・thread/fork・元レイヤー・投稿区間で部品を保守的にまとめ、元コメントを変更せず描画用の衝突レイヤーだけ分離。
- 同じ種類・同じ再生位置で始まる推定CA部品は、Task206の有限表示枠で一部だけ欠けないようグループ単位で採否。owner/自分の投稿、表示開始済み寿命、通常>かんたん>AI>増量の優先は維持。
- 上級者設定に「コメントアートの配置を保護する」を追加（初期ON）。OFFで元データ・増量キャッシュを再取得/破棄せず従来配置へ戻す。切替3グループの一部失敗時は全体を元配置へロールバック。
- 本家keepCAの全文重複削除やスケール変更は移植せず、欠けた取得/NG/適用範囲やフォント差の復元は行わない。新しいコメント増量パネルUI案は未反映。
- 詳細は `docs/design-pack/TASK212_COMMENT_ART_PROTECTION.md`。

## Task210 — コメント配置探索の索引化（2.7.138-task210）

- 衝突探索の開始位置を、各位置までの終了時刻の最大値から二分探索する方式へ変更。時間的に絶対に重ならない過去コメントの再走査を省く。
- 元の配置順・衝突条件・レイヤー・overflow時の乱数順を維持。入力時刻の並び、重複ID、NaN等の境界は従来互換を優先。
- 新UI・CA保護はこのTaskに含めない。詳細は `docs/design-pack/TASK210_COMMENT_LAYOUT_INDEX.md`。

## Task213 — 過去ログ中のコメント増量を再対応（2.7.140-task213 / Advanced 0.3.36-task213）

- 過去ログ(TimeMachine)表示中、コメント増量パネルが`UNSUPPORTED_WAYBACK`で`unavailable`となり「取得し直す」が無効化されていた問題を修正。
- 成功したwayback結果の選択日時`when`を履歴取得の開始境界として保持し、初回取得と「取得し直す」は同じ日時からさらに古いコメントを取得する。
- current/waybackフラグと日時が矛盾する入力、0/未来/不正日時は引き続き拒否。現在コメント・投稿状態・Task207キャッシュ/適用数は変更しない。
- package回帰に、wayback seed・境界検証・同一日時restartの3件を追加。

## Task215 — コメント投稿失敗の構造化診断ログ（2.7.141-task215）

- コメント投稿ごとに相関IDを付け、precheck / post-key / post / ack / retry-refresh / complete の各段階、試行回数、HTTP状態、エラーコード、timeout種別、再試行有無、送信前/成否不明/拒否/成功をConsoleで追跡可能にした。
- 投稿中の再送、未ログイン、コメント準備前、投稿先なし等の通信前拒否も `[ZenzaWatch][CommentPost]` で理由を記録する。
- postKey応答のchallenge要求有無と、ACK不完全時の「値ではなく形」だけを記録。JSON解析失敗でもヘッダー取得済みならHTTP statusを診断用に保持する。
- コメント本文、コマンド文字列、userId、postKey/threadKey、challenge token、Cookie/認証情報はログへ出さない。既存のtoken再取得1回、timeout、二重投稿防止、送信bodyの動作は変更しない。
- focused投稿/ログ安全性テスト41件を通過。詳細は `docs/design-pack/TASK215_COMMENT_POST_DIAGNOSTICS.md`。

# Changelog

このプロジェクト（ZenzaWatch改良版）の変更履歴です。
[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に準じた形式でまとめています。

現時点ではバージョンタグでのリリース管理を行っていないため、これまでの改修内容は
すべて `[未リリース]` セクションにまとめています。各項目の詳しい調査・修正内容は
`docs/design-pack/` 以下の対応するタスク文書を参照してください。

## 作業ごとの変更履歴（新しい順）

機能ごとのまとめは [CHANGES_FROM_UPSTREAM.md](./CHANGES_FROM_UPSTREAM.md) を参照してください。
「〔確認中〕」は、実装済みで実際の環境での確認がまだ終わっていないものです。

### Task 207（2026-10-03） ZenzaWatch-dev 2.7.135-task207 / ZenzaAdvancedSettings 0.3.34-task207
- コメント増量に「適用する件数」（0 / 1,000 / 2,500 / 5,000 / 7,500 / 10,000 / 15,000 / 20,000）を追加。取得済みの増量コメントはメモリーに保持したまま、Zenzaへ適用する件数だけを増減できる。0は「増量前（通常コメントのみ）」でONのまま（OFFとは別）。
- 減らしても取得済みキャッシュは破棄せず、取得済みの範囲内で戻すときは通信しない。取得済みを超える件数を選んだ時だけ、保存済みのカーソルから不足分を取得する。部分失敗時は実際に取得できた件数までしか適用しない。
- 適用する集合は取得順の先頭N件（通常コメントに近い側から）で決定的。減らして外したコメントの表示オブジェクトは同じ動画の間だけ保持して再利用し、重複表示しない。OFF・動画切替では既存どおりキャッシュを解放。
- 「追加する件数」（取得ステップ）に7,500 / 15,000を追加（最大20,000は維持）。パネルに「取得済み N 件 · 適用中 M 件」と内訳を表示。
- 取得目標ちょうどで終わったページを「さらに取得」で再取得していた無駄を修正。続きの取得後も取得順を保つ。
- Task206の同時表示コメント上限とは別の設定。〔確認中〕ログイン済み環境での実取得との組合せ。詳細は `docs/design-pack/TASK207_COMMENT_HISTORY_APPLIED_COUNT.md`。

### Task 206（2026-10-03） ZenzaWatch-dev 2.7.134-task206 / ZenzaAdvancedSettings 0.3.33-task206
- 本家由来の「画面上40件を超えたら流れている途中のコメントを古い順に削除」（`_gcInviewElements` / `MAX_DISPLAY_COMMENT`）を廃止。表示を始めたコメントは寿命まで消さない。
- 期限切れの回収を新着の有無に関係なく毎フレーム先に行い、容量判定の前に除外する。DOM・表示中・見送り・処理済みの管理表を常に一致させる（新着0件でDOMと参照が残る問題、期限切れ40件が新着かんたん1件を押し出す問題を修正）。
- 同時表示上限 `commentLayer.maxDisplayComment`（40/100/200/400/800、初期200）を追加。上級者設定で選択。判定は新着の表示開始前だけで、超過分は理由（limit/reserve）付きで見送り、同じ寿命の間は再判定しない。
- 優先度: owner・自分の投稿（投稿中/失敗を含む）は対象外。通常 > かんたん > AI > 増量（過去コメント）。増量分は上限の75%（かんたん/AIは70%）までで止め、通常コメント用の枠を残す。増量由来の判定は`CommentHistoryRenderer.has()`（読み取り専用）を使い、NicoChatにフラグを足さない。
- 〔確認中〕実際のニコニコ動画での密集場面の確認。詳細と検証範囲は `docs/design-pack/TASK206_COMMENT_DISPLAY_LIFETIME.md`。

### Task 205（2026-10-03） ZenzaWatch-dev 2.7.133-task205
- プレイヤー左下のNGフィルターボタンと、設定パネルの「NGを有効にする」チェック表示を同じ`enableFilter`へ完全同期する。
- 設定パネルが接続中だけ`enableFilter`更新を購読し、開いている時は即再描画。切断時は購読解除し、不要な常駐リスナーを残さない。
- `enableFilter`はNG共有・NGワード・正規表現NG・NGユーザー・NGコマンドのマスタースイッチとして維持し、コメント種類/スレッド種類の表示フィルターとは分離する。
- 小画面モードでNG切替時に一瞬二重に見えたという実機報告は再現待ち。隔離Chromeでは同一`uniqNo`の同時重複は0件で、NG解除時に表示コメント数が増える挙動を確認。今回は描画コードを変更しない。
- NGプリセットと上級者設定UIの大規模改修は将来Taskへ保留。

### Task 204（2026-10-02） ZenzaWatch-dev 2.7.132-task204
- プレイヤー左下のコメント表示ON/OFFボタンの隣に、NGフィルター全体のON/OFFボタンを常時表示する。
- 既存の`enableFilter` / `toggle-enableFilter`をそのまま使用し、NG判定ロジックは変更しない。ON/OFF状態は既存PlayerStateと同期してボタン色に反映する。
- ボタンは32pxの既存menuButtonと同じ配置・状態表現に合わせ、シールド＋斜線のアイコンでコメント表示ボタンと区別する。
- 将来の「各プレイヤーボタンの表示/非表示を上級者設定から共通管理」と「NGフィルタープリセット切替」は別Taskへ分離する。
- 検証: Task204専用5件とZenza全体1,267件が成功。最終distを隔離Chromeへ読み込み、配置・32pxサイズ・物理クリックによるON→OFF→ONでConfig/State/実フィルター/表示状態の同期を確認。

### Task 203（2026-10-02） ZenzaWatch-dev 2.7.131-task203
- MylistPocket 0.5.43-task203も共通URL判定の再生成で更新。上級者設定は0.3.32-task201のまま。
- クリック対象のサムネ削除時とZenza終了時にプレビュー停止の監視・参照を解放する。
- 検証: 全体1,262件、独立コメント取得部品193件、Issue専用38件（全体に含む）。最終配布版の隔離Chromeでは実ページ2経路と合成サムネを使う9項目を確認。ログイン済みの最終版全経路は未確認。
- GitHub Issue #1 の3件を修正。検索/タグのショート一覧URLを動画URLと誤認せず、サムネプレビューをZenza起動時に停止し、☆フォロー新着など公式SPA遷移とZenzaの二重起動を防ぐ。
- URL判定をpath全体＋許可hostで厳密化。Ctrl/Meta/Alt・中/右クリック、外部サイト、live、Zenza自身のUI、動画リンク内の別操作を維持する。
- singletonで別タブのZenzaへ送る場合も、元タブでクリックしたサムネプレビューだけをpointerleaveまで停止する。動画トップの公式「視聴する」は動画リンク本体として扱う。
- ユーザー実機でshort検索誤起動とプレビュー二重再生の修正を確認。フォロー新着の修正前二重起動も再現確認済み。
- プレビュー位置からそのままZenza再生する機能と、別サブドメインへのoverrideWatchLink設定伝播は将来課題として分離した。

### Task 201（2026-10-02） ZenzaWatch-dev 2.7.130-task201
- コメント増量ボタンがマウスで開かない問題を修正。既存の focus-within による pointer-events 無効化から、このネイティブボタンだけを除外する。既存メニューの抑止は維持。
- パネルに zen-family を付け、通常・大・ワイド・3D表示でパネル内部が裏ページとして無効化される問題も修正。
- 実際のツールバー、コマンド伝達、生成モジュール、ZenzaのCSSを通す回帰テストを追加。隔離Chromeの実ページ上でもネイティブマウス入力で再現・修正を確認。
- 上級者設定 0.3.32-task201、MylistPocket 0.5.42-task201を共通生成部品の修正に伴い更新。取得処理・投稿・NG設定の動作は変更しない。

### Task 200（2026-10-02）〔実サイト確認待ち〕 ZenzaWatch-dev 2.7.129-task200
- コメント増量を独立した取得・表示・設定の部品として統合。右下の画面フィルター左に「ふきだし＋プラス」、C-3配置と折りたたみ詳細を追加。
- 初期5,000件、1,000 / 2,500 / 5,000 / 10,000 / 20,000件から選択。取得終了時にまとめて反映し、「さらに取得」で続きから追加（追加分は最大20,000件）。
- ONはページ再読込・次動画にも継承。全タブを対象とし、対応環境では同一サイトの取得を順番待ちにして通信を集中させない。初期状態はOFF。
- OFF・動画切替で増量データを解放。通常コメント、投稿・削除、NG、ニコスクリプトの実行状態を維持する。失敗時は正常な部分結果と停止理由を表示。
- 上級者設定と右下パネルで設定定義を共通化。一覧の閲覧位置・選択・詳細は同じ動画内で保持。
- 開閉・外側クリック・Esc・取得中の脈動・動きを減らす設定に対応。
- ZenzaAdvancedSettings 0.3.31-task200、MylistPocket 0.5.41-task200も共通設定の再生成に伴い更新。
- 自動テストと模擬UI試験を実施。統合版をログイン済み実サイトで動かす確認は未実施。全履歴を取得できるという保証はしない。

### Task 199（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.128-task199
- 「親作品・子作品の一覧を保存（JSON）」に、動画だけでなく生放送・イラスト等も含む全作品のIDと種類を残す。途中で失敗して続きを取得した時も、前半と後半を1つの取得結果にまとめ、プレイリストでも後半を前半の後ろへ入れる。
- CommonsTreeExportResumeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 198（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.127-task198
- 親作品・子作品の取得で、途中の応答が矛盾して一部しか取れなかった時に「親作品・子作品は0件でした」と誤って表示しないようにする。正常な0件・未登録・途中失敗・矛盾による一部のみを区別して伝える。
- CommonsTreeOutcomeClassificationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 197（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.126-task197
- 「親作品・子作品をプレイリストに追加」を1回選ぶだけで、直接の親・子の全範囲を最後まで自動で取得してプレイリストへ追加する（Bad Apple!!なら子1,060件を4回の要求で取得し、動画997件を一度に追加）。300件ごとにもう一度選ぶ必要はなくなる。
- CommonsTreeAutoFetchDialogTest.js で再現と正常経路を確認。実機確認待ち。

### Task 196（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.125-task196
- 親作品・子作品のように約1000件の動画IDをプレイリストへ追加する時、1件ずつの詳細取得（約1000回）を待たずに一度で追加し、画面に見えている項目から少しずつ詳細を補完する。上限を超える分は黙って捨てず、件数を報告する。
- PlaylistBulkDeferredTest.js で再現と正常経路を確認。実機確認待ち。

### Task 195（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.124-task195
- 動画情報がまだ無い（IDだけの）プレイリスト項目を保存して読み戻しても「情報不明」のまま扱い、後から同じ項目のまま正しい情報に置き換えられるようにする。
- IncompleteItemPersistenceTest.js で再現と正常経路を確認。実機確認待ち。

### Task 194（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.123-task194
- 親作品・子作品の取得で、直接の親・子の全範囲（例: Bad Apple!!の子1,060件）を1回の操作の中で最後まで取得できる仕組み（ID収集）を追加する。取消・期限・有限の再試行に対応し、途中の異常は理由付きの部分結果にする。
- CommonsTreeFullScanTest.js で再現と正常経路を確認。実機確認待ち。

### Task 193（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.122-task193、ZenzaAdvancedSettings 0.3.30-task193
- 初めて導入したときの「検索でプレイリストに読み込む最大件数」を300件から1000件にする。設定画面の表記は変えない。
- SearchLimitDefaultTest.js で再現と正常経路を確認。実機確認待ち。

### Task 192（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.121-task192
- 親作品・子作品の一覧に付く表示用の情報（タイトル・サムネイル等）を、動画情報が取れなかった作品の表示にだけ使えるようにする。完全な動画情報（長さ・タグ・各種件数）の代わりにはせず、キャッシュにも書かない。この情報の取得（with_meta）は動作確認ができるまで既定で無効。
- CommonsTreeMetaHintTest.js で再現と正常経路を確認。実機確認待ち。

### Task 191（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.120-task191
- 子作品が1000件を超えるような動画で、親作品・子作品の取得が上限（各300件）で止まった時に「全N件中M件目まで」と伝え、もう一度「親作品・子作品」を選ぶとその続きを最大300件ずつ取得できるようにする。自動で大量取得はしない。
- CommonsTreeContinuationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 190（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.119-task190
- 検索で「続きが無い」と返されたらそこで止め、途中のページだけ失敗した時は取れた分を残しつつ「一部だけ」と分かるようにし、一覧が入っていない壊れた応答を「0件」と扱わない。
- SearchResultStateTest.js で再現と正常経路を確認。実機確認待ち。

### Task 189（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.118-task189
- 本家の検索ページや保存した検索条件から連続再生・検索したとき、ページ位置・ジャンル・長さ種別（long/short）・チャンネル動画の掲載（included）が途中で落ちないようにする。確認できていない条件（kind）は送らず、適用していないことを通知に出す。
- SearchConditionFlowTest.js で再現と正常経路を確認。実機確認待ち。

### Task 188（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.117-task188、ZenzaHLS 0.0.32-task188
- HLS.jsでmanifestを読めた時点に出している互換のcanplayを「再生成功」と扱わず、実メディアのcanplay・最初のplaying・再生時刻の進行・最初の映像を別の段階として記録する。
- HlsReadinessStagesTest.js で再現と正常経路を確認。実機確認待ち。

### Task 187（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.116-task187
- 動画Aのヒートマップ作成が動画Bへ切り替えた後に終わっても、それをBのヒートマップとして通知・保存しない。保存は通知に付いた動画IDが今の動画と一致する時だけ行う。
- HeatMapGenerationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 186（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.115-task186
- 投稿キーが取れなかったときはコメントを送信せず、投稿番号が入っていない応答を「投稿成功」として履歴へ残さない。結果が分からない投稿は自動で再投稿しない。
- CommentPostContractCheckTest.js で再現と正常経路を確認。実機確認待ち。

### Task 185（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.114-task185
- コメント投稿・投稿キー取得で、応答のヘッダーが来たあと本文が止まっても30秒で終わらせ、投稿中の状態を解除する。結果が分からない投稿は自動で再投稿しない。
- CommentPostBodyTimeoutTest.js で再現と正常経路を確認。実機確認待ち。

### Task 184（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.113-task184
- 画質・音質の候補を、サーバーの並びに関係なく高い順に並べ、自動選択や先頭候補を使う処理が低い画質・音質を選ばないようにする。
- QualityOrderTest.js で再現と正常経路を確認。実機確認待ち。

### Task 183（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.112-task183
- 投稿先スレッドがない・コメント情報が一部欠けている動画でも再生とコメント読込を止めず、投稿だけを「できない」と明示して、適当なスレッドへは送らない。
- CommentPostTargetTest.js で再現と正常経路を確認。実機確認待ち。

### Task 182（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.111-task182
- Watch V4で補助情報（lazy）が取れない・投稿者を含まない場合も、初期情報にある投稿者・チャンネルを表示に使い、シリーズ情報が一部だけでも例外にしない。
- WatchV4OwnerSeriesFallbackTest.js で再現と正常経路を確認。実機確認待ち。

### Task 181（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.110-task181
- 動画Aで親子作品の取得中に動画Bへ切り替えたり閉じたりしたとき、Aの親子作品がBのプレイリストへ追加・通知されないようにする。
- CommonsTreeRequestLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 180（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.109-task180
- 親作品・子作品の取得で、通信や応答の失敗・途中失敗を「0件」と表示せず、取得できた分は残して不足を伝える。
- CommonsTreeResultTest.js で再現と正常経路を確認。実機確認待ち。

### Task 179（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.108-task179
- 子作品が多い動画で、要求件数より少ないページが返っても取得を打ち切らず、申告総数・上限まで正しくページ送りする。
- CommonsTreePagingTest.js で再現と正常経路を確認。実機確認待ち。

### Task 178（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.107-task178
- 動画の終了（0秒）・閉じる・別動画への切替時の再開位置保存が、直前の一時停止の保存で1秒間引きされて失われないようにする。
- PlaybackPositionFinalSaveTest.js で再現と正常経路を確認。実機確認待ち。

### Task 177（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.106-task177
- 再開位置の保存を公式と同じv2（JSONのvideoId・seconds）へ移し、保存失敗（HTTP/API）を成功扱いしないようにする。
- PlaybackPositionV2Test.js で再現と正常経路を確認。実機確認待ち。

### Task 176（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.105-task176
- コメント投稿キーの取得時に、読み込んだスレッドの言語（X-Niconico-Language）を送るようにする。
- PostKeyLanguageTest.js で再現と正常経路を確認。実機確認待ち。

### Task 175（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.104-task175
- 視聴ページの初期化判定が旧data.response.okReasonだけを読んでいたため、Watch V4の応答でも公式プレイヤー置換などの視聴ページ処理が働くようにする。
- WatchPageDetectionTest.js で再現と正常経路を確認。実機確認待ち。

### Task 174（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.103-task174
- 有料・限定などで再生できない動画を開いたとき、通常ログへ視聴応答全体（lazy/認証/配信/スレッドキー、署名URL）を出さず、理由と動画IDだけを記録する。
- UnavailableVideoLogSafetyTest.js で再現と正常経路を確認。実機確認待ち。

### Task 173（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.102-task173、ZenzaHLS 0.0.31-task173
- HLS.jsで再生できる環境では最初からHLS.jsで開き、Native HLSが先に取得した鍵とHLS.jsの再取得鍵が食い違う再生失敗を避ける。
- HlsEngineSelectionTest.js で再現と正常経路を確認。実機確認待ち。

### Task 172（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.101-task172
- Watch V4応答にコンテンツツリーの有無が無いことを「なし」と扱わず、親作品・コンテンツツリーとプレイリスト追加の入口を再び表示する。
- ContentTreeEntryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 171（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.100-task171
- bgVideoPositionを無視した最終フレーム代用をやめ、独立した動画キャプチャで指定場面を読み込む。
- CreditSelectedBackgroundTest.js で再現と正常経路を確認。実機確認待ち。

### Task 170（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.99-task170
- blob/HLSの保存可能な動画を受け付け、0秒キャプチャ・失敗・中断が確実に終了するようにする。
- VideoCaptureLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 169（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.98-task169
- 音声のplay完了が遅れても、既に進んだ提供画面の時計が0秒へ戻らないようにする。
- CreditClockLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 168（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.97-task168
- DB更新時に既存ストアを削除する処理を廃止し、他タブによる更新待ち・接続の失効を扱う。
- DbLifecycleTest.js で再現と正常経路を確認。実機確認待ち。

### Task 167（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.96-task167
- 読み取りと書き戻しの間に別タブが保存した情報を古い値で上書きする問題を防ぐ。
- HistoryAtomicUpdateTest.js で再現と正常経路を確認。実機確認待ち。

### Task 166（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.95-task166
- 同期通知の取りこぼしと旧購読の復活を防止し、最後の解除・完了・連結先の後始末を統一する。
- ObservableLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 165（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.94-task165
- 小窓を閉じた後に開始処理が続く競合を防ぎ、イベント待機と描画資源を解放する。
- PipSessionLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 164（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.93-task164
- 既存UIが文字列で保存した検索期間・長さを、設定読込時に数値へ正規化して受け入れる。
- ConfigImportValidationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 163（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.92-task163
- 音声途中停止と裏タブの描画停止で提供画面が待ち続けないようにし、停止後の古いplay応答を無視する。
- CreditClockLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 162（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.91-task162
- 設定ファイルの形・型・主要な範囲を全件検証してから反映し、不正なファイルで正常な設定を壊さない。保存失敗も通知する。
- ConfigImportValidationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 161（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.90-task161
- Worker配置配列の途中に空き要素がある場合も、全コメントを上書きせず拒否する。
- CommentRenderLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 160（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.89-task160
- 初期化失敗・フレーム消失・破棄で待機要求を解放。再接続後は旧応答を無視。fetch中断を受信側へ伝え、本文読み取りまで期限を適用する。
- GateLifecycleTest.js で再現と正常経路を確認。実機確認待ち。

### Task 159（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.88-task159
- 動画切替・閉じる・再読込で前のコメント取得を中断。再試行の待機を解除し、Retry-Afterを尊重する。
- CommentRequestLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 158（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.87-task158
- タブ復帰時の初期化待ちを安全に扱い、不正なWorker配置を一括で拒否し、例外と停止再開で描画予約が止まる・重複する問題を防ぐ。
- CommentRenderLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 157（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.86-task157
- 大百科の記事有無を10タグ単位の一括GETで取得。元タグ名で対応付け、失敗を記事なしとして保存しない。
- NicodicBatchTest.js で再現と正常経路を確認。実機確認待ち。

### Task 156（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.85-task156
- 動画情報取得の窓口がDB準備前にreadyを通知し初回要求を失う順序を修正。キャッシュの失敗でも情報取得を続ける。
- PocketFirstRequestTest.js で再現と正常経路を確認。実機確認待ち。

### Task 155（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.84-task155
- 標準HLSが対応を返しても再生開始できないブラウザで、hls.jsへ一度だけ切り替えて再生する。
- NativeHlsStartupFallbackTest.js で再現と正常経路を確認。実機確認待ち。

### Task 154（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.83-task154
- v4のnormal/middle/large画像URLを従来形式へ変換し、画像URLが欠けてもMediaSessionが再生開始を止めないようにする。
- WatchV4ThumbnailStartupTest.js で再現と正常経路を確認。実機確認待ち。

### Task 153（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.82-task153
- watch応答の$watchV4.dataを既存再生情報へ変換し、コメント・画質・投稿者・チャンネル情報を読み込む。旧形式と削除動画のエラー処理も維持。
- WatchV4ResponseTest.js で再現と正常経路を確認。実機確認待ち。

### Task 152（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.81-task152
- 通知内の再入や登録解除で走査位置がずれ、通常callbackが余分に呼ばれる問題を直す。
- HandlerDispatchMutationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 151（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.80-task151
- 画像のdecodeと描画が終わってからキャプチャ結果を返す。
- HtmlCaptureCompletionTest.js で再現と正常経路を確認。実機確認待ち。

### Task 150（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.79-task150
- DataURLとbitmap fallbackをBlobに変換してから一時URLを生成する。
- CapTubeConversionTest.js で再現と正常経路を確認。実機確認待ち。

### Task 149（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.78-task149
- CapTubeに必要な通知・throttle・製品情報を局所的に供給し、起動時の例外を解消する。
- CapTubeStartupTest.js で再現と正常経路を確認。実機確認待ち。

### Task 148（2026-10-01）〔確認中〕 ZenzaWatch-dev 2.7.77-task148
- native HLSを有効にした時に、対応ブラウザでnative再生を選択する。
- NativeHlsPreferenceTest.js で再現と正常経路を確認。実機確認待ち。

### Task 147（2026-09-30）〔確認中〕 ZenzaWatch-dev 2.7.76-task147
- 終了後のクレジット表示中や待機中に設定をOFFにしても、再生終了通知を一度だけ返す。
- CreditDisableEndTest.js で再現と正常経路を確認。実機確認待ち。

### Task 146（2026-09-30）〔確認中〕 ZenzaWatch-dev 2.7.75-task146
- タッチ操作面より上にスキップボタンを置き、押せるようにする。
- CreditSkipLayerTest.js で再現と正常経路を確認。実機確認待ち。

### Task 145（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.74-task145
- 再走査で同じスクリプト通知が積み重ならないようにする。
- NicoScriptEventRegistrationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 144（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.73-task144
- thread・fork・番号の組合せを使い、桁数の大きなコメント番号でも別コメントを区別する。
- CommentIdentityTest.js で再現と正常経路を確認。実機確認待ち。

### Task 143（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.72-task143
- 中止と恒久的な取得失敗を繰り返さず、一時的な失敗だけを再試行する。
- ThreadLoadRetryClassificationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 142（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.71-task142、ZenzaAdvancedSettings 0.3.25-task142
- 設定書出しをJSON形式とし、ダウンロード開始後に一時URLを解放する。
- ConfigExportLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 141（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.70-task141、MylistPocket 0.5.32-task141
- 書込要求の成功後にtransactionが失敗した場合も、保存失敗として返す。
- IndexedDbCommitBoundaryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 140（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.69-task140、MylistPocket 0.5.31-task140
- 期限切れ整理の失敗を返し、代替処理として全件消去しない。
- IndexedDbGcPreservationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 139（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.68-task139、MylistPocket 0.5.30-task139
- 同じDBの初期化を共有し、初期化やtransaction取得の失敗が待機したままにならないようにする。
- IndexedDbInitializationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 138（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.67-task138、MylistPocket 0.5.29-task138、ZenzaAdvancedSettings 0.3.24-task138
- 購読callbackを省略しても既定の処理とclosed判定が動くようにする。
- ObservableSubscriberDefaultsTest.js で再現と正常経路を確認。実機確認待ち。

### Task 137（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.66-task137
- 設定したシークキーに矢印キー専用の補正を適用しない。
- ShortcutConfiguredSeekTest.js で再現と正常経路を確認。実機確認待ち。

### Task 136（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.65-task136
- 編集要素内と変換中のキー入力で、再生ショートカットが動かないようにする。
- ShortcutEditableGuardTest.js で再現と正常経路を確認。実機確認待ち。

### Task 135（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.64-task135、MylistPocket 0.5.28-task135
- ゲート初期化完了時に、登録したcaptureイベントを正しい条件で解除する。
- GateInitializationListenerTest.js で再現と正常経路を確認。実機確認待ち。

### Task 134（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.63-task134、MylistPocket 0.5.27-task134
- 応答不要の設定保存で待機登録が増える問題と、送信例外時の登録残りを防ぐ。
- GateSessionRegistrationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 133（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.62-task133、MylistPocket 0.5.26-task133
- ゲートのtimeoutが実際のfetchを中止し、完了後のタイマーを残さないようにする。
- GateFetchLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 132（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.61-task132
- 動画Workerの直接通信でも呼出元の中止とタイマー解除を反映する。
- WorkerFetchLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 131（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.60-task131、MylistPocket 0.5.25-task131
- 通信の呼出元が中止した時に実際のfetchも止め、完了後のタイマーとイベント購読を解除する。
- NetUtilFetchLifetimeTest.js で再現と正常経路を確認。実機確認待ち。

### Task 130（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.59-task130、MylistPocket 0.5.24-task130
- MylistPocketの独立したキャッシュ実装にも、破損データ回復と容量不足時の再保存を適用する。
- PocketCacheStorageRecoveryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 129（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.58-task129
- 壊れた保存キャッシュを除去し、容量不足時は期限切れを整理して一度だけ保存を再試行する。
- CacheStorageRecoveryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 128（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.57-task128
- 保存領域の全消去や破損した通知データで、タブ間通信処理が例外を出さないようにする。
- StorageEventFallbackTest.js で再現と正常経路を確認。実機確認待ち。

### Task 127（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.56-task127、MylistPocket 0.5.23-task127、ZenzaAdvancedSettings 0.3.23-task127
- グループ化した設定通知でキーの先頭が欠ける問題と、解除後も通知が残る問題を直す。
- DataStorageNamespaceEventsTest.js で再現と正常経路を確認。実機確認待ち。

### Task 126（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.55-task126、uQuery 0.0.2-task126、MylistPocket 0.5.22-task126、ZenzaAdvancedSettings 0.3.22-task126、ZenzaHLS 0.0.27-task126、HeatSync 0.0.19-task126
- onceで登録した通知を呼出前に解除し、通知内の再発火や例外で繰り返さない。
- EmitterOnceReentryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 125（2026-09-28）〔確認中〕 ZenzaWatch-dev 2.7.54-task125
- 投稿者まとめてNGが有効な時、NGの原因になるコメントの追加・削除で、同じ投稿者の以前からあるコメントも一覧・画面で非表示・再表示されるようにする。
- NgGroupNotificationTest.js で再現と正常経路を確認。通常NGの追加通知は従来どおり。実機確認待ち。

### Task 124（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.53-task124
- 全件NGの場合の再計算を抑え、設定変更後にコメントが追加されても一覧の一部だけをキャッシュしない。
- EmptyFilteredGroupCacheTest.js で再現と正常経路を確認。実機確認待ち。

### Task 123（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.52-task123
- NGに一致した投稿者のコメント除外で、大量のコメントを繰り返し線形探索する処理を減らす。
- NgMatchedUserPerformanceTest.js で再現と正常経路を確認。実機確認待ち。

### Task 122（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.51-task122
- 上級者用設定やコマンドでNG正規表現とフラグを変更した時、組合せを検証して表示へ反映する。
- NgRegexWiringTest.js で再現と正常経路を確認。実機確認待ち。

### Task 121（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.50-task121
- 空欄でNG正規表現を解除し、同じコメントの判定が呼出順で変わる問題を直す。
- NgRegexTest.js で再現と正常経路を確認。実機確認待ち。

### Task 120（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.49-task120
- トークン期限切れ時の再試行を復旧し、匿名指定と投稿直後のコメント情報を正しく引き継ぐ。
- PostContractTest.js で再現と正常経路を確認。実機確認待ち。

### Task 119（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.48-task119
- 特殊コメントが上限以内でも消え、超過分だけ残る誤りを直す。CA属性の取得も修復する。
- SpecialCommentLimitTest.js で再現と正常経路を確認。実機確認待ち。

### Task 118（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.47-task118
- コメントを解除した後に、古いジャンプや次の動画通知を実行しないようにする。
- NicoCommentScriptClearTest.js で再現と正常経路を確認。実機確認待ち。

### Task 117（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.46-task117
- ニコスクリプト開始時刻ちょうどの0除算を解消し、有限の時刻へシークする。
- NicoScripterSeekBoundaryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 116（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.45-task116
- 投稿履歴へ履歴配列自身を追加していた誤りを直し、投稿内容を順番に保持する。
- PostedCommentHistoryTest.js で再現と正常経路を確認。実機確認待ち。

### Task 115（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.44-task115
- XMLコメントの投稿者IDをJSONと同じ入力名へ変換し、投稿者NGと保存用の識別情報を保持する。
- XmlCommentIdentityTest.js で再現と正常経路を確認。実機確認待ち。

### Task 114（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.43-task114
- 通常コメントの文字列0をプレミアム扱いしないよう、APIのプレミアムフラグを明示的に判定する。
- CommentPremiumFlagTest.js で再現と正常経路を確認。実機確認待ち。

### Task 113（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.42-task113
- 存在しないコメントや重複した削除要求で、末尾の別コメントが削除されるのを防ぐ。
- SafeCommentRemovalTest.js で再現と正常経路を確認。実機確認待ち。

### Task 112（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.41-task112
- NG前コメント一覧を取得する公開APIの大文字小文字の不一致を修正し、従来の名前も互換用に残す。
- UnfilteredCommentApiTest.js で再現と正常経路を確認。実機確認待ち。

### Task 111（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.40-task111
- 保存済みのコメント速度で新しく読み込む場合も、速度変更後と同じ表示開始・終了時刻で配置する。流れるコメント・上下固定・長時間コメントを対象に確認。
- InitialCommentSpeedTest.js で再現と正常経路を確認。実機確認待ち。

### Task 110（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.39-task110
- 一覧の再描画後・非表示からの復帰・降順表示でも、現在時刻に対応する行へ追従する。古い再描画の完了通知を排除し、一時停止中も一覧変更を反映する。
- CommentListViewSyncTest.js で再現と正常経路を確認。実機確認待ち。

### Task 109（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.38-task109
- 速度変更・コメント再読込・分割追加が重なっても、古いWorker結果とreset前の追加処理が新しいコメント配置を上書きしない。
- CommentLayoutGenerationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 108（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.37-task108
- 設定インポート等でコメント速度に0・負数・非数・無限大が入っても、描画時間を壊さず標準速度へ戻す。通常の速度設定と倍速再生時の自動調整を維持。
- CommentSpeedValidationTest.js で再現と正常経路を確認。実機確認待ち。

### Task 107（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.36-task107
- コメント削除・NG登録で一覧から行を除いた後に、時刻検索用の位置配列も更新する。前のインデックスを無効化し、残った行への自動スクロール位置を修正。
- CommentRemovalScrollTest.js で再現と正常経路を確認。実機確認待ち。

### Task 106（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.35-task106
- コメント一覧の再読み込み・NG登録・動画切替で消えた行へのシーク、コピー、NG登録、ニコる等を無視し、参照エラーと誤操作を防ぐ。対象IDがない行専用操作も無効化し、有効なID=0と一覧全体の操作は維持。
- StaleCommentActionTest.js で再現と正常経路を確認。実機確認待ち。

### Task 105（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.34-task105
- D-40のコメント周りブラッシュアップ第3弾。表示中コメントの探索が、描画更新のたびに各グループの全コメントを先頭から総走査していたため、コメント数が多い動画ほど不要な判定が増える問題を改善。
- vpos昇順配列と、実データから計算した最大表示時間を使って候補開始位置を二分探索し、現在時刻付近だけを走査。未来コメントに到達したら早期終了する。
- forkの `@秒数` のような長時間コメントも最大表示時間キャッシュへ含めるため取りこぼさない。10,000件の回帰テストでは `isInViewBySecond()` の全件呼び出しを避けることを固定。

### Task 104（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.33-task104
- D-40のコメント周りブラッシュアップ第2弾。コメント速度倍率や「倍速再生でもコメントは速くしない」を変更した時、前回のY座標・overflow判定を持ち越して再レイアウトしていたため、コメントが下へずれたりoverflowが戻らない可能性を修正。
- 速度変更前にレイアウト状態を初期位置へ戻してからtiming再計算→Worker再配置する。naka/ueはY=0、shitaは画面下端へ戻し、自然なoverflow判定を再計算。slotは別ロジックのため変更しない。
- `CommentSpeedRelayoutTest.js` を追加し、初期位置・overflow解除・処理順序を回帰固定。

### Task 103（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.32-task103
- D-40のコメント周りブラッシュアップ第1弾。コメント一覧でダブルクリックしてシークしたコメント行を、既存の `is-active` 強調スタイルで視覚的に残すようにした。
- 別のコメントを選ぶと前の強調だけ解除し、コメント一覧の再構築時は選択をクリア。従来のseek commandはそのまま維持。
- `CommentSelectionHighlightTest.js` を追加し、選択切替とcommand発火を回帰固定。

### Task 102（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.31-task102
- B-7を修正。「コメントを動画の後ろに流す」で動画プレイヤー全体を `opacity:0.90` にしていたbaseline由来の古い演出を削除し、半透明レイヤーの重なりによる透明度ムラを解消。
- 透明度を持つのはコメントレイヤー側だけに整理。コメントは動画の後ろを通り、中央の動画部分では自然に隠れる。
- Task052/095で直した、backCommentの動画縮小とviewportコメントレイヤーの配置はそのまま維持。`BackCommentOpacityTest.js` で両方を回帰固定。

### Task 101（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.30-task101
- B-1を再修正。全画面でシークバーのコメントpreviewが設定・全画面等の右操作ボタンより前面に出てクリックを奪う問題に対し、右操作列だけをシークバーより前面へ出す。
- Task040で行ったコメント一覧・サムネイルの位置移動は行わず、Task042で問題になった「一覧へマウスを移す途中でhoverが切れて消える」副作用を避ける。
- 全画面右操作列は `z-index:310`、menu open時は320。シークバーは300のまま。位置を動かさないことも `FullscreenControlLayerTest.js` で回帰固定。

### Task 100（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.29-task100
- D-39 の lit-html `t.insertBefore is not a function` の原因を特定して修正。context menu の新形式 `emitResolve` が DOM Element ではなく uQuery wrapper を `container` として渡し、ZenzaHLS が `lit.render(..., container)` にそのまま渡していた。
- 新形式 `emitResolve` の `container` だけ実DOM (`wrapper[0]`) に変更。旧 `emitAsync` は既存アドオンとの互換性のためuQuery wrapperのまま維持。
- `AddonMenuContainerTest.js` を追加し、新形式containerが `insertBefore` を持つDOM Nodeであることと、旧形式が従来どおりuQueryであることを固定。

### Task 099（2026-09-27）〔確認中〕 ZenzaWatch-dev 2.7.28-task099
- 検索欄の動画IDカードで、削除済み・不存在動画（ThumbInfo が `DELETED` / `NOT_FOUND`）から「再生」等を実行でき、Watch API の失敗まで進んでしまう D-24 を修正。
- unavailable カードは、再生・次に再生・末尾追加・とりマイの各ボタンを無効化し、Enter / Shift+Enter を含む command 発火経路でも拒否する。`COMMUNITY` 等の「再生は試せる」情報取得失敗は従来どおり許可。
- `VideoIdPreviewAvailabilityTest.js` を追加し、削除済み・不存在動画では4種類の action が1件も発火しないこと、試行可能な失敗は従来挙動を保つことを固定。

### Task 095（2026-09-26）〔確認中〕 ZenzaWatch-dev 2.7.27-task095
- 過去に実機確認済みだった Task 051 の `onlyControlBar` 修正が current source から消えていたため復元。画面モード切替時は control bar だけ再計算し、動画ヘッダーの表示状態を巻き込まない。
- Task 052 B-6 の backComment 修正が後続commitで exact revert されていたため、正常commit `65e93ee` のCSS配置を現在sourceへ復元。
- Task 074 で削除予定だった `IchibaLoader.js` がTask076 catch-up時に残ったため、参照0を確認して物理削除。
- 上記3件を `HistoricalSourceRecoveryTest.js` で回帰固定。

### Task 093（2026-09-26）〔確認中〕 ZenzaWatch-dev 2.7.26-task093
- プレイリストの中のデータの整合性を直した（見た目・描画の速さは Task 094 で扱う）。
  - 動画の ID が後から変わった時（数字の ID で入れたチャンネル動画が so〜 と分かった時など）に、新しい ID で見つからない・古い ID で見つかるままだったのを修正。変わった先の動画が既にあれば1件にまとめる（再生中・情報がある方を残し、再生済みは引き継ぐ）。
  - 一度に追加した一覧の中の同じ動画（例: sm1 を2回）が両方入っていたのを、1件だけにした。置き換え・末尾に追加・次に追加で、同じ動画を残さない規則を揃えた（監査v2 ZW-069）。
  - 置き換え・保存からの復元でも、プレイリストの上限件数（maxItems）を超えないようにした（監査v2 ZW-070）。上限で落とす時、再生中の動画は落とさない。
  - プレイリストから外れた動画の状態の変化で、プレイリストの更新が起きていた（ghost update）のを止めた。
  - 「動画情報不明」になった動画を後で正常に開けた時、同じ項目のまま（位置・再生中・再生済みを保って）動画の情報に置き換わるようにした。以前は「動画情報不明」が残り続けていた。
  - 保存・復元で、動画の ID が古い ID に戻る・元の識別子（uniq_id）が失われるのを修正した。
  - 並びを逆にした後に「次へ」「前へ」が別の動画へ進むことがあったのを修正した。
  - ファイルから復元した時、保存した位置の動画ではなく、いつも先頭の動画を開いていたのを修正した。書き出すファイルの種類を JSON（application/json）にした。
  - 上限いっぱいのプレイリストに追加した時、実際には入っても「追加できる動画がありませんでした（すべて既にあります）」と表示されていたのを、入った件数を表示するようにした。

### Task 092（2026-09-25）〔確認中〕 MylistPocket 0.5.21-task092
- MylistPocket の動画情報（「？」）の説明文で、リンクが二重になる・リンク先が壊れる問題を修正した。
  - `https://www.nicovideo.jp/shorts/ss〜`・`https://nico.ms/ss〜`・既にリンクになっている URL などを混ぜると、URL の中の `ss〜` が別のリンクになり、その href の中がさらに置き換わっていた。動画の参照の解析（`parseNicoVideoReference`）とリンク化を分け、`<a>` の外の文字だけをリンクにするようにした。ショート動画（ss〜）のリンク先は `https://www.nicovideo.jp/shorts/ss〜`。
  - 説明文の中の `script` 等の要素・`on〜` の属性・`javascript:` 等の URL は取り除いて表示する（本体の説明文の Task 088 と同じ方針）。
- Google 検索等のページのリンクの判定を、リンク先のホストとパスで行うようにした。Google のリダイレクト用リンク（`/url?…&url=…`）でも、中の URL が www.nicovideo.jp・sp.nicovideo.jp・nico.ms の動画の時だけメニューを出す（任意のサイトへのリダイレクトは対象にしない）。
- NG・お気に入りの判定のための動画情報の読み込みが、決めていた「同時に6件まで」を超えて最大13〜16件同時に動いていたのを、本当に6件以下にした（先に来た順。1件が失敗しても残りは止まらない）。
- `pointer-events` の書き間違いを修正（NG解除のボタンの吹き出し）。

### Task 091（2026-09-25）〔確認中〕 ZenzaWatch-dev 2.7.25-task091
- Task 090 の実機確認で見つかった、削除済み・不存在動画を開くと `Cannot read properties of undefined (reading 'watchId')` になり、連続再生の3秒後の「次へ」に入れない問題を修正。
  - 現在の watch API が返す `FORBIDDEN / ADMINISTRATOR_DELETE_VIDEO` と `NOT_FOUND` のエラー用 response を、通常動画の response と分けて構造化した。
  - `FORBIDDEN` は「削除されています」、`NOT_FOUND` は「動画が見つかりません」として扱い、連続再生中はどちらも動画単位の3秒タイマーで次へ進む。
  - Task 090 で入れたタイマーの所有権（途中で別動画を選ぶ・閉じると取り消す）はそのまま維持。

### Task 090（2026-09-25）〔確認中〕 ZenzaWatch-dev 2.7.24-task090
- 動画を切り替えた・閉じた後に、前の動画の非同期の結果が今の動画に入らないようにした（監査v2 R04）。
  - 動画情報・セッション作成・接続を待つ間に別の動画を開いた・閉じた時、前の動画の URL・動画情報・コメント・エラーを使わない。最初のプレイヤーの準備中に2回開いてもプレイヤーは1つだけ作る。
  - 動画のセッション（VideoSessionWorker）で、古い動画の sessionId の接続・状態の問い合わせ・終了が、新しい動画のセッションを操作しないようにした。
  - 連続再生中にプレイリストへ追加するだけの時は、今の再生の状態（読み込み中のコメント・再読み込みの設定）を変えない。
  - エラー・NG の後の自動の「次へ」と、再生エラーの後の再読み込みは、別の動画を開く・閉じると取り消す。
  - 読み込みの失敗の中身によって、失敗の処理そのものが例外になっていたのを修正。再生開始の失敗（自動再生の拒否・中断・セッション切れ）の分け方を直した。
  - 手元のキャッシュやプレイリストの初期化に失敗しても（終わらなくても）、動画を開けるようにした。
  - コメントの投稿中に動画を切り替えても、投稿の結果は元の動画に記録し、新しい動画の表示を変えない。
  - 説明文を続けて更新した時に、前後の動画の説明文が混ざらないようにした。
  - シークバーのサムネイルが使う共有の時刻（MediaTimeline）が、短いシークの後に古い時刻へ戻らないようにした。
  - 古い API の再生速度（setPlaybackRate）が例外になる、自動再生の設定（setIsAutoPlay）が効かない問題を修正。

### Task 089（2026-09-25）〔確認中〕 ZenzaWatch-dev 2.7.23-task089・MylistPocket 0.5.20-task089・ZenzaHLS 0.0.26-task089・CapTube 0.0.12-task089
- Worker（裏で動く処理）とのやり取りの土台（workerUtil）を直した。4つの配布物が同じ土台を含むため、4つとも版を上げた。
  - 同じ名前の Worker が複数ある時に、ある呼び出しへの応答が別の呼び出しに返り、片方が待ち続けることがあったのを修正（要求の管理を Worker ごとに分けた）。
  - 設定の受け渡し（env）等、応答の要らない通知を「応答待ち」として送り、待ちが残り続けていたのを修正。port の受け渡しには、使える状態になった時点で応答を返すようにした（Worker どうしを繋ぐ処理が止まっていたのも直る）。
  - Worker が起動できない・中で例外が起きた・終了した・応答が無い時に、待っている呼び出しが終わらなかったのを、失敗として返すようにした。応答が無い時の既定の期限は5分。
  - ページの名前（window.name）等に引用符があると Worker が起動できなかったのを修正（値を文字列としてコードに入れる）。

### Task 088（2026-09-25）〔確認中〕 ZenzaWatch-dev 2.7.22-task088・ZenzaAdvancedSettings 0.3.20-task088・MylistPocket 0.5.19-task088・ZenzaHLS 0.0.25-task088
- 依存の版を固定: lodash を配布物・テストとも 4.18.1 に統一（以前は配布物が 4.17.11／MylistPocket が 4.17.5、テストは 4.18.1）。読み込み先は jsDelivr（cdnjs には 4.18 系が無いため）。hls.js は `@latest` をやめて 1.7.3 に固定し、`@require`・読み込み失敗時の代わり・プレイヤーが読む URL を1つにした。lit の読み込みで版の指定が無かった所を 2.0.2 に固定。
- 動画の説明文: mylist/…・series/… のリンクに ▶ を付ける時、リンクの文字が HTML の属性・要素として解釈されることがあったのを修正（ID はリンク先から取り、数字だけの時に付ける）。説明文の表示の前に、スクリプトとして動き得るもの（script 要素・on〜 の属性・javascript: 等の URL）を取り除くようにした。
- 「コメントの保存」: 保存する HTML の見出し・タイトルに、動画のタイトルが HTML として入ることがあったのを修正（文字のまま入る）。ファイル名に使えない文字は `_` にする。
- ログ: コメントの投稿・ニコる・削除・読み込みのログに、キー・本文・ユーザーID が出ていたのを伏せ字にした。ゲートの「invalid token」等のログにトークンの値を出さないようにした。

### Task 087（2026-09-25）
- 開発者向け: `dist/` の配布物を [dist-manifest.json](./dist-manifest.json) で「active（`npm run build` でソースから作る10個）」と「legacy-frozen（元の作者のリポジトリから引き継いだ旧版3個。作り直さず SHA-256 で固定）」に分けて管理するようにした。どちらにも無い配布物があるとテストが失敗する。旧版3個は削除していません。
- 開発者向け: import した名前が import 先で export されていない宣言14か所を実際の依存に合わせて直し、検査をテストに加えた（配布中のスクリプトの中身は変わりません）。

### Task 085（2026-09-24）
- 開発者向け: `npm run build` / `npm run watch` が古い Babel の引数で失敗していたのを、`node build.js --dev` に統一。README に開発者向けの手順（`npm ci` → `npm test` → `npm run build`）と対応する Node.js の範囲を追加。
- 開発者向け: 依存の版を固定する `package-lock.json` をリポジトリに含め、`package.json` に対応する Node.js の範囲（`engines`）を書いた。
- 開発者向け: 実在しないファイルや大文字・小文字の違うファイルを指していた `import` 8か所を修正（連結ビルドはこの行を使わないため、配布中のスクリプトの中身は変わりません）。
- 開発者向け: `node build.js --watch` が存在しないフォルダを監視しようとしていたのを修正。監視対象が欠けている時は一部だけ監視せずに終了する。
- 公開手順: 公開前の検査を、まだ送っていないコミット全部と、公開される全ファイルの種類・場所の決まりに広げ、送信先（GitHub のリポジトリ）を送信の直前に確認するようにした。

### Task 084（2026-09-24）
- 開発者向け: `node build.js` が、入力ファイルの欠け・生成物の構文エラー・書き込みの失敗を「成功」として終わっていたのを修正。失敗時は終了コード1で、`dist` を書き換えない。
- 画質メニューの「自動（最大○○p）」表示（Task 079b）のソース `src/VideoControlBar.js` が、このリポジトリに入っていなかったのを追加（配布中のスクリプトには入っていたため、利用者から見た動作は変わりません）。ソースから作り直した配布物が `dist` と一致することを確認して公開するようにした。

### Task 082（2026-09-19）
- 本家からの変更点をまとめた `CHANGES_FROM_UPSTREAM.md` を追加し、README からリンクした。

### Task 081 — ZenzaWatch 2.7.21（2026-09-19）
- 動画の最後の「提供」画面の間に投稿されたコメントが流れなかったのを修正。〔確認中〕
- 提供画面の情報を、動画の残りが45秒になってから読み込むようにした（動画を開いた直後の遅れ対策）。〔確認中〕

### Task 080 — ZenzaWatch 2.7.20 / 上級者用設定 0.3.19（2026-09-19）
- 動画の最後の「提供」画面（ニコニ広告・ギフトの支援者、提供音声、ギフトの演出）を再現。設定でON/OFF。〔確認中〕
- エフェクトパネル: 開閉アニメーション、外側を押すと閉じる、左右で元の映像と見比べる。〔確認中〕
- 再生速度のショートカット（13段階）を追加。〔確認中〕

### Task 079 / 079b — ZenzaWatch 2.7.19 / ZenzaHLS 0.0.24 / MylistPocket 0.5.18（2026-09-19）
- 画質「自動」で360pなどの低画質に固定される問題を修正（回線速度の記録方法、GPUの無い環境での画質候補）。〔確認中〕
- 画質メニューの「自動」に最大の画質を表示。〔確認中〕
- MylistPocket: ランキングページで「？」が消えて出なくなる問題を修正。タグの「？」で大百科の記事の有無が分かるようにした。〔確認中〕

### Task 078 — ZenzaWatch 2.7.18（2026-09-19）
- 自動更新先（`@downloadURL`・`@updateURL`）をこのリポジトリに変更。

### Task 077 / 077b / 077c — ZenzaWatch 2.7.14〜2.7.17（2026-09-18〜19）
- 画面フィルター（明るさ・コントラスト・ガンマ・シャープ・色温度 など）とプリセット、エフェクトボタンを追加。左右・上下反転を統合。〔確認中〕
- コンソールに「CanvasTextAlign」の警告が大量に出る問題を修正。〔確認中〕

### Task 076（2026-09-18）
- 動画ヘッダー「常に動画の外」の収め方を作り直し、入力中・メニュー表示中にヘッダーが消えないようにした。〔確認中〕

### Task 075（2026-09-18）
- ジャンルのバッジがタグ編集ボタンと重なる問題を修正。〔確認中〕

### Task 074（2026-09-17〜18）
- 検索の高速化、「再生中の動画の投稿者の動画のみ」の作り直し、音声の自動調整、ニコニコ市場の削除、
  説明文のフルURL・ショート動画IDへの対応、ジャンル表示、いいね！のお礼メッセージのコピー、
  コンテンツツリー0件時のエラー修正、検索予測が出ないことがある問題の修正。〔確認中〕

### Task 073（2026-09-17）
- コメントのコマンドを選んで入力できるピッカー、プレイリストの最大件数の設定、検索予測の表示の統一、
  「投稿者の動画のみ」の修正、Enterでコメントが2回送られ得る問題の修正。〔確認中〕

### Task 072（2026-09-17）
- 動画ヘッダーの表示位置を設定で選べるようにした。動画ID入力時もタグの予測を表示。〔確認中〕

### Task 071（2026-09-17）
- 検索欄に動画IDを入れると、検索欄の下に動画のカードを表示するようにした。〔確認中〕

### Task 070（2026-09-17）
- シークバーのプレビュー画像を一般会員でも表示・高速化。コメント付きPiPを追加。〔確認中〕

### Task 069（2026-09-17）
- MylistPocket: 投稿者の情報が無い動画で読み込みが終わらない問題を修正。検索欄にタグの候補を表示。〔確認中〕

### Task 067 / 068（2026-09-16〜17）
- 検索を本家の検索ページと同じ仕組みに切り替え、並び順（9種類＋昇順/降順）と投稿期間・再生時間・ジャンルの絞り込みを追加。〔確認中〕

### Task 066（2026-09-16）
- 通信まわりの改善（タグ編集キーの期限切れ時の再試行、いいね！の結果確認、広告の冠の一括取得の分割、投稿者情報の補完）。〔確認中〕

### Task 065（2026-09-15）
- 上級者向け設定にコメントパネルの表示ON/OFFを追加。秒数を自由に決められるカスタムシークを10個追加。

### Task 063 / 064（2026-09-14）
- 上級者向け設定の点検: 効いていなかった設定を修正し、意味の無くなった項目を削除。

### Task 059〜061（2026-09-13〜14）
- ショートカットキーを自由に割り当てられるようにし、操作できる項目を大幅に追加。キーを押して登録するボタンの不具合を修正。〔確認中〕

### Task 056 / 058（2026-09-12〜13）
- タグの ▶ ボタンでの検索で、並び順などが正しく反映されない問題を修正。

### Task 054〜057（2026-09-12）
- 広告（ニコニ広告）の金冠・銀冠をプレイリストに表示（設定でON/OFF）。〔確認中〕

### Task 048〜053（2026-09-10〜11）
- コメントが読み込めない問題を修正（Task 048）。
- 「小」モード: 読み込み中の表示位置、縦横比固定ボタンの表示、コメント入力欄の追従、コントロールバーの自動非表示（Task 049〜051）。
- 「コメントを動画の後ろに流す」でコメントがずれる問題を修正（Task 052）。
- 全画面表示でもコントロールバーを自動で透明に。一時停止時は一度表示（Task 053）。〔確認中〕

### Task 038〜047
- 「小」モードのドラッグ・メニュー・カーソルの不具合を修正し、バージョンをコンソールに表示（Task 038・039）。
- プレイリストに動画が入らない問題（Task 041・042）、親作品・子作品のプレイリスト読み込み（Task 043・044）、
  大百科アイコンの復旧（Task 044〜047）、再生後にURLが動画のまま残る問題（Task 046）。

### Task 028〜037
- 大百科の動画埋め込みから Zenza で開けない問題を修正（Task 028）。
- 「小」モードをドラッグで動かせるように、大きさ変更・位置と大きさの記憶を追加（Task 029〜033・035〜037）。
- ZenzaHLS のバグ修正（Task 034）。

### Task 001〜027
- 下の「[未リリース]」を参照。

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

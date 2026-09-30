# Changelog

このプロジェクト（ZenzaWatch改良版）の変更履歴です。
[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に準じた形式でまとめています。

現時点ではバージョンタグでのリリース管理を行っていないため、これまでの改修内容は
すべて `[未リリース]` セクションにまとめています。各項目の詳しい調査・修正内容は
`docs/design-pack/` 以下の対応するタスク文書を参照してください。

## 作業ごとの変更履歴（新しい順）

機能ごとのまとめは [CHANGES_FROM_UPSTREAM.md](./CHANGES_FROM_UPSTREAM.md) を参照してください。
「〔確認中〕」は、実装済みで実際の環境での確認がまだ終わっていないものです。

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

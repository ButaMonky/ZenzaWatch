# クリック起動と他の拡張機能の共存：調査記録

2026-11-12。実装済みのクリック方式は変更していない。設定改善の通常版は 2.7.389-task1014、外部検証版は 0.21.0-external-direct21。

## 経緯と現状

復元された過去の報告では、フォロー新着から起動すると公式ページまで開く問題、検索カードの余白・投稿日から起動できない問題があった。過去にはユーザーの改善確認が記録されている。ただし復元された要約は、消失した原文そのものではない。

現在の HoverMenu は document の capture 段階で対象リンクを判定し、通常は preventDefault と stopImmediatePropagation を実行して起動する。そのため、後続のサイト側の遷移処理を止められる一方、body 等でクリックを読む別の拡張機能にもイベントが届かなくなる。互換性設定で伝播を許可すると、独立して遷移するサイト処理まで動く可能性がある。

検索カードはリンクだけでなく data-anchor-href にも対応している。単純に a 要素だけへ戻すと、余白・投稿日からの起動が退行しうる。

URL の zenza_official=1 は別の OfficialPlayerRoute による「明示的に公式プレイヤーで開く」指定であり、通常クリックを識別するために HoverMenu が付加しているものではない。これだけを削除すると公式起動が再び Zenza に横取りされる可能性がある。URL 問題とイベント伝播問題を一つの変更で解決できるとは扱わない。

## オフライン実ブラウザ検証

test/browser/navigation-cancellation-research.cjs を Chrome 157.0.8103.51 の独立したプロファイルで実行。localhost のみを使用し、実際のマウス入力を CDP から送った。アカウント操作はしていない。作成した Chrome は終了を確認した。

クリックを止めず Navigation API の navigate イベントで watch URL への遷移だけを preventDefault した結果：

|ケース|body のクリック受信|URL 遷移|画面側の副作用|
|---|---|---|---|
|通常のリンク|届く|停止|なし|
|クリック処理から location.assign|届く|停止|なし|
|クリック処理から pushState と DOM 更新|届く|停止|**DOM 更新は継続**|
|メニューボタンが preventDefault|届く|元々遷移なし|メニューは動く|
|クリックなしの pushState|クリックなし|停止|本来対象外の操作まで止める危険|

通常リンクでは sourceElement と userInitiated が利用できたが、クリック由来の location.assign / pushState は sourceElement=null、userInitiated=false だった。従ってこの二項目だけでは無関係なプログラム遷移と区別できない。

この fixture はブラウザの性質を示すもので、現在のログイン済みフォロー新着が同じ処理をしているという証明ではない。別タブ、遅延処理、戻る・進む、実サイトのルーターとの整合性も未完了。Navigation API だけを全面採用する根拠にはならない。

## 選択肢の評価

|方式|評価|
|現在の全域 capture 停止|二重起動を防ぎやすいが、他機能のクリック観測を遮る|
|preventDefault のみに変更|通常のリンク遷移は止まるが、独立した JavaScript 遷移は止まらない|
|最後の bubble で未処理クリックを起動|他機能を尊重できるが、先にサイトが処理したカードで起動できない|
|Navigation API で遷移を停止|有望だが、サイト内部の画面更新まで取り消せない|
|拡張機能ごとの特例・合成クリック再送|採用しない。二重処理や新たな依存を増やす|
|ニコニコのカードごとの場当たり的修正|採用しない。仕様変更時の修正箇所が増える|

## 推奨する整理

1. **起動対象の判定を一本化する。** URL、カード余白、修飾キー、ダウンロード、カード内の別操作を共通の「ユーザーの意図」の判定へまとめる。
2. **判定・ページ遷移の抑止・プレイヤー起動を分ける。** 一度の操作につき起動を一回だけ受け付ける。対象外の操作には触れない。
3. **標準リンクは標準のイベント処理で扱う。** 強いイベント停止を全域の既定手段にしない方針を目指す。
4. **サイト側ルーターと競合する部分だけ、狭い接続層に隔離する。** これは他の拡張機能の名前や内部 API を見る特例ではない。複数のカードに共通する構造・挙動を単位にし、サイト固有部分を散在させない。ただし実サイト検証で安全な境界を確定するまでは現在の停止処理を外さない。
5. **安全に判定できない新構造では通常リンクを壊さない。** 必要なら明示的な Zen 起動操作を残す。曖昧なカード全体を奪う処理を追加しない。

ユーザーの「強い停止をやめたい」という方向には賛成。ただし停止の一括撤去や、要素ごとの特例の積み重ねは推奨しない。共通処理と小さなサイト接続層へ分けることが、変更への追従範囲を限定する現実的な方針。

## 次の検証条件

- ログイン済みフォロー新着：タイトル・画像・余白・投稿日で Zenza のみ一度起動。公式側の遷移・再生が残らない。
- 検索カード：同じ操作、内部ボタン、プロフィール、メニューを区別。再描画後も同じ。
- 他機能のクリック監視を含む共存確認。特定の拡張機能を検出するコードは追加しない。
- Ctrl/Meta/中クリック、Shift の既存動作、右クリック、戻る・進む、連続起動、起動失敗時の扱い。
- 公式プレイヤーへの明示的な起動。URL の指定を置き換えるなら、新規タブを含め意図が失われない独立の設計・検証が必要。

実サイトでの最終確認が未完了のため、この調査をもって互換性問題を解決済みにはしない。

## 参考

- [Chrome: Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)
- [MDN: preventDefault](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
- [MDN: stopImmediatePropagation](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation)
- [MDN: NavigateEvent.sourceElement](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/sourceElement)

## 今回の設定リリースの検証

設定 TypeScript・生成物の整合、実配布 bundle の設定開閉・保存・キャンセル・依存関係、外部検証版60テストを確認。全体テストは5137成功・76保留・14失敗。14失敗は変更前と変更後で同一の既存失敗で、支援者表示のテスト用代替オブジェクトやシーンサーチ生成ファイルの改行判定等に起因する。全体テストが全件成功したという扱いにはしていない。


## 追加検証: イベント停止位置だけでは共存を保証できない

`test/browser/click-propagation-boundaries.cjs` を独立した Chrome で実行。サイトのルーターを main 要素、一般的なクリック監視を body 要素に置いた fixture。第三者スクリプトは使用しない。

|方式|body がクリックを受信|サイトの画面更新|Zenza起動|
|---|---|---|---|
|document capture で停止|0|0|1|
|preventDefault のみ|1|1|1|
|main capture で停止|0|0|1|
|サイトのルーターが defaultPrevented を尊重|1|0|1|

局所的な stopPropagation へ置換するだけでは外側の監視も止まる。別イベントや合成クリックを発行しても、元イベントを監視する既存機能との一般的な互換性にはならない。

次の設計候補は、共通の動画起動意図判定と preventDefault を維持し、公式の遷移入口がキャンセルを尊重するようにする狭い接続層。ただし HTML には登録済みイベント処理が含まれず、現在のフォロー新着の遷移入口を確認できていない。React 等の内部プロパティ、addEventListener 全体の差し替え、全域の window.open/history 差し替えは保守性と副作用から未採用。Navigation API 単独も既述の DOM 更新問題が残る。

従ってこの段階で全面的な伝播許可へは変更しない。個別の拡張機能検出も追加しない。新着欄の Zen / MylistPocket hover 修正は独立して検証・配布する。


## 追加調査: 保存済み公式 JavaScript と実装のイベント境界

2026-11-12、利用者提供の保存済み HAR の静的 JavaScript 本文をオフラインで確認した。ライブサイトの取得・実行はしていない。以下は収録された版についての事実であり、現在の全画面の動作保証ではない。HAR 本文・ユーザー情報はリポジトリへ追加していない。

### 視聴済みの通知が届かない直接の理由

本体の `HoverMenu._overrideWatchLink` は document の capture で動画クリックを受け取り、既定では `preventDefault()` と `stopImmediatePropagation()` を実行する。そのため body の bubble で元クリックを観測する一般的な処理には届かない。

利用者提供の第三者スクリプトも body の click を観測している。ただし受信だけでなく、自身が付けた動画要素の印が対象または祖先にあることを要求し、途中の BUTTON では探索を終了する。従って「クリックを伝播させる」と「そのスクリプトが任意の余白・独立ボタンを視聴扱いにする」は別問題。Zenza がその印や内部 API を操作する対応は採用しない。

実際の TypeScript 実装を読み込む `WatchClickIntentBoundaryTest.js` に4件の境界テストを追加した。伝播 OFF では body の観測0・起動1、伝播 ON では観測1・起動1となる。キャンセルを無視する仮のルーターは ON のとき同時に実行されることも確認。既存の操作境界を含め17件成功。

### フォロー新着の収録コード

対象: `https://common-header.nimg.jp/3.13.3/responsive/CommonHeader.min.js`

HAR 内 text を UTF-8 としてハッシュ化した SHA-256:
`649c5803f970fcfb9e33a3d59db6b66fc3c45f63fe8daaacdb37cb85e47a8e27`

- 活動項目 `Ia` の動画部分は href を持つ a 要素。
- onClick は `An` に集計イベントを渡して true を返す。
- `An` は log.gif への fetch を実行する集計処理。この経路にページ遷移処理は見つからない。
- この活動項目だけから「公式が独立して window.open する」とは結論できない。

以前の二重起動が誤報という意味ではない。旧版の登録タイミング・別のルート・外側の処理・当時の公式実装は、今回の断片だけでは確定できない。

### 公式共通リンクのキャンセル対応

対象: `https://resource.video.nimg.jp/web/scripts/nvpc_next/assets/Panel-CyiJhOal.js`

HAR 内 text を UTF-8 としてハッシュ化した SHA-256:
`4fe7724c6529f9cb614786d3f2b3ec960d932581b198253dc730d06d5e2c88f9`

共通リンク部品 `re` の遷移関数 `V` は入口で `!e.defaultPrevented` を確認する。window.open または SPA 遷移の直前にも同じ確認がある。data-anchor と data-anchor-href を生成する部品であり、通常リンクだけでなく div 型の操作部品にも使用される。

これは document capture で preventDefault だけを行う方式が共存できる有力な根拠。ただし呼び出し側 `U` は `onPress` に相当する `h` を V より先に呼ぶため、全利用箇所の独立した副作用まで停止するという証明にはならない。共通部品の外側にある別のハンドラーも未確定。

### オフライン Chrome 検証

`test/browser/click-propagation-boundaries.cjs` に、収録ヘッダーの「集計だけ行う通常リンク」をモデル化したケースと、遅延して画面更新するルーターを追加。第三者スクリプトや収録バンドル全体は実行していない。

|モデル|body 受信|サイトの画面更新|Zenza起動|ブラウザ遷移の発生|
|---|---:|---:|---:|---:|
|通常リンク＋集計、preventDefaultのみ|1|0|1|0|
|defaultPreventedを尊重するルーター|1|0|1|0|
|キャンセルを無視する遅延ルーター|1|1|1|0|

全6ケースの期待値を確認し、検証用 Chrome は終了済み。遷移イベントだけを見ても SPA の画面更新を検知しきれないことも再確認した。

### 次の判断

方針は「元クリックをそのまま伝播し、標準キャンセルを公式の共通リンクに受け渡す」を第一候補とする。他スクリプト専用の連携、合成クリック、URL の書換え、全域 API 差替えは追加しない。

ただし a 要素かどうかだけではキャンセルを無視するハンドラーの有無を判定できない。見た目やクラス名だけで弱い停止へ切り替える自動判定は行わない。次に必要なのは、伝播を許す比較条件でのログイン済みフォロー新着と検索カード（画像・タイトル・余白・投稿日）の確認、および onPress 等の前段処理の確認。二重起動防止済みの配布コードと既定設定は今回変更していない。


## 利用者検証結果: click1018.1 は不採用

- フォロー新着の画像・タイトル: ページ遷移と二重再生が再発。
- 検索カードの画像・タイトル・余白・投稿日: Zenza 起動は正常。
- 投稿者名・メニュー: 元の操作は正常。
- ブラウザ履歴には残るが、利用者のランキングNGの視聴済み記録は改善しない。

静的に確認した CommonHeader と共通リンクのキャンセル判定だけでは、実際の新着遷移全体を説明できなかった。単純な全域伝播許可は公開通常版に採用しない。検証版の既存スイッチは強制ON経路のため、スイッチOFFでは復帰できない。通常版の上書きとページ再読み込みで復帰する。

ブラウザ履歴の更新は第三者スクリプトへのイベント配送の証明ではない。現時点で未確定なのは、(1) 原クリックが body bubble まで到達したか、(2) 受信側がクリック対象を動画として認識できたか、(3) 保存・表示まで完了したか。検索カードで公式の委譲イベントが伝播を止める可能性や、受信側の要素認識が外れる可能性は仮説に留める。別スクリプトの内部APIを呼ぶ・印を補う対策は行わない。

次はユーザー環境の実イベント経路を読み取りで確認する。新着は公式ハンドラーの実行元と処理タイミング、検索はcapture→target→bodyの到達点とDOMの親子関係を分けて観測する。静的コードだけから新着専用の抑止条件を決めたり、未検証の第2版を配布したりしない。


## 次の比較実装: click1018.2

利用者からの実装・再検証依頼に基づき、検証専用TypeScriptモジュールClickNavigationTrialを追加。常設API差替えを避ける従来方針は維持するが、今回の候補では元クリックを止めずに非協調なwindow.openを抑えるため、1クリックの処理ターンに限ってwindow.openを一時ラップする。対象はユーザーが選んだ同じwatchIdの公式watch URLのみ。他のURL、投稿者、メニュー、修飾クリックは元の扱い。

Navigation APIのキャンセルも同じ時間・動画範囲に限定。次のタイマーで必ず解除してからZenzaを起動。原イベントの後続処理より先にプレイヤーやプレビューのDOMを変更しないよう起動を遅延する。連続要求では古い待機起動を破棄。第三者スクリプトの内部データには触れず、合成クリックも発行しない。

Chromeで通常リンクとwindow.openとlocation.assignの二重遷移を抑止し、bodyに元イベントが届くことを確認。一方、pushStateキャンセル後のDOM副作用は依然として残る。この方式が実サイトの新着を完全に保護するとの結論はまだ出せない。保存されたopen関数・別フレーム・遅延タイマーにも対応を広げていない。

実行時にはクリック到達点と抑止回数だけをZENZA_CLICK_TRIALとして出す。data属性は名前だけを記録し、動画名・URL・ID・Cookie・値は収集しない。body到達を第三者スクリプトの保存成功と混同しない。実サイト結果を受けて採否を決め、通常版には未統合。


## フォロー新着 HAR で確認した遷移元（2026-11-12）

利用者提供の「フォロー新着.har」（484リクエスト）をオフライン解析。保存された実装だけでなく、watch取得のinitiator async stackにも以下の連鎖が記録されていた。

1. CommonHeader 3.13.4: ヘッダー外枠のonClickが `fo()` のハンドラーを呼ぶ。対象からaを探索し、`Sn.emit("commonHeader:linkClick", {href, preventDefault, nativeEvent})` を同期実行する。
2. `Layout-BxKlN5K9.js`: mount時に `r.on("commonHeader:linkClick", callback)` を登録。callbackはauxclick・Ctrl・Meta・target=_blankを判定するが、defaultPreventedは判定しない。通常クリックでは `nativeEvent.preventDefault()` → `r.closePanel()` → `o(e.href)` を呼ぶ。
3. Layoutの `o=ee()` は `Panel-QWHtNi15.js` のexport `s`、すなわち遷移hook `H`。watchは同一originのSPA対応ルートとしてルーターへ渡る。
4. 公式ルーターがwatch loaderを起動して画面を更新する。これはアンカーのブラウザ既定遷移ではない。

HAR entry 210のwatch fetchには `CommonHeader.emit` → `Layout` (line 1 / column 5978、CDPのlineは0-based) → `Panel` → `react`のルーター → `bridge`のfetchというasync initiator stackが保存されている。entry 195のwatch fetchは別経路で、Zenzaの`ClickNavigationTrial.begin` → `_open` → `fetchWatchResponse`に由来する。ページ全体の新しいdocument取得と混同しない。動画ID・認証情報・HAR本文は公開しない。

### なぜ2つの検証版が失敗したか

- preventDefaultのみ: 公式Layoutのcallbackがキャンセル済み状態を確認せずルーターを起動するため。
- window.open一時抑止: この経路はwindow.openを使用しない。
- 短時間のNavigation API抑止: 公式ルーター呼出し・loader処理そのものはNavigation APIのキャンセル対象ではない。履歴更新は後続の非同期処理に進む。今回のログの抑止0回は、ルーター入口を捕捉したことを意味しない。
- 以前の強い伝播停止: ヘッダー外枠のonClickに原イベントが届かず、内部イベント発行も止まるため二重起動が出なかった。

検索カードの共通リンクre/Vは入口でdefaultPreventedを検査する。ヘッダーはこの共通リンクを経由せず、別の内部イベント連携を経由する。見た目が同じリンクでも処理経路が異なる。

### 保存コードを使った再現

`node tools/research-follow-header-route.cjs <利用者提供HARへのパス>`

正確なcallbackだけを抽出し、事前確認したSHA-256一致時だけ、閉じる処理・遷移関数を代替オブジェクトへ置き換えて実行。公式bundle全体は実行せず、通信しない。

|入力|公式ルーター呼出し|
|---|---|
|通常クリック|あり|
|すでにpreventDefaultされたクリック|あり|
|Ctrlクリック|なし|
|auxclick|なし|
|target=_blank|なし|

callbackの前にdefaultPreventedを確認するモデルでは、キャンセル済みクリックのルーター呼出しが0になることを確認。ただしこれは公式コードへ実際に修正を配布したという意味ではない。

対象ファイル（HAR textをUTF-8として算出したSHA-256）:

- CommonHeader 3.13.4: `3165b1845cf0bb84690f194114cbe10ae7d65e90a1c7aa00949af5c2759c9a84`
- Layout-BxKlN5K9.js: `5a628a69f752d9c3e10a87c1d1568a84f8725d0f36b667108de2fae663a2b9cd`
- Panel-QWHtNi15.js: `e04766b44974bc24610eae4e5f5f80e9e4e43de38060a0701dfb33534193a8d6`
- Layout callback（文字offset 5793..5990）: `d1ac9e5dcb6dec2cc32dfc6ce6c1dc831b1c163755c907575a815c9bb9e300f4`

次の設計対象は、ヘッダー内部イベントから公式ルーターへ渡すこの境界。タイマーの延長や全域window.open/history差替えを続ける根拠はない。CommonHeaderにはonがあるが個別offが公開されていないため、既存リスナーを安全に差し替えられると未確認のまま決めつけない。接続の登録時点・復元方法・未知版での動作を検証してから修正方式を選ぶ。ランキングNG専用API・属性の操作はしない。

## click1018.3

CommonHeader.default.prototype.onの公開登録口でZenzaが扱う元のEventだけ配送を止める。defaultPreventedだけでは判定しない。動的scriptのloadをdocument captureで受け、公式loaderのインスタンス作成より先に接続。既にヘッダーがマウント済みなら既存登録解除口がないため、ヘッダー内のみ従来の伝播停止へ戻す。window.open/Navigation API差替え撤去。

型チェック、単体・生成物9件、既存境界17件、localhost Chrome5ケースを確認。実サイトのユーザー確認待ち。ランキングNG専用処理なし。

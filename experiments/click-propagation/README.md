> **task1019で本体に統合済みです。** 以下は検証時点の記録です。click1018.3はユーザーの実画面でフォロー新着の二重起動が解消したことを確認しました。現在は通常版を使用してください。
>
> この実験の再生成は `48196fd` の独立した作業ツリーで行ってください。以下の生成コマンドは当時の2.7.392を前提とし、統合後の配布物には適用しません。最新の検証手順は [task1019](../../docs/maintenance/NATIVE_OFFICIAL_LINKS_20261113.md) を参照してください。

# クリック遷移の検証版 2.7.392-click1018.3

提供HARで、フォロー新着はCommonHeader独自イベントから公式SPAルーターへ進み、defaultPreventedを確認しないことを確認しました。第3版は公開イベント登録口に接続し、Zenzaが扱う元のクリックだけ公式遷移へ渡しません。window.open・Navigation API差替えは撤去しました。

ランキングNG専用処理、合成クリック、URL変更はありません。接続が間に合わない場合はヘッダー対象クリックだけ従来の伝播停止へ戻します。実サイトはユーザー確認待ちです。

## インストール

[検証版をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/experiment/click-propagation1018/experiments/click-propagation/ZenzaWatch-click-propagation-trial.user.js)

既存の ZenzaWatch DEV版と同じ名前・namespaceで上書きします。二つの本体を同時に有効にしないでください。MylistPocketやZenzaBlogPartsButtonの更新は今回不要です。

インストール後、ニコニコのページを再読み込みし、上級者設定 → プレイリスト・検索 → リンク・移動 →「動画リンクをZenzaWatchで開く」をONにします。検証版では「動画リンクのクリックを他のスクリプトにも伝える」の保存値にかかわらず伝播を許可します。この保存値自体は変更しません。

## 確認

1. 未視聴の動画を選び、ヘッダーのフォロー新着で画像とタイトルをそれぞれクリック。Zenzaが一つだけ開き、公式ページ・別タブ・二つ目の音声が出ないか確認。
2. 動画を閉じ、新着欄をスクロールして別の動画で繰り返す。Zen / MylistPocket のボタンへマウスを移しても新着欄が消えないか確認。
3. 検索結果では画像、タイトル、動画カードの余白、投稿日をそれぞれ試す。動画起動領域ではZenzaだけが一回開くか確認。投稿者名・メニュー・あとで見る等は元の操作になるか確認。
4. 視聴済みを記録するスクリプトを普段どおり有効にし、未視聴動画をクリックして閉じる。視聴済み表示と、ページ再読み込み後の記録を確認。まず画像・タイトルの直接クリックで試す（カード余白を第三者スクリプトが検出するかは別の条件です）。これはニコニコ公式の視聴履歴とは別の確認です。
5. Ctrl＋クリック・中クリックは通常の別タブ操作になるか確認。これらでは公式ページが開くのが正常です。

問題があれば「フォロー新着／検索」「クリック位置」「Zenza・公式ページ・別タブのどれが開いたか」「視聴済みになったか」を報告してください。通信HARは不要です。

## 元に戻す

[通常版をインストール](https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaWatch-dev.user.js)して上書き（ダウングレードの確認が出たら承認）し、ニコニコのページを再読み込みしてください。設定やしおりを削除する必要はありません。今回の検証でクリック伝播の設定値は変更しないので、その値は検証前に戻ります。検証開始時に「動画リンクをZenzaWatchで開く」を変更した場合は必要に応じて戻してください。

## 開発・検証

再生成: `node experiments/click-propagation/build.cjs`

単体: `node --test experiments/click-propagation/build.test.cjs experiments/click-propagation/navigation.test.cjs`

Chrome: `node test/browser/click-navigation-trial.cjs`

型チェック、生成物・単体9件、既存クリック境界17件、localhost隔離Chrome5ケースを確認。早期接続・動的scriptロード・遅延接続の安全策・通常カード・対象外クリックを検証。実サイトの代替ではありません。

ConsoleのZENZA_CLICK_TRIALは版、処理経路、公式コールバック抑止数、body到達だけを出力します。header-bridgeは接続成功、header-safe-fallbackは従来の伝播停止。body到達は第三者スクリプトの保存成功を保証しません。URL・動画ID・設定値は記録しません。

通常版distと保存設定は未変更。CommonHeader公開API変更時は再検証が必要です。

# 機能の境界と段階的な整理

目的はファイル数を増やすことではなく、変更する理由と状態の所有者を明確にすることです。機能単位のフォルダを基本とし、その内部で保存・判断・表示を必要に応じて分けます。行数だけでは分割しません。

## 現在の構成

| 機能 | 主な実装 | 境界・今後の扱い |
| --- | --- | --- |
| コメント増量 | `packages/comment-history` | controller / history / transport / renderer / panel / settings が分離済み。既存の設定スキーマを維持する |
| ここまで見た・しおり・AB区間 | `packages/zenza/src/resume` | Policy / Store / Session / Panel / Dock を維持する。画面と保存を直接結び付けない |
| 再生バー・場面画像 | `packages/zenza/src/sceneSearch`, `storyboard` | 座標・表示・画像取得の既存の所有者を使う。新しいマーカーごとに座標処理を作らない |
| 画面フィルター | `packages/zenza/src/videoPlayer/ScreenFilter.js` | パラメータ定義を上級者設定と共有。描画処理とパネルの分離は次の変更時に検討する |
| 通知履歴 | `src/NotificationJournal.js`, `src/NotificationHistoryPanel.js`, `packages/zenza/src/notification` | 今回、内容の正規化と永続化を分離した。詳細は下記 |
| プレイリスト・音声 | `packages/zenza/src/Playlist`, `audio` | 既存の機能単位を維持する |
| 上級者設定 | `tools/typescript-stage1/advanced-src` | 各機能の定義と操作を受け取る接続役。全設定の自動生成は今回導入しない |
| プレイヤー全体の接続 | `NicoVideoPlayerDialog` | 多くの機能を結ぶ箇所。全面分割せず、機能を変更するときに接続の責務を小さくする |

表の `.js` にはTypeScriptからの生成物が含まれます。編集元は各ファイルの `GENERATED FROM` と対応マニフェストを確認してください。通知の正本は `tools/typescript-stage1/nico-src/*.ts`、しおりは `p12-src` です。配布時に一つのUserScriptへ束ねることと、開発時のモジュール分割は両立します。

## 通知の接続

```text
各機能 / PopupMessage
          ↓ record(input)
NotificationJournal ← list / clear / subscribe ← NotificationHistoryPanel
       ├─ NotificationJournalPolicy.normalize(input, identity)
       └─ NotificationJournalStore.create(indexedDB)
                     └─ append / list / clear
```

- **Policy**：通知の形式、許可する診断フィールド、URL・秘密情報の除去。DOM・DB・時刻取得に依存しない。
- **Store**：IndexedDBの接続、再接続、書き込み、保持件数、消去世代を所有する。UI・購読者・メモリ履歴を知らない。保存成功はトランザクション完了時にだけ返す。
- **Journal**：外部向けの既存窓口。識別子と時刻、重複通知の抑制、保存失敗時のメモリ履歴、購読通知を所有する。
- **Panel**：履歴の表示と利用者の操作。直接DBへアクセスしない。

機能からStoreへ直接書かず、Journalを経由させます。そうすることで、後から機能別の診断情報を追加しても、安全な記録方針が一か所に残ります。生のレスポンス・コメント本文・Cookieなどを診断欄へ渡さないでください。

DB名・バージョン・最大保存件数・既存の呼び出しAPIは維持しています。データ移行や設定変更は不要です。パネルの再設計、診断項目の追加、操作単位の追跡IDは別の変更として扱います。

消去前の保存待ち通知は無効にします。消去の購読通知に応じて新たに記録されたイベントは、消去後の記録として残します。この順序はJournalとStoreの両方のテストで確認します。

## 今後の判断基準

1. 同じ理由で変わる処理は近くに置く。別の理由で変わる保存・表示・判断は境界を作る。
2. 状態やイベント購読は一つの所有者が開始・解除する。他の機能が内部フィールドを直接変更しない。
3. 設定のキー・既定値・制約は既存定義を共有する。UIのために別の定義を作らない。
4. 正本がJavaScriptで、その機能に手を入れる必要があるときにTypeScript化を検討する。生成JavaScriptや未使用の候補を一括変換しない。
5. 共通化は実際の重複や変更理由を見て行う。将来の他製品への流用だけを理由に、汎用プラグイン基盤や機能登録システムを作らない。

次に通知UIを変更する際はPanelを中心に進められます。各機能のログを充実させる際は、必要な項目をPolicyの型・許可リストと一緒に追加し、Journalの既存窓口から報告します。

通信・応答の診断は [通信診断の接続範囲](REQUEST_DIAGNOSTICS.md) を参照してください。低レベルの観測処理は保存先を直接参照せず、初期化時に注入する通知先へ報告します。

## 上級者設定（Task993）

- `AdvancedSettingsController.ts`: Config復元待ち、遅延生成、再試行、入口、破棄。
- `_setting.ts`: 既存の各設定アダプターを組み合わせる画面ファクトリー。本体からConfigを受け取り、新しいConfigや保存キーを作らない。
- `ModernAdvancedSettingsModel.ts` / `ModernAdvancedSettingsUI.ts`: 編集・検証・保存と画面表示。個別設定機能の境界は維持。
- `_template.js` / `RootDispatcher.ts`: 本体と設定画面を接続。
- `_settingsRetired.js`: 旧UserScriptの削除案内のみ。設定データへのアクセスなし。

設定項目の自動生成や全機能の分割は今回の対象外です。内部モジュールを一つの本体配布物へまとめ、個別のUserscriptとしてインストールする必要をなくしました。

## 外部サイト再生（Task1017）

`packages/external-playback` に検出・設定・UI・終了処理を分離し、ZenzaBlogPartsButtonとして配布します。プレイヤーのコードは同時にビルドした本体から生成し、固定版の別実装は持ちません。通信アダプターと設定生成手順は [パッケージの説明](../packages/external-playback/README.md) を参照してください。

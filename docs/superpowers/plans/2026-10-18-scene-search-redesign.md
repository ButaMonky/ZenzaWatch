# Scene Search Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** シーンサーチを「シーク位置に追従」「位置を固定」と互換用の「従来表示」に整理し、小画面を含めて画像・ミニコメント・一覧を安全に操作できる確認版を作る。

**Architecture:** 新2方式は共通のnativeプレビューを使い、配置だけを純粋な座標計算で分ける。設定の移行・実効値、配置、DOM所有を別の小さなTSモジュールにし、既存Controller・Bridge・Interactionへ接続する。従来表示はnative所有を維持し、同じ設定を適用する。

**Tech Stack:** TypeScript 7.0.2（既存移行レーンと同版）、既存JavaScript/userscriptビルド、Mocha/assert/jsdom、独立Chrome/CDP。製品の新規実行時依存は追加しない。

**Spec:** [承認済み設計書](../specs/2026-10-18-scene-search-redesign.md)。2026-10-18の「では次へ進めて」で小画面の方針を含む設計から計画へ進む。実装開始は本計画のレビュー後。

## Global Constraints

- 基準は実機確認済み `f76cde6230ae1a05b34c2c2908e17dd60b731c67` / `2.7.304-scui02-twin-idle`。作業先は現在の `publication/task801-scui-preview-settings`。既存3ファイルの設定WIPを消さない。
- 画像の上にミニコメント、新2方式は任意の一覧をすぐ右隣に同時表示。従来表示だけ切替動作を維持する。
- `sceneSearch.commentPreviewVisible` 親、`sceneSearch.miniCommentVisible` と `sceneSearch.commentListVisible` 子は初期true。親OFFで子の値を変えない。一覧の許可とボタンによる開閉要求を分ける。
- 背景 `sceneSearch.commentListBackgroundOpacity` は0〜100整数、初期90。背景alphaだけ変更する。倍率 `sceneSearch.thumbnailScale` は50〜200整数、初期100。画像とminiを等比拡縮し、ボタンと一覧文字は縮めない。
- 共通 `sceneSearch.idleHideSeconds` は初期2秒、0で無効。hover/focus/drag/pin/移動経路を保護し、透明な大きな入力領域を作らない。
- 既存トグル・is-modifiedの青い光を使う。保存済みでも初期値と異なれば光る。「表示・非表示」と設定ID・編集中の値・親子依存を共用する。
- 新規の通常・全画面はfollow。小画面は通常側の設定を使い、実際の全画面が優先。既存の全画面連動値を保持する（新規も既存Configの初期falseを維持）。
- 小画面の動画は既定400×225、最小160×90。動画の実際の矩形とブラウザー下端のシークバーを測る。親containerにtransformを付けない。
- 新規モジュールはTSを正本にする。生成JSは直接編集しない。TextLabel / VideoCaptureUtil / gate / messageUtil と他担当のDataStorage移行は変更しない。
- 公開・非公開の履歴は丸ごと混ぜない。今回の公開確認版と、未統合Task730のdevelop統合は別工程。rebase / force pushは禁止。
- distは `node tools/build_task_sandbox.js` で再生成。Zenzaは既知の2.7.305より大きく、ビルド直前に予約済み最大版を確認して次の未使用版を予約する。@versionと起動ログを一致させる。Pocketは本計画で変更しない。
- 実装中は304と旧方式のソースを残す。確認版の実機承認前にdevelop統合・既存公開版の置換・他UIへの作業拡大をしない。

## Review Focus

1. Config既定値が存在するだけで「新設定は保存済み」と誤認し、旧hiddenを再表示する。破損JSON・storage拒否も含めTask1で確認する。
2. 小→全画面→小、動画移動、入力欄展開が重なり、座標が古いまま・操作中にパネルが飛ぶ。Task4/5で確認する。
3. 一覧OFFや親OFFで開閉要求・旧staticが失われ、ONへ戻しても元に戻らない。Task1/3/5で確認する。
4. 狭幅・倍率200%・一覧長文でminiだけずれる、文字も縮む、見えないパネルがクリックを奪う。Task3/4/6で確認する。
5. 画像の遅延完了、動画切替、方式変更、dispose後に古い描画・listener・timerが戻る。Task3/5/6で確認する。

---

## ファイルと実行規約

以下は作業ツリー内の相対パス。`S` = `tools/typescript-stage1/nico-src`、`R` = `packages/zenza/src/sceneSearch`、`T` = `test/unit` と記す。各表記はそのまま展開した正確なファイル名を指す。

| ファイル | 責務 |
| --- | --- |
| 新規 S/SceneSearchPreferences.ts → R/SceneSearchPreferences.js | 旧設定からの解決、実効コメント状態。旧値は保存したまま |
| 新規 S/SceneSearchPreviewView.ts → R/SceneSearchPreviewView.js | native画像・miniと別一覧Viewの所有、見た目、寸法、復元 |
| 新規 S/SceneSearchPlacement.ts → R/SceneSearchPlacement.js | 通常/小/全画面、follow/fixedの純粋な座標計算 |
| 復元 S/SceneSearchLayout00.ts | 既存生成JSと同等のTS正本。必要な互換修正はここだけ |
| 新規 tools/typescript-stage1/tsconfig.scui.json、package.json、package-lock.json、scripts/sync-scui.mjs、scui-runtime-manifest.json | 上記4モジュールだけを型検査・生成・照合する公開側の限定経路 |
| src/Config.js、src/ModernAdvancedSettingsModel.js | 値・範囲・移行境界・編集中の状態 |
| src/ModernAdvancedSettingsUI.js、src/UiVisibilityRegistry.js | 2カード/互換選択と既存設定部品、表示一覧の参照登録 |
| R/SceneSearchController.js、R/SceneSearchLayoutRegistry.js、R/SceneSearchLayoutBootstrap.js | 意味ベースの選択と単一の表示部品生成 |
| R/SceneSearchIntegrationBridge.js、R/SceneSearchPlayerBinding.js、R/SceneSearchLegacyAdapter.js | 設定、実際の画面状態、native描画の接続 |
| R/SceneSearchInteraction.js、R/ScenePreviewIdleLimiter.js | 既存の表示維持・移動経路を共用（必要な差分だけ） |
| src/VideoControlBar.js、src/NicoVideoPlayerDialog.js | native一覧の見た目、操作中/終了の配置通知 |
| T/*Test.js、tools/qa/scui-redesign-check.cjs、tools/qa/package-task801.cjs | 単体・ブラウザー・確認版検証 |

既存JSが実行時点でTS生成対象になっていたら、変更前に対応する正本と生成経路を確定し、表を更新する。非公開レーンのファイルを一括コピーしない。設定WIPはTask1で既存差分を読んで引き継ぐ。

各TaskのMochaコマンドは作業ツリーrootで `node node_modules/mocha/bin/mocha --require test/setup.js <列挙したTのファイル>` を使う。REDは追加した振る舞いのassertion失敗を確認する。単なるimport/構文エラーだけでRED完了としない。GREENは同コマンドが0終了・失敗0。実際のログと件数を私有のverify-logsへ保存する。

コミットは各TaskのFilesに挙げた変更だけを明示stageする。`git add .` を使わず、並行作業・私有ログ・依存キャッシュは含めない。新モジュールは既存のBEGIN/END・@require規約を維持してビルドへ接続する。

### Task 1: 設定の正本・移行とTS生成境界

**Files:** 新規 S/SceneSearchPreferences.ts、S/SceneSearchLayout00.ts、上表の限定TS生成経路、root package.json/lock/.gitignore。変更 src/Config.js、src/ModernAdvancedSettingsModel.js。Test: T/SceneSearchPreferencesMigrationTest.js、T/SceneSearchSourceParityTest.js、既存WIP T/SceneSearchPreviewAppearanceSettingsTest.js。

**Interfaces:**
- `SceneSearchPreferences.resolve(read: (key:string)=>unknown, hasSaved:(key:string)=>boolean): Preferences` は副作用なし。draftの明示変更はhasSavedと同じ優先度でreadへ渡す。
- `Preferences = {normal: Layout, fullscreen: Layout, linked:boolean, miniStyle:'flow'|'static', miniEnabled:boolean, listAllowed:boolean, listOpen:boolean, opacity:number, scale:number, migration: Array<{key:string, oldValue:string, newValue:Layout}>}`。`Layout = 'follow'|'fixed'|'legacy'`。
- `listOpen` は親ON、一覧子ON、既存 `enableCommentPreview` 要求ONの積。未保存mini子は旧hidden/flow/staticから解決。保存済み子を優先し、hiddenからONならflow。
- 新保存キーは `sceneSearch.presentation.normal` / `.fullscreen`（follow/fixed/legacy、初期follow）。連動は既存 `sceneSearch.layout.linkFullscreen` を共用する。移行告知確認は `sceneSearch.presentation.migrationAcknowledged`（初期false）。旧番号キーは更新しない。
- Config境界に `Config.hasStoredValue(key:string):boolean` を追加。restore後にstorageの実在と有効JSONを確認し、既定値と区別。アクセス拒否はfalseで安全に継続、書込みはしない。

- [ ] 設定WIPと既存テストを確認し、現在の83件を再検証して引継ぎ差分を記録する。
- [ ] 失敗テストを追加する。下記assertionに加え、全旧番号、両画面、正常な新形式の優先、無効な新形式のフォールバック、破損/拒否storageを検査する。

```js
// resolveFixture builds read/hasSaved from explicit stored values, not defaults.
assert.strictEqual(resolveFixture({'sceneSearch.layout.normal':'02'}).normal, 'fixed');
assert.strictEqual(resolveFixture({'sceneSearch.layout.normal':'00'}).normal, 'legacy');
assert.strictEqual(resolveFixture({'sceneSearch.miniCommentMode':'hidden'}).miniEnabled, false);
assert.strictEqual(resolveFixture({'sceneSearch.miniCommentMode':'hidden',
  'sceneSearch.miniCommentVisible':true}).miniStyle, 'flow');
assert.strictEqual(resolveFixture({'sceneSearch.miniCommentMode':'static',
  'sceneSearch.commentPreviewVisible':false}).miniEnabled, false);
assert.strictEqual(resolveFixture({'sceneSearch.commentListVisible':false,
  enableCommentPreview:true}).listOpen, false);
```

- [ ] 上記3テストを実行し、移行と正本照合が未実装で失敗することを確認する。
- [ ] 既存Task639の `a036cfa828c44b8c6538c713994be32a0389950d` からSceneSearchLayout00.tsとtsconfig.scui00.jsonを読み、公開JSとの生成同等性を確認して必要なTSだけ復元する。差があれば公開304の振る舞いを基準にTS側へ最小差分を反映し、JSを手修正しない。
- [ ] 限定生成経路を追加する。TS7.0.2、strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes/noEmitOnError、ES2022。`sync-scui.mjs --write|--check` は4パスのallowlistと前回hashで外部編集を拒否し、全事前検査後に書き、失敗時は復元。未追加のTask3/4モジュールは登録しない。root `nico:sync` / `nico:verify` はこの限定パッケージを呼び、保護対象4ファイルを触らない。
- [ ] resolve、Config境界、範囲検査を実装する。保存前は解決結果だけを使い、旧値を削除しない。初回明示保存で新形式を保存し、告知は実際に表示された後の確認操作でだけ既読化する。旧hiddenから子をONにして保存した値がConfigの初期trueと同じでも、明示した選択として保存され再読込後もONになることを追加assertする。DataStorage.setValueの同値早期returnに依存せず、Config側の限定した保存処理 `Config.persistSceneSearchSelection(values:Record<string,unknown>):void` で妥当性検査後の明示値を保存する。readonly/storage拒否は成功扱いにしない。親だけをOFFにした保存では未操作の子を初期trueで上書きせず、解決済みの値を保つ。JSON取込も同じ検証・解決を通し、不正値はatomic拒否する。
- [ ] `npm run nico:sync` → `npm run nico:verify` と上記3テストを実行しGREENを確認する。SourceParityは生成一致・再実行で差分なし・外国編集拒否・途中失敗の復元・保護対象不変を検査する。
- [ ] このTaskだけをstageし `feat: preserve scene search preferences through migration` でcommitする。

### Task 2: 上級者設定と表示・非表示の整理

**Files:** src/ModernAdvancedSettingsModel.js、src/ModernAdvancedSettingsUI.js、src/UiVisibilityRegistry.js。Test: T/SceneSearchAdvancedLayoutPickerTest.js、T/SceneSearchVisibilityManifestTest.js、T/SceneSearchSettingsSyncTest.js（新規）。

**Interfaces:** Task1のLayoutとConfig境界を消費する。既存 `get/set/resetItem/cancel/isEnabled/isDifferentFromDefault` と `sectionDescriptors(category,subcategory)` を維持し、同じidの参照表示を作る。 `_createSceneLayoutPicker()` はfollow/fixedの見本、折畳み互換選択、通常/全画面タブを返す。

- [ ] native設定UIを実際にmountするテストを追加する。fixtureの `openSection` / `toggle` / `save` / `cancel` は既存UIのclick/inputを発火し、モデルを直接書き換えて代用しない。

```js
h.openSection('シーンサーチ'); h.toggle('sceneSearch.miniCommentVisible', false);
h.openSection('表示・非表示');
assert.strictEqual(h.checked('sceneSearch.miniCommentVisible'), false);
assert.strictEqual(h.modified('sceneSearch.miniCommentVisible'), true);
h.save(); h.reopen();
assert.strictEqual(h.modified('sceneSearch.miniCommentVisible'), true);
h.resetItem('sceneSearch.miniCommentVisible');
assert.strictEqual(h.modified('sceneSearch.miniCommentVisible'), false);
```

- [ ] 3テストでREDを確認する。親OFF/子の無効化、両方向往復、cancel、再読込、fullscreen連動OFFへの復元、移行告知を一度だけ表示するケースも失敗させる。
- [ ] 既存トグルとカードを再利用してUIを実装する。親子3項目をUiVisibilityRegistryへ正本idで登録し、シーンサーチ群へまとめる。既存7項目の固定文言は実数から表示する。選択見本は画像上miniと隣の一覧を描き、draftだけで動く。保存イベントでのみ実プレイヤーへ反映する。
- [ ] 上記3テストとT/SceneSearchPreviewAppearanceSettingsTest.jsを実行しGREENを確認する。互換項目と通常/全画面を含めkeyboard操作・focus表示を確認する。
- [ ] このTaskだけをstageし `feat: simplify scene search settings and synchronize visibility` でcommitする。

### Task 3: 共通nativeプレビューと従来表示の見た目

**Files:** 新規 S/SceneSearchPreviewView.ts、生成 R/SceneSearchPreviewView.js。必要な互換差分は S/SceneSearchLayout00.ts。src/VideoControlBar.js。Test: 新規 T/SceneSearchSharedPreviewTest.js、既存 T/SceneSearchTwinNativeTest.js、T/SceneSearch00MiniDisplayModeTest.js、T/SceneSearch00OriginalCompatibilityTest.js。

**Interfaces:**
- `new SceneSearchPreviewView({document, host, image, mini, listView, onAction})`。image/miniは既存native要素。listViewは既存createListViewの戻り値に合わせたtyped adapter（要素とdispose）で、同じコメントモデルを使う。
- `mount():void; render({shown, miniEnabled, listOpen, opacity, scale, miniStyle}):void; fit({imageScale, listWidth, listMaxHeight}):void; getRects():DOMRect[]; dispose():void`。
- imageScaleは倍率ではなく実効の等比係数。画像・miniの共通論理寸法に適用し、ボタン/一覧文字を除外。disposeは元の親・次兄弟・style・hover callbackを正確に復元し複数回安全。

- [ ] native要素と共有モデルのfixtureを使い、所有・倍率・背景・復元の失敗テストを追加する。

```js
const before = h.captureNativeOwnership();
h.view.render({shown:true, miniEnabled:true, listOpen:true,
  opacity:40, scale:200, miniStyle:'static'});
h.view.fit({imageScale:1.5, listWidth:180, listMaxHeight:240});
assert.strictEqual(h.imageScale(), h.miniScale());
assert.strictEqual(h.listTextScale(), 1);
assert.strictEqual(h.listBackgroundAlpha(), 0.4);
h.hoverList(); assert.strictEqual(h.listBackgroundAlpha(), 0.4);
h.view.dispose(); h.view.dispose();
assert.deepStrictEqual(h.captureNativeOwnership(), before);
```

- [ ] 上記4テストでREDを確認する。0/40/90/100%、50/100/150/200%、後着画像・list時刻click/NG/scroll、flow/static/hidden復元を含める。
- [ ] 共通Viewを実装する。2方式は隣接一覧、legacyは既存切替を維持。legacyの画像と兄弟miniには同一の原点・等比変換を適用する。設定OFFはrequested一覧状態を消さず、effective状態だけ変える。背景alpha専用のCSS変数を使い、nativeのhover/更新中opacity規則が文字を薄くしないようプレビューの範囲で整理する。
- [ ] `npm run nico:sync` と上記4テストを実行しGREENを確認する。canvas解像度・Storyboardモデル・worker数を変えていないこともassertする。
- [ ] このTaskだけをstageし `feat: share native scene preview appearance without shifting mini comments` でcommitする。

### Task 4: 通常・全画面・小画面の配置計算

**Files:** 新規 S/SceneSearchPlacement.ts、生成 R/SceneSearchPlacement.js。Test: 新規 T/SceneSearchPlacementTest.js。

**Interfaces:**
- `SceneSearchPlacement.compute(input: PlacementInput): PlacementResult`。DOM読書きなし。
- `Rect={left:number,top:number,width:number,height:number}` はviewport CSS px。入力は `{layout:'follow'|'fixed', context:'normal'|'small'|'fullscreen', viewport:Rect, player:Rect, seekbar:Rect, obstacles:Rect[], anchorX:number, imageSize:{width:number,height:number}, requestedScale:number, listOpen:boolean, previous:PlacementResult|null, hold:boolean}`。
- 出力は `{rect:Rect, imageScale:number, listWidth:number, listMaxHeight:number, overlapsVideo:boolean}`。requestedScaleは50〜200の保存値、imageScaleは実効係数。求めたrectとTask3の実寸に差が出たら次の一回の測定で補正する。
- ギャップ8px、画面内余白8px、一覧初期幅280px/最小120px、ボタン最小32px、一覧の内部スクロールを使う。極端な小領域ではパネル内部をスクロール可能にして操作を失わない。

- [ ] テストfixture `smallFixture` は1280×720、bar=(0,680,1280,40)、player=(840,430,400,225)を既定とし、source監査で確認したcontainerとは異なる実際の動画矩形を使う。

```js
const a = SceneSearchPlacement.compute(smallFixture({anchorX:0}));
const b = SceneSearchPlacement.compute(smallFixture({anchorX:1279,previous:a}));
assert.deepStrictEqual(a.rect, b.rect); // fixedはシークで移動しない
assert.strictEqual(overlap(a.rect, smallFixture().seekbar), 0);
assert.strictEqual(overlap(a.rect, smallFixture().player), 0);
const c = SceneSearchPlacement.compute(smallFixture({previous:a,hold:true,
  player:{left:0,top:430,width:400,height:225}}));
assert.deepStrictEqual(c.rect, a.rect); // 操作終了まで逃げ回らない
```

- [ ] REDを確認する。320/768/1536幅、画像倍率4値、一覧ON/OFF、先頭/中央/末尾、四隅・中央・最小/自由比率/拡大動画、上下入力欄、viewport縮小をtable testにする。
- [ ] computeを実装する。followはanchor中心、fixed通常は動画直下に必要高さがあれば配置、なければ操作バー上。smallは現在の安全位置→バー上左→右→障害物の辺から作る空き矩形候補の順。保護操作部との重なりを最優先で避け、その後動画重複面積、移動距離、候補順で決める。hold中は移動を保留し画面外補正だけ行う。空き不足は一体縮小と一覧制限を行い、保存値を変更しない。
- [ ] `npm run nico:sync` と配置テストでGREENを確認する。全画面の座標原点変換はTask5に任せ、ここでは一貫してviewport座標を返す。
- [ ] このTaskだけをstageし `feat: place scene previews safely around small player controls` でcommitする。

### Task 5: プレイヤー接続・表示維持・破棄

**Files:** 上表RのController/Registry/Bootstrap/Bridge/Binding/LegacyAdapter/Interaction/IdleLimiter、src/NicoVideoPlayerDialog.js、src/VideoControlBar.js。Test: 新規 T/SceneSearchRedesignBindingTest.js、既存 T/SceneSearchInteractionHoldsTest.js、T/SceneSearchTwinIdleTest.js、T/SceneSearchLiveSettingsTest.js、T/SceneSearchControllerTest.js。

**Interfaces:** Task1 resolve、Task3 View、Task4 computeを消費する。
- Registry.validIdは旧番号に加え意味ベース3値を受け付ける。旧providerは残し、新follow/fixedを同じView factory、legacyを00 factoryへ接続。Controllerは意味ベースで選び、生成失敗fallbackはfollow。古い番号専用テストは移行テストへ役割を移す。
- `Bridge.updatePlacementContext({context:'normal'|'small'|'fullscreen', interactionActive:boolean}):void` を追加。旧 `setMode('normal'|'fullscreen')` は設定選択用として維持する。
- Dialogは既存drag/resizeの開始/終了/resetで `sceneSearchGeometryChange` に `{active:boolean}` を通知。Bindingはこのイベント、screenModeChange、fullscreenchange、viewport resize、入力欄/コマンド欄/メニューのサイズ変化を購読し、dirty時だけ一度のrAFで測定する。ResizeObserverはサイズ変化用でtransform位置監視の代用にしない。

- [ ] 既存native接続fixtureを拡張し、実際のview/listへpointer/focusイベントを送り検査する。

```js
h.showPreview(); h.focusList(); h.clock.tick(3000);
assert.strictEqual(h.allVisible(), true);
h.blurList(); h.leavePreview(); h.clock.tick(2001);
assert.strictEqual(h.anyVisible(), false);
assert.strictEqual(h.activeHitRects().length, 0);
h.seek(42); assert.strictEqual(h.currentTime(), 42);
h.setIdleSeconds(0); h.clock.tick(60000);
assert.strictEqual(h.allVisible(), true);
h.dispose(); h.resolveOldImage();
assert.strictEqual(h.ownedListenerCount(), 0);
assert.strictEqual(h.pendingTimerCount(), 0);
```

- [ ] 上記5テストでREDを確認する。親子OFF/ONで開閉要求復元、pinは場面も維持、fixedは場面更新、移動経路、動画切替、二重dispose、小→全画面→小、drag中の位置維持/終了後再評価を含める。
- [ ] 単一の表示状態を配線する。実際のfullscreenElement内のhostへ配置し、viewport→host座標変換を一箇所で行う。小画面の動画・seekbar・可視入力/操作部はそれぞれ実寸を読む。modeのCSSが反映されるframeまで待つ。scene全体の透明hostはpointer-events:none、実パネルだけauto。非表示では通過経路購読も解除する。
- [ ] 新2方式とlegacyに同じidle設定を適用する。既存Interaction/IdleLimiterを再利用し、hover/focus/drag/pinで維持。ピン解除、pointercancel、動画close、late画像完了時に世代番号を検査し、購読・timer・native所有を解放する。source変更なしのテストを都合よく弱めない。
- [ ] 5テスト、SceneSearch全単体テスト、`npm run nico:verify` を実行しGREENを確認する。常時rAF・mousemoveごとの全矩形再測定が増えていないことを計数fixtureで検査する。
- [ ] このTaskだけをstageし `feat: connect redesigned previews with shared idle and small player lifecycle` でcommitする。

### Task 6: ブラウザー検証と確認版の作成

**Files:** 新規 tools/qa/scui-redesign-check.cjs、tools/qa/package-task801.cjs、T/SceneSearchRedesignDistributionTest.js。変更 src/_template.js、生成dist/ZenzaWatch-dev.user.js、確認用review/task801/ZenzaWatch-dev.user.js。記録 docs/superpowers/plans/2026-10-18-scene-search-redesign-validation.md。

**Interfaces:** CDP harnessは既存scui-twin-check.cjsと同様に独立Chromeを使い、新fixtureに実製品class/CSSとnativeコメントモデルを読み込む。mockup HTMLだけの合格で代用しない。成果JSONは `{passed:number,failed:number,cases:Array<{name:string,ok:boolean}>}`、failed>0で非0終了。

- [ ] 実ブラウザーテストを追加する。3方式、通常/実Fullscreen API/小、幅320/768/1536、倍率50/100/150/200、背景0/40/90/100の組合せを機械検証し、代表ケースを画像確認する。全件単なるCSS class照合で代用しない。
- [ ] 新テストを旧304 fixtureで実行して、共有設定と小画面配置のassertionが失敗することを確認する。旧版そのものに新機能の合格を要求せず、回帰比較の基準として結果を保存する。
- [ ] 製品側fixtureに切替え、画像とminiの座標・canvas不変、一覧scroll/時刻click/NG、hold解除後の実タイマー非表示、0秒、実際のヒットテスト、focus中の入力欄、上下反転コマンド欄、drag/resize/resetを確認する。ブラウザーfullscreenはユーザージェスチャーでrequestFullscreenを呼ぶ。利用不可なら未検証と明記し、合格を捏造しない。
- [ ] `npm run nico:verify`、`npm test`、`node tools/qa/scui-redesign-check.cjs` を実行し、失敗0と未検証項目を記録する。既知UI07の旧幾何不合格6件は隠さず基準と比較し、新3方式の合格に混ぜない。
- [ ] 最新版予約を確認しZenzaだけ次の未使用版に更新する。src/_template.jsの@versionがbuild.jsで起動ログ用VERへ展開されるので、出力の両方を照合する。`node tools/build_task_sandbox.js --copy ZenzaWatch-dev.user.js` を実行し成功を確認する。もう一度sandboxで再現性を確認し、許容する差は既存build IDだけとする。
- [ ] package-task791.cjsを基にTask801用packagerを作る。実装本文はdistと同一、update/downloadURLだけ確認用branchへ向ける。DistributionTestで本文一致・メタデータと起動ログの版一致・旧304保持・Pocket不変を確認する。
- [ ] 最終差分とテスト結果を独立レビューし、指摘修正後は関係する検証を再実行する。成果物と検証記録だけを明示stageして `build: prepare scene search redesign review package` でcommitする。
- [ ] 確認版と通常/全画面/小画面の確認手順を渡す。公開push先・対象差分を確認し、既存の承認範囲を満たす場合だけ通常pushする。私有資料・全非公開ブランチは送らない。実機合格後のdevelop統合は別工程とし、その時点で最新develop merge・全テスト・所定integrateを実施する。

## 実装状況

2026-10-18: Task1〜6の実装と独立レビュー後、実機指摘を2.7.307〜311で修復。ユーザーが2.7.311の追従停止・自動非表示の修復を確認した。統合前の全体テストは実行時timeoutを10秒として3282 passing / 78 pending / 0 failing、nico:verifyも成功。公開pushは未実施。検証結果と計画との差分は同ディレクトリのscene-search-redesign-validation.mdを参照。

## 自己レビューと受け渡し

- 設計書の表示/互換/共通設定はTask1〜3、拡縮はTask3/4、idleと所有はTask5、小画面と実全画面はTask4〜6、公開境界と実機判定はTask6に対応する。
- Review Focusの5条件には各担当Taskの失敗テストを割り当てた。入出力のLayout/Preferences/Rect/PlacementResultと、requested/effectiveの扱いを共通化した。
- Task1の正本復元は広範なTS移行ではなく、今回触る範囲の再生成可能性を保証するため。先行設定WIPを引き継ぎ、他担当の未完了移行やTask730を巻き込まない。
- 全11方式の既存テストを一括削除せず、旧providerの回帰確認と新3方式の受入検査を区別する。性能改善・CA完全再現・全体TS移行完了は主張しない。
- 次の判断は「この計画で実装するか」と実行方式。担当がこの会話で順に実装するNative方式を推奨する。Task間でnative所有と設定状態の接続が密接なため、毎Taskの引継ぎを減らし、最後に独立レビューを置く。

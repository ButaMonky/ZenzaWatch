// Task318: source-of-truth descriptors and transactional settings drafts.
// A standalone domain model; no userscript behavior changes until the new UI is approved.
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
/** Advanced settings descriptor, preserved in legacy flat-key storage. */
export type AdvancedSettingsDescriptor = {
  id: string;
  label: string;
  category: string;
  subcategory: string;
  type?: string;
  description?: string;
  descriptionDetails?: string;
  dependsOn?: string | null;
  dependsOnValue?: unknown;
  disabledReason?: string;
  availability?: 'available' | 'unsupported';
  inputPresentation?: 'radio';
  addCurrentSite?: boolean;
  currentSite?: string;
  [metadata: string]: unknown;
};
export type AdvancedSettingsValue = string | number | boolean | null | unknown[] | Record<string, unknown>;
/** Flat public settings storage, without exposing private runtime keys. */
export interface AdvancedSettingsConfigStore {
  default: Record<string, unknown>;
  resolveSceneSearch?(): {enabled: boolean;normal: string;fullscreen: string;miniVisible: boolean;migration?: Array<{key:string;oldValue:string;newValue:string}>};
  persistSceneSearchSelection?(values: Record<string, unknown>): void;
  props?: Record<string, unknown>;
  readonly?: boolean;
  storage?: Record<string, string | undefined>;
  options?: {
    validateImport?(key: string, value: unknown): boolean;
  };
  getStoredValue?(key: string): unknown;
  setStoredValue?(key: string, value: unknown): void;
  getValue?(key: string): unknown;
  getNativeKey?(key: string): string;
  getStorageKey?(key: string): string;
  setValue(key: string, value: unknown): void;
}
export interface AdvancedShortcutAction {
  id: string;
  label?: string;
  description?: string;
  category?: string;
  defaultKey?: number;
  customSeekSlot?: boolean;
}
export interface AdvancedScreenParam {
  key: string;
  label: string;
  type?: string;
  desc?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<[string | number, string]>;
}
export interface AdvancedScreenPreset { id: string; label: string; user?: boolean; }
export interface AdvancedHistoryParam {
  key: string;
  label: string;
  type?: string;
  description?: string;
  min?: number;
  max?: number;
}
type AdvancedModelDescriptor = AdvancedSettingsDescriptor & {
  sortIndex?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{value: string | number; label: string}>;
  dependsOn?: string | null;
  input?: Element | null;
  aliases?: string[];
  actionId?: string;
  defaultKey?: number;
};
declare const ShareClipPreferences: {
  fields: Array<Pick<AdvancedModelDescriptor, 'id' | 'label' | 'type' | 'description' | 'options' | 'min' | 'max' | 'step' | 'unit'>>;
};
//===BEGIN===
//@require UiVisibilityRegistry
//@require ShareClipPreferences
class ModernAdvancedSettingsModel {
  declare config: AdvancedSettingsConfigStore;
  declare actions: AdvancedShortcutAction[];
  declare _screenPresets: AdvancedScreenPreset[] | (() => AdvancedScreenPreset[]);
  declare _screenParams: Map<string, AdvancedScreenParam>;
  declare _historyParams: Map<string, AdvancedHistoryParam>;
  declare _publicSettings: Map<string, AdvancedModelDescriptor>;
  declare _historyOrder: Map<string, number>;
  declare _screenOrder: Map<string, number>;
  declare categories: string[];
  declare descriptors: AdvancedModelDescriptor[];
  declare _byId: Map<string, AdvancedModelDescriptor>;
  declare saved: Record<string, unknown>;
  declare draft: Record<string, unknown>;
  static get CATEGORIES() {
    return [
      '再生・音声','画面・映像','コメント表示',
      'NG・表示対象','プレイリスト・検索','ショートカット','マウス・タッチ','通知履歴','外部連携','診断（上級者向け）','外部サイトからの再生'
    ];
  }
  static _clone<T>(value: T): T {
    if (value === undefined || value === null || typeof value !== 'object') {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }
  static _same(a: unknown,b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
  // Explicitly user-facing Config defaults that the old advanced panel did not
  // render. Private runtime state (lastWatchId, message, videoSearch.word, etc.)
  // must remain in Config for compatibility but must not become editable.
  static externalLinkSettings(): AdvancedModelDescriptor[] {
    return [
  {
    "id": "externalLinks.enabled",
    "label": "外部サイトでZenボタンを使う",
    "type": "boolean",
    "description": "ZenzaBlogPartsButtonのインストールが必要です。変更後は外部ページを再読み込みしてください。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定"
  },
  {
    "id": "externalLinks.siteMode",
    "label": "対象サイト",
    "type": "select",
    "inputPresentation": "radio",
    "options": [
      {
        "value": "all",
        "label": "すべてのサイト"
      },
      {
        "value": "allow",
        "label": "指定したサイトのみ"
      }
    ],
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.sites",
    "label": "対象サイト",
    "type": "textarea",
    "dependsOn": "externalLinks.siteMode",
    "dependsOnValue": "allow",
    "disabledReason": "「指定したサイトのみ」を選ぶと編集できます。",
    "description": "1行に1件。ドメインを指定すると、そのサブドメインも対象になります。",
    "descriptionDetails": "例：example.com は本体とサブドメインの全ページ。https://example.com/watch/* はそのURLのwatch配下だけ。* は任意の文字列です。HTTPSページで動作し、URLの#以降は判定しません。変更後はページを再読み込みしてください。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定"
  },
  {
    "id": "externalLinks.excludedSites",
    "label": "除外サイト",
    "type": "textarea",
    "description": "対象サイトと同じ書き方で1行に1件。除外を優先します。",
    "descriptionDetails": "「すべてのサイト」でも適用します。空欄なら除外なし。例：https://example.com/private/* を指定すると、そのURLの配下ではZenボタンを表示しません。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.displayMode",
    "label": "Zenボタンの表示方法",
    "type": "select",
    "description": "リンクの横・マウス・文字選択から選びます。",
    "descriptionDetails": "「常に表示」は対象リンクの横にボタンを配置します。サイトによっては改行や配置が変わるため、その場合は「マウスを置いたときに表示」を選んでください。文章中の動画IDはマウスを置くか、文字を選択すると表示します。",
    "options": [
      {
        "value": "inline",
        "label": "常に表示（リンクの横に配置）"
      },
      {
        "value": "hover",
        "label": "マウスを置いたときに表示"
      },
      {
        "value": "selection",
        "label": "文字を選択したときに表示"
      }
    ],
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.size",
    "label": "ボタンの大きさ",
    "type": "select",
    "options": [
      {
        "value": "small",
        "label": "小"
      },
      {
        "value": "normal",
        "label": "標準"
      },
      {
        "value": "large",
        "label": "大"
      }
    ],
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.redirects",
    "label": "中継リンク内の動画URLも検出",
    "type": "boolean",
    "description": "リンクを開かず、埋め込まれたニコニコ動画URLを調べます。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.textIds",
    "label": "文章中の動画IDも検出",
    "type": "boolean",
    "description": "入力欄・編集中・コード欄は対象外です。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.prefixes",
    "label": "検出する動画IDの接頭辞",
    "type": "textarea",
    "description": "1行に1種類。初期値はsm・nm・so・ssです。",
    "descriptionDetails": "数字やワイルドカードは付けず、英小文字2〜8文字だけを入力してください。例：smを登録するとsm12345を検出します。空白・カンマ区切りも使用できます。検出対象への追加は、本体での再生対応を保証するものではありません。事前通信は下の「再生情報の事前確認」で選択します。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.preflight",
    "label": "再生情報の事前確認",
    "type": "select",
    "description": "既定は追加通信なし。確認するタイミングを選べます。",
    "descriptionDetails": "確認しない：追加通信なし。Zenを押したとき：起動前に確認。ボタン表示前：見えている候補を順に確認（通信が増えます）。動画情報から判断するため、実際の再生成功までは保証しません。通信失敗や不明な応答では再生不可と決めつけず、通常の起動を試せます。結果は最大5分、100件まで一時保持し、同時確認は2件までです。",
    "options": [
      {
        "value": "off",
        "label": "確認しない（追加通信なし）"
      },
      {
        "value": "click",
        "label": "Zenを押したときに確認"
      },
      {
        "value": "display",
        "label": "ボタンを表示する前に確認"
      }
    ],
    "category": "外部サイトからの再生",
    "subcategory": "基本設定",
    "dependsOn": "externalLinks.enabled"
  },
  {
    "id": "externalLinks.consoleLog",
    "label": "外部サイト再生の動作をコンソールに詳しく出力",
    "type": "boolean",
    "description": "初期値OFF。調査用です。外部サイトのページと、再生用の枠（www.nicovideo.jp/robots.txt）の両方で、ボタンの検出・クリック・枠の作成・本体との接続・ログイン確認・動画を開く各段階と失敗理由を、開発者ツールのコンソール（F12）へ ZENZA_EXT として出します。",
    "descriptionDetails": "本体とZenzaBlogPartsButtonの両方へ設定が届くよう、ONにしたらニコニコ動画のページを一度再読み込みしてから外部サイトを開いてください。再生用の枠の記録は、コンソール上部の「top」を robots.txt の枠に切り替えると見えます（「すべてのコンテキスト」表示でも出ます）。URLのクエリ・Cookie・認証情報は出しません。",
    "category": "外部サイトからの再生",
    "subcategory": "基本設定"
  }
];
  }

  static visibleExtraSettings(): AdvancedModelDescriptor[] {
    const group=(category: string,subcategory: string,rows: Array<[string,string,Record<string,unknown>?]>)=>rows.map(([id,label,details={}] )=>
      ({id,label,category,subcategory,...details}));
    const slider=(min: number,max: number,step=0.01)=>({type:'slider',min,max,step});
    const select=(items: Array<[string | number,string]>)=>({type:'select',options:items.map(([value,label])=>({value,label}))});
    const screenModes=select([
      ['normal','通常'],['big','大'],['wide','ワイド'],
      ['small','小'],['sideView','サイドビュー'],['3D','3D']
    ]);
    const sharedNg=select([['NONE','無効'],['LOW','弱'],['MID','中'],
      ['HIGH','強'],['MAX','最大']]);
    return [
      ...this.externalLinkSettings(),
      ...group('診断（上級者向け）','コンソールへの詳細ログ',[
        ['diagnostics.console.enabled','詳細な診断ログをコンソールに出す',{type:'boolean',
          description:'不具合を調べるための情報を、ブラウザの開発者ツール（F12）の「Console」へ大量に出します。初期状態はOFFです。ONの間は少し重くなることがあるので、調べ終わったらOFFに戻してください。キー・Cookie・コメント本文・ユーザーIDなどは伏せ字にし、URLのクエリは消して出します。記録は ZenzaWatch.debug.diagnostics.copy() でまとめてコピーでき、.dump() で一覧表示できます。下の項目で出す種類を選べます（変更はすぐ反映されます）。'}],
        ['diagnostics.console.errors','エラー',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'捕捉されなかったエラー、処理されなかったPromiseの拒否、画像やスクリプトの読み込み失敗、セキュリティポリシー（CSP）による遮断を出します。ZenzaWatch由来かページ由来かの目安と、発生場所・スタックも付けます。'}],
        ['diagnostics.console.startup','起動と環境',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'ONにした時と起動時に、版・ビルド・ブラウザ・画面・回線・端末の情報、主な設定、保存領域の使用量を出します。ZenzaWatchの初期化にかかった時間と、失敗した場合はその内容も出します。'}],
        ['diagnostics.console.player','再生（動画要素）',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'動画要素の読み込み・再生・一時停止・シーク・待機・停止・エラーなどのイベントを、その時点の再生位置・バッファ・状態・コマ落ちと一緒に出します。再生中なのに3秒以上進まない「止まり」も知らせます。'}],
        ['diagnostics.console.network','通信',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'ニコニコ関係の通信を、状態コード・所要時間・転送量・キャッシュの有無と一緒に出します。動画データ（セグメント）は数が多いので10秒ごとにまとめ、件数・平均時間・推定速度を出します。失敗した通信は警告として出します。'}],
        ['diagnostics.console.notifications','通知',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'画面に出る通知や、通知履歴に記録される通信の問題・復旧を出します。通知履歴の「記録する機能」でOFFにした種類は出ません。'}],
        ['diagnostics.console.settings','設定の変更',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'設定が変わるたびに、項目名と新しい値を出します。NG・フィルター関係の値は伏せ字にします。'}],
        ['diagnostics.console.events','内部イベント（とても多い）',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'ZenzaWatch内部で発生するイベントを出します。量がとても多いので初期状態はOFFです。同じイベントが2秒以内に続いた場合はまとめます。'}],
        ['diagnostics.console.performance','負荷',{type:'boolean',dependsOn:'diagnostics.console.enabled',
          description:'画面が固まった時間（長いタスク）と、定期的にメモリ使用量・DOM要素数・動画のコマ落ち・処理の遅れを出します。'}],
        ['diagnostics.console.intervalSec','負荷を定期記録する間隔',{dependsOn:'diagnostics.console.performance',
          ...select([[0,'定期記録しない'],[10,'10秒ごと'],[30,'30秒ごと'],[60,'60秒ごと']]),
          description:'「負荷」がONのときに、メモリ使用量などをまとめて出す間隔です。'}],
        ['debug','開発用の細かいログ（従来のデバッグ出力）',{type:'boolean',
          description:'初期値OFF。ZenzaWatch の各部品が出す開発用の細かいログ（処理時間・NG判定の件数・コメント解析など）をコンソールへ出します。「診断ログ」とは別で、整理されていない生の出力です。とても多いので普段はOFFのままに。すぐに反映されます。'}]
      ]),
      ...group('通知履歴','基本設定',[
        ['notificationHistory.enabled','通知履歴を記録する',{type:'boolean',
          description:'これから発生する通知やエラーを履歴に残します。OFFでも画面の通知は表示され、保存済みの履歴は消えません。過去の記録を消す場合は通知履歴パネルの削除操作を使ってください。設定は「変更を保存」の後に反映されます。'}],
        ['notificationHistory.commentText','投稿したコメント本文を残す',{type:'boolean',dependsOn:'notificationHistory.record.comment',
          description:'投稿成功の記録に、自分が投稿した本文・動画タイトル・再生位置を保存します。OFFでは投稿の結果だけを記録します。すでに保存された本文は消えません。ニコニコ側のコメントや視聴履歴には影響しません。'}]
      ]),
      ...group('通知履歴','通知の種類',[
        ['notificationHistory.level.info','通常の通知',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'通常の操作案内などを記録します。 対象の機能もONのときに履歴へ残ります。画面の通知表示は変わりません。'}],
        ['notificationHistory.level.success','成功の記録',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'コメント投稿やいいねなど、成功として分類された結果を記録します。 対象の機能もONのときに履歴へ残ります。画面の通知表示は変わりません。'}],
        ['notificationHistory.level.warning','警告の記録',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'設定がOFFで適用されない場合など、注意が必要な通知を記録します。 対象の機能もONのときに履歴へ残ります。画面の通知表示は変わりません。'}],
        ['notificationHistory.level.error','エラーの記録',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'失敗として分類された通知を記録します。通信の問題は警告などに分類される場合もあります。 対象の機能もONのときに履歴へ残ります。画面の通知表示は変わりません。'}],
      ]),
      ...group('通知履歴','記録する機能',[
        ['notificationHistory.record.general','通常の操作通知',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'NG登録、コピー、プレイリストの読み込み完了など、画面に表示する一般的な通知を履歴に残します。詳しい種類が判明している通知には、その種類の設定が優先されます。'}],
        ['notificationHistory.record.player','動画情報・再生',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'動画情報の取得、動画の読み込み、再生開始、再生セッションの維持などに関する記録です。再生できない原因を確認するときに役立ちます。'}],
        ['notificationHistory.record.comment','コメントの取得・投稿・削除',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'コメントの取得や投稿・削除の結果を記録します。投稿本文を保存するかは「投稿したコメント本文を残す」で別に選べます。コメント増量やNGフィルター自体の動作は変わりません。'}],
        ['notificationHistory.record.like','いいね',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'いいねの操作結果と、いいね関連の通信の問題を記録します。OFFでもいいねの操作は通常どおり行えます。'}],
        ['notificationHistory.record.mylist','マイリスト・あとで見る',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'マイリストや「あとで見る」に関する通信の問題と復旧を記録します。リストの内容や保存動作には影響しません。'}],
        ['notificationHistory.record.playlist','プレイリストの通信',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'プレイリスト取得時の通信の問題と復旧を記録します。画面に出る一般的な読み込み完了通知は「通常の操作通知」で設定します。'}],
        ['notificationHistory.record.search','動画検索',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'検索時の通信の問題と復旧を記録します。検索結果や検索条件そのものを保存する設定ではありません。'}],
        ['notificationHistory.record.storyboard','場面画像・シーンサーチ',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'シークバーやシーンサーチで使う場面画像の情報取得に関する問題と復旧を記録します。画像キャッシュや表示設定には影響しません。'}],
        ['notificationHistory.record.tags','タグ・タグ候補',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'タグ情報、検索時のタグ候補、タグ編集キーなどの取得に関する問題と復旧を記録します。'}],
        ['notificationHistory.record.advertising','ニコニ広告・ギフト・提供情報',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'初期状態はOFFです。広告ブロックなどで繰り返される取得エラーを履歴に残しません。ニコニ広告、広告の装飾、ギフト、提供画面の支援者情報が対象です。調査が必要なときだけONにしてください。広告情報の取得や提供画面の表示自体を止める設定ではありません。'}],
        ['notificationHistory.record.nicoadEnd','動画の最後のニコニ広告',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'初期状態はONです。動画が最後で止まったときに表示するニコニ広告の動画一覧（最大10件）の取得エラーや、応答の形式が変わったことを記録します。「ニコニ広告・ギフト・提供情報」とは別の設定です。表示自体の切り替えは「再生・音声 › 提供画面」の設定で行います。'}],
        ['notificationHistory.record.related','関連動画・投稿者情報・大百科',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'関連動画やシリーズ、投稿者情報、大百科の取得に関する問題と復旧を記録します。'}],
        ['notificationHistory.record.network','その他の通信',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'上の種類に分類できない通信の問題と復旧を記録します。この項目をOFFにしても、上でONにした種類の通信記録は残ります。'}],
        ['notificationHistory.record.system','システム通知',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'システムとして分類された内部処理の通知を記録します。ブラウザのConsoleに出るすべてのログを取り込む機能ではありません。'}],
        ['notificationHistory.record.specChange','仕様変更の疑い',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'初期値ON。同じ機能で「応答の形式を読み取れない」などの失敗が、30分以内に別々の動画などで3件以上起きたとき、ニコニコ側の仕様変更の可能性として1件にまとめて記録します。詳細に「修正箇所の目安」（直すべきソースファイル）と「読めなかった項目」が出ます。'}],
        ['notificationHistory.record.scriptError','スクリプトエラー',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'初期値ON。ZenzaWatch 自身のコードで起きた想定外のエラー（TypeError など）を、エラーの種類と発生箇所つきで記録します。ニコニコのページ自体のエラーは記録しません。同じエラーは1件にまとめて回数を数えます。'}],
        ['notificationHistory.record.commentAction','コメント投稿・ニコる・削除',{type:'boolean',dependsOn:'notificationHistory.enabled',description:'初期値ON。コメントの投稿・ニコる・自分のコメントの削除が失敗したとき、理由と欠けていた項目を記録します（成功は記録しません。投稿したコメントの履歴は別の項目です）。'}],
        ['notificationHistory.maxRecords','記録する上限件数',{
          ...select([[1000,'1,000件'],[2000,'2,000件'],[5000,'5,000件（初期値）'],[10000,'10,000件'],[20000,'20,000件']]),
          dependsOn:'notificationHistory.enabled',
          description:'上限を超えると古い記録から自動で消します。1件は数百バイト程度の文字列なので、20,000件でも数MB程度です。'}],
        ['notificationHistory.maxAgeDays','記録を残す期間',{
          ...select([[7,'7日'],[30,'30日'],[90,'90日（初期値）'],[180,'180日'],[365,'1年'],[0,'無期限（上限件数のみ）']]),
          dependsOn:'notificationHistory.enabled',
          description:'これより古い記録は自動で消します。上限件数と両方が適用されます。'}],
      ]),

      ...group('再生・音声','再生動作',[
        ['autoPlay','動画を自動再生'],
        ['autoPlay:ginza','公式の動画ページで自動再生'],
        ['autoPlay:others','外部サイトで自動再生'],
        ['enableResume','前回の再生位置を利用'],
        ['loop','動画をループ再生'],
        ['autoPauseCommentInput','コメント入力中に動画を一時停止'],
        ['playbackRate','再生速度',{type:'number'}],
        ['playbackRate.respectExternal','拡張機能による再生速度の変更を受け入れる',{
          description:'初期値ON。Video Speed Controller のような拡張機能が再生速度を変えたとき、その速度をそのまま使い、上の「再生速度」の表示とコメントの流れる速さもその速度に合わせます。OFFにすると、拡張機能が変えてもZenza側の設定値へ戻します（従来の動作）。'
        }],
        ['enableSingleton','複数のプレイヤーを同時起動しない']
      ]),
      ...group('再生・音声','ここまで見た・しおり・ABリピート',[
        ['resume.recordEnabled','再生位置を自動で記録',{
          description:'既定ON。一時停止・終了時などの再生位置を動画ごとに1件保存します。OFFではZenzaWatchから端末・サーバーへ自動記録しません。保存済みの位置や手動しおりは消えず、位置の編集・削除は利用できます。公式プレイヤー側の記録には影響しません。'}],
        ['resume.clearOnComplete','最後まで再生したら「ここまで見た」を削除',{
          description:'既定ON。動画の再生完了時に自動位置だけを消去します。手動しおりは残ります。自動記録OFF時は消去しません。'}],
        ['bookmark.showToolbarButton','操作バーに「しおり・ABリピート」を表示',{
          description:'既定ON。「ここまで見た」「しおり」「ABリピート」の3タブを開きます。保存一覧では動画をまたいで位置・区間を検索、編集できます。場面画像はシーンサーチの画像を利用し、過去の動画は必要な画像だけ読み込みます。OFFにすると操作バーのボタンを非表示にします。再び使うときはこの設定をONにしてください。'}],
        ['bookmark.showVideoThumbnails','保存一覧に動画サムネイルを表示',{
          description:'既定ON。動画を識別する小さな画像を表示します。OFFでは画像の場所も詰め、動画サムネイルを読み込みません。'}],
        ['bookmark.showScenePreviews','シーンプレビューを表示',{
          description:'既定ON。保存位置や区間の場面画像を表示します。OFFではこのパネルからの場面画像の読み込みを止めます。シーンサーチには影響しません。'}],
        ['bookmark.thumbnailWidth','保存一覧の動画サムネイルの幅',{...slider(64,160,8),unit:'px'}],
        ['bookmark.titleFontSize','保存一覧の動画タイトルの文字サイズ',{...slider(11,18,1),unit:'px'}],
        ['bookmark.titleLines','保存一覧を閉じているときのタイトル行数',{
          ...select([[1,'1行'],[2,'2行'],[3,'3行']]),
          description:'長いタイトルは省略します。動画の項目を開くと全タイトルを表示します。'}],
        ['abRepeat.enabled','ABリピートを利用',{
          description:'既定ON。A（開始）からB（終了）の区間を繰り返し、再生バーに範囲を表示します。区間はしおりとして保存できます。動画の切替では実行中のリピートを解除しますが、保存した区間は残ります。OFFにすると実行中の区間リピートも停止します。'}]
      ]),
      ...group('再生・音声','音量',[
        ['volume','動画の音量',slider(0,1)],
        ['mute','動画をミュート']
      ]),
      ...group('再生・音声','旧設定・互換性',[
        ['speakLark','コメント読み上げ（現在は未対応）',{availability:'unsupported',disabledReason:'現在のプレイヤーでは未対応です。保存値は互換性のため保持します。',
          description:'旧設定ですが、現在のZenzaWatchには再生コメントを音声化する処理が接続されていません。ONにしても読み上げません。保存値は互換性のため保持します。'
        }],
        ['speakLarkVolume','読み上げ音量（現在は未対応）',{availability:'unsupported',disabledReason:'読み上げ機能が未対応のため変更できません。保存値は保持します。',
          ...slider(0,1),
          description:'コメント読み上げ機能が未実装のため、この音量値も現在の再生には作用しません。'
        }]
      ]),
      ...group('再生・音声','動画の取得',[
        ['forceEconomy','エコノミー画質で取得'],
        ['autoDisableNew','旧配信方式の画質を優先',{description:'旧配信方式を利用できる動画で、画質が良いと判定された場合に優先します。新配信方式のみの動画には作用しません。'}],
        ['dmcVideoQuality','旧配信方式の優先画質',select([
          ['auto','自動'],['veryhigh','最高'],['high','高'],
          ['mid','中'],['low','低']])],
        ['domandVideoQuality','新配信方式の優先画質',select([
          ['auto','自動'],['1080p','1080p'],['720p','720p'],
          ['480p','480p'],['360p','360p'],['144p','144p']])]
      ]),
      ...group('再生・音声','公式プレイヤー連携',[
        ['officialLaunch.button','公式プレイヤーに「Zen」ボタンを表示',{type:'boolean',
          description:'通常のニコニコ動画の再生バーに、今の動画をZenzaWatchで開くボタンを表示します。自動起動がオフでも使えます。ボタンを隠しても割り当てたキーは使えます。'}],
        ['officialLaunch.side','Zenボタンを置く位置',{...select([['left','コメント切替の左'],['right','コメント切替の右']]),dependsOn:'officialLaunch.button',
          description:'吹き出しのボタンを基準に位置を選びます。位置は公式の操作バーが表示されている間と全画面表示時に共通です。'}],
        ['officialLaunch.continueTime','手動で開くときに公式の再生位置を引き継ぐ',{type:'boolean',
          description:'ボタンとショートカットの両方に適用します。オンなら押した時点の位置から、オフなら冒頭から開きます。再生が終了した動画や位置をまだ取得できない動画は冒頭から開きます。'}],
        ['officialLaunch.restoreOnFailure','切り替えに失敗したら公式の再生を再開する',{type:'boolean',
          description:'切り替え中は公式を一時停止します。ZenzaWatchで読み込めなかった場合は公式へ戻り、切り替え前に再生していた動画だけ再開します。オフなら一時停止のまま戻ります。'}],
        ['overrideGinza','公式の視聴ページでZenzaWatchを優先',{description:'視聴ページをアドレス・ブックマーク・別タブなどで直接開いたときも、公式プレイヤーの代わりにZenzaWatchで再生します。ZenzaWatch を開いた時は、公式プレイヤーを必ず一時停止します。初期値OFF。下の項目で細かい動きを選べます。'}],
        ['overrideGinza.officialPlayer','ZenzaWatch が開いている間の公式プレイヤー',{
          ...select([['manual','開いた時に止める。公式の再生ボタンを押した時だけ一緒に再生する'],['block','止めたままにする（公式の再生ボタンを押しても再生しない）']]),
          dependsOn:'overrideGinza',
          description:'「開いた時に止める」では、ZenzaWatch を開いた時（別の動画に切り替えた時も）は必ず公式を止めます。そのあと公式プレイヤーの画面の上で再生ボタンを押すと、ZenzaWatch と一緒に公式も再生できます（画面モード「小」などで公式が見えている時）。公式が自分で再生し直そうとしても再生しません。'}],
        ['overrideGinza.followNavigation','公式の画面で別の動画へ移ったら、ZenzaWatch もその動画に切り替える',{type:'boolean',dependsOn:'overrideGinza',
          description:'ZenzaWatch が開いている時に、公式の画面の関連動画・ショート動画の次の動画などへ移ると、ZenzaWatch もその動画を再生します。OFF にすると、ZenzaWatch は今の動画のまま、公式は止めたままにします。'}],
        ['overrideGinza.openOnNavigation','ページを読み込まずに視聴ページへ移った時も ZenzaWatch で開く',{type:'boolean',dependsOn:'overrideGinza',
          description:'検索・タグ・ユーザーページ・フォロー新着などから、公式の画面の中で（ページを読み込み直さずに）視聴ページへ移った時に、公式プレイヤーを止めて ZenzaWatch で開きます。視聴ページで ZenzaWatch を閉じた動画は、公式で見られます。'}],
        ['overrideGinza.shorts','ショート動画も ZenzaWatch で開く',{type:'boolean',dependsOn:'overrideGinza',
          description:'ショート動画のページ（/shorts/）でも、公式プレイヤーの代わりに ZenzaWatch で再生します。OFF にすると、ショート動画は公式プレイヤーに任せます。'}],
        ['overrideGinza.resumeOnClose','ZenzaWatch を閉じたら、公式プレイヤーで続きから再生する',{type:'boolean',dependsOn:'overrideGinza',
          description:'視聴ページで ZenzaWatch を閉じた時に、公式プレイヤーで同じ位置から再生を続けます。初期値OFF。'}]
      ]),
      ...group('画面・映像','画面フィルター',[
        ['screenFilter.showDescriptions','画面フィルターの説明を表示'],
        ['screenFilter.showAdjustments','画面フィルターの調整欄を表示'],
        ['screenFilter.renderQuality','追加エフェクトの描画品質',{
          ...select([['normal','通常（元の解像度）'],['light','軽量（最大480p・30fps）']]),
          description:'軽量は追加エフェクトを縮小した映像へ適用します。画質と動きの滑らかさを抑えて処理量を制限します。スクリーンショットには影響しません。'}],
        ['screenFilter.changedOnly','変更した項目だけ表示'],
        ['screenFilter.splitPosition','左右比較の境界位置',{...slider(0,100,1),unit:'%'}],
        ['screenFilter.presetOrder','プリセットの並び順',{type:'screen-preset-order',
          description:'標準プリセットと保存したプリセットをそれぞれ並べ替えます。よく使うものは「先頭へ」で上に置けます。変更は下部の保存で確定します。'}],
        ['screenFilter.flipH','左右反転'],
        ['screenFilter.flipV','上下反転'],
        ['screenFilter.applyToScreenshot','スクリーンショットにも映像フィルターを適用'],
        ['screenFilter.applyToCommentPip','コメント付きPiPにも映像フィルターを適用']
      ]),
      ...group('画面・映像','表示モード',[
        ['screenMode','通常の画面モード',screenModes],
        ['screenMode:ginza','公式動画ページの画面モード',screenModes],
        ['screenMode:others','外部サイトの画面モード',screenModes]
      ]),
      ...group('画面・映像','小画面モード',[
        ['smallModeAspectLock','小モードで縦横比を固定'],
        ['controlBar.showOnPause.small','一時停止時に操作バーを表示',{
          description:'既定ON。「小」モードでは一時停止時に操作バーを表示します。動画や下コメントを隠したくない場合はOFFにできます。マウス操作による表示は維持します。'}],
        ['controlBar.hideAfterSeconds.small','操作バーが消えるまでの時間',{
          ...slider(0.2,10,0.1),unit:'秒',
          description:'「小」モードでマウス移動などにより表示した操作バーを隠すまでの時間。初期値3秒。実際の全画面表示中は全画面側の設定を使います。'}]
      ]),
      ...group('画面・映像','全画面モード',[
        ['autoFullScreen','自動でフルスクリーン'],
        ['fullscreenControlBarMode','全画面での操作バー',select([
          ['auto','自動'],['always-show','常に表示'],
          ['always-hide','常に隠す']])],
        ['controlBar.showOnPause.fullscreen','一時停止時に操作バーを表示',{
          description:'既定OFF。全画面・ワイド・3Dで一時停止しただけでは操作バーを表示しません。マウス操作は従来どおり可能です。操作バーの「常に表示／常に隠す」を優先します。'}],
        ['controlBar.hideAfterSeconds.fullscreen','操作バーが消えるまでの時間',{
          ...slider(0.2,10,0.1),unit:'秒',
          description:'全画面・ワイド・3Dで操作バーを自動で隠すまでの時間。初期値0.4秒。「常に表示／常に隠す」では自動非表示の設定は作用しません。'}]
      ]),
      // Native PiP is not the fullscreen screen mode or the video filter itself.
      // Keep all original-page thumbnail preferences in one discoverable section.
      ...group('画面・映像','PiP（小窓再生）',[
        ['pipPageThumbnail','PiP中、元の画面にサムネイルを表示',{
          description:'PiP（別の小窓）で動画を再生している間、元のZenzaWatchの動画領域に静止画を表示します。通常のPiPとコメント付きPiPの両方に共通します。\nこの設定をOFFにすると、元画面のサムネイルは表示されず、「元画面のサムネイルの選び方」も選択できなくなります。小窓内の動画・コメントには影響しません。'}],
        ['pipPageThumbnailSource','元画面のサムネイルの選び方',{
          ...select([
            ['smart','自動切替（推奨）'],
            ['legacy','従来方式（OGP優先）']
          ]),
          description:[
            '【なぜ切り替えが必要？】',
            'ニコニコ動画の公式APIは「OGP画像（SNS共有用、主に1280×720）」と「Player画像（視聴プレイヤー用、主に960×540）」を別々に返します。OGPの一部には、中央に大きな再生マークが画像自体に焼き込まれています。ZenzaWatchの再生ボタンが重なっているのではありません。',
            '',
            '【自動切替（推奨）】',
            'OGPが img.cdn.nimg.jp の元画像なら、高解像度のOGPを優先します（例：sm46962870）。OGPが goptim.video.nimg.jp 等の別配信元なら、再生マークを避けるためPlayer画像を優先します（例：sm46949237）。確認されたgoptim画像は候補から外し、画像が読み込めない場合はほかのサムネイルへ切り替えます。',
            '',
            '【従来方式（OGP優先）】',
            '配信元を区別せず、OGPの1280×720画像から順に表示します。元の高解像度画像を優先できますが、goptim配信の動画では中央に大きな再生マークが表示される場合があります。その場合も画像には手を加えません。',
            '',
            '【注意】',
            'この判定は現在確認できた配信方式に基づくもので、すべての動画で再生マークが消えることを保証するものではありません。選択は元ページの静止画だけに適用され、PiP小窓の動画画質・再生速度・コメントには影響しません。画像のURLは公式APIが返す値をそのまま使います。'
          ].join('\n')
        }]
      ]),
      ...group('画面・映像','プレイヤーの操作表示',[
        ['enableHeatMap','ヒートマップを表示'],
        ['enableStoryboard','シークバーのサムネイルを表示'],
        ['enableStoryboardBar','シーンサーチバーを表示'],
        ['menuScale','操作メニューの拡大率',{type:'number'}],
        ['videoInfo.ownerVideoKindsStyle','投稿者の ▶ の横の「動画のみ・ショートのみ」ボタン',{...select([
          ['row','名前の下の段の中央に「動画」「ショート」（既定）'],['stack','右に小さく縦2段'],['square','右に四角いアイコン2つ'],['shape','右に横長・縦長の形'],
          ['below','▶ の真下に丸いアイコン'],['off','出さない（▶ だけ）']
        ]),description:'動画情報の投稿者名の横にある ▶ にマウスを乗せると、投稿動画だけ・投稿ショート動画だけをプレイリストで開くボタンが出ます（一度出たら出したまま）。ここではその形と位置を選びます。▶ をそのまま押すと、どの設定でも動画とショートの両方を投稿日時の順に読み込みます。「名前の下の段」は最初からその段の場所を空けておくので、ボタンが出ても下の内容は動きません。ほかの形はボタンを名前の行に重ねて表示するので、名前の位置はずれません。'}]
      ]),
      ...group('画面・映像','シーンサムネイルのキャッシュ',[
        ['storyboardCacheMaxMB','画像キャッシュの保存容量',{
          ...select([[0,'永続保存しない'],[32,'32 MB'],[64,'64 MB'],[128,'128 MB'],[256,'256 MB'],[512,'512 MB']]),
          description:'再生中と保存位置のシーンサムネイルで共用する、圧縮画像のディスク保存容量です（1 MB = 1,048,576バイト）。画像展開後のメモリ使用量とは異なります。上限を超えた古い画像から整理します。'}],
        ['storyboardCacheDays','使っていない画像の保持期間',{
          ...select([[1,'1日'],[3,'3日'],[7,'7日'],[14,'14日'],[30,'30日']]),
          description:'最後に使ってからこの日数が過ぎた画像を整理します。しおり・再生履歴は削除しません。'}],
        ['savedSceneFetch','保存位置の足りない画像を取得',{
          description:'しおりや再生履歴で現在表示中の位置に画像がない場合だけ取得します。動画の再生や再生位置は変更しません。OFFでも保存済みの画像は表示します。'}]
      ]),
      ...group('画面・映像','シーンサーチ',[
        ['sceneSearch.presentation.normal','通常表示のシーンサーチ',{
          ...select([['follow','シーク位置に追従'],['fixed','位置を固定'],['legacy','従来表示']])}],
        ['sceneSearch.presentation.fullscreen','全画面のシーンサーチ',{
          ...select([['follow','シーク位置に追従'],['fixed','位置を固定'],['legacy','従来表示']])}],
        ['sceneSearch.layout.normal','旧形式の通常表示',{hidden:true,
          ...select([
            ['00','00 旧式表示（検証中）'],
            ['01','01 クラシック追従'],['02','02 左右ツインパネル'],
            ['03','03 サイドシェルフ'],['04','04 トップエッジ'],
            ['05','05 プレイバック・デッキ'],['06','06 マイクロ・カプセル'],
            ['07','07 3コマ・フィルム'],['08','08 片側引き出し'],
            ['09','09 分離リモコン'],['10','10 スマート自動回避']
          ]),description:'通常時のレイアウトです。動画の再生位置や設定値は変更しません。'}],
        ['sceneSearch.layout.linkFullscreen','全画面も同じ表示方式を使う',{
          description:'ONにしても全画面用に保存したレイアウトは消えません。OFFに戻すとその設定を再利用します。'}],
        ['sceneSearch.layout.fullscreen','旧形式の全画面表示',{hidden:true,
          ...select([
            ['00','00 旧式表示（検証中）'],
            ['01','01 クラシック追従'],['02','02 左右ツインパネル'],
            ['03','03 サイドシェルフ'],['04','04 トップエッジ'],
            ['05','05 プレイバック・デッキ'],['06','06 マイクロ・カプセル'],
            ['07','07 3コマ・フィルム'],['08','08 片側引き出し'],
            ['09','09 分離リモコン'],['10','10 スマート自動回避']
          ]),description:'通常表示と別のUIを使えます。連動がONのときは保存値を保持したまま適用を休止します。'}],
        ['sceneSearch.seekStepSeconds','シーンサーチ内の前後シーク秒数',{
          type:'number',description:'0〜600の整数。0にすると左右のシーク矢印を非表示にして枠を小型化します。既存のキーボード用カスタムシーク設定は変更しません。'}],
        ['sceneSearch.enabled','シーンサーチを表示',{
          description:'シーンサーチ全体を表示します。OFFでもコメントの個別設定や大きさは保持します。'}],
        ['sceneSearch.commentListScale','コメントプレビューの大きさ',{
          ...slider(100,200,1),unit:'%',description:'文字サイズは変えず、表示領域を広げて一度に見えるコメントを増やします。画面に収まる範囲で適用します。'}],
        ['sceneSearch.commentPreviewVisible','シーンサーチのコメント表示',{
          description:'ミニコメントとコメントプレビューの共通スイッチです。OFFの間は両方を隠し、下の個別設定は保持します。右側の動画コメント欄とは別です。'}],
        ['sceneSearch.miniCommentVisible','ミニコメントを表示する',{
          description:'サムネイル画像上のミニコメントを表示します。すべての表示方式で共通です。親のコメント表示をONにすると、この設定を再利用します。'}],
        ['sceneSearch.commentListVisible','コメントプレビューを表示する',{
          description:'コメントボタンで一覧を開けるようにします。ONにしても一覧は自動では開きません。すべての表示方式で共通です。親のコメント表示をONにすると、この設定を再利用します。'}],
        ['sceneSearch.commentListBackgroundOpacity','コメントプレビューの背景濃度',{
          ...slider(0,100,1),unit:'%',
          description:'一覧の背景だけを調整します。文字の濃さは変わりません。0%は透明、100%は不透明です。すべての表示方式で、通常表示・全画面共通です。'}],
        ['sceneSearch.thumbnailScale','サムネイルの大きさ',{
          ...slider(50,200,1),unit:'%',
          description:'サムネイル画像と画像上のミニコメントを一緒に拡大・縮小します。操作ボタンの大きさは変わりません。画面に収まる範囲で表示します。すべての表示方式で、通常表示・全画面共通です。'}],
        ['sceneSearch.miniCommentMode','画像上のミニコメントの表示方式',{
          ...select([
            ['flow','流れる（旧版と同じ）'],
            ['static','静止表示（最大5行）'],
            ['hidden','旧版の非表示設定（引き継ぎ用）']
          ]),
          description:'ミニコメントの動き方を選びます。表示のON/OFFは上の子スイッチを使います。旧版の静止表示設定も引き継ぎます。'}],
        ['enableCommentPreview','コメントプレビューを開いた状態にする',{
          description:'コメントボタンによる一覧の開閉と共通です。追従・固定は画像の隣に一覧を表示し、従来表示は切り替えます。上の許可スイッチがOFFの間は閉じた状態になります。'}],
        ['sceneSearch.controlsReveal','追加ボタンの開き方',{hidden:true,
          ...select([
            ['hover-focus','マウスを乗せるかフォーカスで開く'],
            ['click','クリックで開く'],['always','常に表示']
          ])}],
        ['sceneSearch.animation','UIのアニメーション',{
          ...select([
            ['off','無効（動きなし）'],['subtle','控えめ（推奨）'],['full','通常']
          ])}],
        ['sceneSearch.idleHideSeconds','プレビューを自動で隠すまでの時間',{
          ...slider(0,30,0.5),unit:'秒',
          description:'シークバー上にマウスを置き続けたとき、同じプレビューを表示する時間です。画像とコメント一覧で共通です。既定2秒。0秒にすると自動非表示を無効化します。ピン固定・ドラッグ・ボタン操作中は隠しません。'}]
      ]),
      // All color preferences use the single reusable advanced-settings color editor.
      ...group('画面・映像','通知・ポップアップ',[
        ['popup.notifyColor','通常・成功通知の背景色',{
          type:'color',hexOnly:true,
          description:'一時的な緑色の通知の背景色です。#RRGGBB または #RGB で指定できます。保存するまでプレイヤーには反映されません。'}],
        ['popup.warningColor','警告通知の背景色',{
          type:'color',hexOnly:true,
          description:'注意が必要なときに表示する通知の背景色です。初期色はオレンジです。#RRGGBB または #RGB で指定できます。保存するまでプレイヤーには反映されません。'}],
        ['popup.alertColor','エラー通知の背景色',{
          type:'color',hexOnly:true,
          description:'一時的な赤色のエラー通知の背景色です。#RRGGBB または #RGB で指定できます。保存するまでプレイヤーには反映されません。'}],
        ['popup.backgroundTransparency','通知背景の透明度',{
          ...slider(0,100,1),unit:'%',
          description:'通常・警告・エラー通知に共通の背景透明度です。0%は不透明（従来と同じ）、100%は背景が完全に透明です。文字や影、通知の表示時間には影響しません。'}]
      ]),
      ...group('画面・映像','スクリーンショット',[
        ['screenshot.prefix','保存ファイル名の先頭に追加する文字',{type:'text',
          description:'任意の文字に加え {date}（保存日）や {watchId}（動画ID）などの変数も使えます。'}],
        ['screenshot.filenameTemplate','保存ファイル名の構成・順番',{
          type:'text',
          description:'空欄は従来どおり「タイトル - 動画ID@再生位置.png」。プリセットまたは変数 {title} {watchId} {videoId} {uploader} {time} {date} {datetime} {suffix} を組み合わせて自由に指定できます。拡張子は常に.pngです。'
        }]
      ]),
      ...(typeof UiVisibilityRegistry==='undefined'?[]:UiVisibilityRegistry.descriptors()),
      ...group('コメント表示','表示・配置',[
        ['showComment','コメントを表示'],
        ['backComment','コメントを画面全体に流す',{
          description:'全画面・ワイド表示時に、動画を縮小せず画面全体へコメントを重ねます。通常表示では従来どおりです。'
        }],
        ['commentSpeedRate','コメントの移動速度',{type:'number',unit:'倍',
          description:'コメントが画面を横切る速さです。標準は1倍です。値を小さくすると、同じコメントを長く読めます。'}],
        ['autoCommentSpeedRate','倍速再生時もコメントの速さを保つ',{type:'boolean',
          description:'オンにすると、動画を1.5倍速や2倍速で見ているときも、流れるコメントをおおむね通常再生時の速さで読めます。初期値はオフです。'}],
        ['commentLayer.motionFrameRate','流れるコメントのフレームレート',{
          ...select([['auto','自動（画面に合わせる・初期値）'],['adaptive','自動（コメントの密度に合わせる）'],
            ['15','15 fps'],['30','30 fps'],['60','60 fps'],['120','120 fps']]),
          description:'通常プレイヤーで横に流れるコメントの位置を、1秒に何回変えるかを選びます。「画面に合わせる」はブラウザーの描画周期に任せます。「密度に合わせる」は同時に流れるコメントが60件以上で下の設定に切り替え、40件以下で元に戻ります。固定値が低いほど動きの刻みが見えやすくなります。画面のリフレッシュレートを超える回数は表示できません。PiPや保存するクリップにはそれぞれ専用の描画処理があります。'}],
        ['commentLayer.denseFrameRate','コメントが多い場面のフレームレート',{
          ...select([['15','15 fps'],['30','30 fps（初期値）'],['60','60 fps']]),
          dependsOn:'commentLayer.motionFrameRate',dependsOnValue:'adaptive',
          description:'「密度に合わせる」でコメントが集中したときの更新頻度です。動きの滑らかさを優先するなら60 fps、位置を変える回数を抑えたいなら15または30 fpsを選びます。同時に表示する件数は「同時表示するコメント数」で調整できます。'}],
        ['commentLayerOpacity','コメントの透明度',slider(0,1)],
        ['commentLayer.easyCommentOpacity','かんたんコメントの透明度',slider(0,1)],
        ['commentLayer.aiCommentOpacity','AIコメントの透明度',slider(0,1)],
        ['enableNicosJumpVideo','@ジャンプを有効化']
      ]),
      ...group('コメント表示','コメント一覧',[
        ['enableCommentPanel','コメント一覧を表示'],
        ['enableCommentPanelAutoScroll','コメント一覧を自動スクロール'],
        ['commentPanel.nicoruStyle','ニコるボタンの見た目',{...select([
          ['dark','公式ダークモード風（既定）'],['light','公式ライトモード風'],['legacy','旧式（以前のZenzaWatch）']
        ]),description:'コメント一覧のニコるボタンの色と動きです。どれでもニコった後にもう一度押すとニコるを取り消せます。'}]
      ]),
      ...group('コメント表示','文字・装飾',[
        ['commentLanguage','コメントの言語',select([
          ['ja-jp','日本語'],['en-us','英語（米国）'],['zh-tw','中国語（繁体字）']
        ])],
        ['baseFontFamily','コメントのフォント',{
          type:'font-picker',
          description:'候補にないフォントは「その他（自由入力）」を選んで入力できます。使用できないフォントは代替フォントで表示されます。',
          options:[
            {value:'',label:'標準（ZenzaWatchにおまかせ）'},
            {value:"'Yu Gothic','Meiryo',sans-serif",label:'游ゴシック'},
            {value:"'Meiryo',sans-serif",label:'メイリオ'},
            {value:"'MS Gothic',monospace",label:'MS ゴシック'},
            {value:"'Noto Sans JP',sans-serif",label:'Noto Sans JP'},
            {value:'serif',label:'明朝系'},
            {value:'sans-serif',label:'ゴシック系'},
            {value:'monospace',label:'等幅'}
          ]
        }],
        ['baseChatScale','コメント文字の拡大率',{
          ...slider(0.5,2,0.1),unit:'倍',
          description:'0.5〜2.0倍、0.1倍刻み。1.0倍が標準の大きさです。'
        }],
        ['baseFontBolder','コメント文字を太くする'],
        ['cssFontWeight','文字の太さ',select([
          ['normal','標準'],['500','少し太め'],['600','やや太め'],
          ['bold','太字'],['800','かなり太い'],['900','最も太い']
        ])],
        ['commentLayer.textShadowType','文字の影の形式',{
          ...select([
            ['','標準（軽い）'],['shadow-type2','輪郭を強調'],
            ['shadow-type3','ぼかした影（重い）'],
            ['shadow-stroke','縁取り2（対応ブラウザのみ）'],
            ['shadow-dokaben','ドカベン風']
          ]),description:'文字の読みやすさに影響します。ぼかした影は処理が重く、縁取り2は一部環境で表示されません。ドカベン風は主に固定コメント向けです。'
        }],
        ['commentLayer.ownerCommentShadowColor','投稿者コメントの影色',{
          type:'color',
          description:'色見本と #RRGGBB / #RGB 形式のどちらでも変更できます。従来の CSS 色名（green など）も保持できます。'
        }]
      ]),
      ...group('NG・表示対象','NG条件',[
        ['enableFilter','NGフィルターを有効化'],
        ['wordFilter','NGワード一覧',{type:'textarea'}],
        ['wordRegFilter','NGワード（正規表現）',{type:'text'}],
        ['wordRegFilterFlags','正規表現の適用オプション',{type:'regex-flags',
          description:'i は大文字・小文字を区別しない設定です。通常は初期値の i をおすすめします。m は ^ と $ を改行ごとの先頭・末尾に、s は「.」に改行も含め、u はUnicodeの文字単位を扱います。'}],
        ['userIdFilter','NGユーザーID一覧',{type:'textarea'}],
        ['commandFilter','NGコマンド一覧',{type:'textarea',
          description:'コマンドとはコメントの色・大きさ・表示位置などの指定です。1行に1つ記入すると、その文字列を含むコマンドのコメントがNGになります。現在はNGワードなどとの「いずれかに一致」で判定します（AND条件ではありません）。'}],
        ['removeNgMatchedUser','NGに一致する投稿者のコメントを全除外'],
        ['sharedNgLevel','NG共有の強度',sharedNg]
      ]),
      ...group('NG・表示対象','複合NGルール（上級者向け）',[
        ['ngComposite.rules','複合NG・置換ルール',{type:'composite-ng',
          description:'複数の条件をAND/OR/NOTで組み合わせ、コメントの非表示・置換・装飾解除などを設定します。詳細説明は画面内で開けます。'}]
      ]),
      ...group('NG・表示対象','コメント種別',[
        ['filter.fork0','通常コメントを表示'],
        ['filter.fork1','投稿者コメントを表示'],
        ['filter.fork2','かんたんコメントを表示'],
        ['filter.fork3','追加コメント種別を表示'],
        ['filter.defaultThread','通常スレッド'],
        ['filter.ownerThread','投稿者スレッド'],
        ['filter.communityThread','コミュニティスレッド'],
        ['filter.nicosThread','ニコスクリプトのスレッド'],
        ['filter.easyThread','かんたんコメントのスレッド'],
        ['filter.aiThread','AIコメントのスレッド'],
        ['filter.extraDefaultThread','追加の通常スレッド'],
        ['filter.extraOwnerThread','追加の投稿者スレッド'],
        ['filter.extraCommunityThread','追加のコミュニティスレッド'],
        ['filter.extraNicosThread','追加のニコスクリプトスレッド'],
        ['filter.extraEasyThread','追加のかんたんコメントスレッド']
      ]),
      ...group('プレイリスト・検索','プレイリスト',[
        ['playlist.maxItems','連続再生で増えるプレイリストの保持上限',{
          presentation:'dropdown',
          ...select(Array.from({length:10},(_,index): [number,string]=>{
            const n=(index+1)*1000;
            return [n,`${n.toLocaleString('ja-JP')}件${n===3000?'（初期値・推奨）':n>=8000?'（高負荷）':''}`];
          })),
          description:'1000～10000件を1000件刻みで選択します。初期値は3000件です。連続再生などで1件ずつ増える際の保持件数で、再生中の動画は残します。検索・マイリスト・シリーズ・投稿動画から取得した一覧は、設定値より多くても最大10000件まで保持します。複数の一覧を追加して10000件を超えると、既存動画を優先して余剰分を追加しません。設定を下げるだけでは現在の動画を削除しません。8000～10000件は高負荷になり得ます。動画が多いほど表示・並べ替え・保存が遅くなり、ブラウザの保存容量不足時は再読み込み後に復元できる件数が減るため、大きな一覧は書き出しも併用してください。'
        }],
        ['playlistLoop','プレイリストをループ'],
        ['continueNextPage','再生中の動画をページ移動後も再開'],
        ['enableAdDecoration','プレイリストで動画の装飾枠を表示']
      ]),
      ...group('プレイリスト・検索','動画の先読み',[
        ['playlist.prefetchAhead.enabled','動画を先読みする',{
          description:'初期値ON。次に見そうな動画の動画情報・再生許可・冒頭の映像音声をあらかじめ用意し、その動画を開いた瞬間にキャッシュを使って速く再生を始めます。連続再生・プレイリストのクリック・関連動画からの移動など、開き方を問わず効きます。どの一覧から先読みするかは下の3つで選べます。現在の動画の再生が安定しているときだけ1本ずつ順に通信します。追加の通信が発生します。データセーバーがONの間と、外部サイトからの再生（ZenzaBlogPartsButton で開いたプレイヤー）では先読みしません（他サイトに埋め込まれた状態では先読みデータを取得できず、通信とメモリを無駄に使うため）。失敗・期限切れ時は通常どおり読み込みます。'
        }],
        ['playlist.prefetchAhead.sourcePlaylist','プレイリストの動画を先読み',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値ON。プレイリストの次の動画から順に先読みします。連続再生で次に再生される動画なので、もっとも当たりやすい一覧です。'
        }],
        ['playlist.prefetchAhead.sourceRelated','関連動画欄の動画を先読み',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF。関連動画欄の上から順に先読みします。関連動画をたどって見るときに効きますが、実際には見ない動画も多いため通信が無駄になりやすい一覧です。'
        }],
        ['playlist.prefetchAhead.sourceDescription','動画情報欄の動画を先読み',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF。動画情報欄（説明文）に書かれている動画リンクを上から順に先読みします。シリーズの前後編を続けて見るときに効きますが、説明文には見ない動画のリンクも多く含まれます。'
        }],
        ['playlist.prefetchAhead.order','先読みする順番',{
          type:'prefetch-order',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'先読みを進める順番です（初期値「プレイリスト → 関連動画欄 → 動画情報欄」）。ドラッグして並べ替えられます（「上へ」「下へ」ボタンでも変更できます）。ONにした一覧それぞれから下の本数ずつ候補を取り、ここで決めた順に1本ずつ準備します。'
        }],
        ['playlist.prefetchAhead.window','先読みする本数（一覧ごと）',{
          ...slider(1,32,1),unit:'本',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'ONにした一覧それぞれから、何本先まで準備しておくかです（初期値5本）。3つともONで5本なら最大15本が対象になります。本数が多いほど通信量が増えます。'
        }],
        ['playlist.prefetchAhead.skipWhenLoop','ループ中は先読みしない',{type:'boolean',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF（ループ中も先読みします）。ONにすると、同じ動画を繰り返すループ再生の間は次の動画を先読みしません。ループ中に一覧から次の動画を選ぶことが少なく、通信量を抑えたい場合に使います。'}],
        ['playlist.prefetchAhead.skipWhenPaused','一時停止中は先読みしない',{type:'boolean',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF（一時停止中も先読みを続けます）。止めている間は回線が空いているので、次の動画を準備しておくのに向いています。ONにすると、一時停止中は先読みを止めます。'}],
        ['playlist.prefetchAhead.skipWhenDataSaver','データセーバー中は先読みしない',{type:'boolean',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF（データセーバー中も先読みします）。ONにすると、ブラウザや端末の「データセーバー（通信量の節約）」が有効な間は先読みしません。'}],
        ['playlist.prefetchAhead.cacheMB','メモリキャッシュの上限',{
          ...slider(16,512,16),unit:'MB',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'準備済みの冒頭データを保持する上限です（初期値128MB。1本あたり多くの場合1〜3MBなので、おおよそ40〜100本ぶん）。超えたときは古いものから順に破棄します。ページを閉じると消えます。'
        }],
        ['playlist.prefetchAhead.pacingMs','先読み間の待機時間',{
          ...slider(0,10000,100),unit:'ms',
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'1本準備するたびに置く待機時間です（初期値0＝待機なし）。実際の待機は設定値の1〜2倍の乱数になり、アクセスが機械的な等間隔になりません。低速回線やサーバーへの連続アクセスを抑えたいときに設定してください。'
        }],
        ['playlist.prefetchAhead.companions','コメント・場面画像も先読み',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値ON。次の動画のコメントと、シーンサーチ用の場面画像（最初のページ、シーンサーチがONのとき）も一緒に先読みします。切り替え直後からコメントが表示され、シークのプレビューも早く出ます。その分通信量は増えます。コメントは先読み時点の内容になります（手動の再読み込み・過去ログ指定では通常どおり取得します）。'
        }],
        ['playlist.prefetchAhead.showMark','先読み済みマークを表示',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'先読みが完了した動画のプレイリスト項目（サムネイル右上）に青い丸を表示します。初期値ON。'
        }],
        ['playlist.prefetchAhead.notifyReady','先読みが完了したときに画面に通知',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF。次の動画の先読みが終わってキャッシュに入ったとき、「次の動画の先読みが完了しました（smXXXX）」と画面に表示します。どの動画がいつ準備できたかを確かめたいときにONにしてください。先読みは1本ずつ順に進むため、本数を多くしているとその回数だけ表示されます。下の「先読みの通知」を「通知しない」にしているときは表示しません。'
        }],
        ['playlist.prefetchAhead.notifyHit','先読みが効いたときに画面に通知',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF。先読み済みのデータを実際に使って再生できたとき、「先読みが効きました（1.02秒で再生開始）」のように再生開始までの秒数を画面に表示します。下の「先読みの通知」を「通知しない」にしているときは表示しません。'
        }],
        ['playlist.prefetchAhead.notifyMiss','先読みなしの再生も画面に通知',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF。先読みを使えなかった再生でも秒数を表示します。上の通知と両方ONにすると、効いたときと効かなかったときの秒数を見比べられます。'
        }],
        ['playlist.prefetchAhead.consoleLog','先読みの動きをコンソールに詳しく出力',{
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'初期値OFF。調査用です。動画の切り替えに関わる判断と時間を、ブラウザの開発者ツールのコンソール（F12）へ細かく出します。出る行は、ZENZA_DIAG_ENV（版と設定の一覧）、ZENZA_PREFETCH_GATE（先読みを止めている条件）、ZENZA_PREFETCH_CANDIDATES（先読みの対象に選んだ動画・一覧の件数と位置）、ZENZA_PREFETCH_INPUT（再生が安定しているかの判断に使った値）、ZENZA_PREFETCH_PREPARE／_READY／_EVENT（先読みの準備の経過）、ZENZA_OPEN_TIMING（1回の切り替えの内訳。どの区間で何ms使ったか）、ZENZA_PLAYLIST_SAVE（プレイリスト保存のやり直し回数と所要時間）です。速くならないときは、この行をそのままコピーして開発者へ渡してください。出力量が多いので普段はOFFのままに。'
        }],
        ['playlist.prefetchAhead.notify','先読みの通知',{
          ...select([['off','通知しない'],['journal','通知履歴のみ'],['popup','失敗を画面にも表示']]),
          dependsOn:'playlist.prefetchAhead.enabled',
          description:'先読みの成否を通知する方法です。初期値は通知履歴のみです。「通知しない」にすると、上の2つの秒数通知も記録も行いません。'
        }]
      ]),
      ...group('プレイリスト・検索','検索',[
        ['videoSearch.selectContentType','検索対象',{
          ...select([['long','通常動画'],['short','ショート']]),
          description:'検索欄の「検索対象」と共通の設定です。ショートではニコニコのショート動画だけを検索します。短い通常動画を検索する設定ではありません。ショート検索では「再生中の動画の投稿者の動画のみ」は利用できません。'
        }],
        ['videoSearch.wordCountMode','検索候補のヒット件数を取得するタイミング',{
          ...select([
            ['on-demand','必要なときだけ（低通信量）'],
            ['auto','自動で表示（通信量が増える）'],
            ['off','件数を表示しない（最も低通信量）']
          ]),
          description:'検索行とタグ候補の件数を数える追加通信の設定です。「必要なときだけ」はマウスを乗せるか↑↓キーで選んだ候補のみ取得します。初期設定の「自動」は検索語と表示中のタグ候補を順番に数えます。取得済みの件数は再利用します。「表示しない」は件数の追加通信を行いません。通常の検索やタグ予測の通信には影響しません。'
        }],
        ['videoSearch.videoIdSuggestMode','検索欄に表示する候補の配置',{
          ...select([
            ['merged','すべて縦にまとめる'],
            ['side','タグ候補と動画を左右に表示'],
            ['delayed','タグ候補を先に表示、動画を後から表示']
          ]),
          description:'検索候補と動画IDのカードをどう並べるかの設定です。検索件数の問い合わせ回数を減らす設定ではありません。'
        }],
        ['search.limit','検索1回で取得する最大動画数',{
          ...slider(1,5000,1), unit:'件', input:null,
          description:'1～5000件を1件刻みで指定できます。初期値は1000件です。連続再生の保持上限とは別に、1回の動画・タグ検索から取り込む最大件数を決めます。取得済みの検索結果は保持上限を超えても残します。1～99件も指定した件数のまま使います。多いほど通信量と待ち時間が増え、候補のヒット件数表示には影響しません。検索APIの制約や予備検索への切り替えにより指定件数まで取得できない場合があります。'
        }]
      ]),
      ...group('プレイリスト・検索','関連メニュー › カスタムリンク',[
        ['relatedMenu.builtinOptions','標準関連メニューの詳細編集',{type:'related-builtin-options',
          description:'標準機能の表示名、開き方、動画IDコピーなどの設定です。'}],
        ['relatedMenu.order','関連メニューの並び順と表示／非表示',{
          type:'related-order',
          description:'標準7件・カスタムリンク・登録アクションを同じ一覧で移動し、項目ごとに表示を切り替えます。非表示にしても機能や保存したリンクは削除しません。動画固有の表示条件は優先されます。'
        }],
        ['relatedMenu.hiddenItems','関連メニューで非表示にする項目',{
          type:'related-visibility',
          description:'各行の「表示する」で設定します。非表示にしても設定や外部アクションの登録は維持されます。'
        }]
      ]),
      ...group('プレイリスト・検索','リンク・移動',[
        ['overrideWatchLink','動画リンクをZenzaWatchで開く',{
          description:'ニコニコ動画内のリンクが対象です。公式の視聴ページ（動画を再生しているページ）でも働き、そのときは公式プレイヤーを一時停止してから ZenzaWatch で開きます。外部サイトの直接クリック切替は非対応です。'}],
        ['overrideWatchLink:allowPropagation','動画リンクのクリックを他のスクリプトにも伝える',{
          hidden:true, description:'クリック伝播は自動で管理します。'}],
        ['overrideWatchLink:others','外部サイトの動画リンクをZenzaWatchで開く',{hidden:true}],
        ['enablePushState','ブラウザの履歴への反映を利用'],
        ['historyExtension.enable','旧：視聴履歴の拡張機能に記録させる',{hidden:true,description:'Task1046 の旧設定です。「外部連携」の各項目に置き換わりました。'}],
        ['allowOtherDomain','外部サイトの連携を許可'],
        ['loadLinkedChannelVideo','チャンネル動画のリンクを取得']
      ]),
      // Task1047: 外部のブラウザ拡張機能との連携。中身は nico-src/ExtensionIntegrations.ts（アダプターを足したらここにも1行足す）
      ...group('外部連携','ブラウザ拡張機能',[
        ['extensionIntegration.enable','外部のブラウザ拡張機能との連携を使う',{dependsOn:'enablePushState',
          description:'初期状態はONです。ZenzaWatch は公式の視聴ページを開かずに、検索・タグ・ランキングなどのページの上で動画を再生します。そのため「公式の視聴ページを読んで動く」ブラウザ拡張機能（視聴履歴を保存するものなど）は、ZenzaWatch で見た動画に気づけないことがあります。この設定をONにすると、下で選んだ拡張機能が ZenzaWatch で見た動画も扱えるよう、拡張機能ごとに必要な情報をページに用意します。',
          descriptionDetails:'しくみ：ZenzaWatch は動画を開くと、既読リンクの色を変えるために URL を約3秒だけ動画のページ（/watch/動画ID）に書き換えます（「プレイリスト・検索 › リンク・移動」の「ブラウザの履歴への反映を利用」）。外部連携はこの約3秒の間だけ働き、URL を元に戻すとき・ZenzaWatch を閉じたときに、用意したものを必ず取り除きます。ページの見た目やほかの機能には影響しません。\n用意するのは、題名・投稿者名・ジャンル・タグ・サムネイル・長さといった、動画ページで公開されている情報だけです。ZenzaWatch から外部へ何かを送ることはありません。\n「ブラウザの履歴への反映を利用」がOFFのときは URL を書き換えないため、外部連携も働きません。\n拡張機能側の仕様が変わると、連携が効かなくなることがあります（その場合も ZenzaWatch の動作は変わりません）。'}],
        ['extensionIntegration.nicotubeSaver','ニコつべSaver で ZenzaWatch の視聴を記録する',{dependsOn:'extensionIntegration.enable',
          links:[{label:'ニコつべSaver（Chrome ウェブストア）',url:'https://chromewebstore.google.com/detail/%E3%83%8B%E3%82%B3%E3%81%A4%E3%81%B9saver/aghilngeclanbmagpeacpecnpachdpbc'}],
          description:'初期状態はONです。視聴履歴を保存する拡張機能「ニコつべSaver」が、ZenzaWatch で見た動画も記録できるようにします。ニコつべSaver を入れていない場合は何も起きません。',
          descriptionDetails:'ニコつべSaver は、URL が動画のページになったときに、そのページから題名・投稿者・ジャンル・タグ・サムネイル・長さを読み取って記録します。検索ページなどにはこれらの部品が無いため、以前は ZenzaWatch で見た動画が記録されませんでした。\nONのとき、URL を書き換えている約3秒の間だけ、公式の視聴ページと同じ名前の部品を見えない形でページに置きます。その間はタブの題名も「動画の題名 - ニコニコ動画」になります（ニコつべSaver が題名をこの形で読み取るため）。ジャンルが無い動画は「未設定」として渡します。\n対応を確認したバージョン：ニコつべSaver 4.1（2026年11月）。\n参考：「ニコ動アーカイブ」は URL の書き換えだけで記録されるため、この設定は不要です（ただし拡張機能側の制限で、ショート動画は記録されず、5秒以内に次の動画へ進むと前の動画が記録されません）。'}]
      ]),
      ...group('マウス・タッチ','マウス',[
        ['enableTogglePlayOnClick','動画クリックで再生・停止']
      ]),
      ...group('マウス・タッチ','タッチ',[
        ['touch.enable','タッチジェスチャーを有効化']
      ])
    ];
  }
  static subcategoryPriority(category: string,subcategory: string): number {
    // The left-hand navigation must not move when legacy DOM order changes.
    const order: Record<string,string[]>={
      '再生・音声':['再生動作','ここまで見た・しおり・ABリピート','音量','読み上げ','動画の取得','公式プレイヤー連携','提供画面'],
      '画面・映像':['表示モード','小画面モード','全画面モード','動画ヘッダー','PiP（小窓再生）','プレイヤーの操作表示','シーンサーチ','シーンサムネイルのキャッシュ','表示・非表示','通知・ポップアップ','画面フィルター','スクリーンショット'],
      'コメント表示':['表示・配置','コメント一覧','文字・装飾','追加取得'],
      'NG・表示対象':['NG条件','コメント種別','動画の除外'],
      'プレイリスト・検索':['プレイリスト','動画の先読み','検索','リンク・移動',
        '関連メニュー › カスタムリンク','診断'],
      'ショートカット':['プレイヤー全般','再生','シーク','再生速度','音量','コメント',
        '画面','画面フィルター','フィルタ/NG','プレイリスト','マイリスト','共有','その他'],
      'マウス・タッチ':['マウス','タッチ']
    };
    const index=(order[category]||[]).indexOf(subcategory);
    return index<0?1000:index;
  }
  static categoryFor(key: string, action?: {category?: string}|null): [string,string] {
    if (key === 'relatedMenu.customLinks') {
      return ['プレイリスト・検索','関連メニュー › カスタムリンク'];
    }
    if (/^KEY_/.test(key) || /^PARAM_CUSTOM_SEEK_/.test(key)) {
      return ['ショートカット',action && action.category || 'シーク'];
    }
    if (/^(resume\.|bookmark\.|abRepeat\.)/.test(key)) { return ['再生・音声','ここまで見た・しおり・ABリピート']; }
    if (/^supporterCredit\./.test(key) || key === 'nicoadEnd.enable') { return ['再生・音声','提供画面']; }
    if (/^audio\./.test(key) || /^(volume|mute|speakLark)/.test(key)) {
      return ['再生・音声','音量'];
    }
    if (/^(commentHistory\.|commentHistory[A-Z]|comments\.history|commentIncrease)/.test(key)) {
      return ['コメント表示','追加取得'];
    }
    if (/^(touch\.|touch[A-Z])/.test(key)) { return ['マウス・タッチ','タッチ']; }
    if (/^(mouse|enableTogglePlayOnClick|enableFullScreenOnDoubleClick|enableDblclickClose)/.test(key)) {
      return ['マウス・タッチ','マウス'];
    }
    if (/^(word(Reg)?Filter|wordRegFilterFlags|video(Tag|Owner)Filter|enableFilter|sharedNg)/.test(key)) {
      return ['NG・表示対象',/^video(Tag|Owner)Filter/.test(key)?'動画の除外':'NG条件'];
    }
    if (/^(commentLayer\.|enableCommentPanel|autoScrollComment)/.test(key)) {
      return ['コメント表示',key === 'enableCommentPanel'?'コメント一覧':'表示・配置'];
    }
    if (/^screenFilter\./.test(key)) { return ['画面・映像','画面フィルター']; }
    if (/^videoHeader\./.test(key)) { return ['画面・映像','動画ヘッダー']; }
    if (/^(screen|smallMode|autoFullScreen|autoCloseFullScreen|fullscreen|enableBackComment)/.test(key)) {
      return ['画面・映像','表示モード'];
    }
    if (/^(search\.|videoSearch\.|videoIdSuggest)/.test(key)) {
      return ['プレイリスト・検索','検索'];
    }
    if (/^(playlist|enableAdDecoration|continueNextPage)/.test(key)) {
      return ['プレイリスト・検索','プレイリスト'];
    }
    if (/^(debug|diagnostic)/.test(key)) { return ['プレイリスト・検索','診断']; }
    return ['再生・音声','再生動作'];
  }
  static dependencyFor(key: string): string | null {
    if(key==='ui.scene.commentToggle'||key==='ui.scene.commentSearch'||key==='enableCommentPreview')return 'sceneSearch.commentListVisible';
    if(key.startsWith('ui.scene.'))return 'sceneSearch.enabled';
    if(key==='sceneSearch.miniCommentMode')return 'sceneSearch.miniCommentVisible';
    if(key==='sceneSearch.commentListScale'||key==='sceneSearch.commentListBackgroundOpacity')return 'sceneSearch.commentListVisible';
    if(key.startsWith('sceneSearch.')&&!['sceneSearch.enabled','sceneSearch.commentPreviewVisible','sceneSearch.miniCommentVisible','sceneSearch.commentListVisible'].includes(key))return 'sceneSearch.enabled';
    if(key.startsWith('commentHistory.') && key!=='commentHistory.enabled') {
      return 'commentHistory.enabled';
    }
    if(key.startsWith('filter.') || ['wordFilter','wordRegFilter',
      'wordRegFilterFlags','userIdFilter','commandFilter','sharedNgLevel',
      'removeNgMatchedUser','ngComposite.rules'].includes(key)) { return 'enableFilter'; }
    const direct: Record<string,string>={
      'supporterCredit.enable':'uaa.enable',
      'nicoadEnd.enable':'uaa.enable',
      'sceneSearch.commentPreviewVisible':'sceneSearch.enabled',
      'sceneSearch.miniCommentVisible':'sceneSearch.commentPreviewVisible',
      'sceneSearch.commentListVisible':'sceneSearch.commentPreviewVisible',
      'supporterCredit.voice':'supporterCredit.enable',
      'supporterCredit.gift':'supporterCredit.enable',
      'supporterCredit.skipInPlaylist':'supporterCredit.enable',
      'touch.tap2command':'touch.enable','touch.tap3command':'touch.enable',
      'touch.tap4command':'touch.enable','touch.tap5command':'touch.enable',
      'enableCommentPanelAutoScroll':'enableCommentPanel',
      'extensionIntegration.enable':'enablePushState',
      'extensionIntegration.nicotubeSaver':'extensionIntegration.enable',
      'commentPanel.nicoruStyle':'enableCommentPanel',
      'pipPageThumbnailSource':'pipPageThumbnail',
      'bookmark.thumbnailWidth':'bookmark.showVideoThumbnails',
      'speakLarkVolume':'speakLark'
    };
    return direct[key] || null;
  }
  constructor({config,legacyRoot=null,actions=[],screenFilterParams=[],screenFilterPresets=[],historySchema=[]}: {
    config: AdvancedSettingsConfigStore;
    legacyRoot?: HTMLElement | null;
    actions?: AdvancedShortcutAction[];
    screenFilterParams?: AdvancedScreenParam[];
    screenFilterPresets?: AdvancedScreenPreset[] | (() => AdvancedScreenPreset[]);
    historySchema?: AdvancedHistoryParam[];
  }) {
    if (!config || !config.default) { throw new TypeError('Config defaults are required'); }
    this.config=config;
    this.actions=actions.slice();
    this._screenPresets=screenFilterPresets;
    this._screenParams=new Map((Array.isArray(screenFilterParams)?screenFilterParams:[])
      .filter(p=>p&&typeof p.key==='string')
      .map(p=>['screenFilter.'+p.key,p]));
    this._historyParams=new Map((Array.isArray(historySchema)?historySchema:[])
      .filter(p=>p&&typeof p.key==='string')
      .map(p=>[p.key,p]));
    const clipSettings=Object.hasOwn(config.default,'shareClip.previewQuality') ? ShareClipPreferences.fields.map(field=>({
      ...field,category:'外部連携',subcategory:'動画クリップ・X共有',aliases:['Twitter','動画共有']
    })) : [];
    this._publicSettings=new Map(ModernAdvancedSettingsModel.visibleExtraSettings()
      .concat(clipSettings).map((entry,index)=>[entry.id,{...entry,sortIndex:index}]));
    this._historyOrder=new Map((Array.isArray(historySchema)?historySchema:[])
      .map((entry,index)=>[entry.key,index+1]));
    this._screenOrder=new Map((Array.isArray(screenFilterParams)?screenFilterParams:[])
      .map((entry,index)=>['screenFilter.'+entry.key,index]));
    this.categories=ModernAdvancedSettingsModel.CATEGORIES.slice();
    this.descriptors=[];
    this._byId=new Map();
    const add=(descriptor: AdvancedModelDescriptor)=>{
      if (!descriptor || !descriptor.id || !Object.prototype.hasOwnProperty.call(config.default,descriptor.id)) {
        return;
      }
      // screenFilter.enable is obsolete (automatic detection replaced it).
      // screenFilter.saved is an internal toggle snapshot, not a user setting.
      // Preserve both Config values; only omit the unsupported editing controls.
      if (descriptor.id==='screenFilter.enable' || descriptor.id==='screenFilter.saved' || descriptor.id==='screenFilter.userPresets' ||
          descriptor.id==='bestZenTube') {
        return;
      }
      const publicEntry=this._publicSettings.get(descriptor.id);
      if(publicEntry) { descriptor={...descriptor,...publicEntry}; }
      const param=this._screenParams.get(descriptor.id);
      if(param) {
        const type=param.type==='boolean'?'boolean':
          param.type==='select'?'select':'slider';
        descriptor={...descriptor,label:param.label,type,
          description:param.desc||descriptor.description||'',
          min:param.min,max:param.max,step:param.step,unit:param.unit||'',
          sortIndex:this._screenOrder.get(descriptor.id),
          options:type==='select'?(param.options||[]).map(pair=>({
            value:pair[0],label:pair[1]
          })):[],
          input:type==='slider'?null:descriptor.input};
      }
      const history=this._historyParams.get(descriptor.id);
      if(history) {
        descriptor={...descriptor,label:history.label,
          type:history.type==='integer'?'slider':history.type==='boolean'?'boolean':descriptor.type,
          description:history.description||descriptor.description||'',
          min:history.min,max:history.max,step:1,
          sortIndex:this._historyOrder.get(descriptor.id),
          options:[],
          input:history.type==='integer'?null:descriptor.input};
      }
      if (this._byId.has(descriptor.id)) { return; }
      if (!this.categories.includes(descriptor.category)) {
        throw new Error('未定義のカテゴリ: '+descriptor.category);
      }
      const entry={...descriptor,dependsOn:descriptor.dependsOn===undefined?ModernAdvancedSettingsModel.dependencyFor(descriptor.id):descriptor.dependsOn};
      if(entry.id==='commentHistory.enabled'){entry.sortIndex=0;entry.label='自動で増量';entry.description='動画を開いたときにコメントを自動で増量します。今の動画だけ増量分を隠す場合は、再生画面のコメント増量パネルで「非表示」を使います。';}
      if(entry.id==='commentHistory.maxAdditionalComments'){entry.label='読み込むコメント数';entry.description='読み込みの目標件数です。追加コメント数スライダーの上限にもなります。実際に読み込めた数が少ない場合は、その数が上限です。変更だけでは追加取得せず、読込ボタンで不足分を取得します。';}
      this._byId.set(entry.id,entry);
      this.descriptors.push(entry);
    };
    if (legacyRoot && typeof legacyRoot.querySelectorAll==='function') {
      legacyRoot.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-setting-name],[data-history-setting]').forEach(input=>{
        const id=input.dataset.settingName || (input.dataset.historySetting ?
          'commentHistory.'+input.dataset.historySetting : null);
        // The legacy editor has a PARAM field for every one of the ten seek slots.
        // The action descriptor below must own these fields, or all ten become
        // standalone text cards instead of additive composite shortcut cards.
        if (!id || /^KEY_/.test(id) || /^PARAM_CUSTOM_SEEK_\d+$/.test(id)) { return; }
        const category=ModernAdvancedSettingsModel.categoryFor(id);
        const labelNode=input.closest('label');
        const labelText=labelNode ? Array.from(labelNode.childNodes)
          .filter(n=>n.nodeType===3)
          .map(n=>n.textContent!.trim()).filter(Boolean).join(' ').trim() : '';
        let label=labelText;
        if (!label) {
          let node=input.previousElementSibling;
          while(!node && input.parentElement) {
            node=input.parentElement.previousElementSibling;
            break;
          }
          if (node && node.matches && node.matches('.caption,.caption.sub')) {
            label=node.textContent!.trim();
          }
        }
        if (!label) { label=id; }
        const type=input.type==='checkbox'?'boolean':input.tagName==='SELECT'?'select':
          input.tagName==='TEXTAREA'?'textarea':'text';
        const options=type==='select'?
          Array.from((input as HTMLSelectElement).options).map(o=>({
            value:typeof config.default[id]==='number'?Number(o.value):o.value,
            label:o.textContent!.trim()
          })):[];
        const root=input.closest('.control');
        const note=root && root.querySelector('.settingNote');
        add({id,label,category:category[0],subcategory:category[1],type,options,
          description:note ? note.textContent.trim() : '',input});
      });
    }
    actions.forEach(action=>{
      if (!action || !action.id) { return; }
      const id='KEY_'+action.id;
      const [category,subcategory]=ModernAdvancedSettingsModel.categoryFor(id,action);
      add({id,label:action.label||action.id,category,subcategory,type:'shortcut',
        description:action.description || '',actionId:action.id,defaultKey:action.defaultKey});
      if (action.customSeekSlot) {
        const seek='PARAM_'+action.id;
        add({id:seek,label:(action.label||action.id)+' の秒数',
          category:'ショートカット',subcategory:'シーク',
          type:'seconds',description:'マイナスで戻る、プラスで進む',actionId:action.id});
      }
    });
    // Settings built by separate feature packages are not ordinary data-setting-name
    // controls. Register every public preference key without exposing internal data.
    Object.keys(config.default).forEach(id=>{
      if (!/^commentHistory\.|^screenFilter\./.test(id) && id!=='touch.enable') { return; }
      const [category,subcategory]=ModernAdvancedSettingsModel.categoryFor(id);
      const value=config.default[id];
      const type=typeof value==='boolean'?'boolean':typeof value==='number'?'number':'text';
      const name=id.slice(id.indexOf('.')+1);
      add({id,label:name,category,subcategory,type,options:[],description:''});
    });
    this._publicSettings.forEach(entry=>{
      const type=entry.type|| (typeof config.default[entry.id]==='boolean'?'boolean':
        typeof config.default[entry.id]==='number'?'number':'text');
      add({...entry,type,options:[],description:''});
    });
    add({id:'relatedMenu.customLinks',label:'カスタム関連メニューのリンク',
      category:'プレイリスト・検索',subcategory:'関連メニュー › カスタムリンク',
      type:'related-links',description:''});
    const groupRank=(d: AdvancedModelDescriptor)=>[
      this.categories.indexOf(d.category),
      ModernAdvancedSettingsModel.subcategoryPriority(d.category,d.subcategory),
      Number.isFinite(d.sortIndex)?d.sortIndex!:10000
    ];
    this.descriptors.sort((a,b)=>{
      const ar=groupRank(a),br=groupRank(b);
      for(let i=0;i<ar.length;i++){
        if(ar[i]!==br[i]) {return ar[i]-br[i];}
      }
      return 0;
    });
    this.cancel();
  }
  screenFilterPresetList(): AdvancedScreenPreset[] {
    const source=typeof this._screenPresets==='function'?this._screenPresets():this._screenPresets;
    const unique=new Map<string,AdvancedScreenPreset>();
    for(const preset of source) {
      if(preset && typeof preset.id==='string' && !unique.has(preset.id)) {
        unique.set(preset.id,{...preset,user:preset.user===true});
      }
    }
    let order: unknown=[];
    try {order=JSON.parse(String(this.get('screenFilter.presetOrder')||'[]'));} catch (_) {}
    const ids=Array.isArray(order)?Array.from(new Set(order.filter(id=>typeof id==='string'))):[];
    const sorted=[...ids.filter(id=>unique.has(id)).map(id=>unique.get(id)!),
      ...Array.from(unique.values()).filter(p=>!ids.includes(p.id))];
    return [...sorted.filter(p=>!p.user),...sorted.filter(p=>p.user)];
  }
  moveScreenFilterPreset(id: string,offset: number): boolean {
    const list=this.screenFilterPresetList();
    const preset=list.find(p=>p.id===id);
    if(!preset || !Number.isFinite(offset)){return false;}
    const group=list.filter(p=>p.user===preset.user);
    const from=group.findIndex(p=>p.id===id),to=Math.max(0,Math.min(group.length-1,from+offset));
    if(from===to){return false;}
    group.splice(to,0,group.splice(from,1)[0]);
    let index=0;
    const reordered=list.map(p=>p.user===preset.user?group[index++]:p);
    // Keep temporarily unavailable user IDs while editing; they may reappear.
    let previous: unknown=[];
    try {previous=JSON.parse(String(this.get('screenFilter.presetOrder')||'[]'));} catch (_) {}
    const missing=Array.isArray(previous)?Array.from(new Set(previous.filter(
      item=>typeof item==='string' && !list.some(p=>p.id===item)))):[];
    this.set('screenFilter.presetOrder',JSON.stringify([...reordered.map(p=>p.id),...missing]));
    return true;
  }
  descriptor(id: string): AdvancedModelDescriptor | null { return this._byId.get(id) || null; }
  static get SHARED_VISIBILITY() {
    return typeof UiVisibilityRegistry==='undefined'?[]:UiVisibilityRegistry.SHARED_SETTINGS;
  }
  sectionDescriptors(category: string,subcategory: string): AdvancedModelDescriptor[] {
    const entries=this.descriptors.filter(d=>d.category===category && d.subcategory===subcategory);
    if(category==='再生・音声' && subcategory==='公式プレイヤー連携') {
      const shortcut=this.descriptor('KEY_OPEN_OFFICIAL_WATCH');
      if(shortcut) return [...entries,{...shortcut,category,subcategory,sharedWith:shortcut.category+' / '+shortcut.subcategory}];
    }
    if(category!=='画面・映像' || subcategory!=='表示・非表示'){return entries;}
    // These are display placements, not new Config keys or duplicate drafts.
    // Canonical descriptors retain their original category and are saved once.
    const aliases=ModernAdvancedSettingsModel.SHARED_VISIBILITY.map(([id,icon])=>{
      const original=this.descriptor(id);
      return original?{...original,category,subcategory,icon,visibilityScope:id.startsWith('sceneSearch.')?'scene-comments':'shared',
        sharedWith:original.category+' / '+original.subcategory}:null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    const scene=entries.filter(d=>d.visibilityScope==='scene');
    const sceneAliases=aliases.filter(d=>d.visibilityScope==='scene-comments');
    const firstScene=entries.findIndex(d=>d.visibilityScope==='scene');
    const ordered=entries.filter(d=>d.visibilityScope!=='scene');
    ordered.splice(firstScene<0?ordered.length:firstScene,0,...sceneAliases,...scene);
    return [...ordered,...aliases.filter(d=>d.visibilityScope!=='scene-comments')];
  }
  _liveValue(id: string): unknown {
    if(typeof this.config.resolveSceneSearch==='function'){
      const scene=this.config.resolveSceneSearch();
      if(scene){
        if(id==='sceneSearch.enabled')return scene.enabled;
        if(id==='sceneSearch.presentation.normal')return scene.normal;
        if(id==='sceneSearch.presentation.fullscreen')return scene.fullscreen;
        if(id==='sceneSearch.miniCommentVisible')return scene.miniVisible;
      }
    }
    const v=this.config.getStoredValue ? this.config.getStoredValue(id) : typeof this.config.getValue==='function'?
      this.config.getValue(id):this.config.props?.[id];
    if(id==='playlist.maxItems' && typeof v==='number' && Number.isFinite(v) && v>10000) {
      // Previously persisted 30k is now a bounded 10k choice, not an invalid extra option.
      return 10000;
    }
    return ModernAdvancedSettingsModel._clone(v);
  }
  // A player setting or shortcut can be changed while this editor exists.
  // Refresh only the externally changed value; keep unrelated drafts intact.
  syncLiveValue(id: string): boolean {
    if(!this._byId.has(id)){return false;}
    const live=this._liveValue(id);
    if(ModernAdvancedSettingsModel._same(this.saved[id],live)){return false;}
    this.saved[id]=ModernAdvancedSettingsModel._clone(live);
    this.draft[id]=ModernAdvancedSettingsModel._clone(live);
    return true;
  }
  cancel() {
    this.saved={};
    this.draft={};
    this.descriptors.forEach(descriptor=>{
      const id=descriptor.id;
      this.saved[id]=this._liveValue(id);
      this.draft[id]=ModernAdvancedSettingsModel._clone(this.saved[id]);
    });
    return this;
  }
  get(id: string): unknown {
    if (!this._byId.has(id)) { return undefined; }
    return ModernAdvancedSettingsModel._clone(this.draft[id]);
  }
  set(id: string,value: unknown) {
    const d=this.descriptor(id);
    if (!d) { throw new Error('不明な設定: '+id); }
    if(d.availability==='unsupported'){return this;}
    if (typeof this.config.default[id]==='number' && typeof value==='string' &&
      value.trim()!=='' && Number.isFinite(Number(value))) {
      value=Number(value);
    }
    this.draft[id]=ModernAdvancedSettingsModel._clone(value);
    return this;
  }
  resetItem(id: string) { return this.set(id,this.config.default[id]); }
  resetSubcategory(category: string,subcategory: string) {
    this.sectionDescriptors(category,subcategory).forEach(d=>this.resetItem(d.id));
    return this;
  }
  resetCategory(category: string) {
    this.descriptors.filter(d=>d.category===category)
      .forEach(d=>this.resetItem(d.id));
    return this;
  }
  isEnabled(id: string): boolean { return !this.disabledReason(id); }
  disabledReason(id: string,visited: Set<string>=new Set()): string {
    const d=this.descriptor(id);
    if(!d){return '';}
    if(visited.has(id)){return '依存する設定を確認できません。';}
    visited.add(id);
    if(d.availability==='unsupported'){return d.disabledReason||'現在は未対応です。保存値は保持します。';}
    if(['sceneSearch.layout.fullscreen','sceneSearch.presentation.fullscreen'].includes(id) &&
      this.get('sceneSearch.layout.linkFullscreen')===true){return '通常表示と連動中です。個別に変更するには連動をOFFにしてください。';}
    if(!d.dependsOn){return '';}
    const parent=this.descriptor(d.dependsOn);
    // Partial/legacy catalogs may omit optional parents; retain their existing editability.
    if(!parent){return '';}
    const matched=Object.prototype.hasOwnProperty.call(d,'dependsOnValue')?
      ModernAdvancedSettingsModel._same(this.draft[d.dependsOn],d.dependsOnValue):!!this.draft[d.dependsOn];
    const parentReason=this.disabledReason(d.dependsOn,visited);
    if(parentReason){return parentReason;}
    if(!matched){
      const choice=parent.options?.find(option=>ModernAdvancedSettingsModel._same(option.value,d.dependsOnValue));
      return d.disabledReason||('「'+parent.label+'」を'+(Object.prototype.hasOwnProperty.call(d,'dependsOnValue')?
        '「'+(choice?.label??String(d.dependsOnValue))+'」に変更':'ONに')+'すると利用できます。値は保持しています。');
    }
    return '';
  }
  isDifferentFromDefault(id: string): boolean {
    return this._byId.has(id) && !ModernAdvancedSettingsModel._same(
      this.draft[id],this.config.default[id]);
  }
  isDirty(): boolean {
    return this.descriptors.some(d=>!ModernAdvancedSettingsModel._same(
      this.draft[d.id],this.saved[d.id]));
  }
  changes(): Array<{id:string,value:unknown}> {
    return this.descriptors.filter(d=>!ModernAdvancedSettingsModel._same(
      this.draft[d.id],this.saved[d.id]))
      .map(d=>({id:d.id,value:ModernAdvancedSettingsModel._clone(this.draft[d.id])}));
  }
  validate(): Array<{id:string,message:string}> {
    const errs=[];
    for(const change of this.changes()) {
      const {id,value}=change;
      const basic=typeof value===typeof this.config.default[id] &&
        (typeof value!=='number'||Number.isFinite(value));
      const descriptor=this.descriptor(id)!;
      const rangeOk=descriptor.type!=='slider' ||
        (typeof value==='number' &&
          (descriptor.min===undefined || value>=descriptor.min) &&
          (descriptor.max===undefined || value<=descriptor.max));
      const stepOk=descriptor.type!=='slider' || !Number.isFinite(descriptor.step) ||
        descriptor.step!<=0 ||
        Math.abs(((value as number)-(descriptor.min||0))/descriptor.step!-
          Math.round(((value as number)-(descriptor.min||0))/descriptor.step!))<1e-6;
      const colorOk=descriptor.type!=='color' ||
        (typeof value==='string' && (descriptor.hexOnly===true ?
          /^#(?:[a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(value) :
          /^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|[a-zA-Z]+)$/.test(value)));
      // Screenshot filenames must be valid on Windows as well as other OSes.
      const prefixOk=id!=='screenshot.prefix' ||
        (typeof value==='string' && !/[<>:"/\\|?*\u0000-\u001f]/.test(value));
      const cacheEnumOk=id==='storyboardCacheMaxMB'?[0,32,64,128,256,512].includes(value as number):
        id==='storyboardCacheDays'?[1,3,7,14,30].includes(value as number):
        id==='bookmark.titleLines'?[1,2,3].includes(value as number):true;
      const valid=basic && rangeOk && stepOk && colorOk && prefixOk && cacheEnumOk &&
        (!this.config.options?.validateImport || this.config.options.validateImport(id,value));
      if (!valid) { errs.push({id,message:prefixOk?
        '無効な設定値です':'ファイル名に使用できない文字が含まれています'}); }
    }
    if(this.changes().some(change=>
      change.id==='wordRegFilter' || change.id==='wordRegFilterFlags')){
      try {
        new RegExp((this.get('wordRegFilter')||'') as string,(this.get('wordRegFilterFlags')||'') as string);
      } catch (error) {
        errs.push({id:'wordRegFilterFlags',message:'正規表現の条件またはフラグが不正です'});
      }
    }
    return errs;
  }
  save(): number {
    const changes=this.changes();
    const errors=this.validate();
    if(errors.length){throw new Error('不正な設定値: '+errors.map(e=>e.id).join(', '));}
    for(const {id} of changes) {
      if (!ModernAdvancedSettingsModel._same(this._liveValue(id),this.saved[id])) {
        throw new Error('設定が外部で更新されました。競合: '+id);
      }
    }
    if(changes.length && this.config.readonly) {
      throw new Error('このページでは設定を保存できません（読み取り専用）');
    }
    const storage=this.config.storage;
    const snapshots=new Map<string,{storageKey:string;raw:string|undefined}>();
    if(storage && typeof this.config.getStorageKey==='function'){
      for(const {id} of changes){
        const native=this.config.getStoredValue ? id : (this.config.getNativeKey?.(id) ?? id);
        const storageKey=this.config.getStorageKey(native);
        snapshots.set(id,{storageKey,raw:storage[storageKey]});
      }
    }
    const attempted:string[]=[];
    try {
      for(const {id,value} of changes) {
        attempted.push(id);
        if(id.startsWith('sceneSearch.') && typeof this.config.persistSceneSearchSelection==='function'){
          this.config.persistSceneSearchSelection({[id]:ModernAdvancedSettingsModel._clone(value)});
        }else {(this.config.setStoredValue || this.config.setValue).call(this.config, id,ModernAdvancedSettingsModel._clone(value));}
        // DataStorage.setValue catches localStorage exceptions and can update
        // memory even when the disk write fails. Never report success unless
        // the persisted value matches the requested change.
        if(this.config.storage && typeof this.config.getStorageKey==='function') {
          const native=!this.config.getStoredValue && typeof this.config.getNativeKey==='function' ?
            this.config.getNativeKey(id) : id;
          const storageKey=this.config.getStorageKey(native);
          if(this.config.storage[storageKey]!==JSON.stringify(value)) {
            throw new Error('設定保存の確認に失敗しました: '+id);
          }
        }
      }
    } catch(error) {
      const rollbackErrors:unknown[]=[];
      for(const id of attempted.reverse()) {
        try { (this.config.setStoredValue || this.config.setValue).call(this.config, id,ModernAdvancedSettingsModel._clone(this.saved[id])); }
        catch(restoreError) { rollbackErrors.push(restoreError); }
        // Restore the exact raw value, including absence and legacy fallbacks.
        const snapshot=snapshots.get(id);
        if(storage && snapshot){
          try{
            if(snapshot.raw===undefined){delete storage[snapshot.storageKey];}
            else{storage[snapshot.storageKey]=snapshot.raw;}
            if(storage[snapshot.storageKey]!==snapshot.raw){throw new Error('設定の保存状態を復元できません: '+id);}
          }catch(restoreError){rollbackErrors.push(restoreError);}
        }
        if(!ModernAdvancedSettingsModel._same(this._liveValue(id),this.saved[id])){
          rollbackErrors.push(new Error('設定値を復元できません: '+id));
        }
      }
      if(rollbackErrors.length){
        throw new AggregateError([error,...rollbackErrors],'設定保存と復元に失敗しました',{cause:error});
      }
      throw error;
    }
    this.cancel();
    return changes.length;
  }
  search(query: string): AdvancedModelDescriptor[] {
    const q=String(query||'').trim().toLocaleLowerCase();
    if (!q) { return this.descriptors.filter(d=>!d.hidden); }
    return this.descriptors.filter(d=>!d.hidden &&
      [d.id,d.label,d.category,d.subcategory,d.description,...(d.aliases||[])]
        .join(' ').toLocaleLowerCase().includes(q));
  }
  keyConflicts(value: unknown): string[] {
    const key=Number(value)||0;
    if (!key) { return []; }
    const names: string[]=[];
    this.actions.forEach(action=>{
      if (Number(this.draft['KEY_'+action.id])===key) {
        names.push(action.label||action.id);
      }
    });
    const links=this.draft['relatedMenu.customLinks'];
    if(Array.isArray(links)) {
      links.forEach(link=>{
        if(link&&Number(link.shortcutKey)===key&&link.enabled!==false) {
          names.push(link.label||link.id);
        }
      });
    }
    return names;
  }
}
//===END===
export {ModernAdvancedSettingsModel};

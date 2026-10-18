// Task318: source-of-truth descriptors and transactional settings drafts.
// A standalone domain model; no userscript behavior changes until the new UI is approved.
import {UiVisibilityRegistry} from './UiVisibilityRegistry';
//===BEGIN===
//@require UiVisibilityRegistry
class ModernAdvancedSettingsModel {
  static get CATEGORIES() {
    return [
      '再生・音声','画面・映像','コメント表示',
      'NG・表示対象','プレイリスト・検索','ショートカット','マウス・タッチ'
    ];
  }
  static _clone(value) {
    if (value === undefined || value === null || typeof value !== 'object') {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }
  static _same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
  // Explicitly user-facing Config defaults that the old advanced panel did not
  // render. Private runtime state (lastWatchId, message, videoSearch.word, etc.)
  // must remain in Config for compatibility but must not become editable.
  static visibleExtraSettings() {
    const group=(category,subcategory,rows)=>rows.map(([id,label,details={}] )=>
      ({id,label,category,subcategory,...details}));
    const slider=(min,max,step=0.01)=>({type:'slider',min,max,step});
    const select=items=>({type:'select',options:items.map(([value,label])=>({value,label}))});
    const screenModes=select([
      ['normal','通常'],['big','大'],['wide','ワイド'],
      ['small','小'],['sideView','サイドビュー'],['3D','3D']
    ]);
    const sharedNg=select([['NONE','無効'],['LOW','弱'],['MID','中'],
      ['HIGH','強'],['MAX','最大']]);
    return [
      ...group('再生・音声','再生動作',[
        ['autoPlay','動画を自動再生'],
        ['autoPlay:ginza','公式の動画ページで自動再生'],
        ['autoPlay:others','外部サイトで自動再生'],
        ['enableResume','前回の再生位置を利用'],
        ['loop','動画をループ再生'],
        ['autoPauseCommentInput','コメント入力中に動画を一時停止'],
        ['playbackRate','再生速度',{type:'number'}],
        ['enableSingleton','複数のプレイヤーを同時起動しない']
      ]),
      ...group('再生・音声','音量',[
        ['volume','動画の音量',slider(0,1)],
        ['mute','動画をミュート']
      ]),
      ...group('再生・音声','読み上げ',[
        ['speakLark','コメント読み上げ（現在は未対応）',{
          description:'旧設定ですが、現在のZenzaWatchには再生コメントを音声化する処理が接続されていません。ONにしても読み上げません。保存値は互換性のため保持します。'
        }],
        ['speakLarkVolume','読み上げ音量（現在は未対応）',{
          ...slider(0,1),
          description:'コメント読み上げ機能が未実装のため、この音量値も現在の再生には作用しません。'
        }]
      ]),
      ...group('再生・音声','動画の取得',[
        ['forceEconomy','エコノミー画質で取得'],
        ['autoDisableNew','旧配信方式の画質を優先'],
        ['dmcVideoQuality','旧配信方式の優先画質',select([
          ['auto','自動'],['veryhigh','最高'],['high','高'],
          ['mid','中'],['low','低']])],
        ['domandVideoQuality','新配信方式の優先画質',select([
          ['auto','自動'],['1080p','1080p'],['720p','720p'],
          ['480p','480p'],['360p','360p'],['144p','144p']])]
      ]),
      ...group('再生・音声','公式プレイヤー連携',[
        ['overrideGinza','公式の視聴ページでZenzaWatchを優先']
      ]),
      ...group('画面・映像','画面フィルター',[
        ['screenFilter.flipH','左右反転'],
        ['screenFilter.flipV','上下反転'],
        ['screenFilter.applyToScreenshot','スクリーンショットにも映像フィルターを適用'],
        ['screenFilter.applyToCommentPip','コメント付きPiPにも映像フィルターを適用']
      ]),
      ...group('画面・映像','表示モード',[
        ['screenMode','通常の画面モード',screenModes],
        ['screenMode:ginza','公式動画ページの画面モード',screenModes],
        ['screenMode:others','外部サイトの画面モード',screenModes],
        ['autoFullScreen','自動でフルスクリーン'],
        ['smallModeAspectLock','小モードで縦横比を固定']
      ]),
      ...group('画面・映像','プレイヤーの操作表示',[
        ['fullscreenControlBarMode','全画面での操作バー',select([
          ['auto','自動'],['always-show','常に表示'],
          ['always-hide','常に隠す']])],
        ['enableHeatMap','ヒートマップを表示'],
        ['enableStoryboard','シークバーのサムネイルを表示'],
        ['enableStoryboardBar','シーンサーチバーを表示'],
        ['menuScale','操作メニューの拡大率',{type:'number'}]
      ]),
      ...group('画面・映像','シーンサーチ',[
        ['sceneSearch.layout.normal','通常表示のシーンサーチUI',{
          ...select([
            ['00','00 旧式表示（検証中）'],
            ['01','01 クラシック追従'],['02','02 左右ツインパネル'],
            ['03','03 サイドシェルフ'],['04','04 トップエッジ'],
            ['05','05 プレイバック・デッキ'],['06','06 マイクロ・カプセル'],
            ['07','07 3コマ・フィルム'],['08','08 片側引き出し'],
            ['09','09 分離リモコン'],['10','10 スマート自動回避']
          ]),description:'通常時のレイアウトです。動画の再生位置や設定値は変更しません。'}],
        ['sceneSearch.layout.linkFullscreen','フルスクリーンも通常表示と同じUIを使う',{
          description:'ONにしても全画面用に保存したレイアウトは消えません。OFFに戻すとその設定を再利用します。'}],
        ['sceneSearch.layout.fullscreen','フルスクリーン時のシーンサーチUI',{
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
        ['sceneSearch.commentPreviewVisible','シーンサーチのコメント表示',{
          description:'ミニコメントとコメントプレビューの共通スイッチです。OFFの間は両方を隠し、下の個別設定は保持します。右側の動画コメント欄とは別です。'}],
        ['sceneSearch.miniCommentVisible','ミニコメントを表示する',{
          description:'サムネイル画像上のミニコメントを表示します。すべての表示方式で共通です。親のコメント表示をONにすると、この設定を再利用します。'}],
        ['sceneSearch.commentListVisible','コメントプレビューを表示する',{
          description:'コメントボタンで一覧を開けるようにします。ONにしても一覧は自動では開きません。すべての表示方式で共通です。親のコメント表示をONにすると、この設定を再利用します。'}],
        ['sceneSearch.commentListBackgroundOpacity','コメント一覧の背景の濃さ',{
          ...slider(0,100,1),unit:'%',
          description:'一覧の背景だけを調整します。文字の濃さは変わりません。0%は透明、100%は不透明です。すべての表示方式で、通常表示・全画面共通です。'}],
        ['sceneSearch.thumbnailScale','サムネイルの大きさ',{
          ...slider(50,200,1),unit:'%',
          description:'サムネイル画像と画像上のミニコメントを一緒に拡大・縮小します。操作ボタンの大きさは変わりません。画面に収まる範囲で表示します。すべての表示方式で、通常表示・全画面共通です。'}],
        ['sceneSearch.miniCommentMode','画像上のミニコメントの表示方式',{
          ...select([
            ['flow','流れる（旧版と同じ）'],
            ['static','静止表示（最大5行）'],
            ['hidden','ミニコメントを表示しない']
          ]),
          description:'UI00の画像プレビュー中だけ変更します。コメントボタンで開く一覧は対象外です。共通のシーンサーチコメント表示がOFFなら、どの方式でも見えません。保存後すぐ反映します。'}],
        ['enableCommentPreview','シーンサーチのコメントを一覧表示にする',{
          description:'OFF＝画像と流れるミニコメント、ON＝スクロール可能な一覧。元のコメント切替ボタンでも変更できます。共通コメント表示OFFの間は両方非表示です。'}],
        ['sceneSearch.controlsReveal','追加ボタンの開き方',{
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
        ['commentSpeedRate','コメントの移動速度',{type:'number'}],
        ['autoCommentSpeedRate','コメント速度を自動調整'],
        ['commentLayerOpacity','コメントの透明度',slider(0,1)],
        ['commentLayer.easyCommentOpacity','かんたんコメントの透明度',slider(0,1)],
        ['commentLayer.aiCommentOpacity','AIコメントの透明度',slider(0,1)],
        ['enableNicosJumpVideo','@ジャンプを有効化']
      ]),
      ...group('コメント表示','コメント一覧',[
        ['enableCommentPanel','コメント一覧を表示'],
        ['enableCommentPanelAutoScroll','コメント一覧を自動スクロール']
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
        ['playlistLoop','プレイリストをループ'],
        ['continueNextPage','再生中の動画をページ移動後も再開'],
        ['enableAdDecoration','プレイリストで動画の装飾枠を表示']
      ]),
      ...group('プレイリスト・検索','検索',[
        ['videoSearch.wordCountMode','検索候補のヒット件数を取得するタイミング',{
          ...select([
            ['on-demand','必要なときだけ（推奨・低通信量）'],
            ['auto','自動で表示（通信量が増える）'],
            ['off','件数を表示しない（最も低通信量）']
          ]),
          description:'検索行とタグ候補の件数を数える追加通信の設定です。「必要なときだけ」はマウスを乗せるか↑↓キーで選んだ候補のみ取得します。「自動」は検索語と表示中のタグ候補を順番に数えます。「表示しない」は件数の追加通信を行いません。通常の検索やタグ予測の通信には影響しません。'
        }],
        ['videoSearch.videoIdSuggestMode','検索欄に表示する候補の配置',{
          ...select([
            ['merged','すべて縦にまとめる'],
            ['side','タグ候補と動画を左右に表示'],
            ['delayed','タグ候補を先に表示、動画を後から表示']
          ]),
          description:'検索候補と動画IDのカードをどう並べるかの設定です。検索件数の問い合わせ回数を減らす設定ではありません。'
        }],
        ['search.limit','検索結果をプレイリストに読み込む最大動画数',{
          description:'プレイリストへ実際に追加する動画数の上限です。数が多いほど検索データの読み込みに時間と通信がかかります。候補のヒット件数表示とは別の設定です。既定値は1000件です。'
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
        ['overrideWatchLink','動画リンクをZenzaWatchで開く'],
        ['overrideWatchLink:others','外部サイトの動画リンクをZenzaWatchで開く'],
        ['enablePushState','ブラウザの履歴への反映を利用'],
        ['allowOtherDomain','外部サイトの連携を許可'],
        ['loadLinkedChannelVideo','チャンネル動画のリンクを取得']
      ]),
      ...group('マウス・タッチ','マウス',[
        ['enableTogglePlayOnClick','動画クリックで再生・停止']
      ]),
      ...group('マウス・タッチ','タッチ',[
        ['touch.enable','タッチジェスチャーを有効化']
      ])
    ];
  }
  static subcategoryPriority(category,subcategory) {
    // The left-hand navigation must not move when legacy DOM order changes.
    const order={
      '再生・音声':['再生動作','音量','読み上げ','動画の取得','公式プレイヤー連携','提供画面'],
      '画面・映像':['表示モード','動画ヘッダー','プレイヤーの操作表示','シーンサーチ','表示・非表示','画面フィルター','スクリーンショット'],
      'コメント表示':['表示・配置','コメント一覧','文字・装飾','追加取得'],
      'NG・表示対象':['NG条件','コメント種別','動画の除外'],
      'プレイリスト・検索':['プレイリスト','検索','リンク・移動',
        '関連メニュー › カスタムリンク','診断'],
      'ショートカット':['プレイヤー全般','再生','シーク','再生速度','音量','コメント',
        '画面','画面フィルター','フィルタ/NG','プレイリスト','マイリスト','その他'],
      'マウス・タッチ':['マウス','タッチ']
    };
    const index=(order[category]||[]).indexOf(subcategory);
    return index<0?1000:index;
  }
  static categoryFor(key, action) {
    if (key === 'relatedMenu.customLinks') {
      return ['プレイリスト・検索','関連メニュー › カスタムリンク'];
    }
    if (/^KEY_/.test(key) || /^PARAM_CUSTOM_SEEK_/.test(key)) {
      return ['ショートカット',action && action.category || 'シーク'];
    }
    if (/^supporterCredit\./.test(key)) { return ['再生・音声','提供画面']; }
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
  static dependencyFor(key) {
    if(key.startsWith('commentHistory.') && key!=='commentHistory.enabled') {
      return 'commentHistory.enabled';
    }
    if(key.startsWith('filter.') || ['wordFilter','wordRegFilter',
      'wordRegFilterFlags','userIdFilter','commandFilter','sharedNgLevel',
      'removeNgMatchedUser','ngComposite.rules'].includes(key)) { return 'enableFilter'; }
    const direct={
      'sceneSearch.miniCommentVisible':'sceneSearch.commentPreviewVisible',
      'sceneSearch.commentListVisible':'sceneSearch.commentPreviewVisible',
      'supporterCredit.voice':'supporterCredit.enable',
      'supporterCredit.gift':'supporterCredit.enable',
      'supporterCredit.skipInPlaylist':'supporterCredit.enable',
      'touch.tap2command':'touch.enable','touch.tap3command':'touch.enable',
      'touch.tap4command':'touch.enable','touch.tap5command':'touch.enable',
      'enableCommentPanelAutoScroll':'enableCommentPanel',
      'speakLarkVolume':'speakLark'
    };
    return direct[key] || null;
  }
  constructor({config,legacyRoot=null,actions=[],screenFilterParams=[],historySchema=[]}) {
    if (!config || !config.default) { throw new TypeError('Config defaults are required'); }
    this.config=config;
    this.actions=actions.slice();
    this._screenParams=new Map((Array.isArray(screenFilterParams)?screenFilterParams:[])
      .filter(p=>p&&typeof p.key==='string')
      .map(p=>['screenFilter.'+p.key,p]));
    this._historyParams=new Map((Array.isArray(historySchema)?historySchema:[])
      .filter(p=>p&&typeof p.key==='string')
      .map(p=>[p.key,p]));
    this._publicSettings=new Map(ModernAdvancedSettingsModel.visibleExtraSettings()
      .map((entry,index)=>[entry.id,{...entry,sortIndex:index}]));
    this._historyOrder=new Map((Array.isArray(historySchema)?historySchema:[])
      .map((entry,index)=>[entry.key,index+1]));
    this._screenOrder=new Map((Array.isArray(screenFilterParams)?screenFilterParams:[])
      .map((entry,index)=>['screenFilter.'+entry.key,index]));
    this.categories=ModernAdvancedSettingsModel.CATEGORIES.slice();
    this.descriptors=[];
    this._byId=new Map();
    const add=descriptor=>{
      if (!descriptor || !descriptor.id || !Object.prototype.hasOwnProperty.call(config.default,descriptor.id)) {
        return;
      }
      // screenFilter.enable is obsolete (automatic detection replaced it).
      // screenFilter.saved is an internal toggle snapshot, not a user setting.
      // Preserve both Config values; only omit the unsupported editing controls.
      if (descriptor.id==='screenFilter.enable' || descriptor.id==='screenFilter.saved') {
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
      const entry={...descriptor,dependsOn:ModernAdvancedSettingsModel.dependencyFor(descriptor.id)};
      if(entry.id==='commentHistory.enabled'){entry.sortIndex=0;}
      this._byId.set(entry.id,entry);
      this.descriptors.push(entry);
    };
    if (legacyRoot && typeof legacyRoot.querySelectorAll==='function') {
      legacyRoot.querySelectorAll('[data-setting-name],[data-history-setting]').forEach(input=>{
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
          .map(n=>n.textContent.trim()).filter(Boolean).join(' ').trim() : '';
        let label=labelText;
        if (!label) {
          let node=input.previousElementSibling;
          while(!node && input.parentElement) {
            node=input.parentElement.previousElementSibling;
            break;
          }
          if (node && node.matches && node.matches('.caption,.caption.sub')) {
            label=node.textContent.trim();
          }
        }
        if (!label) { label=id; }
        const type=input.type==='checkbox'?'boolean':input.tagName==='SELECT'?'select':
          input.tagName==='TEXTAREA'?'textarea':'text';
        const options=type==='select'?
          Array.from(input.options).map(o=>({
            value:typeof config.default[id]==='number'?Number(o.value):o.value,
            label:o.textContent.trim()
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
        description:'',actionId:action.id,defaultKey:action.defaultKey});
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
    const groupRank=d=>[
      this.categories.indexOf(d.category),
      ModernAdvancedSettingsModel.subcategoryPriority(d.category,d.subcategory),
      Number.isFinite(d.sortIndex)?d.sortIndex:10000
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
  descriptor(id) { return this._byId.get(id) || null; }
  static get SHARED_VISIBILITY() {
    return typeof UiVisibilityRegistry==='undefined'?[]:UiVisibilityRegistry.SHARED_SETTINGS;
  }
  sectionDescriptors(category,subcategory) {
    const entries=this.descriptors.filter(d=>d.category===category && d.subcategory===subcategory);
    if(category!=='画面・映像' || subcategory!=='表示・非表示'){return entries;}
    // These are display placements, not new Config keys or duplicate drafts.
    // Canonical descriptors retain their original category and are saved once.
    const aliases=ModernAdvancedSettingsModel.SHARED_VISIBILITY.map(([id,icon])=>{
      const original=this.descriptor(id);
      return original?{...original,category,subcategory,icon,visibilityScope:'shared',
        sharedWith:original.category+' / '+original.subcategory}:null;
    }).filter(Boolean);
    return [...entries,...aliases];
  }
  _liveValue(id) {
    if(typeof this.config.resolveSceneSearch==='function'){
      const scene=this.config.resolveSceneSearch();
      if(scene){
        if(id==='sceneSearch.presentation.normal')return scene.normal;
        if(id==='sceneSearch.presentation.fullscreen')return scene.fullscreen;
        if(id==='sceneSearch.miniCommentVisible')return scene.miniVisible;
      }
    }
    const v=typeof this.config.getValue==='function'?
      this.config.getValue(id):this.config.props?.[id];
    return ModernAdvancedSettingsModel._clone(v);
  }
  // A player setting or shortcut can be changed while this editor exists.
  // Refresh only the externally changed value; keep unrelated drafts intact.
  syncLiveValue(id) {
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
  get(id) {
    if (!this._byId.has(id)) { return undefined; }
    return ModernAdvancedSettingsModel._clone(this.draft[id]);
  }
  set(id,value) {
    const d=this.descriptor(id);
    if (!d) { throw new Error('不明な設定: '+id); }
    if (typeof this.config.default[id]==='number' && typeof value==='string' &&
      value.trim()!=='' && Number.isFinite(Number(value))) {
      value=Number(value);
    }
    this.draft[id]=ModernAdvancedSettingsModel._clone(value);
    return this;
  }
  resetItem(id) { return this.set(id,this.config.default[id]); }
  resetSubcategory(category,subcategory) {
    this.sectionDescriptors(category,subcategory).forEach(d=>this.resetItem(d.id));
    return this;
  }
  resetCategory(category) {
    this.descriptors.filter(d=>d.category===category)
      .forEach(d=>this.resetItem(d.id));
    return this;
  }
  isEnabled(id) {
    // A linked fullscreen layout is preserved in the draft, but cannot be edited
    // while the normal layout is the active source of truth.
    if(id==='sceneSearch.layout.fullscreen' &&
      this.get('sceneSearch.layout.linkFullscreen')===true){return false;}
    const d=this.descriptor(id);
    return !d || !d.dependsOn || !this._byId.has(d.dependsOn) ||
      !!this.draft[d.dependsOn];
  }
  isDifferentFromDefault(id) {
    return this._byId.has(id) && !ModernAdvancedSettingsModel._same(
      this.draft[id],this.config.default[id]);
  }
  isDirty() {
    return this.descriptors.some(d=>!ModernAdvancedSettingsModel._same(
      this.draft[d.id],this.saved[d.id]));
  }
  changes() {
    return this.descriptors.filter(d=>!ModernAdvancedSettingsModel._same(
      this.draft[d.id],this.saved[d.id]))
      .map(d=>({id:d.id,value:ModernAdvancedSettingsModel._clone(this.draft[d.id])}));
  }
  validate() {
    const errs=[];
    for(const change of this.changes()) {
      const {id,value}=change;
      const basic=typeof value===typeof this.config.default[id] &&
        (typeof value!=='number'||Number.isFinite(value));
      const descriptor=this.descriptor(id);
      const rangeOk=descriptor.type!=='slider' ||
        (typeof value==='number' &&
          (descriptor.min===undefined || value>=descriptor.min) &&
          (descriptor.max===undefined || value<=descriptor.max));
      const stepOk=descriptor.type!=='slider' || !Number.isFinite(descriptor.step) ||
        descriptor.step<=0 ||
        Math.abs((value-(descriptor.min||0))/descriptor.step-
          Math.round((value-(descriptor.min||0))/descriptor.step))<1e-6;
      const colorOk=descriptor.type!=='color' ||
        (typeof value==='string' && /^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|[a-zA-Z]+)$/.test(value));
      // Screenshot filenames must be valid on Windows as well as other OSes.
      const prefixOk=id!=='screenshot.prefix' ||
        (typeof value==='string' && !/[<>:"/\\|?*\u0000-\u001f]/.test(value));
      const valid=basic && rangeOk && stepOk && colorOk && prefixOk &&
        (!this.config.options?.validateImport || this.config.options.validateImport(id,value));
      if (!valid) { errs.push({id,message:prefixOk?
        '無効な設定値です':'ファイル名に使用できない文字が含まれています'}); }
    }
    if(this.changes().some(change=>
      change.id==='wordRegFilter' || change.id==='wordRegFilterFlags')){
      try {
        new RegExp(this.get('wordRegFilter')||'',this.get('wordRegFilterFlags')||'');
      } catch (error) {
        errs.push({id:'wordRegFilterFlags',message:'正規表現の条件またはフラグが不正です'});
      }
    }
    return errs;
  }
  save() {
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
    const attempted=[];
    try {
      for(const {id,value} of changes) {
        attempted.push(id);
        if(id.startsWith('sceneSearch.') && typeof this.config.persistSceneSearchSelection==='function'){
          this.config.persistSceneSearchSelection({[id]:ModernAdvancedSettingsModel._clone(value)});
        }else {this.config.setValue(id,ModernAdvancedSettingsModel._clone(value));}
        // DataStorage.setValue catches localStorage exceptions and can update
        // memory even when the disk write fails. Never report success unless
        // the persisted value matches the requested change.
        if(this.config.storage && typeof this.config.getStorageKey==='function') {
          const native=typeof this.config.getNativeKey==='function' ?
            this.config.getNativeKey(id) : id;
          const storageKey=this.config.getStorageKey(native);
          if(this.config.storage[storageKey]!==JSON.stringify(value)) {
            throw new Error('設定保存の確認に失敗しました: '+id);
          }
        }
      }
    } catch(error) {
      for(const id of attempted.reverse()) {
        try { this.config.setValue(id,ModernAdvancedSettingsModel._clone(this.saved[id])); }
        catch(_) { /* original error remains authoritative */ }
      }
      throw error;
    }
    this.cancel();
    return changes.length;
  }
  search(query) {
    const q=String(query||'').trim().toLocaleLowerCase();
    if (!q) { return this.descriptors.slice(); }
    return this.descriptors.filter(d=>
      [d.id,d.label,d.category,d.subcategory,d.description,...(d.aliases||[])]
        .join(' ').toLocaleLowerCase().includes(q));
  }
  keyConflicts(value) {
    const key=Number(value)||0;
    if (!key) { return []; }
    const names=[];
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
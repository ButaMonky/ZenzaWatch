/**
 * Canonical TypeScript source for packages/components/src/element/SettingPanelElement.js (Task965).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const DialogElement: Loose;
declare const domEvent: Loose;




const {SettingPanelElement} = (() => {

  class SettingPanelElement extends DialogElement {
    declare _isConnected: Loose;
    declare props: Loose;
    declare requestRender: Loose;
    declare isOpen: Loose;
    declare state: Loose;
    declare events: Loose;
    declare _boundEnableFilterConfig: Loose;
    declare _onEnableFilterConfigUpdate: Loose;

    static get defaultState() {
      return {
        isOpen: false,
        revision: 0
      };
    }

    static getPlayerSettingMenu(html?: Loose, conf?: Loose) {
      return html`
        <details class="player-setting">
        <summary>プレイヤーの設定</summary>
        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="autoPlay"
              .checked=${conf.autoPlay}>
              自動で再生する
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="enableResume"
              .checked=${conf.enableResume}>
              続きから再生する
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
            data-setting-name="enableTogglePlayOnClick"
              .checked=${conf.enableTogglePlayOnClick}>
              画面クリックで再生/一時停止
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="autoFullScreen"
              .checked=${conf.autoFullScreen}>
              自動でフルスクリーンにする
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="enableSingleton"
              .checked=${conf.enableSingleton}>
              ZenzaWatchを起動してるタブがあればそちらで開く<br>
              <small>(singletonモード)</small>
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="enableHeatMap"
              .checked=${conf.enableHeatMap}>
              コメントの盛り上がりをシークバーに表示
          </label>
        </div>
        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="overrideWatchLink"
              .checked=${conf.overrideWatchLink}>
              [Zen]ボタンなしでZenzaWatchを開く(リロード後に反映)
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="enableStoryboard"
              .checked=${conf.enableStoryboard}>
              シークバーにサムネイルを表示
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="audio.autoAdjust"
              .checked=${conf.audio.autoAdjust}
              data-command="toggle-audio.autoAdjust">
              音声の自動調整 (動画ごとの音量差を小さくする)
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="uaa.enable"
              .checked=${conf['uaa.enable']}>
              ニコニ広告の情報を取得する(対応ブラウザのみ)
          </label>
        </div>

        <fieldset class="control setting-children" ?disabled=${!conf['uaa.enable']} aria-label="広告情報を利用する設定">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="supporterCredit.enable"
              .checked=${conf['supporterCredit.enable']}>
              動画の最後に「提供」画面（ニコニ広告・ギフトの支援者）を表示する
          </label>
          <fieldset class="setting-children" ?disabled=${!conf['supporterCredit.enable']} aria-label="提供画面の設定">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="supporterCredit.voice"
              .checked=${conf['supporterCredit.voice']}>
              提供画面の音声（提供読み上げ）を鳴らす
          </label>
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="supporterCredit.gift"
              .checked=${conf['supporterCredit.gift']}>
              提供画面でギフトが落ちてくる演出を表示する
          </label>
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="supporterCredit.skipInPlaylist"
              .checked=${conf['supporterCredit.skipInPlaylist']}>
              連続再生中は提供画面を表示しない
          </label>
          </fieldset>
        </fieldset>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="enableAutoMylistComment"
              .checked=${conf.enableAutoMylistComment}>
              マイリストコメントに投稿者名を入れる
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="autoDisableNew"
              .checked=${conf.autoDisableNew}>
              旧システムのほうが画質が良さそうな時は旧システムを使う<br>
              <small>たまに誤爆することがあります (回転情報の含まれる動画など)</small>
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="enableNicosJumpVideo"
              .checked=${conf.enableNicosJumpVideo}
              data-command="toggle-enableNicosJumpVideo">
              ＠ジャンプで指定された動画をプレイリストに入れる
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox" data-setting-name="touch.enable"
            data-command="toggle-touchEnable"
            .checked=${conf.touch.enable}>
              タッチパネルのジェスチャを有効にする
              <small>(2本指左右シーク・上下で速度変更/3本指で動画切替)</small>
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="bestZenTube"
              .checked=${conf.bestZenTube}
              disabled>
              ZenTubeの画質指定は非対応です（YouTube側で選択してください）
          </label>
        </div>

        <div class="control">
          <label>
            <input type="checkbox" class="checkbox"
              data-setting-name="loadLinkedChannelVideo"
              .checked=${conf.loadLinkedChannelVideo}>
              無料期間の切れた動画はdアニメの映像を流す<br>
              <small>(当然ながらdアニメニコニコチャンネル加入が必要)</small>
          </label>
        </div>

        <div class="control">
          <label>
            <select class="menuScale" data-setting-name="menuScale" data-type="number">
              <option value="0.8" .selected=${conf.menuScale == 0.8}>0.8倍</option>
              <option value="1"   .selected=${conf.menuScale == 1}>標準</option>
              <option value="1.2" .selected=${conf.menuScale == 1.2}>1.2倍</option>
              <option value="1.5" .selected=${conf.menuScale == 1.5}>1.5倍</option>
              <option value="2.0" .selected=${conf.menuScale == 2}>2倍</option>
            </select>
            ボタンの大きさ(倍率)
            <small>※ 一部レイアウトが崩れます</small>
          </label>
        </div>
      </details>
      `;
    }
    static getCommentSettingMenu(html?: Loose, conf?: Loose) {
      return html`
        <details class="comment-setting">
        <summary>コメント・フォントの設定</summary>
          <div class="control">
            <label>
              <input type="checkbox" class="checkbox"
                data-setting-name="autoCommentSpeedRate"
                .checked=${conf.autoCommentSpeedRate}>
                倍速再生でもコメントは速くしない
                <small>※ コメントのレイアウトが一部崩れます</small>
            </label>
          </div>
          <div class="control">
            <label>
              <input type="checkbox" class="checkbox"
                data-setting-name="backComment"
                .checked=${conf.backComment}>
                コメントを画面全体に流す
                <small>※ 全画面・ワイド表示時、映像を縮小せず画面の端までコメントを重ねます</small>
            </label>
          </div>
          <div class="control">
            <label>
              <input type="checkbox" class="checkbox"
                data-setting-name="baseFontBolder"
                .checked=${conf.baseFontBolder}>
                フォントを太くする
            </label>
          </div>

        <div class="control">
          <label>
            <select class="commentSpeedRate"
              data-setting-name="commentSpeedRate" data-type="number">
                <option value="0.5" .selected=${conf.commentSpeedRate==0.5}>0.5倍</option>
                <option value="0.8" .selected=${conf.commentSpeedRate==0.8}>0.8倍</option>
                <option value="1"   .selected=${conf.commentSpeedRate==1}>標準</option>
                <option value="1.2" .selected=${conf.commentSpeedRate==1.2}>1.2倍</option>
                <option value="1.5" .selected=${conf.commentSpeedRate==1.5}>1.5倍</option>
                <option value="2.0" .selected=${conf.commentSpeedRate==2.0}>2倍</option>
            </select>
            コメントの速度(倍率)
              <small>※ コメントのレイアウトが一部崩れます</small>
          </label>
        </div>

        <div class="control">
          <h3>フォント名</h3>
          <label>
          <span class="info">入力例: 「'游ゴシック', 'メイリオ', '戦国TURB'」</span>
            <input type="text" class="textInput" .value=${conf.baseFontFamily}
              aria-label="フォント名" data-setting-name="baseFontFamily">
          </label>
        </div>
        <div class="control">
          <h3>投稿者コメントの影の色</h3>
          <label>
          <span class="info">※ リロード後に反映</span>
          <input type="text" class="textInput"
            pattern="(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|^[a-zA-Z]+$)"
            aria-label="投稿者コメントの影の色" data-setting-name="commentLayer.ownerCommentShadowColor"
            .value=${conf.commentLayer.ownerCommentShadowColor}
            >
          </label>
        </div>

        <div class="control">
          <label>
            フォントサイズ(倍率)
            <input type="number" .value=${conf.baseChatScale}
              min="0.5" max="2.0" step="0.1"
              data-setting-name="baseChatScale" data-type="number"
            >
          </label>
        </div>

        <div class="control">
          <label>
            コメントの透明度
            <input type="range" .value=${conf.commentLayerOpacity}
              min="0.1" max="1.0" step="0.1"
              data-setting-name="commentLayerOpacity" data-type="number"
            >
          </label>
          <label>
            かんたんコメント
            <input type="range" .value=${conf.commentLayer.easyCommentOpacity}
              min="0.1" max="1.0" step="0.1"
              data-setting-name="commentLayer.easyCommentOpacity" data-type="number"
            >
          </label>
          <label>
            AIキャラクターコメント
            <input type="range" .value=${conf.commentLayer.aiCommentOpacity}
              min="0.1" max="1.0" step="0.1"
              data-setting-name="commentLayer.aiCommentOpacity" data-type="number"
            >
          </label>
        </div>

        <div class="control">
          <h3>コメントの影</h3>
          <label>
            <input type="radio"
              name="textShadowType"
              data-setting-name="commentLayer.textShadowType"
              .checked=${conf.commentLayer.textShadowType==''}
              value="">
              標準 (軽い)
          </label>

          <label>
            <input type="radio"
              name="textShadowType"
              data-setting-name="commentLayer.textShadowType"
              .checked=${conf.commentLayer.textShadowType=='shadow-type2'}
              value="shadow-type2">
              縁取り
          </label>

          <label>
            <input type="radio"
              name="textShadowType"
              data-setting-name="commentLayer.textShadowType"
              .checked=${conf.commentLayer.textShadowType=='shadow-type3'}
              value="shadow-type3">
            ぼかし (重い)
          </label>

          <label>
            <input type="radio"
              name="textShadowType"
              data-setting-name="commentLayer.textShadowType"
              .checked=${conf.commentLayer.textShadowType=='shadow-stroke'}
              value="shadow-stroke">
              縁取り2 (対応ブラウザのみ。やや重い)
          </label>

          <label style="font-family: 'dokaben_ver2_1' !important;">
            <input type="radio"
              name="textShadowType"
              data-setting-name="commentLayer.textShadowType"
              .checked=${conf.commentLayer.textShadowType=='shadow-dokaben'}
              value="shadow-dokaben">
              ドカベン <s>(飽きたら消します)</s>
          </label>
        </div>
      </details>
      `;
    }
    static getFilterSettingMenu(html?: Loose, conf?: Loose) {
      const word    = Array.isArray(conf.wordFilter)    ? conf.wordFilter   .join('\n') : conf.wordFilter;
      const command = Array.isArray(conf.commandFilter) ? conf.commandFilter.join('\n') : conf.commandFilter;
      const userId  = Array.isArray(conf.userIdFilter)  ? conf.userIdFilter .join('\n') : conf.userIdFilter;
      return html`
        <style>
          .filterEdit {
            display: block;
            width: 100%;
            min-height: 100px;
            margin: 0 auto 0;
            color: currentcolor;
          }
        </style>
        <details class="filter-setting">
          <summary>NG・フィルタ設定</summary>
          <div class="control">
            <label>
              <input type="checkbox" class="checkbox"
                data-setting-name="enableFilter"
                .checked=${conf.enableFilter}>
                NGを有効にする
            </label>
          </div>

          <div class="control">
            <label>
              <input type="checkbox" class="checkbox"
                data-setting-name="removeNgMatchedUser"
                .checked=${conf.removeNgMatchedUser}>
                コメントがNGにマッチしたら、その発言者のコメントを全て消す
            </label>
          </div>

          <div class="control" style="text-align: center;">
            <h3>NG共有</h3>
            <label class="short">
              <input type="radio"
                name="sharedNgLevel"
                data-setting-name="sharedNgLevel"
                .checked=${conf.sharedNgLevel=='NONE'}
                value="NONE">
                OFF
            </label>
            <label class="short">
              <input type="radio"
                name="sharedNgLevel"
                data-setting-name="sharedNgLevel"
                .checked=${conf.sharedNgLevel=='LOW'}
                value="LOW">
                弱
            </label>
            <label class="short">
              <input type="radio"
                name="sharedNgLevel"
                data-setting-name="sharedNgLevel"
                .checked=${conf.sharedNgLevel=='MID'}
                value="MID">
                中
            </label>
            <label class="short">
              <input type="radio"
                name="sharedNgLevel"
                data-setting-name="sharedNgLevel"
                .checked=${conf.sharedNgLevel=='HIGH'}
                value="HIGH">
                強
            </label>
            <label class="short">
              <input type="radio"
                name="sharedNgLevel"
                data-setting-name="sharedNgLevel"
                .checked=${conf.sharedNgLevel=='MAX'}
                value="MAX">
                MAX
            </label>
          </div>



          <div class="control" style="text-align: center;">
            <h3>表示するコメント（投稿区分）</h3>
            <p class="setting-note">投稿区分と下の配信スレッドの両方がONのコメントを表示します。</p>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.fork0"
                .checked=${conf.filter.fork0}
                value="">
                通常コメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.fork1"
                .checked=${conf.filter.fork1}
                value="">
                投稿者コメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.fork2"
                .checked=${conf.filter.fork2}
                value="">
                かんたんコメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.fork3"
                .checked=${conf.filter.fork3}
                value="">
                AIキャラクターコメント
            </label>
            <h4>配信スレッドの種類</h4>
            <p class="setting-note">同じ名前でも投稿区分とは別の条件です。通常は両方をONにしてください。</p>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.defaultThread"
                .checked=${conf.filter.defaultThread}
                value="">
                通常コメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.ownerThread"
                .checked=${conf.filter.ownerThread}
                value="">
                投稿者コメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.communityThread"
                .checked=${conf.filter.communityThread}
                value="">
                チャンネルコメント / コミュニティコメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.nicosThread"
                .checked=${conf.filter.nicosThread}
                value="">
                ニコスクリプトコメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.easyThread"
                .checked=${conf.filter.easyThread}
                value="">
                かんたんコメント
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.aiThread"
                .checked=${conf.filter.aiThread}
                value="">
                AIキャラクターコメント
            </label>
            <!--
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.extraDefaultThread"
                .checked=${conf.filter.extraDefaultThread}
                value="">
                ***extra-default
            </label>
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.extraOwnerThread"
                .checked=${conf.filter.extraOwnerThread}
                value="">
                ***extra-owner
            </label>
            -->
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.extraCommunityThread"
                .checked=${conf.filter.extraCommunityThread}
                value="">
                引用コメント
            </label>
            <!--
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.extraNicosThread"
                .checked=${conf.filter.extraNicosThread}
                value="">
                ***extra-nicos
            </label>
            -->
            <label class="short">
              <input type="checkbox"
                data-setting-name="filter.extraEasyThread"
                .checked=${conf.filter.extraEasyThread}
                value="">
                引用かんたんコメント
            </label>
          </div>
          <div class="control">
            <h3>NGワード</h3>
            <label>
              <textarea
                class="filterEdit"
                aria-label="NGワード" data-setting-name="wordFilter" data-type="array"
                .value=${word}></textarea>
            </label>
            <h3>NGコマンド</h3>
            <label>
              <textarea
                class="filterEdit"
                aria-label="NGコマンド" data-setting-name="commandFilter" data-type="array"
                .value=${command}></textarea>
            </label>
            <h3>NGユーザー</h3>
            <label>
              <textarea
                class="filterEdit"
                aria-label="NGユーザー" data-setting-name="userIdFilter" data-type="array"
                .value=${userId}></textarea>
            </label>
          </div>

        </details>
      `;
    }

    static getContentsTemplate(html?: Loose, state = {}, props = {}, events = {}) {
      const conf = (props as Loose).config.props;
      return html`
        <style>
          .dialog.is-open .dialog-background {animation:none;}
          .dialog-background {border:1px solid #455066;color:#e9edf5;box-shadow:0 8px 30px #0008;}
          .dialog-inner {background:#171e2af7;color:#e9edf5;border:1px solid #455066;padding:14px;}
          summary {background:#253346;color:#edf4ff;text-shadow:none;font-size:15px;padding:10px 12px;margin:0 0 6px;border-radius:6px;}
          details {margin:0 0 8px;}
          h3,h4 {background:#253346;color:#edf4ff;text-shadow:none;font-size:13px;padding:7px 9px;}
          button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible {outline:2px solid #84dccd;outline-offset:3px;}
          .settings-navigation {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
          .settings-navigation .setting-note {flex-basis:100%;margin:0;}
          .settings-navigation button {background:#303c51;color:#edf4ff;border:1px solid #53627b;border-radius:6px;padding:7px 10px;font:inherit;}
          label {
            display: block;
            margin: 5px;
            padding: 5px;
            cursor: pointer;
          }
          label.short {
            display: inline-block;
            min-width: 15%;
          }
          label:hover {
            border-radius: 4px;
            background: rgba(80, 80, 80, 0.3);
          }
          input[type=checkbox], input[type=radio] {
            accent-color:#84dccd;
            margin-right: 8px;
          }
          input[type=text], input[type=number], select {
            border-radius: 4px;
            border: 1px solid currentcolor;
            font-size: 13px;
            padding: 6px;
            background: #202c3d;
            color: currentcolor;
          }
          input[type=range] {
            width: 70%;
            margin: auto;
            cursor: pointer;
            border-radius: 4px;
            border: 1px solid currentcolor;
          }

          .setting-children {min-width:0;border:0;border-left:2px solid #53627b;margin:4px 0 10px 12px;padding:0 0 0 12px;}
          .setting-children:disabled {color:#939baa;}
          .setting-children input:disabled {opacity:.45;cursor:not-allowed;}
          .setting-note {
            margin: 4px 8px;
            font-size: 12px;
            color:#bdcadb;line-height:1.6;
          }
          .import-export {
            padding: 8px;
            text-align: center;
            outline: none;
          }

          .export-config-button {
            display: inline-block;
          }

          .import-config-file-select {display:block;max-width:100%;margin-top:6px;font:inherit;color:inherit;}
          .import-config-file-select::file-selector-button {background:#303c51;color:#edf4ff;border:1px solid #53627b;border-radius:4px;padding:7px;cursor:pointer;}
          .import-config-file-select-label {display:block;text-align:left;}
          .export-config-button {
            display: inline-block;
            width: 160px;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: #edf4ff;
            background: #303c51;
            border: 0;
          }

        </style>
        <div class="settings-navigation">
          <strong>設定</strong>
          <button type="button" class="command" data-command="openAdvancedSettings">上級者設定を開く</button>
          <button type="button" class="command" data-command="toggleHLSDebug">HLS設定を開く</button>
          <p class="setting-note">コメント増量・ここまで見た・しおり・ABリピート・通知履歴などの詳細設定も上級者設定にあります。</p>
        </div>
        <div data-revision="${(state as Loose).revision}">
          ${this.getPlayerSettingMenu(html, conf)}
          ${this.getCommentSettingMenu(html, conf)}
          ${this.getFilterSettingMenu(html, conf)}

        <details>
          <summary>設定のインポート・エクスポート</summary>
          <div class="import-export">
            <button type="button" class="export-config-button" data-command="export-config">ファイルに保存</button>
            <label class="import-config-file-select-label">ファイルから読み込む
            <input type="file"
              @change=${(events as Loose).onImportFileSelect}
              class="import-config-file-select"
              accept=".json" aria-label="設定ファイルを読み込む"
              data-command="nop">
            </label>
          </div>
        </details>
        </div>
      `;
    }

    constructor() {
      super();
      Object.assign(this.events, {
        onChange: this.onChange.bind(this),
        onImportFileSelect: this.onImportFileSelect.bind(this)
      });
      this._boundEnableFilterConfig = null;
      this._onEnableFilterConfigUpdate = (key: string) => {
        if (!this.isOpen) { return; }
        const root = (this as Loose)._root;
        if (!root || !Array.from(root.querySelectorAll('[data-setting-name]')).some((node: Loose) => node.dataset.settingName === key)) { return; }
        this.state.revision++;
        this.requestRender();
      };
    }

    _bindEnableFilterConfig(config?: Loose) {
      if (this._boundEnableFilterConfig === config) { return; }
      this._boundEnableFilterConfig?.off?.('update', this._onEnableFilterConfigUpdate);
      this._boundEnableFilterConfig = config || null;
      this._boundEnableFilterConfig?.on?.('update', this._onEnableFilterConfigUpdate);
    }

    async connectedCallback() {
      await super.connectedCallback();
      const dialog = (this as Loose)._dialog;
      dialog?.setAttribute('role', 'dialog');
      dialog?.setAttribute('aria-label', '設定');
      this._bindEnableFilterConfig(this.config);
    }

    async disconnectedCallback() {
      this._bindEnableFilterConfig(null);
      await super.disconnectedCallback();
    }

    get config() {
      return this.props.config;
    }
    set config(v: Loose) {
      this.props.config = v;
      this.state.revision++;
      if (this._isConnected) {
        this._bindEnableFilterConfig(v);
        this.requestRender();
      }
    }

    onCommand(e?: Loose) {
      if (['toggle-screenFilterPanel', 'openAdvancedSettings', 'toggleHLSDebug'].includes(e.detail?.command)) {
        (this as Loose).close();
        return; // The original command continues to its existing player/root owner.
      }
      super.onCommand(e);
    }

    onUIEvent(e?: Loose) {
      // console.nicoru('target', e.target.closest('label, input, select, textarea'), e.target);
      if (e.target.closest('label, input, select, textarea') || e.target.tagName === 'SUMMARY') {
        e.stopPropagation();
        return;
      }
      super.onUIEvent(e);
    }

    onChange(e?: Loose) {
      const elm = ((e.path && e.path[0]) ? e.path[0] : e.target) || {};
      const {settingName, type} = elm.dataset || {};
      if (!settingName) {
        return super.onChange(e);
      }
      let value = elm.value;
      // console.nicoru('onChange',
      //   {settingName, checked: elm.checked, value, type, tagName: elm.tagName}, elm, e);

      if (elm.tagName === 'INPUT' && elm.type === 'checkbox') {
        value = elm.checked;
      } else {
        if (type === 'number') {
          elm.setCustomValidity?.('');
          const parsed = Number(value);
          if (value.trim() === '' || !Number.isFinite(parsed) ||
              (elm.min !== '' && elm.min !== undefined && parsed < Number(elm.min)) ||
              (elm.max !== '' && elm.max !== undefined && parsed > Number(elm.max)) ||
              (elm.validity && !elm.validity.valid)) {
            elm.setCustomValidity?.('指定された範囲の数値を入力してください。');
            elm.reportValidity?.();e.stopPropagation();return;
          }
          value = parsed;
        } else if (['boolean', 'json'].includes(type)) {
          try { value = JSON.parse(value); } catch {
            elm.setCustomValidity?.('入力内容を確認してください。');elm.reportValidity?.();e.stopPropagation();return;
          }
        } else if (type === 'array') {
          value = value.split('\n');
        }
      }
      // console.nicoru({settingName, value, type});
      this.config.props[settingName] = value;
      e.stopPropagation();
    }

    onOpen() {
      super.onOpen();
      this.state.revision++;
    }

    async onImportFileSelect(e?: Loose) {
      e.preventDefault();
      e.stopPropagation();

      const file = e.target.files[0];
      if (!file) { return; }
      if (!/\.json$/i.test(file.name)) { alert('JSON形式の設定ファイルを選択してください。');e.target.value='';return; }
      if (!confirm(`ファイル "${file.name}" で書き換えますか？`)) {
        return;
      }

      domEvent.dispatchCommand(e.target, 'close');

      const fileReader = new FileReader();
      fileReader.onload = ev => {
        try {
          this.config.importJson(ev.target!.result);
          location.reload();
        } catch (error) {
          alert(`設定を読み込めませんでした: ${(error as Error).message}`);
        }
      };

      fileReader.onerror = () => alert('設定ファイルを読み取れませんでした。');
      fileReader.readAsText(file);
    }

  }

  if (window.customElements) {
    customElements.get('zenza-setting-panel') || customElements.define('zenza-setting-panel', (SettingPanelElement as Loose));
  }
  return {SettingPanelElement};
})();

export { SettingPanelElement };

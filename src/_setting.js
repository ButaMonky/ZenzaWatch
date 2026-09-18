// ==UserScript==
// @name        ZenzaWatch 上級者用設定
// @namespace   https://github.com/segabito/
// @description1 ZenzaWatchの上級者向け設定。変更する時だけ有効にすればOK
// @include     *//www.nicovideo.jp/my*
// @version     0.3.18-task078
// @author      segabito macmoto
// @license     public domain
// @grant       none
// @noframes
// @require     https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.11/lodash.min.js
// ==/UserScript==

import {ZenzaDetector} from '../packages/components/src/util/ZenzaDetector';
import {uq} from '../packages/lib/src/uQuery';
import {cssUtil} from '../packages/lib/src/css/css';
import {DataStorage} from '../packages/lib/src/infra/DataStorage';
import {Config} from './Config';
import {Emitter, Handler} from '../packages/lib/src/Emitter';
import {SHORTCUT_ACTIONS, encodeKeyCombo, formatKeyCombo, groupShortcutActionsByCategory} from '../packages/zenza/src/ShortcutActions';
import {ScreenFilter} from '../packages/zenza/src/videoPlayer/ScreenFilter';
((window) => { const self = window;
  const PRODUCT = 'ZenzaWatch';
  const monkey = async (PRODUCT) => {
    const _ = window._ ;
    const Array = window.PureArray || window.Array;
//@require Emitter
//@require Config
await Config.promise('restore');
//@require uq
const $ = uq;
//@require cssUtil
//@require SHORTCUT_ACTIONS
//@require ScreenFilter
    window.ZenzaAdvancedSettings = {
      config: Config
    };
    const global = {
      PRODUCT
    };

    let panel;

    const __tpl__ = (`
      <button class="openZenzaAdvancedSettingPanel">ZenzaWatch上級者設定</button>
    `).trim();

    const __css__ = (`
      .openZenzaAdvancedSettingPanel {
        font-size: 12px;
        border-radius: 4px;
        -webkit-box-pack: justify;
        -ms-flex-pack: justify;
        justify-content: space-between;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        padding: 0 6px;
        color: #555;
        font-weight: 600;
        text-align: right;
        letter-spacing: .5px;
        cursor: pointer;
      }
      .openZenzaAdvancedSettingPanel:hover {
        background: #eee;
      }

      .openZenzaAdvancedSettingPanel:active {
        background: #ccc;
      }


      .summer2017Area {
        display: none !important;
      }
    `).trim();



    // Task 059: ショートカットキー設定UI。
    const escapeShortcutHtml = s => String(s).replace(/[&<>"']/g, c => (
      {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'}[c]
    ));

    // Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10)のうち、
    // キーも秒数も既定値(未設定)のままの行は初期状態では隠す
    // (.slotHidden)。ユーザーが以前に使っていた分(キーか秒数のどちらかを
    // 設定済み)は、パネルを開くたびに毎回隠れてしまうと不便なので
    // 常に表示する。
    const isCustomSeekSlotUnset = action => {
      if (!action.customSeekSlot) { return false; }
      const key = parseInt(Config.props['KEY_' + action.id], 10) || 0;
      const seconds = parseFloat(Config.props['PARAM_' + action.id]) || 0;
      return !key && !seconds;
    };

    const renderShortcutKeySettingsHtml = () => {
      const groups = groupShortcutActionsByCategory();
      return groups.map(group => `
        <div class="shortcutCategory">
          <p class="caption sub">${escapeShortcutHtml(group.category)}</p>
          ${group.actions.map(action => {
            const isCustomSeek = !!action.customSeekSlot;
            const rowClass = isCustomSeek ?
              `shortcutRow customSeekSlotRow${isCustomSeekSlotUnset(action) ? ' slotHidden' : ''}` :
              'shortcutRow';
            const secondsInputHtml = isCustomSeek ? `
              <input type="text" class="shortcutSecondsInput" inputmode="numeric"
                data-setting-name="PARAM_${action.id}"
                title="秒数を入力(マイナスで戻る・プラスで進む)"
                placeholder="秒数 例:-10">` : '';
            return `
            <div class="${rowClass}" data-action-id="${action.id}">
              <span class="shortcutLabel">${escapeShortcutHtml(action.label)}</span>
              <span class="shortcutKeyDisplay">${escapeShortcutHtml(formatKeyCombo(Config.props['KEY_' + action.id]))}</span>
              <button type="button" class="shortcutRecordBtn" data-action-id="${action.id}">変更</button>
              <button type="button" class="shortcutClearBtn" data-action-id="${action.id}">未設定にする</button>
              <button type="button" class="shortcutResetBtn" data-action-id="${action.id}">既定に戻す(${escapeShortcutHtml(formatKeyCombo(action.defaultKey))})</button>
              ${secondsInputHtml}
              <span class="shortcutConflictWarning"></span>
            </div>
          `;
          }).join('')}
          ${group.category === 'シーク' ? `
          <div class="customSeekAddRow">
            <button type="button" class="customSeekAddBtn">＋ カスタムシークのスロットを追加(最大10個)</button>
          </div>
          ` : ''}
        </div>
      `).join('');
    };

    // Task 077: 画面フィルターの設定欄。項目と説明文は ScreenFilter.PARAMS から作る
    // （プレイヤー内の専用パネルと同じ文言。項目を足す時は ScreenFilter.js だけ直せばよい）。
    const renderScreenFilterSettingsHtml = () => {
      const esc = escapeShortcutHtml;
      const rows = ScreenFilter.PARAMS.map(p => {
        const name = ScreenFilter.PREFIX + p.key;
        if (p.type === 'boolean') {
          return `
          <div class="screenFilterRow control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="${name}">
              ${esc(p.label)}
            </label>
            <div class="settingNote">${esc(p.desc)}</div>
          </div>`;
        }
        if (p.type === 'select') {
          return `
          <div class="screenFilterRow control toggle">
            <label>
              ${esc(p.label)}
              <select data-setting-name="${name}">
                ${p.options.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join('')}
              </select>
            </label>
            <div class="settingNote">${esc(p.desc)}</div>
          </div>`;
        }
        const range = `${p.min}〜${p.max}${p.unit || ''}、標準は ${ScreenFilter.formatValue(p.key, p.def)}`;
        return `
          <div class="screenFilterRow control toggle">
            <label>
              ${esc(p.label)}${p.heavy ? '（やや重い）' : ''}
              <input type="text" class="screenFilterNumberInput" inputmode="decimal" data-setting-name="${name}">
              <span class="screenFilterRange">${esc(range)}</span>
            </label>
            <div class="settingNote">${esc(p.desc)}</div>
          </div>`;
      }).join('');
      const presets = ScreenFilter.PRESETS.map(p =>
        `<button type="button" class="screenFilterPresetBtn" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`
      ).join('');
      return `
        <p class="caption">画面フィルター（映像の明るさ・色・反転）</p>
        <div class="settingNote">
          動画の映像だけに明るさ・コントラスト・ガンマなどの補正を掛けます（コメントやボタンには掛かりません）。
          設定は全部の動画で共通で、次に開いた時も残ります。
          動画を見ながら調整したい時は、再生画面の下のバーにある「きらめき（✦）」のボタンから専用パネルを開けます。
        </div>
        <div class="screenFilterEnableControl control toggle">
          <label>
            <input type="checkbox" class="checkbox" data-setting-name="screenFilter.enable">
            画面フィルターを使う（OFFにすると元の映像に戻ります。調整した値は残ります）
          </label>
        </div>
        <div class="control">
          <div>かんたん設定（プリセット）: 押すと下の値がまとめて切り替わります</div>
          <div class="screenFilterPresets">${presets}</div>
        </div>
        ${rows}
        <div class="control toggle">
          <label>
            <input type="checkbox" class="checkbox" data-setting-name="screenFilter.applyToScreenshot">
            スクリーンショットにも画面フィルターを反映する
          </label>
          <label>
            <input type="checkbox" class="checkbox" data-setting-name="screenFilter.applyToCommentPip">
            P in P(コメント付き) にも画面フィルターを反映する
          </label>
          <div class="settingNote">
            通常の P in P は、ブラウザが動画をそのまま小窓に出す仕組みのため、フィルターは反映されません。
            左右反転・上下反転は、再生画面の右クリックメニューか専用パネルで切り替えます（ページを開き直すと元に戻ります）。
          </div>
        </div>
      `;
    };

    class SettingPanel {
      constructor(...args) {
        this.initialize(...args);
      }
      initialize(params) {
        this._playerConfig     = params.playerConfig;
        this._$container       = params.$container;

        this._update$rawData = _.debounce(this._update$rawData.bind(this), 500);
        this._playerConfig.on('update', this._onPlayerConfigUpdate.bind(this));
      }
      _initializeDom() {
        if (this._$panel) { return; }
        const $container = this._$container;
        const config = this._playerConfig;

        cssUtil.addStyle(SettingPanel.__css__);
        $container.append(uq.html(SettingPanel.__tpl__));

        const $panel = this._$panel = $container.find('.zenzaAdvancedSettingPanel');
        this._$view =
          $container.find('.zenzaAdvancedSettingPanel');
        this._$view.on('click', e => e.stopPropagation());

        this._$rawData = $panel.find('.zenzaAdvancedSetting-rawData');
        this._$rawData.val(config.exportJson());
        this._$rawData.on('change', () => {
          let val = this._$rawData.val();
          let data;
          if (val === '') { val = '{}'; }

          try {
            data = JSON.parse(val);
          } catch (e) {
            alert(e);
            return;
          }

          if (confirm('設定データを直接書き換えしますか？')) {
            config.clear();
            config.import(data);
            location.reload();
          }

        });

        this._$playlistData = $panel.find('.zenzaAdvancedSetting-playlistData');
        this._$playlistData.val(JSON.stringify(window.ZenzaWatch.external.playlist.export(), null, 2));
        this._$playlistData.on('change', () => {
          let val = this._$playlistData.val();
          let data;
          if (val === '') { val = '{}'; }

          try {
            data = JSON.parse(val);
          } catch (e) {
            alert(e);
            return;
          }

          if (confirm('プレイリストデータを直接書き換えしますか？')) {
            window.ZenzaWatch.external.playlist.import(data);
            location.reload();
          }

        });

        const onInputItemChange = this._onInputItemChange.bind(this);
        const $check = $panel.find('input[type=checkbox]');
        $check.forEach(check => {
          const {settingName} = check.dataset;
          const val = !!config.props[settingName];
          check.checked = val;
          check.closest('.control').classList.toggle('checked', val);
        });
        $check.on('change', this._onToggleItemChange.bind(this));

        const $input = $panel.find('input[type=text], select, .textAreaInput');
        $input.forEach(input => {
          const {settingName} = input.dataset;
          const val = config.props[settingName];
          input.value = val;
        });
        $input.on('change', onInputItemChange);

        // Task 059: ショートカットキー設定の初期化。
        this._$shortcutContainer = $panel.find('.shortcutKeySettingsContainer');
        $panel.find('.shortcutRecordBtn').on('click', e => {
          e.stopPropagation();
          this._onShortcutRecordClick(e);
        });
        $panel.find('.shortcutClearBtn').on('click', e => {
          e.stopPropagation();
          this._onShortcutClearClick(e);
        });
        $panel.find('.shortcutResetBtn').on('click', e => {
          e.stopPropagation();
          this._onShortcutResetClick(e);
        });
        this._refreshAllShortcutRows();

        // Task 065: カスタムシークの「追加」ボタン。押すたびに、隠れている
        // (未設定の)スロットのうち一番若い番号のものを1つだけ表示する。
        // 10個すべて表示し終えたらボタン自体を無効化する。
        this._$customSeekAddBtn = $panel.find('.customSeekAddBtn');
        this._$customSeekAddBtn.on('click', e => {
          e.stopPropagation();
          this._onCustomSeekAddClick();
        });
        this._refreshCustomSeekAddButton();

        // Task 077: 画面フィルターのプリセットボタン。値をまとめて書き換えて、入力欄にも反映する
        $panel.find('.screenFilterPresetBtn').on('click', e => {
          e.stopPropagation();
          const preset = ScreenFilter.PRESETS.find(p => p.id === e.target.dataset.preset);
          if (!preset) { return; }
          ScreenFilter.PARAMS.forEach(p => {
            const name = ScreenFilter.PREFIX + p.key;
            const v = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
            config.props[name] = v;
            const input = $panel.find(`[data-setting-name="${name}"]`)[0];
            if (!input) { return; }
            if (input.type === 'checkbox') {
              input.checked = !!v;
              input.closest('.control').classList.toggle('checked', !!v);
            } else {
              input.value = v;
            }
          });
          if (!config.props['screenFilter.enable']) {
            config.props['screenFilter.enable'] = true;
            const enable = $panel.find('[data-setting-name="screenFilter.enable"]')[0];
            enable && (enable.checked = true);
          }
        });

        $panel.find('.zenzaAdvancedSetting-close').on('mousedown', e => {
          e.stopPropagation();
          this.hide();
        });

        $panel.toggleClass('debug', config.props.debug);
      }
      _onPlayerConfigUpdate(key, value) {
        switch (key) {
          case 'debug':
            this._$panel.toggleClass('debug', value);
            break;
          case 'wordRegFilter':
          case 'wordRegFilterFlags':
            this._$panel.find('.' + key + 'Input').val(value);
            break;
          case 'enableFullScreenOnDoubleClick':
          case 'autoCloseFullScreen':
          case 'continueNextPage':
          case 'smallModeAspectLock':
            this._$panel
              .find('.' + key + 'Control').toggleClass('checked', value)
              .find('input[type=checkbox]').prop('checked', value);
            break;
        }
        this._update$rawData();
      }
      _update$rawData() {
        this._$rawData.val(this._playerConfig.exportJson());
      }
      _onToggleItemChange(e) {
        const {settingName} = e.target.dataset;
        const val = !!e.target.checked;

        this._playerConfig.props[settingName] = val;
        e.target.closest('.control').classList.toggle('checked', val);
      }
      _onInputItemChange(e) {
        const $target = $(e.target);
        const {settingName} = e.target.dataset;
        const val = e.target.value;

        window.setTimeout(() => $target.removeClass('update error'), 300);

        window.console.log('onInputItemChange', settingName, val);
        switch (settingName) {
          case 'wordRegFilter':
            try {
              const reg = new RegExp(val);
              $target.addClass('update');
            } catch(err) {
              $target.addClass('error');
              //alert('正規表現にエラーがあります');
              return;
            }
            break;
          case 'wordRegFilterFlags': {
            try {
              const reg = new RegExp(/./, val);
              $target.addClass('update');
            } catch(err) {
              $target.addClass('error');
              //alert('正規表現にエラーがあります');
              return;
            }
          }
            break;
          default:
            $target.addClass('update');
            break;
        }

        // Task 077: 画面フィルターの数値は範囲内に丸めて数値として保存する
        if (typeof settingName === 'string' && settingName.startsWith(ScreenFilter.PREFIX)) {
          const key = settingName.slice(ScreenFilter.PREFIX.length);
          if (ScreenFilter.PARAM_MAP[key]) {
            const v = ScreenFilter.normalize(key, val);
            this._playerConfig.props[settingName] = v;
            e.target.value = v;
            return;
          }
        }

        this._playerConfig.props[settingName] = val;

        // Task 065: カスタムシーク秒数の入力欄。キーも秒数も未設定に
        // 戻ったら、行を「追加」前の状態(非表示)に戻しておく
        // (常に表示したままだと、使っていないスロットが増えて
        // 一覧が長くなり続けてしまうため)。
        if (typeof settingName === 'string' && settingName.startsWith('PARAM_CUSTOM_SEEK_')) {
          this._hideCustomSeekSlotIfUnset(settingName.replace(/^PARAM_/, ''));
        }
      }
      // Task 065: 指定したカスタムシークのアクションIDが、キー・秒数とも
      // 未設定に戻っていたら行を隠し、「追加」ボタンの状態も更新する。
      _hideCustomSeekSlotIfUnset(actionId) {
        if (!this._$shortcutContainer) { return; }
        const key = parseInt(this._playerConfig.props['KEY_' + actionId], 10) || 0;
        const seconds = parseFloat(this._playerConfig.props['PARAM_' + actionId]) || 0;
        if (key || seconds) { return; }
        this._$shortcutContainer
          .find(`.customSeekSlotRow[data-action-id="${actionId}"]`)
          .addClass('slotHidden');
        this._refreshCustomSeekAddButton();
      }
      // ---- Task 059: ショートカットキー設定 ----
      _refreshShortcutRow(actionId) {
        if (!this._$shortcutContainer) { return; }
        const val = this._playerConfig.props['KEY_' + actionId];
        this._$shortcutContainer
          .find(`.shortcutRow[data-action-id="${actionId}"] .shortcutKeyDisplay`)
          .text(formatKeyCombo(val));
      }
      _refreshAllShortcutRows() {
        if (!this._$shortcutContainer) { return; }
        SHORTCUT_ACTIONS.forEach(action => this._refreshShortcutRow(action.id));
        this._refreshShortcutConflictWarnings();
      }
      _refreshShortcutConflictWarnings() {
        if (!this._$shortcutContainer) { return; }
        const config = this._playerConfig;
        const byKeyValue = {};
        SHORTCUT_ACTIONS.forEach(action => {
          const val = parseInt(config.props['KEY_' + action.id], 10) || 0;
          if (!val || val >= 90000000) { return; }
          (byKeyValue[val] = byKeyValue[val] || []).push(action);
        });
        SHORTCUT_ACTIONS.forEach(action => {
          const val = parseInt(config.props['KEY_' + action.id], 10) || 0;
          const dupes = (byKeyValue[val] || []).filter(a => a.id !== action.id);
          const $warn = this._$shortcutContainer
            .find(`.shortcutRow[data-action-id="${action.id}"] .shortcutConflictWarning`);
          if (val && dupes.length) {
            $warn.text('⚠ 「' + dupes.map(a => a.label).join('」「') + '」と重複しています')
              .addClass('show');
          } else {
            $warn.text('').removeClass('show');
          }
        });
      }
      _cancelShortcutRecording() {
        if (this._shortcutRecordingCleanup) {
          this._shortcutRecordingCleanup();
        }
      }
      _onShortcutRecordClick(e) {
        const actionId = e.target.dataset.actionId;
        this._cancelShortcutRecording();
        const $btn = $(e.target);
        const $row = $btn.closest('.shortcutRow');
        const originalLabel = $btn.text();
        $btn.text('キーを押してください (Escでキャンセル)');
        $row.addClass('recording');

        // 修飾キー単体(Shift/Ctrl/Alt/Meta)の押下だけでは確定しない。
        // 実際のキーが押されるまで待つ。単体のEscはキャンセル扱い。
        const MODIFIER_ONLY_KEYCODES = [16, 17, 18, 91, 92, 93, 224];
        const onKeyDown = evt => {
          evt.preventDefault();
          evt.stopPropagation();
          if (MODIFIER_ONLY_KEYCODES.includes(evt.keyCode)) { return; }
          if (evt.keyCode === 27 &&
              !evt.shiftKey && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
            cleanup();
            return;
          }
          const combo = encodeKeyCombo(evt);
          this._playerConfig.props['KEY_' + actionId] = combo;
          cleanup();
          this._refreshAllShortcutRows();
        };
        const cleanup = () => {
          document.removeEventListener('keydown', onKeyDown, true);
          $btn.text(originalLabel);
          $row.removeClass('recording');
          this._shortcutRecordingCleanup = null;
        };
        this._shortcutRecordingCleanup = cleanup;
        document.addEventListener('keydown', onKeyDown, true);
      }
      _onShortcutClearClick(e) {
        const actionId = e.target.dataset.actionId;
        this._cancelShortcutRecording();
        this._playerConfig.props['KEY_' + actionId] = 0;
        this._refreshAllShortcutRows();
        this._hideCustomSeekSlotIfUnset(actionId);
      }
      _onShortcutResetClick(e) {
        const actionId = e.target.dataset.actionId;
        this._cancelShortcutRecording();
        this._playerConfig.deleteValue('KEY_' + actionId);
        this._refreshAllShortcutRows();
        this._hideCustomSeekSlotIfUnset(actionId);
      }
      // Task 065: カスタムシークスロットの「追加」ボタン。
      // 隠れているスロット行(.customSeekSlotRow.slotHidden)のうち、
      // 配列(= CUSTOM_SEEK_1〜10、DOM上も番号順)で一番先頭のものだけを
      // 表示状態に切り替える。全部表示し終えたらボタンを無効化する。
      _onCustomSeekAddClick() {
        if (!this._$shortcutContainer) { return; }
        const hiddenRows = this._$shortcutContainer.find('.customSeekSlotRow.slotHidden');
        if (hiddenRows.length) {
          $(hiddenRows[0]).removeClass('slotHidden');
        }
        this._refreshCustomSeekAddButton();
      }
      _refreshCustomSeekAddButton() {
        if (!this._$shortcutContainer || !this._$customSeekAddBtn) { return; }
        const hiddenRows = this._$shortcutContainer.find('.customSeekSlotRow.slotHidden');
        const isFull = hiddenRows.length === 0;
        this._$customSeekAddBtn.prop('disabled', isFull);
        this._$customSeekAddBtn.text(
          isFull ? 'これ以上は追加できません(最大10個)' : '＋ カスタムシークのスロットを追加(最大10個)'
        );
      }
      _beforeShow() {
        if (this._$playlistData) {
          this._$playlistData.val(
            JSON.stringify(window.ZenzaWatch.external.playlist.export(), null, 2)
          );
        }
      }
      toggle(v) {
        this._initializeDom();
        // window.ZenzaWatch.external.execCommand('close');
        if (!v) {
          // Task 059: パネルを閉じる時、ショートカットキー記録中の
          // document捕捉フェーズのkeydownリスナーが残ってしまうと、
          // パネルを閉じた後もキー入力が全部食われてしまうため、
          // 必ずキャンセルしてから閉じる。
          this._cancelShortcutRecording();
        }
        this._$view.toggleClass('show', v);
        if (this._$view.hasClass('show')) { this._beforeShow(); }
      }
      show() {
        this.toggle(true);
      }
      hide() {
        this.toggle(false);
      }
    }


    SettingPanel.__css__ = (`
      .zenzaAdvancedSettingPanel {
        position: fixed;
        left: 50%;
        top: -100vh;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 200000;
        width: 90vw;
        height: 90vh;
        color: #000;
        background: rgba(192, 192, 192, 1);
        transition: top 0.4s ease;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        overflow: hidden;
      }
      .zenzaAdvancedSettingPanel.show {
        opacity: 1;
        top: 50%;
      }

      .zenzaAdvancedSettingPanel.show {
        border: 2px outset #fff;
        box-shadow: 6px 6px 6px rgba(0, 0, 0, 0.5);
        pointer-events: auto;
      }

      .zenzaAdvancedSettingPanel .settingPanelInner {
        box-sizing: border-box;
        margin: 8px;
        padding: 8px;
        overflow: auto;
        height: calc(100% - 86px);
        overscroll-behavior: contain;
        border: 1px inset;
      }
      .zenzaAdvancedSettingPanel .caption {
        background: #333;
        font-size: 20px;
        padding: 4px 8px;
        color: #fff;
      }

      .zenzaAdvancedSettingPanel .caption.sub {
        margin: 8px;
        font-size: 16px;
      }

      .zenzaAdvancedSettingPanel .example {
        display: inline-block;
        margin: 0 16px;
        font-family: sans-serif;
      }

      .zenzaAdvancedSettingPanel label {
        display: inline-block;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        padding: 4px 8px;
        cursor: pointer;
      }

      .zenzaAdvancedSettingPanel .control {
        border-radius: 4px;
        background: rgba(88, 88, 88, 0.3);
        padding: 8px;
        margin: 16px 4px;
      }

      /* Task 077: 画面フィルター */
      .zenzaAdvancedSettingPanel .screenFilterNumberInput {
        width: 80px;
        margin: 0 8px;
      }
      .zenzaAdvancedSettingPanel .screenFilterRange {
        font-size: 12px;
        color: #999;
      }
      .zenzaAdvancedSettingPanel .screenFilterPresets {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      /* Task 073: 設定項目の補足説明 */
      .zenzaAdvancedSettingPanel .settingNote {
        padding: 4px 8px 0;
        font-size: 12px;
        line-height: 1.6;
        color: #bbb;
      }

      .zenzaAdvancedSettingPanel .control:hover {
        background: rgba(88, 88, 128, 0.3);
      }

      .zenzaAdvancedSettingPanel button {
        font-size: 10pt;
        padding: 4px 8px;
        background: #888;
        border-radius: 4px;
        border: solid 1px;
        cursor: pointer;
      }

      .zenzaAdvancedSettingPanel input[type=checkbox] {
        transform: scale(2);
        margin-left: 8px;
        margin-right: 16px;
        cursor: pointer;
      }

      .zenzaAdvancedSettingPanel .control.checked {
      }

      .zenzaAdvancedSettingPanel input[type=text] {
        font-size: 24px;
        background: #ccc;
        color: #000;
        width: 90%;
        margin: 0 5%;
        padding: 8px;
        border-radius: 8px;
      }
      .zenzaAdvancedSettingPanel input[type=text].update {
        color: #003;
        background: #fff;
        box-shadow: 0 0 8px #ff9;
      }
      .zenzaAdvancedSettingPanel input[type=text].update:before {
        content: 'ok';
        position: absolute;
        left: 0;
        z-index: 100;
        color: blue;
      }

      .zenzaAdvancedSettingPanel input[type=text].error {
        color: #300;
        background: #f00;
      }

      .zenzaAdvancedSettingPanel select {
        font-size:24px;
        margin: 0 5%;
        border-radius: 8px;
       }

      .zenzaAdvancedSetting-close {
        position: absolute;
        width: 50%;
        left: 50%;
        bottom: 8px;
        transform: translate(-50%);
        z-index: 160000;
        padding: 8px 16px;
        cursor: pointer;
        box-sizing: border-box;
        text-align: center;
        line-height: 30px;
        font-size: 24px;
        border: outset 2px;
        box-shadow: 0 0 4px #000;
        transition:
          opacity 0.4s ease,
          transform 0.2s ease,
          background 0.2s ease,
          box-shadow 0.2s ease
            ;
        pointer-events: auto;
        transform-origin: center center;
      }

      .textAreaInput {
        width: 90%;
        height: 200px;
        margin: 0 5%;
        word-break: break-all;
        overflow: scroll;
      }

      .zenzaAdvancedSetting-rawData,
      .zenzaAdvancedSetting-playlistData {
        width: 90%;
        height: 300px;
        margin: 0 5%;
        word-break: break-all;
        overflow: scroll;
      }

      .zenzaAdvancedSetting-close:active {
        box-shadow: none;
        border: inset 2px;
        transform: scale(0.8);
      }

      .zenzaAdvancedSettingPanel:not(.debug) .debugOnly {
        display: none !important;
      }


      .example code {
        font-family: monospace;
        display: inline-block;
        margin: 4px;
        padding: 4px 8px;
        background: #333;
        color: #fe8;
        border-radius: 4px;
      }

      .shortcutKeySettingsContainer {
        margin: 8px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
      }
      .shortcutCategory {
        margin-bottom: 12px;
      }
      .shortcutCategory .caption.sub {
        margin: 8px 0 4px;
      }
      .shortcutRow {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.35);
        margin-bottom: 4px;
      }
      .shortcutRow.recording {
        background: #ffe680;
        box-shadow: 0 0 6px #f90;
      }
      .shortcutLabel {
        flex: 1 1 260px;
        font-size: 13px;
      }
      .shortcutKeyDisplay {
        flex: 0 0 auto;
        min-width: 110px;
        text-align: center;
        font-family: monospace;
        font-size: 13px;
        background: #222;
        color: #9f9;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .shortcutRow button {
        font-size: 11px;
        padding: 3px 6px;
      }
      .shortcutConflictWarning {
        flex-basis: 100%;
        font-size: 11px;
        color: #a00;
        display: none;
      }
      .shortcutConflictWarning.show {
        display: block;
      }

      /* Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10)専用。
         秒数を自由入力できるテキスト欄。汎用の
         .zenzaAdvancedSettingPanel input[type=text] (幅90%)は
         このshortcutRow内では大きすぎるため、幅を個別に上書きする。 */
      .shortcutRow .shortcutSecondsInput {
        width: 90px;
        min-width: 90px;
        margin: 0;
        font-size: 13px;
        padding: 3px 6px;
      }
      .shortcutSecondsInput::placeholder {
        color: #666;
      }
      /* 「未設定(=キーも秒数も既定値のまま)」のスロットは、「追加」ボタンで
         明示的に表示するまで隠す。 */
      .customSeekSlotRow.slotHidden {
        display: none;
      }
      .customSeekAddRow {
        padding: 4px 8px 12px;
      }
      .customSeekAddBtn {
        font-size: 12px;
      }
      .customSeekAddBtn:disabled {
        opacity: 0.5;
        cursor: default;
      }

    `).trim();

    const commands = (`
      <option value="">なし</option>
      <option value="togglePlay">再生/停止</option>
      <option value="fullScreen">フルスクリーン ON/OFF</option>
      <option value="toggle-mute">ミュート ON/OFF</option>
      <option value="toggle-showComment">コメント表示 ON/OFF</option>
      <option value="toggle-backComment">コメントの背面表示 ON/OFF</option>
      <option value="toggle-loop">ループ ON/OFF</option>
      <option value="toggle-enableFilter">NG設定 ON/OFF</option>
      <option value="screenShot">スクリーンショット</option>
      <option value="deflistAdd">とりあえずマイリスト</option>
      <option value="picture-in-picture">picture-in-picture</option>
      <option value="picture-in-picture-comment">picture-in-picture(コメント付き)</option>
      <option value="toggle-screenFilter.enable">画面フィルター ON/OFF</option>
      <option value="toggle-screenFilterPanel">画面フィルターのパネルを開く/閉じる</option>
    `).trim();

    SettingPanel.__tpl__ = (`
      <div class="zenzaAdvancedSettingPanel zen-family">
        <div class="settingPanelInner">
          <div class="enableFullScreenOnDoubleClickControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableFullScreenOnDoubleClick">
              画面ダブルクリックでフルスクリーン切り換え
            </label>
          </div>

          <div class="autoCloseFullScreenControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="autoCloseFullScreen">
              再生終了時に自動でフルスクリーン解除

            </label>
          </div>

          <div class="continueNextPageControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="continueNextPage">
              再生中にページを切り換えても続きから再開する
            </label>
          </div>

          <div class="enableDblclickClose control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableDblclickClose">
              背景のダブルクリックでプレイヤーを閉じる
            </label>
          </div>

          <div class="smallModeAspectLockControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="smallModeAspectLock">
              画面モード「小」のリサイズ時にアスペクト比を固定する
            </label>
          </div>

          <div class="autoDisableNew control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="autoDisableNew">
              旧システムのほうが画質が良さそうな時は旧システムにする。(旧システム側が1280x720を超える時)
            </label>
          </div>

          <div class="autoZenTube control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="autoZenTube">
              自動ZenTube (ZenTubeから戻す時は動画を右クリックからリロード または 右下の「画」)
            </label>
          </div>

          <div class="enableAdDecorationControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableAdDecoration">
              プレイリストに広告の金冠・銀冠枠を表示する
            </label>
          </div>

          <div class="enableCommentPanelControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="enableCommentPanel">
              動画情報パネルに「コメント」タブ(コメント一覧)を表示する
            </label>
          </div>
          <!-- Task 065: この項目はTask 063でショートカット
            (コメントパネル表示ON/OFF)としてのみ追加されたが、既定では
            キー未割り当て・チェックボックスも無く、押す手段が事実上無い
            状態になっていた(ユーザー報告により発覚)。他の同種の項目
            (プレイリストの広告表示など)と同じ、チェックボックスでの
            直接切り替えをここに追加した。ショートカット自体も
            引き続きショートカットキー設定パネルから利用できる。 -->

          <div class="videoHeaderPositionControl control toggle">
            <label>
              動画ヘッダー（タイトル・タグ欄）の表示位置（通常・大モード）
              <select data-setting-name="videoHeader.position">
                <option value="auto">自動（収まらない時は動画に重ねて自動で隠す・従来通り）</option>
                <option value="outside">常に動画の外に表示（はみ出す時は画面上端に合わせる・隠さない）</option>
                <option value="overlay">常に動画に重ねる（マウスを動かした時だけ表示）</option>
                <option value="overlay-visible">常に動画に重ねる（隠さない）</option>
              </select>
            </label>
          </div>

          <div class="videoIdSuggestModeControl control toggle">
            <label>
              検索欄に動画ID(sm〜)を入力した時のタグ予測の表示
              <select data-setting-name="videoSearch.videoIdSuggestMode">
                <option value="merged">A: 1つの一覧にまとめる（検索→タグ予測→動画）</option>
                <option value="side">B: タグ予測と動画を左右に並べる</option>
                <option value="delayed">C: タグ予測を先に出し、入力が止まってから動画を表示</option>
              </select>
            </label>
          </div>

          <div class="audioAutoAdjustControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="audio.autoAdjust"
                data-command="toggle-audio.autoAdjust">
              音声の自動調整（動画ごとの音量差を小さくする・本家と同じ）
            </label>
            <div class="settingNote">
              ニコニコが動画ごとに測った音の大きさをもとに、音が大きい動画だけ音量を下げます（音量を上げる方向には働きません）。
              OFFにすると動画の音をそのまま再生します。
            </div>
          </div>

          <div class="screenFilterSettingsContainer">${renderScreenFilterSettingsHtml()}</div>

          <div class="searchLimitControl control toggle">
            <label>
              検索でプレイリストに読み込む最大件数（推奨: 1000件まで）
              <select data-setting-name="search.limit">
                <option value="100">100件（軽い）</option>
                <option value="300">300件（標準・初期値）</option>
                <option value="500">500件</option>
                <option value="1000">1000件（推奨の上限）</option>
                <option value="2000">2000件（重い・読み込みに時間がかかる）</option>
                <option value="3000">3000件（重い）</option>
                <option value="5000">5000件（最大・とても重い）</option>
              </select>
            </label>
            <div class="settingNote">
              100件ごとにニコニコへ1回問い合わせるため、多いほど読み込みが遅くなり、プレイリストの表示も重くなります。
              上限はニコニコの検索の仕様で5000件です（予備の検索方式に切り替わった時は1600件まで）。
              リロード後に復元されるのは、再生中の動画の前後1000件までです。
            </div>
          </div>

          <div class="enableSlotLayoutEmulation control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="commentLayer.enableSlotLayoutEmulation">
              Flash版のコメントスロット処理をエミュレーションする
            </label>
          </div>

          <div class="touch-tap2command control toggle">
            <label>
              2本指タッチ
              <select data-setting-name="touch.tap2command">
                ${commands}
              </select>
            </label>
          </div>

          <div class="touch-tap3command control toggle">
            <label>
              3本指タッチ
              <select data-setting-name="touch.tap3command">
                ${commands}
              </select>
            </label>
          </div>

          <div class="touch-tap3command control toggle">
            <label>
              4本指タッチ
              <select data-setting-name="touch.tap4command">
                ${commands}
              </select>
            </label>
          </div>

          <div class="touch-tap5command control toggle">
            <label>
              5本指タッチ
              <select data-setting-name="touch.tap5command">
                ${commands}
              </select>
            </label>
          </div>


          <p class="caption">ショートカットキー設定</p>
          <span class="example">「変更」を押してからキーを押すと割り当てられます。Escキー単体でキャンセルできます。同じキーが複数の項目に割り当てられている場合は警告が表示されます(動作は先勝ちですが、混乱を避けるため重複しないようにすることを推奨します)。</span>
          <div class="shortcutKeySettingsContainer">${renderShortcutKeySettingsHtml()}</div>

          <p class="caption sub">NGワード正規表現</p>
          <span class="example">入力例: <code>([wWｗＷ]+$|^ん[？\?]$|洗った？$)</code> 文法エラーがある時は更新されません</span>
          <input type="text" class="textInput wordRegFilterInput"
            data-setting-name="wordRegFilter">

          <p class="caption sub">NGワード正規表現フラグ</p>
          <span class="example">入力例: <code>i</code></span>
          <input type="text" class="textInput wordRegFilterFlagsInput"
            data-setting-name="wordRegFilterFlags">

          <p class="caption sub">NG tag</p>
          <span class="example">連続再生中にこのタグのある動画があったらスキップ</span>
          <textarea class="videoTagFilter textAreaInput"
            data-setting-name="videoTagFilter"></textarea>

          <p class="caption sub">NG owner</p>
          <span class="example">連続再生中にこの投稿者IDがあったらスキップ。 チャンネルの場合はchをつける 数字の後に 入力例<code>2525 #コメント</code></span>
          <textarea class="videoOwnerFilter textAreaInput"
            data-setting-name="videoOwnerFilter"></textarea>

          <div class="debugControl control toggle">
            <label>
              <input type="checkbox" class="checkbox" data-setting-name="debug">
              デバッグモード
            </label>
          </div>

          <div class="debugOnly">
            <div class="debugCheckAdDecorationControl control toggle">
              <label>
                <input type="checkbox" class="checkbox" data-setting-name="debugCheckAdDecoration">
                【重い処理】広告装飾(金冠・銀冠)のズレを全件チェックしてコンソールに出力する
              </label>
            </div>
            <span class="example">プレイリスト・関連動画の一覧が変わるたび、表示中の全動画についてキャッシュを使わずサーバーへ再確認し、Zenzaの表示とズレていないかコンソールへ出力する。動画数が多いと通信が増えるため、確認が終わったらOFFに戻すことを推奨。</span>

            <p class="caption sub">生データ(ZenzaWatch設定)</p>
            <span class="example">丸ごとコピペで保存/復元可能。 ここを消すと設定がリセットされます。</span>
            <textarea class="zenzaAdvancedSetting-rawData"></textarea>

            <p class="caption sub">生データ(プレイリスト)</p>
            <span class="example">丸ごとコピペで保存/復元可能。 編集は自己責任で</span>
            <textarea class="zenzaAdvancedSetting-playlistData"></textarea>

          </div>

        </div>
        <div class="zenzaAdvancedSetting-close">閉じる</div>
      </div>
    `).trim();



    const initializePanel = () => {
      // Config.watch();
      if (panel == null) {
        panel = new SettingPanel({
          playerConfig: Config,
          $container: $('body')
        });
      }
    };

    const initialize = () => {
      const $button = $(__tpl__);
      cssUtil.addStyle(__css__);

      document.querySelector('#js-initial-userpage-data') ?
        $('.Dropdown-button').before($button) :
        $('.accountEdit').after($button);

      $button.on('click', e => {
        initializePanel();
        panel.toggle();
      });

    };

    initialize();
  };

  const loadGM = () => {
    const script = document.createElement('script');
    script.id = 'ZenzaWatchAdvancedSettingsLoader';
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('charset', 'UTF-8');
    script.append(`(${monkey})('${PRODUCT}');`);
    document.body.append(script);
  };


//@require ZenzaDetector
ZenzaDetector.detect().then(() => loadGM());


})(globalThis ? globalThis.window : window);

import * as _ from 'lodash';
import {CONSTANT} from './constant';
import {Emitter} from './baselib';
import {css} from '../packages/lib/src/css/css';
import {uq} from '../packages/lib/src/uQuery';
import {nicoUtil} from '../packages/lib/src/nico/nicoUtil';
//===BEGIN===
/*
 * Task 073: コメントコマンドピッカー（案C＋案Aパネル）
 * - 入力欄にフォーカスすると、下の帯（旧「入力時に一時停止」の帯）が広がり、サイズ・位置・基本色を選べる
 * - 帯の端の🎨ボタンで、本家と同じ「サイズ・位置・カラー」の詳しいパネルを入力欄の上に開く
 *   （フォント・184・プレミアム色(プレミアム会員のみ表示)もここで選べる）
 * - ボタンで選ぶとコマンド欄の文字が変わり、コマンド欄に手で書くとボタンの選択も追従する
 *   （184・mincho・@秒数など、ピッカーが扱わない語は消さずに残す）
 * - ボタンを押しても入力欄からフォーカスが外れない（外れると一時停止の解除・パネルの縮小が起きるため）
 */
const CommandPicker = (() => {
  const SIZES = ['big', 'medium', 'small'];
  const POSITIONS = ['ue', 'naka', 'shita'];
  const FONTS = ['defont', 'mincho', 'gothic'];
  // 一般会員が使える色（本家の10色と同じ順番）
  const BASIC_COLORS = [
    ['white', '#FFFFFF', '白'], ['red', '#FF0000', '赤'], ['pink', '#FF8080', 'ピンク'],
    ['orange', '#FFC000', 'オレンジ'], ['yellow', '#FFFF00', '黄'], ['green', '#00FF00', '緑'],
    ['cyan', '#00FFFF', '水色'], ['blue', '#0000FF', '青'], ['purple', '#C000FF', '紫'],
    ['black', '#000000', '黒']
  ];
  // プレミアム会員専用色（NicoChat.COLORS と同じ値）
  const PREMIUM_COLORS = [
    ['white2', '#CCCC99', 'niconicowhite'], ['red2', '#CC0033', 'truered'], ['pink2', '#FF33CC', 'pink2'],
    ['orange2', '#FF6600', 'passionorange'], ['yellow2', '#999900', 'madyellow'], ['green2', '#00CC66', 'elementalgreen'],
    ['cyan2', '#00CCCC', 'cyan2'], ['blue2', '#3399FF', 'marineblue'], ['purple2', '#6633CC', 'nobleviolet'],
    ['black2', '#666666', 'black2']
  ];
  const COLOR_ALIASES = {
    niconicowhite: 'white2', truered: 'red2', passionorange: 'orange2', madyellow: 'yellow2',
    elementalgreen: 'green2', marineblue: 'blue2', nobleviolet: 'purple2'
  };
  const ALL_COLOR_NAMES = new Set([
    ...BASIC_COLORS.map(c => c[0]), ...PREMIUM_COLORS.map(c => c[0]), ...Object.keys(COLOR_ALIASES)
  ]);
  const COLOR_HEX = new Map([...BASIC_COLORS, ...PREMIUM_COLORS].map(c => [c[0], c[1]]));
  const DEFAULTS = {size: 'medium', pos: 'naka', color: 'white', font: 'defont'};
  // Task 074: 他の選択肢と排他ではなく、単独でON/OFFする表示調整コマンド
  //   ender     … 改行が多くても文字を縮めない
  //   full      … 上・下コメントを画面の端まで使う（はみ出し時の縮小を抑える）
  //   patissier … 行数が多くても文字を縮めない（コメントアート向け）
  const FLAGS = ['ender', 'full', 'patissier'];
  const SPLIT = /[\x20\xA0　\t ]+/;

  const groupOf = token => {
    const t = token.toLowerCase();
    if (SIZES.includes(t)) { return 'size'; }
    if (POSITIONS.includes(t)) { return 'pos'; }
    if (FONTS.includes(t)) { return 'font'; }
    if (t === '184') { return 'anonymous'; }
    if (FLAGS.includes(t)) { return `flag:${t}`; }
    if (ALL_COLOR_NAMES.has(t) || /^#[0-9a-f]{6}$/i.test(t)) { return 'color'; }
    return null;
  };

  const parse = text => {
    const tokens = String(text || '').split(SPLIT).filter(Boolean);
    const state = Object.assign({anonymous: false, flags: {}}, DEFAULTS);
    tokens.forEach(token => {
      const group = groupOf(token);
      if (!group) { return; }
      const t = token.toLowerCase();
      if (group === 'anonymous') {
        state.anonymous = true;
      } else if (group.startsWith('flag:')) {
        state.flags[t] = true;
      } else if (group === 'color') {
        state.color = COLOR_ALIASES[t] || t;
      } else {
        state[group] = t;
      }
    });
    return state;
  };

  // groupの語を value に置き換える（既定値なら取り除く）。他の語はそのままの位置に残す
  const apply = (text, group, value) => {
    const tokens = String(text || '').split(SPLIT).filter(Boolean);
    const isToggle = group === 'anonymous' || group.startsWith('flag:');
    const isDefault = isToggle ? !value : DEFAULTS[group] === value;
    const newToken = group === 'anonymous' ? '184' : (isToggle ? group.slice(5) : value);
    const result = [];
    let placed = false;
    tokens.forEach(token => {
      if (groupOf(token) !== group) {
        result.push(token);
      } else if (!placed && !isDefault) {
        result.push(newToken);
        placed = true;
      }
    });
    if (!placed && !isDefault) {
      group === 'anonymous' ? result.unshift(newToken) : result.push(newToken);
    }
    return result.join(' ');
  };

  const colorHex = name => {
    if (/^#[0-9a-f]{6}$/i.test(name)) { return name; }
    return COLOR_HEX.get(COLOR_ALIASES[name] || name) || '#FFFFFF';
  };

  return {SIZES, POSITIONS, FONTS, FLAGS, BASIC_COLORS, PREMIUM_COLORS, DEFAULTS, parse, apply, colorHex, groupOf};
})();

class CommentInputPanel extends Emitter {
  constructor(params) {
    super();

    this._$playerContainer = params.$playerContainer;
    this.config = params.playerConfig;

    this._initializeDom();

    this.config.onkey('autoPauseCommentInput', this._onAutoPauseCommentInputChange.bind(this));
  }
  _initializeDom() {
    let $container = this._$playerContainer;
    let config = this.config;

    css.addStyle(CommentInputPanel.__css__);
    $container.append(uq.html(CommentInputPanel.__tpl__));

    let $view = this._$view = $container.find('.commentInputPanel');
    let $input = this._$input = $view.find('.commandInput, .commentInput');
    this._$form = $container.find('form');
    let $autoPause = this._$autoPause = $container.find('.autoPause');
    this._$commandInput = $container.find('.commandInput');
    let $cmt = this._$commentInput = $container.find('.commentInput');
    this._$commentSubmit = $container.find('.commentSubmit');
    let preventEsc = e => {
      if (e.keyCode === 27) { // ESC
        e.preventDefault();
        e.stopPropagation();
        // Task 073: 詳しいパネルが開いている時は、まずパネルだけを閉じる
        if (e.type === 'keydown' && this._isPopoverOpen) {
          this._togglePopover(false);
          this._popoverEscAt = Date.now();
          return;
        }
        if (e.type === 'keyup' && Date.now() - (this._popoverEscAt || 0) < 500) {
          return;
        }
        this.emit('esc');
        e.target.blur();
      }
    };

    $input
      .on('focus', this._onFocus.bind(this))
      .on('blur', _.debounce(this._onBlur.bind(this), 500))
      .on('keydown', preventEsc)
      .on('keyup', preventEsc);

    $autoPause.prop('checked', config.props.autoPauseCommentInput);
    this._$autoPause.on('change', (ev) => {
      config.props.autoPauseCommentInput = ev.target.checked;
      $cmt.focus();
    });
    this._$view.find('label').on('click', e => e.stopPropagation());
    this._$form.on('submit', this._onSubmit.bind(this));
    this._$commentSubmit.on('click', this._onSubmitButtonClick.bind(this));
    $view.on('click', e => e.stopPropagation()).on('paste', e => e.stopPropagation());

    this._initializeCommandPicker();
  }
  // Task 073
  _initializeCommandPicker() {
    const view = this._$view[0];
    const commandInput = this._$commandInput[0];
    this._drawer = view.querySelector('.commandDrawer');
    this._popover = view.querySelector('.commandPopover');
    this._isPopoverOpen = false;
    if (!this._drawer || !this._popover || !commandInput) {
      return;
    }
    let premium = false;
    try {
      premium = !!nicoUtil.isPremium();
    } catch (e) {
      premium = false;
    }
    view.classList.toggle('is-premium', premium);

    [this._drawer, this._popover].forEach(elm => {
      // ボタンを押しても入力欄のフォーカスを奪わない（チェックボックスは通常通り）
      elm.addEventListener('mousedown', e => {
        if (e.button !== 0 || e.target.closest('.autoPauseLabel')) { return; }
        e.preventDefault();
      });
      elm.addEventListener('click', e => {
        const button = e.target.closest('[data-picker-group]');
        if (button) {
          e.preventDefault();
          this._onPickerSelect(button.dataset.pickerGroup, button.dataset.pickerValue);
          return;
        }
        if (e.target.closest('.commandPicker-more')) {
          e.preventDefault();
          this._togglePopover();
          return;
        }
        if (e.target.closest('.commandPicker-reset')) {
          e.preventDefault();
          this._setCommandText('');
        }
      });
    });
    commandInput.addEventListener('input', () => this._syncPicker());
    this._syncPicker();
  }
  _focusedInput() {
    const active = document.activeElement;
    return (active === this._$commandInput[0] || active === this._$commentInput[0]) ?
      active : this._$commentInput[0];
  }
  _onPickerSelect(group, value) {
    const commandInput = this._$commandInput[0];
    let next;
    if (group === 'anonymous') {
      next = CommandPicker.apply(commandInput.value, group, !CommandPicker.parse(commandInput.value).anonymous);
    } else if (group === 'flag') {
      next = CommandPicker.apply(commandInput.value, `flag:${value}`, !CommandPicker.parse(commandInput.value).flags[value]);
    } else {
      next = CommandPicker.apply(commandInput.value, group, value);
    }
    this._setCommandText(next);
  }
  _setCommandText(text) {
    const commandInput = this._$commandInput[0];
    const maxLength = commandInput.maxLength > 0 ? commandInput.maxLength : 64;
    if (text.length > maxLength) {
      // 入りきらない場合は変更しない（途中で切れた語がコマンドとして送られないように）
      this._drawer.classList.remove('is-overflow');
      void this._drawer.offsetWidth;
      this._drawer.classList.add('is-overflow');
      return;
    }
    commandInput.value = text;
    this._syncPicker();
    const focused = this._focusedInput();
    if (document.activeElement !== focused) {
      focused.focus();
    }
  }
  _syncPicker() {
    const state = CommandPicker.parse(this._$commandInput[0].value);
    const view = this._$view[0];
    Array.from(view.querySelectorAll('[data-picker-group]')).forEach(button => {
      const {pickerGroup: group, pickerValue: value} = button.dataset;
      const pressed = group === 'anonymous' ? state.anonymous :
        (group === 'flag' ? !!state.flags[value] : state[group] === value);
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
    const hex = CommandPicker.colorHex(state.color);
    view.style.setProperty('--zenza-command-color', hex);
    view.classList.toggle('is-commandColorDark', ['#000000', '#0000FF', '#666666', '#6633CC'].includes(hex.toUpperCase()));
    view.classList.toggle('has-command', !!this._$commandInput[0].value.trim());
  }
  _togglePopover(open = !this._isPopoverOpen) {
    const popover = this._popover;
    if (!popover) { return; }
    this._isPopoverOpen = !!open;
    this._$view[0].classList.toggle('is-popoverOpen', this._isPopoverOpen);
    if (!this._isPopoverOpen) {
      return;
    }
    this._placePopover();
  }
  // 詳しいパネルが画面外にはみ出さないよう、上下の向きと左右のずれを実測して決める
  // （「小」モードで動画を画面端に置いている時や、上下反転している時にも対応）
  _placePopover() {
    const popover = this._popover;
    const view = this._$view[0];
    const margin = CommentInputPanel.POPOVER_EDGE_MARGIN;
    view.classList.remove('is-popoverBelow');
    view.style.setProperty('--zenza-popover-shift-x', '0px');
    view.style.removeProperty('--zenza-popover-max-h');
    const viewportW = window.innerWidth, viewportH = window.innerHeight;
    const inputRect = this._$commentInput[0].getBoundingClientRect();
    const drawer = this._drawer;
    const drawerRect = drawer.getBoundingClientRect();
    const height = popover.scrollHeight;
    const spaceAbove = inputRect.top - margin * 2;
    const spaceBelow = viewportH - drawerRect.bottom - margin * 2;
    let below = false;
    if (height > spaceAbove) {
      // 上に収まらない時は、下に収まるなら下へ。どちらにも収まらなければ広い方に出してスクロールさせる
      below = height <= spaceBelow || spaceBelow > spaceAbove;
      const space = below ? spaceBelow : spaceAbove;
      if (height > space) {
        view.style.setProperty('--zenza-popover-max-h', `${Math.max(120, Math.floor(space))}px`);
      }
    }
    if (below) {
      view.style.setProperty('--zenza-popover-below-top', `${drawer.offsetTop + drawer.offsetHeight + 6}px`);
      view.classList.add('is-popoverBelow');
    }
    const rect = popover.getBoundingClientRect();
    let shift = 0;
    if (rect.left < margin) {
      shift = margin - rect.left;
    } else if (rect.right > viewportW - margin) {
      shift = (viewportW - margin) - rect.right;
    }
    view.style.setProperty('--zenza-popover-shift-x', `${Math.round(shift)}px`);
  }
  _onFocus() {
    if (!this._hasFocus) {
      this.emit('focus', this.isAutoPause);
    }
    this._hasFocus = true;
  }
  _onBlur() {
    if (this._$commandInput.hasFocus() || this._$commentInput.hasFocus()) {
      return;
    }
    this._togglePopover(false);
    this.emit('blur', this.isAutoPause);

    this._hasFocus = false;
  }
  _onSubmit() {
    this.submit();
  }
  _onSubmitButtonClick() {
    this.submit();
  }
  _onAutoPauseCommentInputChange(val) {
    this._$autoPause.prop('checked', !!val);
  }
  submit() {
    let chat = this._$commentInput.val().trim();
    let cmd = this._$commandInput.val().trim();
    if (!chat.length) {
      return;
    }
    // Task 073: Enterでの送信は「formのsubmit」と「送信ボタンのclick」の両方が同時に起きるため、
    // 同じコメントが2回送られないよう、入力欄が空になるまでの間の2回目は無視する
    if (this._submitPending) {
      return;
    }
    this._submitPending = true;

    setTimeout(() => {
      this._submitPending = false;
      this._$commentInput.val('').blur();
      this._$commandInput.blur();
      this._togglePopover(false);

      let $view = this._$view.addClass('updating');
      (new Promise((resolve, reject) => this.emit('post', {resolve, reject}, chat, cmd)))
        .then(() => $view.removeClass('updating'))
        .catch(() => $view.removeClass('updating'));
    }, 0);
  }
  get isAutoPause() {
    return this.config.props.autoPauseCommentInput;
  }
  focus() {
    this._$commentInput.focus();
    this._onFocus();
  }
  blur() {
    this._$commandInput.blur();
    this._$commentInput.blur();
    this._onBlur();
  }
}
CommentInputPanel.CommandPicker = CommandPicker;
CommentInputPanel.POPOVER_EDGE_MARGIN = 8;

CommentInputPanel.__css__ = (`
  .commentInputPanel {
    position: fixed;
    top:  calc(-50vh + 50% + 100vh);
    left: 50vw;
    box-sizing: border-box;

    width: 200px;
    height: 50px;
    z-index: 30000;
    transform: translate(-50%, -170px);
    overflow: visible;
    /* Task 074: 入力モードを解除した時も、広がる時と同じように幅を戻す */
    transition: width 0.2s ease;
  }
  .is-notPlayed .commentInputPanel,
  .is-waybackMode .commentInputPanel,
  .is-mymemory .commentInputPanel,
  .is-loading  .commentInputPanel,
  .is-error    .commentInputPanel {
    display: none;
  }

  .commentInputPanel:focus-within {
    width: 500px;
    z-index: 100000;
  }
  .zenzaScreenMode_wide .commentInputPanel,
  .is-fullscreen           .commentInputPanel {
    position: absolute !important; /* fixedだとFirefoxのバグで消える */
    top:  auto !important;
    bottom: 120px !important;
    transform: translate(-50%, 0);
    left: 50%;
  }

  .commentInputPanel>* {
    pointer-events: none;
  }

  .commentInputPanel input {
    font-size: 18px;
  }

  .commentInputPanel:focus-within>*,
  .commentInputPanel:hover>* {
    pointer-events: auto;
  }

  .is-mouseMoving .commentInputOuter {
    border: 1px solid #888;
    box-sizing: border-box;
    border-radius: 8px;
    opacity: 0.5;
  }
  .is-mouseMoving:not(:focus-within) .commentInputOuter {
    box-shadow: 0 0 8px #fe9, 0 0 4px #fe9 inset;
  }

  .commentInputPanel:focus-within .commentInputOuter,
  .commentInputPanel:hover  .commentInputOuter {
    border: none;
    opacity: 1;
  }

  .commentInput {
    width: 100%;
    height: 30px !important;
    font-size: 24px;
    background: transparent;
    border: none;
    opacity: 0;
    transition: opacity 0.3s ease, box-shadow 0.4s ease;
    text-align: center;
    line-height: 26px !important;
    padding-right: 32px !important;
    margin-bottom: 0 !important;
  }

  .commentInputPanel:hover  .commentInput {
    opacity: 0.5;
  }
  .commentInputPanel:focus-within .commentInput {
    opacity: 0.9 !important;
  }
  .commentInputPanel:focus-within .commentInput,
  .commentInputPanel:hover  .commentInput {
    box-sizing: border-box;
    border: 1px solid #888;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 0 8px #fff;
    color: #000;
  }
  .commentInputPanel:focus-within :where(.commandInput, .commentSubmit) {
    background: #fff;
    color: #000;
  }

  .commentInputPanel .autoPauseLabel {
    position: absolute;
    width: 145px;
    height: 21px !important;
    font-size: 13px;
    top: 9px;
    left: 50%;
    transform: translate(-50%, 0);
    background: #336;
    z-index: -1;
    opacity: 0;
    transition: top 0.2s ease, opacity 0.2s ease;
    text-align: center;
    color: #ccc;
  }
  .commentInputPanel:focus-within .autoPauseLabel {
    top: 36px;
    z-index: 100;
    opacity: 1;
  }

  .commandInput {
    position: absolute;
    width: 100px;
    height: 30px !important;
    font-size: 24px;
    top: 0;
    left: 0;
    border-radius: 8px;
    z-index: -1;
    opacity: 0;
    /* Task 074: z-indexを戻すのは縮むアニメーションが終わってから（先に戻すと入力欄の裏へ隠れて瞬時に消えて見える） */
    transition: left 0.2s ease, opacity 0.2s ease, z-index 0s linear 0.2s;
    text-align: center;
    line-height: 26px !important;
    padding: 0 !important;
    margin-bottom: 0 !important;
  }
  .commentInputPanel:focus-within .commandInput {
    left: -108px;
    z-index: 1;
    transition: left 0.2s ease, opacity 0.2s ease, z-index 0s;
    opacity: 0.9;
    border: none;
    pointer-evnets: auto;
    box-shadow: 0 0 8px #fff;
    padding: 0;
  }

  .commentSubmit {
    position: absolute;
    width: 100px !important;
    height: 30px !important;
    font-size: 24px;
    top: 0;
    right: 0;
    border: none;
    border-radius: 8px;
    z-index: -1;
    opacity: 0;
    transition: right 0.2s ease, opacity 0.2s ease, z-index 0s linear 0.2s;
    line-height: 26px;
    letter-spacing: 0.2em;
  }
  .commentInputPanel:focus-within .commentSubmit {
    right: -108px;
    z-index: 1;
    transition: right 0.2s ease, opacity 0.2s ease, z-index 0s;
    opacity: 0.9;
    box-shadow: 0 0 8px #fff;
  }
  .commentInputPanel:focus-within .commentSubmit:active {
    color: #000;
    background: #fff;
    box-shadow: 0 0 16px #ccf;
  }

  /* ---- Task 073: コメントコマンドピッカー ---- */
  .commentInputPanel {
    --zenza-picker-bg: rgba(34, 35, 40, 0.97);
    --zenza-picker-line: #55565f;
    --zenza-picker-text: #e8e6e3;
    --zenza-picker-muted: #a0a0aa;
    --zenza-picker-accent: #ff9800;
    --zenza-picker-accent-soft: rgba(255, 152, 0, 0.2);
  }
  .commentInputPanel.has-command:focus-within .commandInput {
    box-shadow: 0 0 8px #fff, inset 5px 0 0 var(--zenza-command-color, #fff);
  }
  .commentInputPanel.has-command.is-commandColorDark:focus-within .commandInput {
    box-shadow: 0 0 8px #fff, inset 5px 0 0 var(--zenza-command-color, #fff), inset 6px 0 0 #999;
  }
  .commentInputPanel .commandPicker-btn {
    appearance: none;
    box-sizing: border-box;
    margin: 0;
    padding: 0 7px;
    min-width: 26px;
    height: 22px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: #eef;
    font-size: 12px;
    line-height: 20px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .commentInputPanel .commandPicker-btn:hover {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.16);
  }
  .commentInputPanel .commandPicker-btn:active {
    transform: scale(0.94);
  }
  .commentInputPanel .commandPicker-btn[aria-pressed="true"] {
    border-color: var(--zenza-picker-accent);
    background: var(--zenza-picker-accent);
    color: #111;
    font-weight: bold;
  }
  .commentInputPanel .commandPicker-seg {
    display: flex;
    gap: 3px;
  }
  .commentInputPanel .commandPicker-dots {
    display: grid;
    grid-template-columns: repeat(10, auto);
    gap: 4px;
  }
  .commentInputPanel .commandPicker-dot {
    appearance: none;
    box-sizing: border-box;
    position: relative;
    margin: 0;
    padding: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #777;
    background: var(--dot-color);
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .commentInputPanel .commandPicker-dot:hover {
    transform: scale(1.18);
  }
  .commentInputPanel .commandPicker-dot[aria-pressed="true"] {
    border-color: #fff;
    box-shadow: 0 0 0 2px var(--zenza-picker-accent);
  }
  .commentInputPanel .commandPicker-more {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .commentInputPanel .commandPicker-swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid #999;
    background: var(--zenza-command-color, #fff);
  }
  .commentInputPanel.is-popoverOpen .commandPicker-more {
    border-color: var(--zenza-picker-accent);
    color: var(--zenza-picker-accent);
  }

  /* 帯（案C）: 入力欄にフォーカスした時だけ下に広がる */
  .commentInputPanel .commandDrawer {
    position: absolute;
    top: 34px;
    left: 50%;
    width: 100%;
    min-width: 280px;
    max-width: calc(100vw - 16px);
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 5px 12px;
    padding: 6px 10px;
    border-radius: 0 0 10px 10px;
    background: #336;
    color: #dde;
    font-size: 12px;
    opacity: 0;
    visibility: hidden;
    transform: translate(-50%, -8px);
    z-index: -1;
    transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.25, 1.1), visibility 0s linear 0.25s, z-index 0s linear 0.25s;
  }
  .commentInputPanel:focus-within .commandDrawer {
    opacity: 1;
    visibility: visible;
    transform: translate(-50%, 0);
    z-index: 100;
    transition-delay: 0s;
  }
  .commentInputPanel .commandDrawer.is-overflow {
    animation: zenzaCommandShake 0.3s ease;
  }
  .commentInputPanel .commandDrawer-group {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .commentInputPanel .commandDrawer-label {
    color: #aab;
    font-size: 11px;
  }
  .commentInputPanel .commandDrawer .autoPauseLabel {
    position: static;
    width: auto;
    height: auto !important;
    transform: none;
    opacity: 1;
    z-index: auto;
    background: none;
    color: #ccd;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
  }
  .commentInputPanel .commandDrawer .autoPauseLabel input {
    font-size: 12px;
    vertical-align: middle;
    margin: 0 3px 0 0;
  }

  /* 詳しいパネル（案A）: 🎨で入力欄の上に開く。はみ出す時はJSで下に回す・左右にずらす */
  .commentInputPanel .commandPopover {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    width: 360px;
    max-width: calc(100vw - 16px);
    box-sizing: border-box;
    display: grid;
    gap: 9px;
    padding: 12px;
    border: 1px solid var(--zenza-picker-line);
    border-radius: 12px;
    background: var(--zenza-picker-bg);
    color: var(--zenza-picker-text);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    font-size: 12px;
    text-align: left;
    opacity: 0;
    visibility: hidden;
    transform: translate(calc(-50% + var(--zenza-popover-shift-x, 0px)), 6px) scale(0.98);
    transform-origin: 50% 100%;
    z-index: -1;
    max-height: var(--zenza-popover-max-h, none);
    overflow-y: auto;
    overscroll-behavior: contain;
    transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.2, 0.9, 0.25, 1.15), visibility 0s linear 0.22s;
  }
  .commentInputPanel.is-popoverBelow .commandPopover {
    bottom: auto;
    top: var(--zenza-popover-below-top, 100px);
    transform-origin: 50% 0;
    transform: translate(calc(-50% + var(--zenza-popover-shift-x, 0px)), -6px) scale(0.98);
  }
  .commentInputPanel.is-popoverOpen:focus-within .commandPopover {
    opacity: 1;
    visibility: visible;
    transform: translate(calc(-50% + var(--zenza-popover-shift-x, 0px)), 0) scale(1);
    z-index: 101;
    transition-delay: 0s;
  }
  .commentInputPanel .commandPopover-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .commentInputPanel .commandPopover-label {
    flex: 0 0 auto;
    white-space: nowrap;
    color: var(--zenza-picker-muted);
    font-weight: bold;
  }
  .commentInputPanel:not(.is-premium) .commandPopover .premiumOnly {
    display: none;
  }
  .commentInputPanel .commandPopover .commandPicker-btn {
    border-color: var(--zenza-picker-line);
    background: #2a2b31;
    color: var(--zenza-picker-text);
  }
  .commentInputPanel .commandPopover .commandPicker-btn:hover {
    border-color: #888;
    background: #35363d;
  }
  .commentInputPanel .commandPopover .commandPicker-btn[aria-pressed="true"] {
    border-color: var(--zenza-picker-accent);
    background: var(--zenza-picker-accent-soft);
    color: var(--zenza-picker-text);
    box-shadow: 0 0 0 1px var(--zenza-picker-accent) inset;
  }
  .commentInputPanel .commandPopover .commandPicker-icon {
    width: 48px;
    height: 32px;
    padding: 2px;
  }
  .commentInputPanel .commandPopover .commandPicker-icon svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
  }
  .commentInputPanel .commandPopover .commandPicker-icon svg text {
    fill: currentColor;
    stroke: none;
    font-weight: bold;
    font-family: sans-serif;
  }
  .commentInputPanel .commandPopover .commandPicker-icon svg .fill {
    fill: currentColor;
    stroke: none;
  }
  .commentInputPanel .commandPopover .commandPicker-dot {
    width: 20px;
    height: 20px;
  }
  .commentInputPanel .commandPopover .commandPicker-dots {
    gap: 5px;
  }
  .commentInputPanel .commandPopover-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
    border-top: 1px solid var(--zenza-picker-line);
  }
  .commentInputPanel .commandPopover-note {
    color: var(--zenza-picker-muted);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .commentInputPanel .commandPopover-foot .commandPicker-btn {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .commentInputPanel.has-command .commandInput {
    font-size: 14px;
  }
  @keyframes zenzaCommandShake {
    0%, 100% { transform: translate(-50%, 0); }
    25% { transform: translate(calc(-50% - 4px), 0); }
    75% { transform: translate(calc(-50% + 4px), 0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .commentInputPanel .commandDrawer,
    .commentInputPanel .commandPopover,
    .commentInputPanel .commandPicker-btn,
    .commentInputPanel .commandPicker-dot {
      transition-duration: 1ms !important;
      animation-duration: 1ms !important;
    }
  }
`).trim();

CommentInputPanel.__tpl__ = (() => {
  const P = CommandPicker;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const textButtons = (group, pairs) => pairs.map(([value, label, title]) =>
    `<button type="button" class="commandPicker-btn" tabindex="-1" data-picker-group="${group}" data-picker-value="${value}" title="${esc(title)}" aria-pressed="false">${esc(label)}</button>`
  ).join('');
  const dots = (colors, note) => colors.map(([name, hex, label]) =>
    `<button type="button" class="commandPicker-dot" tabindex="-1" data-picker-group="color" data-picker-value="${name}" style="--dot-color: ${hex};" title="${esc(label)}（${name}）${note}" aria-label="${esc(label)}" aria-pressed="false"></button>`
  ).join('');
  const sizeIcon = fontSize =>
    `<svg viewBox="0 0 48 32" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="29" rx="4"/><text x="24" y="${16 + fontSize * 0.36}" font-size="${fontSize}" text-anchor="middle">A</text></svg>`;
  const posIcon = y =>
    `<svg viewBox="0 0 48 32" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="29" rx="4"/><rect class="fill" x="12" y="${y}" width="24" height="5" rx="2"/></svg>`;
  const iconButtons = (group, items) => items.map(([value, svg, title]) =>
    `<button type="button" class="commandPicker-btn commandPicker-icon" tabindex="-1" data-picker-group="${group}" data-picker-value="${value}" title="${esc(title)}" aria-label="${esc(title)}" aria-pressed="false">${svg}</button>`
  ).join('');

  return (`
  <div class="commentInputPanel forMember" autocomplete="new-password">
    <form action="javascript: void(0);">
      <div class="commentInputOuter">
        <input
          type="text"
          value=""
          autocomplete="on"
          name="mail"
          placeholder="コマンド"
          class="commandInput"
          maxlength="64"
        >
        <input
          type="text"
          value=""
          autocomplete="off"
          name="chat"
          accesskey="c"
          placeholder="コメント入力(C)"
          class="commentInput"
          maxlength="75"
          >
        <input
          type="submit"
          value="送信"
          name="post"
          class="commentSubmit"
          >
        <div class="recButton" title="音声入力">
        </div>
    </div>
    </form>
    <div class="commandDrawer">
      <div class="commandDrawer-group">
        <span class="commandDrawer-label">サイズ</span>
        <div class="commandPicker-seg">${textButtons('size', [['big', '大', '大きい (big)'], ['medium', '中', '普通 (medium)'], ['small', '小', '小さい (small)']])}</div>
      </div>
      <div class="commandDrawer-group">
        <span class="commandDrawer-label">位置</span>
        <div class="commandPicker-seg">${textButtons('pos', [['ue', '上', '上に固定 (ue)'], ['naka', '流', '流れる (naka)'], ['shita', '下', '下に固定 (shita)']])}</div>
      </div>
      <div class="commandDrawer-group">
        <div class="commandPicker-dots">${dots(P.BASIC_COLORS, '')}</div>
      </div>
      <div class="commandDrawer-group">
        <button type="button" class="commandPicker-btn commandPicker-more" tabindex="-1" title="サイズ・位置・カラー・フォントなどを詳しく選ぶ"><span class="commandPicker-swatch"></span>詳しく</button>
        <label class="autoPauseLabel">
          <input type="checkbox" class="autoPause" checked="checked">
          入力時に一時停止
        </label>
      </div>
    </div>
    <div class="commandPopover" role="dialog" aria-label="コメントのコマンドを選ぶ">
      <div class="commandPopover-row">
        <span class="commandPopover-label">サイズ</span>
        <div class="commandPicker-seg">${iconButtons('size', [['big', sizeIcon(22), '大きい (big)'], ['medium', sizeIcon(15), '普通 (medium)'], ['small', sizeIcon(10), '小さい (small)']])}</div>
      </div>
      <div class="commandPopover-row">
        <span class="commandPopover-label">位置</span>
        <div class="commandPicker-seg">${iconButtons('pos', [['ue', posIcon(6), '上に固定 (ue)'], ['naka', posIcon(13.5), '流れる (naka)'], ['shita', posIcon(21), '下に固定 (shita)']])}</div>
      </div>
      <div class="commandPopover-row">
        <span class="commandPopover-label">カラー</span>
        <div class="commandPicker-dots">${dots(P.BASIC_COLORS, '')}</div>
      </div>
      <div class="commandPopover-row premiumOnly">
        <span class="commandPopover-label">プレミアム</span>
        <div class="commandPicker-dots">${dots(P.PREMIUM_COLORS, ' プレミアム会員専用')}</div>
      </div>
      <div class="commandPopover-row">
        <span class="commandPopover-label">調整</span>
        <div class="commandPicker-seg">${textButtons('flag', [['ender', '改行で縮めない', 'ender: 改行が多くても文字を小さくしない'], ['full', '端まで', 'full: 上・下コメントで画面の端まで使う'], ['patissier', '行数で縮めない', 'patissier: 行数が多くても文字を小さくしない（コメントアート向け）']])}</div>
      </div>
      <div class="commandPopover-row">
        <span class="commandPopover-label">フォント</span>
        <div class="commandPicker-seg">${textButtons('font', [['defont', '標準', '標準 (defont)'], ['mincho', '明朝', '明朝体 (mincho)'], ['gothic', 'ゴシック', 'ゴシック体 (gothic)']])}</div>
      </div>
      <div class="commandPopover-foot">
        <button type="button" class="commandPicker-btn" tabindex="-1" data-picker-group="anonymous" data-picker-value="184" title="184 (匿名で投稿)" aria-pressed="false">184</button>
        <span class="commandPopover-note" title="コマンド欄に直接書くこともできます（@秒数 なども使えます）">コマンド欄に直接も書けます</span>
        <button type="button" class="commandPicker-btn commandPicker-reset" tabindex="-1" title="コマンドを空にする">リセット</button>
      </div>
    </div>
  </div>
  `).trim();
})();


//===END===
//

export {
  CommentInputPanel
};

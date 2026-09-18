import {Emitter} from '../../lib/src/Emitter';
import {SHORTCUT_ACTIONS} from './ShortcutActions';
//===BEGIN===
//@require SHORTCUT_ACTIONS
class ShortcutKeyEmitter {
  static create(config, element, externalEmitter) {
    const emitter = new Emitter();
    let isVerySlow = false;

    // コンソールでキーバインド変更
    //
    // 例: ENTERでコメント入力開始
    // ZenzaWatch.config.props['KEY_INPUT_COMMENT'] = 13;
    // SHIFTをつけたいときは 13 + 0x1000

    const map = {
      CLOSE: 0,
      RE_OPEN: 0,
      HOME: 0,
      SEEK_LEFT: 0,
      SEEK_RIGHT: 0,
      // Task 065: SEEK_LEFT2 / SEEK_RIGHT2 (「カスタマイズ用の予備スロット」)
      // はCUSTOM_SEEK_1〜10に置き換えて廃止した。後継は非レガシー扱いなので
      // dynamicMap(下のrebuildDynamicMap参照)側で自動的に処理される。
      SEEK_PREV_FRAME: 0,
      SEEK_NEXT_FRAME: 0,
      VOL_UP: 0,
      VOL_DOWN: 0,
      INPUT_COMMENT: 0,
      FULLSCREEN: 0,
      MUTE: 0,
      TOGGLE_COMMENT: 0,
      TOGGLE_LOOP: 0,
      DEFLIST_ADD: 0,
      DEFLIST_REMOVE: 0,
      TOGGLE_PLAY: 0,
      TOGGLE_PLAYLIST: 0,
      SCREEN_MODE_1: 0,
      SCREEN_MODE_2: 0,
      SCREEN_MODE_3: 0,
      SCREEN_MODE_4: 0,
      SCREEN_MODE_5: 0,
      SCREEN_MODE_6: 0,
      SHIFT_RESET: 0,
      SHIFT_DOWN: 0,
      SHIFT_UP: 0,
      NEXT_VIDEO: 0,
      PREV_VIDEO: 0,
      SCREEN_SHOT: 0,
      SCREEN_SHOT_WITH_COMMENT: 0
    };

    Object.keys(map).forEach(key => {
      map[key] = parseInt(config.props[`KEY_${key}`], 10);
    });

    // Task 059: ShortcutActions.js のレジストリに登録された「新規」の
    // ショートカット(legacyでないもの)用の、 押されたキーコード -> アクション
    // の逆引きマップ。上のmapと同じ構築方法だが、キーの変更を
    // ページリロード無しで反映できるよう rebuildDynamicMap() として
    // 独立させ、config の 'update' イベントで再構築する。
    let dynamicMap = {};
    const rebuildDynamicMap = () => {
      const next = {};
      SHORTCUT_ACTIONS.filter(action => !action.legacy).forEach(action => {
        const keyValue = parseInt(config.props[`KEY_${action.id}`], 10) || 0;
        if (keyValue) { next[keyValue] = action; }
      });
      dynamicMap = next;
    };
    rebuildDynamicMap();

    // 既存(レガシー)のショートカットも、コンソールや設定パネルからの
    // 変更をリロード無しで反映できるよう、config更新時にmapも作り直す
    // （従来は生成時の値で固定されていたが、設定パネルを新設したことで
    // 「変更したのに反映されない」という混乱を避けるため今回まとめて対応した）。
    if (config && typeof config.on === 'function') {
      config.on('update', key => {
        if (typeof key !== 'string' || !key.startsWith('KEY_')) { return; }
        Object.keys(map).forEach(k => {
          map[k] = parseInt(config.props[`KEY_${k}`], 10);
        });
        rebuildDynamicMap();
      });
    }

    const onKeyDown = e => {
      const target = (e.path && e.path[0]) ? e.path[0] : e.target;

      if (target.tagName === 'SELECT' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA') {
        return;
      }

      const keyCode = e.keyCode +
        (e.metaKey ? 0x1000000 : 0) +
        (e.altKey ? 0x100000 : 0) +
        (e.ctrlKey ? 0x10000 : 0) +
        (e.shiftKey ? 0x1000 : 0);
      let key = '';
      let param = '';
      switch (keyCode) {
        case 178:
        case 179:
          key = 'TOGGLE_PLAY';
          break;
        case 177:
          key = 'PREV_VIDEO';
          break;
        case 176:
          key = 'NEXT_VIDEO';
          break;
        case map.CLOSE:
          key = 'ESC';
          break;
        case map.RE_OPEN:
          key = 'RE_OPEN';
          break;
        case map.HOME:
          key = 'SEEK_TO';
          param = 0;
          break;
        case map.SEEK_LEFT:
        case 37: // LEFT
          if (e.shiftKey || isVerySlow) {
            key = 'SEEK_BY';
            param = isVerySlow ? -0.5 : -5;
          }
          break;

        case map.VOL_UP:
          key = 'VOL_UP';
          break;
        case map.SEEK_RIGHT:
        case 39: // RIGHT
          if (e.shiftKey || isVerySlow) {
            key = 'SEEK_BY';
            param = isVerySlow ? 0.5 : 5;
          }
          break;
        case map.SEEK_PREV_FRAME:
          key = 'SEEK_PREV_FRAME';
          break;
        case map.SEEK_NEXT_FRAME:
          key = 'SEEK_NEXT_FRAME';
          break;
        case map.VOL_DOWN:
          key = 'VOL_DOWN';
          break;
        case map.INPUT_COMMENT:
          key = 'INPUT_COMMENT';
          break;
        case map.FULLSCREEN:
          key = 'FULL';
          break;
        case map.MUTE:
          key = 'MUTE';
          break;
        case map.TOGGLE_COMMENT:
          key = 'VIEW_COMMENT';
          break;
        case map.TOGGLE_LOOP:
          key = 'TOGGLE_LOOP';
          break;
        case map.DEFLIST_ADD:
          key = 'DEFLIST';
          break;
        case map.DEFLIST_REMOVE:
          key = 'DEFLIST_REMOVE';
          break;
        case map.TOGGLE_PLAY:
          key = 'TOGGLE_PLAY';
          break;
        case map.TOGGLE_PLAYLIST:
          key = 'TOGGLE_PLAYLIST';
          break;
        case map.SHIFT_RESET:
          key = 'PLAYBACK_RATE';
          isVerySlow = true;
          param = 0.1;
          break;
        case map.SCREEN_MODE_1:
          key = 'SCREEN_MODE';
          param = 'small';
          break;
        case map.SCREEN_MODE_2:
          key = 'SCREEN_MODE';
          param = 'sideView';
          break;
        case map.SCREEN_MODE_3:
          key = 'SCREEN_MODE';
          param = '3D';
          break;
        case map.SCREEN_MODE_4:
          key = 'SCREEN_MODE';
          param = 'normal';
          break;
        case map.SCREEN_MODE_5:
          key = 'SCREEN_MODE';
          param = 'big';
          break;
        case map.SCREEN_MODE_6:
          key = 'SCREEN_MODE';
          param = 'wide';
          break;
        case map.NEXT_VIDEO:
          key = 'NEXT_VIDEO';
          break;
        case map.PREV_VIDEO:
          key = 'PREV_VIDEO';
          break;
        case map.SHIFT_DOWN:
          key = 'SHIFT_DOWN';
          break;
        case map.SHIFT_UP:
          key = 'SHIFT_UP';
          break;
        case map.SCREEN_SHOT:
          key = 'SCREEN_SHOT';
          break;
        case map.SCREEN_SHOT_WITH_COMMENT:
          key = 'SCREEN_SHOT_WITH_COMMENT';
          break;
        default: {
          // Task 059: 上のswitchのどのcaseにも一致しなかった場合、
          // ShortcutActions.js に登録された「新規」ショートカットの
          // 逆引きマップを見る。新しいショートカットを追加する時は
          // ShortcutActions.js にエントリを1つ足すだけでよく、この
          // switch文自体を変更する必要はない（拡張しやすくするための設計）。
          const action = dynamicMap[keyCode];
          if (action) {
            key = action.id;
            // Task 065: カスタムシークスロット(CUSTOM_SEEK_1〜10)は、
            // このShortcutActions.js配列に書かれた固定のaction.paramでは
            // なく、Config.props.PARAM_<id>にユーザーが自由入力した秒数を
            // 使う。それ以外の既存アクションは今まで通りaction.paramを使う
            // (Config.props.PARAM_<id>自体が存在しないため、下のundefined
            // チェックで自動的にaction.param側にフォールバックする)。
            const paramOverride = config.props[`PARAM_${action.id}`];
            if (paramOverride !== undefined) {
              param = parseFloat(paramOverride) || 0;
            } else {
              param = action.param !== undefined ? action.param : '';
            }
          }
          break;
        }
      }
      if (key) {
        emitter.emit('keyDown', key, e, param);
      }
    };

    const onKeyUp = e => {
      const target = (e.path && e.path[0]) ? e.path[0] : e.target;
      if (target.tagName === 'SELECT' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA') {
        return;
      }

      let key = '';
      const keyCode = e.keyCode +
        (e.metaKey ? 0x1000000 : 0) +
        (e.altKey ? 0x100000 : 0) +
        (e.ctrlKey ? 0x10000 : 0) +
        (e.shiftKey ? 0x1000 : 0);
      let param = '';
      switch (keyCode) {
        case map.SHIFT_RESET:
          key = 'PLAYBACK_RATE';
          isVerySlow = false;
          param = 1;
          break;
      }
      if (key) {
        emitter.emit('keyUp', key, e, param);
      }
    };

    (async () => {
      await externalEmitter.promise('init');
      element = element || document.body || document.documentElement;
      element.addEventListener('keydown', onKeyDown);
      element.addEventListener('keyup', onKeyUp);
      externalEmitter.on('keydown', onKeyDown);
      externalEmitter.on('keyup', onKeyUp);
    })();

    return emitter;
  }
}

//===END===
export {ShortcutKeyEmitter};
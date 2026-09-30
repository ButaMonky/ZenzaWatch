// Task 104 / D-40: コメント速度変更時に前回の衝突レイアウトを持ち越さない。
import assert from 'power-assert';

const {createContext, loadClass} = require('../helpers/extractSource');

function loadSubjects() {
  const NicoChat = {TYPE: {TOP: 'ue', NAKA: 'naka', BOTTOM: 'shita'}, SORT_FUNCTION: () => 0};
  const CommentLayer = {SCREEN: {HEIGHT: 384, WIDTH: 544}};
  const c1 = createContext({NicoChat, CommentLayer});
  const NicoChatViewModel = loadClass(
    'packages/zenza/src/commentLayer/NicoChatViewModel.js',
    'NicoChatViewModel',
    c1
  );

  const c2 = createContext({
    NicoChatViewModel,
    NicoChat,
    CommentLayoutWorker: {getInstance: () => null}
  });
  const NicoChatGroupViewModel = loadClass(
    'packages/zenza/src/commentLayer/NicoChatGroupViewModel.js',
    'NicoChatGroupViewModel',
    c2
  );
  return {NicoChatViewModel, NicoChatGroupViewModel, NicoChat};
}

function fakeViewModel(Cls, type, height, y, overflow) {
  const vm = Object.create(Cls.prototype);
  vm._type = type;
  vm._height = height;
  vm._fontSizePixel = 32;
  vm._y = y;
  vm._isOverflow = overflow;
  vm._isLayouted = true;
  return vm;
}

describe('コメント速度変更時の再レイアウト（D-40 / Task 104）', function() {
  it('naka/ue は古いY・overflowを初期状態へ戻す', function() {
    const {NicoChatViewModel, NicoChat} = loadSubjects();
    const naka = fakeViewModel(NicoChatViewModel, NicoChat.TYPE.NAKA, 32, 160, true);
    const ue = fakeViewModel(NicoChatViewModel, NicoChat.TYPE.TOP, 32, 96, true);

    naka.resetLayoutForSpeedChange();
    ue.resetLayoutForSpeedChange();

    assert.equal(naka.ypos, 0);
    assert.equal(ue.ypos, 0);
    assert.equal(naka.isOverflow, false);
    assert.equal(ue.isOverflow, false);
  });

  it('shita は画面下端の初期Yへ戻す', function() {
    const {NicoChatViewModel, NicoChat} = loadSubjects();
    const shita = fakeViewModel(NicoChatViewModel, NicoChat.TYPE.BOTTOM, 40, 120, true);

    shita.resetLayoutForSpeedChange();

    assert.equal(shita.ypos, 344);
    assert.equal(shita.isOverflow, false);
  });

  it('group.changeSpeed は reset → timing再計算 → relayout の順で行う', function() {
    const {NicoChatGroupViewModel} = loadSubjects();
    const calls = [];
    const member = {
      resetLayoutForSpeedChange() { calls.push('reset'); },
      recalcBeginEndTiming(rate) { calls.push('timing:' + rate); }
    };
    const group = Object.create(NicoChatGroupViewModel.prototype);
    group._members = [member];
    group._execCommentLayoutWorker = () => { calls.push('layout'); };

    group.changeSpeed(1.5);

    assert.deepEqual(calls, ['reset', 'timing:1.5', 'layout']);
  });
});

import assert from 'power-assert';
const {extract, createContext, run} = require('../helpers/extractSource');

function subject(commentSpeedRate, autoCommentSpeedRate = false, playbackRate = 1) {
  const events = [];
  const Config = {props: {commentSpeedRate, autoCommentSpeedRate, playbackRate}};
  const model = {SPEED_RATE: 0.75, emitter: {emit: (...args) => events.push(args)}};
  const c = createContext({Config, NicoChatViewModel: model});
  const update = run('(' + extract('src/CommentPlayer.js', 'updateSpeedRate', 'var') + ')', c);
  update();
  return {model, events, update, Config};
}

describe('不正なコメント速度からの復帰（D-40 / Task108）', function() {
  it('0・負数・非数・無限大のコメント速度を標準速度へ戻す', function() {
    for (const value of [0, -1, '', null, undefined, 'invalid', NaN, Infinity, -Infinity]) {
      const {model, events} = subject(value);
      assert.equal(model.SPEED_RATE, 1, String(value));
      assert.deepEqual(events, [['updateCommentSpeedRate', 1]]);
    }
  });
  it('自動調整で不正な再生速度を使っても有効なコメント速度を保つ', function() {
    for (const value of ['invalid', undefined, NaN, Infinity, -Infinity, 0, -1]) {
      assert.equal(subject(1.5, true, value).model.SPEED_RATE, 1.5, String(value));
    }
    assert.equal(subject(Number.MIN_VALUE, true, 2).model.SPEED_RATE, 1);
  });
  it('正のカスタム速度・数値文字列と自動調整を維持する', function() {
    assert.equal(subject(3).model.SPEED_RATE, 3);
    assert.equal(subject('1.5').model.SPEED_RATE, 1.5);
    assert.equal(subject('1.5', true, '2').model.SPEED_RATE, 0.75);
    assert.equal(subject(1.5, true, 0.5).model.SPEED_RATE, 1.5);
    assert.equal(subject(1.5, false, NaN).model.SPEED_RATE, 1.5);
    assert.equal(subject(0, true, 2).model.SPEED_RATE, 0.5);
  });
  it('同じ有効速度では再通知せず、後から有効な設定に変えられる', function() {
    const {model, events, update, Config} = subject('invalid');
    update();
    assert.equal(events.length, 1);
    Config.props.commentSpeedRate = 2;
    update();
    assert.equal(model.SPEED_RATE, 2);
    assert.deepEqual(events, [['updateCommentSpeedRate', 1], ['updateCommentSpeedRate', 2]]);
    assert.equal(Config.props.commentSpeedRate, 2);
  });
});

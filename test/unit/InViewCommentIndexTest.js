// Task 105 / D-40: 現在時刻付近のコメントだけを走査して描画候補を取得する。
import assert from 'power-assert';

const {createContext, loadClass} = require('../helpers/extractSource');

function loadSubject() {
  const NicoChat = {SORT_FUNCTION: (a, b) => a.vpos - b.vpos};
  const NicoChatViewModel = {};
  const c = createContext({
    NicoChat,
    NicoChatViewModel,
    CommentLayoutWorker: {getInstance: () => null}
  });
  return loadClass(
    'packages/zenza/src/commentLayer/NicoChatGroupViewModel.js',
    'NicoChatGroupViewModel',
    c
  );
}

function makeChat(vposSec, duration, visibleAt, calls) {
  const begin = vposSec;
  const end = begin + duration;
  return {
    vpos: vposSec * 100,
    uniqNo: vposSec,
    beginLeftTiming: begin,
    endRightTiming: end,
    isInViewBySecond(sec) {
      calls.count++;
      return sec + 1 >= begin && sec <= end && sec === visibleAt;
    }
  };
}

describe('表示中コメント探索のインデックス化（D-40 / Task 105）', function() {
  it('長時間コメントを取りこぼさず、未来コメントでは走査を打ち切る', function() {
    const Cls = loadSubject();
    const group = Object.create(Cls.prototype);
    const calls = {count: 0};
    const long = makeChat(0, 120, 100, calls);
    const near = makeChat(99, 4, 100, calls);
    const future = makeChat(200, 4, 100, calls);
    group._members = [future, near, long];
    group._createVSortedMembers();

    const result = group.getInViewMembersBySecond(100);

    assert.deepEqual(result, [long, near]);
    assert.ok(calls.count < 3, '未来コメントまで全件走査している');
  });

  it('大量の過去コメントをisInViewBySecondで総当たりしない', function() {
    const Cls = loadSubject();
    const group = Object.create(Cls.prototype);
    const calls = {count: 0};
    group._members = [];
    for (let sec = 0; sec < 10000; sec++) {
      group._members.push(makeChat(sec, 4, 5000, calls));
    }
    group._createVSortedMembers();

    const result = group.getInViewMembersBySecond(5000);

    assert.ok(result.length > 0);
    assert.ok(calls.count < 20, '候補確認が多すぎる: ' + calls.count);
  });

  it('_createVSortedMembers は実データの最大表示時間をキャッシュする', function() {
    const Cls = loadSubject();
    const group = Object.create(Cls.prototype);
    const calls = {count: 0};
    group._members = [
      makeChat(10, 4, 0, calls),
      makeChat(20, 30, 0, calls),
      makeChat(5, 3, 0, calls)
    ];

    group._createVSortedMembers();

    assert.equal(group._maxInViewDuration, 30);
    assert.deepEqual(group._vSortedMembers.map(v => v.vpos), [500, 1000, 2000]);
  });
});

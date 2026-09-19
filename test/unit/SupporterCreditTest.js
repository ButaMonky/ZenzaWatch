// Task 080: 動画の最後の「提供」画面（SupporterCredit）の、通信とギフトの配置のテスト
import assert from 'power-assert';
import {SupporterCredit} from '../../packages/zenza/src/videoPlayer/SupporterCredit';

const PICKUP = {
  meta: {status: 200},
  data: {
    supporters: {
      adTopSupporter: {supporterName: 'A', auxiliary: {bgColor: '#0000FF'}},
      giftTopSupporter: {userId: 1, supporterName: 'B'},
      adRecentSupporter: {userId: 2, supporterName: 'C', auxiliary: {bgColor: '#0000FF'}},
      giftRecentSupporter: {userId: 1, supporterName: 'B'}
    },
    logoImageUrl: 'https://example.invalid/logo.png',
    infoText: 'info',
    infoUrl: 'https://koken.nicovideo.jp',
    voiceUrl: 'https://example.invalid/voice.mp3'
  }
};
const GIFTS = {meta: {status: 200}, data: {effects: [{itemId: 'x', point: 500}], hasMoreEffects: false}};

const withFetch = async (routes, fn) => {
  const original = global.fetch;
  const calls = [];
  global.fetch = url => {
    calls.push(url);
    const key = Object.keys(routes).find(k => url.includes(k));
    const body = key ? routes[key] : null;
    return Promise.resolve({ok: !!body, json: () => Promise.resolve(body)});
  };
  try {
    return await fn(calls);
  } finally {
    global.fetch = original;
  }
};

describe('SupporterCredit', function() {
  it('pickup_supporters と gift/effects を読み、表示に使う形にまとめる', async function() {
    await withFetch({'/pickup_supporters': PICKUP, '/gift/effects': GIFTS}, async calls => {
      const data = await SupporterCredit.load({videoId: 'sm9', tags: ['音楽', 'VOCALOID']});
      assert.equal(data.supporters.adTopSupporter.supporterName, 'A');
      assert.equal(data.voiceUrl, 'https://example.invalid/voice.mp3');
      assert.equal(data.gifts.length, 1);
      assert.ok(calls.some(u => u.includes('/v2/contents/video/sm9/pickup_supporters?tags=%E9%9F%B3%E6%A5%BD%2CVOCALOID')));
      assert.ok(calls.some(u => u.includes('/v1/nage_video/sm9/gift/effects')));
    });
  });

  it('支援者がいなければ表示しない（null）', async function() {
    await withFetch({'/pickup_supporters': {meta: {status: 200}, data: {supporters: {}}}}, async () => {
      assert.equal(await SupporterCredit.load({videoId: 'sm9'}), null);
    });
    await withFetch({}, async () => {
      assert.equal(await SupporterCredit.load({videoId: 'sm9'}), null);
    });
  });

  it('ギフトは下の段から、空いている所に詰めて置く（本家と同じ配置）', function() {
    const grid = new SupporterCredit.GiftGrid(20);
    grid.add('a', 3, 2);
    grid.add('b', 3, 2);
    grid.add('c', 20, 1);
    assert.deepEqual(grid.items.map(i => [i.data, i.col, i.row]), [['a', 0, 0], ['b', 3, 0], ['c', 0, 2]]);
    assert.equal(grid.rowSize, 3);
    assert.equal(grid.topBaseLine, 3);
  });

  it('300pt 以上のギフトだけ支援者名とポイントを出す。落ちてくる時間は約5.75秒の間に散らばる', function() {
    const gift = (point, row, col) => ({point, supporterName: 's', assetData: {imageGridRow: row, imageGridColumn: col}});
    const layer = new SupporterCredit.GiftLayer([gift(500, 3, 2), gift(200, 3, 2)]);
    assert.deepEqual(layer.items.map(i => i.showName), [true, false]);
    layer.items.forEach(i => {
      assert.ok(i.start >= 0 && i.start <= 5.75 + 1e-9);
      assert.ok(Math.abs(i.land - i.start - 1.25) < 1e-9);
    });
    assert.equal(layer.scroll, null);
  });
});

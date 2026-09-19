// Task 081: 動画の後ろ（提供画面の間）に書かれたコメントの位置のテスト
import assert from 'power-assert';
import {NicoChat} from '../../packages/zenza/src/commentLayer/NicoChat';

const chat = vpos => ({text: 'test', vpos, cmd: '', userId: 'u', no: 1, thread: 1, fork: 0});

describe('NicoChat: 提供画面の間のコメント', function() {
  it('提供画面を出す設定なら、動画の長さ＋1秒より後ろのコメントは詰めない', function() {
    const c = NicoChat.create(chat(25900), {videoDuration: 257, creditDuration: 30});
    assert.equal(c.vpos, 25900);
  });
  it('提供画面を出さない設定なら、今まで通り動画の最後の方へ詰める', function() {
    const c = NicoChat.create(chat(25900), {videoDuration: 257});
    assert.ok(c.vpos < 25700);
  });
  it('提供画面より後ろ（30秒を超える）のコメントは今まで通り詰める', function() {
    const c = NicoChat.create(chat(257 * 100 + 3500), {videoDuration: 257, creditDuration: 30});
    assert.ok(c.vpos < 25700);
  });
});

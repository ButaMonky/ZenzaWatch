/**
 * Task1029 の回帰防止テスト。
 *
 * 2026-11-14 の事故: PlaybackRateReconciler と WarmSwapController を
 * `src/*.js` の import 文だけで取り込んだつもりになっていたが、build.js が
 * 実際にモジュールを埋め込むのは本体の中の `//@require <名前>` 指示を見たときだけ。
 * 指示が無かったため配布物に定義が入らず、
 *   - 速度の調停器が作られず canplay のたびに書き戻す古い動作のまま
 *   - ウォームスワップは設定をONにしても一切起動しない
 * という状態で2回リリースしてしまった。dist はソースから正しく再生成できていたので
 * 再生成チェックでは検出できなかった。
 *
 * そこで「名前が出てくるか」ではなく「定義が配布物に入っているか」を検査する。
 * typeof による参照だけが入っていて定義が無い、という前回の見落としを再現できないように、
 * 参照と定義の両方を別々に数える。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const distPath = resolve(root, 'dist/ZenzaWatch-dev.user.js');

const DEFINITIONS = [
  'class PlaybackRateReconciler',
  'const createPlaybackRateReconciler',
  'const normalizeRate'
];

/** 定義を参照している側（これだけ入っていても機能しない）。 */
const REFERENCES = [
  'typeof createPlaybackRateReconciler'
];

test('task1029 the generated entry files carry the //@require directives', () => {
  const player = readFileSync(resolve(root, 'src/NicoVideoPlayer.js'), 'utf8');
  const dialog = readFileSync(resolve(root, 'src/NicoVideoPlayerDialog.js'), 'utf8');
  // build.js は import 文ではなく //@require を見てモジュールを埋め込む。
  assert.match(player, /^\/\/@require createPlaybackRateReconciler$/m);
  // Task1029 後半: ウォームスワップは削除した（docs/design-pack/reference/task1029-warm-swap/ に記録）。
  assert.doesNotMatch(player, /WarmSwap|isAdoptableReadiness/);
  assert.doesNotMatch(dialog, /WarmSwap/);
});

test('task1029 the built userscript actually defines the new modules', (t) => {
  if (!existsSync(distPath)) {
    t.skip('dist/ZenzaWatch-dev.user.js が無い（ビルド前）');
    return;
  }
  const dist = readFileSync(distPath, 'utf8');
  for (const needle of DEFINITIONS) {
    assert.ok(dist.includes(needle),
      `配布物に定義が入っていない: ${needle}（//@require の指示を確認すること）`);
  }
  // 参照だけ入って定義が無い状態が前回の事故。参照も確かにあることを確認する。
  for (const needle of REFERENCES) {
    assert.ok(dist.includes(needle), `配布物に参照が無い: ${needle}`);
  }
});

test('task1029 the built userscript no longer drops to 1x before setting a rate', (t) => {
  if (!existsSync(distPath)) {
    t.skip('dist/ZenzaWatch-dev.user.js が無い（ビルド前）');
    return;
  }
  const dist = readFileSync(distPath, 'utf8');
  // 「いったん1倍にして100ms後に目的値へ」書く旧実装。拡張機能と押し合いになる。
  assert.ok(!/video\.playbackRate = 1;/.test(dist),
    '速度を1倍へ落とす旧実装が残っている');
  assert.ok(dist.includes('defaultPlaybackRate = rate'),
    'defaultPlaybackRate を設定していない（読み込み時に速度が戻る）');
  assert.ok(dist.includes("'ratechange', fromNative"),
    'ratechange を監視していない（外部の速度変更に気づけない）');
});

test('task1030 the built preparer records when metadata was fetched (reuse needs it)', (t) => {
  if (!existsSync(distPath)) { t.skip('dist が無い'); return; }
  const dist = readFileSync(distPath, 'utf8');
  // 2026-11-15 の事故: Dialog 側だけ配布物に入り、Preparer（hls:sync で生成）が古いままで
  // dataAt が無く、先読みの再利用が全件 no-timestamp で止まっていた。
  assert.match(dist, /expiresAt, companions, dataAt, adopted: false/);
  assert.ok(dist.includes('adoptPrefetched'));
});

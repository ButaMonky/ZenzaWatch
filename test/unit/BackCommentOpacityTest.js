// Task 102 / B-7: backCommentで半透明レイヤーを重ねない。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');

function source() {
  return fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'NicoVideoPlayerDialog.js'),
    'utf-8'
  );
}

describe('backComment の透明度レイヤー（B-7 / Task 102）', function() {
  it('動画プレイヤー全体を半透明にせず、コメントレイヤーだけがopacityを持つ', function() {
    const src = source();

    assert.ok(
      !/\.is-showComment\.is-backComment\s+\.videoPlayer\s*\{[^}]*opacity\s*:/s.test(src),
      'backComment時の .videoPlayer に opacity が残っている'
    );
    assert.ok(
      !/\.is-showComment\.is-backComment\s+\.videoPlayer:hover\s*\{[^}]*opacity\s*:/s.test(src),
      'backComment時の hover opacity が残っている'
    );
    assert.ok(
      /\.zenzaPlayerContainer\s+\.commentLayerFrame\s*\{[^}]*opacity:\s*var\(--zenza-comment-layer-opacity\)/s.test(src),
      'commentLayerFrame の透明度設定が失われている'
    );
  });

  it('Task401では映像を縮小せず画面全面にコメントを重ねる', function() {
    const src = source();
    const fullEnd = src.indexOf("`, {className: 'screenMode for-full', disabled: true});");
    const fullStart = src.lastIndexOf('util.addStyle(`', fullEnd);
    const css = src.slice(fullStart, fullEnd);
    assert.ok(fullStart >= 0 && fullEnd > fullStart);
    assert.ok(!/\.is-(?:showComment\.is-)?backComment\s+\.videoPlayer\s*\{/.test(css),
      '旧来の動画50%縮小ルールが残っている');
    const rule = css.match(/\.zenzaPlayerContainer\.is-backComment\s+\.commentLayerFrame\s*\{([^}]+)\}/s);
    assert.ok(rule, '画面全体のコメントレイヤールールがない');
    assert.match(rule[1], /position:\s*absolute/);
    assert.match(rule[1], /width:\s*100%\s*!important/);
    assert.match(rule[1], /height:\s*100%\s*!important/);
    assert.match(rule[1], /z-index:\s*101\s*!important/);
    assert.match(rule[1], /pointer-events:\s*none/);
    assert.ok(!rule[1].includes('100vh - 40px'), 'コメントが操作バーの上で切れている');
    const info = fs.readFileSync(path.join(REPO_ROOT, 'src', 'VideoInfoPanel.js'), 'utf-8');
    assert.ok(!/\.is-backComment\s+\.zenzaWatchVideo(?:Info|Header)Panel/.test(info),
      '旧背面モードの情報パネル半透明化が残っている');
  });
});

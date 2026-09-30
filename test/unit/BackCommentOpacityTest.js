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

  it('Task052/095のbackComment配置ルールは維持する', function() {
    const src = source();
    assert.ok(
      /\.is-backComment\s+\.videoPlayer\s*\{[^}]*left:\s*25%;[^}]*top:\s*25%;[^}]*width:\s*50%;[^}]*height:\s*50%/s.test(src),
      'backCommentの動画縮小ルールが失われている'
    );
    assert.ok(
      /\.zenzaPlayerContainer\.is-backComment\s+\.commentLayerFrame\s*\{[^}]*position:\s*fixed;[^}]*width:\s*100vw;[^}]*height:\s*calc\(100vh - 40px\)/s.test(src),
      'Task052/095のviewport comment layerルールが失われている'
    );
  });
});

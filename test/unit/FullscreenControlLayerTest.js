// Task 101 / B-1: 全画面で右側操作ボタンをシークバーのコメントpreviewより前面に保つ。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');

function fullscreenCss() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'VideoControlBar.js'), 'utf-8');
  const marker = "{className: 'screenMode for-screen-full videoControlBar'";
  const end = src.indexOf(marker);
  assert.ok(end > 0, 'for-screen-full style marker が見つからない');
  const start = src.lastIndexOf('util.addStyle(\`', end);
  assert.ok(start >= 0, 'for-screen-full util.addStyle が見つからない');
  return src.slice(start, end);
}

function zIndexOf(css, selector) {
  const escaped = selector.replace(/\./g, '\\.');
  const m = new RegExp(escaped + '\\s*\\{([\\s\\S]*?)\\}').exec(css);
  if (!m) { return null; }
  const z = /z-index\s*:\s*(\d+)/.exec(m[1]);
  return z ? Number(z[1]) : null;
}

describe('全画面のシークバーと右操作ボタンの重なり（B-1 / Task 101）', function() {
  it('右操作列はシークバーより前面で、設定・全画面ボタンをクリックできる', function() {
    const css = fullscreenCss();
    const seek = zIndexOf(css, '.seekBarContainer');
    const right = zIndexOf(css, '.controlItemContainer.right');
    const menuRight = zIndexOf(css, '.videoControlBar.is-menuOpen .controlItemContainer.right');
    assert.equal(seek, 300);
    assert.ok(right > seek, 'right controls z-index=' + right + ', seekbar=' + seek);
    assert.ok(menuRight > seek, 'menu-open right controls z-index=' + menuRight + ', seekbar=' + seek);
  });

  it('Task040のようにコメント一覧・サムネイルの位置は動かさない', function() {
    const css = fullscreenCss();
    assert.ok(!/zenzaCommentPreview/.test(css), 'コメントpreviewを全画面用CSSで移動している');
    assert.ok(!/seekBarToolTip/.test(css), 'シークバーthumbnailを全画面用CSSで移動している');
  });
});

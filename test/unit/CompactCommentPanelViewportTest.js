import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');
const read = file => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

describe('short viewport: preserve native video information and comment tabs', function() {
  const panels = [
    'tools/typescript-stage1/nico-src/VideoInfoPanel.ts',
    'src/VideoInfoPanel.js'
  ];
  const dialogs = [
    'tools/typescript-stage1/nico-src/NicoVideoPlayerDialog.ts',
    'src/NicoVideoPlayerDialog.js'
  ];
  for (const file of panels) {
    it(file + ' removes the rejected floating ribbon', function() {
      const src = read(file);
      assert.ok(!src.includes('compactViewportFallback'));
      assert.ok(!src.includes('transform: translateX(calc(100% - 36px))'));
      assert.ok(!src.includes("content: 'コメント・情報'"));
      assert.ok(!src.includes('class="zenzaWatchVideoInfoPanel show initializing" tabindex="0"'));
    });
    it(file + ' restores native tabs for short windows', function() {
      const src = read(file);
      assert.ok(src.includes('@media screen and (height < 700px)'));
      for (const mode of ['normal','big']) {
        assert.ok(src.includes('body.zenzaScreenMode_' + mode + ' .zenzaWatchVideoInfoPanel'));
      }
      assert.ok(src.includes('display: inherit'));
      assert.ok(src.includes('height: min(240px, 35vh)'));
    });
  }
  for (const file of dialogs) {
    it(file + ' scales only the original video frame and reserves panel space', function() {
      const src = read(file);
      assert.ok(src.includes('width < 1216px) and (height < 700px)'));
      assert.ok(src.includes('width < 992px) and (height < 700px)'));
      assert.ok(src.includes('aspect-ratio: 28 / 15'));
      assert.ok(src.includes('aspect-ratio: 7 / 4'));
      assert.ok(src.includes('calc(100vw - ${CONSTANT.RIGHT_PANEL_WIDTH}px)'));
      assert.ok(src.includes('padding-right: ${CONSTANT.RIGHT_PANEL_WIDTH}px'));
      assert.ok(src.includes('min-height: 700px'));
      assert.ok(src.includes('padding-bottom: min(${CONSTANT.BOTTOM_PANEL_HEIGHT}px, 35vh)'));
    });
  }
  it('keeps comments and the original video header settings enabled by default', function() {
    const src=read('src/Config.js');
    assert.match(src,/enableCommentPanel:\s*true/);
    assert.match(src,/enableCommentPanelAutoScroll:\s*true/);
    assert.match(src,/'videoHeader\.position':\s*'auto'/);
  });
});

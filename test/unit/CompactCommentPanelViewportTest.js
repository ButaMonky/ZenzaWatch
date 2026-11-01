import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');

const read = (relative) => fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');

describe('short viewport: video info and comment-list accessibility', function() {
  const sources = [
    'tools/typescript-stage1/nico-src/VideoInfoPanel.ts',
    'src/VideoInfoPanel.js'
  ];

  for (const file of sources) {
    it(file + ' keeps a visible edge drawer at narrow and short sizes', function() {
      const source = read(file);
      for (const [mode, width] of [['normal', 991], ['big', 1215]]) {
        const media = '@media screen and (max-width: ' + width + 'px) and (max-height: 699px)';
        assert.ok(source.includes(media), 'missing short-viewport breakpoint for ' + mode);
        const selector = 'body.zenzaScreenMode_' + mode +
          ' #zenzaVideoPlayerDialog.is-open .zenzaWatchVideoInfoPanel';
        const open = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '\\s*\\{\\s*display:\\s*block;');
        assert.match(source, open, 'comment/info panel must be displayable for ' + mode);
        assert.ok(source.includes(selector + ':hover'), 'mouse access missing');
        assert.ok(source.includes(selector + ':focus-within'), 'keyboard access missing');
      }
      assert.ok(source.includes('tabindex=\\"0\\"') || source.includes('tabindex="0"'),
        'panel needs to be keyboard-focusable');
    });
  }
});

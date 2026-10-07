'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {REPO_ROOT} = require('../helpers/buildSandbox');

const sourceFiles = [
  'src/CommentInputPanel.js',
  'src/NicoVideoPlayerDialog.js',
  'src/TagListView.js',
  'src/VideoControlBar.js',
  'src/VideoInfoPanel.js',
  'packages/zenza/src/storyboard/StoryboardView.js'
];

const badTokens = [
  'translateY(8x)',
  'pointer-evnets',
  'vertical-aligm',
  'box-shdow',
  'will-change: tranform',
  'solid !000',
  ':avtive'
];

describe('Task256 CSS typo cleanup', () => {
  it('removes known CSS typos from source and generated ZenzaWatch dist', () => {
    const source = sourceFiles
      .map(file => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'))
      .join('\n');
    const dist = fs.readFileSync(path.join(REPO_ROOT, 'dist/ZenzaWatch-dev.user.js'), 'utf8');

    for (const token of badTokens) {
      assert.ok(!source.includes(token), `source still contains ${token}`);
      assert.ok(!dist.includes(token), `dist still contains ${token}`);
    }
  });

  it('keeps VideoSearchForm padding and width as separate declarations', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'src/VideoInfoPanel.js'), 'utf8');
    const dist = fs.readFileSync(path.join(REPO_ROOT, 'dist/ZenzaWatch-dev.user.js'), 'utf8');
    const expected = /padding:\s*0 8px;\s*width:\s*248px;/;

    assert.ok(expected.test(source), 'source search panel CSS is malformed');
    assert.ok(expected.test(dist), 'dist search panel CSS is malformed');
  });
});

'use strict';
const assert = require('assert');
const {read} = require('../helpers/extractSource');
const toolbar = () => read('src/VideoControlBar.js');
const fullCss = () => {
  const text = toolbar();
  // Task964: the file is generated from TypeScript, which prints `{ className: ... }`.
  const found = /\{\s*className: 'screenMode for-screen-full videoControlBar'/.exec(text);
  const end = found ? found.index : -1;
  assert(end > 0);
  const start = text.lastIndexOf('util.addStyle(`', end);
  assert(start >= 0);
  return text.slice(start + 'util.addStyle(`'.length, text.lastIndexOf('`', end));
};
describe('Issue #3 / Task951: fullscreen seek hit-area ownership', () => {
  it('owns the transparent wrapper fix inside the seekbar fullscreen style', () => {
    const css = fullCss();
    assert(css.includes('.controlItemContainer.right > .scalingUI'));
    assert(css.includes('pointer-events: none'));
    assert(css.includes('> .controlButton {'));
    assert(css.includes('pointer-events: auto'));
    assert(css.includes('z-index: 310'));
    assert(css.includes('z-index: 320'));
  });
  it('does not double-initialize hit-area CSS in global TypeScript helpers', () => {
    for (const file of ['tools/typescript-stage1/nico-src/inintCssProps.ts',
      'packages/zenza/src/init/inintCssProps.js']) {
      assert(!read(file).includes('issue3-hit-area'), file);
    }
  });
  it('enables this same style on native fullscreen, not other screen modes', () => {
    const dialog = read('src/NicoVideoPlayerDialog.js');
    assert(dialog.includes("on: 'style.screenMode.for-full, style.screenMode.for-screen-full'"));
    assert(dialog.includes("off: 'style.screenMode:not(.for-full):not(.for-screen-full)"));
  });
  it('ships the exact fix in the private userscript bundle', () => {
    const dist = read('dist/ZenzaWatch-dev.user.js');
    const css = fullCss();
    const parity = /\.videoControlBar \.controlItemContainer\.right,\s*\.videoControlBar \.controlItemContainer\.right > \.scalingUI\s*\{\s*pointer-events:\s*none;\s*\}\s*:where\(\.videoControlBar \.controlItemContainer\.right > \.scalingUI\) > \.controlButton\s*\{\s*pointer-events:\s*auto;/;
    assert(parity.test(css), 'source hit-area rules incomplete');
    assert(parity.test(dist), 'distributed hit-area rules missing');
    assert(dist.includes('Issue #3 / Task951'));
    assert(!dist.includes('screenMode for-screen-full issue3-hit-area'));
  });
});

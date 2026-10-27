// Task204: NG filter toggle button beside the existing comment visibility button.
'use strict';
const assert = require('assert');
const {read} = require('../helpers/extractSource');

describe('Task204 NG filter control button', () => {
  const source = () => read('src/NicoVideoPlayerDialog.js');

  it('places the NG toggle immediately beside the comment visibility button', () => {
    const text = source();
    const block = text.match(/<div class="menuItemContainer leftBottom">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
    assert(block, 'leftBottom controls not found');
    assert(/showCommentSwitch[\s\S]*ngFilterSwitch/.test(block[0]), 'NG button must follow comment button');
    assert(/class="ngFilterSwitch menuButton" data-command="toggle-enableFilter"/.test(block[0]));
  });

  it('preserves readable comment and NG tooltips using their configured shortcut keys', () => {
    const text = source();
    // Task939 replaced hard-coded '(V)' with the live KEY_TOGGLE_COMMENT
    // tooltip binding. The original button command and NG icon stay intact.
    assert(text.includes('<div class="tooltip">コメント表示ON/OFF</div>'));
    assert(!text.includes('コメント表示ON/OFF(V)'),
      'hard-coded V would disagree with a customized shortcut');
    const registry = read('src/UiVisibilityRegistry.js');
    assert(/'toggle-showComment':\s*'TOGGLE_COMMENT'/.test(registry));
    assert(/ngFilterSwitch[\s\S]*?<div class="tooltip">NGフィルターON\/OFF<\/div>/.test(text));
    assert(/ngFilterSwitch[\s\S]*?ngFilterIcon/.test(text));
    assert(text.includes('data-command="toggle-showComment"'));
  });

  it('maps filter state to a dialog class so the button always reflects config changes', () => {
    const text = source();
    assert(/isEnableFilter:\s*['"]is-enableFilter['"]/.test(text));
  });

  it('shows enabled and disabled states using the existing menu-button visual language', () => {
    const text = source();
    assert(/\.ngFilterSwitch\s*\{[\s\S]*?left:\s*40px;/.test(text));
    assert(/\.is-enableFilter\s+\.ngFilterSwitch\s*\{[\s\S]*?filter:\s*none;/.test(text));
    assert(/\.ngFilterSwitch[\s\S]*?\.ngFilterIcon/.test(text));
  });

  it('reuses the existing toggle-enableFilter command path instead of adding filter logic', () => {
    const dispatcher = read('src/RootDispatcher.js');
    assert(dispatcher.includes("case 'toggle-enableFilter':"));
    assert(!source().includes('data-command="toggle-ngFilter"'));
  });
});

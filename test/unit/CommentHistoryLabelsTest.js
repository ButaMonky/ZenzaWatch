'use strict';
const assert = require('assert');
const {read} = require('../helpers/extractSource');
describe('Task200 comment-history UTF-8 labels', function() {
  it('keeps the chosen icon accessible name and tooltip readable before the panel loads', function() {
    const text = read('src/VideoControlBar.js');
    const marker = 'class="commentHistorySwitch controlButton"';
    const start = text.indexOf(marker);
    assert(start >= 0);
    const button = text.slice(start, text.indexOf('</button>', start));
    assert(button.includes('aria-label="コメント増量"'));
    assert(button.includes('<span class="tooltip">コメント増量</span>'));
    assert(!button.includes('\uFFFD'));
  });
});

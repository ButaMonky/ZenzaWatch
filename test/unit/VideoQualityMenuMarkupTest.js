'use strict';

const assert = require('assert');
const {read} = require('../helpers/extractSource');

const source = read('src/VideoControlBar.js');

const getMenu = (text, className) => {
  const marker = `<ul class="${className}">`;
  const start = text.indexOf(marker);
  assert(start >= 0, `missing ${className} menu`);
  const end = text.indexOf('</ul>', start);
  assert(end >= 0, `missing ${className} closing ul`);
  return text.slice(start, end + '</ul>'.length);
};

describe('Task233 video-quality menu markup', function() {
  it('uses valid closing li tags for domand quality options', function() {
    const menu = getMenu(source, 'domandVideoQuality');
    assert.strictEqual((menu.match(/<li\b/g) || []).length, 6);
    assert.strictEqual((menu.match(/<\/li>/g) || []).length, 6);
    assert(!menu.includes('<//li>'));
  });

  it('uses valid closing li tags for dmc quality options', function() {
    const menu = getMenu(source, 'dmcVideoQuality');
    assert.strictEqual((menu.match(/<li\b/g) || []).length, 5);
    assert.strictEqual((menu.match(/<\/li>/g) || []).length, 5);
    assert(!menu.includes('<//li>'));
  });

  it('keeps generated dev dist quality-menu markup in parity with source', function() {
    const dist = read('dist/ZenzaWatch-dev.user.js');
    const domand = getMenu(dist, 'domandVideoQuality');
    const dmc = getMenu(dist, 'dmcVideoQuality');
    assert.strictEqual((domand.match(/<li\b/g) || []).length, 6);
    assert.strictEqual((domand.match(/<\/li>/g) || []).length, 6);
    assert.strictEqual((dmc.match(/<li\b/g) || []).length, 5);
    assert.strictEqual((dmc.match(/<\/li>/g) || []).length, 5);
    assert(!domand.includes('<//li>'));
    assert(!dmc.includes('<//li>'));
  });
});

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function tooltipBorderColor(text) {
  const block = text.match(/\.controlButton \.tooltip\s*\{([\s\S]*?)\}/);
  assert.ok(block, 'controlButton tooltip CSS block was not found');
  const border = block[1].match(/border:\s*1px\s+solid\s+([^;]+);/);
  assert.ok(border, 'tooltip border declaration was not found');
  return border[1].trim();
}

describe('Task250 GamePad tooltip border CSS', () => {
  it('uses a valid #000 color in the GamePad source tooltip border', () => {
    const color = tooltipBorderColor(read('src/_gamepad.js'));
    assert.strictEqual(color, '#000');

    const probe = document.createElement('div');
    probe.style.cssText = `border: 1px solid ${color};`;
    assert.notStrictEqual(probe.style.border, '', 'browser CSS parser rejected tooltip border');
  });

  it('keeps generated GamePad dist in parity with the valid source border', () => {
    assert.strictEqual(tooltipBorderColor(read('dist/ZenzaGamePad.user.js')), '#000');
  });
});

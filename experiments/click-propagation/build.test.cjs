'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {build} = require('./build.cjs');
const original = fs.readFileSync(path.join(__dirname, '../../dist/ZenzaWatch-dev.user.js'), 'utf8');
test('trial retains userscript identity, permissions and original saved defaults', () => {
  const trial = build(original);
  for (const key of ['name', 'namespace', 'grant', 'match', 'exclude', 'require']) {
    const pattern = new RegExp('^// @' + key + '\\s+.*$', 'gm');
    assert.deepEqual(trial.match(pattern), original.match(pattern));
  }
  assert.match(trial, /const propagate = true;/);
  assert.match(trial, /'overrideWatchLink:allowPropagation': false/);
  assert.match(trial, /if \(!propagate\) \{\s*e\.stopImmediatePropagation\(\);/);
  assert.match(trial, /experiment\/click-propagation1018/);
  new vm.Script(trial);
});
test('unknown source layout fails closed', () => {
  assert.throws(() => build(original.replace('const propagate =', 'const changed =')), /anchor changed/);
});
test('generated artifact is exactly reproducible from production bundle', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, 'ZenzaWatch-click-propagation-trial.user.js'), 'utf8'), build(original));
});

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {REPO_ROOT} = require('../helpers/buildSandbox');

describe('Task239 package metadata points to the maintained public fork', () => {
  it('uses the same public repository as the README install/support links', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.homepage, 'https://github.com/ButaMonky/ZenzaWatch');
    assert.strictEqual(pkg.bugs && pkg.bugs.url, 'https://github.com/ButaMonky/ZenzaWatch/issues');
    assert.strictEqual(
      pkg.repository && pkg.repository.url,
      'https://github.com/ButaMonky/ZenzaWatch.git'
    );
  });

  it('keeps README installation and support links aligned with package metadata', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
    const fork = pkg.homepage;

    assert.strictEqual(pkg.repository.url, `${fork}.git`);
    assert.strictEqual(pkg.bugs.url, `${fork}/issues`);
    assert.ok(readme.includes(`(${pkg.bugs.url})`), 'README issue tracker must match package.json');
    assert.ok(readme.includes(`(${fork}/discussions)`), 'README discussions must use the maintained fork');

    // Task928: the public project homepage/support stay public, while a
    // private release may legitimately deliver builds from its private repo.
    const dev = fs.readFileSync(path.join(REPO_ROOT, 'dist/ZenzaWatch-dev.user.js'), 'utf8');
    const download = dev.match(/^\/\/ @downloadURL\s+(\S+)/m)?.[1];
    const isPrivate = !!download?.startsWith('https://github.com/ButaMonky/ZenzaWatch-Back-up/raw/develop/dist/');
    const installPrefix = isPrivate ?
      'https://github.com/ButaMonky/ZenzaWatch-Back-up/raw/develop/dist/' :
      'https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/';
    for (const script of [
      'ZenzaWatch-dev.user.js',
      'ZenzaHLS.user.js',
      'MylistPocket.user.js',
      'ZenzaAdvancedSettings.user.js',
      'ZenzaBlogPartsButton.user.js'
    ]) {
      assert.ok(
        readme.includes(`(${installPrefix}${script})`),
        `README install link for ${script} must match its release channel`
      );
    }
  });
});

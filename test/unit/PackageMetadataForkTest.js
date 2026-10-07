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

    const repoPath = new URL(fork).pathname.slice(1);
    const installPrefix = `https://raw.githubusercontent.com/${repoPath}/develop/dist/`;
    for (const script of [
      'ZenzaWatch-dev.user.js',
      'ZenzaHLS.user.js',
      'MylistPocket.user.js',
      'ZenzaAdvancedSettings.user.js',
      'ZenzaBlogPartsButton.user.js'
    ]) {
      assert.ok(
        readme.includes(`(${installPrefix}${script})`),
        `README install link for ${script} must use the maintained fork`
      );
    }
  });
});

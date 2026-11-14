'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {REPO_ROOT} = require('../helpers/buildSandbox');

const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
const SCRIPT = path.join(REPO_ROOT, 'tools', 'check_source_identity.py');
const PUBLIC_REPO = 'https://github.com/ButaMonky/ZenzaWatch';
const PUBLIC_RAW = PUBLIC_REPO + '/raw/develop/dist/ZenzaWatch-dev.user.js';
const VERSION = '2.7.999-task977';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', timeout: 15000});
  assert.strictEqual(result.error, undefined, result.error && result.error.message);
  assert.strictEqual(result.status, 0,
    (result.stderr || '') + (result.stdout || '') + ' command=' + command + ' ' + args.join(' '));
  return result;
}

function createCheckout(channel, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-source-identity-'));
  const repoName = channel === 'private' ? 'ZenzaWatch-Back-up' : 'ZenzaWatch';
  const metadata = {
    homepageURL: PUBLIC_REPO,
    supportURL: PUBLIC_REPO + '/issues',
    downloadURL: PUBLIC_RAW,
    updateURL: PUBLIC_RAW,
    ...overrides
  };
  const source = [
    '// ==UserScript==',
    '// @name ZenzaWatch',
    '// @version ' + VERSION,
    '// ==/UserScript==',
    ''
  ].join('\n');
  const dist = [
    '// ==UserScript==',
    '// @name ZenzaWatch',
    '// @version ' + VERSION,
    '// @homepageURL ' + metadata.homepageURL,
    '// @supportURL ' + metadata.supportURL,
    '// @downloadURL ' + metadata.downloadURL,
    '// @updateURL ' + metadata.updateURL,
    '// ==/UserScript==',
    ''
  ].join('\n');

  fs.mkdirSync(path.join(root, 'src'), {recursive: true});
  fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
  fs.writeFileSync(path.join(root, 'src', '_template.js'), source);
  fs.writeFileSync(path.join(root, 'dist', 'ZenzaWatch-dev.user.js'), dist);

  run('git', ['init', '--quiet'], root);
  run('git', ['config', 'user.name', 'Source Identity Test'], root);
  run('git', ['config', 'user.email', 'source-identity-test@example.invalid'], root);
  run('git', ['add', 'src/_template.js', 'dist/ZenzaWatch-dev.user.js'], root);
  run('git', ['commit', '--quiet', '-m', 'fixture'], root);
  run('git', ['remote', 'add', 'origin',
    'https://github.com/ButaMonky/' + repoName + '.git'], root);
  return root;
}

function check(root, channel) {
  return spawnSync(PYTHON, [
    SCRIPT, '--checkout', root, '--channel', channel, '--metadata-only', '--require-clean'
  ], {cwd: REPO_ROOT, encoding: 'utf8', timeout: 15000});
}

function withCheckout(channel, overrides, callback) {
  const root = createCheckout(channel, overrides);
  try {
    callback(check(root, channel));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
}

describe('Task977 source identity and public update destination', function() {
  this.timeout(30000);

  it('accepts a private development checkout that advertises only public update URLs', function() {
    withCheckout('private', {}, result => {
      assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /SOURCE_IDENTITY=OK/);
      assert.match(result.stdout, /repo=ZenzaWatch-Back-up/);
      assert.match(result.stdout, /update_repo=ZenzaWatch/);
    });
  });

  it('accepts a public checkout with public update URLs', function() {
    withCheckout('public', {}, result => {
      assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /SOURCE_IDENTITY=OK/);
      assert.match(result.stdout, /repo=ZenzaWatch/);
    });
  });

  it('rejects a private @downloadURL in the private development checkout', function() {
    withCheckout('private', {
      downloadURL: 'https://github.com/ButaMonky/ZenzaWatch-Back-up/raw/develop/dist/ZenzaWatch-dev.user.js'
    }, result => {
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /@downloadURL/);
      assert.match(result.stdout, /public ZenzaWatch destination/);
    });
  });

  it('rejects a private @updateURL even when @downloadURL is correct', function() {
    withCheckout('private', {
      updateURL: 'https://github.com/ButaMonky/ZenzaWatch-Back-up/raw/develop/dist/ZenzaWatch-dev.user.js'
    }, result => {
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /@updateURL/);
    });
  });

  it('rejects a private homepageURL', function() {
    withCheckout('private', {
      homepageURL: 'https://github.com/ButaMonky/ZenzaWatch-Back-up'
    }, result => {
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /@homepageURL/);
    });
  });

  it('rejects a private supportURL', function() {
    withCheckout('private', {
      supportURL: 'https://github.com/ButaMonky/ZenzaWatch-Back-up/issues'
    }, result => {
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /@supportURL/);
    });
  });

  it('still rejects a public channel label when origin is the private repository', function() {
    const root = createCheckout('private', {});
    try {
      const result = spawnSync(PYTHON, [
        SCRIPT, '--checkout', root, '--channel', 'public', '--metadata-only', '--require-clean'
      ], {cwd: REPO_ROOT, encoding: 'utf8', timeout: 15000});
      assert.strictEqual(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /origin is not the selected public\/private repository/);
    } finally {
      fs.rmSync(root, {recursive: true, force: true});
    }
  });
});
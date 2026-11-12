'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {REPO_ROOT} = require('../helpers/buildSandbox');
const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const manifest = JSON.parse(read('dist-manifest.json'));
const installNames = [
  'ZenzaWatch-dev','MylistPocket',
  'ZenzaBlogPartsButton'
];
const meta = name => {
  const src = read('dist/' + name + '.user.js').slice(0, 8000);
  const get = field => src.match(new RegExp('^// @' + field + '\\s+([^\\r\\n]+)', 'm'))?.[1]?.trim();
  return {version:get('version'),download:get('downloadURL'),update:get('updateURL')};
};
const publicBase = 'https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/';
const installBase = 'https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/';
describe('Task928 private backup with public-only update destinations', () => {
  it('keeps beginner installer links pointed at the public distribution', () => {
    const readme = read('README.md');
    for (const name of installNames) {
      const url = installBase + name + '.user.js';
      assert(readme.includes('](' + url + ')'), 'README install link: ' + name);
    }
    assert(readme.includes('自動更新先は、常に公開版'));
    assert(!readme.includes('ZenzaWatch-Back-up/raw/develop/dist/'));
  });
  it('documents all distribution roles and the HLS retirement update path', () => {
    const readme = read('README.md'), scripts = read('SCRIPTS.md');
    for (const item of [...manifest.active.files, ...manifest.legacyFrozen.files]) {
      const file = path.basename(item.file);
      assert(readme.includes('`' + file + '`'), 'README role: ' + file);
      assert(scripts.includes('`' + file + '`'), 'SCRIPTS role: ' + file);
    }
    for (const role of ['本体', '任意追加', '廃止案内', '凍結旧版']) assert(readme.includes(role));
    assert(!readme.includes('上の2つをインストール'));
    assert(readme.includes('| ~~ZenzaAdvancedSettings~~ | 本体に統合済み。インストール不要。 |'));
    assert(readme.includes('| ~~ZenzaHLS（HLSサポート）~~ | 本体に統合済み。インストール不要。 |'));
    assert(scripts.includes('ZenzaWatch_video.hls.*'));
    assert(scripts.includes('`zenza_hls` v5 / `ts-data`'));
  });
  it('pins both download and update URLs to the public repository for all active scripts', () => {
    for (const {file} of manifest.active.files) {
      const name = path.basename(file).replace(/\.user\.js$/, '');
      const item = meta(name);
      assert(item.version, name + ': missing version');
      assert.strictEqual(item.download, publicBase + name + '.user.js', name);
      assert.strictEqual(item.update, item.download, name);
      assert(!item.download.includes('/ButaMonky/ZenzaWatch-Back-up/'), name);
    }
  });
  it('records the reviewed build versions of the five installers', () => {
    const wanted = {
      'ZenzaWatch-dev':'2.7.396-task1022',
      'ZenzaHLS':'0.1.0-task997',
      'MylistPocket':'0.5.90-task1015',
      'ZenzaAdvancedSettings':'0.4.0-task993',
      'ZenzaBlogPartsButton':'1.1.0-task1020'
    };
    for (const [name,version] of Object.entries(wanted)) {
      assert.strictEqual(meta(name).version, version, name);
    }
  });
  it('preserves the Task927 features in both rebuilt distribution files', () => {
    const watch = read('dist/ZenzaWatch-dev.user.js');
    const settings = read('dist/ZenzaWatch-dev.user.js');
    assert(watch.includes('popup.backgroundTransparency'));
    assert(watch.includes('popup.notifyColor'));
    assert(watch.includes('popup.alertColor'));
    assert(settings.includes('通知背景の透明度'));
    assert(settings.includes('zw-popup-color-sample'));
    assert(settings.includes('zw-modern-color-editor'));
    assert(read('dist/ZenzaAdvancedSettings.user.js').includes('削除してください'));
  });
});
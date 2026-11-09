'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {REPO_ROOT} = require('../helpers/buildSandbox');
const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const manifest = JSON.parse(read('dist-manifest.json'));
const installNames = [
  'ZenzaWatch-dev','ZenzaHLS','MylistPocket',
  'ZenzaAdvancedSettings','ZenzaBlogPartsButton'
];
const meta = name => {
  const src = read('dist/' + name + '.user.js').slice(0, 8000);
  const get = field => src.match(new RegExp('^// @' + field + '\\s+([^\\r\\n]+)', 'm'))?.[1]?.trim();
  return {version:get('version'),download:get('downloadURL'),update:get('updateURL')};
};
const publicBase = 'https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/';
const installBase = 'https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/';
describe('Task928 private backup with public-only update destinations', () => {
  it('keeps public installer links and documents each build version', () => {
    const readme = read('README.md');
    for (const name of installNames) {
      const version = meta(name).version;
      const url = installBase + name + '.user.js';
      assert(readme.includes('](' + url + ')'), 'README install link: ' + name);
      assert(readme.includes('`' + version + '`'), 'README version: ' + name);
    }
    assert(readme.includes('自動更新先は、常に公開版'));
    assert(!readme.includes('ZenzaWatch-Back-up/raw/develop/dist/'));
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
      'ZenzaWatch-dev':'2.7.365-task989',
      'ZenzaHLS':'0.0.43-task981',
      'MylistPocket':'0.5.83-task989',
      'ZenzaAdvancedSettings':'0.3.89-task989',
      'ZenzaBlogPartsButton':'0.0.5-task928'
    };
    for (const [name,version] of Object.entries(wanted)) {
      assert.strictEqual(meta(name).version, version, name);
    }
  });
  it('preserves the Task927 features in both rebuilt distribution files', () => {
    const watch = read('dist/ZenzaWatch-dev.user.js');
    const settings = read('dist/ZenzaAdvancedSettings.user.js');
    assert(watch.includes('popup.backgroundTransparency'));
    assert(watch.includes('popup.notifyColor'));
    assert(watch.includes('popup.alertColor'));
    assert(settings.includes('通知背景の透明度'));
    assert(settings.includes('zw-popup-color-sample'));
    assert(settings.includes('zw-modern-color-editor'));
    assert(settings.includes("0.3.89-task989"));
  });
});

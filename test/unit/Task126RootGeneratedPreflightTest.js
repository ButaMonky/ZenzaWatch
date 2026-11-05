'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {inspect, sha} = require('../../tools/check-root-test-generated.cjs');

describe('Task126 read-only generated-prerequisite preflight', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-task126-')); });
  afterEach(() => { fs.rmSync(root, {recursive: true, force: true}); });
  const put = (relative, content) => {
    const p = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, content);
  };
  const stage = 'tools/typescript-stage1';

  // The ten baseline modules remain required in both remote and expanded local SCUI.
  const coreScui = ['SceneSearchLayout00', 'SceneSearchPreferences', 'SceneSearchPreviewView',
    'SceneSearchPlacement', 'SceneSearchController', 'SceneSearchInteraction',
    'ScenePreviewIdleLimiter', 'SceneSearchShortcutRouter', 'SceneCommentSearch', 'SceneCommentSearchPanel'];
  const localScui = coreScui.concat(['TimelineGeometry', 'SceneResumeMarkerPresenter',
    'SceneSearchVisibleRectCollector', 'SceneSearchLayoutResources', 'SceneSearchLayoutRegistry',
    'SceneSearchDomLease', 'SceneSearchPreferenceConnection', 'SceneSearchObstacleCollector',
    'SceneSeekStepControl', 'SceneSearchLayoutCatalog', 'SceneSearchLayoutCard',
    'SceneSearchLegacyAdapter', 'SceneSearchLayout10', 'SceneSearchLayouts03_04',
    'SceneSearchLayouts05_06', 'SceneSearchLayout07', 'SceneSearchLayouts01_02',
    'SceneSearchLayoutBootstrap', 'SceneSearchPlayerBinding', 'SceneSearchIntegrationBridge',
    'SceneSearchLayouts08_09']);
  const scuiFixture = (names = coreScui, output = true) => {
    const records = {}, source = 'export const fixture = 1;\n';
    for (const name of names) {
      const sourcePath = stage + '/nico-src/' + name + '.ts';
      put(sourcePath, source);
      if (output) put(stage + '/.generated/scui/' + name + '.js', 'export {};\n');
      records[name] = {source: sourcePath, sourceSha256: sha(source)};
    }
    put(stage + '/scui-runtime-manifest.json', JSON.stringify(records));
    return records;
  };

  it('detects both missing legacy Nico outputs even without a manifest', () => {
    put(stage + '/tsconfig.nico-legacy.json', JSON.stringify({
      files: ['nico-src/NicoVideoPlayerDialog.ts', 'nico-src/VideoControlBar.ts']
    }));
    const result = inspect(root);
    assert.deepEqual(result.missing, [
      stage + '/.generated/nico/NicoVideoPlayerDialog.js',
      stage + '/.generated/nico/VideoControlBar.js'
    ]);
  });

  it('checks Nico and SCUI sources against tracked manifest hashes', () => {
    const source = 'export const x = 1;\n';
    put(stage + '/nico-src/NVApi.ts', source);
    put(stage + '/nico-api-manifests/NVApi.json', JSON.stringify({
      source: stage + '/nico-src/NVApi.ts', sourceSha256: sha(source)
    }));
    scuiFixture(coreScui, false);
    let result = inspect(root);
    assert.equal(result.missing.length, 11);
    assert.deepEqual(result.stale, []);

    put(stage + '/nico-src/NVApi.ts', 'export const x = 2;\n');
    result = inspect(root);
    assert.deepEqual(result.stale, ['NICO_SOURCE_MANIFEST_STALE: NVApi']);
  });

  it('accepts present output paths but does not claim compiler provenance', () => {
    put(stage + '/tsconfig.nico-legacy.json', JSON.stringify({
      files: ['nico-src/VideoControlBar.ts']
    }));
    put(stage + '/.generated/nico/VideoControlBar.js', 'export {};\n');
    const result = inspect(root);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.stale, []);
    assert.equal(result.required.length, 1);
    // The checker deliberately does not certify stale-but-present output.
  });

  it('rejects empty files and directory placeholders', () => {
    put(stage + '/tsconfig.nico-legacy.json', JSON.stringify({
      files: ['nico-src/NicoVideoPlayerDialog.ts', 'nico-src/VideoControlBar.ts']
    }));
    put(stage + '/.generated/nico/NicoVideoPlayerDialog.js', '');
    fs.mkdirSync(path.join(root, stage, '.generated/nico/VideoControlBar.js'), {
      recursive: true
    });
    const result = inspect(root);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.invalid, [
      stage + '/.generated/nico/NicoVideoPlayerDialog.js',
      stage + '/.generated/nico/VideoControlBar.js'
    ]);
  });

  it('requires P12 outputs only when a P12 source module exists', () => {
    assert.deepEqual(inspect(root).required, []);
    put(stage + '/p12-src/ManualBookmarkStore.ts', 'export class ManualBookmarkStore {}\n');
    const result = inspect(root);
    assert.deepEqual(result.missing, [stage + '/.generated/p12/ManualBookmarkStore.js']);
  });

  it('does not write generated files or update the manifest during inspection', () => {
    put(stage + '/tsconfig.nico-legacy.json', JSON.stringify({
      files: ['nico-src/NicoVideoPlayerDialog.ts']
    }));
    const before = fs.readdirSync(path.join(root, stage));
    assert.equal(inspect(root).missing.length, 1);
    const after = fs.readdirSync(path.join(root, stage));
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(path.join(root, stage, '.generated')), false);
  });
  it('accepts all 31 local SCUI module names including grouped layouts with underscores', () => {
    scuiFixture(localScui);
    const result = inspect(root);
    assert.equal(result.required.length, 31);
    assert(result.required.includes(stage + '/.generated/scui/SceneSearchLayouts03_04.js'));
    assert(result.required.includes(stage + '/.generated/scui/SceneSearchLayouts08_09.js'));
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.invalid, []);
    assert.deepEqual(result.stale, []);
  });

  it('rejects SCUI traversal and non-identifier names even beside valid core modules', () => {
    const records = scuiFixture();
    for (const name of ['../Escape', 'Nested/Module', 'Nested\\Module', 'Layout..Two',
      '_Leading', 'Space Name', 'Layout%2fTwo']) {
      put(stage + '/scui-runtime-manifest.json', JSON.stringify({...records,
        [name]: {source: stage + '/nico-src/' + name + '.ts', sourceSha256: sha('')} }));
      assert.throws(() => inspect(root), /INVALID_SCUI_MANIFEST_NAME/);
    }
  });

  it('blocks a truncated SCUI manifest that omits a required baseline module', () => {
    const records = scuiFixture();
    delete records.SceneSearchLayout00;
    put(stage + '/scui-runtime-manifest.json', JSON.stringify(records));
    const result = inspect(root);
    assert(result.stale.includes('SCUI_REQUIRED_MANIFEST_MISSING: SceneSearchLayout00'));
  });

  it('blocks a missing baseline source without attempting to regenerate it', () => {
    const records = scuiFixture(coreScui.filter(name => name !== 'SceneSearchLayout00'));
    records.SceneSearchLayout00 = {
      source: stage + '/nico-src/SceneSearchLayout00.ts', sourceSha256: sha('absent')
    };
    put(stage + '/scui-runtime-manifest.json', JSON.stringify(records));
    const result = inspect(root);
    assert(result.stale.includes('SCUI_SOURCE_MANIFEST_STALE: SceneSearchLayout00'));
    assert.equal(fs.existsSync(path.join(root, stage, 'nico-src/SceneSearchLayout00.ts')), false);
  });

});

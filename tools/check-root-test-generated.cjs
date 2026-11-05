'use strict';
// Task126: read-only root-test prerequisite check. No TypeScript compilation,
// runtime syncing, dist generation, external deployment, or source modification.
// Presence and manifest-source hashes are NOT proof of compiler provenance.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const STAGE = 'tools/typescript-stage1';
const safeName = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
// Grouped SCUI layouts use identifier underscores (for example Layouts03_04).
// Keep this grammar separate from Nico names; neither accepts any path separator.
const safeScuiName = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
const coreScuiNames = ['SceneSearchLayout00', 'SceneSearchPreferences', 'SceneSearchPreviewView',
  'SceneSearchPlacement', 'SceneSearchController', 'SceneSearchInteraction',
  'ScenePreviewIdleLimiter', 'SceneSearchShortcutRouter', 'SceneCommentSearch', 'SceneCommentSearchPanel'];
const abs = (root, relative) => path.join(root, ...relative.split('/'));
const exists = (root, relative) => fs.existsSync(abs(root, relative));
const read = (root, relative) => fs.readFileSync(abs(root, relative), 'utf8');
const sha = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

function plan(root) {
  const paths = new Set(), stale = [];
  const nicoDir = STAGE + '/nico-api-manifests';
  if (exists(root, nicoDir)) {
    for (const filename of fs.readdirSync(abs(root, nicoDir)).filter(n => n.endsWith('.json'))) {
      const name = filename.slice(0, -5);
      if (!safeName(name)) throw Error('INVALID_NICO_MANIFEST_NAME');
      const info = JSON.parse(read(root, nicoDir + '/' + filename));
      const source = STAGE + '/nico-src/' + name + '.ts';
      if (info.source !== source || !/^[a-f0-9]{64}$/.test(info.sourceSha256 || '')) {
        throw Error('INVALID_NICO_SOURCE_MANIFEST: ' + name);
      }
      paths.add(STAGE + '/.generated/nico/' + name + '.js');
      if (!exists(root, source) || sha(read(root, source)) !== info.sourceSha256) {
        stale.push('NICO_SOURCE_MANIFEST_STALE: ' + name);
      }
    }
  }

  // Include the legacy Nico emitter's explicit file list, even if its ignored
  // output is omitted from an otherwise correct strict-compiler build.
  const legacy = STAGE + '/tsconfig.nico-legacy.json';
  if (exists(root, legacy)) {
    const config = JSON.parse(read(root, legacy));
    for (const source of config.files || []) {
      if (typeof source !== 'string' || !/^nico-src\/[A-Za-z][A-Za-z0-9]*\.ts$/.test(source)) {
        throw Error('INVALID_NICO_LEGACY_ENTRY');
      }
      paths.add(STAGE + '/.generated/nico/' + path.basename(source, '.ts') + '.js');
    }
  }

  const scui = STAGE + '/scui-runtime-manifest.json';
  if (exists(root, scui)) {
    const records = JSON.parse(read(root, scui));
    // A shortened manifest must not silently drop baseline source/output requirements.
    // Later feature branches may register additional modules without removing these ten.
    for (const name of coreScuiNames) {
      paths.add(STAGE + '/.generated/scui/' + name + '.js');
      if (!Object.prototype.hasOwnProperty.call(records, name)) {
        stale.push('SCUI_REQUIRED_MANIFEST_MISSING: ' + name);
      }
    }
    for (const [name, info] of Object.entries(records)) {
      if (!safeScuiName(name)) throw Error('INVALID_SCUI_MANIFEST_NAME');
      const source = STAGE + '/nico-src/' + name + '.ts';
      if (info.source !== source || !/^[a-f0-9]{64}$/.test(info.sourceSha256 || '')) {
        throw Error('INVALID_SCUI_SOURCE_MANIFEST: ' + name);
      }
      paths.add(STAGE + '/.generated/scui/' + name + '.js');
      if (!exists(root, source) || sha(read(root, source)) !== info.sourceSha256) {
        stale.push('SCUI_SOURCE_MANIFEST_STALE: ' + name);
      }
    }
  }

  // P12 only exists in later local feature work, not in this remote develop.
  // Do not make the current remote root require an uncommitted project.
  const p12 = STAGE + '/p12-src';
  if (exists(root, p12)) {
    const walk = (directory, relative = '') => {
      for (const ent of fs.readdirSync(directory, {withFileTypes: true})) {
        if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(ent.name)) throw Error('INVALID_P12_ENTRY');
        const local = relative ? relative + '/' + ent.name : ent.name;
        if (ent.isDirectory()) walk(path.join(directory, ent.name), local);
        else if (ent.isFile() && local.endsWith('.ts') && !local.endsWith('.d.ts')) {
          paths.add(STAGE + '/.generated/p12/' + local.slice(0, -3) + '.js');
        }
      }
    };
    walk(abs(root, p12));
  }
  return {required: [...paths].sort(), stale: stale.sort()};
}

function inspect(root) {
  const p = plan(root), missing = [], invalid = [];
  for (const file of p.required) {
    let stat;
    try {
      stat = fs.lstatSync(abs(root, file));
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      missing.push(file);
      continue;
    }
    // An empty file, directory, or symlink is not a usable compiled JavaScript output.
    if (!stat.isFile() || stat.size === 0) invalid.push(file);
  }
  return {...p, missing, invalid};
}

function main() {
  const root = path.resolve(__dirname, '..');
  const {required, missing, invalid, stale} = inspect(root);
  if (missing.length || invalid.length || stale.length) {
    console.error('ROOT_TEST_GENERATED_PREFLIGHT=BLOCKED missing=' + missing.length +
      ' invalid=' + invalid.length + ' sourceManifestStale=' + stale.length);
    for (const file of [...missing.map(v => 'MISSING: ' + v),
      ...invalid.map(v => 'INVALID: ' + v), ...stale].slice(0, 16)) {
      console.error(file);
    }
    console.error('Check source ownership/locks, then use only approved canonical generation.');
    process.exitCode = 1;
  } else {
    console.log('ROOT_TEST_GENERATED_PREFLIGHT=PRESENT count=' + required.length +
      ' (compiler provenance and runtime freshness NOT verified)');
  }
}
if (require.main === module) main();
module.exports = {plan, inspect, sha};

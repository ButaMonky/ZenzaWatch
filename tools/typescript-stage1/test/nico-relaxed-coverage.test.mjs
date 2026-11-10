// TS-P0-01 (#185): prevent quiet growth of the relaxed TypeScript lane.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '../..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const strict = read('tsconfig.nico.json');
const relaxed = read('tsconfig.nico-legacy.json');
const expected = [
  'CapTubeEntry', 'CommentPanel', 'GamePadEntry',
  'MaskedWatchEntry', 'NicoVideoPlayer', 'NicoVideoPlayerDialog',
  'ScreenFilter', 'StoryboardWorker', 'SupporterCredit', 'VideoInfoPanel'
].map(name => 'nico-src/' + name + '.ts');
const sort = items => [...items].sort();

describe('TS-P0-01 legacy TypeScript strict boundary baseline', () => {
  it('keeps the relaxed source allowlist explicit and in sync with strict exclusions', () => {
    assert.equal(strict.compilerOptions.strict, true);
    assert.equal(strict.compilerOptions.noUncheckedIndexedAccess, true);
    assert.equal(strict.compilerOptions.exactOptionalPropertyTypes, true);
    assert.deepEqual(sort(strict.exclude), sort(expected));
    assert.deepEqual(sort(relaxed.files), sort(expected));
    assert.equal(new Set(relaxed.files).size, 10);
    assert.equal(relaxed.compilerOptions.strictNullChecks, false);
    assert.equal(relaxed.compilerOptions.noUncheckedIndexedAccess, false);
  });
  it('keeps the 10 remaining relaxed TypeScript sources mapped to tracked runtime manifests', () => {
    for (const rel of expected) {
      const name = path.basename(rel, '.ts');
      const manifest = read('nico-api-manifests/' + name + '.json');
      assert.equal(manifest.source, 'tools/typescript-stage1/' + rel);
      assert.equal(manifest.schemaVersion, 1);
      assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
      assert.match(manifest.runtimeSha256, /^[a-f0-9]{64}$/);
      assert(fs.statSync(path.join(root, rel)).isFile());
      assert(fs.statSync(path.join(repoRoot, manifest.runtime)).isFile());
    }
  });
});

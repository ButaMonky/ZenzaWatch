import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkEmittedProvenance} from '../scripts/check-emitted-provenance.mjs';

// Real TypeScript 7 native compiler, but all fixture writes are isolated in an
// OS temp directory. The inspection helper itself never writes repo files.
const compiler = resolve(dirname(fileURLToPath(import.meta.url)),
  '../node_modules/typescript/lib/tsc.js');
function scratch(t) {
  const root = fs.mkdtempSync(join(os.tmpdir(), 'zw-emission-proof-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const write = (relative, content) => {
    const file = join(root, relative);
    fs.mkdirSync(dirname(file), {recursive: true});
    fs.writeFileSync(file, content);
  };
  const config = (profile, files, {target='ES2022'}={}) => {
    write(profile, JSON.stringify({
      compilerOptions: {
        target, module:'ES2022', moduleResolution:'Bundler', types: [],
        rootDir:'nico-src',
        outDir:profile==='tsconfig.scui.json'?
          '.generated/scui':'.generated/nico',
        declaration:false, noEmitOnError:true
      },
      files
    }));
  };
  const emit = profile => {
    execFileSync(process.execPath, [compiler, '--project', join(root, profile)], {
      cwd:root, encoding:'utf8', timeout:30000, windowsHide:true,
      stdio:['ignore','pipe','pipe']
    });
  };
  return {root, write, config, emit};
}

test('valid output compares exactly without changing its bytes', t => {
  const v = scratch(t);
  v.write('nico-src/TestAlpha.ts', 'export const value: number = 1;\n');
  v.config('tsconfig.nico.json', ['nico-src/TestAlpha.ts']);
  v.emit('tsconfig.nico.json');
  const file = join(v.root, '.generated/nico/TestAlpha.js');
  const before = fs.readFileSync(file, 'utf8');
  assert.equal(checkEmittedProvenance(v.root,
    ['tsconfig.nico.json']).checkedPaths, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('stale-but-present JS is caught independently of manifests', t => {
  const v = scratch(t);
  v.write('nico-src/TestAlpha.ts', 'export const value: number = 1;\n');
  v.config('tsconfig.nico.json', ['nico-src/TestAlpha.ts']);
  v.emit('tsconfig.nico.json');
  v.write('nico-src/TestAlpha.ts', 'export const value: number = 2;\n');
  assert.throws(() => checkEmittedProvenance(v.root,
    ['tsconfig.nico.json']), /EMIT_PROVENANCE_JS_STALE/);
});

test('missing generated output is rejected', t => {
  const v = scratch(t);
  v.write('nico-src/TestAlpha.ts', 'export const value = 3;\n');
  v.config('tsconfig.nico.json', ['nico-src/TestAlpha.ts']);
  assert.throws(() => checkEmittedProvenance(v.root,
    ['tsconfig.nico.json']), /EMIT_PROVENANCE_JS_MISSING/);
});

test('legacy-only outputs must match a separate second compilation', t => {
  const v = scratch(t);
  v.write('nico-src/TestAlpha.ts', 'export const value = 1;\n');
  v.write('nico-src/LegacyOnly.ts', 'export const legacy = 2;\n');
  v.config('tsconfig.nico.json', ['nico-src/TestAlpha.ts']);
  v.config('tsconfig.nico-legacy.json', ['nico-src/LegacyOnly.ts']);
  v.emit('tsconfig.nico.json');
  v.emit('tsconfig.nico-legacy.json');
  assert.equal(checkEmittedProvenance(v.root,
    ['tsconfig.nico.json','tsconfig.nico-legacy.json']).checkedPaths, 2);
  fs.unlinkSync(join(v.root, '.generated/nico/LegacyOnly.js'));
  assert.throws(() => checkEmittedProvenance(v.root,
    ['tsconfig.nico.json','tsconfig.nico-legacy.json']), /LegacyOnly\.js/);
});

test('changing the compiler target makes older emitted JS invalid', t => {
  const v = scratch(t);
  v.write('nico-src/TestAlpha.ts',
    'export const nested = (value: {x?:{y:number}}) => value.x?.y ?? 0;\n');
  v.config('tsconfig.nico.json', ['nico-src/TestAlpha.ts']);
  v.emit('tsconfig.nico.json');
  v.config('tsconfig.nico.json', ['nico-src/TestAlpha.ts'], {target:'ES2015'});
  assert.throws(() => checkEmittedProvenance(v.root,
    ['tsconfig.nico.json']), /EMIT_PROVENANCE_JS_STALE/);
});

test('SCUI outputs use a separate real-compiler output directory', t => {
  const v = scratch(t);
  v.write('nico-src/SceneAudit.ts', 'export class SceneAudit { value=1; }\n');
  v.config('tsconfig.scui.json', ['nico-src/SceneAudit.ts']);
  v.emit('tsconfig.scui.json');
  assert.equal(checkEmittedProvenance(v.root,
    ['tsconfig.scui.json']).checkedPaths, 1);
  v.write('.generated/scui/SceneAudit.js', 'export class SceneAudit {}\n');
  assert.throws(() => checkEmittedProvenance(v.root,
    ['tsconfig.scui.json']), /EMIT_PROVENANCE_JS_STALE/);
});

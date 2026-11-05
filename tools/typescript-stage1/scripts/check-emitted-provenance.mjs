// #126: Re-emit TypeScript 7 into a disposable OS temp directory and compare
// with ignored Nico and SCUI JavaScript. No tracked source, runtime, dist, or
// deploy destination is ever written. Root "pretest" stays strictly read-only.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const STAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMPILER = resolve(STAGE, 'node_modules/typescript/lib/tsc.js');
const VERSION_FILE = resolve(STAGE, 'node_modules/typescript/package.json');
const LF = text => text.replace(/\r\n/g, '\n');
export const DEFAULT_PROFILES = Object.freeze([
  'tsconfig.nico.json', 'tsconfig.nico-legacy.json', 'tsconfig.scui.json'
]);

function walkJs(directory, prefix = '') {
  const found = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (!/^[A-Za-z0-9_.-]+$/.test(entry.name)) throw Error('EMIT_PROVENANCE_FILENAME_INVALID');
    const name = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) found.push(...walkJs(join(directory, entry.name), name));
    else if (entry.isFile() && name.endsWith('.js')) found.push(name);
    else if (entry.isSymbolicLink()) throw Error('EMIT_PROVENANCE_SYMLINK_OUTPUT');
  }
  return found;
}

/** CLI equivalence proof. Only the disposable temp tree receives compiler output. */
export function checkEmittedProvenance(root = STAGE, profiles = DEFAULT_PROFILES) {
  if (!Array.isArray(profiles) || !profiles.length ||
      new Set(profiles).size !== profiles.length ||
      profiles.some(name => !DEFAULT_PROFILES.includes(name))) {
    throw Error('EMIT_PROVENANCE_PROFILES_INVALID');
  }
  if (!existsSync(COMPILER)) throw Error('EMIT_PROVENANCE_COMPILER_MISSING');
  const rootDir = resolve(root);
  const scratch = mkdtempSync(join(tmpdir(), 'zw-tsgo-emission-'));
  const verified = new Set();
  let examined = 0;
  try {
    for (const filename of profiles) {
      const config = resolve(rootDir, filename);
      if (!existsSync(config)) throw Error('EMIT_PROVENANCE_CONFIG_MISSING: ' + filename);
      const dest = join(scratch, filename.replace(/[^A-Za-z0-9_-]/g, '_'));
      try {
        // Native TS7 "tsc" is invoked unchanged; its emitted JS/.d.ts outputs
        // are redirected from the ignored .generated tree to the OS temp dir.
        execFileSync(process.execPath, [COMPILER, '--project', config,
          '--outDir', dest], {
          cwd: rootDir, encoding: 'utf8', timeout: 120000,
          maxBuffer: 1024 * 1024, windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch {
        // Do not expose local file paths, TS diagnostics, or untrusted text.
        throw Error('EMIT_PROVENANCE_COMPILER_FAILED: ' + filename);
      }
      if (!existsSync(dest)) throw Error('EMIT_PROVENANCE_NO_EMIT: ' + filename);
      const files = walkJs(dest);
      if (!files.length) throw Error('EMIT_PROVENANCE_NO_JS: ' + filename);
      const target = filename === 'tsconfig.scui.json' ?
        '.generated/scui' : '.generated/nico';
      for (const file of files) {
        // Validate relative path before joining to the checked-in output dir.
        if (file.split('/').some(part => part === '..' || part === '.')) {
          throw Error('EMIT_PROVENANCE_INVALID_RELATIVE_PATH');
        }
        const actual = resolve(rootDir, target, ...file.split('/'));
        const regenerated = resolve(dest, ...file.split('/'));
        const display = target + '/' + file;
        if (!existsSync(actual) || !statSync(actual).isFile()) {
          throw Error('EMIT_PROVENANCE_JS_MISSING: ' + display);
        }
        if (LF(readFileSync(actual, 'utf8')) !==
            LF(readFileSync(regenerated, 'utf8'))) {
          throw Error('EMIT_PROVENANCE_JS_STALE: ' + display);
        }
        verified.add(display);
        examined++;
      }
    }
    return {
      checkedPaths: verified.size, checkedProfileOutputs: examined,
      compilerVersion: JSON.parse(readFileSync(VERSION_FILE, 'utf8')).version,
      profiles: [...profiles]
    };
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw Error('EMIT_PROVENANCE_ARGS_INVALID');
    const result = checkEmittedProvenance();
    console.log('EMIT_PROVENANCE=PASS JS=' + result.checkedPaths +
      ' profiles=' + result.profiles.length + ' compiler=' + result.compilerVersion +
      ' (native TS output compared in disposable temp; no repo writes)');
  } catch (error) {
    // Never print source text, credentials or raw compiler diagnostics.
    console.error('EMIT_PROVENANCE=BLOCKED ' +
      String(error?.message || 'UNKNOWN').replace(/[^\w:./ -]/g, '').slice(0, 220));
    process.exitCode = 1;
  }
}

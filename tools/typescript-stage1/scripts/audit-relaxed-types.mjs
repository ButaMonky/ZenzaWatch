// Task TS-P0-01 (#185): read-only repository strict-mode diagnostics.
// TypeScript 7 does not necessarily export the old JavaScript compiler API.
// Invoke the pinned tsc executable and write only a disposable OS-temp config.
// Expected strict diagnostics are advisory; bad configuration fails CI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const posix = value => value.replaceAll('\\', '/');
const strict = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.nico.json'), 'utf8'));
const relaxed = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.nico-legacy.json'), 'utf8'));
const excluded = strict.exclude || [];
const relaxedFiles = relaxed.files || [];
const sort = values => [...values].sort();
if (JSON.stringify(sort(excluded)) !== JSON.stringify(sort(relaxedFiles)) ||
    new Set(relaxedFiles).size !== relaxedFiles.length) {
  throw Error('NICO_RELAXED_CONFIG_MISMATCH');
}
if (relaxedFiles.length !== 11) {
  throw Error('NICO_RELAXED_BASELINE_CHANGED: review Issue #185/#205 strict promotion');
}
for (const rel of relaxedFiles) {
  if (!/^nico-src\/[A-Za-z0-9_]+\.ts$/.test(rel) ||
      !fs.statSync(path.join(root, rel), {throwIfNoEntry: false})?.isFile()) {
    throw Error('NICO_RELAXED_SOURCE_INVALID: ' + rel);
  }
}
const compiler = path.join(root, 'node_modules', '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
if (!fs.existsSync(compiler)) throw Error('NICO_TSC_NOT_INSTALLED');

// An isolated temporary child config inherits the *actual* strict Nico options.
// Include the complete Nico source set instead of the shipping exclusion list.
// No repository file, generated JavaScript, manifest or distribution is changed.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-ts185-'));
let run;
try {
  const configFile = path.join(tmp, 'tsconfig.json');
  fs.writeFileSync(configFile, JSON.stringify({
    extends: path.join(root, 'tsconfig.nico.json'),
    compilerOptions: {noEmit: true},
    include: [posix(path.join(root, 'nico-src', '**', '*.ts'))],
    exclude: []
  }, null, 2), 'utf8');
  run = spawnSync(compiler, ['--project', configFile, '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32'
  });
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}
if (run.error) throw run.error;
if (run.signal || ![0, 1, 2].includes(run.status)) {
  throw Error('NICO_STRICT_COMPILER_FAILED: status=' + run.status);
}
const output = [run.stdout, run.stderr].filter(Boolean).join('\n');
const matches = [...output.matchAll(/^(.+?)\((\d+),(\d+)\): error TS(\d+):/gm)];
if (run.status !== 0 && matches.length === 0) {
  throw Error('NICO_STRICT_COMPILER_OUTPUT_UNRECOGNIZED: ' + output.slice(0, 500));
}
const byFile = new Map();
const elsewhere = [];
for (const m of matches) {
  const file = posix(m[1]).replace(posix(root) + '/', '');
  const code = Number(m[4]);
  if (!relaxedFiles.includes(file)) {
    elsewhere.push({file, code});
    continue;
  }
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(code);
}
const rows = relaxedFiles.map(file => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const codes = byFile.get(file) || [];
  const counts = new Map();
  for (const code of codes) counts.set(code, (counts.get(code) || 0) + 1);
  return {
    file,
    bytes: Buffer.byteLength(source, 'utf8'),
    looseTokenCount: (source.match(/\bLoose\b/g) || []).length,
    diagnosticCount: codes.length,
    codes: [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 6).map(([code, count]) => ({code: 'TS' + code, count}))
  };
});
// Optional strict-diagnostic locations for reviewing staged migration PRs.
// Only relative code paths, coordinates and diagnostic codes are exposed.
// Messages and source lines are deliberately omitted.
const showDetails = process.argv.slice(2).includes('--details');
if (process.argv.slice(2).some(arg => arg !== '--details')) {
  throw Error('NICO_STRICT_AUDIT_OPTION_INVALID');
}
const details = matches.map(m => ({
  file: posix(m[1]).replace(posix(root) + '/', ''),
  line: Number(m[2]),
  column: Number(m[3]),
  code: 'TS' + m[4]
}));
const report = {
  kind: 'TS-P0-01 advisory strict-mode audit',
  note: 'Diagnostic failures do not fail CI; project files are read-only.',
  compilerExitCode: run.status,
  relaxedFileCount: relaxedFiles.length,
  relaxedTotalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
  strictErrorsInRelaxedFiles: rows.reduce((sum, row) => sum + row.diagnosticCount, 0),
  otherStrictErrors: elsewhere.length,
  rows,
  ...(showDetails ? {details} : {})
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

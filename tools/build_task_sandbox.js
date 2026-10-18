'use strict';
// Task 094: build active userscripts in a disposable sandbox.
// Only explicitly allowed dist files may differ from HEAD, and only those files are copied back.

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const {
  createBuildSandbox,
  runBuild,
  removeDir
} = require('../test/helpers/buildSandbox');

const repo = path.resolve(__dirname, '..');

function normalizeBuildId(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n')
    .filter(line => !/^\/\/ build: /.test(line) && !/^\s*(?:var|const|let) BUILD\s*=/.test(line))
    .join('\n');
}

function parseArgs(argv) {
  const copy = [];
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--copy') {
      if (!argv[i + 1]) { throw new Error('--copy requires a dist file'); }
      copy.push(path.basename(argv[++i]));
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error('unknown argument: ' + arg);
    }
  }
  return {copy: [...new Set(copy)], dryRun};
}

function gitShow(rel) {
  const bundledGit = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe');
  const git = fs.existsSync(bundledGit) ? bundledGit : 'git';
  const r = spawnSync(git, ['show', 'HEAD:' + rel], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (r.status !== 0) {
    throw new Error('git show failed: ' + rel + '\n' + (r.stderr || ''));
  }
  return r.stdout;
}

function run(argv = process.argv.slice(2)) {
  const {copy, dryRun} = parseArgs(argv);
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'dist-manifest.json'), 'utf8'));
  const active = manifest.active.files.map(x => path.basename(x.file));
  const activeSet = new Set(active);

  for (const file of copy) {
    if (!activeSet.has(file)) {
      throw new Error('--copy target is not an active dist: ' + file);
    }
  }

  const allowed = new Set(copy);
  const dir = createBuildSandbox('zenza-task-build-');
  try {
    const built = runBuild(dir, ['--dev']);
    process.stdout.write(built.stdout || '');
    process.stderr.write(built.stderr || '');
    if (built.status !== 0) {
      console.error('TASK_SANDBOX_BUILD_RESULT=NG build_exit=' + built.status);
      return built.status || 1;
    }

    const changed = [];
    for (const file of active) {
      const generated = fs.readFileSync(path.join(dir, 'dist', file), 'utf8');
      const baseline = gitShow('dist/' + file);
      if (normalizeBuildId(generated) !== normalizeBuildId(baseline)) {
        changed.push(file);
      }
    }

    const unexpected = changed.filter(file => !allowed.has(file));
    const missing = copy.filter(file => !changed.includes(file));
    console.log('TASK_SANDBOX_CHANGED_DISTS=' + changed.join(','));
    if (unexpected.length || missing.length) {
      console.error('TASK_SANDBOX_BUILD_RESULT=NG');
      if (unexpected.length) console.error('unexpected=' + unexpected.join(','));
      if (missing.length) console.error('missing=' + missing.join(','));
      return 2;
    }

    const copied = [];
    if (!dryRun) {
      for (const file of changed) {
        if (!allowed.has(file)) { continue; }
        fs.copyFileSync(
          path.join(dir, 'dist', file),
          path.join(repo, 'dist', file)
        );
        copied.push(file);
      }
    }
    console.log('TASK_SANDBOX_COPIED_DISTS=' + copied.join(','));
    console.log('TASK_SANDBOX_BUILD_RESULT=OK');
    return 0;
  } finally {
    removeDir(dir);
  }
}

if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (e) {
    console.error('TASK_SANDBOX_BUILD_RESULT=ERROR');
    console.error(e && e.stack ? e.stack : String(e));
    process.exitCode = 3;
  }
}

module.exports = {normalizeBuildId, parseArgs, run};

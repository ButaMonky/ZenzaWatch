var srcDir = './src';
var outFile = 'dist/ZenzaWatch.user.js';

// 配布元（Task 078）。以前は kphrx 版（playlist-deploy ブランチ）を指していたため、
// このフォークからインストールしても Tampermonkey の自動更新で kphrx 版に
// 上書きされてしまっていた。GitHub で公開しているこのフォーク
// （ButaMonky/ZenzaWatch の develop ブランチ）を指すように変更した。
// @name / @namespace は本家・kphrx 版と同じままにしている（同じスクリプトとして
// 上書きインストールされ、二重に動かないようにするため）。
const PUBLISH_REPO = 'https://github.com/ButaMonky/ZenzaWatch';
const PUBLISH_RAW_BASE = `${PUBLISH_REPO}/raw/develop/`;

// ビルド識別子（Task 039）。
// 当初は「@versionは手で上げない運用」だったが、2026-09-12にユーザーから
// 「更新のたびにバージョン表記もちゃんと変更してほしい」との明確な指示を受け、
// 以後は@version（_template.js/_setting.jsのUserScriptヘッダ）もタスクごとに
// 手で上げる運用に変更した（Task 055）。このBUILD_IDは、@versionの更新漏れが
// あっても「今どのビルドが入っているか」を必ず見分けられるようにするための
// 保険として引き続き付与する。ビルド日時（UTC・分まで）と、可能ならgitの
// 短いコミットハッシュを付ける。
var BUILD_ID = (() => {
  const t = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  let hash = '';
  try {
    hash = require('child_process')
      .execSync('git rev-parse --short HEAD', {stdio: ['ignore', 'pipe', 'ignore']})
      .toString().trim();
  } catch (e) { /* gitが無い環境でもビルドは通す */ }
  return hash ? `${t} ${hash}` : t;
})();
// 監視モード（--watch）で見るディレクトリ。ビルドの入力（src と packages/*/src）と一致させる。
// 以前は存在しない ./packages/navi/src が含まれていて、その監視登録の例外で後ろの
// lib・zenza が監視されていなかった（監査v2 ZW-009、Task 085 で削除）。
var watchDirs = [
  srcDir,
  './packages/components/src',
  './packages/lib/src',
  './packages/zenza/src',
  './packages/comment-history/src',
];
// 今回のビルドで読んだ入力ファイル（監視対象から漏れていないかの確認用。Task 085）
const BUILD_INPUTS = new Set();

var templates = [
  { src: '_template.js', dist: 'dist/ZenzaWatch.user.js',            dev: true  },
  { src: '_uquery.js',   dist: 'dist/uQuery.user.js',                dev: false },
  { src: '_pocket.js',   dist: 'dist/MylistPocket.user.js',          dev: false },
  { src: '_shape.js',    dist: 'dist/MaskedWatch.user.js',           dev: false },
  { src: '_setting.js',  dist: 'dist/ZenzaAdvancedSettings.user.js', dev: false },
  { src: '_hls.js',      dist: 'dist/ZenzaHLS.user.js',              dev: false },
  { src: '_gamepad.js',  dist: 'dist/ZenzaGamePad.user.js',          dev: false },
  { src: '_blog.js',     dist: 'dist/ZenzaBlogPartsButton.user.js',  dev: false },
  { src: '_captube.js',  dist: 'dist/CapTube.user.js',               dev: false },
  { src: '_heatsync.js', dist: 'dist/HeatSync.user.js',              dev: false },
  // { src: '_my4.js',      dist: 'dist/MylistFilter.user.js',          dev: false },
  // { src: '_navi.js',    dist: 'dist/Navi.user.js', dev: false },
  // { src: '_yomi.js',    dist: 'dist/Yomi.user.js', dev: false },
  // { src: '_vc.js',    dist: 'dist/VoiceControl.user.js', dev: false }
];

const DEV_HEADER = {
  '_template.js': {
    //name: '// @name           ZenzaWatch DEV版',
    name: '// @name           ZenzaWatch DEV版 fix playlist',
    description: '// @description    ZenzaWatchの開発 先行バージョン'
  },
  '_uquery.js': {},
  '_pocket.js': {},
  '_yomi.js': {},
  '_vc.js': {},
  '_shape.js': {},
  '_setting.js': {},
  '_hls.js': {},
  '_gamepad.js': {},
  '_blog.js': {},
  '_captube.js': {},
  '_my4.js': {},
  '_heatsync': {},
};

let REQMAP = {};

const throttle = (func, interval) => {
  let lastTime = 0;
  let lastArgs = null;
  let timer;
  const result = (...args) => {
    const now = Date.now();
    const timeDiff = now - lastTime;

    if (timeDiff < interval) {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          lastTime = Date.now();
          timer = null;
          func.apply(null, lastArgs);
          lastArgs = null;
        }, Math.max(interval - timeDiff, 0));
      }
      return;
    }

    if (timer) {
      timer = clearTimeout(timer);
    }
    lastTime = now;
    lastArgs = null;
    func(...args);
  };
  result.cancel = () => {
    if (timer) {
      timer = clearTimeout(timer);
    }
  };
  return result;
};


const debounce = (func, interval) => {
  let timer;
  const result = (...args) => {
    if (timer) {
      timer = clearTimeout(timer);
    }
    timer = setTimeout(() => func(...args), interval);
  };
  result.cancel = () => {
    if (timer) { timer = clearTimeout(timer); }
  };
  return result;
};

async function writeIfModified(file, newData, callback) {
  var fs = require('fs');
  return new Promise(res => setTimeout(res, Math.random() * 1000)).then(() => {
    var oldData = fs.readFileSync(file, 'utf-8');
    if (oldData === newData) {
      // callback('Not Modified', null);
      return;
    }

    fs.writeFileSync(file, newData);
    callback('OK', newData);
  }).catch(e => {
    console.log('Exception: ', e);
    fs.writeFileSync(file, newData);
    callback('OK', newData);
  });
}

async function notify(title, message, options = {timeout: 3, subtitle: undefined}) {
  // テストなどでデスクトップ通知を出したくない時は ZENZA_BUILD_NO_NOTIFY=1（Task 084）
  if (process.env.ZENZA_BUILD_NO_NOTIFY) { return; }
  const notifier = require('node-notifier');
  let {timeout, subtitle} = options;
  notifier.notify({title, message, timeout, subtitle});
}

function requireFile(srcDir, file, params, parent = '') {
  var fs = require('fs');
  var path = require('path');
  var lines = [];
  var begin = false;
  var isComment = false;
  var trim = false; //!params.dev && !/NicoTextParser\.js/.test(file);
  var srcFile = path.join(srcDir, file);
  var ignore = false;
  const imports = {};
  const fullpath = path.resolve(srcFile);
  if (REQMAP[fullpath]) {
    REQMAP[fullpath].push(parent);
    console.warn('***WARN***\n"%s" has already required\n in\n %s', fullpath, REQMAP[fullpath].join('\n '));
    // notify('already required', srcFile, parent);
    return `// already required`;
  }
  REQMAP[fullpath] = REQMAP[fullpath] || [];
  REQMAP[fullpath].push(parent || 1);
  BUILD_INPUTS.add(fullpath);
  try {
    fs.statSync(srcFile);
  } catch (e) {
    console.error('*** Error: %s\n\t   "%s"', e.message || e, srcFile);
    console.log(` required by "${parent}"`);
    // 以前は「fild not exist ...」という JavaScript でない文字列を生成物に埋め込んで
    // ビルドを続け、終了コード0で「成功」していた（監査v2 ZW-002）。
    // 入力が欠けたら例外にしてビルド全体を失敗させ、dist は書き換えない（Task 084）。
    throw new Error(`入力ファイルがありません: "${srcFile}"（required by "${parent}"）`);
  }
  fs.readFileSync(srcFile, 'utf-8').split('\n').some(function(line) {
    let lt = line.trim();
    if (!begin && line.trim().match(/^import\s+\{?(.+)\}?\s+from\s+['"](.+)['"]/)) {
      const [$1, $2] = [RegExp.$1, RegExp.$2];
      const modules = $1.split(/[\s,]+/).map(m => m.replace(/[{}*]/g, '').trim()).filter(m => m);
      const modulePath = $2.replace(/\.js$/, '') + '.js';
      modules.forEach(m => imports[m] = modulePath);
    }

    if (lt.startsWith('//@ignore-disable')) {
      ignore = false;
      return;
    } else if (ignore) {
      return;
    } else if (lt.startsWith('//@ignore-enable')) {
      ignore = true;
      return;
    }

    if (lt.match(/\/\/=+BEGIN=+/)) {
      begin = true;
      return;
    }

    lt = lt.replace(/\/\*\*(.*)\*\//g, '');
    if (!isComment && lt.match(/\/\*\*/)) {
      isComment = true;
      // console.log(file, '>', lt);
      lt = lt.replace(/\/\*\*.*/, '');
    } else if (isComment && lt.match(/\*\//)) {
      isComment = false;
      // console.log(file, '>', lt);
      lt = lt.replace(/^.*\*\//, '');
    } else if (isComment) {
      // console.log(file, '>', lt);
      return;
    }
    if (lt.startsWith('//') && !lt.match(/\/\/\s*[@=]/)) {
      return;
    }

    if (begin) {
      if (lt.match(/\/\/=+END=+/)) {
        return true;
      }

      if ((params.dev && line.match(/^\s*\/\/@dev-require (.+)$/)) ||
          line.match(/^\s*\/\/@require (.+)$/)) {
        const m = (RegExp.$1 || '').trim()
        var f = path.join(path.dirname(srcFile), imports[m] || m);
        // imports[m] ? console.log('import ' + f) : console.log('require ' + f);
        lines.push(requireFile(path.dirname(f), path.basename(f), params, path.resolve(srcFile)));
        return;
      }

      // if (!trim) {
      //   lines.push(line);
      //   return;
      // }
      if (lt.length === 0) { return; }
      if (trim) {
        lines.push(line.replace(/^[\s]+/g, '').replace(/([ ]+)/g, ' ')
        );
      } else {
        lines.push(line.replace(/^([\s+]+)/, g => '\t'.repeat(g.length / 2)));
      }
    }
  });

  return lines.join('\n');
}

function deploy(srcFile) {
  var path = require('path');
  var fs   = require('fs');
  if (!fs.existsSync('setting.json')) {
    console.log('setting.json not exist');
    return;
  }

  var setting = JSON.parse(fs.readFileSync('setting.json', 'utf-8'));
  setting.deployTo.some(function(dir) {
    // console.log('deploy To: ', dir);
    if (!fs.existsSync(dir)) {
      // console.log('path not exist: ', dir);
      return;
    }
    var destFile = dir.replace(/\/+$/, '') + '/' + path.basename(srcFile);
    // console.log('deploy file: ', destFile);

    // fs.createReadStream(srcFile).pipe(fs.createWriteStream(destFile));
    writeIfModified(destFile, fs.readFileSync(srcFile, 'utf-8'), function(err, newData) {
      // console.log(err);
    })
  });
}


function loadTemplateFile(srcDir, indexFile, outFile, params) {
  var fs = require('fs');
  var path = require('path');
  var lines = [];
  var ver = null;
  const imports = {};
  const srcFile = path.join(srcDir, indexFile);
  BUILD_INPUTS.add(path.resolve(srcFile));

  fs.readFileSync(srcFile, 'utf-8').split('\n').some(function(line) {
    if (line.trim().match(/^import\s+\{?(.+)\}?\s+from\s+['"](.+)['"]/)) {
      const [$1, $2] = [RegExp.$1, RegExp.$2];
      const modules = $1.split(/[\s,]+/).map(m => m.replace(/[{}*]/g, '').trim()).filter(m => m);
      const modulePath = $2.replace(/\.js$/, '') + '.js';
      modules.forEach(m => imports[m] = modulePath);
      return;
    }
    if (params.dev) {
      if (line.match(/^\/\/\s*@([a-z0-9+]+)(.*)$/)) {
        let name = RegExp.$1;
        // console.log('header:', indexFile, name, RegExp.$2);
        if (DEV_HEADER[indexFile][name]) {
          line = DEV_HEADER[indexFile][name].trim();
        }
      }
    }
    if (line.match(/\/\/ *==\/UserScript==/)) {
      lines.push(`// @homepageURL    ${PUBLISH_REPO}`);
      lines.push(`// @supportURL     ${PUBLISH_REPO}/issues`);
      lines.push(`// @downloadURL    ${PUBLISH_RAW_BASE}${outFile}`);
      // meta.js（UserScriptブロックだけのファイル）は用意していないので、更新確認も本体を見る（Task 078）
      lines.push(`// @updateURL      ${PUBLISH_RAW_BASE}${outFile}`);
      lines.push(line);
      // ビルド識別子。@versionは手で上げない運用のため、どのビルドが
      // インストールされているかを見分ける手段が無かった。ここと
      // コンソール起動ログの両方に出す（Task 039）。
      lines.push(`// build: ${BUILD_ID}`);
      lines.push('/* eslint-disable */');
      return;
    }
    if (line.match(/^(\s*)\/\/\s*@build$/)) {
      lines.push(`${RegExp.$1}var BUILD = '${BUILD_ID}';`);
      return;
    }
    if (line.match(/^(\s*)\/\/\s*@environment$/)) {
      lines.push(`${RegExp.$1}const ENV = '${params.dev ? 'DEV' : 'STABLE'}';\n`);
      return;
    }
    if (line.match(/^(\s*)\/\/\s*@version(.*)$/)) {
      if (!ver) {
        ver = RegExp.$2.trim();
        console.log('ver: ' + ver);
        lines.push(line);
      } else {
        lines.push(RegExp.$1 + 'var VER = \'' + ver + '\';');
      }
      return;
    }
    if ((params.dev && line.match(/^\s*\/\/@dev-require (.+)$/)) ||
      line.match(/^\s*\/\/@require (.+)$/)) {
      const m = (RegExp.$1 || '').trim()
      var f = path.join(path.dirname(srcFile), imports[m] || m);
      // imports[m] ? console.log('import ' + f) : console.log('require ' + f);
      lines.push(requireFile(path.dirname(f), path.basename(f), params, path.resolve(srcFile)));
      return;
    }
    lines.push(line);
  });

  // ここでは書き込まない。全配布物の生成と構文検査が済んでから commitOutputs() が
  // まとめて書き込む（1つでも失敗したら dist を1つも書き換えないため。Task 084 / ZW-002）
  return {outFile, content: lines.join('\n')};
}

// 生成物が JavaScript として読めるか（@babel/parser、Task 037 以来の構文検査の方法）
function checkSyntax(outputs) {
  const errors = [];
  let parser;
  try {
    parser = require('@babel/parser');
  } catch (e) {
    // 検査できない状態を「問題なし」とは扱わない
    return [`構文検査用の @babel/parser を読み込めません（npm install が必要です）: ${e.message}`];
  }
  outputs.forEach(({outFile, content}) => {
    try {
      parser.parse(content, {sourceType: 'script'});
    } catch (e) {
      errors.push(`${outFile}: 生成物が JavaScript として不正です: ${e.message}`);
    }
  });
  return errors;
}

// 生成物を dist へ書き込む。先に全ての書き込み先を確認し、一時ファイルへ書いてから
// 置き換えるので、途中で失敗しても（まれな置き換え失敗を除き）古い dist が残る。
function commitOutputs(outputs) {
  const fs = require('fs');
  const changed = outputs.filter(({outFile, content}) => {
    try {
      return fs.readFileSync(outFile, 'utf-8') !== content;
    } catch (e) {
      return true; // まだ無い・読めない（書き込み可否は次で確かめる）
    }
  });
  for (const {outFile} of changed) {
    if (fs.existsSync(outFile)) {
      if (!fs.statSync(outFile).isFile()) {
        throw new Error(`${outFile}: 書き込み先がファイルではありません`);
      }
      fs.accessSync(outFile, fs.constants.W_OK);
    }
  }
  const temps = [];
  try {
    for (const {outFile, content} of changed) {
      const tmp = `${outFile}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, content);
      temps.push([tmp, outFile, content]);
    }
  } catch (e) {
    temps.forEach(([tmp]) => { try { fs.unlinkSync(tmp); } catch (_) { /* 後片付けのみ */ } });
    throw e;
  }
  for (const [tmp, outFile, content] of temps) {
    fs.renameSync(tmp, outFile);
    console.log(`\n>>>>>>update "${outFile}" (${content.split('\n').length} lines)`);
    deploy(outFile);
  }
}

// 失敗（入力欠損・構文不正・書き込み不可）があれば dist を書き換えず false を返し、
// 終了コードを1にする（Task 084 / 監査v2 ZW-002）
// Task200: refuse stale or edited bundles before writing any dist file.
function checkHistoryGeneration() {
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  const root = path.resolve('packages/comment-history/src');
  const generated = path.join(root, 'generated');
  const fail = file => { throw new Error('comment-history generated source is stale or missing: ' + file + '; run node packages/comment-history/tools/build-zenza.mjs'); };
  const sha = data => crypto.createHash('sha256').update(data).digest('hex');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(generated, 'MANIFEST.json'), 'utf8')); }
  catch (_) { fail('MANIFEST.json'); }
  const required = ['ZenzaCommentHistoryCore.generated.js', 'ZenzaCommentHistorySettings.generated.js', 'package.json'];
  if (!manifest || manifest.generatorVersion !== 2 || !Array.isArray(manifest.files) || manifest.files.length !== required.length) { fail('manifest schema'); }
  for (const name of required) {
    const entry = manifest.files.find(item => item && item.path === name);
    const file = path.join(generated, name);
    if (!entry || !fs.existsSync(file) || sha(fs.readFileSync(file)) !== entry.sha256) { fail(name); }
    BUILD_INPUTS.add(file);
    if (!name.endsWith('.js')) { continue; }
    const text = fs.readFileSync(file, 'utf8');
    const sources = Array.from(text.matchAll(/^\/\/ ([a-z][a-z0-9-]*\.mjs) sha256=([a-f0-9]{64})$/gm));
    if (!sources.length) { fail(name + ' input hashes'); }
    for (const [, source, expected] of sources) {
      const input = path.join(root, source);
      if (!fs.existsSync(input) || sha(fs.readFileSync(input)) !== expected) { fail(source); }
      BUILD_INPUTS.add(input);
    }
  }
}
function build(params) {
  var path = require('path');
  const outputs = [];
  const errors = [];
  try { checkHistoryGeneration(); } catch (error) { errors.push(error.message); }
  templates.forEach(template => {
    var _params = {...params};
    var templateFile = template.src;
    var outFile = template.dist;
    _params.dev = template.dev && params.dev;
    if (_params.dev && !/-dev\.user\.js$/.test(outFile)) {
      outFile = outFile.replace(/\.user\.js$/, '-dev.user.js');
    }
    console.log('\n>>>>>>build: %s', path.basename(outFile));
    REQMAP = {};
    try {
      outputs.push(loadTemplateFile(srcDir, templateFile, outFile, _params));
    } catch (e) {
      errors.push(`${outFile}: ${e.message || e}`);
    }
  });
  if (!errors.length) {
    errors.push(...checkSyntax(outputs));
  }
  if (!errors.length) {
    try {
      commitOutputs(outputs);
    } catch (e) {
      errors.push(`書き込みに失敗しました: ${e.message || e}`);
    }
  }
  if (errors.length) {
    console.error('\n*** BUILD FAILED（%d件）。dist は書き換えていません（書き込み中の失敗を除く）:', errors.length);
    errors.forEach(e => console.error('  - %s', e));
    notify('build error', errors.join('\n'));
    process.exitCode = 1;
    return false;
  }
  return true;
}
const _build = debounce(build, 1000);

function watch(srcDir, params) {
  var fs = require('fs');
  const onChange = async function(event, filename) {
    if (event === 'rename') { // Dropbox経由の更新など
      _build.cancel();
      await new Promise(res => setTimeout(res, Math.random() * 3000));
    }
    console.log('event: "%s", file: "%s"', event, filename);
    try {
      _build(params);
    } catch(e) {
      console.error('error: ', e);
      notify('build error', `${e.message}`);
    }
  };

  return fs.watch(srcDir, {recursive: true}, onChange);
}

// 監視を始める前に、監視対象がすべて存在し、ビルドの入力がすべて監視対象の中にあるかを確かめる。
// 一部だけ監視して動き続ける（変更しても再ビルドされないファイルがある）状態にはしない（Task 085 / ZW-009）。
function checkWatchTargets() {
  const fs = require('fs');
  const path = require('path');
  const errors = [];
  const roots = watchDirs.map(dir => path.resolve(dir));
  roots.forEach((root, i) => {
    let ok = false;
    try { ok = fs.statSync(root).isDirectory(); } catch (e) { /* 無い */ }
    if (!ok) { errors.push(`監視対象のディレクトリがありません: ${watchDirs[i]}`); }
  });
  const uncovered = Array.from(BUILD_INPUTS).filter(file =>
    !roots.some(root => {
      const rel = path.relative(root, file);
      return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    }));
  uncovered.slice(0, 20).forEach(file => errors.push(`監視対象の外にあるビルド入力: ${path.relative(process.cwd(), file)}`));
  return errors;
}

function run() {
  let params = {};
  process.argv.concat().splice(-2).forEach(v => {
    if (/^--(.+)$/.test(v)) {
      params[RegExp.$1] = 1;
    } else if (/^([a-z0-9]+)=(.*)$/.test(v)) {
      params[RegExp.$1] = RegExp.$2;
    }
  });

  console.log(params);
  const ok = build(params);
  if (!ok && !params.watch) {
    return;
  }
  if (params.watch) {
    const errors = checkWatchTargets();
    if (errors.length) {
      console.error('\n*** 監視モードを開始できません（一部だけの監視はしません）:');
      errors.forEach(e => console.error('  - %s', e));
      process.exitCode = 1;
      return;
    }
    const watchers = [];
    try {
      watchDirs.forEach(dir => { watchers.push(watch(dir, params)); });
    } catch (e) {
      watchers.forEach(w => { try { w.close(); } catch (_) { /* 後片付けのみ */ } });
      console.error('\n*** 監視を登録できませんでした: %s', e.message || e);
      process.exitCode = 1;
      return;
    }
    console.log('\n監視しています（%d か所）:', watchDirs.length);
    watchDirs.forEach(dir => console.log('  %s', dir));
    notify('watch start', new Date().toLocaleString());
  }
}

try {
  run();
} catch(e) {
  console.error('error', e);
  console.trace();
  notify('error', `${e.message || e}`);
  process.exitCode = 1; // 例外でも「成功」で終わらせない（Task 084 / ZW-002）
}



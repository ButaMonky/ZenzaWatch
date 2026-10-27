#!/usr/bin/env node
// Task960: semi-automatic converter from a legacy //===BEGIN=== module to canonical nico-src TS.
// Before Task960 this lived only in %TEMP% (Task788-902) and was lost; keep it in the repo.
//
//   node scripts/legacy-to-ts.mjs convert  <config.mjs>   fixtures + nico-src/*.ts
//   node scripts/legacy-to-ts.mjs register <config.mjs>   (after `npm run nico:emit`)
//                                                       registry entries + allowlists
//   node scripts/legacy-to-ts.mjs fix      <config.mjs>   (Task962) error-driven typing
//   node scripts/legacy-to-ts.mjs tokdiff  <old.js> <new.js>
// Task962: a module with `legacy: true` is checked by tsconfig.nico-legacy.json (noImplicitAny
// and the rest of `strict`, but no strictNullChecks / exactOptionalPropertyTypes /
// noUncheckedIndexedAccess). `cls: 'auto'` types every class in the body; `exp` defaults to
// the legacy file's own export statement after //===END===.
//
// The config (an ES module, default export) describes each module:
//   {task:'task960', modules:{Name:{runtime, cls, types, rep:[[from,to,count]], exp,
//    exportNames, fieldTypes}}, allowlist:[[from,to]]}
// `rep` entries are exact, counted replacements on the legacy body (ASCII anchors keep
// non-ASCII text byte-identical). Untyped method/constructor/setter params of `cls` get
// `Loose`, and every `this.x =` field gets `declare x: <fieldTypes[x] || Loose>;`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixFiles, GLOBALS_MARKER} from './legacy-to-ts-fix.mjs';
import {splitEntry, entryDirectives, entryTopLevel} from './sync-nico-api.mjs';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(STAGE, '..', '..');
const rel = p => path.relative(REPO, p).replace(/\\/g, '/');
const LOOSE = `/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
`;

const annotateParams = params => /[{[]|\/\*|\/\//.test(params) ? params : params.split(',').map(p => {
  const t = p.trim();
  if (!t) { return p; }
  const lead = p.match(/^\s*/)[0];
  if (t.startsWith('...')) { return /:/.test(t) ? p : `${lead}${t}: Loose[]`; }
  const eq = t.indexOf('=');
  const name = (eq > 0 ? t.slice(0, eq) : t).trim();
  if (/[:{[]/.test(name)) { return p; }
  if (eq > 0) { return `${lead}${name}: Loose = ${t.slice(eq + 1).trim()}`; }
  return `${lead}${name}?: Loose`;
}).join(',');

function autoTypeClass(body, className, fieldTypes = {}) {
  const lines = body.split('\n');
  const start = lines.findIndex(l => new RegExp(`^(\\s*)class ${className}\\b`).test(l));
  if (start < 0) { throw Error(`class ${className} not found`); }
  const classIndent = lines[start].match(/^\s*/)[0];
  const member = classIndent + '  ';
  let end = lines.findIndex((l, i) => i > start && l === `${classIndent}}`);
  if (end < 0) { end = lines.length; }
  const accessors = new Set(), methods = new Set(), fields = new Set();
  for (const l of lines.slice(start + 1, end)) {
    const a = l.match(/^\s+(?:static\s+|async\s+)?(get|set)\s+([A-Za-z_$][\w$]*)\(/);
    if (a) { accessors.add(a[2]); }
    const m = l.match(/^\s+(?:static\s+|async\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    if (m && !/^\s+(if|for|while|switch|catch|function|return)\b/.test(l)) { methods.add(m[1]); }
    for (const f of l.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) { fields.add(f[1]); }
  }
  const memberRx = new RegExp(`^(${member})((?:static\\s+|async\\s+)?(?:get |set )?\\*?\\s*[A-Za-z_$][\\w$]*)\\s*\\(([^)]*)\\)(\\s*\\{.*)$`);
  for (let i = start + 1; i < end; i++) {
    const l = lines[i];
    const m = l.match(memberRx);
    if (!m || /^\s+(if|for|while|switch|catch|return)\b/.test(l)) { continue; }
    let params = annotateParams(m[3]);
    // A set accessor parameter cannot be optional.
    if (/\bset /.test(m[2])) { params = params.replace(/\?: Loose/, ': Loose'); }
    lines[i] = `${m[1]}${m[2]}(${params})${m[4]}`;
  }
  const declares = [...fields].filter(f => !accessors.has(f) && !methods.has(f)).sort()
    .map(f => `${member}declare ${f}: ${fieldTypes[f] || 'Loose'};`);
  lines.splice(start + 1, 0, ...declares);
  return lines.join('\n');
}

function autoType(body, classNames, fieldTypes = {}) {
  const names = Array.isArray(classNames) ? classNames : (classNames ? [classNames] : []);
  for (const name of names) { body = autoTypeClass(body, name, fieldTypes[name] || fieldTypes); }
  return body;
}

const loadConfig = async file => (await import(pathToFileURL(path.resolve(file)).href)).default;
const prepFile = task => path.join(STAGE, '.generated', 'legacy-to-ts', `${task}.json`);

async function convert(configFile) {
  const cfg = await loadConfig(configFile);
  const Task = cfg.task.replace('task', 'Task');
  const prep = {};
  for (const [name, m] of Object.entries(cfg.modules)) {
    const fixture = path.join(STAGE, 'test', 'fixtures', `${name}.before-${cfg.task}.js`);
    if (!fs.existsSync(fixture)) { fs.copyFileSync(path.join(REPO, m.runtime), fixture); }
    const buf = fs.readFileSync(fixture);
    const src = buf.toString('utf8').replace(/\r\n/g, '\n');
    let preamble, body;
    const beginLines = [];
    if (m.entry) {
      // Task966: an entry script; the header and imports stay JS, the rest becomes TS.
      ({preamble, body} = splitEntry(src));
    } else {
      if (!src.includes('//===BEGIN===') || !src.includes('//===END===')) { throw Error(`${name}: markers missing`); }
      preamble = src.split('//===BEGIN===')[0].split('\n'); preamble.pop();
      body = src.split('//===BEGIN===')[1].split('//===END===')[0].replace(/^\n/, '');
      while (body.startsWith('//@require')) {
        const i = body.indexOf('\n'); beginLines.push(body.slice(0, i)); body = body.slice(i + 1);
      }
    }
    for (const [from, to, count] of m.rep || []) {
      const c = body.split(from).length - 1;
      if (c !== count) { throw Error(`${name}: expected ${count} of ${JSON.stringify(from)}, found ${c}`); }
      body = body.split(from).join(to);
    }
    // A regenerated file shows every old trailing blank as a new whitespace error; drop them
    // (inside template literals this only removes trailing spaces of CSS/HTML lines).
    body = body.replace(/[ \t]+$/gm, '');
    // tsc re-indents multi-line block comments and pads their empty lines with spaces, which
    // `git diff --check` reports; give such empty comment lines a visible marker instead.
    {
      const ls = body.split('\n');
      // Only real JS comments: never touch CSS/HTML comments inside template literals.
      let inComment = false, inTemplate = false, indent = '';
      for (let k = 0; k < ls.length; k++) {
        const l = ls[k];
        if (!inComment) {
          const startedInTemplate = inTemplate;
          for (let q = 0; q < l.length; q++) {
            if (l[q] === '\\') { q++; continue; }
            if (l[q] === '`') { inTemplate = !inTemplate; }
          }
          if (startedInTemplate || l.includes('`')) { continue; }
          const open = l.indexOf('/*');
          if (open >= 0 && l.indexOf('*/', open + 2) < 0 && !/['"]/.test(l.slice(0, open))) {
            inComment = true; indent = l.match(/^\s*/)[0];
          }
          continue;
        }
        if (l.includes('*/')) { inComment = false; continue; }
        if (l === '' && /^\s+$/.test(indent)) { ls[k] = `${indent}  .`; }
      }
      body = ls.join('\n');
    }
    const classes = m.cls === 'auto' ? [...body.matchAll(/^\s*class ([A-Za-z_$][\w$]*)\b/gm)].map(x => x[1]) : m.cls;
    body = autoType(body, classes, m.fieldTypes);
    const after = m.entry ? '' : (src.split('//===END===')[1] || '');
    const em = after.match(/export\s*\{[\s\S]*?\};?/);
    // An entry script exports nothing; `export {};` only makes the TS file a module.
    const exp = m.entry ? 'export {};' : (m.exp || (em ? em[0].replace(/;?$/, ';') : ''));
    if (!exp) { throw Error(`${name}: no export statement`); }
    m.exportNames = m.entry ? [] : (m.exportNames || exp.replace(/^export\s*\{|\};?$/g, '').split(',').map(x => x.trim()).filter(Boolean));
    const ts = `/**\n * Canonical TypeScript source for ${m.runtime} (${Task}).\n */\n` + LOOSE +
      GLOBALS_MARKER + '\n' + (m.types || '') + '\n' + body.replace(/\s+$/, '') + '\n\n' + exp + '\n';
    fs.writeFileSync(path.join(STAGE, 'nico-src', `${name}.ts`), ts);
    prep[name] = {runtime: m.runtime, sha: crypto.createHash('sha256').update(buf).digest('hex'),
      preamble, beginLines, exportNames: m.exportNames || [name], legacy: !!m.legacy,
      entry: !!m.entry, directives: m.entry ? entryDirectives(body) : []};
    console.log('LEGACY_TO_TS_CONVERTED', name, rel(fixture));
  }
  fs.mkdirSync(path.dirname(prepFile(cfg.task)), {recursive: true});
  fs.writeFileSync(prepFile(cfg.task), JSON.stringify(prep, null, 1));
}

function replaceOnce(text, from, to, what) {
  if (text.split(from).length !== 2) { throw Error(`${what}: anchor not unique: ${JSON.stringify(from).slice(0, 80)}`); }
  return text.replace(from, to);
}

async function register(configFile) {
  const cfg = await loadConfig(configFile);
  const Task = cfg.task.replace('task', 'Task');
  const prep = JSON.parse(fs.readFileSync(prepFile(cfg.task), 'utf8'));
  const legacy = Object.entries(prep).filter(([, o]) => o.legacy).map(([n]) => `nico-src/${n}.ts`);
  if (legacy.length) {
    const lp = path.join(STAGE, 'tsconfig.nico-legacy.json');
    const lc = JSON.parse(fs.readFileSync(lp, 'utf8'));
    lc.files = [...new Set([...(lc.files || []), ...legacy])].sort();
    fs.writeFileSync(lp, JSON.stringify(lc, null, 2) + '\n');
    const sp = path.join(STAGE, 'tsconfig.nico.json');
    const sc = JSON.parse(fs.readFileSync(sp, 'utf8'));
    sc.exclude = [...new Set([...(sc.exclude || []), ...legacy])].sort();
    fs.writeFileSync(sp, JSON.stringify(sc, null, 2) + '\n');
    console.log('LEGACY_TO_TS_LEGACY_TSCONFIG', legacy.join(' '));
  }
  if (legacy.length) {
    // emit the legacy-strictness modules so their top-level lines can be read below
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--project', 'tsconfig.nico-legacy.json'],
      {cwd: STAGE, shell: process.platform === 'win32', encoding: 'utf8'});
    if (r.status) { throw Error('legacy emit failed:\n' + (r.stdout || '') + (r.stderr || '')); }
  }
  const regPath = path.join(STAGE, 'scripts', 'nico-api-registry.mjs');
  let reg = fs.readFileSync(regPath, 'utf8');
  const entries = Object.entries(prep).map(([name, o]) => {
    if (reg.includes(`name:${JSON.stringify(name)}`) || reg.includes(`name:'${name}'`)) { throw Error(`${name}: already registered`); }
    const emitted = fs.readFileSync(path.join(STAGE, '.generated', 'nico', `${name}.js`), 'utf8');
    const top = emitted.split('\n').filter(l => /^\S/.test(l) && !l.startsWith('/**') && !l.startsWith('//') && !l.startsWith('export '));
    if (o.entry) {
      const top = entryTopLevel(emitted.replace(/\nexport \{\};\s*$/, ''));
      // the build directives of the untouched legacy body (code lines only)
      const fixture = fs.readFileSync(path.join(STAGE, 'test', 'fixtures', `${name}.before-${cfg.task}.js`), 'utf8');
      const directives = entryDirectives(splitEntry(fixture).body);
      console.log('LEGACY_TO_TS_TOPLEVEL', name, JSON.stringify(top));
      return ['  api({', `    name:${JSON.stringify(name)},`, `    runtime:${JSON.stringify(o.runtime)},`,
        `    originalSha256:${JSON.stringify(o.sha)},`, "    shape:'entry',", `    topLevel:${JSON.stringify(top)},`,
        `    directives:${JSON.stringify(directives)},`, `    task:'${cfg.task}'`, '  })'].join('\n');
    }
    const lines = ['  api({', `    name:${JSON.stringify(name)},`, `    runtime:${JSON.stringify(o.runtime)},`,
      `    originalSha256:${JSON.stringify(o.sha)},`, `    preamble:${JSON.stringify(o.preamble)},`];
    if (o.beginLines.length) { lines.push(`    beginLines:${JSON.stringify(o.beginLines)},`); }
    lines.push("    shape:'declarations',", `    topLevel:${JSON.stringify(top)},`,
      `    exportNames:${JSON.stringify(o.exportNames)},`, `    task:'${cfg.task}'`, '  })');
    console.log('LEGACY_TO_TS_TOPLEVEL', name, JSON.stringify(top));
    return lines.join('\n');
  });
  const end = '  })\n]);\nexport const NICO_API_BY_NAME';
  reg = replaceOnce(reg, end, `  }),\n  // ${Task}: ${cfg.title || 'legacy modules'} (dev build).\n${entries.join(',\n')}\n]);\nexport const NICO_API_BY_NAME`, 'registry end');
  const decl = /(const DECLARATION_MODULES=Object\.freeze\(\[[\s\S]*?)\]\);/;
  const m = reg.match(decl);
  if (!m) { throw Error('DECLARATION_MODULES not found'); }
  const declNames = Object.keys(prep).filter(n => !prep[n].entry);
  if (declNames.length) { reg = reg.replace(decl, `${m[1]},\n  ${declNames.map(n => `'${n}'`).join(',')}]);`); }
  fs.writeFileSync(regPath, reg);
  for (const f of ['tools/typescript-stage1/test/nico-api-task457.test.mjs', 'test/unit/NicoApiTypeScriptSourceSyncTest.js']) {
    const p = path.join(REPO, f);
    let t = fs.readFileSync(p, 'utf8');
    for (const [from, to] of cfg.allowlist || []) { t = replaceOnce(t, from, to, f); }
    fs.writeFileSync(p, t);
    console.log('LEGACY_TO_TS_ALLOWLIST', f);
  }
}

// Comment/whitespace-insensitive token diff, for checking that a conversion only changed
// what was intended (type syntax is erased, so the generated JS should differ only there).
// Small JS scanner: comments dropped; strings, template literals (with nested `${}`) and
// regular-expression literals kept as single tokens.
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^',
  'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', '=>', '&&', '||', '??']);
function tokens(text) {
  const src = text.includes('//===BEGIN===') ? text.split('//===BEGIN===')[1].split('//===END===')[0] : text;
  const out = [];
  let i = 0;
  const n = src.length;
  const readQuoted = (q) => {
    let j = i + 1;
    while (j < n && src[j] !== q) { if (src[j] === '\\') { j++; } j++; }
    return j + 1;
  };
  const readTemplate = () => {
    let j = i + 1, depth = 0;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (depth === 0 && c === '`') { return j + 1; }
      if (c === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
      if (depth > 0 && c === '}') { depth--; }
      else if (depth > 0 && c === '{') { depth++; }
      j++;
    }
    return n;
  };
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') { i++; } continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { const e = readQuoted(c); out.push(src.slice(i, e)); i = e; continue; }
    if (c === '`') { const e = readTemplate(); out.push(src.slice(i, e).replace(/\s+/g, ' ')); i = e; continue; }
    if (c === '/' && (out.length === 0 || REGEX_PREV.has(out[out.length - 1]))) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') { cls = true; } else if (src[j] === ']') { cls = false; } else if (src[j] === '/' && !cls) { break; }
        j++;
      }
      j++;
      while (j < n && /[a-z]/.test(src[j])) { j++; }
      out.push(src.slice(i, j)); i = j; continue;
    }
    const m = src.slice(i).match(/^(?:[A-Za-z_$][\w$]*|\d[\w.]*|=>|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\.\.\.|\S)/);
    out.push(m[0]); i += m[0].length;
  }
  return out;
}
function myersDiff(a, b) {
  const n = a.length, m = b.length, max = n + m, v = new Map([[1, 0]]), trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v.get(k - 1) < v.get(k + 1))) ? v.get(k + 1) : v.get(k - 1) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v.set(k, x);
      if (x >= n && y >= m) {
        const ops = [];
        for (let dd = d; dd > 0; dd--) {
          const vv = trace[dd], kk = x - y;
          const prevK = (kk === -dd || (kk !== dd && vv.get(kk - 1) < vv.get(kk + 1))) ? kk + 1 : kk - 1;
          const px = vv.get(prevK), py = px - prevK;
          while (x > px && y > py) { ops.push(['=', a[--x]]); y--; }
          if (x === px) { ops.push(['+', b[--y]]); } else { ops.push(['-', a[--x]]); }
        }
        while (x > 0) { ops.push(['=', a[--x]]); }
        return ops.reverse();
      }
    }
  }
  return [];
}
function tokdiff(oldFile, newFile) {
  const a = tokens(fs.readFileSync(oldFile, 'utf8')), b = tokens(fs.readFileSync(newFile, 'utf8'));
  const ops = myersDiff(a, b);
  const changed = ops.filter(o => o[0] !== '=').length;
  console.log(`${path.basename(newFile)}: legacy ${a.length} tokens, emitted ${b.length}, changed ${changed}`);
  let i = 0;
  while (i < ops.length) {
    if (ops[i][0] === '=') { i++; continue; }
    const ctx = ops.slice(Math.max(0, i - 3), i).map(o => o[1]).join(' ');
    const hunk = [];
    while (i < ops.length && ops[i][0] !== '=') { hunk.push(ops[i][0] + ops[i][1]); i++; }
    console.log(`   ...${ctx}  [ ${hunk.join(' ')} ]`);
  }
  return changed;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'convert') { await convert(args[0]); }
else if (cmd === 'register') { await register(args[0]); }
else if (cmd === 'tokdiff') { tokdiff(args[0], args[1]); }
else if (cmd === 'fix') {
  const cfg = await loadConfig(args[0]);
  const files = Object.keys(cfg.modules).filter(n => !args[1] || args[1].split(',').includes(n))
    .map(n => path.join(STAGE, 'nico-src', `${n}.ts`));
  const {errors} = fixFiles(STAGE, files, +(process.env.LEGACY_TO_TS_ROUNDS || 12));
  process.exitCode = errors.length ? 1 : 0;
}
else { console.error('usage: legacy-to-ts.mjs convert|fix|register <config.mjs> | tokdiff <old.js> <new.js>'); process.exit(2); }

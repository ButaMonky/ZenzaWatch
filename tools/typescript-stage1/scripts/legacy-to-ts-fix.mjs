// Task962: error-driven typing for large legacy modules converted by legacy-to-ts.mjs.
// Runs the legacy TypeScript config on the given nico-src files, then applies only
// type-level edits that tsc erases on emit (annotations, `declare` lines, `as Loose`
// casts and parentheses around a single arrow parameter). Errors it cannot place safely
// are printed for manual handling. The generated JS must still be checked with tokdiff.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const GLOBALS_MARKER = '// legacy-to-ts: names provided by other bundled modules';

const IDENT = /[A-Za-z0-9_$]/;
const OPEN = {')': '(', ']': '[', '}': '{'};
const CLOSE = {'(': ')', '[': ']', '{': '}'};

// Start of the primary/member expression that ends just before `end` (same line).
function exprStart(text, end) {
  let i = end;
  for (;;) {
    while (i > 0 && text[i - 1] === ' ') { i--; }
    const ch = text[i - 1];
    if (ch && OPEN[ch]) {
      let depth = 0, j = i - 1;
      for (; j >= 0; j--) {
        if (OPEN[text[j]]) { depth++; } else if (CLOSE[text[j]]) {
          depth--; if (depth === 0) { break; }
        }
      }
      if (j < 0) { return -1; }
      i = j;
      // a call/index continues the member chain to the left
      if (i > 0 && (IDENT.test(text[i - 1]) || text[i - 1] === ')' || text[i - 1] === ']')) { continue; }
      return i;
    }
    if (ch && IDENT.test(ch)) {
      while (i > 0 && IDENT.test(text[i - 1])) { i--; }
      if (text[i - 1] === '.' ) { i--; if (text[i - 1] === '?') { i--; } continue; }
      return i;
    }
    return -1;
  }
}

// End (exclusive) of an argument/expression starting at `start` (same line): stops at a
// top-level `,` `)` `]` `}` or `;`.
function argEnd(text, start) {
  let depth = 0, quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') { i++; } else if (c === quote) { quote = null; } continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (CLOSE[c]) { depth++; continue; }
    if (OPEN[c]) { if (depth === 0) { return i; } depth--; continue; }
    if ((c === ',' || c === ';') && depth === 0) { return i; }
  }
  return quote || depth ? -1 : text.length;
}

function findClassLine(lines, name) {
  const rx = new RegExp(`^(\\s*)class ${name.replace(/[$]/g, '\\$')}\\b`);
  return lines.findIndex(l => rx.test(l));
}

function runTsc(stage, files) {
  const cfgDir = path.join(stage, '.generated', 'legacy-to-ts');
  fs.mkdirSync(cfgDir, {recursive: true});
  const cfg = path.join(cfgDir, 'tsconfig.fix.json');
  fs.writeFileSync(cfg, JSON.stringify({
    extends: '../../tsconfig.nico-legacy.json',
    compilerOptions: {noEmit: true, rootDir: '../../nico-src'},
    files: files.map(f => path.relative(cfgDir, f).replace(/\\/g, '/'))
  }, null, 1));
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--project', cfg, '--pretty', 'false'], {cwd: stage, shell: process.platform === 'win32', encoding: 'utf8', maxBuffer: 1 << 28});
  const out = (r.stdout || '') + (r.stderr || '');
  const errors = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/([^\s(]+\.ts)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (m) { errors.push({file: path.resolve(stage, m[1]), line: +m[2] - 1, col: +m[3] - 1, code: m[4], msg: m[5]}); }
  }
  return {errors, raw: out};
}

function planFixes(lines, errs) {
  const ops = []; // {line, col, del, ins} in-line replacement; or {after:line, text}
  const globals = new Set(), done = new Set(), manual = [];
  const declareMember = (cls, member, isStatic) => {
    const ci = findClassLine(lines, cls);
    if (ci < 0) { return false; }
    const key = `m:${cls}:${isStatic}:${member}`;
    if (done.has(key)) { return true; }
    done.add(key);
    const indent = lines[ci].match(/^\s*/)[0] + '  ';
    ops.push({after: ci, text: `${indent}declare ${isStatic ? 'static ' : ''}${member}: Loose;`});
    return true;
  };
  const wrap = (line, start, end) => {
    const key = `w:${line}:${start}`;
    if (done.has(key)) { return; }
    done.add(key);
    const t = lines[line].slice(start, end);
    ops.push({line, col: start, del: end - start, ins: `(${t} as Loose)`});
  };
  for (const e of errs) {
    const text = lines[e.line] ?? '';
    let m;
    if ((e.code === 'TS2304' || e.code === 'TS2552') && (m = e.msg.match(/Cannot find name '([^']+)'/))) {
      globals.add(m[1]); continue;
    }
    if ((e.code === 'TS7006' || e.code === 'TS7019') && (m = e.msg.match(/parameter '([^']+)'/i))) {
      const name = m[1], at = e.col + (text.startsWith('...', e.col) ? 3 : 0);
      if (text.slice(at, at + name.length) !== name) { manual.push(e); continue; }
      const key = `p:${e.line}:${at}`; if (done.has(key)) { continue; } done.add(key);
      const rest = text.slice(at + name.length);
      if (/^\s*=>/.test(rest)) {
        ops.push({line: e.line, col: at, del: name.length, ins: `(${name}?: Loose)`});
      } else {
        const hasDefault = /^\s*=(?!>)/.test(rest);
        const ins = e.code === 'TS7019' ? ': Loose[]' : hasDefault ? ': Loose' : '?: Loose';
        ops.push({line: e.line, col: at + name.length, del: 0, ins});
      }
      continue;
    }
    if ((e.code === 'TS7034' || e.code === 'TS7005' && /\b(?:const|let|var)\s+$/.test(text.slice(0, e.col))) &&
      (m = e.msg.match(/Variable '([^']+)'/))) {
      const at = e.col, name = m[1];
      if (text.slice(at, at + name.length) !== name || text[at + name.length] === ':') { manual.push(e); continue; }
      const key = `v:${e.line}:${at}`; if (done.has(key)) { continue; } done.add(key);
      ops.push({line: e.line, col: at + name.length, del: 0, ins: ': Loose'});
      continue;
    }
    if (e.code === 'TS7031') {
      // binding element of a destructuring parameter: annotate the whole pattern
      let depth = 0, i = e.col, li = e.line, start = -1;
      for (let j = i; j >= 0; j--) {
        const c = text[j];
        if (c === '}' || c === ']') { depth++; }
        if (c === '{' || c === '[') { if (depth === 0) { start = j; break; } depth--; }
      }
      if (start < 0) { manual.push(e); continue; }
      const key = `b:${e.line}:${start}`; if (done.has(key)) { continue; } done.add(key);
      // find the matching close, possibly on a later line
      depth = 0; let endLine = -1, endCol = -1;
      outer: for (let l = e.line; l < Math.min(lines.length, e.line + 30); l++) {
        const s = lines[l];
        for (let j = l === e.line ? start : 0; j < s.length; j++) {
          if (s[j] === '{' || s[j] === '[') { depth++; }
          if (s[j] === '}' || s[j] === ']') { depth--; if (depth === 0) { endLine = l; endCol = j + 1; break outer; } }
        }
      }
      if (endLine < 0 || lines[endLine].slice(endCol).trimStart().startsWith(':')) { manual.push(e); continue; }
      ops.push({line: endLine, col: endCol, del: 0, ins: ': Loose'});
      continue;
    }
    if ((e.code === 'TS2339' || e.code === 'TS2551') && (m = e.msg.match(/Property '([^']+)' does not exist on type '(.+?)'(?:\.|$)/))) {
      const prop = m[1], type = m[2];
      let j = e.col - 1;
      while (j >= 0 && text[j] === ' ') { j--; }
      if (text[j] === ',' || text[j] === '{') {
        let depth = 0, start = -1;
        for (let q = e.col; q >= 0; q--) {
          if (text[q] === '}') { depth++; }
          if (text[q] === '{') { if (depth === 0) { start = q; break; } depth--; }
        }
        let close = -1; depth = 0;
        for (let q = start; start >= 0 && q < text.length; q++) {
          if (text[q] === '{') { depth++; }
          if (text[q] === '}') { depth--; if (depth === 0) { close = q + 1; break; } }
        }
        const key = `b:${e.line}:${start}`;
        if (close < 0 || text.slice(close).trimStart().startsWith(':')) { if (!done.has(key)) { manual.push(e); } continue; }
        if (!done.has(key)) { done.add(key); ops.push({line: e.line, col: close, del: 0, ins: ': Loose'}); }
        continue;
      }
      if (text[j] !== '.') { manual.push(e); continue; }
      let baseEnd = j; if (text[j - 1] === '?') { baseEnd = j - 1; }
      const sm = type.match(/^typeof ([A-Za-z_$][\w$]*)$/);
      if (sm && declareMember(sm[1], prop, true)) { continue; }
      if (/^[A-Za-z_$][\w$]*$/.test(type) && declareMember(type, prop, false)) { continue; }
      if (/^this$/.test(type)) {
        // `this` of an enclosing class: find the nearest class above
        let ci = e.line; while (ci >= 0 && !/^\s*class\s+[A-Za-z_$]/.test(lines[ci])) { ci--; }
        const cm = ci >= 0 && lines[ci].match(/class\s+([A-Za-z_$][\w$]*)/);
        if (cm && declareMember(cm[1], prop, false)) { continue; }
      }
      const s = exprStart(text, baseEnd);
      if (s < 0) { manual.push(e); continue; }
      wrap(e.line, s, baseEnd);
      continue;
    }
    if (e.code === 'TS7053') {
      // element access: wrap the indexed object
      const at = e.col;
      let k = at, depth = 0;
      for (; k < text.length; k++) {
        const c = text[k];
        if (c === '[' && depth === 0 && k > at) { break; }
        if (c === '(') { depth++; } else if (c === ')') { depth--; }
        if (!IDENT.test(c) && c !== '.' && c !== '?' && c !== '(' && c !== ')' && c !== ' ') { k = -1; break; }
      }
      if (k < 0 || text[k] !== '[') { manual.push(e); continue; }
      wrap(e.line, at, k);
      continue;
    }
    if (['TS2739', 'TS2740', 'TS2741'].includes(e.code)) { e.code = 'TS2322'; }
    if (e.code === 'TS2345' || e.code === 'TS2322' && /^\s*[^=]/.test(text.slice(e.col))) {
      // argument (2345) or a single-line value (2322): cast it to Loose
      let start = e.col;
      if (e.code === 'TS2322') {
        const rest = text.slice(e.col);
        const am = rest.match(/^([\w$.[\]'"]+)\s*(?:=|:)\s*/);
        if (!am || rest.startsWith('return')) { manual.push(e); continue; }
        start = e.col + am[0].length;
      }
      const end = argEnd(text, start);
      if (end < 0 || end <= start) { manual.push(e); continue; }
      wrap(e.line, start, end);
      continue;
    }
    if (e.code === 'TS7011') {
      // arrow function with an implicit any return type: annotate `: Loose` before `=>`
      const arrow = text.indexOf('=>', e.col);
      if (arrow < 0) { manual.push(e); continue; }
      const params = text.slice(e.col, arrow).trimEnd();
      const asyncPrefix = params.match(/^async\s+/);
      const plain = asyncPrefix ? params.slice(asyncPrefix[0].length) : params;
      const key = `r:${e.line}:${e.col}`; if (done.has(key)) { continue; } done.add(key);
      const wrapped = plain.startsWith('(') ? plain : `(${plain})`;
      ops.push({line: e.line, col: e.col, del: arrow - e.col, ins: `${asyncPrefix ? asyncPrefix[0] : ''}${wrapped}: Loose `});
      continue;
    }
    if (e.code === 'TS7018' && (m = e.msg.match(/property '([^']+)'/))) {
      // `{list: []}` / `{x: null}`: cast the empty value
      const rest = text.slice(e.col + m[1].length);
      const vm = rest.match(/^\s*:\s*(\[\]|null|undefined)/);
      if (!vm) { manual.push(e); continue; }
      const vs = e.col + m[1].length + vm[0].length - vm[1].length;
      wrap(e.line, vs, vs + vm[1].length);
      continue;
    }
    // a spread into a non-rest parameter list: call through a Loose receiver, like 2554 below
    if (e.code === 'TS2556') { e.code = 'TS2554'; e.msg = 'Expected 0 arguments, but got 1.'; }
    if (e.code === 'TS2554' && (m = e.msg.match(/Expected (\d+)(?:-\d+)? arguments?, but got (\d+)/))) {
      // a legacy call with a different argument count: call through a Loose receiver
      let calleeEnd = -1, callLine = e.line;
      if (+m[2] > +m[1]) {
        let depth = 0, found = false;
        for (let li = e.line; li >= Math.max(0, e.line - 12) && !found; li--) {
          const t = lines[li];
          for (let j = (li === e.line ? e.col : t.length) - 1; j >= 0; j--) {
            const c = t[j];
            if (c === ')' || c === ']' || c === '}') { depth++; }
            if (c === '(' || c === '[' || c === '{') {
              if (depth === 0) { calleeEnd = c === '(' ? j : -1; callLine = li; found = true; break; }
              depth--;
            }
          }
        }
      } else {
        const cm = text.slice(e.col).match(/^[\w$.?]+(?=\()/);
        if (cm) { calleeEnd = e.col + cm[0].length; }
      }
      if (calleeEnd < 0) { manual.push(e); continue; }
      const ctext = lines[callLine];
      const cs = exprStart(ctext, calleeEnd);
      if (cs < 0) { manual.push(e); continue; }
      const callee = ctext.slice(cs, calleeEnd);
      const dot = callee.lastIndexOf('.');
      if (dot > 0) { wrap(callLine, cs, cs + (callee[dot - 1] === '?' ? dot - 1 : dot)); } else { wrap(callLine, cs, calleeEnd); }
      continue;
    }
    if (e.code === 'TS2362' || e.code === 'TS2363') {
      let k = e.col, depth = 0;
      for (; k < text.length; k++) {
        const c = text[k];
        if (c === '[' || c === '(') { depth++; continue; }
        if (c === ']' || c === ')') { if (depth === 0) { break; } depth--; continue; }
        if (depth === 0 && !/[\w$.]/.test(c)) { break; }
      }
      if (k <= e.col) { manual.push(e); continue; }
      wrap(e.line, e.col, k);
      continue;
    }
    if (e.code === 'TS2349') {
      const cm = text.slice(e.col).match(/^[\w$.?]+(?=\s*\()/);
      if (!cm) { manual.push(e); continue; }
      wrap(e.line, e.col, e.col + cm[0].length);
      continue;
    }
    if (e.code === 'TS1016') {
      // a required (destructured) parameter after ones this script made optional:
      // make the earlier `?: Loose` parameters of the same list required again
      let depth = 0, open = -1;
      for (let j = e.col - 1; j >= 0; j--) {
        const c = text[j];
        if (c === ')' || c === ']' || c === '}') { depth++; }
        if (c === '(' || c === '[' || c === '{') { if (depth === 0) { open = j; break; } depth--; }
      }
      const seg = open >= 0 ? text.slice(open, e.col) : '';
      if (!seg.includes('?: Loose')) { manual.push(e); continue; }
      const key = `o:${e.line}:${open}`; if (done.has(key)) { continue; } done.add(key);
      ops.push({line: e.line, col: open, del: seg.length, ins: seg.split('?: Loose').join(': Loose')});
      continue;
    }
    if (e.code === 'TS2683') {
      // `this` inside a plain function: give the function an explicit `this: Loose`
      let li = e.line, fi = -1;
      for (; li >= Math.max(0, e.line - 80); li--) {
        const fm = lines[li].match(/\bfunction\b\s*[A-Za-z_$]*\s*\(/);
        if (fm) { fi = fm.index + fm[0].length; break; }
      }
      if (fi < 0) { manual.push(e); continue; }
      const key = `t:${li}:${fi}`; if (done.has(key)) { continue; } done.add(key);
      const after = lines[li].slice(fi);
      ops.push({line: li, col: fi, del: 0, ins: after.startsWith(')') ? 'this: Loose' : 'this: Loose, '});
      continue;
    }
    manual.push(e);
  }
  return {ops, globals, manual};
}

function applyOps(lines, ops) {
  const inline = ops.filter(o => o.after === undefined).sort((a, b) => b.line - a.line || b.col - a.col);
  for (const o of inline) {
    const t = lines[o.line];
    lines[o.line] = t.slice(0, o.col) + o.ins + t.slice(o.col + o.del);
  }
  const inserts = ops.filter(o => o.after !== undefined).sort((a, b) => b.after - a.after);
  for (const o of inserts) { lines.splice(o.after + 1, 0, o.text); }
}

export function fixFiles(stage, files, rounds = 12) {
  let last = null;
  for (let round = 1; round <= rounds; round++) {
    const {errors, raw} = runTsc(stage, files);
    const mine = errors.filter(e => files.includes(e.file));
    console.log(`LEGACY_TO_TS_FIX round ${round}: ${mine.length} errors`);
    if (!mine.length) { return {errors: [], raw}; }
    let changed = 0;
    for (const file of files) {
      const errs = mine.filter(e => e.file === file);
      if (!errs.length) { continue; }
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      const {ops, globals, manual} = planFixes(lines, errs);
      applyOps(lines, ops);
      const mi = lines.indexOf(GLOBALS_MARKER);
      const have = new Set(lines.filter(l => l.startsWith('declare const ')).map(l => l.slice(14).split(':')[0]));
      const add = [...globals].filter(g => !have.has(g)).sort().map(g => `declare const ${g}: Loose;`);
      if (add.length) { lines.splice(mi + 1, 0, ...add); }
      changed += ops.length + add.length;
      fs.writeFileSync(file, lines.join('\n'));
      last = manual;
    }
    if (!changed) {
      console.log('LEGACY_TO_TS_FIX no automatic fix left; manual:');
      for (const e of mine.slice(0, 60)) {
        const l = fs.readFileSync(e.file, 'utf8').split('\n')[e.line] ?? '';
        console.log(`  ${path.basename(e.file)}:${e.line + 1}:${e.col + 1} ${e.code} ${e.msg.slice(0, 120)}\n      ${l.trim().slice(0, 140)}`);
      }
      return {errors: mine, raw};
    }
  }
  const {errors} = runTsc(stage, files);
  return {errors: errors.filter(e => files.includes(e.file))};
}

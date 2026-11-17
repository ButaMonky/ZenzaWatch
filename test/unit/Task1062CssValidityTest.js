'use strict';
// Task1062: 配布物に入っている CSS を構文と値の両方で検査する（ブラウザが黙って捨てる宣言を見つける）。
// 旧 CssTypoCleanupTest（既知の7つの誤字を文字列で探していた）と、
// HeatSync / MaskedWatch / ZenzaGamePad の TooltipBorderTest（1つの border の値だけを見ていた）の置き換え。
// 今回この検査で見つけて直したもの: `text-align; center;`、`transition: translate(...)`（transform の誤り）、
// 効かない `text-stroke`（標準のプロパティではない）。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const csstree = require('css-tree');

const ROOT = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist-manifest.json'), 'utf8'));
const ACTIVE = manifest.active.files.map(f => f.file).filter(f => /\.user\.js$/.test(f));

// JS を構文解析して、テンプレート文字列（`...`）のうち CSS らしいもの（`セレクタ { プロパティ: 値; }` を含み、HTML ではない）を取り出す。
// `${...}` の部分は zzinterp という印に置き換え、その宣言は検査しない（実行時まで値が分からない）。
const parser = require('@babel/parser');
const cssTemplates = text => {
  const ast = parser.parse(text, {sourceType: 'script', allowReturnOutsideFunction: true, errorRecovery: true, plugins: []});
  const out = [];
  const stack = [ast.program];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.type !== 'string') { continue; }
    if (node.type === 'TemplateLiteral') {
      const body = node.quasis.map(q => q.value.cooked ?? q.value.raw).join('zzinterp');
      if (body.length >= 30 && /[^{};]+\{[^{}]*:[^{}]*;/.test(body) && !/<[a-z][\w-]*[\s>]/i.test(body)) {
        out.push({body, line: node.loc.start.line});
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' || key === 'trailingComments') { continue; }
      const v = node[key];
      if (Array.isArray(v)) { for (const c of v) { if (c && typeof c.type === 'string') stack.push(c); } }
      else if (v && typeof v.type === 'string') { stack.push(v); }
    }
  }
  return out;
};

// css-tree が正しく扱えないもの（誤検出）。ブラウザでは有効。
const KNOWN_PARSER_GAPS = [
  /aspect-ratio\s*[<>]=?\s*\d+\/\d+/,      // メディアクエリの範囲指定と比率
  /\{\s*[>+~&]/,                             // CSS の入れ子（相対セレクタで始まる子ルール）
];
// 分かっていて残しているもの（今は無い。Task1065 でコメント描画の body の margin の誤字を直した）
const ACCEPTED = [];
// 1つのルールで -webkit- 付きと並べている、標準化前の名前（ブラウザは前者を使う）
const PAIRED_PREFIX = {'text-stroke': '-webkit-text-stroke'};
const AT_RULE_DESCRIPTORS = new Set(['syntax', 'inherits', 'initial-value']);

const unvar = s => {
  let prev;
  do {
    prev = s;
    s = s.replace(/var\(\s*--[\w-]+\s*,\s*((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g, '$1');
  } while (s !== prev);
  return s;
};

function problemsIn(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const problems = [];
  for (const {body, line} of cssTemplates(text)) {
    // `${...}` を値の中で使っている宣言は、検査用に無害な識別子へ置き換える（その宣言は検査しない印を付ける）
    const css = body;
    const ast = csstree.parse(css, {
      positions: true,
      onParseError: e => {
        const near = css.slice(Math.max(0, e.offset - 40), e.offset + 40);
        if (KNOWN_PARSER_GAPS.some(re => re.test(near))) { return; }
        if (/zzinterp/.test(near)) { return; }
        problems.push(`${file}:${line + (e.line || 1) - 1} 構文: ${e.message} … ${near.replace(/\s+/g, ' ').trim()}`);
      }
    });
    csstree.walk(ast, {
      visit: 'Rule',
      enter(rule) {
        const props = new Set();
        csstree.walk(rule.block, {visit: 'Declaration', enter(d) { props.add(d.property); }});
        csstree.walk(rule.block, {
          visit: 'Declaration',
          enter(d) {
            if (d.property.startsWith('--')) { return; }
            if (PAIRED_PREFIX[d.property] && props.has(PAIRED_PREFIX[d.property])) { return; }
            let value = csstree.generate(d.value);
            if (/zzinterp/.test(value) || /zzinterp/.test(d.property)) { return; }
            if (value.includes('var(')) {
              value = unvar(value);
              if (value.includes('var(')) { return; } // 既定値の無い var() は実行時まで分からない
            }
            const r = csstree.lexer.matchProperty(d.property, value);
            if (r.error) {
              problems.push(`${file}:${line + (d.loc ? d.loc.start.line : 1) - 1} ${d.property}: ${value.slice(0, 60)} — ${r.error.message.split('\n')[0]}`);
            }
          }
        });
      }
    });
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(at) {
        if (at.name !== 'property' || !at.block) { return; }
        csstree.walk(at.block, {visit: 'Declaration', enter(d) {
          if (!AT_RULE_DESCRIPTORS.has(d.property)) { problems.push(`${file}: @property に不明な項目 ${d.property}`); }
        }});
        // @property の中身は上の Rule の検査に入らない（Atrule の block は Rule ではない）
      }
    });
  }
  return problems;
}

describe('Task1062 配布物の CSS が正しいか（構文・プロパティ名・値）', function() {
  this.timeout(60000);
  it('検査の対象がある（active な配布物の CSS を読めている）', () => {
    assert(ACTIVE.includes('dist/ZenzaWatch-dev.user.js'), JSON.stringify(ACTIVE));
    const count = cssTemplates(fs.readFileSync(path.join(ROOT, 'dist/ZenzaWatch-dev.user.js'), 'utf8')).length;
    assert(count > 50, `CSS のまとまりが ${count} 個しか見つからない`);
  });
  for (const file of ACTIVE) {
    it(file, () => {
      const problems = problemsIn(file).filter(p => !ACCEPTED.some(a => a.file === file && p.includes(a.text)));
      assert.deepStrictEqual(problems, [], '\n' + problems.join('\n'));
    });
  }
  it('検査が誤りを見つけられる（わざと壊した CSS）', () => {
    const tmp = path.join(require('os').tmpdir(), 'zenza-css-validity-' + process.pid + '.user.js');
    fs.writeFileSync(tmp, 'const s = `\n.a .b {\n  text-align; center;\n  pointer-evnets: none;\n  border: 1px solid !000;\n  transition: translate(2px, 2px);\n}\n`;');
    try {
      const rel = path.relative(ROOT, tmp);
      const problems = problemsIn(rel);
      for (const needle of ['構文', 'pointer-evnets', 'border', 'transition']) {
        assert(problems.some(p => p.includes(needle)), `${needle} を見つけられない: ${problems.join(' / ')}`);
      }
    } finally { fs.unlinkSync(tmp); }
  });
});

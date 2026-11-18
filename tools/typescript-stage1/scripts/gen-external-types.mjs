#!/usr/bin/env node
// Task1061: 別ステージ（advanced-src / comment-src / menu-src / p12-src）の TS が持っている部品の型を、
// nico-src から `typeof import('./external/X').X` で参照できるように .d.ts として書き出す。
// nico-src の rootDir の外にあるファイルは import できないため、型だけを写す。
//   node scripts/gen-external-types.mjs          … 書き出す
//   node scripts/gen-external-types.mjs --check  … 書き出し済みのものと一致するか（元が変わったら NG）
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(STAGE, 'nico-src/external');
export const EXTERNAL_TYPES = [
  'advanced-src/UiVisibilityRegistry.ts',
  'advanced-src/RelatedMenuOrder.ts',
  'advanced-src/ScreenshotFileName.ts',
  'menu-src/RelatedMenuActions.ts',
  'comment-src/NicoComment.ts',
  'comment-src/NicoCommentViewModel.ts',
  'comment-src/NicoChatGroup.ts',
  'comment-src/NicoChatGroupViewModel.ts',
  'comment-src/NicoChat.ts',
  'comment-src/NicoChatViewModel.ts',
  'comment-src/NicoCommentCss3PlayerView.ts',
  'comment-src/NicoChatFilter.ts',
  'comment-src/OffscreenLayer.ts',
  'comment-src/CommentPictureInPicture.ts',
  'comment-src/CommentLayoutWorker.ts',
  'p12-src/ManualBookmarkStore.ts',
  'p12-src/ManualBookmarkDock.ts',
];
const HEADER = '// 自動生成（Task1061: scripts/gen-external-types.mjs）。手で直さない。元: ';

// TypeScript 7（ネイティブ版）には JS API が無いので、一時 tsconfig で tsc を呼んで宣言だけを書き出す。
const emit = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-external-types-'));
  try {
    const config = {
      compilerOptions: {
        target: 'ES2022', module: 'ES2022', moduleResolution: 'Bundler', lib: ['ES2022', 'DOM'], types: [],
        strict: true, declaration: true, emitDeclarationOnly: true, noEmitOnError: false, skipLibCheck: true,
        rootDir: STAGE, outDir: path.join(tmp, 'out'),
      },
      files: EXTERNAL_TYPES.map(rel => path.join(STAGE, rel)),
    };
    const configPath = path.join(tmp, 'tsconfig.json');
    fs.writeFileSync(configPath, JSON.stringify(config));
    const r = spawnSync(process.execPath, [path.join(STAGE, 'node_modules/typescript/bin/tsc'), '-p', configPath],
      {cwd: STAGE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    const out = new Map();
    for (const rel of EXTERNAL_TYPES) {
      if (!fs.existsSync(path.join(tmp, 'out', rel.replace(/\.ts$/, '.d.ts')))) {
        throw new Error(`${rel}: 型の書き出しに失敗\n${r.stdout}${r.stderr}`);
      }
    }
    // 元のファイルが import している同じステージの部品（例: p12-src/ManualBookmarkSession.ts）も一緒に写す。
    // import は './X.ts' の相対指定なので、平らな1つのフォルダに並べれば解決できる。
    const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(d =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
    for (const p of walk(path.join(tmp, 'out')).filter(p => p.endsWith('.d.ts')).sort()) {
      const rel = path.relative(path.join(tmp, 'out'), p).replace(/\.d\.ts$/, '.ts').split(path.sep).join('/');
      const name = path.basename(p);
      if (out.has(name)) { throw new Error(`同じ名前の型ファイルが2つある: ${name}`); }
      // comment-src は packages/zenza/src/commentLayer の位置を前提に Emitter を相対 import している。
      // nico-src では同じ Emitter の正本（./Emitter.ts）を指すように直す。
      const body = fs.readFileSync(p, 'utf8').replaceAll("from '../../../lib/src/Emitter'", "from '../Emitter'");
      out.set(name, HEADER + rel + '\n' + body);
    }
    return out;
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const files = emit();
  if (process.argv.includes('--check')) {
    const stale = [...files].filter(([name, text]) => {
      const p = path.join(OUT, name);
      return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text;
    }).map(([name]) => name);
    const extra = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(n => !files.has(n)) : [];
    if (stale.length || extra.length) {
      console.error('EXTERNAL_TYPES=STALE', [...stale, ...extra.map(n => n + '(不要)')].join(' '),
        '\n→ node scripts/gen-external-types.mjs で書き直す');
      process.exit(1);
    }
    console.log('EXTERNAL_TYPES=PASS files=' + files.size);
  } else {
    fs.mkdirSync(OUT, {recursive: true});
    for (const [name, text] of files) fs.writeFileSync(path.join(OUT, name), text);
    console.log('EXTERNAL_TYPES=WRITTEN files=' + files.size);
  }
}

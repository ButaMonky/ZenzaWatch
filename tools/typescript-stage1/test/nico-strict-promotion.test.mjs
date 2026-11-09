// #205: promote only modules proven to have zero strict diagnostic errors.
// This guards future TS config drift and does not change any runtime JavaScript.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe,it} from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const strict=read('tsconfig.nico.json'), legacy=read('tsconfig.nico-legacy.json');
const moved=['CommentPlayer','DialogElement','HeatMapWorker','PipPageThumbnail',
  'RootDispatcher','ShortcutActions','State','StoryboardView','VideoInfo','VideoItemElement'];
const names=moved.map(n=>'nico-src/'+n+'.ts');
const remaining=new Set(legacy.files);
describe('#205 TypeScript strict promotion of ten canonical modules',()=>{
  it('gives strict options to all ten and never regresses the original 19-file legacy baseline',()=>{
    assert.equal(strict.compilerOptions.strict,true);
    assert.equal(strict.compilerOptions.noUncheckedIndexedAccess,true);
    assert(legacy.files.length<=19,'relaxed file count must not increase beyond original 19');
    assert.equal(strict.exclude.length,legacy.files.length);
    assert.deepEqual([...strict.exclude].sort(),[...legacy.files].sort());
    for(const src of names){
      assert(!strict.exclude.includes(src),'still excluded: '+src);
      assert(!remaining.has(src),'still in legacy: '+src);
    }
  });
  it('retains the ten source to generated-runtime mappings without touching output',()=>{
    for(const n of moved){
      const data=read('nico-api-manifests/'+n+'.json');
      assert.equal(data.source,'tools/typescript-stage1/nico-src/'+n+'.ts');
      assert(data.runtime.endsWith('.js'));
      assert.match(data.runtimeSha256,/^[a-f0-9]{64}$/);
      assert(fs.statSync(path.join(root,'nico-src',n+'.ts')).isFile());
    }
  });
});

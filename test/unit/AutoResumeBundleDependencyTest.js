'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const parser=require('@babel/parser');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const names={
 entry:'src/_template.js',video:'src/VideoInfo.js',
 policy:'packages/zenza/src/resume/AutoResumePolicy.js',
 dist:'dist/ZenzaWatch-dev.user.js'
};
describe('P12 onepoint runtime must resolve in the actual local dev bundle',()=>{
 it('registers the typed policy exactly once BEFORE VideoInfo model dependency',()=>{
  const source=read(names.entry);
  const intro="import {selectAutoResume} from '../packages/zenza/src/resume/AutoResumePolicy';";
  assert.strictEqual(source.split(intro).length-1,1);
  assert.strictEqual((source.match(/^\/\/@require selectAutoResume$/gm)||[]).length,1);
  const first=source.indexOf('//@require selectAutoResume');
  const next=source.indexOf('//@require VideoInfoModel');
  assert(first>=0&&next>first);
 });
 it('references the canonical generated policy from VideoInfo, never an undefined global',()=>{
  const source=read(names.video),policy=read(names.policy);
  assert(source.startsWith("import {textUtil}"));
  assert.strictEqual((source.match(/^import \{selectAutoResume\} /gm)||[]).length,1);
  assert.strictEqual((source.match(/\bselectAutoResume\(\{/g)||[]).length,1);
  assert(policy.startsWith('// GENERATED FROM tools/typescript-stage1/p12-src/AutoResumePolicy.ts'));
  assert.strictEqual((policy.match(/\bfunction selectAutoResume\(/g)||[]).length,1);
 });
 it('includes exactly one policy declaration before the only caller in dev output',()=>{
  const dist=read(names.dist);
  const declared=[...dist.matchAll(/\bfunction selectAutoResume\(/g)];
  const called=[...dist.matchAll(/(?:=|\s)selectAutoResume\(\{/g)];
  assert.strictEqual(declared.length,1);
  assert.strictEqual(called.length,1);
  assert(declared[0].index<called[0].index);
 });
 it('uses the actual bundled function body with a completion barrier',()=>{
  const dist=read(names.dist);
  const functionBody=dist.slice(dist.indexOf('function selectAutoResume('),
    dist.indexOf('function selectAutoResume(')+1800);
  assert(functionBody.includes("source: 'server'")||
    functionBody.includes("source:'server'")||
    functionBody.includes('source: "server"')||
    functionBody.includes('source: "local"'));
  assert(functionBody.includes('barrier')&&functionBody.includes('local'));
 });
 it('does not replace old five native marker nodes or seek handlers',()=>{
  const source=read('src/VideoControlBar.js');
  assert.strictEqual((source.match(/class="resumePointer"/g)||[]).length,5);
  assert(source.includes('SceneResumeMarkerPresenter.render('));
  assert(source.includes('data-command="seekTo"'));
 });
});

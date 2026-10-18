'use strict';
const assert=require('assert'),fs=require('fs'),{execFileSync}=require('child_process');
describe('Task801 review package',()=>{
 it('uses one version and identical executable body with isolated review metadata',()=>{
  const path='review/task801/ZenzaWatch-dev.user.js';
  assert(fs.existsSync(path),'review userscript must be packaged');
  const review=fs.readFileSync(path,'utf8'),dist=fs.readFileSync('dist/ZenzaWatch-dev.user.js','utf8');
  const marker='// ==/UserScript==',body=s=>s.slice(s.indexOf(marker));
  assert.strictEqual(body(review),body(dist));
  assert(review.includes('// @version        2.7.307-task801'));
  assert(/var VER\s*=\s*'2\.7\.307-task801'/.test(review));
  for(const key of ['downloadURL','updateURL'])assert(new RegExp('// @'+key+'\\s+https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/refs/heads/publication/task801-scui-preview-settings/review/task801/ZenzaWatch-dev.user.js').test(review));
  for(const name of ['SceneSearchPreferences','SceneSearchPreviewView','SceneSearchPlacement'])assert(dist.includes('class '+name));
 });
 it('packages the standalone settings with the same runtime body',()=>{
  const review=fs.readFileSync('review/task801/ZenzaAdvancedSettings.user.js','utf8'),dist=fs.readFileSync('dist/ZenzaAdvancedSettings.user.js','utf8');
  const marker='// ==/UserScript==';assert.strictEqual(review.slice(review.indexOf(marker)),dist.slice(dist.indexOf(marker)));
  assert(review.includes('0.3.63-task801'));assert(review.includes('class SceneSearchPreferences'));
 });
 it('retains the accepted 304 review file and every other distribution byte',()=>{
  const git='C:/Program Files/Git/cmd/git.exe';
  const unchanged=['review/task791/ZenzaWatch-dev.user.js',...fs.readdirSync('dist').filter(x=>x.endsWith('.user.js')&&!['ZenzaWatch-dev.user.js','ZenzaAdvancedSettings.user.js'].includes(x)).map(x=>'dist/'+x)];
  for(const file of unchanged){
   const original=execFileSync(git,['show','f76cde6:'+file],{maxBuffer:30*1024*1024});
   assert(fs.readFileSync(file).equals(original),file+' must remain byte-identical');
  }
 });
});

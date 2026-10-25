'use strict';
const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const marker='// ==/UserScript==';
const body=s=>s.slice(s.indexOf(marker));
describe('Task801 archived QA and current release parity',()=>{
 it('preserves the immutable Task801 reviewed player while the live distribution advances',()=>{
  const path='review/task801/ZenzaWatch-dev.user.js';
  assert(fs.existsSync(path),'Task801 archival userscript must remain available');
  assert.strictEqual(hash(path),'248162759bcbf3fca029a6270133254d079f13bc8ded9a71be99f935a6607965');
  const review=fs.readFileSync(path,'utf8'),dist=fs.readFileSync('dist/ZenzaWatch-dev.user.js','utf8');
  assert(review.includes('// @version        2.7.316-task801'));
  assert(/var VER\s*=\s*'2\.7\.316-task801'/.test(review));
  for(const key of ['downloadURL','updateURL']){
   assert(new RegExp('// @'+key+'\\s+https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/refs/heads/publication/task801-scui-preview-settings/review/task801/ZenzaWatch-dev.user.js').test(review));
  }
  assert(dist.includes('// @version        2.7.317-task935'));
  assert(dist.includes("var VER = '2.7.317-task935'"));
  for(const name of ['SceneSearchPreferences','SceneSearchPreviewView','SceneSearchPlacement']){
   assert(review.includes('class '+name),'Task801 archive lost '+name);
   assert(dist.includes('class '+name),'new distribution lost '+name);
  }
  assert(dist.includes('this.sceneSearchBinding.attach()'));
  assert(dist.includes(':where(.videoControlBar .controlItemContainer.right > .scalingUI) > .controlButton'));
 });
 it('does not change the archived standalone settings runtime',()=>{
  const review=fs.readFileSync('review/task801/ZenzaAdvancedSettings.user.js','utf8');
  const dist=fs.readFileSync('dist/ZenzaAdvancedSettings.user.js','utf8');
  assert.strictEqual(hash('review/task801/ZenzaAdvancedSettings.user.js'),'dd6659775e6b1dcd07b6bd7438fb7b4a412d8532cb296d93a63d159106bc192e');
  assert.strictEqual(body(review),body(dist));
  assert(review.includes('0.3.66-task801'));
 });
 it('retains the accepted Task791 review snapshot and untouched legacy-frozen files',()=>{
  assert.strictEqual(hash('review/task791/ZenzaWatch-dev.user.js'),'85b9d92c14e5b119c2d7e7d52e77ef978f11ff66971205c037bf9641aa608bf4');
  const manifest=JSON.parse(fs.readFileSync('dist-manifest.json','utf8'));
  for(const {file,sha256} of manifest.legacyFrozen.files){
   assert.strictEqual(hash(file),sha256,file+' changed unexpectedly');
  }
 });
});

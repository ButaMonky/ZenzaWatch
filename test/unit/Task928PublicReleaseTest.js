'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const manifest=JSON.parse(read('dist-manifest.json'));
const prefix='https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/';
const installers='https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/';
const expected={
 'ZenzaWatch-dev.user.js':'2.7.345-task970',
 'ZenzaHLS.user.js':'0.0.41-task966',
 'MylistPocket.user.js':'0.5.81-task971',
 'ZenzaAdvancedSettings.user.js':'0.3.79-task965',
 'ZenzaBlogPartsButton.user.js':'0.0.5-task928'
};
describe('Public promotion: release channel and installer integrity',function(){
 it('preserves 10 active and 3 frozen distribution files',()=>{
  assert.strictEqual(manifest.active.files.length,10);
  assert.strictEqual(manifest.legacyFrozen.files.length,3);
 });
 it('all active headers use public download and update URLs',()=>{
  for(const entry of manifest.active.files){
   const name=path.basename(entry.file||entry);
   const data=read('dist/'+name).split('// ==/UserScript==')[0];
   assert(data.includes('// @downloadURL'),name);
   assert(data.includes('// @updateURL'),name);
   const links=data.split('\n').filter(line=>line.includes('@downloadURL')||line.includes('@updateURL'));
   for(const link of links){
    assert(link.includes(prefix+name),name+': incorrect distribution channel');
    assert(!link.includes('ZenzaWatch-Back-up'),name);
   }
  }
 });
 it('the five installation links have current expected versions',()=>{
  const readme=read('README.md');
  for(const [name,version] of Object.entries(expected)){
   assert(readme.includes('('+installers+name+')'),name+': installer link missing');
   assert(read('dist/'+name).includes(version),name+': version mismatch');
   assert(readme.includes(version),name+': update README');
  }
 });
 it('retains alert and notification settings in both runtime bundles',()=>{
  const watch=read('dist/ZenzaWatch-dev.user.js');
  const settings=read('dist/ZenzaAdvancedSettings.user.js');
  assert(watch.includes('popup.backgroundTransparency'));
  assert(watch.includes('popup.notifyColor'));
  assert(settings.includes('\u901a\u77e5\u80cc\u666f\u306e\u900f\u660e\u5ea6'));
 });
});

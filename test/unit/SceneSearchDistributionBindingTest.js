'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {createBuildSandbox,runBuild,removeDir}=require('../helpers/buildSandbox');
describe('SCUI actual distribution dependency graph',function(){
 this.timeout(120000);
 it('bundles every real scene dependency exactly once into the installed userscript',()=>{
  const temp=createBuildSandbox('scui489-distribution-');
  try{
   const result=runBuild(temp,['--dev']);
   assert.equal(result.status,0,(result.stderr||'').slice(-1000));
   const text=fs.readFileSync(path.join(temp,'dist/ZenzaWatch-dev.user.js'),'utf8');
   for(const name of ['SceneSearchPlayerBinding','SceneSearchLegacyAdapter',
    'SceneSearchIntegrationBridge','SceneSearchController','SceneSearchInteraction',
    'ScenePreviewIdleLimiter','SceneSearchLayoutRegistry','SceneSearchLayoutCatalog',
    'SceneSearchLayoutCard','SceneSearchLayouts03_04','SceneSearchLayouts05_06',
    'SceneSearchLayout07','SceneSearchLayouts08_09','SceneSearchLayout10']){
    assert.equal((text.match(new RegExp('class '+name+'\\s*\\{','g'))||[]).length,1,
      name+' must be present exactly once in generated distribution');
   }
   assert(text.includes('function createSceneSearchLayoutRegistry('));
   assert(text.includes('function registerSceneLayouts01_02('));
   assert(text.includes('this.sceneSearchBinding.attach()'));
  }finally{removeDir(temp);}
 });
});

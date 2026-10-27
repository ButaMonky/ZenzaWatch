'use strict';
// Task453: fast root-suite guard for all TypeScript-canonical advanced-setting modules.
// Runs without tsc, network, browser sign-in or generated/. No runtime code changes.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const parser=require('@babel/parser');
const generate=require('@babel/generator').default;

const root=path.resolve(__dirname,'../..');
const names=['ModernAdvancedSettingsModel','ModernAdvancedSettingsUI',
  'UiVisibilityRegistry','Config','_setting','ScreenshotFileName','RelatedMenuOrder',
  'RelatedMenuSettings','NgCompositeRules','NgCompositeRuleEditor'];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const digest=value=>crypto.createHash('sha256')
  .update(value.replace(/\r\n/g,'\n')).digest('hex');
const canonical=value=>{
  const ast=parser.parse(value,{sourceType:'module',
    plugins:['classProperties','classPrivateProperties']});
  return generate(ast.program,{compact:true,comments:false}).code;
};

describe('Task453: TypeScript advanced-settings source integrity',()=>{
  for(const name of names){
    it('checks declared TS, JavaScript and AST fingerprints: '+name,()=>{
      const source='tools/typescript-stage1/advanced-src/'+name+'.ts';
      const runtime='src/'+name+'.js';
      const emitted='tools/typescript-stage1/.generated/advanced/'+name+'.js';
      const manifestPath='tools/typescript-stage1/advanced-manifests/'+name+'.json';
      const manifest=JSON.parse(read(manifestPath));
      assert.strictEqual(manifest.schemaVersion,1);
      assert.strictEqual(manifest.source,source);
      assert.strictEqual(manifest.runtime,runtime);
      assert.strictEqual(manifest.emitted,emitted);
      assert.strictEqual(manifest.sourceSha256,digest(read(source)),
        'TypeScript changed without updating legacy settings: '+name);
      assert.strictEqual(manifest.runtimeSha256,digest(read(runtime)),
        'Legacy runtime changed without updating TS source: '+name);
      assert.strictEqual(manifest.semanticSha256,digest(canonical(read(runtime))),
        'Legacy JS meaning was changed without compiler parity approval: '+name);
    });
  }
  it('maintains all original build ownership markers and require directives',()=>{
    for(const name of ['ModernAdvancedSettingsModel',
      'ModernAdvancedSettingsUI','UiVisibilityRegistry','Config']){
      const source=read('src/'+name+'.js');
      assert(source.includes('//===BEGIN==='),name+' BEGIN');
      assert(source.includes('//===END==='),name+' END');
    }
    const setting=read('src/_setting.js');
    for(const directive of ['//@require Emitter','//@require Config',
      '//@require uq','//@require ModernAdvancedSettingsModel',
      '//@require ModernAdvancedSettingsUI']){
      assert(setting.includes(directive),'legacy setting directive '+directive);
    }
  });
});

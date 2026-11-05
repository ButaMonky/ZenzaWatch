'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {REPO_ROOT,createBuildSandbox,runNode,removeDir} = require('../helpers/buildSandbox');
const base = 'https://github.com/ButaMonky/ZenzaWatch';
const distBase = base + '/raw/develop/dist/';
const installBase = 'https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/';
const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT,'dist-manifest.json'),'utf8'));
const active = manifest.active.files.map(({file})=>path.basename(file));
const installNames = ['ZenzaWatch-dev','ZenzaHLS','MylistPocket','ZenzaAdvancedSettings','ZenzaBlogPartsButton'];

function headers(root) {
  return active.map(name=>{
    const head=fs.readFileSync(path.join(root,'dist',name),'utf8').split('// ==/UserScript==')[0];
    const field=key=>head.match(new RegExp('^// @'+key+'\\s+([^\\r\\n]+)','m'))?.[1]?.trim();
    return {name,download:field('downloadURL'),update:field('updateURL'),
      homepage:field('homepageURL'),support:field('supportURL')};
  });
}
function publicDestinations(items) {
  for(const item of items) {
    const url=distBase+item.name;
    assert.strictEqual(item.download,url,item.name+' download URL');
    assert.strictEqual(item.update,url,item.name+' update URL');
    assert.strictEqual(item.homepage,base,item.name+' homepage');
    assert.strictEqual(item.support,base+'/issues',item.name+' support');
  }
}

describe('All installed userscripts update exclusively from the public fork',function(){
  it('private repository distributions point only at public release URLs',function(){
    publicDestinations(headers(REPO_ROOT));
  });
  it('private README directs install clicks to public release URLs',function(){
    const readme=fs.readFileSync(path.join(REPO_ROOT,'README.md'),'utf8');
    for(const name of installNames){
      assert.ok(readme.includes(']('+installBase+name+'.user.js)'),name+' public installer');
    }
    assert.ok(!/https:\/\/github\.com\/ButaMonky\/ZenzaWatch-Back-up\/raw\/develop\/dist\//.test(readme));
  });
  it('even forced private-channel builds cannot redirect updates to private GitHub',function(){
    this.timeout(45000);
    const dir=createBuildSandbox('zw-public-url-');
    try {
      const result=runNode(['build.js','--dev'],{cwd:dir,timeout:35000,
        env:{ZENZA_PUBLISH_CHANNEL:'private',GITHUB_REPOSITORY:'ButaMonky/ZenzaWatch-Back-up'}});
      assert.strictEqual(result.status,0,(result.stderr||result.stdout).slice(-1200));
      publicDestinations(headers(dir));
    }finally{removeDir(dir);}
  });
});

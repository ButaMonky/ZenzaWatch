'use strict';
// This repository ships generated JS while TypeScript is the authoritative source.
// Keep GitHub Linguist stats honest without hiding original handwritten JS.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const stage='tools/typescript-stage1/';
const expected=new Set();

const registry=read(stage+'scripts/nico-api-registry.mjs');
for(const match of registry.matchAll(/runtime\s*:\s*["']([^"']+\.js)["']/g)){
  expected.add(match[1]);
}

const advanced=read(stage+'scripts/advanced-registry.mjs');
const array=advanced.match(/Object\.freeze\(\[([\s\S]+?)\]\.map\(name/);
assert(array,'TS advanced registry shape changed');
for(const match of array[1].matchAll(/'([^']+)'/g)){
  expected.add('src/'+match[1]+'.js');
}

Object.values(json(stage+'scui-runtime-manifest.json')).forEach(item=>expected.add(item.runtime));
json(stage+'p12-manual-manifest.json').modules.forEach(item=>expected.add(item.runtime));
for(const name of ['p12-runtime-manifest','p12-auto-clear-manifest',
  'runtime-manifest','style-switcher-manifest','raf-timing-manifest']){
  expected.add(json(stage+name+'.json').runtime);
}
for(const name of fs.readdirSync(path.join(root,stage,'comment-src'))){
  if(name.endsWith('.ts')){
    expected.add('packages/zenza/src/commentLayer/'+name.replace(/\.ts$/,'.js'));
  }
}
for(const name of fs.readdirSync(path.join(root,stage,'menu-src'))){
  if(name.endsWith('.ts')){
    expected.add('packages/zenza/src/menu/'+name.replace(/\.ts$/,'.js'));
  }
}
expected.add('packages/zenza/src/pocket/PocketThumbnail.js');

describe('GitHub Linguist TypeScript canonical source classification',()=>{
  it('marks only confirmed generated runtime JS and dist bundles',()=>{
    const rules=read('.gitattributes').split(/\r?\n/)
      .map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
    assert(rules.includes('dist/** linguist-generated'));
    const actual=rules.filter(s=>s!=='dist/** linguist-generated').map(rule=>{
      const match=/^([^\s]+\.js) linguist-generated$/.exec(rule);
      assert(match,'unexpected or overly broad generated rule: '+rule);
      return match[1];
    });
    assert.equal(new Set(actual).size,actual.length);
    assert.deepStrictEqual(actual.sort(),[...expected].sort());
    for(const file of actual){
      assert(fs.statSync(path.join(root,file)).isFile(),'missing runtime: '+file);
    }
  });
  it('keeps handwritten sources visible as JavaScript',()=>{
    const rules=read('.gitattributes');
    for(const name of ['src/_pocket.js','src/boot.js','build.js','test/unit/PlaylistCoreTest.js']){
      assert(!rules.includes(name+' linguist-generated'),name+' must not be hidden');
      assert(fs.statSync(path.join(root,name)).isFile());
    }
  });
});

'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {runNode,removeDir}=require('../helpers/buildSandbox');
describe('SCUI isolated build inherits external dependency resolution',()=>{
 it('keeps NODE_PATH for an independent worktree with empty node_modules',()=>{
  const resolved=require.resolve('@babel/parser');
  const marker=path.sep+'node_modules'+path.sep;
  const idx=resolved.lastIndexOf(marker);
  assert(idx>=0,'test requires Babel from an installed dependency tree');
  const root=resolved.slice(0,idx+marker.length-1);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scui-node-path-'));
  const previous=process.env.NODE_PATH;
  try{
   fs.writeFileSync(path.join(dir,'probe.cjs'),
    "require('@babel/parser');console.log('SCENE_DEPENDENCY_OK');\n");
   process.env.NODE_PATH=root;
   const result=runNode(['probe.cjs'],{cwd:dir,timeout:10000});
   assert.equal(result.status,0,result.stderr);
   assert(result.stdout.includes('SCENE_DEPENDENCY_OK'));
  }finally{
   if(previous===undefined)delete process.env.NODE_PATH;
   else process.env.NODE_PATH=previous;
   removeDir(dir);
  }
 });
});
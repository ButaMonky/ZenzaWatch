'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {createBuildSandbox,runBuild,REPO_ROOT}=require('../helpers/buildSandbox');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
describe('Task200 history source generation gate',function(){
 this.timeout(60000);
 it('refuses a stale generated module before touching any distributed script',()=>{
  const dir=createBuildSandbox('zenza-ch200-stale-');
  try{
   const dist=path.join(dir,'dist');const names=fs.readdirSync(dist).filter(n=>n.endsWith('.user.js'));
   const before=names.map(n=>digest(path.join(dist,n)));
   fs.appendFileSync(path.join(dir,'packages/comment-history/src/session.mjs'),'\n// deliberate source change\n');
   const r=runBuild(dir);assert.strictEqual(r.status,1);
   assert(/comment-history.*stale|stale.*comment-history/i.test(r.stderr),r.stderr);
   assert.deepStrictEqual(names.map(n=>digest(path.join(dist,n))),before);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
 it('includes history sources among the watched source directories',()=>{
  assert(fs.readFileSync(path.join(REPO_ROOT,'build.js'),'utf8').includes("'./packages/comment-history/src'"));
 });
});

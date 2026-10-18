'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
describe('scene search canonical source generation',function(){
  this.timeout(30000);
  it('restores reproducible canonical TypeScript without rewriting protected modules',()=>{
    assert(fs.existsSync(path.join(root,'tools/typescript-stage1/nico-src/SceneSearchLayout00.ts')),
      'legacy generated runtime must have its canonical source');
    const files=['packages/lib/src/ui/TextLabel.js','packages/lib/src/dom/VideoCaptureUtil.js',
      'packages/lib/src/message/gate.js','packages/lib/src/message/messageUtil.js'];
    const before=files.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
    const result=spawnSync(process.execPath,['tools/typescript-stage1/scripts/sync-scui.mjs','--check'],
      {cwd:root,encoding:'utf8'});
    assert.strictEqual(result.status,0,result.stdout+result.stderr);
    assert.deepStrictEqual(files.map(p=>fs.readFileSync(path.join(root,p),'utf8')),before);
  });
  it('refuses foreign edits before writes and restores files if a transaction fails',async()=>{
    const script=path.join(root,'tools/typescript-stage1/scripts/sync-scui.mjs');
    assert(fs.existsSync(script),'scoped source synchronizer must exist');
    const {applyFiles}=await new Function('url','return import(url)')(require('url').pathToFileURL(script).href);
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scui-sync-test-'));
    try{
      const a=path.join(dir,'a'),b=path.join(dir,'b');fs.writeFileSync(a,'old-a');fs.writeFileSync(b,'old-b');
      const entries=[{path:a,before:'old-a',after:'new-a'},{path:b,before:'old-b',after:'new-b'}];
      fs.writeFileSync(b,'foreign');
      assert.throws(()=>applyFiles(entries),/FOREIGN_EDIT/);
      assert.strictEqual(fs.readFileSync(a,'utf8'),'old-a');
      fs.writeFileSync(b,'old-b');
      let writes=0;
      assert.throws(()=>applyFiles(entries,{writeFileSync(p,v){if(++writes===2)throw Error('disk failed');fs.writeFileSync(p,v);}}),/disk failed/);
      assert.strictEqual(fs.readFileSync(a,'utf8'),'old-a');assert.strictEqual(fs.readFileSync(b,'utf8'),'old-b');
      applyFiles(entries);assert.strictEqual(fs.readFileSync(a,'utf8'),'new-a');
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  });
});

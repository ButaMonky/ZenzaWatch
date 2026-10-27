'use strict';
// Task948: preserve actual Chrome geometry checks in private CI on every develop update.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
describe('Task948 public Chromium tooltip CI coverage',function(){
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/quality.yml'),'utf8');
  it('runs both volume and playback-rate geometry suites after the full regression',()=>{
    const legacy=workflow.indexOf('run: npm test -- --timeout 20000 --reporter dot');
    const volume=workflow.indexOf('run: node test/browser/task939-volume-tooltip.cjs');
    const rate=workflow.indexOf('run: node test/browser/task947-speed-tooltip.cjs');
    assert(legacy>=0&&volume>legacy&&rate>volume,'browser regressions missing or out of order');
    assert.strictEqual(workflow.split('run: node test/browser/task947-speed-tooltip.cjs').length-1,1);
  });
  it('uses a read-only public CI workflow without release or publish steps',()=>{
    assert.match(workflow,/^name: ZenzaWatch quality gates$/m);
    assert.match(workflow,/^permissions:\n  contents: read$/m);
    assert.match(workflow,/branches: \[develop\]/);
    assert.doesNotMatch(workflow,/npm publish|gh release create|git push origin/i);
  });
  it('launches both real Chrome regressions through the sandbox-safe helper',()=>{
    const launcher=fs.readFileSync(path.join(root,'test/helpers/startChromeCdp.js'),'utf8');
    assert(launcher.includes("'--no-sandbox'")&&launcher.includes("'--disable-dev-shm-usage'"));
    assert(launcher.includes('waitMs=options.waitMs ?? 30000'),'Chrome startup wait contract');
    for(const browserTest of ['task939-volume-tooltip.cjs','task947-speed-tooltip.cjs']){
      const test=fs.readFileSync(path.join(root,'test/browser',browserTest),'utf8');
      assert(test.includes("require('../helpers/startChromeCdp')"),browserTest);
      assert(test.includes('startChromeCdp(executable,profile)'),browserTest);
    }
    const test=fs.readFileSync(path.join(root,'test/browser/task947-speed-tooltip.cjs'),'utf8');
    for(const width of ['1280','640','360','300'])assert(test.includes(width),width);
    assert(test.includes('wrapped.height>22'),'long custom shortcut line wrap contract');
  });
});

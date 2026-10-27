'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {startChromeCdp}=require('../helpers/startChromeCdp');

describe('Task952: Chrome CDP startup diagnostics',function(){
  this.timeout(10000);
  it('reports the browser exit code and stderr instead of an opaque debug-port timeout',async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task952-fake-'));
    try{
      await assert.rejects(startChromeCdp(process.execPath,profile,{waitMs:3000}),error=>{
        assert.match(error.message,/Chrome CDP startup failed/);
        assert.match(error.message,/binary=node(?:\.exe)?/);
        assert.match(error.message,/exit=/);
        assert.match(error.message,/stderr=/);
        return true;
      });
      assert(!fs.existsSync(path.join(profile,'DevToolsActivePort')));
    }finally{fs.rmSync(profile,{recursive:true,force:true});}
  });
  it('reports an executable spawn error without hanging for the full timeout',async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task952-missing-'));
    try{
      await assert.rejects(startChromeCdp(path.join(profile,'missing-chrome.exe'),profile,{waitMs:500}),error=>{
        assert.match(error.message,/spawnError=.*ENOENT/);
        return true;
      });
    }finally{fs.rmSync(profile,{recursive:true,force:true});}
  });
});

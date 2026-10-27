'use strict';
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {inferBuildChannel}=require('../helpers/buildSandbox');

describe('Task955 isolated userscript build channel parity',()=>{
  it('keeps the private channel in a copied worktree without .git',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zw955-private-'));
    try {
      fs.mkdirSync(path.join(dir,'dist'));
      fs.writeFileSync(path.join(dir,'dist','ZenzaWatch-dev.user.js'),
        '// ==UserScript==\n// @downloadURL    https://github.com/ButaMonky/ZenzaWatch-Back-up/raw/develop/dist/ZenzaWatch-dev.user.js\n// ==/UserScript==');
      assert.strictEqual(inferBuildChannel(dir),'private');
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
  });
  it('keeps public-channel and missing metadata public',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zw955-public-'));
    try {
      assert.strictEqual(inferBuildChannel(dir),'public');
      fs.mkdirSync(path.join(dir,'dist'));
      fs.writeFileSync(path.join(dir,'dist','ZenzaWatch-dev.user.js'),
        '// @downloadURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaWatch-dev.user.js\n');
      assert.strictEqual(inferBuildChannel(dir),'public');
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
  });
  it('does not trust misleading private repo URL in ordinary text',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zw955-spoof-'));
    try {
      fs.mkdirSync(path.join(dir,'dist'));
      fs.writeFileSync(path.join(dir,'dist','ZenzaWatch-dev.user.js'),
        '// @homepageURL https://github.com/ButaMonky/ZenzaWatch-Back-up\n// @downloadURL https://example.test/file.user.js\n');
      assert.strictEqual(inferBuildChannel(dir),'public');
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
  });
});

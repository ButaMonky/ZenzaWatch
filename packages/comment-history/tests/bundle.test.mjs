import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('userscript registers three manual menus and makes no automatic network requests',()=>{
 const code=fs.readFileSync(new URL('../dist/NicoCommentHistory-Probe.user.js',import.meta.url),'utf8');
 let network=0;const menus=[];const context={GM_registerMenuCommand:(title,fn)=>menus.push({title,fn}),
   window:{addEventListener:()=>{}},fetch:()=>{network++;throw Error('Unexpected automatic network request');},console};
 vm.runInNewContext(code,context);assert.equal(menus.length,3);assert.equal(network,0);
 assert(menus[0].title.includes('最大5回'));assert(menus[1].title.includes('中止'));assert(menus[2].title.includes('JSON'));
});
test('bundle has no remote dependencies or posting/deletion endpoints',()=>{
 const code=fs.readFileSync(new URL('../dist/NicoCommentHistory-Probe.user.js',import.meta.url),'utf8');
 assert(!/@require\s+https?:/.test(code));assert(!code.includes('/easy-comments'));assert(!code.includes('/comment-comment-owner-deletions'));
 assert(!code.includes('eval('));assert(!code.includes('innerHTML'));
});

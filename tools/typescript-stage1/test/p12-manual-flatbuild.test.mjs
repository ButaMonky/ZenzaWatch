import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const names=['ManualBookmarkPolicy','ManualBookmarkStore','ManualBookmarkSession',
 'ManualBookmarkVirtualList','ManualBookmarkPanel','ManualBookmarkDock'];
const source=n=>fs.readFileSync(path.join(root,
 'packages/zenza/src/resume/'+n+'.js'),'utf8');
const body=code=>{
 const start=code.indexOf('//===BEGIN==='),end=code.indexOf('//===END===');
 assert(start>=0&&end>start);
 return code.slice(start+'//===BEGIN==='.length,end)
  .split('\n').filter(line=>!/^\/\/@require /.test(line)).join('\n');
};
test('legacy flat userscript can parse six independent manual modules without helper collisions',()=>{
 const contents=names.map(source);
 const parts=contents.map(body);
 const js=parts.join('\n')+
  '\n;globalThis.__classes={ManualBookmarkSession,ManualBookmarkDock,'+
  'ManualBookmarkRepository,IndexedDbManualBookmarkBackend,ManualBookmarkVirtualList,'+
  'addManualBookmark,normalizeManualBookmarks};';
 const context={};
 vm.runInNewContext(js,context,{timeout:1200,filename:'manual-bookmark-flat-userscript.js'});
 assert.deepEqual(Object.keys(context.__classes).length,7);
 for(const [name,value] of Object.entries(context.__classes)){
  assert.equal(typeof value,'function',name);
 }
 const store=contents[1],dock=contents[5];
 assert(store.includes('//@require normalizeManualBookmarks'));
 assert(dock.includes('//@require ManualBookmarkPanel'));
 assert.equal(contents.filter(x=>x.includes('import {')).length,3);
});

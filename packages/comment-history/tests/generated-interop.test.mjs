import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('Zenza generated modules expose named APIs to the existing Node/Babel test loader',()=>{
 const core=require('../src/generated/ZenzaCommentHistoryCore.generated.js');
 const settings=require('../src/generated/ZenzaCommentHistorySettings.generated.js');
 assert.equal(typeof core.ZenzaCommentHistoryCore?.CommentHistoryRenderer,'function');
 assert.equal(typeof core.ZenzaCommentHistoryCore?.createHistoryFeature,'function');
 assert.equal(typeof settings.ZenzaCommentHistorySettings?.mountHistorySettings,'function');
});

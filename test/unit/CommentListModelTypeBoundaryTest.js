'use strict';
// Task188: the comment list's numeric generations and sort keys must not drift
// back to untyped JavaScript-shaped fields as the legacy TS migration continues.
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const source=fs.readFileSync(path.resolve(
  __dirname,'../../tools/typescript-stage1/nico-src/CommentPanel.ts'),'utf8');

describe('Task188 comment list state TypeScript ownership',()=>{
  it('keeps model reading epochs, time and indexes numerical',()=>{
    const model=source.slice(source.indexOf('class CommentListModel'),
      source.indexOf('class CommentListView'));
    for(const name of ['_currentIndex','_currentTime','_maxItems','_readingEpoch']){
      assert(model.includes('declare '+name+': number;'),name+' must be a number');
    }
    assert(model.includes('declare _positions: number[];'));
    assert(model.includes('declare _currentSortKey: ZenzaCommentSortKey;'));
    assert(model.includes('declare _isDesc: boolean;'));
    assert(model.includes('sortBy(key?: ZenzaCommentSortKey, isDesc?: boolean)'));
  });
  it('keeps the view render generation and cleared reading epoch typed',()=>{
    const view=source.slice(source.indexOf('class CommentListView'),
      source.indexOf('class CommentListItem'));
    assert(view.includes('declare _modelUpdateVersion: number;'));
    assert(view.includes('declare _readingEpoch: number | undefined;'));
    assert(source.includes("import type {ZenzaCommentSortKey, ZenzaCommentReadingModelPort} from './CommentReadTypes';"));
  });
});

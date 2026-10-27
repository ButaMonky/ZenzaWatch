// Compile-only Task521 API contract for normal and historical layers.
import {
  LayeredCommentStore,type LayerAppendResult,
  type LayerSnapshotOptions,type LayerCounts
} from './layers-src/layers';
import type {CommentContext,CommentThread} from './layers-src/core.mjs';

const context:CommentContext={
  videoId:'sm9',
  language:'ja-jp',
  server:'https://public.nvcomment.nicovideo.jp',
  targets:[{id:'100',fork:'main'}]
};
const comments:CommentThread[]=[{
  id:'100',fork:'main',commentCount:1,
  comments:[{id:'c1',no:1,vposMs:2000,body:'ok',
    commands:[],userId:'user',postedAt:'2020-01-01T00:00:00Z'}]
}];
const store=new LayeredCommentStore(context);
const normal:LayerAppendResult=store.addNormal(comments);
const historical:LayerAppendResult=store.addHistory(comments,100);
const totals:LayerCounts=store.counts();
const options:LayerSnapshotOptions={
  historyEnabled:true,historyOnly:false,historyLimit:100
};
const snapshot:CommentThread[]=store.snapshot(options);
const order:string[]=store.additionalOrder();
store.restoreAdditionalOrder(order);
const historicalSnapshot:CommentThread[]=store.historySnapshot();
store.removeHistory();
void normal;void historical;void totals;void snapshot;void historicalSnapshot;
// @ts-expect-error addHistory requires threads array.
store.addHistory(3);
// @ts-expect-error historyLimit must be an integer value, not text.
store.snapshot({historyLimit:'unlimited'});
// @ts-expect-error videoId and language are required.
new LayeredCommentStore({targets:[]});
// @ts-expect-error invalid option names are rejected.
store.snapshot({historyDone:true});

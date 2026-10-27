import type {NicoCommentSlotRow,NicoCommentSlotReply,
  NicoCommentGroupContract,NicoCommentViewModelContract
} from '../comment-src/NicoCommentViewModel';
const item:NicoCommentSlotRow={id:'chat-77',slot:0,begin:1,end:5,fork:1,no:77};
const reply:NicoCommentSlotReply={
  lastUpdate:42,top:[item],naka:[],bottom:[]
};
const group:NicoCommentGroupContract={
  _members:[],_execCommentLayoutWorker:async()=>true,reset(){},
  bulkSlotData:[item],bulkLayoutData:[],export:()=>'<group/>'
};
declare const vm:NicoCommentViewModelContract;
const sec:number=vm.currentTime;
void sec;void reply;void group;
// @ts-expect-error Malformed RPC slot index should be a TypeScript error.
const bad:NicoCommentSlotRow={...item,slot:'0'};
void bad;

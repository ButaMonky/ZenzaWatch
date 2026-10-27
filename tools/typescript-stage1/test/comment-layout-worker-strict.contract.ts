import type {CommentLayoutMember,CommentLayoutWorkerMessage,
  CommentLayoutParams,CommentLayoutWorkerScope} from '../comment-src/CommentLayoutWorker';
const member: CommentLayoutMember={
  id:'sm1',layerId:0,type:'naka',isFixed:false,isOverflow:false,
  isInvisible:false,height:25,ypos:0,beginLeft:0,beginRight:1,
  endLeft:4,endRight:5
};
const request: CommentLayoutWorkerMessage={
  command:'layout',params:{type:'naka',members:[member],lastUpdate:12}
};
const scope: CommentLayoutWorkerScope={onmessage: message => message.params};
const reply: CommentLayoutParams|undefined=scope.onmessage?.(request);
void reply;
// @ts-expect-error A non-numeric collision coordinate is rejected.
const invalid: CommentLayoutMember={...member,beginLeft:'0'};
void invalid;

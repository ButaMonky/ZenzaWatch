// Task576: budget admission is typed separately from the fetched/retained list.
import {CommentDisplayBudget,
  type CommentBudgetCandidate,
  type CommentBudgetOptions,
  type CommentBudgetResult
} from '../comment-src/CommentDisplayBudget';

const a:CommentBudgetCandidate={beginLeftTiming:100,fork:0};
const b:CommentBudgetCandidate={beginLeftTiming:200,fork:2,isMine:false};
const options:CommentBudgetOptions<CommentBudgetCandidate>={
  limit:200,liveCount:10,
  groupOf:chat=>chat.fork,
  tierOf:chat=>CommentDisplayBudget.tierOf(chat)
};
const result:CommentBudgetResult<CommentBudgetCandidate>=
  CommentDisplayBudget.admit([a,b],options);
const admitted:CommentBudgetCandidate[]=result.admitted;
const suppressed:number=result.suppressed.length;
const normal:boolean=CommentDisplayBudget.isValidLimit(200);
void admitted;void suppressed;void normal;

// @ts-expect-error comment render timing must be a number
const invalid:CommentBudgetCandidate={beginLeftTiming:'soon'};
// @ts-expect-error tierOf must return numeric priority, not a boolean
CommentDisplayBudget.admit([a],{tierOf:()=>false});
void invalid;

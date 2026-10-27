// Task590: synthetic normalized chat and NG filter type contract.
import {
  NicoChatFilter,
  type NicoChatFilterOptions,
  type NicoFilterEvaluatedChat,
  type NicoCompositeProgramState,
  type NicoCompositeDisplayState
} from '../packages/zenza/src/commentLayer/NicoChatFilter';

const settings:NicoChatFilterOptions={
  wordFilter:'blocked',enableFilter:true,sharedNgLevel:'MID',
  fork0:true,defaultThread:true
};
const row:NicoFilterEvaluatedChat={
  fork:0,score:0,text:'コメント',cmd:'',type:'naka',vpos:250,
  userId:'synthetic-user',threadLabel:'default'
};
const filter=new NicoChatFilter(settings);
const acceptable:NicoFilterEvaluatedChat[]=filter.applyFilter([row]);
const predicate:(chat:NicoFilterEvaluatedChat)=>boolean=filter.getFilterFunc();
const okay:boolean=predicate(row);
const safe:boolean=filter.isSafe(row);
const program:NicoCompositeProgramState={rules:[],active:[],hasAuthors:false};
const projection:NicoCompositeDisplayState={
  text:'test',cmd:'',color:'#FFFFFF',size:'medium',opacity:1,visible:true
};
void acceptable;void okay;void safe;void program;void projection;

// @ts-expect-error filters expect a Boolean activation flag.
const badSettings:NicoChatFilterOptions={enableFilter:'yes'};
// @ts-expect-error a normalized chat must supply its score and command.
filter.applyFilter([{fork:0,text:'partial'}]);
// @ts-expect-error a projection's visible state is a boolean.
const badProjection:NicoCompositeDisplayState={...projection,visible:'not-visible'};
void badSettings;void badProjection;

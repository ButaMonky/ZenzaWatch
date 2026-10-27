import type {
  SlotLayoutCommentContract,
  SlotLayoutWorkerContract,
  SlotLayoutWorkerRequestMessage,
  SlotLayoutResponseContract
} from '../comment-src/SlotLayoutWorker';

declare const factory: SlotLayoutWorkerContract;
const rpc=factory.create();
const msg: SlotLayoutWorkerRequestMessage={
  command:'layout',
  params:{top:[{begin:1,end:3,no:0,fork:2}],naka:[],bottom:[],lastUpdate:12}
};
const result: Promise<SlotLayoutResponseContract>|undefined=rpc?.post(msg);
void result;
declare const response: SlotLayoutResponseContract;
const generation: number=response.lastUpdate;
void generation;
// @ts-expect-error Non-numeric fork cannot pass the typed comment contract.
const invalidFork: SlotLayoutCommentContract={begin:0,end:1,no:0,fork:'bad'};
// @ts-expect-error The response generation must remain numeric.
const invalidReply: SlotLayoutResponseContract={top:[],naka:[],bottom:[],lastUpdate:'wrong'};
void invalidFork;
void invalidReply;

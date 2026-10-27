// Task522 strict boundary, including negative type tests.
// No runtime execution: this file is only compiled with --noEmit.
import {
  RequestCoordinator,
  type CoordinatorStatistics,
  type RequestKind
} from './coordinator-src/coordinator.js';

const coordinator=new RequestCoordinator({
  settings:{maxRequests:10,maxRetries:2,minIntervalMs:1500},
  now:()=>125,
  sleep:async(_ms,_signal)=>{},
  random:()=>0.25
});
const result:Promise<number>=coordinator.execute(
  async ({signal,timeoutMs})=>{
    const signalOk:AbortSignal=signal;
    const duration:number=timeoutMs;
    void signalOk;
    return duration;
  },
  {kind:'metadata',onRetry:({kind,retryNumber,error,waitMs})=>{
    const typedKind:RequestKind=kind;
    const attempts:number=retryNumber;
    const code:string=error.code;
    const wait:number=waitMs;
    void typedKind;void attempts;void code;void wait;
  }}
);
const refreshed:Promise<boolean>=coordinator.refresh(async()=>true);
const statistics:CoordinatorStatistics=coordinator.stats();
void result;void refreshed;void statistics;

// @ts-expect-error request kinds are a fixed finite protocol union.
coordinator.execute(async()=>1,{kind:'other'});
// @ts-expect-error settings maxRequests must be an integer-shaped number.
new RequestCoordinator({settings:{maxRequests:'100'}});
// @ts-expect-error execute requires a callable operation.
coordinator.execute(42);
// @ts-expect-error sleep callback must return a Promise<void>.
new RequestCoordinator({sleep:()=>3});
coordinator.execute(async()=>1,{onRetry:({retryNumber})=>{
  // @ts-expect-error callback retry number is a number, not a text token.
  const text: string=retryNumber;void text;
}});

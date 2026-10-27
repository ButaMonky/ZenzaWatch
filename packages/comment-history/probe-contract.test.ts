import {
  probeCompatibility,type ProbeOptions,type ProbeReport,type ProbeStage
} from './probe-src/probe';
import type {ProbeContext} from './probe-src/core.mjs';
const context: ProbeContext={
  videoId:'sm9',
  server:'https://public.nvcomment.nicovideo.jp',
  language:'ja-jp',
  targets:[{id:'100',fork:'main'}]
};
const options:ProbeOptions={
  intervalMs:500,
  timeoutMs:2000,
  fetchPage:async (_ctx,request)=>request.targets.map(t=>({
    ...t,commentCount:0,comments:[]
  })),
  onProgress:({stage,requestNumber,maxRequests})=>{
    const stageName:ProbeStage=stage;
    const ordinal:number=requestNumber;
    const limit:5=maxRequests;
    void stageName;void ordinal;void limit;
  }
};
const result:Promise<ProbeReport>=probeCompatibility(context,options);
void result;
// @ts-expect-error A language code is required.
probeCompatibility({videoId:'sm9',targets:[]});
// @ts-expect-error interval is a number, not a CSS string.
probeCompatibility(context,{intervalMs:'5s'});
// @ts-expect-error unknown option names must not pass structural type checks.
probeCompatibility(context,{fetchUnlimited:true});
// @ts-expect-error only documented probe steps exist.
const wrongStage:ProbeStage='all_future_requests';
void wrongStage;
// @ts-expect-error target fork cannot be an arbitrary value.
const wrongContext:ProbeContext={...context,targets:[{id:'100',fork:'random'}]};
void wrongContext;

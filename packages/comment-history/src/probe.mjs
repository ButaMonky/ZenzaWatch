import {integerOption,validateThreads,summarizeThreads} from './core.mjs';
import {requestThreads,withDeadline,abortableDelay,assertNotCancelled,safeError} from './transport.mjs';

/** Up to FIVE retrieval POSTs, fail-fast, aggregate-only report. Does not enable bulk fetching. */
export async function probeCompatibility(context,options={}){
  const {fetchPage=requestThreads,signal,intervalMs=1500,timeoutMs=10000,
    nowSeconds=Math.floor(Date.now()/1000),onProgress}=options;
  integerOption(intervalMs,0,60000);integerOption(timeoutMs,1,30000);integerOption(nowSeconds,0,9999999999);
  const main=context.targets.find(t=>t.fork==='main');
  const report={schema:'nico-comment-history-probe/1',version:'0.1.0',videoId:context.videoId,language:context.language,
    startedAt:new Date().toISOString(),steps:[],reason:'finished',historyCursorProgressed:null,completeCoverageVerified:false};
  if(!main){report.reason='no_main_target';return report;}
  const stages=['baseline_all','main_only','res_from','when_now','when_oldest'];
  const union=new Set();let previous=new Set(),boundary=null;
  for(const [index,stage] of stages.entries()){
    if(stage==='when_oldest' && boundary===null){report.reason='no_boundary_sample';break;}
    const req={targets:index===0?context.targets:[main],signal};
    if(index>=2)req.resFrom=-1000;
    if(index===3)req.when=nowSeconds;
    if(index===4)req.when=boundary;
    const step={stage,targets:req.targets.map(t=>({...t})),additionals:{},ok:false};
    if(req.resFrom!==undefined)step.additionals.res_from=req.resFrom;
    if(req.when!==undefined)step.additionals.when=req.when;
    report.steps.push(step);
    try{
      if(index>0)await abortableDelay(intervalMs,signal);assertNotCancelled(signal);
      try{onProgress?.({stage,requestNumber:index+1,maxRequests:5});}catch{}
      const received=await withDeadline(s=>fetchPage(context,{...req,signal:s}),{signal,timeoutMs});
      assertNotCancelled(signal);
      const threads=validateThreads({meta:{status:200},data:{threads:received}},context,req.targets);
      const keys=new Set(threads.flatMap(t=>t.comments.map(c=>JSON.stringify([t.id,t.fork,c.no]))));
      step.ok=true;step.threads=summarizeThreads(threads);step.returnedCount=threads.reduce((sum,t)=>sum+t.comments.length,0);
      step.uniqueCount=keys.size;step.overlapWithPrevious=[...keys].filter(k=>previous.has(k)).length;
      step.newUniqueAcrossProbe=[...keys].filter(k=>!union.has(k)).length;
      for(const key of keys)union.add(key);previous=keys;
      const oldest=step.threads.find(t=>t.id===main.id && t.fork===main.fork)?.oldestUnixSeconds??null;
      if(index===3)boundary=oldest;
      if(index===4)report.historyCursorProgressed=oldest===null?null:oldest<boundary;
    }catch(e){step.error=safeError(e);report.reason=step.error.code==='CANCELLED'?'cancelled':'stopped_on_error';break;}
  }
  report.finishedAt=new Date().toISOString();
  return report;
}

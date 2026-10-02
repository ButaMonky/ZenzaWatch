import {integerOption,checkedTargets,validateThreads,CommentStore,summarizeThreads} from './core.mjs';
import {requestThreads,assertNotCancelled,withDeadline,abortableDelay,safeError} from './transport.mjs';

/** Experimental collector. Returned comments are private data; diagnostic reports use summaries only.
 * No auto-retry/token-refresh and no claim of full coverage. No baseline/normal-state mutation.
 */
export async function collectHistory(context,options={}){
  const {signal,fetchPage=requestThreads,intervalMs=1500,maxPages=5,maxComments=5000,maxElapsedMs=30000,
    startWhen=Math.floor(Date.now()/1000),onProgress}=options;
  integerOption(maxPages,1,100);integerOption(maxComments,1,50000);integerOption(maxElapsedMs,1,300000);
  integerOption(intervalMs,0,60000);integerOption(startWhen,0,9999999999);
  const targets=checkedTargets(context,options.targets??context.targets.filter(t=>t.fork==='main'));
  const store=new CommentStore(context),started=Date.now();let requests=0,pages=0,duplicates=0,reason='empty_page',error;
  const targetResults=[];
  try{
    outer:for(const target of targets){
      let cursor=startWhen;const state={...target,pages:0,nextWhen:cursor,reason:null};targetResults.push(state);
      while(true){
        assertNotCancelled(signal);
        if(requests>=maxPages){reason='page_limit';state.reason=reason;break outer;}
        if(store.size>=maxComments){reason='comment_limit';state.reason=reason;break outer;}
        let remaining=maxElapsedMs-(Date.now()-started);
        if(remaining<=0){reason='time_limit';state.reason=reason;break outer;}
        if(requests>0 && intervalMs){
          await withDeadline(s=>abortableDelay(intervalMs,s),{signal,timeoutMs:remaining,timeoutCode:'TIME_LIMIT'});
          remaining=maxElapsedMs-(Date.now()-started);if(remaining<=0){reason='time_limit';state.reason=reason;break outer;}
        }
        requests++;
        const received=await withDeadline(s=>fetchPage(context,{targets:[target],when:cursor,resFrom:-1000,signal:s}),{signal,timeoutMs:remaining,timeoutCode:'TIME_LIMIT'});
        assertNotCancelled(signal);
        // A future adapter must not be able to mix another target's response into this store.
        const threads=validateThreads({meta:{status:200},data:{threads:received}},context,[target]);
        const added=store.add(threads,maxComments-store.size);duplicates+=added.duplicates;pages++;state.pages++;
        const summary=summarizeThreads(threads)[0];
        try{onProgress?.({requests,pages,uniqueComments:store.size,duplicates,target:{...target},oldestUnixSeconds:summary.oldestUnixSeconds});}catch{}
        assertNotCancelled(signal);
        if(added.limited || store.size>=maxComments){reason='comment_limit';state.reason=reason;break outer;}
        if(!summary.returnedCount){state.reason='empty_page';break;}
        const exactOldest=threads[0].comments.reduce((oldest,c)=>Math.min(oldest,Date.parse(c.postedAt)/1000),Infinity);
        if(!Number.isInteger(exactOldest)){reason='subsecond_boundary_unverified';state.reason=reason;break outer;}
        const next=summary.oldestUnixSeconds;state.nextWhen=next;
        if(next>=cursor){reason=next===cursor?'cursor_stalled':'cursor_not_respected';state.reason=reason;break outer;}
        cursor=next;
      }
    }
  }catch(e){error=safeError(e);reason=error.code==='TIMEOUT'?'request_timeout':error.code.toLowerCase();
    if(targetResults.length)targetResults[targetResults.length-1].reason=reason;}
  return {videoId:context.videoId,language:context.language,complete:false,reason,requests,pages,
    uniqueComments:store.size,duplicates,elapsedMs:Date.now()-started,targetResults,...(error?{error}:{}),threads:store.snapshot()};
}

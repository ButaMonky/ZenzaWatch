import {HistoryError,integerOption,checkedTargets,validateThreads,summarizeThreads,withThreadKey} from './core.mjs';
import {requestThreads,requestThreadKey,assertNotCancelled,safeError} from './transport.mjs';
import {normalizeSettings} from './settings.mjs';
import {RequestCoordinator} from './coordinator.mjs';
import {LayeredCommentStore} from './layers.mjs';

const resumeIdentity=c=>JSON.stringify([c.videoId,c.language,c.server,c.targets.map(t=>[String(t.id),t.fork]).sort()]);
const RESUMABLE=new Set(['comment_limit','page_limit','request_limit','time_limit','retry_limit','cancelled','network_error','timeout','rate_limited','key_refresh_limit','token_invalid','token_expired','api_error','http_error']);

/** Read-only history session. Normal baseline stays intact; history starts from startWhen,
 * NEVER from the oldest normal comment. The server may select very old comments for baseline.
 * No renderer, posting, DOM, Zenza Config, disk cache or automatic resume dependency.
 */
export class HistorySession {
  #context;#settings;#coordinator;#store;#baseline;#fetchPage;#refreshKey;
  #controller=new AbortController();#started=false;#report;#resume;#finishedNetwork;
  constructor(context,{settings={},coordinator,baseline,resume,fetchPage=requestThreads,refreshKey=requestThreadKey}={}){
    this.#context=context;this.#settings=Object.freeze(normalizeSettings(settings));
    this.#coordinator=coordinator??new RequestCoordinator({settings:this.#settings});
    if(resume && (resume.identity!==resumeIdentity(context)||!Array.isArray(resume.history)||!Array.isArray(resume.cursors)))throw new HistoryError('CONTEXT_CHANGED');
    this.#resume=resume?JSON.parse(JSON.stringify(resume)):null;
    this.#baseline=baseline;this.#fetchPage=fetchPage;this.#refreshKey=refreshKey;
    this.#store=new LayeredCommentStore(context);
    this.#report={schema:'nico-comment-history-session/1',version:'0.2.0',videoId:context.videoId,language:context.language,
      settings:{...this.#settings},reason:'not_started',pages:0,duplicates:0,targetResults:[],
      historyCursorProgressed:false,completeCoverageVerified:false};
  }
  cancel(){this.#controller.abort();}
  removeHistory(){this.cancel();this.#store.removeHistory();}
  snapshot(options){return this.#store.snapshot(options);}
  report(){return JSON.parse(JSON.stringify({...this.#report,counts:this.#store.counts(),network:this.#finishedNetwork??this.#coordinator.stats()}));}
  /** Contains real comment data: internal continuation only, never a diagnostic export. */
  resumeData(){
    if(!this.#report.finishedAt)throw new HistoryError('OPTION');
    return {identity:resumeIdentity(this.#context),history:this.#store.historySnapshot(),order:this.#store.additionalOrder(),
      cursors:this.#report.targetResults.map(s=>({...s})),startWhen:this.#report.startWhen};
  }
  #verifyRefreshed(next){
    const previous=this.#context;
    const targetIdentity=c=>JSON.stringify(c.targets.map(t=>[String(t.id),t.fork]).sort());
    try{
      if(!next||next.videoId!==previous.videoId||next.server!==previous.server||next.language!==previous.language||
        targetIdentity(next)!==targetIdentity(previous)||typeof next.threadKey!=='string'||!next.threadKey)throw new Error();
    }catch{throw new HistoryError('CONTEXT_CHANGED');}
    return withThreadKey(previous,next.threadKey);
  }
  async #page(request,onRetry){
    const signal=this.#controller.signal;
    while(true){
      assertNotCancelled(signal);
      try{
        return await this.#coordinator.execute(async ({signal,timeoutMs})=>{
          const data=await this.#fetchPage(this.#context,{...request,signal,timeoutMs});assertNotCancelled(signal);
          return validateThreads({meta:{status:200},data:{threads:data}},this.#context,request.targets);
        },{signal,kind:'comment',onRetry});
      }catch(e){
        if(!['TOKEN_EXPIRED','TOKEN_INVALID'].includes(e?.code))throw e;
        // A failed/denied refresh propagates. It is not an instruction to log in or bypass auth.
        const next=await this.#coordinator.refresh(async options=>this.#verifyRefreshed(await this.#refreshKey(this.#context,options)),{signal,onRetry});
        assertNotCancelled(signal);this.#context=next;
      }
    }
  }
  async run({signal,startWhen=Math.floor(Date.now()/1000),onProgress}={}){
    integerOption(startWhen,0,9999999999);
    if(this.#started)throw new HistoryError('ALREADY_RUN');this.#started=true;
    this.#report.startedAt=new Date().toISOString();this.#report.startWhen=startWhen;
    const abort=()=>this.cancel();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)this.cancel();
    const localSignal=this.#controller.signal;
    const notify=extra=>{try{onProgress?.({event:'progress',...extra,pages:this.#report.pages,counts:this.#store.counts(),network:this.#coordinator.stats()});}catch{}};
    const onRetry=event=>notify({event:'retry',...event});
    try{
      assertNotCancelled(localSignal);
      const baseline=this.#baseline??await this.#page({targets:this.#context.targets},onRetry);
      assertNotCancelled(localSignal);
      const normal=this.#store.addNormal(baseline);if(normal.limited)throw new HistoryError('BASELINE_LIMIT');
      if(this.#resume){
        const restored=this.#store.addHistory(this.#resume.history,this.#settings.maxAdditionalComments);
        if(restored.limited)throw new HistoryError('OPTION');
        // Task207: keep the previous fetch order so applied subsets stay the same after continuing.
        this.#store.restoreAdditionalOrder(this.#resume.order);
      }
      notify({event:'baseline'});
      const selected=this.#context.targets.filter(t=>t.fork==='main'||this.#settings.includeEasy&&t.fork==='easy');
      if(!selected.length)this.#report.reason='no_history_target';
      const targets=selected.length?checkedTargets(this.#context,selected):[];
      this.#report.targetResults=targets.map(t=>{
        if(!this.#resume)return {...t,pages:0,nextWhen:startWhen,reason:null};
        const matches=this.#resume.cursors.filter(s=>s.id===t.id&&s.fork===t.fork);
        if(matches.length!==1)throw new HistoryError('CONTEXT_CHANGED');
        const previous=matches[0];integerOption(previous.nextWhen,0,9999999999);
        return {...t,pages:0,nextWhen:previous.nextWhen,reason:RESUMABLE.has(previous.reason)?null:previous.reason};
      });
      const states=this.#report.targetResults;let stopped=false;
      // Round-robin prevents the first selected fork from consuming every page before the next.
      while(states.some(s=>s.reason===null)&&!stopped){
        for(const state of states){
          if(state.reason!==null)continue;
          assertNotCancelled(localSignal);
          if(this.#report.pages>=this.#settings.maxPages){this.#report.reason='page_limit';stopped=true;break;}
          if(this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments){this.#report.reason='comment_limit';stopped=true;break;}
          const target={id:state.id,fork:state.fork};const cursor=state.nextWhen;
          const threads=await this.#page({targets:[target],when:cursor,resFrom:-1000},onRetry);
          assertNotCancelled(localSignal);
          const summary=summarizeThreads(threads)[0];
          state.lastPageCount=summary.returnedCount;state.oldestUnixSeconds=summary.oldestUnixSeconds;state.newestUnixSeconds=summary.newestUnixSeconds;
          this.#report.pages++;state.pages++;
          // Inspect newest too: a few ancient selected comments must not hide an ignored when.
          if(threads[0].comments.some(c=>Date.parse(c.postedAt)/1000>cursor)){
            state.reason='cursor_not_respected';this.#report.reason=state.reason;stopped=true;break;
          }
          const newestFirst=threads.map(t=>({...t,comments:[...t.comments].sort((a,b)=>Date.parse(b.postedAt)-Date.parse(a.postedAt)||b.no-a.no)}));
          const added=this.#store.addHistory(newestFirst,this.#settings.maxAdditionalComments-this.#store.counts().additionalCount);
          this.#report.duplicates+=added.duplicates;
          notify({event:'page',target,returnedCount:summary.returnedCount,added:added.added,oldestUnixSeconds:summary.oldestUnixSeconds});
          assertNotCancelled(localSignal);
          // A page cut by the allowance must be requested again on continuation (its rest is still unread).
          if(added.limited){
            state.reason='comment_limit';this.#report.reason=state.reason;stopped=true;break;
          }
          // Task207: a page consumed completely when the goal is reached still advances the cursor below, so a
          // later "fetch only the missing part" does not request (re-download) this page again.
          const reachedGoal=this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments;
          if(!summary.returnedCount){state.reason='empty_page';continue;}
          const oldest=threads[0].comments.reduce((min,c)=>Math.min(min,Date.parse(c.postedAt)/1000),Infinity);
          if(!Number.isInteger(oldest)){state.reason='subsecond_boundary_unverified';continue;}
          if(summary.oldestUnixSeconds===summary.newestUnixSeconds&&summary.returnedCount>1){
            // A timestamp-only cursor cannot establish that this second is exhausted.
            state.reason='same_second_boundary_unverified';continue;
          }
          state.nextWhen=oldest;
          if(oldest>=cursor){state.reason='cursor_stalled';continue;}
          this.#report.historyCursorProgressed=true;
          if(reachedGoal){state.reason='comment_limit';this.#report.reason=state.reason;stopped=true;break;}
          // Additional=0 is not an end condition: the first page may be entirely in baseline.
        }
      }
      if(!stopped&&states.length){
        const reasons=[...new Set(states.map(s=>s.reason))];
        this.#report.reason=reasons.length===1?reasons[0]:'target_boundaries';
        // Task207: the goal was reached on a page whose cursor could not advance safely; still a completed goal.
        if(this.#store.counts().additionalCount>=this.#settings.maxAdditionalComments)this.#report.reason='comment_limit';
      }
      for(const state of states)if(state.reason===null)state.reason=this.#report.reason;
    }catch(e){
      this.#report.error=safeError(e);this.#report.reason=this.#report.error.code.toLowerCase();
      for(const state of this.#report.targetResults)if(state.reason===null)state.reason=this.#report.reason;
    }finally{
      signal?.removeEventListener('abort',abort);this.#report.finishedAt=new Date().toISOString();
      this.#finishedNetwork=this.#coordinator.stats();
      this.#report.resumeAvailable=this.#report.targetResults.some(s=>RESUMABLE.has(s.reason));
    }
    return this.report();
  }
}

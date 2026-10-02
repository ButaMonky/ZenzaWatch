import {HistorySession} from './session.mjs';
import {createZenzaSeed,toZenzaThreads} from './zenza-context.mjs';
import {normalizeSettings} from './settings.mjs';

/** One player's lifecycle. It owns no DOM and never controls playback or posting. */
export class CommentHistoryController {
  #preferences;#render;#clear;#create;#acquire;#notify;#off;#seed;#session;#report;
  #epoch=0;#normalRevision=0;#operation;#promise=Promise.resolve();#listeners=new Set();#disposed=false;
  #state={enabled:false,phase:'idle',videoId:null,goal:0,additionalCount:0,appliedAdditional:0,normalCount:0,pages:0,reason:null,canContinue:false};
  constructor({preferences,render,clearRender,createSession=(c,o)=>new HistorySession(c,o),acquire=fn=>fn(),notify=()=>{}}={}){
    if(!preferences||[preferences.get,preferences.subscribe,render,clearRender,createSession,acquire,notify].some(f=>typeof f!=='function'))throw new TypeError('Invalid history controller dependencies');
    this.#preferences=preferences;this.#render=render;this.#clear=clearRender;this.#create=createSession;this.#acquire=acquire;this.#notify=notify;
    this.#state.enabled=preferences.get().enabled===true;
    this.#off=preferences.subscribe(snapshot=>{
      if(this.#disposed)return;
      const before=this.#state.enabled;this.#state.enabled=snapshot.enabled===true;
      if(!this.#state.enabled){this.#cancel(true);this.#emit({phase:'idle',additionalCount:0,appliedAdditional:0,pages:0,goal:0,reason:null,canContinue:false});}
      else {this.#emit({});if(!before&&this.#seed)void this.start();}
    });
  }
  get state(){return JSON.parse(JSON.stringify(this.#state));}
  subscribe(fn){this.#listeners.add(fn);fn(this.state);return()=>this.#listeners.delete(fn);}
  #emit(changes){Object.assign(this.#state,changes);for(const fn of [...this.#listeners]){try{fn(this.state);}catch{}}}
  #cancel(clear){
    this.#epoch++;this.#operation?.abort();this.#operation=null;
    this.#session?.removeHistory();this.#session=null;this.#report=null;
    if(clear){try{this.#clear();}catch{}}
  }
  invalidate(){
    this.#cancel(true);this.#seed=null;
    this.#emit({phase:'idle',videoId:null,goal:0,additionalCount:0,appliedAdditional:0,normalCount:0,pages:0,reason:null,canContinue:false});
  }
  async normalReady({videoInfo,result,generation}={}){
    if(this.#disposed)return;
    this.invalidate();
    try{
      this.#seed=createZenzaSeed({videoInfo,normalResult:result,playbackGeneration:generation,normalRevision:++this.#normalRevision});
      const normalCount=this.#seed.baseline.reduce((n,t)=>n+t.comments.length,0);
      this.#emit({videoId:this.#seed.identity.videoId,normalCount});
    }catch(error){this.#emit({phase:'unavailable',reason:typeof error?.code==='string'?error.code:'CONTEXT_CHANGED'});return;}
    if(this.#state.enabled)return this.start();
  }
  setEnabled(value){this.#preferences.setEnabled(!!value);}
  stop(){
    if(this.#state.phase==='queued'){this.#operation?.abort();}
    else this.#session?.cancel();
  }
  whenIdle(){return this.#promise;}
  more(){return this.start({more:true});}
  restart(){return this.start({restart:true});}
  start({more=false,restart=false}={}){
    if(this.#disposed||!this.#seed||!this.#state.enabled)return Promise.resolve(this.state);
    if(this.#operation)return this.#promise;
    let settings;try{settings=normalizeSettings(this.#preferences.get().settings);}catch{this.#emit({phase:'unavailable',reason:'SETTINGS_INVALID'});return Promise.resolve(this.state);}
    if(more&&this.#state.additionalCount>=20000&&this.#state.phase!=='render-error')return Promise.resolve(this.state);
    if(more&&this.#report&&!this.#report.resumeAvailable&&this.#state.phase!=='render-error')return Promise.resolve(this.state);
    const applyOnly=this.#state.phase==='render-error'&&!restart;
    const continuing=!!(more&&!restart&&this.#session&&this.#report);
    const resume=continuing?this.#session.resumeData():undefined;
    if(continuing)settings.includeEasy=this.#report.settings.includeEasy;
    const oldGoal=this.#state.goal;
    const goal=applyOnly?oldGoal:continuing?Math.min(20000,this.#state.additionalCount<oldGoal?oldGoal:oldGoal+settings.maxAdditionalComments):settings.maxAdditionalComments;
    const epoch=++this.#epoch,operation=new AbortController();this.#operation=operation;
    const current=()=>!this.#disposed&&this.#epoch===epoch&&!operation.signal.aborted&&this.#state.enabled;
    const seed=this.#seed;
    this.#emit({phase:applyOnly?'applying':'queued',goal,reason:null,canContinue:false});
    this.#promise=(async()=>{
      try{
        if(!applyOnly){
          await this.#acquire(async()=>{
            if(!current())return;
            this.#session=this.#create(seed.context,{baseline:seed.baseline,settings:{...settings,maxAdditionalComments:goal},resume});
            const session=this.#session;
            this.#emit({phase:'fetching',pages:0});
            const report=await session.run({signal:operation.signal,startWhen:resume?.startWhen??Math.floor(Date.now()/1000),onProgress:progress=>{
              if(current())this.#emit({phase:'fetching',additionalCount:progress.counts.additionalCount,pages:progress.pages,network:progress.network,
                waitingMs:progress.event==='retry'?progress.waitMs:0});
            }});
            if(!current())return;
            this.#report=report;
          },operation.signal);
        }
        if(!current()||!this.#report||!this.#session)return;
        const report=this.#report;
        this.#emit({phase:'applying',additionalCount:report.counts.additionalCount,pages:report.pages,network:report.network,waitingMs:0});
        let applied;
        try{applied=await this.#render(toZenzaThreads(seed,this.#session.snapshot({historyOnly:true})),{isCurrent:current,signal:operation.signal});}
        catch{
          if(current()){this.#emit({phase:'render-error',reason:'render_failed',canContinue:true});this.#notify('コメント増量：取得済みデータの反映に失敗しました。パネルから再試行できます。');}
          return;
        }
        if(!current())return;
        const partial=!['comment_limit','empty_page','no_history_target'].includes(report.reason);
        this.#emit({phase:partial?'partial':'ready',reason:report.reason,appliedAdditional:applied?.additionalCount??report.counts.additionalCount,
          canContinue:report.resumeAvailable&&report.counts.additionalCount<20000});
        if(partial&&report.reason!=='cancelled')this.#notify('コメント増量：一部取得で終了しました。取得済みの正常なコメントを反映しました。');
      }catch{
        if(this.#epoch===epoch&&this.#state.enabled){
          this.#emit({phase:'partial',reason:operation.signal.aborted?'cancelled':'operation_failed',canContinue:!!this.#report?.resumeAvailable});
          if(!operation.signal.aborted)this.#notify('コメント増量：取得を開始できませんでした。パネルから再試行できます。');
        }
      }finally{if(this.#epoch===epoch)this.#operation=null;}
      return this.state;
    })();
    return this.#promise;
  }
  dispose(){if(this.#disposed)return;this.#disposed=true;this.invalidate();this.#off?.();this.#listeners.clear();}
}

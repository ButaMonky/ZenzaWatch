import {HistoryError,fail} from './core.mjs';
import {normalizeSettings} from './settings.mjs';
import {withDeadline,abortableDelay,assertNotCancelled,safeError} from './transport.mjs';

/** A single serial queue and CLIENT budget shared by metadata, all forks, retries and key refresh.
 * It cannot meter the official player or unrelated scripts. Do not treat these client bounds as
 * a statement of the server's permitted request rate. Timing dependencies are injectable for tests.
 */
export class RequestCoordinator {
  #settings;#now;#sleep;#random;#start=null;#nextAllowed=0;#tail=Promise.resolve();
  #attempts=0;#successful=0;#retries=0;#keyRefreshes=0;
  #byKind={metadata:0,comment:0,key:0};
  constructor({settings={},now=()=>performance.now(),sleep=abortableDelay,random=Math.random}={}){
    this.#settings=normalizeSettings(settings);this.#now=now;this.#sleep=sleep;this.#random=random;
    if([now,sleep,random].some(f=>typeof f!=='function'))fail('OPTION');
  }
  #remaining(){return this.#settings.maxElapsedMs-(this.#now()-this.#start);}
  #check(signal){
    assertNotCancelled(signal);
    if(this.#remaining()<=0)throw new HistoryError('TIME_LIMIT');
    if(this.#attempts>=this.#settings.maxRequests)throw new HistoryError('REQUEST_LIMIT');
  }
  async #queued(work,signal){
    assertNotCancelled(signal);
    if(this.#start===null)this.#start=this.#now();
    const previous=this.#tail;let release;
    const done=new Promise(resolve=>{release=resolve;});
    // An aborted queue waiter must not allow its successor to overtake the active request.
    this.#tail=previous.catch(()=>{}).then(()=>done);
    try{
      this.#check(signal);
      await withDeadline(()=>previous,{signal,timeoutMs:Math.max(1,Math.ceil(this.#remaining())),timeoutCode:'TIME_LIMIT'});
      this.#check(signal);return await work();
    }finally{release();}
  }
  #retryable(e){
    return ['NETWORK_ERROR','TIMEOUT','RATE_LIMITED'].includes(e?.code)||
      e?.code==='HTTP_ERROR'&&[500,502,503,504].includes(e.httpStatus);
  }
  async #perform(work,{signal,kind='comment',onRetry}={}){
    if(!['metadata','comment','key'].includes(kind)||typeof work!=='function')fail('OPTION');
    let retried=0;
    while(true){
      this.#check(signal);
      const delay=Math.max(0,Math.ceil(this.#nextAllowed-this.#now()));
      if(delay>=this.#remaining())throw new HistoryError('TIME_LIMIT');
      if(delay)await withDeadline(s=>this.#sleep(delay,s),{signal,timeoutMs:Math.max(1,Math.ceil(this.#remaining())),timeoutCode:'TIME_LIMIT'});
      this.#check(signal);
      const remaining=this.#remaining(),timeoutMs=Math.min(this.#settings.requestTimeoutMs,Math.max(1,Math.ceil(remaining)));
      this.#attempts++;this.#byKind[kind]++;this.#nextAllowed=this.#now()+this.#settings.minIntervalMs;
      try{
        const result=await withDeadline(s=>work({signal:s,timeoutMs}),{signal,timeoutMs,
          timeoutCode:remaining<=this.#settings.requestTimeoutMs?'TIME_LIMIT':'TIMEOUT'});
        assertNotCancelled(signal);
        if(this.#remaining()<=0)throw new HistoryError('TIME_LIMIT');
        this.#successful++;return result;
      }catch(e){
        assertNotCancelled(signal);
        if(!this.#retryable(e))throw e;
        if(retried>=this.#settings.maxRetries)throw new HistoryError('RETRY_LIMIT',{...safeError(e),causeCode:safeError(e).code});
        this.#check(signal);
        const random=this.#random();const jitter=Number.isFinite(random)?Math.floor(Math.max(0,Math.min(1,random))*250):0;
        const exponential=1000*2**retried+jitter;
        const rateWait=e.code==='RATE_LIMITED'?(Number.isFinite(e.retryAfterMs)&&e.retryAfterMs>=0?e.retryAfterMs:60000):0;
        const waitMs=Math.ceil(Math.max(this.#settings.minIntervalMs,exponential,rateWait));
        if(waitMs>=this.#remaining())throw new HistoryError('TIME_LIMIT',{causeCode:safeError(e).code});
        this.#nextAllowed=Math.max(this.#nextAllowed,this.#now()+waitMs);
        retried++;this.#retries++;
        try{onRetry?.({kind,retryNumber:retried,waitMs,error:safeError(e)});}catch{}
      }
    }
  }
  execute(work,options={}){return this.#queued(()=>this.#perform(work,options),options.signal);}
  refresh(work,options={}){
    return this.#queued(()=>{
      if(this.#keyRefreshes>=this.#settings.maxKeyRefreshes)throw new HistoryError('KEY_REFRESH_LIMIT');
      this.#keyRefreshes++;return this.#perform(work,{...options,kind:'key'});
    },options.signal);
  }
  stats(){
    return {attempts:this.#attempts,successfulRequests:this.#successful,retries:this.#retries,keyRefreshes:this.#keyRefreshes,
      requestsByKind:{...this.#byKind},remainingRequests:Math.max(0,this.#settings.maxRequests-this.#attempts),
      elapsedMs:this.#start===null?0:Math.max(0,Math.round(this.#now()-this.#start))};
  }
}

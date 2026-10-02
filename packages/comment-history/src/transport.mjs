import {HistoryError,integerOption,buildThreadRequest,validateThreads,normalizeWatch,withThreadKey,COMMENT_ORIGIN} from './core.mjs';

export function assertNotCancelled(signal){if(signal?.aborted)throw new HistoryError('CANCELLED');}
/** Abort both real fetches and the await even when an injected transport ignores signals. */
export async function withDeadline(work,{signal,timeoutMs=10000,timeoutCode='TIMEOUT'}={}){
  integerOption(timeoutMs,1,300000);if(!['TIMEOUT','TIME_LIMIT'].includes(timeoutCode))throw new HistoryError('OPTION');assertNotCancelled(signal);
  const controller=new AbortController();let timeout=false, rejectAbort;
  const onParent=()=>controller.abort();const onAbort=()=>rejectAbort(new HistoryError(timeout?timeoutCode:'CANCELLED'));
  const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
  controller.signal.addEventListener('abort',onAbort,{once:true});signal?.addEventListener('abort',onParent,{once:true});
  const timer=setTimeout(()=>{timeout=true;controller.abort();},timeoutMs);
  try{return await Promise.race([Promise.resolve().then(()=>{assertNotCancelled(controller.signal);return work(controller.signal);}),aborted]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',onParent);controller.signal.removeEventListener('abort',onAbort);}
}
export function abortableDelay(ms,signal){
  integerOption(ms,0,300000);
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new HistoryError('CANCELLED'));return;}
    const finish=()=>{signal?.removeEventListener('abort',cancel);resolve();};
    const timer=setTimeout(finish,ms);
    function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new HistoryError('CANCELLED'));}
    signal?.addEventListener('abort',cancel,{once:true});
  });
}
async function readBoundedText(response,maxBytes,signal){
  if(!response.body)return '';
  const reader=response.body.getReader(),parts=[];let size=0,finished=false;
  const onAbort=()=>{void reader.cancel().catch(()=>{});};
  signal?.addEventListener('abort',onAbort,{once:true});
  try{
    while(true){assertNotCancelled(signal);const {done,value}=await reader.read();if(done){finished=true;break;}
      size+=value.byteLength;if(size>maxBytes)throw new HistoryError('RESPONSE_TOO_LARGE');parts.push(value);}
    const data=new Uint8Array(size);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.byteLength;}
    return new TextDecoder('utf-8',{fatal:true}).decode(data);
  }finally{signal?.removeEventListener('abort',onAbort);if(!finished){try{await reader.cancel();}catch{}}reader.releaseLock();}
}
const API_CODES=new Set(['TOO_MANY_REQUESTS','EXPIRED_TOKEN','INVALID_TOKEN','INVALID_PARAMETER','NOT_FOUND','FORBIDDEN']);
function retryAfter(header){
  if(!header)return undefined;
  if(/^\d+(?:\.\d+)?$/.test(header)){const ms=Number(header)*1000;return Number.isSafeInteger(Math.ceil(ms))?Math.ceil(ms):undefined;}
  const value=Date.parse(header);return Number.isFinite(value)?Math.max(0,value-Date.now()):undefined;
}
/** Internal bounded JSON transport. URL/init are constructed only by allowlisted wrappers below. */
async function requestJson(url,init,options={}){
  const {fetchImpl=globalThis.fetch,timeoutMs=10000,maxBytes=4*1024*1024,signal}=options;
  integerOption(maxBytes,1,8*1024*1024);if(typeof fetchImpl!=='function')throw new HistoryError('OPTION');
  try{
    return await withDeadline(async innerSignal=>{
      const response=await fetchImpl(url,{...init,signal:innerSignal});assertNotCancelled(innerSignal);
      const text=await readBoundedText(response,maxBytes,innerSignal);assertNotCancelled(innerSignal);
      let data;try{data=JSON.parse(text);}catch{}
      const raw=data?.meta?.errorCode,apiCode=API_CODES.has(raw)?raw:raw?'OTHER':undefined;
      const details={httpStatus:response.status,apiCode,retryAfterMs:retryAfter(response.headers.get('Retry-After'))};
      if(response.status===429||apiCode==='TOO_MANY_REQUESTS')throw new HistoryError('RATE_LIMITED',details);
      if(apiCode==='EXPIRED_TOKEN')throw new HistoryError('TOKEN_EXPIRED',details);
      if(apiCode==='INVALID_TOKEN')throw new HistoryError('TOKEN_INVALID',details);
      if(!response.ok)throw new HistoryError(apiCode?'API_ERROR':'HTTP_ERROR',details);
      if(!data)throw new HistoryError('INVALID_JSON',{httpStatus:response.status});
      if(data.meta?.status!==200||raw)throw new HistoryError('API_ERROR',details);
      return data;
    },{signal,timeoutMs});
  }catch(error){if(error instanceof HistoryError)throw error;throw new HistoryError('NETWORK_ERROR');}
}
export async function requestThreads(context,options={}){
  const {url,init}=buildThreadRequest(context,options);
  return validateThreads(await requestJson(url,init,options),context,options.targets??context.targets);
}
const READ_HEADERS=Object.freeze({'X-Frontend-Id':'6','X-Frontend-Version':'0','X-Niconico-Language':'ja-jp'});
function checkedVideoId(id){
  if(typeof id!=='string'||!/^(?:(?:sm|so|nm))?\d+$/.test(id))throw new HistoryError('OPTION');return id;
}
export async function requestWatchContext(videoId,options={}){
  const id=checkedVideoId(videoId);
  const data=await requestJson(`https://www.nicovideo.jp/watch/${id}?responseType=json`,
    {method:'GET',credentials:'include',cache:'no-store',redirect:'error'},options);
  return normalizeWatch(data,id);
}
export async function requestThreadKey(context,options={}){
  if(context.server!==COMMENT_ORIGIN)throw new HistoryError('SERVER_NOT_ALLOWED');
  const id=checkedVideoId(context.videoId);
  const data=await requestJson(`https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId=${id}`,
    {method:'GET',headers:{...READ_HEADERS,'X-Niconico-Language':context.language},
      credentials:'include',mode:'cors',cache:'no-store',redirect:'error'},options);
  return withThreadKey(context,data?.data?.threadKey);
}
const SAFE_CODES=new Set(['OPTION','CANCELLED','TIMEOUT','TIME_LIMIT','REQUEST_LIMIT','RETRY_LIMIT','KEY_REFRESH_LIMIT',
  'ALREADY_RUN','HISTORY_RUNNING','BASELINE_LIMIT','SETTINGS_VERSION','RATE_LIMITED','TOKEN_EXPIRED','TOKEN_INVALID',
  'API_ERROR','HTTP_ERROR','INVALID_JSON','RESPONSE_TOO_LARGE','NETWORK_ERROR','RESPONSE_SCHEMA','COMMENT_SCHEMA',
  'TARGET_SCHEMA','TARGET_NOT_ALLOWED','MISSING_TARGET','IDENTITY_CONFLICT','WATCH_SCHEMA','VIDEO_MISMATCH','MISSING_KEY',
  'SERVER_NOT_ALLOWED','CONTEXT_CHANGED','UNKNOWN_ERROR']);
export function safeError(error){
  const out={code:SAFE_CODES.has(error?.code)?error.code:'UNKNOWN_ERROR'};
  if(Number.isInteger(error?.httpStatus))out.httpStatus=error.httpStatus;
  if(API_CODES.has(error?.apiCode)||error?.apiCode==='OTHER')out.apiCode=error.apiCode;
  if(Number.isFinite(error?.retryAfterMs)&&error.retryAfterMs>=0)out.retryAfterMs=error.retryAfterMs;
  if(SAFE_CODES.has(error?.causeCode))out.causeCode=error.causeCode;
  return out;
}

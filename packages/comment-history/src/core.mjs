/** Read-only protocol and storage. No DOM, network, timers or Zenza dependency. */
export const COMMENT_ORIGIN = 'https://public.nvcomment.nicovideo.jp';
export class HistoryError extends Error {
  constructor(code, details={}) {
    super(code); this.name='HistoryError'; this.code=code;
    // Only machine codes and scalar metadata. Never preserve raw server text or fetch errors.
    for (const k of ['httpStatus','apiCode','retryAfterMs','causeCode']) if (details[k] !== undefined) this[k]=details[k];
  }
}
export function fail(code) { throw new HistoryError(code); }
export function integerOption(value,min,max) {
  if (!Number.isSafeInteger(value) || value<min || value>max) fail('OPTION');
  return value;
}
function threadId(value) {
  if (typeof value==='number' && !Number.isSafeInteger(value)) fail('TARGET_SCHEMA');
  if (!/^[0-9]+$/.test(String(value))) fail('TARGET_SCHEMA');
  return String(value);
}
function targetKey(t) {return `${t.id}:${t.fork}`;}
export function normalizeWatch(input, expectedVideoId) {
  if(input?.meta?.status!==undefined && input.meta.status!==200)fail('WATCH_SCHEMA');
  if (typeof expectedVideoId!=='string' || !/^(?:(?:sm|so|nm))?\d+$/.test(expectedVideoId)) fail('OPTION');
  const candidates=[input?.data?.response?.$watchV4?.data,input?.data?.response,
    input?.response?.$watchV4?.data,input?.response,input?.$watchV4?.data,input?.data,input];
  const w=candidates.find(x=>x?.video?.id && x?.comment?.nvComment);
  if (!w) fail('WATCH_SCHEMA');
  if (w.video.id!==expectedVideoId) fail('VIDEO_MISMATCH');
  const nv=w.comment.nvComment;
  if (nv.server!==COMMENT_ORIGIN) fail('SERVER_NOT_ALLOWED');
  if (typeof nv.threadKey!=='string' || !nv.threadKey) fail('MISSING_KEY');
  const p=nv.params;
  if (!p || !Array.isArray(p.targets) || !p.targets.length || typeof p.language!=='string' || !/^[a-z]{2}-[a-z]{2}$/i.test(p.language)) fail('WATCH_SCHEMA');
  const targets=p.targets.map(t=>{
    if (!['main','owner','easy'].includes(t.fork)) fail('TARGET_SCHEMA');
    return Object.freeze({id:threadId(t.id),fork:t.fork});
  });
  if (new Set(targets.map(targetKey)).size!==targets.length) fail('TARGET_SCHEMA');
  const ctx={videoId:expectedVideoId,server:COMMENT_ORIGIN,language:p.language,targets:Object.freeze(targets)};
  Object.defineProperty(ctx,'threadKey',{value:nv.threadKey,enumerable:false});
  return Object.freeze(ctx);
}
export function checkedTargets(context, targets=context.targets) {
  if (!Array.isArray(targets) || !targets.length) fail('OPTION');
  const allowed=new Set(context.targets.map(targetKey));
  const selected=targets.map(t=>({id:threadId(t.id),fork:t.fork}));
  if (selected.some(t=>!allowed.has(targetKey(t)))) fail('TARGET_NOT_ALLOWED');
  if (new Set(selected.map(targetKey)).size!==selected.length) fail('OPTION');
  return selected;
}
export function buildThreadRequest(context,{targets=context.targets,when,resFrom}={}) {
  if (context.server!==COMMENT_ORIGIN) fail('SERVER_NOT_ALLOWED');
  if (typeof context.threadKey!=='string' || !context.threadKey) fail('MISSING_KEY');
  const selected=checkedTargets(context,targets), additionals={};
  // Seconds, not milliseconds. 9999999999 is a client validation bound, not an API limit.
  if (when!==undefined) additionals.when=integerOption(when,0,9999999999);
  if (resFrom!==undefined) additionals.res_from=integerOption(resFrom,-1000,-1);
  return {url:`${COMMENT_ORIGIN}/v1/threads?pc=1`,init:{method:'POST',
    headers:{'Content-Type':'text/plain;charset=UTF-8','X-Frontend-Id':'6','X-Frontend-Version':'0','X-Client-Os-Type':'others'},
    mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',
    body:JSON.stringify({params:{targets:selected,language:context.language},threadKey:context.threadKey,additionals})}};
}
const FIELDS=['id','no','vposMs','body','commands','userId','isPremium','score','postedAt','nicoruCount','nicoruId','source','isMyPost','deleted'];
function copyComment(c) {
  const out={};for(const k of FIELDS) if(Object.hasOwn(c,k))out[k]=k==='commands'?[...c.commands]:c[k];
  return out;
}
function normalizeComment(c) {
  const idOk=typeof c?.id==='string' && c.id.length>0 || Number.isSafeInteger(c?.id) && c.id>=0;
  if(!c || !idOk || !Number.isSafeInteger(c.no) || c.no<0 || !Number.isFinite(c.vposMs) ||
    typeof c.body!=='string' || typeof c.userId!=='string' || !Array.isArray(c.commands) || c.commands.some(x=>typeof x!=='string') ||
    typeof c.postedAt!=='string' || !/^\d{4}-\d\d-\d\dT/.test(c.postedAt) || !Number.isFinite(Date.parse(c.postedAt)) || Date.parse(c.postedAt)<0) fail('COMMENT_SCHEMA');
  for(const k of ['isPremium','isMyPost'])if(Object.hasOwn(c,k)&&typeof c[k]!=='boolean')fail('COMMENT_SCHEMA');
  if(Object.hasOwn(c,'score')&&!Number.isFinite(c.score))fail('COMMENT_SCHEMA');
  if(Object.hasOwn(c,'nicoruCount')&&(!Number.isSafeInteger(c.nicoruCount)||c.nicoruCount<0))fail('COMMENT_SCHEMA');
  if(Object.hasOwn(c,'source')&&typeof c.source!=='string')fail('COMMENT_SCHEMA');
  if(Object.hasOwn(c,'nicoruId')&&c.nicoruId!==null&&typeof c.nicoruId!=='string'&&!(Number.isSafeInteger(c.nicoruId)&&c.nicoruId>=0))fail('COMMENT_SCHEMA');
  if(Object.hasOwn(c,'deleted')&&typeof c.deleted!=='boolean'&&!Number.isSafeInteger(c.deleted))fail('COMMENT_SCHEMA');
  const out=copyComment(c);out.id=String(c.id);return out;
}
export function validateThreads(body, context, targets=context.targets) {
  if(body?.meta?.status!==200 || body?.meta?.errorCode) fail('API_ERROR');
  if(!Array.isArray(body?.data?.threads)) fail('RESPONSE_SCHEMA');
  const selected=checkedTargets(context,targets), expected=new Set(selected.map(targetKey)), seen=new Set();
  const result=body.data.threads.map(th=>{
    const id=threadId(th.id), fork=th.fork, key=targetKey({id,fork});
    if(!expected.has(key))fail('TARGET_NOT_ALLOWED');
    if(seen.has(key))fail('RESPONSE_SCHEMA');seen.add(key);
    if(!Array.isArray(th.comments) || !Number.isSafeInteger(th.commentCount) || th.commentCount<0)fail('RESPONSE_SCHEMA');
    return {id,fork,commentCount:th.commentCount,comments:th.comments.map(normalizeComment)};
  });
  if(seen.size!==expected.size)fail('MISSING_TARGET');
  return result;
}
export class CommentStore {
  #context; #items=new Map(); #threads=new Map();
  constructor(context){this.#context=context;}
  get size(){return this.#items.size;}
  #key(t,c){return JSON.stringify([this.#context.videoId,this.#context.language,t.id,t.fork,c.no]);}
  /** allowance is the maximum NEW comments admitted by this call. Full page is checked first. */
  add(threads,allowance=Infinity) {
    if(allowance!==Infinity)integerOption(allowance,0,50000);
    if(threads.length)checkedTargets(this.#context,threads);
    const ids=new Map();
    for(const t of threads)for(const c of t.comments){
      const key=this.#key(t,c),existing=this.#items.get(key)?.comment.id??ids.get(key);
      if(existing!==undefined && existing!==c.id)fail('IDENTITY_CONFLICT');
      ids.set(key,c.id);
    }
    let added=0,duplicates=0,limited=false;
    for(const t of threads){
      const tk=targetKey(t);this.#threads.set(tk,{id:t.id,fork:t.fork,commentCount:t.commentCount});
      for(const c of t.comments){
        const key=this.#key(t,c);
        if(this.#items.has(key)){duplicates++;continue;}
        if(added>=allowance){limited=true;continue;}
        this.#items.set(key,{thread:tk,comment:copyComment(c)});added++;
      }
    }
    return {added,duplicates,limited};
  }
  snapshot(){
    const out=new Map([...this.#threads].map(([k,t])=>[k,{...t,comments:[]}]));
    for(const {thread,comment} of this.#items.values())out.get(thread).comments.push(copyComment(comment));
    return [...out.values()];
  }
}
export function summarizeThreads(threads){
  return threads.map(t=>{
    let oldest=Infinity,newest=-Infinity,minNo=Infinity,maxNo=-Infinity,prevDate=-Infinity,prevNo=-Infinity,prevVpos=-Infinity;
    let ascendingPostedAt=true,ascendingNo=true,ascendingVpos=true;
    for(const c of t.comments){const sec=Date.parse(c.postedAt)/1000;oldest=Math.min(oldest,sec);newest=Math.max(newest,sec);
      minNo=Math.min(minNo,c.no);maxNo=Math.max(maxNo,c.no);ascendingPostedAt&&=sec>=prevDate;ascendingNo&&=c.no>=prevNo;ascendingVpos&&=c.vposMs>=prevVpos;
      prevDate=sec;prevNo=c.no;prevVpos=c.vposMs;}
    return {id:t.id,fork:t.fork,commentCountField:t.commentCount,returnedCount:t.comments.length,
      oldestUnixSeconds:oldest===Infinity?null:Math.floor(oldest),newestUnixSeconds:newest===-Infinity?null:Math.floor(newest),
      minNo:minNo===Infinity?null:minNo,maxNo:maxNo===-Infinity?null:maxNo,ascendingPostedAt,ascendingNo,ascendingVpos};
  });
}
/** Clone only the authenticated context; no tokens appear in enumerable data. */
export function withThreadKey(context,key){
  if(context.server!==COMMENT_ORIGIN)fail('SERVER_NOT_ALLOWED');
  if(typeof key!=='string'||!key)fail('MISSING_KEY');
  const next={videoId:context.videoId,server:context.server,language:context.language,targets:context.targets};
  Object.defineProperty(next,'threadKey',{value:key,enumerable:false});
  return Object.freeze(next);
}

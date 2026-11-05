/**
 * P12-03: user-created bookmarks are NOT automatic resume positions.
 * Pure and storage-independent; an explicit separate bookmark store will own
 * persistence. No native marker/CSS or WatchInfoCacheDb mutation here.
 */
export type ManualBookmark=Readonly<{
  id:string;videoId:string;time:number;label:string;
  createdAt:number;updatedAt:number;
}>;
export type ManualBookmarkDraft=Readonly<{
  id:string;videoId:string;time:number;label?:string;now:number;
}>;
const MAX_PER_VIDEO=100;
const validId=(id:unknown):id is string=>
  typeof id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(id);
const validClock=(n:unknown):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const validTime=(time:unknown,duration:number):time is number=>
  typeof time==='number'&&Number.isFinite(time)&&time>=0&&
  typeof duration==='number'&&Number.isFinite(duration)&&duration>0&&
  time<duration;
const labelFor=(raw:unknown):string=>{
  const label=typeof raw==='string'?raw.trim():'';
  if(Array.from(label).length>80)throw new RangeError('Bookmark label is too long');
  return label||'無題のしおり';
};
const immutable=(items:readonly ManualBookmark[]):readonly ManualBookmark[]=>
  Object.freeze(items.map(entry=>Object.freeze({...entry})));
const forVideo=(items:readonly ManualBookmark[],videoId:string):ManualBookmark[]=> {
  if(typeof videoId!=='string'||!videoId.trim())throw new TypeError('Invalid bookmark video ID');
  return items.filter(item=>item.videoId===videoId);
};

export function normalizeManualBookmarks(raw:unknown,videoId:string,duration:number):
 readonly ManualBookmark[] {
  if(typeof videoId!=='string'||!videoId.trim()||
     typeof duration!=='number'||!Number.isFinite(duration)||duration<=0){
    return Object.freeze([]);
  }
  const result:ManualBookmark[]=[],seen=new Set<string>();
  if(!Array.isArray(raw))return Object.freeze(result);
  for(const item of raw){
    if(!item||typeof item!=='object')continue;
    const x=item as Record<string,unknown>;
    if(x.videoId!==videoId||!validId(x.id)||seen.has(x.id)||
       !validTime(x.time,duration)||!validClock(x.createdAt)||
       !validClock(x.updatedAt)||x.updatedAt<x.createdAt)continue;
    let label:string;
    try{label=labelFor(x.label);}catch{continue;}
    seen.add(x.id);
    result.push({id:x.id,videoId,time:x.time,label,
      createdAt:x.createdAt,updatedAt:x.updatedAt});
    if(result.length===MAX_PER_VIDEO)break;
  }
  return immutable(result);
}

export function addManualBookmark(existing:readonly ManualBookmark[],
 draft:ManualBookmarkDraft,duration:number):readonly ManualBookmark[] {
  const previous=forVideo(existing,draft.videoId);
  if(!validId(draft.id)||!validTime(draft.time,duration)||
     !validClock(draft.now))throw new TypeError('Invalid bookmark draft');
  if(previous.some(item=>item.id===draft.id))throw new RangeError('Duplicate bookmark ID');
  if(previous.length>=MAX_PER_VIDEO)throw new RangeError('Bookmark limit reached');
  const created:ManualBookmark={id:draft.id,videoId:draft.videoId,
   time:draft.time,label:labelFor(draft.label),
   createdAt:draft.now,updatedAt:draft.now};
  // Reject another video mixed into an existing per-video record.
  if(previous.length!==existing.length)throw new TypeError('Mixed bookmark video IDs');
  return immutable([...existing,created]);
}

export function renameManualBookmark(existing:readonly ManualBookmark[],
 videoId:string,id:string,label:string,now:number):readonly ManualBookmark[] {
  const previous=forVideo(existing,videoId);
  if(previous.length!==existing.length||!validId(id)||!validClock(now))
    throw new TypeError('Invalid bookmark update');
  const normalized=labelFor(label);
  return immutable(existing.map(entry=>
    entry.id===id?{...entry,label:normalized,updatedAt:Math.max(now,entry.updatedAt,entry.createdAt)}:entry));
}

export function removeManualBookmark(existing:readonly ManualBookmark[],
 videoId:string,id:string):readonly ManualBookmark[] {
  const previous=forVideo(existing,videoId);
  if(previous.length!==existing.length||!validId(id))
    throw new TypeError('Invalid bookmark delete');
  return immutable(existing.filter(entry=>entry.id!==id));
}

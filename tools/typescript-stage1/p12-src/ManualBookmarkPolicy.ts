/**
 * P12-03: user-created bookmarks are NOT automatic resume positions.
 * Pure and storage-independent; an explicit separate bookmark store will own
 * persistence. No native marker/CSS or WatchInfoCacheDb mutation here.
 */
export type ManualBookmark=Readonly<{
  id:string;videoId:string;time:number;endTime?:number;label:string;
  createdAt:number;updatedAt:number;
}>;
export type ManualBookmarkDraft=Readonly<{
  id:string;videoId:string;time:number;endTime?:number;label?:string;now:number;
}>;
export type ManualBookmarkChanges=Readonly<{time:number;endTime?:number;label:string}>;
const MAX_PER_VIDEO=100;
const validId=(id:unknown):id is string=>
  typeof id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(id);
const validClock=(n:unknown):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
// Stored bookmarks must remain valid even if the current video's duration shrinks.
// A duration bound is enforced only when creating a new bookmark or seeking.
const validTime=(time:unknown,duration?:number):time is number=>
  typeof time==='number'&&Number.isFinite(time)&&time>=0&&
  (duration===undefined||(typeof duration==='number'&&
  Number.isFinite(duration)&&duration>0&&time<duration));
const validEnd=(time:number,end:unknown,duration?:number):boolean=>
  end===undefined||(typeof end==='number'&&Number.isFinite(end)&&end>time&&
  (duration===undefined||(end-time>=0.25&&end<=duration)));
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
       !validTime(x.time)||!validEnd(x.time,x.endTime)||!validClock(x.createdAt)||
       !validClock(x.updatedAt)||x.updatedAt<x.createdAt)continue;
    let label:string;
    try{label=labelFor(x.label);}catch{continue;}
    seen.add(x.id);
    result.push({id:x.id,videoId,time:x.time,label,
      ...(x.endTime===undefined?{}:{endTime:x.endTime as number}),
      createdAt:x.createdAt,updatedAt:x.updatedAt});
    if(result.length===MAX_PER_VIDEO)break;
  }
  return immutable(result);
}

export function addManualBookmark(existing:readonly ManualBookmark[],
 draft:ManualBookmarkDraft,duration:number):readonly ManualBookmark[] {
  const previous=forVideo(existing,draft.videoId);
  if(!validId(draft.id)||!validTime(draft.time,duration)||
     !validEnd(draft.time,draft.endTime,duration)||!validClock(draft.now))throw new TypeError('Invalid bookmark draft');
  if(previous.some(item=>item.id===draft.id))throw new RangeError('Duplicate bookmark ID');
  if(previous.length>=MAX_PER_VIDEO)throw new RangeError('Bookmark limit reached');
  const created:ManualBookmark={id:draft.id,videoId:draft.videoId,
   time:draft.time,label:labelFor(draft.label),
   ...(draft.endTime===undefined?{}:{endTime:draft.endTime}),
   createdAt:draft.now,updatedAt:draft.now};
  // Reject another video mixed into an existing per-video record.
  if(previous.length!==existing.length)throw new TypeError('Mixed bookmark video IDs');
  return immutable([...existing,created]);
}

export function updateManualBookmark(existing:readonly ManualBookmark[],
 videoId:string,id:string,changes:ManualBookmarkChanges,now:number,duration:number):
 readonly ManualBookmark[] {
  const previous=forVideo(existing,videoId);
  if(previous.length!==existing.length||!validId(id)||!validClock(now)||
     !validTime(changes.time,duration)||!validEnd(changes.time,changes.endTime,duration))
    throw new TypeError('Invalid bookmark update');
  if(!previous.some(entry=>entry.id===id))throw new RangeError('Bookmark no longer exists');
  const label=labelFor(changes.label);
  return immutable(previous.map(entry=>{
    if(entry.id!==id)return entry;
    const {endTime:oldEnd,...point}=entry;
    return {...point,time:changes.time,label,
      ...(changes.endTime===undefined?{}:{endTime:changes.endTime}),
      updatedAt:Math.max(now,entry.updatedAt,entry.createdAt)};
  }));
}

export function renameManualBookmark(existing:readonly ManualBookmark[],
 videoId:string,id:string,label:string,now:number):readonly ManualBookmark[] {
  const previous=forVideo(existing,videoId);
  if(previous.length!==existing.length||!validId(id)||!validClock(now))
    throw new TypeError('Invalid bookmark update');
  // Atomic backend reads the latest items: a deleted bookmark must not
  // become a successful no-op when another tab still shows its stale ID.
  if(!previous.some(entry=>entry.id===id))
    throw new RangeError('Bookmark no longer exists');
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

/**
 * P12-01. Pure selection of ONE automatic playback position per video.
 * Server and local history remain owned by the original storage/API layers.
 * A per-video clear barrier is required to prevent old local/server positions
 * reappearing after an explicit delete or completed playback.
 *
 * This source does not write to a cache, use DOM, or issue any network call.
 */
export type AutoResumeServer = Readonly<{
  time:unknown;
  updatedAt?:unknown; // epoch milliseconds if supplied by a trusted owner
  videoId?:unknown;
}>;
export type AutoResumeLocal = Readonly<{
  time:unknown;
  now:unknown; // epoch milliseconds; newest is not necessarily first
  videoId?:unknown;
}>;
export type AutoResumeClearBarrier = Readonly<{
  at:unknown; // epoch milliseconds, recorded by the explicit clear owner
  reason:'completed'|'deleted';
  videoId?:unknown;
}>;
export type AutoResumeInput = Readonly<{
  videoId:string;
  duration:unknown;
  server?:AutoResumeServer|null;
  local?:readonly AutoResumeLocal[]|null;
  clear?:AutoResumeClearBarrier|null;
}>;
export type AutoResumeSelected = Readonly<{
  kind:'automatic';
  videoId:string;
  source:'server'|'local';
  time:number;
  recordedAt?:number;
}>;

const marginSeconds=10;
const epoch=(value:unknown):number|null=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const eligible=(time:unknown,duration:number):time is number=>
  typeof time==='number'&&Number.isFinite(time)&&
  time>marginSeconds&&time<duration-marginSeconds;
const matches=(itemVideo:unknown,videoId:string):boolean=>
  itemVideo===undefined||itemVideo===videoId;

/**
 * Apply a clear barrier conservatively. Server updates with no trustworthy
 * timestamp remain hidden after a clear. A future local point can be selected,
 * but an old server value cannot silently supersede it again.
 * Invalid barrier timestamps fail closed to avoid resurrection.
 */
export function selectAutoResume(input:AutoResumeInput):AutoResumeSelected|null {
  if(!input||typeof input.videoId!=='string'||!input.videoId.trim())return null;
  const {videoId,duration,server,local,clear}=input;
  if(typeof duration!=='number'||!Number.isFinite(duration)||
     duration<=marginSeconds*2)return null;
  if(clear&&clear.videoId!==undefined&&!matches(clear.videoId,videoId))return null;
  const barrier=clear?epoch(clear.at):null;
  if(clear&&barrier===null)return null;

  const serverTime=server&&matches(server.videoId,videoId)&&
    eligible(server.time,duration)?server.time:null;
  const serverDate=server?epoch(server.updatedAt):null;
  if(serverTime!==null&&(barrier===null||
    serverDate!==null&&serverDate>barrier)){
    const selected:AutoResumeSelected={
      kind:'automatic',videoId,source:'server',time:serverTime,
      ...(serverDate===null?{}:{recordedAt:serverDate})
    };
    return Object.freeze(selected);
  }

  let latest:AutoResumeLocal|null=null;
  let latestAt=-1;
  if(Array.isArray(local)){
    for(const candidate of local){
      if(!candidate||!matches(candidate.videoId,videoId)||
         !eligible(candidate.time,duration))continue;
      const at=epoch(candidate.now);
      if(at===null||(barrier!==null&&at<=barrier))continue;
      // Stable tie: the first point wins when timestamps are the same.
      if(at>latestAt){latest=candidate;latestAt=at;}
    }
  }
  if(!latest)return null;
  return Object.freeze({
    kind:'automatic',videoId,source:'local',
    time:latest.time as number,recordedAt:latestAt
  });
}

/**
 * P12-03: UI-independent manual-bookmark session owner.
 * A scene switch invalidates delayed responses from the previous video.
 * It owns subscriptions only, never native seekbar or automatic resume state.
 */
import type {ManualBookmark,ManualBookmarkDraft,ManualBookmarkChanges} from './ManualBookmarkPolicy.ts';

export interface ManualBookmarkSessionRepository {
  load(videoId:string,duration:number):Promise<readonly ManualBookmark[]>;
  add(draft:ManualBookmarkDraft,duration:number):Promise<readonly ManualBookmark[]>;
  update?(videoId:string,id:string,changes:ManualBookmarkChanges,now:number,duration:number):
    Promise<readonly ManualBookmark[]>;
  rename(videoId:string,id:string,label:string,now:number,duration:number):
    Promise<readonly ManualBookmark[]>;
  remove(videoId:string,id:string,duration:number):Promise<readonly ManualBookmark[]>;
  close():void;
}
export type BookmarkPanelStatus='idle'|'loading'|'ready'|'error';
export type ManualBookmarkPanelSnapshot=Readonly<{
  status:BookmarkPanelStatus;
  videoId:string|null;
  bookmarks:readonly ManualBookmark[];
}>;
export type ManualBookmarkActionResult=Readonly<{
  status:'applied'|'stale'|'error';
  snapshot:ManualBookmarkPanelSnapshot;
}>;
type OnSnapshot=(value:ManualBookmarkPanelSnapshot)=>void;
const empty=Object.freeze([]) as readonly ManualBookmark[];
const valid=(id:unknown,duration:number):id is string=>
  typeof id==='string'&&id.trim().length>0&&id.length<=256&&
  Number.isFinite(duration)&&duration>0;
const immutable=(rows:readonly ManualBookmark[]):readonly ManualBookmark[]=>
  Object.freeze(rows.map(entry=>Object.freeze({...entry})));
const makeState=(status:BookmarkPanelStatus,videoId:string|null,
  bookmarks:readonly ManualBookmark[]):ManualBookmarkPanelSnapshot=>
  Object.freeze({status,videoId,bookmarks:immutable(bookmarks)});
export class ManualBookmarkSession {
  private readonly repository:ManualBookmarkSessionRepository;
  private readonly listeners=new Set<OnSnapshot>();
  /** Broadcast only invalidation, never video IDs or bookmark content. */
  private readonly changeChannel:BroadcastChannel|null;
  private current:Readonly<{videoId:string;duration:number}>|null=null;
  private generation=0;
  private latestAction=0;
  private activating:Promise<ManualBookmarkActionResult>|null=null;
  private failedAction:number|null=null;
  private readbackRevision=0;
  /** A background read must never overwrite an unfinished local edit. */
  private inFlightWrites=0;
  private refreshing:Promise<ManualBookmarkActionResult>|null=null;
  private peerRefreshPending=false;
  private disposed=false;
  private failedLoad=false;
  private state:ManualBookmarkPanelSnapshot=makeState('idle',null,empty);
  constructor(repository:ManualBookmarkSessionRepository){
    this.repository=repository;
    let channel:BroadcastChannel|null=null;
    try{
      if(typeof window!=='undefined'&&typeof window.BroadcastChannel==='function'){
        channel=new window.BroadcastChannel('zenza-manual-bookmarks-v1');
        channel.onmessage=event=>{
          if(event?.data?.kind!=='changed')return;
          this.peerRefreshPending=true;
          this.drainPeerRefresh();
        };
      }
    }catch{/* Unsupported sandbox/origin: Dock focus/reopen remains the fallback. */}
    this.changeChannel=channel;
  }
  /** Coalesce peer invalidations, but never lose one behind an older read/write. */
  private drainPeerRefresh():void{
    if(!this.peerRefreshPending||this.disposed||!this.current||
       this.state.status!=='ready'||this.inFlightWrites!==0||
       this.activating!==null||this.refreshing!==null)return;
    this.peerRefreshPending=false;
    void this.refreshIfIdle();
  }
  private notifyOtherTabs():void{
    try{this.changeChannel?.postMessage({kind:'changed'});}
    catch{/* Never turn a successful bookmark write into a notification error. */}
  }
  /** Library writes share this invalidation path only after storage commits. */
  notifyCommittedChange():void{
    if(this.disposed)return;
    this.notifyOtherTabs();
    this.peerRefreshPending=true;
    this.drainPeerRefresh();
  }
  get snapshot():ManualBookmarkPanelSnapshot{return this.state;}
  /** Only initial load failures may be retried on Dock open; write failures keep drafts. */
  get needsLoadRetry():boolean{return !this.disposed&&this.failedLoad&&this.state.status==='error';}
  subscribe(listener:OnSnapshot):()=>void {
    if(this.disposed)throw new Error('Bookmark session disposed');
    this.listeners.add(listener);
    try{listener(this.state);}catch{/* UI observer cannot stop persistence. */}
    return ()=>this.listeners.delete(listener);
  }
  private publishState(status:BookmarkPanelStatus,videoId:string|null,
    bookmarks:readonly ManualBookmark[]):ManualBookmarkPanelSnapshot {
    this.state=makeState(status,videoId,bookmarks);
    for(const notify of this.listeners){
      try{notify(this.state);}catch{/* Isolate failing view observers. */}
    }
    return this.state;
  }
  private isCurrent(generation:number,videoId:string):boolean {
    return !this.disposed&&this.generation===generation&&
      this.current?.videoId===videoId;
  }
  activate(videoId:string,duration:number):Promise<ManualBookmarkActionResult> {
    if(this.disposed)return Promise.reject(new Error('Bookmark session disposed'));
    if(!valid(videoId,duration))return Promise.reject(new TypeError('Invalid bookmark video session'));
    // Multiple videoInfo notifications for the same loaded playback must not
    // invalidate a pending bookmark write or replace an unsaved panel draft.
    if(this.current?.videoId===videoId&&this.current.duration===duration&&
       this.state.status!=='error'){
      return this.activating??Promise.resolve(
        Object.freeze({status:'applied',snapshot:this.state}));
    }
    const generation=++this.generation;
    this.current=Object.freeze({videoId,duration});
    this.latestAction=0;
    this.failedAction=null;
    this.failedLoad=false;
    this.readbackRevision++;
    // Publish the in-flight owner before synchronous loading observers run.
    // An observer can re-enter activate() or switch videos immediately.
    const activating=this.loadActivated(generation,videoId,duration);
    this.activating=activating;
    this.publishState('loading',videoId,empty);
    void activating.then(
      ()=>{if(this.activating===activating)this.activating=null;this.drainPeerRefresh();},
      ()=>{if(this.activating===activating)this.activating=null;this.drainPeerRefresh();}
    );
    return activating;
  }
  private async loadActivated(generation:number,videoId:string,duration:number):
    Promise<ManualBookmarkActionResult> {
    try{
      const bookmarks=await this.repository.load(videoId,duration);
      if(!this.isCurrent(generation,videoId)||this.latestAction>0)
        return Object.freeze({status:'stale',snapshot:this.state});
      const snapshot=this.publishState('ready',videoId,bookmarks);
      return Object.freeze({status:'applied',snapshot});
    }catch{
      if(!this.isCurrent(generation,videoId)||this.latestAction>0)
        return Object.freeze({status:'stale',snapshot:this.state});
      this.failedLoad=true;
      const snapshot=this.publishState('error',videoId,empty);
      return Object.freeze({status:'error',snapshot});
    }
  }
  private async modify(operation:(owner:Readonly<{videoId:string;duration:number}>)=>
    Promise<readonly ManualBookmark[]>):Promise<ManualBookmarkActionResult> {
    if(this.disposed)throw new Error('Bookmark session disposed');
    const owner=this.current;
    if(!owner)throw new Error('No active bookmark video');
    const generation=this.generation;
    const action=++this.latestAction;
    this.inFlightWrites++;
    this.failedLoad=false;
    this.failedAction=null;
    this.readbackRevision++;
    try{
      const rows=await operation(owner);
      // A committed write still belongs to shared storage even if this tab
      // has already switched video. Notify peers without exposing the ID.
      this.notifyOtherTabs();
      if(!this.isCurrent(generation,owner.videoId))
        return Object.freeze({status:'stale',snapshot:this.state});
      if(this.latestAction!==action){
        // An earlier write can finish after a newer edit has already failed.
        // Its committed result must not remain invisible until reactivation.
        const failedAction=this.failedAction;
        if(failedAction!==null&&failedAction===this.latestAction){
          const revision=++this.readbackRevision;
          try{
            const committed=await this.repository.load(owner.videoId,owner.duration);
            if(this.isCurrent(generation,owner.videoId)&&
               this.latestAction===failedAction&&this.failedAction===failedAction&&
               this.readbackRevision===revision){
              this.publishState('error',owner.videoId,committed);
            }
          }catch{/* Preserve the last visible state without disclosing errors. */}
        }
        return Object.freeze({status:'stale',snapshot:this.state});
      }
      const snapshot=this.publishState('ready',owner.videoId,rows);
      return Object.freeze({status:'applied',snapshot});
    }catch{
      if(!this.isCurrent(generation,owner.videoId)||this.latestAction!==action)
        return Object.freeze({status:'stale',snapshot:this.state});
      // Earlier commits may complete before or after this recovery read.
      // A later read supersedes a stale recovery snapshot, not a real write.
      this.failedAction=action;
      const revision=++this.readbackRevision;
      let bookmarks=this.state.bookmarks;
      try{bookmarks=await this.repository.load(owner.videoId,owner.duration);}
      catch{/* Keep the last visible state if readback is unavailable. */}
      if(!this.isCurrent(generation,owner.videoId)||this.latestAction!==action)
        return Object.freeze({status:'stale',snapshot:this.state});
      if(this.readbackRevision!==revision)
        return Object.freeze({status:'error',snapshot:this.state});
      const snapshot=this.publishState('error',owner.videoId,bookmarks);
      return Object.freeze({status:'error',snapshot});
    }finally{
      this.inFlightWrites--;
      this.drainPeerRefresh();
    }
  }
  /**
   * A Dock reopen or visible-tab event checks the shared IndexedDB without
   * resetting the active video owner or discarding a pending local write.
   * Only changed records publish a new snapshot (and re-render the panel).
   */
  refreshIfIdle():Promise<ManualBookmarkActionResult>{
    const owner=this.current;
    if(this.refreshing)return this.refreshing;
    if(this.disposed||!owner||this.state.status!=='ready'||
       this.inFlightWrites!==0||this.activating!==null){
      return Promise.resolve(Object.freeze({status:'stale',snapshot:this.state}));
    }
    const generation=this.generation,action=this.latestAction;
    const revision=this.readbackRevision;
    const pending=(async():Promise<ManualBookmarkActionResult>=>{
      try{
        const rows=await this.repository.load(owner.videoId,owner.duration);
        if(!this.isCurrent(generation,owner.videoId)||
           this.latestAction!==action||this.readbackRevision!==revision||
           this.inFlightWrites!==0||this.state.status!=='ready'){
          return Object.freeze({status:'stale',snapshot:this.state});
        }
        const previous=this.state.bookmarks;
        const unchanged=previous.length===rows.length&&previous.every((old,i)=>{
          const next=rows[i];
          return next!==undefined&&old.id===next.id&&
            old.videoId===next.videoId&&old.time===next.time&&
            old.endTime===next.endTime&&old.label===next.label&&old.createdAt===next.createdAt&&
            old.updatedAt===next.updatedAt;
        });
        if(unchanged){
          return Object.freeze({status:'applied',snapshot:this.state});
        }
        const snapshot=this.publishState('ready',owner.videoId,rows);
        return Object.freeze({status:'applied',snapshot});
      }catch{
        // A background read failure must not hide previously loaded markers
        // or change an otherwise usable session to error.
        return Object.freeze({status:'error',snapshot:this.state});
      }
    })();
    this.refreshing=pending;
    void pending.then(
      ()=>{if(this.refreshing===pending)this.refreshing=null;this.drainPeerRefresh();},
      ()=>{if(this.refreshing===pending)this.refreshing=null;this.drainPeerRefresh();}
    );
    return pending;
  }
  add(id:string,time:number,now:number,label='',endTime?:number):Promise<ManualBookmarkActionResult>{
    return this.modify(owner=>this.repository.add({
      id,videoId:owner.videoId,time,now,label,...(endTime===undefined?{}:{endTime})
    },owner.duration));
  }
  update(id:string,changes:ManualBookmarkChanges,now:number):Promise<ManualBookmarkActionResult>{
    return this.modify(owner=>{
      if(!this.repository.update)return Promise.reject(new Error('Bookmark editing unavailable'));
      return this.repository.update(owner.videoId,id,changes,now,owner.duration);
    });
  }
  rename(id:string,label:string,now:number):Promise<ManualBookmarkActionResult>{
    return this.modify(owner=>this.repository.rename(
      owner.videoId,id,label,now,owner.duration));
  }
  remove(id:string):Promise<ManualBookmarkActionResult>{
    return this.modify(owner=>this.repository.remove(owner.videoId,id,owner.duration));
  }
  deactivate():void{
    if(this.disposed)return;
    this.generation++;this.latestAction=0;this.current=null;
    this.peerRefreshPending=false;
    this.failedAction=null;this.failedLoad=false;this.readbackRevision++;
    this.publishState('idle',null,empty);
  }
  dispose():void{
    if(this.disposed)return;
    this.deactivate();
    this.disposed=true;this.listeners.clear();
    try{this.changeChannel?.close();}catch{}
    this.repository.close();
  }
}

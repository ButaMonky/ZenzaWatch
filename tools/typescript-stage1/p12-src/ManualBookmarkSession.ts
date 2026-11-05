/**
 * P12-03: UI-independent manual-bookmark session owner.
 * A scene switch invalidates delayed responses from the previous video.
 * It owns subscriptions only, never native seekbar or automatic resume state.
 */
import type {ManualBookmark,ManualBookmarkDraft} from './ManualBookmarkPolicy.ts';

export interface ManualBookmarkSessionRepository {
  load(videoId:string,duration:number):Promise<readonly ManualBookmark[]>;
  add(draft:ManualBookmarkDraft,duration:number):Promise<readonly ManualBookmark[]>;
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
  private current:Readonly<{videoId:string;duration:number}>|null=null;
  private generation=0;
  private latestAction=0;
  private activating:Promise<ManualBookmarkActionResult>|null=null;
  private failedAction:number|null=null;
  private readbackRevision=0;
  private disposed=false;
  private state:ManualBookmarkPanelSnapshot=makeState('idle',null,empty);
  constructor(repository:ManualBookmarkSessionRepository){this.repository=repository;}
  get snapshot():ManualBookmarkPanelSnapshot{return this.state;}
  subscribe(listener:OnSnapshot):()=>void {
    if(this.disposed)throw new Error('Bookmark session disposed');
    this.listeners.add(listener);
    try{listener(this.state);}catch{/* UI observer cannot stop persistence. */}
    return ()=>this.listeners.delete(listener);
  }
  private update(status:BookmarkPanelStatus,videoId:string|null,
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
    this.readbackRevision++;
    // Publish the in-flight owner before synchronous loading observers run.
    // An observer can re-enter activate() or switch videos immediately.
    const activating=this.loadActivated(generation,videoId,duration);
    this.activating=activating;
    this.update('loading',videoId,empty);
    void activating.then(
      ()=>{if(this.activating===activating)this.activating=null;},
      ()=>{if(this.activating===activating)this.activating=null;}
    );
    return activating;
  }
  private async loadActivated(generation:number,videoId:string,duration:number):
    Promise<ManualBookmarkActionResult> {
    try{
      const bookmarks=await this.repository.load(videoId,duration);
      if(!this.isCurrent(generation,videoId)||this.latestAction>0)
        return Object.freeze({status:'stale',snapshot:this.state});
      const snapshot=this.update('ready',videoId,bookmarks);
      return Object.freeze({status:'applied',snapshot});
    }catch{
      if(!this.isCurrent(generation,videoId)||this.latestAction>0)
        return Object.freeze({status:'stale',snapshot:this.state});
      const snapshot=this.update('error',videoId,empty);
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
    this.failedAction=null;
    this.readbackRevision++;
    try{
      const rows=await operation(owner);
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
              this.update('error',owner.videoId,committed);
            }
          }catch{/* Preserve the last visible state without disclosing errors. */}
        }
        return Object.freeze({status:'stale',snapshot:this.state});
      }
      const snapshot=this.update('ready',owner.videoId,rows);
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
      const snapshot=this.update('error',owner.videoId,bookmarks);
      return Object.freeze({status:'error',snapshot});
    }
  }
  add(id:string,time:number,now:number,label=''):Promise<ManualBookmarkActionResult>{
    return this.modify(owner=>this.repository.add({
      id,videoId:owner.videoId,time,now,label
    },owner.duration));
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
    this.failedAction=null;this.readbackRevision++;
    this.update('idle',null,empty);
  }
  dispose():void{
    if(this.disposed)return;
    this.deactivate();
    this.disposed=true;this.listeners.clear();this.repository.close();
  }
}

/**
 * P12-03 ? independent persistence owner for user-created bookmarks.
 * NO WatchInfoCacheDb use, no session/network or automatic resume writes.
 * Native IndexedDB record mutations happen in one readwrite transaction.
 * A caller may inject an atomic backend for deterministic tests.
 */
import {normalizeManualBookmarks,addManualBookmark,
  renameManualBookmark,removeManualBookmark} from './ManualBookmarkPolicy.ts';
import type {ManualBookmark,ManualBookmarkDraft} from './ManualBookmarkPolicy.ts';

export type BookmarkUpdate=(raw:unknown)=>readonly ManualBookmark[];
export interface BookmarkAtomicBackend {
  read(videoId:string):Promise<unknown>;
  update(videoId:string,change:BookmarkUpdate):Promise<void>;
  close():void;
}
type BookmarkRow={videoId:string;items:readonly ManualBookmark[]};
const databaseName='zenzawatch-manual-bookmarks';
const storeName='bookmarks';
const validateVideoId=(value:unknown):value is string=>
  typeof value==='string'&&value.trim().length>0&&value.length<=256;

/** Uses a distinct database: watch-history garbage collection cannot erase bookmarks. */
export class IndexedDbManualBookmarkBackend implements BookmarkAtomicBackend {
  private db:IDBDatabase|null=null;
  private opening:Promise<IDBDatabase>|null=null;
  private cancelOpening:(()=>void)|null=null;
  // IDBDatabase.close() allows existing transactions to finish. Explicitly
  // abort uncommitted requests when this bookmark owner is disposed.
  private readonly activeTransactions=new Set<IDBTransaction>();
  private readonly factory:IDBFactory;
  constructor(factory:IDBFactory){this.factory=factory;}
  private open():Promise<IDBDatabase>{
    if(this.db)return Promise.resolve(this.db);
    if(this.opening)return this.opening;
    const promise=new Promise<IDBDatabase>((resolve,reject)=>{
      let request:IDBOpenDBRequest;
      try{request=this.factory.open(databaseName,1);}
      catch(error){reject(error);return;}
      let settled=false;
      const fail=(error:unknown)=>{
        if(settled)return;settled=true;reject(error);
      };
      this.cancelOpening=()=>{
        fail(new Error('Bookmark database opening cancelled'));
        try{request.transaction?.abort();}catch{}
      };
      request.onupgradeneeded=()=>{
        if(settled){
          try{request.transaction?.abort();}catch{}
          return;
        }
        try{
          const db=request.result;
          if(!db.objectStoreNames.contains(storeName)){
            db.createObjectStore(storeName,{keyPath:'videoId'});
          }
        }catch(error){
          fail(error);
          try{request.transaction?.abort();}catch{}
        }
      };
      request.onerror=()=>fail(request.error||new Error('Bookmark database open failed'));
      request.onblocked=()=>fail(new Error('Bookmark database upgrade blocked'));
      request.onsuccess=()=>{
        const db=request.result;
        if(settled){db.close();return;}
        settled=true;
        db.onversionchange=()=>{
          // A schema upgrade is a forced end to this connection's owner.
          // db.close() alone waits for transactions and can commit stale writes.
          if(this.db===db)this.close();
          else db.close();
        };
        this.db=db;
        resolve(db);
      };
    });
    this.opening=promise;
    void promise.then(
      ()=>{if(this.opening===promise){this.opening=null;this.cancelOpening=null;}},
      ()=>{if(this.opening===promise){this.opening=null;this.cancelOpening=null;}}
    );
    return promise;
  }
  async read(videoId:string):Promise<unknown>{
    if(!validateVideoId(videoId))throw new TypeError('Invalid bookmark video ID');
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      let transaction:IDBTransaction;
      try{transaction=db.transaction(storeName,'readonly');}
      catch(error){reject(error);return;}
      const req=transaction.objectStore(storeName).get(videoId);
      this.activeTransactions.add(transaction);
      let value:unknown;
      transaction.oncomplete=()=>{this.activeTransactions.delete(transaction);resolve(value);};
      transaction.onabort=()=>{this.activeTransactions.delete(transaction);
        reject(transaction.error||new Error('Bookmark read aborted'));};
      transaction.onerror=()=>{this.activeTransactions.delete(transaction);
        reject(transaction.error||new Error('Bookmark read failed'));};
      req.onerror=()=>reject(req.error||new Error('Bookmark read failed'));
      req.onsuccess=()=>{value=(req.result as BookmarkRow|undefined)?.items||[];};
    });
  }
  async update(videoId:string,change:BookmarkUpdate):Promise<void>{
    if(!validateVideoId(videoId))throw new TypeError('Invalid bookmark video ID');
    const db=await this.open();
    return new Promise<void>((resolve,reject)=>{
      let transaction:IDBTransaction;
      try{transaction=db.transaction(storeName,'readwrite');}
      catch(error){reject(error);return;}
      this.activeTransactions.add(transaction);
      let putIssued=false;
      transaction.oncomplete=()=>{
        this.activeTransactions.delete(transaction);
        if(putIssued)resolve();
        else reject(new Error('Bookmark update was not acknowledged'));
      };
      transaction.onabort=()=>{this.activeTransactions.delete(transaction);
        reject(transaction.error||new Error('Bookmark update aborted'));};
      transaction.onerror=()=>{this.activeTransactions.delete(transaction);
        reject(transaction.error||new Error('Bookmark update failed'));};
      const request=transaction.objectStore(storeName).get(videoId);
      request.onerror=()=>reject(request.error||new Error('Bookmark update read failed'));
      request.onsuccess=()=>{
        try{
          const before=(request.result as BookmarkRow|undefined)?.items||[];
          const after=change(before);
          if(!Array.isArray(after))throw new TypeError('Invalid bookmark update result');
          transaction.objectStore(storeName).put({videoId,items:after} satisfies BookmarkRow);
          putIssued=true;
        }catch(error){
          reject(error);
          try{transaction.abort();}catch{}
        }
      };
    });
  }
  close():void{
    // Invalidate this opening attempt before allowing another owner to reopen.
    // Its delayed success handler still closes the returned IDB connection.
    const cancelOpening=this.cancelOpening;
    this.cancelOpening=null;
    this.opening=null;
    cancelOpening?.();
    const db=this.db;
    this.db=null;
    // Closing an IDB connection alone does NOT roll back pending writes.
    const transactions=[...this.activeTransactions];
    this.activeTransactions.clear();
    for(const transaction of transactions){
      try{transaction.abort();}catch{/* Already committed/inactive. */}
    }
    db?.close();
  }
}

/** Enforces the per-video invariant before changing a persisted record. */
export class ManualBookmarkRepository {
  private readonly backend:BookmarkAtomicBackend;
  constructor(backend:BookmarkAtomicBackend){this.backend=backend;}
  private checked(raw:unknown,videoId:string,duration:number):readonly ManualBookmark[]{
    if(raw==null)return Object.freeze([]);
    if(!Array.isArray(raw))throw new TypeError('Corrupted bookmark record');
    const normalized=normalizeManualBookmarks(raw,videoId,duration);
    if(normalized.length!==raw.length)throw new TypeError('Corrupted bookmark record');
    return normalized;
  }
  async load(videoId:string,duration:number):Promise<readonly ManualBookmark[]>{
    if(!validateVideoId(videoId))throw new TypeError('Invalid bookmark video ID');
    return this.checked(await this.backend.read(videoId),videoId,duration);
  }
  async add(draft:ManualBookmarkDraft,duration:number):Promise<readonly ManualBookmark[]>{
    if(!validateVideoId(draft?.videoId))throw new TypeError('Invalid bookmark video ID');
    let result:readonly ManualBookmark[]=[];
    await this.backend.update(draft.videoId,raw=>{
      result=addManualBookmark(this.checked(raw,draft.videoId,duration),draft,duration);
      return result;
    });
    return result;
  }
  async rename(videoId:string,id:string,label:string,now:number,duration:number):
    Promise<readonly ManualBookmark[]> {
    if(!validateVideoId(videoId))throw new TypeError('Invalid bookmark video ID');
    let result:readonly ManualBookmark[]=[];
    await this.backend.update(videoId,raw=>{
      result=renameManualBookmark(this.checked(raw,videoId,duration),
        videoId,id,label,now);
      return result;
    });
    return result;
  }
  async remove(videoId:string,id:string,duration:number):
    Promise<readonly ManualBookmark[]> {
    if(!validateVideoId(videoId))throw new TypeError('Invalid bookmark video ID');
    let result:readonly ManualBookmark[]=[];
    await this.backend.update(videoId,raw=>{
      result=removeManualBookmark(this.checked(raw,videoId,duration),videoId,id);
      return result;
    });
    return result;
  }
  close():void{this.backend.close();}
}

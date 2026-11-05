/**
 * Owns retryable cleanup for one scene layout, independent of DOM ownership.
 * A failed cleanup remains pending even when the error callback also throws.
 * Canonical typed source; generated JS preserves the legacy runtime contract.
 */
type SceneLayoutCleanup = () => void;
type PendingCleanup = {
  cleanup:SceneLayoutCleanup;
  key:string;
  running:boolean;
  error?:unknown;
  reportError?:unknown;
};
export class SceneSearchLayoutResources {
  declare private _onError:(error:unknown,key:string)=>void;
  declare private _pending:Map<SceneLayoutCleanup,PendingCleanup>;
  constructor(onError:(error:unknown,key:string)=>void=()=>{}) {
    this._onError=onError;
    this._pending=new Map();
  }
  get pendingCount():number{return this._pending.size;}
  release(cleanup:SceneLayoutCleanup,key='scene-layout-cleanup'):boolean {
    const entry:PendingCleanup=this._pending.get(cleanup)||{cleanup,key,running:false};
    if(entry.running)return false;
    this._pending.set(cleanup,entry);
    entry.running=true;
    try{
      cleanup();
      this._pending.delete(cleanup);
      return true;
    }catch(error){
      entry.error=error;
      // Error reporting is external code too. Keep failed cleanup for retry.
      try{this._onError(error,key);}catch(reportError){entry.reportError=reportError;}
      return false;
    }finally{entry.running=false;}
  }
  retry(onlyKey?:string):boolean {
    for(const {cleanup,key} of [...this._pending.values()]){
      if(onlyKey===undefined||key===onlyKey)this.release(cleanup,key);
    }
    return ![...this._pending.values()].some(
      entry=>onlyKey===undefined||entry.key===onlyKey);
  }
}

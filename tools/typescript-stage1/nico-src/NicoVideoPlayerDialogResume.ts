/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogResume.js (Task1060: NicoVideoPlayerDialog.ts から役割ごとに分割).
 * 続きから再生（自動の再生位置の保存・削除・編集）。
 * NicoVideoPlayerDialog.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// Task1060: 本体のクラス（実行時は同じスコープにある）。
type Dialog = import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
declare const NicoVideoPlayerDialog: typeof import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
// legacy-to-ts: names provided by other bundled modules
declare const PlaybackPosition: typeof import('./PlaybackPosition').PlaybackPosition;
type AutoResumeDeleted = Readonly<{videoId:string;local:'cleared';remote:'acknowledged'|'unavailable'|'failed'|'stale-video';fullyAcknowledged:boolean;retryRemote:boolean}>;
type AutoResumeClearAgent={delete(videoId:string):Promise<AutoResumeDeleted>};
declare const AutoResumeClearCoordinator:new(deps:{
  clearLocal:(videoId:string,reason:'deleted')=>Promise<unknown>;
  saveRemoteZero?:(videoId:string,seconds:0)=>Promise<unknown>;
  isLoggedIn:()=>boolean;activeVideoId?:()=>string|null|undefined;
  activeSessionToken?:()=>unknown;
})=>AutoResumeClearAgent;
declare const WatchInfoCacheDb: typeof import('./WatchInfoCacheDb').WatchInfoCacheDb;
declare const _: import('./shared-types/Lodash').LodashSubset;
declare const util: import('./shared-types/ZenzaUtil').ZenzaUtil;

/** 続きから再生（自動の再生位置の保存・削除・編集）。 */
const NicoVideoPlayerDialogResume = {
  // A completed video's own cache key must be invalidated even when the
  // server's final zero save cannot be sent (offline or logged out).
  // Never delete the full video cache record or include its ID in error logs.
  _clearCompletedAutoResume(this: Dialog) {
    if(this._playerConfig?.getValue('resume.clearOnComplete')===false||
       this._playerConfig?.getValue('resume.recordEnabled')===false)return;
    const watchId = this._watchId;
    if (!watchId || typeof WatchInfoCacheDb.clearAutomaticResume !== 'function') return;
    try {
      Promise.resolve(WatchInfoCacheDb.clearAutomaticResume(watchId, 'completed'))
        .catch(() => console.warn('Automatic resume local clear failed'));
    } catch (_) {
      console.warn('Automatic resume local clear failed');
    }
  },
  _isAutoResumeSaveSuppressed(this: Dialog):boolean {
    if(this._playerConfig?.getValue('resume.recordEnabled')===false)return true;
    const owner=this._autoResumeSaveSuppress;
    return !!owner&&owner.videoInfo===this._videoInfo&&
      ((owner.watchId===this._watchId&&owner.requestId===this._requestId)||
       // Native pause from closing the outgoing media can arrive after open()
       // rotates the request. A newly loaded model never inherits this barrier.
       owner===this._outgoingAutoResumeSaveSuppress);
  },
  /** Delete only the current video's automatic position when explicitly requested.
   * Other watch-cache metadata and the separate manual bookmark DB are untouched.
   */
  async _editAutomaticResume(this: Dialog, seconds:number):Promise<boolean> {
    const vi=this._videoInfo,watchId=this._watchId,requestId=this._requestId;
    if(!vi||vi.watchId!==watchId||!Number.isFinite(seconds)||seconds<0||
       !Number.isFinite(vi.duration)||seconds>=vi.duration)return false;
    try{
      const record=await WatchInfoCacheDb.put(watchId as string,{currentTime:seconds,explicitResume:true});
      if(this._videoInfo!==vi||this._watchId!==watchId||this._requestId!==requestId)return false;
      if(record?.watchId!==watchId||record.resumeOverride!==seconds)return false;
      vi._cacheData={...(vi._cacheData||{}),...record};
      this._autoResumeSaveSuppress=undefined;
      this._view?.videoControlBar?.refreshAutoResumePointers?.(vi);
      return true;
    }catch{return false;}
  },
  _deleteAutomaticResume(this: Dialog):Promise<AutoResumeDeleted|null> {
    const vi=this._videoInfo;
    const watchId=this._watchId;
    if(!vi||typeof watchId!=='string'||!watchId||
       vi.watchId!==watchId){return Promise.resolve(null);}
    const owner=Object.freeze({watchId,requestId:this._requestId,videoInfo:vi});
    // Pending deletion must also suppress a racing close/pause cache append.
    this._autoResumeSaveSuppress=owner;
    if(!this._autoResumeClearCoordinator){
      this._autoResumeClearCoordinator=new AutoResumeClearCoordinator({
        clearLocal:async(videoId,reason)=>{
          const currentRequest=this._requestId;
          const currentInfo=this._videoInfo;
          const record=await WatchInfoCacheDb.clearAutomaticResume(videoId,reason);
          if(record?.watchId===videoId&&Array.isArray(record.resume)&&
             record.resume.length===0&&record.resumeClearReason==='deleted'&&
             this._watchId===videoId&&this._videoInfo?.watchId===videoId&&
             this._requestId===currentRequest&&this._videoInfo===currentInfo){
            const current=this._videoInfo;
            current._cacheData={...(current._cacheData||{}),...record};
            this._view?.videoControlBar?.refreshAutoResumePointers?.(current);
          }
          return record;
        },
        saveRemoteZero:(videoId,seconds)=>{
          const current=this._videoInfo;
          const requestId=this._requestId;
          if(!current||this._watchId!==videoId||
             current.watchId!==videoId){
            throw new Error('Automatic resume video changed');
          }
          return this._queuePlaybackPositionSave(current.videoId,()=>{
            // A previous PUT may keep this operation queued across open/close.
            // Recheck the same playback owner before dispatching the clear.
            if(this._requestId!==requestId||this._videoInfo!==current||
               this._watchId!==videoId){
              throw new Error('Automatic resume video changed');
            }
            return PlaybackPosition.record(
              current.videoId,seconds,current.msgInfo.frontendId,
              current.msgInfo.frontendVersion);
          });
        },
        isLoggedIn:()=>util.isLogin(),
        activeVideoId:()=>this._watchId,
        activeSessionToken:()=>this._requestId
      });
    }
    const isCurrent=()=>this._watchId===owner.watchId&&
      this._requestId===owner.requestId&&this._videoInfo===owner.videoInfo;
    return this._autoResumeClearCoordinator.delete(watchId).then(result=>{
      // Completion must only be announced for the same playback generation.
      if(isCurrent()&&result.remote!=='stale-video'){
        const message=result.fullyAcknowledged?
          '「ここまで見た」の自動位置を削除しました':
          result.remote==='unavailable'?
            'この端末の自動位置を削除しました。サーバー側は未確認です':
            'この端末の自動位置を削除しました。サーバー側の削除は未確認です';
        try{this.execCommand('notify',message);}catch{}
      }
      return result;
    },():null=>{
      // A failed local clear is not a committed deletion; restore ordinary saves.
      if(this._autoResumeSaveSuppress===owner)this._autoResumeSaveSuppress=undefined;
      if(isCurrent()){
        try{this.execCommand('alert','自動位置を削除できませんでした');}catch{}
      }
      // Never log the watch ID, server response, tokens or private paths.
      window.console.warn('Automatic resume delete failed');
      return null;
    });
  },
  // Task178 (F10): ordinary saves (pause etc.) stay throttled, but the final save of a
  // video (ended -> 0, close, switching to another video) must not be dropped by the
  // throttle window that a pause right before it consumed.
  _bindPlaybackPositionSavers(this: Dialog) {
    this._savePlaybackPositionNow = this._savePlaybackPosition.bind(this);
    this._savePlaybackPosition =
      _.throttle(this._savePlaybackPositionNow, 1000, {trailing: false});
  },
  _saveFinalPlaybackPosition(this: Dialog, contextWatchId?: Loose, ct?: Loose) {
    const save = this._savePlaybackPositionNow || this._savePlaybackPosition;
    save.call(this, contextWatchId, ct);
  },
  _queuePlaybackPositionSave(this: Dialog, videoId:string,record:()=>Promise<unknown>):Promise<unknown> {
    // Watch aliases can share a video: serialize the actual PUT resource.
    const queues=this._playbackPositionSaves||(this._playbackPositionSaves=new Map());
    const previous=queues.get(videoId);
    let operation:Promise<unknown>;
    if(previous){
      // A failed earlier save must not poison a later explicit clear.
      operation=previous.then(record,record);
    }else{
      // Preserve immediate dispatch for unrelated videos and the first save.
      try{operation=Promise.resolve(record());}
      catch(error){operation=Promise.reject(error);}
    }
    queues.set(videoId,operation);
    const release=():void=>{if(queues.get(videoId)===operation)queues.delete(videoId);};
    void operation.then(release,release);
    // Keep this operation's rejection visible to its own caller.
    return operation;
  },
  _savePlaybackPosition(this: Dialog, contextWatchId?: Loose, ct?: Loose) {
    if(this._playerConfig?.getValue('resume.recordEnabled')===false)return;
    const current=this._videoInfo;
    // Task1041: 最後まで（残り3秒以内）見た位置は「ここまで見た」に残さない。
    // 以前はサーバーへの保存だけがこの判定をしていて、手元の履歴には動画の終わりの位置が残っていた。
    // 連続再生で次の動画へ進むと、終了時に消した位置を open() の保存が終わりの位置で上書きし、
    // しおりの保存一覧の「続きへ」が押せない（終わりの位置）か、開いてもすぐ終わって再生できなかった。
    const nearEnd=NicoVideoPlayerDialog.isNearPlaybackEnd(ct,this.duration)||!!this._state?.isEnded;
    if(current&&current.contextWatchId===contextWatchId&&Number.isFinite(ct)&&ct>0&&!nearEnd&&
       !this._isAutoResumeSaveSuppressed()){
      const watchId=this._watchId,requestId=this._requestId;
      void Promise.resolve(WatchInfoCacheDb.putBestEffort(watchId as string,{currentTime:ct})).then(record=>{
        if(!record||this._videoInfo!==current||this._watchId!==watchId||this._requestId!==requestId)return;
        current._cacheData={...current._cacheData,...record};
        current._resumeInfo={...current._resumeInfo,initialPlaybackPosition:ct};
        this._view?.videoControlBar?.refreshAutoResumePointers?.(current);
        this._view?.manualBookmarkDock?.refreshPreferences();
      }).catch(()=>{});
    }
    if (!util.isLogin()) {
      return;
    }
    const vi = this._videoInfo;
    if (!vi) {
      return;
    }
    // Do not restore a position deleted by the user in this playback session.
    // Explicit completion/server-zero (ct===0) remains permitted.
    if(ct>0&&this._isAutoResumeSaveSuppressed())return;
    const dr = this.duration;
    console.info('%csave PlaybackPosition:', 'background: cyan', ct, dr); // Task 088: csrfToken はログに出さない
    if (vi.contextWatchId !== contextWatchId) {
      return;
    }
    if (Math.abs(ct - dr) < 3) {
      return;
    }
    const isShortContent =
      /^ss\d+$/i.test(String(vi.videoId)) || /^ss\d+$/i.test(String(contextWatchId));
    if (dr < 120 && isShortContent) {
      return;
    } // 短尺でも通常long-formは記録し、ss系ショートだけ従来どおり除外
    // Task177 (F09): contextWatchId only guards which video is current; the v2 API
    // takes the canonical video.id (a numeric channel watch ID is not renamed).
    this._queuePlaybackPositionSave(vi.videoId,()=>{
      if(this._playerConfig?.getValue('resume.recordEnabled')===false)return Promise.resolve();
      return PlaybackPosition.record(
      vi.videoId,
      ct,
      vi.msgInfo.frontendId,
      vi.msgInfo.frontendVersion);
    }).catch((e?: Loose) => {
      window.console.warn('save playback fail', {reason: e && e.reason, status: e && e.status});
    });
  },
};

export {NicoVideoPlayerDialogResume};

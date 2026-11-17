/**
 * Canonical TypeScript source for src/NicoVideoPlayerDialogViewBookmarks.js (Task1063: NicoVideoPlayerDialogView.ts から役割ごとに分割).
 * 手動のしおり（保存した再生位置）の置き場と、保存した位置の一覧からの再生。
 * NicoVideoPlayerDialogView.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// 本体のクラス（実行時は同じスコープにある）。
type View = import('./NicoVideoPlayerDialogView').NicoVideoPlayerDialogView;
// legacy-to-ts: names provided by other bundled modules
declare const NicoVideoPlayerDialog: typeof import('./NicoVideoPlayerDialog').NicoVideoPlayerDialog;
declare const IndexedDbManualBookmarkBackend: typeof import('./external/ManualBookmarkStore').IndexedDbManualBookmarkBackend;
declare const ManualBookmarkRepository: typeof import('./external/ManualBookmarkStore').ManualBookmarkRepository;
declare const ManualBookmarkSession: typeof import('./external/ManualBookmarkSession').ManualBookmarkSession;
declare const ManualBookmarkDock: typeof import('./external/ManualBookmarkDock').ManualBookmarkDock;
declare const SavedVideoThumbnail: typeof import('./SavedVideoThumbnail').SavedVideoThumbnail;
declare const ThumbInfoLoader: typeof import('./ThumbInfoLoader').ThumbInfoLoader;
declare const WatchInfoCacheDb: typeof import('./WatchInfoCacheDb').WatchInfoCacheDb;

/** 手動のしおり（保存した再生位置）の置き場と、保存した位置の一覧からの再生。 */
const NicoVideoPlayerDialogViewBookmarks = {
  _mountManualBookmarkDock(this: View):boolean {
    if(this.manualBookmarkDock)return true;
    // Prevent re-entrant listeners from opening parallel DB owners.
    if(this._manualBookmarkDockMounting)return false;
    this._manualBookmarkDockMounting=true;
    let bookmarkSession:InstanceType<typeof ManualBookmarkSession>|undefined;
    let videoThumbnails:{attach(host:HTMLElement,videoId:string,url?:string):()=>void;dispose():void}|undefined;
    try{
      const container=this._$playerContainer?.[0];
      const backend=new IndexedDbManualBookmarkBackend(window.indexedDB);
      const repository=new ManualBookmarkRepository(backend);
      bookmarkSession=new ManualBookmarkSession(repository);
      videoThumbnails=SavedVideoThumbnail.create({
        load:async(videoId:string)=>{
          const info=await ThumbInfoLoader.load(videoId);
          return info.thumbnail as string | undefined;
        },maxConcurrent:2,maxEntries:128
      });
      const disposeSession=bookmarkSession!.dispose.bind(bookmarkSession);
      bookmarkSession!.dispose=()=>{videoThumbnails?.dispose();disposeSession();};
      this.manualBookmarkDock=ManualBookmarkDock.mount(container,bookmarkSession,{
        currentVideoId:()=>this._state.videoInfo?.watchId??null,
        currentTime:()=>Number(this._currentTimeGetter())||0,
        timestamp:()=>Date.now(),
        newId:()=>{
          const uuid=window.crypto?.randomUUID?.();
          return uuid?'B'+uuid.replace(/-/g,''):
            'B'+Date.now().toString(36)+
              Math.floor(Math.random()*0x1000000).toString(36);
        },
        seek:(seconds:number)=>this.emit('command','seekTo',seconds),
        duration:()=>Number(this._state.videoInfo?.duration)||0,
        automaticTime:()=>this._dialog?._videoInfo?.resumePoints?.[0]?.time??null,
        recordingEnabled:()=>this._playerConfig.getValue('resume.recordEnabled')!==false,
        setRecordingEnabled:(enabled:boolean)=>this._playerConfig.setValue('resume.recordEnabled',enabled),
        createScenePreview:(host:HTMLElement,videoId:string,time:number)=>
          this.videoControlBar?.storyboard?.createSavedPreview?.(host,videoId,time)||(()=>{}),
        loadLibrary:()=>this._loadSavedPointLibrary(repository),
        createVideoThumbnail:(host:HTMLElement,video:Loose)=>
          videoThumbnails!.attach(host,video.videoId,video.thumbnailUrl),
        openLibraryPosition:(videoId:string,time:number,endTime?:number)=>{
          void this._openSavedLibraryPosition(videoId,time,endTime);
        },
        automaticViewedAt:()=>this._dialog?._videoInfo?._cacheData?.viewedAt??null,
        libraryAppearance:()=>({
          showVideoThumbnails:this._playerConfig.getValue('bookmark.showVideoThumbnails')!==false,
          showScenePreviews:this._playerConfig.getValue('bookmark.showScenePreviews')!==false,
          thumbnailWidth:Number(this._playerConfig.getValue('bookmark.thumbnailWidth'))||80,
          titleFontSize:Number(this._playerConfig.getValue('bookmark.titleFontSize'))||13,
          titleLines:Number(this._playerConfig.getValue('bookmark.titleLines'))||1
        }),
        editLibraryBookmark:async(videoId:string,id:string,changes:Loose,duration:number)=>{
          await repository.update(videoId,id,changes,Date.now(),duration);
          bookmarkSession!.notifyCommittedChange();
          await bookmarkSession!.refreshIfIdle();
        },
        deleteLibraryBookmark:async(videoId:string,id:string,duration:number)=>{
          await repository.remove(videoId,id,duration);
          bookmarkSession!.notifyCommittedChange();
          await bookmarkSession!.refreshIfIdle();
        },
        editLibraryAutomatic:async(videoId:string,time:number,duration:number)=>{
          if(!Number.isFinite(time)||time<0||time>=duration)throw Error('Invalid saved position');
          if(videoId===this._dialog._watchId){
            if(!await this._dialog._editAutomaticResume(time))throw Error('Position update failed');
          }else await WatchInfoCacheDb.put(videoId,{currentTime:time,explicitResume:true});
        },
        deleteLibraryAutomatic:async(videoId:string)=>{
          if(videoId===this._dialog._watchId){
            if(!await this._dialog._deleteAutomaticResume())throw Error('Position delete failed');
          }else await WatchInfoCacheDb.clearAutomaticResume(videoId,'deleted');
        },
        onRepeatRangeChange:(range:{a:number|null;b:number|null;active:boolean}|null)=>{
          const info=this._state.videoInfo;
          this.videoControlBar?.setABRepeatRange?.(range,Number(info?.duration)||0,info?.watchId??null);
        },
        repeatEnabled:()=>this._playerConfig.getValue('abRepeat.enabled')!==false,
        repeatState:(active:boolean)=>{
          const media=this._dialog?._nicoVideoPlayer?._videoPlayer;
          if(media)media.isLoop=active?false:!!this._playerConfig.getValue('loop');
        },
        editAutomatic:(seconds:number)=>this._dialog._editAutomaticResume(seconds),
        deleteAutomatic:async()=>!!(await this._dialog._deleteAutomaticResume()),
        onBookmarksChange:(snapshot:{status:string;videoId:string|null;bookmarks:readonly {id:string;time:number;label:string}[]})=>{
          const info=this._state?.videoInfo;
          this.videoControlBar?.setManualBookmarkMarkers?.(
            (snapshot.status==='ready'||snapshot.status==='error')&&
              snapshot.videoId===info?.watchId?snapshot.bookmarks:[],
            Number(info?.duration)||0,info?.watchId??null);
        }
      });
    }catch{
      // A failed optional mount must not strand an IndexedDB subscription.
      videoThumbnails?.dispose();
      try{bookmarkSession?.dispose();}catch{}
      console.warn('Manual bookmark dock unavailable');
    }

    this._manualBookmarkDockMounting=false;
    return !!this.manualBookmarkDock;
  },
  async _loadSavedPointLibrary(this: View, repository:Loose):Promise<Loose[]> {
    const [manual,history]=await Promise.all([repository.list(),WatchInfoCacheDb.listSavedPoints()]);
    const byId=new Map<string,Loose>();
    for(const record of history){
      if(typeof record.watchId!=='string'||!record.watchId)continue;
      byId.set(record.watchId,{videoId:record.watchId,title:record.title||record.watchId,
        duration:Number.isFinite(record.duration)&&record.duration>0?record.duration:Number.MAX_SAFE_INTEGER,
        updatedAt:record.updatedAt||0,viewedAt:record.viewedAt,thumbnailUrl:record.thumbnailUrl,automaticTime:record.automaticTime,bookmarks:[]});
    }
    for(const row of manual){
      const entry=byId.get(row.videoId)||{videoId:row.videoId,title:row.videoId,
        duration:Number.MAX_SAFE_INTEGER,updatedAt:0,automaticTime:null,bookmarks:[]};
      entry.bookmarks=row.items;
      for(const point of row.items)entry.updatedAt=Math.max(entry.updatedAt,point.updatedAt||0);
      byId.set(row.videoId,entry);
    }
    const current=this._state.videoInfo;
    const entry=byId.get(current?.watchId);
    if(entry){entry.title=current.title||entry.title;entry.duration=current.duration||entry.duration;
      entry.thumbnailUrl=current.thumbnail||current.betterThumbnail||entry.thumbnailUrl;
      entry.automaticTime=this._dialog?._videoInfo?.resumePoints?.[0]?.time??entry.automaticTime;}
    return [...byId.values()].filter(row=>row.automaticTime!==null||row.bookmarks.length)
      .sort((a,b)=>b.updatedAt-a.updatedAt);
  },
  async _openSavedLibraryPosition(this: View, videoId:string,time:number,endTime?:number):Promise<void> {
    if(!videoId||!Number.isFinite(time)||time<0||
       (endTime!==undefined&&(!Number.isFinite(endTime)||endTime<=time)))return;
    this._pendingLibraryRepeat=undefined;
    if(videoId===this._state.videoInfo?.watchId){
      if(endTime!==undefined)this.manualBookmarkDock?.setRepeatRange?.(time,endTime,true);
      // Task1041: 終わりの位置なら最初から
      else this.emit('command','seekTo',NicoVideoPlayerDialog.isNearPlaybackEnd(time,this._state.videoInfo?.duration)?0:time);
      return;
    }
    try{
      const opening=this._dialog.open(videoId,{openNow:true,currentTime:time});
      // open rotates the request synchronously. Never adopt a newer request
      // after this promise resolves (even when it opens the same video again).
      const requestId=this._dialog._requestId;
      await opening;
      if(endTime===undefined||this._dialog._requestId!==requestId||
         this._dialog._watchId!==videoId)return;
      this._pendingLibraryRepeat={requestId,videoId,a:time,b:endTime};
      this._trySavedLibraryRepeat();
    }catch{console.warn('Saved position navigation unavailable');}
  },
  _trySavedLibraryRepeat(this: View):void {
    const pending=this._pendingLibraryRepeat;
    if(!pending||pending.requestId!==this._dialog?._requestId||
       pending.videoId!==this._state?.videoInfo?.watchId||
       pending.videoId!==this._libraryCanPlayVideo||
       this._bookmarkActivation?.requestId!==pending.requestId)return;
    if(this.manualBookmarkDock?.setRepeatRange?.(pending.a,pending.b,true))this._pendingLibraryRepeat=undefined;
  },
  /** Explicit retry only: an existing Dock with a failed DB read needs a fresh
   * activation, not a second Dock/IDB owner or an automatic polling loop. */
  _retryFailedManualBookmarkSession(this: View):void {
    if(this.manualBookmarkDock?.bookmarkNeedsReload!==true)return;
    const pending=this._pendingVideoInfo;
    const info=this._state?.videoInfo;
    if(!pending||pending.failed||this._state?.isError||
       pending.requestId!==this._dialog?._requestId||
       !info||pending.info!==info||
       typeof info.watchId!=='string'||!Number.isFinite(info.duration)||
       info.duration<=0)return;
    this._bookmarkActivation=undefined;
    this._applyPendingVideoInfo();
  },
  _showManualBookmarkUnavailable(this: View):void {
    const host=this._$playerContainer?.[0] as HTMLElement|undefined;
    const trigger=host?.querySelector<HTMLElement>('.playbackPointsSwitch');
    if(!host||!trigger)return;
    let note=host.querySelector<HTMLElement>('.zw-points-unavailable');
    if(!note){
      note=host.ownerDocument.createElement('output');
      note.className='zw-points-unavailable';
      note.setAttribute('role','status');
      note.setAttribute('aria-live','polite');
      Object.assign(note.style,{
        position:'absolute',left:'12px',bottom:'72px',zIndex:'150001',
        maxWidth:'calc(100% - 24px)',padding:'6px 10px',borderRadius:'6px',
        background:'rgba(25,30,40,.95)',color:'#fff',
        font:'12px/1.5 sans-serif',pointerEvents:'none'
      });
      host.append(note);
    }
    note.textContent='しおりを開けませんでした。もう一度押すと再試行します。';
    trigger.setAttribute('aria-expanded','false');
  },
  _clearManualBookmarkUnavailable(this: View):void {
    this._$playerContainer?.[0]?.querySelector('.zw-points-unavailable')?.remove();
  },
};

export {NicoVideoPlayerDialogViewBookmarks};

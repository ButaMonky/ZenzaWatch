/**
 * Canonical TypeScript source for packages/zenza/src/storyboard/Storyboard.js (Task901).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
declare class Emitter {
  constructor(...args: Loose[]);
  on(name: string, callback: (...args: Loose[]) => unknown): this;
  emit(name: string, ...args: unknown[]): unknown;
  promise(name: string): Promise<unknown>;
  emitResolve(name: string, ...args: unknown[]): unknown;
}
/** Sibling storyboard modules and globals used here. */
declare const StoryboardInfoLoader: {load(serverType: unknown, videoInfo: Loose): Promise<Loose>};
declare const StoryboardView: new (params: Loose) => Loose;
declare const StoryboardInfoModel: new (data: Loose) => Loose;
declare const SeekBarThumbnail: Loose;
declare const StoryboardWorker: Loose;
declare const StoryboardCacheDb: typeof import('./StoryboardCacheDb').StoryboardCacheDb;
declare const VideoInfoLoader: typeof import('./VideoInfoLoader').VideoInfoLoader;
declare const VideoSessionWorker: typeof import('./VideoSessionWorker').VideoSessionWorker;
declare const netUtil: {fetch(url:string,options:Loose):Promise<Response>};
declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
declare const global: {debug: Loose};

interface SavedSceneDependencies {
  cache:{getPreview?:(id:string,time:number)=>Promise<Loose>;get?:(id:string)=>Promise<Loose>;
    captureGeneration?:()=>number;put:(id:string,raw:Loose,generation?:number)=>Promise<unknown>};
  enabled:()=>boolean;
  loadMetadata:(id:string,signal:AbortSignal)=>Promise<Loose>;
  fetchImage:(url:string,signal:AbortSignal)=>Promise<ArrayBuffer>;
}
/** Passive, reference-counted requests. No ownership of the video player. */
class SavedSceneLoader {
  private resources=new Map<string,{refs:number;controller:AbortController;promise:Promise<Loose>}>();
  private cooldown=new Map<string,number>();
  private running=0;
  private queue:Array<()=>void>=[];
  private deps:SavedSceneDependencies;
  constructor(deps:SavedSceneDependencies){this.deps=deps;}
  get activeResources():number{return this.resources.size;}
  private check(signal:AbortSignal):void {if(signal.aborted)throw new DOMException('Cancelled','AbortError');}
  private schedule<T>(signal:AbortSignal,task:()=>Promise<T>):Promise<T>{
    return new Promise((resolve,reject)=>{
      const cancel=()=>{const i=this.queue.indexOf(start);if(i>=0)this.queue.splice(i,1);reject(new DOMException('Cancelled','AbortError'));};
      const start=()=>{
        signal.removeEventListener('abort',cancel);
        if(signal.aborted){cancel();return;}
        this.running++;
        Promise.resolve().then(task).then(resolve,reject).finally(()=>{
          this.running--;this.queue.shift()?.();
        });
      };
      if(signal.aborted){cancel();return;}
      if(this.running<2)start();else{this.queue.push(start);signal.addEventListener('abort',cancel,{once:true});}
    });
  }
  private lease(key:string,task:(signal:AbortSignal)=>Promise<Loose>){
    let entry=this.resources.get(key);
    if(!entry){
      const controller=new AbortController();
      entry={refs:0,controller,promise:Promise.resolve().then(async()=>{this.check(controller.signal);const result=await task(controller.signal);this.check(controller.signal);return result;})};
      this.resources.set(key,entry);
    }
    entry.refs++;let released=false;
    return {promise:entry.promise,release:()=>{
      if(released)return;released=true;
      if(--entry!.refs===0){entry!.controller.abort();if(this.resources.get(key)===entry)this.resources.delete(key);}
    }};
  }
  cancelAll():void {for(const entry of this.resources.values())entry.controller.abort();this.resources.clear();}
  acquire(videoId:string,time:number):{promise:Promise<Loose>;release:()=>void}{
    const controller=new AbortController(),signal=controller.signal,leases:Array<{release:()=>void}>=[];
    const generation=this.deps.cache.captureGeneration?.();
    const keep=(lease:ReturnType<SavedSceneLoader['lease']>)=>{if(signal.aborted){lease.release();lease.promise.catch(()=>{});this.check(signal);}leases.push(lease);return lease.promise;};
    const usable=(raw:Loose)=>raw?.watchId===videoId&&new StoryboardInfoModel(raw).isAvailable;
    const pageAt=(raw:Loose)=>new StoryboardInfoModel(raw).getThumbnailPosition(time*1000).page;
    const promise=(async()=>{
      if(!/^(?:sm|so|nm)?\d+$/.test(videoId)||!Number.isFinite(time)||time<0)return null;
      let raw:Loose=null;
      for(const type of ['domand','dmc']){
        raw=await keep(this.lease('cache:'+videoId+':'+type+':'+time,async()=>
          (this.deps.cache.getPreview?.(videoId+'_'+type,time)||this.deps.cache.get?.(videoId+'_'+type)||Promise.resolve(null)).catch(()=>null)));
        this.check(signal);
        if(usable(raw)&&time<=raw.duration&&raw.storyboard.images[pageAt(raw)]?.buffer)return raw;
      }
      if(!this.deps.enabled()||(this.cooldown.get(videoId)||0)>Date.now())return null;
      raw=await keep(this.lease('meta:'+videoId,s=>this.schedule(s,()=>this.deps.loadMetadata(videoId,s))));
      this.check(signal);if(!this.deps.enabled()||!usable(raw)||time>raw.duration)return null;
      const page=pageAt(raw),sheet=raw.storyboard.images[page];
      const buffer=await keep(this.lease('sheet:'+videoId+':'+sheet.url,s=>this.schedule(s,()=>this.deps.fetchImage(sheet.url,s))));
      this.check(signal);if(!this.deps.enabled())return null;
      const result={...raw,storyboard:{...raw.storyboard,images:raw.storyboard.images.map((item:Loose,i:number)=>i===page?{...item,buffer}:item)}};
      await this.deps.cache.put(videoId+'_'+raw.format,result,generation).catch(()=>{});
      this.check(signal);this.cooldown.delete(videoId);return result;
    })().catch(error=>{
      if(!signal.aborted&&error?.name!=='AbortError'){
        this.cooldown.delete(videoId);this.cooldown.set(videoId,Date.now()+60000);
        while(this.cooldown.size>128)this.cooldown.delete(this.cooldown.keys().next().value!);
      }
      throw error;
    });
    return {promise,release:()=>{controller.abort();for(const lease of leases)lease.release();leases.length=0;}};
  }
}

class Storyboard extends Emitter {
  declare _savedScenes:SavedSceneLoader|undefined;
  declare _savedPreviewDecodedBytes:number|undefined;
  private savedScenes():SavedSceneLoader {
    if(this._savedScenes)return this._savedScenes;
    const timed=async<T>(signal:AbortSignal,task:(signal:AbortSignal)=>Promise<T>):Promise<T>=>{
      const controller=new AbortController();
      const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted)abort();
      const timer=setTimeout(abort,15000);
      try{return await task(controller.signal);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
    };
    return this._savedScenes=new SavedSceneLoader({
      cache:StoryboardCacheDb,
      enabled:()=>this.config?.props?.savedSceneFetch!==false&&this.config?.props?.enableStoryboard!==false,
      loadMetadata:(videoId,signal)=>timed(signal,async activeSignal=>{
        const diagnostic=typeof RequestDiagnostics==='undefined'?null:RequestDiagnostics.begin('storyboard',videoId,'response',()=>!signal.aborted);
        try{
          const info=await VideoInfoLoader.loadStoryboardInfo(videoId,{signal:activeSignal});
          const classes=VideoSessionWorker.createStoryboardClasses({fetch:(url,options)=>netUtil.fetch(url,{...options,signal:activeSignal,diagnosticActive:()=>false})});
          const session=await classes.StoryboardSession.create({videoInfo:info,serverType:'domand'}).create();
          const loader=classes.StoryboardInfoLoader.create(session);loader.duration=info.duration;await loader.load();
          const result={...loader.toJSON(),status:'ok',watchId:videoId,storyboard:loader.getStoryboardWithUrls()};
          diagnostic?.success();return result;
        }catch(error){diagnostic?.failure(error);throw error;}
      }),
      fetchImage:(url,signal)=>timed(signal,async activeSignal=>{
        const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new TypeError('Invalid scene image');
        const response=await fetch(url,{credentials:'omit',signal:activeSignal});
        if(!response.ok)throw Object.assign(new Error('Scene image unavailable'),{status:response.status});
        const maximum=8*1024*1024;
        if(Number(response.headers.get('content-length'))>maximum){await response.body?.cancel();throw new RangeError('Scene image too large');}
        if(!response.body){const data=await response.arrayBuffer();if(data.byteLength>maximum)throw new RangeError('Scene image too large');return data;}
        const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
        try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new RangeError('Scene image too large');}chunks.push(value);}}
        finally{reader.releaseLock();}
        const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result.buffer;
      })
    });
  }
  declare _savedPreviewInfo:Map<string,{refs:number;promise:Promise<Loose>}>|undefined;
  declare _savedPreviewBytes:Map<object|string,{refs:number;url:string}>|undefined;
  /** Independent passive sprite crop; never moves or seeks the live preview canvas.
   * Historical videos use cached bytes only: opening a library must not start
   * video sessions or fetch every storyboard sheet in the user's history. */
  createSavedPreview(host:HTMLElement,videoId:string,time:number):()=>void {
    let disposed=false,revision=0,releaseImage:(()=>void)|null=null;
    let sceneLease:{promise:Promise<Loose>;release:()=>void}|null=null;
    host.textContent='画像なし';
    host.style.position='relative';host.style.overflow='hidden';
    host.setAttribute('role','img');host.setAttribute('aria-label','場面画像を利用できません');
    if(!Number.isFinite(time)||time<0||typeof videoId!=='string'||!videoId||
       this.config?.props?.enableStoryboard===false)return ()=>{};
    const infos=this._savedPreviewInfo??=(new Map());
    const bytes=this._savedPreviewBytes??=(new Map());
    const isCurrent=()=>this._currentVideoWatchId===videoId&&this.model?.isAvailable===true;
    let infoLease: {refs:number;promise:Promise<Loose>}|undefined;
    const infoKey=videoId+':'+time;
    const cached=()=>{
      if(infoLease)return infoLease.promise;
      infoLease=infos.get(infoKey);
      if(!infoLease){
        const pending=Promise.resolve().then(async()=>{
          for(const type of ['domand','dmc']){
            const raw=await (StoryboardCacheDb.getPreview?.(videoId+'_'+type,time)||StoryboardCacheDb.get(videoId+'_'+type)).catch(()=>null) as Loose;
            if(raw?.watchId===videoId&&raw.status==='ok'&&raw.storyboard)return raw;
          }
          return null;
        });
        infoLease={refs:0,promise:pending};infos.set(infoKey,infoLease);
      }
      infoLease.refs++;return infoLease.promise;
    };
    const draw=async()=>{
      const seq=++revision;
      sceneLease?.release();sceneLease=null;
      releaseImage?.();releaseImage=null;host.textContent='画像なし';
      if(this.config?.props?.enableStoryboard===false)return;
      const live=isCurrent();
      let raw=live?this.model.rawData:await cached();
      if(!live&&!disposed&&seq===revision&&this.config?.props?.savedSceneFetch!==false){
        const candidate=raw&&new StoryboardInfoModel(raw);
        if(!candidate?.isAvailable||!raw.storyboard.images[candidate.getThumbnailPosition(time*1000).page]?.buffer){
          sceneLease=this.savedScenes().acquire(videoId,time);raw=await sceneLease.promise;
        }
      }
      if(disposed||seq!==revision||!raw||raw.watchId!==videoId)return;
      const model=new StoryboardInfoModel(raw);
      if(!model.isAvailable||model.cellCount<=0||time>model.duration)return;
      const pos=model.getThumbnailPosition(time*1000),page=raw.storyboard.images[pos.page];
      const decoded=model.pageWidth*model.pageHeight*4;
      if(!Number.isFinite(decoded)||decoded<=0||decoded>32*1024*1024)return;
      let src:string;
      if(page?.buffer&&Object.prototype.toString.call(page.buffer)==='[object ArrayBuffer]'){
        const key=page.buffer as object;
        let entry=bytes.get(key);
        if(!entry){
          if(!Number.isFinite(decoded)||decoded<=0||(this._savedPreviewDecodedBytes||0)+decoded>32*1024*1024)return;
          entry={refs:0,url:URL.createObjectURL(new Blob([page.buffer]))};bytes.set(key,entry);this._savedPreviewDecodedBytes=(this._savedPreviewDecodedBytes||0)+decoded;
        }
        entry.refs++;src=entry.url;
        releaseImage=()=>{if(--entry!.refs===0){URL.revokeObjectURL(entry!.url);bytes.delete(key);this._savedPreviewDecodedBytes=Math.max(0,(this._savedPreviewDecodedBytes||0)-decoded);}};
      }else{
        // Only the already-open current video may reuse its live URL.
        if(!live||typeof page?.url!=='string'||!/^https?:\/\//.test(page.url))return;
        src=page.url;
        let entry=bytes.get(src);
        if(!entry){if((this._savedPreviewDecodedBytes||0)+decoded>32*1024*1024)return;
          entry={refs:0,url:src};bytes.set(src,entry);this._savedPreviewDecodedBytes=(this._savedPreviewDecodedBytes||0)+decoded;}
        entry.refs++;
        releaseImage=()=>{if(--entry!.refs===0){bytes.delete(src);this._savedPreviewDecodedBytes=Math.max(0,(this._savedPreviewDecodedBytes||0)-decoded);}};
      }
      const image=host.ownerDocument.createElement('img');image.alt='';image.draggable=false;image.crossOrigin='anonymous';
      image.style.cssText=`position:absolute;max-width:none;width:${model.cols*100}%;height:${model.rows*100}%;left:${-pos.col*100}%;top:${-pos.row*100}%;pointer-events:none;`;
      image.onload=()=>{if(!disposed&&seq===revision){host.setAttribute('aria-label','保存時刻付近の場面画像');}};
      image.onerror=()=>{if(!disposed&&seq===revision){host.textContent='画像なし';releaseImage?.();releaseImage=null;}};
      host.style.aspectRatio=String(model.cellWidth)+' / '+String(model.cellHeight);
      host.replaceChildren(image);image.src=src;
    };
    const update=()=>{const pending=draw(),seq=revision;void pending.catch(()=>{if(!disposed&&seq===revision){host.textContent='画像なし';releaseImage?.();releaseImage=null;}});};
    this.on?.('update',update);this.on?.('reset',update);update();
    return ()=>{if(disposed)return;disposed=true;revision++;sceneLease?.release();sceneLease=null;releaseImage?.();releaseImage=null;
      (this as Loose).off?.('update',update);(this as Loose).off?.('reset',update);
      if(infoLease&&--infoLease.refs===0&&infos.get(infoKey)===infoLease)infos.delete(infoKey);
      host.replaceChildren();
    };
  }
  declare _loadingWatchId: Loose;
  declare _requestId: Loose;
  declare _watchId: Loose;
  declare _currentVideoInfo: Loose;
  declare _currentVideoWatchId: Loose;
  declare config: Loose;
  declare container: Loose;
  declare loader: Loose;
  declare model: Loose;
  declare state: Loose;
  declare view: Loose;
  constructor(...args: Loose[]) {
    super();
    this.initialize(...(args as [Loose]));
  }
  initialize(params?: Loose) {
    this.config = params.playerConfig;
    this.container = params.container;
    this.state = params.state;
    this.loader = params.loader || StoryboardInfoLoader;
    /** @type {StoryboardInfoModel} */
    this.model = new StoryboardInfoModel({});
    this._currentVideoInfo = null;
    this._currentVideoWatchId = null;
    // Task943: Master thumbnails switch is independent from filmstrip layout.
    // The switch must work for the current video, even if thumbnails were
    // initially disabled before the player emitted loadVideoInfo/canPlay.
    this.config.onkey?.('enableStoryboard', () => this._onStoryboardMasterChange());
    this.config.onkey?.('savedSceneFetch',()=>{if(this.config.props.savedSceneFetch===false)this._savedScenes?.cancelAll();});
    global.debug.storyboard = this;
  }
  _initializeStoryboard() {
    if (this.view) {
      return;
    }
    this.view = new StoryboardView({
      model: this.model,
      container: this.container,
      enable: this.config.props.enableStoryboardBar===true &&
        this.config.props.enableStoryboard===true,
      state: this.state
    });
    // Task941: toolbar clicks already update Config, but the advanced setting
    // and TOGGLE_STORYBOARD_BAR shortcut previously changed only the stored flag.
    // Listen after the view is created; pre-load changes are applied above.
    this.config.onkey?.('enableStoryboardBar', () =>
      this._onStoryboardBarVisibilityChange());
    this.emitResolve('dom-ready');
  }
  _onStoryboardBarVisibilityChange() {
    if(!this.view){return;}
    // Task942: DataStorage.onkey emits asynchronously. A queued event may
    // represent an older value, including one set before this view existed.
    // Always reconcile with the current Config value, never the event payload.
    const enabled=this.config.props.enableStoryboard===true &&
      this.config.props.enableStoryboardBar===true;
    // A toolbar click sets view.isEnable before it writes Config. Do not
    // toggle the view a second time or restart the animation on that event.
    if(this.view.isEnable===enabled){return;}
    if(enabled){this.view.enable();}
    else{this.view.disable();}
  }
  _onStoryboardMasterChange() {
    // DataStorage publishes asynchronously; always read the latest saved
    // value instead of the event payload to avoid stale notifications.
    if(this.config.props.enableStoryboard!==true){
      this._savedScenes?.cancelAll();
      // Old async master notifications can arrive repeatedly for one OFF.
      // Do not reset workers or fire a synthetic reset on an already empty
      // storyboard; revoke in-flight owners and loaded geometry just once.
      const hadStoryboard=this._loadingWatchId!=null ||
        this.state.isStoryboardAvailable===true || this.model.isAvailable===true;
      this._loadingWatchId=null;
      this._requestId=null; // late loader responses no longer own this video
      this.state.isStoryboardAvailable=false;
      if(hadStoryboard){
        this.model.reset(); // SeekBarThumbnail hides and clears its worker model
        this.emit('reset',this.model);
      }
      this._onStoryboardBarVisibilityChange();
      return;
    }
    this._onStoryboardBarVisibilityChange();
    // Reuse the current videoInfo already delivered by the player, without
    // waiting for a future canPlay or forcing a video/page reload.
    if(this._currentVideoInfo){
      this.load(this._currentVideoWatchId,this._currentVideoInfo);
    }
  }
  reset() {
    this._currentVideoInfo=null;
    this._currentVideoWatchId=null;
    this._loadingWatchId = null;
    this._requestId = null;
    if (!this.model) { return; }
    this.state.isStoryboardAvailable = false;
    this.model.reset();
    this.emit('reset', this.model);
  }
  onVideoCanPlay(watchId?: Loose, videoInfo?: Loose) {
    this.load(watchId, videoInfo);
  }
  /**
   * Task 070: 一般会員でも取得する（access-rights/storyboard は一般会員でも 201 を返す。2026-09-17実機確認）。
   * 動画情報の取得直後（loadVideoInfo）と canPlay の両方から呼ばれ、同じ動画では1回だけ読み込む。
   */
  load(watchId?: Loose, videoInfo?: Loose) {
    // Record only a video with storyboard metadata, including when disabled.
    // reset() clears this ownership on the next player.open event.
    if(videoInfo?.hasStoryboard){
      const currentKey=videoInfo.watchId||watchId;
      if(typeof currentKey==='string' && currentKey){
        this._currentVideoInfo=videoInfo;
        this._currentVideoWatchId=currentKey;
      }
    }
    if (!this.config.props.enableStoryboard || !videoInfo || !videoInfo.hasStoryboard) {
      return;
    }
    const key = videoInfo.watchId || watchId;
    if (this._loadingWatchId === key) {
      return;
    }
    this._loadingWatchId = key;
    this._watchId = watchId;
    const resuestId = this._requestId =  Math.random();

    this._initializeStoryboard();
    const startedAt = performance.now();
    this.loader.load(this.config.props.videoServerType, videoInfo)
      .then(async (info: Loose) => {
        await this.promise('dom-ready');
        console.log('storyboard loaded: %s %sms%s', watchId,
          Math.round(performance.now() - startedAt), info && info.fromCache ? ' (cache)' : '');
        return info;
      })
      .then(this._onStoryboardInfoLoad.bind(this, resuestId))
      .catch(this._onStoryboardInfoLoadFail.bind(this, resuestId));
  }
  _onStoryboardInfoLoad(resuestId?: Loose, rawData?: Loose) {
    if (resuestId !== this._requestId || this.config?.props?.enableStoryboard===false) {
      return; // video changed or master was disabled before notification
    }
    this.model.update(rawData);
    this.emit('update', this.model);

    // A successful HTTP/Worker reply can still contain malformed storyboard
    // geometry. Never advertise unavailable images or block future retries.
    this.state.isStoryboardAvailable = this.model.isAvailable;
    if (!this.model.isAvailable) { this._loadingWatchId = null; }
  }
  _onStoryboardInfoLoadFail(resuestId?: Loose, err?: Loose) {
    if (resuestId !== this._requestId || this.config?.props?.enableStoryboard===false) {
      return; // obsolete loader failure after reset / feature disabled
    }
    console.warn('onStoryboardInfoFail',this._watchId, err);
    this._loadingWatchId = null; // 次の canPlay で再試行できるように
    this.model.update(null);
    this.emit('update', this.model);
    this.state.isStoryboardAvailable = false;
  }
  setCurrentTime(sec?: Loose, forceUpdate?: Loose) {
    if (this.view && this.model.isAvailable) {
      this.view.setCurrentTime(sec, forceUpdate);
    }
  }
  set currentTime(sec: Loose) {
    this.setCurrentTime(sec);
  }
  toggle() {
    if (!this.view) { return; }
    // Task942: when a shortcut has already written Config but its update
    // event has not fired, the view may still show the previous state.
    // A click must toggle the latest preference, not that stale view state.
    const next=this.config.props.enableStoryboardBar!==true;
    const shouldShow=next&&this.config.props.enableStoryboard===true;
    if(this.view.isEnable!==shouldShow){this.view.toggle();}
    this.config.props.enableStoryboardBar=next;
  }
}

export {Storyboard, SeekBarThumbnail, StoryboardWorker, SavedSceneLoader};

// Typed UI07: keep native comment list ownership and optional cached canvas views.
type FilmSide='previous'|'next';
type FilmFrameData={imageUrl?:string;time?:number};
type FilmAsset={time?:number;frames?:{previous?:FilmFrameData|string;next?:FilmFrameData|string};[name:string]:unknown};
type FilmState={videoId?:string|null;time?:number;pinned?:boolean;seekStepSeconds?:number;
  commentListMode?:boolean;commentPreviewVisible?:boolean;[name:string]:unknown};
type FilmThumbnailView={dispose():void;currentTime:number};
type FilmStoryboardModel={cellCount:number;cellIntervalMs:number;duration:number;
  rawData:unknown;isAvailable:boolean;getIndex(milliseconds:number):number};
type FilmGeometry={pointerX?:number;seekLeft?:number;seekWidth?:number;
  visibleLeft?:number;visibleRight?:number};
type FilmSettings={
  createFilmstripThumbnail?:(args:{container:HTMLButtonElement;canvas:HTMLCanvasElement;
    info:unknown;name:string})=>FilmThumbnailView|null|undefined;
  getStoryboardModel?:()=>FilmStoryboardModel|null|undefined;
  getSeekGeometry?:()=>FilmGeometry|null|undefined;
  getDuration?:()=>number;duration?:number;
};
type FilmArgs={settings?:FilmSettings;onAction?:(action:string,ctx:Record<string,unknown>,event:MouseEvent)=>void;
  [name:string]:unknown};
type FilmCard={
  document:Document;container:HTMLElement;root:HTMLElement|null;mode:string;
  settings:FilmSettings;mount(state?:FilmState):void;render(state?:FilmState):void;
  onPreview(asset?:FilmAsset|null):void;dispose():void;
};
type FilmCardConstructor=new(args:FilmArgs)=>FilmCard;
type FilmRegistry={register(entry:{id:string;label:string;description:string;
  factory:(args:FilmArgs)=>FilmCard}):unknown};
type FilmSideNode={fig:HTMLElement;img:HTMLImageElement;placeholder:HTMLSpanElement;
  label:HTMLElement;button:HTMLButtonElement};
type FilmNodes={previous:FilmSideNode;next:FilmSideNode;current:HTMLElement;caption:HTMLElement};
type FilmFrameEntry={canvas:HTMLCanvasElement;view:FilmThumbnailView;index:number};
export class SceneSearchLayout07 {
  static install(registry:FilmRegistry|null,Card?:FilmCardConstructor):FilmRegistry {
    if(typeof registry?.register!=='function'||typeof Card!=='function'){
      throw new TypeError('Three-frame filmstrip needs registry and common card');
    }
    class FilmstripCard extends Card {
      declare _frameNodes:FilmNodes|null;
      declare _listLiftBefore:string;
      declare _listLiftPriority:string;
      declare _listLiftCurrent:string|null;
      declare _lastVideoId:string|null|undefined;
      declare _frameSource:unknown;
      declare _frameViews:Map<FilmSide,FilmFrameEntry>;
      declare _failedFrames:Set<FilmSide>;
      constructor(args:FilmArgs) {
        super({...args,layoutClass:'zenzaSceneFilmstrip',
          extraCss:SceneSearchLayout07.CSS,
          onAction:(action:string,ctx:Record<string,unknown>,event:MouseEvent)=>{
            if(action==='frame-previous'||action==='frame-next'){
              const button=(event?.target as Element|null)?.closest?.('button[data-scui-action]') as HTMLButtonElement|null;
              const time=Number(button?.dataset?.sceneTime);
              if(!button||button.disabled||!button.hasAttribute('data-scene-time')||
                !Number.isFinite(time)||time<0){return;}
              args.onAction?.('frame-seek',{...ctx,time},event);
              return;
            }
            args.onAction?.(action,ctx,event);
          }});
        this._frameNodes=null;
        this._listLiftBefore=this.container.style.getPropertyValue('--scui-ui07-list-lift');
        this._listLiftPriority=this.container.style.getPropertyPriority('--scui-ui07-list-lift');
        this._listLiftCurrent=null;
        this.settings=args.settings||{};
        this._lastVideoId=null;
        this._frameSource=null;
        this._frameViews=new Map();
        this._failedFrames=new Set();
      }
      _makeSideFrame(which:FilmSide):FilmSideNode {
        const d=this.document;
        const fig=d.createElement('figure');
        fig.className='zenzaSceneFilmFrame scene-'+which;
        fig.dataset.frame=which;
        const img=d.createElement('img');
        img.alt=which==='previous'?'前の場面':'次の場面';
        img.hidden=true;
        const button=d.createElement('button');
        button.type='button';
        button.className='zenzaSceneFilmJump';
        button.dataset.scuiAction=which==='previous'?
          'frame-previous':'frame-next';
        button.disabled=true;
        button.setAttribute('aria-label',which==='previous'?
          '前の場面へシーク':'次の場面へシーク');
        button.appendChild(img);
        const placeholder=d.createElement('span');
        placeholder.className='zenzaSceneFilmMissing';
        placeholder.textContent='—';
        button.appendChild(placeholder);
        fig.appendChild(button);
        const label=d.createElement('figcaption');
        label.className='zenzaSceneFilmFrameTime';
        label.textContent='';
        fig.appendChild(label);
        return {fig,img,placeholder,label,button};
      }
      mount(state?:FilmState):void {
        super.mount(state);
        try {
          const center=this.root!.querySelector<HTMLElement>('.zenzaSceneImageBox')!;
          const wrap=this.document.createElement('div');
          wrap.className='zenzaSceneFilmstripFrames';
          const previous=this._makeSideFrame('previous');
          const next=this._makeSideFrame('next');
          const current=this.document.createElement('figure');
          current.className='zenzaSceneFilmFrame scene-current';
          current.dataset.frame='current';
          center.parentNode!.insertBefore(wrap,center);
          current.appendChild(center);
          const caption=this.document.createElement('figcaption');
          caption.className='zenzaSceneFilmFrameTime';
          current.appendChild(caption);
          wrap.append(previous.fig,current,next.fig);
          this._frameNodes={previous,next,current,caption};
          this.render(state);
        }catch(e){this.dispose();throw e;}
      }
      static timeLabel(value?:number):string {
        if(!Number.isFinite(value)||(value as number)<0){return '';}
        const n=Math.floor(value as number);
        return String(Math.floor(n/60))+':'+String(n%60).padStart(2,'0');
      }
      _setSide(which:FilmSide,data:FilmFrameData|string|null|undefined):void {
        const node=this._frameNodes?.[which];
        if(!node){return;}
        const src=typeof data==='string'?data:
          typeof (data as FilmFrameData|null)?.imageUrl==='string'?(data as FilmFrameData).imageUrl:null;
        if(src&&/^(https?:\/\/|blob:|data:image\/)/i.test(src)){
          node.img.src=src;
          node.img.hidden=false;
          node.placeholder.hidden=true;
        }else{
          node.img.removeAttribute('src');
          node.img.hidden=true;
          node.placeholder.hidden=false;
        }
        const time=(data as FilmFrameData|null)?.time;
        const validTime=Number.isFinite(time)&&(time as number)>=0;
        const usableImage=!node.img.hidden;
        node.button.disabled=!validTime||!usableImage;
        if(validTime&&usableImage){
          node.button.dataset.sceneTime=String(time);
        }else{
          delete node.button.dataset.sceneTime;
        }
        node.label.textContent=FilmstripCard.timeLabel(time);
      }
      _clearFrameSide(which:FilmSide):void {
        const owned=this._frameViews.get(which);
        if(owned){
          this._frameViews.delete(which);
          try{owned.view?.dispose?.();}catch(_){}
          owned.canvas.remove();
        }
        this._setSide(which,null);
      }
      _releaseFrameViews():void{
        for(const which of ['previous','next'] as FilmSide[])this._clearFrameSide(which);
        this._frameSource=null;
        this._failedFrames.clear();
      }
      _syncFrameViews(state?:FilmState):void {
        if(!this._frameNodes){return;}
        const create=this.settings.createFilmstripThumbnail;
        const getModel=this.settings.getStoryboardModel;
        // The original design's adjacent frame sources are optional until
        // the production storyboard is available; never invent an image URL.
        if(typeof create!=='function'||typeof getModel!=='function'){return;}
        let model:FilmStoryboardModel|null|undefined;
        try{model=getModel();}
        catch(_){this._releaseFrameViews();return;}
        const count=model?.cellCount,interval=model?.cellIntervalMs;
        const duration=model?.duration,raw=model?.rawData;
        if(state?.seekStepSeconds===0||!model?.isAvailable||!raw||
          !Number.isSafeInteger(count)||(count as number)<1||
          !Number.isFinite(interval)||(interval as number)<=0||
          !Number.isFinite(duration)||(duration as number)<=0||
          typeof model.getIndex!=='function'){
          this._releaseFrameViews();return;
        }
        if(this._frameSource!==raw){
          this._releaseFrameViews();
          this._frameSource=raw;
        }
        let index:number;
        try{index=model.getIndex(Math.max(0,state?.time||0)*1000);}
        catch(_){this._releaseFrameViews();return;}
        if(!Number.isSafeInteger(index)||index<0||index>=(count as number)){
          this._releaseFrameViews();return;
        }
        for(const [which,offset] of [['previous',-1],['next',1]] as Array<[FilmSide,number]>){
          const sideIndex=index+offset;
          const node=this._frameNodes[which];
          if(sideIndex<0||sideIndex>=(count as number)){
            this._clearFrameSide(which);continue;
          }
          const seconds=Math.max(0,Math.min(duration as number,sideIndex*(interval as number)/1000));
          let entry=this._frameViews.get(which);
          if(!entry){
            if(this._failedFrames.has(which)){continue;}
            const canvas=this.document.createElement('canvas');
            canvas.width=160;canvas.height=90;
            canvas.className='zenzaSceneAdjacentCanvas';
            canvas.dataset.scuiSideThumbnail=which;
            node.button.insertBefore(canvas,node.img);
            let view:FilmThumbnailView|null|undefined;
            try{
              view=create({container:node.button,canvas,info:raw,
                name:'SceneSearchFilmstrip-'+which});
              if(!view||typeof view.dispose!=='function'){
                throw new Error('Adjacent thumbnail view not disposable');
              }
            }catch(_){
              canvas.remove();node.button.disabled=true;
              this._failedFrames.add(which);
              continue;
            }
            entry={canvas,view,index:-1};
            this._frameViews.set(which,entry);
          }
          if(entry.index!==sideIndex){
            try{entry.view.currentTime=seconds;entry.index=sideIndex;}
            catch(_){this._clearFrameSide(which);continue;}
          }
          node.img.hidden=true;node.img.removeAttribute('src');
          node.placeholder.hidden=true;
          node.button.disabled=false;
          node.button.dataset.sceneTime=String(seconds);
          node.label.textContent=FilmstripCard.timeLabel(seconds);
        }
      }
      onPreview(asset?:FilmAsset|null):void {
        super.onPreview(asset);
        const frames=asset?.frames;
        if(!this._frameViews.size){
          this._setSide('previous',frames?.previous);
          this._setSide('next',frames?.next);
        }
        if(this._frameNodes){
          this._frameNodes.caption.textContent=
            FilmstripCard.timeLabel(asset?.time);
        }
      }
      render(state?:FilmState):void {
        super.render(state);
        if(!this.root){return;}
        // A new video must never expose stale adjacent-frame image URLs.
        if(state&&Object.prototype.hasOwnProperty.call(state,'videoId')&&
          this._lastVideoId!==state.videoId){
          this._releaseFrameViews();
          this._lastVideoId=state.videoId;
          this._setSide('previous',null);
          this._setSide('next',null);
          if(this._frameNodes){this._frameNodes.caption.textContent='';}
          super.onPreview(null);
        }
        const compact=state?.seekStepSeconds===0;
        if(this._frameNodes){
          this._frameNodes.previous.fig.hidden=compact;
          this._frameNodes.next.fig.hidden=compact;
        }
        const frame=this.container.getBoundingClientRect?.();
        const width=this.container.offsetWidth||frame?.width||
          this.container.clientWidth||800;
        if(this.mode==='normal'){
          const viewportHeight=this.document.defaultView?.innerHeight;
          const room=Number.isFinite(viewportHeight)&&Number.isFinite(frame?.bottom)?
            (viewportHeight as number)-frame!.bottom:Infinity;
          // The original 160px threshold fits the filmstrip itself but not
          // the separately owned native list (up to 200px below the player).
          // Include its actual height and the existing UI07 list offset.
          const list=state?.commentListMode===true&&state.commentPreviewVisible!==false?
            this.container.querySelector<HTMLElement>('.zenzaCommentPreview'):null;
          const rect=list?.getBoundingClientRect?.();
          // The visible rect is authoritative. Avoid a synchronous content
          // scrollHeight/layout read on every seek-time render.
          let panelHeight=rect?.height||0;
          // Config listeners can render the list-open state before the native
          // CommentPreviewView.mode setter changes hover -> list. A 140px
          // hover rectangle does not describe the 200px scrollable list yet.
          // Reserve the native max-height during that brief transition;
          // do not read scrollHeight or create another DOM owner.
          if(list&&list.dataset.commentPreviewMode!=='list'){
            const css=this.document.defaultView?.getComputedStyle?.(list);
            const maximum=Number.parseFloat(css?.maxHeight as string);
            panelHeight=Math.max(panelHeight,Number.isFinite(maximum)?maximum:200);
          }
          if(list&&panelHeight<=0){
            const css=this.document.defaultView?.getComputedStyle?.(list);
            const maximum=Number.parseFloat(css?.maxHeight as string);
            panelHeight=Math.min(Number.isFinite(maximum)?maximum:Infinity,
              list.scrollHeight||0);
          }
          const listOffset=width<580?157:10; // UI07 native comment CSS.
          const required=list?Math.max(160,panelHeight+listOffset+8):160;
          this.root.dataset.scuiPlacement=room<required?'visible-fallback':'below';
          // Native screen modes lock page scrolling. If even the fallback
          // overlay would end below the viewport, lift that sibling list.
          // Do not move its native DOM or change its scroll/click owner.
          const lift=list&&this.root.dataset.scuiPlacement==='visible-fallback'&&
            Number.isFinite(frame?.bottom)&&Number.isFinite(viewportHeight)?
              Math.max(0,Math.ceil(frame!.bottom-94-(viewportHeight as number)+8)):0;
          const value=lift+'px';
          if(this._listLiftCurrent!==value){
            this.container.style.setProperty('--scui-ui07-list-lift',value);
            this._listLiftCurrent=value;
          }
        }else{
          this.root.dataset.scuiPlacement='seek-follow';
          const geometry=this.settings.getSeekGeometry?.();
          const duration=typeof this.settings.getDuration==='function'?
            this.settings.getDuration():this.settings.duration;
          const fraction=Number.isFinite(duration as number)&&(duration as number)>0?
            Math.max(0,Math.min(1,(state?.time||0)/(duration as number))):0.5;
          const desired=Number.isFinite(geometry?.pointerX as number)?(geometry!.pointerX as number):
            Number.isFinite(geometry?.seekLeft as number)&&Number.isFinite(geometry?.seekWidth as number)?
              (geometry!.seekLeft as number)+(geometry!.seekWidth as number)*fraction:width*fraction;
          const left=Math.max(0,Math.min(width,
            Number.isFinite(geometry?.visibleLeft as number)?(geometry!.visibleLeft as number):0));
          const right=Math.max(left,Math.min(width,
            Number.isFinite(geometry?.visibleRight as number)?(geometry!.visibleRight as number):width));
          const actualWidth=Math.min(right-left,compact?153:342);
          const minX=left+actualWidth/2;
          const maxX=right-actualWidth/2;
          const clamp=(x:number)=>maxX>=minX?Math.max(minX,Math.min(maxX,x)):
            (left+right)/2;
          const previous=parseFloat(this.root.style.getPropertyValue('--scene-x'));
          const x=state?.pinned&&Number.isFinite(previous)?
            clamp(previous):clamp(desired);
          this.root.style.setProperty('--scene-x',Math.round(x)+'px');
        }
        this._syncFrameViews(state);
      }
      dispose():void {
        this._releaseFrameViews();
        try{super.dispose();}
        finally{
          if(this._listLiftCurrent!==null){
            if(this._listLiftBefore)this.container.style.setProperty(
              '--scui-ui07-list-lift',this._listLiftBefore,this._listLiftPriority);
            else this.container.style.removeProperty('--scui-ui07-list-lift');
            this._listLiftCurrent=null;
          }
        }
        this._frameNodes=null;
        this._lastVideoId=null;
      }
    }
    registry.register({id:'07',label:'3コマ・フィルム',
      description:'通常は動画の外・下、全画面ではシークバーを追従。前後画像をクリックで選択',
      factory:args=>new FilmstripCard(args)});
    return registry;
  }
  static get CSS():string {
    return `
.zenzaSceneSearchHost.zenzaSceneFilmstrip {
  position:absolute;left:50%;right:auto;top:calc(100% + 12px);bottom:auto;
  transform:translateX(-50%);width:min(342px,calc(100% - 16px));
  border-top:2px solid #94bbd6;
  background:#1a1d25f5;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip[data-mode="fullscreen"] {
  position:absolute;left:var(--scene-x,50%);right:auto;top:auto;bottom:95px;
  transform:translateX(-50%);width:min(342px,calc(100% - 16px));
}
/* Zenza video modes may cover the whole viewport: keep the filmstrip
   visible above the bar if there is no space below the video. */
.zenzaSceneSearchHost.zenzaSceneFilmstrip[data-scui-placement="visible-fallback"] {
  top:auto;bottom:95px;
}
/* UI07 only: the native list is a sibling of the card and never gains
   page scroll in the locked normal player modes. Lift only when necessary. */
[data-scene-search-layout="07"][data-scene-mode="normal"][data-scene-placement="visible-fallback"]
 >.zenzaCommentPreview:where([data-comment-preview-mode="list"]){
  bottom:calc(94px + var(--scui-ui07-list-lift,0px))!important;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmstripFrames {
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr);
  gap:4px;
  min-width:0;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame {
  box-sizing:border-box;
  margin:0;
  min-width:0;
  padding:2px;
  background:#101720;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  border-radius:3px;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmJump{
  display:flex;flex-direction:column;justify-content:center;
  align-items:center;min-width:0;width:100%;min-height:60px;
  padding:0;border:1px solid transparent;border-radius:4px;
  background:#14283b;color:#d1eaff;overflow:hidden;cursor:pointer;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmJump:disabled{
  cursor:default;opacity:.6;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmJump:not(:disabled):is(:hover,:focus-visible){
  border-color:#95e9ff;outline-offset:1px;
}
/* Adjacent views reuse the existing StoryboardWorker's page-image cache.
   No additional worker is created; only two canvases belong to layout07. */
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneAdjacentCanvas{
  display:block;width:100%;height:auto;max-height:78px;
  aspect-ratio:16/9;object-fit:contain;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneAdjacentCanvas.is-loading{
  opacity:.35;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame img {
  display:block;
  width:100%;
  max-height:88px;
  height:60px;
  object-fit:contain;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame img[hidden],
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame[hidden] {
  display:none!important
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame.scene-current {
  box-shadow:inset 0 0 0 1px rgba(166,217,249,.68)
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrameTime {
  font-size:10px;min-height:12px;color:#cbd5e1;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmMissing {
  min-height:60px;display:grid;place-items:center;color:#8593a7;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmMissing[hidden] {display:none}
.zenzaSceneSearchHost.zenzaSceneFilmstrip.is-compact {
  width:min(153px,calc(100% - 12px));
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip.is-compact .zenzaSceneFilmstripFrames {
  grid-template-columns:minmax(0,1fr)
}
@media (max-width:600px) {
 .zenzaSceneSearchHost.zenzaSceneFilmstrip {
   width:min(330px,calc(100% - 12px));
 }
 .zenzaSceneSearchHost.zenzaSceneFilmstrip[data-mode="fullscreen"]{
   width:min(330px,calc(100% - 12px))
 }
 .zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame img {height:45px}
}
`;
  }
}

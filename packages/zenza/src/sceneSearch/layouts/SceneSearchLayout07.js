// SCUI-15: three-frame filmstrip. Uses ONLY images already supplied by
// the shared thumbnail provider. Does not initiate any additional fetches.
//===BEGIN===
class SceneSearchLayout07 {
  static install(registry,Card) {
    if(typeof registry?.register!=='function'||typeof Card!=='function'){
      throw new TypeError('Three-frame filmstrip needs registry and common card');
    }
    class FilmstripCard extends Card {
      constructor(args) {
        super({...args,layoutClass:'zenzaSceneFilmstrip',
          extraCss:SceneSearchLayout07.CSS,
          onAction:(action,ctx,event)=>{
            if(action==='frame-previous'||action==='frame-next'){
              const button=event?.target?.closest?.('button[data-scui-action]');
              const time=Number(button?.dataset?.sceneTime);
              if(!button||button.disabled||!button.hasAttribute('data-scene-time')||
                !Number.isFinite(time)||time<0){return;}
              args.onAction?.('frame-seek',{...ctx,time},event);
              return;
            }
            args.onAction?.(action,ctx,event);
          }});
        this._frameNodes=null;
        this.settings=args.settings||{};
        this._lastVideoId=null;
        this._frameSource=null;
        this._frameViews=new Map();
        this._failedFrames=new Set();
      }
      _makeSideFrame(which) {
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
      mount(state) {
        super.mount(state);
        try {
          const center=this.root.querySelector('.zenzaSceneImageBox');
          const wrap=this.document.createElement('div');
          wrap.className='zenzaSceneFilmstripFrames';
          const previous=this._makeSideFrame('previous');
          const next=this._makeSideFrame('next');
          const current=this.document.createElement('figure');
          current.className='zenzaSceneFilmFrame scene-current';
          current.dataset.frame='current';
          center.parentNode.insertBefore(wrap,center);
          current.appendChild(center);
          const caption=this.document.createElement('figcaption');
          caption.className='zenzaSceneFilmFrameTime';
          current.appendChild(caption);
          wrap.append(previous.fig,current,next.fig);
          this._frameNodes={previous,next,current,caption};
          this.render(state);
        }catch(e){this.dispose();throw e;}
      }
      static timeLabel(value) {
        if(!Number.isFinite(value)||value<0){return '';}
        const n=Math.floor(value);
        return String(Math.floor(n/60))+':'+String(n%60).padStart(2,'0');
      }
      _setSide(which,data) {
        const node=this._frameNodes?.[which];
        if(!node){return;}
        const src=typeof data==='string'?data:
          typeof data?.imageUrl==='string'?data.imageUrl:null;
        if(src&&/^(https?:\/\/|blob:|data:image\/)/i.test(src)){
          node.img.src=src;
          node.img.hidden=false;
          node.placeholder.hidden=true;
        }else{
          node.img.removeAttribute('src');
          node.img.hidden=true;
          node.placeholder.hidden=false;
        }
        const time=data?.time;
        const validTime=Number.isFinite(time)&&time>=0;
        const usableImage=!node.img.hidden;
        node.button.disabled=!validTime||!usableImage;
        if(validTime&&usableImage){
          node.button.dataset.sceneTime=String(time);
        }else{
          delete node.button.dataset.sceneTime;
        }
        node.label.textContent=FilmstripCard.timeLabel(time);
      }
      _clearFrameSide(which) {
        const owned=this._frameViews.get(which);
        if(owned){
          this._frameViews.delete(which);
          try{owned.view?.dispose?.();}catch(_){}
          owned.canvas.remove();
        }
        this._setSide(which,null);
      }
      _releaseFrameViews(){
        for(const which of ['previous','next'])this._clearFrameSide(which);
        this._frameSource=null;
        this._failedFrames.clear();
      }
      _syncFrameViews(state) {
        if(!this._frameNodes){return;}
        const create=this.settings.createFilmstripThumbnail;
        const getModel=this.settings.getStoryboardModel;
        // The original design's adjacent frame sources are optional until
        // the production storyboard is available; never invent an image URL.
        if(typeof create!=='function'||typeof getModel!=='function'){return;}
        let model;
        try{model=getModel();}
        catch(_){this._releaseFrameViews();return;}
        const count=model?.cellCount,interval=model?.cellIntervalMs;
        const duration=model?.duration,raw=model?.rawData;
        if(state?.seekStepSeconds===0||!model?.isAvailable||!raw||
          !Number.isSafeInteger(count)||count<1||
          !Number.isFinite(interval)||interval<=0||
          !Number.isFinite(duration)||duration<=0||
          typeof model.getIndex!=='function'){
          this._releaseFrameViews();return;
        }
        if(this._frameSource!==raw){
          this._releaseFrameViews();
          this._frameSource=raw;
        }
        let index;
        try{index=model.getIndex(Math.max(0,state?.time||0)*1000);}
        catch(_){this._releaseFrameViews();return;}
        if(!Number.isSafeInteger(index)||index<0||index>=count){
          this._releaseFrameViews();return;
        }
        for(const [which,offset] of [['previous',-1],['next',1]]){
          const sideIndex=index+offset;
          const node=this._frameNodes[which];
          if(sideIndex<0||sideIndex>=count){
            this._clearFrameSide(which);continue;
          }
          const seconds=Math.max(0,Math.min(duration,sideIndex*interval/1000));
          let entry=this._frameViews.get(which);
          if(!entry){
            if(this._failedFrames.has(which)){continue;}
            const canvas=this.document.createElement('canvas');
            canvas.width=160;canvas.height=90;
            canvas.className='zenzaSceneAdjacentCanvas';
            canvas.dataset.scuiSideThumbnail=which;
            node.button.insertBefore(canvas,node.img);
            let view;
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
      onPreview(asset) {
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
      render(state) {
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
            viewportHeight-frame.bottom:Infinity;
          this.root.dataset.scuiPlacement=room<160?'visible-fallback':'below';
        }else{
          this.root.dataset.scuiPlacement='seek-follow';
          const geometry=this.settings.getSeekGeometry?.();
          const duration=typeof this.settings.getDuration==='function'?
            this.settings.getDuration():this.settings.duration;
          const fraction=Number.isFinite(duration)&&duration>0?
            Math.max(0,Math.min(1,(state?.time||0)/duration)):0.5;
          const desired=Number.isFinite(geometry?.pointerX)?geometry.pointerX:
            Number.isFinite(geometry?.seekLeft)&&Number.isFinite(geometry?.seekWidth)?
              geometry.seekLeft+geometry.seekWidth*fraction:width*fraction;
          const left=Math.max(0,Math.min(width,
            Number.isFinite(geometry?.visibleLeft)?geometry.visibleLeft:0));
          const right=Math.max(left,Math.min(width,
            Number.isFinite(geometry?.visibleRight)?geometry.visibleRight:width));
          const actualWidth=Math.min(right-left,compact?153:342);
          const minX=left+actualWidth/2;
          const maxX=right-actualWidth/2;
          const clamp=x=>maxX>=minX?Math.max(minX,Math.min(maxX,x)):
            (left+right)/2;
          const previous=parseFloat(this.root.style.getPropertyValue('--scene-x'));
          const x=state?.pinned&&Number.isFinite(previous)?
            clamp(previous):clamp(desired);
          this.root.style.setProperty('--scene-x',Math.round(x)+'px');
        }
        this._syncFrameViews(state);
      }
      dispose() {
        this._releaseFrameViews();
        super.dispose();
        this._frameNodes=null;
        this._lastVideoId=null;
      }
    }
    registry.register({id:'07',label:'3コマ・フィルム',
      description:'通常は動画の外・下、全画面ではシークバーを追従。前後画像をクリックで選択',
      factory:args=>new FilmstripCard(args)});
    return registry;
  }
  static get CSS() {
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
//===END===
export {SceneSearchLayout07};
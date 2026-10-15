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
          extraCss:SceneSearchLayout07.CSS});
        this._frameNodes=null;
      }
      _makeSideFrame(which) {
        const d=this.document;
        const fig=d.createElement('figure');
        fig.className='zenzaSceneFilmFrame scene-'+which;
        fig.dataset.frame=which;
        const img=d.createElement('img');
        img.alt=which==='previous'?'前の場面':'次の場面';
        img.hidden=true;
        fig.appendChild(img);
        const placeholder=d.createElement('span');
        placeholder.className='zenzaSceneFilmMissing';
        placeholder.textContent='—';
        fig.appendChild(placeholder);
        const label=d.createElement('figcaption');
        label.className='zenzaSceneFilmFrameTime';
        label.textContent='';
        fig.appendChild(label);
        return {fig,img,placeholder,label};
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
        node.label.textContent=FilmstripCard.timeLabel(data?.time);
      }
      onPreview(asset) {
        super.onPreview(asset);
        const frames=asset?.frames;
        this._setSide('previous',frames?.previous);
        this._setSide('next',frames?.next);
        if(this._frameNodes){
          this._frameNodes.caption.textContent=
            FilmstripCard.timeLabel(asset?.time);
        }
      }
      render(state) {
        super.render(state);
        if(!this._frameNodes){return;}
        const compact=state?.seekStepSeconds===0;
        this._frameNodes.previous.fig.hidden=compact;
        this._frameNodes.next.fig.hidden=compact;
      }
      dispose() {
        super.dispose();
        this._frameNodes=null;
      }
    }
    registry.register({id:'07',label:'3コマ・フィルム',
      description:'前後のキャッシュ済みシーンと現在のシーンを一列で比較',
      factory:args=>new FilmstripCard(args)});
    return registry;
  }
  static get CSS() {
    return `
.zenzaSceneSearchHost.zenzaSceneFilmstrip {
  width:min(470px,calc(100% - 16px));
  bottom:calc(var(--scene-bottom,64px) + 16px);
  border-top:2px solid #94bbd6;
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip[data-mode="fullscreen"] {
  position:fixed;
  width:min(530px,calc(100vw - 24px));
  bottom:calc(var(--scene-bottom,64px) + 24px);
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
  width:min(124px,calc(100% - 12px));
}
.zenzaSceneSearchHost.zenzaSceneFilmstrip.is-compact .zenzaSceneFilmstripFrames {
  grid-template-columns:minmax(0,1fr)
}
@media (max-width:600px) {
 .zenzaSceneSearchHost.zenzaSceneFilmstrip {
   width:min(330px,calc(100% - 12px));
 }
 .zenzaSceneSearchHost.zenzaSceneFilmstrip[data-mode="fullscreen"]{
   width:min(360px,calc(100vw - 12px))
 }
 .zenzaSceneSearchHost.zenzaSceneFilmstrip .zenzaSceneFilmFrame img {height:45px}
}
`;
  }
}
//===END===
export {SceneSearchLayout07};
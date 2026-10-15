// SCUI-17: bounded collision-aware scene search placement.
// No MutationObserver, resize polling, network calls or global listeners.
//===BEGIN===
class SceneSearchLayout10 {
  static get STYLE() {return `
.zenzaSceneSearchHost[data-layout="10"]{
  --scene-bottom:78px;max-width:calc(100% - 14px);
  transition:left .12s ease-out,bottom .12s ease-out;
}
.zenzaSceneSearchHost[data-layout="10"].is-compact{
  width:min(124px,calc(100% - 14px));
}
.zenzaSceneSearchHost[data-layout="10"][data-mode="fullscreen"]{
  --scene-bottom:88px;
}
@media(prefers-reduced-motion:reduce){
 .zenzaSceneSearchHost[data-layout="10"]{transition:none}
}
`;}
  static validRect(r){
    return !!r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&
      r.width>=0&&r.height>=0;
  }
  static overlap(a,b){
    return Math.max(0,Math.min(a.right,b.x+b.width)-Math.max(a.left,b.x))*
      Math.max(0,Math.min(a.bottom,b.y+b.height)-Math.max(a.top,b.y));
  }
  static choose({width,height,sceneWidth,sceneHeight,cursorX,obstacles=[],
    previous=null,baseBottom=78}={}){
    if(![width,height,sceneWidth,sceneHeight].every(Number.isFinite)||
       width<=0||height<=0||sceneWidth<=0||sceneHeight<=0){return null;}
    const margin=7;
    const clamp=x=>Math.min(width-sceneWidth/2-margin,
      Math.max(sceneWidth/2+margin,x));
    const target=clamp(Number.isFinite(cursorX)?cursorX:width/2);
    const base=Math.max(0,baseBottom);
    const raised=base+sceneHeight+12;
    const choices=[
      {x:target,bottom:base,slot:'cursor'},
      {x:clamp(width*.24),bottom:base,slot:'left'},
      {x:clamp(width*.76),bottom:base,slot:'right'},
      {x:clamp(width*.5),bottom:raised,slot:'raised'},
      {x:target,bottom:raised,slot:'above-cursor'}
    ];
    let winner=null,best=Infinity;
    for(const c of choices){
      if(c.bottom+sceneHeight+margin>height){continue;}
      const box={left:c.x-sceneWidth/2,right:c.x+sceneWidth/2,
        top:height-c.bottom-sceneHeight,bottom:height-c.bottom};
      const overlap=obstacles.filter(SceneSearchLayout10.validRect)
        .reduce((sum,r)=>sum+SceneSearchLayout10.overlap(box,r),0);
      const shift=Math.abs(c.x-target)*.07+
        Math.max(0,c.bottom-base)*.06;
      const sticky=previous?.slot===c.slot?-50:0;
      const score=overlap*100+shift+sticky;
      if(score<best){winner={...c,overlap,score};best=score;}
    }
    return winner;
  }
  static register(registry,{Card,clock}={}){
    if(!registry||typeof registry.register!=='function'||typeof Card!=='function'){
      throw new TypeError('Layout10 requires registry and shared Card');
    }
    registry.register({id:'10',label:'スマート自動回避',
      description:'コメントプレビューとの衝突を低頻度で検出し自動配置する',
      factory:args=>new SceneSearchLayout10({...args,Card,clock})});
    return registry;
  }
  constructor({document,container,mode,onAction,settings={},Card,clock}={}){
    if(!Card||!document||!container){throw new TypeError('Missing shared card');}
    this.document=document;this.container=container;this.mode=mode;
    this.settings=settings||{};
    this.clock=clock||{now:()=>Date.now()};
    this.card=new Card({document,container,mode,id:'10',
      layoutClass:'zenzaSceneSmartAvoid',
      extraCss:SceneSearchLayout10.STYLE,onAction});
    this.root=null;this._lastCheck=-Infinity;this._previous=null;this._disposed=false;
  }
  mount(state){
    if(this._disposed){throw new Error('Layout10 disposed');}
    this.card.mount(state);this.root=this.card.root;this.render(state);
  }
  geometry(){
    if(typeof this.settings.measure==='function'){
      return this.settings.measure(this.root,this.container,this.mode);
    }
    const frame=this.container.getBoundingClientRect();
    const card=this.root.getBoundingClientRect();
    if(!frame.width||!frame.height||!card.width||!card.height){return null;}
    return {width:frame.width,height:frame.height,
      sceneWidth:card.width,sceneHeight:card.height,cursorX:frame.width/2,
      obstacles:Array.from(this.container.querySelectorAll('.zenzaCommentPreview'))
        .filter(el=>!el.hidden).map(el=>{
          const r=el.getBoundingClientRect();
          return {x:r.x-frame.x,y:r.y-frame.y,width:r.width,height:r.height};
        })};
  }
  render(state){
    if(this._disposed){return;}
    this.card.render(state);
    if(!this.root||this.root.hidden){return;}
    const now=this.clock.now();
    if(Number.isFinite(now)&&now-this._lastCheck<160){return;}
    this._lastCheck=Number.isFinite(now)?now:Date.now();
    const input=this.geometry();if(!input){return;}
    const next=SceneSearchLayout10.choose({...input,
      baseBottom:this.mode==='fullscreen'?88:78,previous:this._previous});
    if(!next){return;}
    if(!this._previous||this._previous.x!==next.x||
       this._previous.bottom!==next.bottom){
      this.root.style.setProperty('--scene-x',next.x+'px');
      this.root.style.setProperty('--scene-bottom',next.bottom+'px');
    }
    this._previous=next;
  }
  onPreview(asset,context){this.card.onPreview(asset,context);}
  dispose(){
    if(this._disposed){return;}
    this._disposed=true;this.card.dispose();this.root=null;this._previous=null;
  }
}
//===END===
export {SceneSearchLayout10};
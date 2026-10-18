// SCUI-11: reusable semantic scene card, with no background event handlers.
// CSS placements are supplied by separately registered layout strategies.
//===BEGIN===
class SceneSearchLayoutCard {
  constructor({document,container,id,mode,layoutClass='',extraCss='',onAction}={}) {
    if(!document || !container || !/^(0[1-9]|10)$/.test(id) ||
       !['normal','fullscreen'].includes(mode)){
      throw new TypeError('SceneSearchLayoutCard requires DOM, layout and mode');
    }
    this.document=document;
    this.container=container;
    this.id=id;
    this.mode=mode;
    this.layoutClass=layoutClass;
    this.extraCss=extraCss;
    this.onAction=typeof onAction==='function'?onAction:()=>{};
    this.root=null;
    this.style=null;
    this._lastState=null;
    this._handlers={
      click:this._onClick.bind(this),
      keydown:this._onKeyDown.bind(this)
    };
  }
  static button(doc,name,text,label) {
    const b=doc.createElement('button');
    b.type='button';
    b.dataset.scuiAction=name;
    b.className='zenzaSceneBtn scene-'+name;
    b.textContent=text;
    b.setAttribute('aria-label',label);
    b.title=label;
    if(name==='more'){
      b.setAttribute('aria-haspopup','true');
      b.setAttribute('aria-expanded','false');
    }
    return b;
  }
  mount(state) {
    if(this.root){throw new Error('Already mounted');}
    const d=this.document;
    const style=d.createElement('style');
    style.dataset.scuiLayoutStyle=this.id;
    style.textContent=SceneSearchLayoutCard.CSS+'\n'+this.extraCss;
    d.head.appendChild(style);
    this.style=style;
    try {
      const root=d.createElement('section');
      root.className='zenzaSceneSearchHost '+this.layoutClass;
      root.dataset.layout=this.id;
      root.dataset.mode=this.mode;
      root.setAttribute('role','group');
      root.setAttribute('aria-label','シーンサーチ');
      const imageBox=d.createElement('div');
      imageBox.className='zenzaSceneImageBox';
      const image=d.createElement('img');
      image.className='zenzaSceneImage';
      image.alt='現在のシーンサーチ画像';
      image.hidden=true;
      imageBox.appendChild(image);
      const message=d.createElement('span');
      message.className='zenzaSceneImagePlaceholder';
      message.textContent='プレビュー画像なし';
      imageBox.appendChild(message);
      const foot=d.createElement('div');
      foot.className='zenzaSceneFoot';
      const label=d.createElement('span');
      label.className='zenzaSceneTime';
      label.textContent='0:00';
      foot.appendChild(label);
      const buttons=d.createElement('div');
      buttons.className='zenzaSceneActions';
      for(const [name,symbol,aria] of [
        ['seek-back','‹','指定秒数戻る'],
        ['seek-forward','›','指定秒数進む'],
        ['more','⋯','シーンサーチの追加操作'],
        ['pin','📌','シーンサーチを固定'],
        ['comment-toggle','💬','流れるコメント／一覧の切替'],
        ['comment-search','⌕','コメント検索'],
        ['seek-step','5秒','移動秒数設定']
      ])buttons.appendChild(SceneSearchLayoutCard.button(d,name,symbol,aria));
      foot.appendChild(buttons);
      root.appendChild(imageBox);
      root.appendChild(foot);
      root.addEventListener('click',this._handlers.click);
      root.addEventListener('keydown',this._handlers.keydown);
      this.container.appendChild(root);
      this.root=root;
      this.render(state);
    }catch(e){this.dispose();throw e;}
  }
  _onClick(e) {
    const button=e.target.closest?.('button[data-scui-action]');
    if(!button || !this.root?.contains(button) || button.disabled){return;}
    const action=button.dataset.scuiAction;
    if(action==='more') {
      this.root.classList.toggle('is-expanded');
      button.setAttribute('aria-expanded',
        String(this.root.classList.contains('is-expanded')));
    }
    this.onAction(action,{layoutId:this.id,mode:this.mode},e);
  }
  _onKeyDown(e) {
    if(e.key==='Escape' && this.root?.classList.contains('is-expanded')){
      this.root.classList.remove('is-expanded');
      const more=this.root.querySelector('[data-scui-action="more"]');
      more?.setAttribute('aria-expanded','false');
      more?.focus();
      e.preventDefault();
      e.stopPropagation();
    }
  }
  render(state) {
    if(!this.root){return;}
    state=state||{};
    const previous=this._lastState;
    this._lastState=state;
    const time=Number.isFinite(state.time)&&state.time>=0?Math.floor(state.time):0;
    if(!previous||Math.floor(previous.time)!==time){
      this.root.querySelector('.zenzaSceneTime').textContent=
        String(Math.floor(time/60))+':'+String(time%60).padStart(2,'0');
    }
    if(previous&&previous.shown===state.shown&&previous.pinned===state.pinned&&
      previous.seekStepSeconds===state.seekStepSeconds&&
      previous.commentPreviewVisible===state.commentPreviewVisible&&
      previous.commentListMode===state.commentListMode&&previous.videoId===state.videoId){
      return; // Layout subclass still updates geometry; unchanged controls do not.
    }
    this.root.dataset.mode=this.mode;
    this.root.hidden=state.shown===false && !state.pinned;
    this.root.classList.toggle('is-pinned',state.pinned===true);
    const seconds=state.seekStepSeconds;
    const compact=seconds===0;
    this.root.classList.toggle('is-compact',compact);
    this.root.style.setProperty('--scene-preview-min-width',compact?'124px':'180px');
    for(const action of ['seek-back','seek-forward']){
      const button=this.root.querySelector('[data-scui-action="'+action+'"]');
      button.hidden=compact;
      button.disabled=compact;
      button.style.display=compact?'none':'';
    }
    this.root.querySelector('[data-scui-action="seek-step"]').textContent=
      String(Number.isSafeInteger(seconds)?seconds:5)+'秒';
    const pin=this.root.querySelector('[data-scui-action="pin"]');
    pin.setAttribute('aria-pressed',String(state.pinned===true));
    pin.title=state.pinned?'固定解除':'シーンサーチを固定';
    const comment=this.root.querySelector('[data-scui-action="comment-toggle"]');
    comment.setAttribute('aria-pressed',String(state.commentListMode===true));
    const modeAction=state.commentListMode?'サムネイルに重ねて流れるコメントに切り替え':
      'シーンサーチのコメント一覧に切り替え';
    comment.setAttribute('aria-label',modeAction);
    comment.title=modeAction+(state.commentPreviewVisible===false?'（コメント表示はOFF）':'');
  }
  onPreview(asset) {
    if(!this.root){return;}
    const image=this.root.querySelector('.zenzaSceneImage');
    const placeholder=this.root.querySelector('.zenzaSceneImagePlaceholder');
    const url=typeof asset==='string'?asset:
      typeof asset?.imageUrl==='string'?asset.imageUrl:null;
    if(url && /^(https?:\/\/|blob:|data:image\/)/i.test(url)){
      image.src=url;
      image.hidden=false;
      placeholder.hidden=true;
    }else{
      image.removeAttribute('src');
      image.hidden=true;
      placeholder.hidden=false;
    }
  }
  dispose() {
    if(this.root){
      this.root.removeEventListener('click',this._handlers.click);
      this.root.removeEventListener('keydown',this._handlers.keydown);
      this.root.remove();
      this.root=null;
    }
    this.style?.remove();
    this.style=null;
    this._lastState=null;
  }
  static get CSS() { return `
.zenzaSceneSearchHost {
  --scene-preview-min-width:180px;
  position:absolute;
  box-sizing:border-box;
  left:var(--scene-x,50%);
  bottom:var(--scene-bottom,64px);
  width:var(--scene-preview-min-width);
  max-width:calc(100% - 12px);
  transform:translateX(-50%);
  z-index:150;
  border-radius:5px;
  padding:4px;
  border:1px solid rgba(204,204,204,.55);
  background:#000;
  color:#eee;
  font:12px/1.35 system-ui,sans-serif;
  box-shadow:0 4px 14px rgba(0,0,0,.25);
}
.zenzaSceneSearchHost[hidden],.zenzaSceneBtn[hidden]{display:none!important}
.zenzaSceneImageBox{min-height:42px;overflow:hidden;display:grid;place-items:center;background:#17181b}
.zenzaSceneImage{display:block;width:100%;height:auto;max-height:120px;object-fit:contain}
.zenzaSceneImage[hidden],.zenzaSceneImagePlaceholder[hidden]{display:none}
.zenzaSceneImagePlaceholder{font-size:11px;color:#9fa5af}
.zenzaSceneFoot{display:flex;align-items:center;justify-content:space-between;min-width:0;gap:5px}
.zenzaSceneTime{white-space:nowrap;font-variant-numeric:tabular-nums}
.zenzaSceneActions{display:flex;align-items:center;gap:2px;position:static;flex:0 0 auto}
.zenzaSceneBtn{border:0;border-radius:4px;background:rgba(35,42,54,.88);color:inherit;
  min-width:23px;height:24px;padding:1px 3px;cursor:pointer}
.zenzaSceneBtn:focus-visible{outline:2px solid #8ed8ff;outline-offset:1px}
.zenzaSceneBtn[aria-pressed="true"]{background:#315977;color:#fff}
.zenzaSceneBtn.scene-more{display:inline-grid;place-items:center}
.zenzaSceneBtn.scene-pin,.zenzaSceneBtn.scene-comment-toggle,
.zenzaSceneBtn.scene-comment-search,.zenzaSceneBtn.scene-seek-step{
  position:absolute;bottom:100%;
  opacity:0;visibility:hidden;pointer-events:none;
  transition:opacity .13s ease,visibility .13s}
.zenzaSceneBtn.scene-pin{right:0}
.zenzaSceneBtn.scene-comment-toggle{right:27px}
.zenzaSceneBtn.scene-comment-search{right:54px}
.zenzaSceneBtn.scene-seek-step{right:81px}
.zenzaSceneSearchHost:is(:hover,:focus-within,.is-expanded) .zenzaSceneBtn{
  opacity:1;visibility:visible;pointer-events:auto}
.zenzaSceneSearchHost.is-compact .zenzaSceneImageBox{min-height:28px}
.zenzaSceneSearchHost.is-compact .zenzaSceneImage{max-height:75px}
.zenzaSceneSearchHost .zenzaSeekThumbnail-image{max-width:100%}
.zenzaSceneSearchHost .zenzaSeekThumbnail-thumbnail{max-width:100%;height:auto}
/* The original worker always paints 160x90. Scale visually, do not resize its backing store. */
.zenzaSceneSearchHost.is-compact .zenzaSeekThumbnail-image,
.zenzaSceneSearchHost.is-compact .zenzaSeekThumbnail-thumbnail{width:112px;height:63px}
.zenzaSceneSearchHost.is-compact .zenzaSeekThumbnail{max-width:100%;margin:0 auto}
@media (prefers-reduced-motion: reduce) {
  /* Turn off decorative SCUI motion, not the ORIGINAL CommentPreviewView.
     UI00 also keeps its native comment timing under this preference. */
  .zenzaSceneSearchHost :not(.zenzaCommentPreview):not(.zenzaCommentPreview *){
    transition:none!important;animation:none!important
  }
}
`; }
}
//===END===
export {SceneSearchLayoutCard};
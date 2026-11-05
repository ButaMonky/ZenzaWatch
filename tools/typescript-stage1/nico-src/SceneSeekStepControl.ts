/** Native seek-step control typed without changing its DOM ownership or behavior. */
type SceneSeekOptions={
  document?:Document;
  getSeconds?:()=>unknown;
  setSeconds?:(value:number)=>void;
  onSeek?:(delta:number)=>void;
  onCompactChange?:(isCompact:boolean,details:{minPreviewWidth:number})=>void;
  onMenuChange?:(open:boolean)=>void;
  onError?:(error:unknown)=>void;
};
export class SceneSeekStepControl {
  declare document:Document;
  declare private _getSeconds:()=>unknown;
  declare private _setSeconds:(value:number)=>void;
  declare private _onSeek:(delta:number)=>void;
  declare private _onCompactChange:((isCompact:boolean,details:{minPreviewWidth:number})=>void)|null;
  declare private _onMenuChange:((open:boolean)=>void)|null;
  declare private _onError:((error:unknown)=>void)|null;
  declare private _seconds:number;
  declare private _compact:boolean|null;
  declare root:HTMLDivElement|null;
  declare private _opened:boolean;
  declare private _onClick:(event:MouseEvent)=>void;
  declare private _onKey:(event:KeyboardEvent)=>void;
  declare private _onOutside:(event:PointerEvent)=>void;
  static get PRESETS() { return [0,1,3,5,10,15,30,60]; }
  static validStep(value:unknown):value is number {
    return Number.isSafeInteger(value as number) && (value as number)>=0 && (value as number)<=600;
  }
  constructor({document,getSeconds,setSeconds,onSeek,onCompactChange,onMenuChange,onError}:SceneSeekOptions={}) {
    if(!document || typeof getSeconds!=='function' ||
      typeof setSeconds!=='function' || typeof onSeek!=='function'){
      throw new TypeError('SeekStepControl requires document and callbacks');
    }
    this.document=document;
    this._getSeconds=getSeconds;
    this._setSeconds=setSeconds;
    this._onSeek=onSeek;
    this._onCompactChange=onCompactChange||null;
    this._onMenuChange=typeof onMenuChange==='function'?onMenuChange:null;
    this._onError=onError||null;
    this._seconds=5;
    this._compact=null;
    this.root=null;
    this._opened=false;
    this._onClick=this._handleClick.bind(this);
    this._onKey=this._handleKey.bind(this);
    this._onOutside=this._handleOutside.bind(this);
  }
  mount(container:HTMLElement):HTMLDivElement {
    if(!container || typeof container.appendChild!=='function'){
      throw new TypeError('A mounting container is required');
    }
    if(this.root){throw new Error('Control already mounted');}
    const root=this.document.createElement('div');
    root.className='zenzaSceneSeekStepControl';
    root.setAttribute('role','group');
    root.setAttribute('aria-label','シーンサーチの移動秒数');
    root.innerHTML=`
      <button type="button" data-scui="back" aria-label="指定秒数戻る">‹</button>
      <button type="button" data-scui="open" aria-haspopup="true"
        aria-expanded="false" aria-label="移動秒数を変更">5秒</button>
      <button type="button" data-scui="forward" aria-label="指定秒数進む">›</button>
      <section class="zenzaSceneStepPopup" data-scui="panel" hidden>
        <div class="zenzaSceneStepPresets" data-scui="presets"></div>
        <label>秒数 <input type="number" data-scui="custom"
          min="0" max="600" step="1" aria-label="移動秒数（0〜600秒）"></label>
        <button type="button" data-scui="save">適用</button>
        <button type="button" data-scui="cancel">閉じる</button>
      </section>`;
    const list=root.querySelector('[data-scui="presets"]');
    for(const step of SceneSeekStepControl.PRESETS){
      const button=this.document.createElement('button');
      button.type='button';
      button.dataset.scui='preset';
      button.dataset.seconds=String(step);
      button.textContent=step+'秒';
      list!.appendChild(button);
    }
    root.addEventListener('click',this._onClick);
    root.addEventListener('keydown',this._onKey);
    container.appendChild(root);
    this.root=root;
    this.updateFromConfig();
    return root;
  }
  _node(action:string):HTMLElement|null|undefined {return this.root?.querySelector<HTMLElement>('[data-scui="'+action+'"]');}
  get seconds():number {return this._seconds;}
  updateFromConfig():number {
    const value=this._getSeconds();
    this._seconds=SceneSeekStepControl.validStep(value)?value:5;
    this._render();
    return this._seconds;
  }
  setStep(value:unknown):boolean {
    if(!SceneSeekStepControl.validStep(value)){
      this._node('custom')?.setAttribute('aria-invalid','true');
      return false;
    }
    try{this._setSeconds(value as number);}catch(error){
      this._onError?.(error);return false;
    }
    this._seconds=value as number;
    this._node('custom')?.removeAttribute('aria-invalid');
    this._render();
    return true;
  }
  _render():void {
    if(!this.root){return;}
    const compact=this._seconds===0;
    this.root.classList.toggle('is-compact',compact);
    this.root.style.setProperty('--scene-preview-min-width',
      compact?'124px':'180px');
    for(const id of ['back','forward']){
      const control=this._node(id)!;
      control.hidden=compact;
      control.style.display=compact?'none':'';
      (control as HTMLButtonElement).disabled=compact;
    }
    this._node('open')!.textContent=this._seconds+'秒';
    (this._node('custom') as HTMLInputElement).value=String(this._seconds);
    this.root.querySelectorAll<HTMLElement>('[data-scui="preset"]').forEach(button=>{
      button.setAttribute('aria-pressed',String(
        Number(button.dataset.seconds)===this._seconds));
    });
    if(this._compact!==compact){
      this._compact=compact;
      this._onCompactChange?.(compact,{minPreviewWidth:compact?124:180});
    }
  }
  seek(direction:unknown):boolean {
    if(!this._seconds){return false;}
    const sign=Math.sign(Number(direction));
    if(!Number.isFinite(sign)||sign===0){return false;}
    this._onSeek(sign*this._seconds);
    return true;
  }
  openMenu():void {
    if(!this.root||this._opened){return;}
    this._opened=true;
    this._node('panel')!.hidden=false;
    this._node('open')!.setAttribute('aria-expanded','true');
    this.document.addEventListener('pointerdown',this._onOutside,true);
    this._onMenuChange?.(true);
    this._node('custom')!.focus();
  }
  closeMenu():void {
    if(!this.root||!this._opened){return;}
    this._opened=false;
    this._node('panel')!.hidden=true;
    this._node('open')!.setAttribute('aria-expanded','false');
    this.document.removeEventListener('pointerdown',this._onOutside,true);
    this._onMenuChange?.(false);
  }
  _handleOutside(e:PointerEvent):void {
    if(this.root&&!this.root.contains(e.target as Node)){this.closeMenu();}
  }
  _applyCustom():boolean {
    const input=this._node('custom') as HTMLInputElement|null;
    const raw=input?.value.trim();
    if(!raw||!/^\d+$/.test(raw)){
      input?.setAttribute('aria-invalid','true');return false;
    }
    const value=Number(raw);
    if(!this.setStep(value)){return false;}
    this.closeMenu();return true;
  }
  _handleClick(e:MouseEvent):void {
    const button=(e.target as HTMLElement).closest?.<HTMLButtonElement>('button[data-scui]');
    if(!button||!this.root?.contains(button)){return;}
    const action=button.dataset.scui;
    if(action==='back'||action==='forward'){
      this.seek(action==='back'?-1:1);
    }else if(action==='open'){
      this._opened?this.closeMenu():this.openMenu();
    }else if(action==='preset'){
      if(this.setStep(Number(button.dataset.seconds))){this.closeMenu();}
    }else if(action==='save'){
      this._applyCustom();
    }else if(action==='cancel'){
      this.closeMenu();
    }
  }
  _handleKey(e:KeyboardEvent):void {
    if(!this._opened){return;}
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();this.closeMenu();
      this._node('open')!.focus();
    }else if(e.key==='Enter'&&e.target===this._node('custom')){
      e.preventDefault();e.stopPropagation();this._applyCustom();
    }else if(e.target===this._node('custom')){
      e.stopPropagation(); // Do not forward text edits to player shortcuts.
    }
  }
  dispose():void {
    if(!this.root){return;}
    this.closeMenu();
    this.root.removeEventListener('click',this._onClick);
    this.root.removeEventListener('keydown',this._onKey);
    this.root.remove();
    this.root=null;
    this._compact=null;
  }
}

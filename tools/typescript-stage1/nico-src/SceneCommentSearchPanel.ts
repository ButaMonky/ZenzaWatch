import type {SearchPanelOptions, SearchModel, SearchState} from "./SceneRuntimeContracts";
export class SceneCommentSearchPanel {

 declare readonly document:Document;declare readonly search:SearchModel;declare private _onOpenChange:SearchPanelOptions['onOpenChange'];
 declare root:HTMLElement|null;declare private _open:boolean;declare private _onInput:(event:Event)=>void;declare private _onClick:(event:Event)=>void;declare private _onKey:(event:KeyboardEvent)=>void;

  constructor({document,search,onOpenChange}:SearchPanelOptions={}) {
    if(!document||!search||typeof search.search!=='function'){
      throw new TypeError('Search panel needs document and comment search model');
    }
    this.document=document;
    this.search=search;
    this._onOpenChange=onOpenChange;
    this.root=null;
    this._open=false;
    this._onInput=this._handleInput.bind(this);
    this._onClick=this._handleClick.bind(this);
    this._onKey=this._handleKey.bind(this);
  }
  mount(container:HTMLElement) {
    if(!container||this.root){throw new Error('Search panel cannot be mounted');}
    const root=this.document.createElement('section');
    root.className='zenzaSceneCommentSearch';
    root.setAttribute('role','search');
    root.setAttribute('aria-label','読み込み済みコメントを検索');
    root.hidden=true;
    const label=this.document.createElement('label');
    label.textContent='コメントを検索';
    const input=this.document.createElement('input');
    input.type='search';
    input.maxLength=128;
    input.setAttribute('data-scui','query');
    input.setAttribute('autocomplete','off');
    label.appendChild(input);
    root.appendChild(label);
    const info=this.document.createElement('output');
    info.setAttribute('data-scui','count');
    root.appendChild(info);
    const list=this.document.createElement('ul');
    list.setAttribute('data-scui','hits');
    list.setAttribute('aria-label','コメント検索結果');
    root.appendChild(list);
    root.addEventListener('input',this._onInput);
    root.addEventListener('click',this._onClick);
    root.addEventListener('keydown',this._onKey);
    container.appendChild(root);
    this.root=root;
    return root;
  }
  open() {
    if(!this.root){return false;}
    this._open=true;
    this.root.hidden=false;
    this._onOpenChange?.(true);
    const input=this.root.querySelector<HTMLInputElement>('[data-scui="query"]')!;
    input.focus();
    this.refresh();
    return true;
  }
  close() {
    if(!this.root||!this._open){return;}
    this._open=false;
    this.root.hidden=true;
    this._onOpenChange?.(false);
  }
  toggle(){if(this._open){this.close();}else{this.open();}}
  reset() {
    this.search.reset();
    if(!this.root){return;}
    this.root.querySelector<HTMLInputElement>('[data-scui="query"]')!.value='';
    this._render(this.search.state);
  }
  refresh() {
    if(!this.root){return;}
    const input=this.root.querySelector<HTMLInputElement>('[data-scui="query"]')!;
    this._render(this.search.search(input.value));
  }
  _render(state:SearchState) {
    const list=this.root?.querySelector('[data-scui="hits"]');
    if(!list){return;}
    list.replaceChildren();
    const count=this.root!.querySelector('[data-scui="count"]');
    count!.textContent=state.query?
      `${state.total}件${state.truncated?'（先頭'+state.hits.length+'件を表示）':''}`:
      '読み込み済みのコメントから検索します';
    state.hits.forEach((hit,index)=>{
      const li=this.document.createElement('li');
      const button=this.document.createElement('button');
      button.type='button';
      button.dataset.scui='result';
      button.dataset.index=String(index);
      button.textContent=`${Math.floor(hit.time/60)}:${String(Math.floor(hit.time%60)).padStart(2,'0')}  ${hit.text}`;
      button.title='このコメントの時刻へ移動';
      li.appendChild(button);
      list.appendChild(li);
    });
  }
  _handleInput(event:Event){
    if((event.target as HTMLElement|null)?.dataset?.scui==='query'){this.refresh();}
  }
  _handleClick(event:Event){
    const button=(event.target as Element|null)?.closest?.<HTMLButtonElement>('[data-scui="result"]');
    if(button&&this.root?.contains(button)){
      if(this.search.select(Number(button.dataset.index))){this.close();}
    }
  }
  _handleKey(event:KeyboardEvent){
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();this.close();return;
    }
    if((event.target as HTMLElement|null)?.dataset?.scui==='query'){
      event.stopPropagation(); // Search text is never a playback shortcut.
      if(event.key==='Enter'){
        event.preventDefault();
        if(this.search.select(0)){this.close();}
      }
    }
  }
  dispose(){
    if(!this.root){return;}
    this.root.removeEventListener('input',this._onInput);
    this.root.removeEventListener('click',this._onClick);
    this.root.removeEventListener('keydown',this._onKey);
    this.root.remove();
    this.root=null;
    this._open=false;
  }
}

import type {HlsStorageClient} from './HlsStorage';
// Compatibility boundary: runtime owns persistence and engine configuration.
type Loose = any;
export interface HlsDebugElementDependencies {
  html: (...args: Loose[]) => Loose;
  render: (content: Loose, container: Loose) => void;
  Storage: Pick<HlsStorageClient, 'clear'>;
  HTMLDialogElement: typeof HTMLElement | undefined;
}
export function defineHlsDebugElements(_config: Record<string, Loose>, {Storage, HTMLDialogElement}: HlsDebugElementDependencies): CustomElementConstructor | undefined {
  if (!HTMLDialogElement || !window.customElements) return;
  const existing = window.customElements.get('video-debug-dialog');
  if (existing) return existing;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] => {
    const result = document.createElement(tag);result.textContent = text;return result;
  };
  const controlsStyle = `
    :host{display:block;min-width:0;color:#e7edf4;font:13px/1.45 system-ui,sans-serif}
    *{box-sizing:border-box}input,button,select{font:inherit;accent-color:#78dcca}
    input:focus-visible,summary:focus-visible,button:focus-visible{outline:2px solid #8ce6d5;outline-offset:3px}
    .row{padding:8px 0;border-bottom:1px solid #354052}.heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    label{cursor:pointer;min-width:0;overflow-wrap:anywhere}.value{display:flex;align-items:center;gap:6px}
    input[type=number]{width:96px;max-width:100%;color:inherit;background:#111b28;border:1px solid #718397;border-radius:4px;padding:5px 7px}
    input[type=range]{display:block;width:calc(100% - 6px);margin:9px 3px 4px;min-width:0}
    input[type=checkbox]{width:17px;height:17px;vertical-align:middle;margin:0 7px 0 0}
    input:disabled{opacity:.5;cursor:not-allowed}details{font-size:12px;color:#bdcbd8;margin-top:5px}summary{cursor:pointer;width:fit-content}
    .detailsText{margin-top:5px;white-space:pre-line}.is-changed .labelText::after{content:' •';color:#8ce6d5}
    [aria-invalid=true]{border-color:#ffb3ad!important}.unit{color:#c4d1dd}.hint{font-size:12px;color:#a9c1cd;margin:3px 0}
    @media(pointer:coarse){input[type=number]{min-height:44px}summary{min-height:32px}}
  `;
  class VideoDebugInput extends HTMLElement {
    protected root: ShadowRoot;
    protected box: HTMLElement|null = null;
    protected input: HTMLInputElement|null = null;
    protected number: HTMLInputElement|null = null;
    protected stored: number|boolean = 0;
    protected baseline: number|boolean = 0;
    protected factor = 1;
    protected built = false;
    protected isCheckbox = false;
    constructor(){super();this.root=this.attachShadow({mode:'open'});}
    get name():string{return this.getAttribute('name')||'';}
    get value():number|boolean{return this.stored;}
    set value(value: Loose){
      this.stored=this.isCheckbox ? value===true||value==='true' : Number(value);
      this.sync();
    }
    get defaultValue():number|boolean{return this.baseline;}
    set defaultValue(value: Loose){this.baseline=value;this.sync();}
    reset():void{this.value=this.baseline;}
    set disabled(value:boolean){if(this.input)this.input.disabled=value;if(this.number)this.number.disabled=value;}
    get valid():boolean{return this.isCheckbox||!!this.number&&this.number.value!==''&&this.number.checkValidity()&&Number.isFinite(this.stored);}
    protected sync():void{
      if(!this.input)return;
      if(this.isCheckbox)this.input.checked=!!this.stored;
      else {
        const display=Number(this.stored)/this.factor;
        this.input.value=Number.isFinite(display)?String(display):'';
        if(this.number)this.number.value=Number.isFinite(display)?String(display):'';
      }
      this.box?.classList.toggle('is-changed',this.stored!==this.baseline);
      this.number?.setAttribute('aria-invalid',String(!this.valid));
    }
    connectedCallback():void{
      if(this.built)return;this.built=true;
      const style=node('style',controlsStyle);this.root.append(style);
      this.factor=Number(this.getAttribute('factor'))||1;
      const row=this.box=node('div');row.className='row';
      const heading=node('div');heading.className='heading';
      const label=node('label');label.htmlFor='value';label.className='labelText';
      const text=this.getAttribute('text')||this.name;
      this.input=node('input');this.input.type=this.isCheckbox?'checkbox':'range';
      if(this.isCheckbox){this.input.id='value';label.append(this.input,document.createTextNode(text));heading.append(label);}
      else {
        label.textContent=text;heading.append(label);
        const value=node('div');value.className='value';
        this.number=node('input');this.number.type='number';this.number.id='value';this.number.setAttribute('aria-label',text);
        this.input.setAttribute('aria-label',text);
        for(const key of ['min','max','step']){const v=this.getAttribute(key);if(v!==null){this.input.setAttribute(key,v);this.number.setAttribute(key,key==='step'&&this.factor!==1?'any':v);}}
        const unit=node('span',this.getAttribute('unit')||'');unit.className='unit';value.append(this.number,unit);heading.append(value);
        this.number.addEventListener('input',()=>{
          this.stored=this.number!.value===''?NaN:Number(this.number!.value)*this.factor;
          this.input!.value=this.number!.value;
          this.number!.setAttribute('aria-invalid',String(!this.valid));
          this.changed();
        });
      }
      row.append(heading);if(!this.isCheckbox)row.append(this.input);
      this.input.addEventListener(this.isCheckbox?'change':'input',()=>{
        this.stored=this.isCheckbox?this.input!.checked:Number(this.input!.value)*this.factor;
        this.sync();this.changed();
      });
      const description=this.getAttribute('details');
      if(description){const details=node('details'),summary=node('summary','説明'),body=node('div',description);body.className='detailsText';details.append(summary,body);row.append(details);}
      this.root.append(row);this.sync();
    }
    protected changed():void{this.box?.classList.toggle('is-changed',this.stored!==this.baseline);this.dispatchEvent(new Event('change'));}
  }
  class VideoDebugCheckbox extends VideoDebugInput {constructor(){super();this.isCheckbox=true;this.stored=false;this.baseline=false;}}
  class VideoDebugSlider extends VideoDebugInput {}
  if(!window.customElements.get('video-debug-checkbox'))window.customElements.define('video-debug-checkbox',VideoDebugCheckbox);
  if(!window.customElements.get('video-debug-slider'))window.customElements.define('video-debug-slider',VideoDebugSlider);
  type NumberSetting = {name:string;label:string;min:number;max:number;step:number;factor?:number;unit?:string;details:string};
  const groups:Array<{title:string;numbers?:NumberSetting[];checks?:Array<[string,string,string?]>}>=[
    {title:'バッファ',numbers:[
      {name:'maxBufferLength',label:'先読みする時間',min:0,max:300,step:1,unit:'秒',details:'先読み時間の上限内で、時間の目安と、容量の目安を時間に換算した値の大きい方まで先読みします。'},
      {name:'maxBufferSize',label:'先読みする容量の目安',min:0,max:1000,step:.001,factor:1e6,unit:'MB',details:'1 MB = 1,000,000 byte。時間の目安と組み合わせて使われます。確保するメモリ量の保証・上限ではありません。'},
      {name:'maxMaxBufferLength',label:'先読み時間の上限',min:0,max:1200,step:1,unit:'秒',details:'「先読みする時間」以上にしてください。ブラウザ側の容量制限で、指定した時間まで蓄えられない場合があります。'}]},
    {title:'自動画質',numbers:[
      {name:'minAutoBitrate',label:'自動画質の下限ビットレート',min:0,max:50,step:.001,factor:1e6,unit:'Mbps',details:'0で制限なし。配信されている画質の範囲で選ばれます。'},
      {name:'startLevel',label:'再生開始時の画質番号',min:-1,max:100,step:1,details:'-1で自動。0から画質の低い順に指定します。画質の数は動画によって異なります。'},
      {name:'abrEwmaDefaultEstimate',label:'開始時の推定回線速度',min:0,max:50,step:.001,factor:1e6,unit:'Mbps',details:'自動画質の開始時に使う推定値です。「回線速度を自動で記録」がオンの間は、記録された値を使います。'}],checks:[
      ['autoAbrEwmaDefaultEstimate','回線速度を自動で記録','再生で得た推定回線速度を次回の開始時に使います。手動入力はオフにすると編集できます。'],
      ['capLevelOnFPSDrop','コマ落ちしたら画質を下げる'],['capLevelToPlayerSize','プレイヤーの大きさに合わせて画質を制限']]},
    {title:'キャッシュ',checks:[['enable_db_cache','動画データをキャッシュする（実験的）','ブラウザ内のIndexedDBに保存します。画質ごとに別のデータとなります。']]},
    {title:'診断',checks:[['show_video_label','再生情報を動画上に表示'],['debug','詳細ログをコンソールに出す','問題調査のときに使います。通常はオフにしてください。']]}
  ];
  class VideoDebugDialog extends HTMLElement {
    private root:ShadowRoot;
    private dialog:HTMLDialogElement|null=null;
    private fields:Record<string,VideoDebugInput>={};
    private saved:Record<string,Loose>={};
    private defaults:Record<string,Loose>={};
    private info:Record<string,string>={};
    private status:HTMLElement|null=null;
    settingBounds:Record<string,readonly [number,number]>={};
    private dirty=false;
    private saving=false;
    private clearing=false;
    private headerVersion:HTMLElement|null=null;
    constructor(){super();this.root=this.attachShadow({mode:'open'});}
    set hlsConfig(config:Record<string,Loose>){this.saved={...config};this.dirty=false;for(const [key,field] of Object.entries(this.fields)){if(Object.prototype.hasOwnProperty.call(config,key))field.value=config[key];}this.syncAutomatic();}
    get hlsConfig():Record<string,Loose>{return this.saved;}
    set defaultConfig(config:Record<string,Loose>){this.defaults={...config};for(const [key,field] of Object.entries(this.fields)){if(Object.prototype.hasOwnProperty.call(config,key))field.defaultValue=config[key];}}
    get defaultConfig():Record<string,Loose>{return this.defaults;}
    set versionInfo(info:Record<string,string>){this.info=info;this.updateVersion();}
    get versionInfo():Record<string,string>{return this.info;}
    private updateVersion():void{if(this.headerVersion)this.headerVersion.textContent=['ZenzaWatch '+(this.info.zenza||'版情報なし'),'hls.js '+(this.info.hls||this.saved.hls_js_ver||'未読込')].join(' · ');}
    setStatus(message:string,kind='info'):void{if(this.status){this.status.textContent=message;this.status.dataset.kind=kind;}}
    setSaving(value:boolean):void{
      this.saving=value;
      for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-command]'))button.disabled=value||(button.dataset.command==='clear-cache'&&this.clearing);
      for(const field of Object.values(this.fields))field.disabled=value;
      if(!value)this.syncAutomatic();
      this.dialog?.setAttribute('aria-busy',String(value));
    }
    get isOpen():boolean{return !!this.dialog?.open;}
    open():void{if(this.dialog&&!this.dialog.open)this.dialog.showModal();}
    close():void{if(this.dialog?.open)this.dialog.close();}
    toggle():void{this.isOpen?this.close():this.open();}
    setValue(key:string,value:Loose):void{if(this.dirty)return;if(this.fields[key])this.fields[key].value=value;this.syncAutomatic();}
    getValue(key:string):Loose{return this.fields[key]?.value;}
    reset(config?:Record<string,Loose>):void{
      if(config)this.defaultConfig=config;this.dirty=true;
      for(const field of Object.values(this.fields))field.reset();
      this.syncAutomatic();this.setStatus('初期値に戻しました。保存すると反映します。');
    }
    private syncAutomatic():void{
      const estimate=this.fields.abrEwmaDefaultEstimate;
      if(estimate)estimate.disabled=this.saving||!!this.fields.autoAbrEwmaDefaultEstimate?.value;
      const hint=this.root.querySelector<HTMLElement>('.auto-hint');
      if(hint)hint.hidden=!this.fields.autoAbrEwmaDefaultEstimate?.value;
    }
    private addField(parent:HTMLElement,name:string,label:string,description='',setting?:NumberSetting):void{
      const field=document.createElement(setting?'video-debug-slider':'video-debug-checkbox') as VideoDebugInput;
      field.setAttribute('name',name);field.setAttribute('text',label);if(description)field.setAttribute('details',description);
      if(setting){const bounds=this.settingBounds[name],factor=setting.factor||1;
        for(const key of ['min','max','step','factor','unit'] as const){const value=bounds&&(key==='min'||key==='max')?bounds[key==='min'?0:1]/factor:setting[key];if(value!==undefined)field.setAttribute(key,String(value));}
      }
      this.fields[name]=field;parent.append(field);
      field.defaultValue=Object.prototype.hasOwnProperty.call(this.defaults,name)?this.defaults[name]:this.saved[name];
      field.value=Object.prototype.hasOwnProperty.call(this.saved,name)?this.saved[name]:this.defaults[name];
      field.addEventListener('change',()=>{this.dirty=true;this.syncAutomatic();this.setStatus('未保存の変更があります。');});
    }
    private save():void{
      if(this.saving)return;
      for(const field of Object.values(this.fields))if(!field.valid){this.setStatus('入力値を確認してください。空欄や範囲外の値は保存できません。','error');field.shadowRoot?.querySelector<HTMLInputElement>('input')?.focus();return;}
      if(Number(this.fields.maxMaxBufferLength.value)<Number(this.fields.maxBufferLength.value)){this.setStatus('先読み時間の上限は、先読みする時間以上にしてください。','error');return;}
      const config:Record<string,Loose>={};for(const [key,field] of Object.entries(this.fields))config[key]=field.value;
      this.dispatchEvent(new CustomEvent('save',{detail:{config}}));
    }
    private async clearCache():Promise<void>{
      if(this.clearing||this.saving)return;this.clearing=true;this.setSaving(this.saving);this.setStatus('キャッシュを削除しています…');
      try{await Storage.clear();this.setStatus('キャッシュを削除しました。');}
      catch{this.setStatus('キャッシュの削除に失敗しました。もう一度お試しください。','error');}
      finally{this.clearing=false;this.setSaving(this.saving);}
    }
    connectedCallback():void{
      if(this.dialog)return;
      this.root.append(node('style',`
        :host{color-scheme:dark;font:13px/1.45 system-ui,sans-serif}*{box-sizing:border-box}
        .root{width:min(580px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 32px);padding:0;border:1px solid #586a80;border-radius:9px;background:#171e2a;color:#e7edf4;box-shadow:0 8px 32px #0008;overflow:hidden}
        .root[open]{display:flex;flex-direction:column}.root::backdrop{background:#0006}
        header,footer{flex:none;padding:12px 16px;background:#1c2735}header{border-bottom:1px solid #39485a}h1{font-size:17px;margin:0 0 3px}.version{font-size:11px;color:#b8c7d5}.help{font-size:11px;color:#91cddd}.help:focus-visible{outline:2px solid #8ce6d5;outline-offset:3px}
        .body{overflow:auto;min-height:0;padding:10px 16px;overscroll-behavior:contain}.intro{font-size:12px;color:#b8c7d5;margin:0 0 10px}
        section{margin-bottom:14px}h2{font-size:14px;color:#8ce6d5;margin:6px 0;border-bottom:1px solid #415364;padding-bottom:5px}
        footer{border-top:1px solid #39485a}.actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}button{font:inherit;cursor:pointer;padding:7px 11px;border:1px solid #718397;border-radius:5px;color:#e7edf4;background:#29384a}
        button[data-command=save]{background:#7bdecb;color:#102e2b;border-color:#7bdecb}button:hover{filter:brightness(1.14)}button:disabled{opacity:.55;cursor:wait}
        button:focus-visible{outline:2px solid #8ce6d5;outline-offset:3px}.status{font-size:12px;min-height:18px;margin:0 0 7px;color:#c6d7e4}.status[data-kind=error]{color:#ffb3ad}.auto-hint{font-size:12px;color:#c6d7e4}.auto-hint[hidden]{display:none}
        @media(max-height:460px){header,footer{padding:7px 12px}.body{padding:6px 12px}.intro{margin-bottom:5px}}
        @media(pointer:coarse){button{min-height:44px}}
      `));
      const dialog=this.dialog=node('dialog');dialog.className='root';dialog.setAttribute('aria-labelledby','hls-title');
      const header=node('header'),title=node('h1','HLS・再生の設定');title.id='hls-title';this.headerVersion=node('div');this.headerVersion.className='version';header.append(title,this.headerVersion);
      const help=node('a','hls.js の技術資料');help.href='https://github.com/video-dev/hls.js/blob/v1.7.3/docs/API.md#fine-tuning';help.target='_blank';help.rel='noopener noreferrer';help.className='help';header.append(help);
      const body=node('div');body.className='body';const intro=node('p','保存後に反映します。バッファ・画質設定は次の動画から反映します。');intro.className='intro';body.append(intro);
      const footer=node('footer');this.status=node('p','変更後は「保存」を押してください。');this.status.className='status';this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
      const actions=node('div');actions.className='actions';
      for(const [command,text] of [['reset','初期値に戻す'],['save','保存']]){const button=node('button',text);button.type='button';button.dataset.command=command;actions.append(button);}
      footer.append(this.status,actions);dialog.append(header,body,footer);this.root.append(dialog);
      for(const group of groups){const section=node('section');section.append(node('h2',group.title));body.append(section);
        for(const setting of group.numbers||[])this.addField(section,setting.name,setting.label,setting.details,setting);
        for(const [key,label,description] of group.checks||[])this.addField(section,key,label,description);
        if(group.title==='自動画質'){const hint=node('p','回線速度の自動記録がオンのため、推定回線速度の手動入力は無効です。');hint.className='auto-hint';section.append(hint);}
        if(group.title==='キャッシュ'){const button=node('button','保存済みキャッシュを削除');button.type='button';button.dataset.command='clear-cache';section.append(button);}
      }
      dialog.addEventListener('click',event=>{
        if(event.target===dialog){const rect=dialog.getBoundingClientRect(),mouse=event as MouseEvent;if(mouse.clientX<rect.left||mouse.clientX>rect.right||mouse.clientY<rect.top||mouse.clientY>rect.bottom)this.close();return;}
        const command=(event.target as Element).closest<HTMLElement>('[data-command]')?.dataset.command;
        if(command==='save')this.save();if(command==='reset'&&!this.saving)this.dispatchEvent(new CustomEvent('reset'));if(command==='clear-cache')void this.clearCache();
      });
      for(const name of ['keydown','keyup'])dialog.addEventListener(name,event=>event.stopPropagation());
      this.updateVersion();this.syncAutomatic();
    }
  }
  window.customElements.define('video-debug-dialog',VideoDebugDialog);
  return VideoDebugDialog;
}

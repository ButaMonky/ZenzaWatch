/**
 * P12-03 optional standalone manual bookmark panel.
 * Never takes ownership of the native seekbar or automatic resume markers.
 */
import type {ManualBookmarkPanelSnapshot}
  from './ManualBookmarkSession.ts';
import {ManualBookmarkSession} from './ManualBookmarkSession.ts';
export interface ManualBookmarkPanelDependencies {
  currentVideoId:()=>string|null|undefined;
  currentTime:()=>number;
  timestamp:()=>number;
  newId:()=>string;
  seek:(seconds:number)=>void;
  duration?:()=>number;
  automaticTime?:()=>number|null;
  editAutomatic?:(seconds:number)=>Promise<boolean>;
  deleteAutomatic?:()=>Promise<boolean>;
  recordingEnabled?:()=>boolean;
  repeatEnabled?:()=>boolean;
  repeatState?:(active:boolean)=>void;
}
const displayTime=(time:number):string=>{
  const seconds=Math.max(0,Math.floor(time));
  return Math.floor(seconds/3600)>0?
    Math.floor(seconds/3600)+':'+
      String(Math.floor(seconds%3600/60)).padStart(2,'0')+':'+
      String(seconds%60).padStart(2,'0'):
    Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};
export class ManualBookmarkPanel {
  private readonly root:HTMLElement;
  private readonly session:ManualBookmarkSession;
  private readonly deps:ManualBookmarkPanelDependencies;
  private readonly unsubscribe:()=>void;
  private disposed=false;
  private last:ManualBookmarkPanelSnapshot;
  private readonly clickHandler:(event:MouseEvent)=>void;
  private readonly inputHandler:(event:Event)=>void;
  private addDraftRevision=0;
  private pointDrafts:Record<string,string>={a:'',b:''};
  private loop:{a:number;b:number}|null=null;
  private awaitingLoopSeek=false;
  private pointBusy=false;
  private automaticDraftDirty=false;
  private activeTab='manual';
  private selectTab(name:string):void {
    if(!['manual','automatic','repeat'].includes(name))return;
    this.activeTab=name;
    for(const section of this.root.querySelectorAll<HTMLElement>('[data-point-section]')){
      section.hidden=section.dataset.pointSection!==name;
    }
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-point-tab]')){
      button.setAttribute('aria-pressed',String(button.dataset.pointTab===name));
    }
  }
  get isRepeating():boolean{return this.loop!==null;}
  refreshPreferences():void {
    if(this.deps.repeatEnabled?.()===false){this.loop=null;this.awaitingLoopSeek=false;}
    this.render(this.last);
  }
  private static formatTime(time:number):string {
    const milliseconds=Math.round(time*1000);
    const decimal=milliseconds%1000;
    return displayTime(Math.floor(milliseconds/1000))+(decimal?'.'+String(decimal).padStart(3,'0'):'');
  }
  static parseTime(value:string):number|null {
    const text=value.trim();
    if(!/^\d+(?:\.\d+)?$/.test(text)&&
       !/^\d+:\d{1,2}(?:\.\d+)?$/.test(text)&&
       !/^\d+:\d{1,2}:\d{1,2}(?:\.\d+)?$/.test(text))return null;
    const parts=text.split(':').map(Number);
    if(parts.slice(1).some(n=>n>=60))return null;
    const seconds=parts.reduce((n,part)=>n*60+part,0);
    return Number.isFinite(seconds)?seconds:null;
  }
  /** Called by the real media clock. No timer and no forced play on pause. */
  tick(time:number,paused:boolean,seeking:boolean):boolean {
    if(this.disposed||!this.ownsVideo()||this.deps.repeatEnabled?.()===false){
      this.loop=null;this.awaitingLoopSeek=false;this.updateLoopDisplay();return false;
    }
    const loop=this.loop;
    if(loop)this.deps.repeatState?.(true);
    if(!loop||!Number.isFinite(time))return false;
    if(time<loop.b)this.awaitingLoopSeek=false;
    if(paused||seeking||this.awaitingLoopSeek||time<loop.b)return false;
    this.awaitingLoopSeek=true;
    this.deps.seek(loop.a);
    return true;
  }
  repeatAtEnd():boolean {
    if(this.disposed||!this.ownsVideo()||this.deps.repeatEnabled?.()===false||!this.loop)return false;
    this.awaitingLoopSeek=true;
    this.deps.seek(this.loop.a);
    return true;
  }
  private pointButton(action:string,label:string):HTMLButtonElement {
    const button=this.root.ownerDocument.createElement('button');
    button.type='button';button.dataset.pointAction=action;button.textContent=label;
    return button;
  }
  private pointField(name:string,label:string,value:string):HTMLLabelElement {
    const wrapper=this.root.ownerDocument.createElement('label');
    wrapper.textContent=label;
    const field=this.root.ownerDocument.createElement('input');
    field.type='text';field.inputMode='decimal';field.dataset.pointField=name;
    field.value=value;field.placeholder='0:00';field.setAttribute('aria-label',label);
    wrapper.append(field);return wrapper;
  }
  private pointSection(title:string):HTMLElement {
    const section=this.root.ownerDocument.createElement('section');
    section.className='zw-point-section';
    const heading=this.root.ownerDocument.createElement('h3');heading.textContent=title;
    section.append(heading);return section;
  }
  private renderPointControls(region:HTMLElement,automatic:boolean):void {
    if(!this.deps.duration)return;
    const section=this.pointSection(automatic?'ここまで見た':'ABリピート');
    section.dataset.pointSection=automatic?'automatic':'repeat';
    const status=this.root.ownerDocument.createElement('p');
    status.setAttribute('role','status');
    if(automatic){
      status.dataset.pointStatus='automatic';
      const time=this.deps.automaticTime?.();
      status.textContent=this.deps.recordingEnabled?.()===false?
        '自動記録はOFFです。手動の編集・しおりは利用できます。':
        time===null||time===undefined?'自動位置はまだありません':'自動で更新される位置は1件だけです。';
      section.append(status,this.pointField('automatic','保存位置',
        time===null||time===undefined?'':ManualBookmarkPanel.formatTime(time)),
        this.pointButton('save-automatic','位置を保存'),
        this.pointButton('current-automatic','現在位置を使う'),
        this.pointButton('delete-automatic','削除'));
    }else{
      status.dataset.pointStatus='repeat';
      status.textContent=this.loop?'区間リピート中':'A（開始）とB（終了）を指定します。';
      const row=this.root.ownerDocument.createElement('div');row.className='zw-point-range-inputs';
      row.append(this.pointField('a','A 開始',this.pointDrafts.a||''),
        this.pointButton('set-a','現在位置をAに'),
        this.pointField('b','B 終了',this.pointDrafts.b||''),
        this.pointButton('set-b','現在位置をBに'));
      section.append(status,row,this.pointButton('repeat',this.loop?'リピートを停止':'リピートを開始'),
        this.pointButton('clear-repeat','区間をクリア'));
      const range=this.root.ownerDocument.createElement('div');
      range.className='zw-point-range';range.dataset.pointRange='1';range.setAttribute('aria-hidden','true');
      const selected=this.root.ownerDocument.createElement('span');range.append(selected);section.append(range);
      const hint=this.root.ownerDocument.createElement('small');
      hint.textContent='時刻は 1:23 ／ 1:02:03 ／ 秒数で入力できます。動画を切り替えると区間は解除されます。';
      section.append(hint);
      if(this.deps.repeatEnabled?.()===false){
        status.textContent='ABリピートは上級者設定でOFFになっています。';
        for(const control of section.querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))control.disabled=true;
      }
    }
    region.append(section);
  }
  private pointMessage(kind:string,message:string):void {
    const node=this.root.querySelector<HTMLElement>('[data-point-status="'+kind+'"]');
    if(node)node.textContent=message;
  }
  private updateLoopDisplay():void {
    this.deps.repeatState?.(!!this.loop);
    const button=this.root.querySelector<HTMLButtonElement>('[data-point-action="repeat"]');
    if(button){button.textContent=this.loop?'リピートを停止':'リピートを開始';button.setAttribute('aria-pressed',String(!!this.loop));}
    const span=this.root.querySelector<HTMLElement>('[data-point-range] span');
    const duration=this.deps.duration?.()||0;
    const a=ManualBookmarkPanel.parseTime(this.pointDrafts.a||'');
    const b=ManualBookmarkPanel.parseTime(this.pointDrafts.b||'');
    if(span){span.style.left=duration>0&&a!==null?100*a/duration+'%':'0%';
      span.style.width=duration>0&&a!==null&&b!==null&&b>a?100*(b-a)/duration+'%':'0%';}
  }
  private async pointAction(action:string):Promise<void> {
    if(!this.ownsVideo())return;
    const duration=this.deps.duration?.()||0;
    const read=(name:string)=>this.root.querySelector<HTMLInputElement>('[data-point-field="'+name+'"]');
    if(action==='set-a'||action==='set-b'){
      const name=action==='set-a'?'a':'b',field=read(name),time=this.deps.currentTime();
      if(!Number.isFinite(time)||time<0||time>duration)return;
      this.pointDrafts[name]=ManualBookmarkPanel.formatTime(time);if(field)field.value=this.pointDrafts[name]!;
      this.loop=null;this.awaitingLoopSeek=false;this.updateLoopDisplay();return;
    }
    if(action==='clear-repeat'){
      this.loop=null;this.awaitingLoopSeek=false;this.pointDrafts={a:'',b:''};
      for(const name of ['a','b']){const field=read(name);if(field)field.value='';}
      this.pointMessage('repeat','区間をクリアしました。');this.updateLoopDisplay();return;
    }
    if(action==='repeat'){
      if(this.loop){this.loop=null;this.pointMessage('repeat','停止しました。区間は残っています。');this.updateLoopDisplay();return;}
      if(this.deps.repeatEnabled?.()===false)return;
      const a=ManualBookmarkPanel.parseTime(read('a')?.value||''),b=ManualBookmarkPanel.parseTime(read('b')?.value||'');
      if(a===null||b===null||a<0||b>duration||b-a<0.25){
        this.pointMessage('repeat','Aより後のBを指定してください（間隔0.25秒以上・動画の長さ以内）。');return;
      }
      this.pointDrafts={a:read('a')!.value,b:read('b')!.value};
      this.loop={a,b};this.awaitingLoopSeek=false;
      this.pointMessage('repeat',ManualBookmarkPanel.formatTime(a)+' → '+ManualBookmarkPanel.formatTime(b)+' をリピート中');
      this.updateLoopDisplay();this.deps.seek(a);return;
    }
    if(action==='current-automatic'){
      this.automaticDraftDirty=true;
      const field=read('automatic');if(field)field.value=ManualBookmarkPanel.formatTime(this.deps.currentTime());return;
    }
    if(this.pointBusy)return;
    if(action!=='save-automatic'&&action!=='delete-automatic')return;
    const seconds=ManualBookmarkPanel.parseTime(read('automatic')?.value||'');
    if(action==='save-automatic'&&(seconds===null||seconds>=duration)){
      this.pointMessage('automatic','動画の長さより前の時刻を入力してください。');return;
    }
    const videoId=this.last.videoId;this.pointBusy=true;
    try{
      const ok=action==='delete-automatic'?await this.deps.deleteAutomatic?.():
        await this.deps.editAutomatic?.(seconds!);
      if(this.disposed||this.last.videoId!==videoId)return;
      this.pointMessage('automatic',ok?(action==='delete-automatic'?'自動位置を削除しました。':'この端末に保存しました。次の自動記録で更新されます。'):'保存できませんでした。入力は残っています。');
      if(ok)this.automaticDraftDirty=false;
      if(ok&&action==='delete-automatic'){const field=read('automatic');if(field)field.value='';}
    }catch{if(!this.disposed&&this.last.videoId===videoId)this.pointMessage('automatic','保存できませんでした。入力は残っています。');}
    finally{this.pointBusy=false;}
  }
  constructor(root:HTMLElement,session:ManualBookmarkSession,
    deps:ManualBookmarkPanelDependencies){
    if(!root||!root.ownerDocument)throw new TypeError('Bookmark panel container missing');
    this.root=root;this.session=session;this.deps=deps;
    this.last=session.snapshot;
    this.clickHandler=event=>this.onClick(event);
    this.inputHandler=event=>{
      const target=event.target as Element|null;
      if(target?.matches?.('input[data-point-field]')){
        const field=target as HTMLInputElement;
        if(field.dataset.pointField==='automatic')this.automaticDraftDirty=true;
        if(field.dataset.pointField==='a'||field.dataset.pointField==='b'){
          this.pointDrafts[field.dataset.pointField]=field.value;
          this.loop=null;this.awaitingLoopSeek=false;this.updateLoopDisplay();
          this.pointMessage('repeat','区間を変更しました。「リピートを開始」で反映します。');
        }
      }
      if(target?.matches?.('input[data-bookmark-label]')&&
         this.root.contains(target))this.addDraftRevision++;
    };
    root.addEventListener('click',this.clickHandler);
    root.addEventListener('input',this.inputHandler);
    this.unsubscribe=session.subscribe(snapshot=>{
      this.render(snapshot);
      this.last=snapshot;
    });
  }
  private ownsVideo():boolean{
    return !this.disposed&&this.last.videoId!==null&&
      this.last.videoId===this.deps.currentVideoId();
  }
  private button(action:string,label:string,id?:string):HTMLButtonElement{
    const button=this.root.ownerDocument.createElement('button');
    button.type='button';button.dataset.bookmarkAction=action;
    if(id!==undefined)button.dataset.bookmarkId=id;
    button.textContent=label;return button;
  }
  private render(snapshot:ManualBookmarkPanelSnapshot):void{
    if(this.disposed)return;
    // A refresh of the same video must not silently discard an unsaved rename.
    // A changed canonical label (including our own completed rename) wins.
    const sameVideo=snapshot.videoId!==null&&
      snapshot.videoId===this.last.videoId;
    // A different bookmark's save must not destroy the unsent Add label.
    if(!sameVideo){this.automaticDraftDirty=false;this.loop=null;this.awaitingLoopSeek=false;this.pointDrafts={a:'',b:''};}
    const previousAutomatic=sameVideo?this.root.querySelector<HTMLInputElement>('[data-point-field="automatic"]'):null;
    const automaticDraft=this.automaticDraftDirty?previousAutomatic?.value:undefined;
    const previousAdd=sameVideo?this.root.querySelector<HTMLInputElement>(
      'input[data-bookmark-label]'):null;
    const addDraft=previousAdd?.value||'';
    const focusedAdd=previousAdd!==null&&
      previousAdd===this.root.ownerDocument.activeElement?
      {start:previousAdd.selectionStart,end:previousAdd.selectionEnd}:null;
    const previousLabels=new Map(this.last.bookmarks.map(item=>
      [item.id,item.label] as const));
    const drafts=new Map<string,string>();
    let focusedRename:{id:string;start:number|null;end:number|null}|null=null;
    if(sameVideo){
      for(const field of this.root.querySelectorAll<HTMLInputElement>(
        'input[data-bookmark-rename-id]')){
        const id=field.dataset.bookmarkRenameId;
        if(id===undefined||!previousLabels.has(id))continue;
        if(field.value!==previousLabels.get(id))drafts.set(id,field.value);
        if(field===this.root.ownerDocument.activeElement){
          focusedRename={id,start:field.selectionStart,end:field.selectionEnd};
        }
      }
    }
    const doc=this.root.ownerDocument;
    const region=doc.createElement('section');
    region.setAttribute('role','region');
    region.setAttribute('aria-label','手動しおり');
    const title=doc.createElement('h3');
    title.textContent='手動しおり';
    if(snapshot.videoId!==null)this.renderPointControls(region,true);
    const manual=doc.createElement('section');manual.dataset.pointSection='manual';
    region.append(manual);manual.append(title);
    const status=doc.createElement('p');
    status.dataset.bookmarkStatus=snapshot.status;
    status.textContent=snapshot.status==='error'?'しおりの保存に失敗しました':
      snapshot.status==='loading'?'しおりを読み込み中':snapshot.status==='idle'?
        '再生する動画を選択してください':'';
    manual.append(status);
    if(snapshot.videoId!==null){
      const label=doc.createElement('input');
      label.type='text';label.maxLength=80;
      label.dataset.bookmarkLabel='1';
      label.value=addDraft;
      label.placeholder='名前（省略できます）';
      label.setAttribute('aria-label','しおりの名前');
      manual.append(label);
      manual.append(this.button('add','＋ 現在位置にしおり'));
    }
    const list=doc.createElement('ul');
    for(const entry of [...snapshot.bookmarks].sort((a,b)=>a.time-b.time)){
      const item=doc.createElement('li');
      const description=doc.createElement('span');
      description.textContent=displayTime(entry.time)+' '+entry.label;
      const rename=doc.createElement('input');
      rename.type='text';rename.maxLength=80;
      rename.dataset.bookmarkRenameId=entry.id;
      rename.value=drafts.has(entry.id)&&
        previousLabels.get(entry.id)===entry.label?
        drafts.get(entry.id)!:entry.label;
      rename.setAttribute('aria-label','しおり名を編集');
      const edit=doc.createElement('details');edit.className='zw-bookmark-edit';
      const summary=doc.createElement('summary');summary.textContent='編集';
      edit.append(summary,rename,this.button('rename','名前を変更',entry.id),this.button('remove','削除',entry.id));
      item.append(description,this.button('seek','ここから再生',entry.id),edit);
      list.append(item);
    }
    if(!snapshot.bookmarks.length){
      const empty=doc.createElement('p');empty.className='zw-point-empty';
      empty.textContent='残しておきたい場面を、現在位置から登録できます。';manual.append(empty);
    }
    manual.append(list);
    if(snapshot.videoId!==null)this.renderPointControls(region,false);
    if(this.deps.duration){
      const nav=doc.createElement('nav');nav.className='zw-point-tabs';nav.setAttribute('aria-label','保存位置の種類');
      for(const [name,label] of [['manual','しおり'],['automatic','ここまで見た'],['repeat','ABリピート']]){
        const button=doc.createElement('button');button.type='button';button.dataset.pointTab=name!;
        button.textContent=label!;nav.append(button);
      }
      region.prepend(nav);
    }
    // Only this dedicated container is mutated, not native marker DOM.
    this.root.replaceChildren(region);
    if(automaticDraft!==undefined){
      const field=this.root.querySelector<HTMLInputElement>('[data-point-field="automatic"]');
      if(field)field.value=automaticDraft;
    }
    this.updateLoopDisplay();
    if(this.deps.duration)this.selectTab(this.activeTab);
    if(focusedAdd){
      const replacement=this.root.querySelector<HTMLInputElement>(
        'input[data-bookmark-label]');
      if(replacement){
        replacement.focus({preventScroll:true});
        if(focusedAdd.start!==null&&focusedAdd.end!==null){
          replacement.setSelectionRange(focusedAdd.start,focusedAdd.end);
        }
      }
    }
    if(focusedRename){
      const replacement=Array.from(this.root.querySelectorAll<HTMLInputElement>(
        'input[data-bookmark-rename-id]')).find(field=>
        field.dataset.bookmarkRenameId===focusedRename!.id);
      if(replacement){
        replacement.focus({preventScroll:true});
        if(focusedRename.start!==null&&focusedRename.end!==null){
          replacement.setSelectionRange(focusedRename.start,focusedRename.end);
        }
      }
    }
  }
  private onClick(event:MouseEvent):void{
    const target=event.target as Element|null;
    const tab=target?.closest?.('button[data-point-tab]') as HTMLButtonElement|null;
    if(tab&&this.root.contains(tab)){event.preventDefault();event.stopPropagation();this.selectTab(tab.dataset.pointTab||'');return;}
    const point=target?.closest?.('button[data-point-action]') as HTMLButtonElement|null;
    if(point&&this.root.contains(point)){
      event.preventDefault();event.stopPropagation();void this.pointAction(point.dataset.pointAction||'');return;
    }
    const button=target?.closest?.('button[data-bookmark-action]') as
      HTMLButtonElement|null;
    if(!button||!this.root.contains(button)||!this.ownsVideo())return;
    const action=button.dataset.bookmarkAction;
    const id=button.dataset.bookmarkId;
    const bookmark=this.last.bookmarks.find(item=>item.id===id);
    if(action==='seek'){
      if(!bookmark)return;
      event.preventDefault();event.stopPropagation();
      this.deps.seek(bookmark.time);
    }else if(action==='remove'){
      if(!bookmark)return;
      event.preventDefault();event.stopPropagation();
      void this.session.remove(bookmark.id);
    }else if(action==='rename'){
      if(!bookmark)return;
      const field=button.closest('li')?.querySelector<HTMLInputElement>(
        'input[data-bookmark-rename-id]');
      if(!field||field.dataset.bookmarkRenameId!==bookmark.id)return;
      event.preventDefault();event.stopPropagation();
      void this.session.rename(bookmark.id,field.value,this.deps.timestamp());
    }else if(action==='add'){
      event.preventDefault();event.stopPropagation();
      const label=this.root.querySelector<HTMLInputElement>(
        'input[data-bookmark-label]')?.value||'';
      const time=this.deps.currentTime(),now=this.deps.timestamp(),
        newId=this.deps.newId(),videoId=this.last.videoId,
        submittedRevision=this.addDraftRevision;
      // The pure model validates time, ID, label and limit. Preserve the
      // draft on failure; only clear the text that was actually submitted.
      void this.session.add(newId,time,now,label).then(result=>{
        if(result.status!=='applied'||this.disposed||this.last.videoId!==videoId||
           this.addDraftRevision!==submittedRevision)return;
        const field=this.root.querySelector<HTMLInputElement>(
          'input[data-bookmark-label]');
        if(field?.value===label)field.value='';
      },()=>{/* A failed edit must leave the draft available for retry. */});
    }
  }
  dispose():void{
    if(this.disposed)return;
    this.loop=null;this.deps.repeatState?.(false);
    this.disposed=true;this.unsubscribe();
    this.root.removeEventListener('click',this.clickHandler);
    this.root.removeEventListener('input',this.inputHandler);
    this.root.replaceChildren();
  }
}

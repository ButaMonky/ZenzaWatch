/**
 * P12-03 optional standalone manual bookmark panel.
 * Never takes ownership of the native seekbar or automatic resume markers.
 */
import type {ManualBookmarkPanelSnapshot}
  from './ManualBookmarkSession.ts';
import {ManualBookmarkSession} from './ManualBookmarkSession.ts';
import type {ManualBookmark} from './ManualBookmarkPolicy.ts';
export interface ManualBookmarkLibraryEntry {
  videoId:string;title:string;duration:number;updatedAt:number;
  automaticTime:number|null;bookmarks:readonly ManualBookmark[];
  thumbnailUrl?:string;viewedAt?:number;
}
export interface ManualBookmarkPanelDependencies {
  libraryAppearance?:()=>{showVideoThumbnails:boolean;showScenePreviews:boolean;thumbnailWidth:number;titleFontSize:number;titleLines:number};
  automaticViewedAt?:()=>number|null;
  setRecordingEnabled?:(enabled:boolean)=>void;
  createScenePreview?:(host:HTMLElement,videoId:string,time:number)=>()=>void;
  loadLibrary?:()=>Promise<readonly ManualBookmarkLibraryEntry[]>;
  openLibraryPosition?:(videoId:string,time:number,endTime?:number)=>void;
  editLibraryBookmark?:(videoId:string,id:string,changes:{time:number;endTime?:number;label:string},duration:number)=>Promise<void>;
  deleteLibraryBookmark?:(videoId:string,id:string,duration:number)=>Promise<void>;
  editLibraryAutomatic?:(videoId:string,time:number,duration:number)=>Promise<void>;
  deleteLibraryAutomatic?:(videoId:string)=>Promise<void>;
  onRepeatRangeChange?:(range:{a:number|null;b:number|null;active:boolean}|null)=>void;
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
  /** Read-only feed for the seekbar owner; never manipulates native seek DOM. */
  onBookmarksChange?:(snapshot:ManualBookmarkPanelSnapshot)=>void;
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
  private readonly keyHandler:(event:KeyboardEvent)=>void;
  private readonly inputHandler:(event:Event)=>void;
  private addDraftRevision=0;
  private pointDrafts:Record<string,string>={a:'',b:''};
  private loop:{a:number;b:number}|null=null;
  /** Persist an AB seek failure across dock redraws, but never across videos. */
  private loopFailureNotice:string|null=null;
  private awaitingLoopSeek=false;
  private pointGeneration=0;
  private pointBusyRequest:{generation:number}|null=null;
  private automaticDraftDirty=false;
  private automaticDraftRevision=0;
  private activeTab='automatic';
  private visible=true;
  private previewLeases=new Map<HTMLElement,()=>void>();
  private previewLeaseKeys=new Map<HTMLElement,string>();
  private previewCandidates=new Set<HTMLElement>();
  private previewObserver:IntersectionObserver|null=null;
  private previewObserved=new Set<HTMLElement>();
  private library=false;
  private libraryGeneration=0;
  private libraryRows:readonly ManualBookmarkLibraryEntry[]=[];
  private libraryStatus:'idle'|'loading'|'ready'|'error'='idle';
  private librarySearch='';
  private libraryFilter='all';
  private libraryPage=0;
  private libraryRowPages=new Map<string,number>();
  private libraryDrafts=new Map<string,{values:Record<string,string>;open:boolean}>();
  private expandedVideos=new Set<string>();
  private readonly changeHandler:(event:Event)=>void;
  setVisible(visible:boolean):void {this.visible=visible;this.refreshPreviews();}
  private clearPreviews():void {
    this.previewObserver?.disconnect();this.previewObserver=null;this.previewCandidates.clear();this.previewObserved.clear();
    for(const cleanup of this.previewLeases.values()){try{cleanup();}catch{/* optional preview */}}
    this.previewLeases.clear();this.previewLeaseKeys.clear();
  }
  private preview(videoId:string,time:number):HTMLElement {
    const host=this.root.ownerDocument.createElement('div');host.className='zw-scene-preview';
    host.hidden=this.deps.libraryAppearance?.().showScenePreviews===false;
    host.dataset.sceneVideo=videoId;host.dataset.sceneTime=String(time);
    host.textContent='場面画像';host.setAttribute('aria-label',displayTime(time)+' 付近の場面画像');
    return host;
  }
  private previewEligible(host:HTMLElement):boolean {
    if(!this.visible||this.disposed||!this.root.contains(host)||host.closest('[hidden]'))return false;
    const group=host.closest<HTMLDetailsElement>('details[data-library-video]');
    return !group||group.open;
  }
  private fillPreviewLeases():void {
    if(!this.visible||this.disposed||!this.deps.createScenePreview||this.deps.libraryAppearance?.().showScenePreviews===false)return;
    const videos=new Set(Array.from(this.previewLeases.keys(),host=>host.dataset.sceneVideo!));
    for(const host of this.previewCandidates){
      if(this.previewLeases.size>=12)break;
      if(this.previewLeases.has(host)||!this.previewEligible(host))continue;
      const videoId=host.dataset.sceneVideo!;
      if(!videos.has(videoId)&&videos.size>=3)continue;
      try{
        this.previewLeases.set(host,this.deps.createScenePreview(host,videoId,Number(host.dataset.sceneTime)));
        this.previewLeaseKeys.set(host,videoId+'|'+host.dataset.sceneTime);
        videos.add(videoId);
      }catch{/* Missing previews never disable text actions. */}
    }
  }
  private refreshPreviews():void {
    if(!this.visible||this.disposed||!this.deps.createScenePreview||this.deps.libraryAppearance?.().showScenePreviews===false){this.clearPreviews();return;}
    const hosts=Array.from(this.root.querySelectorAll<HTMLElement>('[data-scene-video]'))
      .filter(host=>this.previewEligible(host));
    const eligible=new Set(hosts);
    for(const host of this.previewObserved)if(!eligible.has(host)){
      this.previewObserver?.unobserve?.(host);this.previewObserved.delete(host);this.previewCandidates.delete(host);
    }
    for(const [host,cleanup] of this.previewLeases)if(!eligible.has(host)||this.previewLeaseKeys.get(host)!==host.dataset.sceneVideo+'|'+host.dataset.sceneTime){
      this.previewLeases.delete(host);this.previewLeaseKeys.delete(host);try{cleanup();}catch{/* optional preview */}
    }
    const Observer=this.root.ownerDocument.defaultView?.IntersectionObserver;
    if(Observer){
      let observer=this.previewObserver;
      if(!observer){observer=new Observer(entries=>{
        if(this.previewObserver!==observer||!this.visible||this.disposed)return;
        for(const entry of entries){
          const host=entry.target as HTMLElement;
          if(entry.isIntersecting&&this.previewEligible(host))this.previewCandidates.add(host);
          else{
            this.previewCandidates.delete(host);
            const cleanup=this.previewLeases.get(host);
            if(cleanup){this.previewLeases.delete(host);this.previewLeaseKeys.delete(host);try{cleanup();}catch{/* optional preview */}}
          }
        }
        this.fillPreviewLeases();
      },{root:this.root.closest('.zenzaManualBookmarkDock'),rootMargin:'100px'});
      this.previewObserver=observer;}
      for(const host of hosts)if(!this.previewObserved.has(host)){this.previewObserved.add(host);observer.observe(host);}
      this.fillPreviewLeases();
    }else{
      // Older engines lack visibility notifications; never load the entire library.
      this.previewCandidates=new Set(hosts.slice(0,12));
      this.fillPreviewLeases();
    }
  }
  setRepeatRange(a:number,b:number,activate=true):boolean {
    const duration=this.deps.duration?.()||0;
    if(!this.ownsVideo()||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>duration||b-a<0.25||
       (activate&&this.deps.repeatEnabled?.()===false))return false;
    this.pointDrafts={a:ManualBookmarkPanel.formatTime(a),b:ManualBookmarkPanel.formatTime(b)};
    this.loop=activate?{a,b}:null;this.loopFailureNotice=null;this.resetLoopSeek();
    this.libraryDrafts.clear();this.library=false;this.activeTab='repeat';this.render(this.last);
    if(activate){try{this.deps.seek(a);}catch{this.stopLoopAfterSeekFailure();}}
    return true;
  }
  private selectTab(name:string):void {
    if(!['manual','automatic','repeat'].includes(name))return;
    this.activeTab=name;
    for(const section of this.root.querySelectorAll<HTMLElement>('[data-point-section]')){
      section.hidden=section.dataset.pointSection!==name;
    }
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-point-tab]')){
      button.setAttribute('aria-pressed',String(button.dataset.pointTab===name));
    }
    this.refreshPreviews();
  }
  get isRepeating():boolean{return this.loop!==null;}
  refreshPreferences():void {
    if(this.deps.repeatEnabled?.()===false){this.loop=null;this.loopFailureNotice=null;this.resetLoopSeek();}
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
  // Media timeupdate is the existing clock; never create a second interval.
  // Bounded retries handle ignored seeks without locking the repeat state forever.
  private loopSeekRequestedAt:number|null=null;
  private loopSeekAttempts=0;
  private resetLoopSeek():void {
    this.awaitingLoopSeek=false;this.loopSeekRequestedAt=null;this.loopSeekAttempts=0;
  }
  private stopLoopAfterSeekFailure():void {
    this.loop=null;this.resetLoopSeek();this.updateLoopDisplay();
    this.loopFailureNotice='シークできなかったため、区間リピートを停止しました。A・Bを確認して再開してください。';
    this.pointMessage('repeat',this.loopFailureNotice);
  }
  private issueLoopSeek(loop:{a:number;b:number}):boolean {
    this.awaitingLoopSeek=true;
    const now=this.deps.timestamp();
    this.loopSeekRequestedAt=Number.isFinite(now)?now:0;
    this.loopSeekAttempts++;
    try{this.deps.seek(loop.a);return true;}
    catch{this.stopLoopAfterSeekFailure();return false;}
  }
  /** Called by the real media clock. No timer and no forced play on pause. */
  tick(time:number,paused:boolean,seeking:boolean):boolean {
    if(this.disposed||!this.ownsVideo()||this.deps.repeatEnabled?.()===false){
      this.loop=null;this.resetLoopSeek();this.updateLoopDisplay();return false;
    }
    const loop=this.loop;
    if(loop)this.deps.repeatState?.(true);
    if(!loop||!Number.isFinite(time))return false;
    // Pending YouTube seeks report an optimistic target, not a landing.
    if(seeking)return false;
    if(time<loop.b){this.resetLoopSeek();return false;}
    if(paused)return false;
    if(this.awaitingLoopSeek){
      const now=this.deps.timestamp();
      if(!Number.isFinite(now)||this.loopSeekRequestedAt===null||
         now-this.loopSeekRequestedAt<1800)return false;
      if(this.loopSeekAttempts>=2){this.stopLoopAfterSeekFailure();return false;}
    }
    return this.issueLoopSeek(loop);
  }
  /** A seek event is not proof of landing: verify the current interval and clock. */
  acknowledgeLoopSeek(time:number):void {
    const loop=this.loop;
    if(this.disposed||!this.ownsVideo()||this.deps.repeatEnabled?.()===false||
       !this.awaitingLoopSeek||!loop||!Number.isFinite(time))return;
    if(time>=loop.a&&time<loop.b)this.resetLoopSeek();
  }
  repeatAtEnd():boolean {
    if(this.disposed||!this.ownsVideo()||this.deps.repeatEnabled?.()===false||!this.loop)return false;
    // timeupdate and one or more ended events can belong to one terminal seek.
    // Keep ownership without issuing another seek or consuming its retry budget.
    if(this.awaitingLoopSeek){
      const now=this.deps.timestamp();
      if(!Number.isFinite(now)||this.loopSeekRequestedAt===null||
         now-this.loopSeekRequestedAt<1800)return true;
      if(this.loopSeekAttempts>=2){this.stopLoopAfterSeekFailure();return false;}
    }
    return this.issueLoopSeek(this.loop);
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
      const setting=this.root.ownerDocument.createElement('label');setting.className='zw-auto-setting';
      const check=this.root.ownerDocument.createElement('input');check.type='checkbox';
      check.dataset.recordingEnabled='1';check.checked=this.deps.recordingEnabled?.()!==false;
      check.disabled=!this.deps.setRecordingEnabled;setting.append(check,'再生位置を自動で記録');
      const note=this.root.ownerDocument.createElement('small');
      note.textContent='すべての動画に適用。OFFでも保存済みの位置は残ります。';
      const line=this.root.ownerDocument.createElement('div');line.className='zw-point-line';
      if(time!==null&&time!==undefined)line.append(this.preview(this.last.videoId!,time));
      const position=this.root.ownerDocument.createElement('span');position.dataset.automaticPosition='1';
      position.textContent=time===null||time===undefined?'未記録':displayTime(time);
      const go=this.pointButton('seek-automatic','続きへ');go.disabled=time===null||time===undefined;
      line.append(position,go);
      const edit=this.root.ownerDocument.createElement('div');edit.className='zw-automatic-edit';
      edit.append(this.pointField('automatic','保存位置',
        time===null||time===undefined?'':ManualBookmarkPanel.formatTime(time)),
        this.pointButton('save-automatic','位置を保存'),
        this.pointButton('current-automatic','現在位置で更新'),
        this.pointButton('delete-automatic','削除'));
      section.append(setting,note,line);
      const viewed=this.viewedDate(this.deps.automaticViewedAt?.());if(viewed)section.append(viewed);
      section.append(edit,status);
    }else{
      status.dataset.pointStatus='repeat';
      status.textContent=this.loop?'区間リピート中':
        (this.loopFailureNotice||'A（開始）とB（終了）を指定します。');
      const row=this.root.ownerDocument.createElement('div');row.className='zw-point-range-inputs';
      for(const name of ['a','b']){
        const column=this.root.ownerDocument.createElement('div');
        const time=ManualBookmarkPanel.parseTime(this.pointDrafts[name]||'');
        const preview=this.root.ownerDocument.createElement('div');preview.className='zw-scene-preview';preview.dataset.endpointPreview=name;
        if(time!==null){preview.dataset.sceneVideo=this.last.videoId!;preview.dataset.sceneTime=String(time);}
        preview.hidden=this.deps.libraryAppearance?.().showScenePreviews===false;
        preview.textContent=time===null?'時刻を指定':'場面画像';
        column.append(this.pointField(name,name==='a'?'A 開始':'B 終了',this.pointDrafts[name]||''),preview,
          this.pointButton('set-'+name,'現在位置を'+name.toUpperCase()+'に'));
        row.append(column);
      }
      section.append(status,row,this.pointButton('repeat',this.loop?'リピートを停止':'リピートを開始'),
        this.pointButton('save-range','しおりに保存'),this.pointButton('clear-repeat','区間をクリア'));
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
    this.deps.onRepeatRangeChange?.(!this.ownsVideo()||(a===null&&b===null)?null:{a,b,active:!!this.loop});
    let previewChanged=false;
    for(const [name,time] of [['a',a],['b',b]] as const){
      const host=this.root.querySelector<HTMLElement>('[data-endpoint-preview="'+name+'"]');
      if(host&&host.dataset.sceneTime!==(time===null?undefined:String(time))){
        host.replaceChildren();host.textContent=time===null?'時刻を指定':'場面画像';
        if(time===null){delete host.dataset.sceneVideo;delete host.dataset.sceneTime;}
        else{host.dataset.sceneVideo=this.last.videoId!;host.dataset.sceneTime=String(time);}
        previewChanged=true;
      }
    }
    if(previewChanged)this.refreshPreviews();
    if(span){span.style.left=duration>0&&a!==null?100*a/duration+'%':'0%';
      span.style.width=duration>0&&a!==null&&b!==null&&b>a?100*(b-a)/duration+'%':'0%';}
  }
  private updatePointBusyControls():void {
    const busy=this.pointBusyRequest!==null;
    for(const name of ['save-automatic','delete-automatic','current-automatic']){
      const button=this.root.querySelector<HTMLButtonElement>('[data-point-action="'+name+'"]');
      if(button){button.disabled=busy;button.setAttribute('aria-busy',String(busy));}
    }
  }
  private async pointAction(action:string):Promise<void> {
    if(!this.ownsVideo())return;
    const duration=this.deps.duration?.()||0;
    const read=(name:string)=>this.root.querySelector<HTMLInputElement>('[data-point-field="'+name+'"]');
    if(action==='seek-automatic'){
      const time=this.deps.automaticTime?.();if(time!==null&&time!==undefined&&time>=0&&time<duration)this.deps.seek(time);return;
    }
    if(action==='save-range'){
      const a=ManualBookmarkPanel.parseTime(this.pointDrafts.a||''),b=ManualBookmarkPanel.parseTime(this.pointDrafts.b||'');
      if(a===null||b===null||a<0||b>duration||b-a<0.25){this.pointMessage('repeat','Aより後のBを動画の長さ以内で指定してください。');return;}
      const generation=this.pointGeneration;
      try{
        const result=await this.session.add(this.deps.newId(),a,this.deps.timestamp(),'区間 '+displayTime(a),b);
        if(!this.disposed&&generation===this.pointGeneration)this.pointMessage('repeat',result.status==='applied'?'区間をしおりに保存しました。':'保存できませんでした。区間は残っています。');
      }catch{if(!this.disposed&&generation===this.pointGeneration)this.pointMessage('repeat','保存できませんでした。区間は残っています。');}
      return;
    }
    if(action==='set-a'||action==='set-b'){
      const name=action==='set-a'?'a':'b',field=read(name),time=this.deps.currentTime();
      if(!Number.isFinite(time)||time<0||time>duration)return;
      this.pointDrafts[name]=ManualBookmarkPanel.formatTime(time);if(field)field.value=this.pointDrafts[name]!;
      this.loop=null;this.loopFailureNotice=null;this.resetLoopSeek();this.updateLoopDisplay();return;
    }
    if(action==='clear-repeat'){
      this.loop=null;this.loopFailureNotice=null;this.resetLoopSeek();this.pointDrafts={a:'',b:''};
      for(const name of ['a','b']){const field=read(name);if(field)field.value='';}
      this.pointMessage('repeat','区間をクリアしました。');this.updateLoopDisplay();return;
    }
    if(action==='repeat'){
      this.loopFailureNotice=null;
      if(this.loop){this.loop=null;this.pointMessage('repeat','停止しました。区間は残っています。');this.updateLoopDisplay();return;}
      if(this.deps.repeatEnabled?.()===false)return;
      const a=ManualBookmarkPanel.parseTime(read('a')?.value||''),b=ManualBookmarkPanel.parseTime(read('b')?.value||'');
      if(a===null||b===null||a<0||b>duration||b-a<0.25){
        this.pointMessage('repeat','Aより後のBを指定してください（間隔0.25秒以上・動画の長さ以内）。');return;
      }
      this.pointDrafts={a:read('a')!.value,b:read('b')!.value};
      this.loop={a,b};this.resetLoopSeek();
      this.pointMessage('repeat',ManualBookmarkPanel.formatTime(a)+' → '+ManualBookmarkPanel.formatTime(b)+' をリピート中');
      this.updateLoopDisplay();
      try{this.deps.seek(a);}catch{this.stopLoopAfterSeekFailure();}
      return;
    }
    if(action==='current-automatic'){
      if(this.pointBusyRequest)return;
      this.automaticDraftDirty=true;this.automaticDraftRevision++;
      const field=read('automatic');if(field)field.value=ManualBookmarkPanel.formatTime(this.deps.currentTime());
      await this.pointAction('save-automatic');return;
    }
    if(this.pointBusyRequest!==null)return;
    if(action!=='save-automatic'&&action!=='delete-automatic')return;
    const seconds=ManualBookmarkPanel.parseTime(read('automatic')?.value||'');
    if(action==='save-automatic'&&(seconds===null||seconds>=duration)){
      this.pointMessage('automatic','動画の長さより前の時刻を入力してください。');return;
    }
    const videoId=this.last.videoId,generation=this.pointGeneration,revision=this.automaticDraftRevision;
    const request={generation};
    this.pointBusyRequest=request;this.updatePointBusyControls();
    try{
      const ok=action==='delete-automatic'?await this.deps.deleteAutomatic?.():
        await this.deps.editAutomatic?.(seconds!);
      if(this.disposed||this.pointGeneration!==generation||this.last.videoId!==videoId)return;
      this.pointMessage('automatic',ok?(action==='delete-automatic'?'自動位置を削除しました。':'この端末に保存しました。次の自動記録で更新されます。'):'保存できませんでした。入力は残っています。');
      if(ok){
        if(revision===this.automaticDraftRevision)this.automaticDraftDirty=false;
        this.clearPreviews();
        const line=this.root.querySelector<HTMLElement>('[data-point-section="automatic"] .zw-point-line');
        line?.querySelector('[data-scene-video]')?.remove();
        if(action!=='delete-automatic'&&line)line.prepend(this.preview(videoId!,seconds!));
        this.refreshPreviews();
        const position=this.root.querySelector<HTMLElement>('[data-automatic-position]');
        if(position)position.textContent=action==='delete-automatic'?'未記録':displayTime(seconds!);
        const go=this.root.querySelector<HTMLButtonElement>('[data-point-action="seek-automatic"]');
        if(go)go.disabled=action==='delete-automatic';
      }
      if(ok&&action==='delete-automatic'&&revision===this.automaticDraftRevision){const field=read('automatic');if(field)field.value='';}
    }catch{if(!this.disposed&&this.pointGeneration===generation&&this.last.videoId===videoId)this.pointMessage('automatic','保存できませんでした。入力は残っています。');}
    finally{if(this.pointBusyRequest===request){this.pointBusyRequest=null;this.updatePointBusyControls();}}
  }
  constructor(root:HTMLElement,session:ManualBookmarkSession,
    deps:ManualBookmarkPanelDependencies){
    if(!root||!root.ownerDocument)throw new TypeError('Bookmark panel container missing');
    this.root=root;this.session=session;this.deps=deps;
    this.last=session.snapshot;
    this.clickHandler=event=>this.onClick(event);
    this.changeHandler=event=>{
      const target=event.target as HTMLInputElement|null;
      if(target?.matches('[data-recording-enabled]')&&this.ownsVideo()){
        this.deps.setRecordingEnabled?.(target.checked);this.pointMessage('automatic',target.checked?'自動記録をONにしました。':'自動記録をOFFにしました。保存済みの位置は残ります。');
      }
      if(target?.matches('[data-library-filter]')){this.libraryFilter=target.value;this.libraryPage=0;this.libraryRowPages.clear();this.renderLibraryGroups();}
    };
    this.inputHandler=event=>{
      const target=event.target as Element|null;
      if(target?.matches?.('[data-library-search]')){this.librarySearch=(target as HTMLInputElement).value;this.libraryPage=0;this.libraryRowPages.clear();this.renderLibraryGroups();return;}
      if(target?.matches?.('input[data-point-field]')){
        const field=target as HTMLInputElement;
        if(field.dataset.pointField==='automatic'){this.automaticDraftDirty=true;this.automaticDraftRevision++;}
        if(field.dataset.pointField==='a'||field.dataset.pointField==='b'){
          this.pointDrafts[field.dataset.pointField]=field.value;
          this.loop=null;this.loopFailureNotice=null;this.resetLoopSeek();this.updateLoopDisplay();
          this.pointMessage('repeat','区間を変更しました。「リピートを開始」で反映します。');
        }
      }
      if(target?.matches?.('input[data-bookmark-label]')&&
         this.root.contains(target))this.addDraftRevision++;
    };
    this.keyHandler=event=>{
      if(event.key!=='Enter'||event.isComposing||event.keyCode===229||event.repeat)return;
      const field=event.target as HTMLInputElement|null;
      if(!field?.matches('input')||!this.root.contains(field))return;
      let button:HTMLButtonElement|null=null;
      const edit=field.closest('.zw-bookmark-edit');
      if(edit)button=edit.querySelector('[data-bookmark-action="rename"],[data-library-action="save"],[data-library-action="save-auto"]');
      else if(field.dataset.pointField==='automatic')button=this.root.querySelector('[data-point-action="save-automatic"]');
      else if(field.dataset.pointField==='a'||field.dataset.pointField==='b')button=this.root.querySelector('[data-point-action="save-range"]');
      else if(field.hasAttribute('data-bookmark-label'))button=this.root.querySelector('[data-bookmark-action="add"]');
      if(button&&!button.disabled){event.preventDefault();event.stopPropagation();button.click();}
    };
    root.addEventListener('keydown',this.keyHandler);
    root.addEventListener('click',this.clickHandler);
    root.addEventListener('input',this.inputHandler);
    root.addEventListener('change',this.changeHandler);
    this.unsubscribe=session.subscribe(snapshot=>{
      this.render(snapshot);
      this.last=snapshot;
      deps.onBookmarksChange?.(snapshot);
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
    if(this.library)this.captureLibraryDrafts();
    // A refresh of the same video must not silently discard an unsaved rename.
    // A changed canonical label (including our own completed rename) wins.
    const sameVideo=snapshot.videoId!==null&&
      snapshot.videoId===this.last.videoId;
    // A different bookmark's save must not destroy the unsent Add label.
    if(!sameVideo){this.libraryDrafts.clear();this.libraryGeneration++;this.libraryBusyRequest=null;this.library=false;this.libraryStatus='idle';this.expandedVideos=new Set(snapshot.videoId?[snapshot.videoId]:[]);this.pointGeneration++;this.pointBusyRequest=null;this.automaticDraftDirty=false;this.loop=null;this.loopFailureNotice=null;this.resetLoopSeek();this.pointDrafts={a:'',b:''};}
    this.clearPreviews();
    const previousTimes=new Map(this.last.bookmarks.map(item=>[item.id,{time:item.time,endTime:item.endTime}]));
    const timeDrafts=new Map<string,{start:string;end:string}>();
    if(sameVideo)for(const edit of this.root.querySelectorAll<HTMLElement>('.zw-bookmark-edit')){
      const start=edit.querySelector<HTMLInputElement>('[data-bookmark-start-id]');
      const end=edit.querySelector<HTMLInputElement>('[data-bookmark-end-id]');
      if(start&&end)timeDrafts.set(start.dataset.bookmarkStartId!,{start:start.value,end:end.value});
    }
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
    const openRenames=new Set<string>();
    const drafts=new Map<string,string>();
    let focusedRename:{id:string;start:number|null;end:number|null}|null=null;
    if(sameVideo){
      for(const details of this.root.querySelectorAll<HTMLDetailsElement>('details.zw-bookmark-edit')){
        const id=details.querySelector<HTMLInputElement>('input[data-bookmark-rename-id]')?.dataset.bookmarkRenameId;
        if(details.open&&id!==undefined&&previousLabels.has(id))openRenames.add(id);
      }
      for(const field of this.root.querySelectorAll<HTMLInputElement>(
        'input[data-bookmark-rename-id]')){
        const id=field.dataset.bookmarkRenameId;
        if(id===undefined||!previousLabels.has(id))continue;
        if(field.value!==previousLabels.get(id))drafts.set(id,field.value);
        if(field===this.root.ownerDocument.activeElement){
          focusedRename={id,start:field.selectionStart,end:field.selectionEnd};
          openRenames.add(id);
        }
      }
    }
    this.last=snapshot;
    const doc=this.root.ownerDocument;
    if(this.library){this.renderLibrary();return;}
    this.root.closest('.zenzaManualBookmarkDock')?.classList.remove('zw-library-wide');
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
    status.textContent=snapshot.status==='error'?
      (this.session.needsLoadRetry?
        'しおりの読み込みに失敗しました。パネルを開き直すと再試行します。':
        'しおりの保存に失敗しました'):
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
    const currentDuration=this.deps.duration?.();
    for(const entry of [...snapshot.bookmarks].sort((a,b)=>a.time-b.time)){
      const outsideCurrent=typeof currentDuration==='number'&&
        Number.isFinite(currentDuration)&&currentDuration>0&&
        entry.time>=currentDuration;
      const item=doc.createElement('li');
      const description=doc.createElement('span');
      description.textContent=displayTime(entry.time)+(entry.endTime===undefined?'':' – '+displayTime(entry.endTime))+' '+entry.label+
        (outsideCurrent?'（現在の動画の長さを超えています）':'');
      const rename=doc.createElement('input');
      rename.type='text';rename.maxLength=80;
      rename.dataset.bookmarkRenameId=entry.id;
      rename.value=drafts.has(entry.id)&&
        previousLabels.get(entry.id)===entry.label?
        drafts.get(entry.id)!:entry.label;
      rename.setAttribute('aria-label','しおり名を編集');
      const edit=doc.createElement('details');edit.className='zw-bookmark-edit';
      edit.open=openRenames.has(entry.id);
      const summary=doc.createElement('summary');summary.textContent='編集';
      const start=this.pointField('bookmark-start','開始',ManualBookmarkPanel.formatTime(entry.time));
      const end=this.pointField('bookmark-end','終了（任意）',entry.endTime===undefined?'':ManualBookmarkPanel.formatTime(entry.endTime));
      const startInput=start.querySelector('input')!,endInput=end.querySelector('input')!;
      startInput.dataset.bookmarkStartId=entry.id;endInput.dataset.bookmarkEndId=entry.id;endInput.placeholder='位置のみ';
      const previous=previousTimes.get(entry.id),draft=timeDrafts.get(entry.id);
      if(draft&&previous?.time===entry.time&&previous?.endTime===entry.endTime){startInput.value=draft.start;endInput.value=draft.end;}
      edit.append(summary,rename,start,end,this.button('rename','保存',entry.id),this.button('remove','削除',entry.id));
      const seekButton=this.button('seek','ここから再生',entry.id);
      if(outsideCurrent){
        seekButton.disabled=true;
        seekButton.title='現在の動画の長さを超えているためシークできません';
      }
      item.append(this.preview(snapshot.videoId!,entry.time),description,seekButton);
      if(entry.endTime!==undefined)item.append(this.button('repeat-range','リピート',entry.id));
      item.append(edit);
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
      for(const [name,label] of [['automatic','ここまで見た'],['manual','しおり'],['repeat','ABリピート']]){
        const button=doc.createElement('button');button.type='button';button.dataset.pointTab=name!;
        button.textContent=label!;nav.append(button);
      }
      region.prepend(nav);
    }
    if(this.deps.loadLibrary){const nav=this.libraryButton('open','保存一覧');nav.className='zw-library-nav';region.prepend(nav);}
    if(this.deps.libraryAppearance?.().showScenePreviews!==false){const hint=doc.createElement('small');hint.textContent='画像は近い時刻の代表コマです。';region.append(hint);}
    // Only this dedicated container is mutated, not native marker DOM.
    this.root.replaceChildren(region);
    if(automaticDraft!==undefined){
      const field=this.root.querySelector<HTMLInputElement>('[data-point-field="automatic"]');
      if(field)field.value=automaticDraft;
    }
    this.updateLoopDisplay();
    this.updatePointBusyControls();
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
    const library=target?.closest?.('button[data-library-action]') as HTMLButtonElement|null;
    if(library&&this.root.contains(library)){event.preventDefault();event.stopPropagation();void this.libraryAction(library);return;}
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
    if(action==='repeat-range'){
      if(bookmark?.endTime!==undefined)this.setRepeatRange(bookmark.time,bookmark.endTime);
      event.preventDefault();event.stopPropagation();
    }else if(action==='seek'){
      if(!bookmark)return;
      event.preventDefault();event.stopPropagation();
      const currentDuration=this.deps.duration?.();
      if(typeof currentDuration==='number'&&Number.isFinite(currentDuration)&&
         currentDuration>0&&bookmark.time>=currentDuration)return;
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
      const start=button.closest('li')?.querySelector<HTMLInputElement>('[data-bookmark-start-id]');
      const end=button.closest('li')?.querySelector<HTMLInputElement>('[data-bookmark-end-id]');
      const time=ManualBookmarkPanel.parseTime(start?.value||'');
      const endTime=end?.value.trim()?ManualBookmarkPanel.parseTime(end.value):undefined;
      const duration=this.deps.duration?.()||Infinity;
      if(time===bookmark.time&&endTime===bookmark.endTime&&(time>=duration||(endTime!==undefined&&endTime>duration))){
        void this.session.rename(bookmark.id,field.value,this.deps.timestamp());return;
      }
      if(time===null||time>=duration||endTime===null||(endTime!==undefined&&(endTime<=time||endTime>duration))){
        const status=this.root.querySelector<HTMLElement>('[data-bookmark-status]');if(status)status.textContent='開始と終了を動画の長さ以内で指定してください。';return;
      }
      void this.session.update(bookmark.id,{time,...(endTime===undefined?{}:{endTime}),label:field.value},this.deps.timestamp());
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

  private captureLibraryDrafts(container:HTMLElement=this.root):void {
    for(const row of container.querySelectorAll<HTMLElement>('[data-library-draft-key]')){
      const key=row.dataset.libraryDraftKey!;
      if(row.dataset.libraryDraftCommitted==='true'){this.libraryDrafts.delete(key);continue;}
      const fields=Array.from(row.querySelectorAll<HTMLInputElement>('input[data-library-start],input[data-library-end],input[data-library-name]'));
      if(!fields.some(field=>field.value!==field.defaultValue)){this.libraryDrafts.delete(key);continue;}
      const values:Record<string,string>={};
      for(const field of fields){const name=field.hasAttribute('data-library-name')?'name':field.hasAttribute('data-library-end')?'end':'start';values[name]=field.value;}
      this.libraryDrafts.set(key,{values,open:row.querySelector<HTMLDetailsElement>('.zw-bookmark-edit')?.open===true});
    }
  }
  private libraryButton(action:string,label:string,videoId?:string,id?:string):HTMLButtonElement {
    const button=this.root.ownerDocument.createElement('button');button.type='button';
    button.dataset.libraryAction=action;button.textContent=label;
    if(videoId)button.dataset.videoId=videoId;if(id)button.dataset.bookmarkId=id;return button;
  }
  private async loadLibrary():Promise<void> {
    const generation=++this.libraryGeneration,videoId=this.last.videoId;
    this.libraryStatus='loading';this.render(this.last);
    try{
      const rows=await this.deps.loadLibrary?.()||[];
      if(this.disposed||generation!==this.libraryGeneration||videoId!==this.last.videoId||!this.library)return;
      this.libraryRows=[...rows].sort((a,b)=>b.updatedAt-a.updatedAt);this.libraryStatus='ready';
    }catch{
      if(this.disposed||generation!==this.libraryGeneration||videoId!==this.last.videoId||!this.library)return;
      this.libraryStatus='error';
    }
    this.render(this.last);
  }
  private renderLibrary():void {
    const doc=this.root.ownerDocument,region=doc.createElement('section');
    this.root.closest('.zenzaManualBookmarkDock')?.classList.add('zw-library-wide');
    region.append(this.libraryButton('back','← 今の動画へ'));
    const title=doc.createElement('h3');title.textContent='保存一覧';region.append(title);
    const search=doc.createElement('input');search.type='search';search.dataset.librarySearch='1';
    search.placeholder='動画名・しおり名で検索';search.setAttribute('aria-label',search.placeholder);search.value=this.librarySearch;
    const filter=doc.createElement('select');filter.dataset.libraryFilter='1';filter.setAttribute('aria-label','保存情報の種類');
    for(const [value,label] of [['all','すべて'],['resume','ここまで見た'],['point','しおり'],['range','区間']]){
      const option=doc.createElement('option');option.value=value!;option.textContent=label!;filter.append(option);
    }
    filter.value=this.libraryFilter;const toolbar=doc.createElement('div');toolbar.className='zw-library-search';toolbar.append(search,filter);region.append(toolbar);
    const status=doc.createElement('p');status.dataset.libraryStatus='1';status.setAttribute('role','status');region.append(status);
    if(this.libraryStatus==='loading')status.textContent='保存一覧を読み込んでいます…';
    if(this.libraryStatus==='error'){status.textContent='保存一覧を読み込めませんでした。';region.append(this.libraryButton('retry','再試行'));}
    const groups=doc.createElement('div');groups.dataset.libraryGroups='1';region.append(groups);
    this.root.replaceChildren(region);
    if(this.libraryStatus==='ready')this.renderLibraryGroups();
  }
  private renderLibraryGroups():void {
    const groups=this.root.querySelector<HTMLElement>('[data-library-groups]');if(!groups||this.disposed)return;
    this.captureLibraryDrafts();this.clearPreviews();groups.replaceChildren();const doc=this.root.ownerDocument;
    const appearance=this.deps.libraryAppearance?.();
    const bounded=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.min(max,Math.max(min,value!)):fallback;
    groups.style.setProperty('--zw-video-thumb-width',bounded(appearance?.thumbnailWidth,80,64,160)+'px');
    groups.style.setProperty('--zw-library-title-size',bounded(appearance?.titleFontSize,13,11,18)+'px');
    groups.style.setProperty('--zw-library-title-lines',String(Math.round(bounded(appearance?.titleLines,1,1,3))));
    const query=this.librarySearch.trim().toLocaleLowerCase(),filter=this.libraryFilter;
    const matching=this.libraryRows.map(video=>{
      const matches=video.title.toLocaleLowerCase().includes(query);
      const automatic=video.automaticTime!==null&&(filter==='all'||filter==='resume')&&(matches||'ここまで見た'.includes(query));
      const bookmarks=video.bookmarks.filter(item=>(filter==='all'||filter===(item.endTime===undefined?'point':'range'))&&
        (matches||item.label.toLocaleLowerCase().includes(query)));
      return {video,automatic,bookmarks};
    }).filter(item=>item.automatic||item.bookmarks.length);
    const videoCount=matching.length,count=matching.reduce((sum,item)=>sum+item.bookmarks.length+Number(item.automatic),0);
    this.libraryPage=Math.min(this.libraryPage,Math.max(0,Math.ceil(videoCount/50)-1));
    for(const {video,automatic,bookmarks} of matching.slice(this.libraryPage*50,(this.libraryPage+1)*50)){
      const group=doc.createElement('details');group.className='zw-library-group';group.dataset.libraryVideo=video.videoId;
      group.open=this.expandedVideos.has(video.videoId);
      const summary=doc.createElement('summary');
      if(appearance?.showVideoThumbnails!==false&&video.thumbnailUrl){
        try{
          const url=new URL(video.thumbnailUrl);
          if(url.protocol==='https:'||url.protocol==='http:'){
            const image=doc.createElement('img');image.className='zw-library-thumbnail';image.alt='';
            image.setAttribute('loading','lazy');image.decoding='async';image.referrerPolicy='no-referrer';image.src=url.href;
            image.addEventListener('error',()=>image.remove(),{once:true});summary.append(image);
          }
        }catch{/* Malformed old metadata must not disable the library. */}
      }
      const header=doc.createElement('span');header.className='zw-library-header';
      const title=doc.createElement('span');title.className='zw-library-title';title.textContent=video.title;header.append(title);
      const meta=doc.createElement('small');meta.textContent=(video.videoId===this.last.videoId?'再生中 · ':'')+(bookmarks.length+Number(automatic))+'件';header.append(meta);
      const viewed=this.viewedDate(video.viewedAt);if(viewed)header.append(viewed);
      summary.append(header);
      group.append(summary);
      // Closed videos have no point rows, editors or scene-image hosts in the DOM.
      const body=doc.createElement('div');let materialized=false;
      const renderBody=()=>{
        const ordered=[...(automatic?[null]:[]),...bookmarks.slice().sort((a,b)=>a.time-b.time)];
        const page=Math.min(this.libraryRowPages.get(video.videoId)||0,Math.max(0,Math.ceil(ordered.length/50)-1));
        this.libraryRowPages.set(video.videoId,page);this.captureLibraryDrafts(body);body.replaceChildren();
        const list=doc.createElement('ul');body.append(list);
        for(const item of ordered.slice(page*50,(page+1)*50))list.append(this.libraryRow(video,item));
        if(ordered.length>50){
          const pager=doc.createElement('div');pager.className='zw-library-pagination';
          for(const [direction,label,offset] of [['prev','前へ',-1],['next','次へ',1]] as const){
            const button=doc.createElement('button');button.type='button';button.textContent=label;button.dataset.libraryRowPage=direction;
            button.disabled=offset<0?page===0:(page+1)*50>=ordered.length;
            button.addEventListener('click',event=>{event.stopPropagation();this.libraryRowPages.set(video.videoId,page+offset);renderBody();this.refreshPreviews();});
            pager.append(button);
          }
          const status=doc.createElement('span');status.textContent=(page*50+1)+'–'+Math.min((page+1)*50,ordered.length)+' / '+ordered.length+' 件';pager.append(status);body.append(pager);
        }
        materialized=true;
      };
      if(group.open){renderBody();group.append(body);}
      group.addEventListener('toggle',()=>{
        if(this.disposed||!group.isConnected)return;
        if(group.open){this.expandedVideos.add(video.videoId);if(!materialized)renderBody();group.append(body);}
        else{this.expandedVideos.delete(video.videoId);this.captureLibraryDrafts(body);body.remove();}
        this.refreshPreviews();
      });groups.append(group);
    }
    if(videoCount>50){
      const pager=doc.createElement('div');pager.className='zw-library-pagination';
      const previous=this.libraryButton('page-prev','前の50動画'),next=this.libraryButton('page-next','次の50動画');
      previous.disabled=this.libraryPage===0;next.disabled=(this.libraryPage+1)*50>=videoCount;
      const label=doc.createElement('span');label.textContent=(this.libraryPage*50+1)+'–'+Math.min((this.libraryPage+1)*50,videoCount)+' / '+videoCount+' 動画';
      pager.append(previous,label,next);groups.append(pager);
    }
    const status=this.root.querySelector<HTMLElement>('[data-library-status]');
    if(status)status.textContent=videoCount+' 動画 · '+count+' 件 · 更新が新しい順';
    if(!count){const empty=doc.createElement('p');empty.textContent='該当する保存情報はありません';groups.append(empty);}
    this.refreshPreviews();
  }
  private viewedDate(value:number|null|undefined):HTMLTimeElement|null {
    if(typeof value!=='number'||!Number.isFinite(value)||value<=0)return null;
    const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
    const time=this.root.ownerDocument.createElement('time');time.dataset.viewedAt='1';
    time.dateTime=date.toISOString();time.textContent='視聴 '+date.toLocaleString('ja-JP');return time;
  }
  private libraryRow(video:ManualBookmarkLibraryEntry,item:ManualBookmark|null):HTMLElement {
    const doc=this.root.ownerDocument,row=doc.createElement('li'),time=item?.time??video.automaticTime!;
    row.dataset.libraryRow='1';row.dataset.libraryDraftKey=JSON.stringify([video.videoId,item?.id??null]);
    const description=doc.createElement('span');description.textContent=(item?.label||'ここまで見た')+' · '+displayTime(time)+
      (item?.endTime===undefined?'':' – '+displayTime(item.endTime));
    const seek=this.libraryButton(item?'seek':'seek-auto',item?'ここから再生':'続きへ',video.videoId,item?.id);
    seek.disabled=time<0||time>=video.duration||!this.deps.openLibraryPosition;
    row.append(this.preview(video.videoId,time),description,seek);
    if(item?.endTime!==undefined){const repeat=this.libraryButton('repeat','リピート',video.videoId,item.id);
      repeat.disabled=!this.deps.openLibraryPosition||this.deps.repeatEnabled?.()===false;row.append(repeat);}
    const edit=doc.createElement('details');edit.className='zw-bookmark-edit';const summary=doc.createElement('summary');summary.textContent='編集';edit.append(summary);
    if(item){const name=doc.createElement('input');name.dataset.libraryName='1';name.value=item.label;name.maxLength=80;name.setAttribute('aria-label','名前');edit.append(name);}
    const start=this.pointField('library-start',item?'開始':'保存位置',ManualBookmarkPanel.formatTime(time));
    start.querySelector('input')!.dataset.libraryStart='1';edit.append(start);
    if(item){const end=this.pointField('library-end','終了（任意）',item.endTime===undefined?'':ManualBookmarkPanel.formatTime(item.endTime));
      end.querySelector('input')!.dataset.libraryEnd='1';end.querySelector('input')!.placeholder='位置のみ';edit.append(end);}
    const save=this.libraryButton(item?'save':'save-auto','保存',video.videoId,item?.id);
    const remove=this.libraryButton(item?'delete':'delete-auto','削除',video.videoId,item?.id);
    save.disabled=item?!this.deps.editLibraryBookmark:!this.deps.editLibraryAutomatic;
    remove.disabled=item?!this.deps.deleteLibraryBookmark:!this.deps.deleteLibraryAutomatic;
    edit.append(save,remove);row.append(edit);
    const draft=this.libraryDrafts.get(row.dataset.libraryDraftKey!);
    for(const field of row.querySelectorAll<HTMLInputElement>('input')){
      field.defaultValue=field.value;
      const name=field.hasAttribute('data-library-name')?'name':field.hasAttribute('data-library-end')?'end':'start';
      if(draft?.values[name]!==undefined)field.value=draft.values[name]!;
    }
    if(draft)edit.open=draft.open;
    return row;
  }
  private libraryBusyRequest:{generation:number}|null=null;
  private async libraryAction(button:HTMLButtonElement):Promise<void> {
    if(this.disposed||button.disabled)return;
    const action=button.dataset.libraryAction;
    if(action==='back'){this.libraryDrafts.clear();this.library=false;this.libraryGeneration++;this.libraryBusyRequest=null;this.render(this.last);return;}
    if(action==='open'){this.libraryBusyRequest=null;this.library=true;this.libraryPage=0;this.expandedVideos.add(this.last.videoId||'');await this.loadLibrary();return;}
    if(action==='retry'){await this.loadLibrary();return;}
    if(action==='page-prev'||action==='page-next'){this.libraryPage+=action==='page-next'?1:-1;this.renderLibraryGroups();return;}
    if(!this.library||!this.ownsVideo())return;
    const video=this.libraryRows.find(v=>v.videoId===button.dataset.videoId);
    if(!video)return;
    const item=video.bookmarks.find(row=>row.id===button.dataset.bookmarkId);
    const time=item?.time??video.automaticTime;
    if(action==='seek'||action==='seek-auto'||action==='repeat'){
      if(time===null||time<0||time>=video.duration)return;
      if(action==='repeat'&&item?.endTime!==undefined&&video.videoId===this.last.videoId){this.setRepeatRange(time,item.endTime);return;}
      this.libraryDrafts.clear();this.library=false;this.libraryGeneration++;this.render(this.last);
      this.deps.openLibraryPosition?.(video.videoId,time,action==='repeat'?item?.endTime:undefined);return;
    }
    if(this.libraryBusyRequest)return;
    const row=button.closest<HTMLElement>('[data-library-row]');if(!row)return;
    const a=ManualBookmarkPanel.parseTime(row.querySelector<HTMLInputElement>('[data-library-start]')?.value||'');
    const end=row.querySelector<HTMLInputElement>('[data-library-end]')?.value.trim()||'';
    const b=end?ManualBookmarkPanel.parseTime(end):undefined;
    const status=this.root.querySelector<HTMLElement>('[data-library-status]');
    if((action==='save'||action==='save-auto')&&(a===null||a>=video.duration||b===null||(b!==undefined&&(b<=a||b>video.duration)))){
      if(status)status.textContent='動画の長さ以内の時刻を入力してください。終了は開始より後にします。';return;
    }
    const generation=this.libraryGeneration,owner=this.last.videoId;
    const request={generation};this.libraryBusyRequest=request;
    const controls=Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
    controls.forEach(control=>control.disabled=true);
    try{
      if(action==='save'&&item)await this.deps.editLibraryBookmark?.(video.videoId,item.id,
        {time:a!,...(b===undefined||b===null?{}:{endTime:b}),label:row.querySelector<HTMLInputElement>('[data-library-name]')?.value||''},video.duration);
      else if(action==='save-auto')await this.deps.editLibraryAutomatic?.(video.videoId,a!,video.duration);
      else if(action==='delete'&&item)await this.deps.deleteLibraryBookmark?.(video.videoId,item.id,video.duration);
      else if(action==='delete-auto')await this.deps.deleteLibraryAutomatic?.(video.videoId);
      else return;
      if(this.disposed||generation!==this.libraryGeneration||owner!==this.last.videoId||!this.library)return;
      row.dataset.libraryDraftCommitted='true';this.libraryDrafts.delete(row.dataset.libraryDraftKey!);
      await this.loadLibrary();
    }catch{
      if(!this.disposed&&generation===this.libraryGeneration&&owner===this.last.videoId&&status?.isConnected)
        status.textContent='保存できませんでした。入力は残っています。再度お試しください。';
    }finally{
      if(this.libraryBusyRequest===request)this.libraryBusyRequest=null;
      if(row.isConnected)controls.forEach(control=>control.disabled=false);
    }
  }

  dispose():void{
    if(this.disposed)return;
    this.loop=null;this.deps.repeatState?.(false);this.deps.onRepeatRangeChange?.(null);this.clearPreviews();this.libraryDrafts.clear();this.libraryGeneration++;
    this.disposed=true;this.pointGeneration++;this.pointBusyRequest=null;this.unsubscribe();
    this.root.removeEventListener('keydown',this.keyHandler);
    this.root.removeEventListener('click',this.clickHandler);
    this.root.removeEventListener('input',this.inputHandler);
    this.root.removeEventListener('change',this.changeHandler);
    this.root.replaceChildren();
  }
}
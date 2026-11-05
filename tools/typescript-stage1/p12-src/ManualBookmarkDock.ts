/**
 * An optional, closed-by-default manual-bookmark dock in the existing info tab.
 * It owns only its newly created details element and subscription; native
 * seek range, automatic markers, thumbnails and scene-search remain untouched.
 */
import {ManualBookmarkPanel} from './ManualBookmarkPanel.ts';
import type {ManualBookmarkPanelDependencies} from './ManualBookmarkPanel.ts';
import {ManualBookmarkSession} from './ManualBookmarkSession.ts';
import type {ManualBookmarkActionResult} from './ManualBookmarkSession.ts';

const contentSelector=
  '.zenzaWatchVideoInfoPanel .tabs.videoInfoTab .zenzaWatchVideoInfoPanelContent';
export class ManualBookmarkDock {
  private readonly node:HTMLDetailsElement;
  private readonly root:HTMLElement;
  private readonly panel:ManualBookmarkPanel;
  private readonly session:ManualBookmarkSession;
  private readonly keyHandler:(event:KeyboardEvent)=>void;
  private disposed=false;
  private host:HTMLElement|null=null;
  private readonly home:HTMLElement;
  private trigger:HTMLElement|null=null;
  private floating=false;
  private style:HTMLStyleElement;
  toggle(host:HTMLElement,trigger?:HTMLElement|null):void {
    if(this.disposed)return;
    if(this.floating){this.close();return;}
    this.host=host;this.trigger=trigger||null;this.floating=true;
    host.append(this.node);this.node.classList.add('zw-points-floating');
    this.panel.refreshPreferences();this.node.open=true;this.trigger?.setAttribute('aria-expanded','true');
    this.node.querySelector<HTMLButtonElement>('button[data-points-close]')?.focus();
  }
  close():void {
    if(this.disposed)return;
    this.node.open=false;
    if(this.floating){
      this.node.classList.remove('zw-points-floating');this.home.append(this.node);
      this.floating=false;this.trigger?.setAttribute('aria-expanded','false');
      if(this.trigger?.isConnected)this.trigger.focus({preventScroll:true});
    }
  }
  get isRepeating():boolean{return this.panel.isRepeating;}
  repeatAtEnd():boolean {return this.panel.repeatAtEnd();}
  refreshPreferences():void {this.panel.refreshPreferences();}
  tick(time:number,paused:boolean,seeking:boolean):boolean {
    return this.panel.tick(time,paused,seeking);
  }
  private constructor(target:HTMLElement,session:ManualBookmarkSession,
    deps:ManualBookmarkPanelDependencies) {
    this.session=session;this.home=target;
    const doc=target.ownerDocument;
    const node=this.node=doc.createElement('details');
    node.className='zenzaManualBookmarkDock';
    node.dataset.bookmarkOwner='manual';
    const summary=doc.createElement('summary');
    summary.textContent='しおり・ABリピート';
    node.append(summary);
    const root=this.root=doc.createElement('section');
    root.className='zenzaManualBookmarkDockContent';
    const close=doc.createElement('button');close.type='button';
    close.dataset.pointsClose='1';close.className='zw-points-close';
    close.textContent='閉じる ×';close.setAttribute('aria-label','しおり・ABリピートを閉じる');
    close.addEventListener('click',()=>this.close());
    node.append(close,root);
    this.style=doc.createElement('style');
    this.style.textContent=ManualBookmarkDock.styles;
    node.append(this.style);
    const series=target.querySelector(':scope > .seriesList');
    target.insertBefore(node,series||null);
    // All keyboard interaction within this dedicated dock belongs to its
    // summary, buttons and text fields, not the video's global shortcuts.
    // Stop bubbling (never preventDefault) without touching native seek keys.
    this.keyHandler=event=>{
      event.stopPropagation();
      if(event.type==='keydown'&&event.key==='Escape'){event.preventDefault();this.close();}
    };
    node.addEventListener('keydown',this.keyHandler);
    node.addEventListener('keyup',this.keyHandler);
    try {
      this.panel=new ManualBookmarkPanel(root,session,deps);
    }catch(error){
      node.removeEventListener('keydown',this.keyHandler);
      node.removeEventListener('keyup',this.keyHandler);
      node.remove();
      throw error;
    }
  }
  static mount(host:HTMLElement,session:ManualBookmarkSession,
    deps:ManualBookmarkPanelDependencies):ManualBookmarkDock {
    const target=host?.querySelector<HTMLElement>(contentSelector);
    if(!target)throw new Error('Manual bookmark info-tab mount missing');
    if(target.querySelector(':scope > .zenzaManualBookmarkDock')){
      throw new Error('Manual bookmark dock already owned');
    }
    return new ManualBookmarkDock(target,session,deps);
  }
  get element():HTMLDetailsElement{return this.node;}
  activate(videoId:string,duration:number):Promise<ManualBookmarkActionResult>{
    if(this.disposed)throw new Error('Manual bookmark dock disposed');
    return this.session.activate(videoId,duration);
  }
  deactivate():void{
    if(this.disposed)return;
    this.close();this.session.deactivate();
  }
  private static readonly styles=`
    .zenzaManualBookmarkDock{position:relative;color-scheme:dark;box-sizing:border-box;color:#e9edf5;background:#171e2a;border:1px solid #455066;border-radius:12px;font:13px/1.6 system-ui,sans-serif;text-align:left;overflow:hidden;isolation:isolate}
    .zenzaManualBookmarkDock>summary{padding:10px 82px 10px 14px;cursor:pointer;font-weight:700;color:#f4f7ff}
    .zenzaManualBookmarkDock[open]{overflow:auto}
    .zenzaManualBookmarkDock.zw-points-floating{position:absolute;z-index:150000;right:12px;bottom:64px;width:420px;max-width:calc(100% - 24px);max-height:calc(100% - 88px);box-shadow:0 12px 48px #000a;overscroll-behavior:contain}
    .zenzaManualBookmarkDockContent{padding:0 14px 14px}
    .zenzaManualBookmarkDock h3{font-size:13px;margin:12px 0 8px;color:#f4f7ff;letter-spacing:.02em}
    .zenzaManualBookmarkDock p{margin:5px 0 10px;color:#aebbd1;font-size:12px}
    .zenzaManualBookmarkDock button,.zenzaManualBookmarkDock input{box-sizing:border-box;font:inherit;line-height:1.4;border-radius:6px;min-height:32px;margin:3px 5px 3px 0}
    .zenzaManualBookmarkDock button{background:#303c51;color:#f4f7ff;border:1px solid #53627b;padding:6px 10px;cursor:pointer}
    .zenzaManualBookmarkDock button:hover{background:#435574}
    .zenzaManualBookmarkDock button:disabled{opacity:.45;cursor:default}
    .zenzaManualBookmarkDock button:focus-visible,.zenzaManualBookmarkDock input:focus-visible,.zenzaManualBookmarkDock summary:focus-visible{outline:2px solid #8ecbff;outline-offset:2px}
    .zenzaManualBookmarkDock input{background:#101722;color:#fff;border:1px solid #53627b;padding:6px 8px;max-width:100%}
    .zenzaManualBookmarkDock label{display:inline-flex;align-items:center;gap:8px;color:#cad5e8}
    .zenzaManualBookmarkDock input[data-point-field]{width:88px;font-variant-numeric:tabular-nums}
    .zenzaManualBookmarkDock input[data-bookmark-label]{width:calc(100% - 2px)}
    .zenzaManualBookmarkDock button[data-bookmark-action="add"]{width:100%;background:#286b91;border-color:#66b8e0;margin-bottom:8px;font-weight:700}
    .zenzaManualBookmarkDock ul{list-style:none;padding:0;margin:6px 0}
    .zenzaManualBookmarkDock li{padding:8px 0;border-top:1px solid #354056;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
    .zenzaManualBookmarkDock li>span{display:block;flex:1 1 55%;overflow-wrap:anywhere;color:#e4edff;font-variant-numeric:tabular-nums}
    .zenzaManualBookmarkDock input[data-bookmark-rename-id]{width:130px;flex:1 1 100px}
    .zenzaManualBookmarkDock .zw-point-section{border-top:1px solid #354056;margin-top:12px;padding-top:2px}
    .zenzaManualBookmarkDock .zw-point-section:first-child{border-top:0;margin-top:0}
    .zenzaManualBookmarkDock .zw-point-range-inputs{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 6px}
    .zenzaManualBookmarkDock .zw-point-range{height:6px;border-radius:3px;background:#354056;position:relative;margin:12px 0;overflow:hidden}
    .zenzaManualBookmarkDock .zw-point-range span{position:absolute;height:100%;background:#6ed9bc}
    .zenzaManualBookmarkDock button[aria-pressed="true"]{background:#245f52;border-color:#6ed9bc}
    .zenzaManualBookmarkDock .zw-point-tabs{display:flex;gap:4px;position:sticky;top:0;background:#171e2a;padding:4px 0 8px;z-index:1}
    .zenzaManualBookmarkDock .zw-point-tabs button{flex:1;padding:6px 3px;font-size:12px;margin:0;white-space:nowrap}
    .zenzaManualBookmarkDock [data-point-section][hidden]{display:none}
    .zenzaManualBookmarkDock .zw-bookmark-edit{flex:1 1 100%;border:0;background:transparent}
    .zenzaManualBookmarkDock .zw-bookmark-edit summary{font-size:11px;padding:2px 0;color:#aebbd1}
    .zenzaManualBookmarkDock small{display:block;color:#aebbd1;font-size:11px;line-height:1.6}
    .zenzaManualBookmarkDock .zw-points-close{position:absolute;top:5px;right:8px;margin:0;min-height:28px;font-size:12px}
    `;
  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    this.node.removeEventListener('keydown',this.keyHandler);
    this.node.removeEventListener('keyup',this.keyHandler);
    this.panel.dispose();
    this.session.dispose();
    this.node.remove();
  }
}

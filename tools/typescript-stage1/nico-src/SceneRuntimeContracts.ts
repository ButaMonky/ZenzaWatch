export type SceneMode = 'normal' | 'fullscreen';
export type SceneSnapshot = Readonly<{
 mode:SceneMode; layoutId:string|null; videoId:string|null; time:number; pinned:boolean;
 shown:boolean; seekStepSeconds:number; commentPreviewVisible:boolean; commentListMode:boolean;
}>;
export type ResolvedSceneSettings = {
 normal:string;fullscreen:string;linked:boolean;enabled?:boolean;listOpen?:boolean;
};
export type PreviewRequest = {videoId:string;time:number;signal:AbortSignal|undefined};
export type SceneLayoutAdapter = {
 dispose():void;mount?(state:SceneSnapshot):void;render?(state:SceneSnapshot):void;
 renderTime?(state:SceneSnapshot):void;onPreview?(asset:unknown,context:{videoId:string;time:number}):void;
};
export type SceneControllerOptions = {
 getPreference?:(key:string)=>unknown; resolvePreferences?:(()=>ResolvedSceneSettings)|null;
 createLayout?:(context:{id:string;mode:SceneMode})=>SceneLayoutAdapter|null;
 loadPreview?:((request:PreviewRequest)=>unknown|Promise<unknown>)|null;
 onSeek?:(delta:number)=>void;onError?:(error:unknown,context:string|{videoId:string;time:number})=>void;
};
export type PointerPoint = {clientX:number;clientY:number};
export type InteractionSource = string|Element;
export type Point = {x:number;y:number};
export type SceneRect = {left:number;right:number;top:number;bottom:number};
export type SceneClock = {setTimeout(callback:()=>void,delay:number):number;clearTimeout(id:number):void};
export type VisibilityController = {show(value:boolean):unknown};
export type InteractionController = VisibilityController & {
 snapshot:{pinned:boolean};pin(value?:boolean):{pinned:boolean};
};
export type IdleOptions = {controller?:VisibilityController;getSeconds?:()=>unknown;clock?:SceneClock|undefined;onIdleHidden?:(hidden:boolean)=>void};
export type IdleLimiter = {
 seekEnter(point?:PointerPoint|null):void;seekMove(point?:PointerPoint|null):unknown;seekLeave():void;
 previewChanged(token:unknown):void;updateSeconds():void;pause(reason:string,active:boolean):void;reset():void;dispose():void;
};
export type InteractionOptions = {
 controller?:InteractionController;getPreviewRect?:()=>SceneRect|SceneRect[]|null;
 subscribePointerMove?:(callback:(point:PointerPoint)=>void)=>()=>void;clock?:SceneClock|undefined;idleLimiter?:IdleLimiter;
};
export type ShortcutOptions = {
 controller?:{snapshot:{mode:string;layoutId:string|null;shown:boolean};show(value:boolean):unknown;onPreferencesChanged(key:string):unknown;seekBy(delta:number):boolean};
 interaction?:{togglePin():unknown;idlePreferencesChanged():void};
 seekStepControl?:{seconds:number;setStep(value:number):boolean};commentSearchPanel?:{toggle():void};
 getPreference?:(key:string)=>unknown;setPreference?:(key:string,value:unknown)=>void;
 onToggleControls?:()=>void;onError?:(error:unknown,key:string)=>void;
};
export type SearchHit = {text:string;vpos:number;time:number;no:unknown;uniqNo:unknown};
export type SearchState = {videoId:string|null;query:string;total:number;hits:SearchHit[];truncated:boolean};
export type SearchOptions = {getChats?:()=>unknown;getVideoId?:()=>string|null|undefined;seekTo?:(time:number,hit:SearchHit)=>void;onResults?:(state:SearchState)=>void;limit?:number};
export type SearchModel = {state:SearchState;search(query:unknown):SearchState;select(index:number):boolean;reset():void};
export type SearchPanelOptions = {document?:Document;search?:SearchModel;onOpenChange?:(open:boolean)=>void};

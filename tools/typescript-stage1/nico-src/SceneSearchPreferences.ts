type SceneLayout = 'follow'|'fixed'|'legacy';
type ScenePreferences = {
 normal:SceneLayout; fullscreen:SceneLayout; linked:boolean; miniStyle:'flow'|'static';
 miniVisible:boolean; listVisible:boolean; miniEnabled:boolean; listAllowed:boolean;
 listOpen:boolean; opacity:number; scale:number; listScale:number; enabled:boolean;
 migration:Array<{key:string;oldValue:string;newValue:SceneLayout}>;
};
export class SceneSearchPreferences {
 static validLayout(value:unknown):value is SceneLayout {
  return value==='follow'||value==='fixed'||value==='legacy';
 }
 static resolve(read:(key:string)=>unknown,hasSaved:(key:string)=>boolean):ScenePreferences {
  const migration:ScenePreferences['migration']=[];
  const layout=(mode:string):SceneLayout=>{
   const key='sceneSearch.presentation.'+mode, value=read(key);
   if(hasSaved(key)&&this.validLayout(value))return value;
   const oldKey='sceneSearch.layout.'+mode,old=read(oldKey);
   if(!hasSaved(oldKey)||typeof old!=='string'||! /^(00|0[1-9]|10)$/.test(old))return 'follow';
   const result=old==='00'?'legacy':old==='01'||old==='06'?'follow':'fixed';
   migration.push({key,oldValue:old,newValue:result});return result;
  };
  const enabled=hasSaved('sceneSearch.enabled')?read('sceneSearch.enabled')!==false:
    read('sceneSearch.enabled')!==false&&read('ui.scene.panel')!==false;
  const master=enabled&&read('sceneSearch.commentPreviewVisible')!==false;
  const oldMini=read('sceneSearch.miniCommentMode');
  const miniVisible=hasSaved('sceneSearch.miniCommentVisible')?
    read('sceneSearch.miniCommentVisible')!==false:oldMini!=='hidden';
  const listVisible=read('sceneSearch.commentListVisible')!==false;
  const bounded=(key:string,min:number,max:number,fallback:number):number=>{
   const value=read(key);
   return typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max?value:fallback;
  };
  return {enabled,listScale:bounded('sceneSearch.commentListScale',100,200,100),normal:layout('normal'),fullscreen:layout('fullscreen'),
   linked:read('sceneSearch.layout.linkFullscreen')===true,
   miniStyle:oldMini==='static'?'static':'flow',miniVisible,listVisible,
   miniEnabled:master&&miniVisible,listAllowed:master&&listVisible,
   listOpen:master&&listVisible&&read('enableCommentPreview')===true,
   opacity:bounded('sceneSearch.commentListBackgroundOpacity',0,100,90),
   scale:bounded('sceneSearch.thumbnailScale',50,200,100),migration};
 }
}

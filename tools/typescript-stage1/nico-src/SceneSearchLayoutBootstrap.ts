import {SceneSearchPreviewView} from './SceneSearchPreviewView';
import {SceneSearchLayoutCard} from './SceneSearchLayoutCard';
import {SceneSearchLayout00} from './SceneSearchLayout00';
import {SceneSearchLayoutRegistry} from './SceneSearchLayoutRegistry';
import {SceneSearchLayoutCatalog} from './SceneSearchLayoutCatalog';
import {registerSceneLayouts01_02} from './SceneSearchLayouts01_02';
import {SceneSearchLayouts03_04} from './SceneSearchLayouts03_04';
import {SceneSearchLayouts05_06} from './SceneSearchLayouts05_06';
import {SceneSearchLayout07} from './SceneSearchLayout07';
import {SceneSearchLayouts08_09} from './SceneSearchLayouts08_09';
import {SceneSearchLayout10} from './SceneSearchLayout10';
/** Full 11-provider bootstrap. Import order / flat userscript requirements are fixed. */
type BootstrapOptions={clock?:unknown};
type BootstrapPreviewOptions={
  document:Document;container:HTMLElement;
  onAction:(action:string,context:unknown,event:Event)=>void;
  settings:{getThumbnail?:()=>HTMLElement|null;getLegacyComment?:()=>HTMLElement|null}
};
type BootstrapLegacyOptions=ConstructorParameters<typeof SceneSearchLayout00>[0];
export function createSceneSearchLayoutRegistry({clock}:BootstrapOptions={}):SceneSearchLayoutRegistry {
  const registry=new SceneSearchLayoutRegistry();
  const coverage=SceneSearchLayoutCatalog.install(registry as never,{
    Card:SceneSearchLayoutCard,
    Legacy:SceneSearchLayout00,
    registerClassic:registerSceneLayouts01_02,
    SideShelf:SceneSearchLayouts03_04 as never,
    PlaybackDeck:SceneSearchLayouts05_06 as never,
    Filmstrip:SceneSearchLayout07 as never,
    Drawer:SceneSearchLayouts08_09 as never,
    SmartAvoid:SceneSearchLayout10 as never,
    clock
  });
  if(!coverage.complete||registry.list().length!==11){
    throw new Error('Scene layout bootstrap must include all ten providers');
  }
  if(typeof SceneSearchPreviewView!=='undefined'){
    for(const id of ['follow','fixed']){
      registry.register({id,label:id==='follow'?'シーク位置に追従':'位置を固定',
        factory:({document,container,onAction,settings}:BootstrapPreviewOptions)=>new SceneSearchPreviewView({
          document,host:container,id,onAction,image:settings.getThumbnail?.() as HTMLElement|null,
          mini:settings.getLegacyComment?.() as HTMLElement|null})});
    }
    registry.register({id:'legacy',label:'従来表示',factory:(options:BootstrapLegacyOptions)=>new SceneSearchLayout00(options)});
  }
  return registry;
}

// SCUI-18: dependency-complete ten-layout bootstrap.
// Safe to import: no DOM access, player hooks or network work until create().
import {SceneSearchPreviewView} from './SceneSearchPreviewView';
import {SceneSearchLayoutCard} from './SceneSearchLayoutCard';
import {SceneSearchLayout00} from './SceneSearchLayout00';
import {SceneSearchLayoutRegistry} from './SceneSearchLayoutRegistry';
import {SceneSearchLayoutCatalog} from './SceneSearchLayoutCatalog';
import {registerSceneLayouts01_02} from './SceneSearchLayouts01_02';
import {SceneSearchLayouts03_04} from './layouts/SceneSearchLayouts03_04';
import {SceneSearchLayouts05_06} from './layouts/SceneSearchLayouts05_06';
import {SceneSearchLayout07} from './layouts/SceneSearchLayout07';
import {SceneSearchLayouts08_09} from './layouts/SceneSearchLayouts08_09';
import {SceneSearchLayout10} from './layouts/SceneSearchLayout10';
//===BEGIN===
//@require SceneSearchPreviewView
//@require SceneSearchLayoutCard
//@require SceneSearchLayout00
//@require SceneSearchLayoutRegistry
//@require SceneSearchLayoutCatalog
//@require registerSceneLayouts01_02
//@require SceneSearchLayouts03_04
//@require SceneSearchLayouts05_06
//@require SceneSearchLayout07
//@require SceneSearchLayouts08_09
//@require SceneSearchLayout10
function createSceneSearchLayoutRegistry({clock}={}) {
  const registry=new SceneSearchLayoutRegistry();
  const coverage=SceneSearchLayoutCatalog.install(registry,{
    Card:SceneSearchLayoutCard,
    Legacy:SceneSearchLayout00,
    registerClassic:registerSceneLayouts01_02,
    SideShelf:SceneSearchLayouts03_04,
    PlaybackDeck:SceneSearchLayouts05_06,
    Filmstrip:SceneSearchLayout07,
    Drawer:SceneSearchLayouts08_09,
    SmartAvoid:SceneSearchLayout10,
    clock
  });
  if(!coverage.complete||registry.list().length!==11){
    throw new Error('Scene layout bootstrap must include all ten providers');
  }
  if(typeof SceneSearchPreviewView!=='undefined'){
    for(const id of ['follow','fixed']){
      registry.register({id,label:id==='follow'?'シーク位置に追従':'位置を固定',
        factory:({document,container,onAction,settings})=>new SceneSearchPreviewView({
          document,host:container,id,onAction,image:settings.getThumbnail?.(),
          mini:settings.getLegacyComment?.()})});
    }
    registry.register({id:'legacy',label:'従来表示',factory:options=>new SceneSearchLayout00(options)});
  }
  return registry;
}
//===END===
export {createSceneSearchLayoutRegistry};

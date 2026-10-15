// SCUI-18: dependency-complete ten-layout bootstrap.
// Safe to import: no DOM access, player hooks or network work until create().
import {SceneSearchLayoutCard} from './SceneSearchLayoutCard';
import {SceneSearchLayoutRegistry} from './SceneSearchLayoutRegistry';
import {SceneSearchLayoutCatalog} from './SceneSearchLayoutCatalog';
import {registerSceneLayouts01_02} from './SceneSearchLayouts01_02';
import {SceneSearchLayouts03_04} from './layouts/SceneSearchLayouts03_04';
import {SceneSearchLayouts05_06} from './layouts/SceneSearchLayouts05_06';
import {SceneSearchLayout07} from './layouts/SceneSearchLayout07';
import {SceneSearchLayouts08_09} from './layouts/SceneSearchLayouts08_09';
import {SceneSearchLayout10} from './layouts/SceneSearchLayout10';
//===BEGIN===
//@require SceneSearchLayoutCard
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
    registerClassic:registerSceneLayouts01_02,
    SideShelf:SceneSearchLayouts03_04,
    PlaybackDeck:SceneSearchLayouts05_06,
    Filmstrip:SceneSearchLayout07,
    Drawer:SceneSearchLayouts08_09,
    SmartAvoid:SceneSearchLayout10,
    clock
  });
  if(!coverage.complete||registry.list().length!==10){
    throw new Error('Scene layout bootstrap must include all ten providers');
  }
  return registry;
}
//===END===
export {createSceneSearchLayoutRegistry};

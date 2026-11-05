'use strict';
// Only the new ownership dependencies are resolved here. Tests still execute
// the production source, both for extracted single classes and flat bundles.
const owned=['SceneSearchDomLease','SceneSearchLayoutResources','SceneSearchPreferenceConnection',
  'SceneSearchObstacleCollector','SceneSearchVisibleRectCollector'];
function sceneSearchOwnershipPrelude(rel,read){
 if(!/^packages\/zenza\/src\/sceneSearch\//.test(rel))return '';
 const source=read(rel),parts=[];
 for(const name of owned){
  if(!new RegExp('(?:import\\s*\\{[^}]*\\b'+name+'\\b|//\\s*@require\\s+'+name+'\\b)').test(source))continue;
  const dependency=read('packages/zenza/src/sceneSearch/'+name+'.js');
  const body=dependency.split('//===BEGIN===')[1]?.split('//===END===')[0];
  if(!body)throw new Error('Missing build section for '+name);
  parts.push('if(typeof '+name+'==="undefined"){'+body+'\nglobalThis.'+name+'='+name+';}');
 }
 return parts.join('\n')+'\n';
}
module.exports={sceneSearchOwnershipPrelude};

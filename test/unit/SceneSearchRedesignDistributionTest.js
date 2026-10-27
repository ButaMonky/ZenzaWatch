 'use strict';
const assert=require('assert'),fs=require('fs');
describe('Task925 combined notification and scene distribution',()=>{
 it('ships scene runtime and notification dock together with matching startup version',()=>{
  const dist=fs.readFileSync('dist/ZenzaWatch-dev.user.js','utf8');
  for(const name of ['SceneSearchPreferences','SceneSearchPreviewView','SceneSearchPlacement','NotificationHistoryPanel','NotificationJournal'])assert(dist.includes(name),name);
  const version=dist.match(/@version\s+([^\s]+)/)[1];
  assert(dist.includes("var VER = '"+version+"'"));
  assert(dist.includes('toggle-notificationHistory'));assert(dist.includes('sceneSearch.presentation.normal'));
 });
 it('ships scene settings and notification shortcut in standalone settings',()=>{
  const dist=fs.readFileSync('dist/ZenzaAdvancedSettings.user.js','utf8');
  assert(dist.includes('class SceneSearchPreferences'));
  assert(dist.includes('TOGGLE_NOTIFICATION_HISTORY'));
  assert(dist.includes('sceneSearch.commentListScale'));
 });
});

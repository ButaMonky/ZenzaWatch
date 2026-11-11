import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './nonvisual-audit-source-harness.mjs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('advertising off blocks credit loading and stops pending or active credit',()=>{
 const listeners={},props={'uaa.enable':true,'supporterCredit.enable':true};
 let loads=0,aborts=0,ended=0;
 const Player=loadSource('nico-src/NicoVideoPlayer.ts','NicoVideoPlayer',{Emitter:class{},BaseViewComponent:class{},SupporterCredit:{load(){loads++;},CreditView:class{stop(){this.isActive=false;}}}});
 const player=Object.create(Player.prototype);
 Object.assign(player,{_playerConfig:{props,onkey(k,f){listeners[k]=f;}},_videoPlayer:{_body:{}},_emitEnded(){ended++;}});
 player._initializeSupporterCredit();
 player._creditRequest={videoId:'sm1'};player._creditAbort={abort(){aborts++;}};player._supporterCredit.isActive=true;
 props['uaa.enable']=false;listeners['uaa.enable']();
 assert.equal(aborts,1);assert.equal(ended,1);assert.equal(player._creditRequest,null);assert.equal(player._supporterCredit.isActive,false);
 player._creditRequest={videoId:'sm1'};assert.equal(player._kickSupporterCreditLoad(),null);assert.equal(loads,0);
 player._loadSupporterCredit({videoId:'sm1'});assert.equal(player._creditRequest,null);
 props['uaa.enable']=true;player._loadSupporterCredit({videoId:'sm1'});assert.equal(player._creditRequest.videoId,'sm1');
 assert.equal(props['supporterCredit.enable'],true);
});
test('advertising and credit switches disable descendants without losing checked values',()=>{
 const Panel=loadSource('nico-src/SettingPanelElement.ts','SettingPanelElement',{DialogElement:class{},window:{}});
 const html=(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),'');
 for(const ads of [false,true])for(const credit of [false,true]){
  const conf={audio:{},'uaa.enable':ads,'supporterCredit.enable':credit,'supporterCredit.voice':true};
  const dom=new JSDOM(Panel.getPlayerSettingMenu(html,new Proxy(conf,{get:(t,k)=>t[k]??{}})).replace(/\?disabled=(true|false)/g,(_,v)=>v==='true'?'disabled':'').replace(/[?.]checked=(true|false)/g,(_,v)=>v==='true'?'checked':''));
  const doc=dom.window.document,enabled=doc.querySelector('[data-setting-name="supporterCredit.enable"]'),voice=doc.querySelector('[data-setting-name="supporterCredit.voice"]');
  assert.equal(enabled.matches(':disabled'),!ads);
  assert.equal(voice.matches(':disabled'),!ads||!credit);
  assert.equal(voice.checked,true);
  dom.window.close();
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
class Dialog {constructor(){this.events={};this.props={};this.state={revision:0};this.isOpen=true;this._isConnected=true;this.renders=0;}requestRender(){this.renders++;}async disconnectedCallback(){}async connectedCallback(){}}
function api(globals={}){return loadSource('nico-src/SettingPanelElement.ts','SettingPanelElement',{DialogElement:Dialog,window:{},domEvent:{dispatchCommand(){}},...globals});}
function config(){const listeners=new Set();return {props:{baseChatScale:1},listeners,on(event,f){assert.equal(event,'update');listeners.add(f);},off(event,f){listeners.delete(f);},emit(key){for(const f of listeners)f(key);}};}
test('empty, nonfinite, min/max and step-invalid values preserve saved numeric setting',()=>{
 const Panel=api(),panel=new Panel(),c=config();panel.config=c;
 for(const [value,valid] of [['',true],['999',true],['0.1',true],['NaN',true],['1.25',false]]){
 let reported=false;panel.onChange({target:{tagName:'INPUT',type:'number',value,min:'0.5',max:'2',validity:{valid},dataset:{settingName:'baseChatScale',type:'number'},setCustomValidity(){},reportValidity(){reported=true;}},stopPropagation(){}});
 assert.equal(c.props.baseChatScale,1);assert(reported);
 }
 panel.onChange({target:{tagName:'INPUT',type:'number',value:'1.5',min:'0.5',max:'2',validity:{valid:true},dataset:{settingName:'baseChatScale',type:'number'},setCustomValidity(){}},stopPropagation(){}});assert.equal(c.props.baseChatScale,1.5);
});
test('all rendered setting updates refresh once and replacement/disconnect release subscription',async()=>{
 const Panel=api(),panel=new Panel(),a=config(),b=config();panel._root={querySelectorAll:()=>['enableResume','screenFilter.applyToScreenshot','backComment','enableFilter'].map(settingName=>({dataset:{settingName}}))};panel.config=a;
 let before=panel.renders;for(const key of ['enableResume','screenFilter.applyToScreenshot','backComment','enableFilter'])a.emit(key);assert.equal(panel.renders,before+4);
 before=panel.renders;a.emit('currentTime');assert.equal(panel.renders,before);
 panel.config=b;assert.equal(a.listeners.size,0);assert.equal(b.listeners.size,1);await panel.disconnectedCallback();assert.equal(b.listeners.size,0);
});
test('renamed JSON backups reach validated importer and invalid suffix explains rejection',async()=>{
 const notices=[],imports=[];let reader;const Panel=api({alert:t=>notices.push(t),confirm:()=>true,location:{reload(){}},FileReader:class{constructor(){reader=this;}readAsText(file){this.onload({target:{result:'{}'}});}}});
 const panel=new Panel();panel.props.config={importJson:value=>imports.push(value)};
 const event=name=>({target:{files:[{name}],value:name},preventDefault(){},stopPropagation(){}});
 await panel.onImportFileSelect(event('renamed.JSON'));assert.deepEqual(imports,['{}']);assert(reader);
 await panel.onImportFileSelect(event('backup.txt'));assert.equal(notices.length,1);assert.equal(imports.length,1);
});
test('normal UI has one filter entry, visible advanced entry, labeled fields and no legacy HLS toggle',()=>{
 const Panel=api();const deep=new Proxy({}, {get:(_,key)=>key===Symbol.toPrimitive?()=>'' : deep});
 const html=(strings,...values)=>strings.reduce((s,part,i)=>s+part+(typeof values[i]==='string'?values[i]:''),'');
 const text=Panel.getContentsTemplate(html,{}, {config:{props:deep}},{});const dom=new JSDOM(text);const doc=dom.window.document;
 assert.equal(doc.querySelectorAll('[data-command="toggle-screenFilterPanel"]').length,1);assert.equal(doc.querySelectorAll('[data-command="screenFilter-preset"]').length,0);
 assert.equal(doc.querySelector('[data-command="openAdvancedSettings"]').closest('details'),null);
 assert.equal(doc.querySelector('[data-setting-name="video.hls.enableOnlyRequired"]'),null);
 assert(doc.querySelector('[data-setting-name="wordFilter"]').getAttribute('aria-label'));assert(doc.querySelector('input[type=file]').getAttribute('aria-label'));
 assert(text.includes('配信スレッドの種類'));assert(text.includes(':focus-visible'));assert(text.includes('#171e2af7'));dom.window.close();
});

test('dedicated tools close normal settings and leave original command bubbling exactly once',()=>{
 const Panel=api(),panel=new Panel();let closes=0;panel.close=()=>closes++;
 for(const command of ['toggle-screenFilterPanel','openAdvancedSettings','toggleHLSDebug']){
  let stopped=false;panel.onCommand({detail:{command},stopPropagation(){stopped=true;},preventDefault(){stopped=true;}});
  assert.equal(stopped,false);
 }
 assert.equal(closes,3);
});
test('connected normal settings has dialog role and accessible name without claiming a focus trap',async()=>{
 const Panel=api(),panel=new Panel(),attrs={};panel._dialog={setAttribute:(key,value)=>attrs[key]=value};
 await panel.connectedCallback();assert.equal(attrs.role,'dialog');assert.equal(attrs['aria-label'],'設定');assert.equal(attrs['aria-modal'],undefined);
});

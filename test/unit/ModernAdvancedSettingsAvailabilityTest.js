const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');
function boot(){
 const dom=new JSDOM('<section id="panel"><div class="settingPanelInner"></div></section>',{url:'https://example.com/path'});
 const ctx=createContext({window:dom.window,document:dom.window.document,URL});
 const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
 const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',ctx);
 const extra=Model.visibleExtraSettings.bind(Model);
 Model.visibleExtraSettings=()=>extra().concat([
 {id:'mode',label:'Mode',category:Model.CATEGORIES[0],subcategory:'Test',type:'select',inputPresentation:'radio',options:[{value:'all',label:'All'},{value:'allow',label:'Allow'}]},
 {id:'sites',label:'Sites',category:Model.CATEGORIES[0],subcategory:'Test',type:'textarea',dependsOn:'mode',dependsOnValue:'allow',disabledReason:'Choose Allow',description:'Short help',descriptionDetails:'Long help',addCurrentSite:true}]);
 const defaults={mode:'all',sites:'saved.example',speakLark:false,speakLarkVolume:1,'bookmark.showVideoThumbnails':true,'bookmark.thumbnailWidth':96};
 const config={default:defaults,values:{...defaults,speakLark:true,speakLarkVolume:0.4},getValue(k){return this.values[k];},setValue(k,v){this.values[k]=v;}};
 const model=new Model({config});const panel=dom.window.document.querySelector('#panel');
 const ui=new UI({panel,legacyRoot:panel.firstElementChild,model,storage:{getItem(){return null;},setItem(){}}});
 ui.selected={category:Model.CATEGORIES[0],subcategory:'Test'};ui._renderCards();
 return {dom,model,ui,config,close(){ui.dispose();dom.window.close();}};
}
describe('Advanced settings availability and compact controls',()=>{
 it('keeps equality dependencies and child values across disabled saves',()=>{const h=boot();
 assert.strictEqual(h.model.descriptor('sites').dependsOn,'mode');assert.strictEqual(h.model.isEnabled('sites'),false);
 assert.strictEqual(h.model.disabledReason('sites'),'Choose Allow');h.model.set('mode','allow');assert(h.model.isEnabled('sites'));
 h.model.set('sites','draft.example');h.model.set('mode','all');h.model.save();assert.strictEqual(h.config.values.sites,'draft.example');h.close();});
 it('preserves unavailable legacy values through all resets',()=>{const h=boot();
 assert.strictEqual(h.model.descriptor('speakLark').subcategory,'旧設定・互換性');assert(!h.model.isEnabled('speakLark'));
 h.model.resetCategory(h.model.descriptor('speakLark').category);h.model.resetItem('speakLarkVolume');
 assert.strictEqual(h.model.get('speakLark'),true);assert.strictEqual(h.model.get('speakLarkVolume'),0.4);h.close();});
 it('refreshes radio dependencies in place with visible reasons and staged edits',()=>{const h=boot();const root=h.ui.root;
 const field=root.querySelector('[data-setting-name="sites"]');const row=field.closest('article');
 assert(field.disabled);assert.strictEqual(row.querySelector('[data-zw-disabled-reason]').textContent,'Choose Allow');
 assert.strictEqual(row.querySelector('.zw-modern-summary').textContent,'Short help');assert(row.querySelector('.zw-modern-note').hidden);
 const radio=root.querySelector('input[type=radio][value=allow]');assert(radio);radio.focus();radio.checked=true;radio.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));
 assert.strictEqual(root.querySelector('[data-setting-name="sites"]'),field);assert.strictEqual(h.dom.window.document.activeElement,radio);assert(!field.disabled);
 assert(row.querySelector('[data-zw-disabled-reason]').hidden);row.querySelector('[data-zw-add-current-site]').click();
 assert.strictEqual(h.model.get('sites'),'saved.example\nexample.com');assert.strictEqual(field.value,'saved.example\nexample.com');assert.strictEqual(h.config.values.sites,'saved.example');h.close();});
 it('explains disabled ancestors before a matching child selection',()=>{const h=boot();
 h.model.set('mode','allow');const parent=h.model.descriptor('mode');parent.dependsOn='bookmark.showVideoThumbnails';
 h.model.set('bookmark.showVideoThumbnails',false);
 assert.strictEqual(h.model.disabledReason('sites'),h.model.disabledReason('mode'));
 assert.notStrictEqual(h.model.disabledReason('sites'),'Choose Allow');h.close();});
 it('uses the caller-provided external host and disables an unavailable host',()=>{const h=boot();
 h.model.set('mode','allow');const descriptor=h.model.descriptor('sites');descriptor.currentSite='external.example';h.ui._renderCards();
 h.ui.root.querySelector('[data-zw-add-current-site]').click();assert.strictEqual(h.model.get('sites'),'saved.example\nexternal.example');
 h.ui.root.querySelector('[data-zw-add-current-site]').click();assert.strictEqual(h.model.get('sites'),'saved.example\nexternal.example');
 descriptor.currentSite='';h.ui._refreshCards();assert(h.ui.root.querySelector('[data-zw-add-current-site]').disabled);h.close();});
 it('preserves segmented choice focus and parent-child order',()=>{const h=boot();
 delete h.model.descriptor('mode').inputPresentation;h.ui._renderCards();
 const cards=Array.from(h.ui.cards.querySelectorAll('[data-zw-id]'),node=>node.dataset.zwId);
 assert.strictEqual(cards.indexOf('sites'),cards.indexOf('mode')+1);
 const button=h.ui.root.querySelector('[data-zw-choice][data-zw-value=allow]');button.focus();button.click();
 assert.strictEqual(h.dom.window.document.activeElement,button);assert(button.classList.contains('is-selected'));
 assert(!h.ui.root.querySelector('[data-setting-name=sites]').disabled);h.close();});
 it('uses thumbnail visibility as parent and fails closed on dependency cycles',()=>{const h=boot();
 h.model.set('bookmark.showVideoThumbnails',false);assert(!h.model.isEnabled('bookmark.thumbnailWidth'));
 h.model.descriptor('mode').dependsOn='sites';assert(!h.model.isEnabled('mode'));h.close();});
});

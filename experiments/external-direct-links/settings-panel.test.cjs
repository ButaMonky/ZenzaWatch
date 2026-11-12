const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const path=require('node:path');
const {openExternalSettings}=require(path.join(process.env.EXTERNAL_SETTINGS_TEST_DIR||path.join(__dirname,'generated'),'settings-panel.js'));
function panel(values={},url='https://current.example/watch/9') {
 const w=new JSDOM('',{url}).window;let shadow,saved;
 const attach=w.Element.prototype.attachShadow;
 w.Element.prototype.attachShadow=function(init){shadow=attach.call(this,init);return shadow;};
 openExternalSettings(w.document,values,v=>saved=v);
 const input=key=>shadow.querySelector(`[data-key="externalLinks.${key}"]`);
 const change=(key,value)=>{const el=input(key);if(el.type==='checkbox')el.checked=value;else if(el.type==='radio'){shadow.querySelector(`[data-key="externalLinks.${key}"][value="${value}"]`).checked=true;}else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const button=text=>[...shadow.querySelectorAll('button')].find(el=>el.textContent===text);
 return {w,shadow,input,change,button,get saved(){return saved;}};
}
test('site allow mode and global enable control descendants without losing draft or saved values',()=>{
 const p=panel({'externalLinks.sites':'kept.example','externalLinks.excludedSites':'private.example'});
 assert.equal(p.input('sites').disabled,true);
 assert.equal(p.button('現在のサイトを追加').disabled,true);
 assert.match(p.shadow.getElementById('externalLinks.sites-reason').textContent,/指定したサイトのみ/);
 assert.equal(p.input('excludedSites').disabled,false);
 p.change('siteMode','allow');assert.equal(p.input('sites').disabled,false);
 p.input('sites').value='edited.example';p.change('enabled',false);
 assert.equal(p.input('sites').disabled,true);assert.equal(p.input('excludedSites').disabled,true);
 assert.match(p.shadow.getElementById('externalLinks.sites-reason').textContent,/ON/);
 p.change('enabled',true);assert.equal(p.input('sites').disabled,false);
 p.change('siteMode','all');assert.equal(p.input('sites').value,'edited.example');
 p.button('保存').click();assert.equal(p.saved['externalLinks.sites'],'edited.example');assert.equal(p.saved['externalLinks.excludedSites'],'private.example');p.w.close();
});
test('reset values save explicitly, and Escape discards edits',()=>{
 const p=panel({'externalLinks.siteMode':'allow','externalLinks.sites':'kept.example','externalLinks.prefixes':'xx'});
 p.button('初期値に戻す').click();assert.equal(p.saved,undefined);p.button('保存').click();
 assert.equal(p.saved['externalLinks.siteMode'],'all');assert.equal(p.saved['externalLinks.sites'],'');assert.equal(p.saved['externalLinks.prefixes'],'sm\nnm\nso\nss');p.w.close();
 const q=panel();q.input('sites').value='unsaved.example';q.shadow.querySelector('section').dispatchEvent(new q.w.KeyboardEvent('keydown',{key:'Escape'}));
 assert.equal(q.saved,undefined);assert.equal(q.w.document.querySelector('[data-zenza-external-settings]'),null);q.w.close();
});
test('add current site uses HTTPS document host, avoids duplicate entries and keeps prefixes multiline',()=>{
 const p=panel({'externalLinks.siteMode':'allow','externalLinks.sites':'saved.example'});
 p.button('現在のサイトを追加').click();p.button('現在のサイトを追加').click();
 assert.equal(p.input('sites').value,'saved.example\ncurrent.example');assert.equal(p.input('prefixes').value,'sm\nnm\nso\nss');
 p.button('保存').click();assert.equal(p.saved['externalLinks.sites'],'saved.example\ncurrent.example');p.w.close();
 const invalid=panel({'externalLinks.siteMode':'allow'},'http://current.example/');assert.equal(invalid.button('現在のサイトを追加').disabled,true);invalid.w.close();
});
test('reset updates dependencies and cancel never saves',()=>{
 const p=panel({'externalLinks.enabled':false,'externalLinks.siteMode':'allow','externalLinks.sites':'kept.example'});
 p.button('初期値に戻す').click();assert.equal(p.input('enabled').checked,true);assert.equal(p.input('sites').disabled,true);assert.equal(p.input('sites').value,'');
 p.button('キャンセル').click();assert.equal(p.saved,undefined);assert.equal(p.w.document.querySelector('[data-zenza-external-settings]'),null);p.w.close();
});

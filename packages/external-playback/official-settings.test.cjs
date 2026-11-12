const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {connectOfficialExternalSettings}=require('./generated/official-settings');
test('official preferences synchronize both ways and ignore unrelated storage',()=>{
 const w=new JSDOM('',{url:'https://www.nicovideo.jp/'}).window;
 let data={'externalLinks.displayMode':'hover'},listener,removed=false;
 const dispose=connectOfficialExternalSettings(w,{get:()=>data,set:(k,v)=>{data=v;listener?.();},listen:(k,f)=>{listener=f;return 1;},unlisten:()=>removed=true});
 const key='ZenzaWatch_externalLinks.displayMode';
 assert.equal(JSON.parse(w.localStorage.getItem(key)),'hover');
 w.localStorage.setItem(key,JSON.stringify('inline'));
 w.localStorage.setItem('ZenzaWatch_secret',JSON.stringify('private'));
 w.dispatchEvent(new w.CustomEvent('ZenzaWatch-advanced-settings-saved',{detail:{keys:['externalLinks.displayMode','secret']}}));
 assert.equal(data['externalLinks.displayMode'],'inline');assert.equal(data.secret,undefined);
 data={...data,'externalLinks.displayMode':'hover'};listener();
 assert.equal(JSON.parse(w.localStorage.getItem(key)),'hover');
 dispose();assert.equal(removed,true);w.close();
});

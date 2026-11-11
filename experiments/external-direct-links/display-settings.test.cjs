const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {createDisplaySettings}=require('./display-settings.cjs');
test('copies presentation preferences across partitions without account or history data',()=>{
 const a=new JSDOM('',{url:'https://www.nicovideo.jp/my'}).window;
 const b=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt'}).window;
 const data=new Map(),gm={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};
 for(const [k,v] of Object.entries({screenMode:'big',menuScale:1.2,'ui.bar.like':false,lastWatchId:'sm9',userSession:'secret','relatedMenu.customLinks':['private']}))a.localStorage.setItem('ZenzaWatch_'+k,JSON.stringify(v));
 createDisplaySettings(a,gm).publish();assert.equal(createDisplaySettings(b,gm).apply(),true);
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_screenMode'),'"big"');
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_menuScale'),'1.2');
 assert.equal(b.localStorage.length,4);assert.equal(a.localStorage.getItem('ZenzaWatch_screenMode'),'"big"');
 b.localStorage.setItem('ZenzaWatchExternalTrial_menuScale','1.5');createDisplaySettings(b,gm).apply();
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_menuScale'),'1.5','unchanged snapshots preserve trial adjustments');
 a.localStorage.removeItem('ZenzaWatch_menuScale');createDisplaySettings(a,gm).publish();createDisplaySettings(b,gm).apply();
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_menuScale'),null,'official reset returns trial to default');
 a.close();b.close();
});
test('external pages cannot publish snapshots and invalid values are ignored',()=>{
 const w=new JSDOM('',{url:'https://example.org'}).window;let writes=0;
 const gm={set:()=>writes++,get:()=>({version:1,values:{screenMode:{bad:true},lastWatchId:'sm9',menuScale:Infinity}})};
 const bridge=createDisplaySettings(w,gm);bridge.publish();bridge.apply();assert.equal(writes,0);assert.equal(w.localStorage.length,1);assert.equal(w.localStorage.getItem('ZenzaWatchExternalTrial_lastWatchId'),null);w.close();
});

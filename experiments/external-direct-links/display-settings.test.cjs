const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {createDisplaySettings}=require('./display-settings.cjs');
const keys=['volume','screenFilter.userPresets','wordFilter'];
test('normal, advanced, and HLS preferences survive a new partition without writing back',()=>{
 const a=new JSDOM('',{url:'https://www.nicovideo.jp/my'}).window;
 const b=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt'}).window;
 const c=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt'}).window;
 const data=new Map(),gm={get:k=>data.get(k),set:(k,v)=>data.set(k,structuredClone(v))};
 for(const [k,v] of Object.entries({screenMode:'big',volume:.3,'videoHeader.position':'outside','video.hls.maxBufferLength':45,'screenFilter.userPresets':[{name:'test',brightness:1.1}],lastWatchId:'sm9',userSession:'secret'}))a.localStorage.setItem('ZenzaWatch_'+k,JSON.stringify(v));
 const official=createDisplaySettings(a,gm,keys),trial=createDisplaySettings(b,gm,keys);official.publish();assert.equal(trial.apply(),true);
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_video.hls.maxBufferLength'),'45');
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_videoHeader.position'),'"outside"');
 assert.equal(b.localStorage.getItem('ZenzaWatchExternalTrial_lastWatchId'),null);
 b.localStorage.setItem('ZenzaWatchExternalTrial_volume','0.6');b.localStorage.setItem('ZenzaWatchExternalTrial_video.hls.maxBufferLength','60');trial.save();
 const next=createDisplaySettings(c,gm,keys);next.apply();
 assert.equal(c.localStorage.getItem('ZenzaWatchExternalTrial_volume'),'0.6');assert.equal(c.localStorage.getItem('ZenzaWatchExternalTrial_video.hls.maxBufferLength'),'60');
 a.localStorage.setItem('ZenzaWatch_screenMode','"wide"');official.publish();next.apply();
 assert.equal(c.localStorage.getItem('ZenzaWatchExternalTrial_volume'),'0.6','unrelated official changes preserve trial edits');
 assert.equal(c.localStorage.getItem('ZenzaWatchExternalTrial_screenMode'),'"wide"');
 assert.equal(a.localStorage.getItem('ZenzaWatch_video.hls.maxBufferLength'),'45');
 a.localStorage.removeItem('ZenzaWatch_video.hls.maxBufferLength');official.publish();next.apply();assert.equal(c.localStorage.getItem('ZenzaWatchExternalTrial_video.hls.maxBufferLength'),null);
 a.close();b.close();c.close();
});
test('rejects unknown state and unsafe structured values; external page cannot publish',()=>{
 const w=new JSDOM('',{url:'https://example.org'}).window;let writes=0;
 const gm={set:()=>writes++,get:k=>k==='settings-v2'?{version:2,values:{lastWatchId:'sm9',menuScale:Infinity,'screenFilter.userPresets':JSON.parse('{"__proto__":{}}')}}:undefined};
 const bridge=createDisplaySettings(w,gm,keys);bridge.publish();assert.equal(writes,0);bridge.apply();assert.equal(w.localStorage.length,0);w.close();
});
test('bursty settings changes persist once and explicit close flushes latest values',async()=>{
 const w=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt'}).window;let writes=0,last;
 const gm={get:()=>undefined,set:(_k,v)=>{writes++;last=v;}};
 const bridge=createDisplaySettings(w,gm,keys);bridge.apply();writes=0;
 for(let i=0;i<20;i++){w.localStorage.setItem('ZenzaWatchExternalTrial_volume',JSON.stringify(i/20));bridge.scheduleSave();}
 await new Promise(r=>w.setTimeout(r,300));assert.equal(writes,1);assert.equal(last.values.volume,.95);
 w.localStorage.setItem('ZenzaWatchExternalTrial_volume','0.5');bridge.scheduleSave();bridge.save();assert.equal(last.values.volume,.5);w.close();
});
test('two open external pages merge only changed keys, including stale close',()=>{
 const a=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt'}).window,b=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt'}).window;
 const data=new Map([['settings-v2',{version:2,values:{volume:.3,menuScale:1}}]]),gm={get:k=>data.get(k),set:(k,v)=>data.set(k,structuredClone(v))};
 const first=createDisplaySettings(a,gm,keys),second=createDisplaySettings(b,gm,keys);first.apply();second.apply();
 a.localStorage.setItem('ZenzaWatchExternalTrial_volume','0.6');first.save();
 b.localStorage.setItem('ZenzaWatchExternalTrial_menuScale','1.5');second.save();first.save();
 assert.equal(data.get('trial-settings-v2').values.volume,.6);assert.equal(data.get('trial-settings-v2').values.menuScale,1.5);
 a.close();b.close();
});

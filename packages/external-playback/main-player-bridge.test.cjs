const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const modulePath=path.join(__dirname,'generated/main-player-bridge.js');
test('same-frame main player protocol is implemented',()=>{
 assert.ok(fs.existsSync(modulePath),'typed main player bridge must exist');
});
function frame(){
 const listeners=new Set();let w;
 w={location:{origin:'https://www.nicovideo.jp',pathname:'/robots.txt'},name:'ZenzaWatchExternalTrialPlayer',
 top:{},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,
 addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn);},
 removeEventListener:(type,fn)=>listeners.delete(fn),
 postMessage(data){queueMicrotask(()=>{for(const fn of [...listeners])fn({source:w,origin:w.location.origin,data});});},
 deliver(data,source){for(const fn of [...listeners])fn({source,origin:w.location.origin,data});}};
 return w;
}
for(const providerFirst of [true,false])test('launch succeeds with separate script closures; provider first='+providerFirst,async()=>{
 const {createMainPlayerClient,installMainPlayerProvider}=require(modulePath);
 const w=frame(),opened=[],stages=[];
 const session={open:async id=>opened.push(id),close:()=>true,setStageListener(fn){this.stage=fn;}};
 let dispose;
 if(providerFirst)dispose=installMainPlayerProvider(w,session);
 const client=createMainPlayerClient(w,{timeoutMs:150,retryMs:10});
 client.setStageListener(s=>stages.push(s));
 const operation=client.open('sm9',{isTrusted:true});
 if(!providerFirst)dispose=installMainPlayerProvider(w,session);
 await operation;assert.deepEqual(opened,['sm9']);session.stage('OPEN');
 await new Promise(r=>setTimeout(r,0));assert.deepEqual(stages,['OPEN']);
 client.dispose();dispose();
});
test('missing main is a bounded actionable failure',async()=>{
 const {createMainPlayerClient}=require(modulePath),client=createMainPlayerClient(frame(),{timeoutMs:20,retryMs:5});
 await assert.rejects(client.open('sm9',{isTrusted:true}),/MAIN_PLAYER_UNAVAILABLE/);client.dispose();
});
test('untrusted click, parent messages and invalid video IDs do not launch',async()=>{
 const {createMainPlayerClient,installMainPlayerProvider}=require(modulePath),w=frame(),opened=[];
 const dispose=installMainPlayerProvider(w,{open:async id=>opened.push(id),close:()=>true,setStageListener(){}});
 const client=createMainPlayerClient(w,{timeoutMs:50,retryMs:5});
 await assert.rejects(client.open('sm9',{isTrusted:false}),/USER_CLICK_REQUIRED/);
 await assert.rejects(client.open('https://evil.example/',{isTrusted:true}),/INVALID_VIDEO_ID/);
 w.deliver({protocol:'zenza-main-player-v1',type:'open',id:'sm9',requestId:1},w.top);
 assert.deepEqual(opened,[]);client.dispose();dispose();
});
test('provider hides on closing but client waits for saved/closed notification',async()=>{
 const {createMainPlayerClient,installMainPlayerProvider}=require(modulePath),w=frame(),events=[];
 let stage;
 const session={open:async()=>{},close:()=>true,setStageListener(fn){stage=fn;}};
 const dispose=installMainPlayerProvider(w,session);
 const client=createMainPlayerClient(w,{timeoutMs:100,retryMs:5,onClosing:()=>events.push('closing'),onClosed:()=>events.push('closed')});
 await client.open('sm9',{isTrusted:true});
 stage('CLOSING');await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['closing']);
 stage('CLOSED');await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['closing','closed']);
 client.dispose();dispose();
});

test('closing before main appears cancels retries and never starts late playback',async()=>{
 const {createMainPlayerClient,installMainPlayerProvider}=require(modulePath),w=frame(),opened=[],events=[];
 const client=createMainPlayerClient(w,{timeoutMs:100,retryMs:5,onClosing:()=>events.push('closing'),onClosed:()=>events.push('closed')});
 const opening=client.open('sm9',{isTrusted:true});const rejected=assert.rejects(opening,/PLAYER_CLOSED/);
 client.close();
 const dispose=installMainPlayerProvider(w,{open:async id=>opened.push(id),close:()=>true,setStageListener(){}});
 await rejected;await new Promise(r=>setTimeout(r,25));
 assert.deepEqual(opened,[]);assert.deepEqual(events,['closing','closed']);
 await assert.rejects(client.open('sm10',{isTrusted:true}),/PLAYER_CLOSED/);
 client.dispose();dispose();
});

// Task1032: Tampermonkey などがスクリプトごとに window を包んで渡す場合（実機で hello が一度も届かなかった）。
test('launch succeeds when each script sees its own wrapper of the same frame window',async()=>{
 const {createMainPlayerClient,installMainPlayerProvider}=require(modulePath);
 const raw=frame();raw.document={};raw.location.href='https://www.nicovideo.jp/robots.txt#t';
 const mainView=new Proxy(raw,{}),companionView=new Proxy(raw,{});
 assert.notEqual(mainView,raw);assert.notEqual(companionView,mainView);
 const opened=[];
 const session={open:async id=>opened.push(id),close:()=>true,setStageListener(){}};
 const dispose=installMainPlayerProvider(mainView,session);
 const client=createMainPlayerClient(companionView,{timeoutMs:300,retryMs:10});
 await client.open('sm9',{isTrusted:true});
 assert.deepEqual(opened,['sm9']);
 client.dispose();dispose();
});
test('a different window (e.g. a child loader frame) is still rejected even if same origin',async()=>{
 const {installMainPlayerProvider}=require(modulePath);
 const raw=frame();raw.document={};raw.location.href='https://www.nicovideo.jp/robots.txt#t';
 const events=[];
 const session={open:async()=>{throw Error('must not open');},close:()=>true,setStageListener(){}};
 const dispose=installMainPlayerProvider(raw,session,{onDiag:(e,d)=>events.push([e,d])});
 const child={document:{},name:'nicovideoApiZenzaWatchExternalTrialLoader1',location:{href:'https://www.nicovideo.jp/robots.txt#x'}};
 raw.deliver({protocol:'zenza-main-player-v1',channel:'00000000-0000-0000-0000-000000000000',type:'hello'},child);
 await new Promise(r=>setTimeout(r,5));
 assert.ok(events.some(([e,d])=>e==='provider-message-rejected'&&d.reason==='source'));
 assert.ok(!events.some(([e])=>e==='provider-hello'));
 dispose();
});

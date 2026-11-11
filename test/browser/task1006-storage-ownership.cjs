'use strict';
// Localhost-only native IndexedDB/BroadcastChannel acceptance. Synthetic data.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const {beginSection,extract}=require('../helpers/extractSource');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-storage1006-'));
const connections=[];let chrome,server;
async function connect(port,url){
  const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(tab.webSocketDebuggerUrl),pending=new Map();let seq=0;
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},15000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Fetch.requestPaused'){
      const p=message.params;
      void send(p.request.url.startsWith(url)?'Fetch.continueRequest':'Fetch.failRequest',
        {requestId:p.requestId,...(p.request.url.startsWith(url)?{}:{errorReason:'BlockedByClient'})});
    }
    const item=pending.get(message.id);if(!item)return;
    clearTimeout(item.timer);pending.delete(message.id);
    message.error?item.reject(Error(message.error.message)):item.resolve(message.result);
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||'Fixture evaluation failed');
    return result.result.value;
  };
  connections.push({send,close(){for(const item of pending.values())clearTimeout(item.timer);ws.close();}});
  await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await send('Page.navigate',{url});
  for(let n=0;n<100;n++){if(await evaluate('document.readyState==="complete"'))break;await delay(20);}
  return {send,evaluate};
}
async function until(tab,expression){
  for(let n=0;n<100;n++){if(await tab.evaluate(expression))return;await delay(30);}
  throw Error('Peer state did not converge');
}
(async()=>{try{
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Synthetic storage fixture</title>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/`;
  const executable=process.env.CHROME_EXECUTABLE||(process.platform==='win32'?
    path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'):'/usr/bin/google-chrome');
  chrome=await startChromeCdp(executable,profile);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
  const a=await connect(port,url),b=await connect(port,url);
  const modules=['ManualBookmarkPolicy','ManualBookmarkStore','ManualBookmarkSession'].map(name=>beginSection(`packages/zenza/src/resume/${name}.js`)).join('\n');
  for(const tab of [a,b])await tab.evaluate(`${modules}
    window.backend=new IndexedDbManualBookmarkBackend(indexedDB);
    window.repository=new ManualBookmarkRepository(backend);
    window.session=new ManualBookmarkSession(repository);
    session.activate('sm1006',120);`);
  await until(a,'session.snapshot.status==="ready"');await until(b,'session.snapshot.status==="ready"');
  await a.evaluate("session.add('fixture-one',10,1,'synthetic')");
  await until(b,'session.snapshot.bookmarks.length===1');
  await b.evaluate("session.rename('fixture-one','renamed',2)");
  await until(a,'session.snapshot.bookmarks[0]?.label==="renamed"');
  await a.evaluate("repository.remove('sm1006','fixture-one',120).then(()=>session.notifyCommittedChange())");
  await until(b,'session.snapshot.bookmarks.length===0');
  await until(a,'session.snapshot.bookmarks.length===0');
  console.log('BOOKMARK_NATIVE_PEERS_PASS add, rename, library delete');

  const journalModules=['NotificationJournalPolicy','NotificationJournalStore'].map(name=>
    beginSection(`packages/zenza/src/notification/${name}.js`)).join('\n')+'\n'+beginSection('src/NotificationJournal.js');
  for(const tab of [a,b])await tab.evaluate(`window.BroadcastChannel=undefined;${journalModules}\nwindow.journal=NotificationJournal;`);
  await a.evaluate("journal.recordDiagnostic('diag-native',{message:'failure',details:{outcome:'failed'}});journal.list();");
  assert.strictEqual(await b.evaluate('journal.clear()'),true);
  assert.strictEqual((await a.evaluate("journal.recordDiagnostic('diag-native',{message:'recovery',details:{outcome:'recovered'}});journal.list();")).length,0);
  const fresh=await a.evaluate("journal.recordDiagnostic('diag-native',{message:'new failure',details:{outcome:'failed'}});journal.list();");
  assert.strictEqual(fresh.length,1);assert.strictEqual(fresh[0].details.count,1);
  await b.evaluate('journal.clear()');
  await a.evaluate("journal.record({category:'like',message:'same',videoId:'sm1006'});journal.list();");
  await b.evaluate('journal.clear()');
  const generic=await a.evaluate("journal.record({category:'general',source:'popup',message:'same'});journal.list();");
  assert.strictEqual(generic.length,1);assert.strictEqual(generic[0].category,'general');
  console.log('NOTIFICATION_NATIVE_CLEAR_PASS durable epoch without BroadcastChannel');

  const worker=extract('packages/lib/src/infra/IndexedDbStorage.js','workerFunc','var');
  await a.evaluate(`window.controller=(${worker})({addEventListener(){},postMessage(){}});
    controller.init({name:'watch-info',ver:2,stores:[{name:'cache',definition:{keyPath:'watchId'},indexes:[]}]});`);
  const sample={watchId:'sm1006',watchCount:7,resume:[{now:1,time:10}],comment:['synthetic'],
    videoInfo:{videoId:'sm1006',title:'Synthetic',csrfToken:'TEST_ONLY_SECRET'}};
  await a.evaluate(`controller.put({name:'watch-info',storeName:'cache',data:${JSON.stringify(sample)}})`);
  const stats=await a.evaluate("controller.scrubWatchVideoInfo({name:'watch-info',storeName:'cache',data:{maxRecords:64}})");
  assert.strictEqual(stats.changed,1);
  const record=await a.evaluate("controller.get({name:'watch-info',storeName:'cache',data:{key:'sm1006'}})");
  assert.deepStrictEqual(record.resume,sample.resume);assert.deepStrictEqual(record.comment,sample.comment);
  assert.strictEqual(record.watchCount,7);assert.strictEqual(record.videoInfo.title,'Synthetic');
  assert.strictEqual(Object.hasOwn(record.videoInfo,'csrfToken'),false);
  await a.evaluate(`controller.put({name:'watch-info',storeName:'cache',data:${JSON.stringify(sample)}})`);
  assert.strictEqual((await a.evaluate("controller.scrubWatchVideoInfo({name:'watch-info',storeName:'cache',data:{maxRecords:64}})")).changed,1);
  await a.evaluate("controller.close({name:'watch-info'});session.dispose();repository.close();");
  await b.evaluate('session.dispose();repository.close();');
  console.log('WATCH_NATIVE_SCRUB_PASS preserves user fields, removes old-writer reinsertion');
}catch(error){console.error(error.stack);process.exitCode=1;}finally{
  if(chrome){
    const exited=new Promise(resolve=>chrome.once('exit',resolve));
    try{await connections[0]?.send('Browser.close');}catch{chrome.kill();}
    await Promise.race([exited,delay(5000)]);
    if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill();await Promise.race([exited,delay(3000)]);}
    const closed=chrome.exitCode!==null||chrome.signalCode!==null;
    console.log('OWNED_CHROME_CLOSED='+closed);if(!closed)process.exitCode=1;
  }
  connections.forEach(connection=>connection.close());server?.close();
  // Keep the temporary profile for approved recycle-bin maintenance.
}})();

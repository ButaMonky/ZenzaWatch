'use strict';
const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tools/typescript-stage1/.generated/scui-browser');
const os=require('os'),{spawn}=require('child_process');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'scui489-cdp-'));
let chrome;
async function client(url){
 const ws=new WebSocket(url),waiting=new Map(),errors=[];let seq=0;
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);
  if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);
  if(v.method==='Runtime.consoleAPICalled')console.log('PAGE_CONSOLE '+v.params.args.map(a=>a.value).join(' '));
  const p=waiting.get(v.id);if(!p)return;waiting.delete(v.id);clearTimeout(p.timer);
  v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);
 });
 return {errors,close:()=>ws.close(),send(method,params={}){const id=++seq;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error('CDP_TIMEOUT '+method));},30000);
   waiting.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}
(async()=>{
 const exe=path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe');
 const log=fs.openSync(path.join(out,'cdp-browser.log'),'w');
 chrome=spawn(exe,['--headless=new','--no-first-run','--disable-extensions',
  '--disable-background-networking','--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],
  {windowsHide:true,stdio:['ignore','ignore',log]});
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let n=0;n<60&&!fs.existsSync(portFile);n++)await new Promise(r=>setTimeout(r,250));
 if(!fs.existsSync(portFile))throw Error('DEVTOOLS_PORT_UNAVAILABLE');
 const host='http://127.0.0.1:'+fs.readFileSync(portFile,'utf8').split('\n')[0];
 const tab=await (await fetch(host+'/json/new?about:blank',{method:'PUT'})).json();
 const c=await client(tab.webSocketDebuggerUrl);const reports=[];
 try{
  await c.send('Page.enable');await c.send('Runtime.enable');
  console.log('EVAL_PROBE '+JSON.stringify(await c.send('Runtime.evaluate',{expression:'1+1',returnByValue:true})));
  for(const width of (process.argv.includes('--one')?[768]:[320,768,1536])){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   await c.send('Page.navigate',{url:pathToFileURL(path.join(out,'fixture.html')).href+'?w='+width+(process.argv.includes('--one')?'&one=1':'')});
   let report;
   for(let i=0;i<60;i++){
    await new Promise(r=>setTimeout(r,250));
    const x=await c.send('Runtime.evaluate',{expression:"document.getElementById('qa-result')?.textContent",returnByValue:true,allowUnsafeEvalBlockedByCSP:false});
    const value=x.result?.value;if(typeof value==='string'&&value.startsWith('{')){report=JSON.parse(value);break;}
    if(c.errors.length)break;
   }
   if(!report)report={failures:[{error:'RESULT_MISSING',exceptions:c.errors.splice(0)}]};
   reports.push({requestedWidth:width,...report});
   console.log(JSON.stringify({width,actual:report.width,checks:report.checks,failures:report.failures.length,first:report.failures.slice(0,8)}));
   fs.writeFileSync(path.join(out,'cdp-'+width+'.json'),JSON.stringify(report,null,2));
  }
  fs.writeFileSync(path.join(out,'cdp-results.json'),JSON.stringify(reports,null,2));
  if(reports.some(r=>r.failures.length))process.exitCode=1;
 }finally{c.close();await fetch(host+'/json/close/'+tab.id).catch(()=>{});chrome.kill();fs.closeSync(log);}
})().catch(error=>{console.error('SCUI_CDP_FAILED '+error.message);chrome?.kill();process.exitCode=1;});

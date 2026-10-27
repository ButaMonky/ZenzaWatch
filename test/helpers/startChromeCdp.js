'use strict';
// Task952: shared, observable Chrome startup for the two read-only tooltip
// browser regressions. No network or NicoNico credentials are required.
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function startChromeCdp(executable, profile, options={}) {
  const waitMs=options.waitMs ?? 30000;
  const args=[
    '--headless=new','--disable-background-networking','--disable-extensions',
    '--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,
    ...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),
    'about:blank'
  ];
  const chrome=spawn(executable,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let stderr='',spawnFailure=null;
  chrome.stderr?.on('data',value=>{
    // Bound diagnostic size; do not dump browser environment or profile contents.
    stderr=(stderr+String(value)).slice(-3200);
  });
  chrome.on('error',error=>{spawnFailure=error;});
  const portFile=path.join(profile,'DevToolsActivePort');
  const deadline=Date.now()+waitMs;
  while(Date.now()<deadline && !fs.existsSync(portFile)) {
    if(spawnFailure || (chrome.exitCode!==null && chrome.exitCode!==0))break;
    await pause(100);
  }
  if(fs.existsSync(portFile))return chrome;
  const failure=spawnFailure?.message||'none';
  const exit=chrome.exitCode===null?'still-running':String(chrome.exitCode);
  const diagnostics=stderr.trim().replace(/[\r\n]+/g,' ').slice(-1600);
  chrome.kill();
  throw new Error('Chrome CDP startup failed after '+waitMs+
    'ms (binary='+path.basename(executable)+', exit='+exit+
    ', spawnError='+failure+', stderr='+diagnostics+')');
}
module.exports={startChromeCdp};

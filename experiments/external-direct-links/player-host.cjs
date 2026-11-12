'use strict';
const {finishPlayerClose}=require('./generated/player-close.js');
const {installPlayerBackground}=require('./generated/player-background.js');
const {validVideoId}=require('./generated/targets.js');
// A cross-origin document is the CSS boundary. Account capabilities stay there.
function createPlayerHost(w,gm,transport,session,onStopped=()=>{}) {
  let frame,port,ticketKey,pending,sequence=0,closing=false,closeTimer,closingTask;
  const stop=(error=Error('PLAYER_CLOSED'))=>{
    const closingPort=port,closingFrame=frame,closingTicket=ticketKey,request=pending;
    port=null;frame=null;ticketKey=null;pending=null;closing=false;
    clearTimeout(closeTimer);
    request?.reject(error);closingPort?.close();closingFrame?.remove();
    if(closingTicket)gm.remove(closingTicket);
    if(closingFrame)onStopped();
  };
  async function open(id,event) {
    if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');
    if(!validVideoId(id))throw Error('INVALID_VIDEO_ID');
    if(pending||closing)throw Error('PLAYER_BUSY');
    if(frame&&!frame.isConnected)stop();
    return new Promise((resolve,reject)=>{
      const requestId=++sequence;
      const timer=w.setTimeout(()=>{stop(Error('PLAYER_TIMEOUT'));},60000);
      pending={resolve:()=>{w.clearTimeout(timer);pending=null;resolve();},reject:e=>{w.clearTimeout(timer);pending=null;reject(e);}};
      const send=()=>port.postMessage({type:'open',id,requestId});
      if(frame){send();return;}
      const token=w.crypto.randomUUID();ticketKey='player:'+token;
      const channel='zw-player:'+w.crypto.randomUUID();
      gm.set(ticketKey,{channel,origin:w.location.origin,expires:Date.now()+60000});
      port=transport.port(channel,'parent',()=>stop());
      port.addEventListener('message',e=>{
        const data=e.data;
        if(data?.type==='ready'){gm.remove(ticketKey);send();}
        else if(data?.type==='closing' && frame){
          closing=true;frame.style.setProperty('display','none','important');
          clearTimeout(closeTimer);closeTimer=setTimeout(()=>stop(),4000);
        }
        else if(data?.type==='closed')stop();
        else if(data?.requestId===sequence && data.type==='opened')pending?.resolve();
        else if(data?.requestId===sequence && data.type==='error'){
          const error=Error(['LOGIN_REQUIRED','AUTH_FORBIDDEN','AUTH_TIMEOUT','GM_NETWORK_ERROR'].includes(data.code)?data.code:'PLAYER_START_FAILED');
          error.stage=['BOOT','SETTINGS','AUTH','UI','VIDEO'].includes(data.stage)?data.stage:'BOOT';
          stop(error);
        }
      });
      frame=w.document.createElement('iframe');frame.name='ZenzaWatchExternalTrialPlayer';
      frame.setAttribute('data-zenza-player-host','');frame.title='ZenzaWatch';frame.allow='autoplay; fullscreen';frame.referrerPolicy='origin';
      frame.src='https://www.nicovideo.jp/robots.txt#'+token;
      for(const [key,value] of Object.entries({all:'initial',position:'fixed',inset:'0',width:'100vw',height:'100vh',border:'0',margin:'0',padding:'0',display:'block',background:'transparent','z-index':'2147483646'}))frame.style.setProperty(key,value,'important');
      w.document.body.append(frame);
    });
  }
  function accept() {
    if(w===w.top||w.name!=='ZenzaWatchExternalTrialPlayer'||w.location.origin!=='https://www.nicovideo.jp'||w.location.pathname!=='/robots.txt')return false;
    const key='player:'+w.location.hash.slice(1),ticket=gm.get(key);
    let origin;try{origin=new URL(w.document.referrer).origin;}catch(_){return false;}
    if(!ticket||ticket.claimed||ticket.expires<Date.now()||ticket.origin!==origin)return false;
    gm.set(key,{...ticket,claimed:true});port=transport.port(ticket.channel,'frame',()=>transport.dispose?.());
    w.document.head.replaceChildren();w.document.body.replaceChildren();
    w.document.documentElement.style.cssText='background:#111;color:#ddd;font:16px sans-serif;';
    w.document.body.style.cssText='margin:0;background:#111;';
    installPlayerBackground(w.document);
    const status=w.document.createElement('div');status.style.cssText='position:fixed;top:24px;left:24px;z-index:2147483647;color:#eee;background:#17212d;padding:16px;font:16px sans-serif';
    const labels={BOOT:'本体を準備しています',SETTINGS:'設定を接続しています',AUTH:'ログイン状態を確認しています',UI:'画面を準備しています',VIDEO:'動画を開いています'};
    status.textContent=labels.BOOT;w.document.body.append(status);
    session.setStageListener?.(stage=>{if(stage==='OPEN')status.remove();else status.textContent=labels[stage]||labels.BOOT;});
    let busy=false,last=0;
    port.addEventListener('message',async e=>{
      const m=e.data;if(m?.type!=='open'||busy||!Number.isSafeInteger(m.requestId)||m.requestId<=last||!validVideoId(m.id))return;
      busy=true;last=m.requestId;
      try{await session.open(m.id,{isTrusted:true});port.postMessage({type:'opened',requestId:m.requestId});}
      catch(error){w.console?.warn('[Zenza external trial] startup failed',error.stage||'BOOT',error.name||'Error');port.postMessage({type:'error',requestId:m.requestId,code:error.message,stage:error.stage});}
      finally{busy=false;}
    });
    port.postMessage({type:'ready'});
    return true;
  }
  w.addEventListener('pagehide',stop,{once:true});
  return {open,accept,close:(pendingSaves=[])=>{
    if(closingTask)return closingTask;
    if(!port)return Promise.resolve();
    const closingPort=port;
    closingTask=finishPlayerClose(pendingSaves,{
      hide:()=>closingPort.postMessage({type:'closing'}),
      dispose:()=>transport.dispose?.(closingPort),
      finish:async()=>{try{await closingPort.postMessage({type:'closed'});}finally{stop();}}
    });
    return closingTask;
  }};
}
module.exports={createPlayerHost};

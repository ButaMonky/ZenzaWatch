'use strict';
// A cross-origin document is the CSS boundary. Account capabilities stay there.
function createPlayerHost(w,gm,transport,session) {
  let frame,port,ticketKey,pending,sequence=0;
  const stop=(error=Error('PLAYER_CLOSED'))=>{pending?.reject(error);pending=null;port?.close();port=null;frame?.remove();frame=null;if(ticketKey)gm.remove(ticketKey);};
  async function open(id,event) {
    if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');
    if(!/^(?:(?:sm|nm|so)\d+|\d+)$/.test(id))throw Error('INVALID_VIDEO_ID');
    if(pending)throw Error('PLAYER_BUSY');
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
      port=transport.port(channel,'parent');
      port.addEventListener('message',e=>{
        const data=e.data;
        if(data?.type==='ready'){gm.remove(ticketKey);send();}
        else if(data?.type==='closed')stop();
        else if(data?.requestId===sequence && data.type==='opened')pending?.resolve();
        else if(data?.requestId===sequence && data.type==='error'){
          const error=Error(['LOGIN_REQUIRED','AUTH_FORBIDDEN','AUTH_TIMEOUT','GM_NETWORK_ERROR'].includes(data.code)?data.code:'PLAYER_START_FAILED');
          stop(error);
        }
      });
      frame=w.document.createElement('iframe');frame.name='ZenzaWatchExternalTrialPlayer';
      frame.setAttribute('data-zenza-player-host','');frame.title='ZenzaWatch';frame.allow='autoplay; fullscreen';frame.referrerPolicy='origin';
      frame.src='https://www.nicovideo.jp/robots.txt#'+token;
      for(const [key,value] of Object.entries({all:'initial',position:'fixed',inset:'0',width:'100vw',height:'100vh',border:'0',margin:'0',padding:'0',display:'block',background:'#111','z-index':'2147483646'}))frame.style.setProperty(key,value,'important');
      w.document.body.append(frame);
    });
  }
  function accept() {
    if(w===w.top||w.name!=='ZenzaWatchExternalTrialPlayer'||w.location.origin!=='https://www.nicovideo.jp'||w.location.pathname!=='/robots.txt')return false;
    const key='player:'+w.location.hash.slice(1),ticket=gm.get(key);
    let origin;try{origin=new URL(w.document.referrer).origin;}catch(_){return false;}
    if(!ticket||ticket.claimed||ticket.expires<Date.now()||ticket.origin!==origin)return false;
    gm.set(key,{...ticket,claimed:true});port=transport.port(ticket.channel,'frame');
    w.document.head.replaceChildren();w.document.body.replaceChildren();
    w.document.documentElement.style.cssText='background:#111;color:#ddd;font:16px sans-serif;';
    w.document.body.style.cssText='margin:0;background:#111;';
    let busy=false,last=0;
    port.addEventListener('message',async e=>{
      const m=e.data;if(m?.type!=='open'||busy||!Number.isSafeInteger(m.requestId)||m.requestId<=last||!/^(?:(?:sm|nm|so)\d+|\d+)$/.test(m.id))return;
      busy=true;last=m.requestId;
      try{await session.open(m.id,{isTrusted:true});port.postMessage({type:'opened',requestId:m.requestId});}
      catch(error){port.postMessage({type:'error',requestId:m.requestId,code:error.message});}
      finally{busy=false;}
    });
    port.postMessage({type:'ready'});
    return true;
  }
  w.addEventListener('pagehide',stop,{once:true});
  return {open,accept,close:()=>port?.postMessage({type:'closed'})};
}
module.exports={createPlayerHost};

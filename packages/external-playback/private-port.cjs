'use strict';

// Private userscript storage carries messages. No ports, API responses or
// authentication capabilities are sent through window.postMessage / DOM events.
function createPrivateTransport(w, gm, onDispose=()=>{}) {
  const ports=new Set();let disposed=false;
  function dispose(keep){
    if(disposed)return;disposed=true;
    for(const p of [...ports])if(p!==keep)p.close();
    onDispose();
  }
  w.addEventListener('pagehide',()=>dispose(),{once:true});
  let frameTicket=null,framePort=null;
  async function pack(value) {
    if(value instanceof w.ArrayBuffer) return {zwType:'buffer',bytes:Array.from(new w.Uint8Array(value))};
    if(w.Blob && value instanceof w.Blob) return {zwType:'blob',mime:value.type,bytes:Array.from(new w.Uint8Array(await value.arrayBuffer()))};
    if(ArrayBuffer.isView(value))return {zwType:'buffer',bytes:Array.from(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
    if(value instanceof w.Date)return {zwType:'date',value:value.toISOString()};
    if(Array.isArray(value))return Promise.all(value.map(pack));
    if(value&&typeof value==='object')return {zwType:'object',entries:await Promise.all(Object.entries(value).map(async([k,v])=>[k,await pack(v)]))};
    return value===undefined?{zwType:'undefined'}:value;
  }
  function unpack(value) {
    if(Array.isArray(value))return value.map(unpack);
    if(!value||typeof value!=='object')return value;
    if(value.zwType==='buffer')return new w.Uint8Array(value.bytes).buffer;
    if(value.zwType==='blob')return new w.Blob([new w.Uint8Array(value.bytes)],{type:value.mime});
    if(value.zwType==='date')return new w.Date(value.value);
    if(value.zwType==='undefined')return undefined;
    if(value.zwType==='object')return Object.fromEntries(value.entries.map(([k,v])=>[k,unpack(v)]));
    throw Error('INVALID_PRIVATE_PACKET');
  }
  function port(channel,side,onClose=()=>{}) {
    if(disposed)throw Error('TRANSPORT_CLOSED');
    const incoming=channel+(side==='parent'?':f':':p'),outgoing=channel+(side==='parent'?':p':':f');
    const listeners={message:new Set(),messageerror:new Set()};let closed=false,queue=Promise.resolve(),seq=0,last=0;
    const emit=(kind,event)=>{for(const fn of [...listeners[kind]]){fn(event);if(event.stopped)break;}};
    const listener=gm.listen(incoming,(_key,_old,packet)=>{
      if(closed||!packet||!Number.isSafeInteger(packet.seq)||packet.seq<=last)return;
      last=packet.seq;
      if(packet.closed){api.close(false);return;}
      try {emit('message',{data:unpack(packet.data),stopImmediatePropagation(){this.stopped=true;}});}
      catch(_){emit('messageerror',{});}
      finally {if(gm.get(incoming)?.seq===packet.seq)gm.remove(incoming);}
    });
    const api={
      postMessage(data){queue=queue.then(async()=>{if(closed)return;const encoded=await pack(data);if(!closed)gm.set(outgoing,{seq:++seq,data:encoded});})
        .catch(()=>{if(!closed)emit('messageerror',{});});return queue;},
      addEventListener(kind,fn){listeners[kind]?.add(fn);},
      removeEventListener(kind,fn){listeners[kind]?.delete(fn);},start(){},
      close(notify=true){
        if(closed)return;closed=true;gm.unlisten(listener);ports.delete(api);
        listeners.message.clear();listeners.messageerror.clear();
        if(notify)gm.set(outgoing,{seq:++seq,closed:true});
        gm.remove(incoming);gm.remove(outgoing);onClose();
      }
    };
    ports.add(api);return api;
  }
  const origin=value=>{try{return new URL(value).origin;}catch(_){return null;}};
  function acceptFrame() {
    const match=/^(nicovideoApi|thumbInfo)ZenzaWatchExternalTrialLoader(?:#(.*))?$/.exec(w.name);
    if(!match||w===w.top)return false;
    const type=match[1],token=w.location.hash.slice(1),key='ticket:'+type+':'+token;
    const ticket=gm.get(key);
    if(!ticket||ticket.claimed||ticket.expires<Date.now()||ticket.type!==type||
      ticket.frameOrigin!==w.location.origin||ticket.origin!==origin(w.document.referrer||match[2]))return false;
    gm.set(key,{...ticket,claimed:true});frameTicket=ticket;
    framePort=port(ticket.channel,'frame',()=>dispose());
    w.addEventListener('pagehide',()=>framePort.close(),{once:true});
    return true;
  }
  function connectGate(gate,token,product) {
    const frame=w.document.createElement('iframe'),generation=gate._generation;
    const type=gate._type,key='ticket:'+type+':'+token;
    const ticket={type,origin:w.location.origin,frameOrigin:new URL(gate._baseUrl).origin,
      channel:'zw-private:'+w.crypto.randomUUID(),expires:Date.now()+60000,claimed:false};
    gm.set(key,ticket);
    const p=port(ticket.channel,'parent',()=>gm.remove(key));gate._pendingPrivatePort=p;
    const initial=e=>{
      if(generation!==gate._generation)return;
      gate._onMessage({...e,ports:[p]});
      if(gate._initializeStatus==='done'){p.removeEventListener('message',initial);gm.remove(key);}
    };
    p.addEventListener('message',initial);
    gate.loaderFrame=frame;frame.name=type+product+'Loader#'+w.location.origin;
    frame.referrerPolicy='origin';frame.sandbox='allow-scripts allow-same-origin';
    frame.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;visibility:hidden;pointer-events:none';
    frame.src=gate._baseUrl+'#'+token;
    (w.document.body||w.document.documentElement).append(frame);gate._loaderWindow=frame.contentWindow;
    gate._frameObserver=new w.MutationObserver(()=>{if(generation===gate._generation&&!frame.isConnected)gate._disconnect(Error('Gate frame removed'));});
    gate._frameObserver.observe(frame.parentNode,{childList:true});
  }
  let posted=false,frameType=null,frameToken=null;
  function postGate(body,{type,token,sessionId=''}={}) {
    if(!framePort)throw Error('PRIVATE_FRAME_REQUIRED');
    frameType=type||frameType;frameToken=token||frameToken;
    const message={id:'ZenzaWatchExternalTrial',type:frameType,token:frameToken,sessionId,body};
    if(!posted){message.body={command:'initialized',params:body};posted=true;}
    framePort.postMessage(message);return framePort;
  }
  return {acceptFrame,connectGate,postGate,dispose,
    isEnabledOrigin:value=>!!frameTicket&&origin(value)===frameTicket.origin,
    // Tests use this constructor with isolated mock GM stores, not page globals.
    port};
}
module.exports={createPrivateTransport};

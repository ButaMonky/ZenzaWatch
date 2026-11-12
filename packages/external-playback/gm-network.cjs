'use strict';

function createGmNetwork(request) {
  let disposed=false;const active=new Set();
  function permitted(value) {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port||
      /^(?:account|point)\.nicovideo\.jp$/.test(u.hostname)||
      !['nicovideo.jp','nimg.jp','dmc.nico'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))
      throw Error('GM_DESTINATION_DENIED');
    return u.href;
  }
  async function gmFetch(resource, options={}) {
    if(disposed)throw new DOMException('Closed','AbortError');
    const isRequest=typeof Request!=='undefined' && resource instanceof Request;
    const url=permitted(isRequest?resource.url:String(resource));
    const method=options.method||(isRequest?resource.method:'GET');
    const signal=options.signal||(isRequest?resource.signal:undefined);
    const headers=Object.fromEntries(new Headers(options.headers||(isRequest?resource.headers:undefined)));
    for(const key of Object.keys(headers))if(/^(cookie|host|authorization|proxy-authorization)$/i.test(key))throw Error('GM_HEADER_DENIED');
    let data=options.body;
    if(data===undefined && isRequest && !/^(GET|HEAD)$/i.test(method))data=await resource.clone().arrayBuffer();
    return new Promise((resolve,reject)=>{
      let handle,done=false,timer;
      if(disposed){reject(new DOMException('Closed','AbortError'));return;}
      const finish=(error,value)=>{if(done)return;done=true;active.delete(abort);clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      const abort=()=>{finish(signal?.reason||new DOMException('Aborted','AbortError'));handle?.abort();};
      const timeout=()=>{finish(new DOMException('GM request timed out','TimeoutError'));handle?.abort();};
      if(signal?.aborted){abort();return;}
      active.add(abort);
      signal?.addEventListener('abort',abort,{once:true});
      const ms=options.timeout===0?0:(options.timeout||30000);
      if(ms>0)timer=setTimeout(timeout,ms);
      try {
        handle=request({url,method,headers,data,responseType:'arraybuffer',
          anonymous:options.credentials==='omit',redirect:'error',nocache:options.cache==='no-store',
          onload:r=>{
            if(done)return;
            try {
              permitted(r.finalUrl||url);
              if(r.status<200||r.status>599||r.status>=300&&r.status<400)throw Error('GM_INVALID_RESPONSE');
              const h=new Headers();
              for(const line of (r.responseHeaders||'').split(/\r?\n/)){
                const i=line.indexOf(':');if(i>0 && !/^set-cookie2?$/i.test(line.slice(0,i)))h.append(line.slice(0,i),line.slice(i+1).trim());
              }
              const res=new Response([204,205,304].includes(r.status)||method==='HEAD'?null:r.response,{status:r.status,statusText:r.statusText||'',headers:h});
              Object.defineProperty(res,'url',{value:r.finalUrl||url});finish(null,res);
            } catch(e){finish(e);}
          },onerror:()=>finish(Error('GM_NETWORK_ERROR')),ontimeout:timeout,
          onabort:()=>finish(new DOMException('Aborted','AbortError'))});
      } catch(e){finish(e);}
    });
  }
  class Loader {
    constructor(){this.context=null;this.controller=null;this.stats=this.newStats();}
    newStats(){return {aborted:false,loaded:0,total:0,retry:0,chunkCount:0,bwEstimate:0,loading:{start:0,first:0,end:0},parsing:{start:0,end:0},buffering:{start:0,first:0,end:0}};}
    load(context,config,callbacks){
      this.abort();this.context=context;this.callbacks=callbacks;
      const stats=this.stats;Object.assign(stats,this.newStats());
      const controller=this.controller=new AbortController();stats.loading.start=performance.now();
      // GM arraybuffer delivery is buffered. Use total elapsed time for a
      // conservative throughput estimate rather than reporting zero transfer time.
      stats.loading.first=stats.loading.start;
      const headers={...context.headers};if(Number.isFinite(context.rangeEnd)&&context.rangeEnd>(context.rangeStart||0))headers.Range=`bytes=${context.rangeStart||0}-${context.rangeEnd-1}`;
      const timeout=config.timeout||config.loadPolicy?.maxLoadTimeMs||30000;
      gmFetch(context.url,{headers,signal:controller.signal,timeout,credentials:'include'}).then(async response=>{
        if(this.controller!==controller||stats.aborted)return;
        if(!response.ok){this.controller=null;callbacks.onError({code:response.status,text:'HLS HTTP '+response.status},context,null,stats);return;}
        const bytes=await response.arrayBuffer();if(this.controller!==controller||stats.aborted)return;
        const now=performance.now();stats.loading.end=now;stats.loaded=stats.total=bytes.byteLength;stats.chunkCount=1;
        const data=context.responseType==='arraybuffer'?bytes:new TextDecoder().decode(bytes);
        this.controller=null;
        callbacks.onSuccess({url:response.url,data,code:response.status},stats,context,null);
      }).catch(error=>{
        if(this.controller!==controller||stats.aborted)return;
        this.controller=null;
        if(error.name==='TimeoutError')callbacks.onTimeout(stats,context,null);
        else callbacks.onError({code:0,text:'HLS GM transport failed'},context,null,stats);
      });
    }
    abort(){if(this.controller){const controller=this.controller;this.controller=null;this.stats.aborted=true;controller.abort();this.callbacks?.onAbort?.(this.stats,this.context,null);}}
    destroy(){this.abort();this.context=null;this.callbacks=null;}
    getCacheAge(){return null;}
    getResponseHeader(){return null;}
  }
  return {fetch:gmFetch,Loader,dispose(){if(disposed)return;disposed=true;for(const abort of [...active])abort();}};
}
module.exports={createGmNetwork};

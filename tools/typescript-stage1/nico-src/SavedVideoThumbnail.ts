/** Bounded, visible-only normal video thumbnails; never opens video sessions. */
export interface SavedVideoThumbnailOptions {
  load:(videoId:string)=>Promise<string|undefined>;
  maxConcurrent?:number;
  maxEntries?:number;
}
export interface SavedVideoThumbnailController {
  attach(host:HTMLElement,videoId:string,initialUrl?:string):()=>void;
  dispose():void;
}
const SavedVideoThumbnail = (() => {
  const safeUrl=(value:unknown):string|undefined=>{
    if(typeof value!=='string'||value.length>4096)return;
    try{const url=new URL(value);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{}
    return;
  };
  const create=({load,maxConcurrent=2,maxEntries=128}:SavedVideoThumbnailOptions):SavedVideoThumbnailController=>{
    const capacity=Number.isFinite(maxEntries)?Math.max(1,Math.min(512,Math.floor(maxEntries))):128;
    const concurrency=Number.isFinite(maxConcurrent)?Math.max(1,Math.min(4,Math.floor(maxConcurrent))):2;
    type Cache={url:string|undefined;expires:number};
    type Lease={host:HTMLElement;id:string;initial:string|undefined;visible:boolean;released:boolean;generation:number;failedUrl:string|undefined;job:Job|null;release:()=>void};
    type Job={id:string;listeners:Set<Lease>;started:boolean};
    const cache=new Map<string,Cache>(),jobs=new Map<string,Job>(),queue:Job[]=[],leases=new Map<HTMLElement,Lease>();
    let active=0,disposed=false,observer:IntersectionObserver|null=null;
    let fallbackDocument:Document|null=null,fallbackWindow:Window|null=null,fallbackQueued=false;
    const remember=(id:string,url:string|undefined)=>{
      cache.delete(id);cache.set(id,{url,expires:Date.now()+(url?86400000:60000)});
      while(cache.size>capacity)cache.delete(cache.keys().next().value!);
    };
    const cached=(id:string):Cache|undefined=>{
      const result=cache.get(id);if(!result)return;
      cache.delete(id);if(result.expires<=Date.now())return;
      cache.set(id,result);return result;
    };
    const state=(lease:Lease,loading:boolean,text='画像なし')=>{
      lease.host.classList.toggle('zw-scene-loading',loading);
      lease.host.setAttribute('aria-busy',String(loading));
      lease.host.setAttribute('aria-label',loading?'動画サムネイルを読み込み中':text);
      lease.host.textContent=loading?'読み込み中':text;
    };
    const detach=(lease:Lease)=>{
      const job=lease.job;lease.job=null;if(!job)return;
      job.listeners.delete(lease);
      if(!job.started&&!job.listeners.size){jobs.delete(job.id);const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);}
    };
    const current=(lease:Lease,generation:number)=>!disposed&&!lease.released&&lease.visible&&lease.generation===generation;
    const show=(lease:Lease,url:string,refreshOnError:boolean)=>{
      const generation=lease.generation;state(lease,true);
      const image=lease.host.ownerDocument.createElement('img');image.alt='';image.decoding='async';image.referrerPolicy='no-referrer';
      image.className='zw-library-thumbnail-image';image.style.cssText='width:100%;height:100%;object-fit:cover;';
      image.onload=()=>{if(!current(lease,generation))return;
        lease.host.classList.remove('zw-scene-loading');lease.host.setAttribute('aria-busy','false');lease.host.setAttribute('aria-label','動画サムネイル');remember(lease.id,url);};
      image.onerror=()=>{if(!current(lease,generation))return;
        lease.failedUrl=url;
        if(refreshOnError)request(lease,true);
        else{remember(lease.id,undefined);state(lease,false);}
      };
      lease.host.replaceChildren(image);image.src=url;
    };
    const pump=()=>{
      while(!disposed&&active<concurrency&&queue.length){
        const job=queue.shift()!;if(!job.listeners.size){jobs.delete(job.id);continue;}
        job.started=true;active++;
        void Promise.resolve().then(()=>load(job.id)).then(safeUrl,()=>undefined).then(url=>{
          if(disposed)return;
          remember(job.id,url&&(!job.listeners.size||[...job.listeners].some(lease=>lease.failedUrl!==url))?url:undefined);
          for(const lease of job.listeners){
            if(lease.job!==job||!current(lease,lease.generation))continue;
            lease.job=null;
            // An unchanged broken URL is a terminal result, not a retry loop.
            if(url&&url!==lease.failedUrl)show(lease,url,false);else state(lease,false);
          }
        }).finally(()=>{active--;if(jobs.get(job.id)===job)jobs.delete(job.id);job.listeners.clear();pump();});
      }
    };
    const request=(lease:Lease,force=false)=>{
      lease.generation++;detach(lease);state(lease,true);
      const hit=cached(lease.id);
      if(hit&&(!force||!hit.url)){
        if(hit.url&&hit.url!==lease.failedUrl)show(lease,hit.url,true);else state(lease,false);
        return;
      }
      let job=jobs.get(lease.id);
      if(!job){
        if(jobs.size>=capacity){state(lease,false);return;}
        job={id:lease.id,listeners:new Set(),started:false};jobs.set(lease.id,job);queue.push(job);
      }
      job.listeners.add(lease);lease.job=job;pump();
    };
    const setVisible=(lease:Lease,visible:boolean)=>{
      if(disposed||lease.released||lease.visible===visible)return;
      lease.visible=visible;lease.generation++;detach(lease);
      if(!visible){state(lease,false,'動画サムネイル');return;}
      if(!/^(?:sm|nm|so|ss)?\d{1,16}$/i.test(lease.id)){state(lease,false);return;}
      const hit=cached(lease.id);
      if(hit){if(hit.url&&hit.url!==lease.failedUrl)show(lease,hit.url,true);else state(lease,false);}
      else if(lease.initial&&lease.initial!==lease.failedUrl)show(lease,lease.initial,true);
      else request(lease);
    };
    const checkFallback=()=>{
      fallbackQueued=false;if(disposed)return;
      for(const lease of leases.values()){
        const rect=lease.host.getBoundingClientRect(),dock=lease.host.closest('.zenzaManualBookmarkDock')?.getBoundingClientRect(),win=lease.host.ownerDocument.defaultView;
        const top=Math.max(0,dock?.top||0),left=Math.max(0,dock?.left||0);
        const bottom=Math.min(win?.innerHeight||0,dock?.bottom??Infinity),right=Math.min(win?.innerWidth||0,dock?.right??Infinity);
        setVisible(lease,lease.host.isConnected&&rect.width>0&&rect.height>0&&rect.bottom>top&&rect.top<bottom&&rect.right>left&&rect.left<right);
      }
    };
    const scheduleFallback=()=>{if(disposed||fallbackQueued)return;fallbackQueued=true;queueMicrotask(checkFallback);};
    const attach=(host:HTMLElement,videoId:string,initialUrl?:string):()=>void=>{
      if(disposed)return ()=>{};
      leases.get(host)?.release();
      const lease:Lease={host,id:videoId,initial:safeUrl(initialUrl),visible:false,released:false,generation:0,failedUrl:undefined,job:null,release:()=>{}};
      lease.release=()=>{if(lease.released)return;lease.released=true;lease.generation++;detach(lease);observer?.unobserve(host);leases.delete(host);
        host.classList.remove('zw-scene-loading');host.setAttribute('aria-busy','false');host.replaceChildren();};
      leases.set(host,lease);host.setAttribute('role','img');state(lease,false,'動画サムネイル');
      const Observer=host.ownerDocument.defaultView?.IntersectionObserver;
      if(Observer){
        if(!observer)observer=new Observer(entries=>{for(const entry of entries){const item=leases.get(entry.target as HTMLElement);if(item)setVisible(item,entry.isIntersecting);}},
          {root:host.closest('.zenzaManualBookmarkDock'),rootMargin:'0px'});
        observer.observe(host);
      }else{
        // Old engines: only acquire measurable viewport entries, never all history.
        if(!fallbackDocument){fallbackDocument=host.ownerDocument;fallbackWindow=fallbackDocument.defaultView;
          fallbackDocument.addEventListener('scroll',scheduleFallback,{capture:true,passive:true});fallbackWindow?.addEventListener('resize',scheduleFallback,{passive:true});}
        scheduleFallback();
      }
      return lease.release;
    };
    const dispose=()=>{if(disposed)return;disposed=true;observer?.disconnect();observer=null;
      fallbackDocument?.removeEventListener('scroll',scheduleFallback,true);fallbackWindow?.removeEventListener('resize',scheduleFallback);
      for(const lease of [...leases.values()])lease.release();queue.length=0;jobs.clear();cache.clear();};
    return {attach,dispose};
  };
  return {create};
})();
export {SavedVideoThumbnail};

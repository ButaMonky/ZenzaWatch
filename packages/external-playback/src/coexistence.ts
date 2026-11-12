/** Suspend the companion when an older external trial is active in this page. */
export function watchLegacyTrial(w:Window & typeof globalThis,stop:()=>void):()=>void {
 let stopped=false;
 const check=()=>{
  if(stopped||!w.document.querySelector('[data-zenza-external-overlay]:not([data-zenza-companion]),[data-zenza-external-inline]:not([data-zenza-companion])'))return;
  stopped=true;stop();observer.disconnect();

 };
 const observer=new w.MutationObserver(check);observer.observe(w.document.documentElement,{childList:true,subtree:true});check();
 return ()=>observer.disconnect();
}

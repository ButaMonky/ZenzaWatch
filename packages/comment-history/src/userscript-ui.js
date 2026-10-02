// Diagnostic wrapper only. It intentionally does not inspect or alter the Zenza player.
let activeProbe=null;
let lastProbeReport=null;
function pageVideoId(){
  if(location.origin!=='https://www.nicovideo.jp')throw new HistoryError('WATCH_SCHEMA');
  const match=location.pathname.match(/^\/watch\/((?:(?:sm|so|nm))?\d+)\/?$/);
  if(!match)throw new HistoryError('WATCH_SCHEMA');return match[1];
}
function stopProbe(){activeProbe?.controller.abort();}
async function startProbe(){
  if(activeProbe){alert('コメント取得の診断が実行中です。中止メニューで止められます。');return;}
  const run={controller:new AbortController(),path:location.pathname};activeProbe=run;lastProbeReport=null;
  const changed=setInterval(()=>{if(location.pathname!==run.path)run.controller.abort();},200);
  const deadline=setTimeout(()=>run.controller.abort(),60000);
  let id;
  try{
    id=pageVideoId();
    console.info('[NCH] 診断開始。再生・描画・投稿は変更しません。');
    const context=await withDeadline(async signal=>{
      // Fresh key stays in this closure. No HAR credentials or pasted tokens are used.
      const res=await fetch(`https://www.nicovideo.jp/watch/${encodeURIComponent(id)}?responseType=json`,
        {credentials:'include',cache:'no-store',redirect:'error',signal});
      if(!res.ok)throw new HistoryError('HTTP_ERROR',{httpStatus:res.status});
      const raw=await res.json();assertNotCancelled(signal);return normalizeWatch(raw,id);
    },{signal:run.controller.signal,timeoutMs:10000});
    if(pageVideoId()!==id)throw new HistoryError('VIDEO_MISMATCH');
    const result=await probeCompatibility(context,{signal:run.controller.signal,
      onProgress:({stage,requestNumber,maxRequests})=>console.info(`[NCH] ${requestNumber}/${maxRequests}: ${stage}`)});
    if(activeProbe!==run)return;
    if(location.pathname!==run.path){result.reason='cancelled_video_change';}
    lastProbeReport=result;
    console.info('[NCH] 診断終了:',result.reason);
    if(location.pathname===run.path)alert(`コメント取得の診断終了: ${result.reason}\nメニュー「3. 診断JSONを保存」で結果を保存してください。\nこの版はコメントの表示量を変更しません。`);
  }catch(e){
    if(activeProbe===run){lastProbeReport={schema:'nico-comment-history-probe/1',version:'0.1.0',
      videoId:id??null,reason:'metadata_or_setup_error',error:safeError(e),steps:[],completeCoverageVerified:false};
      if(location.pathname===run.path)alert(`コメント取得の診断を停止しました: ${lastProbeReport.error.code}\n診断JSONを保存してお送りください。`);}
  }finally{clearInterval(changed);clearTimeout(deadline);if(activeProbe===run)activeProbe=null;}
}
function saveProbeReport(){
  if(!lastProbeReport){alert('まだ診断結果がありません。診断終了後に保存してください。');return;}
  const blob=new Blob([JSON.stringify(lastProbeReport,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`nico-comment-history-probe-v0.1.0-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  (document.body??document.documentElement).append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
window.addEventListener('pagehide',stopProbe);
if(typeof GM_registerMenuCommand==='function'){
  GM_registerMenuCommand('1. コメント取得を診断（最大5回）',startProbe);
  GM_registerMenuCommand('2. 診断を中止',stopProbe);
  GM_registerMenuCommand('3. 診断JSONを保存',saveProbeReport);
}

// Manual verification wrapper only. Zenza right-bottom/advanced views are a later adapter task.
// This wrapper never draws comments, changes playback, injects HTML or submits comments.
let activeHistoryRun=null;
let lastHistorySession=null;
let lastHistorySetupReport=null;
const HISTORY_SETTINGS_KEY='nico-comment-history.settings';
function standaloneSettings(){
  if(typeof GM_getValue!=='function'||typeof GM_setValue!=='function')throw new HistoryError('OPTION');
  return new SettingsStore({read:()=>GM_getValue(HISTORY_SETTINGS_KEY,null),write:value=>GM_setValue(HISTORY_SETTINGS_KEY,value)});
}
function standaloneVideoId(){
  if(location.origin!=='https://www.nicovideo.jp')throw new HistoryError('WATCH_SCHEMA');
  const match=location.pathname.match(/^\/watch\/((?:(?:sm|so|nm))?\d+)\/?$/);
  if(!match)throw new HistoryError('WATCH_SCHEMA');return match[1];
}
function ensureHistoryPage(run){
  assertNotCancelled(run.controller.signal);
  if(standaloneVideoId()!==run.videoId)throw new HistoryError('VIDEO_MISMATCH');
}
function stopStandaloneHistory(){activeHistoryRun?.controller.abort();}
async function startStandaloneHistory(){
  if(activeHistoryRun){alert('独立取得を実行中です。中止メニューで止められます。');return;}
  const run={controller:new AbortController(),path:location.pathname};activeHistoryRun=run;
  lastHistorySession=null;lastHistorySetupReport=null;
  const changed=setInterval(()=>{if(location.pathname!==run.path)run.controller.abort();},200);
  const checkPage=()=>{if(location.pathname!==run.path)run.controller.abort();};
  window.addEventListener('popstate',checkPage);
  let coordinator,lockStatus='unavailable';
  try{
    run.videoId=standaloneVideoId();const settings=standaloneSettings().get();
    coordinator=new RequestCoordinator({settings});
    const collect=async()=>{
      ensureHistoryPage(run);
      const context=await coordinator.execute(o=>requestWatchContext(run.videoId,o),{signal:run.controller.signal,kind:'metadata'});
      ensureHistoryPage(run);
      const guardedPage=async(c,o)=>{ensureHistoryPage(run);const data=await requestThreads(c,o);ensureHistoryPage(run);return data;};
      const guardedKey=async(c,o)=>{ensureHistoryPage(run);const next=await requestThreadKey(c,o);ensureHistoryPage(run);return next;};
      const session=new HistorySession(context,{settings,coordinator,fetchPage:guardedPage,refreshKey:guardedKey});
      lastHistorySession=session;
      const result=await session.run({signal:run.controller.signal,onProgress:e=>{
        if(e.event==='retry')console.info(`[NCH] ${e.error.code}: ${e.waitMs}ms待機、再試行${e.retryNumber}`);
        else console.info(`[NCH] 履歴${e.pages}ページ / 追加${e.counts.additionalCount}件 / 通信${e.network.attempts}回`);
      }});
      if(location.pathname===run.path)alert(`独立取得終了: ${result.reason}\n通常 ${result.counts.normalCount}件 / 追加 ${result.counts.additionalCount}件\n「3. 診断JSONを保存」で結果を保存できます。\nこの版は画面のコメントを増やしません。`);
    };
    if(typeof navigator!=='undefined'&&navigator.locks?.request){
      lockStatus='web-lock';
      await navigator.locks.request('nico-comment-history-standalone',{mode:'exclusive',ifAvailable:true},async lock=>{
        if(!lock){lockStatus='busy';lastHistorySetupReport={reason:'another_tab_busy'};alert('別タブで独立取得が実行中です。新しい通信は開始していません。');return;}
        await collect();
      });
    }else await collect();
  }catch(e){
    lastHistorySetupReport={schema:'nico-comment-history-session/1',version:'0.2.0',videoId:run.videoId??null,
      reason:'metadata_or_setup_error',error:safeError(e),network:coordinator?.stats()??null,completeCoverageVerified:false};
    if(location.pathname===run.path)alert(`独立取得を停止しました: ${lastHistorySetupReport.error.code}\n診断JSONを保存できます。`);
  }finally{
    run.lockStatus=lockStatus;
    if(lastHistorySetupReport||lastHistorySession)lastHistorySetupReport={...lastHistorySetupReport,crossTabCoordination:lockStatus};
    clearInterval(changed);window.removeEventListener('popstate',checkPage);
    if(activeHistoryRun===run)activeHistoryRun=null;
  }
}
function saveStandaloneReport(){
  const report=lastHistorySession?{...lastHistorySession.report(),...lastHistorySetupReport}:lastHistorySetupReport;
  if(!report){alert('まだ取得結果がありません。取得後に保存してください。');return;}
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
  a.download=`nico-comment-history-session-v0.2.0-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  (document.body??document.documentElement).append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function editStandaloneSettings(){
  if(activeHistoryRun){alert('設定は取得の終了後に変更してください。');return;}
  try{
    const store=standaloneSettings(),current=store.get();
    const text=prompt('独立取得設定（JSON）。描画やZenzaの設定は変わりません。通信間隔は1500ms以上です。',JSON.stringify(current,null,2));
    if(text===null)return;
    const changes=JSON.parse(text);store.patch(changes);alert('取得設定を保存しました。次回の手動取得から適用します。');
  }catch(e){alert(`設定は保存していません: ${e instanceof SyntaxError?'INVALID_JSON':safeError(e).code}`);}
}
function discardStandaloneHistory(){
  stopStandaloneHistory();lastHistorySession?.removeHistory();
  alert('独立取得の増量分を破棄しました。保持している通常分とZenzaの表示は変更していません。');
}
window.addEventListener('pagehide',()=>{stopStandaloneHistory();lastHistorySession?.removeHistory();});
if(typeof GM_registerMenuCommand==='function'){
  GM_registerMenuCommand('1. 独立取得を開始（表示変更なし）',startStandaloneHistory);
  GM_registerMenuCommand('2. 取得を中止',stopStandaloneHistory);
  GM_registerMenuCommand('3. 診断JSONを保存',saveStandaloneReport);
  GM_registerMenuCommand('4. 取得設定（JSON）',editStandaloneSettings);
  GM_registerMenuCommand('5. 増量分を破棄（通常分を保持）',discardStandaloneHistory);
}

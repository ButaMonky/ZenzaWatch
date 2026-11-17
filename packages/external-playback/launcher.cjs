'use strict';

function parseDirectLink(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.port ||
        !['www.nicovideo.jp', 'sp.nicovideo.jp'].includes(u.hostname)) return null;
    return /^\/watch\/((?:sm|nm|so)\d+|\d+)\/?$/.exec(u.pathname)?.[1] || null;
  } catch (_) { return null; }
}

async function verifyLogin(api, diag=()=>{}) {
  let response, body;
  const started=Date.now();
  try {
    response = await api.fetch('https://nvapi.nicovideo.jp/v1/users/me/mylists', {
      credentials: 'include', cache: 'no-store', timeout: 15000,
      headers: {'X-Frontend-Id': '6', 'X-Frontend-Version': '0'}
    });
    diag('auth-response',{status:response.status,ms:Date.now()-started});
    if (response.status === 401) throw new Error('LOGIN_REQUIRED');
    if (response.status === 403) throw new Error('AUTH_FORBIDDEN');
    if (response.status !== 200) throw new Error('AUTH_CHECK_FAILED');
    body = await response.json();
  } catch (error) {
    diag('auth-error',{message:String(error?.message||error),name:error?.name||null,ms:Date.now()-started});
    const known=['LOGIN_REQUIRED','AUTH_FORBIDDEN','GM_NETWORK_ERROR','GM_DESTINATION_DENIED'];
    throw new Error(known.includes(error?.message) ? error.message : error?.name==='TimeoutError'?'AUTH_TIMEOUT':'AUTH_CHECK_FAILED');
  }
  if (body?.meta?.status !== 200 || !Array.isArray(body?.data?.mylists))
    throw new Error('AUTH_CHECK_FAILED');
  // Deliberately return neither account details nor private list names.
}

function createRuntimeSession({startRuntime, enable, hasExistingRuntime, diag=()=>{}}) {
  const t0=Date.now();
  let runtime, loading, initializing, ready=false,closed=false;
  const ensureOpen=()=>{if(closed)throw Error('PLAYER_CLOSED');};
  let listener=()=>{},stage='BOOT';
  const progress=value=>{stage=value;diag('stage',{stage:value,ms:Date.now()-t0});listener(value);};
  return {
    reportStage:progress,
    configure(value) {runtime=value;},
    close() {closed=true;if(ready){runtime?.close?.();return true;}return false;},
    setStageListener(value) {listener=value;},
    diagnostics() {return runtime?.diagnostics?.()||{runtimeReady:false};},
    async open(id,event) {
      try {
      diag('session-open',{id,loading:!!loading,ready,runtime:!!runtime});
      ensureOpen();await enable(event);ensureOpen();
      progress('BOOT');
      if(!loading) {
        if(hasExistingRuntime()){diag('existing-runtime',{zenza:typeof window!=='undefined'&&!!window.ZenzaWatch});throw Error('EXISTING_RUNTIME');}
        // A failed bootstrap is not rerun over a partially initialized runtime.
        loading=Promise.resolve().then(startRuntime);
      }
      await loading;ensureOpen();
      if(!runtime)throw Error('RUNTIME_NOT_READY');
      progress('SETTINGS');await runtime.connect();ensureOpen();
      progress('AUTH');await verifyLogin(runtime.api,diag);ensureOpen();
      runtime.setLogin();
      if(!ready) {
        progress('UI');
        initializing=initializing||Promise.resolve().then(runtime.initialize);
        await initializing;ensureOpen();ready=true;
      }
      progress('VIDEO');await runtime.open(id);ensureOpen();progress('OPEN');
      } catch(error) {
        try{
          const name=['TypeError','ReferenceError','RangeError'].includes(error?.name)?error.name:null;
          const m=/of '([^']{1,80})' as it is|reading '([^']{1,80})'|^([A-Za-z_$][\w$.]{0,79}) is not defined/.exec(String(error?.message||''));
          runtime?.journal?.(stage,String(error?.message||'PLAYER_START_FAILED').slice(0,60),name,m?(m[1]||m[2]||m[3]):null);
        }catch(_){}
        diag('session-failed',{stage,message:String(error?.message||error),name:error?.name||null,
          stack:typeof error?.stack==='string'?error.stack.split('\n').slice(0,8).join(' | '):null});
        throw Object.assign(error instanceof Error?error:Error('PLAYER_START_FAILED'),{stage});
      }
    }
  };
}

function installInteractionGuard(w, root=w.document.querySelector('.zenzaPlayerContainer')) {
  let trustedEvent;
  const input=e=>{
    const inPlayer=root && e.composedPath().includes(root);
    const shortcut=/^key/.test(e.type) && (e.target===w.document.body||e.target===w.document);
    if(!inPlayer && !shortcut)return;
    if(e.isTrusted){trustedEvent=e;return;}
    e.preventDefault();e.stopImmediatePropagation();
  };
  const command=e=>{
    if(trustedEvent?.isTrusted && trustedEvent.eventPhase!==0)return;
    if(/^(?:toggle-like|(?:mylist|deflist)(?:Add|Remove)|postComment)$/.test(e.detail?.command||'')){
      e.preventDefault();e.stopImmediatePropagation();
    }
  };
  const types=['click','dblclick','contextmenu','pointerdown','pointerup','mousedown','mouseup','keydown','keyup','keypress','submit'];
  types.forEach(type=>w.addEventListener(type,input,true));w.addEventListener('command',command,true);
  return ()=>{types.forEach(type=>w.removeEventListener(type,input,true));w.removeEventListener('command',command,true);};
}

module.exports={parseDirectLink,verifyLogin,createRuntimeSession,installInteractionGuard};
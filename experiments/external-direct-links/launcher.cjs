'use strict';

function parseDirectLink(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.port ||
        !['www.nicovideo.jp', 'sp.nicovideo.jp'].includes(u.hostname)) return null;
    return /^\/watch\/((?:sm|nm|so)\d+|\d+)\/?$/.exec(u.pathname)?.[1] || null;
  } catch (_) { return null; }
}

async function verifyLogin(api) {
  let response, body;
  try {
    response = await api.fetch('https://nvapi.nicovideo.jp/v1/users/me/mylists', {
      credentials: 'include', cache: 'no-store', timeout: 15000,
      headers: {'X-Frontend-Id': '6', 'X-Frontend-Version': '0'}
    });
    if (response.status === 401) throw new Error('LOGIN_REQUIRED');
    if (response.status === 403) throw new Error('AUTH_FORBIDDEN');
    if (response.status !== 200) throw new Error('AUTH_CHECK_FAILED');
    body = await response.json();
  } catch (error) {
    const known=['LOGIN_REQUIRED','AUTH_FORBIDDEN','GM_NETWORK_ERROR','GM_DESTINATION_DENIED'];
    throw new Error(known.includes(error?.message) ? error.message : error?.name==='TimeoutError'?'AUTH_TIMEOUT':'AUTH_CHECK_FAILED');
  }
  if (body?.meta?.status !== 200 || !Array.isArray(body?.data?.mylists))
    throw new Error('AUTH_CHECK_FAILED');
  // Deliberately return neither account details nor private list names.
}

function createRuntimeSession({startRuntime, enable, hasExistingRuntime}) {
  let runtime, loading, initializing, ready=false;
  let listener=()=>{},stage='BOOT';
  const progress=value=>{stage=value;listener(value);};
  return {
    configure(value) {runtime=value;},
    setStageListener(value) {listener=value;},
    diagnostics() {return runtime?.diagnostics?.()||{runtimeReady:false};},
    async open(id,event) {
      try {
      await enable(event);
      progress('BOOT');
      if(!loading) {
        if(hasExistingRuntime())throw Error('EXISTING_RUNTIME');
        // A failed bootstrap is not rerun over a partially initialized runtime.
        loading=Promise.resolve().then(startRuntime);
      }
      await loading;
      if(!runtime)throw Error('RUNTIME_NOT_READY');
      progress('SETTINGS');await runtime.connect();
      progress('AUTH');await verifyLogin(runtime.api);
      runtime.setLogin();
      if(!ready) {
        progress('UI');
        initializing=initializing||Promise.resolve().then(runtime.initialize);
        await initializing;ready=true;
      }
      progress('VIDEO');await runtime.open(id);progress('OPEN');
      } catch(error) {throw Object.assign(error instanceof Error?error:Error('PLAYER_START_FAILED'),{stage});}
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

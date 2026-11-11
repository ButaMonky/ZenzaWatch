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

function mountLauncher(w, {open}) {
  const d = w.document, entries = new Map(), queued = new Set();
  let timer = null, disposed = false, opening = false, status = null;
  const buttonStyle = 'all:initial;display:inline-block;box-sizing:border-box;font:600 12px/22px sans-serif;color:#e8f5f4;background:#243c47;border:1px solid #7acabc;border-radius:4px;padding:0 6px;margin:0 4px;cursor:pointer;vertical-align:middle;';
  function message(text, failed = false) {
    if (!status) {
      status = d.createElement('div');status.setAttribute('role','status');
      status.style.cssText = 'position:fixed;right:16px;bottom:24px;z-index:2147483647;max-width:360px;padding:16px;background:#17212d;color:#e8f5f4;border:1px solid #7acabc;border-radius:8px;font:14px/1.6 sans-serif;';
      d.body.append(status);
    }
    status.replaceChildren(d.createTextNode(text));
    if (failed) {
      const p=d.createElement('div'), login=d.createElement('a'), close=d.createElement('button');
      login.href='https://account.nicovideo.jp/login';login.target='_blank';login.rel='noopener noreferrer';
      login.textContent='ニコニコ公式でログイン';login.style.color='#8ce0d0';
      close.textContent='閉じる';close.style.cssText=buttonStyle;
      close.onclick=()=>{status.remove();status=null;};
      p.append(login,close);status.append(p);
    }
  }
  function refresh(a) {
    const id=a.isConnected && !a.closest('[contenteditable="true"],.zenzaPlayerContainer') &&
      parseDirectLink(a.getAttribute('href'),d.baseURI);
    const old=entries.get(a);
    if (!id) {if(old){old.remove();entries.delete(a);}return;}
    if (old?.isConnected) return;
    const button=d.createElement('button');button.type='button';button.textContent='Zen';
    button.setAttribute('data-zenza-direct-button','');button.title='このページ上でZenzaWatchを開く';
    button.setAttribute('aria-label','この動画をZenzaWatchで開く');button.style.cssText=buttonStyle;
    button.addEventListener('click',async e=>{
      e.preventDefault();e.stopPropagation();
      const current=parseDirectLink(a.getAttribute('href'),d.baseURI);
      if (!current || opening || !a.isConnected) return;
      opening=true;button.disabled=true;message('ログイン状態を確認して起動しています…');
      try {await open(current,e);status?.remove();status=null;}
      catch(error) {
        const text=error?.message==='EXISTING_RUNTIME' ? 'このページでは通常版のZenzaWatchが動いています。検証版の二重起動を止めました。' :
          error?.message==='LOGIN_REQUIRED' ? '検証版7：Tampermonkey経由の認証確認が401を返しました。公式でログイン済みの場合は、この表示を報告してください。' :
          error?.message==='AUTH_FORBIDDEN' ? '検証版7：Tampermonkey経由の認証確認が403（アクセス拒否）を返しました。未ログインとは限りません。この表示を報告してください。' :
          error?.message==='GM_NETWORK_ERROR' ? '検証版7：Tampermonkey経由の通信に失敗しました。Tampermonkeyに接続先の許可が出ていないか確認してください。' :
          error?.message==='AUTH_TIMEOUT' ? '検証版7：Tampermonkey経由の認証確認が時間切れになりました。' :
          '検証版7：起動または認証確認に失敗しました。サイト別Cookieの許可は変更せず、この表示とConsoleのエラーを報告してください。';
        const stage={BOOT:'本体の準備',SETTINGS:'設定の接続',AUTH:'認証確認',UI:'画面の準備',VIDEO:'動画を開く処理'}[error?.stage];
        message(text+(stage?' 停止した段階：'+stage+'。':''),true);
      } finally {opening=false;button.disabled=false;}
    });
    a.insertAdjacentElement('afterend',button);entries.set(a,button);
  }
  function flush() {
    timer=null;if(disposed)return;
    let count=0;
    for(const a of queued){queued.delete(a);refresh(a);if(++count>=80)break;}
    for(const [a,b] of entries)if(!a.isConnected){b.remove();entries.delete(a);}
    if(queued.size)timer=w.setTimeout(flush,0);
  }
  function queue(node) {
    if(node.nodeType!==1)return;
    if(node.matches('a[href]'))queued.add(node);
    for(const a of node.querySelectorAll('a[href]'))queued.add(a);
    if(timer===null)timer=w.setTimeout(flush,0);
  }
  const observer=new w.MutationObserver(records=>{
    for(const r of records){
      if(r.type==='attributes') {queued.add(r.target);if(timer===null)timer=w.setTimeout(flush,0);}
      else {for(const n of r.addedNodes)queue(n);if(r.removedNodes.length&&timer===null)timer=w.setTimeout(flush,0);}
    }
  });
  observer.observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});queue(d.body);
  return {dispose(){disposed=true;observer.disconnect();if(timer!==null)w.clearTimeout(timer);for(const b of entries.values())b.remove();entries.clear();queued.clear();status?.remove();}};
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

module.exports={parseDirectLink,verifyLogin,mountLauncher,createRuntimeSession,installInteractionGuard};

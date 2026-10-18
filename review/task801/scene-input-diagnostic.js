// Console-only diagnostic. No network, storage, settings or playback changes.
// Waits up to 2 minutes for a visible preview, then observes it for 30 seconds.
(() => {
  const key = '__zenzaSceneInputProbe';
  window[key]?.stop?.();
  const roots = new Map(), timers = new Set();
  const selector = '.zenzaSceneSearchHost,.seekBarToolTip';
  const actions = '[data-scui-action="more"],[data-scui-action="seek-back"],[data-scui-action="seek-forward"],.backwardSeek,.forwardSeek';
  const inspect = typeof getEventListeners === 'function' ? getEventListeners : null;
  let count = 0, presses = 0, appeared = false, stopped = false, interval, deadline;
  const name = node => node?.nodeType === 1 ?
    node.tagName.toLowerCase() + '.' + String(node.className || '').slice(0,120) : null;
  const log = (kind, data) => console.log('[SCUI診断] ' + JSON.stringify({kind, ...data}));
  const visible = root => {const r=root.getBoundingClientRect();return r.width>0&&r.height>0;};
  const pointerRules = () => {
    const result=[];
    const visit=rules=>{for(const rule of rules){
      if(rule.selectorText&&rule.style?.getPropertyValue('pointer-events'))result.push(rule);
      if(rule.cssRules)visit(rule.cssRules);
    }};
    for(const sheet of document.styleSheets)if(!sheet.disabled){try{visit(sheet.cssRules);}catch(_){}}
    return result;
  };
  const ancestry = button => {
    const rules=pointerRules(),rows=[];
    for(let node=button;node&&rows.length<10;node=node.parentElement){
      rows.push({node:name(node),pointerEvents:getComputedStyle(node).pointerEvents,
        inline:node.style.getPropertyValue('pointer-events'),
        rules:rules.filter(rule=>{try{return node.matches(rule.selectorText);}catch(_){return false;}})
          .map(rule=>({selector:rule.selectorText,value:rule.style.getPropertyValue('pointer-events'),
            priority:rule.style.getPropertyPriority('pointer-events')})).slice(-12)});
      if(node===document.body)break;
    }
    return rows;
  };
  const snapshot = () => [...document.querySelectorAll(selector)].map(root => ({
    root: name(root), layout: root.dataset.layout || 'legacy',
    expanded: root.classList.contains('is-expanded'),
    clickListeners: inspect ? (inspect(root).click || []).filter(item=>item.listener!==roots.get(root)).length : null,
    buttons: [...root.querySelectorAll(actions)].map(button => {
      const r = button.getBoundingClientRect(), css = getComputedStyle(button);
      const hit = r.width && r.height ? document.elementFromPoint(r.left+r.width/2,r.top+r.height/2) : null;
      return {action: button.dataset.scuiAction || button.dataset.command,
        disabled: !!button.disabled, hidden: button.hidden,
        display: css.display, visibility: css.visibility, pointerEvents: css.pointerEvents,
        expanded: button.getAttribute('aria-expanded'), width:r.width,height:r.height,
        centerHit: name(hit), receivesCenter: !!hit && button.contains(hit)};
    })
  }));
  const record = (phase, event) => {
    if(phase==='document-capture'&&event.type==='pointerdown')presses++;
    const owned = event.target?.closest?.(selector);
    const root = owned || (event.type!=='keydown'&&[...document.querySelectorAll(selector)].find(node=>{
      const r=node.getBoundingClientRect();return visible(node)&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;
    }));
    if(stopped || !root || count >= 30) return;
    if(event.type === 'keydown' && !['Enter',' ','Tab'].includes(event.key)) return;
    count++;
    log('event', {phase, type:event.type, target:name(event.target),
      action:event.target.closest?.('[data-scui-action],[data-command]')?.dataset.scuiAction ||
        event.target.closest?.('[data-command]')?.dataset.command || null,
      key:event.type==='keydown'?event.key:undefined, trusted:event.isTrusted,
      prevented:event.defaultPrevented, reachedPreview:!!owned, expanded:root.classList.contains('is-expanded')});
    if(phase==='document-capture' && event.type==='click') {
      const timer=setTimeout(()=>{timers.delete(timer);if(!stopped)log('after-click',{roots:snapshot()});},50);
      timers.add(timer);
    }
  };
  const capture = event => record('document-capture',event);
  const scan = () => {
    for(const root of document.querySelectorAll(selector)) if(!roots.has(root)) {
      const handler=event=>record('root-bubble',event);
      root.addEventListener('click',handler,{passive:true});roots.set(root,handler);
    }
    if(!appeared&&[...roots.keys()].some(visible)){
      appeared=true;clearTimeout(deadline);deadline=setTimeout(stop,30000);
      const button=[...document.querySelectorAll(actions)].find(visible);
      log('visible',{roots:snapshot(),pointerAncestry:button?ancestry(button):[]});
    }
  };
  const stop = () => {
    if(stopped)return;
    log('finished',{events:count,documentPresses:presses,previewAppeared:appeared,roots:snapshot()});stopped=true;
    clearInterval(interval);clearTimeout(deadline);
    for(const timer of timers)clearTimeout(timer);
    for(const type of ['pointerdown','click','keydown'])document.removeEventListener(type,capture,true);
    for(const [root,handler] of roots)root.removeEventListener('click',handler);
    roots.clear();if(window[key]?.stop===stop)delete window[key];
  };
  log('start',{revision:2,topDocument:window===window.top,roots:snapshot()});
  for(const type of ['pointerdown','click','keydown'])document.addEventListener(type,capture,{capture:true,passive:true});
  deadline=setTimeout(stop,120000);scan();interval=setInterval(scan,250);
  window[key]={stop};
  console.log('[SCUI診断] F12でConsoleを閉じ、シークバーにマウスを合わせてプレビューを表示し、「…」と前後ボタンを押してください。表示を検出してから30秒後に自動終了します（表示待ちは最大2分）。');
})();

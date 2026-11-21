'use strict';
// The companion decorates links for playback. The main userscript owns video attachment on X.
module.exports = function mountCompanionButtons(win, modules, settings, open, check) {
  function mount(ignoreLink) {
    const overlay = modules.overlay.mountOverlay(win, settings, open, check);
    const inline = modules.inline.mountInlineButtons(win, settings, open, check, ignoreLink);
    return {dispose() { overlay.dispose(); inline.dispose(); }};
  }
  if (!settings.enabled || !/^(?:(?:www|mobile)\.)?(?:x|twitter)\.com$/i.test(win.location.hostname)) return mount();

  const dialog = '[role="dialog"],dialog[open]';
  const composeRoute = /^\/(?:intent|compose)\/(?:tweet|post)\/?$/;
  const doc = win.document;
  let buttons, href, dialogs = [];
  function isComposer(element) {
    return element && (element.querySelector('[data-testid^="tweetTextarea_"],[data-testid="tweetButton"]') ||
      (element.querySelector('[contenteditable="true"][role="textbox"]') && element.querySelector('input[type="file"][accept*="video"]')));
  }
  function visible(element) {
    if (element.closest('[hidden],[inert],[aria-hidden="true"],dialog:not([open])')) return false;
    if (typeof element.checkVisibility === 'function') return element.checkVisibility({visibilityProperty:true});
    for (let node = element; node; node = node.parentElement) {
      const style = win.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }
  function refresh() {
    href = win.location.href;
    const eligible = modules.settings.siteEnabled(href, settings) && !composeRoute.test(win.location.pathname);
    dialogs = eligible ? Array.from(doc.querySelectorAll(dialog)) : [];
    const composer = dialogs.some(element => isComposer(element) && visible(element));
    if (eligible && !composer) {
      if (!buttons) buttons = mount(link => isComposer(link.closest(dialog)));
    } else {
      buttons?.dispose();
      buttons = undefined;
    }
  }
  const observer = new win.MutationObserver(records => {
    if (href !== win.location.href) { refresh(); return; }
    if (composeRoute.test(win.location.pathname)) return;
    // React can show a composer dialog without changing the URL. Ignore ordinary feed updates.
    if (dialogs.some(element => !element.isConnected) || records.some(record =>
      record.target.closest?.(dialog) ||
      (record.type === 'attributes' && dialogs.some(element => record.target.contains(element))) ||
      Array.from(record.addedNodes).some(node => node.nodeType === 1 && (node.matches(dialog) || node.querySelector(dialog))))) refresh();
  });
  refresh();
  observer.observe(doc.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['role','open','data-testid','contenteditable','aria-hidden','inert','hidden','style','class']});
  win.navigation?.addEventListener('currententrychange', refresh);
  win.addEventListener('popstate', refresh);
  return {dispose() {
    observer.disconnect();
    win.navigation?.removeEventListener('currententrychange', refresh);
    win.removeEventListener('popstate', refresh);
    buttons?.dispose();
  }};
};

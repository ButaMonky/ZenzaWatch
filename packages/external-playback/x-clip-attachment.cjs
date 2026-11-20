'use strict';
// Included only in the main userscript's X compose route. X owns the file input and final post.
module.exports = function mountXClipAttachment(clipboard, getTransfer) {
  if (window.top !== window) return;
  const onCompose = () => /^\/(?:compose\/post|intent\/(?:tweet|post))\/?$/.test(location.pathname);
  if (!onCompose() || document.getElementById('zenza-x-clip')) return;
  const match = /^#zenza-clip=([0-9a-f-]{36})$/.exec(location.hash);
  const transfer = match && getTransfer?.();
  const transferId = transfer?.receive && match?.[1];
  if (!transferId && !clipboard.supported()) return;
  if (match) history.replaceState(history.state,'',location.pathname + location.search);
  const host = document.createElement('aside');
  host.id = 'zenza-x-clip';
  host.setAttribute('aria-label','ZenzaWatchの動画添付');
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = '<style>:host{position:fixed;bottom:12px;right:12px;z-index:2147483646;max-width:min(90vw,360px);font:14px/1.4 system-ui;color:#edf4fa;background:#17232d;border:1px solid #678197;border-radius:12px;padding:.5rem;box-shadow:0 2px 8px #0006}button{color:inherit;background:#24405b;border:1px solid #7394ad;border-radius:8px;padding:.4em .75em;cursor:pointer;font:inherit}p{overflow-wrap:anywhere;margin:.3rem 0}p:empty{display:none}</style><button type="button">Zenzaの動画をクリップボードから読み込む</button><button type="button" hidden>戻る</button><p role="status" aria-live="polite"></p>';
  const [button,back] = root.querySelectorAll('button');
  button.hidden = !clipboard.supported();
  const status = root.querySelector('[role=status]');
  const inputs = () => {
    const modal = [...document.querySelectorAll('[role=dialog],dialog[open]')].filter(el => el.getClientRects().length).at(-1);
    // A media picker is commonly hidden for accessibility behind X's own media button.
    return [...(modal || document).querySelectorAll('input[type=file]')].filter(input =>
      !input.disabled && /(?:^|,)\s*(?:video\/|\.(?:mp4|webm|mov)\b)/i.test(input.accept) && !input.closest('[inert]'));
  };
  let file, expiryTimer, fileExpires = 0, readGeneration = 0;
  function attach(chosen) {
    const available = inputs();
    if (!onCompose() || available.length !== 1) throw Error('添付する投稿画面を1つ開いてください。');
    const input = available[0];
    const composer = input.closest('[role=dialog],dialog') || document;
    if (input.files?.length || composer.querySelector('[data-testid=removeMedia]')) {
      throw Error('選択中のファイルを確認し、添付をやり直してください。');
    }
    const allowed = input.accept.toLowerCase().split(',').map(value => value.trim());
    if (!allowed.some(value => value === 'video/*' || value === chosen.type ||
        (value.startsWith('.') && chosen.name.toLowerCase().endsWith(value)))) {
      throw Error('Xの投稿画面で添付できる動画形式を確認してください。');
    }
    const files = new DataTransfer();
    files.items.add(chosen);
    input.files = files.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    reset();
    button.textContent = '別のクリップを読み込む';
    status.textContent = 'Xの添付欄で動画を確認し、投稿してください。';
  }
  function reset() {
    readGeneration++;
    clearTimeout(expiryTimer);
    fileExpires = 0;
    file = null;
    back.hidden = true;
    status.textContent = '';
    button.textContent = 'Zenzaの動画をクリップボードから読み込む';
  }
  function expireSelection() {
    if (!file || Date.now() < fileExpires) return false;
    reset();
    status.textContent = '5分間操作がなかったため、読み込み済みの動画を解放しました。添付するときに再度読み込んでください。';
    return true;
  }
  back.onclick = reset;
  let automatic, abandoned = false;
  const expires = Date.now() + 120000;
  function refresh() {
    if (!onCompose()) {
      abandoned = true;
      automatic?.abort();
      host.remove(); reset();
    } else if (inputs().length === 1) {
      if (!host.isConnected) document.body.append(host);
      if (!automatic && !abandoned && transferId && Date.now() < expires) {
        automatic = new AbortController();
        button.disabled = true;
        status.textContent = '完成した動画を受け取っています…';
        transfer.receive(transferId,attach,automatic.signal).catch(error => {
          status.textContent = error.message || '自動添付できませんでした。ZenzaWatchの完成画面から手動で添付できます。';
        }).finally(() => { button.disabled = false; });
      }
    }
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('popstate',refresh);
  document.addEventListener('visibilitychange',expireSelection);
  window.addEventListener('pagehide',() => { observer.disconnect(); automatic?.abort(); reset(); });
  window.addEventListener('pageshow',event => {
    if (event.persisted) { observer.observe(document.body,{childList:true,subtree:true}); refresh(); }
  });
  refresh();
  button.addEventListener('click', async event => {
    if (!event.isTrusted || !onCompose() || expireSelection()) return;
    button.disabled = true;
    try {
      if (!file) {
        const generation = readGeneration;
        const chosen = await clipboard.read();
        if (generation !== readGeneration || !onCompose() || !host.isConnected) return;
        file = chosen;
        fileExpires = Date.now() + 5 * 60000;
        expiryTimer = setTimeout(expireSelection,5 * 60000);
        back.hidden = false;
        status.textContent = file.name + '（' + (file.size / 1048576).toFixed(1) + ' MiB）・添付待ちは5分間';
        button.textContent = 'この動画をXの下書きに添付';
      } else {
        attach(file);
      }
    } catch (error) {
      const message = error.name === 'NotAllowedError' ? 'ブラウザーのクリップボード読み取りを許可してから、もう一度押してください。' :
        error.name === 'Error' ? error.message : '動画を読み取れませんでした。もう一度コピーしてお試しください。';
      status.textContent = message + ' ZenzaWatchで「動画を保存」を選び、Xのメディアボタンから添付することもできます。';
    } finally { button.disabled = false; }
  });
};

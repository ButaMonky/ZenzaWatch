'use strict';
// Included only in the main userscript's X compose route. X owns the file input and final post.
module.exports = function mountXClipAttachment(clipboard) {
  if (window.top !== window || !clipboard.supported()) return;
  const onCompose = () => /^\/(?:compose\/post|intent\/(?:tweet|post))\/?$/.test(location.pathname);
  if (!onCompose() || document.getElementById('zenza-x-clip')) return;
  const host = document.createElement('aside');
  host.id = 'zenza-x-clip';
  host.setAttribute('aria-label','ZenzaWatchの動画添付');
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = '<style>:host{position:fixed;bottom:12px;right:12px;z-index:2147483646;max-width:min(90vw,360px);font:14px/1.4 system-ui;color:#edf4fa;background:#17232d;border:1px solid #678197;border-radius:12px;padding:.5rem;box-shadow:0 2px 8px #0006}button{color:inherit;background:#24405b;border:1px solid #7394ad;border-radius:8px;padding:.4em .75em;cursor:pointer;font:inherit}p{overflow-wrap:anywhere;margin:.3rem 0}p:empty{display:none}</style><button type="button">Zenzaの動画をクリップボードから読み込む</button><button type="button" hidden>戻る</button><p role="status" aria-live="polite"></p>';
  const [button,back] = root.querySelectorAll('button');
  const status = root.querySelector('[role=status]');
  const inputs = () => {
    const modal = [...document.querySelectorAll('[role=dialog],dialog[open]')].filter(el => el.getClientRects().length).at(-1);
    // A media picker is commonly hidden for accessibility behind X's own media button.
    return [...(modal || document).querySelectorAll('input[type=file]')].filter(input =>
      !input.disabled && /(?:^|,)\s*(?:video\/|\.(?:mp4|webm|mov)\b)/i.test(input.accept) && !input.closest('[inert]'));
  };
  let file;
  function reset() {
    file = null;
    back.hidden = true;
    status.textContent = '';
    button.textContent = 'Zenzaの動画をクリップボードから読み込む';
  }
  back.onclick = reset;
  function refresh() {
    if (!onCompose()) {
      host.remove(); reset();
    } else if (!host.isConnected && inputs().length === 1) {
      document.body.append(host);
    }
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('popstate',refresh);
  refresh();
  button.addEventListener('click', async event => {
    if (!event.isTrusted || !onCompose()) return;
    button.disabled = true;
    try {
      if (!file) {
        const chosen = await clipboard.read();
        if (!onCompose() || !host.isConnected) return;
        file = chosen;
        back.hidden = false;
        status.textContent = file.name + '（' + (file.size / 1048576).toFixed(1) + ' MB）';
        button.textContent = 'この動画をXの下書きに添付';
      } else {
        const available = inputs();
        if (available.length !== 1) throw Error('添付する投稿画面を1つ開いてください。');
        const input = available[0];
        if (input.files?.length) throw Error('選択中のファイルを確認し、添付をやり直してください。');
        const allowed = input.accept.toLowerCase().split(',').map(value => value.trim());
        if (!allowed.some(value => value === 'video/*' || value === file.type ||
            (value.startsWith('.') && file.name.toLowerCase().endsWith(value)))) {
          throw Error('Xの投稿画面で添付できる動画形式を確認してください。');
        }
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change',{bubbles:true}));
        reset();
        button.textContent = '別のクリップを読み込む';
        status.textContent = 'Xの添付欄で動画を確認し、投稿してください。';
      }
    } catch (error) {
      status.textContent = error.name === 'NotAllowedError' ? 'ブラウザーのクリップボード読み取りを許可してから、もう一度押してください。' :
        error.name === 'Error' ? error.message : '動画を読み取れませんでした。もう一度コピーしてお試しください。';
    } finally { button.disabled = false; }
  });
};

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
  const postSelector = '[data-testid="tweetButton"],[data-testid="tweetButtonInline"]';
  const errorSelector = '[role="alert"],[data-testid="mediaUploadError"]';
  const visible = el => !el.closest('[hidden],[aria-hidden=true],[inert],article,a[href],[data-testid^="card."],[data-testid="cardWrapper"]') &&
    el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible';
  function mediaState(composer) {
    const shown = selector => [...composer.querySelectorAll(selector)].filter(visible);
    const attached = shown('[data-testid="removeMedia"]').length > 0 ||
      shown('[data-testid="attachments"] video').some(video =>
        video.currentSrc.startsWith('blob:') || video.src.startsWith('blob:') || video.querySelector('source[src^="blob:"]')) ||
      shown('[data-testid="attachments"] :is(button,[role=button])[aria-label]').some(el =>
        /^(?:メディアを削除|remove media)$/i.test(el.getAttribute('aria-label').trim()));
    const inToolbar = el => el.closest('[role=toolbar],[data-testid="toolBar"]');
    const preparing = shown('[role=progressbar][aria-label]').some(el =>
      !inToolbar(el) && /^(?:メディアを準備中|preparing (?:your )?media)[.\s]*$/i.test(el.getAttribute('aria-label').normalize('NFKC').trim()));
    let busy = preparing || shown('[data-testid="attachments"][aria-busy=true],[data-testid="attachments"] :is([role=progressbar],progress,[aria-busy=true])')
      .some(el => !inToolbar(el));
    let percent;
    for (const el of shown('[data-testid="attachments"] span')) {
      if (inToolbar(el)) continue;
      const label = el.textContent.normalize('NFKC').trim();
      const match = /^(?:アップロード中|uploading(?: media)?)[.\s]*(?:\(\s*(\d{1,3})\s*%\s*\)|(\d{1,3})\s*%)?[.\s]*$/i.exec(label);
      if (!match) continue;
      busy = true;
      const n = Number(match[1] ?? match[2]);
      if (Number.isInteger(n) && n <= 100) percent = Math.max(percent ?? 0,n);
    }
    return {attached,busy,percent};
  }
  function composerFor(input) {
    const dialog = input.closest('[role=dialog],dialog');
    if (dialog) return dialog;
    // Full-page composers have no dialog. Stop at the smallest shared container
    // with the native post control; never use the entire page as proof of readiness.
    for (let el = input.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.querySelector(postSelector)) return el;
    }
  }
  function automaticPicker() {
    const available = inputs();
    if (available.length !== 1) return;
    const input = available[0], composer = composerFor(input);
    if (!composer) return;
    // X can render the home timeline's inline editor before mounting the intent dialog.
    const inlineHome = location.pathname.startsWith('/intent/') && !composer.matches('[role=dialog],dialog');
    const selector = inlineHome ? '[data-testid="tweetButton"]' : postSelector;
    if ([...composer.querySelectorAll(selector)].filter(visible).length === 1) return input;
  }
  const failureText = {
    'draft-media-rejected':'Xが動画の処理エラーを表示しました。Xの下書きで内容を確認してください。',
    'draft-media-timeout':'Xの動画準備またはアップロードの進捗を5分間確認できませんでした。開いている下書きで動画の状態を確認してください。',
    'draft-media-hidden':'バックグラウンドのXで動画の準備が続き、進捗を確認できませんでした。下書きタブを一度表示してください。',
    'draft-media-limit':'Xの動画準備が20分以内に完了しませんでした。開いている下書きで動画の状態を確認してください。',
    'draft-media-unknown':'Xの下書きで動画を投稿できる状態か確認できませんでした。開いている下書きで添付欄を確認してください。'
  };
  function waitForComposer(composer, previousErrors, signal, onPhase) {
    const started = Date.now();
    let preparing = false, progressAt = started, highest = -1, reported = -1, reportedAt = -Infinity;
    let readySince, timer, observer, inspect, stop, replaced;
    return new Promise((resolve,reject) => {
      const fail = reason => reject(Object.assign(Error(failureText[reason]),{reason}));
      stop = () => fail('draft-media-unknown');
      replaced = event => { if (event.target.matches?.('input[type=file]')) stop(); };
      inspect = () => {
        const now = Date.now();
        if (now - started >= 1200000) return fail('draft-media-limit');
        const checkIdle = () => {
          if (now - progressAt < (preparing ? 300000 : 90000)) return;
          if (preparing && document.hidden && highest < 0) return fail('draft-media-hidden');
          fail(preparing ? 'draft-media-timeout' : 'draft-media-unknown');
        };
        if (!onCompose() || composer && !composer.isConnected) return stop();
        const foreground = [...document.querySelectorAll('[role=dialog],dialog[open]')].filter(visible).at(-1);
        if (!composer || foreground && !foreground.contains(composer)) { readySince = undefined; return checkIdle(); }
        const shown = selector => [...composer.querySelectorAll(selector)].filter(visible);
        const rejected = shown(errorSelector).some(el => {
          const text = el.textContent;
          if (previousErrors.get(el) === text) return false;
          return el.dataset.testid === 'mediaUploadError' || /(?:動画|メディア|アップロード).*(?:失敗|できません|エラー)|(?:media|video|upload).*(?:failed|error|could not)|(?:failed|unable) to upload/i.test(text);
        });
        if (rejected) return fail('draft-media-rejected');
        const media = mediaState(composer);
        const posts = shown(postSelector);
        const enabled = posts.length === 1 && posts[0].matches('button,[role=button],input[type=submit]') &&
          !posts[0].matches(':disabled') && !posts[0].closest('[aria-disabled=true]') && getComputedStyle(posts[0]).pointerEvents !== 'none';
        if (media.busy || media.attached && posts.length === 1 && !enabled) {
          const first = !preparing;
          if (first || media.percent > highest) progressAt = now;
          if (media.percent > highest) highest = media.percent;
          preparing = true;
          if (first || highest > reported && now - reportedAt >= 1000) {
            onPhase('draft-prepare',highest >= 0 ? highest : undefined);
            reported = highest;
            reportedAt = now;
          }
        }
        if (!media.attached || !enabled || media.busy) { readySince = undefined; return checkIdle(); }
        if (readySince === undefined) readySince = now;
        else if (now - readySince >= 1500) resolve();
      };
      if (signal?.aborted) return stop();
      signal?.addEventListener('abort',stop,{once:true});
      composer?.addEventListener('change',replaced,true);
      document.addEventListener('visibilitychange',inspect);
      observer = new MutationObserver(inspect);
      if (composer) observer.observe(composer,{childList:true,attributes:true,characterData:true,subtree:true});
      timer = setInterval(inspect,1000);
      inspect();
    }).finally(() => {
      clearInterval(timer);
      observer?.disconnect();
      signal?.removeEventListener('abort',stop);
      composer?.removeEventListener('change',replaced,true);
      document.removeEventListener('visibilitychange',inspect);
    });
  }
  let file, expiryTimer, fileExpires = 0, readGeneration = 0;
  async function attach(chosen, signal, report = () => {}, auto = false) {
    const available = inputs();
    if (!onCompose() || available.length !== 1) throw Error('添付する投稿画面を1つ開いてください。');
    const input = available[0];
    if (auto && automaticPicker() !== input) throw Error('Xの下書きの添付欄を確認できませんでした。完成画面から添付できます。');
    const composer = composerFor(input);
    const existing = composer && mediaState(composer);
    if (input.files?.length || existing?.attached || existing?.busy) {
      throw Error('選択中のファイルを確認し、添付をやり直してください。');
    }
    const allowed = input.accept.toLowerCase().split(',').map(value => value.trim());
    if (!allowed.some(value => value === 'video/*' || value === chosen.type ||
        (value.startsWith('.') && chosen.name.toLowerCase().endsWith(value)))) {
      throw Error('Xの投稿画面で添付できる動画形式を確認してください。');
    }
    const files = new DataTransfer();
    const previousErrors = new Map([...(composer?.querySelectorAll(errorSelector) || [])].filter(visible).map(el => [el,el.textContent]));
    files.items.add(chosen);
    input.files = files.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    reset();
    const size = (chosen.size / 1048576).toFixed(1) + ' MiB';
    const progress = (phase,percent) => {
      status.textContent = phase === 'draft-received' ? 'Xの添付欄に動画（' + size + '）を渡しました。準備完了を待っています…' :
        Number.isInteger(percent) ? 'Xが動画（' + size + '）をアップロード中です（' + percent + '%）。' :
          'Xで動画（' + size + '）を準備しています。投稿ボタンが有効になるまでお待ちください。';
      report(phase,percent);
    };
    progress('draft-received');
    await waitForComposer(composer,previousErrors,signal,progress);
    button.textContent = '別のクリップを読み込む';
    status.textContent = 'Xの添付欄に動画が表示され、投稿ボタンが有効になりました。内容を確認してください。';
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
  let automatic, manual, abandoned = false;
  const expires = Date.now() + 120000;
  function refresh() {
    if (!onCompose()) {
      abandoned = true;
      automatic?.abort();
      manual?.abort();
      host.remove(); reset();
    } else if (inputs().length === 1) {
      if (!host.isConnected) document.body.append(host);
      if (!automatic && !abandoned && transferId && Date.now() < expires && automaticPicker()) {
        automatic = new AbortController();
        button.disabled = true;
        status.textContent = '完成した動画を受け取っています…';
        transfer.receive(transferId,(file,signal,report) => attach(file,signal,report,true),automatic.signal).catch(error => {
          status.textContent = error.message || '自動添付できませんでした。ZenzaWatchの完成画面から手動で添付できます。';
        }).finally(() => { button.disabled = false; });
      }
    }
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['accept','disabled','data-testid','hidden','inert','aria-hidden','role']});
  window.addEventListener('popstate',refresh);
  document.addEventListener('visibilitychange',expireSelection);
  window.addEventListener('pagehide',() => { observer.disconnect(); automatic?.abort(); manual?.abort(); reset(); });
  window.addEventListener('pageshow',event => {
    if (event.persisted) { observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['accept','disabled','data-testid','hidden','inert','aria-hidden','role']}); refresh(); }
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
        manual = new AbortController();
        await attach(file,manual.signal);
      }
    } catch (error) {
      const message = error.name === 'NotAllowedError' ? 'ブラウザーのクリップボード読み取りを許可してから、もう一度押してください。' :
        error.name === 'Error' ? error.message : '動画を読み取れませんでした。もう一度コピーしてお試しください。';
      status.textContent = failureText[error.reason] || message + ' ZenzaWatchで「動画を保存」を選び、Xのメディアボタンから添付することもできます。';
    } finally { manual = null; button.disabled = false; }
  });
};

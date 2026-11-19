'use strict';

// Embedded in the userscript with Function#toString. OAuth and network access stay with the caller.
module.exports = function mountXDirectDialog({file, text = '', auth, publish, account, onClose}) {
  const previousFocus = document.activeElement;
  const host = document.createElement('aside');
  host.id = 'zenza-x-direct';
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = `<style>
    :host {color-scheme:dark}
    dialog {box-sizing:border-box;width:min(44rem,calc(100vw - 16px));max-width:none;max-height:calc(100dvh - 12px);overflow:auto;margin:auto;padding:16px 20px;border:1px solid #5c7183;border-radius:12px;background:#17232d;color:#f3f6f9;font:15px/1.45 system-ui,sans-serif}
    dialog::backdrop {background:#0009}
    header,.actions,.attachment {display:flex;align-items:center;flex-wrap:wrap;gap:5px 10px}
    header {flex-wrap:nowrap;justify-content:space-between}
    h2 {margin:0;font-size:1.15em}
    .attachment {flex-wrap:nowrap;min-width:0;margin:4px 0 10px;color:#c1d0db;font-size:.9em}
    #file {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #size {flex:none;font-variant-numeric:tabular-nums}
    .fields,.columns {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
    .columns:has(> [hidden]) {display:block}
    .fields {margin-bottom:8px}
    label {display:block}
    input,textarea,button {font:inherit}
    input,textarea {display:block;box-sizing:border-box;width:100%;margin-top:2px;padding:5px 8px;color:inherit;background:#111b23;border:1px solid #718595;border-radius:5px}
    textarea {resize:none}
    button {padding:5px 10px;border:1px solid #718595;border-radius:6px;color:inherit;background:#263b4a;cursor:pointer}
    button:disabled {opacity:.55;cursor:default}
    button:is([data-action=authorize],[data-action=account],[data-action=publish]) {color:#102639;background:#b8deff;border-color:#b8deff;font-weight:650}
    .actions {margin:6px 0}
    p,details {margin:6px 0;overflow-wrap:anywhere}
    summary {cursor:pointer;color:#c6e4f9}
    a {color:#a4dbff}
    .fee {font-size:.86em;color:#c1d0db}
    progress {width:100%}
    #preview video {display:block;width:100%;height:min(50dvh,22rem);object-fit:contain;background:#10161c}
    [hidden],p:empty {display:none!important}
    @media(max-width:559px) {
      dialog {padding:10px 12px;font-size:14px}
      .fields,.columns {display:block}
      .fields label+label {margin-top:5px}
    }
    @media(max-height:420px) {dialog{padding:6px 12px;font-size:13px}.attachment,.actions,p,details{margin-block:3px}#preview video{height:45dvh}}
  </style><dialog aria-labelledby="title">
    <header><h2 id="title">動画をXに直接投稿</h2><button data-action="close">閉じる</button></header>
    <p class="attachment"><span id="file"></span><span id="size"></span></p>
    <div id="workflow">
      <section id="setup">
        <div class="fields"><label>公開Client ID<input id="client" autocomplete="off" spellcheck="false"></label>
        <label>登録済みコールバックURL<input id="redirect" type="url" autocomplete="off" spellcheck="false"></label></div>
        <button data-action="authorize">Xで連携を許可</button>
        <details><summary>初回設定の手順</summary>
          <p>X Developer ConsoleでOAuth 2.0の公開クライアントを登録し、公開Client IDとコールバックURLを入力します。</p>
          <p>既定のURLでは、連携の前にPCで受信ツールを起動します。リポジトリのルートでは <code>node packages/external-playback/x-oauth-loopback.cjs</code>、単体で取得した場合は保存先で <code>node x-oauth-loopback.cjs</code> を実行してください。</p>
          <p>別のHTTPS URLを登録する場合は、ご自身で管理するサイトを指定します。</p></details>
      </section>
      <section id="authorization"><p>認可ページでXのアカウントと権限を確認してください。</p>
        <div class="actions"><a id="authorizationLink" target="_blank" rel="noopener noreferrer">認可ページを開く</a>
        <button data-action="abandon">認可を取り消す</button></div>
        <details><summary>認可後に画面が切り替わらない場合</summary><label>認可後のコールバックURL<input id="callback" type="url" autocomplete="off" spellcheck="false"></label>
        <div class="actions"><button data-action="complete">入力したURLで連携を完了</button></div></details>
      </section>
      <div class="columns"><label id="draft">投稿本文<textarea rows="3"></textarea></label>
      <section id="linked"><p id="user"></p>
        <div class="actions"><button data-action="account">投稿先アカウントを確認</button>
        <button data-action="preview" hidden>添付動画を確認</button>
        <button data-action="publish" hidden>内容を確認して投稿</button></div>
        <button data-action="disconnect">この端末の連携を解除・切替</button>
      </section></div>
      <progress max="100" hidden></progress><button data-action="abort" hidden>送信を中止</button>
      <p role="status" aria-live="polite"></p><a id="result" target="_blank" rel="noopener noreferrer" hidden></a>
      <p class="fee">アカウント確認・アップロード・投稿にはX APIの料金が発生する場合があります。</p>
    </div>
    <section id="preview" hidden><video controls playsinline preload="metadata" aria-label="Xに添付する動画"></video>
      <p id="previewStatus" aria-live="polite"></p><div class="actions"><button data-action="back">投稿内容に戻る</button></div></section>
  </dialog>`;
  const find = selector => root.querySelector(selector);
  const action = name => find('[data-action="' + name + '"]');
  const dialog = find('dialog'), body = find('textarea'), status = find('[role=status]');
  const result = find('#result'), progress = find('progress');
  const client = find('#client'), redirect = find('#redirect'), callback = find('#callback');
  const video = find('#preview video');
  let previewUrl;
  const config = auth.config() || {};
  client.value = config.clientId || '';
  redirect.value = config.redirectUri || 'http://127.0.0.1:48765/callback';
  body.value = text;
  const size = (file.size / 1048576).toLocaleString('ja-JP',{maximumFractionDigits:2}) + ' MiB';
  const bytes = file.size.toLocaleString('ja-JP') + ' バイト';
  const fileSummary = file.name + '（' + size + '、' + bytes + '）';
  find('#file').textContent = find('#file').title = file.name;
  find('#size').textContent = file.size < 1048576 ? bytes : size;
  find('#size').title = bytes;
  let stage = auth.isLinked() ? 'linked' : 'setup';
  let busy = false, closed = false, popup, registeredUrl, user, controller;
  const messages = {
    INVALID_CONFIG:'公開Client IDと、Xに登録したコールバックURLを確認してください。',
    AUTH_EXPIRED:'認可の有効期限が切れました。もう一度連携してください。',
    AUTH_REQUIRED:'Xの認可が必要です。もう一度連携してください。',
    AUTH_DENIED:'Xで認可が取り消されました。',
    INVALID_CALLBACK:'認可後のURLを確認してください。登録済みのURLと今回の認可情報が必要です。',
    TOKEN_ERROR:'Xの認可情報を取得できませんでした。アプリ設定を確認し、もう一度連携してください。',
    SCOPE_MISSING:'動画投稿に必要な権限がありません。Xのアプリ設定を確認し、もう一度連携してください。',
    ACCOUNT_CHANGED:'連携中のアカウントが変わりました。投稿先をもう一度確認してください。',
    ACCOUNT_UNKNOWN:'投稿先のアカウントを確認できませんでした。Xの認可と通信状態を確認してください。',
    QUOTA:'Xの利用枠またはクレジットが不足しています。X Developer Consoleを確認してください。',
    DURATION_LIMIT:'動画がこのXアカウントの投稿時間上限を超えています。クリップの区間を短くしてください。',
    POST_REJECTED:'Xが投稿内容を受理しませんでした。本文の長さや動画の形式を確認してください。',
    INVALID_RESPONSE:'Xから動画の受付結果を読み取れませんでした。修復箇所：x-media-publish.cjs のアップロード応答。',
    ACCESS_DENIED:'この操作をXが許可しませんでした。アプリのアクセス権限を確認してください。',
    TOO_LARGE:'動画がXの容量上限を超えています。短いクリップを作成してください。',
    INVALID_FILE:'直接投稿できる形式はMP4です。MP4のクリップを選んでください。',
    RATE_LIMITED:'Xの利用回数制限に達しました。時間をおいてください。',
    NETWORK:'Xに接続できませんでした。通信状態を確認してください。',
    PROCESSING_FAILED:'Xでの動画処理に失敗しました。', PROCESSING_TIMEOUT:'Xの動画処理が期限内に完了しませんでした。',
    CANCELLED:'送信を中止しました。', FILE_READ:'動画ファイルを読み取れませんでした。'
  };
  function render() {
    const sending = stage === 'sending', linked = stage === 'linked' || stage === 'review';
    find('#setup').hidden = stage !== 'setup';
    find('#authorization').hidden = stage !== 'authorization';
    find('#linked').hidden = !linked && !sending;
    find('#user').textContent = user ? '投稿先　@' + user.username : '投稿先は未確認です。';
    find('#draft').hidden = stage === 'setup' || stage === 'authorization';
    action('preview').hidden = stage !== 'review';
    body.readOnly = sending || stage === 'sent' || stage === 'unknown';
    action('publish').hidden = stage !== 'review';
    action('account').hidden = stage !== 'linked';
    action('disconnect').hidden = !linked;
    for (const el of root.querySelectorAll('button,input')) el.disabled = busy;
    action('close').disabled = sending;
    action('abort').hidden = !sending;
    action('abort').disabled = !sending || controller.signal.aborted;
    progress.hidden = !sending;
  }
  function hidePreview() {
    if (!previewUrl) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    find('#preview').hidden = true;
    find('#workflow').hidden = false;
    find('#previewStatus').textContent = '';
  }
  function openPreview() {
    if (stage !== 'review' || previewUrl) return;
    try { previewUrl = URL.createObjectURL(file); }
    catch (_) { status.textContent = '添付動画のプレビューを開けませんでした。'; return; }
    find('#workflow').hidden = true;
    find('#preview').hidden = false;
    video.src = previewUrl;
    action('back').focus();
  }
  video.onerror = () => {
    if (previewUrl) find('#previewStatus').textContent = 'このブラウザーでは添付動画を再生できません。';
  };
  function backFromPreview() {
    hidePreview();
    action('preview').focus();
  }
  function stopPopup() {
    try { popup?.close(); } catch (_) {}
    popup = null;
    registeredUrl = null;
    callback.value = '';
    find('#authorizationLink').removeAttribute('href');
  }
  function close() {
    if (closed) return;
    if (controller) { controller.abort(); return; }
    closed = true;
    hidePreview();
    stopPopup();
    window.removeEventListener('message', onMessage);
    dialog.close();
    host.remove();
    previousFocus?.focus();
    onClose?.();
  }
  function showProfile() {
    result.href = 'https://x.com/' + user.username;
    result.textContent = '@' + user.username + ' の投稿を確認';
    result.hidden = false;
  }
  async function run(work) {
    if (busy || closed) return;
    busy = true;
    status.textContent = '';
    render();
    try {
      await work();
    } catch (error) {
      if (closed) return;
      const code = error?.code || error?.message;
      if (code === 'POST_UNCERTAIN') {
        stage = 'unknown';
        status.textContent = 'Xから投稿結果を確認できませんでした。重複投稿を防ぐため、Xのプロフィールで投稿済みか確認してください。';
        showProfile();
      } else {
        if (stage === 'sending') stage = 'review';
        if (code === 'AUTH_REQUIRED' || code === 'AUTH_EXPIRED' || code === 'SCOPE_MISSING' || code === 'TOKEN_ERROR' || code === 'AUTH_DENIED') {
          stopPopup(); user = null; stage = 'setup';
        }
        if (code === 'ACCOUNT_CHANGED') { user = null; stage = 'linked'; }
        status.textContent = messages[code] || '操作を完了できませんでした。Xのアプリ設定と通信状態を確認してください。';
      }
    } finally {
      busy = false;
      if (!closed) render();
    }
  }
  async function authorize() {
    const settings = {clientId:client.value.trim(), redirectUri:redirect.value.trim()};
    // Open while transient user activation still exists. COOP or blockers may sever the opener.
    popup = window.open('about:blank','_blank','popup,width=620,height=720');
    try {
      await auth.configure(settings);
      registeredUrl = new URL(settings.redirectUri);
      const url = new URL(await auth.begin());
      if (closed) return;
      if (url.origin !== 'https://x.com' || url.pathname !== '/i/oauth2/authorize') throw Error('INVALID_CONFIG');
      stage = 'authorization';
      find('#authorizationLink').href = url.href;
      if (popup && !popup.closed) {
        try { popup.location.href = url.href; } catch (_) {}
      }
    } catch (error) { stopPopup(); throw error; }
  }
  async function complete(value) {
    let url;
    try { url = new URL(value); } catch (_) { throw Error('INVALID_CALLBACK'); }
    if (url.origin !== registeredUrl?.origin || url.pathname !== registeredUrl.pathname) throw Error('INVALID_CALLBACK');
    await auth.complete(url.href);
    stopPopup();
    stage = 'linked';
    status.textContent = '連携しました。投稿先アカウントを確認してください。';
  }
  function onMessage(event) {
    if (stage === 'authorization' && event.isTrusted && popup && event.source === popup && event.origin === registeredUrl?.origin &&
        event.data?.type === 'zenza-x-oauth-complete' && typeof event.data.url === 'string') {
      void run(() => complete(event.data.url));
    }
  }
  async function checkAccount() {
    const identity = await account();
    if (closed) return;
    if (!identity?.id || !/^[A-Za-z0-9_]{1,15}$/.test(identity.username || '')) throw Error('ACCOUNT_CHANGED');
    user = identity;
    stage = 'review';
  }
  async function sendPost() {
    if (stage !== 'review' || !user) return;
    const message = body.value;
    if (!window.confirm('@' + user.username + ' としてXに公開しますか？\n\n動画：' + fileSummary +
      '\n投稿本文：\n' + (message || '（本文なし）') + '\n\nX APIの利用料金が発生する場合があります。')) return;
    controller = new AbortController();
    stage = 'sending';
    progress.value = 0;
    render();
    const labels = {initialize:'準備中',upload:'動画をアップロード中',processing:'Xで動画を処理中',post:'投稿を送信中'};
    try {
      const posted = await publish({file,text:message,signal:controller.signal,onProgress(update) {
        progress.value = update.percent;
        status.textContent = (labels[update.stage] || '送信中') + (update.stage === 'upload' || update.stage === 'processing' ? ' ' + update.percent + '%' : '');
      }});
      if (!/^\d{1,19}$/.test(posted?.id || '')) throw Error('POST_UNCERTAIN');
      stage = 'sent';
      result.href = 'https://x.com/i/status/' + posted.id;
      result.textContent = 'Xで投稿を開く'; result.hidden = false;
      status.textContent = '投稿しました。';
    } finally { controller = null; }
  }
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled || !event.isTrusted) return;
    switch (button.dataset.action) {
      case 'close': close(); break;
      case 'preview': openPreview(); break;
      case 'back': backFromPreview(); break;
      case 'abort': controller?.abort(); render(); break;
      case 'authorize': if (stage === 'setup') void run(authorize); break;
      case 'abandon': stopPopup(); stage = 'setup'; status.textContent = ''; render(); break;
      case 'complete': if (stage === 'authorization') void run(() => complete(callback.value.trim())); break;
      case 'account': if (stage === 'linked') void run(checkAccount); break;
      case 'disconnect':
        void run(async () => {
          const revoked = await auth.disconnect();
          user = null; stage = 'setup';
          status.textContent = revoked === false ? 'この端末の連携を解除しました。X側の解除結果は、Xの「連携しているアプリ」で確認してください。' :
            '連携を解除しました。別のアカウントを使う場合は、Xの認可画面で選んでください。';
        });
        break;
      case 'publish': void run(sendPost); break;
    }
  });
  // Player shortcuts must not close the underlying clip editor while this modal has focus.
  for (const name of ['keydown','keyup','keypress']) {
    dialog.addEventListener(name,event => event.stopPropagation());
  }
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (previewUrl) backFromPreview();
    else if (!controller) close();
  });
  window.addEventListener('message',onMessage);
  document.body.append(host);
  render(); dialog.showModal();
  return {close};
};

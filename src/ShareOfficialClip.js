import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
//===BEGIN===
//@require RequestDiagnostics
// The permission, processing and posting decisions belong to NicoNico's clip service.
const ShareOfficialClip = (() => {
  const base = 'https://nvapi.nicovideo.jp/v1';
  const pollInterval = 5000;
  const recent = new Map();
  const pendingCreations = new Map();
  const pollLimit = 30 * 60 * 1000;
  const ignored = {reason:'cancelled'};
  const schema = missing => ({kind:'schema', missing});
  const postFailures = {
    X_TOKEN_INVALID:'X アカウントの連携を公式ページで確認してください。',
    X_TOO_MANY_REQUESTS:'X の利用上限に達しました。しばらく時間をおいてください。',
    VIDEO_CLIP_NOT_FOUND:'公式サービスでクリップが見つかりません。'
  };
  function responseIssue(operation, data, expired) {
    if (operation === 'clip-permission') {
      if (typeof data?.isLogin !== 'boolean') return schema('data.isLogin');
      if (!data.isLogin || data.isClipTweetAllowedVideo === false || data.isClipTweetAllowed === false) return;
      if (typeof data.twitterLinkage?.isLinked !== 'boolean') return schema('data.twitterLinkage.isLinked');
      if (data.twitterLinkage.isLinked && typeof data.isClipTweetAllowed !== 'boolean') return schema('data.isClipTweetAllowed');
    } else if (operation === 'clip-license' && typeof data?.isUseLicensedMusic !== 'boolean') {
      return schema('data.isUseLicensedMusic');
    } else if (operation === 'clip-create') {
      if (!(typeof data?.clipId === 'string' && data.clipId.trim()) && !(Number.isSafeInteger(data?.clipId) && data.clipId > 0)) return schema('data.clipId');
    } else if (operation === 'clip-status' || operation === 'clip-post-status') {
      const posting = operation === 'clip-post-status';
      if (typeof data?.status !== 'string' || !data.status.trim()) return schema('data.status');
      if (data.status === 'DONE') {
        if (!posting) {
          try { if (new URL(data.clipUri).protocol !== 'https:') return schema('data.clipUri'); }
          catch (_) { return schema('data.clipUri'); }
        }
      } else if (data.status === 'FAILED' || data.status === 'ERROR') {
        return posting && Object.hasOwn(postFailures, data.failureReason) ? ignored : {kind:'service'};
      } else {
        const pending = posting ? ['WAITING','PENDING','PROCESSING','POSTING'] : ['WAITING','GENERATING'];
        if (!pending.includes(data.status)) {
          // Nico's X client treats nonterminal states as pending. Preserve polling while it may still finish.
          return posting && !expired ? ignored : schema('data.status');
        }
        // A polling reply that still says "waiting" cannot confirm that a prior failure has cleared.
        return expired ? {kind:'timeout'} : ignored;
      }
    }
  }

  function mount(container, {info, startTime, endTime, autoPreview = false, text, officialUrl, onUseLocal}) {
    const win = container.ownerDocument.defaultView;
    const duration = Number(info.duration);
    const videoId = String(info.videoId || info.watchId || '');
    const source = '/videos/' + encodeURIComponent(videoId);
    const lifetime = new win.AbortController();
    let timer;
    let clipId;
    let phase = 'checking';
    let task;
    let deadline;
    let account;
    let recordKey;
    let createRequested = false;
    let retryAt = 0, retryTimer;

    container.innerHTML = `
<p>ニコニコが元動画から3〜30秒のクリップを作成します。プレビューを確認して、連携したXアカウントに投稿できます。</p>
<p name="account"></p>
<div class="shareRow">
  <label>開始 <input name="clipStart" type="number" min="0" step="0.001"> 秒</label>
  <label>終了 <input name="clipEnd" type="number" min="0" step="0.001"> 秒</label>
</div>
<div name="editor" hidden>
<p name="license" hidden></p>
<button type="button" name="create" disabled>プレビューを作成</button>
<div name="composer" hidden>
<video aria-label="作成したビデオクリップ" controls playsinline preload="metadata" hidden></video>
<label>投稿本文<textarea name="clipText" rows="3"></textarea></label>
<div class="shareRow"><button type="button" name="post" disabled>この内容でXに投稿する</button>
<button type="button" name="check" hidden>状態を再確認</button>
<button type="button" name="again" hidden>別のクリップを作成</button>
<button type="button" name="discard" hidden>クリップを削除して選び直す</button></div></div>
</div>
<p role="status" class="shareStatus"></p>
<div class="shareRow"><button name="useLocal" type="button" hidden>この範囲を端末で作成</button>
<a class="shareAction" target="_blank" rel="noopener noreferrer">ニコニコの視聴ページで開く</a></div>`;
    const find = name => container.querySelector('[name="' + name + '"]');
    const status = container.querySelector('[role=status]');
    const preview = container.querySelector('video');
    const link = container.querySelector('a');
    const start = find('clipStart');
    const end = find('clipEnd');
    const draft = find('clipText');
    const create = find('create');
    const post = find('post');
    const check = find('check');
    const discard = find('discard');
    const again = find('again');
    const useLocal = find('useLocal');
    // The service uses integer milliseconds. Both HTML step validation and draft
    // matching must use the very same range we send to the server.
    const limit = Number.isFinite(duration) && duration > 0 ? Math.floor(duration * 1000) / 1000 : Infinity;
    const seconds = value => Math.round(value * 1000) / 1000;
    const hasEnd = Number.isFinite(endTime);
    const initialStart = seconds(Math.max(0, Math.min(Number(startTime) || 0, hasEnd ? limit : Math.max(0, limit - 3))));
    const initialEnd = seconds(Math.max(0, Math.min(limit, hasEnd ? endTime : initialStart + 10)));
    start.value = String(initialStart);
    end.value = String(initialEnd);
    if (Number.isFinite(limit)) start.max = end.max = String(limit);
    useLocal.hidden = typeof onUseLocal !== 'function';
    useLocal.onclick = () => {
      if (lifetime.signal.aborted || typeof onUseLocal !== 'function') return;
      const from = start.valueAsNumber, to = end.valueAsNumber;
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from || to > limit) {
        status.textContent = '開始と終了を動画の範囲内で指定してください。';
        return;
      }
      onUseLocal({start:from, end:to});
    };
    link.href = officialUrl;
    const shareUrl = 'https://nico.ms/' + encodeURIComponent(info.watchId);
    const suppliedText = String(text() || '');
    draft.value = suppliedText.includes(shareUrl) ? suppliedText : [suppliedText, shareUrl].filter(Boolean).join('\n');

    function validRange() {
      const first = Math.round(start.valueAsNumber * 1000);
      const last = Math.round(end.valueAsNumber * 1000);
      return Number.isSafeInteger(first) && Number.isSafeInteger(last) && start.validity.valid && end.validity.valid &&
        last - first >= 3000 && last - first <= 30000 && last <= Math.floor(limit * 1000);
    }
    function update() {
      const edit = phase === 'edit';
      start.disabled = end.disabled = !['edit','denied','checking'].includes(phase);
      find('composer').hidden = !clipId;
      create.hidden = !!clipId;
      create.disabled = !edit || Date.now() < retryAt || !validRange();
      post.disabled = phase !== 'preview' || !draft.value.trim();
      draft.disabled = ['posting', 'posted', 'postUnknown'].includes(phase);
      again.hidden = phase !== 'posted';
      check.hidden = phase !== 'postUnknown' && phase !== 'clipUnknown';
      discard.hidden = !clipId || !['preview','clipError','clipUnknown','postFailed'].includes(phase);
    }
    function state(value, message) {
      if (lifetime.signal.aborted) return;
      phase = value;
      const busy = ['checking','creating','generating','posting','discarding'].includes(phase);
      status.dataset.busy = String(busy);
      container.querySelector('[name=editor]').setAttribute('aria-busy', String(busy));
      status.textContent = message;
      update();
    }
    start.oninput = end.oninput = () => {
      if (phase !== 'edit') return;
      update();
      status.textContent = validRange() ? '' : '動画の範囲内で、3〜30秒の区間を選んでください。';
      if (Number.isFinite(start.valueAsNumber) && start.valueAsNumber >= 0) {
        const url = new URL(officialUrl);
        url.searchParams.set('from', String(Math.floor(start.valueAsNumber)));
        link.href = url.href;
      }
    };
    draft.oninput = update;
    preview.onerror = () => {
      if (phase === 'preview') {
        task = 'clip';
        state('clipUnknown', 'プレビューを読み込めません。「状態を再確認」で取得し直してください。');
      }
    };

    // One entry per video and linked account. Persist the actual service-issued clip ID
    // before sending. Reopening can repeat a GET, never a publication request.
    function remember(kind) {
      if (!recordKey) return;
      const value = kind ? JSON.stringify({kind, id:clipId, start:start.value, end:end.value, text:draft.value}) : null;
      if (value) recent.set(recordKey, value); else recent.delete(recordKey);
      try {
        if (value) win.sessionStorage.setItem(recordKey, value);
        else win.sessionStorage.removeItem(recordKey);
      } catch (_) { /* The open tab still retains its request state. */ }
    }
    function saved() {
      try {
        const value = JSON.parse(recent.get(recordKey) || win.sessionStorage.getItem(recordKey) || 'null');
        if (value && ['clip','post','posted'].includes(value.kind) && value.id) return value;
      } catch (_) { /* An unavailable or old record cannot be resumed. */ }
      return null;
    }
    function setCreateNotice(value) {
      const key = recordKey + ':creation';
      if (value) recent.set(key, value); else recent.delete(key);
      try {
        if (value) win.sessionStorage.setItem(key, value); else win.sessionStorage.removeItem(key);
      } catch (_) { /* An open page still retains its latest state. */ }
    }
    function createNotice() {
      const key = recordKey + ':creation';
      let value = recent.get(key);
      try { value ||= win.sessionStorage.getItem(key); } catch (_) { /* storage unavailable */ }
      if (!value) return '';
      if (value === 'unconfirmed') return '前回の作成リクエストが受理されたか確認できません。公式ページで状態を確認してから、必要な場合にもう一度作成してください。';
      if (value === 'limited') return '前回、ニコニコが短時間の作成リクエストを制限しました。時間をおいてから再度作成するか、「この範囲を端末で作成」を選べます。';
      const secondsLeft = Math.ceil((Number(value) - Date.now()) / 1000);
      if (secondsLeft > 0) {
        retryAt = Number(value);
        win.clearTimeout(retryTimer);
        retryTimer = win.setTimeout(() => {
          if (phase === 'edit' && !lifetime.signal.aborted) state('edit', createNotice() || 'もう一度作成を試せます。');
        }, Math.min(retryAt - Date.now() + 1, 2147483647));
        return 'ニコニコからの再試行の目安はあと' + secondsLeft + '秒です。「この範囲を端末で作成」も選べます。';
      }
      setCreateNotice('');
      return '';
    }
    const beginDiagnostic = operation => typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin(operation, videoId, 'response', () => !lifetime.signal.aborted);
    async function request(operation, path, method = 'GET', fields) {
      const abort = new win.AbortController();
      const stop = () => abort.abort();
      if (lifetime.signal.aborted) throw new Error('closed');
      // Closing the panel cannot revoke a submitted POST. Retain its response
      // long enough to obtain the server ID and resume with a GET on reopen.
      if (operation !== 'clip-create') lifetime.signal.addEventListener('abort', stop, {once:true});
      const ticket = beginDiagnostic(operation);
      let timedOut = false, diagnostic = {kind:'network'};
      const timeout = win.setTimeout(() => { timedOut = true; stop(); }, 20000);
      try {
        const headers = {'Accept':'application/json', 'X-Frontend-Id':'6', 'X-Frontend-Version':'0'};
        if (method !== 'GET') headers['X-Request-With'] = win.location.origin;
        const options = {method, headers, credentials:'include', cache:'no-store', signal:abort.signal};
        if (fields) options.body = new win.URLSearchParams(fields);
        const response = await win.fetch(base + path, options);
        if (abort.signal.aborted) throw new Error('interrupted');
        if (response.ok && response.status === 204 && (operation === 'clip-delete' || operation === 'clip-post')) {
          ticket?.success();
          return;
        }
        let envelope;
        try { envelope = await response.json(); }
        catch (_) { if (response.ok) { diagnostic = schema('json'); throw new Error('invalid response'); } }
        if (abort.signal.aborted) throw new Error('interrupted');
        if (!response.ok || !Number.isInteger(envelope?.meta?.status) ||
            envelope.meta.status < 200 || envelope.meta.status >= 300) {
          const error = new Error(envelope?.meta?.errorCode === 'USER_LIMIT_EXCEEDED' ? 'USER_LIMIT_EXCEEDED' : 'request failed');
          error.httpStatus = response.ok ? envelope?.meta?.status : response.status;
          if (error.httpStatus === 429 || error.message === 'USER_LIMIT_EXCEEDED') {
            const wait = response.headers?.get?.('Retry-After');
            const retry = /^\d+$/.test(wait || '') ? Date.now() + Number(wait) * 1000 : Date.parse(wait);
            if (Number.isFinite(retry) && retry > Date.now()) error.retrySeconds = Math.ceil((retry - Date.now()) / 1000);
          }
          const statusCode = error.httpStatus;
          if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) diagnostic = schema('meta.status');
          else if ([401,403,404,429].includes(statusCode) || error.message === 'USER_LIMIT_EXCEEDED' ||
              (operation === 'clip-post' && [400,422].includes(statusCode))) diagnostic = ignored;
          else diagnostic = statusCode === 408 ? {kind:'timeout', statusCode} : {statusCode};
          throw error;
        }
        const issue = responseIssue(operation, envelope.data, Date.now() >= deadline);
        if (issue?.kind === 'schema') { diagnostic = issue; throw new Error('invalid response'); }
        if (issue) ticket?.failure(issue); else ticket?.success();
        return envelope.data;
      } catch (error) {
        ticket?.failure(timedOut ? {kind:'timeout'} : diagnostic);
        throw error;
      } finally {
        win.clearTimeout(timeout);
        lifetime.signal.removeEventListener('abort', stop);
      }
    }

    function permissionMessage(data) {
      if (!data || typeof data.isLogin !== 'boolean') return 'ニコニコの公式投稿を利用できるか確認できません。';
      if (data.isClipTweetAllowedVideo === false) return 'ニコニコでは、この動画の公式クリップ投稿を利用できません。';
      if (!data.isLogin) return '公式投稿にはニコニコへのログインとXアカウント連携が必要です。';
      if (data.twitterLinkage?.isLinked !== true) return '公式投稿には、ニコニコの視聴ページでXアカウントの連携が必要です。';
      if (data.isClipTweetAllowed !== true) return 'ニコニコでは、この動画またはアカウントの公式クリップ投稿を利用できません。';
      return '';
    }
    async function load() {
      if (!videoId || limit < 3) {
        state('denied', '公式クリップには長さ3秒以上のニコニコ動画が必要です。');
        return;
      }
      state('checking', 'ニコニコに公式投稿の利用状況を確認しています…');
      try {
        const permission = await request('clip-permission', source + '/tweet-possibility');
        if (lifetime.signal.aborted) return;
        const reason = permissionMessage(permission);
        if (reason) { state('denied', reason); return; }
        account = permission.twitterLinkage.screenName || '';
        find('account').textContent = account ? '投稿先　@' + account : '連携した X アカウントに投稿';
        find('editor').hidden = false;
        recordKey = 'zenzaWatch:officialClip:' + videoId + ':' + account;
        if (pendingCreations.has(recordKey)) {
          state('creating', '先ほどの作成リクエストの結果を確認しています…');
          await pendingCreations.get(recordKey).catch(() => {});
          if (lifetime.signal.aborted) return;
        }
        const previous = saved();
        // An unconfirmed publication must always resume its result check. A newly
        // selected range otherwise starts a fresh draft, even if an old preview exists.
        const sameRange = previous && seconds(Number(previous.start)) === initialStart && seconds(Number(previous.end)) === initialEnd;
        if (previous && (!hasEnd || sameRange || previous.kind === 'post')) {
          createRequested = true;
          clipId = previous.id;
          start.value = String(seconds(Number(previous.start)));
          end.value = String(seconds(Number(previous.end)));
          draft.value = previous.text;
          if (previous.kind === 'posted') state('posted', 'X にクリップをポストしました。');
          else {
            task = previous.kind;
            deadline = Date.now() + pollLimit;
            void poll();
          }
        } else state('edit', createNotice());
        let licensed;
        try { licensed = (await request('clip-license', source + '/license'))?.isUseLicensedMusic; } catch (_) { /* report uncertainty below */ }
        if (lifetime.signal.aborted) return;
        const note = find('license');
        note.hidden = licensed === false;
        note.textContent = licensed === true ? '権利楽曲利用の可能性があるため、クリップは映像のみになります。' :
          '音声の利用可否は、作成したクリップのプレビューで確認してください。';
        if (autoPreview && !createRequested && !createNotice() && licensed === false && phase === 'edit' && validRange()) create.click();
      } catch (_) {
        state('denied', 'ニコニコの公式投稿を利用できるか確認できません。');
      }
    }
    const clipPath = () => '/clips/' + encodeURIComponent(clipId);
    function uncertain() {
      if (task === 'post') state('postUnknown', '投稿結果を確認できません。「状態を再確認」で結果を確認してください。');
      else state('clipUnknown', '生成状況を確認できません。「状態を再確認」で確認してください。');
    }
    async function poll() {
      if (lifetime.signal.aborted) return;
      const posting = task === 'post';
      state(posting ? 'posting' : 'generating', posting ? 'X への投稿結果を確認しています…' : 'クリップを生成しています…');
      try {
        const result = await request(posting ? 'clip-post-status' : 'clip-status', clipPath() + (posting ? '/x-post' : ''));
        if (lifetime.signal.aborted) return;
        if (result?.status === 'DONE') {
          if (posting) {
            // A confirmed publication also resolves a lost POST acknowledgement, without resending the body.
            beginDiagnostic('clip-post')?.success();
            remember('posted'); state('posted', 'X にクリップをポストしました。'); return;
          }
          const uri = new URL(result.clipUri);
          if (uri.protocol !== 'https:') throw new Error('preview');
          preview.src = uri.href;
          preview.hidden = false;
          state('preview', '作成したクリップと投稿本文を確認してください。');
          return;
        }
        if (result?.status === 'FAILED' || result?.status === 'ERROR') {
          if (posting) state('postFailed', Object.hasOwn(postFailures, result.failureReason) ? postFailures[result.failureReason] : 'X への投稿に失敗しました。');
          else state('clipError', 'クリップの生成に失敗しました。');
          return;
        }
        if (!result?.status || (!posting && !['WAITING', 'GENERATING'].includes(result.status)) ||
            Date.now() >= deadline) { uncertain(); return; }
        timer = win.setTimeout(poll, pollInterval);
      } catch (error) {
        if (!lifetime.signal.aborted && !posting && [404,410].includes(error.httpStatus)) {
          startAnother();
          state('edit', '前回のプレビューはニコニコで利用できなくなりました。区間を確認して新しく作成できます。');
        } else uncertain();
      }
    }
    create.onclick = async () => {
      if (phase !== 'edit' || !validRange() || pendingCreations.has(recordKey)) return;
      createRequested = true;
      state('creating', 'クリップの作成をリクエストしています…');
      setCreateNotice('unconfirmed');
      const creation = request('clip-create', source + '/clips', 'POST', {
        startTime:String(Math.round(start.valueAsNumber * 1000)), endTime:String(Math.round(end.valueAsNumber * 1000))
      }).then(result => {
        clipId = result.clipId;
        remember('clip');
        setCreateNotice('');
      }).catch(error => {
        if (error.httpStatus === 429 || error.message === 'USER_LIMIT_EXCEEDED') {
          setCreateNotice(error.retrySeconds ? String(Date.now() + error.retrySeconds * 1000) : 'limited');
        } else if (error.httpStatus >= 400 && error.httpStatus < 500 && ![408,409].includes(error.httpStatus)) {
          setCreateNotice('');
        }
        throw error;
      }).finally(() => pendingCreations.delete(recordKey));
      pendingCreations.set(recordKey, creation);
      try {
        await creation;
        if (lifetime.signal.aborted) return;
        task = 'clip';
        deadline = Date.now() + pollLimit;
        await poll();
      } catch (error) {
        if (error.httpStatus === 429 || error.message === 'USER_LIMIT_EXCEEDED') state('edit', createNotice());
        else if (error.httpStatus === 401 || error.httpStatus === 403) {
          state('denied', 'ニコニコで公式クリップを作成できません。ログイン、X連携、動画の共有設定を確認してください。');
        } else state('createUnknown', 'ニコニコでのクリップ作成結果を確認できません。');
      }
    };
    post.onclick = async () => {
      if (phase !== 'preview' || !draft.value.trim()) return;
      const body = draft.value;
      state('posting', 'ニコニコで投稿先アカウントを確認しています…');
      try {
        const permission = await request('clip-permission', source + '/tweet-possibility');
        if (lifetime.signal.aborted) return;
        const denied = permissionMessage(permission);
        if (denied || account !== (permission.twitterLinkage.screenName || '')) {
          state('postFailed', denied || '連携アカウントが変更されています。共有画面を開き直してください。');
          return;
        }
      } catch (_) {
        state('preview', 'ニコニコの公式投稿を利用できるか確認できません。まだ投稿していません。');
        return;
      }
      task = 'post';
      remember('post');
      deadline = Date.now() + pollLimit;
      state('posting', 'X にクリップを送信しています…');
      try { await request('clip-post', clipPath() + '/x-post', 'POST', {text:body}); }
      catch (error) {
        if (lifetime.signal.aborted) return;
        if (error.httpStatus >= 400 && error.httpStatus < 500 && error.httpStatus !== 408 && error.httpStatus !== 409) {
          task = 'clip';
          remember('clip');
          if (error.httpStatus === 400 || error.httpStatus === 422) state('preview', '投稿が受理されませんでした。本文の長さや内容を確認して修正してください。');
          else if (error.httpStatus === 429) state('preview', 'X の利用上限に達しました。時間をおいてからお試しください。');
          else state('postFailed', '投稿が受理されませんでした。公式の視聴ページで連携と利用条件を確認してください。');
        } else uncertain();
        return;
      }
      await poll();
    };
    check.onclick = () => {
      if (!['postUnknown', 'clipUnknown'].includes(phase)) return;
      deadline = Date.now() + pollLimit;
      void poll();
    };
    function startAnother() {
      remember(null);
      clipId = null;
      preview.hidden = true;
      preview.removeAttribute('src');
      if (hasEnd) {
        start.value = String(initialStart);
        end.value = String(initialEnd);
      }
      state('edit', '新しい区間を選んでください。');
    }
    again.onclick = () => { if (phase === 'posted') startAnother(); };
    discard.onclick = async () => {
      if (!clipId || discard.hidden) return;
      const previous = phase;
      state('discarding', 'クリップを削除しています…');
      try {
        await request('clip-delete', clipPath(), 'DELETE');
        if (lifetime.signal.aborted) return;
        startAnother();
      } catch (_) { state(previous, '削除結果を確認できません。公式の視聴ページで確認してください。'); }
    };
    void load();
    return () => {
      lifetime.abort();
      win.clearTimeout(timer);
      win.clearTimeout(retryTimer);
      if (!preview.paused) preview.pause();
      preview.removeAttribute('src');
      if (preview.currentSrc) preview.load();
    };
  }
  return {mount};
})();
//===END===
export {ShareOfficialClip};

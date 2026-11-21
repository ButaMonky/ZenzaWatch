'use strict';
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {beginSection} = require('../helpers/extractSource');

describe('完成クリップの一時保管', () => {
  let w, jobs, mount, file, urls, now;
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const minute = 60000;
  const q = selector => w.document.querySelector(selector);
  const checkAfter = minutes => {
    now += minutes * minute;
    w.document.dispatchEvent(new w.Event('visibilitychange'));
  };
  beforeEach(() => {
    w = new JSDOM('<main></main>',{url:'https://www.nicovideo.jp',runScripts:'outside-only'}).window;
    now = 100;
    w.Date.now = () => now;
    urls = new Map();
    let sequence = 0;
    w.URL.createObjectURL = blob => {
      const url = 'blob:fixture-'+(++sequence);
      urls.set(url,blob);
      return url;
    };
    w.URL.revokeObjectURL = url => urls.delete(url);
    w.HTMLMediaElement.prototype.pause = w.HTMLMediaElement.prototype.load = () => {};
    file = new w.File(['fixture'],'original.mp4',{type:'video/mp4'});
    const clipboard = w.eval(beginSection('src/ShareClipClipboard.js') + '\nShareClipClipboard');
    w.ShareClipClipboard = {...clipboard,copyUnavailableReason:() => ''};
    w.ShareClipTimeline = {mount:() => ({stopPreview(){},refresh(){},dispose(){}})};
    const api = w.eval(['ShareClipQueue','ShareClipJobs','ShareClipPreferences','ShareLocalClip'].map(name =>
      beginSection('src/'+name+'.js')).join('\n')+'\n;({jobs:ShareClipJobs,editor:ShareLocalClip})');
    jobs = api.jobs;
    mount = (options = {}) => api.editor.mount(q('main'), options);
  });
  afterEach(() => w.close());

  it('コメント準備を待つ間に動画を切り替えても元の映像を取得し、中止後に届いた描画データは解放する', async () => {
    let currentVideo = '選んだ動画', captured, finishLayout, disposed = 0;
    const job = jobs.start({name:'クリップ',from:0,to:3,
      prepareRenderer:() => new Promise(resolve => {finishLayout = resolve;}),
      getBlob:() => {captured = currentVideo; return file;}});
    currentVideo = '別の動画';
    assert.equal(captured,'選んだ動画');
    jobs.cancel();
    finishLayout({drawFrame(){},dispose(){disposed++;}});
    await flush();
    assert.equal(job.state,'cancelled');
    assert.equal(disposed,1);
    assert.equal(job.file,undefined);
  });

  it('編集中と閉じた後のどちらでも完了か失敗を一度だけ通知し、下書きの本文を履歴に含めない', async () => {
    const notices = [];
    const notify = (message, level) => notices.push([message,level]);
    const stop = jobs.subscribe(() => {});
    jobs.completeRecording({name:'最初の動画',shareText:'個人の下書き',file,
      draft:{complete:async () => {}},onBackgroundFinish:notify});
    await flush();
    assert.equal(notices.length,1);
    assert.match(notices[0][0],/最初の動画.*下書きに動画を添付しました/);
    assert.equal(notices[0][1],'info');
    stop();
    const next = jobs.reserveRecording({name:'次の動画',onCancel(){},onBackgroundFinish:notify});
    next({reason:'映像を取得できませんでした。'});
    next({reason:'重複する完了イベント'});
    await flush();
    assert.equal(notices.length,2);
    assert.match(notices[1][0],/次の動画.*映像を取得できませんでした/);
    assert.equal(notices[1][1],'error');
    assert(!JSON.stringify(notices).includes('個人の下書き'));
  });

  it('完成表示に失敗しても自動転送と他の画面への通知を続ける', async () => {
    const error = new w.TypeError('完成画面の描画エラー');
    const reported = [], sent = [], states = [];
    w.reportError = value => reported.push(value);
    jobs.subscribe(() => { throw error; });
    jobs.subscribe(task => states.push(task?.state));
    jobs.completeRecording({name:'元動画',file,draft:{complete:async value => sent.push(value)}});
    await flush();
    assert(reported.includes(error));
    assert(states.includes('ready'));
    assert.deepEqual(sent,[file]);
  });

  it('区間の再生・操作後に5分間保存でき、期限を過ぎたら表示とURLを一緒に解放する', async () => {
    const close = mount();
    jobs.completeRecording({name:'元動画',file});
    await flush();
    q('[data-editor-page=result]').click();
    const link = q('a[download]'), preview = q('[data-role=preview]');
    const result = q('[data-role=result]');
    const url = link.href;
    let task;
    jobs.subscribe(value => { if (value) task = value; })();
    assert.strictEqual(urls.get(url),file);
    checkAfter(4);
    result.dispatchEvent(new w.Event('pointerdown'));
    checkAfter(4);
    Object.defineProperty(preview,'paused',{configurable:true,value:false});
    preview.dispatchEvent(new w.Event('play'));
    checkAfter(10);
    assert.strictEqual(urls.get(url),file);
    Object.defineProperty(preview,'paused',{value:true});
    preview.dispatchEvent(new w.Event('pause'));
    checkAfter(4);
    assert.strictEqual(task.file,file);
    checkAfter(1);
    assert(!task.file && !link.hasAttribute('href') && !preview.hasAttribute('src'));
    assert(result.hidden && !urls.size);
    assert.match(q('[role=status]').textContent,/保管期限/);
    close();
  });

  it('閉じた編集画面はURLを直ちに解放し、休止から復帰したタブは期限切れの結果を再表示しない', async () => {
    jobs.completeRecording({name:'元動画',file});
    let close = mount();
    await flush();
    close();
    assert.equal(urls.size,0);
    now += 4*minute;
    close = mount();
    await flush();
    q('[data-editor-page=result]').click();
    assert(q('a[download]').hasAttribute('href'));
    close();
    now += 6*minute; // A suspended tab has not run its timeout or visibility handler.
    close = mount();
    assert(!q('a[download]').hasAttribute('href') && !urls.size);
    close();
  });

  it('Xの下書きだけを開く場合も背面設定と完成時の本文を渡す', async () => {
    let opened, background;
    w.ShareClipClipboard.copyUnavailableReason = () => '手動添付';
    w.ShareClipClipboard.reserveDraft = (trusted,flag) => {
      assert.equal(trusted,true);
      background = flag;
      return {openText:async text => { opened = text; }};
    };
    const close = mount();
    jobs.completeRecording({file,shareText:'保存された本文'});
    q('[data-editor-page=result]').click();
    const event = {isTrusted:true,preventDefault() {}};
    q('[data-action=post-x]').onclick(event);
    await flush();
    assert.equal(opened,'保存された本文');
    assert.equal(background,true);
    close();
  });

  it('手動コピーの応答がなくても待機タブと保存期限を解放し、遅い応答で下書きを開かない', async () => {
    const close = mount({qualityConfig:{getValue:key => key === 'shareClip.backgroundTab' ? false : undefined}});
    jobs.completeRecording({file});
    q('[data-editor-page=result]').click();
    const button = q('[data-action=copy-for-x]'), link = q('[data-action=post-x]');
    const draft = {location:{href:'about:blank'},document:w.document.implementation.createHTMLDocument(),close() { this.closed = true; }};
    let finishWrite, expire;
    w.open = () => draft;
    w.ShareClipClipboard.copy = () => new Promise(resolve => { finishWrite = resolve; });
    const timer = w.setTimeout;
    w.setTimeout = (fn,ms,...args) => {
      if (ms === 30000) expire = fn;
      return timer(fn,ms,...args);
    };
    link.onclick({isTrusted:true,preventDefault(){}});
    assert.equal(button.disabled,true);
    assert.equal(typeof expire,'function');
    expire();
    await flush();
    assert.equal(draft.closed,true);
    assert.equal(button.disabled,false);
    assert.match(q('[role=status]').textContent,/30秒.*動画を保存/);
    const message = q('[role=status]').textContent;
    finishWrite();
    await flush();
    assert.equal(q('[role=status]').textContent,message);
    checkAfter(5);
    assert.equal(jobs.results.length,0);
    close();
  });

  it('休止中に期限を過ぎたコピーでは利用者が別ページへ移動したタブを操作しない', async () => {
    const close = mount({qualityConfig:{getValue:key => key === 'shareClip.backgroundTab' ? false : undefined}});
    jobs.completeRecording({file});
    q('[data-editor-page=result]').click();
    let finishWrite, navigated = false, closed = false;
    const draft = {location:{href:'about:blank'},document:w.document.implementation.createHTMLDocument(),close() { closed = true; }};
    w.open = () => draft;
    w.ShareClipClipboard.copy = () => new Promise(resolve => { finishWrite = resolve; });
    q('[data-action=post-x]').onclick({isTrusted:true,preventDefault(){}});
    draft.location.href = 'https://www.nicovideo.jp/other';
    draft.document = {createElement:() => ({click() { navigated = true; }})};
    now += minute;
    finishWrite();
    await flush();
    assert.equal(navigated,false);
    assert.equal(closed,false);
    assert.match(q('[role=status]').textContent,/30秒/);
    close();
  });

  it('Xへの添付処理と失敗後の手動保存時間を確保し、古い利用者は新しい結果の期限を延ばさない', async () => {
    for (const success of [false,true]) {
      let settle, task;
      jobs.completeRecording({name:'元動画',file,draft:{complete:() => new Promise((resolve,reject) => {
        settle = success ? resolve : () => reject(Error('転送失敗'));
      })}});
      jobs.subscribe(value => {task = value;})();
      checkAfter(8);
      assert.strictEqual(task.file,file);
      settle(); await flush(); checkAfter(4);
      assert.strictEqual(task.file,file);
      assert.match(task.draftMessage,success ? /添付しました/ : /転送失敗/);
      checkAfter(1);
      assert(!task.file);
    }
    jobs.completeRecording({file});
    let task;
    jobs.subscribe(value => {task=value;})();
    const previous = task, release = jobs.hold(task);
    jobs.completeRecording({file});
    jobs.subscribe(value => {task=value;})();
    checkAfter(4);
    release();
    checkAfter(1);
    assert.strictEqual(previous.file,file);
    assert(!task.file);
    checkAfter(4);
    assert(!previous.file);
  });

  it('録画と下書き転送が終わるまで後の変換を待ち、予約時の映像を使う', async () => {
    const first = jobs.reserveRecording({name:'先の録画'});
    let source = file, captured, conversions = 0, finishDraft;
    w.ShareFastClip = {convert:async () => { conversions++; throw Error('テスト用の変換終了'); }};
    const second = jobs.start({name:'後の動画',from:0,to:3,getBlob() { captured = source; return captured; }});
    source = null;
    assert.equal(captured,file);
    assert.equal(second.state,'queued');
    first({file,draft:{complete:() => new Promise(resolve => {finishDraft=resolve;})}});
    await flush();
    assert.equal(conversions,0);
    finishDraft();
    await flush();
    assert.equal(conversions,1);
    assert.equal(second.state,'failed');
    assert.strictEqual(jobs.results[0].file,file);
  });

  it('待機中に取り消した動画は変換せず、遅れて届く描画データと下書きを解放する', async () => {
    const first = jobs.reserveRecording({name:'録画中'});
    let releaseRenderer, disposeCount = 0, cancelledDrafts = 0;
    const queued = jobs.start({name:'取り消す予約',from:0,to:3,getBlob:() => file,
      prepareRenderer:() => new Promise(resolve => { releaseRenderer = resolve; }),
      draft:{cancel() { cancelledDrafts++; }}});
    assert.equal(queued.state,'queued');
    assert(jobs.cancel(queued));
    releaseRenderer({drawFrame(){},dispose() { disposeCount++; }});
    const next = jobs.reserveRecording({name:'次の予約'});
    assert.equal(next.task.state,'queued');
    assert(jobs.cancel(next.task));
    assert.equal(await next.started,false);
    await flush();
    assert.equal(queued.state,'cancelled');
    assert.equal(disposeCount,1);
    assert.equal(cancelledDrafts,1);
    assert.equal(jobs.tasks.length,1);
    first({file});
    await flush();
    assert.equal(jobs.results.length,1);
  });

  it('X側が完了を返さなくても転送の上限で次の予約へ進み、完成したMP4と停止箇所を残す', async () => {
    let cancelled = 0, expire, attempts = 0;
    const notices = [];
    const timer = w.setTimeout;
    w.setTimeout = (fn,delay,...args) => {
      if (delay === 10 * minute) expire = fn;
      return timer(fn,delay,...args);
    };
    const first = jobs.reserveRecording({name:'最初',onBackgroundFinish:(...value) => notices.push(value)});
    const next = jobs.reserveRecording({name:'次'});
    first({file,draft:{
      complete(_,text,progress) {
        attempts++;
        progress('draft-attach',42);
        return new Promise(() => {});
      },
      cancel() { cancelled++; }
    }});
    await flush();
    assert.match(first.task.draftMessage,/42%/);
    assert.equal(next.task.state,'queued');
    assert.equal(typeof expire,'function');
    expire();
    assert.equal(await next.started,true);
    assert.equal(attempts,1);
    assert.equal(cancelled,1);
    assert.equal(first.task.file,file);
    assert.equal(first.task.draft,null);
    assert.equal(notices.length,1);
    assert.equal(notices[0][2],'draft-attach');
    assert.equal(notices[0][3],'draft-transfer-timeout');
    next({file});
    await next.task.ticket.done;
  });

  it('Xへの引き渡し後は次の予約を待たせ、進捗で延長できない上限でMP4を残す',async()=>{
    const timers = new Map(), notices = [];
    const set = w.setTimeout, clear = w.clearTimeout;
    w.setTimeout = (fn,ms,...args) => { const id=set(fn,ms,...args); timers.set(id,{fn,ms}); return id; };
    w.clearTimeout = id => { timers.delete(id); clear(id); };
    let report, starts=0;
    const first=jobs.reserveRecording({name:'先に作成',onBackgroundFinish:(...args)=>notices.push(args)});
    const next=jobs.reserveRecording({name:'後から作成'});
    first({file,draft:{complete(_,text,progress) {
      starts++;report=progress;
      return new Promise(()=>{});
    }}});
    await flush();
    report('draft-attach',100);
    assert([...timers.values()].some(t=>t.ms===10*minute));
    report('draft-received');
    const cap=[...timers.values()].find(t=>t.ms===21*minute);
    assert(cap);
    assert(![...timers.values()].some(t=>t.ms===10*minute));
    report('draft-prepare',26);
    report('draft-prepare',65);
    assert.equal(next.task.state,'queued');
    assert([...timers.values()].includes(cap));
    cap.fn();
    assert.equal(await next.started,true);
    assert.equal(notices[0][3],'draft-media-limit');
    assert.equal(starts,1);
    assert.equal(first.task.file,file);
    next({file});
    await next.task.ticket.done;
  });

  for (const [reason,level] of [['draft-media-timeout','warning'],['draft-media-rejected','error']]) {
    it('Xに動画を渡した後の準備結果を記録し、完成したMP4を残す ' + reason, async () => {
      const notices = [], stages = [];
      file = new w.File([new Uint8Array(1572864)],'fixture.mp4',{type:'video/mp4'});
      let rejectMedia;
      jobs.subscribe(task => { if (task?.draftMessage) stages.push(task.draftMessage); });
      jobs.completeRecording({name:'元動画',file,onBackgroundFinish:(...args) => notices.push(args),draft:{
        complete(_,text,progress) {
          progress('draft-attach',100);
          checkAfter(1);
          progress('draft-received');
          progress('draft-prepare');
          progress('draft-prepare',26);
          progress('draft-prepare',17);
          return new Promise((resolve,reject) => {rejectMedia=reject;});
        }
      }});
      await flush();
      assert(stages.some(message => /添付欄.*渡し/.test(message)));
      assert(stages.some(message => /X.*動画.*準備中/.test(message) && message.includes('1.5 MiB')));
      assert(stages.at(-1).includes('Xのアップロード26%') && stages.at(-1).includes('1.5 MiB'));
      assert(!stages.some(message => message.includes('Xのアップロード100%')));
      checkAfter(6);
      rejectMedia(Object.assign(Error('Xの動画準備結果'),{stage:'draft-prepare',reason}));
      await flush();
      assert.equal(jobs.results[0].file,file);
      assert.equal(jobs.results[0].draftFailureStage,'draft-prepare');
      assert.deepEqual(notices[0].slice(1,4),[level,'draft-prepare',reason]);
      assert.deepEqual({...notices[0][4]},{fileBytes:1572864,elapsedMs:6*minute,lastStage:'draft-received',uploadPercent:26});
    });
  }

  it('一方の完成動画を削除しても、もう一方のダウンロードを開ける', async () => {
    const close = mount();
    const second = new w.File(['second'],'second.mp4',{type:'video/mp4'});
    jobs.completeRecording({name:'最初',file});
    jobs.completeRecording({name:'二番目',file:second});
    await flush();
    q('[data-editor-page=result]').click();
    assert.strictEqual(urls.get(q('a[download]').href),second);
    jobs.discard(jobs.results[1]);
    q('[data-editor-page=result]').click();
    assert.strictEqual(urls.get(q('a[download]').getAttribute('href')),file);
    assert.equal(jobs.results.length,1);
    close();
    assert.equal(urls.size,0);
  });

  it('バックグラウンド変換と独立録画にも同じ期限を適用し、失敗時はファイルを保持しない', async () => {
    const create = w.document.createElement.bind(w.document);
    w.document.createElement = tag => {
      assert.notEqual(tag,'video','hidden source must not depend on a media element to publish its output');
      return create(tag);
    };
    let checked;
    w.ShareFastClip = {convert:async () => file,checkOutput:async (output,duration,signal) => {
      checked = [output,duration,signal.aborted];
    }};
    const encoded = jobs.start({name:'clip',from:0,to:3,getBlob:async () => file});
    await flush();
    assert.equal(encoded.state,'ready');
    assert.deepEqual(checked,[encoded.file,3,false]);
    assert.equal(urls.size,0);
    checkAfter(5);
    assert(!encoded.file);
    const finish = jobs.reserveRecording({name:'recorded',onCancel(){}});
    finish({file});
    await flush();
    let recorded;
    jobs.subscribe(value => {recorded = value;})();
    checkAfter(5);
    assert(!recorded.file);
    const bad = jobs.start({from:0,to:3,getBlob:async () => null});
    await flush();
    assert.equal(bad.state,'failed');
    assert(!bad.file && !urls.size);
  });
});

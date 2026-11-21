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
    w.ShareClipClipboard = {copyUnavailableReason:() => ''};
    w.ShareClipTimeline = {mount:() => ({stopPreview(){},refresh(){},dispose(){}})};
    const api = w.eval(['ShareClipJobs','ShareClipPreferences','ShareLocalClip'].map(name =>
      beginSection('src/'+name+'.js')).join('\n')+'\n;({jobs:ShareClipJobs,editor:ShareLocalClip})');
    jobs = api.jobs;
    mount = () => api.editor.mount(q('main'));
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
    assert.equal(notices.length,2);
    assert.match(notices[1][0],/次の動画.*映像を取得できませんでした/);
    assert.equal(notices[1][1],'warning');
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
    assert(q('a[download]').hasAttribute('href'));
    close();
    now += 6*minute; // A suspended tab has not run its timeout or visibility handler.
    close = mount();
    assert(!q('a[download]').hasAttribute('href') && !urls.size);
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
    assert(!previous.file && !task.file);
  });

  it('バックグラウンド変換と独立録画にも同じ期限を適用し、失敗時はファイルを保持しない', async () => {
    const create = w.document.createElement.bind(w.document);
    w.document.createElement = tag => {
      const element = create(tag);
      if (tag === 'video') {
        Object.defineProperties(element,{videoWidth:{value:320},duration:{value:3}});
        queueMicrotask(() => element.onloadedmetadata?.());
      }
      return element;
    };
    w.ShareFastClip = {convert:async () => file};
    const encoded = jobs.start({name:'clip',from:0,to:3,getBlob:async () => file});
    await flush();
    assert.equal(encoded.state,'ready');
    assert.equal(urls.size,0,'probe URL released');
    checkAfter(5);
    assert(!encoded.file);
    const finish = jobs.reserveRecording({name:'recorded',onCancel(){}});
    finish({file});
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

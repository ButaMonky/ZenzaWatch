'use strict';
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {beginSection} = require('../helpers/extractSource');

describe('予約中のクリップ編集', () => {
  it('処理中も別区間をプレビューし、待機中の1件だけを取り消し、完成結果を個別に開ける', async () => {
    const w = new JSDOM('<main></main>', {url:'https://www.nicovideo.jp',runScripts:'outside-only'}).window;
    const next = () => new Promise(resolve => setImmediate(resolve));
    try {
      const q = selector => w.document.querySelector(selector);
      const video = w.document.createElement('video');
      Object.defineProperties(video,{duration:{value:30},videoWidth:{value:640},videoHeight:{value:360}});
      w.HTMLMediaElement.prototype.pause = w.HTMLMediaElement.prototype.load = () => {};
      const running = [];
      let message = '本文A', previewed = 0, sequence = 0;
      w.URL.createObjectURL = () => 'blob:test-' + ++sequence;
      w.URL.revokeObjectURL = () => {};
      w.ShareClipClipboard = {copyUnavailableReason:() => '', reserveDraft:() => ({cancel(){}})};
      w.ShareClipTimeline = {mount(host, {isPreviewActive}) {
        return {refresh(){},dispose(){},stopPreview(){},startPreview(){if (isPreviewActive()) previewed++;}};
      }};
      w.ShareFastClip = {acceptsHls:() => true, checkOutput:async () => {}, convert:options => new Promise(resolve => {
        running.push({options,finish:() => resolve(new w.Blob(['clip'],{type:'video/mp4'}))});
      })};
      const api = w.eval(['ShareClipQueue','ShareClipJobs','ShareClipPreferences','ShareLocalClip'].map(name =>
        beginSection('src/'+name+'.js')).join('\n')+'\n;({jobs:ShareClipJobs,editor:ShareLocalClip})');
      const cleanup = api.editor.mount(q('main'),{title:'動画A',getCurrentVideo:() => video,
        getCurrentHlsSource:() => 'fixture',getShareText:() => message});
      const submit = (from,text) => {
        message = text;
        assert(cleanup.setRange({start:from,end:from+2}));
        assert.equal(q('[data-action=create]').disabled,false);
        q('[data-action=create]').click();
      };
      submit(1,'本文A');
      await next();
      cleanup.startPreview();
      assert.equal(previewed,1);
      submit(5,'本文B');
      submit(10,'本文C');
      assert.equal(running.length,1);
      const queue = q('[data-role=clipQueue]');
      assert.match(queue.textContent,/実行中.*動画A（1〜3秒）.*待機中 2件/);
      queue.querySelectorAll('li button')[1].click();
      assert.equal(api.jobs.tasks.length,2);
      assert(cleanup.setRange({start:15,end:20}));
      running[0].finish(); await next();
      assert.equal(q('.zenzaLocalClip').dataset.page,'range');
      running[1].finish(); await next();
      assert.equal(q('[name=start]').valueAsNumber,15);
      assert.equal(q('.zenzaLocalClip').dataset.page,'range');
      assert.deepEqual(Array.from(api.jobs.results,t => [t.from,t.to,t.shareText]),[[1,3,'本文A'],[5,7,'本文B']]);
      q('[data-editor-page=result]').click();
      assert.equal(q('a[download]').download,'動画A_5-7.mp4');
      const choice = q('[data-role=completedClips]');
      choice.selectedIndex = 0;
      choice.dispatchEvent(new w.Event('change',{bubbles:true}));
      assert.equal(q('a[download]').download,'動画A_1-3.mp4');
      assert.equal(new URL(q('[data-action=post-x]').href).searchParams.get('text'),'本文A');
      cleanup();
    } finally { w.close(); }
  });
});

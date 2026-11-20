'use strict';
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {beginSection} = require('../helpers/extractSource');

describe('クリップの保存画質', () => {
  it('再生中の配信を選び、保存済みの上限画質・通信量優先も尊重する', async () => {
    const page = new JSDOM('<main></main>', {url:'https://www.nicovideo.jp',runScripts:'outside-only'});
    const w = page.window;
    const base = 'https://delivery.domand.nicovideo.jp/';
    const master = ['#EXTM3U', ...[
      [360,300,'360'], [720,1000,'720-high'], [720,750,'720-playing'], [144,100,'144']
    ].flatMap(([height,rate,name]) => ['#EXT-X-STREAM-INF:RESOLUTION=1280x'+height+',BANDWIDTH='+rate,name+'.m3u8'])].join('\n');
    const reads = [];
    w.fetch = async url => {
      reads.push(url);
      return {ok:true,text:async () => url.endsWith('master.m3u8') ? master :
        '#EXTM3U\n#EXT-X-TARGETDURATION:60\n#EXTINF:60,\nsegment.m4s\n#EXT-X-ENDLIST'};
    };
    w.HTMLMediaElement.prototype.pause = w.HTMLMediaElement.prototype.load = () => {};
    w.ShareFastClip = {acceptsHls:() => true};
    w.ShareClipClipboard = {reserveDraft:() => null};
    w.ShareClipTimeline = {mount:() => ({stopPreview(){},refresh(){},dispose(){}})};
    w.RequestDiagnostics = {begin:() => ({success(){},failure(){}})};
    let job;
    w.ShareClipJobs = {subscribe:() => () => {},start:options => { job = options; }};
    const api = w.eval(['ShareClipPreferences','ShareLocalClip','ShareHlsClipSource'].map(name =>
      beginSection('src/'+name+'.js')).join('\n')+'\n;({editor:ShareLocalClip,hls:ShareHlsClipSource})');
    const video = w.document.createElement('video');
    Object.defineProperties(video,{duration:{value:60},videoWidth:{value:640},videoHeight:{value:360}});
    const rendition = {height:720,uri:base+'720-playing.m3u8'};
    const media = {CustomPathedSource:class {},Input:class {}};
    try {
      for (const [saved,playing,expected] of [[undefined,rendition,'720-playing'],['360',rendition,'360'],
        ['low',rendition,'144'],['source',undefined,'360']]) {
        const host = w.document.querySelector('main');
        const cleanup = api.editor.mount(host,{getCurrentVideo:() => video,getCurrentHlsSource:() => base+'master.m3u8',
          getCurrentHlsRendition:() => playing,qualityConfig:{getValue:id => id === 'shareClip.exportQuality' ? saved : undefined}});
        job = undefined;
        host.querySelector('[data-action=create]').click();
        assert(job?.hls, host.querySelector('[role=status]').textContent || '編集画面から書き出しを開始できる');
        reads.length = 0;
        await api.hls.create(media,job.hls,job.from,job.to);
        assert.deepEqual(reads,[base+'master.m3u8',base+expected+'.m3u8']);
        cleanup();
      }
    } finally { w.close(); }
  });
});

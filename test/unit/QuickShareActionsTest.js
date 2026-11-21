const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {beginSection} = require('../helpers/extractSource');

describe('sharing without opening the editor', () => {
  let w, action, info, context, video, jobs, notices, reservations, requests;
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const source = name => beginSection('src/' + name + '.js');
  beforeEach(() => {
    w = new JSDOM('<body/>',{url:'https://www.nicovideo.jp/watch/sm9',runScripts:'outside-only'}).window;
    video = w.document.createElement('video');
    video.pause = () => assert.fail('quick share paused playback');
    Object.defineProperty(video,'duration',{value:48.75});
    jobs = []; notices = []; reservations = []; requests = [];
    info = {watchId:'sm9',videoId:'sm9',title:'元動画',duration:48};
    context = {config:{getValue:() => undefined},getCurrentHlsSource:() => 'original.m3u8',
      getCurrentHlsRendition:() => ({height:720,uri:'720.m3u8'}),getFragmentCache:() => 'cache'};
    w.ShareClipClipboard = {reserveDraft(trusted,background) {
      const draft = {trusted,background,cancel() {this.cancelled = true;}};
      reservations.push(draft); return draft;
    }};
    w.ShareClipJobs = {start:options => jobs.push(options)};
    w.ShareFastClip = {acceptsHls:url => url.endsWith('m3u8')};
    w.PopupMessage = Object.fromEntries(['alert','warning','notify'].map(key => [key,msg => notices.push(msg)]));
    w.textUtil = {secToTime:String};
    w.fetch = async (url,options) => {
      const path = new URL(url).pathname;
      requests.push({path,options});
      const data = path.endsWith('/tweet-possibility') ? {isLogin:true,isClipTweetAllowed:true,twitterLinkage:{isLinked:true,screenName:'Linked'}} :
        path.endsWith('/clips') ? {clipId:'nico-one'} : path.endsWith('/x-post') ? options.method === 'POST' ? {} : {status:'DONE'} :
        {status:'DONE',clipUri:'https://example.test/original.mp4'};
      return {ok:true,status:200,json:async () => ({meta:{status:200},data})};
    };
    action = w.eval(['ShareClipPreferences','ShareClipQueue','ShareOfficialClip','ShareLocalClip','VideoSharePanel'].map(source).join('\n') +
      '\nconst factory = createVideoSharePanel; let deliver; createVideoSharePanel = () => new Promise(ok => {deliver = () => ok(factory());});' +
      '\n({run:VideoSharePanel.quick,close:VideoSharePanel.close,ready:() => deliver()})');
  });
  afterEach(() => w.close());
  it('reserves the X draft while handling the gesture and exports the original full HLS range after lazy loading', async () => {
    action.run('shareZenzaFull',info,19,() => video,context);
    assert.equal(reservations.length,1);
    assert.equal(reservations[0].background,true);
    context.getCurrentHlsSource = () => 'replacement.m3u8';
    info.title = '次の動画';
    action.close();
    action.ready(); await flush();
    assert.equal(jobs.length,1);
    assert.deepEqual([jobs[0].name,jobs[0].from,jobs[0].to,jobs[0].hls.url,jobs[0].hls.height,jobs[0].draft],
      ['元動画',0,48.75,'original.m3u8',720,reservations[0]]);
    assert.equal(w.document.querySelector('dialog'),null);
  });
  it('keeps file and layer capture on the same cancellable job when the player changes during loading', async () => {
    const before = {video,source:'first.mp4'}, selected = [];
    context.config.getValue = key => key === 'shareClip.includeComments' ? true : undefined;
    context.getCurrentFileSource = () => before.source;
    context.getCurrentHlsSource = () => null;
    w.SharePlaybackFile = {get(v,src,options) { selected.push([v,src,options.signal]); return Promise.resolve(new w.Blob()); }};
    w.ShareClipRenderer = {create(options) { selected.push([options.video,options.from,options.to,options.signal]); return {drawFrame(){},dispose(){}}; }};
    action.run('shareZenzaFull',info,12,() => video,context);
    assert.equal(selected.length,2);
    before.source = 'other.mp4';
    video = w.document.createElement('video');
    action.close(); action.ready(); await flush();
    assert.equal(jobs[0].controller.signal,selected[0][2]);
    assert.deepEqual(selected[0].slice(0,2),[before.video,'first.mp4']);
    assert.deepEqual(selected[1],[before.video,0,48.75,jobs[0].controller.signal]);
    jobs[0].controller.abort();
    assert.equal(selected[0][2].aborted,true);
  });
  it('posts only the original remaining interval and skips a repeated submission', async () => {
    action.run('shareNicoNext30',info,37.125,() => video,context);
    info.watchId = info.videoId = 'sm10';
    action.close(); action.ready(); await flush();
    const posts = () => requests.filter(item => item.options.method === 'POST');
    assert.deepEqual(posts().map(item => item.path),['/v1/videos/sm9/clips','/v1/clips/nico-one/x-post']);
    assert.deepEqual([...posts()[0].options.body],[['startTime','37125'],['endTime','48750']]);
    action.run('shareNicoNext30',{...info,watchId:'sm9',videoId:'sm9'},37.125,() => video,context);
    await flush();
    assert.equal(posts().length,2);
    assert.equal(reservations.length,0);
    assert.equal(w.document.querySelector('dialog'),null);
  });
  it('does not create or post when fewer than three seconds remain', async () => {
    action.run('shareNicoNext30',info,47,() => video,context);
    await flush();
    assert.equal(requests.length,0);
    assert(notices.some(msg => msg.includes('3秒')));
  });
});

const assert = require('assert');
const {JSDOM} = require('jsdom');
const {beginSection} = require('../helpers/extractSource');

describe('official NicoNico clip sharing', () => {
  let page;
  let root;
  let calls;
  let cleanup;
  let reopen;
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const allowed = {isLogin: true, isClipTweetAllowedVideo: true, isClipTweetAllowed: true,
    twitterLinkage: {isLinked: true}, canOfferClip: true};
  function mount(reply, info = {watchId: '12345', videoId: 'sm9', duration: 40}, settings = {}) {
    page = new JSDOM('<section></section>', {url:'https://www.nicovideo.jp/ranking', runScripts:'outside-only'});
    root = page.window.document.querySelector('section');
    calls = [];
    page.window.fetch = async (url, options) => {
      calls.push({path: new URL(url).pathname, options});
      const data = await reply(calls[calls.length - 1]);
      if (data?.httpStatus) return {ok:false, status:data.httpStatus,
        headers:{get:key => key === 'Retry-After' ? data.retryAfter : null},
        json:async () => ({meta:{status:data.httpStatus,errorCode:data.errorCode}})};
      return {ok:true, status:200, json:async () => ({meta:{status:200}, data})};
    };
    const module = page.window.eval(beginSection('src/ShareOfficialClip.js') + '\nShareOfficialClip');
    reopen = () => {
      cleanup = module.mount(root, {info, startTime:39, text:()=>'選んだ場面',
        officialUrl:'https://www.nicovideo.jp/watch/12345?zenza_official=1&from=39', ...settings});
    };
    reopen();
  }
  const find = name => root.querySelector('[name="' + name + '"]');
  afterEach(() => { cleanup?.(); page?.window.close(); });
  it('joins an in-flight creation after closing and reuses the same millisecond range', async () => {
    let acknowledge;
    const settings = {startTime:6.00011,endTime:9.00014};
    mount(({path}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) return new Promise(resolve => { acknowledge = resolve; });
      return {status:'DONE',clipUri:'https://media.example/clip.mp4'};
    }, undefined, settings);
    await flush();
    assert.strictEqual(find('clipStart').value,'6');
    assert.strictEqual(find('clipEnd').value,'9');
    assert(calls.every(call => call.options.method === 'GET'));
    find('create').click(); await flush();
    assert.strictEqual(root.querySelector('[role=status]').dataset.busy,'true');
    const posted = calls.find(r => r.path.endsWith('/clips'));
    assert.strictEqual(posted.options.body.get('endTime'),'9000');
    cleanup(); settings.startTime=6.00023; reopen(); await flush();
    assert.strictEqual(posted.options.signal.aborted,false);
    acknowledge({clipId:'retained'}); await flush();
    assert.strictEqual(root.querySelector('video').hidden,false);
    assert.strictEqual(root.querySelector('[role=status]').dataset.busy,'false');
    assert.strictEqual(calls.filter(r => r.options.method === 'POST').length,1);
    assert.strictEqual(calls.filter(r => r.path.endsWith('/retained')).length,1);
  });
  it('honors a quota reply even when a delayed license check completes after the first click', async () => {
    let license, attempts=0;
    mount(({path}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return new Promise(resolve => { license = resolve; });
      if (path.endsWith('/clips')) { attempts++; return {httpStatus:429,retryAfter:'45'}; }
    });
    await flush(); find('create').click(); await flush();
    assert.match(root.querySelector('[role=status]').textContent,/あと4[45]秒/);
    assert.strictEqual(find('create').disabled,true);
    license({isUseLicensedMusic:false}); await flush();
    cleanup(); reopen(); await flush(); license({isUseLicensedMusic:false}); await flush();
    assert.match(root.querySelector('[role=status]').textContent,/再試行/);
    assert.strictEqual(attempts,1);
  });
  it('does not automatically repeat a creation with an unknown outcome on reopen', async () => {
    mount(({path}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) throw Error('connection interrupted');
    });
    await flush(); find('create').click(); await flush(); cleanup(); reopen(); await flush();
    assert.match(root.querySelector('[role=status]').textContent,/前回の作成/);
    assert.strictEqual(find('create').disabled,false);
    assert.strictEqual(calls.filter(r => r.options.method === 'POST').length,1);
  });
  it('offers to make a new clip when the previously saved preview has expired', async () => {
    let expired=false;
    mount(({path}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) return {clipId:'expires'};
      return expired ? {httpStatus:404} : {status:'DONE',clipUri:'https://media.example/clip.mp4'};
    });
    await flush(); find('create').click(); await flush(); cleanup(); expired=true; reopen(); await flush();
    assert.match(root.querySelector('[role=status]').textContent,/利用できなく/);
    assert.strictEqual(find('create').disabled,false);
    assert.strictEqual(calls.filter(r => r.options.method === 'POST').length,1);
  });
  it('waits for permission and disables creation for an unlinked or disallowed account', async () => {
    mount(() => ({...allowed, isClipTweetAllowed:false}));
    await flush();
    assert(find('create').disabled);
    find('create').click();
    assert(!calls.some(r => r.options.method === 'POST'));
    assert(root.querySelector('a').href.includes('from=39'));
  });
  it('can hand off the selected range before NicoNico has answered; no network mutation is required', async () => {
    let reply, range;
    mount(() => new Promise(resolve => { reply = resolve; }), undefined,
      {startTime:1.25, endTime:36.75, onUseLocal:selection => { range = selection; }});
    assert(!find('useLocal').hidden && !find('useLocal').disabled);
    find('useLocal').click();
    assert.deepStrictEqual([range.start, range.end], [1.25, 36.75]);
    reply({isLogin:false, isClipTweetAllowedVideo:true});
    await flush();
    assert.match(root.querySelector('[role=status]').textContent, /ニコニコ.*ログイン/);
    assert(!find('useLocal').disabled);
    assert.deepStrictEqual(calls.map(r => r.options.method), ['GET']);
  });
  for (const [label, permission, reason] of [
    ['unlinked', {...allowed, twitterLinkage:{isLinked:false}}, /X.*連携/],
    ['unsupported', {...allowed, isClipTweetAllowed:false}, /公式.*投稿/],
    ['unavailable', {httpStatus:503}, /確認できません/]
  ]) {
    it('returns to device editing when official posting is ' + label, async () => {
      let range;
      mount(() => permission, undefined, {startTime:38, endTime:40, onUseLocal:selection => { range = selection; }});
      await flush();
      assert(find('create').disabled);
      assert.match(root.querySelector('[role=status]').textContent, reason);
      find('useLocal').click();
      assert.deepStrictEqual([range.start, range.end], [38, 40]);
      assert(!calls.some(r => r.options.method !== 'GET'));
    });
  }
  it('uses the supplied end time and hands off edits when the service denies generation', async () => {
    let range;
    mount(({path}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      return {httpStatus:403};
    }, undefined, {startTime:8.125, endTime:12.625, onUseLocal:value => { range = value; }});
    await flush();
    assert.strictEqual(find('clipStart').value, '8.125');
    assert.strictEqual(find('clipEnd').value, '12.625');
    find('clipEnd').value = '16.75';
    find('clipEnd').dispatchEvent(new page.window.Event('input'));
    find('create').click(); await flush();
    assert.match(root.querySelector('[role=status]').textContent, /公式.*(投稿|作成)/);
    find('useLocal').click();
    assert.deepStrictEqual([range.start, range.end], [8.125, 16.75]);
    assert(!calls.some(r => r.path.endsWith('/x-post')));
  });
  it('can prepare a clip and preserves the selected range when metadata has no duration', async () => {
    let range;
    mount(({path}) => path.endsWith('/tweet-possibility') ? allowed : {isUseLicensedMusic:false},
      {watchId:'sm9', duration:0}, {startTime:4, endTime:20, onUseLocal:value => { range = value; }});
    await flush();
    assert.strictEqual(find('create').disabled, false);
    find('useLocal').click();
    assert.deepStrictEqual([range.start, range.end], [4, 20]);
    assert(calls.every(call => call.options.method === 'GET'));
  });
  for (const licensed of [false, true]) {
    it('prepares only the server preview after the explicit action, licensed music=' + licensed, async () => {
      mount(({path}) => {
        if (path.endsWith('/tweet-possibility')) return allowed;
        if (path.endsWith('/license')) return {isUseLicensedMusic:licensed};
        if (path.endsWith('/clips')) return {clipId:'new-clip'};
        return {status:'DONE', clipUri:'https://media.example/preview.mp4'};
      }, undefined, {startTime:5, endTime:14});
      await flush();
      cleanup(); reopen(); await flush();
      assert(calls.every(call => call.options.method === 'GET'));
      find('create').click(); await flush();
      assert.strictEqual(calls.filter(call => call.path.endsWith('/clips') && call.options.method === 'POST').length, 1);
      assert(!calls.some(call => call.path.endsWith('/x-post')));
    });
  }
  it('opens a newly chosen range even when a preview exists for a different range', async () => {
    const settings = {startTime:8, endTime:14};
    mount(({path}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) return {clipId:'previous'};
      return {status:'DONE', clipUri:'https://media.example/clip.mp4'};
    }, undefined, settings);
    await flush(); find('create').click(); await flush();
    cleanup(); settings.startTime = 16; settings.endTime = 20; reopen(); await flush();
    assert.strictEqual(find('clipStart').value, '16');
    assert.strictEqual(find('clipEnd').value, '20');
    assert(!find('create').disabled);
    assert(find('post').disabled);
  });
  it('clamps to the end and submits the chosen milliseconds and edited text only on explicit clicks', async () => {
    mount(({path, options}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:true};
      if (path.endsWith('/clips')) return {clipId:'draft-9'};
      if (path.endsWith('/x-post')) return options.method === 'POST' ? {} : {status:'DONE'};
      return {status:'DONE', clipUri:'https://media.example/clip.mp4'};
    });
    await flush();
    assert.strictEqual(find('clipStart').value, '37');
    assert.strictEqual(find('clipEnd').value, '40');
    assert.match(root.textContent, /映像のみ/);
    assert(find('post').disabled);
    find('create').click();
    find('create').click();
    await flush();
    assert.strictEqual(root.querySelector('video').src, 'https://media.example/clip.mp4');
    const create = calls.find(r => r.options.method === 'POST');
    assert.strictEqual(create.path, '/v1/videos/sm9/clips');
    assert.strictEqual(create.options.body.get('startTime'), '37000');
    assert.strictEqual(create.options.body.get('endTime'), '40000');
    assert.strictEqual(calls.filter(r => r.options.method === 'POST').length, 1);
    assert(calls.every(r => r.options.credentials === 'include'));
    find('clipText').value = '編集後の本文';
    find('post').click();
    find('post').click();
    await flush();
    assert.strictEqual(calls.filter(r => r.options.method === 'POST').length, 2);
    assert.strictEqual(calls.find(r => r.path.endsWith('/x-post') && r.options.method === 'POST').options.body.get('text'), '編集後の本文');
    assert.match(root.querySelector('[role=status]').textContent, /ポストしました/);
  });
  it('keeps invalid ranges local and never resends a post when the acknowledgement is lost', async () => {
    mount(({path, options}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) return {clipId:'draft-9'};
      if (path.endsWith('/x-post')) throw new Error('network');
      return {status:'DONE', clipUri:'https://media.example/clip.mp4'};
    });
    await flush();
    find('clipEnd').value = '39';
    find('clipEnd').dispatchEvent(new page.window.Event('input'));
    assert(find('create').disabled);
    find('clipEnd').value = '40';
    find('clipEnd').dispatchEvent(new page.window.Event('input'));
    find('create').click(); await flush();
    find('post').click(); await flush();
    assert(find('post').disabled);
    assert.match(root.querySelector('[role=status]').textContent, /確認/);
    find('check').click(); await flush();
    assert.strictEqual(calls.filter(r => r.path.endsWith('/x-post') && r.options.method === 'POST').length, 1);
  });
  it('lets the user correct a definitively rejected post and resumes confirmed success without sending again', async () => {
    let reject = true;
    mount(({path, options}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) return {clipId:'draft-rejected'};
      if (path.endsWith('/x-post')) return options.method === 'POST' && reject ? {httpStatus:422} : {status:'DONE'};
      return {status:'DONE', clipUri:'https://media.example/clip.mp4'};
    });
    await flush();
    find('create').click(); await flush();
    find('post').click(); await flush();
    assert(!find('post').disabled);
    assert(!find('clipText').disabled);
    assert.match(root.querySelector('[role=status]').textContent, /本文/);
    reject = false;
    find('clipText').value = '修正した本文';
    find('post').click(); await flush();
    cleanup(); reopen(); await flush();
    assert.match(root.querySelector('[role=status]').textContent, /ポストしました/);
    assert(find('post').disabled);
    assert.strictEqual(calls.filter(r => r.path.endsWith('/x-post') && r.options.method === 'POST').length, 2);
  });
  it('restores an unacknowledged post with status reads only', async () => {
    let statusReads = 0;
    mount(({path, options}) => {
      if (path.endsWith('/tweet-possibility')) return allowed;
      if (path.endsWith('/license')) return {isUseLicensedMusic:false};
      if (path.endsWith('/clips')) return {clipId:'draft-resume'};
      if (path.endsWith('/x-post')) {
        if (options.method === 'POST') throw new Error('network');
        statusReads++;
        return {status:'DONE'};
      }
      return {status:'DONE', clipUri:'https://media.example/clip.mp4'};
    });
    await flush(); find('create').click(); await flush(); find('post').click(); await flush();
    cleanup(); reopen(); await flush();
    assert.strictEqual(statusReads, 1);
    assert.strictEqual(calls.filter(r => r.path.endsWith('/x-post') && r.options.method === 'POST').length, 1);
    assert.match(root.querySelector('[role=status]').textContent, /ポストしました/);
  });
  it('ignores eligibility results from a panel closed before the response', async () => {
    let finish;
    mount(({path}) => path.endsWith('/license') ? {} : new Promise(resolve => { finish=resolve; }));
    cleanup(); finish(allowed); await flush();
    assert(!calls.some(r => r.options.method === 'POST'));
    assert(!find('create') || find('create').disabled);
  });
});

describe('official X posting from the clip editor', () => {
  let page, root, panel;
  let localCreates, calls;
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const tab = () => root.querySelector('[data-view=official]');
  const find = name => root.querySelector('#zenzaShareOfficial [name="' + name + '"]');
  function open(selection) {
    page = new JSDOM('<body></body>', {url:'https://www.nicovideo.jp/watch/sm9', runScripts:'outside-only'});
    const w = page.window;
    w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    w.HTMLDialogElement.prototype.close = function() { this.open = false; };
    w.textUtil = {secToTime:String};
    w.ShareClipJobs = {busy:false};
    w.ShareLocalClip = {mount(host, options) {
      host.innerHTML = '<div data-provider-slot></div><button data-action=create></button><button data-action=provider-fallback></button>';
      const fallback = host.querySelector('[data-action=provider-fallback]');
      fallback.onclick = () => options.onOpenOfficial(fallback);
      options.onSelectionChange(selection);
      host.querySelector('button').onclick = () => { localCreates++; };
      return () => {};
    }};
    localCreates = 0;
    calls = [];
    w.fetch = async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({path, options});
      let data;
      if (path.endsWith('/tweet-possibility')) data = {isLogin:true, isClipTweetAllowed:true, twitterLinkage:{isLinked:true}};
      else if (path.endsWith('/license')) data = {isUseLicensedMusic:false};
      else if (path.endsWith('/clips')) data = {clipId:'selected-clip'};
      else if (path.endsWith('/x-post')) data = {status:'DONE'};
      else data = {status:'DONE',clipUri:'https://media.example/preview.mp4'};
      return {ok:true,status:200,json:async () => ({meta:{status:200}, data})};
    };
    w.ShareOfficialClip = w.eval(beginSection('src/ShareOfficialClip.js') + '\nShareOfficialClip');
    panel = w.eval(beginSection('src/VideoSharePanel.js') + '\nVideoSharePanel');
    panel.open({watchId:'sm9', videoId:'sm9', title:'fixture', duration:180}, 0);
    root = w.document.querySelector('dialog');
  }
  afterEach(() => { panel?.close(); page?.window.close(); });
  it('only checks provider availability when invoked from a failed local conversion', async () => {
    open({isCurrent:true,start:965.45,end:995.45});
    root.querySelector('[data-action=provider-fallback]').click(); await flush();
    assert.equal(tab().getAttribute('aria-pressed'),'true');
    assert(calls.length && calls.every(call => call.options.method === 'GET'));
    assert.equal(localCreates,0);
  });
  it('prepares the chosen original interval from the first screen and posts only on confirmation', async () => {
    open({isCurrent:true,start:8.25,end:18.5});
    assert(tab() && !tab().closest('[hidden]'));
    assert.equal(calls.length,0);
    tab().click(); await flush();
    assert(calls.every(call => call.options.method === 'GET'));
    root.querySelector('[data-action=back]').click();
    tab().click(); await flush();
    assert(calls.every(call => call.options.method === 'GET'));
    find('create').click(); await flush();
    const create = calls.find(call => call.path.endsWith('/clips'));
    assert.deepEqual([...create.options.body], [['startTime','8250'],['endTime','18500']]);
    assert.equal(localCreates,0);
    assert.equal(tab().getAttribute('aria-pressed'),'true');
    assert(!calls.some(call => call.path.endsWith('/x-post')));
    find('post').click(); await flush();
    const post = calls.find(call => call.path.endsWith('/x-post') && call.options.method === 'POST');
    assert.deepEqual([...post.options.body.keys()],['text']);
  });
  for (const [selection, note] of [
    [{start:5,end:65}, /先頭30秒/],
    [{start:5,end:10,comments:true}, /コメント/],
    [{start:5,end:10,effects:true}, /画面エフェクト/],
    [{start:0,end:2.99}, /3秒/]
  ]) {
    it('explains the difference before creating a server clip ' + JSON.stringify(selection), async () => {
      open({...selection,isCurrent:true});
      tab().click(); await flush();
      assert.match(root.querySelector('#zenzaShareOfficial [data-selection-note]').textContent, note);
      assert(calls.every(call => call.options.method === 'GET'));
      assert.equal(localCreates,0);
      root.querySelector('[data-action=back]').click();
      assert.equal(root.querySelector('#zenzaShareLocal').hidden,false);
      assert.equal(localCreates,0);
    });
  }
  it('explains sharing a device file without requesting a NicoNico clip for another source', async () => {
    open({start:0,end:10,isFile:true});
    tab().click(); await flush();
    assert.match(root.querySelector('#zenzaShareOfficial [data-selection-note]').textContent, /ファイル/);
    assert.equal(calls.length,0);
    assert.equal(localCreates,0);
    assert.equal(find('post'),null);
  });
});

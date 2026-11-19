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
      if (data?.httpStatus) return {ok:false, status:data.httpStatus, json:async () => ({meta:{status:data.httpStatus}})};
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
      }, undefined, {startTime:5, endTime:14, autoPreview:true});
      await flush();
      assert.strictEqual(calls.filter(call => call.path.endsWith('/clips') && call.options.method === 'POST').length, licensed ? 0 : 1);
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

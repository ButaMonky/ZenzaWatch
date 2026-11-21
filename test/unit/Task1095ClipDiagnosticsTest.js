'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {stripTypeScriptTypes} = require('node:module');
const {JSDOM} = require('jsdom');
const {beginSection} = require('../helpers/extractSource');

describe('official clip diagnostics', () => {
  const diagnostics = stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/RequestDiagnostics.ts','utf8'))
    .replace(/^export\s*\{[^}]*\};?\s*$/gm,'');
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const permission = {isLogin:true,isClipTweetAllowed:true,twitterLinkage:{isLinked:true,screenName:'privateAccount'}};
  const preview = {status:'DONE',clipUri:'https://media.invalid/secret-signature?sig=secret-value'};
  const ok = data => ({ok:true,status:200,json:async () => ({meta:{status:200},data})});
  const http = (status,errorCode='sensitive-response-code') => ({ok:false,status,json:async () => ({meta:{status,errorCode}})});
  const empty = () => ({ok:true,status:204,json:() => {throw Error('unexpected JSON read');}});
  let page, win, root, api, events, dispose, calls, reply, clock, tick;
  const find = name => root.querySelector('[name="'+name+'"]');
  const click = async name => { find(name).click(); await flush(); };
  beforeEach(() => {
    page = new JSDOM('<section></section>',{url:'https://www.nicovideo.jp',runScripts:'outside-only'});
    win = page.window;
    root = win.document.querySelector('section');
    win.ShareClipQueue = win.eval(beginSection('src/ShareClipQueue.js') + '\nShareClipQueue');
    const source = win.eval(diagnostics+'\n'+beginSection('src/ShareOfficialClip.js')+'\n;({api:ShareOfficialClip,diag:RequestDiagnostics})');
    api = source.api; events = []; calls = [];
    source.diag.setSink(event => events.push(event));
    clock = 10; win.Date.now = () => clock;
    const timer = win.setTimeout.bind(win);
    win.setTimeout = (fn,ms) => { if (ms === 5000) {tick=fn;return 0;} return timer(fn,ms); };
    win.fetch = async (url,options) => {
      const path = new URL(url).pathname;
      const stage = path.endsWith('/tweet-possibility') ? 'permission' : path.endsWith('/license') ? 'license' :
        path.endsWith('/x-post') ? (options.method === 'POST' ? 'post':'post-status') :
        options.method === 'POST' ? 'create' : options.method === 'DELETE' ? 'delete' : 'status';
      calls.push(stage);
      // A second generic HTTP observer must not produce a duplicate failure or recovery.
      source.diag.startRequest(url).response({status:503});
      const specific = reply?.(stage,options);
      if (specific !== undefined) return specific;
      if (stage === 'delete' || stage === 'post') return empty();
      return ok({permission,license:{isUseLicensedMusic:false},create:{clipId:'private-clip-id'},
        status:preview,'post-status':{status:'DONE'}}[stage]);
    };
    assert.equal(source.diag.labelFor('clip-create'),'クリップの作成');
    assert.equal(source.diag.labelFor('__proto__'),undefined);
  });
  async function open(id='sm987654321') {
    dispose?.();
    dispose = api.mount(root,{info:{videoId:id,watchId:id,duration:20},startTime:2,
      text:()=>'private-body',officialUrl:'https://www.nicovideo.jp/watch/'+id});
    await flush();
  }
  afterEach(() => { dispose?.(); dispose=undefined; page.window.close(); });
  it('does not diagnose normal permission, login, disallowed videos or user limits',async () => {
    for (const data of [{isLogin:false},{isLogin:true,isClipTweetAllowedVideo:false},
      {isLogin:true,twitterLinkage:{isLinked:false}}, {...permission,isClipTweetAllowed:false}]) {
      reply = () => ok(data); await open();
      assert(find('create').disabled);
    }
    for (const result of [http(401),http(403),http(404),http(429),http(400,'USER_LIMIT_EXCEEDED')]) {
      reply = stage => stage === 'create' ? result : undefined; await open(); await click('create');
    }
    assert.deepEqual(events,[]);
  });
  it('checks required fields at each stage and redacts all supplied values',async () => {
    const stages = [
      ['permission',() => ok({isLogin:true}), 'data.twitterLinkage.isLinked'],
      ['permission',() => ok({isLogin:true,twitterLinkage:{isLinked:true}}), 'data.isClipTweetAllowed'],
      ['permission',() => ({ok:true,status:200,json:async () => ({meta:{}})}), 'meta.status'],
      ['permission',() => ({ok:true,status:200,json:async () => {throw Error('private-body');}}),'json'],
      ['license',() => ok({licensed:'secret-value'}),'data.isUseLicensedMusic'],
      ['create',() => ok({clipId:{unexpected:'secret-value'}}),'data.clipId'],
      ['status',() => ok({status:'unrecognized-sensitive-state'}),'data.status'],
      ['status',() => ok({status:'DONE',clipUri:'ftp://invalid/private-account'}),'data.clipUri'],
      ['post-status',() => ok({}),'data.status']
    ];
    let number=0;
    for (const [stage,bad,field] of stages) {
      reply = name => name === stage ? bad() : undefined;
      await open('sm98765432'+(++number));
      if (['create','status','post-status'].includes(stage)) await click('create');
      if (stage === 'post-status') await click('post');
      const event = events.at(-1);
      assert.equal(event.statusCode,200);
      assert.equal(event.method,stage==='create'?'POST':'GET');
      assert(event.endpoint);
      assert.deepEqual([event.operation,event.reason,event.missing,event.module],['clip-'+stage,'schema',field,'src/ShareOfficialClip.js']);
    }
    assert.doesNotMatch(JSON.stringify(events),/sm\d+|private-body|private-clip|privateAccount|unrecognized-sensitive|secret-|https?:/);
  });
  it('requires three distinct videos with the same faulty field inside 30 minutes and reports recovery only for the same stage', async () => {
    reply = () => ok({});
    for (let i=0;i<3;i++) await open('video-one');
    await open('video-old');
    clock += 31*60000;
    await open('video-one'); await open('video-two');
    reply = () => ok({isLogin:true});
    await open('video-three');
    assert(!events.some(e => e.reason === 'spec-change'));
    reply = () => ok({});
    await open('video-three'); await open('video-four');
    const suspected = events.filter(e => e.reason === 'spec-change');
    assert.equal(suspected.length,1);
    assert.equal(suspected[0].distinctTargets,3);
    assert.equal(suspected[0].missing,'data.isLogin');
    reply = () => ok({isLogin:false});
    await open('video-three');
    assert.equal(events.at(-1).outcome,'recovered');
  });
  it('distinguishes 503, transport, user close and request timeout',async () => {
    reply = () => http(503);
    await open(); assert.equal(events.at(-1).statusCode,503);
    reply = () => { throw new TypeError('secret-signature'); };
    await open(); assert.equal(events.at(-1).reason,'network');
    reply = (stage,options) => new Promise((resolve,reject) => options.signal.addEventListener('abort',()=>reject(Error('close'))));
    await open(); dispose(); await flush();
    assert.equal(events.length,2);
    const timer = win.setTimeout;
    win.setTimeout = (fn,ms) => timer(fn,ms === 20000 ? 0 : ms);
    await open();
    await new Promise(resolve=>setTimeout(resolve,12));
    assert.equal(events.at(-1).reason,'timeout');
  });
  it('keeps X nonterminal statuses pollable, detects stuck and unknown states, and never repeats the POST',async () => {
    for (const [index,status] of ['WAITING','unknown-sensitive-state'].entries()) {
      reply = stage => stage === 'post-status' ? ok({status}) : undefined;
      await open('video'+index); await click('create'); await click('post');
      assert.equal(find('check').hidden,true);
      clock += 30*60000;
      await tick(); await flush();
      assert.equal(find('check').hidden,false);
      const problem = events.at(-1);
      assert.equal(problem.operation,'clip-post-status');
      assert.equal(problem.reason,status === 'WAITING' ? 'timeout' : 'schema');
      reply = undefined;
      await click('check');
      assert.equal(events.at(-1).outcome,'recovered');
    }
    assert.equal(calls.filter(s=>s === 'post').length,2);
  });
  it('reports stage-specific service failures and handles 204 responses and known X denials quietly',async () => {
    reply = stage => stage === 'status' ? ok({status:'FAILED',failureReason:'private-response'}) : undefined;
    await open(); await click('create');
    assert.equal(events.at(-1).reason,'service');
    reply = stage => stage === 'delete' ? http(502) : undefined;
    await click('discard'); assert.equal(events.at(-1).operation,'clip-delete');
    reply = undefined;
    await click('discard'); assert.equal(events.at(-1).outcome,'recovered');
    await click('create');
    reply = stage => stage === 'post' ? http(422) : undefined;
    const before = events.length;
    await click('post');
    reply = stage => stage === 'post-status' ? ok({status:'FAILED',failureReason:'X_TOKEN_INVALID'}) : undefined;
    await click('post'); assert.equal(events.length,before);
    assert.doesNotMatch(JSON.stringify(events),/private-response|sensitive-response/);
  });
  it('records an ambiguous X submission once and resumes by GET without another POST',async () => {
    await open(); await click('create');
    reply = stage => stage === 'post' ? http(503) : stage === 'post-status' ? http(404) : undefined;
    await click('post');
    assert.deepEqual([events.at(-1).operation,events.at(-1).statusCode],['clip-post',503]);
    reply = undefined;
    await open();
    assert.equal(calls.filter(stage=>stage === 'post').length,1);
    assert(calls.includes('post-status'));
    assert.match(root.querySelector('[role=status]').textContent,/ポストしました/);
    assert.deepEqual([events.at(-1).operation,events.at(-1).outcome],['clip-post','recovered']);
  });
});

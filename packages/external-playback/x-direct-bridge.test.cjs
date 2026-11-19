'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {createXRequest, mountXPostingBridge} = require('./x-direct-bridge.cjs');
const {createXUserAuth} = require('./x-user-auth.cjs');
const {createXMediaPublisher} = require('./x-media-publish.cjs');

const origin = 'https://www.nicovideo.jp';
const file = new File(['local movie'], 'clip.mp4', {type:'video/mp4'});
const checked = {id:'123',username:'test_user'};
const ready = {id:'913'};
const replies = path => {
  if (path === '/2/users/me') return {data:checked};
  if (path === '/2/media/upload/initialize') return {data:ready};
  if (path === '/2/media/upload/913/append') return {};
  if (path === '/2/media/upload/913/finalize') return {data:{...ready,processing_info:{state:'pending',check_after_secs:2}}};
  if (path === '/2/media/upload?command=STATUS&media_id=913') return {data:{...ready,processing_info:{state:'succeeded'}}};
  if (path === '/2/tweets') return {data:{id:'812'}};
  throw Error('Unexpected path ' + path);
};

function harness({auth,request}, options = {}) {
  const views = [];
  const attrs = {};
  let onMessage;
  const win = {addEventListener(type, fn) { if (type === 'message') onMessage = fn; }};
  win.top = options.child ? {} : win;
  const ctx = {window:win, location:{origin:options.origin || origin}, File,
    document:{documentElement:{setAttribute(k,v) { attrs[k] = v; }}}};
  const mount = vm.runInNewContext('(' + mountXPostingBridge.toString() + ')', ctx);
  mount({auth, request, createPublisher:r => createXMediaPublisher(r,{sleep:async()=>{}}),
    showDialog:props => views.push(props)});
  function emit(override) {
    onMessage?.({origin,source:win,isTrusted:true,data:{type:'zenza-open-x-publisher',file,text:'from page'},...override});
  }
  return {emit,views,attrs};
}

test('only a top-level Nico document and a genuine same-window message with an MP4 can open a review', () => {
  const rejectNetwork = () => assert.fail('opening the review must not access authorization or upload');
  const adapters = {request:rejectNetwork,auth:{getToken:rejectNetwork,isLinked:rejectNetwork}};
  for (const options of [{child:true},{origin:'https://x.com'}]) {
    const h = harness(adapters,options);
    h.emit();
    assert.equal(h.attrs['data-zenza-x-publisher'], undefined);
    assert.equal(h.views.length, 0);
  }
  const h = harness(adapters);
  assert.equal(h.attrs['data-zenza-x-publisher'], 'ready');
  for (const override of [{origin:'https://x.com'},{source:{}},{isTrusted:false},
    {data:{type:'zenza-post-now',file,text:'x'}},
    {data:{type:'zenza-open-x-publisher',file:new File(['x'],'a.webm',{type:'video/webm'}),text:'x'}}]) h.emit(override);
  assert.equal(h.views.length, 0);
  h.emit(); h.emit();
  assert.equal(h.views.length, 1);
  assert.equal(h.views[0].file,file);
  h.views[0].onClose();
  h.emit();
  assert.equal(h.views.length, 2);
});

test('allows the real OAuth and media factories to complete authorization, status polling, posting and revocation', async () => {
  const calls = [];
  const request = createXRequest(options => {
    const url = new URL(options.url);
    assert.equal(url.origin,'https://api.x.com');
    assert.equal(options.anonymous,true);
    assert.equal(options.redirect,'error');
    const path = url.pathname + url.search;
    calls.push([options.method,path]);
    let data;
    if (path === '/2/oauth2/token') {
      assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');
      data = {token_type:'bearer',access_token:'a',refresh_token:'r',expires_in:7200,
        scope:'media.write users.read tweet.read tweet.write offline.access'};
    } else if (path === '/2/oauth2/revoke') {
      assert.ok(['r','a'].includes(new URLSearchParams(options.data).get('token')));
      data = {revoked:true};
    } else {
      assert.equal(options.headers.Authorization,'Bearer a');
      data = replies(path);
    }
    queueMicrotask(() => options.onload({status:path === '/2/tweets' ? 201 : 200,
      responseText:JSON.stringify(data),finalUrl:options.url}));
    return {abort(){}};
  });
  const db = new Map();
  const auth = createXUserAuth({get:k=>db.get(k),set:(k,v)=>db.set(k,v),remove:k=>db.delete(k),request});
  const redirectUri = 'http://127.0.0.1:48765/callback';
  auth.configure({clientId:'public',redirectUri});
  const start = new URL(await auth.begin());
  await auth.complete(redirectUri + '?code=valid&state=' + start.searchParams.get('state'));
  const h = harness({auth,request}); h.emit();
  const view = h.views[0];
  await assert.rejects(view.publish({text:'premature'}),{code:'ACCOUNT_CHANGED'});
  assert.equal((await view.account()).username,'test_user');
  assert.equal((await view.publish({text:'reviewed'})).id,'812');
  await auth.disconnect();
  assert.deepEqual(calls,[
    ['POST','/2/oauth2/token'], ['GET','/2/users/me'], ['POST','/2/media/upload/initialize'],
    ['POST','/2/media/upload/913/append'], ['POST','/2/media/upload/913/finalize'],
    ['GET','/2/media/upload?command=STATUS&media_id=913'], ['POST','/2/tweets'],
    ['POST','/2/oauth2/revoke'], ['POST','/2/oauth2/revoke']
  ]);
});

test('rejects non-allowlisted method/path pairs before calling GM and rejects redirected results', async () => {
  let sent = 0;
  const request = createXRequest(opts => {
    sent++;
    opts.onload({status:200,finalUrl:'https://other.example/2/users/me',responseText:'{}'});
  });
  for (const [method,path] of [
    ['GET','/2/tweets'],['POST','/2/users/me'],['GET','https://api.x.com/2/users/me'],
    ['GET','/2/users/me?user.fields=email'],['GET','/2/users/me\n'],
    ['POST','/2/media/upload/12/../append'],['POST','/2/media/upload/12345678901234567890/append'],
    ['DELETE','/2/tweets']
  ]) assert.throws(()=>request(path,{method}),/INVALID_ENDPOINT/);
  assert.equal(sent,0);
  await assert.rejects(request('/2/users/me',{method:'GET'}),/INVALID_ENDPOINT/);
  assert.equal(sent,1);
});

test('a rotated bearer can finish only for the reviewed user; switch or unlink before create sends no post', async () => {
  for (const rotation of ['same','different','unlink']) {
    let token = 'first';
    const calls = [];
    const auth = {getToken:async()=>token,isLinked:()=>!!token};
    const request = async (path, opts) => {
      calls.push([path,opts.headers.Authorization]);
      if (path.startsWith('/2/media/upload?')) token = rotation === 'unlink' ? null : 'second';
      const changedUser = path === '/2/users/me' && opts.headers.Authorization === 'Bearer second' && rotation === 'different';
      return {status:200,json:changedUser ? {data:{id:'124',username:'other_user'}} : replies(path)};
    };
    const h = harness({auth,request}); h.emit();
    const view = h.views[0];
    await view.account();
    if (rotation === 'same') {
      await view.publish({text:'confirmed'});
      assert.deepEqual(calls.at(-1),['/2/tweets','Bearer second']);
    } else {
      await assert.rejects(view.publish({text:'confirmed'}),{code:rotation === 'unlink' ? 'AUTH_REQUIRED' : 'ACCOUNT_CHANGED'});
      assert.equal(calls.some(([path])=>path === '/2/tweets'),false);
    }
  }
});

test('the transport aborts an in-flight GM request and ignores late completion', async () => {
  let calls = 0, aborts = 0, pending;
  const request = createXRequest(options => {
    calls++;
    pending = options;
    return {abort() { aborts++; options.onabort(); }};
  });
  const signal = AbortSignal.abort();
  await assert.rejects(request('/2/users/me',{method:'GET',signal}),/CANCELLED/);
  assert.equal(calls,0);
  const controller = new AbortController();
  const response = request('/2/users/me',{method:'GET',signal:controller.signal});
  controller.abort();
  pending.onload({status:200,responseText:'{}'});
  await assert.rejects(response,/CANCELLED/);
  assert.equal(aborts,1);
});

test('an unacknowledged create request remains uncertain and is sent once', async () => {
  const calls = [];
  const request = createXRequest(options => {
    const url = new URL(options.url);
    const path = url.pathname + url.search;
    calls.push(path);
    queueMicrotask(() => {
      if (path === '/2/tweets') options.onerror();
      else options.onload({status:200,responseText:JSON.stringify(replies(path)),finalUrl:options.url});
    });
    return {abort(){}};
  });
  const h = harness({request,auth:{getToken:async()=>'first',isLinked:()=>true}}); h.emit();
  await h.views[0].account();
  await assert.rejects(h.views[0].publish({text:'reviewed'}), {code:'POST_UNCERTAIN'});
  assert.equal(calls.filter(path=>path === '/2/tweets').length,1);
});

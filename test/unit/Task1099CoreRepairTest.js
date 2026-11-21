'use strict';
const assert = require('node:assert/strict');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function world(extra={}) {
  const events=[];
  const ctx=createContext({events,...extra});
  run(beginSection('packages/lib/src/infra/RequestDiagnostics.js') +
    ';RequestDiagnostics.setSink(e=>events.push(e));globalThis.diag=RequestDiagnostics;',ctx);
  return {ctx,events};
}

describe('main feature repair reports',()=>{
  it('assigns nested playlist and uploader URLs to the source that reads them',()=>{
    const {ctx,events}=world();
    for(const [path,op] of [
      ['/v1/playlist/search','playlist'],['/v1/playlist/mylist/9','playlist'],
      ['/v1/playlist/watch-later','playlist'],['/v3/users/9/videos?selectContentType=short','playlist'],
      ['/v3/users/9/videos','owner-videos'],['/v1/users/me/watch-later','mylist']
    ]) {
      ctx.diag.startRequest('https://nvapi.nicovideo.jp'+path).response({status:503});
      assert.equal(events.at(-1).operation,op);
    }
  });

  it('keeps failed likes and removals separate and recovers only after a valid acknowledgement',async()=>{
    let body={meta:{status:200,errorCode:'PRIVATE_SERVER_VALUE'}},wire=200;
    const {ctx,events}=world({NVApi:{call:async()=>({status:wire,json:async()=>body})}});
    run(beginSection('packages/lib/src/nico/LikeApi.js')+';globalThis.likes=LikeApi;',ctx);
    await assert.rejects(ctx.likes.like('sm9'));
    assert.equal(events.length,1);
    assert.deepEqual([events[0].method,events[0].endpoint],['POST','like.add']);
    assert.deepEqual([events[0].reason,events[0].errorCode,events[0].statusCode,events[0].apiStatus],
      ['service','OTHER',200,200]);
    body={meta:{status:403}};
    await assert.rejects(ctx.likes.unlike('sm9'));
    assert.deepEqual([events[1].reason,events[1].statusCode,events[1].apiStatus],['permission',200,403]);
    body=null;wire=204;
    await ctx.likes.unlike('sm9');
    assert.equal(events[2].key,events[1].key);
    assert.notEqual(events[2].key,events[0].key);
    assert.equal(events[2].outcome,'recovered');
    assert(!JSON.stringify(events).includes('PRIVATE_SERVER_VALUE'));
  });

  it('carries grant and manifest failures from the shared scene loader without exposing signed URLs',async()=>{
    const {ctx,events}=world();
    run(beginSection('packages/lib/src/nico/VideoSessionWorker.js')+';globalThis.classes=createStoryboardClasses;',ctx);
    const queued=[];
    const {StoryboardSession,StoryboardInfoLoader}=ctx.classes({fetch:async()=>queued.shift()});
    const params={serverType:'domand',videoInfo:{domandInfo:{videoId:'sm9',accessRightKey:'SECRET'}}};
    const grant=()=>StoryboardSession.create(params).create();
    async function observe(action) {
      const ticket=ctx.diag.begin('storyboard','private-video','response');
      try { const result=await action();ticket.success();return result; }
      catch (err) { ticket.failure(err);throw err; }
    }
    const reply=(status,body)=>({status,json:async()=>body});
    queued.push(reply(200,{meta:{status:403},data:{contentUrl:'https://example.invalid/SECRET'}}));
    await assert.rejects(observe(grant));
    assert.deepEqual([events[0].reason,events[0].statusCode,events[0].apiStatus],['permission',200,403]);
    queued.push(reply(200,{meta:{status:200},data:{}}));
    await assert.rejects(observe(grant));
    assert.equal(events[1].missing,'data.contentUrl');
    queued.push(reply(200,{meta:{status:200},data:{contentUrl:'https://example.invalid/SECRET'}}));
    const session=await grant();
    queued.push(reply(503,{}));
    await assert.rejects(observe(()=>StoryboardInfoLoader.create(session).load()));
    assert.equal(events[2].statusCode,503);
    assert(!JSON.stringify(events).includes('SECRET'));
  });
});

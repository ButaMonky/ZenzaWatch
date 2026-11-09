'use strict';
// #219: distinguish recoverable IndexedDB load failures from failed writes.
const assert=require('assert');
const path=require('path'),{pathToFileURL}=require('url');
let Session;
before(async()=>{
  ({ManualBookmarkSession:Session}=await new Function('u','return import(u)')(
    pathToFileURL(path.resolve('packages/zenza/src/resume/ManualBookmarkSession.js')).href));
});
describe('ManualBookmarkSession failed-read retry ownership (#219)',()=>{
  it('only a failed initial load exposes a retry flag; write errors preserve rows',async()=>{
    let failLoad=true,failWrite=false,closed=0;
    const saved=Object.freeze({id:'B1',videoId:'sm9',time:18,label:'保持',createdAt:1,updatedAt:1});
    const repo={
      async load(){if(failLoad)throw Error('private storage detail');return [saved];},
      async add(){if(failWrite)throw Error('write blocked');return [saved];},
      async rename(){throw Error('not used');},
      async remove(){throw Error('not used');},
      close(){closed++;}
    };
    const session=new Session(repo);
    assert.equal(session.needsLoadRetry,false);
    assert.equal((await session.activate('sm9',120)).status,'error');
    assert.equal(session.needsLoadRetry,true,'read errors should be retryable');
    failLoad=false;
    assert.equal((await session.activate('sm9',120)).status,'applied');
    assert.equal(session.needsLoadRetry,false);
    assert.equal(session.snapshot.bookmarks.length,1);
    failWrite=true;
    assert.equal((await session.add('B2',20,2,'失敗')).status,'error');
    assert.equal(session.needsLoadRetry,false,'write failures are not read failures');
    assert.equal(session.snapshot.bookmarks.length,1,'committed data remains available');
    session.deactivate();
    assert.equal(session.needsLoadRetry,false,'old failure cannot leak into next video');
    session.dispose();
    assert.equal(closed,1);
  });
  it('stale load failures after video switch never turn on a retry for the new owner',async()=>{
    let rejectOld;
    const old=new Promise((_,reject)=>{rejectOld=reject;});
    const repo={
      load:videoId=>videoId==='sm9'?old:Promise.resolve([]),
      async add(){return [];},async rename(){return [];},
      async remove(){return [];},close(){}
    };
    const session=new Session(repo);
    const pending=session.activate('sm9',120);
    assert.equal((await session.activate('sm10',120)).status,'applied');
    rejectOld(Error('old load failed'));
    assert.equal((await pending).status,'stale');
    assert.equal(session.needsLoadRetry,false);
    assert.equal(session.snapshot.videoId,'sm10');
    session.dispose();
  });
});

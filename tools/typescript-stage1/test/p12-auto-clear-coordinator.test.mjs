import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoResumeClearCoordinator}
  from '../p12-src/AutoResumeClearCoordinator.ts';
const id='sm123';
const record=(videoId=id)=>({
  watchId:videoId,resume:[],resumeClearedAt:200,
  resumeClearReason:'deleted'
});
const delayed=()=>{
 let resolve,reject;
 const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
 return {promise,resolve,reject};
};
test('clears local state before authenticated server-zero, with acknowledgement',async()=>{
 const calls=[];
 const c=new AutoResumeClearCoordinator({
  clearLocal:async(videoId,reason)=>{
   calls.push(['local',videoId,reason]);return record(videoId);
  },
  saveRemoteZero:async(videoId,seconds)=>{
   calls.push(['remote',videoId,seconds]);return {acknowledged:true};
  },isLoggedIn:()=>true,activeVideoId:()=>id
 });
 const result=await c.delete(id);
 assert.deepEqual(calls,[['local',id,'deleted'],['remote',id,0]]);
 assert.equal(result.local,'cleared');
 assert.equal(result.remote,'acknowledged');
 assert.equal(result.fullyAcknowledged,true);
 assert.equal(result.retryRemote,false);
 assert(Object.isFrozen(result));
});
test('no-login returns local-only, never pretends remote acknowledged',async()=>{
 let remote=0;
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>record(),
  saveRemoteZero:async()=>{remote++;},
  isLoggedIn:()=>false
 });
 const v=await c.delete(id);
 assert.equal(remote,0);assert.equal(v.remote,'unavailable');
 assert.equal(v.fullyAcknowledged,false);
});
test('remote network failure preserves local clear but reports retryable status',async()=>{
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>record(),
  saveRemoteZero:async()=>{throw Error('secret-network-credentials');},
  isLoggedIn:()=>true
 });
 const result=await c.delete(id);
 assert.deepEqual({local:result.local,remote:result.remote,retry:result.retryRemote},
   {local:'cleared',remote:'failed',retry:true});
 assert(!JSON.stringify(result).includes('secret-network-credentials'));
});
test('late remote failure after session switch is stale and must not request retry',async()=>{
 const hold=delayed(),oldSession=Object.freeze({token:1});
 let active=id,session=oldSession,remote=0;
 const c=new AutoResumeClearCoordinator({
  activeVideoId:()=>active,activeSessionToken:()=>session,
  clearLocal:async()=>record(),
  saveRemoteZero:()=>{remote++;return hold.promise;},
  isLoggedIn:()=>true
 });
 const pending=c.delete(id);
 await Promise.resolve();
 assert.equal(remote,1,'remote request must have started before switching');
 active='smOther';session=Object.freeze({token:2});
 hold.reject(new Error('private server error'));
 const outcome=await pending;
 assert.equal(outcome.remote,'stale-video');
 assert.equal(outcome.retryRemote,false,
  'a late rejection for a previous playback session must not invite retry');
 assert.equal(outcome.fullyAcknowledged,false);
});
test('remote failure after reopening the same watch ID belongs to the old token',async()=>{
 const hold=delayed();
 let session=1,remote=0;
 const c=new AutoResumeClearCoordinator({
  activeVideoId:()=>id,activeSessionToken:()=>session,
  clearLocal:async()=>record(),
  saveRemoteZero:()=>{remote++;return hold.promise;},
  isLoggedIn:()=>true
 });
 const oldDelete=c.delete(id);
 await Promise.resolve();
 assert.equal(remote,1);
 session=2;
 hold.reject(Error('sensitive network details'));
 const outcome=await oldDelete;
 assert.equal(outcome.remote,'stale-video');
 assert.equal(outcome.retryRemote,false);
 assert.equal(outcome.fullyAcknowledged,false);
 assert(!JSON.stringify(outcome).includes('sensitive'));
});
test('local storage failure rejects before remote call and does not claim success',async()=>{
 let remote=0;
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>{throw Error('disk failed');},
  saveRemoteZero:async()=>{remote++;},isLoggedIn:()=>true
 });
 await assert.rejects(c.delete(id),/disk failed/);
 assert.equal(remote,0);
});
test('local unacknowledged or wrong-video clear prevents remote erase',async()=>{
 let remote=0;
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>record('smWrong'),
  saveRemoteZero:async()=>{remote++;},isLoggedIn:()=>true
 });
 await assert.rejects(c.delete(id),/not acknowledged/);
 assert.equal(remote,0);
});
test('invalid local record missing explicit clear barrier rejects',async()=>{
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>({watchId:id,resume:[],resumeClearReason:'deleted'}),
  isLoggedIn:()=>false
 });
 await assert.rejects(c.delete(id),/not acknowledged/);
});
test('video switch before click stops write to unrelated video',async()=>{
 let local=0,remote=0;
 const c=new AutoResumeClearCoordinator({
  activeVideoId:()=> 'smOther',clearLocal:async()=>{local++;return record();},
  saveRemoteZero:async()=>{remote++;},isLoggedIn:()=>true
 });
 await assert.rejects(c.delete(id),/video changed/);
 assert.equal(local,0);assert.equal(remote,0);
});
test('video switch during local clear stops remote write after local ack',async()=>{
 const hold=delayed();let active=id,remote=0;
 const c=new AutoResumeClearCoordinator({
  activeVideoId:()=>active,
  clearLocal:()=>hold.promise,
  saveRemoteZero:async()=>{remote++;},isLoggedIn:()=>true
 });
 const pending=c.delete(id);
 active='smOther';
 hold.resolve(record());
 const result=await pending;
 assert.equal(result.remote,'stale-video');
 assert.equal(remote,0);
});
test('reopening the same video invalidates a previous session and permits a new delete',async()=>{
 const hold=delayed(),sessionA=Object.freeze({session:1}),sessionB=Object.freeze({session:2});
 let session=sessionA,local=0,remote=0;
 const c=new AutoResumeClearCoordinator({
  activeVideoId:()=>id,activeSessionToken:()=>session,
  clearLocal:()=>{local++;return local===1?hold.promise:Promise.resolve(record());},
  saveRemoteZero:async()=>{remote++;},isLoggedIn:()=>true
 });
 const oldDelete=c.delete(id);
 session=sessionB;
 const newDelete=c.delete(id);
 assert.notEqual(newDelete,oldDelete,'same watch ID on new session must not coalesce');
 hold.resolve(record());
 const [oldOutcome,newOutcome]=await Promise.all([oldDelete,newDelete]);
 assert.equal(oldOutcome.remote,'stale-video');
 assert.equal(newOutcome.remote,'acknowledged');
 assert.equal(local,2);assert.equal(remote,1);
});
test('simultaneous duplicate deletes share one local and remote operation',async()=>{
 const hold=delayed();let local=0,remote=0;
 const c=new AutoResumeClearCoordinator({
  clearLocal:()=>{local++;return hold.promise;},
  saveRemoteZero:async()=>{remote++;},isLoggedIn:()=>true
 });
 const a=c.delete(id),b=c.delete(id);
 assert.equal(a,b);assert.equal(local,1);
 hold.resolve(record());await a;
 assert.equal(remote,1);
});
test('different video IDs keep independent pending operations',async()=>{
 const calls=[];
 const c=new AutoResumeClearCoordinator({
  clearLocal:async(videoId)=>{calls.push(videoId);return record(videoId);},
  isLoggedIn:()=>false
 });
 const [a,b]=await Promise.all([c.delete('sm1'),c.delete('sm2')]);
 assert.deepEqual(calls,['sm1','sm2']);
 assert.equal(a.videoId,'sm1');assert.equal(b.videoId,'sm2');
});
test('rejects blank IDs and invalid active owner without contacting dependencies',async()=>{
 let called=0;
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>{called++;return record();},
  isLoggedIn:()=>true
 });
 await assert.rejects(c.delete(''),/Invalid automatic resume video ID/);
 await assert.rejects(c.delete('  '),/Invalid automatic resume video ID/);
 assert.equal(called,0);
});
test('session token getter failure rejects asynchronously and permits a later retry',async()=>{
 let first=true,localCalls=0,remoteCalls=0;
 const coordinator=new AutoResumeClearCoordinator({
  activeVideoId:()=>id,
  activeSessionToken:()=>{
   if(first){first=false;throw new Error('private session token unavailable');}
   return 'next-session';
  },
  clearLocal:async()=>{localCalls++;return record();},
  saveRemoteZero:async()=>{remoteCalls++;},isLoggedIn:()=>true
 });
 // The player dialog always attaches .then(...,onError) to the returned promise.
 // A synchronous throw skips that handler and leaves deletion-save suppression set.
 let pending;
 assert.doesNotThrow(()=>{pending=coordinator.delete(id);});
 assert(pending instanceof Promise,'delete must preserve its Promise contract');
 await assert.rejects(pending,/private session token unavailable/);
 assert.equal(localCalls,0);assert.equal(remoteCalls,0);
 const recovered=await coordinator.delete(id);
 assert.equal(recovered.fullyAcknowledged,true);
 assert.equal(localCalls,1);assert.equal(remoteCalls,1);
});
test('failed deletion releases de-dup state for retry when local cache recovers',async()=>{
 let fails=true,calls=0;
 const c=new AutoResumeClearCoordinator({
  clearLocal:async()=>{calls++;if(fails)throw Error('temporary');return record();},
  isLoggedIn:()=>false
 });
 await assert.rejects(c.delete(id),/temporary/);
 fails=false;
 const result=await c.delete(id);
 assert.equal(result.local,'cleared');
 assert.equal(calls,2);
});

'use strict';
const assert=require('assert'),fs=require('fs'),parser=require('@babel/parser');
const {createContext,run}=require('../helpers/extractSource');
function fixture(history=[]){
 const text=fs.readFileSync('tools/typescript-stage1/.generated/nico/NicoVideoPlayerDialog.js','utf8');
 const ast=parser.parse(text,{sourceType:'module',allowUndeclaredExports:true,plugins:['classProperties']});
 const node=ast.program.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='NicoVideoPlayerDialogView');
 const ctx=createContext({Emitter:class{},WatchInfoCacheDb:{listSavedPoints:async()=>history}});
 run(text.slice(node.start,node.end)+';globalThis.View=NicoVideoPlayerDialogView;',ctx);
 const view=Object.create(ctx.View.prototype);view._state={videoInfo:{watchId:'sm1',title:'Current',duration:100}};view._dialog={_requestId:7,_videoInfo:{resumePoints:[{time:12}]}};return view;
}
describe('Saved point library integration',()=>{
 it('uses the current video thumbnail without changing saved timestamps or ordering',async()=>{
  const view=fixture([{watchId:'sm1',title:'Old',duration:100,updatedAt:5,viewedAt:3,automaticTime:2}]);
  view._state.videoInfo.thumbnail='https://example.com/current.jpg';
  const list=await view._loadSavedPointLibrary({list:async()=>[]});
  assert.equal(list[0].thumbnailUrl,'https://example.com/current.jpg');
  assert.equal(list[0].updatedAt,5);assert.equal(list[0].viewedAt,3);
 });
 it('retains actual viewing date and video thumbnail independently of edits',async()=>{
  const view=fixture([{watchId:'sm2',title:'Saved',duration:100,updatedAt:90,viewedAt:12,thumbnailUrl:'https://example.com/video.jpg',automaticTime:3}]);
  const list=await view._loadSavedPointLibrary({list:async()=>[]});
  assert.equal(list[0].viewedAt,12);assert.equal(list[0].thumbnailUrl,'https://example.com/video.jpg');
 });
 it('captures navigation ownership before a delayed open resolves',async()=>{
  const v=fixture();let resolve;const calls=[];
  v._dialog.open=()=>{v._dialog._requestId=8;v._dialog._watchId='sm2';return new Promise(r=>{resolve=r;});};
  v._trySavedLibraryRepeat=()=>calls.push(v._pendingLibraryRepeat);
  const pending=v._openSavedLibraryPosition('sm2',20,30);
  v._dialog._requestId=9;v._dialog._watchId='sm2';resolve();await pending;
  assert.equal(calls.length,0);assert.equal(v._pendingLibraryRepeat,undefined);
 });
 it('navigates to the saved video and arms repeat for that request',async()=>{
  const v=fixture();const calls=[];
  v._dialog.open=(id,options)=>{calls.push([id,options.currentTime]);v._dialog._requestId=8;v._dialog._watchId=id;};
  v._trySavedLibraryRepeat=()=>{};
  await v._openSavedLibraryPosition('sm2',20,30);
  assert.deepStrictEqual(calls,[['sm2',20]]);assert.equal(v._pendingLibraryRepeat.requestId,8);assert.equal(v._pendingLibraryRepeat.b,30);
 });
 it('combines readonly metadata with manual-only records without losing cached-less bookmarks',async()=>{
  const view=fixture([{watchId:'sm1',title:'Old title',duration:100,updatedAt:5,automaticTime:3},{watchId:'sm2',title:'Empty',duration:50,updatedAt:4,automaticTime:null}]);
  const list=await view._loadSavedPointLibrary({list:async()=>[{videoId:'sm3',items:[{id:'b',time:20,endTime:30,label:'range',updatedAt:8}]}]});
  assert.equal(list.length,2);assert.equal(list[0].videoId,'sm3');assert.equal(list[0].bookmarks[0].endTime,30);assert.equal(list[1].title,'Current');assert.equal(list[1].automaticTime,12);
 });
 it('starts a foreign saved range once only after video ownership, session and readiness match',()=>{
  const v=fixture(),calls=[];v.manualBookmarkDock={setRepeatRange:(...args)=>{calls.push(args);return true;}};
  v._pendingLibraryRepeat={requestId:7,videoId:'sm1',a:20,b:30};v._bookmarkActivation={requestId:7};
  v._trySavedLibraryRepeat();assert.equal(calls.length,0);v._libraryCanPlayVideo='sm1';v._trySavedLibraryRepeat();assert.deepStrictEqual(calls,[[20,30,true]]);v._trySavedLibraryRepeat();assert.equal(calls.length,1);
 });
 it('never activates a range from an old request or another video',()=>{
  const v=fixture();v.manualBookmarkDock={setRepeatRange:()=>{throw Error('stale repeat');}};v._bookmarkActivation={requestId:7};v._libraryCanPlayVideo='sm1';
  v._pendingLibraryRepeat={requestId:6,videoId:'sm1',a:20,b:30};v._trySavedLibraryRepeat();
  v._pendingLibraryRepeat={requestId:7,videoId:'sm2',a:20,b:30};v._trySavedLibraryRepeat();
 });
});

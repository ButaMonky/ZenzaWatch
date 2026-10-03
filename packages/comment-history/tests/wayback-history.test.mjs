import test from 'node:test';
import assert from 'node:assert/strict';
import {createZenzaSeed} from '../src/zenza-context.mjs';
import {CommentHistoryController} from '../src/controller.mjs';
import {DEFAULT_SETTINGS} from '../src/settings.mjs';
import {watch,comment} from './fixtures.mjs';

function subject(when=1572253829){
  const raw=watch().data.response.$watchV4.data;
  const info=raw.comment.threads.map(t=>({...t,label:t.forkLabel,layer:{index:t.fork===1?0:1,isTranslucent:false}}));
  return {
    generation:'play-wayback',
    videoInfo:{videoId:'sm1',contextWatchId:'sm1',duration:120,msgInfo:{videoId:'sm1',nvComment:raw.comment.nvComment,threads:info}},
    result:{format:'threads',threadInfo:{videoId:'sm1',threadId:'10',language:'ja-jp',when,isWaybackMode:true,canPost:false},
      body:{__usedLanguage:'ja-jp',threads:[
        {id:'10',fork:'owner',commentCount:0,comments:[]},
        {id:'10',fork:'main',commentCount:50,comments:[comment(9,when-1)]}
      ]}}
  };
}
function preferences(enabled=true){
  let state={enabled,settings:{...DEFAULT_SETTINGS,maxAdditionalComments:2}};
  const listeners=new Set();
  return {
    get:()=>state,
    subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),
    setEnabled:v=>{state={...state,enabled:!!v};for(const f of listeners)f(state);}
  };
}

test('wayback seed keeps the selected time as the history acquisition boundary',()=>{
  const x=subject();
  const seed=createZenzaSeed({videoInfo:x.videoInfo,normalResult:x.result,playbackGeneration:x.generation,normalRevision:1});
  assert.equal(seed.historyStartWhen,1572253829);
  assert.equal(seed.baseline[1].comments[0].no,9);
});

test('wayback/current mode flags and timestamps must agree',()=>{
  const future=Math.floor(Date.now()/1000)+3600;
  for(const change of [
    {isWaybackMode:false,when:1572253829},
    {isWaybackMode:true,when:null},
    {isWaybackMode:true,when:0},
    {isWaybackMode:true,when:future}
  ]){
    const x=subject();
    Object.assign(x.result.threadInfo,change);
    assert.throws(()=>createZenzaSeed({videoInfo:x.videoInfo,normalResult:x.result,playbackGeneration:x.generation,normalRevision:1}));
  }
});

test('enabled history starts and restarts from the selected wayback time, not from now',async()=>{
  const x=subject(),starts=[],renders=[];
  const controller=new CommentHistoryController({
    preferences:preferences(true),
    acquire:fn=>fn(),
    clearRender:()=>{},
    notify:()=>{},
    render:async data=>{renders.push(data);return {additionalCount:0};},
    createSession:(context,{baseline,settings})=>({
      async run({startWhen}){starts.push(startWhen);return {counts:{additionalCount:0},pages:0,network:{attempts:0},reason:'empty_page',resumeAvailable:false,settings};},
      snapshot(){return structuredClone(baseline);},
      removeHistory(){},
      cancel(){},
      resumeData(){throw new Error('not used');}
    })
  });
  await controller.normalReady({videoInfo:x.videoInfo,result:x.result,generation:x.generation});
  assert.notEqual(controller.state.phase,'unavailable');
  assert.deepEqual(starts,[1572253829]);
  assert.equal(renders.length,1);
  await controller.restart();
  assert.deepEqual(starts,[1572253829,1572253829]);
  assert.equal(renders.length,2);
  controller.dispose();
});

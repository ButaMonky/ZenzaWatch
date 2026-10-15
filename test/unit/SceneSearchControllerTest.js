'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

const defaults={
  'sceneSearch.layout.normal':'01',
  'sceneSearch.layout.fullscreen':'01',
  'sceneSearch.layout.linkFullscreen':false,
  'sceneSearch.seekStepSeconds':5,
  'sceneSearch.commentPreviewVisible':true
};

function harness(prefs={},options={}) {
  const stored={...defaults,...prefs},events=[], seeks=[], errors=[];
  const widgets=[];
  const context=createContext({AbortController});
  const Class=loadClass(
    'packages/zenza/src/sceneSearch/SceneSearchController.js',
    'SceneSearchController',context);
  const ctrl=new Class({
    getPreference:key=>stored[key],
    createLayout:({id,mode})=>{
      events.push(['create',id,mode]);
      if(options.failIds?.includes(id)){throw new Error('failed '+id);}
      const widget={id,mode,disposed:0,previews:[],
        mount(state){events.push(['mount',id,mode,state.layoutId]);},
        render(state){events.push(['render',id,state.mode,state.pinned,state.time]);},
        onPreview(asset,request){this.previews.push([asset,request]);},
        dispose(){this.disposed++;events.push(['dispose',id]);}
      };
      widgets.push(widget);return widget;
    },
    loadPreview:options.loadPreview,
    onSeek:delta=>seeks.push(delta),
    onError:(error,key)=>errors.push([error.message,key])
  });
  return {ctrl,stored,events,seeks,errors,widgets};
}

describe('SCUI-03 common SceneSearchController (unwired pure module)',function(){
  it('lazily creates only the selected layout and disposes the old one',()=>{
    const h=harness({'sceneSearch.layout.normal':'06'});
    assert.strictEqual(h.widgets.length,0,'constructor must be side effect free');
    h.ctrl.start('normal');
    assert.strictEqual(h.ctrl.snapshot.layoutId,'06');
    assert.strictEqual(h.widgets.length,1);
    h.stored['sceneSearch.layout.normal']='07';
    h.ctrl.onPreferencesChanged('sceneSearch.layout.normal');
    assert.strictEqual(h.widgets[0].disposed,1);
    assert.strictEqual(h.widgets.length,2);
    assert.strictEqual(h.ctrl.snapshot.layoutId,'07');
    h.ctrl.onPreferencesChanged('sceneSearch.animation');
    assert.strictEqual(h.widgets.length,2,'non-layout update must not remount');
    h.ctrl.dispose();
    assert.strictEqual(h.widgets[1].disposed,1);
  });
  it('uses independent normal/fullscreen settings and releases pin on mode change',()=>{
    const h=harness({'sceneSearch.layout.normal':'03',
      'sceneSearch.layout.fullscreen':'09'});
    h.ctrl.start('normal');
    h.ctrl.onVideoChange('sm9');h.ctrl.setTime(123);h.ctrl.pin(true);
    assert.strictEqual(h.ctrl.snapshot.pinned,true);
    h.ctrl.setMode('fullscreen');
    assert.strictEqual(h.ctrl.snapshot.layoutId,'09');
    assert.strictEqual(h.ctrl.snapshot.pinned,false);
    assert.strictEqual(h.ctrl.snapshot.videoId,'sm9');
    assert.strictEqual(h.ctrl.snapshot.time,123);
    h.ctrl.setMode('normal');
    assert.strictEqual(h.ctrl.snapshot.layoutId,'03');
    assert.strictEqual(h.widgets.length,3);
    assert(h.widgets.every((x,i)=>i===2||x.disposed===1));
  });
  it('does not rerender a hundred times for unchanged pointer and pin state',()=>{
    const h=harness();
    h.ctrl.start();
    const count=()=>h.events.filter(e=>e[0]==='render').length;
    const start=count();
    h.ctrl.setTime(12);h.ctrl.show(true);h.ctrl.pin(true);
    const after=count();
    assert(after>=start+3,'real changes update active layout');
    for(let i=0;i<100;i++){
      h.ctrl.setTime(12);
      h.ctrl.show(true);
      h.ctrl.pin(true);
    }
    assert.strictEqual(count(),after,
      'idle notifications with unchanged values must not thrash DOM rendering');
    h.ctrl.pin(false);h.ctrl.show(false);
    assert.strictEqual(count(),after+2,'real changes still render');
    h.ctrl.dispose();
  });
  it('links fullscreen to normal without losing separately saved choice',()=>{
    const h=harness({'sceneSearch.layout.normal':'04',
      'sceneSearch.layout.fullscreen':'10',
      'sceneSearch.layout.linkFullscreen':true});
    h.ctrl.start('fullscreen');
    assert.strictEqual(h.ctrl.snapshot.layoutId,'04');
    h.stored['sceneSearch.layout.linkFullscreen']=false;
    h.ctrl.onPreferencesChanged('sceneSearch.layout.linkFullscreen');
    assert.strictEqual(h.ctrl.snapshot.layoutId,'10');
    assert.strictEqual(h.stored['sceneSearch.layout.fullscreen'],'10');
  });
  it('uses a safe fallback for invalid layouts and reports mount failures',()=>{
    const h=harness({'sceneSearch.layout.normal':'bad'});
    h.ctrl.start();
    assert.strictEqual(h.ctrl.snapshot.layoutId,'01');
    h.ctrl.dispose();
    const x=harness({'sceneSearch.layout.normal':'08'},{failIds:['08']});
    x.ctrl.start();
    assert.strictEqual(x.ctrl.snapshot.layoutId,'01');
    assert.strictEqual(x.errors.length,1);
    assert.strictEqual(x.errors[0][1],'08');
    assert.deepStrictEqual(x.widgets.map(w=>w.id),['01']);
  });
  it('never calls seek when the step is zero or direction is invalid',()=>{
    const h=harness();h.ctrl.start();
    assert.strictEqual(h.ctrl.seekBy(-1),true);
    assert.strictEqual(h.ctrl.seekBy(1),true);
    assert.deepStrictEqual(h.seeks,[-5,5]);
    h.stored['sceneSearch.seekStepSeconds']=0;
    h.ctrl.onPreferencesChanged('sceneSearch.seekStepSeconds');
    assert.strictEqual(h.ctrl.snapshot.seekStepSeconds,0);
    assert.strictEqual(h.ctrl.seekBy(-1),false);
    assert.strictEqual(h.ctrl.seekBy(1),false);
    assert.strictEqual(h.ctrl.seekBy(NaN),false);
    assert.deepStrictEqual(h.seeks,[-5,5]);
    h.stored['sceneSearch.seekStepSeconds']=600;
    h.ctrl.seekBy(-1);
    assert.deepStrictEqual(h.seeks,[-5,5,-600]);
    h.stored['sceneSearch.seekStepSeconds']=1000000;
    assert.strictEqual(h.ctrl.snapshot.seekStepSeconds,5,'corrupt value falls back');
  });
  it('clears per-video pin and preview visibility without touching preferences',()=>{
    const h=harness();h.ctrl.start();
    h.ctrl.onVideoChange('sm1');h.ctrl.show();h.ctrl.pin(true);
    assert.strictEqual(h.ctrl.snapshot.shown,true);
    assert.strictEqual(h.ctrl.snapshot.pinned,true);
    h.ctrl.onVideoChange('sm2');
    assert.strictEqual(h.ctrl.snapshot.pinned,false);
    assert.strictEqual(h.ctrl.snapshot.shown,false);
    assert.strictEqual(h.ctrl.snapshot.time,0);
    assert.strictEqual(h.ctrl.snapshot.videoId,'sm2');
    assert.strictEqual(h.stored['sceneSearch.commentPreviewVisible'],true);
    h.stored['sceneSearch.commentPreviewVisible']=false;
    h.ctrl.onPreferencesChanged('sceneSearch.commentPreviewVisible');
    assert.strictEqual(h.ctrl.snapshot.commentPreviewVisible,false);
    h.ctrl.pin(true);h.ctrl.show(false);
    assert.strictEqual(h.ctrl.snapshot.pinned,false);
  });
  it('drops late image responses after a video switch or layout switch',async()=>{
    const waits=[];
    const h=harness({}, {loadPreview:({videoId,time,signal})=>new Promise(resolve=>{
      waits.push({videoId,time,signal,resolve});
    })});
    h.ctrl.start();h.ctrl.onVideoChange('sm1');
    const old=h.ctrl.previewAt(12);
    h.ctrl.onVideoChange('sm2');
    const fresh=h.ctrl.previewAt(22);
    assert.strictEqual(waits.length,2);
    assert.strictEqual(waits[0].signal?.aborted,true);
    waits[0].resolve({image:'old'});
    waits[1].resolve({image:'new'});
    assert.strictEqual(await old,false);
    assert.strictEqual(await fresh,true);
    assert.deepStrictEqual(h.widgets[0].previews.map(p=>p[0].image),['new']);
    const third=h.ctrl.previewAt(32);
    h.ctrl.setMode('fullscreen');
    waits[2].resolve({image:'stale'});
    assert.strictEqual(await third,false);
    assert(h.widgets.every(w=>!w.previews.some(p=>p[0].image==='stale')));
  });
  it('isolates preview failures and never resurrects disposed adapters',async()=>{
    const error=new Error('thumbnail provider offline');
    const h=harness({}, {loadPreview:async()=>{throw error;}});
    h.ctrl.start();h.ctrl.onVideoChange('sm9');
    const outcome=await h.ctrl.previewAt(10);
    assert.strictEqual(outcome,false);
    assert.strictEqual(h.errors.length,1);
    assert.strictEqual(h.errors[0][0],error.message);
    h.ctrl.dispose();h.ctrl.dispose();
    assert.strictEqual(h.widgets[0].disposed,1);
    assert.throws(()=>h.ctrl.start(),/disposed/);
    assert.throws(()=>h.ctrl.setTime(10),/disposed/);
  });
  it('can be stopped without creating any preview or network calls',()=>{
    const h=harness();
    h.ctrl.dispose();
    assert.strictEqual(h.widgets.length,0);
    assert.strictEqual(h.events.length,0);
  });
});

'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require('jsdom');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');
let Panel;
before(async()=>{
  ({ManualBookmarkPanel:Panel}=await new Function('u','return import(u)')(
    pathToFileURL(path.resolve('packages/zenza/src/resume/ManualBookmarkPanel.js')).href));
});
function fixture(){
  const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
  let emit,time=10,shouldThrow=false,enabled=true,seekCalls=0;
  const session={snapshot:{status:'ready',videoId:'sm999',bookmarks:[]},
    subscribe(fn){emit=fn;fn(this.snapshot);return()=>{};}};
  const panel=new Panel(root,session,{
    currentVideoId:()=>session.snapshot.videoId,
    currentTime:()=>time,timestamp:()=>100,newId:()=>'B1',
    seek:()=>{seekCalls++;if(shouldThrow)throw Error('TEST_ONLY_FAILURE');},
    duration:()=>120,repeatEnabled:()=>enabled
  });
  const click=n=>root.querySelector('[data-point-action="'+n+'"]').click();
  const status=()=>root.querySelector('[data-point-status="repeat"]').textContent;
  const fail=()=>{
    click('set-a');time=20;click('set-b');click('repeat');
    shouldThrow=true;panel.tick(20,false,false);
    assert.match(status(),/シークできなかった/);
  };
  const dispose=()=>{panel.dispose();dom.window.close();};
  return {dom,root,session,panel,click,status,fail,dispose,
    switchVideo(){session.snapshot={status:'ready',videoId:'sm1000',bookmarks:[]};
      emit(session.snapshot);},
    setRepeatEnabled:v=>enabled=v};
}
describe('Issue #222 AB repeat failure notice persistence',()=>{
  it('retains the stopped warning after close/open preference refresh',()=>{
    const f=fixture();f.fail();
    f.panel.refreshPreferences();
    assert.match(f.status(),/シークできなかった/);
    assert.equal(f.panel.isRepeating,false);f.dispose();
  });
  it('retains the warning after a new snapshot for the same video',()=>{
    const f=fixture();f.fail();
    f.session.snapshot={...f.session.snapshot,status:'ready'};
    f.panel.refreshPreferences();
    assert.match(f.status(),/シークできなかった/);f.dispose();
  });
  it('clears old failure when user changes an A/B field',()=>{
    const f=fixture();f.fail();
    const input=f.root.querySelector('[data-point-field="a"]');
    input.value='11.5';
    input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    f.panel.refreshPreferences();
    assert.doesNotMatch(f.status(),/シークできなかった/);f.dispose();
  });
  it('does not carry the failure to another video',()=>{
    const f=fixture();f.fail();f.switchVideo();
    assert.doesNotMatch(f.status(),/シークできなかった/);f.dispose();
  });
  it('clears the stale warning when AB is disabled',()=>{
    const f=fixture();f.fail();f.setRepeatEnabled(false);
    f.panel.refreshPreferences();
    assert.doesNotMatch(f.status(),/シークできなかった/);f.dispose();
  });
});
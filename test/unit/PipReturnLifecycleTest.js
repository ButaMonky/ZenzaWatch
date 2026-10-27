'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createContext,extract,run} = require('../helpers/extractSource');
const flush = async () => {for(let i=0;i<6;i++) await Promise.resolve();};

function overlayFixture() {
  const dom = new JSDOM('<!doctype html><html><body>' +
    '<div class="videoPlayer"><video class="zenzaWatchVideoElement"></video>' +
    '</div></body></html>', {url:'https://www.nicovideo.jp/my'});
  const doc=dom.window.document;
  const video=doc.querySelector('video');
  const root=doc.querySelector('.videoPlayer');
  const events=new Map();
  const state={videoInfo:{thumbnail:'https://cdn.example/thumb.jpg'},
    on(n,fn){events.set(n,fn);},off(n){events.delete(n);}};
  const config={props:{},on(){},off(){}};
  const c=createContext({document:doc});
  run('const ThumbnailSourcePolicy='+extract('packages/lib/src/nico/ThumbnailSourcePolicy.js','ThumbnailSourcePolicy','var')+';',c);
  run('const PipPageThumbnail='+extract(
    'packages/zenza/src/videoPlayer/PipPageThumbnail.js',
    'PipPageThumbnail','var')+';this.api=PipPageThumbnail;',c);
  const controller=c.api.initialize({document:doc,state,config,
    getContainer:()=>root,getVideo:()=>video});
  const image=()=>root.querySelector('.zenzaPipPageThumbnail img');
  return {dom,doc,root,video,controller,image,api:c.api,
    cleanup(){controller.dispose();dom.window.close();}};
}
function dispatcherFixture(kind='native'){
  const calls={commentStops:0,overlayStops:0,nativeExits:0};
  const listeners=new Map();
  const video={classList:{contains:name=>name==='zenzaWatchVideoElement'}};
  const other={classList:{contains:name=>false}};
  const doc={
    pictureInPictureElement:kind==='native'?video:kind==='other'?other:null,
    exitPictureInPicture(){
      calls.nativeExits++;
      doc.pictureInPictureElement=null;
      return Promise.resolve();
    }
  };
  const config={props:{},on(){}};
  const dialog={_nicoVideoPlayer:{_videoPlayer:{videoElement:video}},
    on(n,fn){listeners.set(n,fn);},execCommand(){}};
  const c=createContext({
    document:doc,
    ZenzaWatch:{state:{player:{}}},
    PlayerConfig:{getInstance:()=>config},
    CommentPictureInPicture:{stop(){calls.commentStops++;}},
    PipPageThumbnail:{initialize(){},stop(){calls.overlayStops++;}},
    console:{warn(){}}
  });
  run('const RootDispatcher='+extract('src/RootDispatcher.js',
    'RootDispatcher','var')+';this.dispatcher=RootDispatcher;',c);
  c.dispatcher.initialize(dialog);
  return {doc,video,other,calls,dialog,c,
    close(){listeners.get('close')();}};
}
describe('Task712: PiP returns to original page even when leave event is lost',()=>{
  let f;
  afterEach(()=>{if(f){f.cleanup();f=null;}});
  it('removes the thumbnail on browser focus if PiP was restored',()=>{
    f=overlayFixture();
    f.doc.pictureInPictureElement=f.video;
    f.api.activate(f.video);
    assert(f.image());
    f.doc.pictureInPictureElement=null;
    f.dom.window.dispatchEvent(new f.dom.window.Event('focus'));
    assert.strictEqual(f.image(),null);
    assert.strictEqual(f.controller.activePip,null);
    assert.strictEqual(f.controller._pipStateTimer,null);
  });
  it('removes the thumbnail on periodic state check without any leave event',()=>{
    f=overlayFixture();
    f.doc.pictureInPictureElement=f.video;
    f.api.activate(f.video);
    assert(f.image());
    const saved=f.controller._checkPipState;
    f.doc.pictureInPictureElement=null;
    saved();
    assert.strictEqual(f.image(),null);
    assert.strictEqual(f.controller._pipStateTimer,null);
  });
  it('does not close an unrelated replacement PiP window',()=>{
    f=overlayFixture();
    f.doc.pictureInPictureElement=f.video;
    f.api.activate(f.video);
    assert(f.image());
    const other=f.doc.createElement('video');
    f.doc.pictureInPictureElement=other;
    f.controller._checkPipState();
    assert.strictEqual(f.image(),null);
    assert.strictEqual(f.doc.pictureInPictureElement,other);
  });
  it('recovers from lost leave event for comment PiP too',()=>{
    f=overlayFixture();
    const comment=f.doc.createElement('video');
    comment.className='zenzaCommentPipVideo';
    f.doc.body.appendChild(comment);
    f.doc.pictureInPictureElement=comment;
    f.api.activate(comment);
    assert(f.image());
    f.doc.pictureInPictureElement=null;
    f.doc.dispatchEvent(new f.dom.window.Event('visibilitychange'));
    assert.strictEqual(f.image(),null);
  });
  it('keeps the thumbnail while PiP is genuinely active',()=>{
    f=overlayFixture();
    f.doc.pictureInPictureElement=f.video;
    f.api.activate(f.video);
    f.controller._checkPipState();
    f.dom.window.dispatchEvent(new f.dom.window.Event('focus'));
    assert(f.image());
  });
  it('disposes the backup interval and browser event listeners',()=>{
    f=overlayFixture();
    f.doc.pictureInPictureElement=f.video;
    f.api.activate(f.video);
    assert.notStrictEqual(f.controller._pipStateTimer,null);
    f.controller.dispose();
    assert.strictEqual(f.controller._pipStateTimer,null);
    assert.strictEqual(f.image(),null);
  });
});
describe('Task712: closing ZenzaWatch closes its own PiP window',()=>{
  it('closes an owned native PiP when the video dialog closes',async()=>{
    const f=dispatcherFixture('native');
    f.close();
    await flush();
    assert.strictEqual(f.calls.nativeExits,1);
    assert.strictEqual(f.calls.commentStops,1);
    assert.strictEqual(f.calls.overlayStops,1);
    assert.strictEqual(f.doc.pictureInPictureElement,null);
    // Opening the next video no longer inherits a stale native PiP session.
    assert.strictEqual(f.doc.pictureInPictureElement,null);
  });
  it('does not close another site’s PiP when ZenzaWatch closes',async()=>{
    const f=dispatcherFixture('other');
    f.close();
    await flush();
    assert.strictEqual(f.calls.nativeExits,0);
    assert.strictEqual(f.doc.pictureInPictureElement,f.other);
    assert.strictEqual(f.calls.commentStops,1);
  });
  it('still clears comments and page UI when PiP is already closed',()=>{
    const f=dispatcherFixture('none');
    f.close();
    assert.strictEqual(f.calls.nativeExits,0);
    assert.strictEqual(f.calls.commentStops,1);
    assert.strictEqual(f.calls.overlayStops,1);
  });
});

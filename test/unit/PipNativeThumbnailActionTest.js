'use strict';
const assert=require('assert');
const {createContext,extract,run}=require('../helpers/extractSource');
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

function fixture(mode='pending'){
  const activated=[],stopped=[],alerts=[];
  let requestCount=0,stoppedComments=0, resolve, reject;
  const future=new Promise((a,b)=>{resolve=a;reject=b;});
  const wrongVideo={requestPictureInPicture(){throw Error('wrong video');}};
  const video={
    requestPictureInPicture(){
      requestCount++;
      if(mode==='throws'){throw Error('request blocked');}
      return future;
    }
  };
  const document={pictureInPictureElement:null,querySelector(){return wrongVideo;}};
  const config={props:{},on(){},getValue(){}};
  const player={_nicoVideoPlayer:{_videoPlayer:{videoElement:video}},
    on(){},execCommand(){}};
  const c=createContext({
    document,console:{warn(){}},
    ZenzaWatch:{state:{player:{}}},
    PlayerConfig:{getInstance:()=>config},
    PopupMessage:{alert:value=>alerts.push(value)},
    CommentPictureInPicture:{stop(){stoppedComments++;}},
    PipPageThumbnail:{
      initialize(){},stop(){},activate:v=>activated.push(v),
      stopFor:v=>stopped.push(v)
    }
  });
  run('const RootDispatcher='+extract('src/RootDispatcher.js',
    'RootDispatcher','var')+';this.root=RootDispatcher;',c);
  c.root.initialize(player);
  return {c,video,document,activated,stopped,alerts,resolve,reject,
    get requested(){return requestCount;},
    get commentStops(){return stoppedComments;}};
}

describe('Task711 native PiP starts page thumbnail after confirmation',()=>{
  it('activates the actual ZenzaWatch video on successful native PiP',async()=>{
    const h=fixture();
    h.c.root.execCommand('picture-in-picture');
    assert.strictEqual(h.requested,1,'request starts in click handler');
    assert.strictEqual(h.commentStops,1);
    assert.strictEqual(h.activated.length,0);
    h.document.pictureInPictureElement=h.video;
    h.resolve({width:360,height:240});
    await flush();
    assert.deepStrictEqual(h.activated,[h.video]);
  });

  it('does not activate after another PiP replaces the pending video',async()=>{
    const h=fixture();
    h.c.root.execCommand('picture-in-picture');
    h.document.pictureInPictureElement={newer:true};
    h.resolve({});
    await flush();
    assert.strictEqual(h.activated.length,0);
  });
  it('does not show a thumbnail if the native PiP request rejects',async()=>{
    const h=fixture();
    h.c.root.execCommand('picture-in-picture');
    h.reject(Error('NotAllowedError'));
    await flush();
    assert.strictEqual(h.activated.length,0);
    assert.deepStrictEqual(h.stopped,[h.video]);
  });

  it('handles a synchronous rejection without an unhandled exception',()=>{
    const h=fixture('throws');
    assert.doesNotThrow(()=>h.c.root.execCommand('picture-in-picture'));
    assert.strictEqual(h.activated.length,0);
    assert.strictEqual(h.requested,1);
  });

  it('does not request PiP if no active video exists',()=>{
    const h=fixture();
    h.c.document.querySelector=()=>null;
    h.c.root.initialize({_nicoVideoPlayer:{_videoPlayer:{videoElement:null}},
      on(){},execCommand(){}});
    h.c.root.execCommand('picture-in-picture');
    assert.strictEqual(h.requested,0);
    assert.strictEqual(h.alerts.length,1);
  });
});

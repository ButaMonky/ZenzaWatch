'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const deps={
  NicoChat:{TYPE:{NAKA:'naka',TOP:'ue',BOTTOM:'shita'}},
  CommentLayer:{SCREEN:{WIDTH:544,HEIGHT:384,OUTER_WIDTH_FULL:739.2}}
};
const load=file=>loadClass(file,'NicoChatCss3View',createContext(deps));
const source=load('packages/zenza/src/commentLayer/NicoChatCss3View.js');
const bundle=load('dist/ZenzaWatch-dev.user.js');
const base={
  id:'fixture',meta:'{}',htmlText:'text',commentVer:'html5',
  size:'medium',color:'#ffffff',fork:0,duration:4,speed:150,
  beginLeftTiming:1,width:120,height:32,ypos:70,slot:0,
  opacity:1,cssScale:1,cssScaleY:1,fontSizePixel:26,lineHeight:29,
  isDoubleResized:false,isLineResized:false,isOverflow:false,
  isMine:false,isUpdating:false,isInvisible:false,isSubThread:false,
  isPostFail:false,isReverse:false,nicotta:false,fontCommand:''
};
// The bundler changes indentation; compare CSS tokens and declarations, not layout.
const normalizeCss=text=>String(text||'').replace(/\r\n/g,'\n')
  .split('\n').map(line=>line.trim()).filter(Boolean).join('\n');
const comparable=x=>({inline:normalizeCss(x.inline),keyframes:normalizeCss(x.keyframes)});
describe('Task705 CSS3 comment geometry source/dev parity',function(){
  this.timeout(15000);
  it('matches source and bundled CSS for moving/fixed comments over numeric edges',()=>{
    const types=['naka','ue','shita'];
    const rates=[0.5,1,1.5,2];
    const options=[
      {},
      {slot:3,fork:1,cssScale:.5,cssScaleY:.5},
      {isReverse:true,isSubThread:true,color:'#00ff00',opacity:.4},
      {height:386,ypos:0,isOverflow:true,fontSizePixel:38},
      {commentVer:'flash',isLineResized:true,lineHeight:48},
      {speed:70,width:255,duration:30,beginLeftTiming:100}
    ];
    for(const type of types)for(const rate of rates)for(const opt of options){
      const chat={...base,...opt};
      const a=comparable(source.buildChatCss(chat,type,10,rate));
      const b=comparable(bundle.buildChatCss(chat,type,10,rate));
      assert.deepStrictEqual(b,a,JSON.stringify({type,rate,opt}));
      assert.equal(typeof b.inline,'string');
    }
  });
  it('keeps same-fork overlapping slots visually ordered by z-index',()=>{
    const chat={...base,slot:0};
    const next={...base,slot:1};
    const css0=source.buildChatCss(chat,'naka',0).inline;
    const css1=source.buildChatCss(next,'naka',0).inline;
    const z=s=>Number(/z-index:\s*(\d+)/.exec(s)?.[1]);
    assert.equal(z(css1)-z(css0),2000);
    assert.equal(normalizeCss(bundle.buildChatCss(next,'naka',0).inline),normalizeCss(css1));
  });
  it('builds matching DOM output without changing comment visibility classes',()=>{
    const dom=new JSDOM('<!doctype html><html><body></body></html>');
    try{
      for(const type of ['naka','ue','shita'])for(const hidden of [true,false]){
        const chat={...base,isInvisible:hidden,slot:2};
        const css=source.buildChatCss(chat,type,10);
        const a=source.buildChatDom(chat,type,'medium',css,dom.window.document);
        const b=bundle.buildChatDom(chat,type,'medium',css,dom.window.document);
        assert.strictEqual(b.outerHTML,a.outerHTML);
        if(hidden)assert.strictEqual(a.innerHTML,'');
      }
    }finally{dom.window.close();}
  });
  it('renders identical HTML strings for ordinary and overflow comments',()=>{
    const dom=new JSDOM('<!doctype html><html><body></body></html>');
    try{
      for(const overflow of [false,true]){
        const chat={...base,isOverflow:overflow,fontCommand:'mincho'};
        const css=source.buildChatCss(chat,'naka',0);
        assert.strictEqual(
          bundle.buildChatHtml(chat,'naka',css,dom.window.document),
          source.buildChatHtml(chat,'naka',css,dom.window.document));
      }
    }finally{dom.window.close();}
  });
});

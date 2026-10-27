'use strict';
// Task954: freeze the scene preview's vertical baseline while seeking.
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
const {fixture}=require('../helpers/scenePlayerFixture');
const Placement=loadClass('packages/zenza/src/sceneSearch/SceneSearchPlacement.js',
  'SceneSearchPlacement',createContext());
const rect=(left,top,width,height)=>({left,top,width,height});
const overlap=Placement.overlap.bind(Placement);
const scene=(patch={})=>({
 layout:'follow',context:'fullscreen',viewport:rect(0,0,1535,960),
 player:rect(0,0,1535,960),seekbar:rect(0,920,1535,24),
 obstacles:[],anchorX:767,imageSize:{width:180,height:90},
 requestedScale:100,listScale:100,listOpen:false,
 previous:null,hold:false,footerHeight:64,previewAnchorTop:890,...patch
});
describe('Task954: stable preview baseline and fullscreen center',function(){
  it('keeps the browser geometry regression in private CI',()=>{
    const {readFileSync}=require('fs');
    const workflow=readFileSync('.github/workflows/quality.yml','utf8');
    assert(workflow.includes('run: node test/browser/task954-scene-preview-vertical.cjs'));
  });
  it('keeps the same vertical position across all seek positions',()=>{
    const a=Placement.compute(scene({anchorX:150}));
    for(const anchorX of [300,600,767,950,1335,1520]){
      const b=Placement.compute(scene({anchorX}));
      assert.strictEqual(b.rect.top,a.rect.top,'vertical jump at '+anchorX);
      assert.strictEqual(b.rect.height,a.rect.height,'height drift at '+anchorX);
      assert(b.rect.top+b.rect.height<=890-12,'below fullscreen controls');
    }
  });
  it('normal preview stays above the expanded 24px seekbar without jumping on hover',()=>{
    const fixed=scene({context:'normal',viewport:rect(0,0,1280,800),
      player:rect(0,0,1280,800),seekbar:rect(0,770,1280,10),
      previewAnchorTop:756,anchorX:640});
    const collapsed=Placement.compute(fixed);
    const expanded=Placement.compute({...fixed,seekbar:rect(0,756,1280,24)});
    assert.strictEqual(collapsed.rect.top,expanded.rect.top);
    assert.strictEqual(collapsed.rect.height,expanded.rect.height);
    assert(collapsed.rect.top+collapsed.rect.height<=744,'leave gap above thick seekbar');
  });
  it('collisions favor horizontal avoidance instead of moving the preview upward',()=>{
    const block=rect(667,730,200,100);
    const input=scene({obstacles:[block],previewAnchorTop:890,anchorX:767});
    const preferred=Placement.compute(scene({anchorX:767}));
    const actual=Placement.compute(input);
    assert.strictEqual(actual.rect.top,preferred.rect.top,'must not leap vertically at center');
    assert.strictEqual(overlap(actual.rect,block),0,'focused input remains accessible');
  });
  it('keeps the same vertical baseline at four widths and thumbnail scales',()=>{
    for(const width of [320,768,1280,1920]){
      for(const scale of [50,100,150,200]){
        const input=scene({context:'normal',viewport:rect(0,0,width,720),
          player:rect(0,0,width,720),seekbar:rect(0,690,width,10),
          previewAnchorTop:676,requestedScale:scale,anchorX:0});
        const start=Placement.compute(input);
        const end=Placement.compute({...input,anchorX:width-1,seekbar:rect(0,676,width,24)});
        assert.strictEqual(start.rect.top,end.rect.top,JSON.stringify({width,scale}));
        assert.strictEqual(start.rect.height,end.rect.height,JSON.stringify({width,scale}));
        assert(start.rect.left>=8&&end.rect.left+end.rect.width<=width-8+.01);
        assert(start.rect.top+start.rect.height<=676-12+.01);
        assert.strictEqual(overlap(start.rect,rect(0,676,width,24)),0);
      }
    }
  });
  it('bridge reserves the expanded seekbar top despite the real CSS margin change',()=>{
    let expanded=false;
    const h=fixture('follow','normal',{beforeAttach:({d,host,seek,config})=>{
      config.resolveSceneSearch=()=>({
        enabled:true,normal:'follow',fullscreen:'follow',linked:false,
        miniEnabled:true,miniVisible:true,listVisible:true,listAllowed:true,
        listOpen:false,opacity:90,scale:100,listScale:100,miniStyle:'flow'
      });
      const wrap=d.createElement('div');wrap.className='seekBarContainer';
      host.insertBefore(wrap,seek);wrap.append(seek);
      wrap.getBoundingClientRect=()=>rect(0,665,1280,20);
      Object.defineProperty(wrap,'offsetWidth',{configurable:true,value:1280});
      seek.getBoundingClientRect=()=>expanded?rect(0,651,1280,24):rect(0,667,1280,10);
    }});
    try{
      h.move(600);
      const bridge=h.binding.adapter.bridge;
      const card=h.d.querySelector('.zenzaSceneSharedPreview');
      assert(card);
      const before=parseFloat(card.style.top);
      assert.strictEqual(bridge._placementGeometry.previewAnchorTop,651);
      expanded=true;bridge.updatePlacementContext({context:'normal'});
      h.move(600);
      assert.strictEqual(bridge._placementGeometry.previewAnchorTop,651);
      assert.strictEqual(parseFloat(card.style.top),before);
    }finally{h.close();}
  });
  it('integration ignores idle comment input, includes focused input, derives stable control row',()=>{
    const h=fixture('follow','fullscreen',{beforeAttach:({d,host,seek,config})=>{
      config.resolveSceneSearch=()=>({
        enabled:true,normal:'follow',fullscreen:'follow',linked:false,
        miniEnabled:true,miniVisible:true,listVisible:true,listAllowed:true,
        listOpen:false,opacity:90,scale:100,listScale:100,miniStyle:'flow'
      });
      const bar=d.createElement('div');bar.className='videoControlBar';
      const left=d.createElement('div');left.className='controlItemContainer left';
      left.getBoundingClientRect=()=>rect(0,890,150,40);
      bar.append(left);host.append(bar);
      const comment=d.createElement('div');comment.className='commentInputPanel';
      comment.innerHTML='<input id="draft" aria-label="comment">';
      comment.getBoundingClientRect=()=>rect(667,730,200,100);
      host.append(comment);
      seek.getBoundingClientRect=()=>rect(0,920,1535,24);
    }});
    try{
      const bridge=h.binding.adapter.bridge;
      bridge.updatePlacementContext({context:'fullscreen'});
      h.move(200);
      const geometry=bridge._placementGeometry;
      assert(geometry,'geometry available');
      assert.strictEqual(geometry.previewAnchorTop,890);
      assert(!geometry.obstacles.some(ob=>ob.left===667),
        'idle transparent comment should not obstruct seek-preview');
      const card=h.d.querySelector('.zenzaSceneSharedPreview');
      assert(card);
      const y=parseFloat(card.style.top),height=parseFloat(card.style.height);
      h.move(767);
      assert.strictEqual(parseFloat(card.style.top),y,'center jump reproduced');
      assert.strictEqual(parseFloat(card.style.height),height);
      h.d.getElementById('draft').focus();
      bridge.updatePlacementContext({context:'fullscreen'});
      h.move(767);
      assert(bridge._placementGeometry.obstacles.some(ob=>ob.left===667),
        'focused input must still be protected');
      assert.strictEqual(parseFloat(card.style.top),y,'focus avoids input horizontally');
    }finally{h.close();}
  });
});

'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const rect=(left,top,width,height)=>({left,top,width,height,
 right:left+width,bottom:top+height,x:left,y:top});
function harness(mode='fullscreen'){
  return fixture('follow',mode,{beforeAttach:({d,host,seek,config})=>{
    Object.defineProperty(d.defaultView,'innerWidth',{configurable:true,value:1535});
    Object.defineProperty(d.defaultView,'innerHeight',{configurable:true,value:960});
    seek.getBoundingClientRect=()=>rect(0,920,1535,24);
    const bar=d.createElement('div');bar.className='videoControlBar';
    const row=d.createElement('div');row.className='controlItemContainer center';
    const ui=d.createElement('div');ui.className='scalingUI';
    const button=d.createElement('div');button.className='controlButton togglePlay';
    const hidden=d.createElement('div');hidden.className='controlButton hiddenAction';hidden.hidden=true;
    const popup=d.createElement('div');popup.className='zenzaPopupMenu';popup.style.display='none';
    button.append(popup);ui.append(button,hidden);row.append(ui);bar.append(row);host.append(bar);
    row.getBoundingClientRect=()=>rect(550,884,400,40);
    ui.getBoundingClientRect=()=>rect(550,847,400,50);
    button.getBoundingClientRect=()=>rect(745,831,32,32);
    hidden.getBoundingClientRect=()=>rect(740,660,32,32);
    popup.getBoundingClientRect=()=>rect(700,550,120,280);
    config.resolveSceneSearch=()=>({enabled:true,normal:'follow',fullscreen:'follow',
      linked:false,miniEnabled:true,miniVisible:true,listVisible:true,
      listAllowed:true,listOpen:false,opacity:90,scale:100,listScale:100,miniStyle:'flow'});
  }});
}
describe('Task956 fullscreen preview clearance from *visible* buttons',()=>{
  it('keeps the fullscreen pixel-hit regression in private CI',()=>{
    const {readFileSync}=require('fs');
    const ci=readFileSync('.github/workflows/quality.yml','utf8');
    assert(ci.includes('run: node test/browser/task956-fullscreen-scene-control-clearance.cjs'));
  });
  it('reserves the rendered button top, not only the transparent control-column top',()=>{
    const h=harness();
    try{
      const bridge=h.binding.adapter.bridge;
      bridge.updatePlacementContext({context:'fullscreen'});
      h.move(767);
      const g=bridge._placementGeometry;
      assert.strictEqual(g.previewAnchorTop,831,
        'transparent wrapper top 884 must not be used over visible button top 831');
      const card=h.d.querySelector('.zenzaSceneSharedPreview');
      const bottom=parseFloat(card.style.top)+parseFloat(card.style.height);
      assert(bottom<=819+.01,'preview must clear controls with at least 12px gap: '+bottom);
    }finally{h.close();}
  });
  it('ignores hidden buttons and menus, and preserves the normal-mode seek anchor',()=>{
    const h=harness('normal');
    try{
      const bridge=h.binding.adapter.bridge;
      bridge.updatePlacementContext({context:'normal'});
      h.move(767);
      assert.strictEqual(bridge._placementGeometry.previewAnchorTop,920,
        'normal mode should not be affected by fullscreen control icons');
    }finally{h.close();}
  });
});

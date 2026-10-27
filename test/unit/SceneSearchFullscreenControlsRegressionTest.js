'use strict';
const assert=require('assert');
const {loadClass,createContext,read}=require('../helpers/extractSource');
const {fixture:playerFixture}=require('../helpers/scenePlayerFixture');
const Placement=loadClass('packages/zenza/src/sceneSearch/SceneSearchPlacement.js','SceneSearchPlacement',createContext());
const rect=(left,top,width,height)=>({left,top,width,height});
const overlap=(a,b)=>Placement.overlap(a,b);
const scene=(patch={})=>({
 layout:'follow',context:'fullscreen',viewport:rect(0,0,1920,1080),
 player:rect(0,0,1920,1080),seekbar:rect(0,1040,1920,40),
 obstacles:[],anchorX:1880,imageSize:{width:180,height:90},requestedScale:100,
 listScale:100,listOpen:true,hold:false,previous:null,...patch
});
describe('Task934 fullscreen controls must not obstruct scene preview',()=>{
 it('avoids the native right icon row near the final 5% of the seekbar',()=>{
   const buttonRow=rect(1450,935,470,95);
   const input=scene({obstacles:[buttonRow]});
   const positioned=Placement.compute(input);
   assert.strictEqual(overlap(positioned.rect,buttonRow),0,JSON.stringify(positioned.rect));
   assert.strictEqual(overlap(positioned.rect,input.seekbar),0);
   assert(positioned.rect.left>=8 && positioned.rect.left+positioned.rect.width<=1912);
 });
 it('avoids visible fullscreen controls in fixed and held modes',()=>{
   const leftButtons=rect(0,800,320,230);
   const input=scene({layout:'fixed',anchorX:50,obstacles:[leftButtons]});
   const first=Placement.compute(input);
   assert.strictEqual(overlap(first.rect,leftButtons),0,JSON.stringify(first.rect));
   const collidingPrevious=Placement.compute(scene({...input,obstacles:[]}));
   const held=Placement.compute({...input,hold:true,previous:collidingPrevious});
   assert.strictEqual(overlap(held.rect,leftButtons),0,JSON.stringify(held.rect));
 });
 it('preserves exact preferred geometry when there is no collision',()=>{
   const first=Placement.compute(scene());
   const second=Placement.compute(scene({obstacles:[rect(30,50,100,100)]}));
   assert.deepStrictEqual(second.rect,first.rect);
 });
 it('live bridge captures fullscreen right controls, not just command menus',()=>{
   const controlRect=rect(600,350,300,145);
   const h=playerFixture('01','fullscreen',{beforeAttach({d,host,config}){
     const right=d.createElement('div');right.className='controlItemContainer right';
     right.getBoundingClientRect=()=>({...controlRect,right:900,bottom:495});
     host.append(right);
     config.resolveSceneSearch=()=>({
       enabled:true,normal:'follow',fullscreen:'follow',linked:false,
       miniEnabled:true,miniVisible:true,listVisible:true,listAllowed:true,
       listOpen:true,opacity:90,scale:100,listScale:100,miniStyle:'flow'
     });
   }});
   try{
     const bridge=h.binding.adapter?.bridge;
     assert(bridge,'fullscreen layout should be attached');
     bridge.updatePlacementContext({context:'fullscreen'});
     h.move(870);
     const tracked=bridge._placementGeometry?.obstacles||[];
     assert(tracked.some(x=>x.width===300&&x.left===600),'right icon row not included as obstacle');
     const active=bridge._active?.root;
     assert(active,'scene preview not mounted');
     const actual=rect(parseFloat(active.style.left),parseFloat(active.style.top),
       parseFloat(active.style.width),parseFloat(active.style.height));
     assert.strictEqual(overlap(actual,controlRect),0,JSON.stringify(actual));
   }finally{h.close();}
 });
 it('the private installable userscript includes the fix, not just its test fixture',()=>{
   const bundle=read('dist/ZenzaWatch-dev.user.js');
   assert(bundle.includes('class SceneSearchPlacement'));
   assert(bundle.includes('clearFullscreenIcons'));
   assert(bundle.includes('.controlItemContainer.right'));
   assert(bundle.includes('this.sceneSearchBinding.attach()'));
   // Task937: the feature persists beyond Task934; read the actual release
   // metadata instead of pinning a test to the historical Task934 version.
   const source=read('src/_template.js');
   const version=source.match(/^\/\/ @version\s+(\S+)/m)?.[1];
   const distVersion=bundle.match(/^\/\/ @version\s+(\S+)/m)?.[1];
   assert.match(version||'',/^2\.7\.\d+-task\d+$/);
   assert.strictEqual(distVersion,version,'distributed build must match the canonical source');
 });
});

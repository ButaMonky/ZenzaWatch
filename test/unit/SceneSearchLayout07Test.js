'use strict';
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
  'SceneSearchLayoutRegistry',createContext());
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
  'SceneSearchLayoutCard',createContext());
const Film=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout07.js',
  'SceneSearchLayout07',createContext());
function harness(mode='normal',settings={}){
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>',
   {virtualConsole:vc});
 const registry=Film.install(new Registry(),Card);
 const stage=dom.window.document.getElementById('stage'),actions=[];
 stage.getBoundingClientRect=()=>({left:0,top:0,width:900,height:550,right:900,bottom:550});
 const card=registry.create({id:'07',mode,document:dom.window.document,container:stage,
   settings,onAction:(action,ctx)=>actions.push([action,ctx])});
 const state={shown:true,time:70,pinned:false,
   seekStepSeconds:5,commentPreviewVisible:true};
 card.mount(state);
 return {dom,errors,registry,card,stage,state,actions,close(){card.dispose();dom.window.close();}};
}
describe('SCUI-15 optional cached three-frame filmstrip',()=>{
 it('registers only 07 and provides no extra network dependencies',()=>{
   const h=harness();
   assert.deepStrictEqual(h.registry.list().map(x=>x.id).join(','),'07');
   assert(h.registry.get('07').description.includes('クリック'));
   assert.strictEqual(h.card.root.dataset.layout,'07');
   h.close();
 });
 for(const mode of ['normal','fullscreen']){
   it('renders 3 frame slots and removes them cleanly in '+mode,()=>{
     const h=harness(mode);
     assert.strictEqual(h.card.root.querySelectorAll('.zenzaSceneFilmFrame').length,3);
     assert.strictEqual(h.card.root.querySelectorAll('img').length,3);
     assert.strictEqual(h.card.root.dataset.mode,mode);
     assert(h.card.style.textContent.includes('top:calc(100% + 12px)'));
     assert(h.card.style.textContent.includes('bottom:95px'));
     assert.equal(h.card.root.dataset.scuiPlacement,mode==='normal'?'below':'seek-follow');
     assert.strictEqual(h.errors.length,0,JSON.stringify(h.errors));
     h.card.dispose();
     assert.strictEqual(h.stage.children.length,0);
     assert.strictEqual(h.dom.window.document.querySelectorAll('style').length,0);
     h.dom.window.close();
   });
 }
 it('renders supplied preloaded frames only, with true timestamps',()=>{
   const h=harness();
   h.card.onPreview({
     imageUrl:'https://img.example.invalid/current.jpg',time:70,
     frames:{
       previous:{imageUrl:'https://img.example.invalid/previous.jpg',time:61},
       next:{imageUrl:'https://img.example.invalid/next.jpg',time:82}
     }
   });
   const frame=id=>h.card.root.querySelector('[data-frame="'+id+'"]');
   assert(frame('previous').querySelector('img').src.includes('previous.jpg'));
   assert(frame('current').querySelector('img').src.includes('current.jpg'));
   assert(frame('next').querySelector('img').src.includes('next.jpg'));
   assert.strictEqual(frame('previous').querySelector('figcaption').textContent,'1:01');
   assert.strictEqual(frame('current').querySelector('figcaption').textContent,'1:10');
   assert.strictEqual(frame('next').querySelector('figcaption').textContent,'1:22');
   const previous=frame('previous').querySelector('button');
   const next=frame('next').querySelector('button');
   assert.equal(previous.disabled,false);
   assert.equal(next.disabled,false);
   previous.click();next.click();
   assert.deepStrictEqual(h.actions.map(x=>[x[0],x[1].time]),[
      ['frame-seek',61],['frame-seek',82]]);
   h.close();
 });
 it('keeps only one thumbnail if side images are missing or unsafe',()=>{
   const h=harness();
   h.card.onPreview({imageUrl:'https://img.example.invalid/current.jpg',
     frames:{previous:{imageUrl:'javascript:alert(1)',time:30}}});
   for(const side of ['previous','next']){
     const fig=h.card.root.querySelector('[data-frame="'+side+'"]');
     assert.strictEqual(fig.querySelector('img').hidden,true);
     assert.strictEqual(fig.querySelector('img').hasAttribute('src'),false);
   }
   assert.strictEqual(h.card.root.querySelectorAll('script').length,0);
   assert.strictEqual(h.card.root.querySelector('[data-frame="previous"] button').disabled,true);
   h.card.root.querySelector('[data-frame="previous"] button').click();
   assert.equal(h.actions.length,0,'unavailable frame must not seek');
   h.close();
 });
 it('collapses to one narrow picture when the seek step is zero',()=>{
   const h=harness();
   h.card.render({...h.state,seekStepSeconds:0,time:80});
   assert(h.card.root.classList.contains('is-compact'));
   assert.strictEqual(h.card.root.style.getPropertyValue('--scene-preview-min-width'),'124px');
   assert.strictEqual(h.card.root.querySelector('[data-frame="previous"]').hidden,true);
   assert.strictEqual(h.card.root.querySelector('[data-frame="next"]').hidden,true);
   assert.strictEqual(h.card.root.querySelector('[data-scui-action="seek-back"]').hidden,true);
   h.card.render({...h.state,seekStepSeconds:10});
   assert.strictEqual(h.card.root.querySelector('[data-frame="previous"]').hidden,false);
   h.close();
 });
 it('follows the actual cursor only in fullscreen and keeps a pinned position',()=>{
   let x=250;
   const h=harness('fullscreen',{
     getDuration:()=>1000,
     getSeekGeometry:()=>({pointerX:x,visibleLeft:0,visibleRight:900})
   });
   assert.equal(h.card.root.style.getPropertyValue('--scene-x'),'250px');
   x=890;h.card.render({...h.state,time:900});
   assert.equal(h.card.root.style.getPropertyValue('--scene-x'),'729px');
   x=80;h.card.render({...h.state,pinned:true});
   assert.equal(h.card.root.style.getPropertyValue('--scene-x'),'729px');
   h.close();
 });
 it('clears stale adjacent images on video change',()=>{
   const h=harness();
   const asset={imageUrl:'https://img.example.invalid/current.jpg',time:70,
     frames:{previous:{imageUrl:'https://img.example.invalid/previous.jpg',time:61}}};
   h.card.render({...h.state,videoId:'sm9'});
   h.card.onPreview(asset);
   assert.equal(h.card.root.querySelector('[data-frame="previous"] button').disabled,false);
   h.card.render({...h.state,videoId:'sm10'});
   const previous=h.card.root.querySelector('[data-frame="previous"]');
   assert.equal(previous.querySelector('button').disabled,true);
   assert.equal(previous.querySelector('img').hasAttribute('src'),false);
   h.close();
 });
 it('uses exactly two disposable shared-worker thumbnail views when storyboard is ready',()=>{
   const views=[],raw={status:'ok',storyboard:{}};
   const model={isAvailable:true,rawData:raw,cellCount:12,cellIntervalMs:10000,
     duration:110,getIndex:ms=>Math.min(11,Math.max(0,Math.floor(ms/10000)))};
   const h=harness('normal',{
     getStoryboardModel:()=>model,
     createFilmstripThumbnail:opts=>{
       const v={opts,times:[],disposed:false};views.push(v);
       return {set currentTime(t){v.times.push(t);},
         dispose(){v.disposed=true;}};
     }
   });
   assert.strictEqual(views.length,2,'no more than two adjacent views');
   assert.strictEqual(h.card.root.querySelectorAll('.zenzaSceneAdjacentCanvas').length,2);
   assert(views.every(v=>v.opts.info===raw),'existing source object is shared');
   const sides=side=>h.card.root.querySelector('[data-frame="'+side+'"] button');
   assert.equal(sides('previous').disabled,false);
   assert.equal(sides('next').disabled,false);
   sides('previous').click();sides('next').click();
   assert.deepStrictEqual(h.actions.map(x=>x[1].time),[60,80]);
   h.card.render({...h.state,time:80});
   assert.equal(views.length,2,'moving cursor must reuse both worker views');
   assert.deepStrictEqual(views[0].times,[60,70]);
   assert.deepStrictEqual(views[1].times,[80,90]);
   h.card.render({...h.state,seekStepSeconds:0});
   assert(views.every(v=>v.disposed),'compact mode releases both extra views');
   assert.equal(h.card.root.querySelectorAll('.zenzaSceneAdjacentCanvas').length,0);
   h.close();
 });
 it('does not keep previous video frames after storyboard reset',()=>{
   const views=[],raw={status:'ok'};
   const model={isAvailable:true,rawData:raw,cellCount:10,cellIntervalMs:10000,
      duration:100,getIndex:ms=>Math.floor(ms/10000)};
   let available=true;
   const h=harness('normal',{
      getStoryboardModel:()=>available?model:null,
      createFilmstripThumbnail:opts=>{
        const row={canvas:opts.canvas,disposed:false};views.push(row);
        return {set currentTime(value){row.time=value;},
          dispose(){row.disposed=true;}};
      }
   });
   assert.equal(views.length,2);
   available=false;
   h.card.render({...h.state,time:71,videoId:'new-video'});
   assert(views.every(v=>v.disposed));
   assert.equal(h.card.root.querySelectorAll('.zenzaSceneAdjacentCanvas').length,0);
   assert.equal(h.card.root.querySelector('[data-frame="previous"] button').disabled,true);
   h.close();
 });
 it('does not retry failing worker creation on every pointer movement',()=>{
   const raw={status:'ok'},model={isAvailable:true,rawData:raw,
     cellCount:12,cellIntervalMs:10000,duration:110,
     getIndex:ms=>Math.floor(ms/10000)};
   let calls=0;
   const h=harness('normal',{
     getStoryboardModel:()=>model,
     createFilmstripThumbnail:()=>{calls++;throw Error('worker unavailable');}
   });
   assert.equal(calls,2);
   for(let i=0;i<20;i++)h.card.render({...h.state,time:70+i/40});
   assert.equal(calls,2);
   assert.equal(h.card.root.querySelectorAll('.zenzaSceneAdjacentCanvas').length,0);
   assert.equal(h.card.root.querySelector('[data-frame="next"] button').disabled,true);
   h.close();
 });
 it('handles many existing preview updates without spawning new DOM or styles',()=>{
   const h=harness();
   for(let i=0;i<100;i++){
     h.card.onPreview({imageUrl:'https://img.example.invalid/f'+i+'.jpg'});
   }
   assert.strictEqual(h.card.root.querySelectorAll('img').length,3);
   assert.strictEqual(h.dom.window.document.querySelectorAll('style').length,1);
   h.close();
 });
});
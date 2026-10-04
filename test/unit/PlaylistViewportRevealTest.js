const assert=require('assert');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {loadClass}=require('../helpers/extractSource');
function setup(columns=1){
 const ctx=createPlaylistContext();const View=loadClass('packages/zenza/src/Playlist/VideoListView.js','VideoListView',ctx.c);
 const view=Object.create(View.prototype),items=Array.from({length:2000},(_,i)=>ctx.item('sm'+i));
 const model=new ctx.VideoListModel({maxItems:2000});model.setItem(items);view.model=model;view.items=items;
 let reads=0,renders=0;const nodes=items.map((item,i)=>({dataset:{itemId:String(item.itemId)},get offsetTop(){reads++;return Math.floor(i/columns)*100;},offsetHeight:100}));
 view.list={children:nodes};view.listContainer={scrollTop:50000,clientHeight:400};view.renderList=async()=>{renders++;};
 return {view,items,nodes,reads:()=>reads,renders:()=>renders};
}
describe('Task229 scroll viewport content before observer delivery',()=>{
 it('reveals a jumped-to viewport synchronously and leaves distant items lazy',()=>{
  const x=setup();x.view._revealVisibleItems();
  for(let i=500;i<504;i++)assert.strictEqual(x.items[i].isLazy,false);
  assert.strictEqual(x.items[0].isLazy,true);assert.strictEqual(x.items[1999].isLazy,true);assert.strictEqual(x.renders(),1);
 });
 it('uses bounded geometry reads instead of scanning all 2000 cards',()=>{
  const x=setup();x.view._revealVisibleItems();assert(x.reads()<100,`reads=${x.reads()}`);
  x.view._revealVisibleItems();assert.strictEqual(x.renders(),1,'unchanged viewport does not rerender');
 });
 it('includes all columns of the visible rows and resolves current DOM identity',()=>{
  const x=setup(2);x.nodes[1000].dataset.itemId=String(x.items[1999].itemId);x.view._revealVisibleItems();
  assert.strictEqual(x.items[1999].isLazy,false);for(let i=1001;i<1008;i++)assert.strictEqual(x.items[i].isLazy,false);
 });
 it('does not touch missing or hidden viewports',()=>{
  const x=setup();x.view.listContainer.clientHeight=0;x.view._revealVisibleItems();assert.strictEqual(x.renders(),0);assert.strictEqual(x.reads(),0);
  x.view.list=null;x.view._revealVisibleItems();assert.strictEqual(x.renders(),0);
 });
});

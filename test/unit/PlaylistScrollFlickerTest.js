const assert=require('assert');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {loadClass}=require('../helpers/extractSource');
function setup(){
 const {c,item,VideoListModel,flush}=createPlaylistContext();
 const View=loadClass('packages/zenza/src/Playlist/VideoListView.js','VideoListView',c);
 const view=Object.create(View.prototype),model=new VideoListModel({uniq:true,maxItems:100});
 const classes=new Set();view.classList={add:n=>classes.add(n),remove:n=>classes.delete(n)};
 view.model=model;view.emit=()=>{};
 return {view,model,item,classes,flush};
}
describe('Task225 playlist scroll presentation',()=>{
 it('keeps the existing list undimmed while a visibility-driven update awaits rendering',async()=>{
  const {view,model,item,classes,flush}=setup();const video=item('sm1');model.setItem([video]);await flush(5);
  let release,updating;view.renderList=()=>new Promise(r=>release=r);
  model.on('update',items=>{updating=view._onModelUpdate(items);});
  view._onItemInview([{target:{dataset:{itemId:video.itemId}},isIntersecting:true}]);await flush(8);
  assert(updating,'real item/model update must reach the view');
  const wasDimmed=classes.has('is-updating');release();await updating;
  assert.strictEqual(wasDimmed,false,'scroll-only item updates must not dim the entire playlist');
 });
 it('still clears a previously explicit drag update state after rendering',async()=>{
  const {view,classes}=setup();classes.add('is-updating');view.renderList=async()=>{};
  await view._onModelUpdate([]);assert(!classes.has('is-updating'));
 });
});

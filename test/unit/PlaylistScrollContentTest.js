const assert=require('assert');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {loadClass,beginSection,run}=require('../helpers/extractSource');
function setup(){
 const ctx=createPlaylistContext();const {c}=ctx;
 c.dll={lit:{html:(parts,...v)=>parts.reduce((s,p,i)=>s+p+(v[i]==null?'':v[i]),'')},directives:{classMap:()=>''}};
 run(beginSection('packages/zenza/src/Playlist/VideoListItemView.js')+';globalThis.ItemView=VideoListItemView;',c);
 const View=loadClass('packages/zenza/src/Playlist/VideoListView.js','VideoListView',c);
 return {...ctx,View,view:Object.create(View.prototype)};
}
describe('Task226 visible playlist content',()=>{
 it('renders newly visible content without waiting for throttled model notification',async()=>{
  const {view,item,VideoListModel}=setup();const v=item('sm1');const model=new VideoListModel({uniq:true});model.setItem([v]);view.model=model;view.items=[v];
  let renders=0;view.renderList=async()=>{renders++;assert.strictEqual(v.isLazy,false);};
  const entry={target:{dataset:{itemId:v.itemId}},isIntersecting:true};
  view._onItemInview([entry]);assert.strictEqual(renders,1);
  view._onItemInview([entry]);assert.strictEqual(renders,1,'unchanged observer notifications do not rerender');
 });
 it('invalidates lazy markup before its delayed timestamp update',()=>{
  const {c,item}=setup();const v=item('sm2');const timestamp=v.timestamp;
  assert(!c.ItemView.build(v).includes('class="videoInfo"'));
  v.isLazy=false;assert.strictEqual(v.timestamp,timestamp);
  assert(c.ItemView.build(v).includes('class="videoInfo"'));
  v.isLazy=true;assert(!c.ItemView.build(v).includes('class="videoInfo"'));
 });
 it('keeps existing observations and removes only detached cards',()=>{
  const {view}=setup();const a={dataset:{itemId:'1'}},b={dataset:{itemId:'2'}},c={dataset:{itemId:'3'}};let targets=[a,b],observer;
  class IO {constructor(){observer=this;this.targets=new Set();this.observeCalls=0;}observe(x){this.targets.add(x);this.observeCalls++;}unobserve(x){this.targets.delete(x);}disconnect(){this.targets.clear();}}
  view.document={querySelectorAll:()=>targets};view.contentWindow={IntersectionObserver:IO};
  view._setInviewObserver();const first=observer;
  view._setInviewObserver();assert.strictEqual(observer,first,'retain observer so queued visibility records survive');assert.strictEqual(observer.observeCalls,2);
  targets=[b,c];view._setInviewObserver();assert.deepStrictEqual([...observer.targets],[b,c]);assert.strictEqual(observer.observeCalls,3);
  // lit reuses a DOM card when sort/replacement puts a different item there.
  b.dataset.itemId='99';view._setInviewObserver();assert.strictEqual(observer.observeCalls,4,'reobserve reused card identity to load its metadata');
  targets=[];view._setInviewObserver();assert.strictEqual(observer.targets.size,0);
 });
 it('does not let a delayed old render replace the latest visible contents',async()=>{
  const {c,view}=setup();view.list={content:''};c.dll.lit.render=(result,list)=>list.content=result;
  let oldDone,newDone;view._buildList=items=>new Promise(r=>items[0]==='old'?oldDone=r:newDone=r);
  view._updateCSSVars=()=>{};view._setInviewObserver=()=>{};c.ItemView.fitCounters=()=>{};
  const old=view.renderList(['old']),latest=view.renderList(['new']);newDone('new');await latest;oldDone('old');await old;
  assert.strictEqual(view.list.content,'new');
 });
});

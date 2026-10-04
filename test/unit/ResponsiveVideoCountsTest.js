const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {beginSection, run, loadClass} = require('../helpers/extractSource');
function setup() {
  const {c,item}=createPlaylistContext();
  c.dll={lit:{html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i] == null ? '' : p.endsWith('=') ? JSON.stringify(String(values[i])) : values[i]),'')},directives:{classMap:()=> 'videoItem'}};
  run(beginSection('packages/zenza/src/Playlist/VideoListItemView.js')+';globalThis.View=VideoListItemView;',c);
  const v=item('sm1',{view_counter:31441461,num_res:5594970,mylist_counter:674219,like:45678}); v.isLazy=false;
  const dom=new JSDOM(c.View.build(v));
  return {View:c.View,root:dom.window.document,close:()=>dom.window.close(),c};
}
describe('Task227 Japanese count display',()=>{
  it('always abbreviates large card counts before any layout measurement',()=>{
    const x=setup();try{assert.strictEqual(x.root.querySelector('.viewCount').textContent,'3144万');assert.strictEqual(x.root.querySelector('.likeCount').textContent,'4.5万');}finally{x.close();}
  });
  it('keeps exact card counts in the tooltip',()=>{
    const x=setup();try{assert(x.root.querySelector('.viewCount').closest('.count').title.includes('31,441,461'));}finally{x.close();}
  });
  it('formats boundaries without rounding up',()=>{
    const x=setup();try{for(const [n,want] of [[0,'0'],[9999,'9,999'],[10000,'1万'],[12000,'1.2万'],[35999,'3.5万'],[1000000,'100万'],[674219,'67.4万'],[31441461,'3144万'],[99999999,'9999万'],[100000000,'1億'],[123456789,'1.2億']])assert.strictEqual(x.View.compactCount(n),want);}finally{x.close();}
  });
  it('uses the current watch-later name on the card',()=>{
    const x=setup();try{assert.strictEqual(x.root.querySelector('.deflistAdd').title,'あとで見る');}finally{x.close();}
  });
});
describe('Task227 header likes',()=>{
  let x,meta;
  beforeEach(()=>{
    x=setup();x.c.BaseViewComponent=class {};
    const Meta=loadClass('src/VideoInfoPanel.js','VideoMetaInfo',x.c);
    meta=Object.create(Meta.prototype);meta._elm={};
    for(const key of ['postedAt','viewCount','commentCount','mylistCount','likeCount','likeColumn'])meta._elm[key]=x.root.createElement('span');
  });
  afterEach(()=>x.close());
  it('shows known zero likes and preserves them on comment-only updates',()=>{
    meta.update({postedAt:0,count:{view:31441461,comment:3,mylist:4,like:0}});
    assert.strictEqual(meta._elm.likeCount.textContent,'0');assert.strictEqual(meta._elm.likeColumn.hidden,false);
    meta.updateVideoCount({comment:8});assert.strictEqual(meta._elm.likeCount.textContent,'0');assert.strictEqual(meta._elm.likeColumn.hidden,false);
  });
  it('clears previous likes when switching to a video without likes',()=>{
    meta.update({postedAt:0,count:{like:12}});meta.update({postedAt:1,count:{view:2}});
    assert.strictEqual(meta._elm.likeColumn.hidden,true);assert.strictEqual(meta._elm.likeCount.textContent,'');
  });
  it('shows exact header counts while cards keep their compact display',()=>{
    for(const counts of [{view:209757,comment:1070,mylist:1790,like:63},{view:31441461,comment:5594970,mylist:674219,like:45678}]) {
      meta.updateVideoCount(counts);
      for(const key of ['view','comment','mylist','like']) {
        assert.strictEqual(meta._elm[key+'Count'].textContent,counts[key].toLocaleString());
        assert.strictEqual(meta._elm[key+'Count'].title,counts[key].toLocaleString());
      }
    }
  });
  it('hides explicitly invalid likes instead of showing a fabricated zero',()=>{
    for(const like of [null,-1,NaN,Infinity,'0',1.5]) {meta.updateVideoCount({like:5});meta.updateVideoCount({like});assert.strictEqual(meta._elm.likeColumn.hidden,true);}
  });
});

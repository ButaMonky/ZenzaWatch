const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {beginSection, run} = require('../helpers/extractSource');
function setup() {
  const {c,item}=createPlaylistContext();
  c.dll={lit:{html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i] == null ? '' : values[i]),'')},directives:{classMap:()=> 'videoItem'}};
  run(beginSection('packages/zenza/src/Playlist/VideoListItemView.js')+';globalThis.View=VideoListItemView;',c);
  const v=item('sm1',{view_counter:31441461,num_res:5594970,mylist_counter:674219,like:45678}); v.isLazy=false;
  const dom=new JSDOM(c.View.build(v));
  const root=dom.window.document;
  const counter=root.querySelector('.counter');
  let width=440;
  Object.defineProperty(counter,'clientWidth',{get:()=>width});
  // jsdom has no layout: only the browser's measured geometry is supplied.
  for(const el of root.querySelectorAll('.count-full')) {
    el.getBoundingClientRect=()=>({width:105});
  }
  return {View:c.View,root,counter,setWidth:n=>width=n,close:()=>dom.window.close()};
}
describe('Task224 responsive counts',()=>{
  it('keeps exact counts when they fit, compacts only on overflow, and restores them',()=>{
    const x=setup();
    try {
      x.View.fitCounters(x.root);
      assert(!x.counter.classList.contains('is-compact'));
      assert(x.root.querySelector('.count-full').textContent.includes('31,441,461'));
      x.setWidth(300); x.View.fitCounters(x.root);
      assert(x.counter.classList.contains('is-compact'));
      assert(x.root.querySelector('.count-short').textContent.includes('3144万'));
      x.setWidth(440); x.View.fitCounters(x.root);
      assert(!x.counter.classList.contains('is-compact'));
    } finally {x.close();}
  });
  it('does not shorten a hidden zero-width list before it becomes visible',()=>{
    const x=setup(); try {x.setWidth(0);x.View.fitCounters(x.root);assert(!x.counter.classList.contains('is-compact'));} finally{x.close();}
  });
  it('counts the gap between fields at the exact fit boundary',()=>{
    const x=setup();try{x.setWidth(435);x.View.fitCounters(x.root);assert(!x.counter.classList.contains('is-compact'));x.setWidth(434);x.View.fitCounters(x.root);assert(x.counter.classList.contains('is-compact'));}finally{x.close();}
  });
  it('formats Japanese units without rounding up and retains small exact counts',()=>{
    const x=setup();try{for(const [n,want] of [[0,'0'],[9999,'9,999'],[10000,'1万'],[674219,'67.4万'],[31441461,'3144万'],[99999999,'9999万'],[123456789,'1.2億']])assert.strictEqual(x.View.compactCount(n),want);}finally{x.close();}
  });
});

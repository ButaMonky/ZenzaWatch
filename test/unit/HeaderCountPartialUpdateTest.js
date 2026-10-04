const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {loadClass}=require('../helpers/extractSource');
describe('Task228 real comment-count event preserves header counters',()=>{
 it('keeps views and mylists after the dialog expands a comment-only update',()=>{
  const {c}=createPlaylistContext();c.BaseViewComponent=class{};
  const Meta=loadClass('src/VideoInfoPanel.js','VideoMetaInfo',c);
  const DialogView=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView',c);
  const dom=new JSDOM('');const meta=Object.create(Meta.prototype);meta._elm={};
  for(const key of ['postedAt','viewCount','commentCount','mylistCount','likeCount','likeColumn'])meta._elm[key]=dom.window.document.createElement('span');
  try {
   meta.update({postedAt:0,count:{view:115000,comment:1351,mylist:158,like:1225}});
   const view=Object.create(DialogView.prototype);view.emit=(name,data)=>{assert.strictEqual(name,'videoCount');meta.updateVideoCount(data);};
   view._onVideoCount({comment:1282});
   assert.strictEqual(meta._elm.viewCount.textContent,'115,000');
   assert.strictEqual(meta._elm.mylistCount.textContent,'158');
   assert.strictEqual(meta._elm.commentCount.textContent,'1,282');
   assert.strictEqual(meta._elm.likeCount.textContent,'1,225');
  }finally{dom.window.close();}
 });
});

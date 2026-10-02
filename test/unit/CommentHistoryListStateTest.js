'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
function subject(){
 const V=loadClass('src/CommentPanel.js','CommentListView',createContext({Emitter:class{}}));
 V.ITEM_HEIGHT=40;const v=Object.create(V.prototype);
 const node=id=>{const classes=new Set();return {dataset:{itemId:String(id)},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)}};};
 const detail=node(-1);detail.classList.add('show');
 Object.assign(v,{_container:{scrollTop:45},_scrollTop:45,_innerHeight:80,isAutoScroll:false,isActive:false,_model:{currentSortKey:'vpos'},_$itemDetail:[detail]});
 const make=(keys,base=0)=>keys.map((no,i)=>({_item:{itemId:base+i,nicoChat:{threadId:'10',fork:0,no}},viewElement:node(base+i),top:i*40}));
 let shown=null;v.showItemDetail=item=>{shown=item;};v.hideItemDetail=()=>{shown=null;};
 v._itemViews=make([1,2,3,4,5]);return {v,make,detail:()=>shown};
}
describe('Task200 stable comment-list reading state',()=>{
 it('anchors the same comment and in-row offset after rows are inserted before it',()=>{
  const {v,make}=subject();assert.strictEqual(typeof v._captureReadingState,'function');
  const state=v._captureReadingState();v._itemViews=make([8,9,1,2,3,4,5],100);
  v._restoreReadingState(state);assert.strictEqual(v._container.scrollTop,125);assert.strictEqual(v._scrollTop,125);
 });
 it('restores selection and detail with newly allocated row IDs',()=>{
  const h=subject(),{v,make}=h;v._selectedItem=v._itemViews[2].viewElement;v._selectedItem.classList.add('is-active');
  v._$itemDetail[0].dataset.itemId='2';const state=v._captureReadingState();
  v._itemViews=make([8,1,2,3,4,5],100);v._restoreReadingState(state);
  assert.strictEqual(v._selectedItem.dataset.itemId,'103');assert.strictEqual(h.detail().nicoChat.no,3);
 });
 it('uses a nearby surviving row and clears a removed selection',()=>{
  const h=subject(),{v,make}=h;v._selectedItem=v._itemViews[2].viewElement;v._$itemDetail[0].dataset.itemId='2';
  const state=v._captureReadingState();v._itemViews=make([1,4,5],100);v._restoreReadingState(state);
  assert.strictEqual(v._container.scrollTop,5);assert.strictEqual(v._selectedItem,null);assert.strictEqual(h.detail(),null);
 });
 it('does not override current-time following when automatic scroll is active',()=>{
  const {v,make}=subject();v.isAutoScroll=true;const state=v._captureReadingState();
  v._itemViews=make([8,1,2,3,4,5],100);v._container.scrollTop=120;v._restoreReadingState(state);
  assert.strictEqual(v._container.scrollTop,120);
 });
 it('handles an empty replacement without stale selection or out-of-range scroll',()=>{
  const {v}=subject();const state=v._captureReadingState();v._itemViews=[];v._restoreReadingState(state);
  assert.strictEqual(v._container.scrollTop,0);assert.strictEqual(v._selectedItem,null);
 });
 it('keeps model time on same-video list replacement; clear still resets it',()=>{
  const c=createContext({Emitter:class{emit(){}emitAsync(){}},_:require('lodash'),textUtil:{escapeHtml:String,dateToString:String,secToTime:String}});
  c.CommentListItem=loadClass('src/CommentPanel.js','CommentListItem',c);c.CommentListItem._itemId=0;
  const M=loadClass('src/CommentPanel.js','CommentListModel',c),m=new M({});m.currentTime=33;
  m.setChatList({top:[],naka:[],bottom:[]});assert.strictEqual(m.currentTime,33);
  m.clear();assert.strictEqual(m.currentTime,0);
 });
});

describe('Task200 list generation isolation',()=>{
 it('does not restore old selection or manual scroll after the player clears for a new video',()=>{
  const {v,make}=subject();v._readingEpoch=1;v._model._readingEpoch=2;
  v._selectedItem=v._itemViews[1].viewElement;
  const state=v._captureReadingState();v._itemViews=make([1,2,3],100);v._restoreReadingState(state);
  assert.strictEqual(v._container.scrollTop,0);assert.strictEqual(v._selectedItem,null);
 });
});

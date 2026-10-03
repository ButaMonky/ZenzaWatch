const assert = require('assert');
const {loadClass, createContext, read} = require('../helpers/extractSource');
function machine(info, postedAt) {
  const c = createContext({BaseViewComponent: class {}, global:{debug:{}}, window:{setTimeout(){}}});
  const C = loadClass('src/CommentPanel.js','TimeMachineView',c);
  const v=Object.create(C.prototype), attrs={}, events=[];
  v._state={isWaybackMode:false};
  v._elm={time:{textContent:''},input:{value:'2012-01-01T00:00:00',setAttribute(k,x){attrs[k]=x;},removeAttribute(k){delete attrs[k];},focus(){}}};
  v.setState=s=>Object.assign(v._state,s);v.emit=(...a)=>events.push(a);
  v.update(info,{videoPostedAt:postedAt});
  return {v,attrs,events};
}
const posted='2009-10-27T03:13:22+09:00';
describe('Task209 historical date selection is independent of opaque thread IDs',()=>{
  for(const id of ['1790214592','1653742625716268575']) {
    it('keeps a 2012 selection with thread '+id,()=>{
      const h=machine({threadId:id,isWaybackMode:false},posted);h.v.openSelect();h.v._onSubmit();
      assert.strictEqual(h.events[0][2].when,Date.parse('2012-01-01T00:00:00')/1000);
      assert.strictEqual(h.attrs.min,h.v._toTDate(Date.parse(posted)));
    });
  }
  it('omits the lower bound when the video publication date is unavailable',()=>{
    const h=machine({threadId:'1790214592',isWaybackMode:false});h.v.openSelect();
    assert.strictEqual(h.attrs.min,undefined);h.v._onSubmit();
    assert.strictEqual(h.events[0][2].when,Date.parse(h.v._elm.input.value)/1000);
  });
  it('has no invented minimum before publication metadata arrives',()=>{
    const h=machine({threadId:'10'});h.v._videoPostTime=undefined;h.v.openSelect();assert.strictEqual(h.attrs.min,undefined);
  });
  it('clears an old lower bound after switching to a video with no usable date',()=>{
    const h=machine({threadId:'10'},posted);h.v.openSelect();h.v.update({threadId:'20'},{videoPostedAt:'invalid'});h.v.openSelect();
    assert.strictEqual(h.attrs.min,undefined);
  });
  it('does not send invalid or impossible selected times',()=>{
    for(const value of ['', 'not-a-date', '9999-99-99T99:99']) {
      const h=machine({threadId:'10'},posted);h.v._elm.input.value=value;h.v._onSubmit();assert.strictEqual(h.events.length,0);
    }
  });
  it('does not replace a successful historical label until Back succeeds',()=>{
    const h=machine({threadId:'10',isWaybackMode:true,when:1572253829},posted);const before=h.v._currentTimestamp;
    h.v._onBack();assert.strictEqual(h.v._state.isWaybackMode,true);assert.strictEqual(h.v._currentTimestamp,before);
    assert.strictEqual(h.events[0][2].when,0);h.v.update({threadId:'10',isWaybackMode:false},{videoPostedAt:posted});assert.strictEqual(h.v._state.isWaybackMode,false);
  });
  it('passes actual publication metadata from the current player without mutating thread info',()=>{
    const C=loadClass('src/CommentPanel.js','CommentPanelView',createContext({Emitter:class{}}));
    const v=Object.create(C.prototype),info=Object.freeze({threadId:'10'});let received;
    v.commentPanel={_player:{_videoInfo:{postedAt:posted}}};v._timeMachineView={update:(...a)=>received=a};v._onThreadInfo(info);
    assert.strictEqual(received[0],info);assert.strictEqual(received[1].videoPostedAt,posted);
  });
  it('supports selecting the original comment second rather than forcing whole minutes',()=>{
    assert(/class="dateTimeInput"[^>]*step="1"/.test(read('src/CommentPanel.js')));
  });
});
describe('Task209 validates the final past-log request boundary',()=>{
  function dialog(){const C=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',createContext({Emitter:class{}}));const d=Object.create(C.prototype),calls=[],alerts=[];d._videoInfo={msgInfo:{videoId:'sm9'}};d.loadComment=x=>{calls.push(x);return Promise.resolve('loaded');};d.execCommand=(...a)=>alerts.push(a);return {d,calls,alerts};}
  for(const when of [NaN,Infinity,-1,1653742625716268575,Date.now()/1000+86400])it('does not send invalid/future when '+when,()=>{
    const h=dialog();h.d.reloadComment({when});assert.strictEqual(h.calls.length,0);assert.strictEqual(h.alerts.length,1);
  });
  it('preserves the selected timestamp, leaves metadata alone, and returns load completion',async()=>{
    const h=dialog(),msg=h.d._videoInfo.msgInfo;assert.strictEqual(await h.d.reloadComment({when:1572253829}),'loaded');
    assert.strictEqual(h.calls[0].when,1572253829);assert.strictEqual(msg.when,undefined);
    await h.d.reloadComment({when:0});assert.strictEqual(h.calls[1].when,0);
  });
});

const assert=require('assert');
const {subject}=require('../helpers/commentMetricSubject');
const args=()=>['hello',29,'naka','medium','','flash'];
function measure(h,owner,input=args()) {
  assert.strictEqual(typeof h.field.measureChat,'function','original-size cache API is available');
  return h.field.measureChat(owner,...input);
}
describe('Task218 original-size measurement reuse',()=>{
  it('measures identical retained comments once without changing the source',async()=>{const h=await subject(),c=Object.freeze({text:'hello'});const a=measure(h,c),b=measure(h,c);assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),{width:180,height:29});assert.deepStrictEqual(a,b);assert.strictEqual(h.count.width,1);assert.strictEqual(h.count.height,1);assert.strictEqual(h.count.writes,1);assert.deepStrictEqual(c,{text:'hello'});});
  for(const [i,value] of [[0,'changed'],[1,45],[2,'ue'],[3,'big'],[4,'mincho'],[5,'html5']])it('invalidates measurement determinant '+i,async()=>{const h=await subject(),c={};measure(h,c);const input=args();input[i]=value;h.span.w=181;assert.strictEqual(measure(h,c,input).width,181);assert.strictEqual(h.count.width,2);measure(h,c);assert.strictEqual(h.count.width,3,'one last condition per owner');});
  it('does not retain a mutable metrics object supplied to a caller',async()=>{const h=await subject(),c={};const first=measure(h,c);try{first.width=0;}catch{}assert.strictEqual(measure(h,c).width,180);});
  it('does not share objects just because their strings are equal',async()=>{const h=await subject();measure(h,{});measure(h,{});assert.strictEqual(h.count.width,2);});
  it('keeps distinct measuring frames independent',async()=>{const a=await subject(),b=await subject(),c={};measure(a,c);b.span.w=185;assert.strictEqual(measure(b,c).width,185);assert.strictEqual(b.count.width,1);});
  it('invalidates after option-font family and bold updates',async()=>{const h=await subject(),c={};measure(h,c);h.config.set('baseFontFamily','serif');h.span.w=181;assert.strictEqual(measure(h,c).width,181);h.config.set('baseFontBolder',false);h.span.w=182;assert.strictEqual(measure(h,c).width,182);assert.strictEqual(h.count.width,3);});
  it('does not discard raw dimensions for a scale-only change',async()=>{const h=await subject(),c={};measure(h,c);h.config.set('baseChatScale',2);assert.strictEqual(measure(h,c).width,180);assert.strictEqual(h.count.width,1);});
  for(const event of ['loading','loadingdone','loadingerror'])it('invalidates on font event '+event,async()=>{const h=await subject(),c={};measure(h,c);h.fontSet.fire(event);h.span.w=190;assert.strictEqual(measure(h,c).width,190);assert.strictEqual(h.count.width,2);});
  it('does not cache while fonts are loading',async()=>{const h=await subject(),c={};h.fontSet.status='loading';measure(h,c);measure(h,c);assert.strictEqual(h.count.width,2);h.fontSet.status='loaded';measure(h,c);measure(h,c);assert.strictEqual(h.count.width,3);});
  it('uses the legacy measurement path when font-state support is missing',async()=>{const h=await subject({fontSupport:false}),c={};measure(h,c);measure(h,c);assert.strictEqual(h.count.width,2);});
  it('conservatively bypasses registered font faces, including already-loaded dynamic faces',async()=>{const h=await subject(),c={};measure(h,c);h.fontSet.size=1;h.span.w=195;assert.strictEqual(measure(h,c).width,195);measure(h,c);assert.strictEqual(h.count.width,3);});
  it('invalidates on a frame resize',async()=>{const h=await subject(),c={};measure(h,c);h.innerWindow.fire('resize');h.span.w=191;assert.strictEqual(measure(h,c).width,191);assert.strictEqual(h.count.width,2);});
  it('does not reuse measurements across device pixel ratio changes',async()=>{const h=await subject(),c={};measure(h,c);h.innerWindow.devicePixelRatio=1.5;h.span.w=183;assert.strictEqual(measure(h,c).width,183);assert.strictEqual(h.count.width,2);});
  it('does not cache measurements for a disconnected span',async()=>{const h=await subject(),c={};h.span.isConnected=false;measure(h,c);measure(h,c);assert.strictEqual(h.count.width,2);});
  for(const dimension of ['w','h'])it('does not cache nonfinite '+dimension,async()=>{const h=await subject(),c={};h.span[dimension]=NaN;measure(h,c);h.span[dimension]=50;measure(h,c);assert.strictEqual(h.count.width,2);});
  it('does not retain zero-height measurements from hidden layout',async()=>{const h=await subject(),c={};h.span.h=0;measure(h,c);h.span.h=29;assert.strictEqual(measure(h,c).height,29);assert.strictEqual(h.count.width,2);});
  it('zero width with a valid height is reusable',async()=>{const h=await subject(),c={};h.span.w=0;measure(h,c);measure(h,c);assert.strictEqual(h.count.width,1);});
  it('measurement failures do not poison a later success',async()=>{const h=await subject(),c={},get=h.field.getOriginalWidth;h.field.getOriginalWidth=()=>{throw Error('synthetic failure');};assert.throws(()=>measure(h,c),/synthetic failure/);h.field.getOriginalWidth=get;assert.strictEqual(measure(h,c).width,180);});
  it('unknown owner keys fall back rather than becoming a strong text cache',async()=>{const h=await subject();for(const c of [null,undefined,'id',1]){measure(h,c);measure(h,c);}assert.strictEqual(h.count.width,8);});
});

const assert=require('assert');
const {subject}=require('../helpers/commentMetricSubject');
const {beginSection,run}=require('../helpers/extractSource');
async function actual() {
  const h=await subject();h.ctx.Config=h.config;h.ctx.ZenzaWatch={};
  h.ctx.util={escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')};
  for(const name of ['NicoChat','NicoTextParser','CommentLayer','NicoChatViewModel'])run(beginSection('packages/zenza/src/commentLayer/'+name+'.js'),h.ctx);
  run('globalThis.Chat=NicoChat;globalThis.VM=NicoChatViewModel;',h.ctx);
  h.make=c=>h.ctx.VM.create(c,h.off);
  h.chat=(text='hello',cmd='')=>h.ctx.Chat.create({text,cmd,date:1700000000,no:1,thread:10,user_id:'synthetic',vpos:100},{videoDuration:1000});
  return h;
}
function geometry(v){return [v.htmlText,v.width,v.height,v._cssLineHeight,v._cssScaleY,v._scale,v.beginLeftTiming,v.beginRightTiming,v.endLeftTiming,v.endRightTiming,v.fontSizePixel];}
describe('Task218 ViewModel uses guarded raw metrics, not cached final geometry',()=>{
  it('shares original-size measurements across repeated ViewModels',async()=>{const h=await actual(),c=h.chat();const before=JSON.stringify(c.props);const a=h.make(c),b=h.make(c);assert.deepStrictEqual(geometry(a),geometry(b));assert.strictEqual(h.count.width,1);assert.strictEqual(h.count.height,1);assert.strictEqual(JSON.stringify(c.props),before);});
  it('keeps legacy field implementations working without the optional measure API',async()=>{const h=await actual(),c=h.chat();delete h.field.measureChat;h.make(c);h.make(c);assert.strictEqual(h.count.width,2);});
  it('recalculates scale and timing while keeping the same raw metric',async()=>{const h=await actual(),c=h.chat();h.make(c);h.ctx.VM.BASE_SCALE=1.5;h.ctx.VM.SPEED_RATE=2;const cached=h.make(c);assert.strictEqual(h.count.width,1);delete h.field.measureChat;assert.deepStrictEqual(geometry(cached),geometry(h.make(c)));});
  for(const cmd of ['','defont','ue full ender big mincho','shita small gothic'])it('matches the legacy CA-related geometry for '+(cmd||'flash'),async()=>{const h=await actual(),c=h.chat('■■■\n　■\n■■■',cmd);h.make(c);const warm=h.make(c);assert.strictEqual(h.count.width,1);delete h.field.measureChat;assert.deepStrictEqual(geometry(warm),geometry(h.make(c)));});
  it('remeasures after a font-setting change and leaves original data intact',async()=>{const h=await actual(),c=h.chat();h.make(c);h.config.set('baseFontFamily','serif');h.span.w=210;const cached=h.make(c);assert.strictEqual(h.count.width,2);delete h.field.measureChat;assert.deepStrictEqual(geometry(cached),geometry(h.make(c)));});
  it('keeps the parsed HTML cache independent of measurement invalidation',async()=>{const h=await actual(),c=h.chat();h.make(c);h.fontSet.fire('loadingdone');h.span.w=211;const a=h.make(c);assert.strictEqual(h.count.width,2);assert.strictEqual(a._originalWidth,211);});
});

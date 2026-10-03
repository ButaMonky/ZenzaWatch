const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function subject() {
  const ctx = createContext({Config: {props: {baseChatScale: 1}, onkey() {}}, ZenzaWatch: {},
    util: {escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}});
  for (const file of ['packages/lib/src/Emitter.js', 'packages/zenza/src/commentLayer/NicoChat.js',
    'packages/zenza/src/commentLayer/NicoTextParser.js', 'packages/zenza/src/commentLayer/CommentLayer.js',
    'packages/zenza/src/commentLayer/NicoChatViewModel.js']) run(beginSection(file), ctx);
  run('globalThis.Chat=NicoChat;globalThis.VM=NicoChatViewModel;globalThis.Parser=NicoTextParser;',ctx);
  const calls = {html5: 0, flash: 0, measures: 0};
  const parsers = {html5: ctx.Parser.likeHTML5, flash: ctx.Parser.likeXP};
  ctx.Parser.likeHTML5 = s => { calls.html5++; return parsers.html5(s); };
  ctx.Parser.likeXP = s => { calls.flash++; return parsers.flash(s); };
  let html = '';
  const field = {setText: s => { html=s; }, setFontSizePixel() {}, setType() {},
    getOriginalWidth: () => { calls.measures++; return html.length; }, getOriginalHeight: () => 29};
  const offscreen = {getTextField: () => field};
  return {ctx, calls, parsers, make: (chat) => ctx.VM.create(chat, offscreen),
    chat: (text='hello', cmd='') => ctx.Chat.create({text, cmd, date:1700000000, no:1, thread:10, user_id:'synthetic', vpos:100})};
}
describe('Task217 parsed HTML reuse without source-comment mutation', () => {
  for (const [mode,cmd] of [['flash',''],['html5','defont']]) {
    it('parses the same retained '+mode+' object once across new ViewModels', () => {
      const h=subject(), c=h.chat('full width 全角 ■\nline',cmd);
      const original=JSON.stringify(c.props), a=h.make(c), b=h.make(c);
      assert.strictEqual(h.calls[mode],1); assert.strictEqual(a.htmlText,b.htmlText);
      assert.strictEqual(JSON.stringify(c.props),original,'cache must not enter source/serialization');
      assert.strictEqual(h.calls.measures,2,'geometry is still measured for each view');
    });
    for (const text of ['', '普通のコメント', 'x <script> & " quote', 'A　B  C\tD', '■■■\n　■\n■■■', '\u0655\u2003\u2588']) {
      it('retains byte-identical '+mode+' parsing for '+JSON.stringify(text), () => {
        const h=subject(), c=h.chat(text,cmd), expected=h.parsers[mode](text);
        assert.strictEqual(h.make(c).htmlText,expected); assert.strictEqual(h.make(c).htmlText,expected);
        assert.strictEqual(h.calls[mode],1);
      });
    }
  }
  it('invalidates on the ordinary text setter and direct props changes', () => {
    const h=subject(), c=h.chat('before'); h.make(c); c.text='after';
    assert.strictEqual(h.make(c).htmlText,h.parsers.flash('after'));
    c.props.text='direct'; assert.strictEqual(h.make(c).htmlText,h.parsers.flash('direct'));
    assert.strictEqual(h.calls.flash,3);
  });
  it('invalidates when the same text switches Flash/HTML5 parsing mode', () => {
    const h=subject(), c=h.chat('A　B'); h.make(c); c.props.commentVer='html5';
    assert.strictEqual(h.make(c).htmlText,h.parsers.html5(c.text));
    assert.strictEqual(h.calls.html5,1); c.props.commentVer='flash'; h.make(c);
    assert.strictEqual(h.calls.flash,2,'only the latest version is retained per object');
  });
  it('keeps an explicitly supplied htmlText override authoritative', () => {
    const h=subject(), c=h.chat('same'); h.make(c); c.htmlText='<span>override</span>';
    assert.strictEqual(h.make(c).htmlText,'<span>override</span>');
    c.text='changed'; assert.strictEqual(h.make(c).htmlText,h.parsers.flash('changed'));
  });
  it('does not share a global string cache across different comment identities', () => {
    const h=subject(), a=h.chat('same'), b=h.chat('same'); h.make(a); h.make(b);
    assert.strictEqual(h.calls.flash,2);
  });
  it('uses non-owning keys rather than retaining comments globally', () => {
    const h=subject(); assert.strictEqual(Object.prototype.toString.call(h.ctx.VM._parsedTextCache),'[object WeakMap]');
  });
  it('does not reuse a failed parser result', () => {
    const h=subject(), c=h.chat('safe'); h.ctx.Parser.likeXP=()=>{throw Error('synthetic failure');};
    assert.throws(()=>h.make(c),/synthetic failure/); h.ctx.Parser.likeXP=h.parsers.flash;
    assert.strictEqual(h.make(c).htmlText,h.parsers.flash('safe'));
  });
  it('reset cannot carry a different old body into a new view', () => {
    const h=subject(), c=h.chat('stale'); h.make(c); c.reset();
    assert.strictEqual(h.make(c).htmlText,'');
  });
});

describe('Task217 parser method compatibility', () => {
  it('preserves the parser receiver for an overridden parser method', () => {
    const h=subject(), c=h.chat('hello');
    h.ctx.Parser.likeXP=function(text) { assert.strictEqual(this,h.ctx.Parser); return '<b>'+text+'</b>'; };
    assert.strictEqual(h.make(c).htmlText,'<b>hello</b>');
  });
  it('invalidates the cached value if the parser method is replaced', () => {
    const h=subject(), c=h.chat('same');h.make(c);
    h.ctx.Parser.likeXP=text=>'<b>'+text+'</b>';
    assert.strictEqual(h.make(c).htmlText,'<b>same</b>');
  });
});

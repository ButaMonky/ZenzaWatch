'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {extract,createContext,run}=require('../helpers/extractSource');
const SOURCE='packages/zenza/src/pocket/PocketDescriptionCard.js';
function fixture(){
 const dom=new JSDOM('<div id="mylistPocket-popup"></div>',{url:'https://www.nicovideo.jp/my'});
 const ctx=createContext({window:dom.window,document:dom.window.document});
 run('const PocketDescriptionCard='+extract(SOURCE,'PocketDescriptionCard','var')+
  ';this.Card=PocketDescriptionCard;',ctx);
 const Card=ctx.Card;
 const card=Card.make(dom.window.document,'sm46778748',
   'https://www.nicovideo.jp/watch/sm46778748','sm46778748',false);
 dom.window.document.querySelector('#mylistPocket-popup').append(card.root);
 return {dom,Card,card,close:()=>dom.window.close()};
}
describe('Task968 user-id-derived icon fallback from recorded research',()=>{
 let h;
 afterEach(()=>{h?.close();h=null;});
 it('generates only a validated known-user bucket path, not a channel or unknown',()=>{
  h=fixture();
  const f=h.Card.userCdnIcon;
  assert.strictEqual(f({type:'user',id:'8174142'}),
   'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/817/8174142.jpg');
  assert.strictEqual(f({type:'user',id:'145346240'}),
   'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/14534/145346240.jpg');
  assert.strictEqual(f({type:'user',id:'9999'}),
   'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/0/9999.jpg');
  assert.strictEqual(f({type:'user',id:'10000'}),
   'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/s/1/10000.jpg');
  for(const id of ['', '0','0001','-1','1.5','NaN','1e6','4/../x',
    '1111111111111111111']){
    assert.strictEqual(f({type:'user',id}),null,id);
  }
  assert.strictEqual(f({type:'channel',id:'8174142'}),null);
  assert.strictEqual(f({type:'user',id:null}),null);
 });
 it('uses a real profile icon first; after error tries CDN once, then blank',()=>{
  h=fixture();
  const owner={type:'user',id:'8174142',name:'公開投稿者',
   icon:'https://img.nicoprofile.nimg.jp/usericon/817/8174142.jpg?key=preserve'};
  h.Card.showOwner(h.card,owner);
  const img=h.card.ownerIcon;
  assert.strictEqual(img.src,owner.icon);
  assert.strictEqual(h.card.ownerName.textContent,owner.name);
  assert.strictEqual(h.card.ownerLink.href,'https://www.nicovideo.jp/user/8174142');
  img.dispatchEvent(new h.dom.window.Event('error'));
  assert.strictEqual(img.src,h.Card.userCdnIcon(owner));
  img.dispatchEvent(new h.dom.window.Event('error'));
  assert(img.src.endsWith('/defaults/blank.jpg'));
  img.dispatchEvent(new h.dom.window.Event('error'));
  assert.strictEqual(img.hasAttribute('src'),false,'no infinite error retry');
  assert.strictEqual(img.onerror,null);
 });
 it('first tries a compact CDN icon when fallback metadata only gives blank',()=>{
  h=fixture();
  const owner={type:'user',id:'145346240',name:'補完済み',
    icon:'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg'};
  h.Card.showOwner(h.card,owner);
  assert.strictEqual(h.card.ownerIcon.src,h.Card.userCdnIcon(owner));
  h.card.ownerIcon.dispatchEvent(new h.dom.window.Event('error'));
  assert.strictEqual(h.card.ownerIcon.src,owner.icon,'404 must preserve blank icon');
  assert.strictEqual(h.card.ownerName.textContent,'補完済み','404 is not an owner failure');
 });
 it('does not synthesize a CDN URL for channel owner or missing user ID',()=>{
  h=fixture();
  for(const owner of [
    {type:'channel',id:'ch765',name:'公式'},
    {type:'user',id:'',name:'(投稿者情報なし)'}
  ]){
    h.Card.showOwner(h.card,owner);
    assert.strictEqual(h.card.ownerIcon.src,
      'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg');
  }
 });
 it('keeps source-provided primary icon URL exactly, including its query',()=>{
  h=fixture();
  const icon='https://img.nicoprofile.nimg.jp/usericon/18/188548.jpg?1495543240';
  const owner={type:'user',id:'188548',name:'say2',icon};
  assert.deepStrictEqual(Array.from(h.Card.selectIconSources(owner)),[
    icon,h.Card.userCdnIcon(owner),
    'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg'
  ]);
 });
});

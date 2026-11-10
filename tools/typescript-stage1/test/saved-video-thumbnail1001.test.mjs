import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSource,flush} from './nonvisual-audit-source-harness.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function fixture(t,options={}){
 const dom=new JSDOM('<div class="zenzaManualBookmarkDock"></div>');t.after(()=>dom.window.close());
 const observers=[],calls=[];dom.window.IntersectionObserver=class{
  constructor(callback){this.callback=callback;observers.push(this);}observe(){}unobserve(){}disconnect(){}
 };
 const api=loadSource('nico-src/SavedVideoThumbnail.ts','SavedVideoThumbnail');
 const service=api.create({load:id=>new Promise((resolve,reject)=>calls.push({id,resolve,reject})),...options});t.after(()=>service.dispose());
 const attach=(id,initial)=>{const host=dom.window.document.createElement('div');dom.window.document.querySelector('div').append(host);return {host,release:service.attach(host,id,initial)};};
 const visible=(item,value=true)=>observers[0].callback([{target:item.host,isIntersecting:value}]);
 return {service,attach,visible,calls,dom};
}
test('missing metadata is fetched only on intersection and remains busy until image load',async t=>{
 const h=fixture(t),a=h.attach('sm1');assert.equal(h.calls.length,0);h.visible(a);await flush();assert.equal(h.calls.length,1);
 h.calls[0].resolve('https://example.com/1.jpg');await flush();assert.equal(a.host.getAttribute('aria-busy'),'true');
 a.host.querySelector('img').onload();assert.equal(a.host.getAttribute('aria-busy'),'false');
});
test('existing URL uses no metadata fetch, failed image gets one fallback',async t=>{
 const h=fixture(t),a=h.attach('sm1','https://example.com/old.jpg');h.visible(a);assert.equal(h.calls.length,0);
 a.host.querySelector('img').onerror();await flush();assert.equal(h.calls.length,1);
 h.calls[0].resolve('https://example.com/new.jpg');await flush();a.host.querySelector('img').onerror();await flush();
 assert.equal(h.calls.length,1);assert.equal(a.host.textContent,'画像なし');
});
test('same video shares one flight and queued offscreen work is cancelled',async t=>{
 const h=fixture(t),a=h.attach('sm1'),b=h.attach('sm1'),c=h.attach('sm2'),d=h.attach('sm3');
 for(const item of [a,b,c,d])h.visible(item);await flush();assert.deepEqual(h.calls.map(c=>c.id),['sm1','sm2']);
 h.visible(d,false);h.calls[0].resolve('https://example.com/a.jpg');await flush();assert.equal(h.calls.length,2);
 assert(a.host.querySelector('img'));assert(b.host.querySelector('img'));
});
test('release ignores late metadata and image callbacks without reviving DOM',async t=>{
 const h=fixture(t),a=h.attach('sm1');h.visible(a);await flush();a.release();h.calls[0].resolve('https://example.com/a.jpg');await flush();assert.equal(a.host.childNodes.length,0);
 const b=h.attach('sm2','https://example.com/b.jpg');h.visible(b);const image=b.host.querySelector('img');b.release();image.onload();image.onerror();await flush();assert.equal(b.host.childNodes.length,0);
});
test('negative results are cached briefly and invalid IDs never trigger retrieval',async t=>{
 const h=fixture(t),a=h.attach('sm1');h.visible(a);await flush();h.calls[0].reject(Error('not found'));await flush();assert.equal(a.host.textContent,'画像なし');a.release();
 const b=h.attach('sm1');h.visible(b);await flush();assert.equal(h.calls.length,1);
 const bad=h.attach('../private');h.visible(bad);await flush();assert.equal(h.calls.length,1);
});
test('URL cache has a bounded LRU capacity',async t=>{
 const h=fixture(t,{maxEntries:2});
 for(const id of ['sm1','sm2','sm3']){const a=h.attach(id);h.visible(a);await flush();h.calls.at(-1).resolve('https://example.com/'+id+'.jpg');await flush();a.release();}
 const a=h.attach('sm1');h.visible(a);await flush();assert.equal(h.calls.length,4);
});
test('unchanged failed URL is negative cached and stale image completion cannot settle refresh',async t=>{
 const h=fixture(t),a=h.attach('sm1','https://example.com/broken.jpg');h.visible(a);
 const stale=a.host.querySelector('img');stale.onerror();stale.onload();
 assert.equal(a.host.getAttribute('aria-busy'),'true');await flush();
 h.calls[0].resolve('https://example.com/broken.jpg');await flush();
 assert.equal(a.host.textContent,'画像なし');assert.equal(a.host.querySelector('img'),null);a.release();
 const b=h.attach('sm1','https://example.com/broken.jpg');h.visible(b);await flush();
 assert.equal(h.calls.length,1);assert.equal(b.host.textContent,'画像なし');
});
test('without IntersectionObserver attachment before mount acquires only visible entries and detaches on dispose',async t=>{
 const h=fixture(t);delete h.dom.window.IntersectionObserver;
 const document=h.dom.window.document,dock=document.querySelector('div');
 dock.getBoundingClientRect=()=>({top:0,left:0,bottom:500,right:500,width:500,height:500});
 const host=document.createElement('div');let top=20;
 host.getBoundingClientRect=()=>({top,left:20,bottom:top+40,right:100,width:80,height:40});
 h.service.attach(host,'sm1');dock.append(host);await flush();assert.equal(h.calls.length,1);
 const off=document.createElement('div');let offTop=700;
 off.getBoundingClientRect=()=>({top:offTop,left:20,bottom:offTop+40,right:100,width:80,height:40});
 h.service.attach(off,'sm2');dock.append(off);await flush();assert.equal(h.calls.length,1);
 offTop=100;document.dispatchEvent(new h.dom.window.Event('scroll'));await flush();assert.equal(h.calls.length,2);
 h.service.dispose();h.calls[0].resolve('https://example.com/late.jpg');await flush();assert.equal(host.childNodes.length,0);
 document.dispatchEvent(new h.dom.window.Event('scroll'));await flush();assert.equal(h.calls.length,2);
});

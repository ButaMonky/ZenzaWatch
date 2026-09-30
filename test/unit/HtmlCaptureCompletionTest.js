const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');
function setup(){
 const events=[],canvases=[];let resolveDecode,rejectDecode,drawError;
 const decoded=new Promise((resolve,reject)=>{resolveDecode=resolve;rejectDecode=reject;});
 class Image{decode(){events.push('decode');return decoded;}}
 const c=createContext({Blob,Image,URL:{createObjectURL(){events.push('url');return 'blob:html';},revokeObjectURL(url){events.push('revoke:'+url);}},
 document:{createElement(tag){if(tag==='a')return {};assert.strictEqual(tag,'canvas');const canvas={id:canvases.length};canvases.push(canvas);canvas.getContext=()=>({fillRect(){},drawImage(image){if(image instanceof Image){if(drawError)throw drawError;events.push('html-painted');}else if(canvases.includes(image)){events.push('composite:'+image.id);assert(events.includes('html-painted')||image.id!==2,'html composite before painting');}}});return canvas;}}});
 const util=run(beginSection('packages/lib/src/dom/VideoCaptureUtil.js').split('VideoCaptureUtil.capture =')[0]+';VideoCaptureUtil;',c);
 return {util,events,canvases,resolveDecode,rejectDecode,failDraw:error=>drawError=error};
}
describe('HTML capture completion',()=>{
 it('resolves only after decoding and drawing, then releases the URL',async()=>{
  const h=setup();let settled=false;const result=Promise.resolve(h.util.htmlToCanvas('<div/>',640,360)).then(r=>{settled=true;return r;});
  await Promise.resolve();assert.strictEqual(settled,false);assert(!h.events.includes('html-painted'));
  h.resolveDecode();const {canvas,img}=await result;assert.strictEqual(canvas,h.canvases[0]);assert(img);
  assert.deepStrictEqual(h.events,['url','decode','html-painted','revoke:blob:html']);
 });
 it('propagates decode rejection and releases the URL',async()=>{
  const h=setup();const error=new Error('decode failed');const result=h.util.htmlToCanvas('<div/>');
  assert(result && typeof result.then==='function','HTML capture must return its completion promise');
  // Attach before rejecting so neither path relies on unhandled-rejection timing.
  const rejection=assert.rejects(Promise.resolve(result),e=>e===error);
  h.rejectDecode(error);await rejection;assert(h.events.includes('revoke:blob:html'));assert(!h.events.includes('html-painted'));
 });
 it('propagates drawing failure and releases the URL',async()=>{
  const h=setup();const error=new Error('draw failed');h.failDraw(error);
  const result=h.util.htmlToCanvas('<div/>');assert(result && typeof result.then==='function','HTML capture must return its completion promise');
  const rejection=assert.rejects(Promise.resolve(result),e=>e===error);
  h.resolveDecode();await rejection;assert(h.events.includes('revoke:blob:html'));
 });
 it('video composition awaits the actual HTML canvas painting',async()=>{
  const h=setup();const result=h.util.nicoVideoToCanvas({video:{src:'https://delivery.domand.nicovideo.jp/test',videoWidth:640,videoHeight:360},html:'<div/>',minHeight:360});
  result.catch(()=>{});
  await Promise.resolve();await Promise.resolve();assert(!h.events.includes('html-painted'));h.resolveDecode();
  await result;assert(h.events.indexOf('composite:2')>h.events.indexOf('html-painted'));
 });
});

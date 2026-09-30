const assert=require('assert');
const {read,createContext,run}=require('../helpers/extractSource');
function setup(failure){
 const events=[],timers=[],blobs=[];const error=new Error('download failed');
 const c=createContext({Blob,Config:{exportJson:()=>'{"volume":0.5}'},
 URL:{createObjectURL(blob){blobs.push(blob);events.push('created');return 'blob:config';},revokeObjectURL(url){events.push('revoke:'+url);}},
 setTimeout(fn){timers.push(fn);},document:{createElement(){if(failure==='create')throw error;return {click(){events.push('click');if(failure==='click')throw error;events.push(this.download);events.push(this.href);}};}}});
 const source=read('src/Config.js');run(source.slice(source.indexOf('Config.exportToFile ='),source.indexOf('const NaviConfig')),c);
 return {export:()=>c.Config.exportToFile(),events,timers,blobs,error};
}
describe('Config JSON export lifetime',()=>{
 it('downloads the unchanged JSON with a JSON MIME type and filename',async()=>{
  const h=setup();h.export();assert.strictEqual(h.blobs[0].type,'application/json');
  assert.strictEqual(await h.blobs[0].text(),'{"volume":0.5}');
  assert(h.events.some(x=>x.endsWith('_ZenzaWatch.config.json')));assert(h.events.includes('blob:config'));
 });
 it('revokes the created URL after the click task has returned',()=>{
  const h=setup();h.export();assert(!h.events.some(x=>x.startsWith('revoke:')));
  assert.strictEqual(h.timers.length,1);h.timers[0]();assert.strictEqual(h.events.filter(x=>x==='revoke:blob:config').length,1);
 });
 for(const failure of ['create','click'])it(`releases the URL even when ${failure} throws`,()=>{
  const h=setup(failure);assert.throws(()=>h.export(),e=>e===h.error);
  assert.strictEqual(h.timers.length,1);h.timers[0]();assert(h.events.includes('revoke:blob:config'));
 });
});

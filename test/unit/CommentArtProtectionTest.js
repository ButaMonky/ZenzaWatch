const assert=require('assert'),fs=require('fs'),path=require('path');
const {beginSection,createContext,run}=require('../helpers/extractSource');
const {REPO_ROOT}=require('../helpers/buildSandbox');
function api(){const file='packages/zenza/src/commentLayer/CommentArtProtection.js';assert(fs.existsSync(path.join(REPO_ROOT,file)),'shared CA classifier exists');const c=createContext();run(beginSection(file)+';globalThis.Art=CommentArtProtection;',c);return c.Art;}
const part=(no,extra={})=>({id:no,no,threadId:'10',fork:0,layerId:0,userId:'synthetic-a',date:1700000000+no,text:'\u25a0\u25a0\u25a0',cmd:'ue full ender',type:'ue',vpos:100,...extra});
const analyze=(data,on=true)=>api().analyze(data,{enabled:on});
describe('Task211 display-only CA classification',()=>{
 it('separates probable parts from unrelated text while preserving their shared layer',()=>{const a=part(1),b=part(2),ordinary=part(3,{userId:'b',text:'hello',cmd:''});const m=analyze([a,ordinary,b]);assert(m.has(a)&&m.has(b));assert.strictEqual(m.get(a).layerId,m.get(b).layerId);assert(!m.has(ordinary));assert.strictEqual(m.get(a).group,m.get(b).group);});
 it('never edits or deletes original comments, text or command metadata',()=>{const a=Object.freeze(part(1)),b=Object.freeze(part(2));const input=Object.freeze([a,b]);const before=JSON.stringify(input);const m=analyze(input);assert.strictEqual(m.size,2);assert.strictEqual(JSON.stringify(input),before);assert.strictEqual(input[0],a);});
 it('OFF produces no protective metadata and retains all input',()=>{const a=[part(1),part(2)];assert.strictEqual(analyze(a,false).size,0);assert.strictEqual(a.length,2);});
 it('does not classify ordinary one-line messages from a prolific author',()=>{assert.strictEqual(analyze(Array.from({length:30},(_,i)=>part(i,{cmd:'',text:'hello'}))).size,0);});
 it('supports multiline evidence without special commands',()=>{const a=part(1,{cmd:'',text:'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk'}),b=part(2,{cmd:'',text:'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk'});assert.strictEqual(analyze([a,b]).size,2);});
 for(const userId of [undefined,null,'','0','-1',-1])it('does not combine unknown author '+String(userId),()=>assert.strictEqual(analyze([part(1,{userId}),part(2,{userId})]).size,0));
 it('does not infer around invalid dates or original layers',()=>{for(const extra of [{date:NaN},{date:0},{layerId:'untrusted'},{date:Infinity}])assert.strictEqual(analyze([part(1,extra),part(2,extra)]).size,0);});
 it('keeps thread, fork, author and original layer groups separate',()=>{const data=[];for(let i=0;i<4;i++){const extra=[{threadId:'11'},{fork:2},{userId:'other'},{layerId:3}][i];data.push(part(i*2+1,extra),part(i*2+2,extra));}const m=analyze(data);assert.strictEqual(new Set(data.map(c=>m.get(c).layerId)).size,4);});
 it('splits posting sessions farther than five minutes apart, not infinite chained groups',()=>{const a=part(1,{date:1700000000}),b=part(2,{date:1700000010}),c=part(3,{date:1700000610}),d=part(4,{date:1700000620});const m=analyze([d,b,c,a]);assert.strictEqual(m.get(a).layerId,m.get(b).layerId);assert.notStrictEqual(m.get(a).layerId,m.get(c).layerId);});
 it('owner is not re-layered',()=>assert.strictEqual(analyze([part(1,{fork:1}),part(2,{fork:1})]).size,0));
 it('does not drop repeated text from the same or different authors',()=>{const data=[part(1),part(2),part(3,{userId:'b'}),part(4,{userId:'b'})];assert.strictEqual(analyze(data).size,4);});
 it('creates atomic groups only for identical start/type within an art layer',()=>{const a=part(1),b=part(2),c=part(3,{vpos:200}),d=part(4,{type:'naka'});const m=analyze([a,b,c,d]);assert.strictEqual(m.get(a).group,m.get(b).group);assert.notStrictEqual(m.get(a).group,m.get(c).group);assert.notStrictEqual(m.get(a).group,m.get(d).group);});
 it('is deterministic for a reordered input set',()=>{const data=[part(1),part(2),part(3,{userId:'b'}),part(4,{userId:'b'})];const a=analyze(data),b=analyze(data.slice().reverse());for(const c of data)assert.strictEqual(a.get(c).layerId,b.get(c).layerId);});
});

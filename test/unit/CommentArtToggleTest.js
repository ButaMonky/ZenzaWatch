const assert=require('assert');
const {loadClass,createContext,beginSection,run,read}=require('../helpers/extractSource');
function group(){
 const ctx=createContext({Config:{props:{'commentLayer.protectCA':true}},CommentLayer:{SCREEN:{HEIGHT:384}},NicoChat:{SORT_FUNCTION:(a,b)=>a.id-b.id,TYPE:{BOTTOM:'shita'}},console:{log(){},warn(){}}});
 run(beginSection('packages/zenza/src/commentLayer/CommentArtProtection.js'),ctx);
 const VM=loadClass('packages/zenza/src/commentLayer/NicoChatViewModel.js','NicoChatViewModel',ctx);
 const G=loadClass('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js','NicoChatGroupViewModel',ctx),g=Object.create(G.prototype);
 g._members=[1,2].map(id=>{const v=Object.create(VM.prototype);v._nicoChat=Object.freeze({id,no:id,userId:'synthetic',threadId:'10',date:1700000000+id,layerId:0,fork:0,type:'ue',vpos:100,cmd:'full ender',text:'part'});Object.assign(v,{_y:id*20,_height:30,_fontSizePixel:20,_type:'ue',_isFixed:true,_isLayouted:true,_beginLeftTiming:1,_endRightTiming:4});return v;});
 g._lastUpdate=0;g._layoutWorker={post:async({params})=>({...params,members:params.members.map(m=>({...m,ypos:0,isOverflow:false}))})};return {g,VM};
}
describe('Task211 reversible CA relayout lifecycle',()=>{
 it('returns a verified success for a completed new layout',async()=>{const h=group();assert.strictEqual(await h.g._execCommentLayoutWorker(),true);assert.strictEqual(h.g._members[0].layerId,h.g._members[1].layerId);});
 it('restores the last layout and metadata if protection preparation fails',async()=>{const h=group();h.g._layoutWorker.post=async()=>{throw Error('synthetic worker failure');};const before=h.g._members.map(m=>({y:m.ypos,layer:m.layerId,ready:m._isLayouted}));assert.strictEqual(await h.g._execCommentLayoutWorker(),false);assert.deepStrictEqual(h.g._members.map(m=>({y:m.ypos,layer:m.layerId,ready:m._isLayouted})),before);});
 it('does not revert a newer generation after a late failed reply',async()=>{const h=group();let reject;h.g._layoutWorker.post=()=>new Promise((r,j)=>reject=j);const p=h.g._execCommentLayoutWorker();h.g._lastUpdate++;h.g._members[0]._y=123;reject(Error('late'));await p;assert.strictEqual(h.g._members[0].ypos,123);});
 it('refreshes only after all three display groups finish',async()=>{const C=loadClass('packages/zenza/src/commentLayer/NicoCommentViewModel.js','NicoCommentViewModel',createContext({Emitter:class{}}));assert.strictEqual(typeof C.prototype._onCommentArtProtectionChange,'function');const m=Object.create(C.prototype),events=[];let finish;const groups=[0,1,2].map((_,i)=>({_members:[],_execCommentLayoutWorker:()=>i===1?new Promise(r=>finish=r):Promise.resolve(true)}));[m._topGroup,m._nakaGroup,m._bottomGroup]=groups;m.emit=e=>events.push(e);const p=m._onCommentArtProtectionChange();assert.strictEqual(events.length,0);finish(true);await p;assert.deepStrictEqual(events,['setData']);});
 it('a replacement collection makes a pending toggle stale',async()=>{const C=loadClass('packages/zenza/src/commentLayer/NicoCommentViewModel.js','NicoCommentViewModel',createContext({Emitter:class{}}));assert.strictEqual(typeof C.prototype._onCommentArtProtectionChange,'function');const m=Object.create(C.prototype),events=[];let finish;const groups=[0,1,2].map((_,i)=>({_members:[],_execCommentLayoutWorker:()=>i===1?new Promise(r=>finish=r):Promise.resolve(true)}));[m._topGroup,m._nakaGroup,m._bottomGroup]=groups;m.emit=e=>events.push(e);const p=m._onCommentArtProtectionChange();groups[0]._members=[];finish(true);await p;assert.strictEqual(events.length,0);});
 it('wires the existing configuration event rather than refetching comments',()=>{const s=read('packages/zenza/src/commentLayer/NicoCommentViewModel.js');assert(s.includes("config.onkey('protectCA'"));const a=s.indexOf('async _onCommentArtProtectionChange'),b=s.indexOf('_onSetData()',a);assert(a>=0);assert(!s.slice(a,b).includes('fetch('));});
});

describe('Task212 CA toggle is atomic across all three groups',()=>{
 it('rolls successful groups back if any group fails in the same toggle',async()=>{
  const C=loadClass('packages/zenza/src/commentLayer/NicoCommentViewModel.js','NicoCommentViewModel',createContext({Emitter:class{}}));
  const m=Object.create(C.prototype),events=[];
  const make=(ok,id)=>{const member={_commentArtMetadata:{layerId:'old-'+id,group:'old-'+id},_y:id,_isOverflow:false,_isLayouted:true};return {_members:[member],_execCommentLayoutWorker:async()=>{member._commentArtMetadata={layerId:'new-'+id,group:'new-'+id};member._y=100+id;return ok;}};};
  const groups=[make(true,1),make(false,2),make(true,3)];[m._topGroup,m._nakaGroup,m._bottomGroup]=groups;m.emit=e=>events.push(e);
  await m._onCommentArtProtectionChange();
  assert.deepStrictEqual(groups.map(g=>[g._members[0]._commentArtMetadata.layerId,g._members[0]._y]),[['old-1',1],['old-2',2],['old-3',3]]);
  assert.deepStrictEqual(events,[]);
 });
});

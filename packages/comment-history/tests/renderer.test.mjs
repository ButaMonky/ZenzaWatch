import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=new URL('../src/renderer.mjs',import.meta.url);
const api=fs.existsSync(url)?await import(url):{};
class Chat {static TYPE={TOP:'ue',NAKA:'naka',BOTTOM:'shita'};static SIZE={SMALL:'small'};static create(o){return {...o,threadId:o.thread,type:o.cmd==='ue'?'ue':'naka',get uniqNo(){return `${this.thread}:${this.fork}:${this.no}`;}};}static SORT_FUNCTION(a,b){return a.vpos-b.vpos||a.id-b.id;}}
let seq=0;
class VM {static create(chat){return new VM(chat);} constructor(chat){this.chat=chat;this.id=++seq;this.type=chat.type;this.vpos=chat.vpos;this.beginLeftTiming=chat.vpos/100;this.endRightTiming=this.beginLeftTiming+4;}get bulkLayoutData(){return {id:this.id,ypos:0,isOverflow:false};}set bulkLayoutData(v){this.layout=v;}reset(){this.wasReset=true;}}
function setup(){
 const normal=Chat.create({thread:'1',fork:0,no:1,text:'normal',cmd:'',vpos:1000,date:1});
 const groups=['ue','naka','shita'].map(type=>({_type:type,_members:type==='naka'?[normal]:[],_filteredMembersValid:false,onChange(){this.changes=(this.changes||0)+1;}}));
 const listeners=new Map(),emitted=[];
 const model={_options:{duration:100,mainThreadId:1},topGroup:groups[0],nakaGroup:groups[1],bottomGroup:groups[2],_nicoChatFilter:{applyFilter:a=>a.filter(x=>!x.blocked)},nicoScripter:{isEmpty:false,apply(a){for(const c of a)c.text+='!';}},promise:()=>Promise.resolve(),on:(e,fn)=>listeners.set(e,fn),off:()=>{},emit:(...a)=>emitted.push(a)};
 const vms=groups.map(g=>({_nicoChatGroup:g,_offScreen:{},_members:g._members.map(c=>new VM(c)),_vSortedMembers:[],_lastUpdate:1,_layoutWorker:{post:async({params:p})=>({...p,members:p.members.map((x,i)=>({...x,ypos:i,isOverflow:false}))})}}));
 const player={_model:model,_viewModel:{getGroup:type=>vms[['ue','naka','shita'].indexOf(type)]},_view:{refresh(){this.count=(this.count||0)+1;}}};
 assert.equal(typeof api.CommentHistoryRenderer,'function');
 const renderer=new api.CommentHistoryRenderer({player,Chat,ChatViewModel:VM,yieldControl:()=>Promise.resolve()});
 const page=(nos)=>({threads:[{id:'1',fork:'main',info:{fork:0,layer:{index:0},label:'default'},comments:nos.map(no=>({id:'c'+no,no,body:'history'+no,commands:[],postedAt:'2026-09-01T00:00:00Z',userId:'u',vposMs:no*100,isPremium:false,isMyPost:false,nicoruCount:0}))}]});
 return {renderer,normal,groups,vms,model,player,page,emitted,listeners};
}
test('keeps normal object identities, commits history after validated layouts',async()=>{const h=setup();const r=await h.renderer.apply(h.page([1,2,3]));assert.equal(r.additionalCount,2);assert.strictEqual(h.groups[1]._members[0],h.normal);assert.equal(h.groups[1]._members[1].text,'history2!');assert.equal(h.player._view.count,1);assert.equal(h.vms[1]._members.length,3);});
test('OFF removes only historical objects and preserves local posts and normal changes',async()=>{const h=setup();await h.renderer.apply(h.page([2]));h.normal.nicoru=10;const post=Chat.create({thread:'1',fork:0,no:3,text:'mine'});h.groups[1]._members.push(post);h.renderer.clear();assert.deepEqual(h.groups[1]._members,[h.normal,post]);assert.equal(h.normal.nicoru,10);});
test('deleted history is not resurrected by continue/re-application',async()=>{const h=setup();await h.renderer.apply(h.page([2,3]));const removed=h.groups[1]._members[1];h.renderer.removed(removed);h.groups[1]._members=h.groups[1]._members.filter(c=>c!==removed);await h.renderer.apply(h.page([2,3,4]));assert.deepEqual(h.groups[1]._members.map(c=>c.no),[1,3,4]);});
test('worker failure leaves the currently visible and normal sets intact',async()=>{const h=setup();const old=h.groups[1]._members;h.vms[1]._layoutWorker.post=async()=>{throw Error('worker');};await assert.rejects(()=>h.renderer.apply(h.page([2])));assert.strictEqual(h.groups[1]._members,old);assert.equal(h.player._view.count,undefined);});
test('late worker reply cannot restore comments after OFF',async()=>{const h=setup();let release;h.vms[1]._layoutWorker.post=p=>new Promise(r=>release=()=>r({...p.params}));const pending=h.renderer.apply(h.page([2]));for(let i=0;i<20&&!release;i++)await Promise.resolve();h.renderer.clear();release();await assert.rejects(pending);assert.deepEqual(h.groups[1]._members,[h.normal]);});
test('empty fixed groups are cleared and never sent as empty worker requests',async()=>{const h=setup();let calls=0;for(const v of h.vms){const old=v._layoutWorker.post;v._layoutWorker.post=p=>{calls++;return old(p);};}await h.renderer.apply(h.page([2]));assert.equal(calls,1);assert.equal(h.vms[0]._members.length,0);assert.equal(h.vms[2]._members.length,0);});
test('applies 20000 history comments without the legacy 10000 input truncation',async()=>{const h=setup();const x=await h.renderer.apply(h.page(Array.from({length:20000},(_,i)=>i+2)));assert.equal(x.additionalCount,20000);assert.equal(h.groups[1]._members.length,20001);});
test('rejects more than 20000 extras, before changing visible groups',async()=>{const h=setup();await assert.rejects(()=>h.renderer.apply(h.page(Array.from({length:20001},(_,i)=>i+2))));assert.deepEqual(h.groups[1]._members,[h.normal]);});
test('continuation preserves the already displayed history object and its nicoru state',async()=>{const h=setup();await h.renderer.apply(h.page([2]));const old=h.groups[1]._members[1];old.nicoru=8;await h.renderer.apply(h.page([2,3]));assert.strictEqual(h.groups[1]._members[1],old);assert.equal(old.nicoru,8);});
test('invalid layout id/order is rejected atomically',async()=>{const h=setup();h.vms[1]._layoutWorker.post=async({params:p})=>({...p,members:p.members.map(x=>({...x,id:999}))});await assert.rejects(()=>h.renderer.apply(h.page([2])));assert.deepEqual(h.groups[1]._members,[h.normal]);});

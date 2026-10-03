const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const reference = require('../fixtures/commentLayoutBeforeIndex');
function worker(code, seed = 123) {
  let state = seed, randomCalls = 0;
  const math = Object.create(Math);
  math.random = () => {randomCalls++; state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296;};
  const context = createContext({Math:math, Config:{}, workerUtil:{}, console:{time(){},timeEnd(){}}});
  run(code+';globalThis.factory=CommentLayoutWorker._func;',context);
  const self={};context.factory(self);
  return {layout:members=>self.onmessage({command:'layout',params:{type:'naka',members,lastUpdate:73}}),calls:()=>randomCalls};
}
const source = () => beginSection('packages/zenza/src/commentLayer/CommentLayoutWorker.js');
const item = (id, time=0, extra={}) => ({id,type:'naka',fork:0,layerId:0,isFixed:false,isInvisible:false,isOverflow:false,ypos:0,height:25,beginLeft:time,beginRight:time+1,endLeft:time+3,endRight:time+4,...extra});
const clone = list=>list.map(x=>({...x}));
function compare(list,seed=1) {
  const old=worker(reference,seed), current=worker(source(),seed);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(current.layout(clone(list)))),JSON.parse(JSON.stringify(old.layout(clone(list)))));
  assert.strictEqual(current.calls(),old.calls(),'overflow RNG sequence must be identical');
}
describe('Task210 indexed collision search preserves the existing layout',()=>{
  it('bounds prior-member scans for sparse comments',()=>{
    let reads=0;const list=Array.from({length:1000},(_,i)=>{const c=item(i,i*10);Object.defineProperty(c,'endRight',{enumerable:true,get(){reads++;return i*10+4;}});return c;});
    const result=worker(source()).layout(list);
    assert.strictEqual(result.members.length,1000);
    assert(reads<20000,'expiry property reads should be near linear, actual='+reads);
  });
  for(const type of ['naka','ue','shita']) for(const density of [0.03,1,4,10]) {
    it('matches order, layer and overflow for '+type+' spacing '+density,()=>{
      compare(Array.from({length:120},(_,i)=>item(i,i*density,{type,isFixed:type!=='naka',ypos:type==='shita'?354:0,height:15+i%25,layerId:i%3,isInvisible:i%17===0,isOverflow:i%29===0})),7);
    });
  }
  it('preserves exact timestamp inequalities and long-lived comments',()=>{compare([item(1,0,{endRight:1000}),item(2,4),item(3,4),item(4,1000),item(5,1004)]);});
  it('does not require input to be sorted by start time',()=>{compare([item(1,20),item(2,0),item(3,10),item(4,5),item(5,100)]);});
  it('preserves first matching duplicate identity semantics',()=>{compare([item(1,0),item(2,4),item(1,100),item(3,50)]);});
  it('does not let Map SameValueZero invent an equality for NaN IDs',()=>{compare([item(NaN,0),item(NaN,4),item(1,10)]);});
  it('handles empty and single-member arrays',()=>{compare([]);compare([item(1)]);});
  it('conservatively preserves malformed and unbounded geometry',()=>{
    for(const value of [NaN,Infinity,-Infinity,undefined,'4'])compare([item(1,0,{endRight:value}),item(2,4),item(3,5)]);
  });
  it('keeps each request independent',()=>{const current=worker(source()),old=worker(reference);for(const list of [[item(1)],[],[item(2),item(3)],Array.from({length:30},(_,i)=>item(i,i*20))])assert.deepStrictEqual(JSON.parse(JSON.stringify(current.layout(clone(list)))),JSON.parse(JSON.stringify(old.layout(clone(list)))));});
  it('matches deterministic mixed fixtures',()=>{let s=310;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};for(let n=0;n<100;n++){const list=Array.from({length:45},(_,i)=>item(i,Math.floor(random()*40),{height:10+Math.floor(random()*60),layerId:Math.floor(random()*4),isFixed:random()<.4,endRight:45+random()*10,isInvisible:random()<.05}));compare(list,n+1);}});
});

const assert=require('assert'),vm=require('vm');
const {beginSection}=require('../helpers/extractSource');
const reference=require('../fixtures/commentLayoutBeforeDense');
const source=beginSection('packages/zenza/src/commentLayer/CommentLayoutWorker.js');
function factory(code) {
  const math=Object.create(Math),context=vm.createContext({Math:math,Config:{},workerUtil:{},console:{time(){},timeEnd(){}}});
  new vm.Script(code+';globalThis.F=CommentLayoutWorker._func;').runInContext(context);
  const self={};context.F(self);
  return (members,seed=1)=>{
    let state=seed,calls=0;
    math.random=()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const result=self.onmessage({command:'layout',params:{type:members[0]?.type||'naka',members,lastUpdate:123}});
    return {result,calls};
  };
}
const current=factory(source),old=factory(reference);
const item=(i,t=0,extra={})=>({id:i,fork:0,type:'naka',layerId:0,height:24,ypos:0,isFixed:false,isOverflow:false,isInvisible:false,beginLeft:t,beginRight:t+1.4,endLeft:t+2.6,endRight:t+4,...extra});
const clone=members=>members.map(m=>({...m}));
function compare(members,seed=1){const a=old(clone(members),seed),b=current(clone(members),seed);assert.deepStrictEqual(structuredClone(b.result),structuredClone(a.result),'exact output at seed '+seed);assert.strictEqual(b.calls,a.calls,'overflow RNG count at seed '+seed);}
function random(seed){let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function mixed(seed,n=90){const r=random(seed),types=['naka','ue','shita'],layers=[0,1,2,'zenza-ca/0','zenza-ca/1'];return Array.from({length:n},(_,i)=>{const type=types[Math.floor(r()*3)],t=Math.round(r()*30)/4,h=[0,12,24,37.5,80,385][Math.floor(r()*6)],duration=[0,0.01,1,3,4,10,100][Math.floor(r()*7)];return item(i,t,{type,layerId:layers[Math.floor(r()*layers.length)],height:h,ypos:type==='shita'?384-h:Math.floor(r()*3),isFixed:type!=='naka',isInvisible:r()<.07,isOverflow:r()<.03,invisible:r()<.02,beginRight:t+duration*.3,endLeft:t+duration*.7,endRight:t+duration});});}
describe('Task220 exact dense collision compaction',()=>{
  it('removes repeated time-property scans in a dense burst without changing geometry',()=>{
    const data=Array.from({length:1500},(_,i)=>item(i,i/75,{height:18+i%3*4}));
    const measure=fn=>{let reads=0;const rows=data.map(x=>{const c={...x};Object.defineProperty(c,'endRight',{enumerable:true,get(){reads++;return x.endRight;}});return c;});const result=fn(rows,91);return {reads,result};};
    const a=measure(old),b=measure(current);assert.deepStrictEqual(structuredClone(b.result),structuredClone(a.result));
    assert(b.reads<a.reads/2,'time-property reads must fall, before='+a.reads+' after='+b.reads);
  });
  for(const type of ['naka','ue','shita'])for(const spacing of [0,.01,1/75,1,4,10])it('preserves '+type+' spacing '+spacing,()=>{compare(Array.from({length:180},(_,i)=>item(i,i*spacing,{type,isFixed:type!=='naka',height:16+i%4*6,ypos:type==='shita'?354:0})),57);});
  for(const height of [0,.25,1,23,29,80,383,384,385,500])it('preserves boundary height '+height,()=>{compare(Array.from({length:100},(_,i)=>item(i,i/100,{height})),height+3000);});
  it('keeps duplicate identities and first-identity stop position',()=>{const data=Array.from({length:180},(_,i)=>item(i%75,i/75));compare(data,12);});
  it('preserves NaN IDs through the legacy fallback rather than inventing identity',()=>{compare(Array.from({length:60},(_,i)=>item(i%5===0?NaN:i,i/50)),16);});
  it('distinguishes string/number IDs and layers',()=>{compare(Array.from({length:150},(_,i)=>item(i%2?String(i):i,i/75,{layerId:i%2?'0':0})),71);});
  it('preserves the legacy invisible typo as distinct from isInvisible',()=>{compare(Array.from({length:150},(_,i)=>item(i,i/80,{invisible:i%4===0,isInvisible:i%7===0})),53);});
  it('keeps unsorted input order, including early-time comments late in the array',()=>{const r=random(54);compare(Array.from({length:180},(_,i)=>item(i,Math.floor(r()*12))),22);});
  it('does not drop long-lived comments after the typical time window',()=>{const data=Array.from({length:180},(_,i)=>item(i,i/2));data[0].endRight=10000;data[0].beginRight=10000;compare(data,42);});
  it('preserves exact touching boundaries for fixed and moving comments',()=>{const vals=[0,1,1.4,2.6,3,4,4+Number.EPSILON*4];compare(Array.from({length:140},(_,i)=>item(i,vals[i%vals.length],{isFixed:i%2===0})),71);});
  it('conservatively handles non-finite and unusual time values',()=>{for(const value of [NaN,Infinity,-Infinity,undefined,null,'4']){const rows=Array.from({length:90},(_,i)=>item(i,i/30));rows[0].endRight=value;rows[1].beginLeft=value;rows[2].beginRight=value;compare(rows,8);}});
  it('does not mutate additional metadata or reorder the response',()=>{const rows=Array.from({length:100},(_,i)=>item(i,i/75,{tag:'tag-'+i,extra:{keep:i}}));compare(rows,4);});
  it('handles empty, one-element and sparse groups',()=>{compare([]);compare([item(1)]);compare(Array.from({length:500},(_,i)=>item(i,i*10)),19);});
  it('matches 3000 seeded mixtures of times, types, layers, invisible/overflow and dimensions',function(){this.timeout(120000);for(let seed=1;seed<=3000;seed++)compare(mixed(seed,40+seed%80),seed);});
});

describe('Task220 legacy fallback boundaries',()=>{
  it('preserves coercive or nonfinite predecessor geometry through fallback',()=>{for(const extra of [{height:'24'},{height:Infinity},{ypos:NaN}]){const data=Array.from({length:120},(_,i)=>item(i,i/100));Object.assign(data[0],extra);compare(data,4);}});
  it('does not change already-laid-out inputs on a subsequent request differently from legacy',()=>{let a=Array.from({length:120},(_,i)=>item(i,i/100)),b=clone(a);for(let i=0;i<3;i++){const x=old(a,33),y=current(b,33);assert.deepStrictEqual(structuredClone(y.result),structuredClone(x.result));assert.strictEqual(y.calls,x.calls);a=x.result.members;b=y.result.members;}});
});

describe('Task220 measured optimization boundary',()=>{
  it('keeps fixed comments on the original scan path after compaction measured slower',()=>{
    const data=Array.from({length:1000},(_,i)=>item(i,i/20,{type:'ue',isFixed:true}));
    const reads=fn=>{let count=0;const rows=data.map(x=>{const c={...x};Object.defineProperty(c,'endRight',{get(){count++;return x.endRight;}});return c;});fn(rows);return count;};
    assert.strictEqual(reads(current),reads(old));
  });
});

describe('Task220 resumed high-density mixed-layer review',()=>{
  it('matches 600 dense moving fixtures across varying order, long lifetimes and CA layers',function(){
    this.timeout(120000);
    for(let seed=7001;seed<=7600;seed++){
      const r=random(seed),rows=Array.from({length:160+seed%100},(_,i)=>{
        const t=seed%2?i/140:Math.floor(r()*20)/10;
        const h=[.5,3,12,24,48,110][Math.floor(r()*6)];
        const d=[1,3,4,10,80][Math.floor(r()*5)];
        return item(i,t,{height:h,layerId:seed%3?'zenza-ca/'+i%3:0,isInvisible:r()<.05,isOverflow:r()<.02,beginRight:t+d*.35,endLeft:t+d*.65,endRight:t+d});
      });compare(rows,seed);
    }
  });
});

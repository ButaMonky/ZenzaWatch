const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {installUiDiagnostics}=require('./ui-diagnostics.cjs');
test('bounded diagnostic aggregates timings only and releases observers/timers',()=>{
 const w=new JSDOM('',{pretendToBeVisual:true}).window;let now=0,id=0,report;
 const timers=new Map(),frames=new Map(),observers=[];
 w.performance.now=()=>now;w.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};w.clearTimeout=k=>timers.delete(k);
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};w.cancelAnimationFrame=k=>frames.delete(k);
 w.PerformanceObserver=class{static supportedEntryTypes=['event','longtask'];constructor(cb){this.cb=cb;observers.push(this);}observe(){}takeRecords(){return [];}disconnect(){this.closed=true;}};
 const listeners=new Map(),add=w.addEventListener.bind(w),remove=w.removeEventListener.bind(w);
 w.addEventListener=(type,fn,options)=>{if(type==='wheel')listeners.set(type,fn);add(type,fn,options);};
 w.removeEventListener=(type,fn,options)=>{if(listeners.get(type)===fn)listeners.delete(type);remove(type,fn,options);};
 const probe=installUiDiagnostics(w,()=>({sourceAvailable:false}),r=>report=r);
 w.dispatchEvent(new w.Event('pointerdown'));assert.equal(timers.size,0,'synthetic input does not arm capture');
 probe.start();probe.start();assert.equal(observers.length,2);
 listeners.get('wheel')({type:'wheel',isTrusted:true});
 listeners.get('wheel')({type:'wheel',isTrusted:false});
 observers[0].cb({getEntries:()=>[{entryType:'event',name:'click',startTime:10,processingStart:90,processingEnd:120,duration:180,target:'SECRET'}, {entryType:'event',name:'secret input text',duration:10}]});
 observers[1].cb({getEntries:()=>[{entryType:'longtask',duration:100,attribution:[{containerSrc:'SECRET'}]}]});
 now=15000;probe.finish();probe.finish();assert.equal(timers.size,0);assert.equal(frames.size,0);assert.ok(observers.every(o=>o.closed));
 assert.equal(listeners.size,0);assert.equal(report.inputCounts.wheel,1);
 assert.equal(report.events.click.maxInputDelayMs,80);assert.equal(report.events.click.maxHandlerMs,30);assert.equal(report.timing.longTasks,1);
 assert.equal(JSON.stringify(report).includes('SECRET'),false);assert.equal(JSON.stringify(report).includes('secret input'),false);w.close();
});


test('return probe waits without polling, samples once on return and cleans listeners',()=>{
 const w=new JSDOM('',{pretendToBeVisual:true}).window;let now=0,id=0,starts=0,finishes=0,meta;
 const timers=new Map();w.performance.now=()=>now;w.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};w.clearTimeout=k=>timers.delete(k);
 const factory=(_w,metadata)=>{meta=metadata();return {start(){starts++;},finish(){finishes++;}};};
 const probe=require('./ui-diagnostics.cjs').installReturnDiagnostics(w,()=>({remainingPlayerFrames:0}),()=>{},factory);
 assert.equal(timers.size,1);assert.equal(starts,0);
 w.dispatchEvent(new w.Event('focus'));assert.equal(starts,0);
 now=100;w.dispatchEvent(new w.Event('blur'));now=3100;w.dispatchEvent(new w.Event('focus'));
 assert.equal(starts,1);assert.equal(meta.awayMs,3000);assert.equal(meta.phase,'after-return');assert.equal(timers.size,0);
 w.dispatchEvent(new w.Event('blur'));w.dispatchEvent(new w.Event('focus'));assert.equal(starts,1);
 probe.finish();assert.equal(finishes,1);w.close();
});

test('return probe expires and cancelled probes never restart',()=>{
 const w=new JSDOM('',{pretendToBeVisual:true}).window;let callback,starts=0;
 w.setTimeout=fn=>{callback=fn;return 1;};w.clearTimeout=()=>{};
 const factory=()=>({start(){starts++;},finish(){}});
 const make=()=>require('./ui-diagnostics.cjs').installReturnDiagnostics(w,()=>({}),()=>{},factory);
 const probe=make();callback();w.dispatchEvent(new w.Event('blur'));w.dispatchEvent(new w.Event('focus'));assert.equal(starts,0);
 const other=make();other.finish();w.dispatchEvent(new w.Event('blur'));w.dispatchEvent(new w.Event('focus'));assert.equal(starts,0);w.close();
});

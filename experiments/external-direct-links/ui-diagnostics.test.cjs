const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const {installUiDiagnostics}=require('./ui-diagnostics.cjs');
test('bounded diagnostic aggregates timings only and releases observers/timers',()=>{
 const w=new JSDOM('',{pretendToBeVisual:true}).window;let now=0,id=0,report;
 const timers=new Map(),frames=new Map(),observers=[];
 w.performance.now=()=>now;w.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};w.clearTimeout=k=>timers.delete(k);
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};w.cancelAnimationFrame=k=>frames.delete(k);
 w.PerformanceObserver=class{static supportedEntryTypes=['event','longtask'];constructor(cb){this.cb=cb;observers.push(this);}observe(){}takeRecords(){return [];}disconnect(){this.closed=true;}};
 const probe=installUiDiagnostics(w,()=>({sourceAvailable:false}),r=>report=r);
 w.dispatchEvent(new w.Event('pointerdown'));assert.equal(timers.size,0,'synthetic input does not arm capture');
 probe.start();probe.start();assert.equal(observers.length,2);
 observers[0].cb({getEntries:()=>[{entryType:'event',name:'click',startTime:10,processingStart:90,processingEnd:120,duration:180,target:'SECRET'}, {entryType:'event',name:'secret input text',duration:10}]});
 observers[1].cb({getEntries:()=>[{entryType:'longtask',duration:100,attribution:[{containerSrc:'SECRET'}]}]});
 now=15000;probe.finish();probe.finish();assert.equal(timers.size,0);assert.equal(frames.size,0);assert.ok(observers.every(o=>o.closed));
 assert.equal(report.events.click.maxInputDelayMs,80);assert.equal(report.events.click.maxHandlerMs,30);assert.equal(report.timing.longTasks,1);
 assert.equal(JSON.stringify(report).includes('SECRET'),false);assert.equal(JSON.stringify(report).includes('secret input'),false);w.close();
});

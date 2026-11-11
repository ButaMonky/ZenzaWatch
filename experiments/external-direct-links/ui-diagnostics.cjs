'use strict';
// One bounded sample. No target labels, input text, URLs, user IDs or payloads.
function installUiDiagnostics(w,metadata,emit=report=>w.console.info('ZENZA_UI_DIAG',JSON.stringify(report))) {
  let started=false,finished=false,raf,tick,stopTimer,begin,lastFrame,nextTick;
  const inputCounts={}, inputTypes=['pointerdown','click','keydown','wheel','scroll'];
  const countInput=e=>{if(started&&!finished&&e.isTrusted)inputCounts[e.type]=(inputCounts[e.type]||0)+1;};
  const observers=[],events={},timing={frames:0,slowFrames:0,maxFrameGapMs:0,timerSamples:0,maxTimerDelayMs:0,longTasks:0,totalLongTaskMs:0,maxLongTaskMs:0};
  const round=n=>Math.round(n*10)/10;
  function entries(list){for(const entry of list){
    if(entry.entryType==='longtask'){timing.longTasks++;timing.totalLongTaskMs+=entry.duration;timing.maxLongTaskMs=Math.max(timing.maxLongTaskMs,entry.duration);}
    else if(['click','pointerdown','pointerup','keydown'].includes(entry.name)){
      const row=events[entry.name]||(events[entry.name]={count:0,maxInputDelayMs:0,maxHandlerMs:0,maxAfterHandlerMs:0});row.count++;
      row.maxInputDelayMs=Math.max(row.maxInputDelayMs,Math.max(0,entry.processingStart-entry.startTime));
      row.maxHandlerMs=Math.max(row.maxHandlerMs,Math.max(0,entry.processingEnd-entry.processingStart));
      row.maxAfterHandlerMs=Math.max(row.maxAfterHandlerMs,Math.max(0,entry.startTime+entry.duration-entry.processingEnd));
    }
  }}
  function finish(){
    if(!started||finished)return;finished=true;
    w.cancelAnimationFrame?.(raf);w.clearTimeout(tick);w.clearTimeout(stopTimer);
    for(const observer of observers){entries(observer.takeRecords());observer.disconnect();}
    w.removeEventListener('pointerdown',arm,true);w.removeEventListener('pagehide',finish);
    for(const type of inputTypes)w.removeEventListener(type,countInput,true);
    let info;try{info=metadata();}catch(_){info={diagnosticUnavailable:true};}
    emit({version:'external-direct.14',elapsedMs:round(w.performance.now()-begin),hiddenDuringSample,
      inputCounts:{...inputCounts},supported:observers.map(o=>o._diagnosticType),timing:Object.fromEntries(Object.entries(timing).map(([k,v])=>[k,round(v)])),
      events:Object.fromEntries(Object.entries(events).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([n,x])=>[n,round(x)]))])),settings:info});
  }
  let hiddenDuringSample=false;
  function frame(now){if(finished)return;if(w.document.hidden)hiddenDuringSample=true;else if(lastFrame!==undefined){const gap=now-lastFrame;timing.frames++;if(gap>50)timing.slowFrames++;timing.maxFrameGapMs=Math.max(timing.maxFrameGapMs,gap);}lastFrame=now;raf=w.requestAnimationFrame(frame);}
  function timer(){if(finished)return;const now=w.performance.now();if(w.document.hidden)hiddenDuringSample=true;else{timing.timerSamples++;timing.maxTimerDelayMs=Math.max(timing.maxTimerDelayMs,Math.max(0,now-nextTick));}nextTick=now+250;tick=w.setTimeout(timer,250);}
  function start(){
    if(started)return;started=true;w.removeEventListener('pointerdown',arm,true);begin=w.performance.now();nextTick=begin+250;
    for(const type of ['event','longtask']){try{
      if(!w.PerformanceObserver?.supportedEntryTypes?.includes(type))continue;
      const observer=new w.PerformanceObserver(list=>entries(list.getEntries()));observer._diagnosticType=type;
      observer.observe(type==='event'?{type,durationThreshold:16}:{type});observers.push(observer);
    }catch(_){}}
    for(const type of inputTypes)w.addEventListener(type,countInput,{capture:true,passive:true});
    raf=w.requestAnimationFrame?.(frame);tick=w.setTimeout(timer,250);stopTimer=w.setTimeout(finish,15000);
  }
  function arm(event){if(event.isTrusted)start();}
  w.addEventListener('pointerdown',arm,true);w.addEventListener('pagehide',finish);
  return {start,finish};
}
module.exports={installUiDiagnostics};

'use strict';
const assert=require('assert');
const {createContext,run,beginSection}=require('../helpers/extractSource');
describe('SCUI browser native timer receiver',()=>{
 it('uses the browser global receiver for both timer-owning coordinators',()=>{
  const c=createContext();
  run(`globalThis.calls=[];
    globalThis.setTimeout=function(fn,delay){'use strict';
      if(this!==globalThis)throw new TypeError('Illegal invocation');
      calls.push(['set',delay]);return calls.length;};
    globalThis.clearTimeout=function(id){'use strict';
      if(this!==globalThis)throw new TypeError('Illegal invocation');calls.push(['clear',id]);};`,c);
  for(const file of ['SceneSearchInteraction.js','ScenePreviewIdleLimiter.js']){
    run(beginSection('packages/zenza/src/sceneSearch/'+file),c);
  }
  assert.doesNotThrow(()=>run(`
    const controller={snapshot:{pinned:false},show(){},pin(){}};
    const idle=new ScenePreviewIdleLimiter({controller,getSeconds:()=>2});
    idle.seekEnter({clientX:1,clientY:1});idle.dispose();
    const interaction=new SceneSearchInteraction({controller,getPreviewRect:()=>null,
      subscribePointerMove:()=>()=>{}});
    interaction.seekLeave({clientX:1,clientY:1});interaction.dispose();
  `,c));
  assert(c.calls.some(x=>x[0]==='set'&&x[1]===2000));
  assert(c.calls.some(x=>x[0]==='set'&&x[1]===850));
 });
});

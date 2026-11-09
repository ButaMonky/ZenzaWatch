'use strict';
const assert=require('assert');
const {createContext,beginSection,read,run}=require('../helpers/extractSource');
function field(value){
  const listeners=new Set();let blurs=0;
  return {val(v){if(arguments.length){value=v;return this;}return value;},
    blur(){blurs++;return this;},
    on(events,fn){listeners.add(fn);return this;},off(events,fn){listeners.delete(fn);return this;},
    fire(){for(const fn of [...listeners])fn();},get blurs(){return blurs;},get listeners(){return listeners.size;}};
}
function helper(file){
  const raw=read(file),start=raw.indexOf('const CommentSubmitLifetime = (() => {'),end=raw.indexOf('\n})();',start);
  assert(start>=0&&end>start,'runtime helper present');
  const c=createContext({Promise});run(raw.slice(start,end+'\n})();'.length)+';globalThis.Subject=CommentSubmitLifetime;',c);
  return c.Subject;
}
describe('Audit #239: new same-text comment draft is never cleared by old POST',()=>{
  for(const file of ['packages/lib/src/nico/CommentSubmitLifetime.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' retains same-text retyped comment or command draft',async()=>{
      const text=field('repeat'),command=field('184'),pending=[];
      const p={_$commentInput:text,_$commandInput:command,_$view:{addClass(){},removeClass(){}},
        _togglePopover(){},emit(event,control){pending.push(control);}};
      const lifetime=helper(file);
      const wait=lifetime.submit(p);
      text.val('new draft');text.fire();
      text.val('repeat');text.fire();
      command.val('shita');command.fire();
      command.val('184');command.fire();
      assert.strictEqual(lifetime.submit(p),wait,'duplicate in-flight submit is suppressed');
      pending[0].resolve();assert.strictEqual(await wait,true);
      assert.strictEqual(text.val(),'repeat');
      assert.strictEqual(command.val(),'184');
      assert.strictEqual(text.blurs,0);
      assert.strictEqual(command.blurs,0);
      assert.strictEqual(text.listeners,0);
      assert.strictEqual(command.listeners,0);
    });
    it(file+' still clears an unchanged successfully submitted draft',async()=>{
      const text=field('sent'),command=field('184'),pending=[];
      const p={_$commentInput:text,_$commandInput:command,_$view:{addClass(){},removeClass(){}},
        _togglePopover(){},emit(event,control){pending.push(control);}};
      const wait=helper(file).submit(p);pending[0].resolve();
      assert.strictEqual(await wait,true);
      assert.strictEqual(text.val(),'');
      assert.equal(text.blurs,1);
      assert.equal(text.listeners,0);
    });
  }
});

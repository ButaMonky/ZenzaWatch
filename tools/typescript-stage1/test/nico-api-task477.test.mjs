// Task477: NicoVideoApi parity — lazy CrossDomainGate creation and forwarding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.NicoVideoApi;
const before=read(spec.fixture),after=read(spec.runtime);

function globalsFor(host){
  const log=[],holder={instances:[]};
  class CrossDomainGate{
    constructor(options){log.push(['new',options]);this._config={props:{}};holder.instances.push(this);}
    _onCommand(body,sessionId){log.push(['super._onCommand',body,sessionId]);return 'handled:'+body.command;}
    fetch(...a){log.push(['fetch',...a]);return Promise.resolve({status:200,tag:'res'});}
    configBridge(...a){log.push(['configBridge',...a]);return 'bridged';}
    postMessage(...a){log.push(['postMessage',...a]);return 'posted';}
    sendMessage(...a){log.push(['sendMessage',...a]);return 'sent';}
    pushHistory(...a){log.push(['pushHistory',...a]);return 'pushed';}
    bridgeDb(...a){log.push(['bridgeDb',...a]);return Promise.resolve('db');}
  }
  const location={host,href:`https://${host}/watch/sm9?from=1`};
  return {log,holder,globals:{CrossDomainGate,location}};
}
async function compare(label,host,steps){
  const a=globalsFor(host),b=globalsFor(host);
  const A=loadLegacy(before,'NicoVideoApi',a.globals),B=loadLegacy(after,'NicoVideoApi',b.globals);
  for(const [i,step] of steps.entries()){
    const ra=await settle(()=>step(A,a)),rb=await settle(()=>step(B,b));
    assert.deepEqual(snapshot(rb),snapshot(ra),`${label} step ${i}`);
  }
  assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' gate calls');
  assert.equal(b.holder.instances.length,a.holder.instances.length,label+' gate count');
  return [a,b];
}

test('other hosts: one gate, every method forwards args and return values',async()=>{
  const [a]=await compare('live.nicovideo.jp','live.nicovideo.jp',[
    api=>api.fetch('https://www.nicovideo.jp/',{credentials:'include'}),
    api=>api.configBridge({name:'Config'}),
    api=>api.postMessage({a:1},true),
    api=>api.sendMessage({command:'x'},true,'sid'),
    api=>api.pushHistory('/watch/sm9','title'),
    api=>api.bridgeDb({name:'watch'}),
    api=>api.fetch('second-call-reuses-gate')
  ]);
  assert.equal(a.holder.instances.length,1);
});

test('NVGate._onCommand: configSync writes props, other commands go to super',async()=>{
  const gate=(api,g)=>{api.postMessage('init');return g.holder.instances[0];};
  await compare('commands','live.nicovideo.jp',[
    (api,g)=>gate(api,g)._onCommand({command:'configSync',params:{key:'volume',value:0.5}},'s1'),
    (api,g)=>g.holder.instances[0]._config.props,
    (api,g)=>g.holder.instances[0]._onCommand({command:'fetch',status:'ok',params:{url:'u'},value:3},'s2'),
    (api,g)=>g.holder.instances[0]._onCommand({command:'ping'}),
    (api,g)=>g.holder.instances[0]._onCommand({command:'configSync'})
  ]);
});

test('www.nicovideo.jp: no bridge is created and methods are not callable',async()=>{
  await compare('www','www.nicovideo.jp',[
    api=>api.fetch('u'),
    api=>api.pushHistory('/a'),
    api=>api.bridgeDb('x')
  ]);
});

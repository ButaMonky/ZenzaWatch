// Task469: ThumbInfoLoader legacy JavaScript / generated TypeScript parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.ThumbInfoLoader;
const before=read(spec.fixture),after=read(spec.runtime);

function makeWorld(scenario={}){
  const log=[],instances=[];
  const reply=scenario.reply===undefined ? {status:'ok',data:{watchId:'sm9'}} : scenario.reply;
  class CrossDomainGate{
    constructor(options){log.push(['construct',options]);instances.push(this);this.options=options;}
    fetch(url,options){
      log.push(['fetch',url,options]);
      return Object.hasOwn(scenario,'reject') ? Promise.reject(scenario.reject) : Promise.resolve(reply);
    }
  }
  return {globals:{CrossDomainGate,Promise,Error},log,instances,reply};
}

async function parity(label,scenario,steps){
  const left=makeWorld(scenario),right=makeWorld(scenario);
  const old=loadLegacy(before,'ThumbInfoLoader',left.globals);
  const now=loadLegacy(after,'ThumbInfoLoader',right.globals);
  for(const [index,step] of steps.entries()){
    const a=await settle(()=>step(old,left));
    const b=await settle(()=>step(now,right));
    assert.deepEqual(snapshot(b),snapshot(a),`${label} step ${index}`);
  }
  assert.deepEqual(snapshot(right.log),snapshot(left.log),label+' calls/options');
  assert.equal(right.instances.length,left.instances.length,label+' instantiations');
  return {left,right};
}

const load=id=>api=>api.load(id);

test('ThumbInfoLoader: lazy gate, request URL, options and result identity',async()=>{
  const scenario={reply:{status:'ok', data:{xml:'<thumb/>'}}};
  const {left,right}=await parity('load success',scenario,[
    api=>api.initGate(),api=>api.initGate(),load('sm9'),load('so7'),load('sm/a?b=1')
  ]);
  assert.equal(left.instances.length,1);
  assert.equal(right.instances.length,1);
  assert.deepEqual(snapshot(left.log[0][1]),{
    baseUrl:'https://ext.nicovideo.jp/',origin:'https://ext.nicovideo.jp/',type:'thumbInfo'
  });
  assert.equal(left.log.filter(row=>row[0]==='fetch').length,3);
  assert.equal(left.log[1][1],'https://ext.nicovideo.jp/api/getthumbinfo/sm9');
  assert.deepEqual(snapshot(left.log[1][2]),{_format:'text',expireTime:86400000});
});

test('ThumbInfoLoader: remote failures and malformed responses preserve original behavior',async()=>{
  const cases=[
    ['status fail',{reply:{status:'fail',message:'not-found'}}],
    ['status absent',{reply:{message:'no status'}}],
    ['empty text',{reply:{status:'ok',data:''}}],
    ['transport reject',{reject:Error('offline')}],
    ['message empty',{reject:{message:''}}],
    ['message numeric',{reject:{message:17}}],
    ['reject null',{reject:null}],
    ['reply null',{reply:null}]
  ];
  for(const [label,scenario] of cases){
    await parity(label,scenario,[load('sm9'),load(undefined)]);
  }
});

test('ThumbInfoLoader: parser re-export remains available without generator changes',()=>{
  assert.match(before,/export\s*\{\s*ThumbInfoLoader,\s*parseThumbInfo\s*\}/);
  assert.match(after,/import\s*\{parseThumbInfo\}\s*from\s*['"]\.\/parseThumbInfo['"]/);
  assert.match(after,/export\s*\{ThumbInfoLoader,\s*parseThumbInfo\};/);
  assert.equal(spec.shape,'iife');
});

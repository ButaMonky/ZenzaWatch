'use strict';
const fs=require('fs');
const {read,beginSection,extract,createContext,run}=require('./extractSource');
const files={NgCompositeRules:'src/NgCompositeRules.js',Emitter:'packages/lib/src/Emitter.js',
 NicoChatFilter:'packages/zenza/src/commentLayer/NicoChatFilter.js',
 NicoChatGroup:'packages/zenza/src/commentLayer/NicoChatGroup.js',
 NicoComment:'packages/zenza/src/commentLayer/NicoComment.js'};
// Preserve the distribution's real event-handler closure and its static state.
// Keep one text snapshot only; do not retain ASTs or live test contexts.
let emitterSnapshot;
function distEmitter(rel){
 const text=read(rel);
 if(!emitterSnapshot||emitterSnapshot.text!==text){
  let code;
  const ast=require('@babel/parser').parse(text,{sourceType:'unambiguous'});
  require('@babel/traverse').default(ast,{noScope:true,FunctionDeclaration(p){
   if(p.node.id?.name==='EmitterInitFunc'){code=text.slice(p.node.start,p.node.end);p.stop();}
  }});
  if(!code)throw new Error('Distribution EmitterInitFunc was not found');
  emitterSnapshot={text,code:code+'\nconst {Emitter}=EmitterInitFunc();'};
 }
 return emitterSnapshot.code;
}
function load(kind='source',extra={}){
 let networkCalls=0;
 const quiet={log(){},error(){},warn(){},time(){},timeLog(){},timeEnd(){},info(){}};
 const c=createContext({console:quiet,Config:{getValue:()=>false},CommentLayer:{MAX_COMMENT:100000},
  _:{compact:a=>a.filter(Boolean),debounce:fn=>Object.assign(fn,{cancel(){},flush(){}})},
  textUtil:{escapeRegs:s=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')},
  fetch(){networkCalls++;throw new Error('Unexpected network');},
  XMLHttpRequest:class{constructor(){networkCalls++;throw new Error('Unexpected XHR');}},
  WebSocket:class{constructor(){networkCalls++;throw new Error('Unexpected WebSocket');}},
  navigator:{sendBeacon(){networkCalls++;throw new Error('Unexpected beacon');}},...extra});
 let baseline;
 if(kind==='baseline')baseline=JSON.parse(fs.readFileSync(process.env.TASK403_BASELINE,'utf8'));
 for(const [name,path] of Object.entries(files)){
  let code;
  if(kind==='baseline')code=baseline[path];
  else if(kind==='dist'){
   const d='dist/ZenzaWatch-dev.user.js';
   code=name==='Emitter'?distEmitter(d):
    (name==='NgCompositeRules'?'const NG_COLOR_HEX='+extract(d,'NG_COLOR_HEX','var')+';':'')+extract(d,name);
  }else code=beginSection(path);
  run(code+'\nglobalThis.'+name+'='+name+';',c);
 }
 if(kind==='dist'){
  c.NicoChatFilter.SHARED_NG_LEVEL={NONE:'NONE',LOW:'LOW',MID:'MID',HIGH:'HIGH',MAX:'MAX'};
  c.NicoChatFilter.SHARED_NG_SCORE={NONE:-99999,LOW:-10000,MID:-5000,HIGH:-1000,MAX:-1};
 }
 c.NicoChat={TYPE:{TOP:'ue',NAKA:'naka',BOTTOM:'shita'}};
 return {...c,networkCount:()=>networkCalls};
}
let serial=0;
const node=(field,value,cmp='equals',not=false)=>({id:'node'+(++serial),field,value:String(value),cmp,not});
const group=(nodes,mode='all')=>({id:'group'+(++serial),kind:'group',nodes,mode});
function rule(action='hide',conditions=group([node('text','BAN','contains')]),more={}){
 return {id:'rule'+(++serial),name:'synthetic',enabled:true,scope:'normal',phase:'after',
 stopOnMatch:false,conditions,exemptNicoru:false,nicoruMin:1,unknownPolicy:'evaluate',
 keepProtectedOnAuthorHide:true,action,pattern:'BAN',replacement:'SAFE',regexReplace:false,
 flags:'g',strip:['red','big'],normalizeColor:'white',normalizeSize:'medium',dim:50,mask:'***',...more};
}
function chat(no,text='normal',userId='A',type='naka'){
 const p={no,text,userId,type,cmd:type==='naka'?'':type,fork:0,thread:1,
  threadLabel:'default',score:0,nicoru:0,nicoruKnown:true,vpos:no*100,
  color:'#FFFFFF',size:'medium',opacity:1,isDeleted:false,uniqNo:'chat'+no};
 const c={props:p};
 for(const k of Object.keys(p))Object.defineProperty(c,k,{get:()=>p[k],set:v=>{p[k]=v},enumerable:true});
 Object.defineProperty(c,'group',{get:()=>p.group,set:v=>{p.group=v}});
 Object.defineProperty(c,'threadId',{get:()=>p.thread});
 c.onChange=()=>p.group?.onChange({chat:c});
 return c;
}
function runtime(kind,rules,more={},extra={}){
 const c=load(kind,extra),filter=new c.NicoChatFilter({compositeRules:rules,sharedNgLevel:'NONE',...more});
 const model=Object.create(c.NicoComment.prototype);
 const groups=['ue','naka','shita'].map(t=>new c.NicoChatGroup(t,{nicoChatFilter:filter}));
 Object.assign(model,{topGroup:groups[0],nakaGroup:groups[1],bottomGroup:groups[2],_nicoChatFilter:filter,
  _wordReplacer:null,nicoScripter:{isEmpty:true,reset(){}},emit(){}});
 return {c,filter,model,groups};
}
module.exports={load,runtime,node,group,rule,chat};

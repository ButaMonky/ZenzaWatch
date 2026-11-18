'use strict';
const {JSDOM}=require('jsdom');
const parser=require('@babel/parser');
const {EventEmitter}=require('events');
const _=require('lodash');
const {loadClass,createContext,run,read}=require('./extractSource');
function nativePreview(dom){
 const document=dom.window.document,commands=[];
 const wrap=node=>{const list=[node];list.append=other=>{node.append(other[0]||other);return list;};
  list.on=(event,fn,options)=>{node.addEventListener(event,fn,options);return list;};return list;};
 wrap.html=html=>{const t=document.createElement('template');t.innerHTML=html;return wrap(t.content.firstElementChild);};
 const ctx=createContext({document,window:dom.window,Emitter:EventEmitter,_,
  global:dom.window,cssUtil:{registerProps(){},s:v=>v+'s',px:v=>v+'px',
   setProps:(...rows)=>rows.forEach(([node,key,value])=>node.style.setProperty(key,value))},
  throttle:{raf:fn=>{const f=(...args)=>fn(...args);f.cancel=()=>{};return f;}},
  util:{$:wrap,secToTime:sec=>String(sec),StyleSwitcher:{update(){}},
   dispatchCommand:(node,command,value)=>commands.push([command,value])}});
 const src='src/CommentPreview.js'; // Task1063: コメントのプレビューは VideoControlBar.js から分割した
 loadClass(src,'CommentPreviewModel',ctx);
 const View=loadClass(src,'CommentPreviewView',ctx);
 loadClass(src,'CommentPreviewChatItem',ctx);
 // Read complete static assignments; CSS startup wrappers are separate statements.
 const code=read(src);
 const statements=parser.parse(code,{sourceType:'module'}).program.body.filter(node=>
  node.type==='ExpressionStatement' && node.expression.type==='AssignmentExpression' &&
  node.expression.left.type==='MemberExpression' &&
  node.expression.left.object.name==='CommentPreviewView');
 run(statements.map(node=>code.slice(node.start,node.end)).join('\n'),ctx);
 const Preview=loadClass(src,'CommentPreview',ctx);
 const owner=document.createElement('div');document.body.append(owner);
 const preview=new Preview({$container:wrap(owner)});
 return {preview,View,owner,commands,ctx,
  chats:{top:[],bottom:[],naka:Array.from({length:40},(_,i)=>({
   vpos:i*100,uniqNo:'native'+i,text:'行 '+i+'　特殊記号★',no:i+1,date:1600000000,
   userId:'fixture',duration:4,color:i%2?'#ff0000':'#fff',fork:0}))}};
}
module.exports={nativePreview};
